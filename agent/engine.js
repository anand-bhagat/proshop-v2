// agent/engine.js — Agentic Execution Engine
// Implements the tool-calling loop: LLM picks tool -> execute -> feed result back -> repeat.
// Uses the LLM adapter layer from agent/llm/ for provider-agnostic communication.

import { getToolDefinitions, executeTool, getToolEntry } from './registry.js';
import agentConfig from './config.js';
import { getLLMAdapter } from './llm/index.js';
import { buildSystemPrompt } from './llm/prompt-builder.js';
import { trackUsage } from './llm/cost-tracker.js';

// ---------------------------------------------------------------------------
// Adapter management
// ---------------------------------------------------------------------------

let llmAdapter = null;

/**
 * Set the LLM adapter directly (for testing or manual override).
 * When set, this takes priority over config-based adapter creation.
 */
function setLLMAdapter(adapter) {
  llmAdapter = adapter;
}

/**
 * Get the active LLM adapter — manual override or config-based.
 */
function getAdapter() {
  if (llmAdapter) return llmAdapter;
  return getLLMAdapter(agentConfig.llm);
}

/**
 * Call the LLM via the adapter. Handles cost tracking.
 */
async function callLLM(messages, toolDefs) {
  const adapter = getAdapter();
  const response = await adapter.chat(messages, toolDefs);

  if (agentConfig.llm.costTracking?.enabled && response.usage) {
    trackUsage(response.usage, agentConfig.llm.model, agentConfig.llm.costTracking.pricing);
  }

  return response;
}

// ---------------------------------------------------------------------------
// Conversation Memory
// ---------------------------------------------------------------------------

/** In-memory conversation store. Replace with MongoDB in production (see Conversation model). */
const conversations = new Map();

/**
 * Get or create a conversation.
 */
function getConversation(conversationId) {
  if (conversationId && conversations.has(conversationId)) {
    return conversations.get(conversationId);
  }
  const id = conversationId || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const conv = { id, messages: [], createdAt: new Date() };
  conversations.set(id, conv);
  return conv;
}

/**
 * Truncate conversation history to stay within context limits.
 * Keeps the system prompt (always first) and the last N messages.
 */
function truncateHistory(messages, maxMessages) {
  if (!maxMessages || messages.length <= maxMessages) return messages;
  // Always keep system prompt if present
  const systemMsg = messages[0]?.role === 'system' ? messages[0] : null;
  const nonSystem = systemMsg ? messages.slice(1) : messages;
  const truncated = nonSystem.slice(-maxMessages);
  return systemMsg ? [systemMsg, ...truncated] : truncated;
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

function buildPrompt(toolDefs, userContext) {
  return buildSystemPrompt({
    appName: 'ProShop',
    appDescription:
      'An e-commerce store selling electronics and other products. You help users browse products, manage orders, update profiles, and handle admin tasks.',
    userContext,
    toolDefinitions: toolDefs,
  });
}

// ---------------------------------------------------------------------------
// Core Execution Loop
// ---------------------------------------------------------------------------

/**
 * Run the agentic loop.
 *
 * @param {Object} options
 * @param {string} options.message - The user's message
 * @param {Array}  options.conversationHistory - Previous messages [{role, content}]
 * @param {Object} options.userContext - {userId, role, name}
 * @param {Object} [options.frontendResult] - Result from a frontend tool execution
 * @param {string} [options.conversationId] - Conversation ID for memory persistence
 * @returns {Object} { type, message, toolResults, frontendAction, conversationId }
 */
async function runAgent({ message, conversationHistory = [], userContext, frontendResult, conversationId }) {
  const maxIterations = agentConfig.engine.maxIterations;
  const toolDefs = getToolDefinitions(userContext.role);
  const systemPrompt = buildPrompt(toolDefs, userContext);

  // Conversation memory
  const conversation = getConversation(conversationId);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversation.messages,
    ...conversationHistory,
  ];

  // Truncate to keep within context limits
  const maxHistoryMessages = agentConfig.llm.maxHistoryMessages || 50;
  const truncated = truncateHistory(messages, maxHistoryMessages);

  // If this is a frontend result callback, inject it as a tool result
  if (frontendResult) {
    truncated.push({
      role: 'tool',
      tool_call_id: frontendResult.toolCallId || 'frontend',
      content: JSON.stringify({
        success: frontendResult.success,
        message: frontendResult.message,
        data: frontendResult.data || null,
      }),
    });
  } else {
    truncated.push({ role: 'user', content: message });
    conversation.messages.push({ role: 'user', content: message });
  }

  const toolResults = [];

  for (let i = 0; i < maxIterations; i++) {
    let llmResponse;
    try {
      llmResponse = await callLLM(truncated, toolDefs);
    } catch (err) {
      console.error('LLM call failed:', err);
      return {
        type: 'error',
        message: `LLM call failed: ${err.message}`,
        toolResults,
        conversationId: conversation.id,
      };
    }

    // If LLM wants to call tools
    if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
      // Add assistant message with tool calls to history
      truncated.push({
        role: 'assistant',
        content: llmResponse.content || '',
        tool_calls: llmResponse.toolCalls,
      });

      for (const toolCall of llmResponse.toolCalls) {
        const toolEntry = getToolEntry(toolCall.name);

        // Confirmation flow for destructive tools
        if (toolEntry && toolEntry.confirmBefore && !toolCall.params.__confirmed) {
          return {
            type: 'confirmation_needed',
            tool: toolCall.name,
            params: toolCall.params,
            message: `I'd like to ${toolCall.name.replace(/_/g, ' ')}. Should I proceed?`,
            toolResults,
            conversationId: conversation.id,
          };
        }

        // Execute the tool
        const result = await executeTool(toolCall.name, toolCall.params, userContext);

        // Frontend tool routing — return action to widget
        if (result.type === 'frontend_action') {
          return {
            type: 'frontend_action',
            toolCallId: toolCall.id,
            ...result,
            toolResults,
            conversationId: conversation.id,
          };
        }

        // Confirmation needed (from registry-level check)
        if (result.type === 'confirmation_needed') {
          return { ...result, toolResults, conversationId: conversation.id };
        }

        // Feed result back to LLM
        toolResults.push({
          tool: toolCall.name,
          result,
        });

        truncated.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      continue; // Loop — LLM may need more tools
    }

    // LLM produced a text response — we're done
    if (llmResponse.content) {
      conversation.messages.push({ role: 'assistant', content: llmResponse.content });
      return {
        type: 'response',
        message: llmResponse.content,
        toolResults,
        conversationId: conversation.id,
      };
    }
  }

  // Max iterations reached
  return {
    type: 'response',
    message:
      'I\'ve been working on this for a while but couldn\'t complete the request within the allowed number of steps. Here\'s what I found so far. Please try a more specific question if you need additional details.',
    toolResults,
    conversationId: conversation.id,
  };
}

// ---------------------------------------------------------------------------
// Streaming Execution
// ---------------------------------------------------------------------------

/**
 * Run the agent with streaming responses.
 * Yields SSE-compatible events as the LLM streams its response.
 *
 * @param {Object} options - Same as runAgent()
 * @yields {Object} SSE events: { event, data }
 */
async function* runAgentStream({ message, conversationHistory = [], userContext, frontendResult, conversationId }) {
  const maxIterations = agentConfig.engine.maxIterations;
  const toolDefs = getToolDefinitions(userContext.role);
  const systemPrompt = buildPrompt(toolDefs, userContext);

  const conversation = getConversation(conversationId);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversation.messages,
    ...conversationHistory,
  ];

  const maxHistoryMessages = agentConfig.llm.maxHistoryMessages || 50;
  const truncated = truncateHistory(messages, maxHistoryMessages);

  if (frontendResult) {
    truncated.push({
      role: 'tool',
      tool_call_id: frontendResult.toolCallId || 'frontend',
      content: JSON.stringify({
        success: frontendResult.success,
        message: frontendResult.message,
        data: frontendResult.data || null,
      }),
    });
  } else {
    truncated.push({ role: 'user', content: message });
    conversation.messages.push({ role: 'user', content: message });
  }

  const toolResults = [];
  const adapter = getAdapter();

  for (let i = 0; i < maxIterations; i++) {
    try {
      // Collect the full response from stream for tool call detection
      let fullContent = '';
      const toolCallsInProgress = new Map();
      let usage = null;

      for await (const chunk of adapter.chatStream(truncated, toolDefs)) {
        if (chunk.type === 'text_delta') {
          fullContent += chunk.content;
          yield { event: 'text_delta', data: chunk.content };
        } else if (chunk.type === 'tool_start') {
          toolCallsInProgress.set(chunk.id, { id: chunk.id, name: chunk.name, argsJson: '' });
          yield { event: 'tool_start', data: { name: chunk.name, id: chunk.id } };
        } else if (chunk.type === 'tool_input_delta') {
          // Append to the last tool call's arguments
          const lastToolId = [...toolCallsInProgress.keys()].pop();
          if (lastToolId) {
            toolCallsInProgress.get(lastToolId).argsJson += chunk.content;
          }
        } else if (chunk.type === 'done') {
          usage = chunk.usage;
        }
      }

      // Track cost
      if (agentConfig.llm.costTracking?.enabled && usage) {
        trackUsage(usage, agentConfig.llm.model, agentConfig.llm.costTracking.pricing);
      }

      // Process tool calls if any
      const toolCalls = [...toolCallsInProgress.values()].map((tc) => ({
        id: tc.id,
        name: tc.name,
        params: tc.argsJson ? JSON.parse(tc.argsJson) : {},
      }));

      if (toolCalls.length > 0) {
        truncated.push({
          role: 'assistant',
          content: fullContent || '',
          tool_calls: toolCalls,
        });

        for (const toolCall of toolCalls) {
          const toolEntry = getToolEntry(toolCall.name);

          if (toolEntry && toolEntry.confirmBefore && !toolCall.params.__confirmed) {
            yield {
              event: 'confirmation_needed',
              data: {
                tool: toolCall.name,
                params: toolCall.params,
                message: `I'd like to ${toolCall.name.replace(/_/g, ' ')}. Should I proceed?`,
                conversationId: conversation.id,
              },
            };
            return;
          }

          const result = await executeTool(toolCall.name, toolCall.params, userContext);

          if (result.type === 'frontend_action') {
            yield { event: 'frontend_action', data: { toolCallId: toolCall.id, ...result, conversationId: conversation.id } };
            return;
          }

          toolResults.push({ tool: toolCall.name, result });
          yield { event: 'tool_result', data: { tool: toolCall.name, result } };

          truncated.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        continue;
      }

      // Text-only response — done
      if (fullContent) {
        conversation.messages.push({ role: 'assistant', content: fullContent });
        yield { event: 'done', data: { conversationId: conversation.id } };
        return;
      }
    } catch (err) {
      yield { event: 'error', data: { message: `LLM call failed: ${err.message}`, conversationId: conversation.id } };
      return;
    }
  }

  yield { event: 'error', data: { message: 'I\'ve been working on this for a while but couldn\'t complete the request. Please try rephrasing your question.', conversationId: conversation.id } };
}

export { runAgent, runAgentStream, setLLMAdapter, getConversation, truncateHistory };
