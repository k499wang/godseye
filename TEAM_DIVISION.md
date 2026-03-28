# Team Division — 1 Day Hackathon (4 People)

## Overview

**Goal:** Working demo for $8500+ in prizes in 8-12 hours.

**The core problem with naive parallel development:** Person 3 needs Person 1's DB models AND Person 2's LLMClient before they can write simulation logic. Person 2 needs Person 1's DB models before they can write claims generation. In the naive plan, Person 3 is blocked until hour 3.

**The solution:** Contract-first development. In the first 30-45 minutes, Person 1 writes skeleton model files and Person 2 writes a skeleton LLMClient. These stubs define the exact field names, method signatures, and import paths. Everyone else writes real logic against those stubs from minute one. Person 1 and 2 then fill in the real implementations behind the agreed interfaces.

**Result:** All 4 people write real code from minute one. Everything is consistent because everyone imports from the same stubs.

---

## Critical Rule: The Contract Is Final

Once stubs are committed to git (target: minute 45), **no one changes a field name, method signature, or import path without telling the whole team first.**

These things are the glue between all four workstreams. Changing them unilaterally breaks someone else's code silently.

---

## File Structure (Everyone Must Use These Exact Paths)

All backend code lives under `backend/app/`. All frontend code lives under `frontend/`.

Backend layout:
- `app/core/config.py` — Person 1
- `app/core/database.py` — Person 1
- `app/core/llm_client.py` — Person 2 (stub by minute 30)
- `app/models/market.py` — Person 1
- `app/models/session.py` — Person 1
- `app/models/claim.py` — Person 1 (stub by minute 45)
- `app/models/agent.py` — Person 1 (stub by minute 45)
- `app/models/simulation.py` — Person 1 (stub by minute 45)
- `app/models/claim_share.py` — Person 1 (stub by minute 45)
- `app/models/report.py` — Person 1
- `app/schemas/market.py` — Person 1
- `app/schemas/claim.py` — Person 1
- `app/schemas/simulation.py` — Person 1 and Person 3 agree on this together (critical shared contract)
- `app/schemas/report.py` — Person 1
- `app/services/market_ingestion.py` — Person 1
- `app/services/polymarket_client.py` — Person 1
- `app/services/claims_generator.py` — Person 2
- `app/services/apollo_service.py` — Person 2
- `app/services/world_builder.py` — Person 3
- `app/services/simulation_runner.py` — Person 3
- `app/services/report_agent.py` — Person 3
- `app/api/routes/markets.py` — Person 1
- `app/api/routes/claims.py` — Person 1 (route shell) + Person 2 (service logic)
- `app/api/routes/simulations.py` — Person 1 (route shell) + Person 3 (service logic)
- `app/api/routes/reports.py` — Person 1 (route shell) + Person 3 (service logic)
- `app/workers/simulation_worker.py` — Person 3
- `alembic/` — Person 1

Frontend layout:
- `app/page.tsx` — Person 4 (market import page)
- `app/simulation/[id]/page.tsx` — Person 4 (simulation dashboard and replay)
- `app/reports/[id]/page.tsx` — Person 4 (report view)
- `components/SimulationReplay.tsx` — Person 4 (THE critical component)
- `components/AgentDebateFeed.tsx` — Person 4
- `components/BeliefChart.tsx` — Person 4
- `components/TrustNetwork.tsx` — Person 4
- `components/MarketImport.tsx` — Person 4
- `lib/api.ts` — Person 4 (typed API client)
- `lib/types.ts` — Person 4 (TypeScript types that mirror the backend schemas exactly)

---

## Hour 0 — Stubs First (Minutes 0-45)

**This is the most important phase of the entire hackathon.** Before anyone writes real logic, the following stub files must exist and be committed to git.

### Person 2 commits by minute 30: `app/core/llm_client.py`

The LLMClient stub must define:
- A `complete()` async method that accepts a prompt, an optional system string, a model name, and a response format flag. It returns a string. The stub can return a hardcoded placeholder string — that is enough for Person 3 to write simulation logic against it.
- A `call_apollo()` async method that accepts job titles, keywords, and a limit. It returns a list of dicts. The stub can return an empty list.
- A module-level `llm_client` singleton instance. Everyone imports this singleton — no one creates their own instance.

Model name conventions that must be consistent everywhere:
- `"gemini-flash"` routes to gemini-1.5-flash-002 via Lava (fast, for simulation ticks)
- `"gemini-pro"` routes to gemini-1.5-pro-002 via Lava (smart, for claims and reports)
- `"k2-think"` routes to Kindo/K2-Think-V2 via LiteLLM (reasoning, for world-building and report planning)

### Person 1 commits by minute 45: all model and schema stub files

Each model stub must define the SQLAlchemy class with the correct tablename and all column names — even if the column definitions are minimal. The field names are the contract. Person 2 and Person 3 will write code that reads and writes these exact field names.

**Claim model fields:** id, session_id, market_id, text, stance, strength_score, novelty_score

**Agent model fields:** id, simulation_id, name, archetype, initial_belief, current_belief, confidence, professional_background, trust_scores
- `archetype` values: bayesian_updater, trend_follower, contrarian, data_skeptic, narrative_focused, quantitative_analyst
- `professional_background` is a JSON column storing: title, company, industry, apollo_enriched (bool)
- `trust_scores` is a JSON column storing a dict of other_agent_id to float (0.0–1.0)

**Simulation model fields:** id, session_id, market_id, status, current_tick, total_ticks, tick_data, created_at, completed_at
- `status` values: pending, building, running, complete, failed
- `total_ticks` always defaults to 30
- `tick_data` is a JSON column storing a list of TickSnapshot dicts (see schemas contract below)

**ClaimShare model fields:** id, simulation_id, from_agent_id, to_agent_id, claim_id, commentary, tick_number, delivered
- `delivered` is a boolean, defaults to False
- `tick_number` is the tick when the share was created (recipient sees it on tick_number + 1)

---

## Shared Data Contracts (All Four People Read This Section)

These are the exact data shapes that flow between all four workstreams. Person 3 produces them. Person 1 stores and returns them. Person 4 reads and displays them.

### Claim shape

Fields: id, text, stance (yes or no), strength_score (0.0–1.0), novelty_score (0.0–1.0)

### ProfessionalBackground shape

Fields: title, company, industry, apollo_enriched (bool)

### AgentSummary shape

Fields: id, name, archetype, initial_belief, current_belief, confidence, professional_background (ProfessionalBackground shape)

### AgentTickState shape

Fields: agent_id, name, belief (probability at end of this tick), confidence, action_taken (either "update_belief" or "share_claim"), reasoning (the agent's reasoning text — this is what appears in the frontend debate feed)

### ClaimShareRecord shape

Fields: from_agent_id, from_agent_name, to_agent_id, to_agent_name, claim_id, claim_text, commentary, tick

### TrustUpdate shape

Fields: from_agent_id, to_agent_id, old_trust, new_trust

### TickSnapshot shape

Fields: tick (integer 1–30), agent_states (list of AgentTickState), claim_shares (list of ClaimShareRecord for this tick), trust_updates (list of TrustUpdate for this tick), faction_clusters (list of lists of agent_ids — groups of agents whose beliefs are close)

### SimulationResponse shape (the main API response Person 4 polls)

Fields: id, session_id, market_id, status, current_tick, total_ticks, agents (list of AgentSummary), tick_data (list of TickSnapshot — grows as simulation runs), created_at, completed_at

### MarketResponse shape

Fields: id, polymarket_id, question, resolution_criteria, current_probability (float 0.0–1.0), volume

### ReportResponse shape

Fields: id, simulation_id, market_probability (Polymarket's number), simulation_probability (emergent consensus), summary, key_drivers (list of strings), faction_analysis, trust_insights, recommendation

---

## API Route Contracts (Person 1 implements, Person 4 calls)

These are the exact endpoint signatures. Person 4 builds their entire API client against these from day one using mock data that matches the shapes above.

- `POST /api/markets/import` — accepts a Polymarket URL, returns MarketResponse
- `POST /api/sessions/{market_id}/claims/generate` — returns ClaimsGenerateResponse (session_id, market_id, list of ClaimSchema)
- `POST /api/simulations/build-world` — accepts session_id, returns SimulationResponse with status="building" and agents populated, tick_data empty
- `POST /api/simulations/{id}/start` — returns SimulationResponse with status="running"
- `GET /api/simulations/{id}` — returns SimulationResponse with tick_data growing as simulation runs; this is the polling endpoint
- `GET /api/reports/{simulation_id}` — returns ReportResponse

---

## Agent Action Contract (Person 3 produces, simulation loop processes)

On each tick, every agent LLM call must return exactly one of two JSON shapes.

**Shape 1 — update_belief:** action field set to "update_belief", new_probability (float 0.0–1.0), confidence (float 0.0–1.0), reasoning (string shown in debate feed)

**Shape 2 — share_claim:** action field set to "share_claim", claim_id (must be an id from the visible claims or incoming claims in the agent's prompt), target_agent_ids (list of agent ids, usually 1–2 trusted agents), commentary (string shown in debate feed), reasoning (internal reasoning not shared with other agents)

Person 3 owns the prompt format that produces these responses. Person 1 does not need to know the prompt internals — only the output shape matters for routing and storage.

---

## Person 1: Database + API Gateway + Polymarket

**Full day. Must deliver stubs in the first 45 minutes before writing any real implementations.**

### Phase 1 (Minutes 0-45): Commit All Stubs
- Create full FastAPI scaffold with routers and app entry point
- Create async SQLAlchemy session setup in database.py
- Write all model stub files with correct field names (see Hour 0 section above)
- Write all schema files with correct shapes (see Shared Data Contracts above)
- Commit and announce in `#backend-status`: "Stubs ready. Everyone can start."

### Phase 2 (Hour 1-2): Full DB Implementation
- Flesh out all model files with indexes, relationships, and constraints
- Write and run Alembic migrations against Supabase
- Announce in `#backend-status`: "DB migrations done."

### Phase 3 (Hour 2-4): API Routes + Polymarket Client
- Build Polymarket HTTP wrapper (no official Python SDK exists — use httpx with retry logic)
- Build market ingestion service: parses URL slug, fetches market data, saves to DB
- Build route shells for all endpoints listed in API Route Contracts
- Wire Person 2's claims_generator into the claims route

### Phase 4 (Hour 4-6): Integration + Deploy
- Wire Person 3's world_builder into POST /api/simulations/build-world
- Wire Person 3's simulation_worker into POST /api/simulations/{id}/start
- Deploy to Railway
- Post Railway URL to `#backend-status`

### What Person 1 provides to others
- To Person 2: DB models importable from app.models.claim and app.models.session
- To Person 3: DB models importable from app.models.agent, app.models.simulation, app.models.claim_share
- To Person 4: All API endpoints at the exact paths listed above

---

## Person 2: LLMClient + Claims Generation + Apollo

**Full day. LLMClient stub must be committed within 30 minutes — this is the single most important early action of the whole hackathon.**

### Phase 1 (Minutes 0-30): Commit LLMClient Stub
- Create llm_client.py with the stub interface described in Hour 0
- The stub just returns placeholder strings — that is enough to unblock Person 3
- Commit and announce in `#llm-status`: "LLMClient stub committed. Person 3 can start."

### Phase 2 (Hour 1-3): Real LLMClient Implementation
- Implement complete() to route by model name: gemini-flash and gemini-pro go through Lava, k2-think goes through LiteLLM
- When response_format is "json", append a JSON instruction to the prompt and parse the response before returning
- Implement call_apollo() via Lava's Apollo.io endpoint
- Announce in `#llm-status`: "Real LLMClient done."

### Phase 3 (Hour 2-4): Claims Generation Service
- claims_generator.py takes market_id and session_id
- Loads market question and resolution criteria from DB
- Sends one Gemini Pro prompt asking for 20-30 structured claims with stance, strength_score, and novelty_score
- Parses the JSON response and saves each claim to the DB as a Claim model
- Returns ClaimsGenerateResponse

**The claims generation prompt must ask for:** claim text, stance (yes or no — where yes means the claim supports the market resolving YES), strength_score (how strong is this evidence), novelty_score (how surprising or non-obvious is this claim)

### Phase 4 (Hour 3-6): Apollo Integration
- apollo_service.py exposes get_relevant_professionals(market_question) returning a list of ProfessionalBackground
- First calls Gemini Pro to extract relevant job titles and keywords from the market question
- Then calls llm_client.call_apollo() with those titles and keywords
- Maps the Apollo response to the ProfessionalBackground shape
- Falls back to K2 Think-generated synthetic profiles if Apollo returns fewer than 6 results
- Announce in `#llm-status`: "Apollo service ready."

### What Person 2 provides to others
- To Person 3: llm_client singleton importable from app.core.llm_client
- To Person 3: apollo_service importable from app.services.apollo_service
- To Person 1: claims_generator service for Person 1 to wire into the claims route

---

## Person 3: Simulation Engine + Report Generation

**Full day. Can start writing real simulation logic from minute one because Person 2's stub exists within 30 minutes. Write against the stubs — real implementations arrive behind them.**

### Phase 1 (Minutes 0-30): Start Writing Against Stubs
- Do not wait. Person 2's LLMClient stub is available within 30 minutes.
- Import from app.core.llm_client and app.models immediately — stubs exist
- Start writing simulation_runner.py structure, agent tick logic, and the tick loop
- If a model file is not committed yet, write a local dataclass with the same field names and swap to the real import when Person 1 commits

### Phase 2 (Hour 1-3): World Builder
- world_builder.py exposes build_world(session_id, simulation_id) returning a list of Agent DB objects
- Calls apollo_service.get_relevant_professionals() to get real personas, or falls back to K2 Think-generated synthetic backgrounds
- Creates 12 agents covering all 6 archetypes (2 of each): bayesian_updater, trend_follower, contrarian, data_skeptic, narrative_focused, quantitative_analyst
- Assigns initial beliefs spread across 0.35–0.65 based on archetype
- Assigns initial trust scores between agents (0.4–0.8 range, partially randomized)
- Saves all Agent models to DB

### Phase 3 (Hour 2-5): Simulation Runner

**The loop runs for 30 ticks. Each tick:**

1. Load all agents for the simulation from DB
2. Load all claims for the session from DB
3. Select visible_claims: rank all claims by (0.7 × strength_score + 0.3 × novelty_score), take the top 4 yes-stance claims and top 4 no-stance claims
4. Load pending ClaimShares where tick_number equals the current tick and delivered is False, grouped by to_agent_id — these become incoming_claims for each agent
5. For each agent, build a private prompt containing: the agent's name and archetype, current belief and confidence, list of trusted agents with trust weights, the visible_claims list, and the incoming_claims specific to that agent
6. Call llm_client.complete() with model="gemini-flash" and response_format="json"
7. Parse the response into either an update_belief action or a share_claim action (see Agent Action Contract)
8. Apply the action: if update_belief, update agent.current_belief and agent.confidence in DB; if share_claim, create a new ClaimShare record with delivered=False
9. Update trust scores: when an agent shares a claim, increase trust toward the target by 0.02; when an agent ignores a received claim, decrease trust toward the sender by 0.01
10. Detect factions: group agents whose beliefs are within 0.08 of each other
11. Build a TickSnapshot dict using the shapes defined in Shared Data Contracts and append it to simulation.tick_data
12. Update simulation.current_tick
13. Mark all ClaimShares processed this tick as delivered=True

**Key simulation rules:**
- Claim stance belongs to the claim and never changes — it is set at generation time
- Agent belief belongs to the agent — it changes every tick based on evidence
- Shares are not instant: a claim shared at Tick N appears in the recipient's prompt at Tick N+1
- The backend is the mailman — agents never directly read each other's prompts

### Phase 4 (Hour 5-7): Report Generation
- report_agent.py generates the final report after the simulation completes
- First calls K2 Think to plan the report structure with multi-step reasoning over the tick_data summary
- Then calls Gemini Pro to draft each section: executive summary, probability comparison, key evidence drivers, faction analysis, trust network insights, recommendation
- Saves to Report DB model and returns ReportResponse

**The report's simulation_probability field** is the average agent belief at the final tick (tick 30).

### What Person 3 provides to others
- To Person 1: simulation_worker.run_simulation(simulation_id) async function for Person 1 to wire into the start route
- To Person 4: The SimulationResponse shape with tick_data (Person 4 builds the replay UI against this)

---

## Person 4: Frontend (Everything UI)

**Full day. Start immediately with mock data. Never blocked.**

### Phase 1 (Hour 0-1): Setup + Types
- Initialize Next.js 15 app with TypeScript and Tailwind
- Create lib/types.ts with TypeScript interfaces that exactly mirror every shape in the Shared Data Contracts section above — field names and types must match exactly
- Create lib/mockData.ts with hardcoded data matching those types (3 agents, 5 ticks is enough to build all UI components)

### Phase 2 (Hour 1-4): Build All Pages With Mock Data

**Priority order:**

1. SimulationReplay.tsx — the critical demo component. Split-screen. Left pane: horizontal tick scrubber (1–30) plus a Recharts line chart with one line per agent (x=tick, y=belief 0–1) plus trust network visualization plus faction cluster display. Right pane: chat-style debate feed showing each agent's reasoning and claim shares at the selected tick. Clicking a tick on the scrubber updates both panes simultaneously.
2. AgentDebateFeed.tsx — at each tick, shows each agent's reasoning field and any ClaimShareRecords where they are the sender
3. BeliefChart.tsx — standalone Recharts line chart reused inside SimulationReplay
4. Market import page (app/page.tsx) — text input for Polymarket URL and a submit button
5. Report view page (app/reports/[id]/page.tsx) — displays all ReportResponse fields

### Phase 3 (Hour 4-6): API Client + Polling
- Build lib/api.ts with typed functions for every endpoint in the API Route Contracts section
- Use Tanstack Query for all data fetching
- Polling: use refetchInterval of 2000ms while simulation status is "running"
- Stop polling when status is "complete" or "failed"
- As tick_data grows with each poll, the scrubber and chart update automatically

### Phase 4 (Hour 6-8): Connect Real API, Replace Mock Data
- When Person 1 posts the Railway URL to `#backend-status`, set NEXT_PUBLIC_API_URL and test each route
- Replace mock data with real API calls one page at a time
- Test the full user flow: import market → generate claims → build world → start simulation → watch replay → view report

### Phase 5 (Hour 8-10): Deploy + Polish
- Deploy to Vercel, set NEXT_PUBLIC_API_URL env var in the Vercel dashboard
- Post Vercel URL to `#frontend-status`

### What Person 4 provides to others
- To everyone: the demo. The split-screen simulation replay is the judge-facing proof the system works.

---

## Hourly Coordination Plan

### Hour 0 (Minutes 0-45): Stubs Committed
- Person 1: FastAPI scaffold + all model stubs + all schema files committed
- Person 2: LLMClient stub committed, announced in `#llm-status`
- Person 3: Start writing simulation_runner.py and world_builder.py structure against stubs
- Person 4: Next.js setup + create lib/types.ts from the Shared Data Contracts section + build mock data

Checkpoint: Can Person 3 import llm_client without error? Can Person 2 import Claim model without error? Resolve before anything else.

### Hour 1-2: Database Sprint
- Person 1: Full model implementations + Alembic migrations. Announce "DB ready" in `#backend-status`.
- Person 2: Real LLMClient implementation. Start claims generator.
- Person 3: World builder logic. Simulation loop with real DB model imports.
- Person 4: Build SimulationReplay component with mock data.

### Hour 2-3: Core Services
- Person 1: API routes for market import and claims. Wire in Person 2's claims_generator.
- Person 2: Claims generator finished. Start Apollo service.
- Person 3: Start simulation runner. Wire in real LLMClient when Person 2 announces it's done.
- Person 4: AgentDebateFeed and BeliefChart components.

### Hour 3-6: Everything Running
- Person 1: Deploy backend. Support incoming bugs. Wire in Person 3's world_builder.
- Person 2: Apollo service finished. Help Person 3 debug LLM prompt issues.
- Person 3: Simulation running end-to-end. Announce in `#simulation-status`.
- Person 4: Full mock simulation replay working. Start polling logic.

### Hour 6-8: Integration
- Person 1: Post Railway URL to `#backend-status`.
- Person 2: Report agent service. Write K2 Think submission docs.
- Person 3: Report generation. Test full pipeline.
- Person 4: Replace mock data with real API. Test end-to-end.

### Hour 8-10: Polish + Deploy
- Person 1: Monitor backend, fix bugs.
- Person 2: Help with LLM debugging.
- Person 3: Full pipeline test. Reduce to 10 ticks if running slow.
- Person 4: Deploy to Vercel. Polish UI. Record demo.

### Hour 10-12: Submissions
- Person 2: Apollo.io creative submission writeup
- Person 3: K2 Think reasoning documentation
- Person 4: Screenshots and demo video
- Everyone: Prize submission forms

---

## Communication Protocol

- `#backend-status` — Person 1 posts: "Stubs committed", "DB migrations done", "Railway URL: ..."
- `#llm-status` — Person 2 posts: "LLMClient stub committed", "Real LLM ready", "Apollo ready"
- `#simulation-status` — Person 3 posts: "World builder working", "Simulation running end-to-end"
- `#frontend-status` — Person 4 posts: "Mock replay working", "Vercel URL: ..."
- `#blockers` — Anyone blocked posts here immediately

Standups:
- Hour 1: "Stubs committed? Can everyone import without error?"
- Hour 3: "DB ready? LLMClient real? Simulation loop started?"
- Hour 5: "Simulation running? Frontend mock done?"
- Hour 7: "Integration working? Any blockers?"
- Hour 9: "Demo working end-to-end?"

---

## Critical Path

Minute 30: Person 2 commits LLMClient stub → Person 3 can write all simulation logic

Minute 45: Person 1 commits all model stubs and schemas → Person 2 can write claims generator, Person 3 can write world builder, Person 4 has all TypeScript types and can build all UI components

Hour 2: Person 1 finishes real DB migrations → Person 2 and Person 3 can persist to DB for real

Hour 3: Person 2 finishes real LLMClient → Person 3 simulation loop makes real LLM calls

Hour 6: Person 3 simulation running end-to-end → Person 4 can test with real data shapes

Hour 6: Person 1 deploys to Railway → Person 4 can replace mock data with real API calls

Hour 8: Full pipeline working

If Person 2 does not commit LLMClient stub by minute 30, Person 3 is blocked from writing any simulation logic. This is the only hard early blocker.

If Person 1 does not commit model stubs by minute 45, Person 2 cannot write claims generator and Person 3 cannot write world builder. Model stubs must be committed before real implementations are written.

Person 4 is never blocked. Mock data matches the real schema exactly because lib/types.ts is written from the Shared Data Contracts section. When the real API is ready, it just works.

---

## Fallback Plan

Hour 6 — simulation not running: reduce to 6 agents and 10 ticks. Skip Apollo.io and use K2 Think-generated synthetic personas instead.

Hour 8 — frontend not integrated: demo with mock data. The UI is the demo, not the backend.

Hour 10 — major issues: strip down to market import → static simulation output → report. Demo the vision, not the full implementation.

---

## Minimal Viable Demo

Must have:
1. Import a Polymarket market
2. Claims generated for the market
3. Simulation starts and runs
4. Simulation replay shows agents updating beliefs over ticks
5. Final report generated

Can skip if tight: Apollo.io (fall back to K2-generated personas), trust network visualization, fancy animations, what-if scenarios

Try hard to include Apollo.io — it is the $500 Most Creative prize differentiator and only takes 2-3 hours.

---

## How The System Works (Context For All AI Coding Agents)

Every person's code must be consistent with this mental model.

**The claim pool:** One LLM call at the start generates 20-30 claims for the market. Each claim has a stance (yes or no) indicating which direction it points relative to the market outcome. Stance belongs to the claim and never changes. It is set once at generation time.

**Agent beliefs:** Each of the 12 agents has its own belief (probability 0.0–1.0). Belief belongs to the agent, not the claim. Two agents can see the same claim and react differently.

**Each tick:** Every agent gets its own private prompt containing their current belief and confidence, a selection of visible claims from the shared pool (top 4 yes + top 4 no ranked by strength and novelty), and any claims specifically sent to them by other agents in the previous tick. Each agent returns exactly one action: update their own belief OR share one claim with a targeted peer.

**Claim shares are not instant:** If Agent A shares a claim to Agent B at Tick 1, Agent B sees it in Tick 2. The backend stores the share and injects it into the recipient's next prompt. The backend is the mailman — agents never directly see each other's prompts.

**The frontend output:** The primary deliverable is the Simulation Replay with Agent Debates. Split-screen. Left: tick scrubber 1–30, belief convergence line chart per agent, trust network, faction clusters. Right: chat-style feed showing each agent's reasoning and claim shares at the selected tick. This is what judges see. This is the demo.
