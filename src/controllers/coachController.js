const { getDb } = require('../db');

/**
 * AI Coach endpoint. Fetches the last 30 days of activity logs, builds a JSON context,
 * constructs a prompt, and calls the Google Gemini API (falling back to a rules-based engine).
 * Returns structured, explainable, and prioritized recommendations.
 */
async function askCoach(req, res) {
  try {
    const { question } = req.body;
    const user_id = parseInt(req.body.user_id, 10) || 1;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'Please provide a valid question for the AI coach.' });
    }

    const db = await getDb();

    // 1. Fetch user baseline info
    const user = await db.get('SELECT name, baseline_emissions FROM users WHERE id = ?', [user_id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2. Fetch last 30 days of logs
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
    const endDateStr = formatLocalDate(today);

    const logs = await db.all(`
      SELECT category, activity, value, co2_emissions, activity_date
      FROM logs
      WHERE user_id = ? AND activity_date >= ? AND activity_date <= ?
      ORDER BY activity_date DESC
    `, [user_id, startDateStr, endDateStr]);

    // 3. Aggregate statistics for context
    const stats = {
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

    const apiKey = process.env.GEMINI_API_KEY;

    // 4. Call Gemini API or fallback
    if (apiKey && apiKey.trim() !== '') {
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

        if (response.ok) {
          const data = await response.json();
          let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          // Clean up markdown wrapper if returned by mistake
          rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

          const parsed = JSON.parse(rawText);
          
          if (parsed.advice && Array.isArray(parsed.recommendations)) {
            // Compute priorities, sort, and return top 3
            const processedRecs = parsed.recommendations.map(r => {
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
            });

            processedRecs.sort((a, b) => b.priority - a.priority);

            return res.json({
              advice: parsed.advice,
              recommendations: processedRecs.slice(0, 3),
              context_summary: {
                total_emissions_30d: Number(stats.total_emissions_30d.toFixed(1)),
                active_days: stats.days_logged
              },
              mode: 'AI'
            });
          }
        }
      } catch (geminiError) {
        console.warn('Gemini API call failed or parse failed, falling back to Rules Engine:', geminiError.message);
      }
    }

    // Rules-Based Fallback Engine
    const candidates = [];

    // Category: Transportation
    if (stats.category_totals.transportation > 0) {
      const gasCarCount = logs.filter(l => l.activity === 'gasoline_car').length;
      if (gasCarCount > 2) {
        candidates.push({
          recommendation: 'Use public transport twice a week',
          reason: `You logged travel via gasoline car ${gasCarCount} times. Swapping a couple of commutes to bus/train decreases fuel usage.`,
          estimatedReduction: 18.0,
          confidence: 87,
          easeScore: 4
        });
      } else {
        candidates.push({
          recommendation: 'Consolidate travel routes',
          reason: `Transportation contributes to your carbon footprint. Grouping errands reduces cold engine phase emissions.`,
          estimatedReduction: 10.0,
          confidence: 90,
          easeScore: 5
        });
      }
    }

    // Category: Food
    if (stats.category_totals.food > 0) {
      const beefCount = logs.filter(l => l.activity === 'beef_meal').length;
      if (beefCount > 2) {
        candidates.push({
          recommendation: 'Replace beef meals with poultry or vegetarian alternatives',
          reason: `You consumed beef ${beefCount} times. Beef is resource-intensive; swapping it cuts your food footprint by half.`,
          estimatedReduction: 24.0,
          confidence: 83,
          easeScore: 4
        });
      } else {
        candidates.push({
          recommendation: 'Try a Plant-based Monday',
          reason: `Food is a carbon factor. Eating vegetarian once a week decreases global land use emissions.`,
          estimatedReduction: 12.0,
          confidence: 88,
          easeScore: 5
        });
      }
    }

    // Category: Electricity
    if (stats.category_totals.electricity > 0) {
      candidates.push({
        recommendation: 'Adjust thermostat by 1 degree',
        reason: `Electricity usage is recorded. Small temperature trims save significant HVAC electricity over a month.`,
        estimatedReduction: 15.0,
        confidence: 85,
        easeScore: 4
      });
    }

    // Default general recommendations to ensure we always have >= 3 candidates
    candidates.push({
      recommendation: 'Unplug idle standby electronics',
      reason: 'Household appliances consume vampire loads when left plugged in but idle.',
      estimatedReduction: 5.0,
      confidence: 95,
      easeScore: 5
    });

    candidates.push({
      recommendation: 'Walk or bike for short trips under 3km',
      reason: 'Short driving journeys are highly carbon intensive because car catalytic converters take time to warm up.',
      estimatedReduction: 8.0,
      confidence: 92,
      easeScore: 4
    });

    // Compute priority = estimatedReduction * easeScore
    const prioritizedRecs = candidates.map(c => {
      return {
        ...c,
        priority: Number((c.estimatedReduction * c.easeScore).toFixed(1))
      };
    });

    // Sort descending by priority
    prioritizedRecs.sort((a, b) => b.priority - a.priority);

    // Pick top 3
    const top3 = prioritizedRecs.slice(0, 3);

    // Generate fallback text intro
    const adviceText = `Hello ${user.name}! Based on your data over the last 30 days, I have analyzed your carbon logs and prioritized the top 3 most effective actions for you below.`;

    return res.json({
      advice: adviceText,
      recommendations: top3,
      context_summary: {
        total_emissions_30d: Number(stats.total_emissions_30d.toFixed(1)),
        active_days: stats.days_logged
      },
      mode: 'Expert Rules System (API Key not configured)'
    });

  } catch (error) {
    console.error('Error in coach route:', error);
    return res.status(500).json({ error: 'Failed to process AI Coach advice' });
  }
}

module.exports = {
  askCoach
};
