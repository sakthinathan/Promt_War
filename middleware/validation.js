// middleware/validation.js
// Copy this file to your project

const { body, query, validationResult } = require('express-validator');

/**
 * Validation rules for checkout requests
 * Validates item ID, quantity, and optional seat number
 */
const validateCheckout = [
  body('itemId')
    .trim()
    .isString()
    .withMessage('Item ID must be a string')
    .escape()
    .notEmpty()
    .withMessage('Item ID is required'),

  body('quantity')
    .isInt({ min: 1, max: 50 })
    .withMessage('Quantity must be between 1 and 50'),

  body('seatNumber')
    .optional()
    .matches(/^[A-Z]\d{1,3}$/)
    .withMessage('Seat number must match format (e.g., A1, B123)'),

  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
];

/**
 * Validation middleware for queue update requests
 * Validates sector, wait time, and timestamp
 */
const validateQueueUpdate = [
  body('sector')
    .trim()
    .isString()
    .escape()
    .notEmpty()
    .withMessage('Sector is required'),

  body('waitTime')
    .isInt({ min: 0, max: 300 })
    .withMessage('Wait time must be between 0 and 300 minutes'),

  body('timestamp')
    .optional()
    .isInt()
    .withMessage('Timestamp must be a valid number'),
];

/**
 * Middleware to handle validation errors
 * Sends formatted error response to client
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'validation_error',
      message: 'Request validation failed',
      errors: errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value,
      })),
    });
  }

  next();
};

/**
 * Validation for analytics queries
 */
const validateAnalyticsQuery = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be valid ISO8601 format'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be valid ISO8601 format'),

  query('sector')
    .optional()
    .trim()
    .isString()
    .escape(),
];

module.exports = {
  validateCheckout,
  validateQueueUpdate,
  validateAnalyticsQuery,
  handleValidationErrors,
};
