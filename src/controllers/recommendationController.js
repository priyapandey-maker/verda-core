/**
 * @file recommendationController.js
 * @description Controller handling recommendation rules and simulated carbon twin metrics.
 */

const recommendationService = require('../services/recommendationService');
const twinService = require('../services/twinService');
const { validateUserId } = require('../utils/validators');

/**
 * Get personalized carbon footprint recommendations.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next handler.
 */
async function getRecommendations(req, res, next) {
  try {
    const userId = validateUserId(req.query.user_id || 1);
    const result = await recommendationService.getRecommendations(userId);
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get carbon twin projection metrics.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next handler.
 */
async function getCarbonTwin(req, res, next) {
  try {
    const userId = validateUserId(req.query.user_id || 1);
    const result = await twinService.getCarbonTwin(userId);
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRecommendations,
  getCarbonTwin,
  generateRecommendationsInternal: recommendationService.generateRecommendationsInternal
};
