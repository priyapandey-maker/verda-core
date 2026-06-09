/**
 * Verda Application Orchestrator
 */

// Cache dashboard stats locally to enable sub-millisecond What-If simulator updates
let cachedDashboardStats = null;
let cachedLogs = null;
let cachedStreak = null;
let cachedRecommendations = null;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize form interaction panels and default date
  VerdaDOM.setupFormInteractions();

  // Load initial dashboard metrics, recommendations, and log lists
  refreshDashboardData();

  // Bind activity logging form submission
  const form = VerdaDOM.$('#activity-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  // Bind input listeners to What-If Simulator range inputs
  const sliders = document.querySelectorAll('.sim-slider');
  sliders.forEach(slider => {
    slider.addEventListener('input', updateSimulatorProjections);
  });

  // Bind target goal input action
  const btnSetGoal = VerdaDOM.$('#btn-set-goal');
  if (btnSetGoal) {
    btnSetGoal.addEventListener('click', updateSimulatorProjections);
  }
  const inputTargetGoal = VerdaDOM.$('#input-target-goal');
  if (inputTargetGoal) {
    inputTargetGoal.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        updateSimulatorProjections();
      }
    });
  }

  // Bind AI Coach chat widget submit
  const coachForm = VerdaDOM.$('#coach-chat-form');
  if (coachForm) {
    coachForm.addEventListener('submit', handleCoachSubmit);
  }

  // Enter to send / Shift+Enter for newline key handler on the chat textarea
  const chatInput = VerdaDOM.$('#input-coach-question');
  if (chatInput && coachForm) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // Trigger submit
        const submitEvent = new Event('submit', { cancelable: true });
        coachForm.dispatchEvent(submitEvent);
      }
    });
  }

  // Bind Generate PDF Report button action
  const btnReport = VerdaDOM.$('#btn-generate-report');
  if (btnReport) {
    btnReport.addEventListener('click', async () => {
      if (cachedDashboardStats && cachedStreak) {
        const transit = parseInt(VerdaDOM.$('#sim-transit').value, 10) || 0;
        const veg = parseInt(VerdaDOM.$('#sim-veg').value, 10) || 0;
        const electricity = parseInt(VerdaDOM.$('#sim-electricity').value, 10) || 0;
        
        btnReport.disabled = true;
        btnReport.innerHTML = 'Generating Climate Passport...';
        
        try {
          await VerdaDOM.generateClimatePassportPDF(
            cachedDashboardStats,
            cachedLogs || [],
            cachedStreak,
            { transit, veg, electricity },
            cachedRecommendations || []
          );
        } catch (error) {
          console.error('Failed to generate Climate Passport:', error);
          VerdaDOM.showToast('Failed to generate Climate Passport. Please try again.', 'error');
        } finally {
          btnReport.disabled = false;
          btnReport.innerHTML = '<span>📄</span> Climate Passport';
        }
      } else {
        VerdaDOM.showToast('Please wait for the dashboard to finish loading data.', 'warning');
      }
    });
  }
});

/**
 * Refreshes dashboard data, recommendations, and logs list in parallel
 */
async function refreshDashboardData(userId = 1) {
  try {
    // Parallelize network requests to prevent waterfall delays
    const [stats, logsData, recsData, streakData] = await Promise.all([
      VerdaAPI.getDashboard(userId),
      VerdaAPI.getLogs(userId),
      VerdaAPI.getRecommendations(userId),
      VerdaAPI.getStreak ? VerdaAPI.getStreak(userId).catch(() => ({ currentStreak: 0, longestStreak: 0 })) : { currentStreak: 0, longestStreak: 0 }
    ]);

    cachedDashboardStats = stats;
    cachedLogs = logsData.logs;
    cachedStreak = streakData;
    cachedRecommendations = recsData.recommendations;

    // Cache dynamic constants returned from stats payload in VerdaDOM.constants
    if (stats && stats.constants) {
      VerdaDOM.constants = stats.constants;
    }
    
    // Render dashboard widgets
    VerdaDOM.renderDashboard(stats);

    // Render Streak Widget
    VerdaDOM.renderStreak(streakData);

    // Initial Twin projection calculations based on default slider states (0)
    updateSimulatorProjections();

    // Render history logs list
    VerdaDOM.renderLogsList(logsData.logs);

    // Render Personalized Insights
    VerdaDOM.renderPersonalizedInsights(stats, logsData.logs);

    // Render prioritized recommendations list
    VerdaDOM.renderPrioritizedRecommendations(recsData.recommendations);

  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    VerdaDOM.showToast('Failed to sync metrics with server. Please refresh.', 'error');
  }
}

/**
 * AI Coach chat widget submit handler
 */
async function handleCoachSubmit(event) {
  event.preventDefault();

  const input = VerdaDOM.$('#input-coach-question');
  if (!input) return;

  const question = input.value.trim();
  if (!question) return;

  // Impose strict character limit on question
  if (question.length > 500) {
    VerdaDOM.showToast('Question is too long. Please keep it under 500 characters.', 'warning');
    return;
  }

  // Render user bubble
  VerdaDOM.renderCoachMessage('user', question);
  input.value = '';

  // Show typing bouncing indicator
  VerdaDOM.toggleCoachLoading(true);

  try {
    const response = await VerdaAPI.askCoach(question, 1);
    
    // Hide typing indicator
    VerdaDOM.toggleCoachLoading(false);

    // Format the response text with recommendations listed
    let botMessage = response.advice;
    if (response.recommendations && response.recommendations.length > 0) {
      response.recommendations.forEach((rec) => {
        botMessage += `\n\n👉 Recommendation: ${rec.recommendation}\nReason: ${rec.reason}\nMonthly Savings: ${rec.estimatedReduction} kg CO₂ (Confidence: ${rec.confidence}%)`;
      });
    }

    // Render bot advice and recommendations
    VerdaDOM.renderCoachMessage('bot', botMessage);

  } catch (error) {
    VerdaDOM.toggleCoachLoading(false);
    VerdaDOM.renderCoachMessage('bot', error.message || 'Failed to get a response from the AI coach.');
  }
}

/**
 * Triggers re-calculation in What-If Simulator using sliders values
 */
function updateSimulatorProjections() {
  if (!cachedDashboardStats) return;

  const transit = parseInt(VerdaDOM.$('#sim-transit').value, 10) || 0;
  const veg = parseInt(VerdaDOM.$('#sim-veg').value, 10) || 0;
  const electricity = parseInt(VerdaDOM.$('#sim-electricity').value, 10) || 0;

  const totalYearlySavings = VerdaDOM.renderTwinAndSimulator(cachedDashboardStats, { transit, veg, electricity });

  // Update Net Zero Progress Tracker
  VerdaDOM.renderNetZeroProgress(cachedDashboardStats, totalYearlySavings);

  // Check achievements after simulator changes
  const simulatorUsed = (transit > 0 || veg > 0 || electricity > 0);
  const score = cachedDashboardStats.sustainability_score || 0;
  VerdaDOM.checkAndUnlockAchievements(cachedDashboardStats, cachedLogs || [], score, totalYearlySavings, simulatorUsed);
}

/**
 * Form Submission Event Handler
 */
async function handleFormSubmit(event) {
  event.preventDefault();

  const submitBtn = VerdaDOM.$('#btn-submit-log');
  const activeCategory = VerdaDOM.$('input[name="category"]:checked').value;
  const dateValue = VerdaDOM.$('#input-date').value;

  let activity = '';
  let value = 0;

  if (activeCategory === 'transportation') {
    activity = VerdaDOM.$('#select-transport').value;
    const distanceInput = VerdaDOM.$('#input-distance');
    value = parseFloat(distanceInput.value);
  } else if (activeCategory === 'electricity') {
    activity = 'grid_electricity';
    const kwhInput = VerdaDOM.$('#input-kwh');
    value = parseFloat(kwhInput.value);
  } else if (activeCategory === 'food') {
    activity = VerdaDOM.$('#select-food').value;
    const mealsInput = VerdaDOM.$('#input-meals');
    value = parseInt(mealsInput.value, 10);
  }

  if (!dateValue) {
    VerdaDOM.showToast('Please select a valid date.', 'warning');
    return;
  }
  if (isNaN(value) || value <= 0) {
    VerdaDOM.showToast('Please enter a positive numeric value.', 'warning');
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging...';
    }

    const payload = {
      user_id: 1,
      activity_date: dateValue,
      category: activeCategory,
      activity,
      value
    };

    await VerdaAPI.logActivity(payload);

    resetInputs();
    VerdaDOM.showToast('Activity logged successfully!', 'success');

    // Refresh everything
    await refreshDashboardData(1);

  } catch (error) {
    VerdaDOM.showToast(error.message || 'Failed to log activity. Try again.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log Activity';
    }
  }
}

/**
 * Resets numeric inputs
 */
function resetInputs() {
  const distance = VerdaDOM.$('#input-distance');
  const kwh = VerdaDOM.$('#input-kwh');
  const meals = VerdaDOM.$('#input-meals');

  if (distance) distance.value = '';
  if (kwh) kwh.value = '';
  if (meals) meals.value = '';
}

if (typeof module !== 'undefined') {
  module.exports = {
    // Export variables so the test suite can manipulate them or read their states
    get_cachedDashboardStats: () => cachedDashboardStats,
    set_cachedDashboardStats: (val) => { cachedDashboardStats = val; },
    refreshDashboardData,
    updateSimulatorProjections,
    handleFormSubmit,
    resetInputs,
    handleCoachSubmit
  };
}
