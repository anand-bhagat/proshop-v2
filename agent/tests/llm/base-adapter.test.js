import { describe, it, expect } from '@jest/globals';
import BaseLLMAdapter from '../../llm/base-adapter.js';

describe('BaseLLMAdapter', () => {
  it('should not be instantiable directly', () => {
    expect(() => new BaseLLMAdapter({ model: 'test' })).toThrow(
      'BaseLLMAdapter is abstract and cannot be instantiated directly'
    );
  });

  it('should be extendable by subclasses', () => {
    class TestAdapter extends BaseLLMAdapter {
      async chat() { return {}; }
    }
    const adapter = new TestAdapter({
      model: 'test-model',
      apiKey: 'test-key',
      maxTokens: 2048,
      temperature: 0.5,
      baseUrl: 'https://example.com',
      timeoutMs: 10000,
    });

    expect(adapter.model).toBe('test-model');
    expect(adapter.apiKey).toBe('test-key');
    expect(adapter.maxTokens).toBe(2048);
    expect(adapter.temperature).toBe(0.5);
    expect(adapter.baseUrl).toBe('https://example.com');
    expect(adapter.timeoutMs).toBe(10000);
  });

  it('should use default values for optional config', () => {
    class TestAdapter extends BaseLLMAdapter {}
    const adapter = new TestAdapter({ model: 'test', apiKey: 'key' });

    expect(adapter.maxTokens).toBe(4096);
    expect(adapter.temperature).toBe(0);
    expect(adapter.baseUrl).toBeNull();
    expect(adapter.timeoutMs).toBe(30000);
  });

  it('should throw on unimplemented chat()', async () => {
    class TestAdapter extends BaseLLMAdapter {}
    const adapter = new TestAdapter({ model: 'test', apiKey: 'key' });
    await expect(adapter.chat([])).rejects.toThrow('chat() must be implemented');
  });

  it('should throw on unimplemented chatStream()', async () => {
    class TestAdapter extends BaseLLMAdapter {}
    const adapter = new TestAdapter({ model: 'test', apiKey: 'key' });
    const gen = adapter.chatStream([]);
    await expect(gen.next()).rejects.toThrow('chatStream() must be implemented');
  });

  it('should throw on unimplemented formatTools()', () => {
    class TestAdapter extends BaseLLMAdapter {}
    const adapter = new TestAdapter({ model: 'test', apiKey: 'key' });
    expect(() => adapter.formatTools([])).toThrow('formatTools() must be implemented');
  });

  it('should throw on unimplemented parseResponse()', () => {
    class TestAdapter extends BaseLLMAdapter {}
    const adapter = new TestAdapter({ model: 'test', apiKey: 'key' });
    expect(() => adapter.parseResponse({})).toThrow('parseResponse() must be implemented');
  });
});
