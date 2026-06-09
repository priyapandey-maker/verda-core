/**
 * @file habitService.js
 * @description Service layer managing recurring habit detection query algorithms.
 */

const logRepository = require('../repositories/logRepository');
const { formatLocalDate } = require('../utils/formatter');
const { DAYS_IN_30D_WINDOW } = require('../config/constants');
const { AppError } = require('../utils/errors');

/**
 * Detects recurring user habits over the last 30 days.
 * @param {number} user_id - User identifier.
 * @returns {Promise<object>} Object of formatted user habits.
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
