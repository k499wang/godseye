# System Architecture & Flow - Prediction Market Analysis

## Overview

This document provides detailed architecture diagrams and flow descriptions for the Polymarket prediction market analysis system.

---

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                           │
│                    (Next.js 15 Frontend)                         │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Market      │  │  Claim       │  │  Simulation  │          │
│  │  Import      │  │  Generation  │  │  Dashboard   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
└─────────┼──────────────────┼──────────────────┼───────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                           │
│                      (FastAPI Backend)                           │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Market      │  │  Claims      │  │  Simulation  │          │
│  │  Routes      │  │  Routes      │  │  Routes      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
└─────────┼──────────────────┼──────────────────┼───────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                               │
│                    (Business Logic)                              │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐│
│  │ Market Ingestion │  │ Claims Generator │  │ World Builder  ││
│  │ Service          │  │ Service          │  │ Service        ││
│  └──────────────────┘  └──────────────────┘  └────────────────┘│
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐│
│  │ Belief Engine    │  │  Trust Engine    │  │ Simulation     ││
│  │                  │  │                  │  │ Runner         ││
│  └──────────────────┘  └──────────────────┘  └────────────────┘│
│  ┌──────────────────┐                                           │
│  │ Report Agent     │                                           │
│  └──────────────────┘                                           │
│                                                                   │
└─────────┼──────────────────┼──────────────────┼───────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA ACCESS LAYER                             │
│                   (SQLAlchemy ORM)                               │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Market      │  │  Claims      │  │  Simulation  │          │
│  │  Models      │  │  Models      │  │  Models      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
└─────────┼──────────────────┼──────────────────┼───────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                                │
│                  (Supabase Postgres)                             │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Relational Tables                                          ││
│  │  - markets, analysis_sessions, claims, entities, etc.      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Polymarket  │  │  Gemini API  │  │  K2 Think V2 │          │
│  │  API         │  │  (Lava)      │  │  (LiteLLM)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## Complete Data Flow Pipeline

### **Phase 1: Market Ingestion**

```
User Action: Paste Polymarket URL or market slug
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ Frontend: POST /api/markets/import                         │
│ Payload: { market_input, title?, user_thesis? }           │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Backend: MarketIngestionService                            │
│ 1. Parse market slug from URL                             │
│ 2. Call Polymarket API                                     │
│ 3. Create Market record                                    │
│ 4. Create MarketSnapshot (freeze orderbook state)         │
│ 5. Create AnalysisSession                                  │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Database: Insert into                                      │
│ - markets (question, probability, volume)                  │
│ - market_snapshots (captured_at, orderbook_json)          │
│ - analysis_sessions (market_id, status: "created")        │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Response: {                                                │
│   market_id: UUID,                                         │
│   analysis_session_id: UUID,                              │
│   question: "Will X happen?",                             │
│   current_probability: 0.67                               │
│ }                                                          │
└────────────────────────────────────────────────────────────┘
```

### **Phase 2: Claims Generation**

```
Trigger: Part of world-building or a separate step after market import
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ Frontend: POST /api/claims/generate                        │
│ Payload: { analysis_session_id }                          │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Backend: ClaimsGeneratorService                            │
│ 1. Fetch market question + resolution criteria            │
│ 2. Build claims generation prompt                         │
│ 3. Call LLM to generate 20-30 relevant claims             │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ LLM Call: Gemini Pro via Lava Gateway                     │
│                                                            │
│ await llm_client.complete(                                │
│   model="gemini-1.5-pro-002",                            │
│   messages=[...]                                           │
│ )                                                          │
│                                                            │
│ Input: Market question + resolution criteria              │
│ Output: JSON array of 20-30 claims                        │
│                                                            │
│ Example Output:                                            │
│ {                                                          │
│   "claims": [                                              │
│     {                                                      │
│       "text": "Fed officials signaled rate cuts in 2024",│
│       "stance": "yes",                                     │
│       "strength_score": 0.8,                              │
│       "novelty_score": 0.6                                │
│     },                                                     │
│     {                                                      │
│       "text": "Inflation remains above target at 3.2%",  │
│       "stance": "no",                                      │
│       "strength_score": 0.7,                              │
│       "novelty_score": 0.5                                │
│     },                                                     │
│     // ... 18-28 more claims                              │
│   ]                                                        │
│ }                                                          │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Worker: Persist claims                                     │
│ 1. Validate claim structure (text, stance, scores)        │
│ 2. Create Claim records in DB                              │
│ 3. Optionally create Entity records if extracted          │
│ 4. Create Relationship records if applicable              │
│                                                            │
│ No document upload, no parsing, no chunking,              │
│ no embeddings needed.                                      │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Database: Insert into                                      │
│ - claims (text, stance, strength_score, novelty_score,    │
│           analysis_session_id)                              │
│ - entities (canonical_name, entity_type, description)     │
│ - relationships (source_id, target_id, type, weight)      │
└────────────────────────────────────────────────────────────┘
```

### **Phase 3: World Building**

```
Trigger: User clicks "Build Simulation"
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ Frontend: POST /api/simulations/build-world                │
│ Payload: { analysis_session_id, num_agents: 12 }         │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Backend: WorldBuilderService                               │
│ 1. Create Simulation record                               │
│ 2. Fetch market question                                   │
│ 3. Prepare agent generation (Apollo-enhanced or generic)  │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Apollo Enhancement (KILLER FEATURE for Lava prizes)       │
│                                                            │
│ Step 1: Determine relevant professional roles             │
│ ┌─────────────────────────────────────────────┐          │
│ │ LLMClient: Gemini Flash via Lava            │          │
│ │ Input: Market question                      │          │
│ │ Output: Relevant titles & industries        │          │
│ └─────────────────────────────────────────────┘          │
│                                                            │
│ Step 2: Search Apollo.io for real professionals          │
│ ┌─────────────────────────────────────────────┐          │
│ │ LLMClient: call_apollo() via Lava Gateway   │          │
│ │ API: Apollo.io                              │          │
│ │ Params: titles, industries, page_size       │          │
│ │ Returns: Real professional profiles         │          │
│ └─────────────────────────────────────────────┘          │
│                                                            │
│ Step 3: Generate personas with K2 Think                   │
│ ┌─────────────────────────────────────────────┐          │
│ │ LLMClient: K2 Think V2 via LiteLLM          │          │
│ │ (For each professional profile)             │          │
│ │ Input: Title, company, industry             │          │
│ │ Output: Forecaster persona with reasoning   │          │
│ └─────────────────────────────────────────────┘          │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ LLM Call: K2 Think V2 via LiteLLM (for deep reasoning)   │
│ Input: Market question + professional profile             │
│ Output: JSON array of 12 agent personas                   │
│                                                            │
│ Example Output (Apollo-enhanced):                         │
│ [                                                          │
│   {                                                        │
│     "name": "Dr. Sarah Chen",                             │
│     "title": "Chief Economist, JP Morgan",               │
│     "company": "JP Morgan Chase",                         │
│     "archetype": "quantitative_analyst",                  │
│     "forecast_style": "Data-driven, focuses on macro...", │
│     "social_style": "Collaborative, shares research",     │
│     "initial_probability": 0.65,                          │
│     "confidence": 0.7,                                     │
│     "risk_tolerance": 0.4,                                │
│     "biases": ["Institutional bias", "Hawkish tilt"],    │
│     "trust_profile": {                                     │
│       "trusts_data": 0.9,                                 │
│       "trusts_experts": 0.8,                              │
│       "trusts_crowd": 0.5                                 │
│     }                                                      │
│   },                                                       │
│   // ... 11 more agents based on real professionals      │
│ ]                                                          │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Worker: Create agents & trust graph                       │
│ 1. Create SimulationAgent records for each persona       │
│ 2. Initialize trust edges (N×N matrix, ~144 edges)       │
│ 3. Set initial trust weights (random 0.3-0.7)            │
│ 4. Update Simulation.world_state_json                     │
│    Include: apollo_enhanced: true                         │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Database: Insert into                                      │
│ - simulations (status: "ready", world_state_json)         │
│ - simulation_agents (×12 agents with real-world personas) │
│ - trust_edges (×144 initial trust relationships)          │
│                                                            │
│ Note: world_state_json includes:                          │
│ {                                                          │
│   "apollo_enhanced": true,                                │
│   "agent_sources": ["JP Morgan", "Goldman Sachs", ...],   │
│   "professional_diversity": 0.85                          │
│ }                                                          │
└────────────────────────────────────────────────────────────┘
```

### **Phase 4: Simulation Execution**

```
Trigger: User clicks "Run Simulation"
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ Frontend: POST /api/simulations/{id}/start                │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Backend: Start worker thread (async)                      │
│ Update simulation.status = "running"                      │
│ Return immediately: { status: "started" }                 │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Worker: SimulationRunner (30 ticks)                       │
│                                                            │
│ FOR tick = 1 to 30:                                       │
│                                                            │
│   1. Load agents & current state                          │
│   2. Retrieve claims (from DB)                            │
│   3. For each agent (parallel):                           │
│      ┌─────────────────────────────────────────────┐     │
│      │ LLM Call: Gemini Flash                      │     │
│      │ Input: Agent state + visible claims         │     │
│      │        + claims shared with you this tick   │     │
│      │ Output: Action (update_belief |             │     │
│      │         share_claim to target agents)       │     │
│      └─────────────────────────────────────────────┘     │
│   4. Process claim shares:                                │
│      - Route shared claims to target agents for next tick │
│   5. Apply actions:                                       │
│      - Update agent probabilities (BeliefEngine)          │
│      - Update trust weights (TrustEngine)                 │
│      - Detect factions (FactionEngine)                    │
│   6. Update agent memories                                │
│   7. Log tick events                                       │
│   8. Persist tick snapshot                                │
│   9. Update simulation.current_tick                       │
│                                                            │
│ END FOR                                                    │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Database: Insert per tick                                  │
│ - simulation_ticks (tick_number, world_summary)           │
│ - simulation_events (event_type, agent_id, payload)       │
│ - agent_actions (action_type, action_payload_json)        │
│ - belief_snapshots (agent_id, probability, confidence)    │
│ - claim_shares (agent_id, claim_id, target_agent_ids,    │
│                  commentary, tick_number)                  │
│ - agent_memories (memory_summary, key_claim_ids)          │
│ - faction_states (faction_key, agent_ids, mean_prob)      │
│                                                            │
│ Update per tick:                                           │
│ - simulation_agents.current_probability                    │
│ - simulation_agents.confidence                             │
│ - trust_edges.trust_weight                                 │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Worker: Finalize simulation                               │
│ 1. Update simulation.status = "completed"                 │
│ 2. Set simulation.completed_at = now()                    │
│ 3. Calculate final metrics:                               │
│    - emergent_probability (mean of agent beliefs)         │
│    - consensus_score (1 - std_dev)                        │
│    - fragmentation_score (faction variance)               │
└────────────────────────────────────────────────────────────┘
```

### **Phase 5: Report Generation**

```
Trigger: Simulation completes OR user requests report
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ Frontend: POST /api/reports/generate                       │
│ Payload: { simulation_id }                                │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Backend: ReportContextService                              │
│ 1. Gather simulation artifacts:                           │
│    - Final agent beliefs                                   │
│    - Key events (high-impact actions)                     │
│    - Faction analysis                                      │
│    - Belief trajectory (convergence data)                 │
│    - Trust network metrics                                │
│ 2. Build report context bundle                            │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Worker: ReportAgent (multi-stage)                         │
│                                                            │
│ Stage 1: Planning (Advanced Reasoning)                   │
│ ┌─────────────────────────────────────────────┐          │
│ │ LLMClient: K2 Think V2 via LiteLLM          │          │
│ │ Input: Simulation context bundle            │          │
│ │ Output: Report outline with sections        │          │
│ │                                             │          │
│ │ Example sections:                           │          │
│ │ - Executive Summary                         │          │
│ │ - Probability Comparison                     │          │
│ │ - Key Drivers                               │          │
│ │ - Faction Analysis                          │          │
│ │ - Trust Dynamics                            │          │
│ │ - Uncertainty Assessment                    │          │
│ │ - Recommendations                           │          │
│ └─────────────────────────────────────────────┘          │
│                                                            │
│ Stage 2: Drafting (High-Quality Writing)                 │
│ ┌─────────────────────────────────────────────┐          │
│ │ LLMClient: Gemini Pro via Lava              │          │
│ │ (For each section, 5-8 calls)               │          │
│ │ Input: Section context + outline            │          │
│ │ Output: Section draft in prose              │          │
│ │                                             │          │
│ │ Provider: Lava (for prize eligibility)      │          │
│ │ Quality: High-quality long-form content     │          │
│ └─────────────────────────────────────────────┘          │
│                                                            │
│ Stage 3: Reflection (Self-Critique)                      │
│ ┌─────────────────────────────────────────────┐          │
│ │ LLMClient: K2 Think V2 via LiteLLM          │          │
│ │ Input: Full draft                           │          │
│ │ Output: Revision notes                      │          │
│ │                                             │          │
│ │ Deep reasoning for:                         │          │
│ │ - Logical consistency check                 │          │
│ │ - Evidence support verification             │          │
│ │ - Gaps or weak arguments                    │          │
│ └─────────────────────────────────────────────┘          │
│                                                            │
│ Stage 4: Finalization                                     │
│ ┌─────────────────────────────────────────────┐          │
│ │ Integrate revisions                         │          │
│ │ Format citations                            │          │
│ │ Generate summary metrics                    │          │
│ └─────────────────────────────────────────────┘          │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Database: Insert into                                      │
│ - reports (                                                │
│     market_probability: 0.67,                             │
│     emergent_probability: 0.58,                           │
│     consensus_score: 0.73,                                │
│     fragmentation_score: 0.42,                            │
│     summary: "Simulation suggests...",                    │
│     status: "completed"                                    │
│   )                                                        │
│ - report_sections (×5-8 sections):                        │
│     - Executive Summary                                    │
│     - Probability Comparison                               │
│     - Key Drivers                                          │
│     - Faction Analysis                                     │
│     - Trust Dynamics                                       │
│     - Uncertainty Assessment                               │
│     - Recommendations                                      │
│                                                            │
│ LLM Usage Summary:                                         │
│ - K2 Think (planning + reflection): 2 calls via LiteLLM  │
│ - Gemini Pro (drafting): 5-8 calls via Lava              │
└────────────────────────────────────────────────────────────┘
```

---

## Simulation Tick Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────┐
│                    SIMULATION TICK N                         │
└─────────────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Load State   │    │ Retrieve     │    │ Build Agent  │
│ - Agents     │    │ Claims       │    │ Context      │
│ - Trust      │    │ (from DB)    │    │ - Memory     │
│ - Memory     │    │              │    │ - Claims     │
│              │    │              │    │ - Trust      │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                    │
       └───────────────────┼────────────────────┘
                           ▼
              ┌────────────────────────┐
              │ FOR EACH AGENT         │
              │ (parallel execution)   │
              └────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │ LLMClient: Route to Gemini Flash     │
        │ via Lava Gateway                     │
        │                                       │
        │ await llm_client.complete(           │
        │   model="gemini-1.5-flash-002",     │
        │   messages=[...]                     │
        │ )                                     │
        │                                       │
        │ Automatic routing:                    │
        │ → Lava Gateway                        │
        │   → Google Gemini Flash API           │
        └───────────┬──────────────────────────┘
                    │
                    ▼
        ┌──────────────────────────────────────┐
        │ LLM Call: Gemini Flash via Lava      │
        │                                       │
        │ System: "You are {agent.name}, a     │
        │ {agent.archetype} forecaster."       │
        │                                       │
        │ Context:                              │
        │ - Your current belief: {probability}  │
        │ - Your confidence: {confidence}       │
        │ - Agents you trust: [{names}]        │
        │ - Recent claims shared: [{claims}]    │
        │ - Claims shared with you this tick:   │
        │   [{incoming_claims}]                 │
        │                                       │
        │ Prompt: "Choose an action: update     │
        │ your belief silently, or share a      │
        │ claim with other agents."             │
        │                                       │
        │ Output (JSON):                        │
        │ {                                     │
        │   "action": "update_belief",          │
        │   "new_probability": 0.62,            │
        │   "confidence": 0.75,                 │
        │   "reasoning": "Given evidence X..."  │
        │ }                                     │
        │ OR                                    │
        │ {                                     │
        │   "action": "share_claim",            │
        │   "claim_id": "uuid",                 │
        │   "target_agent_ids": ["uuid", ...],  │
        │   "commentary": "This is key...",     │
        │   "reasoning": "I want to convince..."│
        │ }                                     │
        │                                       │
        │ Provider: Lava (for prize credit)    │
        │ Cost: ~$0.006 per call               │
        └───────────┬──────────────────────────┘
                    │
                    ▼
        ┌──────────────────────────────────────┐
        │ Collect all agent actions             │
        └───────────┬──────────────────────────┘
                    │
                    ▼
        ┌──────────────────────────────────────┐
        │ Process claim shares                  │
        │                                       │
        │ - Route shared claims to target       │
        │   agents for next tick                │
        │ - Insert into claim_shares table      │
        │ - Buffer incoming claims per agent    │
        └───────────┬──────────────────────────┘
                    │
                    ▼
        ┌──────────────────────────────────────┐
        │ Apply Actions (Sequential)            │
        │                                       │
        │ 1. Update Beliefs (BeliefEngine)     │
        │    - Validate probability in [0,1]    │
        │    - Check confidence bounds          │
        │    - Log belief_snapshot              │
        │                                       │
        │ 2. Update Trust (TrustEngine)        │
        │    - If agents agreed → +trust        │
        │    - If agents disagreed → -trust     │
        │    - Update trust_edges               │
        │                                       │
        │ 3. Detect Factions (FactionEngine)   │
        │    - Cluster agents by probability    │
        │    - Identify coalitions              │
        │    - Log faction_states               │
        └───────────┬──────────────────────────┘
                    │
                    ▼
        ┌──────────────────────────────────────┐
        │ Update Memories                       │
        │                                       │
        │ FOR EACH AGENT:                       │
        │   Generate memory summary via LLM:    │
        │   "Summarize tick events for agent"   │
        │   Store in agent_memories             │
        │                                       │
        │ GLOBAL MEMORY:                        │
        │   Track high-impact events:           │
        │   - Belief shifts > 0.1               │
        │   - Trust breaks                      │
        │   - Faction formations                │
        │   Store in global_memory_events       │
        └───────────┬──────────────────────────┘
                    │
                    ▼
        ┌──────────────────────────────────────┐
        │ Log Tick Snapshot                     │
        │                                       │
        │ - simulation_ticks (world_summary)    │
        │ - simulation_events (all actions)     │
        │ - belief_snapshots (per agent)        │
        └───────────┬──────────────────────────┘
                    │
                    ▼
        ┌──────────────────────────────────────┐
        │ Update Simulation Replay UI (via polling)│
        │                                       │
        │ Frontend polls /simulations/{id}      │
        │ Gets: current_tick, agent_beliefs,    │
        │       trust_edges, faction_states     │
        │ Renders: split-screen simulation      │
        │          replay with:                 │
        │   - Left pane: tick timeline state    │
        │   - Belief convergence lines          │
        │   - Trust network changes             │
        │   - Faction cluster updates           │
        │   - Right pane: agent debate feed     │
        │   - Agent reasoning (on click)        │
        └───────────────────────────────────────┘
```

---

## LLM Routing Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    LLM ROUTING LOGIC                             │
│            (Hybrid: Lava + LiteLLM + Direct SDK)                 │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │   LLMClient      │
                    │   (Wrapper)      │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Lava Gateway │ │  LiteLLM     │ │ Direct SDK   │
    │              │ │              │ │              │
    │ Gemini Flash │ │ K2 Think V2  │ │ (reserved)   │
    │ Gemini Pro   │ │              │ │              │
    │ Apollo.io    │ │              │ │              │
    └──────────────┘ └──────────────┘ └──────────────┘

TASK: Agent action during simulation tick (×12 agents × 30 ticks = 360 calls)
├─ MODEL: Gemini Flash (gemini-1.5-flash-002)
├─ PROVIDER: Lava Gateway (for prize eligibility)
├─ WHY: Fast (< 1s), cheap, 1M context, sufficient reasoning
└─ COST: ~$2 (within Lava $15 free credits)

TASK: Claims generation (1 call per analysis session)
├─ MODEL: Gemini Pro (gemini-1.5-pro-002)
├─ PROVIDER: Lava Gateway (for prize eligibility)
├─ WHY: High-quality structured output, generates 20-30 relevant claims
└─ COST: ~$0.50 (within Lava $15 free credits)

TASK: Apollo.io professional search (for realistic agents, ~1-3 calls)
├─ API: Apollo.io
├─ PROVIDER: Lava Gateway (premium API access)
├─ WHY: Killer feature - real professional profiles for agents
└─ COST: Included in Lava credits

TASK: World building - agent persona generation (1 call)
├─ MODEL: K2 Think V2 (Kindo/K2-Think-V2)
├─ PROVIDER: LiteLLM (Lava doesn't support Together AI)
├─ WHY: Showcases advanced reasoning for prize track
└─ COST: ~$0.50 (within Together AI $25 credit)

TASK: Report planning - outline generation (1 call)
├─ MODEL: K2 Think V2
├─ PROVIDER: LiteLLM
├─ WHY: Multi-step reasoning for report structure
└─ COST: ~$0.50 (within Together AI $25 credit)

TASK: Report drafting - section writing (5-8 calls)
├─ MODEL: Gemini Pro (gemini-1.5-pro-002)
├─ PROVIDER: Lava Gateway
├─ WHY: High-quality long-form content, fast
└─ COST: ~$1 (within Lava $15 free credits)

TASK: Report reflection - revision analysis (1 call)
├─ MODEL: K2 Think V2
├─ PROVIDER: LiteLLM
├─ WHY: Deep reasoning for self-critique
└─ COST: ~$0.50 (within Together AI $25 credit)

TASK: What-if scenario analysis (stretch goal, ~2-5 calls)
├─ MODEL: K2 Think V2
├─ PROVIDER: LiteLLM
├─ WHY: Complex counterfactual reasoning
└─ COST: ~$0.50 per scenario (within Together AI $25 credit)

TOTAL ESTIMATED COST FOR DEMO:
├─ Lava (Gemini + Apollo): ~$4 (have $15 free)
├─ Together AI (K2 Think): ~$2 (have $25 free)
└─ TOTAL: ~$6 (have $40 in free credits)

PRIZE ELIGIBILITY:
✅ Lava prizes ($2000): Using Lava for 360+ Gemini calls + Apollo.io
✅ K2 Think prize ($4500): Using K2 for reasoning tasks
✅ Polymarket prize: Core use case
✅ Harper prize: Enterprise AI agents
```

---

## Frontend Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND STRUCTURE                        │
│                    (Next.js App Router)                      │
└─────────────────────────────────────────────────────────────┘

app/
├─ layout.tsx                  # Root layout (Providers)
├─ page.tsx                    # Landing page
│
├─ market/
│  └─ import/
│     └─ page.tsx              # Market import form
│
├─ session/
│  └─ [sessionId]/
│     ├─ page.tsx              # Session overview
│     ├─ simulation/
│     │  ├─ page.tsx           # Simulation dashboard
│     │  └─ timeline/
│     │     └─ page.tsx        # Simulation Replay with Agent Debates (primary output)
│     └─ report/
│        └─ page.tsx           # Final report view
│
└─ api/                        # API route handlers (proxy)
   ├─ markets/
   ├─ claims/
   ├─ simulations/
   └─ reports/

components/
├─ ui/                         # Base components (if using shadcn)
├─ timeline/                   # Simulation Replay with Agent Debates (PRIMARY OUTPUT)
│  ├─ TimelineScrubber.tsx     # Horizontal tick slider (1-30)
│  ├─ BeliefLineChart.tsx      # Agent probability lines over time
│  ├─ TrustNetworkView.tsx     # Trust edges between agents (updates per tick)
│  ├─ FactionClusterView.tsx   # Faction groupings per tick
│  ├─ AgentReasoningPanel.tsx  # Right-pane debate/reasoning view for selected agent/tick
│  ├─ ClaimImpactView.tsx      # Click claim → see which agents it influenced
│  └─ ClaimFlowArrows.tsx      # Animated arrows showing claim sharing between agents each tick
├─ charts/
│  ├─ ProbabilityLineChart.tsx # Convergence chart (used inside replay)
│  └─ FactionBarChart.tsx      # Faction distribution
├─ market/
│  ├─ MarketCard.tsx
│  └─ MarketImportForm.tsx
├─ simulation/
│  ├─ AgentCard.tsx
│  └─ SimulationControls.tsx
└─ report/
   └─ ReportSection.tsx

lib/
├─ api.ts                      # API client functions
├─ supabase.ts                 # Supabase client setup
└─ utils.ts                    # Helper functions
```

---

## Database Schema Relationships

```
┌──────────────┐
│   markets    │
└──────┬───────┘
       │ 1:N
       ▼
┌────────────────────┐
│ market_snapshots   │
└──────┬─────────────┘
       │ 1:N
       ▼
┌──────────────────────────┐
│  analysis_sessions       │
└──────┬───────────────────┘
       │
       ├─────────── 1:N ──────────┐
       │                           │
       ▼                           ▼
┌─────────────┐           ┌─────────────┐
│   claims    │           │  entities   │
└──────┬──────┘           └──────┬──────┘
       │                         │
       └────────┬────────────────┘
                │ N:M
                ▼
       ┌───────────────────┐
       │  relationships    │
       └───────────────────┘

┌──────────────────────────┐
│  analysis_sessions       │
└──────┬───────────────────┘
       │ 1:N
       ▼
┌─────────────────┐
│  simulations    │
└──────┬──────────┘
       │
       ├────── 1:N ─────┬───────── 1:N ─────┬────── 1:N ──────┐
       │                │                    │                 │
       ▼                ▼                    ▼                 ▼
┌──────────────┐ ┌───────────────┐ ┌──────────────┐ ┌──────────────┐
│ sim_agents   │ │  sim_ticks    │ │ sim_events   │ │ trust_edges  │
└──────┬───────┘ └───────────────┘ └──────────────┘ └──────────────┘
       │
       ├─ 1:N ─┬─ 1:N ──┬─ 1:N ───┬─ 1:N ────┬─ 1:N ────┐
       │       │        │         │          │          │
       ▼       ▼        ▼         ▼          ▼          ▼
    ┌──────┐ ┌─────┐ ┌──────┐ ┌────────┐ ┌─────────┐ ┌──────────┐
    │belief│ │agent│ │global│ │faction │ │narrative│ │ claim    │
    │snaps │ │mems │ │ mems │ │ states │ │ states  │ │ shares   │
    └──────┘ └─────┘ └──────┘ └────────┘ └─────────┘ └──────────┘

claim_shares:
  - agent_id (FK → sim_agents)
  - claim_id (FK → claims)
  - target_agent_ids (UUID[])
  - commentary (text)
  - tick_number (int)

┌─────────────────┐
│  simulations    │
└──────┬──────────┘
       │ 1:1
       ▼
┌──────────────┐
│   reports    │
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────────┐
│ report_sections  │
└──────────────────┘

┌──────────────┐
│   reports    │
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────────┐
│  chat_sessions   │
└──────┬───────────┘
       │ 1:N
       ▼
┌──────────────────┐
│  chat_messages   │
└──────────────────┘
```

---

## API Endpoint Map

```
┌─────────────────────────────────────────────────────────────┐
│                      API ENDPOINTS                           │
└─────────────────────────────────────────────────────────────┘

### Market Ingestion
POST   /api/markets/import
  Request: { market_input, title?, user_thesis? }
  Response: { market_id, analysis_session_id, question, current_probability }

GET    /api/markets/{market_id}
  Response: Market details

GET    /api/markets/{market_id}/snapshots
  Response: List of market snapshots

### Claims
POST   /api/claims/generate
  Request: { analysis_session_id }
  Response: { status: "processing", job_id }

GET    /api/sessions/{session_id}/claims
  Response: List of generated claims

### Simulation
POST   /api/simulations/build-world
  Request: { analysis_session_id, num_agents: 12 }
  Response: { simulation_id, status: "ready" }

POST   /api/simulations/{id}/start
  Response: { status: "started" }

GET    /api/simulations/{id}
  Response: {
    id, status, current_tick, max_ticks,
    agents: [{ name, probability, confidence }],
    started_at, completed_at
  }

GET    /api/simulations/{id}/ticks
  Response: List of tick snapshots

GET    /api/simulations/{id}/events
  Response: Event log

GET    /api/simulations/{id}/claim-shares
  Response: Claim sharing history [{
    agent_id, agent_name, claim_id, claim_text,
    target_agent_ids, commentary, tick_number
  }]

### Reports
POST   /api/reports/generate
  Request: { simulation_id }
  Response: { report_id, status: "generating" }

GET    /api/reports/{id}
  Response: {
    id, market_probability, emergent_probability,
    consensus_score, fragmentation_score,
    sections: [{ title, content }]
  }

### Chat (Stretch Goal)
POST   /api/chat/report
  Request: { report_id, message }
  Response: { response }

POST   /api/chat/agent
  Request: { agent_id, message }
  Response: { response }
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION DEPLOYMENT                     │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  Custom Domain   │    ──────────────────────┐
│  (GoDaddy)       │                          │
└────────┬─────────┘                          │
         │                                     │
         ▼                                     ▼
┌─────────────────────────────┐     ┌─────────────────────────┐
│      Vercel CDN             │     │   Railway/Render        │
│  (Frontend Hosting)         │     │   (Backend Hosting)     │
│                             │     │                         │
│  - Next.js App              │────▶│  - FastAPI App          │
│  - Static Assets            │     │  - Uvicorn Server       │
│  - Edge Functions           │     │  - Worker Threads       │
│  - Auto-scaling             │     │  - 512MB RAM            │
└─────────────────────────────┘     └─────────┬───────────────┘
                                              │
                                              │
                                              ▼
                                    ┌──────────────────────────┐
                                    │   Supabase Cloud         │
                                    │                          │
                                    │  - Postgres Database     │
                                    │  - Connection Pooling    │
                                    │  - Auto-backups          │
                                    └──────────────────────────┘

External Services (API calls):
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Polymarket  │  │ Google Gemini│  │ Together AI  │
│  API         │  │ API          │  │ (K2 Think)   │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Performance Optimization Strategy

### **Backend Optimization**

1. **Database Indexing**
   - Index on `analysis_session_id` (most queries filter by session)
   - Index on `simulation_id` (tick queries)

2. **LLM Call Batching**
   - Parallel agent actions (12 concurrent Gemini calls per tick)
   - Cache claim generation results (dedupe entities/claims)

3. **Async Processing**
   - Simulation in separate thread

### **Frontend Optimization**

1. **Data Fetching**
   - Tanstack Query caching (stale-while-revalidate)
   - Polling interval: 2 seconds (not 100ms)
   - Incremental loading (paginate tick history)

2. **Rendering**
   - Simulation replay: memoize tick snapshots, only re-render changed agents
   - Recharts with memoization for belief line chart
   - Virtual scrolling for event logs
   - Lazy load report sections

---

This architecture supports the full hackathon implementation with clear flows for every component. Ready to build!
