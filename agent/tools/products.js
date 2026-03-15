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
      ? {
          $or: [
            { name: { $regex: escapeRegex(keyword), $options: 'i' } },
            { brand: { $regex: escapeRegex(keyword), $options: 'i' } },
            { category: { $regex: escapeRegex(keyword), $options: 'i' } },
            { description: { $regex: escapeRegex(keyword), $options: 'i' } },
          ],
        }
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

/**
 * Tool: create_product
 * Create a new product with user-provided values.
 * Access: admin
 */
async function createProduct(params, context) {
  const { name, price, category, brand, countInStock, description, image } = params;

  try {
    const product = new Product({
      name,
      price,
      user: context.userId,
      image: image || '/images/sample.jpg',
      brand,
      category,
      countInStock,
      numReviews: 0,
      description: description || '',
    });

    const createdProduct = await product.save();
    return successResponse(createdProduct);
  } catch (err) {
    return errorResponse(`Failed to create product: ${err.message}`, 'INTERNAL_ERROR');
  }
}

/**
 * Tool: update_product
 * Update an existing product's details. Only provided fields are updated.
 * Access: admin
 */
async function updateProduct(params, context) {
  const { product_id, name, price, description, image, brand, category, countInStock } = params;

  if (!product_id || !isValidObjectId(product_id)) {
    return errorResponse('Invalid or missing product ID', 'INVALID_PARAM');
  }

  try {
    const product = await Product.findById(product_id);

    if (!product) {
      return errorResponse(`Product ${product_id} not found`, 'NOT_FOUND');
    }

    // Only update fields that were explicitly provided (partial update)
    if (name !== undefined) product.name = name;
    if (price !== undefined) product.price = price;
    if (description !== undefined) product.description = description;
    if (image !== undefined) product.image = image;
    if (brand !== undefined) product.brand = brand;
    if (category !== undefined) product.category = category;
    if (countInStock !== undefined) product.countInStock = countInStock;

    const updatedProduct = await product.save();
    return successResponse(updatedProduct);
  } catch (err) {
    return errorResponse(`Failed to update product: ${err.message}`, 'INTERNAL_ERROR');
  }
}

/**
 * Tool: submit_review
 * Submit or update a review for a product (upsert behavior).
 * Access: authenticated
 */
async function submitReview(params, context) {
  const { product_id, rating, comment } = params;

  if (!product_id || !isValidObjectId(product_id)) {
    return errorResponse('Invalid or missing product ID', 'INVALID_PARAM');
  }

  if (!rating || rating < 1 || rating > 5) {
    return errorResponse('Rating must be an integer between 1 and 5', 'INVALID_PARAM');
  }

  if (!comment || comment.trim().length === 0) {
    return errorResponse('Comment must not be empty', 'INVALID_PARAM');
  }

  try {
    const product = await Product.findById(product_id);

    if (!product) {
      return errorResponse(`Product ${product_id} not found`, 'NOT_FOUND');
    }

    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === context.userId.toString()
    );

    if (alreadyReviewed) {
      // Upsert: update existing review
      alreadyReviewed.name = context.name;
      alreadyReviewed.rating = Number(rating);
      alreadyReviewed.comment = comment;
    } else {
      // Create new review
      const review = {
        name: context.name,
        rating: Number(rating),
        comment,
        user: context.userId,
      };
      product.reviews.push(review);
    }

    // Recalculate aggregate values
    product.numReviews = product.reviews.length;
    product.rating =
      product.reviews.reduce((acc, item) => item.rating + acc, 0) /
      product.reviews.length;

    await product.save();
    return successResponse({ message: 'Review added' });
  } catch (err) {
    return errorResponse(`Failed to submit review: ${err.message}`, 'INTERNAL_ERROR');
  }
}

/**
 * Tool: delete_product
 * Permanently delete a product from the catalog.
 * Access: admin, confirmBefore: true
 */
async function deleteProduct(params, context) {
  const { product_id } = params;

  if (!product_id || !isValidObjectId(product_id)) {
    return errorResponse('Invalid or missing product ID', 'INVALID_PARAM');
  }

  try {
    const product = await Product.findById(product_id);

    if (!product) {
      return errorResponse(`Product ${product_id} not found`, 'NOT_FOUND');
    }

    await Product.deleteOne({ _id: product._id });
    return successResponse({ message: 'Product removed' });
  } catch (err) {
    return errorResponse(`Failed to delete product: ${err.message}`, 'INTERNAL_ERROR');
  }
}

export {
  getProduct,
  searchProducts,
  getTopProducts,
  createProduct,
  updateProduct,
  submitReview,
  deleteProduct,
};
