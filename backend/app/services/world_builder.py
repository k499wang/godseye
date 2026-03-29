"""
World Builder — Person 3

Creates 12 agents (2 per archetype) for a simulation.
Uses Apollo.io enrichment if available, falls back to K2 Think synthetic profiles.

Usage (wired by Person 1 into POST /api/simulations/build-world):
    from app.services.world_builder import world_builder
    agents = await world_builder.build_world(session_id=..., simulation_id=..., market_question=...)
"""

from __future__ import annotations

import json
import random
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from app.core.llm_client import (
    llm_client,
    MODEL_GEMINI_PRO,
    MODEL_K2_THINK,
)

# ---------------------------------------------------------------------------
# Constants (from SHARED_CONTRACTS.md §2)
# ---------------------------------------------------------------------------
TOTAL_AGENTS = 12
ARCHETYPES = [
    "bayesian_updater",
    "trend_follower",
    "contrarian",
    "data_skeptic",
    "narrative_focused",
    "quantitative_analyst",
]
AGENTS_PER_ARCHETYPE = 2
INITIAL_BELIEF_MIN = 0.35
INITIAL_BELIEF_MAX = 0.65
INITIAL_TRUST_MIN = 0.4
INITIAL_TRUST_MAX = 0.8

# ---------------------------------------------------------------------------
# Local stand-in types (swap to real DB models when Person 1 commits them)
# ---------------------------------------------------------------------------

@dataclass
class ProfessionalBackground:
    title: str
    company: str
    industry: str
    apollo_enriched: bool


@dataclass
class AgentRecord:
    """Mirrors the Agent DB model fields from SHARED_CONTRACTS.md."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    simulation_id: str = ""
    name: str = ""
    archetype: str = ""
    initial_belief: float = 0.5
    current_belief: float = 0.5
    confidence: float = 0.5
    professional_background: dict[str, Any] = field(default_factory=dict)
    trust_scores: dict[str, float] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Archetype-specific defaults
# ---------------------------------------------------------------------------
_ARCHETYPE_DEFAULTS: dict[str, dict[str, Any]] = {
    "bayesian_updater": {
        "belief_bias": 0.0,      # centred
        "confidence": 0.5,
        "description": "Updates incrementally on evidence using Bayesian reasoning",
    },
    "trend_follower": {
        "belief_bias": 0.05,     # leans toward consensus
        "confidence": 0.4,
        "description": "Follows the crowd and adjusts toward the majority view",
    },
    "contrarian": {
        "belief_bias": -0.05,    # pushes against consensus
        "confidence": 0.6,
        "description": "Bets against the crowd; looks for overreactions",
    },
    "data_skeptic": {
        "belief_bias": 0.0,
        "confidence": 0.3,
        "description": "Requires strong quantitative evidence before shifting belief",
    },
    "narrative_focused": {
        "belief_bias": 0.03,
        "confidence": 0.55,
        "description": "Looks for compelling stories and narrative coherence",
    },
    "quantitative_analyst": {
        "belief_bias": 0.0,
        "confidence": 0.5,
        "description": "Trusts numbers and statistical models over qualitative arguments",
    },
}


# ---------------------------------------------------------------------------
# Name generation helpers
# ---------------------------------------------------------------------------
_FIRST_NAMES = [
    "Sarah", "James", "Elena", "David", "Priya", "Marcus",
    "Yuki", "Carlos", "Amira", "Robert", "Wei", "Natasha",
]


def _generate_name(index: int) -> str:
    return _FIRST_NAMES[index % len(_FIRST_NAMES)]


# ---------------------------------------------------------------------------
# World Builder
# ---------------------------------------------------------------------------

class WorldBuilder:

    async def build_world(
        self,
        session_id: str,
        simulation_id: str,
        market_question: str,
        skip_llm_profiles: bool = False,
    ) -> list[AgentRecord]:
        """
        Create 12 agents for *simulation_id*.

        1. Try Apollo enrichment for real professional backgrounds.
        2. Fall back to K2 Think synthetic profiles if Apollo returns < 6.
        3. Assign archetypes, initial beliefs, and trust scores.

        Returns a list of AgentRecord objects ready to be persisted by Person 1's
        DB layer.
        """
        # --- Step 1: get professional backgrounds ---
        profiles = self._fallback_profiles() if skip_llm_profiles else await self._get_profiles(market_question)

        # --- Step 2: create agents ---
        agents: list[AgentRecord] = []
        for idx in range(TOTAL_AGENTS):
            archetype = ARCHETYPES[idx % len(ARCHETYPES)]
            defaults = _ARCHETYPE_DEFAULTS[archetype]

            # Spread initial beliefs across the range, with archetype bias
            base_belief = INITIAL_BELIEF_MIN + (
                (INITIAL_BELIEF_MAX - INITIAL_BELIEF_MIN)
                * (idx / (TOTAL_AGENTS - 1))
            )
            initial_belief = round(
                max(0.0, min(1.0, base_belief + defaults["belief_bias"]
                             + random.uniform(-0.03, 0.03))),
                4,
            )

            profile = profiles[idx] if idx < len(profiles) else ProfessionalBackground(
                title="Analyst", company="Independent", industry="General", apollo_enriched=False,
            )

            agent = AgentRecord(
                simulation_id=simulation_id,
                name=_generate_name(idx),
                archetype=archetype,
                initial_belief=initial_belief,
                current_belief=initial_belief,
                confidence=round(defaults["confidence"] + random.uniform(-0.05, 0.05), 4),
                professional_background={
                    "title": profile.title,
                    "company": profile.company,
                    "industry": profile.industry,
                    "apollo_enriched": profile.apollo_enriched,
                },
                trust_scores={},  # filled after all agents exist
            )
            agents.append(agent)

        # --- Step 3: assign initial trust scores between agents ---
        self._assign_trust_scores(agents)

        return agents

    # ------------------------------------------------------------------
    # Profile fetching
    # ------------------------------------------------------------------

    async def _get_profiles(self, market_question: str) -> list[ProfessionalBackground]:
        """Try Apollo first, fall back to K2 synthetic profiles."""
        try:
            profiles = await self._get_apollo_profiles(market_question)
            if len(profiles) >= 6:
                return profiles
        except Exception:
            pass  # Apollo unavailable — fall through

        return await self._get_synthetic_profiles(market_question)

    async def _get_apollo_profiles(self, market_question: str) -> list[ProfessionalBackground]:
        """Use Person 2's apollo_service to find real professionals."""
        try:
            from app.services.apollo_service import apollo_service
            profiles_raw = await apollo_service.get_relevant_professionals(
                market_question=market_question,
            )
            return [
                ProfessionalBackground(
                    title=p.title,
                    company=p.company,
                    industry=p.industry,
                    apollo_enriched=p.apollo_enriched,
                )
                for p in profiles_raw
            ]
        except ImportError:
            return []

    async def _get_synthetic_profiles(
        self, market_question: str,
    ) -> list[ProfessionalBackground]:
        """Generate synthetic professional profiles via K2 Think."""
        prompt = f"""Given this prediction market question:
"{market_question}"

Generate {TOTAL_AGENTS} diverse professional profiles of people who would have
relevant expertise to forecast the outcome.  Cover a mix of industries,
seniority levels, and perspectives.

Return a JSON array of objects, each with exactly these fields:
- "title": job title (string)
- "company": company name (string)
- "industry": industry sector (string)

Return ONLY the JSON array, nothing else."""

        try:
            response = await llm_client.complete(
                prompt=prompt,
                model=MODEL_K2_THINK,
                response_format="json",
            )
            data = json.loads(response)
            if not isinstance(data, list):
                data = data.get("profiles", data.get("results", []))
            return [
                ProfessionalBackground(
                    title=p.get("title", "Analyst"),
                    company=p.get("company", "Unknown"),
                    industry=p.get("industry", "General"),
                    apollo_enriched=False,
                )
                for p in data[:TOTAL_AGENTS]
            ]
        except Exception:
            return self._fallback_profiles()

    @staticmethod
    def _fallback_profiles() -> list[ProfessionalBackground]:
        """Hardcoded last-resort profiles if all LLM calls fail."""
        fallbacks = [
            ("Chief Economist", "Goldman Sachs", "Finance"),
            ("Senior Policy Analyst", "Brookings Institution", "Think Tank"),
            ("Portfolio Manager", "BlackRock", "Asset Management"),
            ("Data Scientist", "Palantir", "Technology"),
            ("Geopolitical Strategist", "Eurasia Group", "Consulting"),
            ("Macro Researcher", "Bridgewater Associates", "Hedge Fund"),
            ("Political Correspondent", "Reuters", "Media"),
            ("Quantitative Trader", "Citadel", "Trading"),
            ("Professor of Economics", "MIT", "Academia"),
            ("Risk Analyst", "JP Morgan", "Banking"),
            ("Crypto Analyst", "a16z", "Venture Capital"),
            ("Regulatory Affairs Director", "Deloitte", "Professional Services"),
        ]
        return [
            ProfessionalBackground(title=t, company=c, industry=i, apollo_enriched=False)
            for t, c, i in fallbacks
        ]

    # ------------------------------------------------------------------
    # Trust score assignment
    # ------------------------------------------------------------------

    @staticmethod
    def _assign_trust_scores(agents: list[AgentRecord]) -> None:
        """
        Assign pairwise trust scores between all agents.

        Same-archetype agents start with higher trust (0.6–0.8).
        Cross-archetype agents start with moderate trust (0.4–0.6).
        """
        for agent in agents:
            scores: dict[str, float] = {}
            for other in agents:
                if other.id == agent.id:
                    continue
                if other.archetype == agent.archetype:
                    trust = round(random.uniform(0.6, INITIAL_TRUST_MAX), 4)
                else:
                    trust = round(random.uniform(INITIAL_TRUST_MIN, 0.6), 4)
                scores[other.id] = trust
            agent.trust_scores = scores


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
world_builder = WorldBuilder()
