"use client";

import type { AgentSummary, TickSnapshot } from "@/lib/types";
import { ARCHETYPE_COLORS, ARCHETYPE_LABELS } from "@/lib/constants";

interface AgentDebateFeedProps {
  agents: AgentSummary[];
  tickSnapshot: TickSnapshot | null;
  previousTickSnapshot: TickSnapshot | null;
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
  previousTickSnapshot,
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

  const summarizeReasoning = (text: string) => {
    const compact = text.replace(/\s+/g, " ").trim();
    if (!compact) return "No short commentary";
    const sentence = compact.split(/[.!?]/)[0]?.trim() || compact;
    return sentence.length > 88 ? `${sentence.slice(0, 85)}...` : sentence;
  };

  const previousStateById = new Map(
    (previousTickSnapshot?.agent_states ?? []).map((state) => [state.agent_id, state])
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto rounded-[24px] border border-white/8 bg-[rgba(255,255,255,0.02)] p-3">
      <div className="sticky top-0 z-10 -mx-3 -mt-3 mb-3 border-b border-white/8 bg-[rgba(8,11,18,0.94)] px-3 pb-3 pt-3 backdrop-blur-xl">
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
          className="mb-3 rounded-[18px] border border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.04)] p-3"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="ui-mono rounded-full border border-[rgba(52,211,153,0.24)] bg-[rgba(52,211,153,0.08)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--success)]">
              Propagation
            </span>
            <span className="text-[13px] text-[var(--text-secondary)]">
              {share.from_agent_name} to {share.to_agent_name}
            </span>
          </div>
          <div className="rounded-[14px] border border-white/6 bg-[rgba(9,14,21,0.45)] px-3 py-2.5">
            <div className="ui-mono mb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Active claim
            </div>
            <p className="text-[13px] leading-5 text-[var(--text-primary)]">
              {summarizeReasoning(share.claim_text)}
            </p>
          </div>
          <div className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">
            {summarizeReasoning(share.commentary)}
          </div>
        </div>
      ))}

      <div className="space-y-2.5">
        {states.map((state) => {
          const agent = agents.find((entry) => entry.id === state.agent_id);
          if (!agent) return null;

          const color = ARCHETYPE_COLORS[agent.archetype] ?? "#ffffff";
          const beliefTone = beliefColor(state.belief);
          const previousBelief = previousStateById.get(state.agent_id)?.belief ?? agent.initial_belief;
          const beliefDelta = state.belief - previousBelief;
          const deltaLabel =
            beliefDelta === 0
              ? "No change"
              : `${beliefDelta > 0 ? "+" : ""}${Math.round(beliefDelta * 100)} pts ${
                  beliefDelta > 0 ? "up" : "down"
                }`;

          return (
            <div key={state.agent_id} className="rounded-[18px] border border-white/8 bg-[rgba(255,255,255,0.025)] p-3">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ background: color, boxShadow: `0 0 10px ${color}66` }}
                  />
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-bright)]">
                      {state.name}
                    </div>
                    <div
                      className="ui-mono text-[10px] uppercase tracking-[0.14em]"
                      style={{ color: `${color}dd` }}
                    >
                      {ARCHETYPE_LABELS[agent.archetype]}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="ui-mono rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
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
                    className="ui-mono text-base font-bold"
                    style={{ color: beliefTone }}
                  >
                    {Math.round(state.belief * 100)}%
                  </span>
                </div>
              </div>

              <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-muted)]">
                <span
                  className="ui-mono uppercase tracking-[0.14em]"
                  style={{ color: beliefDelta >= 0 ? "var(--success)" : "var(--danger)" }}
                >
                  {deltaLabel}
                </span>
                <span>Confidence {Math.round(state.confidence * 100)}%</span>
              </div>

              <div className="rounded-[14px] border border-white/6 bg-[rgba(8,11,18,0.42)] px-3 py-2.5 text-[12px] leading-5 text-[var(--text-secondary)]">
                {summarizeReasoning(state.reasoning)}
              </div>
            </div>
          );
        })}
      </div>

      {tickSnapshot.trust_updates.length > 0 && (
        <div className="mt-4 border-t border-white/8 pt-4">
          <div className="eyebrow mb-2">Trust updates</div>
          <div className="space-y-2">
            {tickSnapshot.trust_updates.map((update, index) => {
              const from = agents.find((agent) => agent.id === update.from_agent_id);
              const to = agents.find((agent) => agent.id === update.to_agent_id);
              const delta = update.new_trust - update.old_trust;

              return (
                <div
                  key={index}
                  className="rounded-[14px] border border-white/8 bg-[rgba(255,255,255,0.02)] px-3 py-2.5 text-[12px] text-[var(--text-secondary)]"
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
