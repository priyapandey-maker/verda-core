/**
 * Verda Application Orchestrator
 */

// Cache dashboard stats locally to enable sub-millisecond What-If simulator updates
let cachedDashboardStats = null;

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
});

/**
 * Refreshes dashboard data, recommendations, and logs list
 */
async function refreshDashboardData(userId = 1) {
  try {
    // 1. Fetch dashboard statistics and cache them
    const stats = await VerdaAPI.getDashboard(userId);
    cachedDashboardStats = stats;
    
    // Render dashboard widgets
    VerdaDOM.renderDashboard(stats);

    // Initial Twin projection calculations based on default slider states (0)
    updateSimulatorProjections();

    // 2. Fetch history logs list
    const logsData = await VerdaAPI.getLogs(userId);
    VerdaDOM.renderLogsList(logsData.logs);

    // 3. Fetch prioritized recommendations list
    const recsData = await VerdaAPI.getRecommendations(userId);
    VerdaDOM.renderPrioritizedRecommendations(recsData.recommendations);

  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    VerdaDOM.showToast('Failed to sync metrics with server. Please refresh.', 'error');
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

  VerdaDOM.renderTwinAndSimulator(cachedDashboardStats, { transit, veg, electricity });
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
