/**
 * Verda Application Orchestrator
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize form interaction panels and default date
  VerdaDOM.setupFormInteractions();

  // Load initial dashboard metrics and history log lists
  refreshDashboardData();

  // Bind activity logging form submission
  const form = VerdaDOM.$('#activity-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
});

/**
 * Refreshes dashboard data and logs list by querying REST APIs
 */
async function refreshDashboardData(userId = 1) {
  try {
    // 1. Fetch dashboard statistics
    const dashData = await VerdaAPI.getDashboard(userId);
    VerdaDOM.renderDashboard(dashData);

    // 2. Fetch history logs
    const logsData = await VerdaAPI.getLogs(userId);
    VerdaDOM.renderLogsList(logsData.logs);

  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    VerdaDOM.showToast('Failed to sync metrics with server. Please refresh.', 'error');
  }
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

  // Gather specific inputs based on category
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

  // Client-side Input Validation
  if (!dateValue) {
    VerdaDOM.showToast('Please select a valid date.', 'warning');
    return;
  }
  if (isNaN(value) || value <= 0) {
    VerdaDOM.showToast('Please enter a positive numeric value.', 'warning');
    return;
  }

  try {
    // Disable submit button during request
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging...';
    }

    const payload = {
      user_id: 1, // Single-user MVP default
      activity_date: dateValue,
      category: activeCategory,
      activity,
      value
    };

    const result = await VerdaAPI.logActivity(payload);

    // Reset input fields
    resetInputs();

    // Show success notification
    VerdaDOM.showToast('Activity logged successfully!', 'success');

    // Refresh dashboard stats and logs list
    await refreshDashboardData(1);

  } catch (error) {
    VerdaDOM.showToast(error.message || 'Failed to log activity. Try again.', 'error');
  } finally {
    // Re-enable submit button
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log Activity';
    }
  }
}

/**
 * Resets numeric input fields on form success
 */
function resetInputs() {
  const distance = VerdaDOM.$('#input-distance');
  const kwh = VerdaDOM.$('#input-kwh');
  const meals = VerdaDOM.$('#input-meals');

  if (distance) distance.value = '';
  if (kwh) kwh.value = '';
  if (meals) meals.value = '';
}
