// agent/tools/orders.js — Order-domain tool handlers

import Order from '../../backend/models/orderModel.js';
import { isValidObjectId } from '../helpers/validate.js';
import { successResponse, errorResponse } from '../helpers/response.js';

/**
 * Tool: get_order
 * Retrieve the full details of a specific order by its order ID.
 * Access: authenticated
 */
async function getOrder(params, context) {
  const { order_id } = params;

  if (!order_id || !isValidObjectId(order_id)) {
    return errorResponse('Invalid or missing order ID', 'INVALID_PARAM');
  }

  try {
    const order = await Order.findById(order_id).populate('user', 'name email');

    if (!order) {
      return errorResponse(`Order ${order_id} not found`, 'NOT_FOUND');
    }

    return successResponse(order);
  } catch (err) {
    return errorResponse(`Failed to fetch order: ${err.message}`, 'INTERNAL_ERROR');
  }
}

/**
 * Tool: get_my_orders
 * Retrieve all orders placed by the currently authenticated user.
 * Access: authenticated
 */
async function getMyOrders(params, context) {
  try {
    const orders = await Order.find({ user: context.userId });

    return successResponse(orders);
  } catch (err) {
    return errorResponse(`Failed to fetch orders: ${err.message}`, 'INTERNAL_ERROR');
  }
}

/**
 * Tool: list_orders
 * Retrieve all orders in the system with populated user details.
 * Access: admin
 */
async function listOrders(params, context) {
  try {
    const orders = await Order.find({}).populate('user', 'id name');

    return successResponse(orders);
  } catch (err) {
    return errorResponse(`Failed to fetch orders: ${err.message}`, 'INTERNAL_ERROR');
  }
}

export { getOrder, getMyOrders, listOrders };
