import os
import sys
import unittest


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)


from app.services.simulation_runner import Claim, SimulationRunner  # noqa: E402
from app.services.world_builder import AgentRecord  # noqa: E402


class SimulationRunnerShareTests(unittest.TestCase):
    def setUp(self) -> None:
        self.runner = SimulationRunner()
        self.agent = AgentRecord(
            id="agent-a",
            simulation_id="sim-1",
            name="Ava",
            archetype="bayesian_updater",
            initial_belief=0.64,
            current_belief=0.64,
            confidence=0.72,
            professional_background={},
            trust_scores={"agent-b": 0.7, "agent-c": 0.6},
        )
        self.other_agents = [
            self.agent,
            AgentRecord(
                id="agent-b",
                simulation_id="sim-1",
                name="Blake",
                archetype="trend_follower",
                initial_belief=0.5,
                current_belief=0.5,
                confidence=0.4,
                professional_background={},
                trust_scores={"agent-a": 0.5},
            ),
            AgentRecord(
                id="agent-c",
                simulation_id="sim-1",
                name="Casey",
                archetype="contrarian",
                initial_belief=0.4,
                current_belief=0.4,
                confidence=0.6,
                professional_background={},
                trust_scores={"agent-a": 0.5},
            ),
        ]
        self.visible_claims = [
            Claim(
                id="claim-1",
                text="Rate cuts are getting closer.",
                stance="yes",
                strength_score=0.7,
                novelty_score=0.5,
            )
        ]

    def test_validate_share_action_accepts_new_claim_text(self) -> None:
        is_valid = self.runner._validate_share_action(
            action={
                "action": "share_claim",
                "claim_text": "Payroll weakness is starting to matter.",
                "claim_stance": "yes",
                "target_agent_ids": ["agent-b", "agent-c"],
            },
            agent=self.agent,
            visible_claims=self.visible_claims,
            incoming_claims=[],
            all_agents=self.other_agents,
        )

        self.assertTrue(is_valid)

    def test_resolve_share_claim_reuses_existing_matching_text(self) -> None:
        claims_by_id = {claim.id: claim for claim in self.visible_claims}
        claim_origins = {claim.id: None for claim in self.visible_claims}

        resolved = self.runner._resolve_share_claim(
            action={
                "action": "share_claim",
                "claim_text": "Rate cuts are getting closer.",
                "claim_stance": "yes",
                "target_agent_ids": ["agent-b"],
            },
            agent=self.agent,
            visible_claims=self.visible_claims,
            incoming_claims=[],
            claims_by_id=claims_by_id,
            claim_origins=claim_origins,
        )

        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.id, "claim-1")

    def test_resolve_share_claim_creates_new_claim_when_text_is_new(self) -> None:
        claims_by_id = {claim.id: claim for claim in self.visible_claims}
        claim_origins = {claim.id: None for claim in self.visible_claims}

        resolved = self.runner._resolve_share_claim(
            action={
                "action": "share_claim",
                "claim_text": "Regional banks are tightening credit faster than expected.",
                "target_agent_ids": ["agent-b", "agent-c"],
            },
            agent=self.agent,
            visible_claims=self.visible_claims,
            incoming_claims=[],
            claims_by_id=claims_by_id,
            claim_origins=claim_origins,
        )

        self.assertIsNotNone(resolved)
        assert resolved is not None
        self.assertNotEqual(resolved.id, "claim-1")
        self.assertEqual(resolved.stance, "yes")
        self.assertEqual(
            resolved.text,
            "Regional banks are tightening credit faster than expected.",
        )
        self.assertGreaterEqual(resolved.strength_score, 0.35)
        self.assertGreaterEqual(resolved.novelty_score, 0.25)

    def test_resolve_share_claim_prefers_strong_self_originated_claim(self) -> None:
        external_claim = Claim(
            id="claim-external",
            text="The market is too complacent about inflation persistence.",
            stance="no",
            strength_score=0.76,
            novelty_score=0.4,
        )
        own_claim = Claim(
            id="claim-own",
            text="Labor softness is spreading into services hiring.",
            stance="yes",
            strength_score=0.88,
            novelty_score=0.71,
        )
        visible_claims = [external_claim, own_claim]
        claims_by_id = {claim.id: claim for claim in visible_claims}
        claim_origins = {
            "claim-external": "agent-b",
            "claim-own": "agent-a",
        }

        resolved = self.runner._resolve_share_claim(
            action={
                "action": "share_claim",
                "claim_id": "claim-external",
                "target_agent_ids": ["agent-b", "agent-c"],
            },
            agent=self.agent,
            visible_claims=visible_claims,
            incoming_claims=[],
            claims_by_id=claims_by_id,
            claim_origins=claim_origins,
        )

        self.assertIsNotNone(resolved)
        assert resolved is not None
        self.assertEqual(resolved.id, "claim-own")

    def test_resolve_share_claim_falls_back_to_external_if_own_claim_is_weak(self) -> None:
        external_claim = Claim(
            id="claim-external",
            text="The market is too complacent about inflation persistence.",
            stance="no",
            strength_score=0.9,
            novelty_score=0.82,
        )
        own_claim = Claim(
            id="claim-own",
            text="A minor anecdote from one regional bank is worth watching.",
            stance="yes",
            strength_score=0.38,
            novelty_score=0.31,
        )
        visible_claims = [external_claim, own_claim]
        claims_by_id = {claim.id: claim for claim in visible_claims}
        claim_origins = {
            "claim-external": "agent-b",
            "claim-own": "agent-a",
        }

        resolved = self.runner._resolve_share_claim(
            action={
                "action": "share_claim",
                "claim_id": "claim-external",
                "target_agent_ids": ["agent-b", "agent-c"],
            },
            agent=self.agent,
            visible_claims=visible_claims,
            incoming_claims=[],
            claims_by_id=claims_by_id,
            claim_origins=claim_origins,
        )

        self.assertIsNotNone(resolved)
        assert resolved is not None
        self.assertEqual(resolved.id, "claim-external")

    def test_create_claim_shares_carries_generated_claim_metadata(self) -> None:
        generated_claim = Claim(
            id="claim-new",
            text="Forward guidance is softening.",
            stance="yes",
            strength_score=0.83,
            novelty_score=0.74,
        )

        shares = self.runner._create_claim_shares(
            agent=self.agent,
            action={
                "action": "share_claim",
                "target_agent_ids": ["agent-b", "agent-c"],
                "commentary": "This matters more than the market thinks.",
            },
            all_agents=self.other_agents,
            claim=generated_claim,
            current_tick=4,
            simulation_id="sim-1",
        )

        self.assertEqual(len(shares), 2)
        self.assertTrue(all(share.claim_id == "claim-new" for share in shares))
        self.assertTrue(all(share.claim_text == generated_claim.text for share in shares))
        self.assertTrue(all(share.claim_stance == "yes" for share in shares))
        self.assertTrue(all(share.claim_strength_score == 0.83 for share in shares))
        self.assertTrue(all(share.claim_novelty_score == 0.74 for share in shares))


if __name__ == "__main__":
    unittest.main()
