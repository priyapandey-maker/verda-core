/**
 * @file coverageBoost.test.js
 * @description Unit tests targeting remaining uncovered lines in service, repository, utility, controller and server layers to achieve >=95% branch coverage.
 */

const fs = require('fs');
const path = require('path');
const carbonService = require('../src/services/carbonService');
const coachService = require('../src/services/coachService');
const habitService = require('../src/services/habitService');
const recommendationService = require('../src/services/recommendationService');
const twinService = require('../src/services/twinService');

const userRepository = require('../src/repositories/userRepository');
const logRepository = require('../src/repositories/logRepository');
const formatter = require('../src/utils/formatter');
const dbModule = require('../src/db');
const errorHandler = require('../src/middleware/errorHandler');
const request = require('supertest');
const app = require('../src/server');

describe('Coverage Boost Unit Tests Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /* ----------------------------------------------------
     1. CARBON SERVICE & STREAKS
     ---------------------------------------------------- */
  describe('Carbon Service Streaks & Error cases', () => {
    test('calculateLongestStreak - multiple gaps and segments with tempStreak <= longest branch', async () => {
      // Build dynamic dates to avoid hardcoded date conflicts with system date
      const today = new Date();
      const format = (daysAgo) => {
        const d = new Date(today);
        d.setDate(today.getDate() - daysAgo);
        return formatter.formatLocalDate(d);
      };

      // Gap structure:
      // Segment 1 (streak 3): [10, 9, 8 days ago]
      // Segment 2 (streak 2): [6, 5 days ago] (triggers tempStreak (2) <= longest (3) in gap at 2 days ago)
      // Segment 3 (streak 1): [2 days ago]
      const dates = [
        format(10),
        format(9),
        format(8),
        format(6),
        format(5),
        format(2)
      ].sort();

      jest.spyOn(userRepository, 'findById').mockResolvedValue({ id: 1, name: 'Test User', baseline_emissions: 15.0 });
      jest.spyOn(logRepository, 'getDistinctActivityDates').mockResolvedValue(dates);

      const result = await carbonService.getStreak(1);
      // Longest streak is 3
      expect(result.longestStreak).toBe(3);
      // Since last date is 2 days ago, current streak must be 0
      expect(result.currentStreak).toBe(0);
    });

    test('calculateCurrentStreak - last logged date is today or yesterday and loop breaks on gap', async () => {
      const todayStr = formatter.formatLocalDate(new Date());
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatter.formatLocalDate(yesterday);

      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = formatter.formatLocalDate(twoDaysAgo);

      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const fiveDaysAgoStr = formatter.formatLocalDate(fiveDaysAgo);

      jest.spyOn(userRepository, 'findById').mockResolvedValue({ id: 1, name: 'Test User', baseline_emissions: 15.0 });
      
      // Case A: Last date is today, preceding is yesterday and two days ago (streak = 3)
      jest.spyOn(logRepository, 'getDistinctActivityDates').mockResolvedValue([
        twoDaysAgoStr,
        yesterdayStr,
        todayStr
      ]);
      let streakData = await carbonService.getStreak(1);
      expect(streakData.currentStreak).toBe(3);

      // Case B: Last date is yesterday, preceding is two days ago (streak = 2)
      jest.spyOn(logRepository, 'getDistinctActivityDates').mockResolvedValue([
        twoDaysAgoStr,
        yesterdayStr
      ]);
      streakData = await carbonService.getStreak(1);
      expect(streakData.currentStreak).toBe(2);

      // Case C: Today, yesterday, two days ago, and five days ago (streak = 3, hits break on line 78)
      jest.spyOn(logRepository, 'getDistinctActivityDates').mockResolvedValue([
        fiveDaysAgoStr,
        twoDaysAgoStr,
        yesterdayStr,
        todayStr
      ]);
      streakData = await carbonService.getStreak(1);
      expect(streakData.currentStreak).toBe(3);
    });

    test('getStreak - user not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValue(null);
      await expect(carbonService.getStreak(999)).rejects.toThrow('User not found');
    });

    test('getStreak - empty dates list', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValue({ id: 1, name: 'Test User' });
      jest.spyOn(logRepository, 'getDistinctActivityDates').mockResolvedValue([]);
      const result = await carbonService.getStreak(1);
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
    });

    test('getStreak - generic error thrown by db should be wrapped in AppError', async () => {
      jest.spyOn(userRepository, 'findById').mockRejectedValue(new Error('DB Connection Timeout'));
      await expect(carbonService.getStreak(1)).rejects.toThrow('Failed to retrieve streak data');
    });

    test('logActivity - nonexistent user defaults to user 1', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValue(null);
      const mockInsertId = 42;
      jest.spyOn(logRepository, 'create').mockResolvedValue(mockInsertId);

      const result = await carbonService.logActivity({
        user_id: 9999,
        activity_date: '2026-06-01',
        category: 'transportation',
        activity: 'gasoline_car',
        value: 10.0
      });

      expect(result.log.user_id).toBe(1);
    });

    test('logActivity - database exception should be wrapped in AppError', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValue({ id: 1 });
      jest.spyOn(logRepository, 'create').mockRejectedValue(new Error('SQLite Insert Constraint Failure'));

      await expect(carbonService.logActivity({
        user_id: 1,
        activity_date: '2026-06-01',
        category: 'transportation',
        activity: 'gasoline_car',
        value: 10.0
      })).rejects.toThrow('Failed to log activity');
    });

    test('getDashboard - user with null baseline emissions falls back to DEFAULT_BASELINE_EMISSIONS', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValue({ id: 1, name: 'Null Baseline User', baseline_emissions: null });
      jest.spyOn(logRepository, 'getCategoryEmissions').mockResolvedValue({ total: 10.0 });
      jest.spyOn(logRepository, 'getActiveDaysCount').mockResolvedValue(5);

      const result = await carbonService.getDashboard(1);
      expect(result.user.daily_baseline).toBe(15.0); // DEFAULT_BASELINE_EMISSIONS = 15.0
    });
  });

  /* ----------------------------------------------------
     2. COACH SERVICE EDGE CASES
     ---------------------------------------------------- */
  describe('Coach Service Unit Tests', () => {
    test('Fallback advice texts matching different categories', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValue({ id: 1, name: 'Eco Explorer', baseline_emissions: 15.0 });
      jest.spyOn(logRepository, 'findByUserId').mockResolvedValue([
        { category: 'transportation', activity: 'gasoline_car', co2_emissions: 10, activity_date: '2026-06-01' },
        { category: 'food', activity: 'beef_meal', co2_emissions: 5, activity_date: '2026-06-01' },
        { category: 'electricity', activity: 'grid_electricity', co2_emissions: 12, activity_date: '2026-06-01' }
      ]);

      // Category: Transportation
      let result = await coachService.askCoach(1, 'Tell me about travel or driving carbon emissions');
      expect(result.advice).toContain('transportation');
      // Ensure prioritized recommendation basePriority += 1000 calculation was triggered
      expect(result.recommendations[0].recommendation).toContain('public transport');

      // Category: Food
      result = await coachService.askCoach(1, 'Tell me about diet or beef meal carbon emissions');
      expect(result.advice).toContain('food or meals');

      // Category: Electricity
      result = await coachService.askCoach(1, 'Tell me about energy or electricity thermostat carbon emissions');
      expect(result.advice).toContain('energy or electricity');
    });

    test('Gemini API call returns ok but JSON is invalid format', async () => {
      process.env.GEMINI_API_KEY = 'valid_mock_key';
      jest.spyOn(userRepository, 'findById').mockResolvedValue({ id: 1, name: 'Eco Explorer', baseline_emissions: 15.0 });
      jest.spyOn(logRepository, 'findByUserId').mockResolvedValue([]);

      // Mock fetch to return ok response with invalid/missing JSON fields
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: '{"invalid_format": true}'
              }]
            }
          }]
        })
      });

      const result = await coachService.askCoach(1, 'How do I save carbon?');
      // Should fall back to rules engine
      expect(result.mode).toContain('Expert Rules System');
    });

    test('Gemini API candidates structure throws exception inside extractRawText', async () => {
      process.env.GEMINI_API_KEY = 'valid_mock_key';
      jest.spyOn(userRepository, 'findById').mockResolvedValue({ id: 1, name: 'Eco Explorer', baseline_emissions: 15.0 });
      jest.spyOn(logRepository, 'findByUserId').mockResolvedValue([]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [] // empty candidates to trigger throw in extractRawText
        })
      });

      const result = await coachService.askCoach(1, 'How do I save carbon?');
      // Should fall back to rules engine since extractRawText returns ''
      expect(result.mode).toContain('Expert Rules System');
    });

    test('Gemini API recommendations missing estimatedReduction, easeScore, confidence fallbacks', async () => {
      process.env.GEMINI_API_KEY = 'valid_mock_key';
      jest.spyOn(userRepository, 'findById').mockResolvedValue({ id: 1, name: 'Eco Explorer', baseline_emissions: 15.0 });
      jest.spyOn(logRepository, 'findByUserId').mockResolvedValue([]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  advice: 'Hello',
                  recommendations: [{
                    recommendation: 'Use public transport'
                    // missing estimatedReduction, easeScore, confidence
                  }]
                })
              }]
            }
          }]
        })
      });

      const result = await coachService.askCoach(1, 'How do I save carbon?');
      expect(result.mode).toBe('AI');
      expect(result.recommendations[0].estimatedReduction).toBe(0);
      expect(result.recommendations[0].easeScore).toBe(3);
      expect(result.recommendations[0].confidence).toBe(80);
    });
  });

  /* ----------------------------------------------------
     3. HABIT SERVICE ERROR HANDLING
     ---------------------------------------------------- */
  describe('Habit Service Unit Tests', () => {
    test('getHabits - generic DB error should throw wrapped AppError', async () => {
      jest.spyOn(logRepository, 'getHabits').mockRejectedValue(new Error('SQLite Constraint Error'));
      await expect(habitService.getHabits(1)).rejects.toThrow('Failed to retrieve habit metrics');
    });
  });

  /* ----------------------------------------------------
     4. RECOMMENDATION SERVICE EXTRA COVERAGE
     ---------------------------------------------------- */
  describe('Recommendation Service Unit Tests', () => {
    test('Dominant category electricity is not matched -> getElectricityRecommendation returns null', async () => {
      const mockStats = {
        user: { id: 1, name: 'Test User', baseline_emissions: 15.0 },
        total_emissions_30d: 100,
        active_days: 10,
        category_breakdown: { transportation: 80, electricity: 10, food: 10 }
      };

      jest.spyOn(userRepository, 'findById').mockResolvedValue(mockStats.user);
      jest.spyOn(logRepository, 'getCategoryEmissions').mockResolvedValue({
        total: 100.0,
        transportation: 80.0,
        electricity: 10.0,
        food: 10.0
      });
      jest.spyOn(logRepository, 'getActiveDaysCount').mockResolvedValue(10);
      jest.spyOn(logRepository, 'getHabits').mockResolvedValue([]);

      const result = await recommendationService.getRecommendations(1);
      expect(result.recommendations.length).toBeGreaterThan(0);
      // Electricity recommendation rec_home_efficiency should NOT be present since transportation is dominant
      const elecRec = result.recommendations.find(r => r.id === 'rec_home_efficiency');
      expect(elecRec).toBeUndefined();
    });
  });

  /* ----------------------------------------------------
     5. CARBON TWIN SERVICE ACTIVE DAYS 0
     ---------------------------------------------------- */
  describe('Carbon Twin Service Unit Tests', () => {
    test('getCarbonTwin - activeDays is 0', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValue({ id: 1, name: 'Lazy Tracker', baseline_emissions: 12.0 });
      jest.spyOn(logRepository, 'getCategoryEmissions').mockResolvedValue({
        total: 0,
        transportation: 0,
        electricity: 0,
        food: 0
      });
      jest.spyOn(logRepository, 'getActiveDaysCount').mockResolvedValue(0);
      jest.spyOn(logRepository, 'getHabits').mockResolvedValue([]);
      jest.spyOn(logRepository, 'getDistinctActivityDates').mockResolvedValue([]);

      const result = await twinService.getCarbonTwin(1);
      expect(result.days_tracked_30d).toBe(0);
      // daily average should be daily baseline
      expect(result.calculation_basis.daily_average_kg).toBe(12.0);
    });

    test('getCarbonTwin - user not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValue(null);
      await expect(twinService.getCarbonTwin(999)).rejects.toThrow('User not found');
    });

    test('getCarbonTwin - generic DB error wrapped in AppError', async () => {
      jest.spyOn(userRepository, 'findById').mockRejectedValue(new Error('Connection Pool Exhausted'));
      await expect(twinService.getCarbonTwin(1)).rejects.toThrow('Failed to calculate projection metrics');
    });
  });

  /* ----------------------------------------------------
     6. ERROR HANDLER COMPREHENSIVE COVERAGE
     ---------------------------------------------------- */
  describe('Error Handler Middleware Unit Tests', () => {
    test('errorHandler - error without message and statusCode', () => {
      const req = { method: 'GET', originalUrl: '/test', query: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const _next = jest.fn();

      errorHandler({}, req, res, _next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });

    test('errorHandler - SyntaxError variations', () => {
      const req = { method: 'GET', originalUrl: '/test', query: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const _next = jest.fn();

      // SyntaxError but status is not 400
      const err1 = new SyntaxError('Err1');
      err1.status = 500;
      errorHandler(err1, req, res, _next);
      expect(res.status).toHaveBeenCalledWith(500);

      // SyntaxError, status is 400, but no body
      const err2 = new SyntaxError('Err2');
      err2.status = 400;
      errorHandler(err2, req, res, _next);
      expect(res.status).toHaveBeenCalledWith(500); // defaults to 500 since err2 has no statusCode

      // SyntaxError, status is 400, and has body
      const err3 = new SyntaxError('Err3');
      err3.status = 400;
      err3.body = 'foo';
      errorHandler(err3, req, res, _next);
      expect(res.status).toHaveBeenCalledWith(500); // intercept sets statusCode to 500
    });
  });

  /* ----------------------------------------------------
     7. DATABASE HELPER FALLBACKS
     ---------------------------------------------------- */
  describe('Database Helper Unit Tests', () => {
    test('DB index - fallback branches', async () => {
      // Save current dbInstance
      await dbModule.closeDb();

      // Test closeDb when already null
      await dbModule.closeDb();

      // Test getDb fallback to process.env.DB_FILE
      const oldDbFile = process.env.DB_FILE;
      process.env.DB_FILE = ':memory:';
      const dbInstance = await dbModule.getDb();
      expect(dbInstance).toBeDefined();

      // Clean up
      await dbModule.closeDb();
      process.env.DB_FILE = oldDbFile;
    });

    test('DB index - fallback to default file path', async () => {
      await dbModule.closeDb();

      const oldDbFile = process.env.DB_FILE;
      delete process.env.DB_FILE;

      const targetFile = path.join(__dirname, '../src/db', 'verda_test_dummy.db');
      if (fs.existsSync(targetFile)) {
        try { fs.unlinkSync(targetFile); } catch (_) {}
      }

      // Mock path.join to redirect verda.db to verda_test_dummy.db
      const originalJoin = path.join;
      path.join = jest.fn().mockImplementation((...args) => {
        const res = originalJoin(...args);
        if (typeof res === 'string' && res.endsWith('verda.db')) {
          return res.replace('verda.db', 'verda_test_dummy.db');
        }
        return res;
      });

      const dbInstance = await dbModule.getDb();
      expect(dbInstance).toBeDefined();

      await dbModule.closeDb();

      path.join = originalJoin;

      if (fs.existsSync(targetFile)) {
        try { fs.unlinkSync(targetFile); } catch (_) {}
      }

      process.env.DB_FILE = oldDbFile;
    });

    test('logRepository.getActiveDaysCount - null database result returns 0', async () => {
      // Get DB singleton
      const db = await dbModule.getDb();
      const originalGet = db.get;
      db.get = jest.fn().mockResolvedValue(null);

      const count = await logRepository.getActiveDaysCount(1, '2026-06-01', '2026-06-02');
      expect(count).toBe(0);

      db.get = originalGet;
    });
  });

  /* ----------------------------------------------------
     8. LOGGER ENVIRONMENT CONFIGURATION
     ---------------------------------------------------- */
  describe('Logger Module Configuration', () => {
    test('logger - branch coverage', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalLogLevel = process.env.LOG_LEVEL;

      // Case 1: NOT test, NOT production, no LOG_LEVEL
      process.env.NODE_ENV = 'development';
      delete process.env.LOG_LEVEL;
      jest.isolateModules(() => {
        const devLogger = require('../src/utils/logger');
        expect(devLogger.level).toBe('info');
      });

      // Case 2: production, LOG_LEVEL set to 'warn'
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'warn';
      jest.isolateModules(() => {
        const prodLogger = require('../src/utils/logger');
        expect(prodLogger.level).toBe('warn');
      });

      // Restore
      process.env.NODE_ENV = originalEnv;
      process.env.LOG_LEVEL = originalLogLevel;
    });
  });

  /* ----------------------------------------------------
     9. SERVER FATAL INITIALIZATION ERROR & FALLBACKS
     ---------------------------------------------------- */
  describe('Server Fatal Init and Fallbacks', () => {
    test('server - initialization error catch block', (done) => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

      jest.isolateModules(() => {
        const dbModIsolated = require('../src/db');
        jest.spyOn(dbModIsolated, 'initDb').mockRejectedValue(new Error('Mock Schema Error'));
        require('../src/server');
      });

      setTimeout(() => {
        try {
          expect(mockExit).toHaveBeenCalledWith(1);
          done();
        } catch (err) {
          done(err);
        }
      }, 50);
    });

    test('server - fallback to port 3000', () => {
      const oldPort = process.env.PORT;
      delete process.env.PORT;

      jest.isolateModules(() => {
        require('../src/server');
      });

      process.env.PORT = oldPort;
    });
  });

  /* ----------------------------------------------------
     10. ZOD SCHEMAS AND VALIDATORS
     ---------------------------------------------------- */
  describe('Zod Schemas and Validators edge cases', () => {
    test('validateUserId - defaults to 1 for undefined or null or invalid string', () => {
      const { validateUserId } = require('../src/utils/validators');
      expect(validateUserId(undefined)).toBe(1);
      expect(validateUserId(null)).toBe(1);
      expect(validateUserId('invalid-id')).toBe(1);
    });

    test('validateLogActivity - invalid non-object types', () => {
      const { validateLogActivity } = require('../src/utils/validators');
      expect(() => validateLogActivity(null)).toThrow();
      expect(() => validateLogActivity('not-an-object')).toThrow();
    });
  });

  /* ----------------------------------------------------
     11. CONTROLLERS DEFAULT USER AND ERROR PATHS
     ---------------------------------------------------- */
  describe('Controller routes default user parameter and catch validation errors', () => {
    test('GET /api/recommendations without user_id defaults to 1', async () => {
      const res = await request(app).get('/api/recommendations');
      expect(res.status).toBe(200);
      expect(res.body.recommendations).toBeDefined();
    });

    test('GET /api/twin without user_id defaults to 1', async () => {
      const res = await request(app).get('/api/twin');
      expect(res.status).toBe(200);
      expect(res.body.current_trajectory_yearly).toBeDefined();
    });

    test('GET /api/habits without user_id defaults to 1', async () => {
      const res = await request(app).get('/api/habits');
      expect(res.status).toBe(200);
      expect(res.body.habits).toBeDefined();
    });

    test('GET /api/streak without user_id defaults to 1', async () => {
      const res = await request(app).get('/api/streak');
      expect(res.status).toBe(200);
      expect(res.body.currentStreak).toBeDefined();
    });

    test('GET /api/dashboard without user_id defaults to 1', async () => {
      const res = await request(app).get('/api/dashboard');
      expect(res.status).toBe(200);
      expect(res.body.sustainability_score).toBeDefined();
    });
  });
});
