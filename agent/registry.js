// agent/registry.js — Tool Registry
// Registers all 28 tools with JSON schemas, descriptions, execution types, and access levels.
// Backend tool handlers are null until implemented in later phases.

import { validateParams } from './helpers/validate.js';
import { checkPermission } from './helpers/auth.js';
import { errorResponse } from './helpers/response.js';
import agentConfig from './config.js';

// Phase 2: Core Read Tool handlers
import { getProduct } from './tools/products.js';
import { getOrder } from './tools/orders.js';
import { getUserProfile, getUser } from './tools/users.js';

// Phase 3: Search & List Tool handlers
import { searchProducts, getTopProducts } from './tools/products.js';
import { getMyOrders, listOrders } from './tools/orders.js';
import { listUsers } from './tools/users.js';

// ---------------------------------------------------------------------------
// Tool Definitions — 17 backend + 11 frontend
// ---------------------------------------------------------------------------

const tools = {
  // ── Products (backend) ──────────────────────────────────────────────────

  get_product: {
    description:
      'Fetch a single product by its MongoDB ObjectId. Returns full product details including reviews, rating, price, and stock count. No authentication required.',
    handler: getProduct,
    schema: {
      type: 'object',
      required: ['product_id'],
      additionalProperties: false,
      properties: {
        product_id: {
          type: 'string',
          pattern: '^[0-9a-fA-F]{24}$',
          description: 'The MongoDB ObjectId of the product to retrieve.',
        },
      },
    },
    execution: 'backend',
    access: 'public',
    category: 'products',
    confirmBefore: false,
  },

  search_products: {
    description:
      'Search the product catalog by keyword with pagination. Returns matching products, page count, and current page. Keyword is matched as case-insensitive regex against product names. Omit keyword to return all products.',
    handler: searchProducts,
    schema: {
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        keyword: {
          type: 'string',
          description:
            'Optional search term. Matched as a case-insensitive regex against product names. Omit or leave empty to return all products.',
        },
        page: {
          type: 'integer',
          minimum: 1,
          default: 1,
          description: 'Page number for paginated results. Defaults to 1.',
        },
      },
    },
    execution: 'backend',
    access: 'public',
    category: 'products',
    confirmBefore: false,
  },

  get_top_products: {
    description:
      'Retrieve the top 3 highest-rated products in the catalog. No parameters needed. No authentication required.',
    handler: getTopProducts,
    schema: {
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {},
    },
    execution: 'backend',
    access: 'public',
    category: 'products',
    confirmBefore: false,
  },

  create_product: {
    description:
      'Create a new product with sample placeholder values. Admin only. No parameters needed — creates a template product that can be updated afterward.',
    handler: null, // Phase 5
    schema: {
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {},
    },
    execution: 'backend',
    access: 'admin',
    category: 'products',
    confirmBefore: false,
  },

  update_product: {
    description:
      'Update an existing product\'s details. Admin only. Provide product_id and any fields to update (name, price, description, image, brand, category, countInStock).',
    handler: null, // Phase 5
    schema: {
      type: 'object',
      required: ['product_id'],
      additionalProperties: false,
      properties: {
        product_id: {
          type: 'string',
          pattern: '^[0-9a-fA-F]{24}$',
          description: 'The MongoDB ObjectId of the product to update.',
        },
        name: { type: 'string', description: 'Updated product name.' },
        price: {
          type: 'number',
          minimum: 0,
          description: 'Updated product price.',
        },
        description: {
          type: 'string',
          description: 'Updated product description.',
        },
        image: {
          type: 'string',
          description: 'Updated product image path or URL.',
        },
        brand: { type: 'string', description: 'Updated product brand.' },
        category: {
          type: 'string',
          description: 'Updated product category.',
        },
        countInStock: {
          type: 'integer',
          minimum: 0,
          description: 'Updated stock count.',
        },
      },
    },
    execution: 'backend',
    access: 'admin',
    category: 'products',
    confirmBefore: false,
  },

  delete_product: {
    description:
      'Permanently delete a product from the catalog by its MongoDB ObjectId. Admin only. Requires user confirmation before execution.',
    handler: null, // Phase 5
    schema: {
      type: 'object',
      required: ['product_id'],
      additionalProperties: false,
      properties: {
        product_id: {
          type: 'string',
          pattern: '^[0-9a-fA-F]{24}$',
          description: 'The MongoDB ObjectId of the product to delete.',
        },
      },
    },
    execution: 'backend',
    access: 'admin',
    category: 'products',
    confirmBefore: true,
  },

  submit_review: {
    description:
      'Submit or update a review for a product. Authenticated users only. Provide product_id, rating (1-5), and a comment. If the user already reviewed this product, the existing review is updated.',
    handler: null, // Phase 5
    schema: {
      type: 'object',
      required: ['product_id', 'rating', 'comment'],
      additionalProperties: false,
      properties: {
        product_id: {
          type: 'string',
          pattern: '^[0-9a-fA-F]{24}$',
          description: 'The MongoDB ObjectId of the product to review.',
        },
        rating: {
          type: 'integer',
          minimum: 1,
          maximum: 5,
          description: 'Star rating from 1 (worst) to 5 (best).',
        },
        comment: {
          type: 'string',
          minLength: 1,
          description: 'The review text. Must not be empty.',
        },
      },
    },
    execution: 'backend',
    access: 'authenticated',
    category: 'products',
    confirmBefore: false,
  },

  // ── Orders (backend) ───────────────────────────────────────────────────

  get_order: {
    description:
      'Retrieve the full details of a specific order by its order ID. Includes populated user and product details. Authenticated users only.',
    handler: getOrder,
    schema: {
      type: 'object',
      required: ['order_id'],
      additionalProperties: false,
      properties: {
        order_id: {
          type: 'string',
          pattern: '^[a-fA-F0-9]{24}$',
          description: 'The MongoDB ObjectId of the order to retrieve.',
        },
      },
    },
    execution: 'backend',
    access: 'authenticated',
    category: 'orders',
    confirmBefore: false,
  },

  get_my_orders: {
    description:
      'Retrieve all orders placed by the currently authenticated user. No parameters needed.',
    handler: getMyOrders,
    schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execution: 'backend',
    access: 'authenticated',
    category: 'orders',
    confirmBefore: false,
  },

  list_orders: {
    description:
      'Retrieve all orders in the system with populated user details. Admin only.',
    handler: listOrders,
    schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execution: 'backend',
    access: 'admin',
    category: 'orders',
    confirmBefore: false,
  },

  mark_order_delivered: {
    description:
      'Mark an order as delivered by setting its delivery status and recording the timestamp. Admin only.',
    handler: null, // Phase 5
    schema: {
      type: 'object',
      required: ['order_id'],
      additionalProperties: false,
      properties: {
        order_id: {
          type: 'string',
          pattern: '^[a-fA-F0-9]{24}$',
          description:
            'The MongoDB ObjectId of the order to mark as delivered.',
        },
      },
    },
    execution: 'backend',
    access: 'admin',
    category: 'orders',
    confirmBefore: false,
  },

  // ── Users (backend) ────────────────────────────────────────────────────

  get_user_profile: {
    description:
      'Retrieve the profile of the currently authenticated user. No parameters needed. Returns name, email, and admin status.',
    handler: getUserProfile,
    schema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    execution: 'backend',
    access: 'authenticated',
    category: 'users',
    confirmBefore: false,
  },

  list_users: {
    description:
      'Retrieve a list of all registered users. Admin only. Password hashes are excluded.',
    handler: listUsers,
    schema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    execution: 'backend',
    access: 'admin',
    category: 'users',
    confirmBefore: false,
  },

  get_user: {
    description:
      'Retrieve a specific user\'s details by their user ID. Admin only. Password hash is excluded.',
    handler: getUser,
    schema: {
      type: 'object',
      required: ['user_id'],
      additionalProperties: false,
      properties: {
        user_id: {
          type: 'string',
          pattern: '^[0-9a-fA-F]{24}$',
          description: 'The MongoDB ObjectId of the user to retrieve.',
        },
      },
    },
    execution: 'backend',
    access: 'admin',
    category: 'users',
    confirmBefore: false,
  },

  update_user_profile: {
    description:
      'Update the currently authenticated user\'s own profile. Only name and email can be changed. Password is excluded for security.',
    handler: null, // Phase 5
    schema: {
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          minLength: 1,
          description:
            'The new display name. If omitted, the current name is kept.',
        },
        email: {
          type: 'string',
          format: 'email',
          description:
            'The new email address. If omitted, the current email is kept.',
        },
      },
    },
    execution: 'backend',
    access: 'authenticated',
    category: 'users',
    confirmBefore: false,
  },

  update_user: {
    description:
      'Update any user\'s account details by their ID. Admin only. Can change name, email, and admin status.',
    handler: null, // Phase 5
    schema: {
      type: 'object',
      required: ['user_id'],
      additionalProperties: false,
      properties: {
        user_id: {
          type: 'string',
          pattern: '^[0-9a-fA-F]{24}$',
          description: 'The MongoDB ObjectId of the user to update.',
        },
        name: {
          type: 'string',
          minLength: 1,
          description: 'The new display name for the user.',
        },
        email: {
          type: 'string',
          format: 'email',
          description: 'The new email address for the user.',
        },
        isAdmin: {
          type: 'boolean',
          description: 'Whether the user should have admin privileges.',
        },
      },
    },
    execution: 'backend',
    access: 'admin',
    category: 'users',
    confirmBefore: false,
  },

  delete_user: {
    description:
      'Delete a user account by user ID. Admin only. Requires user confirmation before execution.',
    handler: null, // Phase 5
    schema: {
      type: 'object',
      required: ['user_id'],
      additionalProperties: false,
      properties: {
        user_id: {
          type: 'string',
          pattern: '^[0-9a-fA-F]{24}$',
          description: 'The MongoDB ObjectId of the user to delete.',
        },
      },
    },
    execution: 'backend',
    access: 'admin',
    category: 'users',
    confirmBefore: true,
  },

  // ── Cart (frontend) ────────────────────────────────────────────────────

  add_to_cart: {
    description:
      'Add a product to the shopping cart, or update its quantity if it already exists. Provide product_id and qty.',
    handler: null, // frontend — no server handler
    schema: {
      type: 'object',
      required: ['product_id', 'qty'],
      additionalProperties: false,
      properties: {
        product_id: {
          type: 'string',
          pattern: '^[a-fA-F0-9]{24}$',
          description: 'The MongoDB ObjectId of the product to add to the cart.',
        },
        qty: {
          type: 'integer',
          minimum: 1,
          description:
            'The quantity to add. Must be at least 1 and should not exceed countInStock.',
        },
      },
    },
    execution: 'frontend',
    access: 'public',
    category: 'cart',
    confirmBefore: false,
    frontendAction: {
      type: 'dispatch',
      store: 'cart',
      action: 'addToCart',
    },
  },

  remove_from_cart: {
    description:
      'Remove a specific product from the shopping cart by its product ID.',
    handler: null,
    schema: {
      type: 'object',
      required: ['product_id'],
      additionalProperties: false,
      properties: {
        product_id: {
          type: 'string',
          pattern: '^[a-fA-F0-9]{24}$',
          description:
            'The MongoDB ObjectId of the product to remove from the cart.',
        },
      },
    },
    execution: 'frontend',
    access: 'public',
    category: 'cart',
    confirmBefore: false,
    frontendAction: {
      type: 'dispatch',
      store: 'cart',
      action: 'removeFromCart',
    },
  },

  clear_cart: {
    description: 'Remove all items from the shopping cart at once.',
    handler: null,
    schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execution: 'frontend',
    access: 'public',
    category: 'cart',
    confirmBefore: false,
    frontendAction: {
      type: 'dispatch',
      store: 'cart',
      action: 'clearCartItems',
    },
  },

  // ── Navigation (frontend) ──────────────────────────────────────────────

  navigate_to_login: {
    description: 'Navigate the user to the login page.',
    handler: null,
    schema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    execution: 'frontend',
    access: 'public',
    category: 'navigation',
    confirmBefore: false,
    frontendAction: { type: 'navigate', route: '/login' },
  },

  navigate_to_register: {
    description: 'Navigate the user to the registration page.',
    handler: null,
    schema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    execution: 'frontend',
    access: 'public',
    category: 'navigation',
    confirmBefore: false,
    frontendAction: { type: 'navigate', route: '/register' },
  },

  navigate_to_checkout: {
    description:
      'Navigate the user to the shipping step of the checkout process. Authenticated users only.',
    handler: null,
    schema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    execution: 'frontend',
    access: 'authenticated',
    category: 'navigation',
    confirmBefore: false,
    frontendAction: { type: 'navigate', route: '/shipping' },
  },

  navigate_to_profile: {
    description:
      'Navigate the user to their profile page. Authenticated users only.',
    handler: null,
    schema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    execution: 'frontend',
    access: 'authenticated',
    category: 'navigation',
    confirmBefore: false,
    frontendAction: { type: 'navigate', route: '/profile' },
  },

  navigate_to_product: {
    description:
      'Navigate the user to a specific product detail page. Provide the product_id.',
    handler: null,
    schema: {
      type: 'object',
      required: ['product_id'],
      additionalProperties: false,
      properties: {
        product_id: {
          type: 'string',
          description:
            'The unique MongoDB ObjectId of the product to display.',
        },
      },
    },
    execution: 'frontend',
    access: 'public',
    category: 'navigation',
    confirmBefore: false,
    frontendAction: { type: 'navigate', route: '/product/:id' },
  },

  navigate_to_cart: {
    description: 'Navigate the user to the shopping cart page.',
    handler: null,
    schema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    execution: 'frontend',
    access: 'public',
    category: 'navigation',
    confirmBefore: false,
    frontendAction: { type: 'navigate', route: '/cart' },
  },

  navigate_to_order: {
    description:
      'Navigate the user to a specific order detail page. Authenticated users only.',
    handler: null,
    schema: {
      type: 'object',
      required: ['order_id'],
      additionalProperties: false,
      properties: {
        order_id: {
          type: 'string',
          description: 'The unique MongoDB ObjectId of the order to display.',
        },
      },
    },
    execution: 'frontend',
    access: 'authenticated',
    category: 'navigation',
    confirmBefore: false,
    frontendAction: { type: 'navigate', route: '/order/:id' },
  },

  navigate_to_home: {
    description: 'Navigate the user to the homepage of the ProShop store.',
    handler: null,
    schema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    execution: 'frontend',
    access: 'public',
    category: 'navigation',
    confirmBefore: false,
    frontendAction: { type: 'navigate', route: '/' },
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return tool definitions filtered by user role and enabled categories.
 * Output format matches the LLM function-calling schema.
 */
function getToolDefinitions(userRole) {
  const enabledCategories = agentConfig.enabledCategories;
  const definitions = [];

  for (const [name, tool] of Object.entries(tools)) {
    // Filter by enabled category
    if (!enabledCategories.includes(tool.category)) continue;

    // Filter by access level
    if (tool.access === 'admin' && userRole !== 'admin') continue;
    if (tool.access === 'authenticated' && !userRole) continue;

    definitions.push({
      name,
      description: tool.description,
      parameters: tool.schema,
    });
  }

  return definitions;
}

/**
 * Execute a tool by name.
 * 1. Check the tool exists
 * 2. Check user permissions
 * 3. Check confirmation for destructive tools
 * 4. Validate params
 * 5. Route to backend handler or return frontend action
 */
async function executeTool(name, params, context) {
  const tool = tools[name];
  if (!tool) {
    return errorResponse(`Unknown tool: ${name}`, 'NOT_FOUND');
  }

  // Category enabled check
  if (!agentConfig.enabledCategories.includes(tool.category)) {
    return errorResponse(`Tool category "${tool.category}" is disabled`, 'FORBIDDEN');
  }

  // Permission check
  const access = checkPermission(context, tool.access);
  if (!access.allowed) {
    return errorResponse(access.error, 'FORBIDDEN');
  }

  // Confirmation check for destructive tools
  if (tool.confirmBefore && !params.__confirmed) {
    return {
      type: 'confirmation_needed',
      tool: name,
      params,
      message: `I'd like to ${name.replace(/_/g, ' ')}. Should I proceed?`,
    };
  }

  // Validate parameters
  const validation = validateParams(params, tool.schema);
  if (!validation.valid) {
    return errorResponse(validation.error, 'INVALID_PARAM');
  }

  // Route by execution type
  if (tool.execution === 'frontend') {
    return {
      type: 'frontend_action',
      tool: name,
      actionType: tool.frontendAction.type,
      store: tool.frontendAction.store || null,
      action: tool.frontendAction.action || null,
      route: tool.frontendAction.route || null,
      params,
    };
  }

  // Backend execution
  if (!tool.handler) {
    return errorResponse(
      `Tool "${name}" is registered but its handler is not yet implemented`,
      'NOT_IMPLEMENTED'
    );
  }

  try {
    const start = Date.now();
    const result = await tool.handler(params, context);
    const duration = Date.now() - start;

    // Structured logging
    console.log(
      JSON.stringify({
        type: 'tool_execution',
        tool: name,
        userId: context?.userId || null,
        role: context?.role || null,
        success: result.success,
        errorCode: result.code || null,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      })
    );

    return result;
  } catch (err) {
    return errorResponse(
      `Tool execution failed: ${err.message}`,
      'INTERNAL_ERROR'
    );
  }
}

/**
 * Register or replace a tool handler at runtime (used by tool implementation phases).
 */
function registerHandler(name, handler) {
  if (!tools[name]) {
    throw new Error(`Cannot register handler: tool "${name}" not found in registry`);
  }
  tools[name].handler = handler;
}

/**
 * Get the raw tool entry (used by the engine to check confirmBefore, execution type, etc.)
 */
function getToolEntry(name) {
  return tools[name] || null;
}

export { getToolDefinitions, executeTool, registerHandler, getToolEntry };
