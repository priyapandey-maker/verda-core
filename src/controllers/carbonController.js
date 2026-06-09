/**
 * @file carbonController.js
 * @description Controller layer handling HTTP requests for carbon log inputs, dashboard aggregates, and streaks.
 */

const carbonService = require('../services/carbonService');
const { validateLogActivity, validateGetLogsQuery, validateUserId } = require('../utils/validators');
const { calculateEmissions } = require('../utils/calculations');
const { EMISSION_FACTORS, CAR_EMISSION_FACTOR, BUS_EMISSION_FACTOR } = require('../config/constants');

/**
 * Log a new carbon activity entry.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next handler.
 * @returns {Promise<import('express').Response|void>} Express response or next.
 */
async function logActivity(req, res, next) {
  try {
    const validatedData = validateLogActivity(req.body);
    const result = await carbonService.logActivity(validatedData);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Retrieve carbon logs list.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next handler.
 * @returns {Promise<import('express').Response|void>} Express response or next.
 */
async function getLogs(req, res, next) {
  try {
    const validatedQuery = validateGetLogsQuery(req.query);
    const result = await carbonService.getLogs(validatedQuery);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Get aggregated dashboard statistics and user EarthScore metrics.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next handler.
 * @returns {Promise<import('express').Response|void>} Express response or next.
 */
async function getDashboard(req, res, next) {
  try {
    const userId = validateUserId(req.query.user_id || 1);
    const result = await carbonService.getDashboard(userId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Get current and longest user activity streaks.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next handler.
 * @returns {Promise<import('express').Response|void>} Express response or next.
 */
async function getStreak(req, res, next) {
  try {
    const userId = validateUserId(req.query.user_id || 1);
    const result = await carbonService.getStreak(userId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  logActivity,
  getLogs,
  getDashboard,
  getStreak,
  calculateEmissions,
  EMISSION_FACTORS,
  CAR_EMISSION_FACTOR,
  BUS_EMISSION_FACTOR
};
