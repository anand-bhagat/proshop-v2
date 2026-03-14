import { describe, it, expect } from '@jest/globals';
import AnthropicAdapter from '../../llm/adapters/anthropic.js';

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
];

describe('AnthropicAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new AnthropicAdapter({
      model: 'claude-sonnet-4-20250514',
      apiKey: 'test-key',
    });
  });

  // ─── formatTools ────────────────────────────────────────────────────────

  describe('formatTools()', () => {
    it('should convert universal format to Anthropic input_schema format', () => {
      const formatted = adapter.formatTools(sampleTools);

      expect(formatted).toHaveLength(1);
      expect(formatted[0]).toEqual({
        name: 'search_products',
        description: 'Search products by keyword',
        input_schema: sampleTools[0].parameters,
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
        content: [{ type: 'text', text: 'Here are your results.' }],
        usage: { input_tokens: 100, output_tokens: 25 },
      };

      const result = adapter.parseResponse(raw);
      expect(result.content).toBe('Here are your results.');
      expect(result.toolCalls).toEqual([]);
      expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 25 });
    });

    it('should parse tool_use response', () => {
      const raw = {
        content: [
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'search_products',
            input: { keyword: 'laptop' },
          },
        ],
        usage: { input_tokens: 150, output_tokens: 30 },
      };

      const result = adapter.parseResponse(raw);
      expect(result.content).toBeNull();
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]).toEqual({
        id: 'toolu_123',
        name: 'search_products',
        params: { keyword: 'laptop' },
      });
    });

    it('should parse mixed text and tool_use response', () => {
      const raw = {
        content: [
          { type: 'text', text: 'Let me search for that.' },
          {
            type: 'tool_use',
            id: 'toolu_456',
            name: 'search_products',
            input: { keyword: 'phone' },
          },
        ],
        usage: { input_tokens: 200, output_tokens: 50 },
      };

      const result = adapter.parseResponse(raw);
      expect(result.content).toBe('Let me search for that.');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('search_products');
    });

    it('should join multiple text blocks', () => {
      const raw = {
        content: [
          { type: 'text', text: 'Part one. ' },
          { type: 'text', text: 'Part two.' },
        ],
        usage: { input_tokens: 50, output_tokens: 10 },
      };

      const result = adapter.parseResponse(raw);
      expect(result.content).toBe('Part one. Part two.');
    });

    it('should handle missing usage data', () => {
      const raw = { content: [{ type: 'text', text: 'Hi' }] };

      const result = adapter.parseResponse(raw);
      expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    });

    it('should handle multiple tool_use blocks', () => {
      const raw = {
        content: [
          { type: 'tool_use', id: 'toolu_1', name: 'search_products', input: { keyword: 'a' } },
          { type: 'tool_use', id: 'toolu_2', name: 'search_products', input: { keyword: 'b' } },
        ],
        usage: { input_tokens: 300, output_tokens: 60 },
      };

      const result = adapter.parseResponse(raw);
      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0].id).toBe('toolu_1');
      expect(result.toolCalls[1].id).toBe('toolu_2');
    });
  });

  // ─── _convertMessages ──────────────────────────────────────────────────

  describe('_convertMessages()', () => {
    it('should pass through user and assistant messages', () => {
      const messages = [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
      ];

      const converted = adapter._convertMessages(messages);
      expect(converted).toEqual(messages);
    });

    it('should convert tool result messages to user role with tool_result content', () => {
      const messages = [
        { role: 'tool', tool_call_id: 'toolu_123', content: '{"success":true}' },
      ];

      const converted = adapter._convertMessages(messages);
      expect(converted[0]).toEqual({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_123',
            content: '{"success":true}',
          },
        ],
      });
    });

    it('should convert assistant messages with tool_calls to tool_use content blocks', () => {
      const messages = [
        {
          role: 'assistant',
          content: 'Searching...',
          tool_calls: [
            { id: 'toolu_1', name: 'search_products', params: { keyword: 'laptop' } },
          ],
        },
      ];

      const converted = adapter._convertMessages(messages);
      expect(converted[0].role).toBe('assistant');
      expect(converted[0].content).toEqual([
        { type: 'text', text: 'Searching...' },
        { type: 'tool_use', id: 'toolu_1', name: 'search_products', input: { keyword: 'laptop' } },
      ]);
    });

    it('should handle assistant tool_calls without text content', () => {
      const messages = [
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            { id: 'toolu_1', name: 'get_order', params: { order_id: 'abc' } },
          ],
        },
      ];

      const converted = adapter._convertMessages(messages);
      expect(converted[0].content).toEqual([
        { type: 'tool_use', id: 'toolu_1', name: 'get_order', input: { order_id: 'abc' } },
      ]);
    });
  });

  // ─── Constructor ────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should set model and apiKey', () => {
      expect(adapter.model).toBe('claude-sonnet-4-20250514');
      expect(adapter.apiKey).toBe('test-key');
    });
  });
});
