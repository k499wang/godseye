import json
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urlparse

import httpx

from app.core.config import settings


@dataclass(frozen=True)
class PolymarketMarketSnapshot:
    polymarket_id: str
    question: str
    resolution_criteria: str
    current_probability: Decimal
    volume: Decimal


class PolymarketClientError(Exception):
    def __init__(self, *, status_code: int, detail: str, code: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.code = code


def _coerce_decimal(value: Any, *, default: str = "0") -> Decimal:
    if value is None:
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float, str)):
        try:
            return Decimal(str(value))
        except InvalidOperation:
            return Decimal(default)
    return Decimal(default)


class PolymarketClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        timeout_seconds: float | None = None,
        max_retries: int | None = None,
    ) -> None:
        self.base_url = (base_url or settings.polymarket_gamma_base_url).rstrip("/")
        self.timeout_seconds = timeout_seconds or settings.polymarket_timeout_seconds
        self.max_retries = max_retries or settings.polymarket_max_retries

    async def fetch_market(self, market_url: str) -> PolymarketMarketSnapshot:
        slug = self.parse_market_slug(market_url)
        payload = await self._get_market_payload(slug)
        return self._normalize_market_payload(payload, fallback_slug=slug)

    def parse_market_slug(self, market_url: str) -> str:
        parsed = urlparse(market_url)
        path = parsed.path.strip("/")
        segments = [segment for segment in path.split("/") if segment]

        if parsed.scheme and parsed.netloc:
            hostname = (parsed.hostname or "").lower()
            if hostname not in {"polymarket.com", "www.polymarket.com"}:
                raise PolymarketClientError(
                    status_code=422,
                    detail="Invalid Polymarket URL format",
                    code="INVALID_URL",
                )
            if len(segments) >= 2 and segments[0] == "event":
                return segments[-1]
        elif segments:
            return segments[-1]

        raise PolymarketClientError(
            status_code=422,
            detail="Invalid Polymarket URL format",
            code="INVALID_URL",
        )

    async def _get_market_payload(self, slug: str) -> dict[str, Any]:
        last_error: Exception | None = None
        async with httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout_seconds,
            headers={"Accept": "application/json"},
        ) as client:
            for attempt in range(1, self.max_retries + 1):
                try:
                    payload = await self._fetch_market_or_event_payload(client=client, slug=slug)
                    if not isinstance(payload, dict):
                        raise PolymarketClientError(
                            status_code=502,
                            detail="Unexpected Polymarket response format",
                            code="UPSTREAM_BAD_RESPONSE",
                        )
                    return payload
                except PolymarketClientError:
                    raise
                except (httpx.HTTPError, ValueError) as exc:
                    last_error = exc
                    if attempt == self.max_retries:
                        break

        raise PolymarketClientError(
            status_code=502,
            detail="Failed to fetch market data from Polymarket",
            code="UPSTREAM_UNAVAILABLE",
        ) from last_error

    async def _fetch_market_or_event_payload(
        self,
        *,
        client: httpx.AsyncClient,
        slug: str,
    ) -> dict[str, Any]:
        market_response = await client.get(f"/markets/slug/{slug}")
        if market_response.status_code == 200:
            return market_response.json()
        if market_response.status_code not in {404, 429, 500, 502, 503, 504}:
            market_response.raise_for_status()
        if market_response.status_code in {429, 500, 502, 503, 504}:
            market_response.raise_for_status()

        event_response = await client.get(f"/events/slug/{slug}")
        if event_response.status_code == 404:
            raise PolymarketClientError(
                status_code=404,
                detail="Polymarket market not found",
                code="MARKET_NOT_FOUND",
            )
        if event_response.status_code in {429, 500, 502, 503, 504}:
            event_response.raise_for_status()
        event_response.raise_for_status()

        event_payload = event_response.json()
        if not isinstance(event_payload, dict):
            raise PolymarketClientError(
                status_code=502,
                detail="Unexpected Polymarket response format",
                code="UPSTREAM_BAD_RESPONSE",
            )

        markets = event_payload.get("markets")
        if not isinstance(markets, list) or not markets:
            raise PolymarketClientError(
                status_code=502,
                detail="Polymarket event response did not include markets",
                code="UPSTREAM_BAD_RESPONSE",
            )

        first_market = markets[0]
        if not isinstance(first_market, dict):
            raise PolymarketClientError(
                status_code=502,
                detail="Unexpected Polymarket market payload inside event response",
                code="UPSTREAM_BAD_RESPONSE",
            )

        # Inject parent event context so the sub-market question isn't opaque
        event_title = event_payload.get("title") or event_payload.get("question") or ""
        if event_title:
            first_market["_event_title"] = str(event_title).strip()
            all_outcomes = [
                str(m.get("question") or m.get("title") or "").strip()
                for m in markets
                if isinstance(m, dict)
            ]
            first_market["_event_outcomes"] = [o for o in all_outcomes if o]

        return first_market

    def _normalize_market_payload(
        self,
        payload: dict[str, Any],
        *,
        fallback_slug: str,
    ) -> PolymarketMarketSnapshot:
        polymarket_id = str(payload.get("slug") or payload.get("id") or fallback_slug).strip()
        question = str(payload.get("question") or payload.get("title") or "").strip()

        # If this sub-market came from a multi-outcome event, prepend event
        # context so downstream consumers (claims generator, agents) understand
        # what the market is actually about.
        event_title = payload.get("_event_title")
        event_outcomes = payload.get("_event_outcomes")
        if event_title and event_title != question:
            outcomes_note = ""
            if event_outcomes and len(event_outcomes) > 1:
                outcomes_note = (
                    f"\nOther outcomes in this event: {', '.join(event_outcomes)}"
                )
            question = f"[Event: {event_title}] {question}{outcomes_note}"

        resolution_criteria = str(
            payload.get("resolution_criteria")
            or payload.get("description")
            or payload.get("rules")
            or payload.get("resolutionCriteria")
            or ""
        ).strip()
        if not question or not resolution_criteria:
            raise PolymarketClientError(
                status_code=502,
                detail="Polymarket market response is missing required fields",
                code="UPSTREAM_BAD_RESPONSE",
            )

        current_probability = self._extract_probability(payload)
        volume = self._extract_volume(payload)

        return PolymarketMarketSnapshot(
            polymarket_id=polymarket_id,
            question=question,
            resolution_criteria=resolution_criteria,
            current_probability=current_probability,
            volume=volume,
        )

    def _extract_probability(self, payload: dict[str, Any]) -> Decimal:
        direct_probability = payload.get("current_probability") or payload.get("probability")
        if direct_probability is not None:
            probability = _coerce_decimal(direct_probability)
        else:
            probability = self._extract_probability_from_outcomes(payload)

        if probability < 0:
            return Decimal("0")
        if probability > 1:
            return probability / Decimal("100")
        return probability

    def _extract_probability_from_outcomes(self, payload: dict[str, Any]) -> Decimal:
        outcome_prices = payload.get("outcomePrices")
        if isinstance(outcome_prices, str):
            try:
                outcome_prices = json.loads(outcome_prices)
            except json.JSONDecodeError:
                outcome_prices = None
        if isinstance(outcome_prices, list) and outcome_prices:
            return _coerce_decimal(outcome_prices[0])

        yes_price = payload.get("yes_price") or payload.get("yesPrice")
        return _coerce_decimal(yes_price)

    def _extract_volume(self, payload: dict[str, Any]) -> Decimal:
        for key in ("volume", "volumeNum", "volumeUsd", "liquidity", "liquidityClob"):
            if payload.get(key) is not None:
                volume = _coerce_decimal(payload[key])
                return max(volume, Decimal("0"))
        return Decimal("0")

    def _extract_market_probability_value(self, payload: dict[str, Any]) -> float | None:
        direct_probability = payload.get("current_probability")
        if direct_probability is None:
            direct_probability = payload.get("probability")

        if direct_probability is not None:
            probability = float(_coerce_decimal(direct_probability))
        else:
            outcome_prices = payload.get("outcomePrices")
            if isinstance(outcome_prices, str):
                try:
                    outcome_prices = json.loads(outcome_prices)
                except json.JSONDecodeError:
                    outcome_prices = None

            if isinstance(outcome_prices, list) and outcome_prices:
                probability = float(_coerce_decimal(outcome_prices[0]))
            else:
                yes_price = payload.get("yes_price")
                if yes_price is None:
                    yes_price = payload.get("yesPrice")
                if yes_price is None:
                    return None
                probability = float(_coerce_decimal(yes_price))

        if probability > 1.0:
            probability /= 100.0
        if 0.0 <= probability <= 1.0:
            return probability
        return None

    def _extract_event_probability(self, payload: dict[str, Any]) -> float | None:
        markets = payload.get("markets")
        if not isinstance(markets, list) or not markets:
            return None

        probabilities = [
            probability
            for market in markets
            if isinstance(market, dict)
            for probability in [self._extract_market_probability_value(market)]
            if probability is not None
        ]

        if not probabilities:
            return None

        # For multi-outcome events, surface the favorite's implied probability
        # so the browse UI reflects a live Polymarket number instead of a
        # placeholder.
        return max(probabilities)

    @staticmethod
    def _coerce_bool(value: Any) -> bool | None:
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"true", "1", "yes"}:
                return True
            if lowered in {"false", "0", "no"}:
                return False
        return None

    def _event_looks_inactive_or_resolved(self, event: dict[str, Any]) -> bool:
        for key in ("active",):
            value = self._coerce_bool(event.get(key))
            if value is False:
                return True

        for key in ("closed", "resolved", "archived", "inactive"):
            value = self._coerce_bool(event.get(key))
            if value is True:
                return True

        return False

    async def fetch_active_events(self, limit: int = 20) -> list[dict[str, Any]]:
        """
        Return a list of active Polymarket events sorted by volume, suitable
        for the browse feed.  Each item is a normalised dict with keys:
            slug, title, description, url, image, volume, volume24hr, probability
        """
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.get(
                f"{self.base_url}/events",
                params={
                    "active": "true",
                    "limit": str(limit),
                    "order": "volume24hr",
                    "ascending": "false",
                },
            )
            response.raise_for_status()

        raw_events: list[dict[str, Any]] = response.json()
        if not isinstance(raw_events, list):
            return []

        results: list[dict[str, Any]] = []
        for event in raw_events:
            if not isinstance(event, dict):
                continue
            if self._event_looks_inactive_or_resolved(event):
                continue
            slug = str(event.get("slug") or "").strip()
            title = str(event.get("title") or "").strip()
            if not slug or not title:
                continue

            description = str(event.get("description") or "").strip()
            image = event.get("image") or event.get("icon") or None
            volume = float(_coerce_decimal(event.get("volume") or 0))
            volume24hr = float(_coerce_decimal(event.get("volume24hr") or 0))
            url = f"https://polymarket.com/event/{slug}"
            tag_slugs: list[str] = []
            raw_tags = event.get("tags")
            if isinstance(raw_tags, list):
                for tag in raw_tags:
                    if not isinstance(tag, dict):
                        continue
                    tag_slug = str(tag.get("slug") or "").strip().lower()
                    if tag_slug and tag_slug not in tag_slugs:
                        tag_slugs.append(tag_slug)

            probability = self._extract_event_probability(event)

            results.append({
                "slug": slug,
                "title": title,
                "description": description,
                "url": url,
                "image": image,
                "volume": volume,
                "volume24hr": volume24hr,
                "probability": probability,
                "tag_slugs": tag_slugs,
            })

        return results


polymarket_client = PolymarketClient()
