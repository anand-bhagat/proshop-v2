// Tests for agent/tools/orders.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the Order model before importing handlers
const mockPopulate = jest.fn();
const mockFindById = jest.fn(() => ({ populate: mockPopulate }));
jest.unstable_mockModule('../../../backend/models/orderModel.js', () => ({
  default: { findById: mockFindById },
}));

const { getOrder } = await import('../../tools/orders.js');

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

const sampleOrder = {
  _id: '507f1f77bcf86cd799439022',
  user: {
    _id: '507f1f77bcf86cd799439011',
    name: 'John Doe',
    email: 'john@example.com',
  },
  orderItems: [
    {
      name: 'Test Product',
      qty: 2,
      image: '/images/test.jpg',
      price: 49.99,
      product: '507f1f77bcf86cd799439033',
    },
  ],
  shippingAddress: {
    address: '123 Main St',
    city: 'Boston',
    postalCode: '02101',
    country: 'US',
  },
  paymentMethod: 'PayPal',
  paymentResult: null,
  itemsPrice: 99.98,
  taxPrice: 15.0,
  shippingPrice: 0.0,
  totalPrice: 114.98,
  isPaid: false,
  isDelivered: false,
  createdAt: '2024-01-15T09:00:00.000Z',
};

// ---------------------------------------------------------------------------
// get_order
// ---------------------------------------------------------------------------

describe('get_order', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindById.mockReturnValue({ populate: mockPopulate });
  });

  it('should return order details for a valid order ID', async () => {
    mockPopulate.mockResolvedValue(sampleOrder);

    const result = await getOrder(
      { order_id: '507f1f77bcf86cd799439022' },
      mockContext()
    );

    expect(result.success).toBe(true);
    expect(result.data.user.name).toBe('John Doe');
    expect(result.data.totalPrice).toBe(114.98);
    expect(mockFindById).toHaveBeenCalledWith('507f1f77bcf86cd799439022');
    expect(mockPopulate).toHaveBeenCalledWith('user', 'name email');
  });

  it('should return NOT_FOUND for non-existent order', async () => {
    mockPopulate.mockResolvedValue(null);

    const result = await getOrder(
      { order_id: '507f1f77bcf86cd799439099' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
  });

  it('should return INVALID_PARAM for invalid ObjectId', async () => {
    const result = await getOrder(
      { order_id: 'bad-id' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('should return INVALID_PARAM for missing order_id', async () => {
    const result = await getOrder({}, mockContext());

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should handle unpaid order with null paymentResult', async () => {
    mockPopulate.mockResolvedValue({ ...sampleOrder, paymentResult: null, isPaid: false });

    const result = await getOrder(
      { order_id: '507f1f77bcf86cd799439022' },
      mockContext()
    );

    expect(result.success).toBe(true);
    expect(result.data.isPaid).toBe(false);
    expect(result.data.paymentResult).toBeNull();
  });

  it('should return INTERNAL_ERROR on database failure', async () => {
    mockPopulate.mockRejectedValue(new Error('DB connection lost'));

    const result = await getOrder(
      { order_id: '507f1f77bcf86cd799439022' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});
