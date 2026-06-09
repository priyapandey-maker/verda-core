/**
 * @file twinService.js
 * @description Service layer managing yearly carbon projections and simulation targets.
 */

const { getDb } = require('../db');
const { getDashboardData, generateRecommendationsInternal } = require('./recommendationService');
const { calculateYearlyTrajectory, calculateImprovedTrajectory } = require('../utils/projections');
const { DAYS_IN_30D_WINDOW } = require('../config/constants');

/**
 * Retrieves the simulated carbon twin yearly projection statistics.
 * @param {number} userId - User identifier.
 * @returns {Promise<object>} Carbon twin projection metrics.
 */
async function getCarbonTwin(userId) {
  try {
    const db = await getDb();
    const dash = await getDashboardData(userId, db);
    if (!dash) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const currentTrajectoryYearly = calculateYearlyTrajectory(dash.currentEmissions, dash.dailyBaseline, dash.activeDays);

    const recommendations = await generateRecommendationsInternal(userId, db);
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
    if (err.statusCode) throw err;
    const error = new Error('Failed to calculate projection metrics');
    error.statusCode = 500;
    throw error;
  }
}

module.exports = {
  getCarbonTwin
};
