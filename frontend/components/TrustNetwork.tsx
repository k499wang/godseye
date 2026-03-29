"use client";

import type { AgentSummary, TickSnapshot } from "@/lib/types";
import { ARCHETYPE_COLORS } from "@/lib/constants";

interface TrustNetworkProps {
  agents: AgentSummary[];
  tickSnapshot: TickSnapshot | null;
  size?: number;
  title?: string;
}

function getAgentPosition(index: number, total: number, radius: number, cx: number, cy: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function trustToOpacity(trust: number): number {
  return Math.max(0.05, Math.min(0.9, (trust - 0.3) / 0.7));
}

function trustToWidth(trust: number): number {
  return Math.max(0.5, trust * 2.5);
}

export function TrustNetwork({
  agents,
  tickSnapshot,
  size = 220,
  title = "TRUST NETWORK",
}: TrustNetworkProps) {
  const center = size / 2;
  const radius = Math.max(56, size * 0.33);

  // Build trust map from tick trust_updates + initial trust approximation
  // We'll use trust_updates to show the CURRENT state after this tick
  const trustUpdates = tickSnapshot?.trust_updates ?? [];

  // Build a map of agent positions
  const positions = agents.map((_, i) =>
    getAgentPosition(i, agents.length, radius, center, center)
  );

  // Build edges: draw from trust_updates if present, otherwise show skeleton
  const edges: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    trust: number;
    color: string;
  }[] = [];

  if (trustUpdates.length > 0) {
    trustUpdates.forEach((tu) => {
      const fromIdx = agents.findIndex((a) => a.id === tu.from_agent_id);
      const toIdx = agents.findIndex((a) => a.id === tu.to_agent_id);
      if (fromIdx === -1 || toIdx === -1) return;
      const from = agents[fromIdx];
      edges.push({
        x1: positions[fromIdx].x,
        y1: positions[fromIdx].y,
        x2: positions[toIdx].x,
        y2: positions[toIdx].y,
        trust: tu.new_trust,
        color: ARCHETYPE_COLORS[from.archetype] ?? "#ffffff",
      });
    });
  } else {
    // Show light skeleton edges between all adjacent agents
    agents.forEach((agent, i) => {
      const next = (i + 1) % agents.length;
      edges.push({
        x1: positions[i].x,
        y1: positions[i].y,
        x2: positions[next].x,
        y2: positions[next].y,
        trust: 0.15,
        color: "#374151",
      });
    });
  }

  // Faction clusters
  const factionClusters = tickSnapshot?.faction_clusters ?? [];

  return (
    <div className="flex flex-col items-center">
      <div className="font-mono text-[9px] tracking-widest text-[#374151] mb-2">
        {title}
      </div>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="4"
            markerHeight="4"
            refX="2"
            refY="2"
            orient="auto"
          >
            <polygon points="0 0, 4 2, 0 4" fill="rgba(245,158,11,0.4)" />
          </marker>
        </defs>

        {/* Faction rings */}
        {factionClusters.map((cluster, ci) => {
          const clusterPositions = cluster
            .map((id) => {
              const idx = agents.findIndex((a) => a.id === id);
              return idx >= 0 ? positions[idx] : null;
            })
            .filter(Boolean) as { x: number; y: number }[];

          if (clusterPositions.length < 2) return null;

          // Draw a subtle convex hull approximation (just connect cluster positions)
          const cx =
            clusterPositions.reduce((s, p) => s + p.x, 0) / clusterPositions.length;
          const cy =
            clusterPositions.reduce((s, p) => s + p.y, 0) / clusterPositions.length;

          return (
            <circle
              key={ci}
              cx={cx}
              cy={cy}
              r={28}
              fill={`rgba(245,158,11,0.04)`}
              stroke={`rgba(245,158,11,0.12)`}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Trust edges */}
        {edges.map((edge, i) => (
          <line
            key={i}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke={edge.color}
            strokeWidth={trustToWidth(edge.trust)}
            strokeOpacity={trustToOpacity(edge.trust)}
            markerEnd={edge.trust > 0.5 ? "url(#arrowhead)" : undefined}
          />
        ))}

        {/* Agent nodes */}
        {agents.map((agent, i) => {
          const pos = positions[i];
          const color = ARCHETYPE_COLORS[agent.archetype] ?? "#ffffff";
          const tickState = tickSnapshot?.agent_states.find(
            (s) => s.agent_id === agent.id
          );
          const belief = tickState?.belief ?? agent.initial_belief;

          // Node radius scales with belief
          const nodeR = 7 + belief * 4;

          return (
            <g key={agent.id}>
              {/* Belief halo */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={nodeR + 4}
                fill="none"
                stroke={color}
                strokeWidth={0.5}
                strokeOpacity={0.2}
              />
              {/* Node */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={nodeR}
                fill={`${color}22`}
                stroke={color}
                strokeWidth={1.5}
              />
              {/* Belief text */}
              <text
                x={pos.x}
                y={pos.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={8}
                fontFamily="var(--font-mono)"
                fill={color}
                fontWeight="600"
              >
                {Math.round(belief * 100)}
              </text>
              {/* Name label */}
              <text
                x={pos.x}
                y={pos.y + nodeR + 8}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={7}
                fontFamily="var(--font-mono)"
                fill="#6b7280"
              >
                {agent.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Faction legend */}
      {factionClusters.length > 0 && (
        <div className="mt-2 font-mono text-[9px] text-[#4b5563]">
          {factionClusters.length} FACTION{factionClusters.length > 1 ? "S" : ""} DETECTED
        </div>
      )}
    </div>
  );
}
