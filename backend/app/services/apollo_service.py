"""
Apollo Service — Person 2

Finds real professionals relevant to a market question via Apollo.io (through Lava).
Falls back to K2-generated synthetic profiles if Apollo returns fewer than 6 results.

Usage (consumed by Person 3's world_builder):
    from app.services.apollo_service import apollo_service
    profiles = await apollo_service.get_relevant_professionals(market_question="...")
"""

from __future__ import annotations

import json

from pydantic import BaseModel, Field, ValidationError

from app.core.llm_client import MODEL_GEMINI_PRO, MODEL_K2_THINK, llm_client
from app.schemas.simulation import ProfessionalBackground


class ApolloSearchPlan(BaseModel):
    job_titles: list[str] = Field(min_length=1)
    keywords: list[str] = Field(min_length=1)


class SyntheticProfilesEnvelope(BaseModel):
    profiles: list[ProfessionalBackground] = Field(min_length=1)


class ApolloService:
    async def get_relevant_professionals(
        self,
        market_question: str,
        limit: int = 12,
    ) -> list[ProfessionalBackground]:
        plan = await self._build_search_plan(market_question=market_question)
        apollo_results = await llm_client.call_apollo(
            job_titles=plan.job_titles,
            keywords=plan.keywords,
            limit=limit,
        )

        real_profiles = [
            self._to_professional_background(result) for result in apollo_results
        ]

        if len(real_profiles) >= 6:
            return real_profiles[:limit]

        synthetic_profiles = await self._generate_synthetic_profiles(
            market_question=market_question,
            desired_count=limit - len(real_profiles),
            excluded_titles={profile.title for profile in real_profiles},
        )
        combined_profiles = real_profiles + synthetic_profiles
        return combined_profiles[:limit]

    async def _build_search_plan(self, market_question: str) -> ApolloSearchPlan:
        prompt = (
            "You are preparing an Apollo.io search for forecasting experts.\n\n"
            f"Prediction market question:\n{market_question}\n\n"
            "Return JSON with:\n"
            "- job_titles: 5 to 8 relevant professional job titles\n"
            "- keywords: 5 to 10 short domain keywords for Apollo search\n\n"
            "Choose titles and keywords that would help find professionals who would "
            "reason credibly about this market."
        )
        raw_response = await llm_client.complete(
            prompt=prompt,
            model=MODEL_GEMINI_PRO,
            response_format="json",
        )
        payload = json.loads(raw_response)
        try:
            plan = ApolloSearchPlan.model_validate(payload)
        except ValidationError as exc:
            raise ValueError("Invalid Apollo search plan returned by LLM") from exc

        plan.job_titles = self._dedupe_strings(plan.job_titles)
        plan.keywords = self._dedupe_strings(plan.keywords)
        return plan

    async def _generate_synthetic_profiles(
        self,
        market_question: str,
        desired_count: int,
        excluded_titles: set[str],
    ) -> list[ProfessionalBackground]:
        if desired_count <= 0:
            return []

        prompt = (
            "Generate synthetic but realistic professional backgrounds for a market-forecasting "
            "simulation.\n\n"
            f"Prediction market question:\n{market_question}\n\n"
            f"Return exactly {desired_count} profiles as JSON with a top-level `profiles` field.\n"
            "Each profile must include:\n"
            "- title\n"
            "- company\n"
            "- industry\n"
            "- apollo_enriched\n\n"
            "Rules:\n"
            "- apollo_enriched must be false for every synthetic profile.\n"
            "- Use realistic titles, companies, and industries.\n"
            "- Avoid generic placeholders.\n"
            f"- Avoid reusing these titles: {sorted(excluded_titles) if excluded_titles else 'none'}."
        )
        raw_response = await llm_client.complete(
            prompt=prompt,
            model=MODEL_K2_THINK,
            response_format="json",
        )
        payload = json.loads(raw_response)
        try:
            envelope = SyntheticProfilesEnvelope.model_validate(payload)
        except ValidationError as exc:
            raise ValueError(
                "Invalid synthetic profile payload returned by LLM"
            ) from exc

        return [
            ProfessionalBackground(
                title=profile.title.strip(),
                company=profile.company.strip(),
                industry=profile.industry.strip(),
                apollo_enriched=False,
            )
            for profile in envelope.profiles[:desired_count]
        ]

    def _to_professional_background(
        self, payload: dict[str, object]
    ) -> ProfessionalBackground:
        title = str(payload.get("title", "")).strip()
        company = str(payload.get("company", "")).strip()
        industry = str(payload.get("industry", "")).strip()

        if not title or not company or not industry:
            raise ValueError(
                "Apollo payload missing required professional background fields"
            )

        return ProfessionalBackground(
            title=title,
            company=company,
            industry=industry,
            apollo_enriched=True,
        )

    def _dedupe_strings(self, values: list[str]) -> list[str]:
        seen: set[str] = set()
        deduped: list[str] = []
        for value in values:
            normalized = value.strip()
            key = normalized.lower()
            if not normalized or key in seen:
                continue
            seen.add(key)
            deduped.append(normalized)
        return deduped


apollo_service = ApolloService()
