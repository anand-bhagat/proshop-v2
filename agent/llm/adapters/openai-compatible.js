// agent/llm/adapters/openai-compatible.js — Universal OpenAI-Compatible Adapter
// Works with any OpenAI-compatible API via configurable baseUrl:
//   - OpenAI (https://api.openai.com/v1)
//   - Z.ai / GLM (https://open.z.ai/api/paas/v4)
//   - Groq (https://api.groq.com/openai/v1)
//   - OpenRouter (https://openrouter.ai/api/v1)
//   - Ollama (http://localhost:11434/v1)

import OpenAI from 'openai';
import BaseLLMAdapter from '../base-adapter.js';

class OpenAICompatibleAdapter extends BaseLLMAdapter {
  constructor(config) {
    super(config);
    this.client = new OpenAI({
      apiKey: this.apiKey,
      ...(this.baseUrl && { baseURL: this.baseUrl }),
      timeout: this.timeoutMs,
    });
    this.isZai = !!(this.baseUrl && this.baseUrl.includes('z.ai'));
  }

  formatTools(tools) {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  parseResponse(raw) {
    const message = raw.choices?.[0]?.message;

    const toolCalls = (message?.tool_calls || []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      params: typeof tc.function.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments,
    }));

    return {
      content: message?.content || null,
      toolCalls,
      usage: {
        inputTokens: raw.usage?.prompt_tokens || 0,
        outputTokens: raw.usage?.completion_tokens || 0,
      },
    };
  }

  async chat(messages, tools = [], options = {}) {
    const params = {
      model: this.model,
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature ?? this.temperature,
      messages: this._convertMessages(messages),
    };

    if (tools.length > 0) {
      params.tools = this.formatTools(tools);
    }

    // Z.ai: disable thinking/reasoning to get direct responses
    if (this.isZai) {
      params.thinking = { type: 'disabled' };
    }

    const response = await this.client.chat.completions.create(params);
    return this.parseResponse(response);
  }

  async *chatStream(messages, tools = [], options = {}) {
    const params = {
      model: this.model,
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature ?? this.temperature,
      messages: this._convertMessages(messages),
      stream: true,
      stream_options: { include_usage: true },
    };

    if (tools.length > 0) {
      params.tools = this.formatTools(tools);
    }

    // Z.ai: disable thinking/reasoning to get direct responses
    if (this.isZai) {
      params.thinking = { type: 'disabled' };
    }

    const stream = await this.client.chat.completions.create(params);

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;

      if (delta?.content) {
        yield { type: 'text_delta', content: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.function?.name) {
            yield { type: 'tool_start', name: tc.function.name, id: tc.id };
          }
          if (tc.function?.arguments) {
            yield { type: 'tool_input_delta', content: tc.function.arguments };
          }
        }
      }

      if (chunk.usage) {
        yield {
          type: 'done',
          usage: {
            inputTokens: chunk.usage.prompt_tokens || 0,
            outputTokens: chunk.usage.completion_tokens || 0,
          },
        };
      }
    }
  }

  /**
   * Convert universal message format to OpenAI format.
   * Tool result messages use role: 'tool' with tool_call_id.
   * Assistant messages with tool_calls need the tool_calls array.
   */
  _convertMessages(messages) {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: msg.tool_call_id,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        };
      }

      if (msg.role === 'assistant' && msg.tool_calls?.length > 0) {
        return {
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: typeof tc.params === 'string' ? tc.params : JSON.stringify(tc.params),
            },
          })),
        };
      }

      return { role: msg.role, content: msg.content };
    });
  }
}

export default OpenAICompatibleAdapter;
