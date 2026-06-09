/**
 * @file schemas.js
 * @description Zod validation schemas for request parameters, payloads, and queries.
 */

const { z } = require('zod');

/**
 * Validates and pre-processes User ID inputs.
 * Defaults to 1 if NaN or string parsing fails.
 */
const userIdSchema = z.preprocess((val) => {
  if (val === undefined || val === null) return 1;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? 1 : parsed;
}, z.number().int());

/**
 * Validates date strings in YYYY-MM-DD format and verifies actual Gregorian calendar date exists.
 */
const dateStringSchema = z.string({
  required_error: 'Invalid or missing activity_date (format: YYYY-MM-DD)',
  invalid_type_error: 'Invalid or missing activity_date (format: YYYY-MM-DD)'
})
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid or missing activity_date (format: YYYY-MM-DD)')
  .refine((val) => {
    const d = new Date(val);
    return d instanceof Date && !isNaN(d.getTime());
  }, 'Invalid or missing activity_date (format: YYYY-MM-DD)');

/**
 * Schema validating the POST payload for carbon activity logging.
 */
const logActivitySchema = z.object({
  user_id: userIdSchema,
  activity_date: dateStringSchema,
  category: z.string({ required_error: 'Invalid or missing category' })
    .min(1, 'Invalid or missing category'),
  activity: z.string({ required_error: 'Invalid or missing activity type' })
    .min(1, 'Invalid or missing activity type'),
  value: z.number({ required_error: 'Value must be a positive number', invalid_type_error: 'Value must be a positive number' })
    .positive('Value must be a positive number')
}).superRefine((data, ctx) => {
  // 1. Validate category matches constant options
  const constants = require('../config/constants');
  if (!constants.EMISSION_FACTORS[data.category]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid or missing category',
      path: ['category']
    });
    return;
  }

  // 2. Validate activity type is defined under category factor list
  const factors = constants.EMISSION_FACTORS[data.category];
  if (factors[data.activity] === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid or missing activity type',
      path: ['activity']
    });
  }
});

/**
 * Schema validating the POST payload for carbon activity logging (with pre-processing).
 * @type {import('zod').ZodSchema}
 */
const logActivityPayloadSchema = z.preprocess((val) => {
  if (!val || typeof val !== 'object') return val;
  return val;
}, logActivitySchema);

/**
 * Schema validating the GET query parameters for retrieving logs.
 * @type {import('zod').ZodSchema}
 */
const getLogsQuerySchema = z.object({
  user_id: userIdSchema,
  start_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start_date format (format: YYYY-MM-DD)')
    .refine((val) => {
      const d = new Date(val);
      return d instanceof Date && !isNaN(d.getTime());
    }, 'Invalid start_date format (format: YYYY-MM-DD)')
    .optional(),
  end_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end_date format (format: YYYY-MM-DD)')
    .refine((val) => {
      const d = new Date(val);
      return d instanceof Date && !isNaN(d.getTime());
    }, 'Invalid end_date format (format: YYYY-MM-DD)')
    .optional()
});

/**
 * Schema validating the POST payload for AI Coach question asking.
 * @type {import('zod').ZodSchema}
 */
const askCoachSchema = z.object({
  user_id: userIdSchema,
  question: z.string({ required_error: 'Please provide a valid question for the AI coach.' })
    .min(1, 'Please provide a valid question for the AI coach.')
    .max(500, 'Question is too long. Please keep it under 500 characters.')
});

module.exports = {
  userIdSchema,
  logActivityPayloadSchema,
  getLogsQuerySchema,
  askCoachSchema
};
