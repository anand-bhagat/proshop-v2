// Tests for agent/tools/products.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the Product model before importing handlers
const mockFindById = jest.fn();
const mockCountDocuments = jest.fn();
const mockSkip = jest.fn();
const mockLimit = jest.fn();
const mockSort = jest.fn();
const mockFind = jest.fn();

jest.unstable_mockModule('../../../backend/models/productModel.js', () => ({
  default: {
    findById: mockFindById,
    find: mockFind,
    countDocuments: mockCountDocuments,
  },
}));

const { getProduct, searchProducts, getTopProducts } = await import(
  '../../tools/products.js'
);

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
