import { NextRequest, NextResponse } from "next/server";

const POLYMARKET_GAMMA_BASE_URL = "https://gamma-api.polymarket.com";

export const dynamic = "force-dynamic";

function parseMarketSlug(marketUrl: string): string {
  const parsed = new URL(marketUrl);
  const segments = parsed.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (
    !["polymarket.com", "www.polymarket.com"].includes(parsed.hostname.toLowerCase())
  ) {
    throw new Error("Invalid Polymarket URL");
  }

  if (segments.length >= 2 && segments[0] === "event") {
    return segments[segments.length - 1];
  }

  throw new Error("Invalid Polymarket URL");
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeProbability(value: number | null): number | null {
  if (value == null) return null;

  const normalized = value > 1 ? value / 100 : value;
  if (normalized < 0 || normalized > 1) return null;
  return normalized;
}

function parseOutcomePrices(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}

function extractMarketProbability(payload: Record<string, unknown>): number | null {
  const directProbability =
    parseNumericValue(payload.current_probability) ??
    parseNumericValue(payload.probability);

  if (directProbability != null) {
    return normalizeProbability(directProbability);
  }

  const outcomePrices = parseOutcomePrices(payload.outcomePrices);
  if (outcomePrices?.length) {
    return normalizeProbability(parseNumericValue(outcomePrices[0]));
  }

  return normalizeProbability(
    parseNumericValue(payload.yes_price) ?? parseNumericValue(payload.yesPrice)
  );
}

function extractEventProbability(payload: Record<string, unknown>): number | null {
  const markets = payload.markets;
  if (!Array.isArray(markets)) return null;

  const probabilities = markets
    .filter((market): market is Record<string, unknown> => !!market && typeof market === "object")
    .map((market) => extractMarketProbability(market))
    .filter((probability): probability is number => probability != null);

  if (!probabilities.length) return null;
  return Math.max(...probabilities);
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...(init?.headers ?? {}),
    },
  });
}

export async function GET(request: NextRequest) {
  const marketUrl = request.nextUrl.searchParams.get("url");
  if (!marketUrl) {
    return noStoreJson(
      { detail: "Missing Polymarket URL." },
      { status: 400 }
    );
  }

  let slug: string;
  try {
    slug = parseMarketSlug(marketUrl);
  } catch {
    return noStoreJson(
      { detail: "Invalid Polymarket URL." },
      { status: 422 }
    );
  }

  try {
    const marketResponse = await fetch(
      `${POLYMARKET_GAMMA_BASE_URL}/markets/slug/${slug}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }
    );

    if (marketResponse.ok) {
      const marketPayload = (await marketResponse.json()) as Record<string, unknown>;
      return noStoreJson({
        slug,
        probability: extractMarketProbability(marketPayload),
        source: "market",
      });
    }

    if (marketResponse.status !== 404) {
      return noStoreJson(
        { detail: "Polymarket market lookup failed." },
        { status: marketResponse.status }
      );
    }

    const eventResponse = await fetch(
      `${POLYMARKET_GAMMA_BASE_URL}/events/slug/${slug}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }
    );

    if (!eventResponse.ok) {
      return noStoreJson(
        { detail: "Polymarket event lookup failed." },
        { status: eventResponse.status }
      );
    }

    const eventPayload = (await eventResponse.json()) as Record<string, unknown>;
    return noStoreJson({
      slug,
      probability: extractEventProbability(eventPayload),
      source: "event",
    });
  } catch {
    return noStoreJson(
      { detail: "Could not fetch live Polymarket data." },
      { status: 502 }
    );
  }
}
