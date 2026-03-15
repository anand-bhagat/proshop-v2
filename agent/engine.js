// agent/engine.js — Agentic Execution Engine
// Implements the tool-calling loop: LLM picks tool -> execute -> feed result back -> repeat.
// Uses the LLM adapter layer from agent/llm/ for provider-agnostic communication.

import { getToolDefinitions, executeTool, getToolEntry } from './registry.js';
import agentConfig from './config.js';
import { getLLMAdapter } from './llm/index.js';
import { buildSystemPrompt } from './llm/prompt-builder.js';
import { trackUsage } from './llm/cost-tracker.js';

// ---------------------------------------------------------------------------
// Tool Status Messages — user-friendly labels for every tool
// ---------------------------------------------------------------------------

const TOOL_STATUS_MESSAGES = {
  // Backend — Products
  get_product: '📱 Looking up product...',
  search_products: '🔍 Searching products...',
  get_top_products: '⭐ Finding top products...',
  create_product: '✏️ Creating product...',
  update_product: '✏️ Updating product...',
  delete_product: '🗑️ Deleting product...',
  submit_review: '⭐ Submitting review...',
  // Backend — Orders
  get_order: '📦 Looking up order...',
  get_my_orders: '📦 Fetching your orders...',
  list_orders: '📋 Loading all orders...',
  mark_order_delivered: '🚚 Marking as delivered...',
  // Backend — Users
  get_user_profile: '👤 Loading profile...',
  get_user: '👤 Looking up user...',
  list_users: '👥 Loading users...',
  update_user_profile: '✏️ Updating profile...',
  update_user: '✏️ Updating user...',
  delete_user: '🗑️ Deleting user...',
  // Frontend — Cart
  add_to_cart: '🛒 Adding to cart...',
  remove_from_cart: '🛒 Removing from cart...',
  clear_cart: '🛒 Clearing cart...',
  // Frontend — Navigation
  navigate_to_login: '🔑 Opening login...',
  navigate_to_register: '📝 Opening registration...',
  navigate_to_checkout: '📦 Opening checkout...',
  navigate_to_profile: '👤 Opening profile...',
  navigate_to_product: '📱 Opening product...',
  navigate_to_cart: '🛒 Opening cart...',
  navigate_to_order: '📋 Opening order details...',
  navigate_to_home: '🏠 Going to home page...',
};

function getToolStatusMessage(toolName) {
  return TOOL_STATUS_MESSAGES[toolName] || '⚙️ Processing...';
}

// ---------------------------------------------------------------------------
// Tool-call param coercion — open-source models often send numbers as strings
// ---------------------------------------------------------------------------

function coerceToolParams(params, toolName) {
  const entry = getToolEntry(toolName);
  const props = entry?.schema?.properties;
  if (!props || !params || typeof params !== 'object') return params;

  const coerced = { ...params };
  for (const [key, prop] of Object.entries(props)) {
    if (!(key in coerced)) continue;
    const val = coerced[key];
    if (prop.type === 'integer' && typeof val === 'string') {
      const n = parseInt(val, 10);
      if (!isNaN(n)) coerced[key] = n;
    } else if (prop.type === 'number' && typeof val === 'string') {
      const n = parseFloat(val);
      if (!isNaN(n)) coerced[key] = n;
    } else if (prop.type === 'boolean' && typeof val === 'string') {
      coerced[key] = val === 'true';
    }
  }
  return coerced;
}

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
        toolCall.params = coerceToolParams(toolCall.params, toolCall.name);

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
  const requestStart = Date.now();
  console.log(`[AGENT ${requestStart}] Request received`);

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
  let llmCallCount = 0;
  let llmTotalMs = 0;
  let toolCallCount = 0;
  let toolTotalMs = 0;

  for (let i = 0; i < maxIterations; i++) {
    try {
      // Status: only emit on first iteration.
      // On subsequent iterations the previous tool status stays visible
      // until text starts streaming (avoids rapid status flicker).
      if (i === 0) {
        // Frontend tool continuation — agent is just wrapping up, not starting fresh
        const initialStatus = frontendResult ? '✍️ Writing response...' : 'Thinking...';
        yield { event: 'status', data: { message: initialStatus } };
      }

      const llmStart = Date.now();
      console.log(`[AGENT ${llmStart}] LLM call #${i + 1} starting`);
      llmCallCount++;

      // Collect the full response from stream for tool call detection
      let fullContent = '';
      const toolCallsInProgress = new Map();
      let usage = null;
      let firstTextDelta = true;
      let firstChunk = true;

      for await (const chunk of adapter.chatStream(truncated, toolDefs)) {
        if (firstChunk) {
          console.log(`[AGENT ${Date.now()}] LLM first token received (${Date.now() - llmStart}ms)`);
          firstChunk = false;
        }

        if (chunk.type === 'text_delta') {
          // On the first text token, emit a "Writing response..." status
          // so the user sees the transition from tool execution to response
          if (firstTextDelta && i > 0) {
            yield { event: 'status', data: { message: 'Writing response...' } };
          }
          firstTextDelta = false;
          fullContent += chunk.content;
          yield { event: 'text_delta', data: { content: chunk.content } };
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

      const llmEnd = Date.now();
      const llmDuration = llmEnd - llmStart;
      llmTotalMs += llmDuration;

      // Track cost
      if (agentConfig.llm.costTracking?.enabled && usage) {
        trackUsage(usage, agentConfig.llm.model, agentConfig.llm.costTracking.pricing);
      }

      // Process tool calls if any
      const toolCalls = [...toolCallsInProgress.values()].map((tc) => ({
        id: tc.id,
        name: tc.name,
        params: coerceToolParams(tc.argsJson ? JSON.parse(tc.argsJson) : {}, tc.name),
      }));

      console.log(`[AGENT ${llmEnd}] LLM response complete - ${toolCalls.length} tool calls (${llmDuration}ms)`);

      if (toolCalls.length > 0) {
        truncated.push({
          role: 'assistant',
          content: fullContent || '',
          tool_calls: toolCalls,
        });

        for (const toolCall of toolCalls) {
          // Status: executing tool
          yield { event: 'status', data: { message: getToolStatusMessage(toolCall.name) } };

          const toolStart = Date.now();
          console.log(`[AGENT ${toolStart}] Executing tool: ${toolCall.name}`);

          const result = await executeTool(toolCall.name, toolCall.params, userContext);

          const toolDuration = Date.now() - toolStart;
          toolCallCount++;
          toolTotalMs += toolDuration;
          console.log(`[AGENT ${Date.now()}] Tool ${toolCall.name} complete (${toolDuration}ms)`);

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
        const totalMs = Date.now() - requestStart;
        console.log(`[AGENT ${Date.now()}] Response sent to client`);
        console.log(`[AGENT] Total: ${totalMs}ms | LLM calls: ${llmCallCount} (${llmTotalMs}ms) | Tool calls: ${toolCallCount} (${toolTotalMs}ms)`);
        yield { event: 'done', data: { conversationId: conversation.id } };
        return;
      }
    } catch (err) {
      const totalMs = Date.now() - requestStart;
      console.log(`[AGENT ${Date.now()}] Error: ${err.message}`);
      console.log(`[AGENT] Total: ${totalMs}ms | LLM calls: ${llmCallCount} (${llmTotalMs}ms) | Tool calls: ${toolCallCount} (${toolTotalMs}ms)`);
      yield { event: 'error', data: { message: `LLM call failed: ${err.message}`, conversationId: conversation.id } };
      return;
    }
  }

  const totalMs = Date.now() - requestStart;
  console.log(`[AGENT ${Date.now()}] Max iterations reached`);
  console.log(`[AGENT] Total: ${totalMs}ms | LLM calls: ${llmCallCount} (${llmTotalMs}ms) | Tool calls: ${toolCallCount} (${toolTotalMs}ms)`);
  yield { event: 'error', data: { message: 'I\'ve been working on this for a while but couldn\'t complete the request. Please try rephrasing your question.', conversationId: conversation.id } };
}

export { runAgent, runAgentStream, setLLMAdapter, getConversation, truncateHistory };
