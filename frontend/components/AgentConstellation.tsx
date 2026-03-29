"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { AgentSummary, TickSnapshot } from "@/lib/types";
import { ARCHETYPE_COLORS, ARCHETYPE_LABELS } from "@/lib/constants";

interface AgentConstellationProps {
  agents: AgentSummary[];
  tickData: TickSnapshot[];
  currentTick: number;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
}

type GraphNode = d3.SimulationNodeDatum & {
  id: string;
  name: string;
  archetype: string;
  belief: number;
  confidence: number;
  delta: number;
  radius: number;
  isSelected: boolean;
  isActive: boolean;
  targetX: number;
  targetY: number;
};

type GraphLink = d3.SimulationLinkDatum<GraphNode> & {
  id: string;
  kind: "trust" | "share" | "ambient";
  strength: number;
  label: string;
  isHighlighted: boolean;
  color: string;
  secondaryColor?: string;
};

const SCENE_W = 1420;
const SCENE_H = 860;
const TICK_MOTION_MS = 650;

function shortName(name: string): string {
  return name.split(" ")[0] ?? name;
}

function hash(value: string): number {
  let acc = 0;
  for (let index = 0; index < value.length; index += 1) {
    acc = (acc * 33 + value.charCodeAt(index)) % 100003;
  }
  return acc;
}

function seededUnit(seed: string): number {
  return (hash(seed) % 1000) / 1000;
}

function clip(text: string, limit: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 3)}...` : normalized;
}

function resolveNode(endpoint: string | number | GraphNode): GraphNode | null {
  return typeof endpoint === "object" ? endpoint : null;
}

function curveMetrics(link: GraphLink): {
  path: string;
  source: GraphNode;
  target: GraphNode;
  cx: number;
  cy: number;
  length: number;
} | null {
  const source = resolveNode(link.source);
  const target = resolveNode(link.target);
  if (!source || !target) return null;

  const dx = (target.x ?? 0) - (source.x ?? 0);
  const dy = (target.y ?? 0) - (source.y ?? 0);
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const curvature = link.kind === "share" ? Math.min(72, length * 0.18) : Math.min(34, length * 0.1);
  const mx = ((source.x ?? 0) + (target.x ?? 0)) / 2;
  const my = ((source.y ?? 0) + (target.y ?? 0)) / 2;
  const cx = mx - (dy / length) * curvature;
  const cy = my + (dx / length) * curvature;

  return {
    path: `M ${source.x ?? 0} ${source.y ?? 0} Q ${cx} ${cy} ${target.x ?? 0} ${target.y ?? 0}`,
    source,
    target,
    cx,
    cy,
    length,
  };
}

function labelPosition(link: GraphLink): { x: number; y: number } | null {
  const metrics = curveMetrics(link);
  if (!metrics) return null;
  return {
    x: 0.25 * (metrics.source.x ?? 0) + 0.5 * metrics.cx + 0.25 * (metrics.target.x ?? 0),
    y: 0.25 * (metrics.source.y ?? 0) + 0.5 * metrics.cy + 0.25 * (metrics.target.y ?? 0),
  };
}

function beliefTone(value: number): string {
  if (value >= 0.65) return "#34d399";
  if (value >= 0.5) return "#f59e0b";
  return "#fb7185";
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentConstellation({
  agents,
  tickData,
  currentTick,
  selectedAgentId,
  onSelectAgent,
}: AgentConstellationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1240);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const snapshots = useMemo(
    () => tickData.filter((snapshot) => snapshot.tick <= currentTick),
    [currentTick, tickData]
  );

  const currentSnapshot = snapshots[snapshots.length - 1] ?? null;
  const previousSnapshot = snapshots[snapshots.length - 2] ?? null;

  const stateById = useMemo(() => {
    const currentStates = new Map(
      (currentSnapshot?.agent_states ?? []).map((state) => [state.agent_id, state])
    );
    const previousStates = new Map(
      (previousSnapshot?.agent_states ?? []).map((state) => [state.agent_id, state])
    );
    return new Map(
      agents.map((agent) => {
        const currentState = currentStates.get(agent.id);
        const previousState = previousStates.get(agent.id);
        const belief = currentState?.belief ?? agent.current_belief ?? agent.initial_belief;
        const previousBelief = previousState?.belief ?? agent.initial_belief;
        return [
          agent.id,
          {
            belief,
            confidence: currentState?.confidence ?? agent.confidence,
            delta: belief - previousBelief,
            isSharing: currentState?.action_taken === "share_claim",
            reasoning: currentState?.reasoning ?? "",
            action: currentState?.action_taken ?? "update_belief",
          },
        ];
      })
    );
  }, [agents, currentSnapshot, previousSnapshot]);

  const activeShares = currentSnapshot?.claim_shares ?? [];

  // ---- Layout computation (d3 force simulation) ----
  const layout = useMemo(() => {
    const nodes: GraphNode[] = agents.map((agent) => {
      const state = stateById.get(agent.id);
      const belief = state?.belief ?? agent.initial_belief;
      const confidence = state?.confidence ?? agent.confidence;
      const orbit = 180 + belief * 240 + seededUnit(`${agent.id}-orbit`) * 120;
      const angle = seededUnit(`${agent.id}-angle`) * Math.PI * 2;
      const drift = (confidence - 0.5) * 220;
      const targetX = SCENE_W / 2 + Math.cos(angle) * orbit + (belief - 0.5) * 260;
      const targetY = SCENE_H / 2 + Math.sin(angle) * (orbit * 0.48) - drift;
      return {
        id: agent.id,
        name: agent.name,
        archetype: agent.archetype,
        belief,
        confidence,
        delta: state?.delta ?? 0,
        radius: selectedAgentId === agent.id ? 14 : state?.isSharing ? 11 : 9,
        isSelected: selectedAgentId === agent.id,
        isActive:
          state?.isSharing === true ||
          activeShares.some((share) => share.from_agent_id === agent.id || share.to_agent_id === agent.id),
        targetX,
        targetY,
        x: targetX,
        y: targetY,
      };
    });

    // Build trust links from trust_updates across snapshots
    const trustMap = new Map<string, GraphLink>();
    for (const snapshot of snapshots) {
      for (const update of snapshot.trust_updates) {
        const sourceAgent = agents.find((agent) => agent.id === update.from_agent_id);
        trustMap.set(`${update.from_agent_id}:${update.to_agent_id}`, {
          id: `trust-${update.from_agent_id}-${update.to_agent_id}`,
          source: update.from_agent_id,
          target: update.to_agent_id,
          kind: "trust",
          strength: Math.max(0.12, Math.min(update.new_trust, 0.95)),
          label: `${Math.round(update.new_trust * 100)} trust`,
          isHighlighted:
            selectedAgentId === update.from_agent_id || selectedAgentId === update.to_agent_id,
          color: sourceAgent ? ARCHETYPE_COLORS[sourceAgent.archetype] : "#94a3b8",
        });
      }
    }

    // Build share links from current tick
    const shareLinks: GraphLink[] = activeShares.map((share, index) => {
      const sourceAgent = agents.find((agent) => agent.id === share.from_agent_id);
      const targetAgent = agents.find((agent) => agent.id === share.to_agent_id);
      return {
        id: `share-${share.from_agent_id}-${share.to_agent_id}-${index}`,
        source: share.from_agent_id,
        target: share.to_agent_id,
        kind: "share",
        strength: 1,
        label: clip(share.claim_text, 42),
        isHighlighted:
          selectedAgentId === share.from_agent_id || selectedAgentId === share.to_agent_id,
        color: sourceAgent ? ARCHETYPE_COLORS[sourceAgent.archetype] : "#1d4ed8",
        secondaryColor: targetAgent ? ARCHETYPE_COLORS[targetAgent.archetype] : "#0f172a",
      };
    });

    const links: GraphLink[] = [...trustMap.values(), ...shareLinks];

    // Add subtle ambient links when graph is sparse (early ticks)
    if (links.length < Math.max(agents.length, 8)) {
      const ambientLinks = new Map<string, GraphLink>();
      for (const source of nodes) {
        const neighbors = nodes
          .filter((target) => target.id !== source.id)
          .map((target) => ({
            target,
            score: Math.abs(source.belief - target.belief) * 0.7 + Math.abs(source.confidence - target.confidence) * 0.3,
          }))
          .sort((a, b) => a.score - b.score)
          .slice(0, 2);
        for (const neighbor of neighbors) {
          const pair = [source.id, neighbor.target.id].sort().join(":");
          if (ambientLinks.has(pair)) continue;
          ambientLinks.set(pair, {
            id: `ambient-${pair}`,
            source: source.id,
            target: neighbor.target.id,
            kind: "ambient",
            strength: Math.max(0.35, 1 - neighbor.score),
            label: "",
            isHighlighted: selectedAgentId === source.id || selectedAgentId === neighbor.target.id,
            color: "rgba(148,163,184,0.5)",
          });
        }
      }
      links.push(...ambientLinks.values());
    }

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((node) => node.id)
          .distance((link) => (link.kind === "share" ? 118 : link.kind === "ambient" ? 154 : 176))
          .strength((link) => (link.kind === "share" ? 0.64 : link.kind === "ambient" ? 0.2 : 0.18 + link.strength * 0.22))
      )
      .force("charge", d3.forceManyBody().strength(-420))
      .force("center", d3.forceCenter(SCENE_W / 2, SCENE_H / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((node) => node.radius + 44))
      .force("x", d3.forceX<GraphNode>((node) => node.targetX).strength(0.14))
      .force("y", d3.forceY<GraphNode>((node) => node.targetY).strength(0.14))
      .force("radial", d3.forceRadial(260, SCENE_W / 2, SCENE_H / 2).strength(0.02))
      .stop();

    for (let index = 0; index < 320; index += 1) simulation.tick();

    return { nodes, links };
  }, [activeShares, agents, selectedAgentId, snapshots, stateById]);

  // ---- Animation ----
  const [animatedNodes, setAnimatedNodes] = useState<GraphNode[]>(layout.nodes);

  useEffect(() => {
    setAnimatedNodes((previousNodes) => {
      if (previousNodes.length === 0) return layout.nodes;
      const previousById = new Map(previousNodes.map((node) => [node.id, node]));
      return layout.nodes.map((node) => {
        const previous = previousById.get(node.id);
        return previous ? { ...node, x: previous.x ?? node.x, y: previous.y ?? node.y } : node;
      });
    });
  }, [layout.nodes]);

  useEffect(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);

    const previousById = new Map(animatedNodes.map((node) => [node.id, node]));
    const targets = layout.nodes.map((node) => {
      const previous = previousById.get(node.id);
      return {
        id: node.id,
        fromX: previous?.x ?? node.x ?? node.targetX,
        fromY: previous?.y ?? node.y ?? node.targetY,
        toX: node.x ?? node.targetX,
        toY: node.y ?? node.targetY,
      };
    });

    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / TICK_MOTION_MS);
      const eased = easeInOutCubic(progress);
      setAnimatedNodes(
        layout.nodes.map((node) => {
          const target = targets.find((entry) => entry.id === node.id);
          if (!target) return node;
          return {
            ...node,
            x: target.fromX + (target.toX - target.fromX) * eased,
            y: target.fromY + (target.toY - target.fromY) * eased,
          };
        })
      );
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [layout.nodes]);

  // ---- Rendered links (use animated node positions) ----
  const renderedLinks = useMemo(
    () =>
      layout.links.map((link) => {
        const sourceId = typeof link.source === "object" ? link.source.id : String(link.source);
        const targetId = typeof link.target === "object" ? link.target.id : String(link.target);
        return {
          ...link,
          source: animatedNodes.find((node) => node.id === sourceId) ?? link.source,
          target: animatedNodes.find((node) => node.id === targetId) ?? link.target,
        };
      }),
    [animatedNodes, layout.links]
  );

  const selectedNode = animatedNodes.find((node) => node.id === selectedAgentId) ?? animatedNodes[0] ?? null;
  const selectedState = selectedNode ? stateById.get(selectedNode.id) : null;
  const renderedHeight = Math.max(640, containerWidth * (SCENE_H / SCENE_W));

  if (!agents.length) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-[28px] border border-[rgba(255,255,255,0.08)] bg-[rgba(12,16,26,0.82)]">
        <div className="ui-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-subtle)]">
          No agents loaded
        </div>
      </div>
    );
  }

  // ---- Render ----
  return (
    <div className="rounded-[30px] border border-[rgba(255,255,255,0.08)] bg-[rgba(12,16,26,0.82)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-[26px] border border-[rgba(255,255,255,0.06)] bg-[radial-gradient(ellipse_at_20%_15%,rgba(245,158,11,0.08),transparent_40%),radial-gradient(ellipse_at_80%_20%,rgba(59,130,246,0.06),transparent_40%),linear-gradient(180deg,rgba(8,11,18,0.99)_0%,rgba(5,7,13,0.99)_100%)]"
      >
        <svg width="100%" height={renderedHeight} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="block">
          <defs>
            <radialGradient id="star-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
            </radialGradient>
            <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Share link gradients */}
            {renderedLinks
              .filter((link) => link.kind === "share")
              .map((link) => (
                <linearGradient key={`gradient-${link.id}`} id={`gradient-${link.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={link.color} />
                  <stop offset="50%" stopColor="#fde68a" stopOpacity="0.7" />
                  <stop offset="100%" stopColor={link.secondaryColor ?? link.color} />
                </linearGradient>
              ))}
            {/* Share link arrow markers */}
            {renderedLinks
              .filter((link) => link.kind === "share")
              .map((link) => (
                <marker key={`marker-${link.id}`} id={`marker-${link.id}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill={link.secondaryColor ?? link.color} opacity="0.8" />
                </marker>
              ))}
          </defs>

          {/* Background stars */}
          {Array.from({ length: 55 }).map((_, index) => (
            <circle
              key={`star-${index}`}
              cx={seededUnit(`star-x-${index}`) * SCENE_W}
              cy={seededUnit(`star-y-${index}`) * SCENE_H}
              r={0.5 + seededUnit(`star-r-${index}`) * 1.2}
              fill="url(#star-glow)"
              opacity={0.2 + seededUnit(`star-o-${index}`) * 0.35}
            />
          ))}

          {/* Links */}
          <g>
            {renderedLinks.map((link) => {
              const metrics = curveMetrics(link);
              if (!metrics) return null;
              const labelPos = labelPosition(link);

              if (link.kind === "ambient") {
                return (
                  <path
                    key={link.id}
                    d={metrics.path}
                    fill="none"
                    stroke="rgba(148,163,184,0.15)"
                    strokeWidth={link.isHighlighted ? 1.4 : 0.8}
                    strokeOpacity={link.isHighlighted ? 0.4 : 0.2}
                    strokeDasharray="4 6"
                    strokeLinecap="round"
                  />
                );
              }

              if (link.kind === "trust") {
                return (
                  <g key={link.id}>
                    <path
                      d={metrics.path}
                      fill="none"
                      stroke={link.isHighlighted ? link.color : "rgba(148,163,184,0.5)"}
                      strokeWidth={link.isHighlighted ? 2.4 : 1.2 + link.strength * 1.2}
                      strokeOpacity={link.isHighlighted ? 0.7 : 0.25}
                      strokeLinecap="round"
                    />
                    {link.isHighlighted && (
                      <circle r="2" fill={link.color} opacity="0.7">
                        <animateMotion dur="2.8s" repeatCount="indefinite" path={metrics.path} />
                      </circle>
                    )}
                  </g>
                );
              }

              // Share links — the prominent ones
              return (
                <g key={link.id}>
                  {/* Glow behind share path */}
                  <path
                    d={metrics.path}
                    fill="none"
                    stroke="rgba(245,158,11,0.15)"
                    strokeWidth={10}
                    strokeOpacity={0.2}
                    filter="url(#soft-glow)"
                  />
                  {/* Main share path */}
                  <path
                    d={metrics.path}
                    fill="none"
                    stroke={`url(#gradient-${link.id})`}
                    strokeWidth={link.isHighlighted ? 3.5 : 2.8}
                    strokeOpacity={link.isHighlighted ? 1 : 0.85}
                    markerEnd={`url(#marker-${link.id})`}
                    strokeLinecap="round"
                    className="constellation-share-path"
                  />
                  {/* Animated particles */}
                  <circle r="3" fill={link.color} filter="url(#soft-glow)">
                    <animateMotion dur="1.9s" repeatCount="indefinite" path={metrics.path} />
                  </circle>
                  <circle r="2" fill={link.secondaryColor ?? link.color} opacity="0.85">
                    <animateMotion dur="1.9s" begin="0.55s" repeatCount="indefinite" path={metrics.path} />
                  </circle>
                  {/* Claim text label */}
                  {link.isHighlighted && labelPos && (
                    <g transform={`translate(${labelPos.x}, ${labelPos.y})`}>
                      <rect
                        x={-(Math.max(80, link.label.length * 6) / 2)}
                        y="-12"
                        width={Math.max(80, link.label.length * 6)}
                        height="24"
                        rx="12"
                        fill="rgba(8,11,18,0.94)"
                        stroke="rgba(245,158,11,0.25)"
                      />
                      <text textAnchor="middle" dominantBaseline="central" fontSize="10" fontFamily="var(--font-mono)" fill="#dbe5f2" letterSpacing="0.02em">
                        {link.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {animatedNodes.map((node) => {
              const nodeColor = ARCHETYPE_COLORS[node.archetype] ?? "#94a3b8";
              const label = shortName(node.name);
              const nodeX = node.x ?? SCENE_W / 2;
              const nodeY = node.y ?? SCENE_H / 2;

              return (
                <g
                  key={node.id}
                  transform={`translate(${nodeX}, ${nodeY})`}
                  onClick={() => onSelectAgent(node.id)}
                  style={{ cursor: "pointer" }}
                  className="constellation-node-group"
                >
                  {/* Selection ring */}
                  {node.isSelected && (
                    <circle r={node.radius + 9} fill="none" stroke={nodeColor} strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="4 3" />
                  )}
                  {/* Active pulse */}
                  {node.isActive && (
                    <circle r={node.radius + 16} fill="none" stroke={nodeColor} strokeOpacity="0.2" className="constellation-node-pulse" />
                  )}
                  {/* Soft glow */}
                  <circle
                    r={node.radius + (node.isActive ? 4 : 2)}
                    fill={nodeColor}
                    opacity={node.isSelected ? 0.18 : node.isActive ? 0.12 : 0.06}
                  />
                  {/* Main circle */}
                  <circle
                    r={node.radius}
                    fill="rgba(7,9,17,0.94)"
                    stroke={nodeColor}
                    strokeWidth={node.isSelected ? 2.5 : 1.5}
                  />
                  {/* Inner dot */}
                  <circle
                    r={Math.max(3, node.radius - 4)}
                    fill={nodeColor}
                    opacity={0.9}
                    filter={node.isActive ? "url(#soft-glow)" : undefined}
                  />

                  {/* Name below node */}
                  <text
                    y={node.radius + 16}
                    textAnchor="middle"
                    fontSize="11.5"
                    fontWeight="600"
                    fill={node.isSelected ? "#f8fafc" : "#cbd5e1"}
                    stroke="rgba(5,7,13,0.85)"
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {label}
                  </text>
                  {/* Belief below name */}
                  <text
                    y={node.radius + 30}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="var(--font-mono)"
                    fill={beliefTone(node.belief)}
                    stroke="rgba(5,7,13,0.85)"
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {Math.round(node.belief * 100)}%
                    {node.delta !== 0 && (
                      <tspan fill={node.delta > 0 ? "#34d399" : "#fb7185"} fontSize="9">
                        {" "}{node.delta > 0 ? "\u25B2" : "\u25BC"}
                      </tspan>
                    )}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend — top left: link types */}
        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
          <LinkLegendChip label="Trust" color="#94a3b8" />
          <LinkLegendChip label="Claim share" color="#f59e0b" animated />
        </div>

        {/* Legend — bottom left: archetypes */}
        <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap items-center gap-1.5">
          {Object.entries(ARCHETYPE_LABELS).map(([key, label]) => (
            <ArchetypeChip key={key} label={label} color={ARCHETYPE_COLORS[key]} />
          ))}
        </div>

        {/* Selected agent info card — top right */}
        {selectedNode && (
          <div className="pointer-events-none absolute right-4 top-4 w-[280px] rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(7,9,17,0.88)] px-4 py-3 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: ARCHETYPE_COLORS[selectedNode.archetype] ?? "#94a3b8" }}
              />
              <span className="text-[14px] font-semibold text-[var(--text-bright)]">{selectedNode.name}</span>
              <span
                className="ui-mono ml-auto text-[10px] uppercase tracking-[0.12em]"
                style={{ color: ARCHETYPE_COLORS[selectedNode.archetype] ?? "var(--text-muted)" }}
              >
                {ARCHETYPE_LABELS[selectedNode.archetype]}
              </span>
            </div>

            <div className="mb-2.5 grid grid-cols-3 gap-2">
              <MiniStat label="Belief" value={`${Math.round(selectedNode.belief * 100)}%`} color={beliefTone(selectedNode.belief)} />
              <MiniStat
                label="Delta"
                value={`${selectedNode.delta >= 0 ? "+" : ""}${Math.round(selectedNode.delta * 100)}pt`}
                color={selectedNode.delta >= 0 ? "#34d399" : "#fb7185"}
              />
              <MiniStat label="Conf" value={`${Math.round(selectedNode.confidence * 100)}%`} color="var(--text-primary)" />
            </div>

            {selectedState?.reasoning && (
              <div className="border-t border-[rgba(255,255,255,0.06)] pt-2">
                <div className="ui-mono mb-1 text-[9px] uppercase tracking-[0.14em] text-[var(--text-subtle)]">
                  {selectedState.action === "share_claim" ? "Shared claim" : "Updated belief"}
                </div>
                <p className="line-clamp-3 text-[11px] leading-[1.5] italic text-[var(--text-secondary)]">
                  &ldquo;{selectedState.reasoning}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-2.5 py-2">
      <div className="mb-0.5 ui-mono text-[9px] uppercase tracking-[0.12em] text-[var(--text-subtle)]">{label}</div>
      <div className="ui-mono text-[14px] font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}

function LinkLegendChip({ label, color, animated = false }: { label: string; color: string; animated?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(7,9,17,0.8)] px-2.5 py-1 backdrop-blur-sm">
      <span
        className="block h-[2px] w-4 rounded-full"
        style={{ background: color, opacity: animated ? 1 : 0.6 }}
      />
      {animated && (
        <span className="block h-1.5 w-1.5 rounded-full" style={{ background: color, animation: "pulse 1.4s ease-in-out infinite" }} />
      )}
      <span className="ui-mono text-[9px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</span>
    </div>
  );
}

function ArchetypeChip({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(7,9,17,0.8)] px-2 py-0.5 backdrop-blur-sm">
      <span className="block h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="ui-mono text-[8.5px] uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}</span>
    </div>
  );
}
