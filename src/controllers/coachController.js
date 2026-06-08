const { getDb } = require('../db');

/**
 * AI Coach endpoint. Fetches the last 30 days of activity logs, builds a JSON context,
 * constructs a prompt, and calls the Google Gemini API (falling back to a rules-based engine).
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
      recent_logs: logs.slice(0, 10) // Include up to 10 recent logs for detail
    };

    // 4. Construct Prompt
    const systemPrompt = `You are Verda, an advanced, encouraging, and friendly AI Sustainability Coach.
Your goal is to help users track, understand, and reduce their carbon footprint.
Be encouraging, concise, actionable, and focus directly on the data provided.

User Details and last 30 days Carbon footprint data:
${JSON.stringify(stats, null, 2)}

User Question: "${question}"

Please provide a structured response, utilizing bullet points for actions. Refrain from generalities; use their specific data metrics where possible.`;

    const apiKey = process.env.GEMINI_API_KEY;

    // 5. Call Gemini API or fallback
    if (apiKey && apiKey.trim() !== '') {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: systemPrompt }]
                }
              ]
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Gemini API returned status ${response.status}`);
        }

        const data = await response.json();
        const advice = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (advice) {
          return res.json({
            advice,
            context_summary: {
              total_emissions_30d: stats.total_emissions_30d,
              active_days: stats.days_logged
            },
            mode: 'AI'
          });
        }
      } catch (geminiError) {
        console.warn('Gemini API call failed, falling back to Rules Engine:', geminiError.message);
      }
    }

    // Rules-Based Fallback Engine
    const adviceParts = [];
    adviceParts.push(`Hello ${user.name}! I am your Verda Coach. Here is your personalized carbon footprint analysis based on the past 30 days:`);
    adviceParts.push(`\n**Your Current Profile:**`);
    adviceParts.push(`- Total recorded emissions: **${stats.total_emissions_30d.toFixed(1)} kg CO₂** over the last 30 days.`);
    adviceParts.push(`- You actively tracked activities on **${stats.days_logged} out of 30 days**.`);

    const highestCat = Object.entries(stats.category_totals).sort((a, b) => b[1] - a[1])[0];
    if (highestCat && highestCat[1] > 0) {
      adviceParts.push(`- Your highest carbon category is **${highestCat[0]}** contributing **${highestCat[1].toFixed(1)} kg CO₂**.`);
    }

    adviceParts.push(`\n**Actionable Suggestions to Answer: "${question}":**`);
    if (highestCat[0] === 'transportation') {
      adviceParts.push(`- **Reduce Commute Footprint**: Since transportation is your main source of emissions, try replacing driving trips with cycling, walking, or bus/train transit where possible.`);
      adviceParts.push(`- **Plan Combined Routes**: Save fuel and distance by grouping tasks into a single journey.`);
    } else if (highestCat[0] === 'food') {
      adviceParts.push(`- **Opt for Plant-Based Substitutes**: Food is your largest source. Try swapping beef meals with chicken or plant-based meals to immediately cut CO₂ emissions.`);
      adviceParts.push(`- **Minimize Food Waste**: Buy food locally and avoid wastage to lower lifecycle carbon impacts.`);
    } else if (highestCat[0] === 'electricity') {
      adviceParts.push(`- **Eco-Efficiency at Home**: Try raising/lowering your thermostat slightly, turning off devices completely rather than leaving them on standby, and using energy-saving appliances.`);
    } else {
      adviceParts.push(`- **Log More Habits**: Keep tracking daily activities so I can give you more specific feedback!`);
      adviceParts.push(`- **Unplug vampire electronics** to trim down base electricity consumption.`);
    }

    return res.json({
      advice: adviceParts.join('\n'),
      context_summary: {
        total_emissions_30d: stats.total_emissions_30d,
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
