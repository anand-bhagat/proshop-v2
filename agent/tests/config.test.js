// Tests for agent/config.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('agent/config.js', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear module cache so config re-reads env vars
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should export default config with sensible defaults', async () => {
    const { default: config } = await import('../config.js');

    expect(config.llm.provider).toBe('anthropic');
    expect(config.llm.maxTokens).toBe(1024);
    expect(config.llm.temperature).toBe(0.7);
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
