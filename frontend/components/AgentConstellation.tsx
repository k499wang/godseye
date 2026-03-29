"use client";

import { useMemo } from "react";
import type { AgentSummary, TickSnapshot } from "@/lib/types";
import { ARCHETYPE_COLORS, ARCHETYPE_LABELS } from "@/lib/constants";

interface AgentConstellationProps {
  agents: AgentSummary[];
  tickData: TickSnapshot[];
  currentTick: number;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
}

type Point = { x: number; y: number };
type Edge = { from: string; to: string; trust: number };
type AgentStateView = {
  belief: number;
  previousBelief: number;
  confidence: number;
  action: string;
  reasoning: string;
};

const SCENE_W = 920;
const SCENE_H = 1040;
const X_PAD = 220;
const Y_PAD = 190;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shortName(name: string): string {
  return name.split(" ")[0] ?? name;
}

function summarize(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "No current commentary";
  const first = compact.split(/[.!?]/)[0]?.trim() || compact;
  return first.length > 78 ? `${first.slice(0, 75)}...` : first;
}

function hash(value: string): number {
  let acc = 0;
  for (let index = 0; index < value.length; index += 1) {
    acc = (acc * 33 + value.charCodeAt(index)) % 100003;
  }
  return acc;
}

function edgeStyle(from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return {
    left: from.x,
    top: from.y,
    width: length,
    transform: `rotate(${angle}deg)`,
    transformOrigin: "0 50%",
  };
}

export function AgentConstellation({
  agents,
  tickData,
  currentTick,
  selectedAgentId,
  onSelectAgent,
}: AgentConstellationProps) {
  const snapshots = useMemo(
    () => tickData.filter((snapshot) => snapshot.tick <= currentTick),
    [currentTick, tickData]
  );

  const currentSnapshot = snapshots[snapshots.length - 1] ?? null;
  const previousSnapshot = snapshots[snapshots.length - 2] ?? null;

  const stateById = useMemo(() => {
    const currentMap = new Map(
      (currentSnapshot?.agent_states ?? []).map((state) => [state.agent_id, state])
    );
    const previousMap = new Map(
      (previousSnapshot?.agent_states ?? []).map((state) => [state.agent_id, state])
    );

    return new Map<string, AgentStateView>(
      agents.map((agent) => {
        const current = currentMap.get(agent.id);
        const previous = previousMap.get(agent.id);
        return [
          agent.id,
          {
            belief: current?.belief ?? agent.current_belief ?? agent.initial_belief,
            previousBelief: previous?.belief ?? agent.initial_belief,
            confidence: current?.confidence ?? agent.confidence,
            action: current?.action_taken ?? "update_belief",
            reasoning: current?.reasoning ?? "",
          },
        ];
      })
    );
  }, [agents, currentSnapshot, previousSnapshot]);

  const points = useMemo(() => {
    const map = new Map<string, Point>();
    for (const agent of agents) {
      const state = stateById.get(agent.id);
      if (!state) continue;
      const salt = hash(agent.id);
      const xJitter = ((salt % 17) - 8) * 1.5;
      const yJitter = ((Math.floor(salt / 17) % 19) - 9) * 2;
      const x = X_PAD + state.belief * (SCENE_W - X_PAD * 2) + xJitter;
      const y = Y_PAD + (1 - state.confidence) * (SCENE_H - Y_PAD * 2) + yJitter;
      map.set(agent.id, {
        x: clamp(x, 120, SCENE_W - 120),
        y: clamp(y, 120, SCENE_H - 120),
      });
    }
    return map;
  }, [agents, stateById]);

  const edges = useMemo(() => {
    const edgeMap = new Map<string, Edge>();
    for (const snapshot of snapshots) {
      for (const update of snapshot.trust_updates) {
        edgeMap.set(`${update.from_agent_id}:${update.to_agent_id}`, {
          from: update.from_agent_id,
          to: update.to_agent_id,
          trust: clamp(update.new_trust, 0.08, 0.95),
        });
      }
    }
    return [...edgeMap.values()].sort((a, b) => b.trust - a.trust).slice(0, 20);
  }, [snapshots]);

  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null;
  const selectedState = selectedAgent ? stateById.get(selectedAgent.id) : null;

  if (!agents.length) {
    return (
      <div className="flex min-h-[560px] items-center justify-center rounded-[30px] border border-white/10 bg-[rgba(255,255,255,0.03)]">
        <div className="eyebrow text-[var(--text-muted)]">No agents loaded</div>
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-white/6 bg-[linear-gradient(180deg,rgba(13,17,26,0.9),rgba(8,11,18,0.96))] p-3 shadow-[0_14px_44px_rgba(0,0,0,0.18)]">
      <div className="mb-1.5 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow text-[var(--accent)]">Agent constellation</span>
          <span className="ui-mono rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Belief X
          </span>
          <span className="ui-mono rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Confidence Y
          </span>
          <span className="ui-mono rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Trust links
          </span>
        </div>
        {selectedAgent && selectedState && (
          <div className="w-[300px] rounded-[12px] border border-white/8 bg-[rgba(255,255,255,0.02)] px-2.5 py-1.5">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[var(--text-bright)]">{selectedAgent.name}</div>
              </div>
              <div
                className="ui-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ color: ARCHETYPE_COLORS[selectedAgent.archetype] ?? "#fff" }}
              >
                {ARCHETYPE_LABELS[selectedAgent.archetype]}
              </div>
              <div className="flex min-w-[118px] flex-col items-end">
                <div className="ui-mono text-sm font-bold text-[var(--text-bright)]">
                  {Math.round(selectedState.belief * 100)}%
                </div>
                <div
                  className="ui-mono text-[10px] uppercase tracking-[0.12em]"
                  style={{
                    color:
                      selectedState.belief - selectedState.previousBelief >= 0
                        ? "var(--success)"
                        : "var(--danger)",
                  }}
                >
                  {selectedState.belief - selectedState.previousBelief >= 0 ? "+" : ""}
                  {Math.round((selectedState.belief - selectedState.previousBelief) * 100)} pt
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${selectedState.confidence * 100}%`,
                      background: ARCHETYPE_COLORS[selectedAgent.archetype] ?? "#fff",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className="overflow-y-auto rounded-[18px] border border-[rgba(255,255,255,0.06)] bg-[radial-gradient(circle_at_50%_0%,rgba(34,197,94,0.045),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(59,130,246,0.08),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.008))] p-3"
        style={{ height: 620 }}
      >
        <div className="relative mx-auto" style={{ width: SCENE_W, height: SCENE_H }}>
          {Array.from({ length: 6 }).map((_, index) => {
            const x = X_PAD + (index / 5) * (SCENE_W - X_PAD * 2);
            return (
              <div
                key={`vx-${index}`}
                className="absolute top-0 bottom-0 border-l border-dashed border-white/10"
                style={{ left: x }}
              />
            );
          })}
          {Array.from({ length: 5 }).map((_, index) => {
            const y = Y_PAD + (index / 4) * (SCENE_H - Y_PAD * 2);
            return (
              <div
                key={`hz-${index}`}
                className="absolute left-0 right-0 border-t border-dashed border-white/10"
                style={{ top: y }}
              />
            );
          })}

          <div
            className="pointer-events-none absolute left-[72px] top-[18px] ui-mono text-[11px] tracking-[0.16em] text-[#9eb0c8]"
          >
            HIGH CONFIDENCE
          </div>
          <div
            className="pointer-events-none absolute left-[72px] bottom-[8px] ui-mono text-[11px] tracking-[0.16em] text-[#9eb0c8]"
          >
            BEARISH
          </div>
          <div
            className="pointer-events-none absolute right-[24px] bottom-[8px] ui-mono text-[11px] tracking-[0.16em] text-[#9eb0c8]"
          >
            BULLISH
          </div>

          {edges.map((edge) => {
            const from = points.get(edge.from);
            const to = points.get(edge.to);
            const fromAgent = agents.find((agent) => agent.id === edge.from);
            if (!from || !to || !fromAgent) return null;
            const active =
              selectedAgentId != null &&
              (selectedAgentId === edge.from || selectedAgentId === edge.to);
            const color = ARCHETYPE_COLORS[fromAgent.archetype] ?? "#fff";
            return (
              <div
                key={`${edge.from}-${edge.to}`}
                className="absolute rounded-full transition-all duration-500 ease-out"
                style={{
                  ...edgeStyle(from, to),
                  height: active ? 3 : 1 + edge.trust * 2,
                  background: color,
                  opacity: active ? 0.72 : 0.14 + edge.trust * 0.38,
                }}
              />
            );
          })}

          {agents.map((agent) => {
            const point = points.get(agent.id);
            const state = stateById.get(agent.id);
            if (!point || !state) return null;
            const color = ARCHETYPE_COLORS[agent.archetype] ?? "#fff";
            const selected = selectedAgent?.id === agent.id;
            const isSharing = state.action === "share_claim";
            const dotSize = selected ? 16 : 12;

            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => onSelectAgent(agent.id)}
                className="absolute transition-all duration-500 ease-out"
                style={{
                  left: point.x,
                  top: point.y,
                  transform: "translate(-50%, -50%)",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
                title={`${agent.name} ${Math.round(state.belief * 100)}%`}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: selected ? -12 : -9,
                    borderRadius: "999px",
                    border: `1px solid ${color}`,
                    opacity: isSharing || selected ? 0.45 : 0.18,
                    boxShadow: selected ? `0 0 20px ${color}` : "none",
                  }}
                />
                <div
                  style={{
                    width: dotSize,
                    height: dotSize,
                    borderRadius: "999px",
                    background: color,
                    boxShadow: isSharing
                      ? `0 0 18px ${color}, 0 0 34px ${color}55`
                      : `0 0 12px ${color}66`,
                    position: "relative",
                    zIndex: 2,
                  }}
                />
                <div
                  className="pointer-events-none absolute whitespace-nowrap ui-mono text-[11px] uppercase tracking-[0.12em]"
                  style={{
                    left: 16,
                    top: -6,
                    color: selected ? "#f5f7fb" : "#a5b4c7",
                    transition: "all 500ms ease-out",
                  }}
                >
                  {shortName(agent.name)}
                  <span style={{ marginLeft: 8, color }}>{Math.round(state.belief * 100)}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
