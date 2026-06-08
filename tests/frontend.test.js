/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Read index.html content to initialize JSDOM document
const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');

describe('Verda Frontend Integration & Accessibility Suite', () => {
  let VerdaDOM;
  let VerdaAPI;
  let App;

  beforeEach(() => {
    // Set up document body
    document.documentElement.innerHTML = html;

    // Mock global toast container if needed
    if (!document.getElementById('toast-container')) {
      const toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }

    // Mock global fetch API
    global.fetch = jest.fn();

    // Reset module cache and re-require frontend modules
    jest.resetModules();
    
    // Inject global objects into window so the client code can access them
    VerdaDOM = require('../public/js/dom');
    global.VerdaDOM = VerdaDOM;

    VerdaAPI = require('../public/js/api');
    global.VerdaAPI = VerdaAPI;

    App = require('../public/js/app');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Form Interaction and A11y Tab Controls', () => {
    test('should switch panels when clicking category tabs', () => {
      // Setup default interactions
      VerdaDOM.setupFormInteractions();

      const electricityTab = document.querySelector('label[for="cat-electricity"]');
      const transportPanel = document.getElementById('panel-transportation');
      const electricityPanel = document.getElementById('panel-electricity');

      expect(transportPanel.classList.contains('active')).toBe(true);
      expect(electricityPanel.classList.contains('active')).toBe(false);

      // Click Electricity tab
      electricityTab.click();

      expect(transportPanel.classList.contains('active')).toBe(false);
      expect(electricityPanel.classList.contains('active')).toBe(true);
      expect(electricityTab.getAttribute('aria-checked')).toBe('true');
      expect(document.getElementById('cat-electricity').checked).toBe(true);
    });

    test('should navigate tabs with ArrowRight and ArrowLeft keys', () => {
      VerdaDOM.setupFormInteractions();

      const tabs = document.querySelectorAll('.tab-btn');
      // Set initial focus to first tab
      tabs[0].focus();

      // Trigger ArrowRight keydown
      const rightEvent = new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      tabs[0].dispatchEvent(rightEvent);

      // Focus should move to index 1 (Electricity)
      expect(document.activeElement).toBe(tabs[1]);
      expect(document.getElementById('cat-electricity').checked).toBe(true);
      expect(document.getElementById('panel-electricity').classList.contains('active')).toBe(true);

      // Trigger ArrowLeft keydown on tabs[1]
      const leftEvent = new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
      tabs[1].dispatchEvent(leftEvent);

      // Focus should move back to index 0 (Transport)
      expect(document.activeElement).toBe(tabs[0]);
      expect(document.getElementById('cat-transport').checked).toBe(true);
      expect(document.getElementById('panel-transportation').classList.contains('active')).toBe(true);
    });

    test('should activate tab on Enter or Space key press', () => {
      VerdaDOM.setupFormInteractions();

      const tabs = document.querySelectorAll('.tab-btn');
      
      // Select the food tab and fire Enter key
      const enterEvent = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      tabs[2].dispatchEvent(enterEvent);

      expect(document.getElementById('cat-food').checked).toBe(true);
      expect(document.getElementById('panel-food').classList.contains('active')).toBe(true);
    });
  });

  describe('2. What-If Simulator and Twin Projections', () => {
    test('should calculate savings and update progress metrics', () => {
      // Mock stats from dashboard payload
      const mockStats = {
        user: { name: 'Alice', daily_baseline: 10 },
        total_emissions_30d: 300,
        active_days: 30,
        category_breakdown: { transportation: 120, electricity: 100, food: 80 },
        sustainability_score: 85,
        consistency_bonus: 5,
        constants: {
          CAR_EMISSION_FACTOR: 0.20,
          BUS_EMISSION_FACTOR: 0.05
        }
      };

      // Set input values
      document.getElementById('sim-transit').value = '50'; // 50% driving replaced with transit
      document.getElementById('sim-veg').value = '2'; // 2 vegetarian days / week
      document.getElementById('sim-electricity').value = '10'; // 10% electricity reduction

      // Ensure custom constants are registered
      VerdaDOM.constants = mockStats.constants;

      // Trigger Twin rendering logic
      VerdaDOM.renderTwinAndSimulator(mockStats, { transit: 50, veg: 2, electricity: 10 });

      // Check yearly savings projections
      // Transport savings: 120 * 0.5 * ((0.20 - 0.05) / 0.20) * 12 = 60 * 0.75 * 12 = 540 kg CO2/yr
      // Food savings: 2 * 5.5 * 52 = 572 kg CO2/yr
      // Electricity savings: 100 * 0.10 * 12 = 120 kg CO2/yr
      // Total simulated savings: 540 + 572 + 120 = 1232 kg CO2/yr
      const expectedSavings = 540 + 572 + 120; // 1232

      expect(document.getElementById('twin-savings-val').textContent).toBe(expectedSavings.toFixed(1));

      // Check equivalence calculations
      // Trees: 1232 / 22 = 56
      // Km saved: 1232 / CAR_EMISSION_FACTOR = 1232 / 0.20 = 6160
      // Homes: 1232 / 4.5 = 274
      expect(document.getElementById('impact-trees').textContent).toBe('56');
      expect(document.getElementById('impact-km').textContent).toBe('6,160');
      expect(document.getElementById('impact-homes').textContent).toBe('274');
    });

    test('should render target goal line and mark progress', () => {
      const mockStats = {
        user: { name: 'Alice', daily_baseline: 10 },
        total_emissions_30d: 300,
        active_days: 30,
        category_breakdown: { transportation: 120, electricity: 100, food: 80 }
      };

      // Set yearly target goal to 1000 kg CO2
      document.getElementById('input-target-goal').value = '1000';

      // Call simulator math with savings of 400 kg CO2
      VerdaDOM.renderTwinAndSimulator(mockStats, { transit: 0, veg: 0, electricity: 0 });
      // Render goal line directly
      VerdaDOM.renderGoalTracker(1000, mockStats, 400);

      const goalLine = document.getElementById('target-goal-line');
      const progressText = document.getElementById('goal-progress-text');

      expect(goalLine.style.display).toBe('block');
      expect(progressText.style.display).toBe('block');
      expect(progressText.innerHTML).toContain('40%'); // 400 / 1000 = 40%

      // Goal achieved scenario
      VerdaDOM.renderGoalTracker(1000, mockStats, 1100);
      expect(progressText.innerHTML).toContain('Goal Achieved!');
    });
  });

  describe('3. AI Coach Interactive Chat Widget', () => {
    test('should append user and bot message bubbles', () => {
      // Initial chat bubble exists
      const history = document.getElementById('chat-history-container');
      expect(history.children.length).toBe(1);
      expect(history.children[0].textContent).toContain('Hello! I am your AI Sustainability Coach');

      // Add user message
      VerdaDOM.renderCoachMessage('user', 'Can you help me reduce my beef intake?');
      expect(history.children.length).toBe(2);
      expect(history.children[1].classList.contains('user')).toBe(true);
      expect(history.children[1].textContent).toBe('Can you help me reduce my beef intake?');

      // Toggle loading indicator
      VerdaDOM.toggleCoachLoading(true);
      expect(history.children.length).toBe(3);
      expect(history.querySelector('.typing')).toBeDefined();

      // Send bot message (should remove typing indicator automatically)
      VerdaDOM.renderCoachMessage('bot', 'Try replacing beef with poultry.');
      expect(history.children.length).toBe(3); // 2 messages + typing removed, then bot added = 3
      expect(history.querySelector('.typing')).toBeNull();
      expect(history.children[2].classList.contains('bot')).toBe(true);
      expect(history.children[2].textContent).toBe('Try replacing beef with poultry.');
    });

    test('should submit coach question form and call API', async () => {
      const mockResponse = { advice: 'Here is some tailored advice from Gemini.' };
      jest.spyOn(VerdaAPI, 'askCoach').mockResolvedValue(mockResponse);

      const input = document.getElementById('input-coach-question');
      input.value = 'How can I save carbon?';

      const event = { preventDefault: jest.fn() };
      await App.handleCoachSubmit(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(VerdaAPI.askCoach).toHaveBeenCalledWith('How can I save carbon?', 1);
      
      const history = document.getElementById('chat-history-container');
      // Bubble 1: Initial chat bot bubble
      // Bubble 2: User question "How can I save carbon?"
      // Bubble 3: Bot advice bubble
      expect(history.children.length).toBe(3);
      expect(history.children[2].textContent).toBe('Here is some tailored advice from Gemini.');
    });

    test('should enforce character limit on coach form question', async () => {
      jest.spyOn(VerdaDOM, 'showToast').mockImplementation(() => {});
      jest.spyOn(VerdaAPI, 'askCoach');

      const input = document.getElementById('input-coach-question');
      input.value = 'a'.repeat(501); // Exceeds 500 limit

      const event = { preventDefault: jest.fn() };
      await App.handleCoachSubmit(event);

      expect(VerdaDOM.showToast).toHaveBeenCalledWith(expect.stringContaining('too long'), 'warning');
      expect(VerdaAPI.askCoach).not.toHaveBeenCalled();
    });
  });

  describe('4. Dashboard API Concurrency', () => {
    test('should call stats, logs, and recs APIs concurrently via Promise.all', async () => {
      const mockStats = {
        user: { name: 'Alice', daily_baseline: 10 },
        total_emissions_30d: 300,
        active_days: 30,
        category_breakdown: { transportation: 120, electricity: 100, food: 80 },
        constants: { CAR_EMISSION_FACTOR: 0.18, BUS_EMISSION_FACTOR: 0.08 }
      };
      const mockLogs = { logs: [] };
      const mockRecs = { recommendations: [] };

      const getDashboardSpy = jest.spyOn(VerdaAPI, 'getDashboard').mockResolvedValue(mockStats);
      const getLogsSpy = jest.spyOn(VerdaAPI, 'getLogs').mockResolvedValue(mockLogs);
      const getRecommendationsSpy = jest.spyOn(VerdaAPI, 'getRecommendations').mockResolvedValue(mockRecs);

      await App.refreshDashboardData(1);

      expect(getDashboardSpy).toHaveBeenCalledWith(1);
      expect(getLogsSpy).toHaveBeenCalledWith(1);
      expect(getRecommendationsSpy).toHaveBeenCalledWith(1);

      // Verify stats and constants were cached
      expect(App.get_cachedDashboardStats()).toBe(mockStats);
      expect(VerdaDOM.constants.CAR_EMISSION_FACTOR).toBe(0.18);
    });
  });
});
