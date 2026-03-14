import { describe, it, expect } from '@jest/globals';
import OpenAICompatibleAdapter from '../../llm/adapters/openai-compatible.js';

// Sample tools in universal format
const sampleTools = [
  {
    name: 'search_products',
    description: 'Search products by keyword',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Search term' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'get_order',
    description: 'Get order by ID',
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'Order ID' },
      },
      required: ['order_id'],
    },
  },
];

describe('OpenAICompatibleAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new OpenAICompatibleAdapter({
      model: 'gpt-4o',
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
    });
  });

  // ─── formatTools ────────────────────────────────────────────────────────

  describe('formatTools()', () => {
    it('should convert universal format to OpenAI function format', () => {
      const formatted = adapter.formatTools(sampleTools);

      expect(formatted).toHaveLength(2);
      expect(formatted[0]).toEqual({
        type: 'function',
        function: {
          name: 'search_products',
          description: 'Search products by keyword',
          parameters: sampleTools[0].parameters,
        },
      });
    });

    it('should handle empty tools array', () => {
      expect(adapter.formatTools([])).toEqual([]);
    });
  });

  // ─── parseResponse ─────────────────────────────────────────────────────

  describe('parseResponse()', () => {
    it('should parse text-only response', () => {
      const raw = {
        choices: [{ message: { content: 'Hello there!', tool_calls: undefined } }],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      };

      const result = adapter.parseResponse(raw);
      expect(result.content).toBe('Hello there!');
      expect(result.toolCalls).toEqual([]);
      expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 20 });
    });

    it('should parse tool call response', () => {
      const raw = {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  function: {
                    name: 'search_products',
                    arguments: '{"keyword":"laptop"}',
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 150, completion_tokens: 30 },
      };

      const result = adapter.parseResponse(raw);
      expect(result.content).toBeNull();
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]).toEqual({
        id: 'call_123',
        name: 'search_products',
        params: { keyword: 'laptop' },
      });
    });

    it('should parse response with both text and tool calls', () => {
      const raw = {
        choices: [
          {
            message: {
              content: 'Let me search for that.',
              tool_calls: [
                {
                  id: 'call_456',
                  function: {
                    name: 'get_order',
                    arguments: '{"order_id":"abc123"}',
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 200, completion_tokens: 50 },
      };

      const result = adapter.parseResponse(raw);
      expect(result.content).toBe('Let me search for that.');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('get_order');
    });

    it('should handle missing usage data', () => {
      const raw = {
        choices: [{ message: { content: 'Hi' } }],
      };

      const result = adapter.parseResponse(raw);
      expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    });

    it('should handle pre-parsed arguments object', () => {
      const raw = {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_789',
                  function: {
                    name: 'search_products',
                    arguments: { keyword: 'phone' },
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      };

      const result = adapter.parseResponse(raw);
      expect(result.toolCalls[0].params).toEqual({ keyword: 'phone' });
    });
  });

  // ─── _convertMessages ──────────────────────────────────────────────────

  describe('_convertMessages()', () => {
    it('should pass through system, user, and assistant messages', () => {
      const messages = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
      ];

      const converted = adapter._convertMessages(messages);
      expect(converted).toEqual(messages);
    });

    it('should convert tool result messages', () => {
      const messages = [
        { role: 'tool', tool_call_id: 'call_1', content: '{"success":true}' },
      ];

      const converted = adapter._convertMessages(messages);
      expect(converted[0]).toEqual({
        role: 'tool',
        tool_call_id: 'call_1',
        content: '{"success":true}',
      });
    });

    it('should convert assistant messages with tool_calls', () => {
      const messages = [
        {
          role: 'assistant',
          content: 'Let me look that up.',
          tool_calls: [
            { id: 'call_1', name: 'search_products', params: { keyword: 'laptop' } },
          ],
        },
      ];

      const converted = adapter._convertMessages(messages);
      expect(converted[0].role).toBe('assistant');
      expect(converted[0].tool_calls[0].type).toBe('function');
      expect(converted[0].tool_calls[0].function.name).toBe('search_products');
      expect(converted[0].tool_calls[0].function.arguments).toBe('{"keyword":"laptop"}');
    });
  });

  // ─── Constructor ────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should set baseUrl on the OpenAI client', () => {
      const a = new OpenAICompatibleAdapter({
        model: 'glm-4',
        apiKey: 'key',
        baseUrl: 'https://open.z.ai/api/paas/v4',
      });
      expect(a.baseUrl).toBe('https://open.z.ai/api/paas/v4');
      expect(a.model).toBe('glm-4');
    });

    it('should work without baseUrl (defaults to OpenAI)', () => {
      const a = new OpenAICompatibleAdapter({
        model: 'gpt-4o',
        apiKey: 'key',
      });
      expect(a.baseUrl).toBeNull();
    });
  });
});
