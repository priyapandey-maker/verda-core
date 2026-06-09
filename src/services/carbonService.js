/**
 * @file carbonService.js
 * @description Business logic layer for logging carbon activities, calculating user statistics, and tracking streaks.
 */

const userRepository = require('../repositories/userRepository');
const logRepository = require('../repositories/logRepository');
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
const { AppError, NotFoundError } = require('../utils/errors');

/**
 * Helper to calculate the longest consecutive streak from a list of dates.
 * @param {Array<string>} dates - Sorted unique date strings.
 * @returns {number} The longest streak count.
 */
function calculateLongestStreak(dates) {
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
  return tempStreak > longest ? tempStreak : longest;
}

/**
 * Helper to calculate the current active streak.
 * @param {Array<string>} dates - Sorted unique date strings.
 * @returns {number} The current streak count.
 */
function calculateCurrentStreak(dates) {
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
  return currentStreak;
}

/**
 * Log a new carbon activity into the database.
 * @param {object} activityData - Validated activity data.
 * @returns {Promise<object>} Result metadata and logged entry.
 */
async function logActivity({ user_id, activity_date, category, activity, value }) {
  try {
    const co2_emissions = calculateEmissions(category, activity, value);

    // Verify user exists, otherwise fallback to default user (id: 1)
    const user = await userRepository.findById(user_id);
    const finalUserId = user ? user.id : 1;

    const insertedId = await logRepository.create({
      user_id: finalUserId,
      activity_date,
      category,
      activity,
      value,
      co2_emissions
    });

    return {
      message: 'Activity logged successfully',
      log: {
        id: insertedId,
        user_id: finalUserId,
        activity_date,
        category,
        activity,
        value,
        co2_emissions
      }
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to log activity', 500);
  }
}

/**
 * Retrieve activity logs for a user within an optional date range.
 * @param {object} filterParams - Filter variables (user_id, start_date, end_date).
 * @returns {Promise<object>} Object containing logs array.
 */
async function getLogs({ user_id, start_date, end_date }) {
  try {
    const logs = await logRepository.findByUserId(user_id, start_date, end_date);
    return { logs };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to retrieve logs', 500);
  }
}

/**
 * Retrieve user profile and emissions analytics dashboard data (30-day window).
 * @param {number} user_id - User identifier.
 * @returns {Promise<object>} Structured dashboard object.
 */
async function getDashboard(user_id) {
  try {
    // 1. Fetch user data (specifically baseline_emissions)
    const user = await userRepository.findById(user_id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Define 30-day window dates
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - (DAYS_IN_30D_WINDOW - 1));

    const endDateStr = formatLocalDate(today);
    const startDateStr = formatLocalDate(thirtyDaysAgo);

    // 2. Fetch total emissions and active days in parallel
    const [emissionsResult, activeDays] = await Promise.all([
      logRepository.getCategoryEmissions(user_id, startDateStr, endDateStr),
      logRepository.getActiveDaysCount(user_id, startDateStr, endDateStr)
    ]);

    const currentEmissions = emissionsResult.total || 0;
    const categoryBreakdown = {
      transportation: emissionsResult.transportation || 0,
      electricity: emissionsResult.electricity || 0,
      food: emissionsResult.food || 0
    };
    
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
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to retrieve dashboard data', 500);
  }
}

/**
 * Calculates user's logging streaks (current and longest consecutive active days).
 * @param {number} user_id - User identifier.
 * @returns {Promise<object>} Streak statistics.
 */
async function getStreak(user_id) {
  try {
    const user = await userRepository.findById(user_id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Get distinct activity dates sorted ascending
    const dates = await logRepository.getDistinctActivityDates(user_id);

    if (dates.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    const longest = calculateLongestStreak(dates);
    const current = calculateCurrentStreak(dates);

    return {
      currentStreak: current,
      longestStreak: longest
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to retrieve streak data', 500);
  }
}

module.exports = {
  logActivity,
  getLogs,
  getDashboard,
  getStreak
};
