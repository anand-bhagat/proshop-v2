// agent/llm/index.js — Adapter Factory
// Reads config and returns the correct LLM adapter instance.
// The engine imports from here — never from a specific adapter.

import AnthropicAdapter from './adapters/anthropic.js';
import OpenAICompatibleAdapter from './adapters/openai-compatible.js';

const ADAPTERS = {
  anthropic: AnthropicAdapter,
  'openai-compatible': OpenAICompatibleAdapter,
};

let _instance = null;

/**
 * Get the LLM adapter instance (singleton).
 * @param {Object} config - LLM config from agent/config.js
 * @param {string} config.provider - 'anthropic' | 'openai-compatible'
 * @param {string} config.model - Model identifier
 * @param {string} config.apiKey - Provider API key
 * @param {number} [config.maxTokens] - Max output tokens
 * @param {number} [config.temperature] - Sampling temperature
 * @param {string} [config.baseUrl] - Base URL for OpenAI-compatible endpoints
 * @param {number} [config.timeoutMs] - Request timeout
 * @returns {BaseLLMAdapter}
 */
function getLLMAdapter(config) {
  if (_instance) return _instance;

  const AdapterClass = ADAPTERS[config.provider];
  if (!AdapterClass) {
    throw new Error(
      `Unknown LLM provider: "${config.provider}". Available: ${Object.keys(ADAPTERS).join(', ')}`
    );
  }

  _instance = new AdapterClass({
    model: config.model,
    apiKey: config.apiKey,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
  });

  return _instance;
}

/**
 * Reset the singleton instance (for tests or provider switching).
 */
function resetAdapter() {
  _instance = null;
}

export { getLLMAdapter, resetAdapter, ADAPTERS };
