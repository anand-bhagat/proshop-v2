// agent/tests/e2e.test.js — Phase 9 Integration & E2E Tests
// Tests: full chain wiring, permission boundaries, error recovery, multi-tool chains
// Uses mock LLM adapter and mock tool handlers to avoid MongoDB dependency.

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { runAgent, runAgentStream, setLLMAdapter } from '../engine.js';
import { getToolDefinitions, executeTool, getToolEntry, registerHandler } from '../registry.js';
import { buildSystemPrompt } from '../llm/prompt-builder.js';

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

function unauthenticatedContext() {
  return { userId: null, role: null, name: null };
}

/**
 * Create a mock LLM adapter that returns predefined responses.
 * Each call to chat()/chatStream() shifts one response off the queue.
 */
function createMockAdapter(responses) {
  const queue = [...responses];
  const calls = [];
  return {
    chat: async (messages, tools) => {
      calls.push({ messages: [...messages], tools });
      if (queue.length === 0) {
        return { content: 'No more responses queued.', toolCalls: null, usage: { inputTokens: 10, outputTokens: 5 } };
      }
      return queue.shift();
    },
    chatStream: async function* (messages, tools) {
      calls.push({ messages: [...messages], tools });
      if (queue.length === 0) {
        yield { type: 'text_delta', content: 'No more responses queued.' };
        yield { type: 'done', usage: { inputTokens: 10, outputTokens: 5 } };
        return;
      }
      const resp = queue.shift();
      if (resp.toolCalls && resp.toolCalls.length > 0) {
        for (const tc of resp.toolCalls) {
          yield { type: 'tool_start', name: tc.name, id: tc.id };
          yield { type: 'tool_input_delta', content: JSON.stringify(tc.params) };
        }
      }
      if (resp.content) {
        yield { type: 'text_delta', content: resp.content };
      }
      yield { type: 'done', usage: resp.usage || { inputTokens: 10, outputTokens: 5 } };
    },
    getCalls: () => calls,
  };
}

/** Collect all events from an async generator */
async function collectStream(gen) {
  const events = [];
  for await (const chunk of gen) {
    events.push(chunk);
  }
  return events;
}

// ---------------------------------------------------------------------------
// Mock tool handlers — avoid MongoDB dependency
// ---------------------------------------------------------------------------

/** Save original handlers to restore after tests */
const savedHandlers = {};

function mockToolHandler(toolName, handler) {
  const entry = getToolEntry(toolName);
  if (entry) {
    savedHandlers[toolName] = entry.handler;
    registerHandler(toolName, handler);
  }
}

function restoreAllHandlers() {
  for (const [name, handler] of Object.entries(savedHandlers)) {
    registerHandler(name, handler);
  }
  Object.keys(savedHandlers).forEach((k) => delete savedHandlers[k]);
}

// Pre-built mock handlers
const mockHandlers = {
  get_product: async (params) => ({
    success: true,
    data: { _id: params.product_id, name: 'Test Product', price: 29.99, rating: 4.5, countInStock: 10 },
  }),
  search_products: async (params) => ({
    success: true,
    data: [
      { _id: '111111111111111111111111', name: 'Wireless Headphones', price: 45.99, rating: 4.2 },
      { _id: '222222222222222222222222', name: 'Bluetooth Speaker', price: 35.99, rating: 3.8 },
    ],
    metadata: { total: 2, page: params.page || 1, pages: 1 },
  }),
  get_top_products: async () => ({
    success: true,
    data: [
      { _id: '111111111111111111111111', name: 'Top Product 1', rating: 5.0 },
      { _id: '222222222222222222222222', name: 'Top Product 2', rating: 4.8 },
      { _id: '333333333333333333333333', name: 'Top Product 3', rating: 4.5 },
    ],
  }),
  get_my_orders: async () => ({
    success: true,
    data: [
      { _id: 'aaa111111111111111111111', totalPrice: 150, isDelivered: false, isPaid: true },
      { _id: 'bbb222222222222222222222', totalPrice: 300, isDelivered: true, isPaid: true },
    ],
  }),
  get_order: async (params) => ({
    success: true,
    data: { _id: params.order_id, totalPrice: 150, isDelivered: false, isPaid: true, user: { name: 'Test User' } },
  }),
  create_product: async () => ({
    success: true,
    data: { _id: '999999999999999999999999', name: 'Sample Product', price: 0 },
  }),
  update_product: async (params) => ({
    success: true,
    data: { _id: params.product_id, name: params.name || 'Updated', price: params.price || 0 },
  }),
  delete_product: async (params) => ({
    success: true,
    data: { message: `Product ${params.product_id} deleted` },
  }),
  get_user_profile: async () => ({
    success: true,
    data: { _id: '507f1f77bcf86cd799439011', name: 'Test User', email: 'test@test.com' },
  }),
  list_users: async () => ({
    success: true,
    data: [
      { _id: '507f1f77bcf86cd799439011', name: 'User 1', email: 'u1@test.com', isAdmin: false },
      { _id: '507f1f77bcf86cd799439012', name: 'Admin', email: 'admin@test.com', isAdmin: true },
    ],
  }),
  list_orders: async () => ({
    success: true,
    data: [
      { _id: 'aaa111111111111111111111', totalPrice: 150, user: { name: 'User 1' } },
    ],
  }),
  mark_order_delivered: async (params) => ({
    success: true,
    data: { _id: params.order_id, isDelivered: true },
  }),
  submit_review: async () => ({
    success: true,
    data: { message: 'Review submitted' },
  }),
  delete_user: async (params) => ({
    success: true,
    data: { message: `User ${params.user_id} deleted` },
  }),
  update_user: async (params) => ({
    success: true,
    data: { _id: params.user_id, name: params.name || 'Updated' },
  }),
  update_user_profile: async (params) => ({
    success: true,
    data: { name: params.name || 'Test User', email: params.email || 'test@test.com' },
  }),
  get_user: async (params) => ({
    success: true,
    data: { _id: params.user_id, name: 'Some User', email: 'user@test.com' },
  }),
};

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  setLLMAdapter(null);
  // Install mock handlers for all backend tools
  for (const [name, handler] of Object.entries(mockHandlers)) {
    mockToolHandler(name, handler);
  }
});

afterEach(() => {
  setLLMAdapter(null);
  restoreAllHandlers();
});

// ---------------------------------------------------------------------------
// E2E-01: Full Chain Wiring
// ---------------------------------------------------------------------------

describe('E2E-01: Full Chain Wiring', () => {
  it('should wire widget → engine → LLM adapter → text response through full chain', async () => {
    const adapter = createMockAdapter([
      { content: 'Hello! How can I help you today?', toolCalls: null, usage: { inputTokens: 50, outputTokens: 20 } },
    ]);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: 'Hi there',
      userContext: mockContext(),
    });

    expect(result.type).toBe('response');
    expect(result.message).toBe('Hello! How can I help you today?');
    expect(result.conversationId).toBeTruthy();
    expect(adapter.getCalls().length).toBe(1);
  });

  it('should pass user context through to tool execution (auth token flow)', async () => {
    const adapter = createMockAdapter([
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'get_my_orders', params: {} }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
      {
        content: 'You have 2 orders.',
        toolCalls: null,
        usage: { inputTokens: 100, outputTokens: 30 },
      },
    ]);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: 'Show me my orders',
      userContext: mockContext(),
    });

    // The adapter was called twice: first returned tool call, second returned text
    expect(adapter.getCalls().length).toBe(2);
    // The second call should include the tool result in messages
    const secondCallMessages = adapter.getCalls()[1].messages;
    const toolMsg = secondCallMessages.find((m) => m.role === 'tool');
    expect(toolMsg).toBeTruthy();
    expect(toolMsg.tool_call_id).toBe('tc1');
    // Verify the tool result contains order data
    const toolResult = JSON.parse(toolMsg.content);
    expect(toolResult.success).toBe(true);
    expect(toolResult.data.length).toBe(2);
  });

  it('should execute backend tools and return results through full chain', async () => {
    const adapter = createMockAdapter([
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'get_top_products', params: {} }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
      {
        content: 'Here are the top products!',
        toolCalls: null,
        usage: { inputTokens: 100, outputTokens: 30 },
      },
    ]);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: 'Show me top products',
      userContext: mockContext(),
    });

    expect(result.type).toBe('response');
    expect(result.toolResults.length).toBe(1);
    expect(result.toolResults[0].tool).toBe('get_top_products');
    expect(result.toolResults[0].result.success).toBe(true);
    expect(result.toolResults[0].result.data.length).toBe(3);
  });

  it('should route frontend tools back to widget as frontend_action', async () => {
    const adapter = createMockAdapter([
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'navigate_to_checkout', params: {} }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
    ]);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: 'I want to checkout',
      userContext: mockContext(),
    });

    expect(result.type).toBe('frontend_action');
    expect(result.tool).toBe('navigate_to_checkout');
    expect(result.actionType).toBe('navigate');
    expect(result.route).toBe('/shipping');
    expect(result.toolCallId).toBe('tc1');
    expect(result.conversationId).toBeTruthy();
  });

  it('should handle frontend result callback and continue the loop', async () => {
    const adapter = createMockAdapter([
      {
        content: 'Great, I\'ve navigated you to checkout!',
        toolCalls: null,
        usage: { inputTokens: 50, outputTokens: 20 },
      },
    ]);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: null,
      userContext: mockContext(),
      frontendResult: {
        tool: 'navigate_to_checkout',
        toolCallId: 'tc1',
        success: true,
        message: 'Navigated to /shipping',
      },
      conversationId: 'conv_test_123',
    });

    expect(result.type).toBe('response');
    expect(result.message).toContain('checkout');
    // Verify the frontend result was injected as a tool message
    const callMessages = adapter.getCalls()[0].messages;
    const toolMsg = callMessages.find((m) => m.role === 'tool');
    expect(toolMsg).toBeTruthy();
    expect(toolMsg.tool_call_id).toBe('tc1');
  });

  it('should maintain conversationId across multiple messages', async () => {
    const adapter1 = createMockAdapter([
      { content: 'Response 1', toolCalls: null, usage: { inputTokens: 50, outputTokens: 20 } },
    ]);
    setLLMAdapter(adapter1);

    const result1 = await runAgent({
      message: 'Hello',
      userContext: mockContext(),
    });
    const convId = result1.conversationId;
    expect(convId).toBeTruthy();

    // Second message with same conversationId
    const adapter2 = createMockAdapter([
      { content: 'Response 2', toolCalls: null, usage: { inputTokens: 50, outputTokens: 20 } },
    ]);
    setLLMAdapter(adapter2);

    const result2 = await runAgent({
      message: 'Follow up',
      userContext: mockContext(),
      conversationId: convId,
    });

    expect(result2.conversationId).toBe(convId);
    // Conversation history should include previous messages
    const callMessages = adapter2.getCalls()[0].messages;
    const userMsgs = callMessages.filter((m) => m.role === 'user');
    expect(userMsgs.length).toBe(2); // 'Hello' and 'Follow up'
  });

  it('should stream events through full chain', async () => {
    const adapter = createMockAdapter([
      { content: 'Streaming response here', toolCalls: null, usage: { inputTokens: 50, outputTokens: 20 } },
    ]);
    setLLMAdapter(adapter);

    const events = await collectStream(
      runAgentStream({
        message: 'Hi',
        userContext: mockContext(),
      })
    );

    const textEvents = events.filter((e) => e.event === 'text_delta');
    const doneEvents = events.filter((e) => e.event === 'done');
    expect(textEvents.length).toBeGreaterThan(0);
    expect(doneEvents.length).toBe(1);
    expect(doneEvents[0].data.conversationId).toBeTruthy();
  });

  it('should stream tool results through full chain', async () => {
    const adapter = createMockAdapter([
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'get_top_products', params: {} }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
      {
        content: 'Here are the top products from streaming!',
        toolCalls: null,
        usage: { inputTokens: 100, outputTokens: 30 },
      },
    ]);
    setLLMAdapter(adapter);

    const events = await collectStream(
      runAgentStream({
        message: 'Show top products',
        userContext: mockContext(),
      })
    );

    const toolStartEvents = events.filter((e) => e.event === 'tool_start');
    const toolResultEvents = events.filter((e) => e.event === 'tool_result');
    expect(toolStartEvents.length).toBe(1);
    expect(toolStartEvents[0].data.name).toBe('get_top_products');
    expect(toolResultEvents.length).toBe(1);
    expect(toolResultEvents[0].data.result.success).toBe(true);
  });

  it('should stream frontend_action event with conversationId', async () => {
    const adapter = createMockAdapter([
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'add_to_cart', params: { product_id: '507f1f77bcf86cd799439011', qty: 1 } }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
    ]);
    setLLMAdapter(adapter);

    const events = await collectStream(
      runAgentStream({
        message: 'Add to cart',
        userContext: mockContext(),
      })
    );

    const feEvents = events.filter((e) => e.event === 'frontend_action');
    expect(feEvents.length).toBe(1);
    expect(feEvents[0].data.tool).toBe('add_to_cart');
    expect(feEvents[0].data.conversationId).toBeTruthy();
    expect(feEvents[0].data.toolCallId).toBe('tc1');
  });
});

// ---------------------------------------------------------------------------
// E2E-02: System Prompt Tuning
// ---------------------------------------------------------------------------

describe('E2E-02: System Prompt Tuning', () => {
  it('should include tool selection guide in system prompt', () => {
    const toolDefs = getToolDefinitions('user');
    const prompt = buildSystemPrompt({
      appName: 'ProShop',
      appDescription: 'An e-commerce store.',
      userContext: mockContext(),
      toolDefinitions: toolDefs,
    });

    expect(prompt).toContain('Tool Selection Guide');
    expect(prompt).toContain('search_products');
    expect(prompt).toContain('get_my_orders');
    expect(prompt).toContain('add_to_cart');
    expect(prompt).toContain('navigate_to_');
  });

  it('should include multi-tool query guidance', () => {
    const toolDefs = getToolDefinitions('user');
    const prompt = buildSystemPrompt({
      appName: 'ProShop',
      appDescription: 'An e-commerce store.',
      userContext: mockContext(),
      toolDefinitions: toolDefs,
    });

    expect(prompt).toContain('Multi-Tool Queries');
    expect(prompt).toContain('chain tool calls');
  });

  it('should include out-of-scope instructions', () => {
    const toolDefs = getToolDefinitions('user');
    const prompt = buildSystemPrompt({
      appName: 'ProShop',
      appDescription: 'An e-commerce store.',
      userContext: mockContext(),
      toolDefinitions: toolDefs,
    });

    expect(prompt).toContain('Out of Scope');
    expect(prompt).toContain('weather');
  });

  it('should include user context in prompt', () => {
    const ctx = mockContext({ name: 'John Doe', role: 'admin' });
    const toolDefs = getToolDefinitions('admin');
    const prompt = buildSystemPrompt({
      appName: 'ProShop',
      appDescription: 'An e-commerce store.',
      userContext: ctx,
      toolDefinitions: toolDefs,
    });

    expect(prompt).toContain('John Doe');
    expect(prompt).toContain('admin');
  });

  it('should include all 28 tool definitions in admin prompt', () => {
    const toolDefs = getToolDefinitions('admin');
    const prompt = buildSystemPrompt({
      appName: 'ProShop',
      appDescription: 'An e-commerce store.',
      userContext: mockAdminContext(),
      toolDefinitions: toolDefs,
    });

    const expectedTools = [
      'get_product', 'search_products', 'get_top_products', 'create_product',
      'update_product', 'delete_product', 'submit_review',
      'get_order', 'get_my_orders', 'list_orders', 'mark_order_delivered',
      'get_user_profile', 'list_users', 'get_user', 'update_user_profile', 'update_user', 'delete_user',
      'add_to_cart', 'remove_from_cart', 'clear_cart',
      'navigate_to_login', 'navigate_to_register', 'navigate_to_checkout',
      'navigate_to_profile', 'navigate_to_product', 'navigate_to_cart',
      'navigate_to_order', 'navigate_to_home',
    ];

    for (const tool of expectedTools) {
      expect(prompt).toContain(tool);
    }
  });

  it('should include confirmation behavior rules', () => {
    const toolDefs = getToolDefinitions('user');
    const prompt = buildSystemPrompt({
      appName: 'ProShop',
      appDescription: 'An e-commerce store.',
      userContext: mockContext(),
      toolDefinitions: toolDefs,
    });

    expect(prompt).toContain('destructive');
    expect(prompt).toContain('confirmation');
  });

  it('should include frontend action explanation', () => {
    const toolDefs = getToolDefinitions('user');
    const prompt = buildSystemPrompt({
      appName: 'ProShop',
      appDescription: 'An e-commerce store.',
      userContext: mockContext(),
      toolDefinitions: toolDefs,
    });

    expect(prompt).toContain('Frontend Actions');
    expect(prompt).toContain('browser');
  });

  it('should include price-related search guidance', () => {
    const toolDefs = getToolDefinitions('user');
    const prompt = buildSystemPrompt({
      appName: 'ProShop',
      appDescription: 'An e-commerce store.',
      userContext: mockContext(),
      toolDefinitions: toolDefs,
    });

    expect(prompt).toContain('under $50');
  });
});

// ---------------------------------------------------------------------------
// E2E-03: Permission Boundary Tests
// ---------------------------------------------------------------------------

describe('E2E-03: Permission Boundaries', () => {
  it('should exclude admin tools from regular user tool definitions', () => {
    const userTools = getToolDefinitions('user');
    const toolNames = userTools.map((t) => t.name);

    // Admin-only tools should NOT be present
    expect(toolNames).not.toContain('create_product');
    expect(toolNames).not.toContain('delete_product');
    expect(toolNames).not.toContain('update_product');
    expect(toolNames).not.toContain('list_users');
    expect(toolNames).not.toContain('get_user');
    expect(toolNames).not.toContain('update_user');
    expect(toolNames).not.toContain('delete_user');
    expect(toolNames).not.toContain('list_orders');
    expect(toolNames).not.toContain('mark_order_delivered');

    // Public/authenticated tools SHOULD be present
    expect(toolNames).toContain('get_product');
    expect(toolNames).toContain('search_products');
    expect(toolNames).toContain('get_top_products');
    expect(toolNames).toContain('get_my_orders');
    expect(toolNames).toContain('get_order');
    expect(toolNames).toContain('get_user_profile');
    expect(toolNames).toContain('submit_review');
    expect(toolNames).toContain('add_to_cart');
    expect(toolNames).toContain('navigate_to_checkout');
  });

  it('should include all tools for admin users', () => {
    const adminTools = getToolDefinitions('admin');
    const toolNames = adminTools.map((t) => t.name);

    expect(toolNames).toContain('create_product');
    expect(toolNames).toContain('delete_product');
    expect(toolNames).toContain('list_users');
    expect(toolNames).toContain('delete_user');
    expect(toolNames).toContain('list_orders');
    expect(toolNames).toContain('mark_order_delivered');
    // Admin also gets regular user tools
    expect(toolNames).toContain('get_product');
    expect(toolNames).toContain('get_my_orders');
    expect(toolNames).toContain('add_to_cart');
  });

  it('should return permission error when regular user calls admin tool (create_product)', async () => {
    const result = await executeTool('create_product', {}, mockContext());
    expect(result.success).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
  });

  it('should return permission error when regular user calls delete_product', async () => {
    const result = await executeTool('delete_product', { product_id: '507f1f77bcf86cd799439011', __confirmed: true }, mockContext());
    expect(result.success).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
  });

  it('should return permission error when regular user calls list_users', async () => {
    const result = await executeTool('list_users', {}, mockContext());
    expect(result.success).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
  });

  it('should return permission error when regular user calls update_user', async () => {
    const result = await executeTool('update_user', { user_id: '507f1f77bcf86cd799439011', name: 'Hacked' }, mockContext());
    expect(result.success).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
  });

  it('should return permission error when regular user calls list_orders', async () => {
    const result = await executeTool('list_orders', {}, mockContext());
    expect(result.success).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
  });

  it('should return permission error when regular user calls mark_order_delivered', async () => {
    const result = await executeTool('mark_order_delivered', { order_id: '507f1f77bcf86cd799439011' }, mockContext());
    expect(result.success).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
  });

  it('should only show public tools for unauthenticated users', () => {
    const publicTools = getToolDefinitions(null);
    const toolNames = publicTools.map((t) => t.name);

    // Public tools should be present
    expect(toolNames).toContain('get_product');
    expect(toolNames).toContain('search_products');
    expect(toolNames).toContain('get_top_products');
    expect(toolNames).toContain('add_to_cart');
    expect(toolNames).toContain('navigate_to_login');
    expect(toolNames).toContain('navigate_to_home');

    // Authenticated/admin tools should NOT be present
    expect(toolNames).not.toContain('get_my_orders');
    expect(toolNames).not.toContain('get_order');
    expect(toolNames).not.toContain('get_user_profile');
    expect(toolNames).not.toContain('submit_review');
    expect(toolNames).not.toContain('navigate_to_checkout');
    expect(toolNames).not.toContain('navigate_to_profile');
  });

  it('should return permission error when unauthenticated user calls authenticated tool', async () => {
    const result = await executeTool('get_my_orders', {}, unauthenticatedContext());
    expect(result.success).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
  });

  it('should return clear permission error message for LLM to relay', async () => {
    const result = await executeTool('create_product', {}, mockContext());
    expect(result.error).toBeTruthy();
    expect(typeof result.error).toBe('string');
    expect(result.error.length).toBeGreaterThan(0);
  });

  it('should feed permission error back to LLM when user tries admin tool via engine', async () => {
    const adapter = createMockAdapter([
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'list_users', params: {} }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
      {
        content: 'I\'m sorry, but you need admin access to view the user list.',
        toolCalls: null,
        usage: { inputTokens: 100, outputTokens: 30 },
      },
    ]);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: 'List all users',
      userContext: mockContext(), // regular user
    });

    // LLM received the permission error and responded appropriately
    expect(result.type).toBe('response');
    const secondCallMessages = adapter.getCalls()[1].messages;
    const toolMsg = secondCallMessages.find((m) => m.role === 'tool');
    expect(toolMsg).toBeTruthy();
    const toolResult = JSON.parse(toolMsg.content);
    expect(toolResult.success).toBe(false);
    expect(toolResult.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// E2E-04: Error & Recovery Tests
// ---------------------------------------------------------------------------

describe('E2E-04: Error & Recovery', () => {
  it('should return tool validation error to LLM for self-correction', async () => {
    const adapter = createMockAdapter([
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'get_product', params: { product_id: 'invalid!' } }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
      {
        content: 'Sorry, that ID is invalid. Could you provide a valid product ID?',
        toolCalls: null,
        usage: { inputTokens: 100, outputTokens: 30 },
      },
    ]);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: 'Get product invalid!',
      userContext: mockContext(),
    });

    expect(result.type).toBe('response');
    expect(adapter.getCalls().length).toBe(2);

    // Verify the validation error was fed back
    const secondCallMessages = adapter.getCalls()[1].messages;
    const toolMsg = secondCallMessages.find((m) => m.role === 'tool');
    expect(toolMsg).toBeTruthy();
    const toolResult = JSON.parse(toolMsg.content);
    expect(toolResult.success).toBe(false);
    expect(toolResult.code).toBe('INVALID_PARAM');
  });

  it('should handle LLM API timeout gracefully', async () => {
    setLLMAdapter({
      chat: async () => {
        throw new Error('Request timed out after 30000ms');
      },
    });

    const result = await runAgent({
      message: 'Hello',
      userContext: mockContext(),
    });

    expect(result.type).toBe('error');
    expect(result.message).toContain('timed out');
    expect(result.conversationId).toBeTruthy();
  });

  it('should handle LLM API network error gracefully', async () => {
    setLLMAdapter({
      chat: async () => {
        throw new Error('ECONNREFUSED');
      },
    });

    const result = await runAgent({
      message: 'Hello',
      userContext: mockContext(),
    });

    expect(result.type).toBe('error');
    expect(result.message).toContain('LLM call failed');
  });

  it('should stop gracefully when max iterations reached', async () => {
    // Create adapter that always calls tools, never produces text
    const endlessToolCalls = Array.from({ length: 15 }, (_, i) => ({
      content: null,
      toolCalls: [{ id: `tc${i}`, name: 'get_top_products', params: {} }],
      usage: { inputTokens: 50, outputTokens: 20 },
    }));
    const adapter = createMockAdapter(endlessToolCalls);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: 'Keep searching',
      userContext: mockContext(),
    });

    expect(result.type).toBe('response');
    expect(result.message).toContain('allowed number of steps');
    // Should have stopped at maxIterations (10)
    expect(adapter.getCalls().length).toBeLessThanOrEqual(10);
  });

  it('should handle streaming LLM error gracefully', async () => {
    setLLMAdapter({
      chat: async () => { throw new Error('test'); },
      chatStream: async function* () {
        throw new Error('Stream connection failed');
      },
    });

    const events = await collectStream(
      runAgentStream({
        message: 'Hello',
        userContext: mockContext(),
      })
    );

    const errorEvents = events.filter((e) => e.event === 'error');
    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0].data.message).toContain('Stream connection failed');
    expect(errorEvents[0].data.conversationId).toBeTruthy();
  });

  it('should handle unknown tool call gracefully', async () => {
    const adapter = createMockAdapter([
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'nonexistent_tool', params: {} }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
      {
        content: 'I tried to use a tool that doesn\'t exist. Let me help you another way.',
        toolCalls: null,
        usage: { inputTokens: 100, outputTokens: 30 },
      },
    ]);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: 'Do something weird',
      userContext: mockContext(),
    });

    expect(result.type).toBe('response');
    const secondCallMessages = adapter.getCalls()[1].messages;
    const toolMsg = secondCallMessages.find((m) => m.role === 'tool');
    expect(toolMsg).toBeTruthy();
    const toolResult = JSON.parse(toolMsg.content);
    expect(toolResult.success).toBe(false);
    expect(toolResult.code).toBe('NOT_FOUND');
  });

  it('should handle tool execution exception and feed error to LLM', async () => {
    // Override get_product to throw an error
    mockToolHandler('get_product', async () => {
      throw new Error('Database connection lost');
    });

    const adapter = createMockAdapter([
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'get_product', params: { product_id: '507f1f77bcf86cd799439011' } }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
      {
        content: 'I encountered a database error. Please try again later.',
        toolCalls: null,
        usage: { inputTokens: 100, outputTokens: 30 },
      },
    ]);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: 'Get product X',
      userContext: mockContext(),
    });

    expect(result.type).toBe('response');
    expect(adapter.getCalls().length).toBe(2);
    // The error was caught and fed back to the LLM
    const secondCallMessages = adapter.getCalls()[1].messages;
    const toolMsg = secondCallMessages.find((m) => m.role === 'tool');
    const toolResult = JSON.parse(toolMsg.content);
    expect(toolResult.success).toBe(false);
    expect(toolResult.code).toBe('INTERNAL_ERROR');
  });

  it('should include max-iterations message in streaming', async () => {
    const endlessToolCalls = Array.from({ length: 15 }, (_, i) => ({
      content: null,
      toolCalls: [{ id: `tc${i}`, name: 'get_top_products', params: {} }],
      usage: { inputTokens: 50, outputTokens: 20 },
    }));
    const adapter = createMockAdapter(endlessToolCalls);
    setLLMAdapter(adapter);

    const events = await collectStream(
      runAgentStream({
        message: 'Keep going forever',
        userContext: mockContext(),
      })
    );

    const errorEvents = events.filter((e) => e.event === 'error');
    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0].data.message).toContain('couldn\'t complete');
  });
});

// ---------------------------------------------------------------------------
// E2E-05: Multi-Tool Chain Tests
// ---------------------------------------------------------------------------

describe('E2E-05: Multi-Tool Chains', () => {
  it('should chain get_my_orders + LLM aggregation for "pending orders and total"', async () => {
    const adapter = createMockAdapter([
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'get_my_orders', params: {} }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
      {
        content: 'You have 2 orders totaling $450.00. 1 is pending delivery.',
        toolCalls: null,
        usage: { inputTokens: 200, outputTokens: 50 },
      },
    ]);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: 'What are my pending orders and their total value?',
      userContext: mockContext(),
    });

    expect(result.type).toBe('response');
    expect(result.toolResults.length).toBe(1);
    expect(result.toolResults[0].tool).toBe('get_my_orders');
    expect(result.toolResults[0].result.success).toBe(true);
    expect(adapter.getCalls().length).toBe(2);
  });

  it('should chain search_products + add_to_cart (frontend action)', async () => {
    const adapter = createMockAdapter([
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'search_products', params: { keyword: 'headphones' } }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
      {
        content: null,
        toolCalls: [{ id: 'tc2', name: 'add_to_cart', params: { product_id: '111111111111111111111111', qty: 1 } }],
        usage: { inputTokens: 200, outputTokens: 30 },
      },
    ]);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: 'Find wireless headphones and add the best one to my cart',
      userContext: mockContext(),
    });

    // First tool (search) executed as backend, second (cart) returns as frontend_action
    expect(adapter.getCalls().length).toBe(2);
    expect(result.toolResults.length).toBe(1);
    expect(result.toolResults[0].tool).toBe('search_products');
    expect(result.type).toBe('frontend_action');
    expect(result.tool).toBe('add_to_cart');
  });

  it('should handle 3+ sequential tool calls', async () => {
    const adapter = createMockAdapter([
      // Step 1: search products
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'search_products', params: { keyword: 'laptop' } }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
      // Step 2: get top products for comparison
      {
        content: null,
        toolCalls: [{ id: 'tc2', name: 'get_top_products', params: {} }],
        usage: { inputTokens: 200, outputTokens: 30 },
      },
      // Step 3: get specific product details
      {
        content: null,
        toolCalls: [{ id: 'tc3', name: 'get_product', params: { product_id: '111111111111111111111111' } }],
        usage: { inputTokens: 300, outputTokens: 30 },
      },
      // Step 4: text response
      {
        content: 'Based on my research, the best laptop is the Wireless Headphones at $45.99.',
        toolCalls: null,
        usage: { inputTokens: 400, outputTokens: 50 },
      },
    ]);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: 'Find the best laptop and tell me about it',
      userContext: mockContext(),
    });

    expect(result.type).toBe('response');
    expect(adapter.getCalls().length).toBe(4);
    expect(result.toolResults.length).toBe(3);
    expect(result.toolResults[0].tool).toBe('search_products');
    expect(result.toolResults[1].tool).toBe('get_top_products');
    expect(result.toolResults[2].tool).toBe('get_product');
  });

  it('should handle confirmation flow in multi-tool chain', async () => {
    const adapter = createMockAdapter([
      // Step 1: search to find the product
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'search_products', params: { keyword: 'sample' } }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
      // Step 2: delete requires confirmation
      {
        content: null,
        toolCalls: [{ id: 'tc2', name: 'delete_product', params: { product_id: '111111111111111111111111' } }],
        usage: { inputTokens: 200, outputTokens: 30 },
      },
    ]);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: 'Delete the sample product',
      userContext: mockAdminContext(),
    });

    // Engine should pause at confirmation
    expect(result.type).toBe('confirmation_needed');
    expect(result.tool).toBe('delete_product');
    expect(result.toolResults.length).toBe(1);
    expect(result.toolResults[0].tool).toBe('search_products');
  });

  it('should chain tools correctly without human intervention between calls', async () => {
    const adapter = createMockAdapter([
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'get_my_orders', params: {} }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
      {
        content: null,
        toolCalls: [{ id: 'tc2', name: 'get_order', params: { order_id: 'aaa111111111111111111111' } }],
        usage: { inputTokens: 200, outputTokens: 30 },
      },
      {
        content: 'Your latest order (total $150) has not been delivered yet.',
        toolCalls: null,
        usage: { inputTokens: 300, outputTokens: 50 },
      },
    ]);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: 'Show me my latest order and tell me if it\'s been delivered',
      userContext: mockContext(),
    });

    expect(result.type).toBe('response');
    expect(adapter.getCalls().length).toBe(3);
    expect(result.toolResults.length).toBe(2);
    expect(result.toolResults[0].tool).toBe('get_my_orders');
    expect(result.toolResults[1].tool).toBe('get_order');
  });

  it('should handle create_product + update_product chain for admin', async () => {
    const adapter = createMockAdapter([
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'create_product', params: {} }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
      {
        content: null,
        toolCalls: [{
          id: 'tc2',
          name: 'update_product',
          params: { product_id: '999999999999999999999999', name: 'Widget X', price: 29.99 },
        }],
        usage: { inputTokens: 200, outputTokens: 30 },
      },
      {
        content: 'Created a new product "Widget X" priced at $29.99!',
        toolCalls: null,
        usage: { inputTokens: 300, outputTokens: 50 },
      },
    ]);
    setLLMAdapter(adapter);

    const result = await runAgent({
      message: 'Create a new product called Widget X priced at $29.99',
      userContext: mockAdminContext(),
    });

    expect(result.type).toBe('response');
    expect(adapter.getCalls().length).toBe(3);
    expect(result.toolResults[0].tool).toBe('create_product');
    expect(result.toolResults[0].result.success).toBe(true);
    expect(result.toolResults[1].tool).toBe('update_product');
    expect(result.toolResults[1].result.success).toBe(true);
  });

  it('should handle mixed backend + frontend tool chain in streaming', async () => {
    const adapter = createMockAdapter([
      // First: search (backend tool)
      {
        content: null,
        toolCalls: [{ id: 'tc1', name: 'search_products', params: { keyword: 'headphones' } }],
        usage: { inputTokens: 50, outputTokens: 20 },
      },
      // Second: add_to_cart (frontend tool) — ends stream with frontend_action
      {
        content: null,
        toolCalls: [{ id: 'tc2', name: 'add_to_cart', params: { product_id: '111111111111111111111111', qty: 2 } }],
        usage: { inputTokens: 200, outputTokens: 30 },
      },
    ]);
    setLLMAdapter(adapter);

    const events = await collectStream(
      runAgentStream({
        message: 'Find headphones under $50 and add the best one to cart',
        userContext: mockContext(),
      })
    );

    // Should have tool_result for search, then frontend_action for cart
    const toolResultEvents = events.filter((e) => e.event === 'tool_result');
    const feEvents = events.filter((e) => e.event === 'frontend_action');
    expect(toolResultEvents.length).toBe(1);
    expect(toolResultEvents[0].data.tool).toBe('search_products');
    expect(feEvents.length).toBe(1);
    expect(feEvents[0].data.tool).toBe('add_to_cart');
  });
});

// ---------------------------------------------------------------------------
// Additional Integration Tests
// ---------------------------------------------------------------------------

describe('E2E: Additional integration checks', () => {
  it('should have confirmBefore flag on destructive tools', () => {
    expect(getToolEntry('delete_product').confirmBefore).toBe(true);
    expect(getToolEntry('delete_user').confirmBefore).toBe(true);
    expect(getToolEntry('get_product').confirmBefore).toBe(false);
    expect(getToolEntry('update_product').confirmBefore).toBe(false);
  });

  it('should return confirmation_needed from executeTool for destructive tools without __confirmed', async () => {
    const result = await executeTool('delete_product', { product_id: '507f1f77bcf86cd799439011' }, mockAdminContext());
    expect(result.type).toBe('confirmation_needed');
    expect(result.tool).toBe('delete_product');
    expect(result.message).toBeTruthy();
  });

  it('should execute destructive tool when __confirmed is true', async () => {
    const result = await executeTool('delete_product', { product_id: '507f1f77bcf86cd799439011', __confirmed: true }, mockAdminContext());
    expect(result.success).toBe(true);
  });

  it('should route frontend dispatch tools correctly', async () => {
    const result = await executeTool('add_to_cart', { product_id: '507f1f77bcf86cd799439011', qty: 1 }, mockContext());
    expect(result.type).toBe('frontend_action');
    expect(result.actionType).toBe('dispatch');
    expect(result.action).toBe('addToCart');
    expect(result.store).toBe('cart');
  });

  it('should route frontend navigation tools correctly', async () => {
    const result = await executeTool('navigate_to_checkout', {}, mockContext());
    expect(result.type).toBe('frontend_action');
    expect(result.actionType).toBe('navigate');
    expect(result.route).toBe('/shipping');
  });

  it('should route navigate_to_product with params', async () => {
    const result = await executeTool('navigate_to_product', { product_id: '507f1f77bcf86cd799439011' }, mockContext());
    expect(result.type).toBe('frontend_action');
    expect(result.actionType).toBe('navigate');
    expect(result.route).toBe('/product/:id');
    expect(result.params.product_id).toBe('507f1f77bcf86cd799439011');
  });

  it('should validate that all tool schemas are well-formed', () => {
    const allTools = getToolDefinitions('admin');
    for (const tool of allTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeTruthy();
      expect(tool.parameters.type).toBe('object');
    }
  });

  it('should have 28 total tools (17 backend + 11 frontend)', () => {
    const allTools = getToolDefinitions('admin');
    expect(allTools.length).toBe(28);
  });
});
