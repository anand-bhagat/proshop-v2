// agent/engine.js — Agentic Execution Engine
// Implements the tool-calling loop: LLM picks tool -> execute -> feed result back -> repeat.
// Uses a placeholder for the LLM call — the real adapter is wired in Phase 7 (LLM-07).

import { getToolDefinitions, executeTool, getToolEntry } from './registry.js';
import agentConfig from './config.js';

// ---------------------------------------------------------------------------
// Placeholder LLM adapter — replaced by real adapter in LLM-07
// ---------------------------------------------------------------------------

let llmAdapter = null;

/**
 * Set the LLM adapter (called once the adapter layer is built).
 */
function setLLMAdapter(adapter) {
  llmAdapter = adapter;
}

/**
 * Placeholder LLM call — returns a simple text response.
 * In production this calls adapter.chat(messages, tools).
 * Returns normalized shape: { content, toolCalls, usage }
 */
async function callLLM(messages, toolDefs) {
  if (llmAdapter) {
    return llmAdapter.chat(messages, toolDefs);
  }

  // Placeholder: echo back a message indicating no LLM adapter is configured
  const lastUserMsg = [...messages]
    .reverse()
    .find((m) => m.role === 'user');

  return {
    content: `[Agent placeholder] I received your message: "${lastUserMsg?.content || ''}" — but no LLM adapter is configured yet. Wire one via setLLMAdapter().`,
    toolCalls: null,
    usage: { inputTokens: 0, outputTokens: 0 },
  };
}

// ---------------------------------------------------------------------------
// System Prompt Builder (minimal — full version in LLM-05)
// ---------------------------------------------------------------------------

function buildSystemPrompt(toolDefs, userContext) {
  const toolList = toolDefs
    .map((t) => `- ${t.name}: ${t.description}`)
    .join('\n');

  return `You are an AI assistant embedded in ProShop, an e-commerce store. You help users by querying and managing their data using the tools available to you.

## Rules
1. ALWAYS use tools to get data. Never make up information.
2. If a query is ambiguous, ask for clarification.
3. For destructive actions (delete, cancel), ALWAYS confirm with the user first.
4. If a tool returns an error, explain the issue clearly. Don't retry more than twice.
5. When showing data, format it clearly (tables for lists, summaries for aggregations).
6. Respect the user's permissions — if a tool returns a permission error, explain that the action requires elevated access.

## Available Tools
${toolList}

## User Context
- User ID: ${userContext.userId || 'anonymous'}
- Role: ${userContext.role || 'guest'}
- Name: ${userContext.name || 'Guest'}`;
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
 * @returns {Object} { type, message, toolResults, frontendAction, conversationId }
 */
async function runAgent({ message, conversationHistory = [], userContext, frontendResult }) {
  const maxIterations = agentConfig.engine.maxIterations;
  const toolDefs = getToolDefinitions(userContext.role);
  const systemPrompt = buildSystemPrompt(toolDefs, userContext);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
  ];

  // If this is a frontend result callback, inject it as a tool result
  if (frontendResult) {
    messages.push({
      role: 'tool',
      tool_call_id: frontendResult.toolCallId || 'frontend',
      content: JSON.stringify({
        success: frontendResult.success,
        message: frontendResult.message,
        data: frontendResult.data || null,
      }),
    });
  } else {
    messages.push({ role: 'user', content: message });
  }

  const toolResults = [];

  for (let i = 0; i < maxIterations; i++) {
    let llmResponse;
    try {
      llmResponse = await callLLM(messages, toolDefs);
    } catch (err) {
      return {
        type: 'error',
        message: `LLM call failed: ${err.message}`,
        toolResults,
      };
    }

    // If LLM wants to call tools
    if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
      // Add assistant message with tool calls to history
      messages.push({
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
          };
        }

        // Confirmation needed (from registry-level check)
        if (result.type === 'confirmation_needed') {
          return { ...result, toolResults };
        }

        // Feed result back to LLM
        toolResults.push({
          tool: toolCall.name,
          result,
        });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      continue; // Loop — LLM may need more tools
    }

    // LLM produced a text response — we're done
    if (llmResponse.content) {
      return {
        type: 'response',
        message: llmResponse.content,
        toolResults,
      };
    }
  }

  // Max iterations reached
  return {
    type: 'response',
    message:
      'I was unable to complete this request within the allowed number of steps. Please try rephrasing your question.',
    toolResults,
  };
}

export { runAgent, setLLMAdapter, buildSystemPrompt };
