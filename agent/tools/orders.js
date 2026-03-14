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

export { getOrder };
