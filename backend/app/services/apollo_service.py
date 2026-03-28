"""
Apollo Service — Person 2

Finds real professionals relevant to a market question via Apollo.io (through Lava).
Falls back to K2-generated synthetic profiles if Apollo returns fewer than 6 results.

Usage (consumed by Person 3's world_builder):
    from app.services.apollo_service import apollo_service
    profiles = await apollo_service.get_relevant_professionals(market_question="...")
"""

# TODO: implement after LLMClient real implementation is done
