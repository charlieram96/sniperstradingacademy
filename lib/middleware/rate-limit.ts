// =============================================
// Rate Limiting Middleware
// Simple in-memory rate limiter for API endpoints
// Can be enhanced with Redis for production scale
// =============================================

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  limit: number; // Max requests
  windowMs: number; // Time window in milliseconds
  keyGenerator?: (req: NextRequest) => string; // Generate unique key per client
  message?: string; // Custom error message
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (replace with Redis for production scale)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'anonymous';
  return ip;
}

/**
 * Rate limit check - returns null if allowed, or error response if blocked
 */
export async function checkRateLimit(
  req: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const {
    limit,
    windowMs,
    keyGenerator = defaultKeyGenerator,
    message = 'Too many requests. Please try again later.',
  } = config;

  const key = keyGenerator(req);
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired one
    entry = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, entry);
    return null; // Allowed
  }

  // Increment count
  entry.count++;

  if (entry.count > limit) {
    // Rate limited
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(entry.resetTime / 1000).toString(),
        },
      }
    );
  }

  return null; // Allowed
}

/**
 * Rate limit wrapper for API handlers
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const rateLimitResponse = await checkRateLimit(req, config);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    return handler(req);
  };
}

/**
 * Pre-configured rate limits for different endpoint types
 */
export const RATE_LIMITS = {
  // Payment endpoints - strict limits
  payment: {
    limit: 10,
    windowMs: 60 * 60 * 1000, // 10 per hour
    message: 'Too many payment requests. Please wait before trying again.',
  },

  // Authentication endpoints - prevent brute force
  auth: {
    limit: 5,
    windowMs: 15 * 60 * 1000, // 5 per 15 minutes
    message: 'Too many authentication attempts. Please wait 15 minutes.',
  },

  // Wallet operations
  wallet: {
    limit: 20,
    windowMs: 60 * 60 * 1000, // 20 per hour
    message: 'Too many wallet operations. Please try again later.',
  },

  // General API endpoints
  api: {
    limit: 100,
    windowMs: 60 * 1000, // 100 per minute
    message: 'Rate limit exceeded. Please slow down.',
  },

  // Admin endpoints - more lenient
  admin: {
    limit: 200,
    windowMs: 60 * 1000, // 200 per minute
    message: 'Admin rate limit exceeded.',
  },
};

/**
 * Key generator that uses user ID when authenticated
 */
export function userIdKeyGenerator(userId?: string): (req: NextRequest) => string {
  return (req: NextRequest) => {
    if (userId) {
      return `user:${userId}`;
    }
    return defaultKeyGenerator(req);
  };
}

/**
 * Key generator that combines IP and endpoint path
 */
export function endpointKeyGenerator(req: NextRequest): string {
  const ip = defaultKeyGenerator(req);
  const path = new URL(req.url).pathname;
  return `${ip}:${path}`;
}
