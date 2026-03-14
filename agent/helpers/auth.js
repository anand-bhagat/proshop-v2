// agent/helpers/auth.js — Permission checking helpers

const ACCESS = {
  PUBLIC: 'public',
  AUTHENTICATED: 'authenticated',
  OWNER: 'owner',
  ADMIN: 'admin',
};

function checkPermission(context, requiredLevel, resourceOwnerId = null) {
  if (requiredLevel === ACCESS.PUBLIC) {
    return { allowed: true };
  }

  if (!context || !context.userId) {
    return { allowed: false, error: 'Authentication required' };
  }

  if (requiredLevel === ACCESS.AUTHENTICATED) {
    return { allowed: true };
  }

  if (requiredLevel === ACCESS.ADMIN) {
    if (context.role !== 'admin') {
      return { allowed: false, error: 'Admin access required' };
    }
    return { allowed: true };
  }

  if (requiredLevel === ACCESS.OWNER) {
    if (context.role === 'admin') {
      return { allowed: true };
    }
    if (
      resourceOwnerId &&
      resourceOwnerId.toString() !== context.userId.toString()
    ) {
      return { allowed: false, error: 'You can only access your own resources' };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

function isOwner(context, resourceUserId) {
  if (!context || !context.userId || !resourceUserId) return false;
  return context.userId.toString() === resourceUserId.toString();
}

export { ACCESS, checkPermission, isOwner };
