"use client";

import { useState, useCallback, useEffect } from "react";
import type { SimulationResponse, TickSnapshot } from "@/lib/types";
import { BeliefChart } from "./BeliefChart";
import { AgentDebateFeed } from "./AgentDebateFeed";
import { SocietyGraph, SocietyInspector } from "./SocietyGraph";

interface SimulationReplayProps {
  simulation: SimulationResponse;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; dot: string }> = {
    pending: {
      bg: "rgba(148, 163, 184, 0.12)",
      text: "var(--text-secondary)",
      dot: "#94a3b8",
    },
    building: { bg: "rgba(245,158,11,0.14)", text: "var(--accent)", dot: "var(--accent)" },
    running: { bg: "rgba(52,211,153,0.14)", text: "var(--success)", dot: "var(--success)" },
    complete: { bg: "rgba(96,165,250,0.14)", text: "#93c5fd", dot: "#93c5fd" },
    failed: { bg: "rgba(251,113,133,0.14)", text: "var(--danger)", dot: "var(--danger)" },
  };
  const c = colors[status] ?? colors.pending;

  return (
    <span
      className="ui-mono inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
      style={{ background: c.bg, color: c.text }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{
          background: c.dot,
          boxShadow: status === "running" ? `0 0 10px ${c.dot}` : "none",
          animation: status === "running" ? "pulse 1.5s ease-in-out infinite" : "none",
        }}
      />
      {status}
    </span>
  );
}

export function SimulationReplay({ simulation }: SimulationReplayProps) {
  const [currentTick, setCurrentTick] = useState<number>(
    simulation.tick_data.length > 0
      ? simulation.tick_data[simulation.tick_data.length - 1].tick
      : 1
  );
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    simulation.agents[0]?.id ?? null
  );
  const [selectedShareIndex, setSelectedShareIndex] = useState<number | null>(null);

  const tickData = simulation.tick_data;
  const agents = simulation.agents;
  const totalTicks = simulation.total_ticks;
  const loadedTicks = tickData.length;

  const currentSnapshot: TickSnapshot | null =
    tickData.find((t) => t.tick === currentTick) ?? null;

  useEffect(() => {
    setSelectedShareIndex(null);
    setSelectedAgentId((current) => current ?? simulation.agents[0]?.id ?? null);
  }, [currentTick, simulation.agents]);

  const handleTickSelect = useCallback(
    (tick: number) => {
      const snap = tickData.find((t) => t.tick === tick);
      if (snap) setCurrentTick(tick);
    },
    [tickData]
  );

  const consensusAtTick = currentSnapshot
    ? currentSnapshot.agent_states.reduce((sum, state) => sum + state.belief, 0) /
      currentSnapshot.agent_states.length
    : null;

  const handleSelectAgent = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
    setSelectedShareIndex(null);
  }, []);

  const handleSelectShare = useCallback((shareIndex: number) => {
    setSelectedShareIndex(shareIndex);
  }, []);

  return (
    <div className="flex h-full flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow">Society simulation</span>
          <span className="ui-mono text-sm text-[var(--text-muted)]">
            {simulation.id.slice(0, 8).toUpperCase()}
          </span>
          <StatusBadge status={simulation.status} />
        </div>

        <div className="flex flex-wrap items-center gap-5">
          {consensusAtTick !== null && (
            <MetricInline
              label="Consensus"
              value={`${Math.round(consensusAtTick * 100)}%`}
              color={
                consensusAtTick >= 0.55
                  ? "var(--success)"
                  : consensusAtTick >= 0.45
                    ? "var(--accent)"
                    : "var(--danger)"
              }
            />
          )}
          <MetricInline label="Agents" value={String(agents.length)} />
          <MetricInline label="Ticks" value={`${loadedTicks}/${totalTicks}`} />
        </div>
      </div>

      <div className="border-b border-white/6 px-5 py-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="eyebrow">Tick</span>
          <span className="ui-mono text-sm font-semibold text-[var(--accent)]">
            {String(currentTick).padStart(2, "0")}
          </span>
        </div>

        <div className="relative">
          <div className="relative h-1.5 w-full rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-[rgba(245,158,11,0.22)]"
              style={{ width: `${(loadedTicks / totalTicks) * 100}%` }}
            />
            {Array.from({ length: loadedTicks }).map((_, index) => {
              const tick = tickData[index].tick;
              const pct = ((tick - 1) / (totalTicks - 1)) * 100;
              const isActive = tick === currentTick;

              return (
                <button
                  key={tick}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all"
                  style={{
                    left: `${pct}%`,
                    width: isActive ? 14 : 9,
                    height: isActive ? 14 : 9,
                    background: isActive ? "var(--accent)" : "rgba(245,158,11,0.45)",
                    boxShadow: isActive ? "0 0 18px rgba(245,158,11,0.28)" : "none",
                    border: isActive ? "3px solid rgba(255,255,255,0.82)" : "none",
                  }}
                  onClick={() => handleTickSelect(tick)}
                  title={`Tick ${tick}`}
                />
              );
            })}
          </div>

          <div className="mt-2 flex justify-between text-xs text-[var(--text-muted)]">
            <span className="ui-mono">1</span>
            <span className="ui-mono">{totalTicks}</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className="ui-mono rounded-full border border-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={() => {
              const index = tickData.findIndex((tick) => tick.tick === currentTick);
              if (index > 0) setCurrentTick(tickData[index - 1].tick);
            }}
          >
            Prev
          </button>
          <button
            className="ui-mono rounded-full border border-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={() => {
              const index = tickData.findIndex((tick) => tick.tick === currentTick);
              if (index < tickData.length - 1) setCurrentTick(tickData[index + 1].tick);
            }}
          >
            Next
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className="flex min-h-0 flex-col border-r border-white/8"
          style={{ width: "62%" }}
        >
          <div className="flex-1 min-h-0 border-b border-white/6 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="eyebrow mb-1">Agent society</div>
                <div className="text-sm text-[var(--text-secondary)]">
                  Claim exchange, factions, and live positions at the selected tick.
                </div>
              </div>
              {currentSnapshot && (
                <div className="ui-mono rounded-full border border-[rgba(52,211,153,0.24)] bg-[rgba(52,211,153,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--success)]">
                  {currentSnapshot.claim_shares.length} active share
                  {currentSnapshot.claim_shares.length === 1 ? "" : "s"}
                </div>
              )}
            </div>
            <div className="flex h-[calc(100%-40px)] items-center justify-center rounded-[28px] border border-white/8 bg-[rgba(255,255,255,0.02)]">
              <SocietyGraph
                agents={agents}
                tickSnapshot={currentSnapshot}
                selectedAgentId={selectedAgentId}
                selectedShareIndex={selectedShareIndex}
                onSelectAgent={handleSelectAgent}
                onSelectShare={handleSelectShare}
              />
            </div>
          </div>

          <div className="flex overflow-hidden" style={{ height: 300 }}>
            <div className="flex-shrink-0 border-r border-white/6 p-4">
              <div className="eyebrow mb-3">Inspector</div>
              <div style={{ width: 340 }}>
                <SocietyInspector
                  agents={agents}
                  tickSnapshot={currentSnapshot}
                  selectedAgentId={selectedAgentId}
                  selectedShareIndex={selectedShareIndex}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="eyebrow mb-3">Belief convergence</div>
              <div style={{ height: 220 }}>
                <BeliefChart
                  agents={agents}
                  tickData={tickData}
                  currentTick={currentTick}
                  totalTicks={totalTicks}
                  onTickSelect={handleTickSelect}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden p-4">
            <AgentDebateFeed
              agents={agents}
              tickSnapshot={currentSnapshot}
              currentTick={currentTick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricInline({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow">{label}</span>
      <span
        className="ui-mono text-sm font-semibold"
        style={{ color: color ?? "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}
