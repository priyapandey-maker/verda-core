/**
 * @file logRepository.js
 * @description Repository pattern layer executing activity logs query and write operations on the SQLite database.
 */

const { getDb } = require('../db');

/**
 * Repository class managing activity log queries and writes.
 */
class LogRepository {
  /**
   * Save a new carbon activity entry.
   * @param {object} logData - Structured log payload.
   * @returns {Promise<number>} Resolves to the last inserted row ID.
   */
  async create({ user_id, activity_date, category, activity, value, co2_emissions }) {
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO logs (user_id, activity_date, category, activity, value, co2_emissions)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, activity_date, category, activity, value, co2_emissions]
    );
    return result.lastID;
  }

  /**
   * Find activity logs of a user with optional date range filters.
   * @param {number} userId - The user ID.
   * @param {string} [startDate] - Start date bounds (YYYY-MM-DD).
   * @param {string} [endDate] - End date bounds (YYYY-MM-DD).
   * @returns {Promise<Array<object>>} Resolves to list of log rows.
   */
  async findByUserId(userId, startDate, endDate) {
    const db = await getDb();
    let query = 'SELECT * FROM logs WHERE user_id = ?';
    const params = [userId];

    if (startDate) {
      query += ' AND activity_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND activity_date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY activity_date DESC, id DESC';
    return db.all(query, params);
  }

  /**
   * Retrieve total emission sum and category breakdown aggregates for a user date window.
   * @param {number} userId - User identifier.
   * @param {string} startDate - Window start date.
   * @param {string} endDate - Window end date.
   * @returns {Promise<object>} Object containing category sums.
   */
  async getCategoryEmissions(userId, startDate, endDate) {
    const db = await getDb();
    const query = `
      SELECT 
        SUM(co2_emissions) as total,
        SUM(CASE WHEN category = 'transportation' THEN co2_emissions ELSE 0 END) as transportation,
        SUM(CASE WHEN category = 'electricity' THEN co2_emissions ELSE 0 END) as electricity,
        SUM(CASE WHEN category = 'food' THEN co2_emissions ELSE 0 END) as food
      FROM logs 
      WHERE user_id = ? AND activity_date >= ? AND activity_date <= ?
    `;
    return db.get(query, [userId, startDate, endDate]);
  }

  /**
   * Retrieve count of distinct active logging days for a user date window.
   * @param {number} userId - User identifier.
   * @param {string} startDate - Window start date.
   * @param {string} endDate - Window end date.
   * @returns {Promise<number>} Resolves to count of active logging days.
   */
  async getActiveDaysCount(userId, startDate, endDate) {
    const db = await getDb();
    const query = `
      SELECT COUNT(DISTINCT activity_date) as active_days
      FROM logs
      WHERE user_id = ? AND activity_date >= ? AND activity_date <= ?
    `;
    const result = await db.get(query, [userId, startDate, endDate]);
    return result ? result.active_days : 0;
  }

  /**
   * Retrieve recurring user habits with logged occurrences count > 3 in a date window.
   * @param {number} userId - User identifier.
   * @param {string} startDate - Window start date.
   * @returns {Promise<Array<object>>} List of recurring activities aggregates.
   */
  async getHabits(userId, startDate) {
    const db = await getDb();
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
    return db.all(query, [userId, startDate]);
  }

  /**
   * Get list of unique activity log dates for a user sorted chronologically.
   * @param {number} userId - User identifier.
   * @returns {Promise<Array<string>>} List of dates (YYYY-MM-DD).
   */
  async getDistinctActivityDates(userId) {
    const db = await getDb();
    const query = 'SELECT DISTINCT activity_date FROM logs WHERE user_id = ? ORDER BY activity_date ASC';
    const logs = await db.all(query, [userId]);
    return logs.map(l => l.activity_date);
  }
}

module.exports = new LogRepository();
