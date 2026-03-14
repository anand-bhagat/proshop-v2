// Tests for agent/tools/products.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the Product model before importing handlers
const mockFindById = jest.fn();
jest.unstable_mockModule('../../../backend/models/productModel.js', () => ({
  default: { findById: mockFindById },
}));

const { getProduct } = await import('../../tools/products.js');

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

const sampleProduct = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Test Product',
  image: '/images/test.jpg',
  brand: 'TestBrand',
  category: 'Electronics',
  description: 'A test product',
  reviews: [],
  rating: 4.5,
  numReviews: 10,
  price: 99.99,
  countInStock: 5,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// get_product
// ---------------------------------------------------------------------------

describe('get_product', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return product details for a valid product ID', async () => {
    mockFindById.mockResolvedValue(sampleProduct);

    const result = await getProduct(
      { product_id: '507f1f77bcf86cd799439011' },
      mockContext()
    );

    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Test Product');
    expect(result.data.price).toBe(99.99);
    expect(mockFindById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });

  it('should return NOT_FOUND for non-existent product', async () => {
    mockFindById.mockResolvedValue(null);

    const result = await getProduct(
      { product_id: '507f1f77bcf86cd799439012' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
  });

  it('should return INVALID_PARAM for invalid ObjectId', async () => {
    const result = await getProduct(
      { product_id: 'not-valid-id' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('should return INVALID_PARAM for missing product_id', async () => {
    const result = await getProduct({}, mockContext());

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should handle product with empty reviews array', async () => {
    mockFindById.mockResolvedValue({ ...sampleProduct, reviews: [] });

    const result = await getProduct(
      { product_id: '507f1f77bcf86cd799439011' },
      mockContext()
    );

    expect(result.success).toBe(true);
    expect(result.data.reviews).toEqual([]);
  });

  it('should return INTERNAL_ERROR on database failure', async () => {
    mockFindById.mockRejectedValue(new Error('DB connection lost'));

    const result = await getProduct(
      { product_id: '507f1f77bcf86cd799439011' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});
