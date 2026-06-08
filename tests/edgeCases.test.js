const request = require('supertest');
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = require('../src/server');
const dbModule = require('../src/db');
const { initDb, closeDb, getDb } = dbModule;

describe('Verda Edge Cases and Error Handler Coverage Suite', () => {
  let db;
  const originalFetch = global.fetch;

  const seedDatabase = async (database) => {
    // Create baseline user 1 (Mixed Logs)
    await database.run('INSERT OR IGNORE INTO users (id, name, baseline_emissions) VALUES (1, "API integration Tester", 15.0)');
    
    // Create zero emissions user 2 with negative baseline to cover non-positive baseline path
    await database.run('INSERT OR IGNORE INTO users (id, name, baseline_emissions) VALUES (2, "Zero Emission User", -1.0)');

    // Create user 10 for custom category habit description mapping fallback
    await database.run('INSERT OR IGNORE INTO users (id, name, baseline_emissions) VALUES (10, "Custom Category User", 15.0)');

    // Create user 3 (Dominant Electricity)
    await database.run('INSERT OR IGNORE INTO users (id, name, baseline_emissions) VALUES (3, "Power Consumer", 15.0)');

    // Create user 4 (Dominant Food / beef lover with frequent beef meals)
    await database.run('INSERT OR IGNORE INTO users (id, name, baseline_emissions) VALUES (4, "Steak Lover", 15.0)');

    // Create user 5 (Transportation dominant, but no frequent habit to test General Transit rec)
    await database.run('INSERT OR IGNORE INTO users (id, name, baseline_emissions) VALUES (5, "Occasional Traveler", 15.0)');

    // Create user 6 (Food dominant, but no frequent beef habit to test Plant-based Monday rec)
    await database.run('INSERT OR IGNORE INTO users (id, name, baseline_emissions) VALUES (6, "Occasional Diner", 15.0)');

    // Create user 7 (Extremely high emissions to test score < 60 Carbon Fast rec)
    await database.run('INSERT OR IGNORE INTO users (id, name, baseline_emissions) VALUES (7, "High Carbon User", 10.0)');

    // Create user 8 (High frequency car driver for gasoline_car > 2)
    await database.run('INSERT OR IGNORE INTO users (id, name, baseline_emissions) VALUES (8, "High Frequency Driver", 15.0)');

    // Create user 9 (Empty Data User)
    await database.run('INSERT OR IGNORE INTO users (id, name, baseline_emissions) VALUES (9, "Empty Data User", 15.0)');

    const todayStr = '2026-06-01';

    // Logs for User 1
    await database.run(`INSERT INTO logs (user_id, activity_date, category, activity, value, co2_emissions)
                  VALUES (1, ?, 'transportation', 'gasoline_car', 10.0, 1.8)`, [todayStr]);
    await database.run(`INSERT INTO logs (user_id, activity_date, category, activity, value, co2_emissions)
                  VALUES (1, ?, 'food', 'beef_meal', 1.0, 6.0)`, [todayStr]);
    await database.run(`INSERT INTO logs (user_id, activity_date, category, activity, value, co2_emissions)
                  VALUES (1, ?, 'electricity', 'grid_electricity', 10.0, 4.5)`, [todayStr]);

    // Logs for User 3 (Electricity dominant)
    for (let i = 0; i < 4; i++) {
      await database.run(`INSERT INTO logs (user_id, activity_date, category, activity, value, co2_emissions)
                    VALUES (3, ?, 'electricity', 'grid_electricity', 125.0, 56.25)`, [`2026-06-0${i+1}`]);
    }

    // Logs for User 4 (Food dominant + Beef Lover)
    for (let i = 0; i < 4; i++) {
      await database.run(`INSERT INTO logs (user_id, activity_date, category, activity, value, co2_emissions)
                    VALUES (4, ?, 'food', 'beef_meal', 1.0, 6.0)`, [`2026-06-0${i+1}`]);
    }

    // Logs for User 5 (Transportation dominant, no frequent car driving count)
    await database.run(`INSERT INTO logs (user_id, activity_date, category, activity, value, co2_emissions)
                  VALUES (5, ?, 'transportation', 'gasoline_car', 5.0, 0.9)`, [todayStr]);

    // Logs for User 6 (Food dominant, no frequent beef meals count)
    await database.run(`INSERT INTO logs (user_id, activity_date, category, activity, value, co2_emissions)
                  VALUES (6, ?, 'food', 'beef_meal', 1.0, 6.0)`, [todayStr]);

    // Logs for User 7 (Extremely high emissions, score will fall below 60)
    await database.run(`INSERT INTO logs (user_id, activity_date, category, activity, value, co2_emissions)
                  VALUES (7, ?, 'transportation', 'gasoline_car', 3000.0, 540.0)`, [todayStr]);

    // Logs for User 8 (High frequency car driver, gasoline_car >= 3)
    for (let i = 0; i < 4; i++) {
      await database.run(`INSERT INTO logs (user_id, activity_date, category, activity, value, co2_emissions)
                    VALUES (8, ?, 'transportation', 'gasoline_car', 10.0, 1.8)`, [`2026-06-0${i+1}`]);
    }

    // Logs for User 10 (to trigger implicit final else branch in habit mapping)
    for (let i = 0; i < 4; i++) {
      await database.run(`INSERT INTO logs (user_id, activity_date, category, activity, value, co2_emissions)
                    VALUES (10, ?, 'other_category', 'some_activity', 10.0, 5.0)`, [`2026-06-0${i+1}`]);
    }
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    db = await initDb(':memory:');
    await seedDatabase(db);
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await closeDb();
  });

  beforeEach(() => {
    global.fetch = jest.fn();
    process.env.GEMINI_API_KEY = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /* ----------------------------------------------------
     1. SERVER.JS TESTS (404, Error Handler, Listen)
     ---------------------------------------------------- */
  test('GET /api/nonexistent - should return 404 status', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });

  test('POST /api/logs - should trigger global error handler on malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/logs')
      .set('Content-Type', 'application/json')
      .send('{"category": "transportation",');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
  });

  test('should verify startup callback trigger when NODE_ENV is production and port is dynamic', (done) => {
    const originalEnv = process.env.NODE_ENV;
    const originalPort = process.env.PORT;
    
    process.env.NODE_ENV = 'production';
    process.env.PORT = '0'; 

    jest.isolateModules(() => {
      const dbMod = require('../src/db');
      const spyInit = jest.spyOn(dbMod, 'initDb').mockResolvedValue({});

      const expressMod = require('express');
      const spyListen = jest.spyOn(expressMod.application, 'listen').mockImplementation(function (port, callback) {
        if (callback) callback();
        return { close: (cb) => cb && cb() };
      });

      const serverInst = require('../src/server');

      setTimeout(() => {
        try {
          expect(spyListen).toHaveBeenCalled();
          spyInit.mockRestore();
          spyListen.mockRestore();
          process.env.NODE_ENV = originalEnv;
          process.env.PORT = originalPort;
          done();
        } catch (err) {
          process.env.NODE_ENV = originalEnv;
          process.env.PORT = originalPort;
          done(err);
        }
      }, 100);
    });
  });

  /* ----------------------------------------------------
     2. DB DIRECTORY CREATION COVERAGE
     ---------------------------------------------------- */
  test('should create directory if DB folder does not exist', async () => {
    // Force reset the database singleton cache
    await closeDb();

    const tempPath = path.join(__dirname, 'temp_test_db', 'verda_temp.db');
    const tempDir = path.dirname(tempPath);

    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);

    const testDb = await getDb(tempPath);
    const existsAfter = fs.existsSync(tempDir);

    expect(existsAfter).toBe(true);

    // Reset the singleton correctly (this closes testDb too since it is dbInstance)
    await closeDb();

    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);

    // Re-initialize standard memory db for subsequent tests
    db = await initDb(':memory:');
    await seedDatabase(db);
  });

  /* ----------------------------------------------------
     3. CARBONCONTROLLER.JS EDGE CASES & DB FAILURES
     ---------------------------------------------------- */
  test('POST /api/logs - invalid activity (missing from category list)', async () => {
    const res = await request(app)
      .post('/api/logs')
      .send({
        user_id: 1,
        activity_date: '2026-06-01',
        category: 'food',
        activity: '',
        value: 10
      });
    expect(res.status).toBe(400);
  });

  test('POST /api/logs - invalid value type (missing value)', async () => {
    const res = await request(app)
      .post('/api/logs')
      .send({
        user_id: 1,
        activity_date: '2026-06-01',
        category: 'food',
        activity: 'beef_meal'
      });
    expect(res.status).toBe(400);
  });

  test('GET /api/logs - valid individual start and end date parameters', async () => {
    await request(app).get('/api/logs?user_id=1&start_date=2026-06-01');
    await request(app).get('/api/logs?user_id=1&end_date=2026-06-05');
  });

  test('GET /api/dashboard - user not found', async () => {
    const res = await request(app).get('/api/dashboard?user_id=999');
    expect(res.status).toBe(404);
  });

  test('GET /api/dashboard - division by zero handling', async () => {
    const res = await request(app).get('/api/dashboard?user_id=2');
    expect(res.status).toBe(200);
    expect(res.body.sustainability_score).toBeDefined();
  });

  test('POST /api/logs - DB exception error catch handling', async () => {
    const originalRun = db.run;
    db.run = jest.fn().mockRejectedValue(new Error('Mock insertion fail'));

    const res = await request(app)
      .post('/api/logs')
      .send({
        user_id: 1,
        activity_date: '2026-06-01',
        category: 'food',
        activity: 'beef_meal',
        value: 1
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to log activity');
    db.run = originalRun;
  });

  test('GET /api/logs - DB query error catch handling', async () => {
    const originalAll = db.all;
    db.all = jest.fn().mockRejectedValue(new Error('Mock query fail'));

    const res = await request(app).get('/api/logs?user_id=1');
    expect(res.status).toBe(500);
    db.all = originalAll;
  });

  test('GET /api/dashboard - DB query error catch handling', async () => {
    const originalGet = db.get;
    db.get = jest.fn().mockRejectedValue(new Error('Mock get fail'));

    const res = await request(app).get('/api/dashboard?user_id=1');
    expect(res.status).toBe(500);
    db.get = originalGet;
  });

  /* ----------------------------------------------------
     4. COACHCONTROLLER.JS TESTS (Gemini Mock, Fallbacks, DB error)
     ---------------------------------------------------- */
  test('POST /api/coach - missing question', async () => {
    const res = await request(app).post('/api/coach').send({ user_id: 1 });
    expect(res.status).toBe(400);
  });

  test('POST /api/coach - question too long (exceeds 500 characters)', async () => {
    const longQuestion = 'a'.repeat(501);
    const res = await request(app)
      .post('/api/coach')
      .send({ user_id: 1, question: longQuestion });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('too long');
  });

  test('POST /api/coach - user not found', async () => {
    const res = await request(app).post('/api/coach').send({ user_id: 999, question: 'Question' });
    expect(res.status).toBe(404);
  });

  test('POST /api/coach - database fetch error catch handling', async () => {
    const originalGet = db.get;
    db.get = jest.fn().mockRejectedValue(new Error('Mock get fail'));

    const res = await request(app)
      .post('/api/coach')
      .send({ user_id: 1, question: 'Hello coach' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to process AI Coach advice');
    db.get = originalGet;
  });

  test('POST /api/coach - active Rules engine matches multiple categories', async () => {
    const res = await request(app)
      .post('/api/coach')
      .send({ user_id: 1, question: 'How can I save carbon?' });

    expect(res.status).toBe(200);
    expect(res.body.mode).toContain('Expert Rules System');
    expect(res.body.recommendations.length).toBeGreaterThan(0);
  });

  test('POST /api/coach - rules engine with zero logs user fallback', async () => {
    const res = await request(app)
      .post('/api/coach')
      .send({ user_id: 2, question: 'How can I save carbon?' });

    expect(res.status).toBe(200);
    expect(res.body.mode).toContain('Expert Rules System');
  });

  test('POST /api/coach - mock Gemini fetch failing fallback to rules engine', async () => {
    process.env.GEMINI_API_KEY = 'mock_key';
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500
    });

    const res = await request(app)
      .post('/api/coach')
      .send({ user_id: 1, question: 'How can I save carbon?' });

    expect(res.status).toBe(200);
    expect(res.body.mode).toContain('Expert Rules System');
  });

  test('POST /api/coach - mock Gemini invalid JSON payload parse exception', async () => {
    process.env.GEMINI_API_KEY = 'mock_key';
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: 'invalid_raw_text' }]
          }
        }]
      })
    });

    const res = await request(app)
      .post('/api/coach')
      .send({ user_id: 1, question: 'How can I save carbon?' });

    expect(res.status).toBe(200);
    expect(res.body.mode).toContain('Expert Rules System');
  });

  test('POST /api/coach - mock Gemini success structured response parsing', async () => {
    process.env.GEMINI_API_KEY = 'mock_key';
    
    const mockAdvice = {
      advice: "AI Coach custom advice.",
      recommendations: [
        {
          recommendation: "Test suggestion",
          reason: "Reason text",
          estimatedReduction: 12.0,
          confidence: 88,
          easeScore: 4
        }
      ]
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify(mockAdvice) }]
          }
        }]
      })
    });

    const res = await request(app)
      .post('/api/coach')
      .send({ user_id: 1, question: 'Hello coach' });

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('AI');
    expect(res.body.recommendations[0].priority).toBe(48.0);
  });

  /* ----------------------------------------------------
     5. RECOMMENDATIONCONTROLLER.JS & HABITCONTROLLER.JS
     ---------------------------------------------------- */
  test('GET /api/recommendations - user not found', async () => {
    const res = await request(app).get('/api/recommendations?user_id=999');
    expect(res.status).toBe(200);
    expect(res.body.recommendations.length).toBe(0);
  });

  test('GET /api/recommendations - triggers Food dominant recommendations (User 4 - beef lover)', async () => {
    const res = await request(app).get('/api/recommendations?user_id=4');
    expect(res.status).toBe(200);
    expect(res.body.recommendations.length).toBeGreaterThan(0);

    const beefRec = res.body.recommendations.find(r => r.id === 'rec_beef_swap');
    expect(beefRec).toBeDefined();
  });

  test('GET /api/recommendations - triggers Food dominant (User 6 - occasional diner)', async () => {
    const res = await request(app).get('/api/recommendations?user_id=6');
    expect(res.status).toBe(200);
    
    const plantRec = res.body.recommendations.find(r => r.id === 'rec_plant_day');
    expect(plantRec).toBeDefined();
  });

  test('GET /api/recommendations - triggers Transportation dominant (User 5 - occasional traveler)', async () => {
    const res = await request(app).get('/api/recommendations?user_id=5');
    expect(res.status).toBe(200);

    const transitRec = res.body.recommendations.find(r => r.id === 'rec_general_transit');
    expect(transitRec).toBeDefined();
  });

  test('GET /api/recommendations - triggers Electricity dominant recommendations (User 3)', async () => {
    const res = await request(app).get('/api/recommendations?user_id=3');
    expect(res.status).toBe(200);
    expect(res.body.recommendations.length).toBeGreaterThan(0);

    const electricityRec = res.body.recommendations.find(r => r.id === 'rec_home_efficiency');
    expect(electricityRec).toBeDefined();
  });

  test('GET /api/recommendations - triggers Low score sustainability fast (User 7)', async () => {
    const res = await request(app).get('/api/recommendations?user_id=7');
    expect(res.status).toBe(200);

    const fastRec = res.body.recommendations.find(r => r.id === 'rec_sustainability_boost');
    expect(fastRec).toBeDefined();
  });

  test('GET /api/twin - user not found', async () => {
    const res = await request(app).get('/api/twin?user_id=999');
    expect(res.status).toBe(404);
  });

  test('GET /api/recommendations - database fetch error catch handling', async () => {
    const originalGet = db.get;
    db.get = jest.fn().mockRejectedValue(new Error('Mock query error'));

    const res = await request(app).get('/api/recommendations?user_id=1');
    expect(res.status).toBe(500);
    db.get = originalGet;
  });

  test('GET /api/twin - database fetch error catch handling', async () => {
    const originalGet = db.get;
    db.get = jest.fn().mockRejectedValue(new Error('Mock query error'));

    const res = await request(app).get('/api/twin?user_id=1');
    expect(res.status).toBe(500);
    db.get = originalGet;
  });

  test('GET /api/habits - database fetch error catch handling', async () => {
    const originalAll = db.all;
    db.all = jest.fn().mockRejectedValue(new Error('Mock query error'));

    const res = await request(app).get('/api/habits?user_id=1');
    expect(res.status).toBe(500);
    db.all = originalAll;
  });

  /* ----------------------------------------------------
     6. EXTRA VALUATION & EDGE CASES FOR COVERAGE TARGETS
     ---------------------------------------------------- */
  test('POST /api/logs - invalid category should return 400', async () => {
    const res = await request(app)
      .post('/api/logs')
      .send({
        user_id: 1,
        activity_date: '2026-06-01',
        category: 'invalid_category',
        activity: 'gasoline_car',
        value: 10
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('category');
  });

  test('POST /api/coach - invalid user_id (NaN/string) should default to 1', async () => {
    const res = await request(app)
      .post('/api/coach')
      .send({ user_id: 'abc', question: 'How can I save carbon?' });
    expect(res.status).toBe(200);
    expect(res.body.mode).toContain('Expert Rules System');
  });

  test('POST /api/coach - invalid user_id (negative) should return 404', async () => {
    const res = await request(app)
      .post('/api/coach')
      .send({ user_id: -5, question: 'How can I save carbon?' });
    expect(res.status).toBe(404);
  });

  test('GET /api/recommendations - empty data (user with no logs)', async () => {
    const res = await request(app).get('/api/recommendations?user_id=9');
    expect(res.status).toBe(200);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
    const communityRec = res.body.recommendations.find(r => r.id === 'rec_sustainability_maintain');
    expect(communityRec).toBeDefined();
  });

  test('GET /api/recommendations - zero-emission user', async () => {
    const res = await request(app).get('/api/recommendations?user_id=2');
    expect(res.status).toBe(200);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
  });

  test('GET /api/recommendations - invalid user_id parameter should default to 1', async () => {
    const res = await request(app).get('/api/recommendations?user_id=abc');
    expect(res.status).toBe(200);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
  });

  test('GET /api/twin - invalid user_id parameter should default to 1', async () => {
    const res = await request(app).get('/api/twin?user_id=abc');
    expect(res.status).toBe(200);
  });

  test('GET /api/habits - invalid user_id parameter should default to 1', async () => {
    const res = await request(app).get('/api/habits?user_id=abc');
    expect(res.status).toBe(200);
  });

  test('POST /api/coach - user 8 dominant category high frequency car logs rules-engine triggers swap recommendation', async () => {
    const res = await request(app)
      .post('/api/coach')
      .send({ user_id: 8, question: 'How can I save carbon?' });

    expect(res.status).toBe(200);
    expect(res.body.mode).toContain('Expert Rules System');
    const transitRec = res.body.recommendations.find(r => r.recommendation === 'Use public transport twice a week');
    expect(transitRec).toBeDefined();
  });

  test('POST /api/coach - mock Gemini API network error fallback to rules engine', async () => {
    process.env.GEMINI_API_KEY = 'mock_key';
    global.fetch.mockRejectedValue(new Error('Network connection timeout'));

    const res = await request(app)
      .post('/api/coach')
      .send({ user_id: 1, question: 'How can I save carbon?' });

    expect(res.status).toBe(200);
    expect(res.body.mode).toContain('Expert Rules System');
  });

  test('GET /api/habits - food habit description mapping', async () => {
    const res = await request(app).get('/api/habits?user_id=4');
    expect(res.status).toBe(200);
    expect(res.body.habits.length).toBeGreaterThan(0);
    const foodHabit = res.body.habits.find(h => h.category === 'food');
    expect(foodHabit.description).toContain('consumed beef meal');
  });

  test('GET /api/habits - electricity habit description mapping', async () => {
    const res = await request(app).get('/api/habits?user_id=3');
    expect(res.status).toBe(200);
    expect(res.body.habits.length).toBeGreaterThan(0);
    const elecHabit = res.body.habits.find(h => h.category === 'electricity');
    expect(elecHabit.description).toContain('electricity usage');
  });

  test('GET /api/habits - other category habit description mapping fallback', async () => {
    const res = await request(app).get('/api/habits?user_id=10');
    expect(res.status).toBe(200);
    expect(res.body.habits.length).toBeGreaterThan(0);
    const otherHabit = res.body.habits.find(h => h.category === 'other_category');
    expect(otherHabit.description).toBe('');
  });

  test('POST /api/coach - rules engine with beef lover triggers beef reduction advice', async () => {
    const res = await request(app)
      .post('/api/coach')
      .send({ user_id: 4, question: 'How can I save carbon?' });

    expect(res.status).toBe(200);
    expect(res.body.mode).toContain('Expert Rules System');
    const beefRec = res.body.recommendations.find(r => r.recommendation.toLowerCase().includes('replace beef'));
    expect(beefRec).toBeDefined();
  });
});
