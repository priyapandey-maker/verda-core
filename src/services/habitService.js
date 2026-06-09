/**
 * @typedef {Object} UserHabit
 * @property {string} category - Habit category.
 * @property {string} activity - Specific activity type.
 * @property {number} frequency - Count of logs.
 * @property {number} total_value - Sum of activity values.
 * @property {number} total_co2 - Total carbon footprint.
 * @property {string} description - Dynamic text description.
 */

/**
 * @typedef {Object} HabitResult
 * @property {number} user_id - User identifier.
 * @property {Object} period - Tracking range.
 * @property {string} period.start_date - ISO date.
 * @property {string} period.end_date - ISO date.
 * @property {UserHabit[]} habits - Detected user habits list.
 */

const logRepository = require('../repositories/logRepository');
const { formatLocalDate } = require('../utils/formatter');
const { DAYS_IN_30D_WINDOW } = require('../config/constants');
const { AppError } = require('../utils/errors');

/**
 * Detects recurring user habits over the last 30 days.
 * @param {number} user_id - User identifier.
 * @returns {Promise<HabitResult>} Object of formatted user habits.
 */
async function getHabits(user_id) {
  try {
    // Define 30-day window
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - (DAYS_IN_30D_WINDOW - 1));

    const startDateStr = formatLocalDate(thirtyDaysAgo);

    // Habit detection query delegated to repository
    const habits = await logRepository.getHabits(user_id, startDateStr);

    // Format output with dynamic descriptions
    const formattedHabits = habits.map(h => {
      let description = '';
      if (h.category === 'transportation') {
        description = `You logged travel via ${h.activity.replace('_', ' ')} ${h.frequency} times, covering a total of ${h.total_value.toFixed(1)} km.`;
      } else if (h.category === 'food') {
        description = `You consumed ${h.activity.replace('_', ' ')} ${h.frequency} times.`;
      } else if (h.category === 'electricity') {
        description = `You logged electricity usage ${h.frequency} times, totaling ${h.total_value.toFixed(1)} kWh.`;
      }

      return {
        category: h.category,
        activity: h.activity,
        frequency: h.frequency,
        total_value: Number(h.total_value.toFixed(2)),
        total_co2: Number(h.total_co2.toFixed(2)),
        description
      };
    });

    return {
      user_id,
      period: {
        start_date: startDateStr,
        end_date: formatLocalDate(today)
      },
      habits: formattedHabits
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to retrieve habit metrics', 500);
  }
}

module.exports = {
  getHabits
};
