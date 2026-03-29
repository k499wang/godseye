"use client";

import { useCallback, useEffect, useState } from "react";
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

  const handleTickSelect = useCallback(
    (tick: number) => {
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
  const selectedAgentSentShares =
    selectedAgent && currentSnapshot
      ? currentSnapshot.claim_shares.filter((share) => share.from_agent_id === selectedAgent.id)
      : [];
  const selectedAgentReceivedShares =
    selectedAgent && currentSnapshot
      ? currentSnapshot.claim_shares.filter((share) => share.to_agent_id === selectedAgent.id)
      : [];

  return (
    <div className="mx-auto max-w-[1680px] px-6 py-8 text-[var(--text-primary)] md:px-8 xl:px-10">
      <div className="mb-5 rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[rgba(12,16,26,0.82)] px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
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

      <div className="mb-6 rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[rgba(12,16,26,0.82)] px-5 py-4 shadow-[0_16px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              className="rounded-full border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] px-4 py-2 ui-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-bright)] transition hover:bg-[rgba(245,158,11,0.14)]"
              onClick={() => {
                const index = tickData.findIndex((snapshot) => snapshot.tick === currentTick);
                if (index > 0) setCurrentTick(tickData[index - 1].tick);
              }}
            >
              Prev
            </button>
            <div className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2">
              <span className="ui-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Tick </span>
              <span className="ui-mono text-[16px] font-bold text-[var(--accent)]">
                {String(currentTick).padStart(2, "0")}
              </span>
            </div>
            <button
              className="rounded-full border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] px-4 py-2 ui-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-bright)] transition hover:bg-[rgba(245,158,11,0.14)]"
              onClick={() => {
                const index = tickData.findIndex((snapshot) => snapshot.tick === currentTick);
                if (index < tickData.length - 1) setCurrentTick(tickData[index + 1].tick);
              }}
            >
              Next
            </button>
          </div>

          <span className="ui-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-subtle)]">
            {loadedTicks} loaded / {totalTicks} total
          </span>
        </div>

        <div className="relative h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,var(--accent),#fbbf24)]"
            style={{ width: `${(loadedTicks / totalTicks) * 100}%` }}
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
                  width: isActive ? 16 : 12,
                  height: isActive ? 16 : 12,
                  background: isActive ? "var(--accent)" : "rgba(255,255,255,0.92)",
                  borderColor: isActive ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.22)",
                  boxShadow: isActive ? "0 0 0 4px rgba(245,158,11,0.16)" : "none",
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
        simulationId={simulation.id}
      />

      {selectedAgent && selectedAgentState && (
        <div className="mt-6 rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[rgba(12,16,26,0.82)] px-5 py-4 shadow-[0_14px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-[260px] flex-1">
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

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Belief" value={`${Math.round(selectedAgentState.belief * 100)}%`} color={beliefTone(selectedAgentState.belief)} />
                <MetricCard label="Delta" value={`${selectedAgentDelta >= 0 ? "+" : ""}${Math.round(selectedAgentDelta * 100)}pt`} color={selectedAgentDelta >= 0 ? "#059669" : "#dc2626"} />
                <MetricCard label="Confidence" value={`${Math.round(selectedAgentState.confidence * 100)}%`} />
                <MetricCard label="Mode" value={selectedAgentState.action_taken === "share_claim" ? "Share claim" : "Update belief"} />
              </div>

              <div className="mt-4 rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="ui-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-subtle)]">
                  Current reasoning
                </div>
                <p className="mt-2 text-[13px] leading-6 text-[var(--text-primary)]">
                  {selectedAgentState.reasoning || "No reasoning recorded for this tick."}
                </p>
              </div>
            </div>

            <div className="grid min-w-[300px] flex-1 gap-4 xl:max-w-[680px] xl:grid-cols-2">
              <div>
                <div className="ui-mono mb-3 text-[10px] uppercase tracking-[0.16em] text-[var(--text-subtle)]">
                  Claims shared this tick
                </div>
                <ClaimShareList
                  shares={selectedAgentSentShares}
                  direction="sent"
                />
              </div>

              <div>
                <div className="ui-mono mb-3 text-[10px] uppercase tracking-[0.16em] text-[var(--text-subtle)]">
                  Claims received this tick
                </div>
                <ClaimShareList
                  shares={selectedAgentReceivedShares}
                  direction="received"
                />
              </div>
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

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
      <div className="ui-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-subtle)]">{label}</div>
      <div className="mt-1 text-[18px] font-semibold" style={{ color: color ?? "var(--text-bright)" }}>
        {value}
      </div>
    </div>
  );
}

function ClaimShareList({
  shares,
  direction,
}: {
  shares: TickSnapshot["claim_shares"];
  direction: "sent" | "received";
}) {
  if (shares.length === 0) {
    return (
      <div className="rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4 text-[13px] text-[var(--text-subtle)]">
        No claims {direction} on this tick.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {shares.map((share, index) => {
        const counterparty =
          direction === "sent" ? share.to_agent_name : share.from_agent_name;
        return (
          <div
            key={`${direction}-${share.claim_id}-${share.from_agent_id}-${share.to_agent_id}-${index}`}
            className="rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="ui-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-subtle)]">
                {direction === "sent" ? `To ${counterparty}` : `From ${counterparty}`}
              </div>
              <div className="ui-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                Tick {String(share.tick).padStart(2, "0")}
              </div>
            </div>
            <p className="mt-3 text-[13px] font-medium leading-6 text-[var(--text-bright)]">
              {share.claim_text}
            </p>
            <p className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">
              {share.commentary || "No commentary attached."}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function beliefTone(value: number): string {
  if (value >= 0.65) return "#059669";
  if (value >= 0.5) return "#d97706";
  return "#dc2626";
}
