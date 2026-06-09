/**
 * @typedef {Object} Recommendation
 * @property {string} id - Unique recommendation identifier.
 * @property {string} title - Recommendation title.
 * @property {string} category - Carbon category.
 * @property {string} why - Reasoning text.
 * @property {number} estimated_co2_reduction - Expected reduction in kg CO2.
 * @property {string} priority_score - Priority level ('High', 'Medium', 'Low').
 */

/**
 * @typedef {Object} RecommendationDashboardData
 * @property {number} dailyBaseline - Daily baseline.
 * @property {number} currentEmissions - Total emissions.
 * @property {number} score - Sustainability score.
 * @property {Object} categoryBreakdown - Category breakdown.
 * @property {number} categoryBreakdown.transportation - Transportation emissions.
 * @property {number} categoryBreakdown.electricity - Electricity emissions.
 * @property {number} categoryBreakdown.food - Food emissions.
 * @property {number} activeDays - Number of active days logged.
 * @property {string} startDateStr - YYYY-MM-DD start.
 * @property {string} endDateStr - YYYY-MM-DD end.
 */

/**
 * @typedef {Object} RecommendationsResponse
 * @property {number} user_id - User identifier.
 * @property {Recommendation[]} recommendations - Recommendation list.
 */

const userRepository = require('../repositories/userRepository');
const logRepository = require('../repositories/logRepository');
const {
  DAYS_IN_30D_WINDOW,
  BEEF_VEG_EMISSION_DIFF,
  DEFAULT_BASELINE_EMISSIONS
} = require('../config/constants');
const { formatLocalDate } = require('../utils/formatter');
const { calculateSustainabilityScore, calculateConsistencyBonus } = require('../utils/calculations');
const { AppError } = require('../utils/errors');

// Named Constants for recommendation estimations
const TRANSIT_SWAP_SAVINGS_MULTIPLIER = 0.10; // gasoline car (0.18) - bus (0.08)
const SWAP_PROPORTION = 0.5; // 50% swap

/**
 * Gets category-specific dominant carbon suggestions.
 * @param {string} dominantCategory - Dominant carbon category.
 * @param {number} dominantEmissions - Dominant category total emissions.
 * @param {Array<Object>} habits - Detected active user habits.
 * @param {Object} breakdown - Category breakdown emission weights.
 * @param {number} breakdown.transportation - Transportation emissions.
 * @param {number} breakdown.electricity - Electricity emissions.
 * @param {number} breakdown.food - Food emissions.
 * @returns {Recommendation|null} Generated recommendation object or null.
 */
function getDominantCategoryRecommendation(dominantCategory, dominantEmissions, habits, breakdown) {
  if (dominantEmissions <= 0) return null;

  if (dominantCategory === 'transportation') {
    const carHabit = habits.find(h => h.activity === 'gasoline_car' || h.activity === 'diesel_car');
    if (carHabit && carHabit.frequency > 2) {
      const distance = carHabit.total_value;
      const reduction = Number((distance * SWAP_PROPORTION * TRANSIT_SWAP_SAVINGS_MULTIPLIER).toFixed(1));
      return {
        id: 'rec_transit_swap',
        title: 'Switch Driving to Public Transit',
        category: 'transportation',
        why: `Transportation is your largest emission category. You logged ${carHabit.frequency} car trips totaling ${distance.toFixed(0)} km. Swapping half of these to public transit saves significant emissions.`,
        estimated_co2_reduction: reduction,
        priority_score: 'High'
      };
    }
    return {
      id: 'rec_general_transit',
      title: 'Consolidate Travel & Choose Train/Bus',
      category: 'transportation',
      why: `Transportation accounts for ${breakdown.transportation.toFixed(1)} kg CO2 (your highest source). Consolidating errands and taking public transit reduces carbon output.`,
      estimated_co2_reduction: 15.0,
      priority_score: 'Medium'
    };
  }

  if (dominantCategory === 'food') {
    const beefHabit = habits.find(h => h.activity === 'beef_meal');
    if (beefHabit && beefHabit.frequency > 2) {
      const reduction = Number((beefHabit.total_value * SWAP_PROPORTION * BEEF_VEG_EMISSION_DIFF).toFixed(1));
      return {
        id: 'rec_beef_swap',
        title: 'Swap Beef for Plant-based Options',
        category: 'food',
        why: `Food is your highest carbon category, and beef is a high-impact food. You logged ${beefHabit.frequency} beef meals. Replacing half of them with vegetarian alternatives significantly lowers your footprint.`,
        estimated_co2_reduction: reduction,
        priority_score: 'High'
      };
    }
    return {
      id: 'rec_plant_day',
      title: 'Introduce Meatless Mondays',
      category: 'food',
      why: `Food accounts for ${breakdown.food.toFixed(1)} kg CO2. Incorporating plant-based days cuts dietary emissions by about 10-15%.`,
      estimated_co2_reduction: 12.0,
      priority_score: 'Medium'
    };
  }

  if (dominantCategory === 'electricity') {
    const reduction = Number((breakdown.electricity * 0.15).toFixed(1));
    return {
      id: 'rec_home_efficiency',
      title: 'Optimize Household Power Usage',
      category: 'electricity',
      why: `Electricity contributes ${breakdown.electricity.toFixed(1)} kg CO2 (your highest category). Simple changes like LED bulbs, turning off standby mode, and adjusting thermostat ranges can trim 15% easily.`,
      estimated_co2_reduction: reduction,
      priority_score: 'High'
    };
  }

  return null;
}

/**
 * Gets score-based eco action recommendations.
 * @param {number} score - Sustainability score.
 * @returns {Recommendation|null} Generated recommendation or null.
 */
function getScoreBasedRecommendation(score) {
  if (score < 60) {
    return {
      id: 'rec_sustainability_boost',
      title: 'Initiate a 7-Day Carbon Fast',
      category: 'general',
      why: `Your sustainability score is low (${score}/100). Focus on walking/biking all short trips (<3km) and eating plant-based meals this week.`,
      estimated_co2_reduction: 25.0,
      priority_score: 'High'
    };
  }
  if (score >= 85) {
    return {
      id: 'rec_sustainability_maintain',
      title: 'Promote Community Eco-Actions',
      category: 'general',
      why: `Excellent score of ${score}/100! Share your sustainability journey to encourage others to transition to lower-carbon habits.`,
      estimated_co2_reduction: 0.0,
      priority_score: 'Low'
    };
  }
  return null;
}

/**
 * Helper to fetch user dashboard data programmatically.
 * @param {number} userId - User ID.
 * @returns {Promise<RecommendationDashboardData|null>} Dashboard subset or null.
 */
async function getDashboardData(userId) {
  const user = await userRepository.findById(userId);
  if (!user) return null;

  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - (DAYS_IN_30D_WINDOW - 1));

  const endDateStr = formatLocalDate(today);
  const startDateStr = formatLocalDate(thirtyDaysAgo);

  // Parallel database lookups for dashboard totals and consistency metrics
  const [stats, activeDays] = await Promise.all([
    logRepository.getCategoryEmissions(userId, startDateStr, endDateStr),
    logRepository.getActiveDaysCount(userId, startDateStr, endDateStr)
  ]);

  const currentEmissions = stats.total || 0;
  const dailyBaseline = user.baseline_emissions || DEFAULT_BASELINE_EMISSIONS;
  const baselineEmissions = dailyBaseline * DAYS_IN_30D_WINDOW;

  const consistencyBonus = calculateConsistencyBonus(activeDays);
  const finalScore = calculateSustainabilityScore(currentEmissions, baselineEmissions, consistencyBonus);

  return {
    dailyBaseline,
    currentEmissions,
    score: finalScore,
    categoryBreakdown: {
      transportation: stats.transportation || 0,
      electricity: stats.electricity || 0,
      food: stats.food || 0
    },
    activeDays,
    startDateStr,
    endDateStr
  };
}

/**
 * Generates recommendations based on the user's logged habits.
 * @param {number} userId - User ID.
 * @returns {Promise<Recommendation[]>} Generated recommendations.
 */
async function generateRecommendationsInternal(userId) {
  const dash = await getDashboardData(userId);
  if (!dash) return [];

  // Get habits query delegated to repository
  const habits = await logRepository.getHabits(userId, dash.startDateStr);

  const recommendations = [];

  // 1. Identify dominant category
  const breakdown = dash.categoryBreakdown;
  const categoriesSorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const dominantCategory = categoriesSorted[0][0];
  const dominantEmissions = categoriesSorted[0][1];

  const categoryRec = getDominantCategoryRecommendation(dominantCategory, dominantEmissions, habits, breakdown);
  if (categoryRec) {
    recommendations.push(categoryRec);
  }

  const scoreRec = getScoreBasedRecommendation(dash.score);
  if (scoreRec) {
    recommendations.push(scoreRec);
  }

  // 3. Constant/Standby defaults (Ensure we always have at least two robust recommendations)
  recommendations.push({
    id: 'rec_unplug_standby',
    title: 'Unplug Idle Electronics',
    category: 'electricity',
    why: 'Household electronics consume "vampire power" when plugged in but idle. Unplugging them saves passive emissions.',
    estimated_co2_reduction: 5.0,
    priority_score: 'Low'
  });

  recommendations.push({
    id: 'rec_active_commutes',
    title: 'Walk or Cycle for Short Trips',
    category: 'transportation',
    why: 'Nearly 50% of urban car trips are under 3km. Swapping these to walking or biking eliminates driving emissions.',
    estimated_co2_reduction: 10.0,
    priority_score: 'Medium'
  });

  return recommendations;
}

/**
 * Endpoint-level service to get recommendations.
 * @param {number} userId - User ID.
 * @returns {Promise<RecommendationsResponse>} Object with user_id and recommendations.
 */
async function getRecommendations(userId) {
  try {
    const recommendations = await generateRecommendationsInternal(userId);
    return { user_id: userId, recommendations };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to retrieve recommendations', 500);
  }
}

module.exports = {
  getRecommendations,
  generateRecommendationsInternal,
  getDashboardData
};
