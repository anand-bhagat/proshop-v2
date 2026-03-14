// Tests for agent/tools/users.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the User model before importing handlers
const mockSelect = jest.fn();
const mockFindById = jest.fn();
const mockFind = jest.fn();
const mockSave = jest.fn();
const mockDeleteOne = jest.fn();
jest.unstable_mockModule('../../../backend/models/userModel.js', () => ({
  default: { findById: mockFindById, find: mockFind, deleteOne: mockDeleteOne },
}));

const {
  getUserProfile,
  getUser,
  listUsers,
  updateUserProfile,
  updateUser,
  deleteUser,
} = await import('../../tools/users.js');

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

// ---------------------------------------------------------------------------
// update_user_profile
// ---------------------------------------------------------------------------

describe('update_user_profile', () => {
  let mockUser;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindById.mockReset();
    mockUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'John Doe',
      email: 'john@example.com',
      isAdmin: false,
      save: mockSave,
    };
  });

  it('should update the user name', async () => {
    mockFindById.mockResolvedValue(mockUser);
    mockSave.mockResolvedValue({ ...mockUser, name: 'Jane Doe' });

    const result = await updateUserProfile(
      { name: 'Jane Doe' },
      mockContext()
    );

    expect(result.success).toBe(true);
    expect(mockUser.name).toBe('Jane Doe');
    expect(result.data).not.toHaveProperty('password');
  });

  it('should update the user email', async () => {
    mockFindById.mockResolvedValue(mockUser);
    mockSave.mockResolvedValue({ ...mockUser, email: 'jane@example.com' });

    const result = await updateUserProfile(
      { email: 'jane@example.com' },
      mockContext()
    );

    expect(result.success).toBe(true);
    expect(mockUser.email).toBe('jane@example.com');
  });

  it('should reject password field', async () => {
    const result = await updateUserProfile(
      { password: 'newpass123' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('should return INVALID_PARAM when no fields provided', async () => {
    const result = await updateUserProfile({}, mockContext());

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should return NOT_FOUND if user does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const result = await updateUserProfile(
      { name: 'Test' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
  });

  it('should return CONFLICT for duplicate email', async () => {
    mockFindById.mockResolvedValue(mockUser);
    const dupError = new Error('Duplicate key');
    dupError.code = 11000;
    mockSave.mockRejectedValue(dupError);

    const result = await updateUserProfile(
      { email: 'taken@example.com' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('CONFLICT');
  });

  it('should return INTERNAL_ERROR on database failure', async () => {
    mockFindById.mockRejectedValue(new Error('DB error'));

    const result = await updateUserProfile(
      { name: 'Test' },
      mockContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// update_user
// ---------------------------------------------------------------------------

describe('update_user', () => {
  let mockUser;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindById.mockReset();
    mockUser = {
      _id: '507f1f77bcf86cd799439012',
      name: 'Jane Smith',
      email: 'jane@example.com',
      isAdmin: false,
      save: mockSave,
    };
  });

  it('should update user name', async () => {
    mockFindById.mockResolvedValue(mockUser);
    mockSave.mockResolvedValue({ ...mockUser, name: 'Updated' });

    const result = await updateUser(
      { user_id: '507f1f77bcf86cd799439012', name: 'Updated' },
      mockAdminContext()
    );

    expect(result.success).toBe(true);
    expect(mockUser.name).toBe('Updated');
  });

  it('should toggle admin status', async () => {
    mockFindById.mockResolvedValue(mockUser);
    mockSave.mockResolvedValue({ ...mockUser, isAdmin: true });

    const result = await updateUser(
      { user_id: '507f1f77bcf86cd799439012', isAdmin: true },
      mockAdminContext()
    );

    expect(result.success).toBe(true);
    expect(mockUser.isAdmin).toBe(true);
  });

  it('should return NOT_FOUND for non-existent user', async () => {
    mockFindById.mockResolvedValue(null);

    const result = await updateUser(
      { user_id: '507f1f77bcf86cd799439099', name: 'Test' },
      mockAdminContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
  });

  it('should return INVALID_PARAM for invalid user ID', async () => {
    const result = await updateUser(
      { user_id: 'bad-id', name: 'Test' },
      mockAdminContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('should return INVALID_PARAM when no update fields provided', async () => {
    const result = await updateUser(
      { user_id: '507f1f77bcf86cd799439012' },
      mockAdminContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should return CONFLICT for duplicate email', async () => {
    mockFindById.mockResolvedValue(mockUser);
    const dupError = new Error('Duplicate key');
    dupError.code = 11000;
    mockSave.mockRejectedValue(dupError);

    const result = await updateUser(
      { user_id: '507f1f77bcf86cd799439012', email: 'taken@example.com' },
      mockAdminContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('CONFLICT');
  });

  it('should return INTERNAL_ERROR on database failure', async () => {
    mockFindById.mockRejectedValue(new Error('DB error'));

    const result = await updateUser(
      { user_id: '507f1f77bcf86cd799439012', name: 'Test' },
      mockAdminContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// delete_user
// ---------------------------------------------------------------------------

describe('delete_user', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindById.mockReset();
  });

  it('should delete a non-admin user successfully', async () => {
    mockFindById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439012',
      name: 'Jane',
      isAdmin: false,
    });
    mockDeleteOne.mockResolvedValue({ deletedCount: 1 });

    const result = await deleteUser(
      { user_id: '507f1f77bcf86cd799439012' },
      mockAdminContext()
    );

    expect(result.success).toBe(true);
    expect(result.data.message).toBe('User removed');
    expect(mockDeleteOne).toHaveBeenCalledWith({ _id: '507f1f77bcf86cd799439012' });
  });

  it('should prevent deleting an admin user', async () => {
    mockFindById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439013',
      name: 'Admin',
      isAdmin: true,
    });

    const result = await deleteUser(
      { user_id: '507f1f77bcf86cd799439013' },
      mockAdminContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
    expect(mockDeleteOne).not.toHaveBeenCalled();
  });

  it('should return NOT_FOUND for non-existent user', async () => {
    mockFindById.mockResolvedValue(null);

    const result = await deleteUser(
      { user_id: '507f1f77bcf86cd799439099' },
      mockAdminContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
  });

  it('should return INVALID_PARAM for invalid user ID', async () => {
    const result = await deleteUser(
      { user_id: 'bad-id' },
      mockAdminContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('should return INVALID_PARAM for missing user_id', async () => {
    const result = await deleteUser({}, mockAdminContext());

    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_PARAM');
  });

  it('should return INTERNAL_ERROR on database failure', async () => {
    mockFindById.mockRejectedValue(new Error('DB error'));

    const result = await deleteUser(
      { user_id: '507f1f77bcf86cd799439012' },
      mockAdminContext()
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});
