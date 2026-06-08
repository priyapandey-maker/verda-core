# Verda - Carbon Footprint Awareness Platform

Verda is a hackathon-ready MVP designed to help users track, analyze, and reduce their carbon footprint through personalized feedback, habit tracking, and proactive recommendations.

This repository implements the full backend APIs, calculation engines, and database configurations for **Phase 1**.

---

## Technical Stack
- **Backend**: Node.js & Express
- **Database**: SQLite (configured asynchronously using `sqlite` + `sqlite3`)
- **Testing**: Jest & Supertest
- **Security**: Helmet headers, CORS policies, rate limiting (`express-rate-limit`), and strict parameterized query protection.

---

## Directory Structure
```text
verda-core/
├── public/                  # Static assets & dashboard frontend templates
│   ├── css/
│   │   ├── variables.css    # Premium CSS design tokens (emerald, teal, slates)
│   │   └── styles.css       # Core typography, resets, layout definitions
│   ├── js/
│   │   ├── api.js           # Client-side API request wrapper
│   │   ├── dom.js           # DOM query and styling helpers
│   │   └── app.js           # UI initializer
│   └── index.html           # Main semantic HTML portal
├── src/                     # Express & SQLite Backend
│   ├── controllers/
│   │   ├── carbonController.js         # Carbon tracking, calculations, & score logic
│   │   ├── habitController.js          # SQLite aggregation for habit detection
│   │   ├── recommendationController.js  # Personalized recommendation logic
│   │   └── coachController.js           # AI Coach system (with Gemini fallback)
│   ├── routes/
│   │   └── api.js           # REST API router matching controllers
│   ├── db/
│   │   ├── schema.sql       # Database schema creation script
│   │   └── index.js         # SQLite connector lifecycle adapter
│   └── server.js            # Express app config (security headers, CORS, rate limits)
├── tests/                   # Automated Tests (100% Passing)
│   ├── api.test.js          # REST End-to-end API tests
│   ├── carbonEngine.test.js # Core calculator unit tests
│   ├── habitDetection.test.js  # Habit detection query assertions
│   └── recommendationEngine.test.js # Advice and Carbon Twin math tests
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js >= 18.x

### Setup & Installation
1. Install project dependencies:
   ```bash
   npm install
   ```

2. (Optional) Configure environment parameters in `.env`:
   - `PORT`: Server port (default: 3000)
   - `DB_FILE`: Database file path (default: `./src/db/verda.db`)
   - `GEMINI_API_KEY`: API key to activate natural language feedback in AI Coach. If empty, the system automatically falls back to an expert rules engine to provide context-aware feedback.

### Start the Server
Run the active backend process:
```bash
npm start
```
The server will run on `http://localhost:3000`. It initializes the database schema automatically on startup.

### Run Automated Tests
Execute the full test suite using Jest:
```bash
npm test
```

---

## REST API Documentation

All routes are prefixed with `/api`.

### 1. Carbon Tracking APIs
- **`POST /api/logs`**: Logs a carbon activity.
  - **Body parameters**:
    - `activity_date` (string, required): `YYYY-MM-DD`
    - `category` (string, required): `'transportation'`, `'electricity'`, or `'food'`
    - `activity` (string, required):
      - *transportation*: `gasoline_car`, `diesel_car`, `electric_car`, `bus`, `train`, `flight`, `walking_biking`
      - *electricity*: `grid_electricity`
      - *food*: `beef_meal`, `pork_meal`, `poultry_meal`, `vegetarian_meal`, `vegan_meal`
    - `value` (number, required): Positive distance in km, kWh consumed, or meals count.
    - `user_id` (number, optional): Defaults to `1`.

- **`GET /api/logs`**: Retrieves history logs.
  - **Query parameters**: `user_id` (default: 1), `start_date` (`YYYY-MM-DD`), `end_date` (`YYYY-MM-DD`).

- **`GET /api/dashboard`**: Fetches the Sustainability Score and 30-day carbon statistics.
  - **Query parameters**: `user_id` (default: 1).
  - Calculates the sustainability score out of 100 based on emissions vs. daily baseline, plus consistency bonuses (+1 point per active day tracked up to +10).

### 2. Analysis & Recommendations
- **`GET /api/habits`**: Discover recurring habits (frequency > 3 in the last 30 days) via parameterized database aggregation.
- **`GET /api/recommendations`**: Emits tailored suggestions based on the user's high-emission categories and logs, complete with Estimated CO₂ reduction and priority levels.
- **`GET /api/twin`**: Fetches yearly carbon projections comparing current habits trajectory against recommended actions.

### 3. AI Coach
- **`POST /api/coach`**: Consults the coach system on sustainability.
  - **Body parameters**:
    - `question` (string, required): Question text (e.g. "What can I do to improve?").
  - Dynamically builds a context profile from the last 30 days of logs, feeds it to Google Gemini (or custom fallback rules engine), and returns personalized advice.
