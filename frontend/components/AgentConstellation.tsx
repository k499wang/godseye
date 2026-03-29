"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { AgentSummary, TickSnapshot, TrustUpdate } from "@/lib/types";
import { ARCHETYPE_COLORS, ARCHETYPE_LABELS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";

interface AgentConstellationProps {
  agents: AgentSummary[];
  tickData: TickSnapshot[];
  currentTick: number;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  simulationId?: string;
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
const GRID_SPACING = 40;

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
  simulationId,
}: AgentConstellationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1240);
  const animationFrameRef = useRef<number | null>(null);

  // Supabase-sourced trust scores remain a fallback until the API exposes a
  // tick-by-tick trust history derived from the DB.
  const [dbTrustScores, setDbTrustScores] = useState<Map<string, Record<string, number>>>(new Map());

  // Fetch trust_scores from agents table
  useEffect(() => {
    if (!simulationId || simulationId === "sim-001") return;

    async function fetchTrustScores() {
      const { data, error } = await supabase
        .from("agents")
        .select("id, trust_scores")
        .eq("simulation_id", simulationId!);

      if (error) {
        console.error("[AgentConstellation] Error fetching trust_scores:", error);
        return;
      }

      if (data && data.length > 0) {
        const trustMap = new Map<string, Record<string, number>>();
        for (const agent of data) {
          if (agent.trust_scores && typeof agent.trust_scores === "object") {
            trustMap.set(agent.id, agent.trust_scores as Record<string, number>);
          }
        }
        console.log(`[AgentConstellation] Fetched trust_scores for ${trustMap.size} agents from Supabase`);
        setDbTrustScores(trustMap);
      }
    }

    fetchTrustScores();
  }, [simulationId]);

  // Merge Supabase data into tick snapshots
  const enrichedTickData = useMemo(() => {
    const hasShareData = tickData.some((t) => (t.claim_shares?.length ?? 0) > 0);
    const hasTrustData = tickData.some((t) => (t.trust_updates?.length ?? 0) > 0);
    if (hasShareData || dbTrustScores.size === 0) {
      return tickData;
    }
    if (hasTrustData) {
      return tickData;
    }

    // Build a set of agent pairs that have interacted (shared claims) up to each tick
    // Trust edges only appear between agents that have actually shared claims
    const interactedPairs = new Set<string>();
    const interactedByTick = new Map<number, Set<string>>();
    const sortedTicks = [...tickData]
      .filter((snapshot) => snapshot.claim_shares.length > 0)
      .map((snapshot) => snapshot.tick)
      .sort((a, b) => a - b);
    for (const tick of sortedTicks) {
      const snapshot = tickData.find((entry) => entry.tick === tick);
      if (!snapshot) continue;
      for (const share of snapshot.claim_shares) {
        interactedPairs.add(`${share.from_agent_id}:${share.to_agent_id}`);
        interactedPairs.add(`${share.to_agent_id}:${share.from_agent_id}`);
      }
      interactedByTick.set(tick, new Set(interactedPairs));
    }

    return tickData.map((snapshot) => {
      // Find the most recent interaction set at or before this tick
      let pairsAtTick: Set<string> | undefined;
      for (const tick of sortedTicks) {
        if (tick <= snapshot.tick) pairsAtTick = interactedByTick.get(tick);
        else break;
      }

      // Only show trust edges between agents that have interacted by this tick
      const trustUpdates: TrustUpdate[] = [];
      if (pairsAtTick && pairsAtTick.size > 0) {
        for (const [fromId, scores] of dbTrustScores) {
          for (const [toId, trust] of Object.entries(scores)) {
            if (trust > 0.1 && pairsAtTick.has(`${fromId}:${toId}`)) {
              trustUpdates.push({
                from_agent_id: fromId,
                to_agent_id: toId,
                old_trust: 0,
                new_trust: trust,
              });
            }
          }
        }
      }

      return {
        ...snapshot,
        trust_updates: trustUpdates.length > 0 ? trustUpdates : snapshot.trust_updates ?? [],
      };
    });
  }, [tickData, dbTrustScores]);

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
    () => enrichedTickData.filter((snapshot) => snapshot.tick <= currentTick),
    [currentTick, enrichedTickData]
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

  // Accumulate all historical shares (deduplicated by agent pair, keeping latest)
  const historicalShares = useMemo(() => {
    const shareMap = new Map<string, (typeof activeShares)[number]>();
    for (const snapshot of snapshots) {
      for (const share of snapshot.claim_shares) {
        const key = `${share.from_agent_id}:${share.to_agent_id}`;
        shareMap.set(key, share);
      }
    }
    return [...shareMap.values()];
  }, [snapshots]);

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
        radius: selectedAgentId === agent.id ? 34 : state?.isSharing ? 28 : 24,
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

    const activeShareKeys = new Set(
      activeShares.map((s) => `${s.from_agent_id}:${s.to_agent_id}`)
    );
    const shareLinks: GraphLink[] = historicalShares.map((share, index) => {
      const sourceAgent = agents.find((agent) => agent.id === share.from_agent_id);
      const targetAgent = agents.find((agent) => agent.id === share.to_agent_id);
      const isCurrentlyActive = activeShareKeys.has(`${share.from_agent_id}:${share.to_agent_id}`);
      return {
        id: `share-${share.from_agent_id}-${share.to_agent_id}-${index}`,
        source: share.from_agent_id,
        target: share.to_agent_id,
        kind: "share" as const,
        strength: isCurrentlyActive ? 1 : 0.5,
        label: clip(share.claim_text, 42),
        isHighlighted:
          selectedAgentId === share.from_agent_id || selectedAgentId === share.to_agent_id,
        color: sourceAgent ? ARCHETYPE_COLORS[sourceAgent.archetype] : "#1d4ed8",
        secondaryColor: targetAgent ? ARCHETYPE_COLORS[targetAgent.archetype] : "#0f172a",
      };
    });

    const links: GraphLink[] = [...trustMap.values(), ...shareLinks];

    const minLinks = Math.ceil(agents.length * 0.5);
    if (links.length < minLinks) {
      const needed = minLinks - links.length;
      const existingPairs = new Set(
        links.map((l) => {
          const sId = typeof l.source === "object" ? l.source.id : String(l.source);
          const tId = typeof l.target === "object" ? l.target.id : String(l.target);
          return [sId, tId].sort().join(":");
        })
      );
      const candidates: { pair: string; source: string; target: string; score: number }[] = [];
      for (const source of nodes) {
        for (const target of nodes) {
          if (source.id >= target.id) continue;
          const pair = [source.id, target.id].sort().join(":");
          if (existingPairs.has(pair)) continue;
          const beliefGap = Math.abs(source.belief - target.belief);
          const confidenceGap = Math.abs(source.confidence - target.confidence);
          candidates.push({ pair, source: source.id, target: target.id, score: beliefGap * 0.7 + confidenceGap * 0.3 });
        }
      }
      candidates.sort((a, b) => a.score - b.score);
      for (const candidate of candidates.slice(0, needed)) {
        links.push({
          id: `ambient-${candidate.pair}`,
          source: candidate.source,
          target: candidate.target,
          kind: "ambient",
          strength: Math.max(0.35, 1 - candidate.score),
          label: "",
          isHighlighted: selectedAgentId === candidate.source || selectedAgentId === candidate.target,
          color: "rgba(148,163,184,0.92)",
        });
      }
    }

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((node) => node.id)
          .distance((link) => (link.kind === "share" ? 220 : link.kind === "ambient" ? 280 : 260))
          .strength((link) => (link.kind === "share" ? 0.4 : link.kind === "ambient" ? 0.1 : 0.12 + link.strength * 0.15))
      )
      .force("charge", d3.forceManyBody().strength(-900))
      .force("center", d3.forceCenter(SCENE_W / 2, SCENE_H / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((node) => node.radius + 80))
      .force("x", d3.forceX<GraphNode>((node) => node.targetX).strength(0.06))
      .force("y", d3.forceY<GraphNode>((node) => node.targetY).strength(0.06))
      .force("radial", d3.forceRadial(340, SCENE_W / 2, SCENE_H / 2).strength(0.03))
      .stop();

    for (let index = 0; index < 320; index += 1) simulation.tick();

    return { nodes, links };
  }, [activeShares, agents, historicalShares, selectedAgentId, snapshots, stateById]);

  const [animatedNodes, setAnimatedNodes] = useState<GraphNode[]>(layout.nodes);

  useEffect(() => {
    setAnimatedNodes((previousNodes) => {
      if (previousNodes.length === 0) return layout.nodes;

      const previousById = new Map(previousNodes.map((node) => [node.id, node]));
      return layout.nodes.map((node) => {
        const previous = previousById.get(node.id);
        return previous
          ? {
              ...node,
              x: previous.x ?? node.x,
              y: previous.y ?? node.y,
            }
          : node;
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

  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let x = 0; x <= SCENE_W; x += GRID_SPACING) {
      lines.push({ x1: x, y1: 0, x2: x, y2: SCENE_H });
    }
    for (let y = 0; y <= SCENE_H; y += GRID_SPACING) {
      lines.push({ x1: 0, y1: y, x2: SCENE_W, y2: y });
    }
    return lines;
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c0e14] p-2">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl bg-[#0a0c12]"
      >
        <svg width="100%" height={renderedHeight} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="block">
          <defs>
            {renderedLinks
              .filter((link) => link.kind === "share")
              .map((link) => (
                <marker
                  key={`arrow-${link.id}`}
                  id={`arrow-${link.id}`}
                  markerWidth="10"
                  markerHeight="7"
                  refX="10"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill={link.color} opacity="0.8" />
                </marker>
              ))}
            <marker
              id="arrow-trust"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#64748b" opacity="0.5" />
            </marker>
          </defs>

          {/* Dot grid background */}
          <g opacity="0.12">
            {gridLines.map((line, i) => (
              <line
                key={`grid-${i}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#334155"
                strokeWidth="0.5"
              />
            ))}
          </g>

          {/* Edges */}
          <g>
            {renderedLinks.map((link) => {
              const source = resolveNode(link.source);
              const target = resolveNode(link.target);
              if (!source || !target) return null;

              const sx = source.x ?? 0;
              const sy = source.y ?? 0;
              const tx = target.x ?? 0;
              const ty = target.y ?? 0;

              const isShare = link.kind === "share";
              const isAmbient = link.kind === "ambient";
              const labelPos = labelPosition(link);
              const metrics = curveMetrics(link);

              return (
                <g key={link.id}>
                  {/* Edge line - simple straight or slight curve */}
                  <path
                    d={metrics?.path ?? `M ${sx} ${sy} L ${tx} ${ty}`}
                    fill="none"
                    stroke={
                      isShare
                        ? link.color
                        : isAmbient
                          ? "#e2e8f0"
                          : link.isHighlighted
                            ? "#cbd5e1"
                            : link.color
                    }
                    strokeWidth={
                      isShare
                        ? link.strength >= 1 ? 5 : 3.5
                        : isAmbient
                          ? 1.5
                          : link.isHighlighted
                            ? 4
                            : 2.5 + link.strength * 2
                    }
                    strokeOpacity={
                      isShare
                        ? link.strength >= 1 ? 1 : 0.7
                        : isAmbient
                          ? link.isHighlighted ? 0.6 : 0.4
                          : link.isHighlighted
                            ? 0.95
                            : 0.7
                    }
                    strokeDasharray={isAmbient ? "6 4" : undefined}
                    markerEnd={isShare ? `url(#arrow-${link.id})` : link.kind === "trust" ? "url(#arrow-trust)" : undefined}
                    strokeLinecap="round"
                  />
                  {/* Edge label - trust and share edges only (no labels on ambient) */}
                  {!isAmbient && labelPos && (link.kind === "share" ? link.label : link.label) && (
                    <g transform={`translate(${labelPos.x}, ${labelPos.y})`}>
                      {(() => {
                        const text = link.label;
                        const textWidth = Math.max(60, text.length * 6);
                        return (
                          <>
                            <rect
                              x={-(textWidth / 2) - 6}
                              y="-12"
                              width={textWidth + 12}
                              height="24"
                              rx="4"
                              fill="#0f172a"
                              stroke={
                                isShare
                                  ? link.isHighlighted ? "rgba(245,158,11,0.5)" : "rgba(245,158,11,0.25)"
                                  : link.isHighlighted ? "#475569" : "#1e293b"
                              }
                              strokeWidth="1"
                            />
                            <text
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={isShare ? "10" : "9"}
                              fontFamily="var(--font-mono)"
                              fill={isShare ? "#e2e8f0" : "#94a3b8"}
                            >
                              {text}
                            </text>
                          </>
                        );
                      })()}
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {animatedNodes.map((node) => {
              const nodeColor = ARCHETYPE_COLORS[node.archetype] ?? "#64748b";
              const label = shortName(node.name);
              const nodeX = node.x ?? SCENE_W / 2;
              const nodeY = node.y ?? SCENE_H / 2;
              const nodeRadius = node.isSelected ? 34 : node.isActive ? 28 : 24;

              return (
                <g
                  key={node.id}
                  transform={`translate(${nodeX}, ${nodeY})`}
                  onClick={() => onSelectAgent(node.id)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Selection ring */}
                  {node.isSelected && (
                    <circle
                      r={nodeRadius + 4}
                      fill="none"
                      stroke={nodeColor}
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                  )}
                  {/* Active indicator */}
                  {node.isActive && !node.isSelected && (
                    <circle
                      r={nodeRadius + 3}
                      fill="none"
                      stroke={nodeColor}
                      strokeWidth="1"
                      opacity="0.5"
                    />
                  )}
                  {/* Main node circle */}
                  <circle
                    r={nodeRadius}
                    fill={nodeColor}
                    opacity={node.isSelected ? 0.9 : node.isActive ? 0.8 : 0.65}
                    stroke="#ffffff"
                    strokeWidth={node.isSelected ? 3 : 2}
                    strokeOpacity={node.isSelected ? 0.9 : 0.6}
                  />
                  {/* Belief percentage inside node */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="14"
                    fontWeight="700"
                    fontFamily="var(--font-mono)"
                    fill="#fff"
                  >
                    {Math.round(node.belief * 100)}
                  </text>
                  {/* Name label below node */}
                  <text
                    y={nodeRadius + 16}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="600"
                    fill="#e2e8f0"
                  >
                    {label}
                  </text>
                  {/* Archetype label */}
                  <text
                    y={nodeRadius + 30}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="#64748b"
                    textTransform="uppercase"
                    letterSpacing="0.08em"
                  >
                    {ARCHETYPE_LABELS[node.archetype]?.split(" ")[0] ?? node.archetype}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap items-center gap-2">
          <LegendChip label="Trust" color="#64748b" />
          <LegendChip label="Share" color="#f59e0b" />
          <LegendChip label="Ambient" color="#475569" dashed />
        </div>

        {/* Selected node detail panel */}
        {selectedNode && (
          <div className="pointer-events-none absolute right-4 top-4 min-w-[260px] rounded-lg border border-white/10 bg-[#0f172a]/95 px-4 py-3 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: ARCHETYPE_COLORS[selectedNode.archetype] ?? "#64748b" }}
              />
              <span className="text-sm font-semibold text-slate-100">{selectedNode.name}</span>
            </div>
            <div className="mb-3 ui-mono text-[10px] uppercase tracking-wider" style={{ color: ARCHETYPE_COLORS[selectedNode.archetype] ?? "#64748b" }}>
              {ARCHETYPE_LABELS[selectedNode.archetype]}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Belief" value={`${Math.round(selectedNode.belief * 100)}%`} color={beliefTone(selectedNode.belief)} />
              <MiniStat label="Delta" value={`${selectedNode.delta >= 0 ? "+" : ""}${Math.round(selectedNode.delta * 100)}pt`} color={selectedNode.delta >= 0 ? "#34d399" : "#fb7185"} />
              <MiniStat label="Conf" value={`${Math.round(selectedNode.confidence * 100)}%`} color="#e2e8f0" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-md border border-white/8 bg-white/3 px-2.5 py-2">
      <div className="mb-0.5 ui-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="ui-mono text-sm font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}

function LegendChip({
  label,
  color,
  dashed = false,
}: {
  label: string;
  color: string;
  dashed?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-white/8 bg-[#0f172a]/90 px-2.5 py-1">
      <span
        className="block w-4"
        style={{
          borderTop: dashed ? `1.5px dashed ${color}` : `2px solid ${color}`,
          opacity: 0.8,
        }}
      />
      <span className="ui-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
    </div>
  );
}
