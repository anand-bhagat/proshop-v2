// Tests for agent/helpers/

import { describe, it, expect } from '@jest/globals';
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from '../helpers/response.js';
import { validateParams, isValidObjectId } from '../helpers/validate.js';
import { ACCESS, checkPermission, isOwner } from '../helpers/auth.js';
import {
  parsePaginationParams,
  buildPaginationMeta,
} from '../helpers/pagination.js';

// ---------------------------------------------------------------------------
// response.js
// ---------------------------------------------------------------------------

describe('helpers/response.js', () => {
  it('successResponse should return correct shape', () => {
    const result = successResponse({ id: '123', name: 'Test' });
    expect(result).toEqual({
      success: true,
      data: { id: '123', name: 'Test' },
      metadata: {},
    });
  });

  it('successResponse should include metadata when provided', () => {
    const result = successResponse({ id: '123' }, { executionTime: 42 });
    expect(result.metadata).toEqual({ executionTime: 42 });
  });

  it('errorResponse should return correct shape', () => {
    const result = errorResponse('Something went wrong', 'INTERNAL_ERROR');
    expect(result).toEqual({
      success: false,
      error: 'Something went wrong',
      code: 'INTERNAL_ERROR',
    });
  });

  it('errorResponse should default code to ERROR', () => {
    const result = errorResponse('Bad request');
    expect(result.code).toBe('ERROR');
  });

  it('paginatedResponse should calculate pagination metadata', () => {
    const items = [{ id: 1 }, { id: 2 }];
    const result = paginatedResponse(items, 25, 2, 10);
    expect(result).toEqual({
      success: true,
      data: items,
      metadata: {
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasMore: true,
      },
    });
  });

  it('paginatedResponse should set hasMore to false on last page', () => {
    const result = paginatedResponse([], 20, 2, 10);
    expect(result.metadata.hasMore).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validate.js
// ---------------------------------------------------------------------------

describe('helpers/validate.js', () => {
  it('validateParams should pass valid params', () => {
    const schema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
      },
    };
    const result = validateParams({ name: 'Test' }, schema);
    expect(result).toEqual({ valid: true });
  });

  it('validateParams should fail on missing required param', () => {
    const schema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
      },
    };
    const result = validateParams({}, schema);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid parameters');
  });

  it('validateParams should fail on wrong type', () => {
    const schema = {
      type: 'object',
      properties: {
        count: { type: 'integer' },
      },
    };
    const result = validateParams({ count: 'not a number' }, schema);
    expect(result.valid).toBe(false);
  });

  it('isValidObjectId should accept valid ObjectId', () => {
    expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
  });

  it('isValidObjectId should reject invalid ObjectId', () => {
    expect(isValidObjectId('invalid')).toBe(false);
    expect(isValidObjectId('')).toBe(false);
    expect(isValidObjectId('123')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// auth.js
// ---------------------------------------------------------------------------

describe('helpers/auth.js', () => {
  const userCtx = {
    userId: '507f1f77bcf86cd799439011',
    role: 'user',
    name: 'Test User',
  };

  const adminCtx = {
    userId: '507f1f77bcf86cd799439012',
    role: 'admin',
    name: 'Admin User',
  };

  it('should allow public access for anyone', () => {
    expect(checkPermission(null, ACCESS.PUBLIC)).toEqual({ allowed: true });
    expect(checkPermission(userCtx, ACCESS.PUBLIC)).toEqual({ allowed: true });
  });

  it('should require authentication for authenticated access', () => {
    expect(checkPermission(null, ACCESS.AUTHENTICATED).allowed).toBe(false);
    expect(checkPermission({}, ACCESS.AUTHENTICATED).allowed).toBe(false);
    expect(checkPermission(userCtx, ACCESS.AUTHENTICATED).allowed).toBe(true);
  });

  it('should require admin role for admin access', () => {
    expect(checkPermission(userCtx, ACCESS.ADMIN).allowed).toBe(false);
    expect(checkPermission(userCtx, ACCESS.ADMIN).error).toBe(
      'Admin access required'
    );
    expect(checkPermission(adminCtx, ACCESS.ADMIN).allowed).toBe(true);
  });

  it('should handle owner access — allow owner', () => {
    const result = checkPermission(
      userCtx,
      ACCESS.OWNER,
      '507f1f77bcf86cd799439011'
    );
    expect(result.allowed).toBe(true);
  });

  it('should handle owner access — reject non-owner', () => {
    const result = checkPermission(
      userCtx,
      ACCESS.OWNER,
      '507f1f77bcf86cd799439099'
    );
    expect(result.allowed).toBe(false);
  });

  it('should handle owner access — admin can access any resource', () => {
    const result = checkPermission(
      adminCtx,
      ACCESS.OWNER,
      '507f1f77bcf86cd799439099'
    );
    expect(result.allowed).toBe(true);
  });

  it('isOwner should return true when user owns the resource', () => {
    expect(isOwner(userCtx, '507f1f77bcf86cd799439011')).toBe(true);
  });

  it('isOwner should return false when user does not own the resource', () => {
    expect(isOwner(userCtx, '507f1f77bcf86cd799439099')).toBe(false);
  });

  it('isOwner should return false for null context', () => {
    expect(isOwner(null, '507f1f77bcf86cd799439011')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pagination.js
// ---------------------------------------------------------------------------

describe('helpers/pagination.js', () => {
  it('parsePaginationParams should return defaults for empty params', () => {
    const result = parsePaginationParams({});
    expect(result).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it('parsePaginationParams should parse page and limit', () => {
    const result = parsePaginationParams({ page: '3', limit: '20' });
    expect(result).toEqual({ page: 3, limit: 20, skip: 40 });
  });

  it('parsePaginationParams should clamp limit to max 50', () => {
    const result = parsePaginationParams({ limit: '100' });
    expect(result.limit).toBe(50);
  });

  it('parsePaginationParams should enforce minimum page 1', () => {
    const result = parsePaginationParams({ page: '0' });
    expect(result.page).toBe(1);
  });

  it('buildPaginationMeta should compute correct metadata', () => {
    const meta = buildPaginationMeta(55, 2, 10);
    expect(meta).toEqual({
      total: 55,
      page: 2,
      limit: 10,
      totalPages: 6,
      hasMore: true,
    });
  });

  it('buildPaginationMeta should set hasMore false on last page', () => {
    const meta = buildPaginationMeta(20, 2, 10);
    expect(meta.hasMore).toBe(false);
  });
});
