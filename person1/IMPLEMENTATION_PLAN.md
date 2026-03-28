# Person 1 Implementation Plan

This file is the execution plan for Person 1 only.

Source of truth priority:

1. `SHARED_CONTRACTS.md`
2. `TEAM_DIVISION.md`
3. `ARCHITECTURE_FLOW.md`

Non-negotiable contract rules:

- Use `session_id`, not `analysis_session_id`
- Do not rename API paths
- Do not rename shared schema fields
- Do not change model import paths after stubs are committed

## Person 1 Scope

You own:

- FastAPI backend scaffold
- app config and database setup
- SQLAlchemy models
- Pydantic schemas
- Supabase SQL schema management
- Polymarket client
- Market ingestion service
- API route shells
- Wiring Person 2 and Person 3 services into your routes
- CORS and deployment-ready backend setup

You do not own:

- `app/core/llm_client.py`
- `app/services/claims_generator.py`
- `app/services/apollo_service.py`
- `app/services/world_builder.py`
- `app/services/simulation_runner.py`
- `app/services/report_agent.py`
- frontend code

## Deliverables

You need these paths in the backend:

- `backend/app/main.py`
- `backend/app/core/config.py`
- `backend/app/core/database.py`
- `backend/app/models/market.py`
- `backend/app/models/session.py`
- `backend/app/models/claim.py`
- `backend/app/models/agent.py`
- `backend/app/models/simulation.py`
- `backend/app/models/claim_share.py`
- `backend/app/models/report.py`
- `backend/app/schemas/market.py`
- `backend/app/schemas/claim.py`
- `backend/app/schemas/simulation.py`
- `backend/app/schemas/report.py`
- `backend/app/services/polymarket_client.py`
- `backend/app/services/market_ingestion.py`
- `backend/app/api/routes/markets.py`
- `backend/app/api/routes/claims.py`
- `backend/app/api/routes/simulations.py`
- `backend/app/api/routes/reports.py`
- `shared_contracts/supabase_schema.sql`

## Step-By-Step Plan

### Step 1: Create backend skeleton

Goal:

- Create the directory structure and import paths the whole team will code against.

Tasks:

- [ ] Create `backend/app/` package structure
- [ ] Add `main.py` with FastAPI app instance
- [ ] Add router registration structure
- [ ] Add `app/core/config.py`
- [ ] Add `app/core/database.py`
- [ ] Add package `__init__.py` files where needed

Definition of done:

- [ ] `uvicorn app.main:app` is a valid app target from `backend/`
- [ ] Router modules are importable even if logic is still stubbed

### Step 2: Lock the database contract with model stubs

Goal:

- Unblock Person 2 and Person 3 immediately with final model names, field names, and import paths.

Tasks:

- [ ] Create `Market` model
- [ ] Create `Session` model
- [ ] Create `Claim` model
- [ ] Create `Agent` model
- [ ] Create `Simulation` model
- [ ] Create `ClaimShare` model
- [ ] Create `Report` model
- [ ] Use the exact field names from `SHARED_CONTRACTS.md` and `TEAM_DIVISION.md`

Required model contract details:

- `Claim`: `id`, `session_id`, `market_id`, `text`, `stance`, `strength_score`, `novelty_score`
- `Agent`: `id`, `simulation_id`, `name`, `archetype`, `initial_belief`, `current_belief`, `confidence`, `professional_background`, `trust_scores`
- `Simulation`: `id`, `session_id`, `market_id`, `status`, `current_tick`, `total_ticks`, `tick_data`, `created_at`, `completed_at`
- `ClaimShare`: `id`, `simulation_id`, `from_agent_id`, `to_agent_id`, `claim_id`, `commentary`, `tick_number`, `delivered`
- `Report`: must support the `ReportResponse` shape

Definition of done:

- [ ] All model files import cleanly
- [ ] Person 2 can import `Claim` and `Session`
- [ ] Person 3 can import `Agent`, `Simulation`, and `ClaimShare`

### Step 3: Lock the API contract with schema files

Goal:

- Give Person 4 exact backend response shapes and give Person 3 exact simulation payload shapes.

Tasks:

- [ ] Create `app/schemas/claim.py`
- [ ] Create `app/schemas/market.py`
- [ ] Create `app/schemas/simulation.py`
- [ ] Create `app/schemas/report.py`
- [ ] Implement all enums and response models exactly as documented

Required schema coverage:

- [ ] `ClaimSchema`
- [ ] `ProfessionalBackground`
- [ ] `AgentSummary`
- [ ] `AgentTickState`
- [ ] `ClaimShareRecord`
- [ ] `TrustUpdate`
- [ ] `TickSnapshot`
- [ ] `MarketResponse`
- [ ] `ClaimsGenerateResponse`
- [ ] `SimulationResponse`
- [ ] `ReportResponse`

Definition of done:

- [ ] No field name drift from `SHARED_CONTRACTS.md`
- [ ] `SimulationResponse` includes `agents` and `tick_data`
- [ ] Frontend can mirror these shapes one-to-one

### Step 4: Add route shells with exact endpoint paths

Goal:

- Publish stable route paths so frontend and service owners can code against them immediately.

Tasks:

- [ ] Add `POST /api/markets/import`
- [ ] Add `POST /api/sessions/{market_id}/claims/generate`
- [ ] Add `POST /api/simulations/build-world`
- [ ] Add `POST /api/simulations/{id}/start`
- [ ] Add `GET /api/simulations/{id}`
- [ ] Add `GET /api/reports/{simulation_id}`
- [ ] Return placeholder or DB-backed responses matching contract shapes
- [ ] Add consistent structured error responses

Definition of done:

- [ ] All routes exist at final paths
- [ ] Response models are attached
- [ ] CORS allows `http://localhost:3000` and the deployed frontend origin

### Step 5: Implement market import path first

Goal:

- Finish the one fully owned feature Person 1 can complete without waiting on Person 2 or Person 3.

Tasks:

- [ ] Build `polymarket_client.py`
- [ ] Parse Polymarket URL into a slug or identifier
- [ ] Fetch market details
- [ ] Normalize `question`, `resolution_criteria`, `current_probability`, and `volume`
- [ ] Create `Market` record
- [ ] Create linked `Session` record
- [ ] Return `MarketResponse`
- [ ] Add retry handling and clear HTTP errors

Definition of done:

- [ ] `POST /api/markets/import` creates market plus session
- [ ] Response includes `session_id`
- [ ] Invalid URLs return structured 4xx errors

### Step 6: Flesh out real ORM relationships and constraints

Goal:

- Move stubs into a stable relational model before integration work expands.

Tasks:

- [ ] Add primary keys and foreign keys
- [ ] Add indexes on query-heavy fields
- [ ] Add timestamp fields where needed
- [ ] Add JSON columns for `professional_background`, `trust_scores`, and `tick_data`
- [ ] Add status and stance constraints or enums
- [ ] Validate `total_ticks` default is `30`

Recommended relationships:

- [ ] `Market` has one-to-many `Session`
- [ ] `Session` belongs to `Market`
- [ ] `Session` has many `Claim`
- [ ] `Session` has many `Simulation`
- [ ] `Simulation` has many `Agent`
- [ ] `Simulation` has many `ClaimShare`
- [ ] `Simulation` has one `Report`

Definition of done:

- [ ] ORM graph supports all planned route queries
- [ ] No relationship naming conflicts with Person 2 or Person 3 code

### Step 7: Keep schema changes in Supabase SQL

Goal:

- Keep the database schema aligned through the shared Supabase SQL file.

Tasks:

- [ ] Update `shared_contracts/supabase_schema.sql` when model contracts change
- [ ] Keep SQLAlchemy model definitions aligned with the Supabase SQL
- [ ] Review SQL manually before applying in Supabase
- [ ] Apply schema changes through Supabase SQL editor or SQL files

Definition of done:

- [ ] Fresh database can be created from the shared SQL file
- [ ] Teammates can apply the same schema without migration tooling

### Step 8: Wire Person 2 service boundaries

Goal:

- Integrate claims generation without taking ownership of LLM logic.

Tasks:

- [ ] In `claims.py`, call Person 2's claims generation service
- [ ] Pass the route data needed by Person 2 cleanly
- [ ] Persist returned claims to DB using your models
- [ ] Return `ClaimsGenerateResponse`

Dependency:

- Person 2 must provide `llm_client` and claims generation service implementation

Definition of done:

- [ ] Claims route works without changing route path or response shape
- [ ] Person 2 code plugs in without DB model refactors

### Step 9: Wire Person 3 service boundaries

Goal:

- Integrate world building, simulation startup, and report retrieval cleanly.

Tasks:

- [ ] In build-world route, create `Simulation` record and call Person 3's world builder
- [ ] Persist returned agents using your `Agent` model
- [ ] In start route, mark simulation as `running`
- [ ] Trigger Person 3's worker or runner
- [ ] In simulation get route, return the latest DB-backed `SimulationResponse`
- [ ] In reports route, fetch and return `ReportResponse`

Dependency:

- Person 3 must provide world builder, simulation worker, and report generation logic

Definition of done:

- [ ] Person 3 logic is invoked through your fixed API shells
- [ ] Person 4 can poll simulation state without needing backend changes

### Step 10: Deployment readiness

Goal:

- Make the backend easy to run locally and easy to deploy.

Tasks:

- [ ] Add environment variable config for DB and external APIs
- [ ] Add startup instructions in backend README if needed
- [ ] Confirm CORS config
- [ ] Confirm health of DB connection path
- [ ] Prepare Railway deployment settings

Definition of done:

- [ ] Backend runs locally
- [ ] Backend is deployable without structural changes

## Checklist By Time Window

### First 45 minutes

- [ ] Create backend package layout
- [ ] Create `config.py`
- [ ] Create `database.py`
- [ ] Create all model stubs
- [ ] Create all schema files
- [ ] Create route shell files
- [ ] Commit and announce that backend stubs are ready

### Hour 1 to Hour 2

- [ ] Flesh out ORM details
- [ ] Add relationships
- [ ] Add constraints and indexes
- [ ] Set up Alembic

### Hour 2 to Hour 4

- [ ] Implement Polymarket client
- [ ] Implement market ingestion service
- [ ] Finish `POST /api/markets/import`
- [ ] Finish claims route shell integration points
- [ ] Finish simulation route shell integration points

### Hour 4 to Hour 6

- [ ] Wire Person 2 claims generation into claims route
- [ ] Wire Person 3 world builder into build-world route
- [ ] Wire Person 3 simulation runner or worker into start route
- [ ] Add report retrieval route
- [ ] Deploy backend

## Coordination Checklist

### What to announce to the team

- [ ] "Stubs ready. Everyone can start."
- [ ] "DB migrations done."
- [ ] "Market import route working."
- [ ] "Claims route shell wired."
- [ ] "Simulation route shells wired."
- [ ] "Backend deployed."

### What to confirm with Person 2

- [ ] Exact import path for claims generation service
- [ ] Return type for generated claims
- [ ] Whether claims service persists records or only returns data
- [ ] `llm_client` import path remains `app.core.llm_client`

### What to confirm with Person 3

- [ ] Exact import path for world builder
- [ ] Exact import path for simulation worker or runner
- [ ] Whether build-world returns ORM objects or plain data
- [ ] Whether tick updates are persisted incrementally or per completed tick
- [ ] How report creation is triggered

### What to confirm with Person 4

- [ ] Frontend uses `session_id` everywhere
- [ ] Frontend mirrors schema names exactly
- [ ] Frontend polls `GET /api/simulations/{id}` every 2 seconds

## Risks To Avoid

- [ ] Do not use `analysis_session_id`
- [ ] Do not let `ARCHITECTURE_FLOW.md` override `SHARED_CONTRACTS.md`
- [ ] Do not change route paths once frontend starts
- [ ] Do not put Person 2 or Person 3 business logic inside your models
- [ ] Do not make the frontend depend on DB-only internal fields
- [ ] Do not block on Person 2 or Person 3 before finishing your own scaffolding

## Minimum Viable Success Criteria

Person 1 is done enough for the team when:

- [ ] All backend import paths exist
- [ ] All shared models and schemas are stable
- [ ] All API endpoints exist at final paths
- [ ] Market import works end-to-end
- [ ] Person 2 can plug claims generation into your route
- [ ] Person 3 can plug world building and simulation running into your routes
- [ ] Person 4 can code against your responses without contract changes
