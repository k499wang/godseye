"use client";

import type { AgentSummary, TickSnapshot } from "@/lib/types";
import { ARCHETYPE_COLORS, ARCHETYPE_LABELS } from "@/lib/constants";

interface AgentDebateFeedProps {
  agents: AgentSummary[];
  tickSnapshot: TickSnapshot | null;
  currentTick: number;
}

function beliefColor(belief: number): string {
  if (belief >= 0.65) return "var(--success)";
  if (belief >= 0.5) return "var(--accent)";
  return "var(--danger)";
}

function beliefLabel(belief: number): string {
  if (belief >= 0.7) return "Bullish";
  if (belief >= 0.55) return "Lean yes";
  if (belief >= 0.45) return "Neutral";
  if (belief >= 0.3) return "Lean no";
  return "Bearish";
}

export function AgentDebateFeed({
  agents,
  tickSnapshot,
  currentTick,
}: AgentDebateFeedProps) {
  if (!tickSnapshot) {
    return (
      <div className="flex h-full items-center justify-center rounded-[28px] border border-white/8 bg-[rgba(255,255,255,0.02)]">
        <p className="eyebrow text-[var(--text-muted)]">Select a tick to view debate</p>
      </div>
    );
  }

  const states = [...tickSnapshot.agent_states].sort((a, b) => {
    if (a.action_taken === "share_claim" && b.action_taken !== "share_claim") return -1;
    if (b.action_taken === "share_claim" && a.action_taken !== "share_claim") return 1;
    return b.confidence - a.confidence;
  });

  return (
    <div className="flex h-full flex-col overflow-y-auto rounded-[30px] border border-white/8 bg-[rgba(255,255,255,0.025)] p-4">
      <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-5 border-b border-[rgba(245,158,11,0.16)] bg-[rgba(8,11,18,0.96)] px-4 pb-4 pt-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow text-[var(--accent)]">
            Tick {String(currentTick).padStart(2, "0")}
          </span>
          <span className="text-sm text-[var(--text-secondary)]">
            {states.length} agent updates
          </span>
          {tickSnapshot.claim_shares.length > 0 && (
            <span className="ui-mono rounded-full border border-[rgba(52,211,153,0.24)] bg-[rgba(52,211,153,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--success)]">
              {tickSnapshot.claim_shares.length} claim share
              {tickSnapshot.claim_shares.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {tickSnapshot.claim_shares.map((share, index) => (
        <div
          key={`share-${index}`}
          className="mb-4 rounded-[24px] border border-[rgba(52,211,153,0.24)] bg-[rgba(52,211,153,0.05)] p-4"
        >
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="ui-mono rounded-full border border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--success)]">
              Claim share
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              {share.from_agent_name} to {share.to_agent_name}
            </span>
          </div>
          <p className="rounded-[18px] border border-white/8 bg-[rgba(9,14,21,0.55)] p-4 text-base leading-7 text-[var(--text-primary)]">
            "{share.claim_text}"
          </p>
          <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">
            {share.commentary}
          </p>
        </div>
      ))}

      <div className="space-y-4">
        {states.map((state) => {
          const agent = agents.find((entry) => entry.id === state.agent_id);
          if (!agent) return null;

          const color = ARCHETYPE_COLORS[agent.archetype] ?? "#ffffff";
          const beliefTone = beliefColor(state.belief);

          return (
            <div
              key={state.agent_id}
              className="rounded-[24px] border border-white/8 bg-[rgba(255,255,255,0.03)] p-4"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: color, boxShadow: `0 0 10px ${color}66` }}
                  />
                  <div>
                    <div className="text-base font-semibold text-[var(--text-bright)]">
                      {state.name}
                    </div>
                    <div
                      className="ui-mono text-[11px] uppercase tracking-[0.18em]"
                      style={{ color: `${color}dd` }}
                    >
                      {ARCHETYPE_LABELS[agent.archetype]}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="ui-mono rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style={{
                      color: beliefTone,
                      borderColor:
                        beliefTone === "var(--success)"
                          ? "rgba(52,211,153,0.28)"
                          : beliefTone === "var(--accent)"
                            ? "rgba(245,158,11,0.28)"
                            : "rgba(251,113,133,0.24)",
                      background:
                        beliefTone === "var(--success)"
                          ? "rgba(52,211,153,0.08)"
                          : beliefTone === "var(--accent)"
                            ? "rgba(245,158,11,0.08)"
                            : "rgba(251,113,133,0.08)",
                    }}
                  >
                    {beliefLabel(state.belief)}
                  </span>
                  <span
                    className="ui-mono text-lg font-bold"
                    style={{ color: beliefTone }}
                  >
                    {Math.round(state.belief * 100)}%
                  </span>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
                <span className="ui-mono uppercase tracking-[0.16em]">
                  {state.action_taken === "share_claim" ? "Shared claim" : "Updated belief"}
                </span>
                <span>Confidence {Math.round(state.confidence * 100)}%</span>
              </div>

              <p className="text-base leading-7 text-[var(--text-secondary)]">
                {state.reasoning}
              </p>
            </div>
          );
        })}
      </div>

      {tickSnapshot.trust_updates.length > 0 && (
        <div className="mt-5 border-t border-white/8 pt-5">
          <div className="eyebrow mb-3">Trust updates</div>
          <div className="space-y-2">
            {tickSnapshot.trust_updates.map((update, index) => {
              const from = agents.find((agent) => agent.id === update.from_agent_id);
              const to = agents.find((agent) => agent.id === update.to_agent_id);
              const delta = update.new_trust - update.old_trust;

              return (
                <div
                  key={index}
                  className="rounded-[18px] border border-white/8 bg-[rgba(255,255,255,0.025)] px-4 py-3 text-sm text-[var(--text-secondary)]"
                >
                  <span className="font-medium text-[var(--text-bright)]">
                    {from?.name ?? update.from_agent_id}
                  </span>
                  <span className="mx-2 text-[var(--text-muted)]">to</span>
                  <span className="font-medium text-[var(--text-bright)]">
                    {to?.name ?? update.to_agent_id}
                  </span>
                  <span
                    className="ui-mono ml-3 font-semibold uppercase tracking-[0.12em]"
                    style={{ color: delta >= 0 ? "var(--success)" : "var(--danger)" }}
                  >
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(2)}
                  </span>
                  <span className="ml-2 text-[var(--text-muted)]">
                    ({update.old_trust.toFixed(2)} to {update.new_trust.toFixed(2)})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
