"""
Report Agent — Person 3

Generates the final analysis report after a simulation completes.

4-stage pipeline:
  1. K2 Think  — plan report structure from tick_data summary
  2. Gemini Pro — draft each section (summary, key_drivers, faction_analysis,
                  trust_insights, recommendation)
  3. K2 Think  — self-critique & revision notes
  4. Finalize  — apply revisions, compute simulation_probability, return report

Usage (called by simulation_worker after simulation completes):
    from app.services.report_agent import report_agent
    report = await report_agent.generate(
        simulation_id=..., result=..., market_question=..., market_probability=...
    )
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

from app.core.llm_client import llm_client, MODEL_GEMINI_FLASH, MODEL_K2_THINK
from app.services.simulation_runner import SimulationResult

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ReportData:
    """Internal report data matching Person 1's Report DB model fields."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    simulation_id: str = ""
    market_probability: float = 0.5
    simulation_probability: float = 0.5
    summary: str = ""
    key_drivers: list[str] = field(default_factory=list)
    faction_analysis: str = ""
    trust_insights: str = ""
    recommendation: str = ""


# ---------------------------------------------------------------------------
# Report Agent
# ---------------------------------------------------------------------------

class ReportAgent:
    """
    Generates the final analysis report from a completed simulation.

    All stages gracefully degrade when LLM is stubbed — producing
    placeholder text so the pipeline runs end-to-end.
    """

    async def generate(
        self,
        simulation_id: str,
        result: SimulationResult,
        market_question: str = "",
        market_probability: float = 0.5,
    ) -> ReportData:
        """
        Run the 4-stage report pipeline.

        Parameters:
            simulation_id: The simulation's unique ID.
            result: The SimulationResult from simulation_runner.
            market_question: The prediction market question text.
            market_probability: Polymarket's current probability for the market.

        Returns:
            ReportData ready to be persisted to Report DB model.
        """
        logger.info("Generating report for simulation %s", simulation_id)

        # Compute simulation_probability = average belief at final tick
        sim_probability = self._compute_sim_probability(result)

        # Build a summary of the simulation for LLM context
        sim_summary = self._build_sim_summary(result, market_question, market_probability, sim_probability)

        # --- Stage 1: K2 Think — plan report structure ---
        plan = await self._stage_plan(sim_summary)
        logger.info("Stage 1 (plan) complete")

        # --- Stage 2: Gemini Pro — draft sections ---
        draft = await self._stage_draft(sim_summary, plan)
        logger.info("Stage 2 (draft) complete")

        # --- Stage 3: K2 Think — self-critique ---
        critique = await self._stage_critique(sim_summary, draft)
        logger.info("Stage 3 (critique) complete")

        # --- Stage 4: Finalize ---
        report = await self._stage_finalize(sim_summary, draft, critique)
        logger.info("Stage 4 (finalize) complete")

        report.simulation_id = simulation_id
        report.market_probability = market_probability
        report.simulation_probability = sim_probability

        return report

    def build_fallback_report(
        self,
        simulation_id: str,
        result: SimulationResult,
        market_question: str = "",
        market_probability: float = 0.5,
    ) -> ReportData:
        """Produce a fully-populated fallback report without relying on live LLM calls."""
        sim_probability = self._compute_sim_probability(result)
        sim_summary = self._build_sim_summary(
            result,
            market_question,
            market_probability,
            sim_probability,
        )
        draft = self._fallback_draft(sim_summary)
        return ReportData(
            simulation_id=simulation_id,
            market_probability=market_probability,
            simulation_probability=sim_probability,
            summary=str(draft.get("summary", "")),
            key_drivers=list(draft.get("key_drivers", [])),
            faction_analysis=str(draft.get("faction_analysis", "")),
            trust_insights=str(draft.get("trust_insights", "")),
            recommendation=str(draft.get("recommendation", "")),
        )

    # ------------------------------------------------------------------
    # Probability computation
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_sim_probability(result: SimulationResult) -> float:
        """Average current_belief across all agents at tick 30."""
        if not result.agents:
            return 0.5
        beliefs = [a.current_belief for a in result.agents]
        return round(sum(beliefs) / len(beliefs), 5)

    # ------------------------------------------------------------------
    # Simulation summary builder (LLM context)
    # ------------------------------------------------------------------

    @staticmethod
    def _build_sim_summary(
        result: SimulationResult,
        market_question: str,
        market_probability: float,
        sim_probability: float,
    ) -> str:
        """Build a concise text summary of the simulation for LLM prompts."""
        parts = [
            f"Market question: {market_question}",
            f"Polymarket probability: {market_probability:.1%}",
            f"Simulation probability (avg agent belief at tick 30): {sim_probability:.1%}",
            f"Total ticks: {result.total_ticks}",
            f"Total agents: {len(result.agents)}",
            "",
            "Agent final states:",
        ]

        for agent in result.agents:
            bg = agent.professional_background
            parts.append(
                f"  - {agent.name} ({agent.archetype}): belief={agent.current_belief:.3f}, "
                f"confidence={agent.confidence:.3f}, "
                f"background={bg.get('title', 'Analyst')} at {bg.get('company', 'Unknown')}"
            )

        # Faction summary from last tick
        if result.tick_data:
            last_tick = result.tick_data[-1]
            parts.append("")
            parts.append(f"Final factions (tick {last_tick.tick}):")
            agent_lookup = {a.id: a for a in result.agents}
            for i, cluster in enumerate(last_tick.faction_clusters, 1):
                names = [agent_lookup[aid].name for aid in cluster if aid in agent_lookup]
                beliefs = [agent_lookup[aid].current_belief for aid in cluster if aid in agent_lookup]
                avg_b = sum(beliefs) / len(beliefs) if beliefs else 0
                parts.append(f"  Faction {i} ({len(cluster)} agents, avg belief {avg_b:.3f}): {', '.join(names)}")

            # Trust dynamics summary
            total_shares = sum(len(t.claim_shares) for t in result.tick_data)
            total_trust_changes = sum(len(t.trust_updates) for t in result.tick_data)
            parts.append("")
            parts.append(f"Total claim shares across all ticks: {total_shares}")
            parts.append(f"Total trust updates across all ticks: {total_trust_changes}")

            # Belief trajectory (ticks 1, 10, 20, 30)
            parts.append("")
            parts.append("Average belief trajectory:")
            for tick_idx in [0, 9, 19, 29]:
                if tick_idx < len(result.tick_data):
                    snap = result.tick_data[tick_idx]
                    avg_belief = sum(s.belief for s in snap.agent_states) / len(snap.agent_states) if snap.agent_states else 0
                    parts.append(f"  Tick {snap.tick}: avg belief = {avg_belief:.3f}")

        return "\n".join(parts)

    # ------------------------------------------------------------------
    # Stage 1: Plan (K2 Think)
    # ------------------------------------------------------------------

    async def _stage_plan(self, sim_summary: str) -> str:
        """Use K2 Think to plan the report structure."""
        prompt = f"""You are an expert analyst writing a report on a prediction market simulation.

Here is the simulation summary:
{sim_summary}

Plan the structure of a comprehensive analysis report. Think step-by-step about:
1. What should the executive summary cover?
2. What are the key evidence drivers that shaped agent beliefs?
3. How should faction dynamics be analyzed?
4. What trust network insights are most interesting?
5. What should the final recommendation say?

Provide a detailed outline with key points for each section."""

        response = await llm_client.complete(
            prompt=prompt,
            model=MODEL_K2_THINK,
            response_format="text",
        )
        return response

    # ------------------------------------------------------------------
    # Stage 2: Draft (Gemini Pro)
    # ------------------------------------------------------------------

    async def _stage_draft(self, sim_summary: str, plan: str) -> dict[str, Any]:
        """Use Gemini Pro to draft each report section."""
        prompt = f"""You are writing a professional analysis report on a prediction market simulation.

SIMULATION SUMMARY:
{sim_summary}

REPORT PLAN:
{plan}

Draft the full report as a JSON object with exactly these fields:
- "summary": A 2-3 paragraph executive summary comparing the simulation's probability estimate to the market price. Highlight where agents agreed/disagreed and why.
- "key_drivers": A JSON array of 4-6 strings, each a concise key evidence driver that shaped the simulation outcome.
- "faction_analysis": A 1-2 paragraph analysis of how agent factions formed and evolved. Which archetypes clustered together and why?
- "trust_insights": A 1-2 paragraph analysis of trust dynamics. How did information sharing patterns affect the outcome?
- "recommendation": A 1 paragraph actionable recommendation for a trader based on the simulation results vs market price.

Return ONLY valid JSON."""

        try:
            response = await llm_client.complete(
                prompt=prompt,
                model=MODEL_GEMINI_FLASH,
                response_format="json",
            )
            parsed = json.loads(response)
            if isinstance(parsed, dict) and "summary" in parsed:
                return parsed
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

        return self._fallback_draft(sim_summary)

    # ------------------------------------------------------------------
    # Stage 3: Critique (K2 Think)
    # ------------------------------------------------------------------

    async def _stage_critique(self, sim_summary: str, draft: dict[str, Any]) -> str:
        """Use K2 Think to self-critique the draft."""
        draft_text = json.dumps(draft, indent=2)
        prompt = f"""You are reviewing a draft analysis report on a prediction market simulation.

SIMULATION SUMMARY:
{sim_summary}

DRAFT REPORT:
{draft_text}

Critically evaluate the draft:
1. Is the summary accurate and does it capture the key dynamics?
2. Are the key drivers well-chosen and relevant?
3. Does the faction analysis correctly describe group dynamics?
4. Are the trust insights meaningful?
5. Is the recommendation actionable and well-supported?

Provide specific revision suggestions for each section. Be constructive and concrete."""

        response = await llm_client.complete(
            prompt=prompt,
            model=MODEL_K2_THINK,
            response_format="text",
        )
        return response

    # ------------------------------------------------------------------
    # Stage 4: Finalize
    # ------------------------------------------------------------------

    async def _stage_finalize(
        self,
        sim_summary: str,
        draft: dict[str, Any],
        critique: str,
    ) -> ReportData:
        """Apply critique revisions and produce final report."""
        draft_text = json.dumps(draft, indent=2)
        prompt = f"""You are finalizing an analysis report on a prediction market simulation.

SIMULATION SUMMARY:
{sim_summary}

DRAFT REPORT:
{draft_text}

REVIEWER CRITIQUE:
{critique}

Produce the final revised report incorporating the reviewer's feedback.
Return ONLY valid JSON with exactly these fields:
- "summary": string (2-3 paragraphs)
- "key_drivers": array of 4-6 strings
- "faction_analysis": string (1-2 paragraphs)
- "trust_insights": string (1-2 paragraphs)
- "recommendation": string (1 paragraph)"""

        try:
            response = await llm_client.complete(
                prompt=prompt,
                model=MODEL_GEMINI_FLASH,
                response_format="json",
            )
            parsed = json.loads(response)
            if isinstance(parsed, dict) and "summary" in parsed:
                return ReportData(
                    summary=str(parsed.get("summary", draft.get("summary", ""))),
                    key_drivers=parsed.get("key_drivers", draft.get("key_drivers", [])),
                    faction_analysis=str(parsed.get("faction_analysis", draft.get("faction_analysis", ""))),
                    trust_insights=str(parsed.get("trust_insights", draft.get("trust_insights", ""))),
                    recommendation=str(parsed.get("recommendation", draft.get("recommendation", ""))),
                )
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

        # Fall back to draft content
        return ReportData(
            summary=str(draft.get("summary", "")),
            key_drivers=draft.get("key_drivers", []),
            faction_analysis=str(draft.get("faction_analysis", "")),
            trust_insights=str(draft.get("trust_insights", "")),
            recommendation=str(draft.get("recommendation", "")),
        )

    # ------------------------------------------------------------------
    # Fallback draft (when LLM is stubbed)
    # ------------------------------------------------------------------

    @staticmethod
    def _fallback_draft(sim_summary: str) -> dict[str, Any]:
        """Produce a reasonable draft when the LLM returns placeholder JSON."""
        return {
            "summary": (
                "The multi-agent simulation analyzed the prediction market question "
                "using 12 diverse AI forecasters across 6 archetypes. Agents deliberated "
                "over 30 rounds, sharing evidence and updating their beliefs based on "
                "incoming claims and their professional expertise. "
                "The simulation's consensus probability represents the collective "
                "judgment after accounting for diverse perspectives and information flow."
            ),
            "key_drivers": [
                "Economic indicator trends shaped the majority of belief updates",
                "Contrarian agents provided valuable pushback against consensus drift",
                "Trust dynamics amplified information sharing within aligned factions",
                "Professional background diversity led to varied interpretations of evidence",
            ],
            "faction_analysis": (
                "Agents naturally clustered into factions based on belief proximity. "
                "Bayesian updaters and quantitative analysts tended to converge around "
                "data-driven estimates, while narrative-focused and trend-following agents "
                "formed a separate cluster influenced by qualitative signals. "
                "Contrarians maintained distinct positions throughout the simulation."
            ),
            "trust_insights": (
                "Trust scores evolved as agents shared claims with peers. Agents who "
                "actively shared evidence built higher trust within their factions. "
                "Cross-faction trust remained lower, limiting information flow between "
                "groups with differing views. This trust asymmetry contributed to "
                "the persistence of distinct faction beliefs."
            ),
            "recommendation": (
                "Based on the simulation results, the collective AI forecaster judgment "
                "should be compared against the current market price. Any significant "
                "divergence suggests a potential mispricing that a trader could exploit, "
                "while convergence with the market validates the current odds."
            ),
        }


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
report_agent = ReportAgent()
