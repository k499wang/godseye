"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { SimulationResponse, TickSnapshot } from "@/lib/types";
import { AgentConstellation } from "./AgentConstellation";
import { ARCHETYPE_COLORS, ARCHETYPE_LABELS } from "@/lib/constants";

interface SimulationReplayProps {
  simulation: SimulationResponse;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; dot: string; border: string }> = {
    pending: { bg: "rgba(148,163,184,0.08)", text: "#94a3b8", dot: "#94a3b8", border: "rgba(148,163,184,0.18)" },
    building: { bg: "rgba(245,158,11,0.10)", text: "#f59e0b", dot: "#f59e0b", border: "rgba(245,158,11,0.22)" },
    running: { bg: "rgba(52,211,153,0.10)", text: "#34d399", dot: "#34d399", border: "rgba(52,211,153,0.22)" },
    complete: { bg: "rgba(96,165,250,0.10)", text: "#93c5fd", dot: "#60a5fa", border: "rgba(96,165,250,0.22)" },
    failed: { bg: "rgba(251,113,133,0.10)", text: "#fb7185", dot: "#fb7185", border: "rgba(251,113,133,0.22)" },
  };
  const color = colors[status] ?? colors.pending;

  return (
    <span
      className="ui-mono inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
      style={{ background: color.bg, color: color.text, borderColor: color.border }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color.dot, animation: status === "running" ? "pulse 1.4s ease-in-out infinite" : "none" }}
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
  const [playDirection, setPlayDirection] = useState<"forward" | "backward" | null>(null);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tickData = simulation.tick_data;
  const agents = simulation.agents;
  const totalTicks = simulation.total_ticks;
  const loadedTicks = tickData.length;
  const latestLoadedTick = loadedTicks > 0 ? tickData[loadedTicks - 1].tick : 1;

  const currentSnapshot: TickSnapshot | null =
    tickData.find((snapshot) => snapshot.tick === currentTick) ?? null;
  const currentIndex = tickData.findIndex((snapshot) => snapshot.tick === currentTick);
  const previousSnapshot: TickSnapshot | null =
    currentIndex > 0 ? tickData[currentIndex - 1] : null;

  useEffect(() => {
    if (
      simulation.status === "running" ||
      simulation.status === "building" ||
      simulation.status === "pending"
    ) {
      setCurrentTick(latestLoadedTick);
    } else if (!tickData.find((snapshot) => snapshot.tick === currentTick)) {
      setCurrentTick(latestLoadedTick);
    }
  }, [currentTick, latestLoadedTick, simulation.status, tickData]);

  useEffect(() => {
    if (!agents.length) {
      setSelectedAgentId(null);
      return;
    }
    if (selectedAgentId && agents.some((agent) => agent.id === selectedAgentId)) return;
    setSelectedAgentId(agents[0].id);
  }, [agents, selectedAgentId]);

  // Play/rewind: advance one tick per interval
  useEffect(() => {
    if (playRef.current) clearInterval(playRef.current);
    if (!playDirection) return;

    playRef.current = setInterval(() => {
      setCurrentTick((prev) => {
        const idx = tickData.findIndex((s) => s.tick === prev);
        if (playDirection === "forward") {
          if (idx >= tickData.length - 1) {
            setPlayDirection(null);
            return prev;
          }
          return tickData[idx + 1].tick;
        } else {
          if (idx <= 0) {
            setPlayDirection(null);
            return prev;
          }
          return tickData[idx - 1].tick;
        }
      });
    }, 850);

    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [playDirection, tickData]);

  const handleTickSelect = useCallback(
    (tick: number) => {
      setPlayDirection(null);
      if (tickData.find((snapshot) => snapshot.tick === tick)) setCurrentTick(tick);
    },
    [tickData]
  );

  const consensusAtTick = currentSnapshot
    ? currentSnapshot.agent_states.reduce((sum, state) => sum + state.belief, 0) /
      currentSnapshot.agent_states.length
    : null;

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const selectedAgentState =
    selectedAgent && currentSnapshot
      ? currentSnapshot.agent_states.find((state) => state.agent_id === selectedAgent.id) ?? null
      : null;
  const previousSelectedState =
    selectedAgent && previousSnapshot
      ? previousSnapshot.agent_states.find((state) => state.agent_id === selectedAgent.id) ?? null
      : null;

  const selectedAgentDelta =
    selectedAgent && selectedAgentState && previousSelectedState
      ? selectedAgentState.belief - previousSelectedState.belief
      : selectedAgent && selectedAgentState
        ? selectedAgentState.belief - selectedAgent.initial_belief
        : 0;

  return (
    <div className="mx-auto max-w-[1680px] px-6 py-8 text-[var(--text-primary)] md:px-8 xl:px-10">
      <div className="mb-5 rounded-xl border border-white/8 bg-[rgba(12,16,26,0.9)] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="ui-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Constellation Replay
            </span>
            <span className="ui-mono text-[12px] text-[var(--text-subtle)]">
              {simulation.id.slice(0, 8).toUpperCase()}
            </span>
            <StatusBadge status={simulation.status} />
          </div>

          <div className="flex flex-wrap items-center gap-5">
            {consensusAtTick !== null && (
              <MetricInline
                label="Consensus"
                value={`${Math.round(consensusAtTick * 100)}%`}
                color={beliefTone(consensusAtTick)}
              />
            )}
            <MetricInline label="Agents" value={String(agents.length)} />
            <MetricInline label="Ticks" value={`${loadedTicks}/${totalTicks}`} />
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-white/8 bg-[rgba(12,16,26,0.9)] px-5 py-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <CtrlBtn
              onClick={() => {
                setPlayDirection(null);
                const index = tickData.findIndex((s) => s.tick === currentTick);
                if (index > 0) setCurrentTick(tickData[index - 1].tick);
              }}
            >
              ← Prev
            </CtrlBtn>
            <CtrlBtn
              active={playDirection === "backward"}
              onClick={() => setPlayDirection((d) => (d === "backward" ? null : "backward"))}
            >
              ◀ Rewind
            </CtrlBtn>
            <div className="mx-1 rounded-lg border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-2 text-center">
              <span className="ui-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-subtle)]">Tick </span>
              <span className="ui-mono text-[15px] font-bold text-[var(--text-bright)]">
                {String(currentTick).padStart(2, "0")}
              </span>
            </div>
            <CtrlBtn
              active={playDirection === "forward"}
              onClick={() => setPlayDirection((d) => (d === "forward" ? null : "forward"))}
            >
              Play ▶
            </CtrlBtn>
            <CtrlBtn
              onClick={() => {
                setPlayDirection(null);
                const index = tickData.findIndex((s) => s.tick === currentTick);
                if (index < tickData.length - 1) setCurrentTick(tickData[index + 1].tick);
              }}
            >
              Next →
            </CtrlBtn>
          </div>

          <span className="ui-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-subtle)]">
            {loadedTicks} loaded / {totalTicks} total
          </span>
        </div>

        <div className="relative h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
          {/* Loaded range (dim) */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[rgba(245,158,11,0.15)]"
            style={{ width: `${(loadedTicks / totalTicks) * 100}%` }}
          />
          {/* Current playhead */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[rgba(255,255,255,0.55)] transition-[width] duration-300"
            style={{ width: `${(currentTick / totalTicks) * 100}%` }}
          />
          {tickData.map((snapshot) => {
            const pct = ((snapshot.tick - 1) / Math.max(totalTicks - 1, 1)) * 100;
            const isActive = snapshot.tick === currentTick;
            return (
              <button
                key={snapshot.tick}
                type="button"
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all"
                style={{
                  left: `${pct}%`,
                  width: isActive ? 14 : 10,
                  height: isActive ? 14 : 10,
                  background: isActive ? "#e2e8f0" : "rgba(255,255,255,0.35)",
                  borderColor: isActive ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)",
                }}
                onClick={() => handleTickSelect(snapshot.tick)}
                title={`Tick ${snapshot.tick}`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex justify-between ui-mono text-[10px] text-[var(--text-subtle)]">
          <span>1</span>
          <span>{totalTicks}</span>
        </div>
      </div>

      <AgentConstellation
        agents={agents}
        tickData={tickData}
        currentTick={currentTick}
        selectedAgentId={selectedAgentId}
        onSelectAgent={setSelectedAgentId}
      />

      {selectedAgent && selectedAgentState && (
        <div className="mt-4 rounded-xl border border-white/8 bg-[rgba(12,16,26,0.9)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: ARCHETYPE_COLORS[selectedAgent.archetype] ?? "#0f172a" }}
              />
              <div>
                <div className="text-[17px] font-semibold text-[var(--text-bright)]">{selectedAgent.name}</div>
                <div
                  className="ui-mono text-[10px] uppercase tracking-[0.16em]"
                  style={{ color: ARCHETYPE_COLORS[selectedAgent.archetype] ?? "var(--text-muted)" }}
                >
                  {ARCHETYPE_LABELS[selectedAgent.archetype]}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <MetricInline label="Belief" value={`${Math.round(selectedAgentState.belief * 100)}%`} color={beliefTone(selectedAgentState.belief)} />
              <MetricInline label="Delta" value={`${selectedAgentDelta >= 0 ? "+" : ""}${Math.round(selectedAgentDelta * 100)}pt`} color={selectedAgentDelta >= 0 ? "#059669" : "#dc2626"} />
              <MetricInline label="Confidence" value={`${Math.round(selectedAgentState.confidence * 100)}%`} />
              <MetricInline
                label="Mode"
                value={selectedAgentState.action_taken === "share_claim" ? "share" : "update"}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricInline({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="ui-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-subtle)]">{label}</span>
      <span className="ui-mono text-[13px] font-semibold" style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

function CtrlBtn({
  children,
  onClick,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="ui-mono rounded-lg border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition"
      style={{
        borderColor: active ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
        background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
        color: active ? "var(--text-bright)" : "var(--text-secondary)",
      }}
    >
      {children}
    </button>
  );
}

function beliefTone(value: number): string {
  if (value >= 0.65) return "#059669";
  if (value >= 0.5) return "#d97706";
  return "#dc2626";
}
