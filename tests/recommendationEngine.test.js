const { initDb, closeDb } = require('../src/db');
const { getRecommendations, getCarbonTwin } = require('../src/controllers/recommendationController');

describe('Recommendation and Carbon Twin Engines', () => {
  let db;

  beforeAll(async () => {
    // Open isolated in-memory DB connection
    db = await initDb(':memory:');
    
    // Add mock user with default baseline 15 kg/day
    await db.run('INSERT OR IGNORE INTO users (id, name, baseline_emissions) VALUES (1, "Green Traveler", 15.0)');

    const today = new Date();
    const formatLocalDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // Insert 10 logs of high-impact driving over the last 30 days
    // 10 logs * 100 km * 0.18 = 180 kg CO2.
    // Total baseline for 30 days is 15 * 30 = 450 kg CO2.
    // Score should be high/medium, transportation is highest emission category.
    for (let i = 1; i <= 10; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      await db.run(`
        INSERT INTO logs (user_id, activity_date, category, activity, value, co2_emissions)
        VALUES (1, ?, 'transportation', 'gasoline_car', 100.0, 18.0)
      `, [formatLocalDate(d)]);
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  test('should generate transportation public transit recommendation based on driving habits', async () => {
    const req = { query: { user_id: 1 } };
    let jsonResponse = null;

    const res = {
      json: (data) => {
        jsonResponse = data;
        return res;
      },
      status: () => res
    };

    await getRecommendations(req, res);

    expect(jsonResponse).not.toBeNull();
    expect(jsonResponse.recommendations).toBeDefined();
    
    // Should have transit swap recommendation
    const transitRec = jsonResponse.recommendations.find(r => r.id === 'rec_transit_swap');
    expect(transitRec).toBeDefined();
    expect(transitRec.priority_score).toBe('High');
    expect(transitRec.category).toBe('transportation');
    expect(transitRec.estimated_co2_reduction).toBeGreaterThan(0);
  });

  test('should calculate valid Carbon Twin projections', async () => {
    const req = { query: { user_id: 1 } };
    let jsonResponse = null;

    const res = {
      json: (data) => {
        jsonResponse = data;
        return res;
      },
      status: () => res
    };

    await getCarbonTwin(req, res);

    expect(jsonResponse).not.toBeNull();
    expect(jsonResponse.current_trajectory_yearly).toBeDefined();
    expect(jsonResponse.improved_trajectory_yearly).toBeDefined();
    expect(jsonResponse.estimated_yearly_reduction).toBeDefined();
    
    // Trajectory maths check:
    // 180 kg CO2 / 30 = 6 kg CO2/day average.
    // Yearly current = 6 * 365 = 2190 kg.
    expect(jsonResponse.current_trajectory_yearly).toBe(2190.0);
    expect(jsonResponse.estimated_yearly_reduction).toBeGreaterThan(0);
    expect(jsonResponse.improved_trajectory_yearly).toBeLessThan(jsonResponse.current_trajectory_yearly);
  });
});
