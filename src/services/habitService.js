/**
 * @file habitService.js
 * @description Service layer managing recurring habit detection query algorithms.
 */

const { getDb } = require('../db');
const { formatLocalDate } = require('../utils/formatter');
const { DAYS_IN_30D_WINDOW } = require('../config/constants');

/**
 * Detects recurring user habits over the last 30 days.
 * @param {number} user_id - User identifier.
 * @returns {Promise<object>} Object of formatted user habits.
 */
async function getHabits(user_id) {
  try {
    const db = await getDb();

    // Define 30-day window
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - (DAYS_IN_30D_WINDOW - 1));

    const startDateStr = formatLocalDate(thirtyDaysAgo);

    // Habit detection query
    const query = `
      SELECT 
        category,
        activity, 
        COUNT(*) as frequency,
        SUM(value) as total_value,
        SUM(co2_emissions) as total_co2
      FROM logs
      WHERE user_id = ? AND activity_date >= ?
      GROUP BY category, activity
      HAVING frequency > 3
      ORDER BY frequency DESC
    `;

    const habits = await db.all(query, [user_id, startDateStr]);

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
  } catch (_err) {
    const error = new Error('Failed to retrieve habit metrics');
    error.statusCode = 500;
    throw error;
  }
}

module.exports = {
  getHabits
};
