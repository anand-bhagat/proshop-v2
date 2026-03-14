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

export { getUserProfile, getUser, listUsers };
