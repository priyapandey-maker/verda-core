const { initDb, closeDb } = require('../src/db');
const { getHabits } = require('../src/controllers/habitController');

describe('Habit Detection SQLite Aggregation Engine', () => {
  let db;

  beforeAll(async () => {
    // Initialize standard mock db in memory
    db = await initDb(':memory:');

    // Create a mock user
    await db.run('INSERT OR IGNORE INTO users (id, name, baseline_emissions) VALUES (1, "Test User", 15.0)');

    const today = new Date();
    const formatLocalDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // Construct mock dates over the last few days
    const mockDates = [];
    for (let i = 1; i <= 6; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      mockDates.push(formatLocalDate(d));
    }

    // Insert 5 logs for gasoline_car (should be detected, frequency = 5 > 3)
    for (let i = 0; i < 5; i++) {
      await db.run(`
        INSERT INTO logs (user_id, activity_date, category, activity, value, co2_emissions)
        VALUES (1, ?, 'transportation', 'gasoline_car', 20.0, 3.6)
      `, [mockDates[i]]);
    }

    // Insert 2 logs for beef_meal (should NOT be detected, frequency = 2 <= 3)
    for (let i = 0; i < 2; i++) {
      await db.run(`
        INSERT INTO logs (user_id, activity_date, category, activity, value, co2_emissions)
        VALUES (1, ?, 'food', 'beef_meal', 1.0, 6.0)
      `, [mockDates[i]]);
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  test('should aggregate and identify gasoline_car as a frequent habit, and ignore beef_meal', async () => {
    const req = { query: { user_id: 1 } };
    let jsonResponse = null;

    const res = {
      json: (data) => {
        jsonResponse = data;
        return res;
      },
      status: (code) => {
        return res;
      }
    };

    await getHabits(req, res);

    expect(jsonResponse).not.toBeNull();
    expect(jsonResponse.user_id).toBe(1);
    expect(jsonResponse.habits).toBeDefined();
    
    // Check that gasoline_car is returned and has count = 5
    const gasCarHabit = jsonResponse.habits.find(h => h.activity === 'gasoline_car');
    expect(gasCarHabit).toBeDefined();
    expect(gasCarHabit.frequency).toBe(5);
    expect(gasCarHabit.category).toBe('transportation');

    // Check that beef_meal is not present because frequency is 2
    const beefHabit = jsonResponse.habits.find(h => h.activity === 'beef_meal');
    expect(beefHabit).toBeUndefined();
  });
});
