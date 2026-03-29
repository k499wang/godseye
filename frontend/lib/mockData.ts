import type {
  AgentSummary,
  ClaimSchema,
  TickSnapshot,
  SimulationResponse,
  MarketResponse,
  PaperTradingResponse,
  ReportResponse,
} from "./types";

export const MOCK_MARKET: MarketResponse = {
  id: "mkt-001",
  session_id: "sess-001",
  polymarket_id: "will-fed-cut-rates-q1-2025",
  question: "Will the Federal Reserve cut interest rates before March 2025?",
  resolution_criteria:
    "Resolves YES if the Federal Open Market Committee announces a federal funds rate reduction at any meeting before March 31, 2025.",
  current_probability: 0.62,
  volume: 4820000,
};

export const MOCK_AGENTS: AgentSummary[] = [
  {
    id: "agent-001",
    name: "Dr. Sarah Chen",
    archetype: "bayesian_updater",
    initial_belief: 0.55,
    current_belief: 0.68,
    confidence: 0.72,
    professional_background: {
      title: "Chief Economist",
      company: "Goldman Sachs",
      industry: "Investment Banking",
      apollo_enriched: true,
    },
  },
  {
    id: "agent-002",
    name: "Marcus Webb",
    archetype: "contrarian",
    initial_belief: 0.38,
    current_belief: 0.31,
    confidence: 0.65,
    professional_background: {
      title: "Macro Strategist",
      company: "Bridgewater Associates",
      industry: "Hedge Fund",
      apollo_enriched: true,
    },
  },
  {
    id: "agent-003",
    name: "Priya Nair",
    archetype: "quantitative_analyst",
    initial_belief: 0.61,
    current_belief: 0.74,
    confidence: 0.81,
    professional_background: {
      title: "Senior Quant Researcher",
      company: "Two Sigma",
      industry: "Quantitative Finance",
      apollo_enriched: true,
    },
  },
  {
    id: "agent-004",
    name: "James Thornton",
    archetype: "trend_follower",
    initial_belief: 0.58,
    current_belief: 0.71,
    confidence: 0.69,
    professional_background: {
      title: "Portfolio Manager",
      company: "BlackRock",
      industry: "Asset Management",
      apollo_enriched: false,
    },
  },
  {
    id: "agent-005",
    name: "Elena Vasquez",
    archetype: "narrative_focused",
    initial_belief: 0.48,
    current_belief: 0.56,
    confidence: 0.58,
    professional_background: {
      title: "Senior Economist",
      company: "Federal Reserve Bank of NY",
      industry: "Central Banking",
      apollo_enriched: true,
    },
  },
  {
    id: "agent-006",
    name: "Robert Kim",
    archetype: "data_skeptic",
    initial_belief: 0.42,
    current_belief: 0.39,
    confidence: 0.54,
    professional_background: {
      title: "Research Director",
      company: "PIMCO",
      industry: "Fixed Income",
      apollo_enriched: false,
    },
  },
];

export const MOCK_CLAIMS: ClaimSchema[] = [
  {
    id: "claim-001",
    text: "CPI inflation has fallen to 2.4%, approaching the Fed's 2% target for three consecutive months.",
    stance: "yes",
    strength_score: 0.87,
    novelty_score: 0.45,
  },
  {
    id: "claim-002",
    text: "Labor market remains strong with unemployment at 3.7%, giving the Fed less urgency to cut.",
    stance: "no",
    strength_score: 0.79,
    novelty_score: 0.38,
  },
  {
    id: "claim-003",
    text: "Fed Chair Powell's recent speech used language consistent with past pre-cut statements.",
    stance: "yes",
    strength_score: 0.71,
    novelty_score: 0.62,
  },
  {
    id: "claim-004",
    text: "PCE price index remains above 2.5%, suggesting inflation is not fully under control.",
    stance: "no",
    strength_score: 0.68,
    novelty_score: 0.41,
  },
];

function buildTick(
  tick: number,
  beliefDeltas: Record<string, number>
): TickSnapshot {
  const agentStates = MOCK_AGENTS.map((agent) => {
    const delta = beliefDeltas[agent.id] ?? 0;
    const belief = Math.min(1, Math.max(0, agent.initial_belief + delta));
    return {
      agent_id: agent.id,
      name: agent.name,
      belief,
      confidence: agent.confidence + (Math.random() * 0.04 - 0.02),
      action_taken:
        tick % 3 === 0 && agent.archetype !== "bayesian_updater"
          ? ("share_claim" as const)
          : ("update_belief" as const),
      reasoning: TICK_REASONINGS[agent.id]?.[tick - 1] ?? `Updated belief based on tick ${tick} evidence.`,
    };
  });

  const claimShares =
    tick === 2
      ? [
          {
            from_agent_id: "agent-003",
            from_agent_name: "Priya Nair",
            to_agent_id: "agent-001",
            to_agent_name: "Dr. Sarah Chen",
            claim_id: "claim-001",
            claim_text: MOCK_CLAIMS[0].text,
            commentary:
              "Three-month trend in CPI is statistically significant. Model assigns 74% probability to cut.",
            tick: 2,
          },
        ]
      : tick === 4
      ? [
          {
            from_agent_id: "agent-002",
            from_agent_name: "Marcus Webb",
            to_agent_id: "agent-006",
            to_agent_name: "Robert Kim",
            claim_id: "claim-002",
            claim_text: MOCK_CLAIMS[1].text,
            commentary:
              "Strong jobs data is being underweighted by the market. Historical precedent suggests Fed won't cut into a hot labor market.",
            tick: 4,
          },
        ]
      : [];

  const trustUpdates =
    tick === 3
      ? [
          {
            from_agent_id: "agent-001",
            to_agent_id: "agent-003",
            old_trust: 0.62,
            new_trust: 0.64,
          },
          {
            from_agent_id: "agent-002",
            to_agent_id: "agent-006",
            old_trust: 0.58,
            new_trust: 0.6,
          },
        ]
      : [];

  // Simple faction clustering
  const beliefs = agentStates.map((s) => ({ id: s.agent_id, belief: s.belief }));
  beliefs.sort((a, b) => a.belief - b.belief);
  const factionClusters: string[][] = [];
  let current: string[] = [beliefs[0].id];
  for (let i = 1; i < beliefs.length; i++) {
    if (beliefs[i].belief - beliefs[i - 1].belief <= 0.08) {
      current.push(beliefs[i].id);
    } else {
      if (current.length > 1) factionClusters.push(current);
      current = [beliefs[i].id];
    }
  }
  if (current.length > 1) factionClusters.push(current);

  return { tick, agent_states: agentStates, claim_shares: claimShares, trust_updates: trustUpdates, faction_clusters: factionClusters };
}

const TICK_REASONINGS: Record<string, string[]> = {
  "agent-001": [
    "Initial assessment aligns with market pricing. CPI trajectory is the dominant signal.",
    "Quantitative data shared by Priya is compelling. Revising upward.",
    "Rate futures now pricing 68% probability. My bayesian update: 0.67.",
    "Labor market data is a counter-signal but historically the Fed has looked through hot jobs when inflation is falling.",
    "Consensus forming around 65-70% range. My model converges at 0.68.",
  ],
  "agent-002": [
    "Market is overpricing a cut. Jobs data is being systematically ignored.",
    "Fed historically does not cut when unemployment is below 4%. This is not different.",
    "Inflation may be falling but the Fed needs to see sustained evidence. Not there yet.",
    "Sharing jobs data with Kim. The contrarian case is stronger than 38% market pricing.",
    "Standing firm at 0.31. The consensus is too optimistic.",
  ],
  "agent-003": [
    "Quantitative signals: 3-month CPI trajectory, rate futures curve, and Fed dot plot all converge.",
    "Sharing CPI momentum data with Chen. Statistical significance is high.",
    "Model output: 0.74 probability. Confidence interval 0.68-0.80.",
    "Adding weight to narrative factors per Vasquez's commentary.",
    "Final estimate: 0.74. Well within the YES faction.",
  ],
  "agent-004": [
    "Following the dominant market trend. Momentum indicators support YES.",
    "Rate futures leading indicator points toward cut. Following the signal.",
    "Trend strengthening. Adjusting upward to 0.69.",
    "No divergence from the main trend. Maintaining position.",
    "Closing at 0.71. Trend remains intact.",
  ],
  "agent-005": [
    "Narrative framing: Powell's last three speeches have been notably dovish.",
    "The political economy context matters — pre-election year typically sees accommodation.",
    "Fed communication signals are more important than data in the short run.",
    "Nuanced view: YES on the cut, but timing is uncertain.",
    "Landing at 0.56. The narrative supports a cut but the timing is tight.",
  ],
  "agent-006": [
    "PCE data does not support the consensus. Being skeptical of the CPI narrative.",
    "Receiving contrarian signal from Webb. Corroborates my PCE concern.",
    "Historical base rates: Fed cuts at this phase of cycle are rarer than priced.",
    "Data uncertainty is high. Remaining below market consensus.",
    "Final: 0.39. The data skeptic holds.",
  ],
};

const DELTAS: Record<string, number[]> = {
  "agent-001": [0.02, 0.06, 0.1, 0.12, 0.13],
  "agent-002": [-0.05, -0.07, -0.08, -0.07, -0.07],
  "agent-003": [0.04, 0.08, 0.12, 0.13, 0.13],
  "agent-004": [0.03, 0.07, 0.1, 0.12, 0.13],
  "agent-005": [0.01, 0.04, 0.06, 0.08, 0.08],
  "agent-006": [-0.04, -0.05, -0.04, -0.03, -0.03],
};

export const MOCK_TICK_DATA: TickSnapshot[] = [1, 2, 3, 4, 5].map((tick) => {
  const beliefDeltas: Record<string, number> = {};
  MOCK_AGENTS.forEach((agent) => {
    beliefDeltas[agent.id] = DELTAS[agent.id]?.[tick - 1] ?? 0;
  });
  return buildTick(tick, beliefDeltas);
});

export const MOCK_SIMULATION: SimulationResponse = {
  id: "sim-001",
  session_id: "sess-001",
  market_id: "mkt-001",
  status: "complete",
  current_tick: 5,
  total_ticks: 30,
  agents: MOCK_AGENTS,
  tick_data: MOCK_TICK_DATA,
  created_at: new Date(Date.now() - 3600000).toISOString(),
  completed_at: new Date().toISOString(),
};

export const MOCK_REPORT: ReportResponse = {
  id: "report-001",
  simulation_id: "sim-001",
  market_id: "mkt-001",
  market_probability: 0.62,
  simulation_probability: 0.57,
  summary:
    "The multi-agent simulation converged toward a 57% probability of a Federal Reserve rate cut before March 2025, slightly below Polymarket's current 62% implied probability. Bayesian updaters and quantitative analysts drove belief upward on inflation trajectory data, while contrarians and data skeptics maintained lower probabilities citing strong labor market conditions and PCE stickiness.",
  key_drivers: [
    "Three-month CPI trajectory approaching 2% target (positive signal, weight: 0.87)",
    "Unemployment at 3.7% — historically inconsistent with Fed cuts (negative signal, weight: 0.79)",
    "Powell speech language analysis shows dovish shift (positive signal, weight: 0.71)",
    "PCE price index remaining above 2.5% (negative signal, weight: 0.68)",
  ],
  faction_analysis:
    "Two dominant factions emerged by tick 30. The YES faction (4 agents: Chen, Nair, Thornton, Vasquez) clustered around 0.62-0.74 belief, sharing CPI and Fed communication claims. The NO faction (2 agents: Webb, Kim) held firm at 0.31-0.39, anchored by labor market data and PCE concerns. Trust network analysis shows the YES faction formed a denser information-sharing cluster, which explains the slight upward drift from initial priors.",
  trust_insights:
    "Nair→Chen trust relationship strengthened most (+0.04 by tick 30), driven by high-quality CPI data sharing. Webb→Kim became the anchor for the NO faction. Cross-faction trust remained low throughout — neither faction significantly updated on the other's claims.",
  recommendation:
    "The simulation's 57% estimate suggests the market may be slightly overpricing a rate cut at 62%. The gap is within normal uncertainty bounds but the strong labor market is an underweighted risk factor. Consider a small position against the market consensus or hold if risk tolerance is low.",
};

export const MOCK_PAPER_TRADING: PaperTradingResponse = {
  position: {
    id: "paper-pos-001",
    market_id: "mkt-001",
    simulation_id: "sim-001",
    report_id: "report-001",
    side: "no",
    avg_entry_price: 0.38,
    shares: 65.78947,
    total_cost: 25,
    current_price: 0.43,
    market_probability: 0.57,
    current_value: 28.28947,
    unrealized_pnl: 3.28947,
    unrealized_pnl_pct: 0.1316,
    created_at: new Date(Date.now() - 1800000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  trades: [
    {
      id: "paper-trade-001",
      side: "no",
      price: 0.38,
      shares: 65.78947,
      amount: 25,
      wallet_address: "DemoWallet1111111111111111111111111111111",
      signed_message: "GodSEye paper trade approval\nMarket: mkt-001",
      wallet_signature: "ZGVtby1zaWduYXR1cmU=",
      created_at: new Date(Date.now() - 1800000).toISOString(),
    },
  ],
};
