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

/**
 * Escape special regex characters to prevent ReDoS.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tool: search_products
 * Search the product catalog by keyword with pagination.
 * Access: public
 */
async function searchProducts(params, context) {
  const { keyword, page = 1 } = params;
  const pageSize = Number(process.env.PAGINATION_LIMIT) || 8;

  try {
    const filter = keyword
      ? { name: { $regex: escapeRegex(keyword), $options: 'i' } }
      : {};

    const count = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .limit(pageSize)
      .skip(pageSize * (page - 1));

    return successResponse({
      products,
      page,
      pages: Math.ceil(count / pageSize),
    });
  } catch (err) {
    return errorResponse(`Failed to search products: ${err.message}`, 'INTERNAL_ERROR');
  }
}

/**
 * Tool: get_top_products
 * Retrieve the top 3 highest-rated products.
 * Access: public
 */
async function getTopProducts(params, context) {
  try {
    const products = await Product.find({}).sort({ rating: -1 }).limit(3);

    return successResponse(products);
  } catch (err) {
    return errorResponse(`Failed to fetch top products: ${err.message}`, 'INTERNAL_ERROR');
  }
}

export { getProduct, searchProducts, getTopProducts };
