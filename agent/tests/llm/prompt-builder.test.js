import { describe, it, expect } from '@jest/globals';
import { buildSystemPrompt } from '../../llm/prompt-builder.js';

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

describe('buildSystemPrompt()', () => {
  it('should include app name and description', () => {
    const prompt = buildSystemPrompt({
      appName: 'ProShop',
      appDescription: 'An e-commerce store.',
      userContext: { userId: 'u1', role: 'user', name: 'Alice' },
      toolDefinitions: sampleTools,
    });

    expect(prompt).toContain('ProShop');
    expect(prompt).toContain('An e-commerce store.');
  });

  it('should include user context', () => {
    const prompt = buildSystemPrompt({
      appName: 'App',
      appDescription: 'Test app.',
      userContext: { userId: 'user123', role: 'admin', name: 'Bob' },
      toolDefinitions: [],
    });

    expect(prompt).toContain('Bob');
    expect(prompt).toContain('admin');
    expect(prompt).toContain('user123');
  });

  it('should include tool definitions with name and description', () => {
    const prompt = buildSystemPrompt({
      appName: 'App',
      appDescription: 'Test.',
      userContext: { userId: 'u1', role: 'user', name: 'A' },
      toolDefinitions: sampleTools,
    });

    expect(prompt).toContain('### search_products');
    expect(prompt).toContain('Search products by keyword');
    expect(prompt).toContain('### get_order');
    expect(prompt).toContain('Get order by ID');
  });

  it('should include tool parameters as JSON', () => {
    const prompt = buildSystemPrompt({
      appName: 'App',
      appDescription: 'Test.',
      userContext: { userId: 'u1', role: 'user', name: 'A' },
      toolDefinitions: sampleTools,
    });

    expect(prompt).toContain('"keyword"');
    expect(prompt).toContain('"order_id"');
  });

  it('should include behavioral rules', () => {
    const prompt = buildSystemPrompt({
      appName: 'App',
      appDescription: 'Test.',
      userContext: { userId: 'u1', role: 'user', name: 'A' },
      toolDefinitions: [],
    });

    expect(prompt).toContain('ALWAYS use tools');
    expect(prompt).toContain('destructive actions');
    expect(prompt).toContain('permissions');
  });

  it('should handle empty/guest user context gracefully', () => {
    const prompt = buildSystemPrompt({
      appName: 'App',
      appDescription: 'Test.',
      userContext: {},
      toolDefinitions: [],
    });

    expect(prompt).toContain('Guest');
    expect(prompt).toContain('guest');
    expect(prompt).toContain('anonymous');
  });

  it('should handle empty tool definitions', () => {
    const prompt = buildSystemPrompt({
      appName: 'App',
      appDescription: 'Test.',
      userContext: { userId: 'u1', role: 'user', name: 'A' },
      toolDefinitions: [],
    });

    expect(prompt).toContain('## Available Tools');
  });
});
