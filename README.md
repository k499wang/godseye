# GodsEye

GodsEye is a multi-agent prediction market analysis app built around Polymarket. It imports live markets, generates claims, creates a simulated society of forecasters, runs a belief-updating simulation, and lets you inspect the result through an interactive globe, replay view, and report flow.

## What It Does

- Imports live Polymarket markets
- Shows active markets on a globe-first discovery UI
- Generates claims and evidence for a market
- Builds a panel of AI forecasters with distinct styles
- Runs a multi-tick simulation of belief updates and claim sharing
- Produces a report comparing market probability vs. simulation probability
- Supports paper trading against report outcomes

## Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Three.js / React Three Fiber
- Supabase client

### Backend

- FastAPI
- SQLAlchemy async
- PostgreSQL / Supabase
- httpx
- LiteLLM
- Lava-backed Gemini + Apollo access

## Repo Layout

```text
backend/    FastAPI API, services, schemas, tests
frontend/   Next.js app, globe UI, simulation and report pages
docs/       Specs and supporting design docs
```

## Main Flow

1. A user pastes a Polymarket URL or browses a live event.
2. The backend imports market metadata and current probability.
3. Claims are generated for the market question.
4. A simulation world is built with multiple forecast agents.
5. The simulation runs and tracks belief, confidence, trust, and faction changes.
6. The frontend renders the replay and report views.

## Prerequisites

- Node.js current LTS
- npm
- Python 3.12
- A PostgreSQL database or Supabase project

## Environment Variables

### Backend

Create `backend/.env` with the values you need for local development.

```env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=...
LAVA_API_KEY=...
K2_API_KEY=...
POLYMARKET_GAMMA_BASE_URL=https://gamma-api.polymarket.com
```

Useful notes:

- `DATABASE_URL` can be `postgresql://...`; the app normalizes it to the async SQLAlchemy driver.
- `LAVA_API_KEY` is required for Gemini and Apollo-backed calls.
- `K2_API_KEY` is needed for `k2-think` model calls.
- If `SUPABASE_URL` and keys are missing, some live database-backed features will not work.

### Frontend

Create `frontend/.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

If Supabase env vars are missing, the frontend falls back to a no-op realtime client instead of crashing.

## Local Setup

### 1. Start the backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```bash
# PowerShell
.venv\Scripts\Activate.ps1

# bash
source .venv/Scripts/activate
```

Install dependencies and run the API:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 5001
```

The API will be available at `http://localhost:5001`.

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

## Important Routes

- `GET /healthz` - backend healthcheck
- `POST /api/markets/import` - import a Polymarket market
- `GET /api/markets/browse` - browse live Polymarket events
- `POST /api/markets/refresh` - refresh the browse cache
- `POST /api/sessions/{market_id}/claims/generate` - generate claims
- `POST /api/simulations/build-world` - create a simulation
- `POST /api/simulations/{simulation_id}/start` - start a simulation
- `GET /api/reports/{simulation_id}` - fetch a report

## Development Notes

- The browse feed is cached in memory on the backend for one hour unless explicitly refreshed.
- The frontend globe can still render with fallback data if the backend is unavailable.
- The app uses `NEXT_PUBLIC_API_URL` to decide which backend to call.
- The backend loads env vars from the repo root `.env` and `backend/.env`, with `backend/.env` taking precedence.

## Verification

Frontend:

```bash
cd frontend
npm run build
```

Backend tests and smoke checks live under `backend/tests/` plus the integration scripts in `backend/`.

## Current Branding

The app title and UI branding use `GodsEye`.
