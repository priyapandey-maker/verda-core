const request = require('supertest');
const app = require('../src/server');
const { initDb, closeDb } = require('../src/db');

describe('Verda REST API Endpoints Integration Suite', () => {
  let db;

  beforeAll(async () => {
    // Set environment to test to prevent server network listener binding
    process.env.NODE_ENV = 'test';
    
    // Spin up DB in memory
    db = await initDb(':memory:');
    
    // Add default user with explicit id: 1
    await db.run('INSERT OR IGNORE INTO users (id, name, baseline_emissions) VALUES (1, "API Integration Tester", 15.0)');
  });

  afterAll(async () => {
    await closeDb();
  });

  test('POST /api/logs - successfully logs standard activity with valid payload', async () => {
    const res = await request(app)
      .post('/api/logs')
      .send({
        user_id: 1,
        activity_date: '2026-06-01',
        category: 'transportation',
        activity: 'gasoline_car',
        value: 100.0
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('success');
    expect(res.body.log).toBeDefined();
    expect(res.body.log.co2_emissions).toBe(18.0);
    expect(res.body.log.activity_date).toBe('2026-06-01');
  });

  test('POST /api/logs - triggers validation 400 error for invalid values', async () => {
    const res = await request(app)
      .post('/api/logs')
      .send({
        user_id: 1,
        activity_date: '2026-06-01',
        category: 'transportation',
        activity: 'gasoline_car',
        value: -15.0
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Value must be a positive number');
  });

  test('POST /api/logs - triggers validation 400 error for incorrect date format', async () => {
    const res = await request(app)
      .post('/api/logs')
      .send({
        user_id: 1,
        activity_date: '06-01-2026',
        category: 'food',
        activity: 'beef_meal',
        value: 1
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('activity_date');
  });

  test('GET /api/logs - returns user logs', async () => {
    const res = await request(app)
      .get('/api/logs?user_id=1');

    expect(res.status).toBe(200);
    expect(res.body.logs).toBeDefined();
    expect(res.body.logs.length).toBeGreaterThan(0);
  });

  test('GET /api/dashboard - calculates score and stats for user dashboard', async () => {
    const res = await request(app)
      .get('/api/dashboard?user_id=1');

    expect(res.status).toBe(200);
    expect(res.body.sustainability_score).toBeDefined();
    expect(res.body.category_breakdown).toBeDefined();
    expect(res.body.category_breakdown.transportation).toBe(18.0);
  });

  test('GET /api/habits - fetches detected habits list', async () => {
    const res = await request(app)
      .get('/api/habits?user_id=1');

    expect(res.status).toBe(200);
    expect(res.body.habits).toBeDefined();
  });

  test('GET /api/recommendations - yields suggestions list', async () => {
    const res = await request(app)
      .get('/api/recommendations?user_id=1');

    expect(res.status).toBe(200);
    expect(res.body.recommendations).toBeDefined();
    expect(res.body.recommendations.length).toBeGreaterThan(0);
  });

  test('GET /api/twin - fetches Carbon Twin trajectories', async () => {
    const res = await request(app)
      .get('/api/twin?user_id=1');

    expect(res.status).toBe(200);
    expect(res.body.current_trajectory_yearly).toBeDefined();
    expect(res.body.improved_trajectory_yearly).toBeDefined();
  });

  test('POST /api/coach - fetches sustainability advice with structured and prioritized recommendations', async () => {
    const res = await request(app)
      .post('/api/coach')
      .send({
        user_id: 1,
        question: 'How do I cut down my carbon footprint?'
      });

    expect(res.status).toBe(200);
    expect(res.body.advice).toBeDefined();
    expect(res.body.recommendations).toBeDefined();
    expect(res.body.recommendations.length).toBeGreaterThan(0);

    const rec = res.body.recommendations[0];
    expect(typeof rec.recommendation).toBe('string');
    expect(typeof rec.reason).toBe('string');
    expect(typeof rec.estimatedReduction).toBe('number');
    expect(typeof rec.confidence).toBe('number');
    expect(typeof rec.easeScore).toBe('number');
    expect(typeof rec.priority).toBe('number');

    // Confirm priority calculation: Priority = Reduction * Ease
    expect(rec.priority).toBe(Number((rec.estimatedReduction * rec.easeScore).toFixed(1)));

    // Confirm descending priority order sorting
    if (res.body.recommendations.length > 1) {
      expect(res.body.recommendations[0].priority).toBeGreaterThanOrEqual(res.body.recommendations[1].priority);
    }
  });
});
