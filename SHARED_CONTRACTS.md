# SHARED_CONTRACTS.md — GodSEye Prediction Market Analyzer

## How To Use This File (Read First)

This is the **single source of truth** for every data shape, API route, and constant in this project. All four workstreams build against these definitions. Field names, types, and enum values are final once committed — do not change them without announcing to the full team.

**For AI coding agents:** Treat every code block in this file as a specification you must implement exactly. Do not invent field names, do not change types, do not add optional fields unless they appear here. When in doubt, the code block wins over any prose description.

**Authoritative path precedence:** This file > TEAM_DIVISION.md > ARCHITECTURE_FLOW.md

---

## Section Index

1. [Enums & String Literals](#1-enums--string-literals)
2. [Shared Constants](#2-shared-constants)
3. [Pydantic Schemas (Backend — Python)](#3-pydantic-schemas-backend--python)
4. [TypeScript Interfaces (Frontend)](#4-typescript-interfaces-frontend)
5. [Agent Action Shapes (LLM Output Contract)](#5-agent-action-shapes-llm-output-contract)
6. [API Routes](#6-api-routes)
7. [LLMClient Interface](#7-llmclient-interface)
8. [Error Response Shape](#8-error-response-shape)
9. [Producer / Consumer Map](#9-producer--consumer-map)

---

## 1. Enums & String Literals

**Produced by:** Person 1 (schemas). **Consumed by:** Everyone.

### Python

```python
from typing import Literal

AgentArchetype = Literal[
    "bayesian_updater",
    "trend_follower",
    "contrarian",
    "data_skeptic",
    "narrative_focused",
    "quantitative_analyst",
]

SimulationStatus = Literal["pending", "building", "running", "complete", "failed"]

ClaimStance = Literal["yes", "no"]

AgentAction = Literal["update_belief", "share_claim"]
```

### TypeScript

```typescript
export type AgentArchetype =
  | "bayesian_updater"
  | "trend_follower"
  | "contrarian"
  | "data_skeptic"
  | "narrative_focused"
  | "quantitative_analyst";

export type SimulationStatus = "pending" | "building" | "running" | "complete" | "failed";

export type ClaimStance = "yes" | "no";

export type AgentAction = "update_belief" | "share_claim";
```

---

## 2. Shared Constants

**Produced by:** Person 3 (enforces in simulation logic). **Consumed by:** Everyone — do not hardcode these values inline, import or copy from here.

### Python

```python
TOTAL_TICKS: int = 30
TOTAL_AGENTS: int = 12
ARCHETYPES: list[str] = [
    "bayesian_updater",
    "trend_follower",
    "contrarian",
    "data_skeptic",
    "narrative_focused",
    "quantitative_analyst",
]
AGENTS_PER_ARCHETYPE: int = 2           # Always 2 of each archetype

VISIBLE_CLAIMS_PER_STANCE: int = 4      # Top 4 yes + top 4 no shown to each agent per tick
CLAIM_RANKING_WEIGHT_STRENGTH: float = 0.7
CLAIM_RANKING_WEIGHT_NOVELTY: float = 0.3
# Ranking score = 0.7 * strength_score + 0.3 * novelty_score

TRUST_SHARE_DELTA: float = 0.02         # Sharer's trust toward recipient increases
TRUST_IGNORE_DELTA: float = -0.01       # Receiver's trust toward sender decreases if ignored
INITIAL_TRUST_MIN: float = 0.4
INITIAL_TRUST_MAX: float = 0.8
INITIAL_BELIEF_MIN: float = 0.35
INITIAL_BELIEF_MAX: float = 0.65

FACTION_THRESHOLD: float = 0.08         # Agents within 0.08 of each other form a faction
```

### TypeScript

```typescript
export const TOTAL_TICKS = 30;
export const TOTAL_AGENTS = 12;
export const AGENTS_PER_ARCHETYPE = 2;
export const VISIBLE_CLAIMS_PER_STANCE = 4;
export const CLAIM_RANKING_WEIGHT_STRENGTH = 0.7;
export const CLAIM_RANKING_WEIGHT_NOVELTY = 0.3;
export const TRUST_SHARE_DELTA = 0.02;
export const TRUST_IGNORE_DELTA = -0.01;
export const FACTION_THRESHOLD = 0.08;
export const POLLING_INTERVAL_MS = 2000;
```

---

## 3. Pydantic Schemas (Backend — Python)

**File locations:**
- `app/schemas/market.py` — MarketResponse, ClaimsGenerateResponse
- `app/schemas/claim.py` — ClaimSchema
- `app/schemas/simulation.py` — everything else below
- `app/schemas/report.py` — ReportResponse

Import path pattern: `from app.schemas.simulation import SimulationResponse`

### ProfessionalBackground

**Produced by:** Person 2 (Apollo service). **Stored by:** Person 1 in agent.professional_background JSON column.

```python
from pydantic import BaseModel

class ProfessionalBackground(BaseModel):
    title: str
    company: str
    industry: str
    apollo_enriched: bool  # True if sourced from Apollo.io; False if K2-generated synthetic
```

### ClaimSchema

**Produced by:** Person 2 (claims generator). **Stored by:** Person 1. **Read by:** Person 3 (simulation) and Person 4 (UI).

```python
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Literal

class ClaimSchema(BaseModel):
    id: UUID
    text: str
    stance: Literal["yes", "no"]
    strength_score: float = Field(ge=0.0, le=1.0)
    novelty_score: float = Field(ge=0.0, le=1.0)
```

### AgentSummary

**Produced by:** Person 3 (world builder). **Read by:** Person 4 (displayed in replay sidebar).

```python
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Literal

class AgentSummary(BaseModel):
    id: UUID
    name: str
    archetype: Literal[
        "bayesian_updater", "trend_follower", "contrarian",
        "data_skeptic", "narrative_focused", "quantitative_analyst"
    ]
    initial_belief: float = Field(ge=0.0, le=1.0)
    current_belief: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    professional_background: ProfessionalBackground
```

### AgentTickState

**Produced by:** Person 3 (simulation runner, one per agent per tick). **Read by:** Person 4 (debate feed).

```python
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Literal

class AgentTickState(BaseModel):
    agent_id: UUID
    name: str
    belief: float = Field(ge=0.0, le=1.0)       # agent's belief at end of this tick
    confidence: float = Field(ge=0.0, le=1.0)
    action_taken: Literal["update_belief", "share_claim"]
    reasoning: str                                # shown in the debate feed
```

### ClaimShareRecord

**Produced by:** Person 3 (simulation runner). **Read by:** Person 4 (debate feed, shown as claim passing between agents).

```python
from pydantic import BaseModel
from uuid import UUID

class ClaimShareRecord(BaseModel):
    from_agent_id: UUID
    from_agent_name: str
    to_agent_id: UUID
    to_agent_name: str
    claim_id: UUID
    claim_text: str
    commentary: str    # the sender's commentary attached to the share
    tick: int          # tick when the share was created (recipient sees it on tick+1)
```

### TrustUpdate

**Produced by:** Person 3 (simulation runner, after each tick's trust recalculation). **Read by:** Person 4 (trust network visualization).

```python
from pydantic import BaseModel
from uuid import UUID

class TrustUpdate(BaseModel):
    from_agent_id: UUID
    to_agent_id: UUID
    old_trust: float
    new_trust: float
```

### TickSnapshot

**Produced by:** Person 3. **Stored by:** Person 1 in simulation.tick_data JSON column. **Read by:** Person 4 (entire replay UI).

```python
from pydantic import BaseModel
from uuid import UUID
from typing import List

class TickSnapshot(BaseModel):
    tick: int                              # 1–30
    agent_states: List[AgentTickState]     # one entry per agent (always 12)
    claim_shares: List[ClaimShareRecord]   # shares that occurred this tick
    trust_updates: List[TrustUpdate]       # trust changes that occurred this tick
    faction_clusters: List[List[UUID]]     # groups of agent_ids with beliefs within FACTION_THRESHOLD
```

### MarketResponse

**Produced by:** Person 1 (market import endpoint). **Read by:** Person 4.

```python
from pydantic import BaseModel
from uuid import UUID

class MarketResponse(BaseModel):
    id: UUID
    session_id: UUID            # the AnalysisSession created alongside the market
    polymarket_id: str          # the market slug/id from Polymarket
    question: str
    resolution_criteria: str
    current_probability: float  # Polymarket's current implied probability (0.0–1.0)
    volume: float               # total trading volume in USD
```

### ClaimsGenerateResponse

**Produced by:** Person 1 route + Person 2 service. **Read by:** Person 4.

```python
from pydantic import BaseModel
from uuid import UUID
from typing import List

class ClaimsGenerateResponse(BaseModel):
    session_id: UUID
    market_id: UUID
    claims: List[ClaimSchema]
```

### SimulationResponse

**Produced by:** Person 1 (route). **Updated tick-by-tick by:** Person 3. **Polled by:** Person 4 every 2 seconds.

```python
from pydantic import BaseModel
from uuid import UUID
from typing import List, Optional
from datetime import datetime
from typing import Literal

class SimulationResponse(BaseModel):
    id: UUID
    session_id: UUID
    market_id: UUID
    status: Literal["pending", "building", "running", "complete", "failed"]
    current_tick: int
    total_ticks: int                  # always 30
    agents: List[AgentSummary]        # populated after build-world; empty list before
    tick_data: List[TickSnapshot]     # grows as simulation runs; empty list before start
    created_at: datetime
    completed_at: Optional[datetime]  # None until status == "complete"
```

### ReportResponse

**Produced by:** Person 3 (report agent). **Stored by:** Person 1. **Read by:** Person 4.

```python
from pydantic import BaseModel
from uuid import UUID
from typing import List

class ReportResponse(BaseModel):
    id: UUID
    simulation_id: UUID
    market_probability: float       # Polymarket's number at time of market import
    simulation_probability: float   # average agent belief at tick 30
    summary: str
    key_drivers: List[str]
    faction_analysis: str
    trust_insights: str
    recommendation: str
```

---

## 4. TypeScript Interfaces (Frontend)

**File:** `frontend/lib/types.ts`. **Owned by:** Person 4. UUID fields are `string` in TypeScript.

```typescript
export interface ProfessionalBackground {
  title: string;
  company: string;
  industry: string;
  apollo_enriched: boolean;
}

export interface ClaimSchema {
  id: string;
  text: string;
  stance: ClaimStance;
  strength_score: number;
  novelty_score: number;
}

export interface AgentSummary {
  id: string;
  name: string;
  archetype: AgentArchetype;
  initial_belief: number;
  current_belief: number;
  confidence: number;
  professional_background: ProfessionalBackground;
}

export interface AgentTickState {
  agent_id: string;
  name: string;
  belief: number;
  confidence: number;
  action_taken: AgentAction;
  reasoning: string;
}

export interface ClaimShareRecord {
  from_agent_id: string;
  from_agent_name: string;
  to_agent_id: string;
  to_agent_name: string;
  claim_id: string;
  claim_text: string;
  commentary: string;
  tick: number;
}

export interface TrustUpdate {
  from_agent_id: string;
  to_agent_id: string;
  old_trust: number;
  new_trust: number;
}

export interface TickSnapshot {
  tick: number;
  agent_states: AgentTickState[];
  claim_shares: ClaimShareRecord[];
  trust_updates: TrustUpdate[];
  faction_clusters: string[][];
}

export interface MarketResponse {
  id: string;
  session_id: string;
  polymarket_id: string;
  question: string;
  resolution_criteria: string;
  current_probability: number;
  volume: number;
}

export interface ClaimsGenerateResponse {
  session_id: string;
  market_id: string;
  claims: ClaimSchema[];
}

export interface SimulationResponse {
  id: string;
  session_id: string;
  market_id: string;
  status: SimulationStatus;
  current_tick: number;
  total_ticks: number;
  agents: AgentSummary[];
  tick_data: TickSnapshot[];
  created_at: string;
  completed_at: string | null;
}

export interface ReportResponse {
  id: string;
  simulation_id: string;
  market_probability: number;
  simulation_probability: number;
  summary: string;
  key_drivers: string[];
  faction_analysis: string;
  trust_insights: string;
  recommendation: string;
}

export interface ApiError {
  detail: string;
  code: string | null;
}
```

---

## 5. Agent Action Shapes (LLM Output Contract)

**Produced by:** LLM via Person 3's prompts. **Consumed by:** Person 3 (simulation runner parses and routes these).

On each tick, the LLM call for every agent MUST return exactly one of these two JSON shapes. No other shapes are valid. Person 3 owns the prompt that produces them.

### Shape 1 — Update Belief

```json
{
  "action": "update_belief",
  "new_probability": 0.72,
  "confidence": 0.65,
  "reasoning": "The Fed's recent statement strongly implies rate cuts are coming, which outweighs the inflation data."
}
```

```python
class UpdateBeliefAction(BaseModel):
    action: Literal["update_belief"]
    new_probability: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str   # shown in the debate feed
```

### Shape 2 — Share Claim

```json
{
  "action": "share_claim",
  "claim_id": "uuid-of-claim-from-visible-or-incoming-list",
  "target_agent_ids": ["uuid-agent-b", "uuid-agent-c"],
  "commentary": "This data point is being overlooked. Sharing with analysts who track monetary policy.",
  "reasoning": "Internal reasoning not shared with other agents — kept private for prompt context only."
}
```

```python
from uuid import UUID

class ShareClaimAction(BaseModel):
    action: Literal["share_claim"]
    claim_id: UUID          # must be an id from the agent's visible_claims or incoming_claims
    target_agent_ids: list[UUID]  # 1–2 trusted agent ids
    commentary: str         # shown in the debate feed to the receiving agents
    reasoning: str          # private — not injected into other agents' prompts
```

**Rule:** `claim_id` must be one the agent was shown (from visible claims or incoming claims). Person 3 must validate this and discard shares of claims the agent never saw.

---

## 6. API Routes

**Produced by:** Person 1 (route shells + wiring). **Called by:** Person 4.

| Method | Path | Request Body | Response Type | Notes |
|--------|------|-------------|---------------|-------|
| `POST` | `/api/markets/import` | `{ "url": string }` | `MarketResponse` | Creates market + session |
| `POST` | `/api/sessions/{market_id}/claims/generate` | _(none)_ | `ClaimsGenerateResponse` | market_id in path |
| `POST` | `/api/simulations/build-world` | `{ "session_id": string }` | `SimulationResponse` | status="building", agents populated, tick_data=[] |
| `POST` | `/api/simulations/{id}/start` | _(none)_ | `SimulationResponse` | status="running"; kicks off background worker |
| `GET`  | `/api/simulations/{id}` | _(none)_ | `SimulationResponse` | Polling endpoint; tick_data grows as simulation runs |
| `GET`  | `/api/reports/{simulation_id}` | _(none)_ | `ReportResponse` | Only available after status="complete" |

**All error responses** use the shape in Section 8.

**CORS:** The backend must allow `http://localhost:3000` and the Vercel deployment URL. Person 1 configures this in FastAPI middleware.

---

## 7. LLMClient Interface

**Produced by:** Person 2. **Import path for everyone:** `from app.core.llm_client import llm_client`

The singleton `llm_client` is the only instance that should exist. No other code creates a new `LLMClient()`.

### Model Name Constants (use these strings exactly, everywhere)

```python
MODEL_GEMINI_FLASH = "gemini-flash"   # → gemini-1.5-flash-002 via Lava (fast; use for simulation ticks)
MODEL_GEMINI_PRO = "gemini-pro"       # → gemini-1.5-pro-002 via Lava (smart; use for claims + report drafting)
MODEL_K2_THINK = "k2-think"           # → Kindo/K2-Think-V2 via LiteLLM (reasoning; use for world-build + report planning)
```

### Interface

```python
from typing import Optional, Any

class LLMClient:
    async def complete(
        self,
        prompt: str,
        system: Optional[str] = None,
        model: str = "gemini-flash",    # one of MODEL_* constants above
        response_format: str = "text",  # "text" or "json"
    ) -> str:
        """
        Returns the LLM response as a string.
        If response_format="json", the returned string is valid JSON (already parsed and re-serialized).
        Caller is responsible for json.loads() if they need a dict.
        """
        ...

    async def call_apollo(
        self,
        job_titles: list[str],
        keywords: list[str],
        limit: int = 12,
    ) -> list[dict[str, Any]]:
        """
        Returns a list of professional profile dicts from Apollo.io via Lava.
        Each dict contains at minimum: title, company, industry.
        Returns empty list if Apollo returns no results or on error.
        """
        ...

# Module-level singleton — import this, do not instantiate LLMClient directly
llm_client = LLMClient()
```

---

## 8. Error Response Shape

**All API error responses** (4xx and 5xx) return this shape.

### Python (FastAPI HTTPException detail)

```python
# FastAPI automatically wraps HTTPException detail in {"detail": ...}
# For structured errors, raise with a dict:
from fastapi import HTTPException

raise HTTPException(
    status_code=422,
    detail={"detail": "Invalid Polymarket URL format", "code": "INVALID_URL"}
)
```

### TypeScript

```typescript
export interface ApiError {
  detail: string;
  code: string | null;
}
```

Person 4: check for this shape in all TanStack Query `onError` handlers. The `code` field is nullable — don't assume it's always present.

---

## 9. Producer / Consumer Map

Use this to know who you are waiting on and who is waiting on you.

| What | Produced by | Consumed by | Unblocks |
|------|-------------|-------------|----------|
| `llm_client` singleton stub | Person 2 (by minute 30) | Person 3 | Person 3 can write all simulation logic |
| All model stubs + schema files | Person 1 (by minute 45) | Person 2, Person 3, Person 4 | Everyone starts real code |
| `ClaimSchema`, `MarketResponse` | Person 1 (schemas) | Person 2 (claims gen), Person 4 (UI) | Claims gen and market UI |
| `SimulationResponse`, `TickSnapshot` | Person 1 (schema) + Person 3 (populates) | Person 4 (replay UI) | Replay component |
| Real `LLMClient` implementation | Person 2 (by hour 3) | Person 3 | Simulation makes real LLM calls |
| `apollo_service.get_relevant_professionals()` | Person 2 | Person 3 (world builder) | Real agent personas |
| `world_builder.build_world(session_id, simulation_id)` | Person 3 | Person 1 (wires into build-world route) | Build-world endpoint works |
| `simulation_worker.run_simulation(simulation_id)` | Person 3 | Person 1 (wires into start route) | Start endpoint triggers simulation |
| Railway backend URL | Person 1 (by hour 6) | Person 4 | Frontend replaces mock data |
| `ReportResponse` | Person 3 (report agent) | Person 4 (report page) | Report view page |

### Import paths each person needs

**Person 2 needs from Person 1:**
```python
from app.models.claim import Claim
from app.models.session import AnalysisSession
from app.core.database import get_db
```

**Person 3 needs from Person 1:**
```python
from app.models.agent import Agent
from app.models.simulation import Simulation
from app.models.claim_share import ClaimShare
from app.models.claim import Claim
from app.core.database import get_db
```

**Person 3 needs from Person 2:**
```python
from app.core.llm_client import llm_client
from app.services.apollo_service import apollo_service
```

**Person 4 needs from everyone:**
```
GET/POST the API routes listed in Section 6
All TypeScript interfaces in frontend/lib/types.ts (Person 4 writes these from this file)
```

---

## Simulation Mental Model (For All AI Coding Agents)

This section exists so every AI agent has the same model of how the simulation works.

- **One shared claim pool.** Claims are generated once per session. Stance (`yes`/`no`) belongs to the claim and never changes. Claims are not modified during simulation.
- **12 agents with private beliefs.** Each agent has its own `current_belief` (float 0–1). Belief belongs to the agent, not the claim.
- **Each tick:** Every agent receives a private prompt with: their current belief and confidence, the top 4 yes + top 4 no claims from the shared pool (ranked by `0.7*strength + 0.3*novelty`), and any claims specifically sent to them in the previous tick. Each agent returns one action (update belief OR share a claim).
- **Shares are not instant.** A claim shared at tick N is stored as a `ClaimShare` record with `delivered=False`. It is injected into the recipient's prompt at tick N+1, then marked `delivered=True`.
- **The backend is the mailman.** Agents never see each other's prompts directly. All communication goes through `ClaimShare` records.
- **Trust updates after each tick.** When agent A shares a claim to agent B: A's trust score toward B increases by `TRUST_SHARE_DELTA`. When agent B receives a claim from A but does not act on it (no share back, no belief update toward A's position): B's trust toward A decreases by `TRUST_IGNORE_DELTA`.
- **Factions.** After each tick, group agents whose `current_belief` values are within `FACTION_THRESHOLD` (0.08) of each other. Store as `faction_clusters` in `TickSnapshot`.
- **Final probability.** `simulation_probability` in `ReportResponse` = average `current_belief` across all 12 agents at tick 30.
