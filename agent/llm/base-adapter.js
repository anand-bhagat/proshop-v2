// agent/llm/base-adapter.js — Abstract LLM Adapter Interface
// Every provider adapter must extend this class and implement all methods.
// The engine calls these methods — it never touches provider-specific APIs.

class BaseLLMAdapter {
  /**
   * @param {Object} config
   * @param {string} config.model - Model identifier (e.g. 'claude-sonnet-4-20250514')
   * @param {string} config.apiKey - Provider API key
   * @param {number} [config.maxTokens=4096] - Max output tokens
   * @param {number} [config.temperature=0] - Sampling temperature
   * @param {string} [config.baseUrl] - Base URL override (for OpenAI-compatible endpoints)
   * @param {number} [config.timeoutMs=30000] - Request timeout in milliseconds
   */
  constructor(config) {
    if (new.target === BaseLLMAdapter) {
      throw new Error('BaseLLMAdapter is abstract and cannot be instantiated directly');
    }
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature ?? 0;
    this.baseUrl = config.baseUrl || null;
    this.timeoutMs = config.timeoutMs || 30000;
  }

  /**
   * Send a chat completion request with tool definitions.
   * @param {Array} messages - [{ role: 'system'|'user'|'assistant'|'tool', content, tool_call_id?, tool_calls? }]
   * @param {Array} tools - Tool definitions in UNIVERSAL format (from registry)
   * @param {Object} [options] - { temperature, maxTokens } overrides
   * @returns {Promise<Object>} Normalized response: { content, toolCalls, usage }
   */
  async chat(messages, tools = [], options = {}) {
    throw new Error('chat() must be implemented by adapter');
  }

  /**
   * Send a streaming chat completion request.
   * @param {Array} messages - Same as chat()
   * @param {Array} tools - Same as chat()
   * @param {Object} [options] - Same as chat()
   * @returns {AsyncGenerator} Yields normalized chunks:
   *   { type: 'text_delta', content }
   *   { type: 'tool_start', name, id }
   *   { type: 'tool_input_delta', content }
   *   { type: 'done', usage: { inputTokens, outputTokens } }
   */
  async *chatStream(messages, tools = [], options = {}) {
    throw new Error('chatStream() must be implemented by adapter');
  }

  /**
   * Convert universal tool definitions to provider-specific format.
   * Universal format: { name, description, parameters: { type, properties, required } }
   * @param {Array} tools - Tools in universal format
   * @returns {Array} Tools in provider's expected format
   */
  formatTools(tools) {
    throw new Error('formatTools() must be implemented by adapter');
  }

  /**
   * Parse provider's raw response into normalized format.
   * @param {Object} rawResponse - Raw API response from the provider
   * @returns {Object} { content: string|null, toolCalls: [{ id, name, params }], usage: { inputTokens, outputTokens } }
   */
  parseResponse(rawResponse) {
    throw new Error('parseResponse() must be implemented by adapter');
  }
}

export default BaseLLMAdapter;
