// Tests for Phase 6: Frontend & Navigation Tools
// These tools have no backend handler — they return frontend_action objects
// routed by the registry's executeTool function.

import { describe, it, expect } from '@jest/globals';
import {
  executeTool,
  getToolDefinitions,
  getToolEntry,
} from '../../registry.js';

// ---------------------------------------------------------------------------
// Helpers
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

function anonymousContext() {
  return { userId: null, role: null, name: null };
}

// ---------------------------------------------------------------------------
// Cart Action Tools
// ---------------------------------------------------------------------------

describe('add_to_cart (frontend)', () => {
  it('should return frontend_action with dispatch type', async () => {
    const result = await executeTool(
      'add_to_cart',
      { product_id: '507f1f77bcf86cd799439011', qty: 2 },
      mockContext()
    );
    expect(result.type).toBe('frontend_action');
    expect(result.tool).toBe('add_to_cart');
    expect(result.actionType).toBe('dispatch');
    expect(result.store).toBe('cart');
    expect(result.action).toBe('addToCart');
    expect(result.params).toEqual({
      product_id: '507f1f77bcf86cd799439011',
      qty: 2,
    });
  });

  it('should pass through params for widget to handle', async () => {
    const result = await executeTool(
      'add_to_cart',
      { product_id: 'aabbccddeeff00112233aabb', qty: 5 },
      mockContext()
    );
    expect(result.params.product_id).toBe('aabbccddeeff00112233aabb');
    expect(result.params.qty).toBe(5);
  });

  it('should reject invalid product_id pattern', async () => {
    const result = await executeTool(
      'add_to_cart',
      { product_id: 'not-valid', qty: 1 },
      mockContext()
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should reject qty less than 1', async () => {
    const result = await executeTool(
      'add_to_cart',
      { product_id: '507f1f77bcf86cd799439011', qty: 0 },
      mockContext()
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should reject missing required product_id', async () => {
    const result = await executeTool(
      'add_to_cart',
      { qty: 1 },
      mockContext()
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should reject missing required qty', async () => {
    const result = await executeTool(
      'add_to_cart',
      { product_id: '507f1f77bcf86cd799439011' },
      mockContext()
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should allow anonymous users (access is public)', async () => {
    const result = await executeTool(
      'add_to_cart',
      { product_id: '507f1f77bcf86cd799439011', qty: 1 },
      anonymousContext()
    );
    expect(result.type).toBe('frontend_action');
  });

  it('should be registered with execution: frontend and no handler', () => {
    const entry = getToolEntry('add_to_cart');
    expect(entry.execution).toBe('frontend');
    expect(entry.handler).toBeNull();
    expect(entry.category).toBe('cart');
    expect(entry.access).toBe('public');
    expect(entry.confirmBefore).toBe(false);
  });

  it('should appear in tool definitions for all roles', () => {
    for (const role of ['admin', 'user', null]) {
      const defs = getToolDefinitions(role);
      const names = defs.map((d) => d.name);
      expect(names).toContain('add_to_cart');
    }
  });
});

describe('remove_from_cart (frontend)', () => {
  it('should return frontend_action with dispatch type', async () => {
    const result = await executeTool(
      'remove_from_cart',
      { product_id: '507f1f77bcf86cd799439011' },
      mockContext()
    );
    expect(result.type).toBe('frontend_action');
    expect(result.tool).toBe('remove_from_cart');
    expect(result.actionType).toBe('dispatch');
    expect(result.store).toBe('cart');
    expect(result.action).toBe('removeFromCart');
    expect(result.params.product_id).toBe('507f1f77bcf86cd799439011');
  });

  it('should reject invalid product_id pattern', async () => {
    const result = await executeTool(
      'remove_from_cart',
      { product_id: 'bad-id' },
      mockContext()
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should reject missing product_id', async () => {
    const result = await executeTool('remove_from_cart', {}, mockContext());
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should allow anonymous users (access is public)', async () => {
    const result = await executeTool(
      'remove_from_cart',
      { product_id: '507f1f77bcf86cd799439011' },
      anonymousContext()
    );
    expect(result.type).toBe('frontend_action');
  });

  it('should be registered with correct config', () => {
    const entry = getToolEntry('remove_from_cart');
    expect(entry.execution).toBe('frontend');
    expect(entry.handler).toBeNull();
    expect(entry.category).toBe('cart');
    expect(entry.access).toBe('public');
    expect(entry.frontendAction).toEqual({
      type: 'dispatch',
      store: 'cart',
      action: 'removeFromCart',
    });
  });
});

describe('clear_cart (frontend)', () => {
  it('should return frontend_action with dispatch type', async () => {
    const result = await executeTool('clear_cart', {}, mockContext());
    expect(result.type).toBe('frontend_action');
    expect(result.tool).toBe('clear_cart');
    expect(result.actionType).toBe('dispatch');
    expect(result.store).toBe('cart');
    expect(result.action).toBe('clearCartItems');
  });

  it('should accept empty params', async () => {
    const result = await executeTool('clear_cart', {}, mockContext());
    expect(result.type).toBe('frontend_action');
    expect(result.params).toEqual({});
  });

  it('should reject additional properties', async () => {
    const result = await executeTool(
      'clear_cart',
      { extra: 'field' },
      mockContext()
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should allow anonymous users (access is public)', async () => {
    const result = await executeTool('clear_cart', {}, anonymousContext());
    expect(result.type).toBe('frontend_action');
  });

  it('should be registered with correct config', () => {
    const entry = getToolEntry('clear_cart');
    expect(entry.execution).toBe('frontend');
    expect(entry.handler).toBeNull();
    expect(entry.category).toBe('cart');
    expect(entry.access).toBe('public');
    expect(entry.frontendAction).toEqual({
      type: 'dispatch',
      store: 'cart',
      action: 'clearCartItems',
    });
  });
});

// ---------------------------------------------------------------------------
// Navigation Tools
// ---------------------------------------------------------------------------

describe('navigate_to_login (frontend/nav)', () => {
  it('should return frontend_action with navigate type', async () => {
    const result = await executeTool('navigate_to_login', {}, mockContext());
    expect(result.type).toBe('frontend_action');
    expect(result.tool).toBe('navigate_to_login');
    expect(result.actionType).toBe('navigate');
    expect(result.route).toBe('/login');
  });

  it('should allow anonymous users (access is public)', async () => {
    const result = await executeTool(
      'navigate_to_login',
      {},
      anonymousContext()
    );
    expect(result.type).toBe('frontend_action');
    expect(result.route).toBe('/login');
  });

  it('should be registered with correct config', () => {
    const entry = getToolEntry('navigate_to_login');
    expect(entry.execution).toBe('frontend');
    expect(entry.handler).toBeNull();
    expect(entry.category).toBe('navigation');
    expect(entry.access).toBe('public');
    expect(entry.frontendAction).toEqual({ type: 'navigate', route: '/login' });
  });
});

describe('navigate_to_register (frontend/nav)', () => {
  it('should return frontend_action with navigate type', async () => {
    const result = await executeTool(
      'navigate_to_register',
      {},
      mockContext()
    );
    expect(result.type).toBe('frontend_action');
    expect(result.tool).toBe('navigate_to_register');
    expect(result.actionType).toBe('navigate');
    expect(result.route).toBe('/register');
  });

  it('should allow anonymous users (access is public)', async () => {
    const result = await executeTool(
      'navigate_to_register',
      {},
      anonymousContext()
    );
    expect(result.type).toBe('frontend_action');
  });

  it('should be registered with correct config', () => {
    const entry = getToolEntry('navigate_to_register');
    expect(entry.execution).toBe('frontend');
    expect(entry.access).toBe('public');
    expect(entry.frontendAction).toEqual({
      type: 'navigate',
      route: '/register',
    });
  });
});

describe('navigate_to_checkout (frontend/nav)', () => {
  it('should return frontend_action with navigate type for authenticated user', async () => {
    const result = await executeTool(
      'navigate_to_checkout',
      {},
      mockContext()
    );
    expect(result.type).toBe('frontend_action');
    expect(result.tool).toBe('navigate_to_checkout');
    expect(result.actionType).toBe('navigate');
    expect(result.route).toBe('/shipping');
  });

  it('should reject anonymous users (access is authenticated)', async () => {
    const result = await executeTool(
      'navigate_to_checkout',
      {},
      anonymousContext()
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
  });

  it('should be registered with correct config', () => {
    const entry = getToolEntry('navigate_to_checkout');
    expect(entry.execution).toBe('frontend');
    expect(entry.access).toBe('authenticated');
    expect(entry.frontendAction).toEqual({
      type: 'navigate',
      route: '/shipping',
    });
  });
});

describe('navigate_to_profile (frontend/nav)', () => {
  it('should return frontend_action with navigate type for authenticated user', async () => {
    const result = await executeTool(
      'navigate_to_profile',
      {},
      mockContext()
    );
    expect(result.type).toBe('frontend_action');
    expect(result.tool).toBe('navigate_to_profile');
    expect(result.actionType).toBe('navigate');
    expect(result.route).toBe('/profile');
  });

  it('should reject anonymous users (access is authenticated)', async () => {
    const result = await executeTool(
      'navigate_to_profile',
      {},
      anonymousContext()
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
  });

  it('should be registered with correct config', () => {
    const entry = getToolEntry('navigate_to_profile');
    expect(entry.execution).toBe('frontend');
    expect(entry.access).toBe('authenticated');
    expect(entry.frontendAction).toEqual({
      type: 'navigate',
      route: '/profile',
    });
  });
});

describe('navigate_to_product (frontend/nav)', () => {
  it('should return frontend_action with navigate type and route', async () => {
    const result = await executeTool(
      'navigate_to_product',
      { product_id: '507f1f77bcf86cd799439011' },
      mockContext()
    );
    expect(result.type).toBe('frontend_action');
    expect(result.tool).toBe('navigate_to_product');
    expect(result.actionType).toBe('navigate');
    expect(result.route).toBe('/product/:id');
    expect(result.params.product_id).toBe('507f1f77bcf86cd799439011');
  });

  it('should reject missing product_id', async () => {
    const result = await executeTool(
      'navigate_to_product',
      {},
      mockContext()
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should allow anonymous users (access is public)', async () => {
    const result = await executeTool(
      'navigate_to_product',
      { product_id: '507f1f77bcf86cd799439011' },
      anonymousContext()
    );
    expect(result.type).toBe('frontend_action');
  });

  it('should be registered with correct config', () => {
    const entry = getToolEntry('navigate_to_product');
    expect(entry.execution).toBe('frontend');
    expect(entry.access).toBe('public');
    expect(entry.frontendAction).toEqual({
      type: 'navigate',
      route: '/product/:id',
    });
  });
});

describe('navigate_to_cart (frontend/nav)', () => {
  it('should return frontend_action with navigate type', async () => {
    const result = await executeTool('navigate_to_cart', {}, mockContext());
    expect(result.type).toBe('frontend_action');
    expect(result.tool).toBe('navigate_to_cart');
    expect(result.actionType).toBe('navigate');
    expect(result.route).toBe('/cart');
  });

  it('should allow anonymous users (access is public)', async () => {
    const result = await executeTool(
      'navigate_to_cart',
      {},
      anonymousContext()
    );
    expect(result.type).toBe('frontend_action');
  });

  it('should be registered with correct config', () => {
    const entry = getToolEntry('navigate_to_cart');
    expect(entry.execution).toBe('frontend');
    expect(entry.access).toBe('public');
    expect(entry.frontendAction).toEqual({
      type: 'navigate',
      route: '/cart',
    });
  });
});

describe('navigate_to_order (frontend/nav)', () => {
  it('should return frontend_action with navigate type and params', async () => {
    const result = await executeTool(
      'navigate_to_order',
      { order_id: '507f1f77bcf86cd799439011' },
      mockContext()
    );
    expect(result.type).toBe('frontend_action');
    expect(result.tool).toBe('navigate_to_order');
    expect(result.actionType).toBe('navigate');
    expect(result.route).toBe('/order/:id');
    expect(result.params.order_id).toBe('507f1f77bcf86cd799439011');
  });

  it('should reject missing order_id', async () => {
    const result = await executeTool('navigate_to_order', {}, mockContext());
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should reject anonymous users (access is authenticated)', async () => {
    const result = await executeTool(
      'navigate_to_order',
      { order_id: '507f1f77bcf86cd799439011' },
      anonymousContext()
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
  });

  it('should be registered with correct config', () => {
    const entry = getToolEntry('navigate_to_order');
    expect(entry.execution).toBe('frontend');
    expect(entry.access).toBe('authenticated');
    expect(entry.frontendAction).toEqual({
      type: 'navigate',
      route: '/order/:id',
    });
  });
});

describe('navigate_to_home (frontend/nav)', () => {
  it('should return frontend_action with navigate type', async () => {
    const result = await executeTool('navigate_to_home', {}, mockContext());
    expect(result.type).toBe('frontend_action');
    expect(result.tool).toBe('navigate_to_home');
    expect(result.actionType).toBe('navigate');
    expect(result.route).toBe('/');
  });

  it('should allow anonymous users (access is public)', async () => {
    const result = await executeTool(
      'navigate_to_home',
      {},
      anonymousContext()
    );
    expect(result.type).toBe('frontend_action');
    expect(result.route).toBe('/');
  });

  it('should be registered with correct config', () => {
    const entry = getToolEntry('navigate_to_home');
    expect(entry.execution).toBe('frontend');
    expect(entry.access).toBe('public');
    expect(entry.frontendAction).toEqual({
      type: 'navigate',
      route: '/',
    });
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: All Frontend Tools
// ---------------------------------------------------------------------------

describe('Frontend tool cross-cutting concerns', () => {
  const allFrontendTools = [
    'add_to_cart',
    'remove_from_cart',
    'clear_cart',
    'navigate_to_login',
    'navigate_to_register',
    'navigate_to_checkout',
    'navigate_to_profile',
    'navigate_to_product',
    'navigate_to_cart',
    'navigate_to_order',
    'navigate_to_home',
  ];

  it('all 11 frontend tools should have execution: frontend', () => {
    for (const name of allFrontendTools) {
      const entry = getToolEntry(name);
      expect(entry).not.toBeNull();
      expect(entry.execution).toBe('frontend');
    }
  });

  it('all frontend tools should have handler: null', () => {
    for (const name of allFrontendTools) {
      const entry = getToolEntry(name);
      expect(entry.handler).toBeNull();
    }
  });

  it('all frontend tools should have a frontendAction config', () => {
    for (const name of allFrontendTools) {
      const entry = getToolEntry(name);
      expect(entry.frontendAction).toBeDefined();
      expect(entry.frontendAction.type).toBeDefined();
      expect(['dispatch', 'navigate']).toContain(entry.frontendAction.type);
    }
  });

  it('all frontend tools should have confirmBefore: false', () => {
    for (const name of allFrontendTools) {
      const entry = getToolEntry(name);
      expect(entry.confirmBefore).toBe(false);
    }
  });

  it('cart tools should have category: cart', () => {
    for (const name of ['add_to_cart', 'remove_from_cart', 'clear_cart']) {
      const entry = getToolEntry(name);
      expect(entry.category).toBe('cart');
    }
  });

  it('navigation tools should have category: navigation', () => {
    const navTools = allFrontendTools.filter((n) => n.startsWith('navigate_'));
    for (const name of navTools) {
      const entry = getToolEntry(name);
      expect(entry.category).toBe('navigation');
    }
  });

  it('dispatch tools should have store and action fields', () => {
    const dispatchTools = ['add_to_cart', 'remove_from_cart', 'clear_cart'];
    for (const name of dispatchTools) {
      const entry = getToolEntry(name);
      expect(entry.frontendAction.type).toBe('dispatch');
      expect(entry.frontendAction.store).toBeDefined();
      expect(entry.frontendAction.action).toBeDefined();
    }
  });

  it('navigate tools should have route field', () => {
    const navTools = allFrontendTools.filter((n) => n.startsWith('navigate_'));
    for (const name of navTools) {
      const entry = getToolEntry(name);
      expect(entry.frontendAction.type).toBe('navigate');
      expect(entry.frontendAction.route).toBeDefined();
      expect(typeof entry.frontendAction.route).toBe('string');
    }
  });

  it('all 11 frontend tools should appear in admin tool definitions', () => {
    const defs = getToolDefinitions('admin');
    const names = defs.map((d) => d.name);
    for (const tool of allFrontendTools) {
      expect(names).toContain(tool);
    }
  });

  it('public frontend tools should appear for anonymous users', () => {
    const defs = getToolDefinitions(null);
    const names = defs.map((d) => d.name);
    const publicTools = allFrontendTools.filter((n) => {
      const entry = getToolEntry(n);
      return entry.access === 'public';
    });
    for (const tool of publicTools) {
      expect(names).toContain(tool);
    }
  });

  it('authenticated frontend tools should NOT appear for anonymous users', () => {
    const defs = getToolDefinitions(null);
    const names = defs.map((d) => d.name);
    const authTools = allFrontendTools.filter((n) => {
      const entry = getToolEntry(n);
      return entry.access === 'authenticated';
    });
    for (const tool of authTools) {
      expect(names).not.toContain(tool);
    }
  });
});
