"use client";

import type { AgentSummary, TickSnapshot } from "@/lib/types";
import { ARCHETYPE_COLORS, ARCHETYPE_LABELS } from "@/lib/constants";

interface SocietyGraphProps {
  agents: AgentSummary[];
  tickSnapshot: TickSnapshot | null;
  selectedAgentId: string | null;
  selectedShareIndex: number | null;
  onSelectAgent: (agentId: string) => void;
  onSelectShare: (shareIndex: number) => void;
}

type Position = { x: number; y: number };

const SIZE = 520;
const CENTER = SIZE / 2;
const RADIUS = 180;

function getPosition(index: number, total: number): Position {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
  };
}

function edgePath(from: Position, to: Position) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const curve = Math.max(18, Math.min(54, distance * 0.18));
  const nx = distance === 0 ? 0 : -dy / distance;
  const ny = distance === 0 ? 0 : dx / distance;
  const cx = mx + nx * curve;
  const cy = my + ny * curve;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

function beliefTone(belief: number) {
  if (belief >= 0.65) return "var(--success)";
  if (belief >= 0.45) return "var(--accent)";
  return "var(--danger)";
}

export function SocietyGraph({
  agents,
  tickSnapshot,
  selectedAgentId,
  selectedShareIndex,
  onSelectAgent,
  onSelectShare,
}: SocietyGraphProps) {
  const positions = agents.map((_, index) => getPosition(index, agents.length));
  const shares = tickSnapshot?.claim_shares ?? [];

  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="max-h-full max-w-full overflow-visible"
      >
        <defs>
          <marker
            id="society-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 8 4, 0 8" fill="rgba(245,158,11,0.85)" />
          </marker>
        </defs>

        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS + 42}
          fill="rgba(255,255,255,0.015)"
          stroke="rgba(255,255,255,0.05)"
          strokeDasharray="4 8"
        />

        {(tickSnapshot?.faction_clusters ?? []).map((cluster, clusterIndex) => {
          const clusterPoints = cluster
            .map((id) => {
              const index = agents.findIndex((agent) => agent.id === id);
              return index >= 0 ? positions[index] : null;
            })
            .filter(Boolean) as Position[];

          if (clusterPoints.length < 2) return null;

          const cx = clusterPoints.reduce((sum, point) => sum + point.x, 0) / clusterPoints.length;
          const cy = clusterPoints.reduce((sum, point) => sum + point.y, 0) / clusterPoints.length;
          const maxDistance = clusterPoints.reduce((max, point) => {
            const dx = point.x - cx;
            const dy = point.y - cy;
            return Math.max(max, Math.sqrt(dx * dx + dy * dy));
          }, 0);

          return (
            <circle
              key={`cluster-${clusterIndex}`}
              cx={cx}
              cy={cy}
              r={maxDistance + 34}
              fill="rgba(245,158,11,0.04)"
              stroke="rgba(245,158,11,0.18)"
              strokeDasharray="6 6"
            />
          );
        })}

        {shares.map((share, index) => {
          const fromIndex = agents.findIndex((agent) => agent.id === share.from_agent_id);
          const toIndex = agents.findIndex((agent) => agent.id === share.to_agent_id);
          if (fromIndex === -1 || toIndex === -1) return null;

          const active = selectedShareIndex === index;
          const from = positions[fromIndex];
          const to = positions[toIndex];
          const path = edgePath(from, to);

          return (
            <g key={`${share.claim_id}-${index}`}>
              <path
                d={path}
                fill="none"
                stroke={active ? "rgba(245,158,11,0.95)" : "rgba(52,211,153,0.75)"}
                strokeWidth={active ? 4 : 2.5}
                strokeLinecap="round"
                markerEnd="url(#society-arrow)"
                style={{ cursor: "pointer" }}
                onClick={() => onSelectShare(index)}
              />
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={18}
                style={{ cursor: "pointer" }}
                onClick={() => onSelectShare(index)}
              />
            </g>
          );
        })}

        {agents.map((agent, index) => {
          const position = positions[index];
          const state = tickSnapshot?.agent_states.find((entry) => entry.agent_id === agent.id);
          const belief = state?.belief ?? agent.initial_belief;
          const confidence = state?.confidence ?? agent.confidence;
          const color = ARCHETYPE_COLORS[agent.archetype] ?? "#ffffff";
          const selected = selectedAgentId === agent.id;
          const ringColor = beliefTone(belief);
          const radius = 26 + confidence * 10;

          return (
            <g key={agent.id} style={{ cursor: "pointer" }} onClick={() => onSelectAgent(agent.id)}>
              <circle
                cx={position.x}
                cy={position.y}
                r={radius + 10}
                fill="none"
                stroke={selected ? ringColor : `${color}55`}
                strokeWidth={selected ? 3 : 1}
                strokeOpacity={selected ? 0.85 : 0.35}
              />
              <circle
                cx={position.x}
                cy={position.y}
                r={radius}
                fill="rgba(9,14,21,0.92)"
                stroke={selected ? ringColor : color}
                strokeWidth={selected ? 3 : 2}
              />
              <text
                x={position.x}
                y={position.y - 3}
                textAnchor="middle"
                fontSize={15}
                fontFamily="var(--font-mono)"
                fill={selected ? ringColor : color}
                fontWeight="700"
              >
                {Math.round(belief * 100)}%
              </text>
              <text
                x={position.x}
                y={position.y + 13}
                textAnchor="middle"
                fontSize={8}
                fontFamily="var(--font-mono)"
                fill="#94a3b8"
                letterSpacing="1.2"
              >
                {ARCHETYPE_LABELS[agent.archetype].toUpperCase()}
              </text>
              <text
                x={position.x}
                y={position.y + radius + 18}
                textAnchor="middle"
                fontSize={11}
                fontFamily="var(--font-mono)"
                fill={selected ? "#f8fafc" : "#94a3b8"}
              >
                {agent.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function SocietyInspector({
  agents,
  tickSnapshot,
  selectedAgentId,
  selectedShareIndex,
}: {
  agents: AgentSummary[];
  tickSnapshot: TickSnapshot | null;
  selectedAgentId: string | null;
  selectedShareIndex: number | null;
}) {
  const selectedState = tickSnapshot?.agent_states.find(
    (entry) => entry.agent_id === selectedAgentId
  );
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const selectedShare =
    selectedShareIndex !== null ? (tickSnapshot?.claim_shares ?? [])[selectedShareIndex] : null;

  if (selectedShare) {
    return (
      <div className="rounded-[24px] border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.06)] p-4">
        <div className="eyebrow mb-2 text-[var(--accent)]">Claim in motion</div>
        <div className="mb-3 text-sm text-[var(--text-secondary)]">
          {selectedShare.from_agent_name} to {selectedShare.to_agent_name}
        </div>
        <p className="rounded-[18px] border border-white/8 bg-[rgba(9,14,21,0.55)] p-4 text-base leading-7 text-[var(--text-primary)]">
          {selectedShare.claim_text}
        </p>
        <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">
          {selectedShare.commentary}
        </p>
      </div>
    );
  }

  if (selectedAgent && selectedState) {
    const color = ARCHETYPE_COLORS[selectedAgent.archetype] ?? "#ffffff";
    return (
      <div className="rounded-[24px] border border-white/8 bg-[rgba(255,255,255,0.03)] p-4">
        <div className="mb-3 flex items-center gap-3">
          <div
            className="h-3 w-3 rounded-full"
            style={{ background: color, boxShadow: `0 0 10px ${color}66` }}
          />
          <div>
            <div className="text-base font-semibold text-[var(--text-bright)]">
              {selectedAgent.name}
            </div>
            <div className="ui-mono text-[11px] uppercase tracking-[0.16em]" style={{ color }}>
              {ARCHETYPE_LABELS[selectedAgent.archetype]}
            </div>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="ui-mono rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Belief {Math.round(selectedState.belief * 100)}%
          </span>
          <span className="ui-mono rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Confidence {Math.round(selectedState.confidence * 100)}%
          </span>
          <span className="ui-mono rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            {selectedState.action_taken === "share_claim" ? "Sharing" : "Updating"}
          </span>
        </div>
        <div className="eyebrow mb-2">Thinking right now</div>
        <p className="text-base leading-7 text-[var(--text-secondary)]">
          {selectedState.reasoning}
        </p>
        <div className="mt-4 border-t border-white/8 pt-4">
          <div className="eyebrow mb-2">Background</div>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            {selectedAgent.professional_background.title} at{" "}
            {selectedAgent.professional_background.company}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-white/8 bg-[rgba(255,255,255,0.03)] p-4">
      <div className="eyebrow mb-2">Inspector</div>
      <p className="text-base leading-7 text-[var(--text-secondary)]">
        Click an agent to inspect its current reasoning, or click a line to inspect the claim
        moving through the society on this tick.
      </p>
    </div>
  );
}
