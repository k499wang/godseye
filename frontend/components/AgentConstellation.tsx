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
const SCENE_H = 940;
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
  const previousLayoutRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const transitionRef = useRef<{
    from: Map<string, { x: number; y: number }>;
    to: Map<string, { x: number; y: number }>;
  }>({
    from: new Map(),
    to: new Map(),
  });
  const [transitionProgress, setTransitionProgress] = useState(1);

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
          },
        ];
      })
    );
  }, [agents, currentSnapshot, previousSnapshot]);

  const activeShares = currentSnapshot?.claim_shares ?? [];

  const layout = useMemo(() => {
    const nodes: GraphNode[] = agents.map((agent) => {
      const state = stateById.get(agent.id);
      const previousLayout = previousLayoutRef.current.get(agent.id);
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
        x: previousLayout?.x ?? targetX,
        y: previousLayout?.y ?? targetY,
      };
    });

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

    if (links.length < Math.max(agents.length, 8)) {
      const ambientLinks = new Map<string, GraphLink>();
      for (const source of nodes) {
        const neighbors = nodes
          .filter((target) => target.id !== source.id)
          .map((target) => {
            const beliefGap = Math.abs(source.belief - target.belief);
            const confidenceGap = Math.abs(source.confidence - target.confidence);
            return {
              target,
              score: beliefGap * 0.7 + confidenceGap * 0.3,
            };
          })
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
            color: "rgba(148,163,184,0.92)",
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
      .force("collision", d3.forceCollide<GraphNode>().radius((node) => node.radius + 62))
      .force("x", d3.forceX<GraphNode>((node) => node.targetX).strength(0.14))
      .force("y", d3.forceY<GraphNode>((node) => node.targetY).strength(0.14))
      .force("radial", d3.forceRadial(260, SCENE_W / 2, SCENE_H / 2).strength(0.02))
      .stop();

    for (let index = 0; index < 320; index += 1) simulation.tick();

    return { nodes, links };
  }, [activeShares, agents, selectedAgentId, snapshots, stateById]);

  useEffect(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);

    const to = new Map(
      layout.nodes.map((node) => [node.id, { x: node.x ?? node.targetX, y: node.y ?? node.targetY }])
    );
    const from =
      previousLayoutRef.current.size > 0 ? new Map(previousLayoutRef.current) : new Map(to);

    transitionRef.current = { from, to };
    setTransitionProgress(0);

    const start = performance.now();

    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / TICK_MOTION_MS);
      const eased = easeInOutCubic(progress);
      setTransitionProgress(eased);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        previousLayoutRef.current = new Map(to);
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

  const animatedNodes = useMemo(() => {
    const { from, to } = transitionRef.current;
    return layout.nodes.map((node) => {
      const fromPoint = from.get(node.id) ?? { x: node.x ?? node.targetX, y: node.y ?? node.targetY };
      const toPoint = to.get(node.id) ?? { x: node.x ?? node.targetX, y: node.y ?? node.targetY };
      return {
        ...node,
        x: fromPoint.x + (toPoint.x - fromPoint.x) * transitionProgress,
        y: fromPoint.y + (toPoint.y - fromPoint.y) * transitionProgress,
      };
    });
  }, [layout.nodes, transitionProgress]);

  const renderedLinks = useMemo(
    () =>
      layout.links.map((link) => {
        const sourceId =
          typeof link.source === "object" ? link.source.id : String(link.source);
        const targetId =
          typeof link.target === "object" ? link.target.id : String(link.target);
        return {
          ...link,
          source: animatedNodes.find((node) => node.id === sourceId) ?? link.source,
          target: animatedNodes.find((node) => node.id === targetId) ?? link.target,
        };
      }),
    [animatedNodes, layout.links]
  );

  const selectedNode =
    animatedNodes.find((node) => node.id === selectedAgentId) ?? animatedNodes[0] ?? null;
  const renderedHeight = Math.max(680, containerWidth * (SCENE_H / SCENE_W));

  if (!agents.length) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-[28px] border border-[rgba(255,255,255,0.08)] bg-[rgba(12,16,26,0.82)]">
        <div className="ui-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-subtle)]">
          No agents loaded
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[30px] border border-[rgba(255,255,255,0.08)] bg-[rgba(12,16,26,0.82)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-[26px] border border-[rgba(255,255,255,0.08)] bg-[radial-gradient(circle_at_18%_12%,rgba(245,158,11,0.16),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(59,130,246,0.12),transparent_34%),linear-gradient(180deg,rgba(13,17,26,0.98)_0%,rgba(6,9,16,0.98)_100%)]"
      >
        <svg width="100%" height={renderedHeight} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="block">
          <defs>
            <radialGradient id="star-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef3c7" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
            <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="network-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="14" result="networkBlur" />
              <feColorMatrix
                in="networkBlur"
                type="matrix"
                values="1 0 0 0 0
                        0 1 0 0 0
                        0 0 1 0 0
                        0 0 0 0.55 0"
              />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {renderedLinks.map((link) => (
              <linearGradient
                key={`line-${link.id}`}
                id={`line-${link.id}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor={link.color} stopOpacity={link.kind === "share" ? 1 : 0.16} />
                <stop offset="50%" stopColor={link.kind === "share" ? "#fde68a" : link.color} stopOpacity={link.kind === "share" ? 0.78 : 0.3} />
                <stop offset="100%" stopColor={link.secondaryColor ?? link.color} stopOpacity={link.kind === "share" ? 1 : 0.16} />
              </linearGradient>
            ))}
            {renderedLinks
              .filter((link) => link.kind === "share")
              .map((link) => (
                <linearGradient
                  key={`gradient-${link.id}`}
                  id={`gradient-${link.id}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor={link.color} />
                  <stop offset="100%" stopColor={link.secondaryColor ?? link.color} />
                </linearGradient>
              ))}
            {renderedLinks
              .filter((link) => link.kind === "share")
              .map((link) => (
                <marker
                  key={`marker-${link.id}`}
                  id={`marker-${link.id}`}
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 z" fill={link.secondaryColor ?? link.color} />
                </marker>
              ))}
          </defs>

          {Array.from({ length: 180 }).map((_, index) => {
            const x = seededUnit(`star-x-${index}`) * SCENE_W;
            const y = seededUnit(`star-y-${index}`) * SCENE_H;
            const r = 0.6 + seededUnit(`star-r-${index}`) * 1.8;
            return (
              <circle
                key={`star-${index}`}
                cx={x}
                cy={y}
                r={r}
                fill="url(#star-glow)"
                opacity={0.35 + seededUnit(`star-o-${index}`) * 0.5}
              />
            );
          })}

          <g>
            {renderedLinks.map((link) => {
              const metrics = curveMetrics(link);
              if (!metrics) return null;
              const labelPos = labelPosition(link);

              return (
                <g key={link.id}>
                  <path
                    d={metrics.path}
                    fill="none"
                    stroke={
                      link.kind === "share"
                        ? "rgba(245,158,11,0.24)"
                        : link.kind === "ambient"
                          ? "rgba(148,163,184,0.12)"
                          : "rgba(148,163,184,0.18)"
                    }
                    strokeWidth={link.kind === "share" ? 14 : link.kind === "ambient" ? 5 : link.isHighlighted ? 9 : 7}
                    strokeOpacity={link.kind === "share" ? 0.22 : link.kind === "ambient" ? 0.12 : link.isHighlighted ? 0.24 : 0.16}
                    filter="url(#network-glow)"
                  />
                  <path
                    d={metrics.path}
                    fill="none"
                    stroke={
                      link.kind === "share"
                        ? `url(#line-${link.id})`
                        : link.kind === "ambient"
                          ? "rgba(148,163,184,0.42)"
                          : link.isHighlighted
                            ? "#cbd5e1"
                            : "rgba(148,163,184,0.88)"
                    }
                    strokeWidth={
                      link.kind === "share"
                        ? link.isHighlighted
                          ? 4.5
                          : 3.6
                        : link.kind === "ambient"
                          ? link.isHighlighted
                            ? 2.8
                            : 1.6
                        : link.isHighlighted
                          ? 3.4
                          : 2.2 + link.strength * 2.2
                    }
                    strokeOpacity={
                      link.kind === "share"
                        ? link.isHighlighted
                          ? 1
                          : 0.92
                        : link.kind === "ambient"
                          ? link.isHighlighted
                            ? 0.52
                            : 0.3
                        : link.isHighlighted
                          ? 0.96
                          : 0.72
                    }
                    markerEnd={link.kind === "share" ? `url(#marker-${link.id})` : undefined}
                    strokeLinecap="round"
                    filter={link.kind === "share" ? "url(#soft-glow)" : "url(#soft-glow)"}
                    className={link.kind === "share" ? "constellation-share-path" : undefined}
                  />
                  {link.kind === "share" && (
                    <>
                      <circle r="3.5" fill={link.color} filter="url(#soft-glow)">
                        <animateMotion dur="1.9s" repeatCount="indefinite" path={metrics.path} />
                      </circle>
                      <circle r="2.2" fill={link.secondaryColor ?? link.color} opacity="0.9">
                        <animateMotion dur="1.9s" begin="0.55s" repeatCount="indefinite" path={metrics.path} />
                      </circle>
                    </>
                  )}
                  {link.kind === "trust" && link.isHighlighted && (
                    <circle r="2.4" fill={link.color} opacity="0.75">
                      <animateMotion dur="2.8s" repeatCount="indefinite" path={metrics.path} />
                    </circle>
                  )}
                  {link.kind === "share" && labelPos && (
                    <g transform={`translate(${labelPos.x}, ${labelPos.y})`}>
                      <rect
                        x={-(Math.max(90, link.label.length * 6.5) / 2)}
                        y="-13"
                        width={Math.max(90, link.label.length * 6.5)}
                        height="26"
                        rx="13"
                        fill="rgba(8,11,18,0.92)"
                        stroke={link.isHighlighted ? "rgba(245,158,11,0.32)" : "rgba(255,255,255,0.08)"}
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="11"
                        fontFamily="var(--font-mono)"
                        fill="#dbe5f2"
                        letterSpacing="0.02em"
                      >
                        {link.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          <g>
            {animatedNodes.map((node) => {
              const nodeColor = ARCHETYPE_COLORS[node.archetype] ?? "#0f172a";
              const label = shortName(node.name);
              const labelWidth = Math.max(84, label.length * 8 + 44);
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
                  {node.isSelected && (
                    <circle r={node.radius + 11} fill={nodeColor} opacity="0.12" />
                  )}
                  {node.isActive && (
                    <circle r={node.radius + 18} fill="none" stroke={nodeColor} strokeOpacity="0.22" className="constellation-node-pulse" />
                  )}
                  <circle
                    r={node.radius + (node.isActive ? 5 : 2)}
                    fill={nodeColor}
                    opacity={node.isActive ? 0.16 : 0.08}
                  />
                  <circle
                    r={node.radius}
                    fill="rgba(7,9,17,0.96)"
                    stroke={nodeColor}
                    strokeWidth={node.isSelected ? 3 : 2}
                  />
                  <circle
                    r={Math.max(3.5, node.radius - 5)}
                    fill={nodeColor}
                    filter={node.isActive ? "url(#soft-glow)" : undefined}
                  />

                  <g transform={`translate(${node.radius + 12}, -16)`}>
                    <rect
                      width={labelWidth}
                      height="34"
                      rx="17"
                      fill="rgba(7,9,17,0.88)"
                      stroke={node.isSelected ? "rgba(245,158,11,0.34)" : "rgba(255,255,255,0.08)"}
                    />
                    <circle cx="14" cy="17" r="4" fill={nodeColor} />
                    <text x="24" y="14" fontSize="12" fontWeight="600" fill="#f8fafc">
                      {label}
                    </text>
                    <text x={labelWidth - 10} y="14" textAnchor="end" fontSize="11" fill={beliefTone(node.belief)} fontFamily="var(--font-mono)">
                      {Math.round(node.belief * 100)}%
                    </text>
                    <text x="24" y="25" fontSize="9.5" fill="#8b97ab" fontFamily="var(--font-mono)" letterSpacing="0.12em">
                      {node.isActive ? "ACTIVE" : "STABLE"}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute left-5 top-5 flex flex-wrap items-center gap-2">
          <LegendChip label="Trust" color="#94a3b8" />
          <LegendChip label="Flow" color="#f59e0b" />
          <LegendChip label="Focus" color="#f59e0b" strong />
        </div>
        {selectedNode && (
          <div className="pointer-events-none absolute right-5 top-5 min-w-[280px] rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[rgba(7,9,17,0.84)] px-4 py-3 backdrop-blur">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: ARCHETYPE_COLORS[selectedNode.archetype] ?? "#0f172a" }}
              />
              <span className="text-[15px] font-semibold text-[var(--text-bright)]">{selectedNode.name}</span>
            </div>
            <div className="mb-3 ui-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: ARCHETYPE_COLORS[selectedNode.archetype] ?? "var(--text-muted)" }}>
              {ARCHETYPE_LABELS[selectedNode.archetype]}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Belief" value={`${Math.round(selectedNode.belief * 100)}%`} color={beliefTone(selectedNode.belief)} />
              <MiniStat label="Delta" value={`${selectedNode.delta >= 0 ? "+" : ""}${Math.round(selectedNode.delta * 100)}pt`} color={selectedNode.delta >= 0 ? "#34d399" : "#fb7185"} />
              <MiniStat label="Confidence" value={`${Math.round(selectedNode.confidence * 100)}%`} color="var(--text-primary)" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
      <div className="mb-1 ui-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-subtle)]">{label}</div>
      <div className="ui-mono text-[15px] font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}

function LegendChip({
  label,
  color,
  dashed = false,
  strong = false,
}: {
  label: string;
  color: string;
  dashed?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(7,9,17,0.82)] px-3 py-1.5 backdrop-blur">
      <span
        className="block h-[2px] w-5 rounded-full"
        style={{
          background: color,
          opacity: strong ? 1 : 0.75,
          borderTop: dashed ? `2px dashed ${color}` : undefined,
          height: dashed ? 0 : 2,
        }}
      />
      <span className="ui-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</span>
    </div>
  );
}
