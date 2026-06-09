# Verda 🌱
 
### AI-Powered Carbon Footprint Awareness Platform
 
Verda is a lightweight, AI-assisted sustainability platform that helps users **track, understand, and reduce their carbon footprint** through behavioral analytics, predictive modeling, habit detection, and explainable recommendations.
 
Unlike static carbon calculators, Verda transforms environmental data into **actionable behavior change loops** using simulations, projections, and AI-guided coaching.
 
---
 
## Problem Statement
 
Most carbon tracking tools:
- Provide static scores
- Lack personalization
- Do not guide behavioral change
Verda solves this by integrating:
- Carbon tracking
- Habit detection
- Predictive emission modeling
- Real-time simulation engine
- AI + rules-based coaching system
---
 
## System Architecture
 
```text
Frontend (Vanilla JS)
        │
        ▼
Express Router Layer
        │
        ▼
Controller Layer (HTTP + Zod Validation Only)
        │
        ▼
Service Layer (Business Logic Only)
        │
        ▼
Repository Layer (Database Access Only)
        │
        ▼
SQLite Database
        │
        ├── Habit Engine
        ├── Carbon Engine
        ├── Recommendation Engine
        └── Twin Engine
        │
        ▼
AI Layer (Gemini / Rules Engine Fallback)
```
 
### Architecture Contract (STRICT)
 
| Layer | Responsibilities | Forbidden |
|---|---|---|
| **Controller** | HTTP requests/responses · Zod validation · Calls service layer | ❌ Business logic · ❌ DB access |
| **Service** | Business logic · Domain rules · Calls repositories | ❌ HTTP handling · ❌ DB queries |
| **Repository** | SQLite queries · Pure data access | ❌ Business logic · ❌ Service imports |
 
### Dependency Flow
 
```text
Controller → Service → Repository → Database
```
 
### Forbidden Patterns
 
- ❌ Business logic inside controllers
- ❌ Direct DB access from services
- ❌ Unvalidated external input
- ❌ Circular dependencies
- ❌ Silent error suppression
---
 
## Core Features
 
### 📊 Sustainability Score
 
Dynamic score based on:
- Emission totals
- Activity consistency
- Behavioral patterns
- Baseline comparison
### 🔍 Habit Detection Engine
 
Automatically detects behavioral patterns using aggregation logic:
- Transport usage patterns
- Energy consumption trends
- Dietary emission patterns
### 🌍 Carbon Twin
 
Predictive model that generates:
- Current emission trajectory
- Optimized future trajectory
- Annual carbon savings projection
### 🎛️ What-If Simulator
 
Real-time simulation engine for lifestyle changes:
- Transport switching impact
- Diet modifications
- Energy usage optimization
### 🤖 AI Sustainability Coach
 
Generates personalized recommendations using:
- User history
- Habit patterns
- Carbon projections
**Fallback Mode:** If AI is unavailable, a deterministic rules engine ensures full functionality.
 
### 💡 Explainable Recommendations
 
Each recommendation includes:
- Reason
- Estimated CO₂ reduction
- Priority level
- Expected impact
---
 
## Design Principles
 
**Lightweight**
- No frontend frameworks
- Minimal dependencies
- Fast startup time
**Secure**
- Parameterized queries
- Rate limiting
- Security headers
- Environment isolation
**Accessible**
- Semantic HTML
- ARIA labels
- Keyboard navigation
- WCAG AA compliance
**AI-Independent Core** — System remains fully functional without external AI services.
 
---
 
## Technical Stack
 
| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS |
| Backend | Node.js, Express |
| Database | SQLite |
| AI | Gemini API + Rules Engine |
| Testing | Jest, Supertest |
| Security | Helmet, CORS, Zod |
| CI/CD | GitHub Actions |
 
---
 
## Validation & Data Safety
 
All external inputs **must** pass Zod schema validation before entering the service layer.
 
Guarantees:
- Runtime type safety
- Input sanitization
- Schema enforcement
---
 
## Testing Strategy
 
### Coverage Targets
 
| Metric | Target |
|---|---|
| Statement Coverage | ≥ 98% |
| Branch Coverage | ≥ 95% |
 
### Test Structure
 
- **Unit Tests** → Services
- **Integration Tests** → Controllers
- **Edge Tests** → Validation & Error Handling
### Required per endpoint
 
- ✅ Success case
- ✅ Failure case
- ✅ Validation failure case
---
 
## CI/CD Enforcement
 
Pipeline enforces (single source of truth):
 
| Check | Threshold |
|---|---|
| ESLint | Zero warnings allowed |
| Jest | All tests must pass |
| Branch Coverage | ≥ 95% (hard fail) |
 
> Any violation → build failure
 
---
 
## Security Model
 
- Helmet HTTP headers
- Express rate limiting
- Parameterized SQL queries
- Zod runtime validation
- Environment variable isolation
---
 
## Performance Design
 
- SQLite local persistence
- No frontend framework overhead
- Minimal API payload size
- Optimized async execution patterns
---
 
## Refactoring Standards
 
### JSDoc Type System
 
Core entities defined using `@typedef`, `@param`, `@returns` for:
- Static analysis compatibility
- Type-safe runtime behavior
### Error Handling Model
 
Centralized error system with:
- Standardized JSON responses
- No duplicate try/catch formatting
- Unified error middleware
### Constant Management
 
All constants centralized in `src/config/constants.js` — prevents magic numbers and hardcoded emission factors.
 
---
 
## API Structure
 
All endpoints prefixed with `/api`
 
### Carbon Tracking
 
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/logs` | Create activity log |
| `GET` | `/api/logs` | Retrieve activity history |
| `GET` | `/api/dashboard` | Sustainability score + analytics |
 
### Analysis
 
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/habits` | Detect behavioral patterns |
| `GET` | `/api/recommendations` | Personalized recommendations |
| `GET` | `/api/twin` | Carbon Twin projections |
 
### AI Coach
 
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/coach` | AI-guided coaching session |
 
---
 
## Getting Started
 
### Prerequisites
 
- Node.js 18+
### Installation
 
```bash
npm install
```
 
### Environment Variables
 
Create a `.env` file (use `.env.example` as template):
 
```env
PORT=3000
DB_FILE=./src/db/verda.db
GEMINI_API_KEY=your_key_here
```
 
> `GEMINI_API_KEY` is optional — the rules engine fallback activates automatically when absent.
 
### Start
 
```bash
npm start
```
 
Application available at `http://localhost:3000`
 
### Test
 
```bash
npm test
```
 
---
 
## Deployment
 
Supported platforms: Railway · Render · Heroku
 
1. Link the `main` branch to your hosting platform
2. Set environment variables (`PORT`, `DB_FILE`, `GEMINI_API_KEY`)
3. Platform auto-runs `npm install && npm start`
The SQLite database initializes its schema automatically on first startup.
 
---
 
## Project Structure
 
```text
verda-core/
├── .github/
│   └── workflows/
│       └── ci.yml
├── public/
│   ├── css/
│   │   ├── variables.css
│   │   └── styles.css
│   ├── js/
│   │   ├── api.js
│   │   ├── dom.js
│   │   └── app.js
│   └── index.html
├── src/
│   ├── config/
│   │   └── constants.js
│   ├── controllers/
│   │   ├── carbonController.js
│   │   ├── habitController.js
│   │   ├── recommendationController.js
│   │   └── coachController.js
│   ├── errors/
│   │   └── AppError.js
│   ├── repositories/
│   │   ├── carbonRepository.js
│   │   ├── habitRepository.js
│   │   └── logRepository.js
│   ├── services/
│   │   ├── carbonService.js
│   │   ├── habitService.js
│   │   ├── recommendationService.js
│   │   ├── twinService.js
│   │   └── coachService.js
│   ├── middleware/
│   │   └── errorHandler.js
│   ├── utils/
│   │   ├── calculations.js
│   │   ├── formatter.js
│   │   ├── projections.js
│   │   └── validators.js
│   ├── routes/
│   │   └── api.js
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 001_initial_schema.sql
│   │   └── index.js
│   └── server.js
├── tests/
│   ├── carbonService.test.js
│   ├── habitService.test.js
│   ├── recommendationService.test.js
│   ├── coachService.test.js
│   ├── api.test.js
│   └── edgeCases.test.js
├── .env.example
├── .gitignore
├── eslint.config.js
├── package.json
└── README.md
```
 
---
 
## Future Enhancements
 
- Multi-user authentication
- Community challenges
- Carbon offset marketplace
- Renewable energy recommendations
- Advanced forecasting models
---
 
## Hackathon Alignment
 
Optimized for:
 
| Criterion | Implementation |
|---|---|
| Code Quality | Clean layered architecture, AST-clean structure |
| Security | Zod validation boundaries, strict input sanitization |
| Efficiency | Low overhead, SQLite local persistence |
| Testing | ≥ 95% branch coverage enforced by CI |
| Maintainability | Controller → Service → Repository separation |
| Explainability | Transparent AI reasoning, rules-engine fallback |
 
---
 
*Built for the Carbon Footprint Awareness Platform Challenge 🌱*
 
