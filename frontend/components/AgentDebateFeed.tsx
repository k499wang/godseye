"use client";

import type { AgentSummary, TickSnapshot } from "@/lib/types";
import { ARCHETYPE_COLORS, ARCHETYPE_LABELS } from "@/lib/constants";

interface AgentDebateFeedProps {
  agents: AgentSummary[];
  tickSnapshot: TickSnapshot | null;
  currentTick: number;
}

function beliefColor(belief: number): string {
  if (belief >= 0.65) return "#10B981";
  if (belief >= 0.5) return "#F59E0B";
  return "#EF4444";
}

function beliefLabel(belief: number): string {
  if (belief >= 0.7) return "BULLISH";
  if (belief >= 0.55) return "LEAN YES";
  if (belief >= 0.45) return "NEUTRAL";
  if (belief >= 0.3) return "LEAN NO";
  return "BEARISH";
}

export function AgentDebateFeed({
  agents,
  tickSnapshot,
  currentTick,
}: AgentDebateFeedProps) {
  if (!tickSnapshot) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#4b5563] font-mono text-xs tracking-widest">
          SELECT A TICK TO VIEW DEBATE
        </p>
      </div>
    );
  }

  // Sort: shares first, then updates; within each group by confidence desc
  const states = [...tickSnapshot.agent_states].sort((a, b) => {
    if (a.action_taken === "share_claim" && b.action_taken !== "share_claim") return -1;
    if (b.action_taken === "share_claim" && a.action_taken !== "share_claim") return 1;
    return b.confidence - a.confidence;
  });

  return (
    <div className="flex flex-col gap-0 overflow-y-auto h-full pr-1">
      {/* Tick header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f] border-b border-[rgba(245,158,11,0.15)] pb-2 mb-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[#F59E0B] tracking-[0.2em]">
            TICK {String(currentTick).padStart(2, "0")} / {tickSnapshot.tick}
          </span>
          <span className="text-[#2d2d3a] font-mono text-[10px]">
            ── {states.length} AGENTS ──{" "}
            {tickSnapshot.claim_shares.length > 0 &&
              `${tickSnapshot.claim_shares.length} SHARE${tickSnapshot.claim_shares.length > 1 ? "S" : ""}`}
          </span>
        </div>
      </div>

      {/* Claim shares (highlighted) */}
      {tickSnapshot.claim_shares.map((share, i) => (
        <div
          key={`share-${i}`}
          className="mb-3 border border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.03)] p-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[9px] font-mono tracking-widest px-1.5 py-0.5"
              style={{
                background: "rgba(16,185,129,0.15)",
                color: "#10B981",
                border: "1px solid rgba(16,185,129,0.3)",
              }}
            >
              CLAIM SHARE
            </span>
            <span className="font-mono text-[10px] text-[#6b7280]">
              {share.from_agent_name} → {share.to_agent_name}
            </span>
          </div>
          <p className="font-mono text-[11px] text-[#9ca3af] mb-2 leading-relaxed border-l-2 border-[rgba(16,185,129,0.4)] pl-2">
            &ldquo;{share.claim_text}&rdquo;
          </p>
          <p className="font-mono text-[11px] text-[#d1d5db] leading-relaxed">
            {share.commentary}
          </p>
        </div>
      ))}

      {/* Agent reasoning entries */}
      {states.map((state) => {
        const agent = agents.find((a) => a.id === state.agent_id);
        if (!agent) return null;
        const color = ARCHETYPE_COLORS[agent.archetype] ?? "#ffffff";
        const bc = beliefColor(state.belief);

        return (
          <div
            key={state.agent_id}
            className="mb-3 border-l-2 pl-3 py-1"
            style={{ borderLeftColor: `${color}40` }}
          >
            {/* Agent header */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{ background: color }}
                />
                <div>
                  <span className="font-mono text-[11px] text-white font-medium">
                    {state.name}
                  </span>
                  <span
                    className="ml-2 font-mono text-[9px] tracking-widest"
                    style={{ color: `${color}99` }}
                  >
                    {ARCHETYPE_LABELS[agent.archetype]}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className="font-mono text-[9px] tracking-widest px-1 py-0.5"
                  style={{
                    color: bc,
                    background: `${bc}15`,
                    border: `1px solid ${bc}30`,
                  }}
                >
                  {beliefLabel(state.belief)}
                </span>
                <span
                  className="font-mono text-[13px] font-bold tabular-nums"
                  style={{ color: bc }}
                >
                  {Math.round(state.belief * 100)}%
                </span>
              </div>
            </div>

            {/* Action badge */}
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="font-mono text-[9px] tracking-widest"
                style={{ color: "#4b5563" }}
              >
                {state.action_taken === "share_claim"
                  ? "↗ SHARED CLAIM"
                  : "↻ UPDATED BELIEF"}
              </span>
              <span className="font-mono text-[9px] text-[#374151]">
                conf: {Math.round(state.confidence * 100)}%
              </span>
            </div>

            {/* Reasoning */}
            <p className="font-mono text-[11px] text-[#9ca3af] leading-relaxed">
              {state.reasoning}
            </p>
          </div>
        );
      })}

      {/* Trust updates */}
      {tickSnapshot.trust_updates.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
          <div className="font-mono text-[9px] tracking-widest text-[#374151] mb-2">
            TRUST UPDATES
          </div>
          {tickSnapshot.trust_updates.map((tu, i) => {
            const from = agents.find((a) => a.id === tu.from_agent_id);
            const to = agents.find((a) => a.id === tu.to_agent_id);
            const delta = tu.new_trust - tu.old_trust;
            return (
              <div key={i} className="font-mono text-[10px] text-[#6b7280] mb-1">
                <span className="text-[#9ca3af]">{from?.name ?? tu.from_agent_id}</span>
                <span className="text-[#374151]"> → </span>
                <span className="text-[#9ca3af]">{to?.name ?? tu.to_agent_id}</span>
                <span
                  className="ml-2"
                  style={{ color: delta >= 0 ? "#10B981" : "#EF4444" }}
                >
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(2)}
                </span>
                <span className="text-[#374151]">
                  {" "}
                  ({tu.old_trust.toFixed(2)} → {tu.new_trust.toFixed(2)})
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
