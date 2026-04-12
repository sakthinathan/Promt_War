// middleware/rate-limit.js
// Copy this file to your project

const rateLimit = require('express-rate-limit');

/**
 * General rate limiter for all API endpoints
 * Limit: 100 requests per minute per IP
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    status: 'error',
    message: 'Too many requests from this IP. Please try again later.',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
  keyGenerator: (req) => {
    // Use IP address as key
    return req.ip || req.connection.remoteAddress;
  },
});

/**
 * Stricter limiter for checkout operations
 * Limit: 10 requests per minute per IP
 * Prevents abuse of order processing
 */
const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    status: 'error',
    message: 'Too many checkout attempts. Please wait before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests, including successful ones
  skipFailedRequests: false, // Count failed requests
});

/**
 * Limiter for authentication endpoints
 * Limit: 5 requests per 15 minutes per IP
 * Prevents brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    status: 'error',
    message: 'Too many authentication attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful authentications
});

/**
 * Limiter for queue update WebSocket connections
 * Limit: 50 messages per second per connection
 * Prevents flooding
 */
const socketLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 50,
  keyGenerator: (req) => {
    // Use socket ID instead of IP
    return req.socket?.id || req.ip;
  },
  skip: (req) => {
    // Don't skip any socket messages
    return false;
  },
});

/**
 * Custom rate limiter with progressive backoff
 * Increases wait time with each attempt
 */
class ProgressiveRateLimiter {
  constructor(baseWindowMs = 60000, maxAttempts = 10) {
    this.baseWindowMs = baseWindowMs;
    this.maxAttempts = maxAttempts;
    this.attempts = new Map();
  }

  isAllowed(key) {
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record) {
      // First attempt
      this.attempts.set(key, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
        blocked: false,
      });
      return true;
    }

    // Reset if outside window
    if (now - record.firstAttempt > this.baseWindowMs) {
      this.attempts.set(key, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
        blocked: false,
      });
      return true;
    }

    // Check if blocked
    if (record.blocked) {
      const blockDuration = this.baseWindowMs * record.count;
      if (now - record.lastAttempt > blockDuration) {
        // Block expires
        record.blocked = false;
        record.count = 1;
        record.firstAttempt = now;
        return true;
      }
      return false;
    }

    // Increment count
    record.count++;
    record.lastAttempt = now;

    // Block if exceeded
    if (record.count > this.maxAttempts) {
      record.blocked = true;
    }

    return record.count <= this.maxAttempts;
  }

  getStatus(key) {
    const record = this.attempts.get(key);
    if (!record) return { allowed: true };

    return {
      allowed: !record.blocked,
      attempts: record.count,
      maxAttempts: this.maxAttempts,
      blocked: record.blocked,
      nextAttemptAt: record.blocked
        ? record.lastAttempt + (this.baseWindowMs * record.count)
        : Date.now(),
    };
  }

  reset(key) {
    this.attempts.delete(key);
  }

  clearExpired() {
    const now = Date.now();
    for (const [key, record] of this.attempts.entries()) {
      if (now - record.lastAttempt > this.baseWindowMs * 10) {
        this.attempts.delete(key);
      }
    }
  }
}

const progressiveLimiter = new ProgressiveRateLimiter(60000, 10);

/**
 * Middleware wrapper for progressive rate limiter
 */
const createProgressiveLimiterMiddleware = (keyExtractor = (req) => req.ip) => {
  return (req, res, next) => {
    const key = keyExtractor(req);
    const status = progressiveLimiter.getStatus(key);

    if (!progressiveLimiter.isAllowed(key)) {
      return res.status(429).json({
        status: 'error',
        message: 'Too many attempts. Please try again later.',
        retryAfter: Math.ceil((status.nextAttemptAt - Date.now()) / 1000),
      });
    }

    res.setHeader('X-RateLimit-Limit', status.maxAttempts);
    res.setHeader('X-RateLimit-Remaining', status.maxAttempts - status.attempts);
    res.setHeader('X-RateLimit-Reset', new Date(status.nextAttemptAt).toISOString());

    next();
  };
};

// Clean up expired records every 10 minutes
setInterval(() => {
  progressiveLimiter.clearExpired();
}, 10 * 60 * 1000);

module.exports = {
  generalLimiter,
  checkoutLimiter,
  authLimiter,
  socketLimiter,
  ProgressiveRateLimiter,
  createProgressiveLimiterMiddleware,
};
