const express = require('express');
const router = express.Router();

const { logActivity, getLogs, getDashboard } = require('../controllers/carbonController');
const { getHabits } = require('../controllers/habitController');
const { getRecommendations, getCarbonTwin } = require('../controllers/recommendationController');
const { askCoach } = require('../controllers/coachController');

// Activity Log Routes
router.post('/logs', logActivity);
router.get('/logs', getLogs);

// Sustainability Statistics Dashboard
router.get('/dashboard', getDashboard);

// Habit Detection Route
router.get('/habits', getHabits);

// Recommendation Engine Route
router.get('/recommendations', getRecommendations);

// Carbon Twin Projections Route
router.get('/twin', getCarbonTwin);

// AI Coach Route
router.post('/coach', askCoach);

module.exports = router;
