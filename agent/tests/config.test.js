// Tests for agent/config.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('agent/config.js', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should export default config with sensible defaults', async () => {
    const { default: config } = await import('../config.js');

    expect(config.llm.provider).toBe('openai-compatible');
    expect(config.llm.model).toBe('glm-4.7-flashx');
    expect(config.llm.baseUrl).toBe('https://open.z.ai/api/paas/v4');
    expect(config.llm.maxTokens).toBe(4096);
    expect(config.llm.temperature).toBe(0);
    expect(config.llm.timeoutMs).toBe(30000);
    expect(config.llm.streamingEnabled).toBe(true);
    expect(config.llm.costTracking.enabled).toBe(true);
    expect(config.llm.maxHistoryMessages).toBe(50);
    expect(config.engine.maxIterations).toBe(10);
    expect(config.engine.maxRetries).toBe(2);
    expect(config.engine.timeoutMs).toBe(30000);
    expect(config.enabledCategories).toEqual([
      'products',
      'orders',
      'users',
      'cart',
      'navigation',
    ]);
    expect(config.rateLimit.maxRequestsPerMinute).toBe(20);
    expect(config.rateLimit.maxRequestsPerHour).toBe(200);
    expect(config.systemPromptPath).toBe('agent/prompts/system.txt');
  });

  it('should include LLM provider settings', async () => {
    const { default: config } = await import('../config.js');

    expect(config.llm).toHaveProperty('provider');
    expect(config.llm).toHaveProperty('model');
    expect(config.llm).toHaveProperty('apiKey');
    expect(config.llm).toHaveProperty('maxTokens');
    expect(config.llm).toHaveProperty('temperature');
    expect(config.llm).toHaveProperty('baseUrl');
    expect(config.llm).toHaveProperty('timeoutMs');
    expect(config.llm).toHaveProperty('streamingEnabled');
    expect(config.llm).toHaveProperty('costTracking');
    expect(config.llm).toHaveProperty('maxHistoryMessages');
  });

  it('should include cost tracking pricing table', async () => {
    const { default: config } = await import('../config.js');

    const pricing = config.llm.costTracking.pricing;
    expect(pricing['glm-4.7-flashx']).toBeDefined();
    expect(pricing['gpt-4o']).toBeDefined();
    expect(pricing['claude-sonnet-4-20250514']).toBeDefined();
    expect(pricing['gpt-4o'].input).toBeGreaterThan(0);
    expect(pricing['gpt-4o'].output).toBeGreaterThan(0);
  });

  it('should include engine settings', async () => {
    const { default: config } = await import('../config.js');

    expect(config.engine).toHaveProperty('maxIterations');
    expect(config.engine).toHaveProperty('maxRetries');
    expect(config.engine).toHaveProperty('timeoutMs');
  });

  it('should include rate limit settings', async () => {
    const { default: config } = await import('../config.js');

    expect(config.rateLimit).toHaveProperty('maxRequestsPerMinute');
    expect(config.rateLimit).toHaveProperty('maxRequestsPerHour');
  });
});
