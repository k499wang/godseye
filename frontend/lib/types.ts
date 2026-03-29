export type AgentArchetype =
  | "bayesian_updater"
  | "trend_follower"
  | "contrarian"
  | "data_skeptic"
  | "narrative_focused"
  | "quantitative_analyst";

export type SimulationStatus = "pending" | "building" | "running" | "complete" | "failed";

export type ClaimStance = "yes" | "no";

export type AgentAction = "update_belief" | "share_claim";

export interface ProfessionalBackground {
  title: string;
  company: string;
  industry: string;
  apollo_enriched: boolean;
}

export interface ClaimSchema {
  id: string;
  text: string;
  stance: ClaimStance;
  strength_score: number;
  novelty_score: number;
}

export interface AgentSummary {
  id: string;
  name: string;
  archetype: AgentArchetype;
  initial_belief: number;
  current_belief: number;
  confidence: number;
  professional_background: ProfessionalBackground;
}

export interface AgentTickState {
  agent_id: string;
  name: string;
  belief: number;
  confidence: number;
  action_taken: AgentAction;
  reasoning: string;
}

export interface ClaimShareRecord {
  from_agent_id: string;
  from_agent_name: string;
  to_agent_id: string;
  to_agent_name: string;
  claim_id: string;
  claim_text: string;
  commentary: string;
  tick: number;
}

export interface TrustUpdate {
  from_agent_id: string;
  to_agent_id: string;
  old_trust: number;
  new_trust: number;
}

export interface TickSnapshot {
  tick: number;
  agent_states: AgentTickState[];
  claim_shares: ClaimShareRecord[];
  trust_updates: TrustUpdate[];
  faction_clusters: string[][];
}

export interface MarketResponse {
  id: string;
  session_id: string;
  polymarket_id: string;
  question: string;
  resolution_criteria: string;
  current_probability: number;
  volume: number;
}

export interface ClaimsGenerateResponse {
  session_id: string;
  market_id: string;
  claims: ClaimSchema[];
}

export interface SimulationResponse {
  id: string;
  session_id: string;
  market_id: string;
  status: SimulationStatus;
  current_tick: number;
  total_ticks: number;
  agents: AgentSummary[];
  tick_data: TickSnapshot[];
  created_at: string;
  completed_at: string | null;
}

export interface ReportResponse {
  id: string;
  simulation_id: string;
  market_id: string;
  market_probability: number;
  simulation_probability: number;
  summary: string;
  key_drivers: string[];
  faction_analysis: string;
  trust_insights: string;
  recommendation: string;
}

export interface MarketBrowseItem {
  slug: string;
  title: string;
  description: string;
  url: string;
  image: string | null;
  volume: number;
  volume24hr: number;
  probability: number | null;
  lat: number;
  lng: number;
  region: string;
  is_imported: boolean;
  market_id: string | null;
  session_id: string | null;
  simulation_id: string | null;
  simulation_status: SimulationStatus | null;
}

export interface MarketBrowseResponse {
  markets: MarketBrowseItem[];
  cached: boolean;
  cache_age_seconds: number;
}

export interface ApiError {
  detail: string;
  code: string | null;
}

export interface PlacePaperOrderRequest {
  market_id: string;
  simulation_id?: string | null;
  report_id?: string | null;
  side: "yes" | "no";
  amount: number;
}

export interface PaperTrade {
  id: string;
  side: "yes" | "no";
  price: number;
  shares: number;
  amount: number;
  created_at: string;
}

export interface PaperPositionSummary {
  id: string;
  market_id: string;
  simulation_id: string | null;
  report_id: string | null;
  side: "yes" | "no";
  avg_entry_price: number;
  shares: number;
  total_cost: number;
  current_price: number;
  market_probability: number;
  current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  created_at: string;
  updated_at: string;
}

export interface PaperTradingResponse {
  position: PaperPositionSummary | null;
  trades: PaperTrade[];
}
