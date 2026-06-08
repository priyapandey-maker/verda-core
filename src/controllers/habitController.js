const { getDb } = require('../db');

/**
 * Detects recurring habits for the user (last 30 days with > 3 logged events of a specific activity).
 */
async function getHabits(req, res) {
  try {
    const user_id = parseInt(req.query.user_id, 10) || 1;
    const db = await getDb();

    // Define 30-day window
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 29);

    const formatLocalDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

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

    return res.json({
      user_id,
      period: {
        start_date: startDateStr,
        end_date: formatLocalDate(today)
      },
      habits: formattedHabits
    });
  } catch (error) {
    console.error('Error detecting habits:', error);
    return res.status(500).json({ error: 'Failed to retrieve habit metrics' });
  }
}

module.exports = {
  getHabits
};
