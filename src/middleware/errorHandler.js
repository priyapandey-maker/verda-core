/**
 * @file errorHandler.js
 * @description Centralized error boundary mapping operational, validation, and database errors to standardized JSON formats.
 */

const logger = require('../utils/logger');

/**
 * Express error-handling middleware.
 * @param {Error} err - Received error exception.
 * @param {import('express').Request} req - Express request instance.
 * @param {import('express').Response} res - Express response instance.
 * @param {import('express').NextFunction} _next - Express next middleware reference.
 */
function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Intercept body-parser SyntaxError on malformed JSON payload bodies
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 500;
    message = 'Internal Server Error';
  }

  // Log structured details via Pino
  logger.error({
    err: {
      message: err.message,
      stack: err.stack,
      statusCode
    },
    req: {
      method: req.method,
      url: req.originalUrl,
      query: req.query
    }
  }, message);

  return res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
