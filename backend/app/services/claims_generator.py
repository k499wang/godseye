"""
Claims Generator Service — Person 2

Generates 20-30 structured claims for a given market using Gemini Pro via LLMClient.

Usage (wired by Person 1 into POST /api/sessions/{market_id}/claims/generate):
    from app.services.claims_generator import claims_generator
    result = await claims_generator.generate(db=session, market_id=..., session_id=...)
"""

from __future__ import annotations

import json
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm_client import MODEL_GEMINI_PRO, llm_client
from app.models.claim import Claim
from app.models.market import Market
from app.models.session import AnalysisSession
from app.schemas.claim import ClaimSchema
from app.schemas.market import ClaimsGenerateResponse


class GeneratedClaimPayload(BaseModel):
    text: str = Field(min_length=1)
    stance: str
    strength_score: float = Field(ge=0.0, le=1.0)
    novelty_score: float = Field(ge=0.0, le=1.0)


class GeneratedClaimsEnvelope(BaseModel):
    claims: list[GeneratedClaimPayload] = Field(min_length=1)


class ClaimsGeneratorService:
    async def generate(
        self,
        db: AsyncSession,
        market_id: UUID,
        session_id: UUID,
    ) -> ClaimsGenerateResponse:
        market = await self._load_market(
            db=db, market_id=market_id, session_id=session_id
        )
        prompt = self._build_claims_prompt(market=market)
        raw_response = await llm_client.complete(
            prompt=prompt,
            model=MODEL_GEMINI_PRO,
            response_format="json",
        )

        claims_payload = self._parse_claims_response(raw_response)
        claim_models = [
            Claim(
                session_id=session_id,
                market_id=market_id,
                text=claim.text.strip(),
                stance=claim.stance,  # type: ignore[arg-type]
                strength_score=Decimal(str(claim.strength_score)),
                novelty_score=Decimal(str(claim.novelty_score)),
            )
            for claim in claims_payload.claims
        ]

        db.add_all(claim_models)
        await db.commit()

        for claim in claim_models:
            await db.refresh(claim)

        return ClaimsGenerateResponse(
            session_id=session_id,
            market_id=market_id,
            claims=[ClaimSchema.model_validate(claim) for claim in claim_models],
        )

    async def _load_market(
        self,
        db: AsyncSession,
        market_id: UUID,
        session_id: UUID,
    ) -> Market:
        stmt: Select[tuple[Market]] = (
            select(Market)
            .join(AnalysisSession, AnalysisSession.market_id == Market.id)
            .where(Market.id == market_id, AnalysisSession.id == session_id)
        )
        result = await db.execute(stmt)
        market = result.scalar_one_or_none()
        if market is None:
            raise ValueError("Market/session combination not found")
        return market

    def _build_claims_prompt(self, market: Market) -> str:
        return (
            "Generate 20-30 structured claims for this prediction market.\n\n"
            f"Market question:\n{market.question}\n\n"
            f"Resolution criteria:\n{market.resolution_criteria}\n\n"
            "Return a JSON object with a `claims` field containing an array.\n"
            "Each claim must include:\n"
            "- text\n"
            "- stance (`yes` or `no`)\n"
            "- strength_score (0.0 to 1.0)\n"
            "- novelty_score (0.0 to 1.0)\n\n"
            "Rules:\n"
            "- `yes` means the claim supports the market resolving YES.\n"
            "- `no` means the claim supports the market resolving NO.\n"
            "- Cover both sides of the market.\n"
            "- Focus on material evidence, catalysts, and arguments.\n"
            "- Do not include markdown fences or commentary."
        )

    def _parse_claims_response(self, raw_response: str) -> GeneratedClaimsEnvelope:
        payload = json.loads(raw_response)
        if isinstance(payload, list):
            payload = {"claims": payload}

        try:
            envelope = GeneratedClaimsEnvelope.model_validate(payload)
        except ValidationError as exc:
            raise ValueError("Invalid claims payload returned by LLM") from exc

        normalized_claims: list[GeneratedClaimPayload] = []
        for claim in envelope.claims:
            stance = claim.stance.strip().lower()
            if stance not in {"yes", "no"}:
                raise ValueError(
                    f"Invalid claim stance '{claim.stance}' returned by LLM"
                )

            normalized_claims.append(
                GeneratedClaimPayload(
                    text=claim.text.strip(),
                    stance=stance,
                    strength_score=claim.strength_score,
                    novelty_score=claim.novelty_score,
                )
            )

        return GeneratedClaimsEnvelope(claims=normalized_claims)


claims_generator = ClaimsGeneratorService()
