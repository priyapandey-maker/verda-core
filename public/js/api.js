/**
 * @file api.js
 * @description Verda Client API Client wrapper to perform fetch requests to the REST backend.
 */

/**
 * @typedef {Object} CarbonStats
 * @property {Object} user
 * @property {number} user.id
 * @property {string} user.name
 * @property {number} user.daily_baseline
 * @property {number} user.baseline_emissions_30d
 * @property {number} sustainability_score
 * @property {number} consistency_bonus
 * @property {number} active_days
 * @property {number} total_emissions_30d
 * @property {number} average_daily_emissions_30d
 * @property {Object} category_breakdown
 * @property {number} category_breakdown.transportation
 * @property {number} category_breakdown.electricity
 * @property {number} category_breakdown.food
 * @property {Object} period
 * @property {string} period.start_date
 * @property {string} period.end_date
 * @property {Object} constants
 * @property {number} constants.CAR_EMISSION_FACTOR
 * @property {number} constants.BUS_EMISSION_FACTOR
 * @property {Object} constants.EMISSION_FACTORS
 */

/**
 * @typedef {Object} ActivityLog
 * @property {number} id
 * @property {number} user_id
 * @property {string} activity_date
 * @property {string} category
 * @property {string} activity
 * @property {number} value
 * @property {number} co2_emissions
 */

/**
 * @typedef {Object} Recommendation
 * @property {string} recommendation
 * @property {string} reason
 * @property {number} estimatedReduction
 * @property {number} confidence
 * @property {number} easeScore
 * @property {number} priority
 */

/**
 * @typedef {Object} TwinProjections
 * @property {Array<{day: number, current: number, improved: number}>} current_trajectory_yearly
 * @property {Array<{day: number, current: number, improved: number}>} improved_trajectory_yearly
 * @property {number} current_yearly_total
 * @property {number} improved_yearly_total
 * @property {number} potential_yearly_savings
 */

/**
 * @typedef {Object} StreakData
 * @property {number} currentStreak
 * @property {number} longestStreak
 */

/**
 * @typedef {Object} CoachResponse
 * @property {string} advice
 * @property {Recommendation[]} recommendations
 */

const VerdaAPI = {
  baseUrl: '/api',

  /**
   * Helper to perform fetch requests with error handling.
   * @param {string} endpoint - API endpoint relative path.
   * @param {RequestInit} [options={}] - Fetch configuration options.
   * @returns {Promise<any>} Response JSON data.
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Set headers
    options.headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error on ${endpoint}:`, error.message);
      throw error;
    }
  },

  /**
   * Log a new carbon activity.
   * @param {Partial<ActivityLog>} payload - Activity data to log.
   * @returns {Promise<{message: string, log: ActivityLog}>} Response message and created log.
   */
  async logActivity(payload) {
    return this.request('/logs', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * Fetch user activity logs.
   * @param {number} [userId=1] - User identifier.
   * @param {string} [startDate=''] - Optional start date ISO string (YYYY-MM-DD).
   * @param {string} [endDate=''] - Optional end date ISO string (YYYY-MM-DD).
   * @returns {Promise<{logs: ActivityLog[]}>} Array of activity logs.
   */
  async getLogs(userId = 1, startDate = '', endDate = '') {
    let query = `?user_id=${userId}`;
    if (startDate) query += `&start_date=${startDate}`;
    if (endDate) query += `&end_date=${endDate}`;
    return this.request(`/logs${query}`);
  },

  /**
   * Fetch dashboard metrics and sustainability score.
   * @param {number} [userId=1] - User identifier.
   * @returns {Promise<CarbonStats>} Dashboard analytics data.
   */
  async getDashboard(userId = 1) {
    return this.request(`/dashboard?user_id=${userId}`);
  },

  /**
   * Fetch detected habits.
   * @param {number} [userId=1] - User identifier.
   * @returns {Promise<{habits: Array<{category: string, activity: string, count: number, description: string}>}>} Detected habits.
   */
  async getHabits(userId = 1) {
    return this.request(`/habits?user_id=${userId}`);
  },

  /**
   * Fetch personalized recommendations.
   * @param {number} [userId=1] - User identifier.
   * @returns {Promise<{recommendations: Recommendation[]}>} Personalized recommendations list.
   */
  async getRecommendations(userId = 1) {
    return this.request(`/recommendations?user_id=${userId}`);
  },

  /**
   * Fetch Carbon Twin projections.
   * @param {number} [userId=1] - User identifier.
   * @returns {Promise<TwinProjections>} Carbon Twin projection trajectories.
   */
  async getTwin(userId = 1) {
    return this.request(`/twin?user_id=${userId}`);
  },

  /**
   * Fetch current and longest logging streak.
   * @param {number} [userId=1] - User identifier.
   * @returns {Promise<StreakData>} Current and longest streak counts.
   */
  async getStreak(userId = 1) {
    return this.request(`/streak?user_id=${userId}`);
  },

  /**
   * Ask AI Coach a question.
   * @param {string} question - Question query.
   * @param {number} [userId=1] - User identifier.
   * @returns {Promise<CoachResponse>} AI advice and recommendations response.
   */
  async askCoach(question, userId = 1) {
    return this.request('/coach', {
      method: 'POST',
      body: JSON.stringify({ question, user_id: userId })
    });
  }
};

if (typeof module !== 'undefined') {
  module.exports = VerdaAPI;
}
