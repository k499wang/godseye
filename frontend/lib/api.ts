import axios from "axios";
import type {
  MarketResponse,
  ClaimsGenerateResponse,
  SimulationResponse,
  ReportResponse,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001";

const client = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

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

export async function buildWorld(sessionId: string): Promise<SimulationResponse> {
  const res = await client.post<SimulationResponse>("/api/simulations/build-world", {
    session_id: sessionId,
  });
  return res.data;
}

export async function startSimulation(simulationId: string): Promise<SimulationResponse> {
  const res = await client.post<SimulationResponse>(
    `/api/simulations/${simulationId}/start`
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
