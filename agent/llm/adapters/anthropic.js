// agent/llm/adapters/anthropic.js — Anthropic (Claude) Adapter
// Handles Claude's unique API format: tool_use content blocks, system as top-level param,
// tool results as user-role messages with tool_result content blocks.

import Anthropic from '@anthropic-ai/sdk';
import BaseLLMAdapter from '../base-adapter.js';

class AnthropicAdapter extends BaseLLMAdapter {
  constructor(config) {
    super(config);
    this.client = new Anthropic({
      apiKey: this.apiKey,
      timeout: this.timeoutMs,
    });
  }

  formatTools(tools) {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  parseResponse(raw) {
    const content = raw.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('') || null;

    const toolCalls = raw.content
      .filter((block) => block.type === 'tool_use')
      .map((block) => ({
        id: block.id,
        name: block.name,
        params: block.input,
      }));

    return {
      content,
      toolCalls,
      usage: {
        inputTokens: raw.usage?.input_tokens || 0,
        outputTokens: raw.usage?.output_tokens || 0,
      },
    };
  }

  async chat(messages, tools = [], options = {}) {
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = this._convertMessages(messages.filter((m) => m.role !== 'system'));

    const params = {
      model: this.model,
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature ?? this.temperature,
      messages: chatMessages,
    };

    if (systemMsg) params.system = systemMsg.content;
    if (tools.length > 0) params.tools = this.formatTools(tools);

    const response = await this.client.messages.create(params);
    return this.parseResponse(response);
  }

  async *chatStream(messages, tools = [], options = {}) {
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = this._convertMessages(messages.filter((m) => m.role !== 'system'));

    const params = {
      model: this.model,
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature ?? this.temperature,
      messages: chatMessages,
      stream: true,
    };

    if (systemMsg) params.system = systemMsg.content;
    if (tools.length > 0) params.tools = this.formatTools(tools);

    const stream = await this.client.messages.create(params);

    for await (const event of stream) {
      if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
        yield { type: 'tool_start', name: event.content_block.name, id: event.content_block.id };
      } else if (event.type === 'content_block_delta') {
        if (event.delta?.type === 'text_delta') {
          yield { type: 'text_delta', content: event.delta.text };
        } else if (event.delta?.type === 'input_json_delta') {
          yield { type: 'tool_input_delta', content: event.delta.partial_json };
        }
      } else if (event.type === 'message_delta') {
        yield {
          type: 'done',
          usage: {
            inputTokens: event.usage?.input_tokens || 0,
            outputTokens: event.usage?.output_tokens || 0,
          },
        };
      }
    }
  }

  /**
   * Convert universal message format to Anthropic format.
   * - 'tool' role messages become user messages with tool_result content blocks
   * - assistant messages with tool_calls become assistant messages with tool_use content blocks
   */
  _convertMessages(messages) {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id,
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            },
          ],
        };
      }

      if (msg.role === 'assistant' && msg.tool_calls?.length > 0) {
        const content = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.params || {},
          });
        }
        return { role: 'assistant', content };
      }

      return { role: msg.role, content: msg.content };
    });
  }
}

export default AnthropicAdapter;
