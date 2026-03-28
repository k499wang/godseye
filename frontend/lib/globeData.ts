import type { MarketBrowseItem } from "./types";

export type GlobeEventCategory =
  | "monetary"
  | "geopolitical"
  | "election"
  | "tech"
  | "energy"
  | "macro";

export interface GlobeEvent {
  id: string;
  title: string;
  region: string;
  question: string;
  probability: number | null; // 0–1, null hides market signal section
  lat: number;
  lng: number;
  category: GlobeEventCategory;
  /** Route to /simulation/[simulationId], or "mock" for the demo simulation. Null = no simulation yet. */
  simulationId: string | null;
  volume?: number; // USD, optional
  image_url?: string | null;
  confidence_score?: number; // 0–1, defaults to 0.5
  start_time?: string; // ISO date string for timeline filtering
}

export const CATEGORY_COLOR: Record<GlobeEventCategory, string> = {
  monetary: "#F59E0B",
  geopolitical: "#EF4444",
  election: "#8B5CF6",
  tech: "#06B6D4",
  energy: "#10B981",
  macro: "#F97316",
};

function classifyCategory(title: string): GlobeEventCategory {
  const t = title.toLowerCase();
  if (/war|ceasefire|military|russia|ukraine|china|taiwan|iran|israel|nato|conflict|troops|invasion|sanction/.test(t))
    return "geopolitical";
  if (/election|vote|president|congress|senate|ballot|prime minister|chancellor|governor/.test(t))
    return "election";
  if (/fed|federal reserve|\brate\b|interest rate|inflation|\bcpi\b|\bpce\b|\becb\b|\bboe\b|central bank/.test(t))
    return "monetary";
  if (/bitcoin|crypto|ethereum|\bai\b|artificial intelligence|openai|apple|google|microsoft|technology|software/.test(t))
    return "tech";
  if (/\boil\b|opec|\bgas\b|energy|nuclear|solar|coal|barrel|petroleum/.test(t))
    return "energy";
  return "macro";
}


export function browseItemToGlobeEvent(item: MarketBrowseItem): GlobeEvent {
  return {
    id: item.slug,
    title: item.title.length > 50 ? item.title.slice(0, 47) + "…" : item.title,
    region: item.region,
    question: item.title,
    probability: item.probability,
    lat: item.lat,
    lng: item.lng,
    category: classifyCategory(item.title),
    simulationId: null,
    volume: item.volume,
    image_url: item.image ?? null,
    confidence_score: 0.5,
  };
}

export const GLOBE_EVENTS: GlobeEvent[] = [
  {
    id: "fed-rate-cut",
    title: "Fed Rate Decision",
    region: "United States",
    question: "Will the Federal Reserve cut interest rates before March 2025?",
    probability: 0.62,
    lat: 38.9,
    lng: -77.0,
    category: "monetary",
    simulationId: "mock",
    volume: 4820000,
    confidence_score: 0.81,
    start_time: "2025-02-25T00:00:00Z",
  },
  {
    id: "ai-regulation",
    title: "US AI Regulation",
    region: "Silicon Valley",
    question: "Will the US pass a federal AI regulation bill before end of 2025?",
    probability: 0.27,
    lat: 37.4,
    lng: -122.1,
    category: "tech",
    simulationId: "mock",
    volume: 1230000,
    confidence_score: 0.67,
    start_time: "2025-03-01T00:00:00Z",
  },
  {
    id: "china-gdp",
    title: "China GDP Target",
    region: "China",
    question: "Will China achieve its 5% GDP growth target in 2025?",
    probability: 0.44,
    lat: 39.9,
    lng: 116.4,
    category: "macro",
    simulationId: "mock",
    volume: 3100000,
    confidence_score: 0.72,
    start_time: "2025-03-05T00:00:00Z",
  },
  {
    id: "russia-ukraine",
    title: "Russia-Ukraine Ceasefire",
    region: "Eastern Europe",
    question: "Will Russia and Ukraine reach a formal ceasefire by mid-2025?",
    probability: 0.19,
    lat: 50.4,
    lng: 30.5,
    category: "geopolitical",
    simulationId: "mock",
    volume: 8740000,
    confidence_score: 0.58,
    start_time: "2025-03-08T00:00:00Z",
  },
  {
    id: "opec-cuts",
    title: "OPEC+ Oil Cuts",
    region: "Saudi Arabia",
    question: "Will OPEC+ extend production cuts through Q3 2025?",
    probability: 0.71,
    lat: 24.7,
    lng: 46.7,
    category: "energy",
    simulationId: "mock",
    volume: 2650000,
    confidence_score: 0.76,
    start_time: "2025-03-12T00:00:00Z",
  },
  {
    id: "taiwan-strait",
    title: "Taiwan Strait Tensions",
    region: "Asia Pacific",
    question: "Will there be a significant military incident in the Taiwan Strait in 2025?",
    probability: 0.12,
    lat: 25.0,
    lng: 121.5,
    category: "geopolitical",
    simulationId: "mock",
    volume: 5900000,
    confidence_score: 0.61,
    start_time: "2025-03-15T00:00:00Z",
  },
  {
    id: "india-growth",
    title: "India Growth Surge",
    region: "India",
    question: "Will India overtake Japan as the world's 4th largest economy by end of 2025?",
    probability: 0.58,
    lat: 28.6,
    lng: 77.2,
    category: "macro",
    simulationId: "mock",
    volume: 920000,
    confidence_score: 0.69,
    start_time: "2025-03-19T00:00:00Z",
  },
  {
    id: "bitcoin-ath",
    title: "Bitcoin All-Time High",
    region: "Global",
    question: "Will Bitcoin reach $150,000 before end of 2025?",
    probability: 0.39,
    lat: 51.5,
    lng: -0.1,
    category: "tech",
    simulationId: "mock",
    volume: 12400000,
    confidence_score: 0.55,
    start_time: "2025-03-22T00:00:00Z",
  },
];
