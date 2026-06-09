/**
 * @file habitController.js
 * @description Controller handling incoming requests for user habit frequency metrics.
 */

const habitService = require('../services/habitService');
const { validateUserId } = require('../utils/validators');

/**
 * Endpoint to retrieve recurring user habits.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next handler.
 * @returns {Promise<import('express').Response|void>} Express response or next.
 */
async function getHabits(req, res, next) {
  try {
    const userId = validateUserId(req.query.user_id || 1);
    const result = await habitService.getHabits(userId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getHabits
};
