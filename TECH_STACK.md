# Complete Tech Stack - Prediction Market Analysis System

## Overview

Polymarket prediction market analysis system using MiroFish-inspired multi-agent simulation. This stack is optimized for **$8500+ in prize eligibility** across 6 tracks.

**Target Prizes:**
1. Polymarket - Most impressive prediction market hack
2. Lava Best Overall ($1000) - Using Lava for Gemini + Apollo.io
3. Lava Most Creative ($500) - Apollo.io-powered realistic agents
4. Lava Agent MCP ($500) - Polymarket MCP integration
5. K2 Think V2 ($4500) - Advanced reasoning implementation
6. Harper - Personal AI Agents in Enterprises

---

## Core Technology Stack

### **Backend (Python)**

| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.11+ | Runtime |
| **FastAPI** | 0.115+ | REST API framework |
| **Uvicorn** | 0.32+ | ASGI server |
| **SQLAlchemy** | 2.0+ | ORM with async support |
| **Pydantic** | 2.10+ | Data validation |
| **asyncpg** | 0.30+ | Async Postgres driver |
| **httpx** | 0.28+ | Async HTTP client |
| **Lava** | 1.0+ | Gemini gateway + Apollo.io access |
| **LiteLLM** | 1.55+ | K2 Think V2 access only |
| **python-dotenv** | 1.0+ | Environment variables |
| **alembic** | 1.14+ | Database migrations |

**Key Backend Design:**
- FastAPI over Flask for async support and automatic API docs
- SQLAlchemy 2.0 for async ORM patterns
- Lava for Gemini calls (prize eligibility) + Apollo.io access
- LiteLLM only for K2 Think (Lava doesn't support Together AI)

---

### **Frontend (TypeScript/React)**

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20+ | Runtime |
| **Next.js** | 15+ | React framework with App Router |
| **TypeScript** | 5.7+ | Type safety |
| **React** | 19+ | UI library |
| **Tailwind CSS** | 3.4+ | Styling (no component library for MVP) |
| **Recharts** | 2.15+ | Data visualization |
| **Tanstack Query** | 5.62+ | Data fetching/caching |
| **Supabase JS** | 2.48+ | Database client |
| **Axios** | 1.7+ | HTTP client |
| **date-fns** | 4.1+ | Date utilities |

**Key Frontend Design:**
- Next.js App Router for modern routing and server components
- Raw Tailwind only for MVP (no shadcn/ui initially)
- Recharts for split-screen simulation replay timeline (critical for demo — our equivalent of MiroFish's knowledge graph)
- Tanstack Query for smart caching and auto-refetching
- Polling (2 second interval) for live simulation updates

---

### **Database (Supabase/Postgres)**

| Technology | Version | Purpose |
|------------|---------|---------|
| **Supabase** | Cloud | Hosted Postgres + auth |
| **PostgreSQL** | 15+ | Relational database |

**Supabase Features Used:**
- Postgres database (all structured data)
- Supabase Auth (stretch goal for user authentication)

**Database Design:**
- 20+ tables tracking markets → sessions → simulations → reports
- UUID primary keys for all core tables
- created_at and updated_at timestamps on mutable tables
- Foreign key path: markets → analysis_sessions → simulations → reports

---

### **AI/LLM Stack (Hybrid Architecture)**

| Provider | Model | Access Method | Purpose | Context | RPM Limit |
|----------|-------|---------------|---------|---------|-----------|
| **Google Gemini** | gemini-1.5-flash-002 | **Lava** | Fast agent actions (360+ calls) | 1M tokens | 1,500 RPM |
| **Google Gemini** | gemini-1.5-pro-002 | **Lava** | Claims generation, reports (50+ calls) | 2M tokens | 360 RPM |
| **K2 (Together AI)** | Kindo/K2-Think-V2 | **LiteLLM** | Complex reasoning (5-10 calls) | 128K tokens | TBD |

**LLM Routing Strategy:**
- **Fast, frequent calls during simulation (360+ calls)**: Use gemini-1.5-flash-002 via Lava for prize eligibility
- **Claims generation and report generation (50+ calls)**: Use gemini-1.5-pro-002 via Lava for prize eligibility
- **Complex reasoning tasks (5-10 calls)**: Use K2-Think-V2 via LiteLLM for K2 prize track

**Why This Hybrid Approach:**
- Lava for Gemini: Qualifies for Lava prizes ($2000), gives Apollo.io access
- LiteLLM for K2 Think: Lava doesn't support Together AI (where K2 is hosted)
- Unified via LLMClient wrapper: Clean abstraction hides complexity from services

**Critical Implementation:**
- Create LLMClient wrapper class that routes based on model name
- LLMClient.complete() method for all LLM calls
- LLMClient.call_apollo() method for Apollo.io premium API

---

### **Premium APIs (via Lava)**

| API | Purpose | Access | Use Case |
|-----|---------|--------|----------|
| **Apollo.io** | Contact enrichment | Lava | Realistic agent personas from real professionals |
| **Dune** | Crypto analytics | Lava | Crypto market data (optional) |
| **FRED** | Economic data | Lava | Macro indicators (optional) |

**Apollo.io Integration (Killer Feature):**
- Search for real professionals relevant to each prediction market
- Extract job titles, companies, industries from actual profiles
- Generate agent personas based on real backgrounds (not generic AI personas)
- Cost: ~$0.25 per simulation via Lava credits
- Prize value: $500 "Most Creative" track

---

### **External APIs**

| API | Purpose | Auth | Rate Limits |
|-----|---------|------|-------------|
| **Polymarket Gamma** | Market data | None (public) | Unknown (add retry) |
| **Polymarket CLOB** | Orderbook | None | Unknown (add retry) |

**Polymarket API Endpoints:**
- GET /markets - List all markets
- GET /markets/{slug} - Market details
- GET /markets/{id}/orderbook - Current orderbook
- GET /markets/{id}/trades - Trade history

**Custom Client Required:**
- No official Python SDK exists
- Build simple HTTP wrapper with httpx
- Implement retry logic for rate limits
- Parse market slug from URL inputs

---

## Environment Variables

### **Backend (.env)**

Required variables:
- DATABASE_URL: PostgreSQL connection string with asyncpg driver
- SUPABASE_URL: Supabase project URL
- SUPABASE_SERVICE_KEY: Supabase service role key
- LAVA_API_KEY: For Gemini (via Lava) + Apollo.io
- TOGETHER_API_KEY: For K2 Think V2 (via LiteLLM)
- ENVIRONMENT: development or production
- LOG_LEVEL: INFO or DEBUG
- SIMULATION_MAX_TICKS: 30

### **Frontend (.env.local)**

Required variables:
- NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anonymous key
- NEXT_PUBLIC_API_URL: Backend API URL (http://localhost:5001 for dev)

---

## Third-Party Services

### **Required (Free Tier)**

| Service | Purpose | Signup | Free Tier |
|---------|---------|--------|-----------|
| **Supabase** | Database | https://supabase.com | 500MB DB |
| **Lava** | LLM Gateway + Premium APIs | https://www.lavanet.xyz | $15 free ($10 signup + $5 Discord) |
| **Together AI** | K2 Think V2 | https://together.ai | $25 free credit |

### **Stretch Goals (Optional)**

| Service | Purpose | Signup | Free Tier |
|---------|---------|--------|-----------|
| **Auth0** | User authentication | https://auth0.com | 7,000 MAU |
| **GoDaddy** | Custom domain | https://godaddy.com | N/A (paid) |

---

## Prize Tracks

**Total Potential: $8500+ confirmed prizes**

| Sponsor | Prize Track | Amount | Strategy |
|---------|-------------|--------|----------|
| **Polymarket** | Most impressive prediction market hack | TBD | Core use case - multi-agent market analysis |
| **Lava** | Best Overall Implementation | $1000 | Use Lava for 410+ Gemini calls + Apollo.io |
| **Lava** | Most Creative | $500 | Apollo.io-powered realistic agent personas |
| **Lava** | Agent MCP Bonus | $500 | Polymarket MCP integration submission |
| **K2 Think V2** | Best Reasoning Implementation | $4500 | Use K2 for world-building, planning, what-if |
| **Harper** | Personal AI Agents in Enterprises | Prize | Frame as enterprise forecasting tool |

**How This Stack Qualifies:**

**Lava Prizes ($2000):**
- Using Lava for all Gemini API calls (360+ agent actions via Flash, 50+ claims generation/reports via Pro)
- Using Apollo.io for creative agent persona generation (real professionals, not generic AI)
- Submitting Polymarket MCP integration for agent marketplace

**K2 Think V2 Prize ($4500):**
- Using K2 for complex reasoning: world-building (analyzing professional backgrounds), report planning (multi-step outline), what-if scenarios (counterfactual reasoning)
- Showcasing multi-step reasoning in real-world forecasting context

**Polymarket Prize:**
- Core product is prediction market analysis
- Ingests real Polymarket markets
- Produces actionable forecasting insights

**Harper Prize:**
- AI agents solving enterprise problem (market research/forecasting)
- Multi-agent system with decision-making workflows

---

## Project Structure

Recommended Python backend structure:
- backend/app/api/routes/ - API endpoints (markets, simulations, reports, chat)
- backend/app/core/ - Config, DB, logging, LLMClient wrapper
- backend/app/models/ - SQLAlchemy models (market, simulation, report)
- backend/app/schemas/ - Pydantic schemas for requests/responses
- backend/app/services/ - Business logic (market_ingestion, claims_generator, world_builder, simulation_runner, report_agent)
- backend/app/workers/ - Background jobs (simulation_worker, report_worker)
- backend/alembic/ - Database migrations

Recommended Next.js frontend structure:
- frontend/app/ - Next.js 15 App Router pages
- frontend/components/ - React components (timeline replay, debate feed, charts, claim flow visualization, market, simulation, report)
- frontend/lib/ - Utilities (api client, supabase client, helpers)
- frontend/public/ - Static assets

---

## Performance Targets

**Backend:**
- API response time: < 200ms (non-LLM endpoints)
- Claims generation: < 15s per market
- Simulation tick: < 2s per tick
- Full simulation (30 ticks): < 2 minutes

**Frontend:**
- Initial page load: < 2s
- Client-side navigation: < 100ms
- Chart render time: < 500ms
- Polling interval: 2 seconds

**Database:**
- Query latency: < 50ms (indexed queries)
- Concurrent connections: Up to 20

---

## Cost Estimates (Free Tier)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Supabase | $0 | Within free tier (< 500MB DB) |
| Lava | $0 | $15 free credits covers demo |
| Together AI (K2) | $0 | $25 free credit covers demo |
| Vercel | $0 | Within free tier |
| Railway | $0-5 | $5 credit, then $5-10/month |
| **Total** | **$0-10** | Fully within free tiers for hackathon |

**Expected Demo Usage:**
- Agent actions (360 calls): ~$2 via Lava
- Claims generation (50 calls): ~$3 via Lava
- Apollo.io (1 search): ~$0.25 via Lava
- World-building (1 call): ~$0.50 via LiteLLM
- Report planning (1 call): ~$0.50 via LiteLLM
- Report drafting (8 calls): ~$1 via Lava
- **Total: ~$7.25** (have $40 in free credits)

---

## Development Workflow

**Local Development:**
- Terminal 1: Backend - uvicorn app.main:app --reload --port 5001
- Terminal 2: Frontend - npm run dev (Next.js on port 3000)
- Terminal 3: Database - Supabase cloud (no local needed)

**Database Migrations:**
- Create migration: alembic revision --autogenerate -m "Description"
- Apply migration: alembic upgrade head
- Rollback: alembic downgrade -1

**Testing:**
- Backend tests: pytest tests/
- Frontend tests: npm run test

---

## Deployment Stack

| Component | Platform | Free Tier | Notes |
|-----------|----------|-----------|-------|
| **Frontend** | Vercel | 100GB bandwidth | Auto-deploy from GitHub |
| **Backend** | Railway or Render | $5 credit | Auto-deploy from GitHub |
| **Database** | Supabase | 500MB DB | Auto-backups included |

**Deployment Configuration:**
- Frontend: Build with Next.js, output to .next/, set env vars in Vercel dashboard
- Backend: Install requirements.txt, start with uvicorn, set env vars in Railway/Render
- Database: Supabase managed, connection string in DATABASE_URL env var

---

## MVP Scope (Core Features)

**Must Have (Days 1-3):**
- Polymarket market import
- LLM claims generation (entities, claims, relationships)
- World builder (agent generation with Apollo.io option)
- Simulation engine (30 ticks) + claim sharing between agents
- Belief + trust updates
- Report generation
- Simulation Replay with Agent Debates (split screen, tick scrubber, belief lines, debate feed, trust network, factions)

**Nice to Have (Day 4):**
- Click-to-inspect agent reasoning at any tick
- Agent personality cards
- Auto-play mode for replay timeline
- Post-simulation chat

**Stretch (Last 2 Hours):**
- Auth0 integration
- Custom domain
- Polish + animations

---

## Why This Stack?

**Python Backend:**
- Best LLM ecosystem (Lava, LiteLLM, etc.)
- Excellent async support (FastAPI + asyncpg)
- Strong scientific computing libraries
- Easy integration with AI APIs

**Next.js Frontend:**
- Best React framework for production
- Built-in API routes (can proxy backend)
- Server components (fast initial load)
- Vercel deployment (one command)

**Supabase:**
- Managed Postgres with generous free tier
- No DevOps overhead
- Built-in auth

**Lava + LiteLLM Hybrid:**
- Lava: Qualifies for prizes, gives Apollo.io access
- LiteLLM: Handles K2 Think (Lava doesn't support)
- LLMClient wrapper: Clean unified interface

---

## Alternatives Considered (and Rejected)

| Technology | Why Rejected |
|------------|--------------|
| **MongoDB** | Already architected for Postgres |
| **Solana** | Massive scope creep, not aligned with core value |
| **Auth0 (MVP)** | Supabase auth simpler, Auth0 for polish only |
| **shadcn/ui (MVP)** | Raw Tailwind faster for hackathon |
| **D3.js** | Recharts simpler and React-friendly |
| **Celery** | Python threading sufficient for single-machine |
| **WebSockets** | Polling simpler for MVP |
| **Pure LiteLLM** | Lava needed for prizes + Apollo.io access |

---

## Next Steps

1. Read TECH_STACK_FINAL.md (this document)
2. Reference ARCHITECTURE_FLOW.md when pieces need to connect
3. Review PLAN.md for the build plan
4. Check PROJECT_OVERVIEW.md and TEAM_DIVISION.md for context
5. Set up API keys before hackathon starts
6. Initialize projects (backend + frontend) before hackathon

**All technologies verified compatible. Architecture finalized. Prize strategy clear. Ready to build!**
