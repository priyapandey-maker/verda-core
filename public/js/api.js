/**
 * Verda Client API Client wrapper
 */
const VerdaAPI = {
  baseUrl: '/api',

  /**
   * Helper to perform fetch requests with error handling
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
   * Log a new carbon activity
   */
  async logActivity(payload) {
    return this.request('/logs', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * Fetch user activity logs
   */
  async getLogs(userId = 1, startDate = '', endDate = '') {
    let query = `?user_id=${userId}`;
    if (startDate) query += `&start_date=${startDate}`;
    if (endDate) query += `&end_date=${endDate}`;
    return this.request(`/logs${query}`);
  },

  /**
   * Fetch dashboard metrics and sustainability score
   */
  async getDashboard(userId = 1) {
    return this.request(`/dashboard?user_id=${userId}`);
  },

  /**
   * Fetch detected habits
   */
  async getHabits(userId = 1) {
    return this.request(`/habits?user_id=${userId}`);
  },

  /**
   * Fetch personalized recommendations
   */
  async getRecommendations(userId = 1) {
    return this.request(`/recommendations?user_id=${userId}`);
  },

  /**
   * Fetch Carbon Twin projections
   */
  async getTwin(userId = 1) {
    return this.request(`/twin?user_id=${userId}`);
  },

  /**
   * Fetch current and longest logging streak
   */
  async getStreak(userId = 1) {
    return this.request(`/streak?user_id=${userId}`);
  },

  /**
   * Ask AI Coach a question
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
