"""
Geo Enrichment — assigns lat/lng/region to prediction markets via Gemini.

Called once per browse cache refresh (every hour), so the LLM cost is minimal.
Falls back to lat=0/lng=0/region="Global" for any market Gemini can't classify.
"""

from __future__ import annotations

import json

from app.core.llm_client import MODEL_GEMINI_FLASH, llm_client


async def enrich_with_geo(markets: list[dict]) -> list[dict]:
    """
    Takes the raw market dicts from fetch_active_events and adds
    lat, lng, region fields to each by asking Gemini in a single call.
    Mutates and returns the same list.
    """
    if not markets:
        return markets

    items = [{"slug": m["slug"], "title": m["title"]} for m in markets]

    prompt = (
        "You are a geography classifier for prediction markets.\n\n"
        "For each market, assign the most relevant geographic coordinates and region name:\n"
        "- Sports markets: use the home city of the relevant team or event venue\n"
        "- Geopolitical/political markets: use the relevant country capital or region center\n"
        "- Crypto/tech/abstract markets: spread them across different world locations "
        "(e.g. Bitcoin → San Francisco, Ethereum → Berlin, AI → Tokyo)\n"
        "- Global multi-country events: pick the most relevant country\n\n"
        f"Markets:\n{json.dumps(items, indent=2)}\n\n"
        "Return JSON with a 'markets' array where each item has:\n"
        "- slug (string, unchanged from input)\n"
        "- lat (float, -90 to 90, avoid poles — keep between -60 and 60)\n"
        "- lng (float, -180 to 180)\n"
        "- region (string, e.g. 'United States', 'Eastern Europe', 'Global')"
    )

    try:
        response = await llm_client.complete(
            prompt=prompt,
            model=MODEL_GEMINI_FLASH,
            response_format="json",
        )
        parsed = json.loads(response)
        geo_map = {item["slug"]: item for item in parsed.get("markets", []) if isinstance(item, dict)}
    except Exception:
        geo_map = {}

    for market in markets:
        geo = geo_map.get(market["slug"], {})
        try:
            lat = float(geo.get("lat", 0.0))
            lng = float(geo.get("lng", 0.0))
            # Clamp to safe globe range
            lat = max(-60.0, min(60.0, lat))
            lng = max(-180.0, min(180.0, lng))
        except (TypeError, ValueError):
            lat, lng = 0.0, 0.0
        market["lat"] = lat
        market["lng"] = lng
        market["region"] = str(geo.get("region") or "Global").strip()

    return markets
