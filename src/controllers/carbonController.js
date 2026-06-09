const { getDb } = require('../db');

// Named Constants for transportation emission factors (kg CO2 per km)
const CAR_EMISSION_FACTOR = 0.18;
const BUS_EMISSION_FACTOR = 0.08;

// Core Emission Factors (kg CO2 equivalent per unit: km, kWh, or meal count)
const EMISSION_FACTORS = {
  transportation: {
    gasoline_car: CAR_EMISSION_FACTOR,      // per km
    diesel_car: 0.17,        // per km
    electric_car: 0.05,      // per km
    bus: BUS_EMISSION_FACTOR,               // per km
    train: 0.04,             // per km
    flight: 0.25,            // per km
    walking_biking: 0.00     // per km
  },
  electricity: {
    grid_electricity: 0.45   // per kWh
  },
  food: {
    beef_meal: 6.0,          // per meal
    pork_meal: 2.0,          // per meal
    poultry_meal: 1.5,       // per meal
    vegetarian_meal: 0.5,    // per meal
    vegan_meal: 0.3          // per meal
  }
};

/**
 * Calculates carbon emissions based on category, activity, and value.
 */
function calculateEmissions(category, activity, value) {
  if (!EMISSION_FACTORS[category]) return 0;
  const factor = EMISSION_FACTORS[category][activity];
  if (factor === undefined) return 0;
  return Number((factor * value).toFixed(2));
}

/**
 * Helper to validate activity date format (YYYY-MM-DD)
 */
function isValidDate(dateStr) {
  const reg = /^\d{4}-\d{2}-\d{2}$/;
  if (!reg.test(dateStr)) return false;
  const d = new Date(dateStr);
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Log a new carbon activity.
 */
async function logActivity(req, res) {
  try {
    const { user_id = 1, activity_date, category, activity, value } = req.body;

    // Input validation
    if (!activity_date || !isValidDate(activity_date)) {
      return res.status(400).json({ error: 'Invalid or missing activity_date (format: YYYY-MM-DD)' });
    }
    if (!category || !EMISSION_FACTORS[category]) {
      return res.status(400).json({ error: 'Invalid or missing category' });
    }
    if (!activity || EMISSION_FACTORS[category][activity] === undefined) {
      return res.status(400).json({ error: 'Invalid or missing activity type' });
    }
    if (value === undefined || typeof value !== 'number' || value <= 0) {
      return res.status(400).json({ error: 'Value must be a positive number' });
    }

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

    return res.status(201).json({
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
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    return res.status(500).json({ error: 'Failed to log activity' });
  }
}

/**
 * Retrieve logs for a user (optional date filter).
 */
async function getLogs(req, res) {
  try {
    const user_id = parseInt(req.query.user_id, 10) || 1;
    const { start_date, end_date } = req.query;
    const db = await getDb();

    let query = 'SELECT * FROM logs WHERE user_id = ?';
    const params = [user_id];

    if (start_date && isValidDate(start_date)) {
      query += ' AND activity_date >= ?';
      params.push(start_date);
    }
    if (end_date && isValidDate(end_date)) {
      query += ' AND activity_date <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY activity_date DESC, id DESC';
    const logs = await db.all(query, params);

    return res.json({ logs });
  } catch (error) {
    console.error('Error retrieving logs:', error);
    return res.status(500).json({ error: 'Failed to retrieve logs' });
  }
}

/**
 * Calculates the Sustainability Score & aggregates statistics for the Dashboard (30-day window).
 */
async function getDashboard(req, res) {
  try {
    const user_id = parseInt(req.query.user_id, 10) || 1;
    const db = await getDb();

    // 1. Fetch user data (specifically baseline_emissions)
    const user = await db.get('SELECT * FROM users WHERE id = ?', [user_id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Define 30-day window dates
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 29);

    const formatLocalDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

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
    
    // Consistency bonus: 1 point per logging day in 30 days, capped at 10.
    const consistencyBonus = Math.min(10, activeDays);

    // 4. Calculate score
    // Baseline emissions over the 30-day window (Daily baseline * 30 days)
    const dailyBaseline = user.baseline_emissions || 15.0;
    const baselineEmissions = dailyBaseline * 30;

    let score = 0;
    if (baselineEmissions > 0) {
      score = Math.max(0, 100 - ((currentEmissions / baselineEmissions) * 100)) + consistencyBonus;
    } else {
      score = consistencyBonus;
    }
    const finalScore = Number(Math.min(100, score).toFixed(1));

    return res.json({
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
      average_daily_emissions_30d: Number((currentEmissions / 30).toFixed(2)),
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
    });
  } catch (error) {
    console.error('Error calculating dashboard stats:', error);
    return res.status(500).json({ error: 'Failed to retrieve dashboard data' });
  }
}

async function getStreak(req, res) {
  try {
    const user_id = parseInt(req.query.user_id, 10) || 1;
    const db = await getDb();

    const user = await db.get('SELECT * FROM users WHERE id = ?', [user_id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get distinct activity dates sorted ascending
    const logs = await db.all(
      'SELECT DISTINCT activity_date FROM logs WHERE user_id = ? ORDER BY activity_date ASC',
      [user_id]
    );

    if (logs.length === 0) {
      return res.json({ currentStreak: 0, longestStreak: 0 });
    }

    const dates = logs.map(l => l.activity_date);

    function parseLocalDate(dateStr) {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    }

    const dayDiff = (date1, date2) => {
      const diffTime = Math.abs(date2.getTime() - date1.getTime());
      return Math.round(diffTime / (1000 * 60 * 60 * 24));
    };

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
    const todayStr = `${todayVal.getFullYear()}-${String(todayVal.getMonth() + 1).padStart(2, '0')}-${String(todayVal.getDate()).padStart(2, '0')}`;
    const yesterdayVal = new Date();
    yesterdayVal.setDate(todayVal.getDate() - 1);
    const yesterdayStr = `${yesterdayVal.getFullYear()}-${String(yesterdayVal.getMonth() + 1).padStart(2, '0')}-${String(yesterdayVal.getDate()).padStart(2, '0')}`;

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

    return res.json({
      currentStreak,
      longestStreak: longest
    });
  } catch (error) {
    console.error('Error calculating streak:', error);
    return res.status(500).json({ error: 'Failed to retrieve streak data' });
  }
}

module.exports = {
  logActivity,
  getLogs,
  getDashboard,
  getStreak,
  calculateEmissions,
  EMISSION_FACTORS,
  CAR_EMISSION_FACTOR,
  BUS_EMISSION_FACTOR
};
