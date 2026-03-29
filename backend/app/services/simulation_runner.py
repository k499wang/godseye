"""
Simulation Runner — Person 3

Core 30-tick simulation engine. Each tick:
  1. Select visible claims (top 4 yes + top 4 no by rank score)
  2. Gather incoming claim-shares from prior tick
  3. Prompt all 12 agents in parallel via Gemini Flash
  4. Parse actions (update_belief or share_claim), validate, apply
  5. Update trust scores, detect factions, build TickSnapshot

Usage (wired by simulation_worker):
    from app.services.simulation_runner import simulation_runner
    result = await simulation_runner.run(simulation_id=..., agents=..., ...)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Literal

from app.core.llm_client import llm_client, MODEL_GEMINI_FLASH
from app.services.world_builder import AgentRecord

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants (from SHARED_CONTRACTS.md §2)
# ---------------------------------------------------------------------------
TOTAL_TICKS: int = 30
VISIBLE_CLAIMS_PER_STANCE: int = 4
CLAIM_RANKING_WEIGHT_STRENGTH: float = 0.7
CLAIM_RANKING_WEIGHT_NOVELTY: float = 0.3
TRUST_SHARE_DELTA: float = 0.02
TRUST_IGNORE_DELTA: float = -0.01
FACTION_THRESHOLD: float = 0.08
AGENT_LLM_TIMEOUT_SECONDS: float = float(os.getenv("SIM_AGENT_TIMEOUT_SECONDS", "8"))

# ---------------------------------------------------------------------------
# Data structures (swap to DB models / Pydantic schemas when Person 1 commits)
# ---------------------------------------------------------------------------


@dataclass
class Claim:
    """Mirrors ClaimSchema from SHARED_CONTRACTS.md §3."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    text: str = ""
    stance: Literal["yes", "no"] = "yes"
    strength_score: float = 0.5
    novelty_score: float = 0.5


@dataclass
class _PendingShare:
    """Internal working type for a claim share during the simulation loop."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    simulation_id: str = ""
    from_agent_id: str = ""
    from_agent_name: str = ""
    to_agent_id: str = ""
    to_agent_name: str = ""
    claim_id: str = ""
    claim_text: str = ""
    commentary: str = ""
    tick: int = 0
    delivered: bool = False


@dataclass
class AgentTickState:
    """One agent's state at the end of a tick."""

    agent_id: str = ""
    name: str = ""
    belief: float = 0.5
    confidence: float = 0.5
    action_taken: Literal["update_belief", "share_claim"] = "update_belief"
    reasoning: str = ""


@dataclass
class TrustUpdate:
    """A single trust-score change between two agents."""

    from_agent_id: str = ""
    to_agent_id: str = ""
    old_trust: float = 0.0
    new_trust: float = 0.0


@dataclass
class TickSnapshot:
    """Complete snapshot of one simulation tick."""

    tick: int = 0
    agent_states: list[AgentTickState] = field(default_factory=list)
    claim_shares: list[_PendingShare] = field(default_factory=list)
    trust_updates: list[TrustUpdate] = field(default_factory=list)
    faction_clusters: list[list[str]] = field(default_factory=list)


@dataclass
class SimulationResult:
    """Return value from the simulation runner."""

    simulation_id: str = ""
    status: str = "complete"
    current_tick: int = 0
    total_ticks: int = TOTAL_TICKS
    tick_data: list[TickSnapshot] = field(default_factory=list)
    agents: list[AgentRecord] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Stub claims fallback (used when Person 2's claims_generator isn't ready)
# ---------------------------------------------------------------------------

def _generate_stub_claims() -> list[Claim]:
    """Hardcoded fallback claims — 8 yes + 8 no with realistic scores."""
    stubs = [
        # YES stance
        ("Recent economic indicators suggest a softening labor market, increasing pressure for policy action.", "yes", 0.82, 0.60),
        ("Multiple Federal Reserve officials have signaled openness to rate adjustments in upcoming meetings.", "yes", 0.75, 0.50),
        ("Consumer confidence surveys show declining sentiment about future economic conditions.", "yes", 0.70, 0.55),
        ("Global central banks have already begun easing cycles, creating coordination pressure.", "yes", 0.65, 0.70),
        ("Housing market activity has slowed significantly due to elevated borrowing costs.", "yes", 0.68, 0.45),
        ("Credit card delinquency rates are rising to multi-year highs.", "yes", 0.60, 0.65),
        ("Manufacturing PMI data suggests continued contraction in the industrial sector.", "yes", 0.58, 0.50),
        ("Yield curve dynamics suggest markets are pricing in near-term policy accommodation.", "yes", 0.72, 0.40),
        # NO stance
        ("Core inflation metrics remain stubbornly above the 2% target with limited downward momentum.", "no", 0.85, 0.35),
        ("Wage growth continues to outpace productivity gains, sustaining cost-push inflation pressures.", "no", 0.78, 0.45),
        ("Services inflation has proven sticky and resistant to the lagged effects of prior tightening.", "no", 0.73, 0.50),
        ("Fiscal expansion and deficit spending are offsetting the contractionary effects of monetary policy.", "no", 0.70, 0.60),
        ("Energy prices have rebounded due to geopolitical tensions, adding to headline inflation.", "no", 0.65, 0.55),
        ("The Federal Reserve has repeatedly emphasized a higher-for-longer stance in recent communications.", "no", 0.80, 0.30),
        ("Strong corporate earnings suggest the economy remains resilient enough to absorb current rates.", "no", 0.62, 0.48),
        ("Asset price inflation in equities and real estate argues against premature easing.", "no", 0.55, 0.65),
    ]
    return [
        Claim(text=text, stance=stance, strength_score=strength, novelty_score=novelty)
        for text, stance, strength, novelty in stubs
    ]


# ---------------------------------------------------------------------------
# Simulation Runner
# ---------------------------------------------------------------------------

class SimulationRunner:
    """
    Core simulation engine. Runs 30 ticks of agent deliberation.

    All state is held in-memory during the run. Returns a SimulationResult
    with the complete list of TickSnapshots.
    """

    async def run(
        self,
        simulation_id: str,
        agents: list[AgentRecord],
        claims: list[Claim] | None = None,
        market_question: str = "",
        total_ticks: int = TOTAL_TICKS,
        on_tick_complete: Callable[[TickSnapshot, list[AgentRecord]], Awaitable[None]] | None = None,
    ) -> SimulationResult:
        if not claims:
            claims = _generate_stub_claims()

        claims_by_id: dict[str, Claim] = {c.id: c for c in claims}
        all_claim_shares: list[_PendingShare] = []
        visible_claims = self._select_visible_claims(claims)
        tick_data: list[TickSnapshot] = []

        for tick_num in range(1, total_ticks + 1):
            logger.info("Simulation %s — tick %d/%d", simulation_id, tick_num, total_ticks)

            # 1. Incoming claims per agent (shares from previous tick)
            incoming_by_agent: dict[str, list[_PendingShare]] = {
                a.id: self._get_incoming_claims(a.id, all_claim_shares, tick_num)
                for a in agents
            }

            # 2. Prompt + LLM call for all 12 agents in parallel
            async def _process(agent: AgentRecord) -> tuple[AgentRecord, dict[str, Any]]:
                sys_prompt, usr_prompt = self._build_agent_prompt(
                    agent, agents, visible_claims,
                    incoming_by_agent.get(agent.id, []),
                    market_question, tick_num,
                )
                action = await asyncio.wait_for(
                    self._call_agent_llm(agent, sys_prompt, usr_prompt),
                    timeout=AGENT_LLM_TIMEOUT_SECONDS,
                )
                return agent, action

            results = await asyncio.gather(
                *(_process(a) for a in agents),
                return_exceptions=True,
            )

            # 3. Process results
            tick_agent_states: list[AgentTickState] = []
            tick_shares: list[_PendingShare] = []
            tick_actions: dict[str, dict[str, Any]] = {}

            for result in results:
                if isinstance(result, BaseException):
                    logger.warning("Agent LLM call failed: %s", result)
                    continue

                agent, action = result
                tick_actions[agent.id] = action

                if action.get("action") == "share_claim" and self._validate_share_action(
                    action, agent, visible_claims,
                    incoming_by_agent.get(agent.id, []), agents,
                ):
                    new_shares = self._create_claim_shares(
                        agent, action, agents, claims_by_id,
                        tick_num, simulation_id,
                    )
                    tick_shares.extend(new_shares)
                    all_claim_shares.extend(new_shares)
                    tick_agent_states.append(AgentTickState(
                        agent_id=agent.id,
                        name=agent.name,
                        belief=agent.current_belief,
                        confidence=agent.confidence,
                        action_taken="share_claim",
                        reasoning=action.get("reasoning", ""),
                    ))
                else:
                    state = self._apply_belief_update(agent, action)
                    tick_agent_states.append(state)

            # 4. Trust updates
            trust_updates = self._update_trust_scores(agents, tick_actions, incoming_by_agent)

            # 5. Factions
            faction_clusters = self._detect_factions(agents)

            # 6. Build snapshot
            snapshot = TickSnapshot(
                tick=tick_num,
                agent_states=tick_agent_states,
                claim_shares=tick_shares,
                trust_updates=trust_updates,
                faction_clusters=faction_clusters,
            )
            tick_data.append(snapshot)

            # 7. Mark incoming shares as delivered
            for shares in incoming_by_agent.values():
                for share in shares:
                    share.delivered = True

            if on_tick_complete is not None:
                await on_tick_complete(snapshot, agents)

        return SimulationResult(
            simulation_id=simulation_id,
            status="complete",
            current_tick=total_ticks,
            total_ticks=total_ticks,
            tick_data=tick_data,
            agents=agents,
        )

    # ------------------------------------------------------------------
    # Claim ranking & selection
    # ------------------------------------------------------------------

    def _select_visible_claims(self, claims: list[Claim]) -> list[Claim]:
        """Top 4 yes + top 4 no by (0.7*strength + 0.3*novelty)."""

        def _rank(c: Claim) -> float:
            return (
                CLAIM_RANKING_WEIGHT_STRENGTH * c.strength_score
                + CLAIM_RANKING_WEIGHT_NOVELTY * c.novelty_score
            )

        yes_sorted = sorted((c for c in claims if c.stance == "yes"), key=_rank, reverse=True)
        no_sorted = sorted((c for c in claims if c.stance == "no"), key=_rank, reverse=True)
        return yes_sorted[:VISIBLE_CLAIMS_PER_STANCE] + no_sorted[:VISIBLE_CLAIMS_PER_STANCE]

    # ------------------------------------------------------------------
    # Incoming claims
    # ------------------------------------------------------------------

    @staticmethod
    def _get_incoming_claims(
        agent_id: str,
        all_shares: list[_PendingShare],
        current_tick: int,
    ) -> list[_PendingShare]:
        """Shares created at tick N-1 arrive at tick N (if not yet delivered)."""
        return [
            cs for cs in all_shares
            if cs.to_agent_id == agent_id
            and cs.tick == current_tick - 1
            and not cs.delivered
        ]

    # ------------------------------------------------------------------
    # Prompt building
    # ------------------------------------------------------------------

    @staticmethod
    def _build_agent_prompt(
        agent: AgentRecord,
        all_agents: list[AgentRecord],
        visible_claims: list[Claim],
        incoming_claims: list[_PendingShare],
        market_question: str,
        current_tick: int,
    ) -> tuple[str, str]:
        bg = agent.professional_background
        system_prompt = (
            f"You are {agent.name}, a {agent.archetype.replace('_', ' ')} forecaster.\n"
            f"Professional background: {bg.get('title', 'Analyst')} at "
            f"{bg.get('company', 'Independent')} ({bg.get('industry', 'General')}).\n\n"
            f"You are participating in a structured forecasting exercise about:\n"
            f'"{market_question}"\n\n'
            f"Your belief is a probability (0.0 to 1.0) that the market resolves YES.\n"
            f"Your confidence (0.0 to 1.0) represents how certain you are.\n\n"
            f"Write like a real person thinking out loud, not a polished report writer.\n"
            f"Keep your language short, direct, a little opinionated, and specific to your archetype.\n"
            f"Use plain words. It is fine to sound skeptical, excited, dismissive, stubborn, cautious, or punchy.\n"
            f"Avoid corporate phrasing, generic summaries, and formal analyst-speak.\n"
            f"Reasoning should feel like a quick justification you would say in a fast-moving room.\n"
            f"Keep reasoning to 1-2 short sentences max.\n"
            f"Keep commentary even tighter: 1 short sentence max.\n\n"
            f"On each round, choose exactly ONE action:\n"
            f"1. update_belief — Revise your probability and confidence.\n"
            f"2. share_claim — Forward one claim to 1-4 trusted peers.\n\n"
            f"IMPORTANT: Good forecasters actively share evidence. You should share claims "
            f"roughly 40-60% of the time — especially when you see a strong or novel claim "
            f"that your peers might not have seen, or when someone shares something with you "
            f"that deserves to be passed along. Hoarding information is bad forecasting. "
            f"If you received claims this round, seriously consider forwarding the most "
            f"impactful one to a trusted peer.\n"
            f"When sharing, send to MULTIPLE peers (2-4 agents) — the more people who see "
            f"important evidence, the better the group forecast becomes. Don't just send to one person.\n\n"
            f"Return ONLY valid JSON matching one of these shapes:\n"
            f'{{"action":"update_belief","new_probability":<float 0-1>,'
            f'"confidence":<float 0-1>,"reasoning":"<text>"}}\n'
            f'{{"action":"share_claim","claim_id":"<id>",'
            f'"target_agent_ids":["<id>","<id>",...],"commentary":"<text>","reasoning":"<text>"}}'
        )

        parts: list[str] = [
            f"Round {current_tick} of {TOTAL_TICKS}.",
            f"Your current belief: {agent.current_belief}",
            f"Your confidence: {agent.confidence}",
            "",
        ]

        # Top-5 trusted agents
        agent_lookup = {a.id: a for a in all_agents}
        sorted_trust = sorted(agent.trust_scores.items(), key=lambda x: x[1], reverse=True)
        trusted_lines = []
        for other_id, trust_val in sorted_trust[:5]:
            other = agent_lookup.get(other_id)
            if other:
                trusted_lines.append(f"  - {other.name} (id: {other.id}, trust: {trust_val:.2f})")
        if trusted_lines:
            parts.append("Agents you trust most:")
            parts.extend(trusted_lines)
            parts.append("")

        # Visible claims
        parts.append("Visible claims from the evidence pool:")
        for i, claim in enumerate(visible_claims, 1):
            parts.append(f"  {i}. [id: {claim.id}] {claim.text} (stance: {claim.stance})")
        parts.append("")

        # Incoming claims
        if incoming_claims:
            parts.append("Claims shared with you this round:")
            for ic in incoming_claims:
                parts.append(
                    f"  - [id: {ic.claim_id}] {ic.claim_text}\n"
                    f"    Shared by: {ic.from_agent_name} (id: {ic.from_agent_id})\n"
                    f'    Their commentary: "{ic.commentary}"'
                )
            parts.append("")
        else:
            parts.append("Claims shared with you this round: none")
            parts.append("")

        parts.append(
            "Choose one action. If you share a claim, the claim_id MUST be from the "
            "visible or incoming claims above. target_agent_ids must be from the "
            "trusted agents list — include 2-4 agents to spread evidence widely. "
            "Explain yourself briefly and with personality. "
            "Remember: sharing strong evidence with multiple peers is just as valuable as updating your own belief. "
            "Return ONLY valid JSON."
        )

        return system_prompt, "\n".join(parts)

    # ------------------------------------------------------------------
    # LLM call + parsing
    # ------------------------------------------------------------------

    @staticmethod
    async def _call_agent_llm(
        agent: AgentRecord,
        system_prompt: str,
        user_prompt: str,
    ) -> dict[str, Any]:
        default_action: dict[str, Any] = {
            "action": "update_belief",
            "new_probability": agent.current_belief,
            "confidence": agent.confidence,
            "reasoning": "No change this round.",
        }
        try:
            response = await llm_client.complete(
                prompt=user_prompt,
                system=system_prompt,
                model=MODEL_GEMINI_FLASH,
                response_format="json",
            )
            parsed = json.loads(response)
            if not isinstance(parsed, dict):
                return default_action

            action_type = parsed.get("action")
            if action_type not in ("update_belief", "share_claim"):
                return default_action

            if action_type == "update_belief":
                prob = parsed.get("new_probability")
                conf = parsed.get("confidence")
                if prob is None or conf is None:
                    return default_action
                parsed["new_probability"] = max(0.0, min(1.0, float(prob)))
                parsed["confidence"] = max(0.0, min(1.0, float(conf)))
                parsed.setdefault("reasoning", "")

            elif action_type == "share_claim":
                if not parsed.get("claim_id") or not parsed.get("target_agent_ids"):
                    return default_action
                parsed.setdefault("commentary", "")
                parsed.setdefault("reasoning", "")

            return parsed
        except Exception:
            return default_action

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_share_action(
        action: dict[str, Any],
        agent: AgentRecord,
        visible_claims: list[Claim],
        incoming_claims: list[_PendingShare],
        all_agents: list[AgentRecord],
    ) -> bool:
        claim_id = str(action.get("claim_id", "")).strip()
        target_ids = action.get("target_agent_ids", [])

        valid_claim_ids = {str(c.id).strip() for c in visible_claims} | {str(ic.claim_id).strip() for ic in incoming_claims}
        if claim_id not in valid_claim_ids:
            logger.warning(
                "Agent %s share_claim rejected: claim_id %s not in %d valid claims",
                agent.name, claim_id, len(valid_claim_ids),
            )
            return False

        valid_agent_ids = {str(a.id).strip() for a in all_agents if a.id != agent.id}
        if not target_ids or any(str(tid).strip() not in valid_agent_ids for tid in target_ids):
            logger.warning(
                "Agent %s share_claim rejected: invalid target_agent_ids %s",
                agent.name, target_ids,
            )
            return False

        return True

    # ------------------------------------------------------------------
    # Apply actions
    # ------------------------------------------------------------------

    @staticmethod
    def _apply_belief_update(
        agent: AgentRecord,
        action: dict[str, Any],
    ) -> AgentTickState:
        new_prob = max(0.0, min(1.0, float(action.get("new_probability", agent.current_belief))))
        new_conf = max(0.0, min(1.0, float(action.get("confidence", agent.confidence))))
        agent.current_belief = round(new_prob, 4)
        agent.confidence = round(new_conf, 4)
        return AgentTickState(
            agent_id=agent.id,
            name=agent.name,
            belief=agent.current_belief,
            confidence=agent.confidence,
            action_taken="update_belief",
            reasoning=action.get("reasoning", ""),
        )

    @staticmethod
    def _create_claim_shares(
        agent: AgentRecord,
        action: dict[str, Any],
        all_agents: list[AgentRecord],
        claims_by_id: dict[str, Claim],
        current_tick: int,
        simulation_id: str,
    ) -> list[_PendingShare]:
        claim_id = str(action["claim_id"])
        claim = claims_by_id.get(claim_id)
        claim_text = claim.text if claim else ""
        commentary = action.get("commentary", "")
        agent_lookup = {a.id: a for a in all_agents}

        return [
            _PendingShare(
                simulation_id=simulation_id,
                from_agent_id=agent.id,
                from_agent_name=agent.name,
                to_agent_id=str(tid),
                to_agent_name=agent_lookup[str(tid)].name if str(tid) in agent_lookup else "Unknown",
                claim_id=claim_id,
                claim_text=claim_text,
                commentary=commentary,
                tick=current_tick,
                delivered=False,
            )
            for tid in action.get("target_agent_ids", [])
        ]

    # ------------------------------------------------------------------
    # Trust updates
    # ------------------------------------------------------------------

    @staticmethod
    def _update_trust_scores(
        agents: list[AgentRecord],
        tick_actions: dict[str, dict[str, Any]],
        incoming_by_agent: dict[str, list[_PendingShare]],
    ) -> list[TrustUpdate]:
        updates: list[TrustUpdate] = []

        for agent in agents:
            action = tick_actions.get(agent.id, {})

            # Sharer's trust toward each target increases
            if action.get("action") == "share_claim":
                for tid in action.get("target_agent_ids", []):
                    tid_str = str(tid)
                    if tid_str in agent.trust_scores:
                        old = agent.trust_scores[tid_str]
                        new = round(min(1.0, old + TRUST_SHARE_DELTA), 4)
                        agent.trust_scores[tid_str] = new
                        updates.append(TrustUpdate(
                            from_agent_id=agent.id, to_agent_id=tid_str,
                            old_trust=old, new_trust=new,
                        ))

            # Receiver who got claims but didn't share them forward:
            # trust toward each sender decreases
            incoming = incoming_by_agent.get(agent.id, [])
            if incoming and action.get("action") != "share_claim":
                for ic in incoming:
                    sender_id = ic.from_agent_id
                    if sender_id in agent.trust_scores:
                        old = agent.trust_scores[sender_id]
                        new = round(max(0.0, old + TRUST_IGNORE_DELTA), 4)
                        agent.trust_scores[sender_id] = new
                        updates.append(TrustUpdate(
                            from_agent_id=agent.id, to_agent_id=sender_id,
                            old_trust=old, new_trust=new,
                        ))

        return updates

    # ------------------------------------------------------------------
    # Faction detection (Union-Find / single-linkage clustering)
    # ------------------------------------------------------------------

    @staticmethod
    def _detect_factions(agents: list[AgentRecord]) -> list[list[str]]:
        n = len(agents)
        parent = list(range(n))

        def find(x: int) -> int:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(x: int, y: int) -> None:
            rx, ry = find(x), find(y)
            if rx != ry:
                parent[rx] = ry

        for i in range(n):
            for j in range(i + 1, n):
                if abs(agents[i].current_belief - agents[j].current_belief) <= FACTION_THRESHOLD:
                    union(i, j)

        clusters: dict[int, list[str]] = {}
        for i in range(n):
            clusters.setdefault(find(i), []).append(agents[i].id)

        return [ids for ids in clusters.values() if len(ids) >= 2]


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
simulation_runner = SimulationRunner()
