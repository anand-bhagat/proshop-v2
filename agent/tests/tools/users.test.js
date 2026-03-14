// Tests for agent/tools/users.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the User model before importing handlers
const mockSelect = jest.fn();
const mockFindById = jest.fn();
const mockFind = jest.fn();
jest.unstable_mockModule('../../../backend/models/userModel.js', () => ({
  default: { findById: mockFindById, find: mockFind },
}));

const { getUserProfile, getUser, listUsers } = await import(
  '../../tools/users.js'
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

function mockAdminContext() {
  return mockContext({ role: 'admin', name: 'Admin User' });
}

const sampleUser = {
  _id: '507f1f77bcf86cd799439011',
  name: 'John Doe',
  email: 'john@example.com',
  isAdmin: false,
};

const sampleUser2 = {
  _id: '507f1f77bcf86cd799439012',
  name: 'Jane Smith',
  email: 'jane@example.com',
  isAdmin: false,
};

const sampleAdmin = {
  _id: '507f1f77bcf86cd799439013',
  name: 'Admin User',
  email: 'admin@example.com',
  isAdmin: true,
};

// ---------------------------------------------------------------------------
// get_user_profile
// ---------------------------------------------------------------------------

describe('get_user_profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset findById to return directly (no chained .select())
    mockFindById.mockReset();
  });

  it('should return the authenticated user profile', async () => {
    mockFindById.mockResolvedValue(sampleUser);

    const result = await getUserProfile({}, mockContext());

    expect(result.success).toBe(true);
    expect(result.data._id).toBe('507f1f77bcf86cd799439011');
    expect(result.data.name).toBe('John Doe');
    expect(result.data.email).toBe('john@example.com');
    expect(result.data.isAdmin).toBe(false);
    expect(mockFindById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });

  it('should return only safe fields (no password)', async () => {
    mockFindById.mockResolvedValue({
      ...sampleUser,
      password: '$2a$10$hashedpassword',
    });

    const result = await getUserProfile({}, mockContext());

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('password');
    expect(result.data).toHaveProperty('name');
    expect(result.data).toHaveProperty('email');
    expect(result.data).toHaveProperty('isAdmin');
  });

  it('should return NOT_FOUND if user no longer exists', async () => {
    mockFindById.mockResolvedValue(null);

    const result = await getUserProfile({}, mockContext());

    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
  });

  it('should return INTERNAL_ERROR on database failure', async () => {
    mockFindById.mockRejectedValue(new Error('DB connection lost'));

    const result = await getUserProfile({}, mockContext());

    expect(result.success).toBe(false);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// get_user
// ---------------------------------------------------------------------------

describe('get_user', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // get_user chains .select('-password') so we need to mock that
    mockFindById.mockReset();
  });

  it('should return user details for a valid user ID', async () => {
    mockFindById.mockReturnValue({ select: mockSelect });
    mockSelect.mockResolvedValue(sampleUser);

    const result = await getUser(
      { user_id: '507f1f77bcf86cd799439011' },
      mockAdminContext()
    );

    expect(result.success).toBe(true);
    expect(result.data.name).toBe('John Doe');
    expect(result.data.email).toBe('john@example.com');
    expect(mockFindById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(mockSelect).toHaveBeenCalledWith('-password');
  });

  it('should return NOT_FOUND for non-existent user', async () => {
    mockFindById.mockReturnValue({ select: mockSelect });
    mockSelect.mockResolvedValue(null);

    const result = await getUser(
      { user_id: '507f1f77bcf86cd799439099' },
      mockAdminContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
  });

  it('should return INVALID_PARAM for invalid ObjectId', async () => {
    const result = await getUser(
      { user_id: 'not-valid' },
      mockAdminContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('should return INVALID_PARAM for missing user_id', async () => {
    const result = await getUser({}, mockAdminContext());

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should return INTERNAL_ERROR on database failure', async () => {
    mockFindById.mockReturnValue({ select: mockSelect });
    mockSelect.mockRejectedValue(new Error('DB connection lost'));

    const result = await getUser(
      { user_id: '507f1f77bcf86cd799439011' },
      mockAdminContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// list_users
// ---------------------------------------------------------------------------

describe('list_users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all users without password fields', async () => {
    mockSelect.mockResolvedValue([sampleUser, sampleUser2, sampleAdmin]);
    mockFind.mockReturnValue({ select: mockSelect });

    const result = await listUsers({}, mockAdminContext());

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(3);
    expect(mockFind).toHaveBeenCalledWith({});
    expect(mockSelect).toHaveBeenCalledWith('-password');
  });

  it('should return empty array when no users exist', async () => {
    mockSelect.mockResolvedValue([]);
    mockFind.mockReturnValue({ select: mockSelect });

    const result = await listUsers({}, mockAdminContext());

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('should verify password field is excluded via select', async () => {
    mockSelect.mockResolvedValue([sampleUser]);
    mockFind.mockReturnValue({ select: mockSelect });

    await listUsers({}, mockAdminContext());

    expect(mockSelect).toHaveBeenCalledWith('-password');
  });

  it('should return INTERNAL_ERROR on database failure', async () => {
    mockSelect.mockRejectedValue(new Error('DB connection lost'));
    mockFind.mockReturnValue({ select: mockSelect });

    const result = await listUsers({}, mockAdminContext());

    expect(result.success).toBe(false);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});
