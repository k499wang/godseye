"use client";

import { useState, useCallback } from "react";
import type { SimulationResponse, TickSnapshot } from "@/lib/types";
import { ARCHETYPE_COLORS, ARCHETYPE_LABELS } from "@/lib/constants";
import { BeliefChart } from "./BeliefChart";
import { AgentDebateFeed } from "./AgentDebateFeed";
import { TrustNetwork } from "./TrustNetwork";

interface SimulationReplayProps {
  simulation: SimulationResponse;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; dot: string }> = {
    pending: { bg: "rgba(107,114,128,0.15)", text: "#9ca3af", dot: "#6b7280" },
    building: { bg: "rgba(245,158,11,0.15)", text: "#F59E0B", dot: "#F59E0B" },
    running: { bg: "rgba(16,185,129,0.15)", text: "#10B981", dot: "#10B981" },
    complete: { bg: "rgba(59,130,246,0.15)", text: "#3B82F6", dot: "#3B82F6" },
    failed: { bg: "rgba(239,68,68,0.15)", text: "#EF4444", dot: "#EF4444" },
  };
  const c = colors[status] ?? colors.pending;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] tracking-widest"
      style={{ background: c.bg, color: c.text }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: c.dot,
          boxShadow: status === "running" ? `0 0 6px ${c.dot}` : "none",
          animation: status === "running" ? "pulse 1.5s ease-in-out infinite" : "none",
        }}
      />
      {status.toUpperCase()}
    </span>
  );
}

export function SimulationReplay({ simulation }: SimulationReplayProps) {
  const [currentTick, setCurrentTick] = useState<number>(
    simulation.tick_data.length > 0
      ? simulation.tick_data[simulation.tick_data.length - 1].tick
      : 1
  );

  const tickData = simulation.tick_data;
  const agents = simulation.agents;
  const totalTicks = simulation.total_ticks;
  const loadedTicks = tickData.length;

  const currentSnapshot: TickSnapshot | null =
    tickData.find((t) => t.tick === currentTick) ?? null;

  const handleTickSelect = useCallback(
    (tick: number) => {
      const snap = tickData.find((t) => t.tick === tick);
      if (snap) setCurrentTick(tick);
    },
    [tickData]
  );

  // Compute consensus at current tick
  const consensusAtTick = currentSnapshot
    ? currentSnapshot.agent_states.reduce((sum, s) => sum + s.belief, 0) /
      currentSnapshot.agent_states.length
    : null;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] font-mono">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-3">
          <span className="text-[10px] tracking-[0.3em] text-[#4b5563]">
            SIMULATION
          </span>
          <span className="text-[10px] text-[#6b7280]">
            {simulation.id.slice(0, 8).toUpperCase()}
          </span>
          <StatusBadge status={simulation.status} />
        </div>
        <div className="flex items-center gap-4">
          {consensusAtTick !== null && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] tracking-widest text-[#4b5563]">
                CONSENSUS
              </span>
              <span
                className="text-[14px] font-bold tabular-nums"
                style={{
                  color:
                    consensusAtTick >= 0.55
                      ? "#10B981"
                      : consensusAtTick >= 0.45
                      ? "#F59E0B"
                      : "#EF4444",
                }}
              >
                {Math.round(consensusAtTick * 100)}%
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-widest text-[#4b5563]">
              AGENTS
            </span>
            <span className="text-[#9ca3af] text-[12px]">{agents.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-widest text-[#4b5563]">TICKS</span>
            <span className="text-[#9ca3af] text-[12px]">
              {loadedTicks}/{totalTicks}
            </span>
          </div>
        </div>
      </div>

      {/* Tick scrubber */}
      <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[9px] tracking-widest text-[#374151]">TICK</span>
          <span
            className="text-[10px] text-[#F59E0B] tabular-nums"
            style={{ minWidth: 24 }}
          >
            {String(currentTick).padStart(2, "0")}
          </span>
        </div>
        <div className="relative">
          {/* Track */}
          <div className="w-full h-1 bg-[#1a1a24] relative">
            {/* Loaded range */}
            <div
              className="absolute top-0 left-0 h-full bg-[rgba(245,158,11,0.2)]"
              style={{ width: `${(loadedTicks / totalTicks) * 100}%` }}
            />
            {/* Tick markers */}
            {Array.from({ length: loadedTicks }).map((_, i) => {
              const tick = tickData[i].tick;
              const pct = ((tick - 1) / (totalTicks - 1)) * 100;
              const isActive = tick === currentTick;
              return (
                <button
                  key={tick}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all"
                  style={{
                    left: `${pct}%`,
                    width: isActive ? 10 : 6,
                    height: isActive ? 10 : 6,
                    background: isActive ? "#F59E0B" : "rgba(245,158,11,0.35)",
                    borderRadius: 0,
                    outline: isActive ? "2px solid rgba(245,158,11,0.4)" : "none",
                    outlineOffset: 2,
                  }}
                  onClick={() => handleTickSelect(tick)}
                  title={`Tick ${tick}`}
                />
              );
            })}
          </div>
          {/* Labels */}
          <div className="flex justify-between mt-1">
            <span className="text-[8px] text-[#374151]">1</span>
            <span className="text-[8px] text-[#374151]">{totalTicks}</span>
          </div>
        </div>

        {/* Prev / Next buttons */}
        <div className="flex gap-2 mt-2">
          <button
            className="px-2 py-0.5 text-[9px] tracking-widest text-[#6b7280] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(245,158,11,0.3)] hover:text-[#F59E0B] transition-colors"
            onClick={() => {
              const idx = tickData.findIndex((t) => t.tick === currentTick);
              if (idx > 0) setCurrentTick(tickData[idx - 1].tick);
            }}
          >
            ← PREV
          </button>
          <button
            className="px-2 py-0.5 text-[9px] tracking-widest text-[#6b7280] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(245,158,11,0.3)] hover:text-[#F59E0B] transition-colors"
            onClick={() => {
              const idx = tickData.findIndex((t) => t.tick === currentTick);
              if (idx < tickData.length - 1) setCurrentTick(tickData[idx + 1].tick);
            }}
          >
            NEXT →
          </button>
        </div>
      </div>

      {/* Main split: left = chart + network, right = debate feed */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* LEFT PANE */}
        <div className="flex flex-col border-r border-[rgba(255,255,255,0.05)]" style={{ width: "55%" }}>
          {/* Belief chart */}
          <div className="flex-1 min-h-0 p-3 border-b border-[rgba(255,255,255,0.04)]">
            <div className="text-[9px] tracking-widest text-[#374151] mb-2">
              BELIEF CONVERGENCE — ALL AGENTS
            </div>
            <div style={{ height: "calc(100% - 20px)" }}>
              <BeliefChart
                agents={agents}
                tickData={tickData}
                currentTick={currentTick}
                totalTicks={totalTicks}
                onTickSelect={handleTickSelect}
              />
            </div>
          </div>

          {/* Bottom: trust network + agent legend */}
          <div className="flex overflow-hidden" style={{ height: 260 }}>
            {/* Trust network */}
            <div className="flex-shrink-0 p-3 border-r border-[rgba(255,255,255,0.04)]">
              <TrustNetwork agents={agents} tickSnapshot={currentSnapshot} />
            </div>

            {/* Agent legend */}
            <div className="flex-1 p-3 overflow-y-auto">
              <div className="text-[9px] tracking-widest text-[#374151] mb-2">
                AGENTS
              </div>
              <div className="flex flex-col gap-1.5">
                {agents.map((agent) => {
                  const color = ARCHETYPE_COLORS[agent.archetype] ?? "#fff";
                  const tickState = currentSnapshot?.agent_states.find(
                    (s) => s.agent_id === agent.id
                  );
                  const belief = tickState?.belief ?? agent.initial_belief;
                  const delta = belief - agent.initial_belief;

                  return (
                    <div key={agent.id} className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 flex-shrink-0"
                        style={{ background: color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-[#d1d5db] truncate">
                          {agent.name}
                        </div>
                        <div
                          className="text-[9px] truncate"
                          style={{ color: `${color}80` }}
                        >
                          {ARCHETYPE_LABELS[agent.archetype]}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className="text-[11px] font-bold tabular-nums"
                          style={{ color }}
                        >
                          {Math.round(belief * 100)}%
                        </span>
                        <span
                          className="text-[9px] tabular-nums"
                          style={{
                            color: delta >= 0 ? "#10B981" : "#EF4444",
                          }}
                        >
                          {delta >= 0 ? "+" : ""}
                          {Math.round(delta * 100)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANE — debate feed */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden p-3">
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
