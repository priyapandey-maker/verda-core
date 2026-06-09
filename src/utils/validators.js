/**
 * @file validators.js
 * @description Centralized validation wrapper invoking Zod schemas and mapping exceptions to operational ValidationErrors.
 */

const {
  userIdSchema,
  logActivityPayloadSchema,
  getLogsQuerySchema,
  askCoachSchema
} = require('./schemas');
const { ValidationError } = require('./errors');

/**
 * Validates data against a schema and throws a structured ValidationError on failure.
 * @param {import('zod').ZodSchema} schema - Zod validator schema.
 * @param {any} data - Input data payload to parse.
 * @returns {any} Validated and formatted typed DTO.
 * @throws {ValidationError} If schema parsing fails.
 */
function parseWithSchema(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new ValidationError(firstIssue.message);
  }
  return result.data;
}

/**
 * Validate user ID parameter.
 * @param {any} userId - User identifier.
 * @returns {number} Parsed user ID.
 */
function validateUserId(userId) {
  return parseWithSchema(userIdSchema, userId);
}

/**
 * Validate log activity payload body.
 * @param {object} body - Payload body.
 * @returns {object} Validated DTO object.
 */
function validateLogActivity(body) {
  return parseWithSchema(logActivityPayloadSchema, body);
}

/**
 * Validate get logs query filters.
 * @param {object} query - Request query parameters.
 * @returns {object} Validated DTO object.
 */
function validateGetLogsQuery(query) {
  return parseWithSchema(getLogsQuerySchema, query);
}

/**
 * Validate ask coach payload body.
 * @param {object} body - Request body.
 * @returns {object} Validated DTO object.
 */
function validateAskCoach(body) {
  return parseWithSchema(askCoachSchema, body);
}

module.exports = {
  validateUserId,
  validateLogActivity,
  validateGetLogsQuery,
  validateAskCoach
};
