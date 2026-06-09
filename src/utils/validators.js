/**
 * @file validators.js
 * @description Centralized validation utility for API input parameters, query constraints, and payload properties.
 */

const { EMISSION_FACTORS } = require('../config/constants');

/**
 * Validates if the given string is a valid date in format YYYY-MM-DD.
 * @param {string} dateStr - Date string to validate.
 * @returns {boolean} True if the date is valid.
 */
function isValidDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const reg = /^\d{4}-\d{2}-\d{2}$/;
  if (!reg.test(dateStr)) return false;
  const d = new Date(dateStr);
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Validates a user ID. Returns the parsed user ID (defaults to 1 if not a valid number).
 * @param {any} userId - User ID to validate.
 * @returns {number} Parsed user ID.
 */
function validateUserId(userId) {
  const parsed = parseInt(userId, 10);
  if (isNaN(parsed)) {
    return 1;
  }
  return parsed;
}

/**
 * Validates the body payload for logging a new activity.
 * @param {object} body - Request body.
 * @returns {object} Validated and structured payload.
 * @throws {Error} If validation fails.
 */
function validateLogActivity(body) {
  const { user_id = 1, activity_date, category, activity, value } = body;

  const parsedUserId = validateUserId(user_id);

  if (!activity_date || !isValidDate(activity_date)) {
    const error = new Error('Invalid or missing activity_date (format: YYYY-MM-DD)');
    error.statusCode = 400;
    throw error;
  }

  if (!category || !EMISSION_FACTORS[category]) {
    const error = new Error('Invalid or missing category');
    error.statusCode = 400;
    throw error;
  }

  if (!activity || EMISSION_FACTORS[category][activity] === undefined) {
    const error = new Error('Invalid or missing activity type');
    error.statusCode = 400;
    throw error;
  }

  if (value === undefined || typeof value !== 'number' || value <= 0) {
    const error = new Error('Value must be a positive number');
    error.statusCode = 400;
    throw error;
  }

  return {
    user_id: parsedUserId,
    activity_date,
    category,
    activity,
    value
  };
}

/**
 * Validates the query parameters for filtering logs.
 * @param {object} query - Request query object.
 * @returns {object} Validated query parameters.
 */
function validateGetLogsQuery(query) {
  const user_id = validateUserId(query.user_id || 1);
  const { start_date, end_date } = query;

  const result = { user_id };

  if (start_date) {
    if (!isValidDate(start_date)) {
      const error = new Error('Invalid start_date format (format: YYYY-MM-DD)');
      error.statusCode = 400;
      throw error;
    }
    result.start_date = start_date;
  }

  if (end_date) {
    if (!isValidDate(end_date)) {
      const error = new Error('Invalid end_date format (format: YYYY-MM-DD)');
      error.statusCode = 400;
      throw error;
    }
    result.end_date = end_date;
  }

  return result;
}

/**
 * Validates request payload for AI Coach query.
 * @param {object} body - Request body.
 * @returns {object} Validated coach request.
 * @throws {Error} If validation fails.
 */
function validateAskCoach(body) {
  const { question } = body;
  const user_id = validateUserId(body.user_id || 1);

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    const error = new Error('Please provide a valid question for the AI coach.');
    error.statusCode = 400;
    throw error;
  }

  if (question.length > 500) {
    const error = new Error('Question is too long. Please keep it under 500 characters.');
    error.statusCode = 400;
    throw error;
  }

  return {
    user_id,
    question: question.trim()
  };
}

module.exports = {
  isValidDate,
  validateUserId,
  validateLogActivity,
  validateGetLogsQuery,
  validateAskCoach
};
