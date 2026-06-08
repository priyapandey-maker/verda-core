const { getDb } = require('../db');

/**
 * Helper to fetch user dashboard data programmatically.
 */
async function getDashboardData(userId, db) {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return null;

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

  const stats = await db.get(`
    SELECT 
      SUM(co2_emissions) as total,
      SUM(CASE WHEN category = 'transportation' THEN co2_emissions ELSE 0 END) as transportation,
      SUM(CASE WHEN category = 'electricity' THEN co2_emissions ELSE 0 END) as electricity,
      SUM(CASE WHEN category = 'food' THEN co2_emissions ELSE 0 END) as food
    FROM logs 
    WHERE user_id = ? AND activity_date >= ? AND activity_date <= ?
  `, [userId, startDateStr, endDateStr]);

  const activeDaysResult = await db.get(`
    SELECT COUNT(DISTINCT activity_date) as active_days
    FROM logs
    WHERE user_id = ? AND activity_date >= ? AND activity_date <= ?
  `, [userId, startDateStr, endDateStr]);

  const currentEmissions = stats.total || 0;
  const activeDays = activeDaysResult.active_days || 0;
  const dailyBaseline = user.baseline_emissions || 15.0;
  const baselineEmissions = dailyBaseline * 30;

  const consistencyBonus = Math.min(10, activeDays);
  let score = 0;
  if (baselineEmissions > 0) {
    score = Math.max(0, 100 - ((currentEmissions / baselineEmissions) * 100)) + consistencyBonus;
  } else {
    score = consistencyBonus;
  }
  const finalScore = Number(Math.min(100, score).toFixed(1));

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
 * Generates personalized recommendations based on the user's habits and category breakdown.
 */
async function generateRecommendationsInternal(userId, db) {
  const dash = await getDashboardData(userId, db);
  if (!dash) return [];

  // Get habits query
  const habits = await db.all(`
    SELECT category, activity, COUNT(*) as frequency, SUM(value) as total_value, SUM(co2_emissions) as total_co2
    FROM logs
    WHERE user_id = ? AND activity_date >= ?
    GROUP BY category, activity
    ORDER BY frequency DESC
  `, [userId, dash.startDateStr]);

  const recommendations = [];

  // 1. Identify dominant category
  const breakdown = dash.categoryBreakdown;
  const categoriesSorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const dominantCategory = categoriesSorted[0][0];
  const dominantEmissions = categoriesSorted[0][1];

  // Only produce category-specific suggestions if emissions are > 0
  if (dominantEmissions > 0) {
    if (dominantCategory === 'transportation') {
      const carHabit = habits.find(h => h.activity === 'gasoline_car' || h.activity === 'diesel_car');
      if (carHabit && carHabit.frequency > 2) {
        // High frequency fossil driving
        const distance = carHabit.total_value;
        // Estimate 50% replacement with public transport (bus: 0.08 vs gasoline car: 0.18, net diff: 0.10)
        const reduction = Number((distance * 0.5 * 0.10).toFixed(1));
        recommendations.push({
          id: 'rec_transit_swap',
          title: 'Switch Driving to Public Transit',
          category: 'transportation',
          why: `Transportation is your largest emission category. You logged ${carHabit.frequency} car trips totaling ${distance.toFixed(0)} km. Swapping half of these to public transit saves significant emissions.`,
          estimated_co2_reduction: reduction,
          priority_score: 'High'
        });
      } else {
        recommendations.push({
          id: 'rec_general_transit',
          title: 'Consolidate Travel & Choose Train/Bus',
          category: 'transportation',
          why: `Transportation accounts for ${breakdown.transportation.toFixed(1)} kg CO2 (your highest source). Consolidating errands and taking public transit reduces carbon output.`,
          estimated_co2_reduction: 15.0,
          priority_score: 'Medium'
        });
      }
    } else if (dominantCategory === 'food') {
      const beefHabit = habits.find(h => h.activity === 'beef_meal');
      if (beefHabit && beefHabit.frequency > 2) {
        // High beef consumption
        // Estimate replacing 50% of beef meals with vegetarian (beef: 6.0 vs vegetarian: 0.5, net diff: 5.5)
        const reduction = Number((beefHabit.total_value * 0.5 * 5.5).toFixed(1));
        recommendations.push({
          id: 'rec_beef_swap',
          title: 'Swap Beef for Plant-based Options',
          category: 'food',
          why: `Food is your highest carbon category, and beef is a high-impact food. You logged ${beefHabit.frequency} beef meals. Replacing half of them with vegetarian alternatives significantly lowers your footprint.`,
          estimated_co2_reduction: reduction,
          priority_score: 'High'
        });
      } else {
        recommendations.push({
          id: 'rec_plant_day',
          title: 'Introduce Meatless Mondays',
          category: 'food',
          why: `Food accounts for ${breakdown.food.toFixed(1)} kg CO2. Incorporating plant-based days cuts dietary emissions by about 10-15%.`,
          estimated_co2_reduction: 12.0,
          priority_score: 'Medium'
        });
      }
    } else if (dominantCategory === 'electricity') {
      // High electricity usage
      const reduction = Number((breakdown.electricity * 0.15).toFixed(1));
      recommendations.push({
        id: 'rec_home_efficiency',
        title: 'Optimize Household Power Usage',
        category: 'electricity',
        why: `Electricity contributes ${breakdown.electricity.toFixed(1)} kg CO2 (your highest category). Simple changes like LED bulbs, turning off standby mode, and adjusting thermostat ranges can trim 15% easily.`,
        estimated_co2_reduction: reduction,
        priority_score: 'High'
      });
    }
  }

  // 2. Score-based suggestions
  if (dash.score < 60) {
    recommendations.push({
      id: 'rec_sustainability_boost',
      title: 'Initiate a 7-Day Carbon Fast',
      category: 'general',
      why: `Your sustainability score is low (${dash.score}/100). Focus on walking/biking all short trips (<3km) and eating plant-based meals this week.`,
      estimated_co2_reduction: 25.0,
      priority_score: 'High'
    });
  } else if (dash.score >= 85) {
    recommendations.push({
      id: 'rec_sustainability_maintain',
      title: 'Promote Community Eco-Actions',
      category: 'general',
      why: `Excellent score of ${dash.score}/100! Share your sustainability journey to encourage others to transition to lower-carbon habits.`,
      estimated_co2_reduction: 0.0,
      priority_score: 'Low'
    });
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
 * Endpoint to fetch recommendations.
 */
async function getRecommendations(req, res) {
  try {
    const user_id = parseInt(req.query.user_id, 10) || 1;
    const db = await getDb();

    const recommendations = await generateRecommendationsInternal(user_id, db);
    return res.json({ user_id, recommendations });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return res.status(500).json({ error: 'Failed to retrieve recommendations' });
  }
}

/**
 * Calculates Carbon Twin projections (Current vs Improved trajectory over a year).
 */
async function getCarbonTwin(req, res) {
  try {
    const user_id = parseInt(req.query.user_id, 10) || 1;
    const db = await getDb();

    const dash = await getDashboardData(user_id, db);
    if (!dash) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 1. Current Yearly Trajectory
    // Project average daily emissions in the last 30 days to a year.
    // If they have no logs, fallback to daily baseline * 365.
    const averageDaily = dash.activeDays > 0 ? (dash.currentEmissions / 30) : dash.dailyBaseline;
    const currentTrajectoryYearly = Number((averageDaily * 365).toFixed(1));

    // 2. Calculate Improved Trajectory based on recommendations
    const recommendations = await generateRecommendationsInternal(user_id, db);
    // Sum the monthly estimated reductions from high & medium priority recommendations
    const monthlyReduction = recommendations
      .filter(r => r.priority_score === 'High' || r.priority_score === 'Medium')
      .reduce((sum, r) => sum + r.estimated_co2_reduction, 0);

    const estimatedYearlyReduction = Number((monthlyReduction * 12).toFixed(1));
    const improvedTrajectoryYearly = Number(Math.max(0, currentTrajectoryYearly - estimatedYearlyReduction).toFixed(1));

    return res.json({
      user_id,
      days_tracked_30d: dash.activeDays,
      current_trajectory_yearly: currentTrajectoryYearly,
      improved_trajectory_yearly: improvedTrajectoryYearly,
      estimated_yearly_reduction: estimatedYearlyReduction,
      calculation_basis: {
        daily_average_kg: Number(averageDaily.toFixed(2)),
        monthly_saving_potential_kg: Number(monthlyReduction.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Error calculating carbon twin projections:', error);
    return res.status(500).json({ error: 'Failed to calculate projection metrics' });
  }
}

module.exports = {
  getRecommendations,
  getCarbonTwin,
  generateRecommendationsInternal
};
