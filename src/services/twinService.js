/**
 * @file twinService.js
 * @description Service layer managing yearly carbon projections and simulation targets.
 */

const { getDashboardData, generateRecommendationsInternal } = require('./recommendationService');
const { calculateYearlyTrajectory, calculateImprovedTrajectory } = require('../utils/projections');
const { DAYS_IN_30D_WINDOW } = require('../config/constants');
const { AppError, NotFoundError } = require('../utils/errors');

/**
 * Retrieves the simulated carbon twin yearly projection statistics.
 * @param {number} userId - User identifier.
 * @returns {Promise<object>} Carbon twin projection metrics.
 */
async function getCarbonTwin(userId) {
  try {
    const dash = await getDashboardData(userId);
    if (!dash) {
      throw new NotFoundError('User not found');
    }

    const currentTrajectoryYearly = calculateYearlyTrajectory(dash.currentEmissions, dash.dailyBaseline, dash.activeDays);

    const recommendations = await generateRecommendationsInternal(userId);
    const monthlyReduction = recommendations
      .filter(r => r.priority_score === 'High' || r.priority_score === 'Medium')
      .reduce((sum, r) => sum + r.estimated_co2_reduction, 0);

    const estimatedYearlyReduction = Number((monthlyReduction * 12).toFixed(1));
    const improvedTrajectoryYearly = calculateImprovedTrajectory(currentTrajectoryYearly, estimatedYearlyReduction);

    const averageDaily = dash.activeDays > 0 ? (dash.currentEmissions / DAYS_IN_30D_WINDOW) : dash.dailyBaseline;

    return {
      user_id: userId,
      days_tracked_30d: dash.activeDays,
      current_trajectory_yearly: currentTrajectoryYearly,
      improved_trajectory_yearly: improvedTrajectoryYearly,
      estimated_yearly_reduction: estimatedYearlyReduction,
      calculation_basis: {
        daily_average_kg: Number(averageDaily.toFixed(2)),
        monthly_saving_potential_kg: Number(monthlyReduction.toFixed(2))
      }
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to calculate projection metrics', 500);
  }
}

module.exports = {
  getCarbonTwin
};
