// Tests for agent/tools/products.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the Product model before importing handlers
const mockFindById = jest.fn();
const mockCountDocuments = jest.fn();
const mockSkip = jest.fn();
const mockLimit = jest.fn();
const mockSort = jest.fn();
const mockFind = jest.fn();
const mockSave = jest.fn();
const mockDeleteOne = jest.fn();

// Mock Product constructor for create_product
let mockProductInstance;
const MockProduct = jest.fn().mockImplementation((data) => {
  mockProductInstance = { ...data, _id: '507f1f77bcf86cd799439099', save: mockSave };
  return mockProductInstance;
});
MockProduct.findById = mockFindById;
MockProduct.find = mockFind;
MockProduct.countDocuments = mockCountDocuments;
MockProduct.deleteOne = mockDeleteOne;

jest.unstable_mockModule('../../../backend/models/productModel.js', () => ({
  default: MockProduct,
}));

const {
  getProduct,
  searchProducts,
  getTopProducts,
  createProduct,
  updateProduct,
  submitReview,
  deleteProduct,
} = await import('../../tools/products.js');

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

const sampleProduct2 = {
  _id: '507f1f77bcf86cd799439012',
  name: 'Another Product',
  image: '/images/another.jpg',
  brand: 'OtherBrand',
  category: 'Electronics',
  description: 'Another product',
  reviews: [],
  rating: 4.0,
  numReviews: 5,
  price: 49.99,
  countInStock: 10,
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

// ---------------------------------------------------------------------------
// search_products
// ---------------------------------------------------------------------------

describe('search_products', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up chainable mock: find() -> limit() -> skip() -> resolves
    mockSkip.mockResolvedValue([sampleProduct]);
    mockLimit.mockReturnValue({ skip: mockSkip });
    mockFind.mockReturnValue({ limit: mockLimit });
    mockCountDocuments.mockResolvedValue(1);
  });

  it('should return matching products for a keyword', async () => {
    const result = await searchProducts({ keyword: 'Test' }, mockContext());

    expect(result.success).toBe(true);
    expect(result.data.products).toHaveLength(1);
    expect(result.data.products[0].name).toBe('Test Product');
    expect(result.data.page).toBe(1);
    expect(result.data.pages).toBe(1);
    // Verify regex filter was used
    expect(mockFind).toHaveBeenCalledWith({
      name: { $regex: 'Test', $options: 'i' },
    });
    expect(mockCountDocuments).toHaveBeenCalledWith({
      name: { $regex: 'Test', $options: 'i' },
    });
  });

  it('should return all products when no keyword is provided', async () => {
    mockCountDocuments.mockResolvedValue(2);
    mockSkip.mockResolvedValue([sampleProduct, sampleProduct2]);

    const result = await searchProducts({}, mockContext());

    expect(result.success).toBe(true);
    expect(result.data.products).toHaveLength(2);
    expect(mockFind).toHaveBeenCalledWith({});
    expect(mockCountDocuments).toHaveBeenCalledWith({});
  });

  it('should return empty results when keyword matches nothing', async () => {
    mockCountDocuments.mockResolvedValue(0);
    mockSkip.mockResolvedValue([]);

    const result = await searchProducts(
      { keyword: 'nonexistent' },
      mockContext()
    );

    expect(result.success).toBe(true);
    expect(result.data.products).toEqual([]);
    expect(result.data.page).toBe(1);
    expect(result.data.pages).toBe(0);
  });

  it('should handle pagination (page 2)', async () => {
    mockCountDocuments.mockResolvedValue(16);
    mockSkip.mockResolvedValue([sampleProduct2]);

    const result = await searchProducts({ page: 2 }, mockContext());

    expect(result.success).toBe(true);
    expect(result.data.page).toBe(2);
    expect(result.data.pages).toBe(2);
    // Verify skip was called with correct offset (pageSize * (page-1))
    expect(mockSkip).toHaveBeenCalled();
  });

  it('should default page to 1 when not provided', async () => {
    const result = await searchProducts({ keyword: 'Test' }, mockContext());

    expect(result.success).toBe(true);
    expect(result.data.page).toBe(1);
  });

  it('should escape special regex characters in keyword', async () => {
    const result = await searchProducts(
      { keyword: 'test+product (special)' },
      mockContext()
    );

    expect(result.success).toBe(true);
    // The regex should have escaped special chars
    expect(mockFind).toHaveBeenCalledWith({
      name: {
        $regex: 'test\\+product \\(special\\)',
        $options: 'i',
      },
    });
  });

  it('should return INTERNAL_ERROR on database failure', async () => {
    mockCountDocuments.mockRejectedValue(new Error('DB error'));

    const result = await searchProducts({ keyword: 'test' }, mockContext());

    expect(result.success).toBe(false);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// get_top_products
// ---------------------------------------------------------------------------

describe('get_top_products', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return top 3 products sorted by rating', async () => {
    const topProducts = [
      { ...sampleProduct, rating: 5.0 },
      { ...sampleProduct2, rating: 4.5 },
      { ...sampleProduct, _id: '507f1f77bcf86cd799439013', rating: 4.0 },
    ];
    mockLimit.mockResolvedValue(topProducts);
    mockSort.mockReturnValue({ limit: mockLimit });
    mockFind.mockReturnValue({ sort: mockSort });

    const result = await getTopProducts({}, mockContext());

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(3);
    expect(mockFind).toHaveBeenCalledWith({});
    expect(mockSort).toHaveBeenCalledWith({ rating: -1 });
    expect(mockLimit).toHaveBeenCalledWith(3);
  });

  it('should handle fewer than 3 products in the database', async () => {
    mockLimit.mockResolvedValue([sampleProduct]);
    mockSort.mockReturnValue({ limit: mockLimit });
    mockFind.mockReturnValue({ sort: mockSort });

    const result = await getTopProducts({}, mockContext());

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('should handle empty product catalog', async () => {
    mockLimit.mockResolvedValue([]);
    mockSort.mockReturnValue({ limit: mockLimit });
    mockFind.mockReturnValue({ sort: mockSort });

    const result = await getTopProducts({}, mockContext());

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('should return INTERNAL_ERROR on database failure', async () => {
    mockLimit.mockRejectedValue(new Error('DB connection lost'));
    mockSort.mockReturnValue({ limit: mockLimit });
    mockFind.mockReturnValue({ sort: mockSort });

    const result = await getTopProducts({}, mockContext());

    expect(result.success).toBe(false);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// create_product
// ---------------------------------------------------------------------------

describe('create_product', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a product with sample placeholder values', async () => {
    const savedProduct = {
      _id: '507f1f77bcf86cd799439099',
      name: 'Sample name',
      price: 0,
      user: '507f1f77bcf86cd799439011',
      image: '/images/sample.jpg',
      brand: 'Sample brand',
      category: 'Sample category',
      countInStock: 0,
      numReviews: 0,
      description: 'Sample description',
    };
    mockSave.mockResolvedValue(savedProduct);

    const result = await createProduct({}, mockContext());

    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Sample name');
    expect(result.data.price).toBe(0);
    expect(result.data.user).toBe('507f1f77bcf86cd799439011');
    expect(mockSave).toHaveBeenCalled();
  });

  it('should use the authenticated user ID from context', async () => {
    const ctx = mockContext({ userId: 'aabbccddeeff00112233aabb' });
    mockSave.mockResolvedValue({ _id: '507f1f77bcf86cd799439099', user: ctx.userId });

    await createProduct({}, ctx);

    expect(MockProduct).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'aabbccddeeff00112233aabb' })
    );
  });

  it('should return INTERNAL_ERROR on database failure', async () => {
    mockSave.mockRejectedValue(new Error('DB error'));

    const result = await createProduct({}, mockContext());

    expect(result.success).toBe(false);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// update_product
// ---------------------------------------------------------------------------

describe('update_product', () => {
  let mockProduct;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProduct = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Original Name',
      price: 99.99,
      description: 'Original desc',
      image: '/images/orig.jpg',
      brand: 'OrigBrand',
      category: 'Electronics',
      countInStock: 5,
      save: mockSave,
    };
  });

  it('should update a single field', async () => {
    mockFindById.mockResolvedValue(mockProduct);
    mockSave.mockResolvedValue({ ...mockProduct, name: 'Updated Name' });

    const result = await updateProduct(
      { product_id: '507f1f77bcf86cd799439011', name: 'Updated Name' },
      mockContext()
    );

    expect(result.success).toBe(true);
    expect(mockProduct.name).toBe('Updated Name');
    // Other fields should remain unchanged
    expect(mockProduct.price).toBe(99.99);
    expect(mockSave).toHaveBeenCalled();
  });

  it('should update multiple fields', async () => {
    mockFindById.mockResolvedValue(mockProduct);
    mockSave.mockResolvedValue({ ...mockProduct, name: 'New', price: 49.99 });

    const result = await updateProduct(
      { product_id: '507f1f77bcf86cd799439011', name: 'New', price: 49.99 },
      mockContext()
    );

    expect(result.success).toBe(true);
    expect(mockProduct.name).toBe('New');
    expect(mockProduct.price).toBe(49.99);
  });

  it('should allow setting price to 0', async () => {
    mockFindById.mockResolvedValue(mockProduct);
    mockSave.mockResolvedValue({ ...mockProduct, price: 0 });

    const result = await updateProduct(
      { product_id: '507f1f77bcf86cd799439011', price: 0 },
      mockContext()
    );

    expect(result.success).toBe(true);
    expect(mockProduct.price).toBe(0);
  });

  it('should return NOT_FOUND for non-existent product', async () => {
    mockFindById.mockResolvedValue(null);

    const result = await updateProduct(
      { product_id: '507f1f77bcf86cd799439012', name: 'Test' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
  });

  it('should return INVALID_PARAM for invalid product ID', async () => {
    const result = await updateProduct(
      { product_id: 'bad-id', name: 'Test' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('should return INTERNAL_ERROR on database failure', async () => {
    mockFindById.mockRejectedValue(new Error('DB error'));

    const result = await updateProduct(
      { product_id: '507f1f77bcf86cd799439011', name: 'Test' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// submit_review
// ---------------------------------------------------------------------------

describe('submit_review', () => {
  let mockProduct;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProduct = {
      _id: '507f1f77bcf86cd799439011',
      reviews: [],
      numReviews: 0,
      rating: 0,
      save: mockSave,
    };
  });

  it('should create a new review', async () => {
    mockFindById.mockResolvedValue(mockProduct);
    mockSave.mockResolvedValue(mockProduct);

    const result = await submitReview(
      { product_id: '507f1f77bcf86cd799439011', rating: 5, comment: 'Great!' },
      mockContext()
    );

    expect(result.success).toBe(true);
    expect(result.data.message).toBe('Review added');
    expect(mockProduct.reviews).toHaveLength(1);
    expect(mockProduct.reviews[0].rating).toBe(5);
    expect(mockProduct.reviews[0].comment).toBe('Great!');
    expect(mockProduct.numReviews).toBe(1);
    expect(mockProduct.rating).toBe(5);
  });

  it('should update an existing review (upsert)', async () => {
    mockProduct.reviews = [
      {
        user: { toString: () => '507f1f77bcf86cd799439011' },
        name: 'Test User',
        rating: 3,
        comment: 'OK',
      },
    ];
    mockProduct.numReviews = 1;
    mockProduct.rating = 3;
    mockFindById.mockResolvedValue(mockProduct);
    mockSave.mockResolvedValue(mockProduct);

    const result = await submitReview(
      { product_id: '507f1f77bcf86cd799439011', rating: 5, comment: 'Amazing!' },
      mockContext()
    );

    expect(result.success).toBe(true);
    // Should still be 1 review (updated, not added)
    expect(mockProduct.reviews).toHaveLength(1);
    expect(mockProduct.reviews[0].rating).toBe(5);
    expect(mockProduct.reviews[0].comment).toBe('Amazing!');
    expect(mockProduct.numReviews).toBe(1);
  });

  it('should return NOT_FOUND for non-existent product', async () => {
    mockFindById.mockResolvedValue(null);

    const result = await submitReview(
      { product_id: '507f1f77bcf86cd799439012', rating: 5, comment: 'Great!' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
  });

  it('should return INVALID_PARAM for rating of 0', async () => {
    const result = await submitReview(
      { product_id: '507f1f77bcf86cd799439011', rating: 0, comment: 'Bad' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should return INVALID_PARAM for rating above 5', async () => {
    const result = await submitReview(
      { product_id: '507f1f77bcf86cd799439011', rating: 6, comment: 'Great!' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should return INVALID_PARAM for empty comment', async () => {
    const result = await submitReview(
      { product_id: '507f1f77bcf86cd799439011', rating: 5, comment: '' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should return INVALID_PARAM for invalid product ID', async () => {
    const result = await submitReview(
      { product_id: 'bad-id', rating: 5, comment: 'Great!' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('should return INTERNAL_ERROR on database failure', async () => {
    mockFindById.mockRejectedValue(new Error('DB error'));

    const result = await submitReview(
      { product_id: '507f1f77bcf86cd799439011', rating: 5, comment: 'Great!' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// delete_product
// ---------------------------------------------------------------------------

describe('delete_product', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete a product successfully', async () => {
    mockFindById.mockResolvedValue({ _id: '507f1f77bcf86cd799439011', name: 'Test' });
    mockDeleteOne.mockResolvedValue({ deletedCount: 1 });

    const result = await deleteProduct(
      { product_id: '507f1f77bcf86cd799439011' },
      mockContext()
    );

    expect(result.success).toBe(true);
    expect(result.data.message).toBe('Product removed');
    expect(mockDeleteOne).toHaveBeenCalledWith({ _id: '507f1f77bcf86cd799439011' });
  });

  it('should return NOT_FOUND for non-existent product', async () => {
    mockFindById.mockResolvedValue(null);

    const result = await deleteProduct(
      { product_id: '507f1f77bcf86cd799439012' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
  });

  it('should return INVALID_PARAM for invalid product ID', async () => {
    const result = await deleteProduct(
      { product_id: 'bad-id' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('should return INTERNAL_ERROR on database failure', async () => {
    mockFindById.mockRejectedValue(new Error('DB error'));

    const result = await deleteProduct(
      { product_id: '507f1f77bcf86cd799439011' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});
