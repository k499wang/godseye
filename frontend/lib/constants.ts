export const TOTAL_TICKS = 30;
export const TOTAL_AGENTS = 12;
export const AGENTS_PER_ARCHETYPE = 2;
export const VISIBLE_CLAIMS_PER_STANCE = 4;
export const CLAIM_RANKING_WEIGHT_STRENGTH = 0.7;
export const CLAIM_RANKING_WEIGHT_NOVELTY = 0.3;
export const TRUST_SHARE_DELTA = 0.02;
export const TRUST_IGNORE_DELTA = -0.01;
export const FACTION_THRESHOLD = 0.08;
export const POLLING_INTERVAL_MS = 1000;

export const ARCHETYPE_LABELS: Record<string, string> = {
  bayesian_updater: "Bayesian Updater",
  trend_follower: "Trend Follower",
  contrarian: "Contrarian",
  data_skeptic: "Data Skeptic",
  narrative_focused: "Narrative Focused",
  quantitative_analyst: "Quant Analyst",
};

export const ARCHETYPE_COLORS: Record<string, string> = {
  bayesian_updater: "#F59E0B",
  trend_follower: "#10B981",
  contrarian: "#EF4444",
  data_skeptic: "#3B82F6",
  narrative_focused: "#8B5CF6",
  quantitative_analyst: "#06B6D4",
};
