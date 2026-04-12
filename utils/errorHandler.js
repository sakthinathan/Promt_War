// utils/errorHandler.js
// Copy this file to your project

const logger = console;

/**
 * Custom error class for application errors
 * Extends Error with HTTP status code
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.timestamp = new Date();

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON() {
    return {
      status: 'error',
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV === 'development' && {
        stack: this.stack,
      }),
    };
  }
}

/**
 * Validation error - 400
 */
class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 400);
    this.details = details;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      details: this.details,
    };
  }
}

/**
 * Not found error - 404
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

/**
 * Unauthorized error - 401
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * Forbidden error - 403
 */
class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403);
  }
}

/**
 * Rate limit error - 429
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message, 429);
    this.retryAfter = retryAfter;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
    };
  }
}

/**
 * Server error handler middleware
 * Catches all errors and returns formatted response
 */
const errorHandler = (err, req, res, next) => {
  // Default to 500 server error
  let error = err;

  if (!(error instanceof AppError)) {
    // Convert non-AppError exceptions
    error = new AppError(
      error.message || 'Internal Server Error',
      error.statusCode || 500
    );
  }

  // Log error
  logger.error({
    message: error.message,
    statusCode: error.statusCode,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  // Set response headers
  if (error instanceof RateLimitError) {
    res.setHeader('Retry-After', error.retryAfter);
  }

  // Send response
  res.status(error.statusCode).json(error.toJSON());
};

/**
 * Async error wrapper for Express route handlers
 * Catches promise rejections and passes to error handler
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Safe JSON parse with error handling
 */
function safeJsonParse(json, defaultValue = null) {
  try {
    return JSON.parse(json);
  } catch (error) {
    logger.warn(`Failed to parse JSON: ${error.message}`);
    return defaultValue;
  }
}

/**
 * Safe function execution with fallback
 */
function safeTry(fn, fallback = null) {
  try {
    return fn();
  } catch (error) {
    logger.error(`Safe try failed: ${error.message}`);
    return fallback;
  }
}

/**
 * Error boundary for async operations
 */
async function withErrorBoundary(asyncFn, errorHandler = null) {
  try {
    return await asyncFn();
  } catch (error) {
    logger.error(`Error boundary caught: ${error.message}`);
    if (errorHandler) {
      return errorHandler(error);
    }
    throw error;
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  errorHandler,
  asyncHandler,
  safeJsonParse,
  safeTry,
  withErrorBoundary,
};
