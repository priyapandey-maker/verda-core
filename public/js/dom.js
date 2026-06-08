/**
 * Verda DOM Utilities and dynamic rendering engine
 */
const VerdaDOM = {
  // Select helper
  $(selector) {
    return document.querySelector(selector);
  },

  /**
   * Set up tab controls for the activity logging form
   */
  setupFormInteractions() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.form-panel');
    const form = this.$('#activity-form');

    // Default dates to today YYYY-MM-DD
    const dateInput = this.$('#input-date');
    if (dateInput) {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      dateInput.value = `${y}-${m}-${d}`;
    }

    tabs.forEach(tab => {
      // Handle click events
      tab.addEventListener('click', () => {
        const value = this.$(`#${tab.getAttribute('for')}`).value;
        this.switchTab(value);
      });

      // Handle keyboard accessibility (Enter/Space to select)
      tab.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          const radioId = tab.getAttribute('for');
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
  renderDashboard(data) {
    if (!data) return;

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

      // Circular Ring math: radius=52 -> circumfrence = 2 * PI * 52 = 326.725
      const circ = 326.7;
      const offset = circ - (circ * score / 100);
      scoreRing.style.strokeDashoffset = offset;

      // Color coding score
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

    // Helper to render individual category bars
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

      // 1. Date column
      const tdDate = document.createElement('td');
      tdDate.textContent = log.activity_date;
      tr.appendChild(tdDate);

      // 2. Category column (with accessible text and icon)
      const tdCategory = document.createElement('td');
      let icon = '❓';
      let catClass = 'food';
      if (log.category === 'transportation') {
        icon = '🚗';
        catClass = 'transport';
      } else if (log.category === 'electricity') {
        icon = '⚡';
        catClass = 'electricity';
      } else if (log.category === 'food') {
        icon = '🥗';
        catClass = 'food';
      }
      
      const badgeSpan = document.createElement('span');
      badgeSpan.className = 'table-category-label';
      badgeSpan.innerHTML = `<span aria-hidden="true">${icon}</span> ${log.category.charAt(0).toUpperCase() + log.category.slice(1)}`;
      tdCategory.appendChild(badgeSpan);
      tr.appendChild(tdCategory);

      // 3. Activity details column
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

      // 4. Impact emissions column (color badge)
      const tdImpact = document.createElement('td');
      const impactBadge = document.createElement('span');
      const co2 = log.co2_emissions;
      
      let level = 'low';
      if (co2 >= 15.0) {
        level = 'high';
      } else if (co2 >= 4.0) {
        level = 'medium';
      }
      
      impactBadge.className = `impact-badge ${level}`;
      impactBadge.textContent = `+${co2.toFixed(1)} kg`;
      tdImpact.appendChild(impactBadge);
      tr.appendChild(tdImpact);

      listBody.appendChild(tr);
    });
  },

  /**
   * Helper to emit a toast message alert accessibly
   */
  showToast(message, type = 'success') {
    const container = this.$('#toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} glass`;
    
    // Add text message
    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);

    // Close button
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

    // Auto remove toast
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'fadeIn 0.2s reverse ease-out';
        setTimeout(() => toast.remove(), 200);
      }
    }, 4000);
  }
};
