"""
Claims Generator Service — Person 2

Generates 20-30 structured claims for a given market using Gemini Pro via LLMClient.

Usage (wired by Person 1 into POST /api/sessions/{market_id}/claims/generate):
    from app.services.claims_generator import claims_generator
    result = await claims_generator.generate(market_id=..., session_id=...)
"""

# TODO: implement after Person 1 commits model stubs (app.models.claim, app.models.session)
