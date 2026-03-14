// Tests for agent/registry.js

import { describe, it, expect } from '@jest/globals';
import {
  getToolDefinitions,
  executeTool,
  registerHandler,
  getToolEntry,
} from '../registry.js';

// ---------------------------------------------------------------------------
// Mock context helpers
// ---------------------------------------------------------------------------

function mockContext(overrides = {}) {
  return {
    userId: '507f1f77bcf86cd799439011',
    role: 'user',
    name: 'Test User',
    ...overrides,
  };
}

function mockAdminContext() {
  return mockContext({ role: 'admin', name: 'Admin User' });
}

// ---------------------------------------------------------------------------
// getToolDefinitions
// ---------------------------------------------------------------------------

describe('getToolDefinitions()', () => {
  it('should return an array of tool definitions', () => {
    const defs = getToolDefinitions('user');
    expect(Array.isArray(defs)).toBe(true);
    expect(defs.length).toBeGreaterThan(0);
  });

  it('each tool definition should have name, description, parameters', () => {
    const defs = getToolDefinitions('admin');
    for (const def of defs) {
      expect(def).toHaveProperty('name');
      expect(def).toHaveProperty('description');
      expect(def).toHaveProperty('parameters');
      expect(typeof def.name).toBe('string');
      expect(typeof def.description).toBe('string');
      expect(typeof def.parameters).toBe('object');
    }
  });

  it('should include all 28 tools for admin users', () => {
    const defs = getToolDefinitions('admin');
    expect(defs.length).toBe(28);
  });

  it('should filter out admin-only tools for regular users', () => {
    const adminDefs = getToolDefinitions('admin');
    const userDefs = getToolDefinitions('user');
    expect(userDefs.length).toBeLessThan(adminDefs.length);

    const userToolNames = userDefs.map((d) => d.name);
    // Admin-only tools should NOT appear for regular users
    expect(userToolNames).not.toContain('create_product');
    expect(userToolNames).not.toContain('delete_product');
    expect(userToolNames).not.toContain('delete_user');
    expect(userToolNames).not.toContain('list_users');
    expect(userToolNames).not.toContain('list_orders');
  });

  it('should filter out authenticated tools for anonymous users', () => {
    const defs = getToolDefinitions(null);
    const names = defs.map((d) => d.name);
    expect(names).not.toContain('get_user_profile');
    expect(names).not.toContain('get_my_orders');
    // Public tools should still be present
    expect(names).toContain('get_product');
    expect(names).toContain('search_products');
    expect(names).toContain('navigate_to_home');
  });

  it('should include public tools for all roles', () => {
    for (const role of ['admin', 'user', null]) {
      const defs = getToolDefinitions(role);
      const names = defs.map((d) => d.name);
      expect(names).toContain('get_product');
      expect(names).toContain('search_products');
      expect(names).toContain('navigate_to_home');
    }
  });
});

// ---------------------------------------------------------------------------
// executeTool
// ---------------------------------------------------------------------------

describe('executeTool()', () => {
  it('should return NOT_FOUND for unknown tool', async () => {
    const result = await executeTool('nonexistent_tool', {}, mockContext());
    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
  });

  it('should return FORBIDDEN when user lacks permission', async () => {
    const result = await executeTool(
      'create_product',
      {},
      mockContext({ role: 'user' })
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
  });

  it('should return confirmation_needed for destructive tools', async () => {
    const result = await executeTool(
      'delete_product',
      { product_id: '507f1f77bcf86cd799439011' },
      mockAdminContext()
    );
    expect(result.type).toBe('confirmation_needed');
    expect(result.tool).toBe('delete_product');
  });

  it('should skip confirmation when __confirmed is true', async () => {
    const result = await executeTool(
      'delete_product',
      { product_id: '507f1f77bcf86cd799439011', __confirmed: true },
      mockAdminContext()
    );
    // Should not return confirmation_needed (will return NOT_IMPLEMENTED since handler is null)
    expect(result.type).not.toBe('confirmation_needed');
  });

  it('should return INVALID_PARAM for bad params on backend tool', async () => {
    const result = await executeTool(
      'get_product',
      { product_id: 'invalid!' },
      mockContext()
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should return frontend_action for frontend tools', async () => {
    const result = await executeTool(
      'navigate_to_home',
      {},
      mockContext()
    );
    expect(result.type).toBe('frontend_action');
    expect(result.tool).toBe('navigate_to_home');
    expect(result.actionType).toBe('navigate');
    expect(result.route).toBe('/');
  });

  it('should return frontend_action with dispatch info for cart tools', async () => {
    const result = await executeTool(
      'add_to_cart',
      { product_id: '507f1f77bcf86cd799439011', qty: 2 },
      mockContext()
    );
    expect(result.type).toBe('frontend_action');
    expect(result.actionType).toBe('dispatch');
    expect(result.store).toBe('cart');
    expect(result.action).toBe('addToCart');
  });

  it('should return NOT_IMPLEMENTED for unimplemented backend tools', async () => {
    const result = await executeTool(
      'create_product',
      {},
      mockContext({ role: 'admin' })
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_IMPLEMENTED');
  });
});

// ---------------------------------------------------------------------------
// registerHandler / getToolEntry
// ---------------------------------------------------------------------------

describe('registerHandler()', () => {
  it('should register a handler for an existing tool', async () => {
    // Save the original handler
    const originalHandler = getToolEntry('search_products').handler;

    const mockHandler = async () => ({
      success: true,
      data: { id: 'test' },
      metadata: {},
    });

    registerHandler('search_products', mockHandler);

    const result = await executeTool(
      'search_products',
      {},
      mockContext()
    );
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('test');

    // Clean up — restore original handler
    registerHandler('search_products', originalHandler);
  });

  it('should throw for unknown tool name', () => {
    expect(() => registerHandler('fake_tool', () => {})).toThrow(
      'Cannot register handler'
    );
  });
});

describe('getToolEntry()', () => {
  it('should return tool entry for existing tool', () => {
    const entry = getToolEntry('get_product');
    expect(entry).not.toBeNull();
    expect(entry.execution).toBe('backend');
    expect(entry.access).toBe('public');
    expect(entry.category).toBe('products');
  });

  it('should return null for unknown tool', () => {
    expect(getToolEntry('nonexistent')).toBeNull();
  });
});
