"""
Claims Generator Service — Person 2

Generates structured claims for a market using Gemini Pro.
Person 1 wires this service into the fixed claims route and persists the result.
"""

from __future__ import annotations

import json
from decimal import Decimal
from json import JSONDecodeError
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


class ClaimsGeneratorInputError(ValueError):
    pass


class ClaimsGeneratorDependencyError(RuntimeError):
    pass


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
        *,
        db: AsyncSession,
        market_id: UUID,
    ) -> ClaimsGenerateResponse:
        market, analysis_session = await self._load_market_and_session(
            db=db,
            market_id=market_id,
        )

        existing_claims = await self._load_existing_claims(
            db=db,
            market_id=market_id,
            session_id=analysis_session.id,
        )
        if existing_claims:
            return self._to_response(
                market_id=market_id,
                session_id=analysis_session.id,
                claims=existing_claims,
            )

        prompt = self._build_claims_prompt(market=market)
        try:
            raw_response = await llm_client.complete(
                prompt=prompt,
                model=MODEL_GEMINI_PRO,
                response_format="json",
            )
        except RuntimeError as exc:
            raise ClaimsGeneratorDependencyError(str(exc)) from exc

        claims_payload = self._parse_claims_response(raw_response)
        claim_models = [
            Claim(
                session_id=analysis_session.id,
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

        return self._to_response(
            market_id=market_id,
            session_id=analysis_session.id,
            claims=claim_models,
        )

    async def _load_market_and_session(
        self,
        *,
        db: AsyncSession,
        market_id: UUID,
    ) -> tuple[Market, AnalysisSession]:
        stmt: Select[tuple[Market, AnalysisSession]] = (
            select(Market, AnalysisSession)
            .join(AnalysisSession, AnalysisSession.market_id == Market.id)
            .where(Market.id == market_id)
        )
        result = await db.execute(stmt)
        row = result.one_or_none()
        if row is None:
            raise ClaimsGeneratorInputError("Analysis session not found for market")
        return row

    async def _load_existing_claims(
        self,
        *,
        db: AsyncSession,
        market_id: UUID,
        session_id: UUID,
    ) -> list[Claim]:
        stmt: Select[tuple[Claim]] = (
            select(Claim)
            .where(Claim.market_id == market_id, Claim.session_id == session_id)
            .order_by(Claim.created_at.asc(), Claim.id.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

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
        try:
            payload = json.loads(raw_response)
        except JSONDecodeError as exc:
            raise ValueError("Claims generator returned invalid JSON") from exc

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

    def _to_response(
        self,
        *,
        market_id: UUID,
        session_id: UUID,
        claims: list[Claim],
    ) -> ClaimsGenerateResponse:
        return ClaimsGenerateResponse(
            session_id=session_id,
            market_id=market_id,
            claims=[ClaimSchema.model_validate(claim) for claim in claims],
        )


claims_generator = ClaimsGeneratorService()
