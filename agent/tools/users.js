// agent/tools/users.js — User-domain tool handlers

import User from '../../backend/models/userModel.js';
import { isValidObjectId } from '../helpers/validate.js';
import { successResponse, errorResponse } from '../helpers/response.js';

/**
 * Tool: get_user_profile
 * Retrieve the profile of the currently authenticated user.
 * Access: authenticated
 */
async function getUserProfile(params, context) {
  try {
    const user = await User.findById(context.userId);

    if (!user) {
      return errorResponse('User not found', 'NOT_FOUND');
    }

    return successResponse({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    });
  } catch (err) {
    return errorResponse(`Failed to fetch user profile: ${err.message}`, 'INTERNAL_ERROR');
  }
}

/**
 * Tool: get_user
 * Retrieve a specific user's details by their user ID.
 * Access: admin
 */
async function getUser(params, context) {
  const { user_id } = params;

  if (!user_id || !isValidObjectId(user_id)) {
    return errorResponse('Invalid or missing user ID', 'INVALID_PARAM');
  }

  try {
    const user = await User.findById(user_id).select('-password');

    if (!user) {
      return errorResponse(`User ${user_id} not found`, 'NOT_FOUND');
    }

    return successResponse(user);
  } catch (err) {
    return errorResponse(`Failed to fetch user: ${err.message}`, 'INTERNAL_ERROR');
  }
}

/**
 * Tool: list_users
 * Retrieve all registered users. Password hashes are excluded.
 * Access: admin
 */
async function listUsers(params, context) {
  try {
    const users = await User.find({}).select('-password');

    return successResponse(users);
  } catch (err) {
    return errorResponse(`Failed to fetch users: ${err.message}`, 'INTERNAL_ERROR');
  }
}

/**
 * Tool: update_user_profile
 * Update the authenticated user's own profile (name and/or email).
 * Password is explicitly excluded for security.
 * Access: authenticated
 */
async function updateUserProfile(params, context) {
  // Defense-in-depth: strip password even if schema validation should block it
  const { name, email, password, ...rest } = params;
  if (password !== undefined) {
    return errorResponse(
      'Password cannot be changed through this tool. Use the profile page instead.',
      'FORBIDDEN'
    );
  }

  // At least one field must be provided
  if (name === undefined && email === undefined) {
    return errorResponse(
      'At least one field (name or email) must be provided',
      'INVALID_PARAM'
    );
  }

  try {
    const user = await User.findById(context.userId);

    if (!user) {
      return errorResponse('User not found', 'NOT_FOUND');
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;

    const updatedUser = await user.save();

    return successResponse({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
    });
  } catch (err) {
    if (err.code === 11000) {
      return errorResponse('Email is already in use by another account', 'CONFLICT');
    }
    return errorResponse(`Failed to update profile: ${err.message}`, 'INTERNAL_ERROR');
  }
}

/**
 * Tool: update_user
 * Admin updates any user's account details (name, email, isAdmin).
 * Access: admin
 */
async function updateUser(params, context) {
  const { user_id, name, email, isAdmin } = params;

  if (!user_id || !isValidObjectId(user_id)) {
    return errorResponse('Invalid or missing user ID', 'INVALID_PARAM');
  }

  // At least one update field must be provided
  if (name === undefined && email === undefined && isAdmin === undefined) {
    return errorResponse(
      'At least one field (name, email, or isAdmin) must be provided',
      'INVALID_PARAM'
    );
  }

  try {
    const user = await User.findById(user_id);

    if (!user) {
      return errorResponse(`User ${user_id} not found`, 'NOT_FOUND');
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (isAdmin !== undefined) user.isAdmin = Boolean(isAdmin);

    const updatedUser = await user.save();

    return successResponse({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
    });
  } catch (err) {
    if (err.code === 11000) {
      return errorResponse('Email is already in use by another account', 'CONFLICT');
    }
    return errorResponse(`Failed to update user: ${err.message}`, 'INTERNAL_ERROR');
  }
}

/**
 * Tool: delete_user
 * Delete a user account. Admin users cannot be deleted.
 * Access: admin, confirmBefore: true
 */
async function deleteUser(params, context) {
  const { user_id } = params;

  if (!user_id || !isValidObjectId(user_id)) {
    return errorResponse('Invalid or missing user ID', 'INVALID_PARAM');
  }

  try {
    const user = await User.findById(user_id);

    if (!user) {
      return errorResponse(`User ${user_id} not found`, 'NOT_FOUND');
    }

    if (user.isAdmin) {
      return errorResponse(
        'Cannot delete admin user. Demote the user first if deletion is needed.',
        'FORBIDDEN'
      );
    }

    await User.deleteOne({ _id: user._id });
    return successResponse({ message: 'User removed' });
  } catch (err) {
    return errorResponse(`Failed to delete user: ${err.message}`, 'INTERNAL_ERROR');
  }
}

export {
  getUserProfile,
  getUser,
  listUsers,
  updateUserProfile,
  updateUser,
  deleteUser,
};
