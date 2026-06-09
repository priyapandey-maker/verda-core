/**
 * @file coachService.js
 * @description Service layer managing AI Coach conversational inquiries, prompt synthesis, and rules fallback.
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
 * @property {string} recommendation - Recommendation text.
 * @property {string} reason - Justification.
 * @property {number} estimatedReduction - Monthly reduction in kg.
 * @property {number} confidence - Confidence score.
 * @property {number} easeScore - Ease rating (1-5).
 * @property {number} priority - Calculated priority index.
 */

/**
 * @typedef {Object} CoachStats
 * @property {string} user_name - User's name.
 * @property {number} daily_baseline - Daily baseline emissions.
 * @property {number} total_emissions_30d - Total emissions in 30 days.
 * @property {number} days_logged - Count of active days.
 * @property {Object.<string, number>} category_totals - Category emissions breakdown.
 * @property {ActivityLog[]} recent_logs - User's recent logs.
 */

/**
 * @typedef {Object} CoachAdviceResponse
 * @property {string} advice - Text response.
 * @property {Recommendation[]} recommendations - Recommendation list.
 * @property {Object} context_summary - Summary indicators.
 * @property {number} context_summary.total_emissions_30d - Total 30-day emissions.
 * @property {number} context_summary.active_days - Logged days.
 * @property {string} mode - Execution mode (AI or fallback).
 */

const userRepository = require('../repositories/userRepository');
const logRepository = require('../repositories/logRepository');
const { DAYS_IN_30D_WINDOW } = require('../config/constants');
const { formatLocalDate } = require('../utils/formatter');
const { AppError, NotFoundError } = require('../utils/errors');

/**
 * Helper generating fallback candidates based on categories.
 * @param {string|null} detectedCategory - Matched keyword category.
 * @param {object} categoryTotals - User emissions weights by category.
 * @param {Array<object>} logs - Recent logged items list.
 * @returns {Array<object>} Candidate recommendations list.
 */
function getRulesBasedCandidates(detectedCategory, categoryTotals, logs) {
  const candidates = [];

  // Category: Transportation
  if (categoryTotals.transportation > 0 || detectedCategory === 'transportation') {
    const gasCarCount = logs.filter(l => l.activity === 'gasoline_car').length;
    if (gasCarCount > 2) {
      candidates.push({
        recommendation: 'Use public transport twice a week',
        reason: `You logged travel via gasoline car ${gasCarCount} times. Swapping a couple of commutes to bus/train decreases fuel usage.`,
        estimatedReduction: 18.0,
        confidence: 87,
        easeScore: 4,
        category: 'transportation'
      });
    } else {
      candidates.push({
        recommendation: 'Use public transport or carpooling',
        reason: `Swapping solo commutes for bus, train, or carpooling with colleagues significantly decreases travel carbon footprint.`,
        estimatedReduction: 15.0,
        confidence: 85,
        easeScore: 4,
        category: 'transportation'
      });
    }
    candidates.push({
      recommendation: 'Walk or bike for short trips under 3km',
      reason: 'Short driving journeys are highly carbon intensive; walking and cycling are zero-emission alternatives.',
      estimatedReduction: 8.0,
      confidence: 92,
      easeScore: 5,
      category: 'transportation'
    });
  }

  // Category: Food
  if (categoryTotals.food > 0 || detectedCategory === 'food') {
    const beefCount = logs.filter(l => l.activity === 'beef_meal').length;
    if (beefCount > 2) {
      candidates.push({
        recommendation: 'Replace beef meals with poultry or vegetarian alternatives',
        reason: `You consumed beef ${beefCount} times. Beef is resource-intensive; swapping it cuts your food footprint by half.`,
        estimatedReduction: 24.0,
        confidence: 83,
        easeScore: 4,
        category: 'food'
      });
    } else {
      candidates.push({
        recommendation: 'Reduce beef and use plant-based alternatives',
        reason: `Incorporating plant-based meals like tofu, lentils, or meat alternatives reduces emissions compared to beef or pork.`,
        estimatedReduction: 18.0,
        confidence: 85,
        easeScore: 4,
        category: 'food'
      });
    }
    candidates.push({
      recommendation: 'Try a Plant-based Monday',
      reason: `Food is a carbon factor. Eating vegetarian once a week decreases global land use emissions.`,
      estimatedReduction: 12.0,
      confidence: 88,
      easeScore: 5,
      category: 'food'
    });
  }

  // Category: Electricity
  if (categoryTotals.electricity > 0 || detectedCategory === 'electricity') {
    candidates.push({
      recommendation: 'Adjust thermostat by 1 degree',
      reason: `Electricity usage is recorded. Small temperature trims save significant HVAC electricity over a month.`,
      estimatedReduction: 15.0,
      confidence: 85,
      easeScore: 4,
      category: 'electricity'
    });
  }

  // Default general recommendations to ensure we always have >= 3 candidates
  candidates.push({
    recommendation: 'Unplug idle standby electronics',
    reason: 'Household appliances consume vampire loads when left plugged in but idle.',
    estimatedReduction: 5.0,
    confidence: 95,
    easeScore: 5,
    category: 'electricity'
  });

  candidates.push({
    recommendation: 'Walk or bike for short trips under 3km',
    reason: 'Short driving journeys are highly carbon intensive because car catalytic converters take time to warm up.',
    estimatedReduction: 8.0,
    confidence: 92,
    easeScore: 4,
    category: 'transportation'
  });

  return candidates;
}

/**
 * Prioritizes fallback recommendations and sorts them.
 * @param {Array<object>} candidates - Unsorted list of candidates.
 * @param {string|null} detectedCategory - Category matched keyword.
 * @returns {Array<object>} Top 3 prioritized recommendations.
 */
function processFallbackRecommendations(candidates, detectedCategory) {
  const prioritizedRecs = candidates.map(c => {
    let basePriority = c.estimatedReduction * c.easeScore;
    if (detectedCategory && c.category === detectedCategory) {
      basePriority += 1000.0;
    }
    return {
      recommendation: c.recommendation,
      reason: c.reason,
      estimatedReduction: c.estimatedReduction,
      confidence: c.confidence,
      easeScore: c.easeScore,
      priority: Number(basePriority.toFixed(1))
    };
  });

  prioritizedRecs.sort((a, b) => b.priority - a.priority);

  const cleanRecs = prioritizedRecs.map(r => {
    let cleanPriority = r.priority;
    if (cleanPriority >= 1000.0) {
      cleanPriority -= 1000.0;
    }
    return {
      recommendation: r.recommendation,
      reason: r.reason,
      estimatedReduction: r.estimatedReduction,
      confidence: r.confidence,
      easeScore: r.easeScore,
      priority: cleanPriority
    };
  });

  return cleanRecs.slice(0, 3);
}

/**
 * Synthesizes advice paragraphs based on matched categories.
 * @param {object} user - User record.
 * @param {string|null} detectedCategory - Keyword matched category.
 * @returns {string} Compiled advice string.
 */
function getAdviceText(user, detectedCategory) {
  let adviceText = `Hello ${user.name}! Based on your data over the last 30 days, I have analyzed your carbon logs and prioritized the top 3 most effective actions for you below.`;
  if (detectedCategory === 'transportation') {
    adviceText = `Hello Eco Challenger! I detected you are asking about transportation. Based on your travel habits, here are specific recommendations to lower your transport emissions:
- **Public transport**: Swapping solo driving for public transport (buses, trains) reduces carbon emissions dramatically.
- **Cycling**: Choose cycling or bicycle commutes to eliminate emissions for short-to-medium trips.
- **Walking**: Walk for short trips under 3km to eliminate emissions completely.
- **Carpooling**: Share rides with others (carpooling) to split the emission load per traveler.`;
  } else if (detectedCategory === 'food') {
    adviceText = `Hello Eco Challenger! I noticed you are asking about food or meals. Here are the top ways to optimize your diet's carbon footprint based on your logged meals:
- **Beef reduction**: Avoid or limit beef meals, which carry the highest carbon footprint.
- **Vegetarian meals**: Swapping meat for vegetarian meals like beans or lentils reduces dietary footprint.
- **Plant-based alternatives**: Switch to plant-based alternatives or soy products to lower carbon intensity.`;
  } else if (detectedCategory === 'electricity') {
    adviceText = `Hello ${user.name}! Regarding your query about energy or electricity: here are custom tips to minimize household power consumption based on your logged electricity usage:`;
  }
  return adviceText;
}

/**
 * Aggregates user stats based on user and log profiles.
 * @param {object} user - User record.
 * @param {Array<object>} logs - Activity logs.
 * @returns {object} Aggregated stats.
 */
function aggregateStats(user, logs) {
  return {
    user_name: user.name,
    daily_baseline: user.baseline_emissions,
    total_emissions_30d: logs.reduce((sum, log) => sum + log.co2_emissions, 0),
    days_logged: new Set(logs.map(log => log.activity_date)).size,
    category_totals: logs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + log.co2_emissions;
      return acc;
    }, { transportation: 0, electricity: 0, food: 0 }),
    recent_logs: logs.slice(0, 10)
  };
}

/**
 * Formats a recommendation candidate from Gemini API.
 * @param {object} r - Raw recommendation candidate.
 * @returns {object} Processed recommendation.
 */
function mapRecommendation(r) {
  const est = Number(r.estimatedReduction) || 0;
  const ease = Number(r.easeScore) || 3;
  return {
    recommendation: r.recommendation,
    reason: r.reason,
    estimatedReduction: est,
    confidence: Number(r.confidence) || 80,
    easeScore: ease,
    priority: Number((est * ease).toFixed(1))
  };
}

/**
 * Safely extracts raw text from Gemini API response candidates.
 * @param {object} data - API response JSON object.
 * @returns {string} Extracted text or empty string.
 */
function extractRawText(data) {
  try {
    return data.candidates[0].content.parts[0].text;
  } catch (_err) {
    return '';
  }
}

/**
 * Call Gemini API using fetch.
 * @param {string} apiKey - API key for Gemini.
 * @param {object} stats - Aggregated statistics.
 * @param {string} question - Question query.
 * @returns {Promise<object|null>} Structured AI response or null.
 */
async function callGemini(apiKey, stats, question) {
  try {
    const systemPrompt = `You are Verda, an advanced, encouraging, and friendly AI Sustainability Coach.
Your goal is to help users track, understand, and reduce their carbon footprint.
Be encouraging, concise, actionable, and focus directly on the data provided.

User Details and last 30 days Carbon footprint data:
${JSON.stringify(stats, null, 2)}

User Question: "${question}"

You MUST return a raw JSON object and nothing else. Do NOT wrap it in markdown code blocks or code fences.
The JSON structure must match this schema exactly:
{
  "advice": "General coaching advice text answering the user's question.",
  "recommendations": [
    {
      "recommendation": "Title of recommendation (e.g. Use public transport twice a week)",
      "reason": "Specific reason based on user stats details",
      "estimatedReduction": number, // estimated monthly reduction in kg CO2 as a number
      "confidence": number, // confidence percentage as a number between 0 and 100
      "easeScore": number // ease of implementation score from 1 (hardest) to 5 (easiest)
    }
  ]
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }]
        })
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    let rawText = extractRawText(data);
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(rawText);
    
    if (!parsed.advice || !Array.isArray(parsed.recommendations)) {
      return null;
    }

    const processedRecs = parsed.recommendations.map(mapRecommendation);

    processedRecs.sort((a, b) => b.priority - a.priority);

    return {
      advice: parsed.advice,
      recommendations: processedRecs.slice(0, 3),
      context_summary: {
        total_emissions_30d: Number(stats.total_emissions_30d.toFixed(1)),
        active_days: stats.days_logged
      },
      mode: 'AI'
    };
  } catch (_geminiError) {
    return null;
  }
}

/**
 * Detect question category based on keywords.
 * @param {string} question - Question query.
 * @returns {string|null} Detected category.
 */
function detectQuestionCategory(question) {
  const qLower = question.toLowerCase();
  if (/\b(transport|car|cars|bus|train|drive|driving|travel|fly|flight|commute)\b/i.test(qLower)) {
    return 'transportation';
  }
  if (/\b(food|meat|beef|pork|poultry|vegetarian|vegan|meal|meals|eat|eating|diet)\b/i.test(qLower)) {
    return 'food';
  }
  if (/\b(electricity|power|energy|home|thermostat|grid|utility|vampire|electronics)\b/i.test(qLower)) {
    return 'electricity';
  }
  return null;
}

/**
 * Processes a question posed to the AI Coach.
 * @param {number} user_id - User identifier.
 * @param {string} question - Question query.
 * @returns {Promise<CoachAdviceResponse>} Structured coach advice.
 */
async function askCoach(user_id, question) {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - (DAYS_IN_30D_WINDOW - 1));

    const startDateStr = formatLocalDate(thirtyDaysAgo);
    const endDateStr = formatLocalDate(today);

    const [user, logs] = await Promise.all([
      userRepository.findById(user_id),
      logRepository.findByUserId(user_id, startDateStr, endDateStr)
    ]);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const stats = aggregateStats(user, logs);
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey.trim() !== '') {
      const aiResult = await callGemini(apiKey, stats, question);
      if (aiResult) {
        return aiResult;
      }
    }

    // Rules-Based Fallback Engine
    const detectedCategory = detectQuestionCategory(question);
    const candidates = getRulesBasedCandidates(detectedCategory, stats.category_totals, logs);
    const top3 = processFallbackRecommendations(candidates, detectedCategory);
    const adviceText = getAdviceText(user, detectedCategory);

    return {
      advice: adviceText,
      recommendations: top3,
      context_summary: {
        total_emissions_30d: Number(stats.total_emissions_30d.toFixed(1)),
        active_days: stats.days_logged
      },
      mode: 'Expert Rules System (API Key not configured)'
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to process AI Coach advice', 500);
  }
}

module.exports = {
  askCoach
};
