/**
 * @file projections.js
 * @description Central utility for yearly carbon trajectory projections and potential reduction metrics.
 */

const { DAYS_IN_30D_WINDOW, DAYS_IN_YEAR } = require('../config/constants');

/**
 * Calculates current yearly emissions trajectory.
 * @param {number} currentEmissions - Emissions in the current tracking window.
 * @param {number} dailyBaseline - Daily baseline fallback.
 * @param {number} activeDays - Count of active days logged.
 * @returns {number} Projected yearly emissions in kg CO2 (rounded to 1 decimal place).
 */
function calculateYearlyTrajectory(currentEmissions, dailyBaseline, activeDays) {
  const averageDaily = activeDays > 0 ? (currentEmissions / DAYS_IN_30D_WINDOW) : dailyBaseline;
  return Number((averageDaily * DAYS_IN_YEAR).toFixed(1));
}

/**
 * Calculates the improved yearly emissions trajectory.
 * @param {number} currentTrajectoryYearly - Baseline projected yearly emissions.
 * @param {number} estimatedYearlyReduction - Potential savings over a year.
 * @returns {number} Net improved yearly trajectory in kg CO2 (rounded to 1 decimal place).
 */
function calculateImprovedTrajectory(currentTrajectoryYearly, estimatedYearlyReduction) {
  return Number(Math.max(0, currentTrajectoryYearly - estimatedYearlyReduction).toFixed(1));
}

module.exports = {
  calculateYearlyTrajectory,
  calculateImprovedTrajectory
};
