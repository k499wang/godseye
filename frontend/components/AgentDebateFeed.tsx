"use client";

import { useState } from "react";
import type { AgentSummary, TickSnapshot } from "@/lib/types";
import { ARCHETYPE_COLORS } from "@/lib/constants";

interface AgentDebateFeedProps {
  agents: AgentSummary[];
  tickSnapshot: TickSnapshot | null;
  previousTickSnapshot: TickSnapshot | null;
  currentTick: number;
  selectedAgentId?: string | null;
}

function beliefColor(belief: number): string {
  if (belief >= 0.65) return "var(--success)";
  if (belief >= 0.5) return "var(--accent)";
  return "var(--danger)";
}

function compactText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function clip(text: string, limit: number): string {
  const normalized = compactText(text);
  if (!normalized) return "";
  return normalized.length > limit ? `${normalized.slice(0, limit - 3)}...` : normalized;
}

function deltaLabel(delta: number): string {
  if (Math.abs(delta) < 0.005) return "flat";
  return `${delta > 0 ? "+" : ""}${Math.round(delta * 100)} pts`;
}

function deltaTone(delta: number): string {
  if (Math.abs(delta) < 0.005) return "var(--text-muted)";
  return delta > 0 ? "var(--success)" : "var(--danger)";
}

function trustLabel(delta: number): string {
  if (Math.abs(delta) < 0.005) return "Trust flat";
  return `${delta > 0 ? "Trust +" : "Trust "}${delta.toFixed(2)}`;
}

function ExpandableLine({
  text,
  collapsedChars = 140,
}: {
  text: string;
  collapsedChars?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const normalized = compactText(text);
  if (!normalized) return null;

  const collapsible = normalized.length > collapsedChars;
  const visible = !collapsible || expanded
    ? normalized
    : `${normalized.slice(0, collapsedChars - 3)}...`;

  return (
    <div>
      <p className="text-[13px] leading-6 text-inherit">{visible}</p>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="ui-mono mt-2 text-[10px] uppercase tracking-[0.16em] text-[var(--accent)] transition hover:text-[var(--text-bright)]"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}

function ImpactChip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="ui-mono rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{ color, background: "rgba(255,255,255,0.05)" }}
    >
      {label}
    </span>
  );
}

export function AgentDebateFeed({
  agents,
  tickSnapshot,
  previousTickSnapshot,
  currentTick,
  selectedAgentId = null,
}: AgentDebateFeedProps) {
  if (!tickSnapshot) {
    return (
      <div className="flex h-full items-center justify-center rounded-[20px] bg-[#f8fafc]">
        <p className="ui-mono text-[11px] uppercase tracking-[0.16em] text-[#94a3b8]">Select a tick to view interactions</p>
      </div>
    );
  }

  const previousStateById = new Map(
    (previousTickSnapshot?.agent_states ?? []).map((state) => [state.agent_id, state])
  );
  const currentStateById = new Map(
    tickSnapshot.agent_states.map((state) => [state.agent_id, state])
  );
  const trustByPair = new Map(
    tickSnapshot.trust_updates.map((update) => [
      `${update.from_agent_id}:${update.to_agent_id}`,
      update,
    ])
  );

  const exchanges = tickSnapshot.claim_shares.map((share, index) => {
    const speakerState = currentStateById.get(share.from_agent_id);
    const listenerState = currentStateById.get(share.to_agent_id);
    const previousListenerState = previousStateById.get(share.to_agent_id);
    const trustUpdate = trustByPair.get(`${share.from_agent_id}:${share.to_agent_id}`) ?? null;
    const involvesSelectedAgent =
      selectedAgentId !== null &&
      (share.from_agent_id === selectedAgentId || share.to_agent_id === selectedAgentId);

    const listenerDelta =
      (listenerState?.belief ?? 0) - (previousListenerState?.belief ?? listenerState?.belief ?? 0);
    const trustDelta = trustUpdate ? trustUpdate.new_trust - trustUpdate.old_trust : 0;

    return {
      id: `${share.from_agent_id}-${share.to_agent_id}-${index}`,
      speakerName: share.from_agent_name,
      speakerArchetype:
        agents.find((a) => a.id === share.from_agent_id)?.archetype ?? "bayesian_updater",
      speakerBelief: speakerState?.belief ?? null,
      listenerName: share.to_agent_name,
      listenerArchetype:
        agents.find((a) => a.id === share.to_agent_id)?.archetype ?? "bayesian_updater",
      listenerBelief: listenerState?.belief ?? null,
      claim: compactText(share.claim_text),
      commentary: compactText(share.commentary) || "Pushes the claim directly.",
      response: compactText(listenerState?.reasoning ?? "") || "Processing the incoming claim.",
      listenerDelta,
      trustDelta,
      involvesSelectedAgent,
    };
  }).sort((a, b) => Number(b.involvesSelectedAgent) - Number(a.involvesSelectedAgent));

  const fallbackMoments = tickSnapshot.agent_states
    .map((state) => {
      const previousBelief =
        previousStateById.get(state.agent_id)?.belief ??
        agents.find((a) => a.id === state.agent_id)?.initial_belief ??
        state.belief;
      return {
        id: state.agent_id,
        name: state.name,
        archetype:
          agents.find((a) => a.id === state.agent_id)?.archetype ?? "bayesian_updater",
        delta: state.belief - previousBelief,
        belief: state.belief,
        reasoning: compactText(state.reasoning),
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="ui-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">Agent interactions</div>
          <div className="mt-1.5 text-[13px] text-[#64748b]">
            Tick {String(currentTick).padStart(2, "0")}
          </div>
        </div>
        <div className="ui-mono text-[11px] uppercase tracking-[0.16em] text-[#94a3b8]">
          {exchanges.length > 0 ? `${exchanges.length} exchange${exchanges.length > 1 ? "s" : ""}` : "No direct exchanges"}
        </div>
      </div>

      {selectedAgentId && exchanges.some((exchange) => exchange.involvesSelectedAgent) && (
        <div className="mb-4">
          <ImpactChip label="Selected agent involved" color="var(--accent)" />
        </div>
      )}

      {exchanges.length > 0 ? (
        <div className="space-y-8">
          {exchanges.map((ex) => {
            const speakerColor = ARCHETYPE_COLORS[ex.speakerArchetype] ?? "#fff";
            const listenerColor = ARCHETYPE_COLORS[ex.listenerArchetype] ?? "#fff";

            return (
              <div
                key={ex.id}
                className="space-y-1.5 rounded-[22px] px-3 py-3"
                style={{
                  background: ex.involvesSelectedAgent ? "#fff7ed" : "transparent",
                  border: ex.involvesSelectedAgent
                    ? "1px solid #fed7aa"
                    : "1px solid transparent",
                }}
              >
                {/* Speaker message */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: speakerColor, boxShadow: `0 0 10px ${speakerColor}88` }}
                    />
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: speakerColor }}
                    >
                      {ex.speakerName}
                    </span>
                    {ex.speakerBelief !== null && (
                      <span className="ui-mono text-[11px] text-[#94a3b8]">
                        {Math.round(ex.speakerBelief * 100)}%
                      </span>
                    )}
                    <span className="ui-mono text-[10px] text-[#94a3b8]">→ {ex.listenerName}</span>
                  </div>

                  <div
                    className="rounded-[18px] px-4 py-3.5"
                    style={{
                      background: `${speakerColor}12`,
                      borderLeft: `2px solid ${speakerColor}66`,
                    }}
                  >
                    <div className="mb-2 rounded-[12px] bg-white/80 px-3 py-2">
                      <div className="ui-mono mb-1 text-[9px] uppercase tracking-[0.16em] text-[#94a3b8]">
                        claim
                      </div>
                      <p className="text-[12px] italic leading-5 text-[#334155]">
                        {clip(ex.claim, 200)}
                      </p>
                    </div>
                    <div className="text-[#0f172a]">
                      <ExpandableLine text={ex.commentary} collapsedChars={160} />
                    </div>
                  </div>
                </div>

                {/* Flow indicator */}
                <div className="flex items-center gap-2 pl-4">
                  <div
                    className="h-px flex-1"
                    style={{
                      background: `linear-gradient(90deg, ${speakerColor}44, ${listenerColor}44)`,
                    }}
                  />
                  <span className="ui-mono text-[9px] uppercase tracking-[0.14em] text-[#94a3b8]">
                    responding
                  </span>
                  <div
                    className="h-px flex-1"
                    style={{
                      background: `linear-gradient(90deg, ${listenerColor}44, transparent)`,
                    }}
                  />
                </div>

                {/* Listener response */}
                <div>
                  <div
                    className="rounded-[18px] px-4 py-3.5"
                    style={{
                      background: "#f8fafc",
                      borderRight: `2px solid ${listenerColor}55`,
                    }}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: listenerColor, boxShadow: `0 0 10px ${listenerColor}88` }}
                        />
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: listenerColor }}
                        >
                          {ex.listenerName}
                        </span>
                      </div>
                      {ex.listenerBelief !== null && (
                        <span
                          className="ui-mono text-[12px] font-bold"
                          style={{ color: beliefColor(ex.listenerBelief) }}
                        >
                          {Math.round(ex.listenerBelief * 100)}%
                        </span>
                      )}
                    </div>

                    <div className="text-[#475569]">
                      <ExpandableLine text={ex.response} collapsedChars={180} />
                    </div>

                    {(Math.abs(ex.listenerDelta) >= 0.005 || Math.abs(ex.trustDelta) >= 0.005) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Math.abs(ex.listenerDelta) >= 0.005 && (
                          <ImpactChip
                            label={deltaLabel(ex.listenerDelta)}
                            color={deltaTone(ex.listenerDelta)}
                          />
                        )}
                        {Math.abs(ex.trustDelta) >= 0.005 && (
                          <ImpactChip
                            label={trustLabel(ex.trustDelta)}
                            color={deltaTone(ex.trustDelta)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-[24px] bg-[#f8fafc] px-5 py-4">
            <div className="ui-mono mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">Quiet tick</div>
            <div className="text-[13px] leading-6 text-[#64748b]">
              No direct claim exchanges this round. Agents updated beliefs independently.
            </div>
          </div>

          {fallbackMoments.map((moment) => {
            const color = ARCHETYPE_COLORS[moment.archetype] ?? "#fff";
            return (
              <div key={moment.id} className="rounded-[22px] bg-[#f8fafc] px-5 py-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: color, boxShadow: `0 0 10px ${color}66` }}
                    />
                    <span className="text-[13px] font-semibold text-[#0f172a]">
                      {moment.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ImpactChip label={deltaLabel(moment.delta)} color={deltaTone(moment.delta)} />
                    <span
                      className="ui-mono text-[12px] font-semibold"
                      style={{ color: beliefColor(moment.belief) }}
                    >
                      {Math.round(moment.belief * 100)}%
                    </span>
                  </div>
                </div>
                <div
                  className="rounded-[14px] px-4 py-3 text-[var(--text-secondary)]"
                  style={{ background: `${color}0a`, borderLeft: `2px solid ${color}33` }}
                >
                  <ExpandableLine text={moment.reasoning || "No spoken reaction captured."} collapsedChars={170} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
