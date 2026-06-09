/**
 * @file errors.js
 * @description Custom error subclasses for Express API operational and database failures.
 */

/**
 * Base Application Error class.
 * @extends Error
 */
class AppError extends Error {
  /**
   * @param {string} message - Error explanation message.
   * @param {number} statusCode - Assigned HTTP status code.
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error class representing payload failures.
 * @extends AppError
 */
class ValidationError extends AppError {
  /**
   * @param {string} message - Details of the input validation failure.
   */
  constructor(message) {
    super(message, 400);
  }
}

/**
 * Not Found Error class representing missing profiles or resources.
 * @extends AppError
 */
class NotFoundError extends AppError {
  /**
   * @param {string} message - Details of the missing resource.
   */
  constructor(message) {
    super(message, 404);
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError
};
