/**
 * @file calculations.js
 * @description Central utility for core mathematical operations, emission tracking, and score metrics.
 */

const { EMISSION_FACTORS, MAX_SCORE, MAX_CONSISTENCY_BONUS } = require('../config/constants');

/**
 * Calculates carbon emissions based on category, activity, and input value.
 * @param {string} category - Category (e.g. transportation, electricity, food).
 * @param {string} activity - Specific activity type.
 * @param {number} value - Numeric quantity of activity.
 * @returns {number} Calculated emissions in kg CO2 (rounded to 2 decimal places).
 */
function calculateEmissions(category, activity, value) {
  if (!EMISSION_FACTORS[category]) return 0;
  const factor = EMISSION_FACTORS[category][activity];
  if (factor === undefined) return 0;
  return Number((factor * value).toFixed(2));
}

/**
 * Calculates the user's consistency bonus.
 * @param {number} activeDays - Count of active days logged in the window.
 * @returns {number} Consistency bonus points.
 */
function calculateConsistencyBonus(activeDays) {
  return Math.min(MAX_CONSISTENCY_BONUS, activeDays);
}

/**
 * Computes the final sustainability score out of 100.
 * @param {number} currentEmissions - User's total emissions in the tracking window.
 * @param {number} baselineEmissions - User's baseline emissions for the tracking window.
 * @param {number} consistencyBonus - Calculated consistency bonus.
 * @returns {number} Rounded final score between 0 and 100 (1 decimal place).
 */
function calculateSustainabilityScore(currentEmissions, baselineEmissions, consistencyBonus) {
  let score = 0;
  if (baselineEmissions > 0) {
    score = Math.max(0, MAX_SCORE - ((currentEmissions / baselineEmissions) * MAX_SCORE)) + consistencyBonus;
  } else {
    score = consistencyBonus;
  }
  return Number(Math.min(MAX_SCORE, score).toFixed(1));
}

module.exports = {
  calculateEmissions,
  calculateConsistencyBonus,
  calculateSustainabilityScore
};
