/**
 * @file logger.js
 * @description Structured logging utility configured with Pino and transport colorizers for development.
 */

const pino = require('pino');

/**
 * Structured logger instance configured using Pino.
 * @type {import('pino').Logger}
 */
const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  transport: process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

module.exports = logger;
