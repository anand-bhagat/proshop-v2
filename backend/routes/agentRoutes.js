// backend/routes/agentRoutes.js — Agent API Endpoint
// POST /api/agent/chat — authenticated endpoint for the agentic chat loop

import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { runAgent, runAgentStream } from '../../agent/engine.js';
import agentConfig from '../../agent/config.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (per-user)
// ---------------------------------------------------------------------------

const rateLimitStore = new Map(); // userId -> { minute: { count, resetAt }, hour: { count, resetAt } }

function checkRateLimit(userId) {
  const now = Date.now();
  let entry = rateLimitStore.get(userId);

  if (!entry) {
    entry = {
      minute: { count: 0, resetAt: now + 60_000 },
      hour: { count: 0, resetAt: now + 3_600_000 },
    };
    rateLimitStore.set(userId, entry);
  }

  // Reset windows if expired
  if (now > entry.minute.resetAt) {
    entry.minute = { count: 0, resetAt: now + 60_000 };
  }
  if (now > entry.hour.resetAt) {
    entry.hour = { count: 0, resetAt: now + 3_600_000 };
  }

  // Check limits
  if (entry.minute.count >= agentConfig.rateLimit.maxRequestsPerMinute) {
    return { allowed: false, error: 'Rate limit exceeded. Please wait a minute before trying again.' };
  }
  if (entry.hour.count >= agentConfig.rateLimit.maxRequestsPerHour) {
    return { allowed: false, error: 'Hourly rate limit exceeded. Please try again later.' };
  }

  // Increment
  entry.minute.count++;
  entry.hour.count++;

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// POST /api/agent/chat
// ---------------------------------------------------------------------------

router.post(
  '/',
  protect,
  asyncHandler(async (req, res) => {
    const { message, conversationId, frontendResult, stream } = req.body;

    // Request validation
    if (!message && !frontendResult) {
      res.status(400);
      throw new Error('Request must include "message" (string) or "frontendResult" (object)');
    }

    if (message && typeof message !== 'string') {
      res.status(400);
      throw new Error('"message" must be a string');
    }

    // Rate limiting
    const userId = req.user._id.toString();
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      res.status(429);
      throw new Error(rateCheck.error);
    }

    // Build user context from authenticated user
    const userContext = {
      userId: req.user._id.toString(),
      role: req.user.isAdmin ? 'admin' : 'user',
      name: req.user.name,
    };

    // SSE streaming — uses runAgentStream() async generator
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        const streamGen = runAgentStream({
          message,
          conversationHistory: [],
          userContext,
          frontendResult,
          conversationId,
        });

        for await (const chunk of streamGen) {
          // chunk = { event, data }
          res.write(`data: ${JSON.stringify({ type: chunk.event, ...chunk.data })}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();
      } catch (err) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        res.end();
      }
      return;
    }

    // Standard JSON response
    const result = await runAgent({
      message,
      conversationHistory: [],
      userContext,
      frontendResult,
      conversationId,
    });

    res.json(result);
  })
);

export default router;
