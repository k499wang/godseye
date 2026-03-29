import axios from "axios";
import type {
  MarketResponse,
  ClaimsGenerateResponse,
  SimulationResponse,
  ReportResponse,
  MarketBrowseResponse,
  PaperTradingResponse,
  PlacePaperOrderRequest,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001";

const client = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

type SimulationRequestOptions = {
  demo?: boolean;
};

export interface PolymarketQuoteResponse {
  slug: string;
  probability: number | null;
  source: "market" | "event";
}

const polymarketQuoteCache = new Map<string, PolymarketQuoteResponse>();

export async function importMarket(url: string): Promise<MarketResponse> {
  const res = await client.post<MarketResponse>("/api/markets/import", { url });
  return res.data;
}

export async function generateClaims(marketId: string): Promise<ClaimsGenerateResponse> {
  const res = await client.post<ClaimsGenerateResponse>(
    `/api/sessions/${marketId}/claims/generate`
  );
  return res.data;
}

export async function buildWorld(
  sessionId: string,
  options: SimulationRequestOptions = {}
): Promise<SimulationResponse> {
  const res = await client.post<SimulationResponse>(
    "/api/simulations/build-world",
    {
      session_id: sessionId,
    },
    {
      params: options.demo ? { demo: true } : undefined,
    }
  );
  return res.data;
}

export async function startSimulation(
  simulationId: string,
  options: SimulationRequestOptions = {}
): Promise<SimulationResponse> {
  const res = await client.post<SimulationResponse>(
    `/api/simulations/${simulationId}/start`,
    undefined,
    {
      params: options.demo ? { demo: true } : undefined,
    }
  );
  return res.data;
}

export async function getSimulation(simulationId: string): Promise<SimulationResponse> {
  const res = await client.get<SimulationResponse>(`/api/simulations/${simulationId}`);
  return res.data;
}

export async function getReport(simulationId: string): Promise<ReportResponse> {
  const res = await client.get<ReportResponse>(`/api/reports/${simulationId}`);
  return res.data;
}

export async function getPaperTrading(reportId: string): Promise<PaperTradingResponse> {
  const res = await client.get<PaperTradingResponse>(`/api/paper-trading/reports/${reportId}`);
  return res.data;
}

export async function placePaperOrder(
  payload: PlacePaperOrderRequest
): Promise<PaperTradingResponse> {
  const res = await client.post<PaperTradingResponse>("/api/paper-trading/orders", payload);
  return res.data;
}

export async function browseMarkets(): Promise<MarketBrowseResponse> {
  const res = await client.get<MarketBrowseResponse>("/api/markets/browse");
  return res.data;
}

export async function refreshMarkets(): Promise<MarketBrowseResponse> {
  const res = await client.post<MarketBrowseResponse>("/api/markets/refresh");
  return res.data;
}

export async function getPolymarketQuote(
  url: string
): Promise<PolymarketQuoteResponse> {
  const cached = polymarketQuoteCache.get(url);
  if (cached) return cached;

  const res = await fetch(`/api/polymarket/quote?url=${encodeURIComponent(url)}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Could not fetch live Polymarket probability.");
  }

  const data = (await res.json()) as PolymarketQuoteResponse;
  polymarketQuoteCache.set(url, data);
  return data;
}
