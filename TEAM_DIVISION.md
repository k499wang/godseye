# Team Division - 1 Day Hackathon (4 People)

## The Reality

**You have: 1 day (8-12 hours)**
**You need: Working demo for $8500+ in prizes**

## 4 Parallel Work Streams

### **Person 1: Database + Polymarket + API Gateway**

**Time: Full day**

**Responsibilities:**
- Set up FastAPI app structure
- Create ALL database models (copy from schema docs)
- Run Alembic migrations
- Build Polymarket client (fetch market data)
- Create API routes for Person 2, 3, 4 to call
- Deploy backend to Railway

**Deliverables:**
- Database schema deployed to Supabase
- POST /api/markets/import working
- POST /api/claims/generate working
- POST /api/simulations/build-world working
- POST /api/simulations/{id}/start working
- GET /api/simulations/{id} working
- GET /api/reports/{id} working

**Why this person is critical:**
- Everyone else is blocked until database exists
- API routes define the contract for frontend/services
- Must work FAST on database schema (first 2 hours)

**Interface they provide:**
- Database models imported by Person 2 and 3
- API endpoints called by Person 4
- Polymarket data for everyone

---

### **Person 2: LLM Stack + Claims Generation + Apollo**

**Time: Full day (start after hour 2 when DB ready)**

**Responsibilities:**
- **Build LLMClient wrapper** (Lava + LiteLLM routing)
- Claims generation service (LLM-generated claims from market question via Gemini Pro)
- **Apollo.io integration** (3-step realistic agent generation)

**Deliverables:**
- LLMClient class with .complete(), .call_apollo()
- Claims generated from market context
- Apollo.io returning real professional profiles

**Why this person is critical:**
- LLMClient is used by Person 3 for simulation
- Apollo.io is the killer feature for prizes
- Claims generation feeds simulation

**Interface they provide:**
- `from app.core.llm_client import llm_client` for Person 3
- `ApolloEnrichmentService` for realistic agents
- Generated claims for simulation context

---

### **Person 3: Simulation Engine + Report Generation**

**Time: Full day (start after hour 2-3 when DB + LLMClient ready)**

**Responsibilities:**
- World builder (create agents, use Apollo if available)
- Simulation runner (30 tick loop)
- Agent action generation (Gemini Flash via LLMClient)
- Claim sharing mechanics (agents share claims with targeted peers)
- Belief updates
- Trust updates
- Faction detection
- Memory tracking
- Report generation (K2 Think planning, Gemini Pro drafting)

**Deliverables:**
- Agents created (12 agents, Apollo-enhanced if available)
- Simulation runs 30 ticks
- Agent beliefs converge/diverge over time
- Report generated with sections

**Why this person is critical:**
- This IS the demo
- If simulation doesn't run, there's no product
- Hardest technical piece

**Dependencies:**
- Needs Person 1's database models
- Needs Person 2's LLMClient wrapper
- Can start planning/pseudocode while waiting

**Interface they provide:**
- Simulation state for Person 4 to display
- Report data for Person 4 to show

---

### **Person 4: Frontend (Everything UI)**

**Time: Full day (can start early with mock data)**

**Responsibilities:**
- Next.js app setup
- All pages (market import, simulation dashboard, report)
- **Simulation Replay with Agent Debates** (THE critical visualization — our equivalent of MiroFish's knowledge graph)
  - Split-screen main view
  - Left pane: horizontal tick scrubber (1-30) + belief convergence lines
  - Left pane: trust network visualization + faction clusters + claim flow
  - Right pane: chat-style debate feed showing what agents are thinking/saying at that tick
  - Click-to-inspect agent reasoning inside the debate pane
- Polling logic (every 2 seconds during simulation)
- API client (calls Person 1's endpoints)
- Deploy to Vercel

**Deliverables:**
- Market import page (paste Polymarket URL)
- Simulation dashboard with live chart
- Report view page
- All deployed and working

**Why this person is critical:**
- Judges see the frontend, not the backend
- Simulation replay makes or breaks the demo
- Can work independently with mock data initially

**Strategy:**
- Start with mock data immediately (don't wait)
- Build static pages first
- Hook up real API endpoints later (hour 6-8)
- Focus on the split-screen simulation replay

**Dependencies:**
- Minimal - can mock everything initially
- Needs Person 1's API endpoints for final integration

---

## Hourly Coordination

### **Hour 0-1: Setup**
- Person 1: FastAPI scaffold, start database models
- Person 2: Install dependencies, wait for DB
- Person 3: Read docs, plan simulation logic
- Person 4: Next.js setup, start with mock data

### **Hour 1-2: Database Sprint**
- Person 1: **FOCUS** - get all 30 tables created and migrated
- Person 2: Start LLMClient wrapper + claims generation (can do without DB)
- Person 3: Start world builder logic (pseudocode)
- Person 4: Build market import page (mock)

### **Hour 2-3: Integration Begins**
- Person 1: API routes + Polymarket client
- Person 2: **LLMClient finished**, start claims generation service
- Person 3: **Start simulation with real LLMClient**
- Person 4: Build split-screen simulation replay component (mock data)

### **Hour 3-6: Core Build**
- Person 1: Support others, fix API issues, add endpoints as needed
- Person 2: Claims generation + Apollo.io
- Person 3: **Simulation running**, belief updates working
- Person 4: **Simulation replay working with mock data**, polling logic

### **Hour 6-8: Integration**
- Person 1: Deploy backend to Railway
- Person 2: Final Apollo integration, help Person 3
- Person 3: Report generation, simulation polish
- Person 4: **Connect real API**, replace mock data

### **Hour 8-10: Polish**
- Person 1: Monitor backend, fix bugs
- Person 2: Help with any LLM call issues
- Person 3: Test full pipeline
- Person 4: **Deploy frontend**, test full flow

### **Hour 10-12: Prize Submissions**
- Everyone: Record demo video
- Person 2: Write Apollo.io creative submission
- Person 3: Write K2 Think reasoning docs
- Person 4: Polish frontend for screenshots

---

## Critical Path (What Blocks Everything)

```
Hour 0-2: Person 1 database schema
    ↓
Hour 2-3: Person 2 LLMClient wrapper
    ↓
Hour 3-6: Person 3 simulation running
    ↓
Hour 6-8: Person 4 frontend integration
    ↓
Hour 8-10: Full pipeline working
```

**If Person 1 is slow (hour 0-2), everyone is blocked.**
**If Person 2 is slow (hour 2-3), Person 3 is blocked.**
**Person 4 can work independently the whole time.**

---

## Communication Protocol

**Slack/Discord channels:**
- #backend-status (Person 1 posts when DB ready, when API ready)
- #llm-status (Person 2 posts when LLMClient ready)
- #simulation-status (Person 3 posts when simulation working)
- #frontend-status (Person 4 posts when pages ready)
- #blockers (anyone blocked posts here)

**Standups:**
- Hour 2: "Database ready? LLMClient ready?"
- Hour 4: "Simulation running? Frontend pages built?"
- Hour 6: "Integration working? Any blockers?"
- Hour 8: "Demo working end-to-end?"

---

## Minimal Viable Demo

**What you MUST have working:**
1. Import a Polymarket market ✅
2. Claims generated for the market ✅
3. Start simulation ✅
4. See simulation running (agents sharing claims, beliefs converging) ✅
5. View final report ✅

**What you CAN skip if tight on time:**
- Apollo.io (fallback to K2 Think generic agents)
- Fancy UI (raw Tailwind is fine)
- Chat feature
- What-if scenarios

**But seriously try to include Apollo.io** - it's your $500 prize differentiator and only takes 2-3 hours.

---

## What Each Person Needs From Others

### **Person 1 provides:**
→ To Person 2: Database models to import
→ To Person 3: Database models to import, API endpoints
→ To Person 4: API endpoints to call

### **Person 2 provides:**
→ To Person 3: LLMClient wrapper, Apollo service, generated claims
→ To Person 1: Nothing (independent)
→ To Person 4: Nothing (independent)

### **Person 3 provides:**
→ To Person 4: Simulation data structure
→ To Person 1 & 2: Requirements for API/services

### **Person 4 provides:**
→ To everyone: The demo they see
→ To Person 1: Frontend requirements for API

---

## Fallback Plan (If Running Late)

### **Hour 6 - Still no simulation running:**
- Person 3: Reduce to 10 ticks instead of 30
- Person 3: Use 6 agents instead of 12
- Person 2: Skip Apollo.io, use generic K2 agents

### **Hour 8 - Still no frontend integration:**
- Person 4: Show simulation with mock data (fake it)
- Person 3: Record backend terminal output for demo
- Everyone: Focus on making SOMETHING demoable

### **Hour 10 - Still major issues:**
- Reduce to: Market import → Simulation (mock) → Report (mock)
- Make the chart look good with fake data
- Demo the "vision" not the full implementation

---

## Success Metrics

**Minimum viable (still prize eligible):**
- Market imports ✅
- Simulation runs (even with generic agents) ✅
- ONE chart shows something ✅
- Backend deployed ✅
- Frontend deployed ✅

**Target (strong prize contender):**
- All above +
- Apollo.io working (real professional profiles) ✅
- Report generates ✅
- Full pipeline works ✅

**Stretch (prize favorites):**
- All above +
- Claims generation enriching simulation ✅
- Beautiful UI ✅
- Smooth demo ✅

---

## Who Should Be Who

**Person 1 (Database + API Gateway):**
- **Best for:** Most experienced backend dev
- **Skills:** Python, SQL, FastAPI
- **Personality:** Fast executor, doesn't overthink

**Person 2 (LLM + Claims Generation + Apollo):**
- **Best for:** Good with APIs and data transformation
- **Skills:** Python, API integration, LLM prompting
- **Personality:** Detail-oriented, can handle complexity

**Person 3 (Simulation + Reports):**
- **Best for:** Strongest engineer (hardest piece)
- **Skills:** Python, algorithms, complex logic
- **Personality:** Can handle ambiguity and pressure

**Person 4 (Frontend Everything):**
- **Best for:** Frontend specialist
- **Skills:** React, Next.js, TypeScript, design
- **Personality:** Visual thinker, fast iteration

---

## The Reality Check

**You will NOT finish everything.**

**Pick your battles:**
- ✅ Get simulation running (core demo)
- ✅ Get simulation replay working (visual proof — our knowledge graph equivalent)
- ✅ Get Apollo.io working if possible ($500 prize)
- ✅ Deploy something working (credibility)

**Everything else is negotiable.**

**The goal: $8500 in prizes from a 12-hour sprint.**

**Let's go.** 🚀
