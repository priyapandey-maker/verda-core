/**
 * @file carbonService.js
 * @description Business logic layer for logging carbon activities, calculating user statistics, and tracking streaks.
 */

const { getDb } = require('../db');
const {
  DAYS_IN_30D_WINDOW,
  DEFAULT_BASELINE_EMISSIONS,
  CAR_EMISSION_FACTOR,
  BUS_EMISSION_FACTOR,
  EMISSION_FACTORS
} = require('../config/constants');
const {
  calculateEmissions,
  calculateConsistencyBonus,
  calculateSustainabilityScore
} = require('../utils/calculations');
const {
  formatLocalDate,
  parseLocalDate,
  dayDiff
} = require('../utils/formatter');

/**
 * Log a new carbon activity into the database.
 * @param {object} activityData - Validated activity data.
 * @returns {Promise<object>} Result metadata and logged entry.
 */
async function logActivity({ user_id, activity_date, category, activity, value }) {
  try {
    const co2_emissions = calculateEmissions(category, activity, value);
    const db = await getDb();

    // Verify user exists, otherwise fallback to default user (id: 1)
    const user = await db.get('SELECT id FROM users WHERE id = ?', [user_id]);
    const finalUserId = user ? user.id : 1;

    const result = await db.run(
      `INSERT INTO logs (user_id, activity_date, category, activity, value, co2_emissions)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [finalUserId, activity_date, category, activity, value, co2_emissions]
    );

    return {
      message: 'Activity logged successfully',
      log: {
        id: result.lastID,
        user_id: finalUserId,
        activity_date,
        category,
        activity,
        value,
        co2_emissions
      }
    };
  } catch (_err) {
    const error = new Error('Failed to log activity');
    error.statusCode = 500;
    throw error;
  }
}

/**
 * Retrieve activity logs for a user within an optional date range.
 * @param {object} filterParams - Filter variables (user_id, start_date, end_date).
 * @returns {Promise<object>} Object containing logs array.
 */
async function getLogs({ user_id, start_date, end_date }) {
  try {
    const db = await getDb();

    let query = 'SELECT * FROM logs WHERE user_id = ?';
    const params = [user_id];

    if (start_date) {
      query += ' AND activity_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND activity_date <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY activity_date DESC, id DESC';
    const logs = await db.all(query, params);

    return { logs };
  } catch (_err) {
    const error = new Error('Failed to retrieve logs');
    error.statusCode = 500;
    throw error;
  }
}

/**
 * Retrieve user profile and emissions analytics dashboard data (30-day window).
 * @param {number} user_id - User identifier.
 * @returns {Promise<object>} Structured dashboard object.
 */
async function getDashboard(user_id) {
  try {
    const db = await getDb();

    // 1. Fetch user data (specifically baseline_emissions)
    const user = await db.get('SELECT * FROM users WHERE id = ?', [user_id]);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Define 30-day window dates
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - (DAYS_IN_30D_WINDOW - 1));

    const endDateStr = formatLocalDate(today);
    const startDateStr = formatLocalDate(thirtyDaysAgo);

    // 2. Fetch total and category emissions
    const totalEmissionsQuery = `
      SELECT 
        SUM(co2_emissions) as total,
        SUM(CASE WHEN category = 'transportation' THEN co2_emissions ELSE 0 END) as transportation,
        SUM(CASE WHEN category = 'electricity' THEN co2_emissions ELSE 0 END) as electricity,
        SUM(CASE WHEN category = 'food' THEN co2_emissions ELSE 0 END) as food
      FROM logs 
      WHERE user_id = ? AND activity_date >= ? AND activity_date <= ?
    `;
    const emissionsResult = await db.get(totalEmissionsQuery, [user_id, startDateStr, endDateStr]);

    const currentEmissions = emissionsResult.total || 0;
    const categoryBreakdown = {
      transportation: emissionsResult.transportation || 0,
      electricity: emissionsResult.electricity || 0,
      food: emissionsResult.food || 0
    };

    // 3. Consistency Bonus: Count of distinct active days in the 30-day window
    const activeDaysQuery = `
      SELECT COUNT(DISTINCT activity_date) as active_days
      FROM logs
      WHERE user_id = ? AND activity_date >= ? AND activity_date <= ?
    `;
    const activeDaysResult = await db.get(activeDaysQuery, [user_id, startDateStr, endDateStr]);
    const activeDays = activeDaysResult.active_days || 0;
    
    // Consistency bonus calculation
    const consistencyBonus = calculateConsistencyBonus(activeDays);

    // Calculate score
    const dailyBaseline = user.baseline_emissions || DEFAULT_BASELINE_EMISSIONS;
    const baselineEmissions = dailyBaseline * DAYS_IN_30D_WINDOW;

    const finalScore = calculateSustainabilityScore(currentEmissions, baselineEmissions, consistencyBonus);

    return {
      user: {
        id: user.id,
        name: user.name,
        daily_baseline: dailyBaseline,
        baseline_emissions_30d: baselineEmissions
      },
      sustainability_score: finalScore,
      consistency_bonus: consistencyBonus,
      active_days: activeDays,
      total_emissions_30d: Number(currentEmissions.toFixed(2)),
      average_daily_emissions_30d: Number((currentEmissions / DAYS_IN_30D_WINDOW).toFixed(2)),
      category_breakdown: {
        transportation: Number(categoryBreakdown.transportation.toFixed(2)),
        electricity: Number(categoryBreakdown.electricity.toFixed(2)),
        food: Number(categoryBreakdown.food.toFixed(2))
      },
      period: {
        start_date: startDateStr,
        end_date: endDateStr
      },
      constants: {
        CAR_EMISSION_FACTOR,
        BUS_EMISSION_FACTOR,
        EMISSION_FACTORS
      }
    };
  } catch (_err) {
    if (_err.statusCode) throw _err;
    const error = new Error('Failed to retrieve dashboard data');
    error.statusCode = 500;
    throw error;
  }
}

/**
 * Calculates user's logging streaks (current and longest consecutive active days).
 * @param {number} user_id - User identifier.
 * @returns {Promise<object>} Streak statistics.
 */
async function getStreak(user_id) {
  try {
    const db = await getDb();

    const user = await db.get('SELECT * FROM users WHERE id = ?', [user_id]);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Get distinct activity dates sorted ascending
    const logs = await db.all(
      'SELECT DISTINCT activity_date FROM logs WHERE user_id = ? ORDER BY activity_date ASC',
      [user_id]
    );

    if (logs.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    const dates = logs.map(l => l.activity_date);

    let longest = 0;
    let tempStreak = 0;

    for (let i = 0; i < dates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prevDate = parseLocalDate(dates[i - 1]);
        const currDate = parseLocalDate(dates[i]);
        const diff = dayDiff(prevDate, currDate);
        if (diff === 1) {
          tempStreak++;
        } else if (diff > 1) {
          if (tempStreak > longest) {
            longest = tempStreak;
          }
          tempStreak = 1;
        }
      }
    }
    if (tempStreak > longest) {
      longest = tempStreak;
    }

    const todayVal = new Date();
    const todayStr = formatLocalDate(todayVal);
    const yesterdayVal = new Date();
    yesterdayVal.setDate(todayVal.getDate() - 1);
    const yesterdayStr = formatLocalDate(yesterdayVal);

    const lastDateStr = dates[dates.length - 1];
    let currentStreak = 0;
    if (lastDateStr === todayStr || lastDateStr === yesterdayStr) {
      currentStreak = 1;
      for (let i = dates.length - 1; i > 0; i--) {
        const prev = parseLocalDate(dates[i - 1]);
        const curr = parseLocalDate(dates[i]);
        const diff = dayDiff(prev, curr);
        if (diff === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    return {
      currentStreak,
      longestStreak: longest
    };
  } catch (_err) {
    if (_err.statusCode) throw _err;
    const error = new Error('Failed to retrieve streak data');
    error.statusCode = 500;
    throw error;
  }
}

module.exports = {
  logActivity,
  getLogs,
  getDashboard,
  getStreak
};
