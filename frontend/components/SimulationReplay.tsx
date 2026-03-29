"use client";

import { useState, useCallback, useEffect } from "react";
import type { SimulationResponse, TickSnapshot } from "@/lib/types";
import { ARCHETYPE_COLORS, ARCHETYPE_LABELS } from "@/lib/constants";
import { BeliefChart } from "./BeliefChart";
import { AgentDebateFeed } from "./AgentDebateFeed";
import { AgentConstellation } from "./AgentConstellation";

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
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const tickData = simulation.tick_data;
  const agents = simulation.agents;
  const totalTicks = simulation.total_ticks;
  const loadedTicks = tickData.length;
  const latestLoadedTick = loadedTicks > 0 ? tickData[loadedTicks - 1].tick : 1;

  const currentSnapshot: TickSnapshot | null =
    tickData.find((t) => t.tick === currentTick) ?? null;
  const previousSnapshot: TickSnapshot | null =
    tickData.find((t) => t.tick === currentTick - 1) ?? null;

  const handleTickSelect = useCallback(
    (tick: number) => {
      const snap = tickData.find((t) => t.tick === tick);
      if (snap) setCurrentTick(tick);
    },
    [tickData]
  );

  useEffect(() => {
    if (simulation.status === "running" || simulation.status === "building" || simulation.status === "pending") {
      setCurrentTick(latestLoadedTick);
    } else if (!tickData.find((tick) => tick.tick === currentTick)) {
      setCurrentTick(latestLoadedTick);
    }
  }, [currentTick, latestLoadedTick, simulation.status, tickData]);

  useEffect(() => {
    if (!agents.length) {
      setSelectedAgentId(null);
      return;
    }
    if (selectedAgentId && agents.some((agent) => agent.id === selectedAgentId)) {
      return;
    }
    setSelectedAgentId(agents[0].id);
  }, [agents, selectedAgentId]);

  const consensusAtTick = currentSnapshot
    ? currentSnapshot.agent_states.reduce((sum, state) => sum + state.belief, 0) /
      currentSnapshot.agent_states.length
    : null;

  return (
    <div className="min-h-[1500px] bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="flex items-center justify-between gap-4 border-b border-white/8 px-3.5 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow">Simulation replay</span>
          <span className="ui-mono text-sm text-[var(--text-muted)]">
            {simulation.id.slice(0, 8).toUpperCase()}
          </span>
          <StatusBadge status={simulation.status} />
        </div>

        <div className="flex flex-wrap items-center gap-4">
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

      <div className="border-b border-white/6 px-3.5 py-2.5">
        <div className="mb-1.5 flex items-center gap-3">
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

        <div className="mt-2.5 flex gap-2">
          <button
            className="ui-mono rounded-full border border-white/12 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={() => {
              const index = tickData.findIndex((tick) => tick.tick === currentTick);
              if (index > 0) setCurrentTick(tickData[index - 1].tick);
            }}
          >
            Prev
          </button>
          <button
            className="ui-mono rounded-full border border-white/12 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={() => {
              const index = tickData.findIndex((tick) => tick.tick === currentTick);
              if (index < tickData.length - 1) setCurrentTick(tickData[index + 1].tick);
            }}
          >
            Next
          </button>
        </div>
      </div>

      <div className="flex">
        <div className="flex flex-col border-r border-white/8" style={{ width: "68%" }}>
          <div className="border-b border-white/6 p-2.5">
            <AgentConstellation
              agents={agents}
              tickData={tickData}
              currentTick={currentTick}
              selectedAgentId={selectedAgentId}
              onSelectAgent={setSelectedAgentId}
            />
          </div>

          <div className="p-2.5" style={{ minHeight: 320 }}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="eyebrow">Belief motion timeline</span>
            </div>
            <div style={{ height: 280 }}>
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

        <div className="flex flex-1 flex-col">
          <div className="p-2.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="eyebrow">Claim propagation stream</span>
            </div>
            <AgentDebateFeed
              agents={agents}
              tickSnapshot={currentSnapshot}
              previousTickSnapshot={previousSnapshot}
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
