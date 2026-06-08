/**
 * Verda DOM Utilities and dynamic rendering engine
 */

// Dynamic emission constants loaded from backend. Fallbacks defined on VerdaDOM


const VerdaDOM = {
  // Select helper
  $(selector) {
    return document.querySelector(selector);
  },

  /**
   * Set up tab controls and default values for the activity form
   */
  setupFormInteractions() {
    const tabs = document.querySelectorAll('.tab-btn');
    const dateInput = this.$('#input-date');

    // Default dates to today YYYY-MM-DD
    if (dateInput) {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      dateInput.value = `${y}-${m}-${d}`;
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        const value = this.$(`#${tab.getAttribute('for')}`).value;
        this.switchTab(value);
      });

      tab.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          const radioId = tab.getAttribute('for');
          const radio = this.$(`#${radioId}`);
          radio.checked = true;
          this.switchTab(radio.value);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = (index + 1) % tabs.length;
          tabs[nextIndex].focus();
          const radioId = tabs[nextIndex].getAttribute('for');
          const radio = this.$(`#${radioId}`);
          radio.checked = true;
          this.switchTab(radio.value);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = (index - 1 + tabs.length) % tabs.length;
          tabs[prevIndex].focus();
          const radioId = tabs[prevIndex].getAttribute('for');
          const radio = this.$(`#${radioId}`);
          radio.checked = true;
          this.switchTab(radio.value);
        }
      });
    });
  },

  /**
   * Switch visible input panel based on selection
   */
  switchTab(category) {
    const tabs = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.form-panel');

    tabs.forEach(t => {
      const radioId = t.getAttribute('for');
      const radio = this.$(`#${radioId}`);
      if (radio.value === category) {
        radio.checked = true;
        t.setAttribute('aria-checked', 'true');
        t.setAttribute('tabindex', '0');
      } else {
        t.setAttribute('aria-checked', 'false');
        t.setAttribute('tabindex', '-1');
      }
    });

    panels.forEach(p => {
      if (p.id === `panel-${category}`) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });
  },

  /**
   * Updates all dashboard text fields, SVG circular progress meter, and bar charts
   */
  constants: {
    CAR_EMISSION_FACTOR: 0.18,
    BUS_EMISSION_FACTOR: 0.08
  },

  renderDashboard(data) {
    if (!data) return;

    if (data.constants) {
      this.constants = data.constants;
    }

    // Greeting
    const greeting = this.$('#user-greeting');
    if (greeting && data.user) {
      greeting.textContent = `Welcome back, ${data.user.name}`;
    }

    // Sustainability Score
    const scoreVal = this.$('#score-val');
    const scoreRing = this.$('#score-ring-fill');
    if (scoreVal && scoreRing) {
      const score = data.sustainability_score || 0;
      scoreVal.textContent = score;

      const circ = 326.7;
      const offset = circ - (circ * score / 100);
      scoreRing.style.strokeDashoffset = offset;

      if (score >= 80) {
        scoreRing.style.stroke = 'var(--color-success)';
      } else if (score >= 50) {
        scoreRing.style.stroke = 'var(--color-warning)';
      } else {
        scoreRing.style.stroke = 'var(--color-danger)';
      }
    }

    // Active tracking days & consistency bonus
    const activeDays = this.$('#active-days-val');
    const bonus = this.$('#bonus-val');
    if (activeDays) activeDays.textContent = `${data.active_days} / 30`;
    if (bonus) bonus.textContent = `+${data.consistency_bonus || 0} pts`;

    // Total emissions
    const totalEmissions = this.$('#total-emissions-val');
    if (totalEmissions) {
      totalEmissions.textContent = data.total_emissions_30d.toFixed(1);
    }

    // Category breakdown bar charts
    const breakdown = data.category_breakdown || { transportation: 0, electricity: 0, food: 0 };
    const total = data.total_emissions_30d || 0;

    const updateBar = (categoryName, val) => {
      const valLabel = this.$(`#emissions-${categoryName}-val`);
      const fill = this.$(`#bar-fill-${categoryName}`);
      
      if (valLabel) valLabel.textContent = `${val.toFixed(1)} kg`;
      if (fill) {
        const pct = total > 0 ? Math.min(100, Math.round((val / total) * 100)) : 0;
        fill.style.width = `${pct}%`;
        fill.setAttribute('aria-valuenow', pct);
      }
    };

    updateBar('transport', breakdown.transportation || 0);
    updateBar('electricity', breakdown.electricity || 0);
    updateBar('food', breakdown.food || 0);
  },

  /**
   * Renders the activity history log rows
   */
  renderLogsList(logs) {
    const listBody = this.$('#history-list-body');
    if (!listBody) return;

    if (!logs || logs.length === 0) {
      listBody.innerHTML = `
        <tr>
          <td colspan="4" class="table-empty">No activity logs recorded. Add one above!</td>
        </tr>
      `;
      return;
    }

    listBody.innerHTML = '';

    logs.forEach(log => {
      const tr = document.createElement('tr');

      // 1. Date
      const tdDate = document.createElement('td');
      tdDate.textContent = log.activity_date;
      tr.appendChild(tdDate);

      // 2. Category
      const tdCategory = document.createElement('td');
      let icon = '❓';
      if (log.category === 'transportation') icon = '🚗';
      else if (log.category === 'electricity') icon = '⚡';
      else if (log.category === 'food') icon = '🥗';
      
      const badgeSpan = document.createElement('span');
      badgeSpan.className = 'table-category-label';
      badgeSpan.innerHTML = `<span aria-hidden="true">${icon}</span> ${log.category.charAt(0).toUpperCase() + log.category.slice(1)}`;
      tdCategory.appendChild(badgeSpan);
      tr.appendChild(tdCategory);

      // 3. Details
      const tdDetails = document.createElement('td');
      tdDetails.className = 'table-details';
      let detailText = '';
      if (log.category === 'transportation') {
        detailText = `${log.activity.replace('_', ' ')} (${log.value.toFixed(1)} km)`;
      } else if (log.category === 'electricity') {
        detailText = `${log.value.toFixed(1)} kWh consumed`;
      } else if (log.category === 'food') {
        detailText = `${log.activity.replace('_', ' ')} (${log.value} serving${log.value > 1 ? 's' : ''})`;
      }
      tdDetails.textContent = detailText;
      tr.appendChild(tdDetails);

      // 4. Impact (CO2)
      const tdImpact = document.createElement('td');
      const impactBadge = document.createElement('span');
      const co2 = log.co2_emissions;
      
      let level = 'low';
      if (co2 >= 15.0) level = 'high';
      else if (co2 >= 4.0) level = 'medium';
      
      impactBadge.className = `impact-badge ${level}`;
      impactBadge.textContent = `+${co2.toFixed(1)} kg`;
      tdImpact.appendChild(impactBadge);
      tr.appendChild(tdImpact);

      listBody.appendChild(tr);
    });
  },

  /**
   * Recalculates and renders the Carbon Twin Projections, Slider Labels, and Impact Summary
   */
  renderTwinAndSimulator(stats, sliderValues) {
    const transportEmissions = stats.category_breakdown.transportation || 0;
    const electricityEmissions = stats.category_breakdown.electricity || 0;

    const carEF = this.constants.CAR_EMISSION_FACTOR || 0.18;
    const busEF = this.constants.BUS_EMISSION_FACTOR || 0.08;

    // 1. Calculate savings using constants
    // Public Transport Swap savings
    const transportYearlySavings = transportEmissions * (sliderValues.transit / 100) * ((carEF - busEF) / carEF) * 12;

    // Veg Days savings (1 meal per veg day per week swapped, saves 5.5 kg CO2)
    const foodYearlySavings = sliderValues.veg * 5.5 * 52;

    // Electricity savings
    const electricityYearlySavings = electricityEmissions * (sliderValues.electricity / 100) * 12;

    const totalYearlySavings = transportYearlySavings + foodYearlySavings + electricityYearlySavings;

    // 2. Trajectories calculations
    const currentTrajectoryYearly = stats.active_days > 0 ? (stats.total_emissions_30d / 30 * 365) : stats.user.daily_baseline * 365;
    const improvedTrajectoryYearly = Math.max(0, currentTrajectoryYearly - totalYearlySavings);

    // 3. Update Text Values
    this.$('#sim-transit-val').textContent = `${sliderValues.transit}%`;
    this.$('#sim-veg-val').textContent = `${sliderValues.veg} day${sliderValues.veg !== 1 ? 's' : ''}`;
    this.$('#sim-electricity-val').textContent = `${sliderValues.electricity}%`;

    this.$('#twin-current-val').textContent = Math.round(currentTrajectoryYearly).toLocaleString();
    this.$('#twin-savings-val').textContent = totalYearlySavings.toFixed(1);
    this.$('#twin-improved-val').textContent = Math.round(improvedTrajectoryYearly).toLocaleString();

    // 4. Update Height chart bars
    const currentBar = this.$('#twin-bar-current');
    const improvedBar = this.$('#twin-bar-improved');
    if (currentBar && improvedBar) {
      currentBar.style.height = '100%';
      currentBar.setAttribute('aria-valuenow', 100);

      const improvedPct = currentTrajectoryYearly > 0 ? Math.min(100, Math.round((improvedTrajectoryYearly / currentTrajectoryYearly) * 100)) : 0;
      improvedBar.style.height = `${improvedPct}%`;
      improvedBar.setAttribute('aria-valuenow', improvedPct);
    }

    // 5. Update Impact Summary equivalence stats
    const trees = Math.round(totalYearlySavings / 22);
    const km = Math.round(totalYearlySavings / carEF);
    const homes = Math.round(totalYearlySavings / 4.5);

    this.$('#impact-co2-reduction').textContent = totalYearlySavings.toFixed(1);
    this.$('#impact-trees').textContent = trees.toLocaleString();
    this.$('#impact-km').textContent = km.toLocaleString();
    this.$('#impact-homes').textContent = homes.toLocaleString();

    // 6. Update tooltips text content
    const tooltipCurrent = this.$('#tooltip-current');
    const tooltipImproved = this.$('#tooltip-improved');
    if (tooltipCurrent) {
      tooltipCurrent.textContent = `${Math.round(currentTrajectoryYearly).toLocaleString()} kg CO₂/yr`;
    }
    if (tooltipImproved) {
      tooltipImproved.textContent = `${Math.round(improvedTrajectoryYearly).toLocaleString()} kg CO₂/yr (Saved ${totalYearlySavings.toFixed(1)} kg)`;
    }

    // 7. Update Goal Tracker progress text and dashed overlay marker
    const targetGoalInput = this.$('#input-target-goal');
    if (targetGoalInput) {
      const targetGoal = parseFloat(targetGoalInput.value) || 0;
      this.renderGoalTracker(targetGoal, stats, totalYearlySavings);
    }
  },

  /**
   * Render target line and goal progress text on twin chart
   */
  renderGoalTracker(targetGoal, stats, simulatedSavings) {
    const goalLine = this.$('#target-goal-line');
    const goalLabel = this.$('#target-goal-label');
    const progressText = this.$('#goal-progress-text');

    if (!goalLine) return;

    if (!targetGoal || targetGoal <= 0) {
      goalLine.style.display = 'none';
      if (progressText) progressText.style.display = 'none';
      return;
    }

    const currentTrajectory = stats.active_days > 0 ? (stats.total_emissions_30d / 30 * 365) : stats.user.daily_baseline * 365;
    const targetTrajectory = Math.max(0, currentTrajectory - targetGoal);
    const pct = currentTrajectory > 0 ? Math.min(100, Math.max(0, Math.round((targetTrajectory / currentTrajectory) * 100))) : 0;

    goalLine.style.display = 'block';
    goalLine.style.bottom = `${pct}%`;
    if (goalLabel) {
      goalLabel.textContent = `Target: -${targetGoal} kg`;
    }

    if (progressText) {
      progressText.style.display = 'block';
      const pctComplete = Math.min(100, Math.round((simulatedSavings / targetGoal) * 100));
      if (simulatedSavings >= targetGoal) {
        progressText.innerHTML = `🎉 <strong>Goal Achieved!</strong> Your simulated changes save <strong>${simulatedSavings.toFixed(1)} kg CO₂/yr</strong>, exceeding your target of <strong>${targetGoal} kg</strong>!`;
      } else {
        progressText.innerHTML = `🎯 Goal Progress: <strong>${pctComplete}%</strong>. Simulated changes save <strong>${simulatedSavings.toFixed(1)} kg</strong> of your <strong>${targetGoal} kg</strong> yearly reduction target.`;
      }
    }
  },

  /**
   * Appends a message bubble to the AI Coach chat history container
   */
  renderCoachMessage(sender, text) {
    const container = this.$('#chat-history-container');
    if (!container) return;

    // Remove any typing bubble first
    const typingBubble = container.querySelector('.typing');
    if (typingBubble) typingBubble.remove();

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;
    bubble.textContent = text;
    container.appendChild(bubble);

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  },

  /**
   * Show/hide typing indicator animation for AI Coach
   */
  toggleCoachLoading(show) {
    const container = this.$('#chat-history-container');
    if (!container) return;

    const existing = container.querySelector('.typing');
    if (existing) existing.remove();

    if (show) {
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble bot typing';
      bubble.innerHTML = '<span></span><span></span><span></span>';
      container.appendChild(bubble);
      container.scrollTop = container.scrollHeight;
    }
  },

  /**
   * Renders the prioritized recommendation cards at the bottom of the dashboard
   */
  renderPrioritizedRecommendations(recommendations) {
    const grid = this.$('#recommendations-grid');
    if (!grid) return;

    if (!recommendations || recommendations.length === 0) {
      grid.innerHTML = '<div class="recs-loading">No custom recommendations available yet. Log more activities!</div>';
      return;
    }

    grid.innerHTML = '';

    // Sort by priority rank (High > Medium > Low)
    const priorityWeight = { 'High': 3, 'Medium': 2, 'Low': 1 };
    const sorted = [...recommendations].sort((a, b) => {
      return (priorityWeight[b.priority_score] || 0) - (priorityWeight[a.priority_score] || 0);
    });

    sorted.forEach(rec => {
      const card = document.createElement('div');
      card.className = 'rec-card glass';

      const pClass = (rec.priority_score || 'Low').toLowerCase();

      card.innerHTML = `
        <div class="rec-card-header">
          <h3 class="rec-card-title">${rec.title}</h3>
          <span class="badge-priority ${pClass}">${rec.priority_score} Priority</span>
        </div>
        <p class="rec-reason">${rec.why}</p>
        <div class="rec-metrics">
          <span>Monthly Savings: <strong class="rec-m-val">${rec.estimated_co2_reduction.toFixed(1)} kg</strong></span>
          <span>Category: <strong class="rec-m-val">${rec.category}</strong></span>
        </div>
      `;

      grid.appendChild(card);
    });
  },

  /**
   * Emits toast notification popup
   */
  showToast(message, type = 'success') {
    const container = this.$('#toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} glass`;
    
    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.marginLeft = '1rem';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.opacity = '0.7';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => toast.remove());
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'fadeIn 0.2s reverse ease-out';
        setTimeout(() => toast.remove(), 200);
      }
    }, 4000);
  }
};

if (typeof module !== 'undefined') {
  module.exports = VerdaDOM;
}
