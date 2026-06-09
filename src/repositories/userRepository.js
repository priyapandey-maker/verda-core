/**
 * @file userRepository.js
 * @description Repository pattern layer for executing user profile queries on the SQLite database.
 */

const { getDb } = require('../db');

/**
 * Repository class managing user profile lookups.
 */
class UserRepository {
  /**
   * Find user metadata by their unique integer ID.
   * @param {number} userId - The unique identifier of the user.
   * @returns {Promise<object|null>} Resolves to user record or null if not found.
   */
  async findById(userId) {
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    return user || null;
  }
}

module.exports = new UserRepository();
