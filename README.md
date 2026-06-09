# Verda 🌱
### AI-Powered Carbon Footprint Awareness Platform

Verda is an intelligent sustainability platform that helps individuals **understand, track, and reduce their carbon footprint** through personalized insights, predictive analytics, habit detection, and AI-powered coaching.

Unlike traditional carbon calculators that provide only a static score, Verda transforms environmental awareness into actionable behavior change through real-time simulations, future impact projections, and explainable recommendations.

---

# Problem Statement

Individuals often struggle to understand how their daily activities contribute to their carbon footprint. Existing tools typically provide one-time calculations without offering personalized guidance or helping users explore practical ways to reduce emissions.

Verda addresses this challenge by combining:

- Carbon footprint tracking
- Habit detection
- Predictive carbon modeling
- Real-time lifestyle simulations
- AI-powered sustainability coaching

into a single user-centric platform.

---

# Key Features

## 📊 Sustainability Score

A dynamic sustainability score that evaluates environmental performance based on:

- Total emissions
- Daily activity patterns
- Consistency of tracking
- Personalized baseline emissions

The score updates automatically as users log new activities.

---

## 🔍 Habit Detection Engine

Verda automatically identifies recurring behaviors using SQLite aggregation queries.

Examples:

- Frequent car commuting
- High electricity consumption
- Repeated high-emission meal choices

These habits become inputs for recommendations and coaching.

---

## 🌍 Carbon Twin

The Carbon Twin acts as a digital representation of the user's environmental impact.

It generates:

- Current annual carbon trajectory
- Improved future trajectory
- Potential yearly carbon savings

allowing users to visualize the long-term impact of their habits.

---

## 🎛️ What-If Simulator

An interactive simulation engine that enables users to instantly explore how lifestyle changes affect future emissions.

Users can experiment with:

- Public transport adoption
- Vegetarian meal frequency
- Electricity conservation

Results update in real time without page refreshes.

---

## 🤖 AI Sustainability Coach

The AI Coach analyzes:

- Recent activity history
- Emission patterns
- Habit trends
- Carbon Twin projections

to provide personalized sustainability guidance.

### AI Resilience

Verda remains fully functional even without AI services.

When a Gemini API key is unavailable, the system automatically switches to a built-in expert rules engine that generates context-aware recommendations.

---

## 💡 Explainable Recommendations

Every recommendation includes:

- Reasoning
- Estimated CO₂ reduction
- Priority level
- Expected impact

This ensures users understand why actions are recommended and what benefits they can expect.

---

# System Architecture

```text
User
 │
 ▼
Frontend (HTML + CSS + Vanilla JavaScript)
 │
 ▼
Express REST API
 │
 ▼
SQLite Database
 │
 ├── Habit Detection Engine
 ├── Sustainability Score Engine
 ├── Carbon Twin Engine
 └── Recommendation Engine
          │
          ▼
 AI Coach (Gemini / Rules-Based Fallback)
```

---

# Design Principles

### Lightweight

- No frontend framework overhead
- Fast startup time
- Minimal dependencies

### Secure

- Parameterized SQL queries
- Rate limiting
- Security headers
- Environment variable isolation

### Accessible

- Semantic HTML
- Keyboard navigation
- ARIA labels
- WCAG AA compliant design

### AI-Enhanced, Not AI-Dependent

Core platform functionality remains operational even without external AI services.

---

# Technical Stack

| Layer | Technology |
|---------|------------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express |
| Database | SQLite |
| AI Integration | Google Gemini |
| Testing | Jest, Supertest |
| Security | Helmet, CORS, Express Rate Limit |

---

# Project Structure

```text
verda-core/
├── public/
│   ├── css/
│   │   ├── variables.css
│   │   └── styles.css
│   ├── js/
│   │   ├── api.js
│   │   ├── dom.js
│   │   └── app.js
│   └── index.html
│
├── src/
│   ├── controllers/
│   │   ├── carbonController.js
│   │   ├── habitController.js
│   │   ├── recommendationController.js
│   │   └── coachController.js
│   │
│   ├── routes/
│   │   └── api.js
│   │
│   ├── db/
│   │   ├── schema.sql
│   │   └── index.js
│   │
│   └── server.js
│
├── tests/
│   ├── api.test.js
│   ├── carbonEngine.test.js
│   ├── habitDetection.test.js
│   └── recommendationEngine.test.js
│
├── package.json
└── README.md
```

---

# Quality Metrics

## ✅ Testing

- 85 Automated Tests Passing
- 99.14% Statement Coverage
- 90.10% Branch Coverage

---

## 🔒 Security

- Helmet Security Headers
- Express Rate Limiting
- Parameterized SQLite Queries
- Input Validation
- Environment Variable Isolation

---

## ♿ Accessibility

- Semantic HTML
- Keyboard Navigation
- Skip-to-Content Support
- ARIA Labels
- WCAG AA Color Compliance

---

## ⚡ Performance

- Repository Size: 237 KiB
- SQLite Local Persistence
- Zero Frontend Framework Overhead
- Real-Time Client-Side Simulations

---

# Getting Started

## Prerequisites

- Node.js 18+

---

## Installation

```bash
npm install
```

---

## Environment Variables

Create a `.env` file:

```env
PORT=3000
DB_FILE=./src/db/verda.db
GEMINI_API_KEY=your_api_key_here
```

### Optional

If no Gemini API key is provided, Verda automatically uses its built-in expert recommendation engine.

---

## Start Application

```bash
npm start
```

Application will be available at:

```text
http://localhost:3000
```

---

## Run Tests

```bash
npm test
```

---

# REST API

All endpoints are prefixed with:

```text
/api
```

## Carbon Tracking

### POST /api/logs

Create a new carbon activity log.

### GET /api/logs

Retrieve activity history.

### GET /api/dashboard

Retrieve sustainability score and 30-day analytics.

---

## Analysis & Recommendations

### GET /api/habits

Detect recurring user habits.

### GET /api/recommendations

Generate personalized recommendations.

### GET /api/twin

Retrieve Carbon Twin projections.

---

## AI Coach

### POST /api/coach

Generate personalized sustainability guidance using:

- Recent activity history
- Habit patterns
- Carbon categories
- Carbon Twin projections

Returns either:

- Gemini-generated insights
- Rules-engine recommendations

depending on system configuration.

---

# Hackathon Evaluation Alignment

Verda was intentionally designed to maximize:

✅ Code Quality  
✅ Security  
✅ Efficiency  
✅ Testing Coverage  
✅ Accessibility  
✅ Real-World Usability  
✅ Explainable AI  
✅ Sustainable Behavior Change

---

# Deployment Instructions

Verda is optimized for instant deployment on cloud application runners like **Railway**, **Heroku**, or **Render**:

1. **GitHub Synchronization**: Link your GitHub repository branch `main` to your hosting platform.
2. **Environment Variables Config**: Configure the following runtime variables:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `DB_FILE=./src/db/verda.db` (The SQLite database initializes its tables automatically on initial deployment startup)
   - `GEMINI_API_KEY=your_gemini_api_key` (Optional; rules fallback handles queries gracefully if not provided)
3. **Build & Start**: The engine automatically detects the Node.js runtime, executes `npm install`, and starts the platform via `npm start`.

---

# Future Enhancements

- Multi-user authentication
- Community sustainability challenges
- Carbon offset marketplace integrations
- Renewable energy recommendations
- Advanced AI forecasting models

---

**Built for the Carbon Footprint Awareness Platform Challenge 🌱**
