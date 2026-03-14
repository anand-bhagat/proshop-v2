// agent/tools/products.js — Product-domain tool handlers

import Product from '../../backend/models/productModel.js';
import { isValidObjectId } from '../helpers/validate.js';
import { successResponse, errorResponse } from '../helpers/response.js';

/**
 * Tool: get_product
 * Fetch a single product by its MongoDB ObjectId.
 * Access: public
 */
async function getProduct(params, context) {
  const { product_id } = params;

  if (!product_id || !isValidObjectId(product_id)) {
    return errorResponse('Invalid or missing product ID', 'INVALID_PARAM');
  }

  try {
    const product = await Product.findById(product_id);

    if (!product) {
      return errorResponse(`Product ${product_id} not found`, 'NOT_FOUND');
    }

    return successResponse(product);
  } catch (err) {
    return errorResponse(`Failed to fetch product: ${err.message}`, 'INTERNAL_ERROR');
  }
}

export { getProduct };
