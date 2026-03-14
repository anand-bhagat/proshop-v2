import { describe, it, expect, beforeEach } from '@jest/globals';
import { getLLMAdapter, resetAdapter, ADAPTERS } from '../../llm/index.js';
import OpenAICompatibleAdapter from '../../llm/adapters/openai-compatible.js';
import AnthropicAdapter from '../../llm/adapters/anthropic.js';

describe('LLM Adapter Factory', () => {
  beforeEach(() => {
    resetAdapter();
  });

  it('should return OpenAICompatibleAdapter for provider "openai-compatible"', () => {
    const adapter = getLLMAdapter({
      provider: 'openai-compatible',
      model: 'gpt-4o',
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
    });

    expect(adapter).toBeInstanceOf(OpenAICompatibleAdapter);
  });

  it('should return AnthropicAdapter for provider "anthropic"', () => {
    const adapter = getLLMAdapter({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKey: 'test-key',
    });

    expect(adapter).toBeInstanceOf(AnthropicAdapter);
  });

  it('should return singleton instance on subsequent calls', () => {
    const config = {
      provider: 'openai-compatible',
      model: 'gpt-4o',
      apiKey: 'test-key',
    };

    const adapter1 = getLLMAdapter(config);
    const adapter2 = getLLMAdapter(config);
    expect(adapter1).toBe(adapter2);
  });

  it('should return new instance after resetAdapter()', () => {
    const config = {
      provider: 'openai-compatible',
      model: 'gpt-4o',
      apiKey: 'test-key',
    };

    const adapter1 = getLLMAdapter(config);
    resetAdapter();
    const adapter2 = getLLMAdapter(config);
    expect(adapter1).not.toBe(adapter2);
  });

  it('should throw on unknown provider', () => {
    expect(() =>
      getLLMAdapter({ provider: 'unknown', model: 'test', apiKey: 'key' })
    ).toThrow('Unknown LLM provider: "unknown"');
  });

  it('should include available providers in error message', () => {
    try {
      getLLMAdapter({ provider: 'invalid', model: 'test', apiKey: 'key' });
    } catch (err) {
      expect(err.message).toContain('anthropic');
      expect(err.message).toContain('openai-compatible');
    }
  });

  it('should pass config through to adapter', () => {
    const adapter = getLLMAdapter({
      provider: 'openai-compatible',
      model: 'GLM-4.7-FlashX',
      apiKey: 'zai-key',
      baseUrl: 'https://open.z.ai/api/paas/v4',
      maxTokens: 2048,
      temperature: 0.3,
      timeoutMs: 15000,
    });

    expect(adapter.model).toBe('GLM-4.7-FlashX');
    expect(adapter.apiKey).toBe('zai-key');
    expect(adapter.baseUrl).toBe('https://open.z.ai/api/paas/v4');
    expect(adapter.maxTokens).toBe(2048);
    expect(adapter.temperature).toBe(0.3);
    expect(adapter.timeoutMs).toBe(15000);
  });

  it('should have expected adapters registered', () => {
    expect(Object.keys(ADAPTERS)).toEqual(['anthropic', 'openai-compatible']);
  });
});
