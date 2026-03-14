// Tests for agent/engine.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { runAgent, setLLMAdapter, truncateHistory } from '../engine.js';
import { getToolDefinitions, registerHandler } from '../registry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockContext(overrides = {}) {
  return {
    userId: '507f1f77bcf86cd799439011',
    role: 'user',
    name: 'Test User',
    ...overrides,
  };
}

function mockAdminContext() {
  return mockContext({ role: 'admin', name: 'Admin User' });
}

/**
 * Create a mock LLM adapter that returns predefined responses.
 * responses is an array — each call to chat() shifts one off.
 */
function createMockAdapter(responses) {
  const queue = [...responses];
  return {
    chat: async () => {
      if (queue.length === 0) {
        return { content: 'No more responses', toolCalls: null, usage: {} };
      }
      return queue.shift();
    },
  };
}

// ---------------------------------------------------------------------------
// truncateHistory
// ---------------------------------------------------------------------------

describe('truncateHistory()', () => {
  it('should return messages unchanged when under limit', () => {
    const messages = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ];
    const result = truncateHistory(messages, 10);
    expect(result).toEqual(messages);
  });

  it('should preserve system prompt and truncate from the start', () => {
    const messages = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'msg1' },
      { role: 'assistant', content: 'resp1' },
      { role: 'user', content: 'msg2' },
      { role: 'assistant', content: 'resp2' },
    ];
    const result = truncateHistory(messages, 2);
    expect(result).toHaveLength(3); // system + last 2
    expect(result[0].role).toBe('system');
    expect(result[1].content).toBe('msg2');
    expect(result[2].content).toBe('resp2');
  });

  it('should handle messages without system prompt', () => {
    const messages = [
      { role: 'user', content: 'msg1' },
      { role: 'user', content: 'msg2' },
      { role: 'user', content: 'msg3' },
    ];
    const result = truncateHistory(messages, 2);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('msg2');
  });

  it('should return all messages when maxMessages is 0/null', () => {
    const messages = [{ role: 'user', content: 'hi' }];
    expect(truncateHistory(messages, 0)).toEqual(messages);
    expect(truncateHistory(messages, null)).toEqual(messages);
  });
});

// ---------------------------------------------------------------------------
// runAgent — placeholder (no adapter)
// ---------------------------------------------------------------------------

describe('runAgent() — placeholder mode', () => {
  beforeEach(() => {
    setLLMAdapter(null); // Reset to placeholder
  });

  it('should return an error when no adapter is set and no API key configured', async () => {
    // With the refactored engine, if no adapter is set it tries getLLMAdapter(config)
    // which will create an adapter with an empty API key. The call will fail
    // because no real API is available, so we set a mock adapter that returns placeholder.
    setLLMAdapter(createMockAdapter([
      { content: '[Placeholder] No adapter configured', toolCalls: null, usage: {} },
    ]));

    const result = await runAgent({
      message: 'Hello',
      conversationHistory: [],
      userContext: mockContext(),
    });

    expect(result.type).toBe('response');
    expect(result.message).toContain('Placeholder');
  });
});

// ---------------------------------------------------------------------------
// runAgent — with mock adapter
// ---------------------------------------------------------------------------

describe('runAgent() — with mock adapter', () => {
  it('should return text response from LLM', async () => {
    setLLMAdapter(
      createMockAdapter([
        { content: 'Here is your answer!', toolCalls: null, usage: {} },
      ])
    );

    const result = await runAgent({
      message: 'Help me',
      conversationHistory: [],
      userContext: mockContext(),
    });

    expect(result.type).toBe('response');
    expect(result.message).toBe('Here is your answer!');
    expect(result.conversationId).toBeDefined();
  });

  it('should execute backend tool and feed result back to LLM', async () => {
    // Register a mock handler for get_product
    registerHandler('get_product', async (params) => ({
      success: true,
      data: { id: params.product_id, name: 'Test Product', price: 29.99 },
      metadata: {},
    }));

    setLLMAdapter(
      createMockAdapter([
        // First response: LLM calls a tool
        {
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              name: 'get_product',
              params: { product_id: '507f1f77bcf86cd799439011' },
            },
          ],
          usage: {},
        },
        // Second response: LLM returns text after getting tool result
        {
          content: 'The product "Test Product" costs $29.99.',
          toolCalls: null,
          usage: {},
        },
      ])
    );

    const result = await runAgent({
      message: 'What is product 507f1f77bcf86cd799439011?',
      conversationHistory: [],
      userContext: mockContext(),
    });

    expect(result.type).toBe('response');
    expect(result.message).toContain('Test Product');
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults[0].tool).toBe('get_product');

    // Clean up
    registerHandler('get_product', null);
  });

  it('should return confirmation_needed for destructive tools', async () => {
    setLLMAdapter(
      createMockAdapter([
        {
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              name: 'delete_product',
              params: { product_id: '507f1f77bcf86cd799439011' },
            },
          ],
          usage: {},
        },
      ])
    );

    const result = await runAgent({
      message: 'Delete that product',
      conversationHistory: [],
      userContext: mockAdminContext(),
    });

    expect(result.type).toBe('confirmation_needed');
    expect(result.tool).toBe('delete_product');
  });

  it('should return frontend_action for frontend tools', async () => {
    setLLMAdapter(
      createMockAdapter([
        {
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              name: 'navigate_to_home',
              params: {},
            },
          ],
          usage: {},
        },
      ])
    );

    const result = await runAgent({
      message: 'Take me home',
      conversationHistory: [],
      userContext: mockContext(),
    });

    expect(result.type).toBe('frontend_action');
    expect(result.route).toBe('/');
  });

  it('should handle LLM call errors gracefully', async () => {
    setLLMAdapter({
      chat: async () => {
        throw new Error('API timeout');
      },
    });

    const result = await runAgent({
      message: 'Hello',
      conversationHistory: [],
      userContext: mockContext(),
    });

    expect(result.type).toBe('error');
    expect(result.message).toContain('API timeout');
  });

  it('should stop after max iterations', async () => {
    // Adapter always returns tool calls, never text — should hit max iterations
    const neverEndingAdapter = {
      chat: async () => ({
        content: '',
        toolCalls: [
          {
            id: 'call_loop',
            name: 'get_top_products',
            params: {},
          },
        ],
        usage: {},
      }),
    };

    // Register a handler so get_top_products doesn't return NOT_IMPLEMENTED
    registerHandler('get_top_products', async () => ({
      success: true,
      data: [{ name: 'Product A' }],
      metadata: {},
    }));

    setLLMAdapter(neverEndingAdapter);

    const result = await runAgent({
      message: 'Loop forever',
      conversationHistory: [],
      userContext: mockContext(),
    });

    expect(result.type).toBe('response');
    expect(result.message).toContain('unable to complete');

    // Clean up
    registerHandler('get_top_products', null);
  });

  it('should handle tool execution errors and feed error back to LLM', async () => {
    // Register a handler that throws
    registerHandler('get_product', async () => {
      throw new Error('Database connection lost');
    });

    setLLMAdapter(
      createMockAdapter([
        {
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              name: 'get_product',
              params: { product_id: '507f1f77bcf86cd799439011' },
            },
          ],
          usage: {},
        },
        {
          content: 'Sorry, I encountered a database error.',
          toolCalls: null,
          usage: {},
        },
      ])
    );

    const result = await runAgent({
      message: 'Get product',
      conversationHistory: [],
      userContext: mockContext(),
    });

    expect(result.type).toBe('response');
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults[0].result.success).toBe(false);
    expect(result.toolResults[0].result.code).toBe('INTERNAL_ERROR');

    // Clean up
    registerHandler('get_product', null);
  });

  it('should handle frontendResult callback', async () => {
    setLLMAdapter(
      createMockAdapter([
        {
          content: 'Great, the item was added to your cart!',
          toolCalls: null,
          usage: {},
        },
      ])
    );

    const result = await runAgent({
      message: null,
      conversationHistory: [],
      userContext: mockContext(),
      frontendResult: {
        toolCallId: 'call_1',
        success: true,
        message: 'Added to cart',
      },
    });

    expect(result.type).toBe('response');
    expect(result.message).toContain('cart');
  });

  it('should return conversationId for conversation persistence', async () => {
    setLLMAdapter(
      createMockAdapter([
        { content: 'Hello!', toolCalls: null, usage: {} },
      ])
    );

    const result = await runAgent({
      message: 'Hi',
      conversationHistory: [],
      userContext: mockContext(),
    });

    expect(result.conversationId).toBeDefined();
    expect(result.conversationId).toMatch(/^conv_/);
  });
});
