# Project Overview - Polymarket Prediction Market Analyzer

## What We're Building

A multi-agent simulation system that analyzes Polymarket prediction markets by creating a society of realistic AI forecasters who interact, share information, and converge (or diverge) on probability estimates.

**Think:** MiroFish meets Prediction Markets

**The Hook:** Instead of generic AI agents, we use Apollo.io to create agents based on REAL professionals (economists, analysts, VCs) relevant to each market.

---

## The Problem

**Prediction markets show prices, not reasoning.**

When you look at a Polymarket market showing "Trump wins 2024: 67%", you see:
- Current probability
- Trading volume
- Orderbook

**What you DON'T see:**
- What evidence is driving the price?
- What are the competing narratives?
- Where is there disagreement?
- What probability would emerge from informed deliberation?

**Our solution:** Simulate a society of diverse forecasters analyzing the same evidence and see what probability they converge to.

---

## The Solution

### **Phase 1: Ingest Market + Generate Claims**
1. User pastes Polymarket URL
2. System fetches market data (question, current probability, resolution criteria)
3. System uses LLM to generate 20-30 relevant claims and evidence from the market question

### **Phase 2: Build Forecasting Society**
1. System determines relevant professional expertise (via LLM)
2. **Apollo.io searches for real professionals** (e.g., economists for Fed markets, aerospace analysts for SpaceX markets)
3. System generates agent personas based on real job titles, companies, industries
4. Creates 12 diverse agents with different forecasting styles, risk tolerances, biases

### **Phase 3: Run Simulation**
1. Agents start with independent probability estimates
2. Over 30 ticks, agents:
   - Review claims and claims shared by trusted peers
   - Update beliefs based on evidence quality
   - Share specific claims with trusted peers to influence them
   - Selectively share claims with trusted agents + add commentary
   - Form factions around different interpretations
   - Converge or diverge on probability
3. System tracks: belief evolution, trust dynamics, faction formation, narrative spread

### **Phase 4: Simulation Replay with Agent Debates**
1. Generate a **Simulation Replay with Agent Debates** — the primary output
2. User scrubs through ticks 1-30 in a split-screen replay
3. Left side shows the timeline state at that tick:
   - How each agent's belief shifted and why
   - Trust network changes (who started/stopped trusting whom)
   - Faction formation and dissolution
   - Which claims drove the biggest moves
4. Right side shows a chat-style debate view:
   - What each agent is thinking
   - What claims they are reacting to
   - What claims they are sending to other agents
   - Why they changed belief or stayed put
5. User compares market probability vs. emergent consensus
6. User identifies disagreement points, key drivers, and confidence levels
7. System provides recommendations (is the market mispriced?)

---

## Core Features

### **1. Market Import**
- Paste any Polymarket URL
- Fetches current market state (probability, volume, orderbook)
- Freezes snapshot for simulation anchoring

### **2. LLM-Generated Claims**
- Gemini Pro generates 20-30 relevant claims from the market question
- Claims have stance (supports YES or NO), strength scores, and novelty scores
- Covers key entities, events, and arguments on both sides
- No document upload needed — LLM knowledge provides the evidence base

### **3. Apollo.io Agent Enhancement** ⭐ (Killer Feature)
- Search Apollo.io for real professionals relevant to market
- Extract actual job titles, companies, industries
- Generate agent personas based on real backgrounds
- Example: For "Fed rate cut" market → Chief Economist at JP Morgan, Senior Fellow at Brookings, Portfolio Manager at BlackRock

**Why this matters:**
- Realistic expertise distribution
- Real professional biases and perspectives  
- Not generic "Analyst #1, Analyst #2"
- Wins "Most Creative" prize ($500)

### **4. Multi-Agent Simulation**
- 12 agents with diverse archetypes:
  - Bayesian updater (updates incrementally on evidence)
  - Trend follower (follows consensus)
  - Contrarian (bets against crowd)
  - Data skeptic (requires strong evidence)
  - Narrative focused (looks for stories)
  - Quantitative analyst (trusts numbers)
- 30 simulation ticks
- Each tick: agents review claims → update beliefs → selectively share claims with trusted peers
- Each tick, agents choose to: update beliefs silently OR share a specific claim with targeted peers
- Claim sharing creates visible information flow — see which claims spread through the network
- Emergent behavior: trust networks, factions, narrative spread

### **5. Belief & Trust Dynamics**
- **Belief tracking:** Each agent's probability and confidence over time
- **Trust network:** Who trusts whom, how trust evolves
- **Faction detection:** Clusters of agents with similar beliefs
- **Influence scoring:** Which agents move others' beliefs
- **Claim propagation:** Which claims spread furthest, who shared them, and how they influenced beliefs
- **Information flow:** Track how a single claim ripples through the trust network

### **6. Simulation Replay with Agent Debates** (Primary Output)
- **Replaces MiroFish's knowledge graph** as the core visualization
- Split-screen main view
- Left pane: timeline scrubber across ticks 1-30 plus simulation state
- Right pane: chat-style agent debate log for the selected tick
- At each tick, see:
  - **Belief lines** — each agent's probability updating in real-time
  - **Trust network** — edges strengthening/weakening between agents
  - **Faction clusters** — groups forming and splitting
  - **Claim flow** — who shared what claim with whom
  - **Agent debate feed** — what each agent is thinking, saying, and reacting to
- Click any agent at any tick to inspect their reasoning in the debate pane
- Click any claim to see which agents it influenced and how
- Click a claim to see its propagation path through the agent network
- Animated transitions between ticks for smooth playback
- Auto-play mode to watch the full simulation unfold

### **7. Report Generation**
- Executive summary
- Probability comparison (market vs. simulation)
- Key evidence drivers
- Faction analysis (where disagreement exists)
- Trust network insights
- Uncertainty quantification
- Recommendations

---

## Key Technologies

**Backend:**
- FastAPI (Python API framework)
- Supabase (Postgres database)
- Lava (Gemini API gateway + Apollo.io access)
- LiteLLM (K2 Think V2 for advanced reasoning)
- Alembic (database migrations)

**Frontend:**
- Next.js 15 (React framework)
- Tailwind CSS (styling)
- Recharts (probability visualization)
- Tanstack Query (data fetching)

**LLM Stack:**
- Gemini Flash (fast agent actions, 360+ calls) via Lava
- Gemini Pro (claims generation, reports, 30+ calls) via Lava
- K2 Think V2 (world-building, report planning) via LiteLLM
- Apollo.io (professional search) via Lava

**Data Pipeline:**
- Polymarket API → market data
- LLM claim generation → claims database
- Claims fed to agents during simulation

---

## User Flow

1. **User:** Paste Polymarket URL "Will Fed cut rates in March 2025?"
2. **System:** Import market (current probability: 67%)
3. **System:** Generate 25 relevant claims via Gemini Pro
4. **User:** Click "Build Simulation"
5. **System:**
   - Search Apollo.io for economists and Fed watchers
   - Find 12 real professionals (Chief Economist at Goldman Sachs, etc.)
   - Generate agent personas based on their backgrounds
6. **User:** Click "Run Simulation"
7. **System:** 30 ticks, agents review claims and update beliefs
8. **User:** Watch the split-screen simulation replay — scrub through 30 ticks, watch agents share claims, debate them, form factions, and converge to 58%
9. **User:** Read the agent debate feed at each tick, click agents to inspect reasoning, and watch claim sharing and factions form and dissolve
10. **System:** Generate report comparing 67% (market) vs 58% (simulation)
11. **User:** Read report — "Simulation suggests market is overconfident, key uncertainty is inflation data"

---

## What Makes This Special

### **1. Real Professional Profiles (Apollo.io)**
- Not generic "AI Agent #1"
- Actual job titles and companies
- Realistic expertise distribution
- Novel use of contact enrichment for simulation

### **2. Advanced Reasoning (K2 Think V2)**
- Multi-step reasoning for world-building
- Complex belief update logic
- Report planning with reflection

### **3. Interactive Timeline (vs. MiroFish's Knowledge Graph)**
- MiroFish shows a static knowledge graph — we show a **living simulation playback**
- MiroFish uses social media posts — we use **selective claim sharing** where agents strategically choose which claims to share with which peers
- Scrub through 30 ticks of agent interactions
- SEE probability convergence, trust shifts, claim propagation, and faction formation happen
- Judges can understand the full story at a glance

### **4. Real Market Data (Polymarket)**
- Not toy examples
- Actual prediction markets people care about
- Actionable insights (is market mispriced?)

### **5. Enterprise-Ready Architecture**
- Can analyze any prediction market
- Scalable to multiple markets simultaneously
- Clean separation of concerns
- API-first design

---

## Prize Strategy

### **Polymarket Prize**
- Core use case is prediction market analysis
- Ingests real Polymarket markets
- Novel approach to market analysis
- Actionable for traders

### **Lava Best Overall ($1000)**
- 410+ Gemini API calls via Lava
- Apollo.io integration (premium API)
- Showcase unified LLM gateway orchestration

### **Lava Most Creative ($500)**
- Apollo.io-powered realistic agents
- Real professional profiles vs generic AI
- Novel application of contact enrichment

### **Lava Agent MCP ($500)**
- Polymarket MCP integration
- Allows AI agents to query markets
- Reusable by Lava ecosystem

### **K2 Think V2 ($4500)**
- Advanced reasoning for world-building
- Multi-step report planning
- What-if scenario analysis

### **Harper AI Agents in Enterprises**
- Enterprise forecasting tool
- Multi-agent decision support
- Automated market analysis workflow

**Total: $8500+ in prize eligibility**

---

## Success Metrics

**Technical:**
- Market imports successfully ✅
- Claims generated via LLM ✅
- Apollo.io returns real profiles ✅
- Simulation runs 30 ticks ✅
- Agents' beliefs change over time ✅
- Report generates ✅
- Interactive timeline visualizes simulation playback ✅

**Demo:**
- Full pipeline works end-to-end ✅
- Interactive timeline working ✅
- Report compares market vs simulation ✅
- Apollo.io enhancement clear in demo ✅

**Prizes:**
- Lava submissions ready ✅
- K2 Think documentation complete ✅
- Demo video recorded ✅
- Deployed and accessible ✅

---

## Future Extensions (Post-Hackathon)

**If we continue building:**
- Multi-market analysis (compare markets)
- Historical backtesting (did simulation predict correctly?)
- Real-time updates (re-run as new evidence emerges)
- Trading signals (when simulation diverges from market)
- Custom agent creation (user defines agent profiles)
- Larger simulations (50-100 agents)
- Longer timescales (100+ ticks)
- Integration with trading platforms
- API for developers
- Premium features (more Apollo searches, faster simulations)

**But for hackathon: Focus on core demo.**

---

## The Vision

**We're building the future of prediction market analysis.**

Instead of just seeing a price, see the reasoning.
Instead of trusting the crowd, simulate informed deliberation.
Instead of generic AI, use realistic professional expertise.

**Polymarket shows you what the crowd thinks.**
**We show you what informed experts would conclude.**

**The gap between those two numbers? That's alpha.** 📈
