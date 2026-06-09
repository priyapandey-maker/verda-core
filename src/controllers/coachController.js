/**
 * @file coachController.js
 * @description Controller handling incoming requests for the conversational AI coach and fallback rules engine.
 */

const coachService = require('../services/coachService');
const { validateAskCoach } = require('../utils/validators');

/**
 * Ask the sustainability coach a question.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next handler.
 */
async function askCoach(req, res, next) {
  try {
    const validatedData = validateAskCoach(req.body);
    const result = await coachService.askCoach(validatedData.user_id, validatedData.question);
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  askCoach
};
