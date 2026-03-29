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
  baseRadius: number;
  isActive: boolean;
  targetX: number;
  targetY: number;
};

type GraphLink = d3.SimulationLinkDatum<GraphNode> & {
  id: string;
  kind: "trust" | "share" | "ambient";
  strength: number;
  label: string;
  color: string;
  secondaryColor?: string;
  fromId: string;
  toId: string;
};

const SCENE_W = 1420;
const SCENE_H = 820;
const TICK_MOTION_MS = 600;

function shortName(name: string): string {
  return name.split(" ")[0] ?? name;
}

function hash(value: string): number {
  let acc = 0;
  for (let i = 0; i < value.length; i++) {
    acc = (acc * 33 + value.charCodeAt(i)) % 100003;
  }
  return acc;
}

function seededUnit(seed: string): number {
  return (hash(seed) % 1000) / 1000;
}

function clip(text: string, limit: number): string {
  const n = text.replace(/\s+/g, " ").trim();
  return n.length > limit ? `${n.slice(0, limit - 3)}...` : n;
}

function resolveNode(e: string | number | GraphNode): GraphNode | null {
  return typeof e === "object" ? e : null;
}

function curvePath(
  link: GraphLink & { source: string | number | GraphNode; target: string | number | GraphNode }
): { path: string; cx: number; cy: number; length: number; sx: number; sy: number; tx: number; ty: number } | null {
  const src = resolveNode(link.source);
  const tgt = resolveNode(link.target);
  if (!src || !tgt) return null;
  const sx = src.x ?? 0, sy = src.y ?? 0;
  const tx = tgt.x ?? 0, ty = tgt.y ?? 0;
  const dx = tx - sx, dy = ty - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const curv = link.kind === "share" ? Math.min(60, len * 0.16) : Math.min(28, len * 0.08);
  const mx = (sx + tx) / 2, my = (sy + ty) / 2;
  const cx = mx - (dy / len) * curv;
  const cy = my + (dx / len) * curv;
  return { path: `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`, cx, cy, length: len, sx, sy, tx, ty };
}

function beliefColor(v: number): string {
  if (v >= 0.65) return "#34d399";
  if (v >= 0.5) return "#f59e0b";
  return "#fb7185";
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

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
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const snapshots = useMemo(
    () => tickData.filter((s) => s.tick <= currentTick),
    [currentTick, tickData]
  );

  const currentSnapshot = snapshots[snapshots.length - 1] ?? null;
  const previousSnapshot = snapshots[snapshots.length - 2] ?? null;

  const stateById = useMemo(() => {
    const cur = new Map((currentSnapshot?.agent_states ?? []).map((s) => [s.agent_id, s]));
    const prev = new Map((previousSnapshot?.agent_states ?? []).map((s) => [s.agent_id, s]));
    return new Map(
      agents.map((a) => {
        const cs = cur.get(a.id);
        const ps = prev.get(a.id);
        const belief = cs?.belief ?? a.current_belief ?? a.initial_belief;
        const prevBelief = ps?.belief ?? a.initial_belief;
        return [
          a.id,
          {
            belief,
            confidence: cs?.confidence ?? a.confidence,
            delta: belief - prevBelief,
            isSharing: cs?.action_taken === "share_claim",
            reasoning: cs?.reasoning ?? "",
            action: cs?.action_taken ?? "update_belief",
          },
        ];
      })
    );
  }, [agents, currentSnapshot, previousSnapshot]);

  const activeShares = currentSnapshot?.claim_shares ?? [];

  // Layout — does NOT depend on selectedAgentId so clicking a node never re-layouts
  const layout = useMemo(() => {
    const nodes: GraphNode[] = agents.map((a) => {
      const st = stateById.get(a.id);
      const belief = st?.belief ?? a.initial_belief;
      const confidence = st?.confidence ?? a.confidence;
      const orbit = 180 + belief * 220 + seededUnit(`${a.id}-orbit`) * 100;
      const angle = seededUnit(`${a.id}-angle`) * Math.PI * 2;
      const drift = (confidence - 0.5) * 200;
      const targetX = SCENE_W / 2 + Math.cos(angle) * orbit + (belief - 0.5) * 240;
      const targetY = SCENE_H / 2 + Math.sin(angle) * (orbit * 0.48) - drift;
      const isActive =
        st?.isSharing === true ||
        activeShares.some((s) => s.from_agent_id === a.id || s.to_agent_id === a.id);
      return {
        id: a.id,
        name: a.name,
        archetype: a.archetype,
        belief,
        confidence,
        delta: st?.delta ?? 0,
        baseRadius: isActive ? 11 : 9,
        isActive,
        targetX,
        targetY,
        x: targetX,
        y: targetY,
      };
    });

    // Trust links
    const trustMap = new Map<string, GraphLink>();
    for (const snap of snapshots) {
      for (const upd of snap.trust_updates) {
        const srcAgent = agents.find((a) => a.id === upd.from_agent_id);
        trustMap.set(`${upd.from_agent_id}:${upd.to_agent_id}`, {
          id: `trust-${upd.from_agent_id}-${upd.to_agent_id}`,
          source: upd.from_agent_id,
          target: upd.to_agent_id,
          kind: "trust",
          strength: Math.max(0.12, Math.min(upd.new_trust, 0.95)),
          label: `${Math.round(upd.new_trust * 100)}`,
          color: srcAgent ? ARCHETYPE_COLORS[srcAgent.archetype] : "#94a3b8",
          fromId: upd.from_agent_id,
          toId: upd.to_agent_id,
        });
      }
    }

    // Share links
    const shareLinks: GraphLink[] = activeShares.map((s, i) => {
      const srcAgent = agents.find((a) => a.id === s.from_agent_id);
      const tgtAgent = agents.find((a) => a.id === s.to_agent_id);
      return {
        id: `share-${s.from_agent_id}-${s.to_agent_id}-${i}`,
        source: s.from_agent_id,
        target: s.to_agent_id,
        kind: "share",
        strength: 1,
        label: clip(s.claim_text, 44),
        color: srcAgent ? ARCHETYPE_COLORS[srcAgent.archetype] : "#6366f1",
        secondaryColor: tgtAgent ? ARCHETYPE_COLORS[tgtAgent.archetype] : undefined,
        fromId: s.from_agent_id,
        toId: s.to_agent_id,
      };
    });

    const links: GraphLink[] = [...trustMap.values(), ...shareLinks];

    // Ambient links for sparse early ticks
    if (links.length < Math.max(agents.length, 8)) {
      const ambient = new Map<string, GraphLink>();
      for (const src of nodes) {
        const neighbors = nodes
          .filter((t) => t.id !== src.id)
          .map((t) => ({
            t,
            score: Math.abs(src.belief - t.belief) * 0.7 + Math.abs(src.confidence - t.confidence) * 0.3,
          }))
          .sort((a, b) => a.score - b.score)
          .slice(0, 2);
        for (const { t } of neighbors) {
          const pair = [src.id, t.id].sort().join(":");
          if (ambient.has(pair)) continue;
          ambient.set(pair, {
            id: `ambient-${pair}`,
            source: src.id,
            target: t.id,
            kind: "ambient",
            strength: 0.3,
            label: "",
            color: "rgba(148,163,184,0.4)",
            fromId: src.id,
            toId: t.id,
          });
        }
      }
      links.push(...ambient.values());
    }

    const sim = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((n) => n.id)
          .distance((l) => (l.kind === "share" ? 120 : l.kind === "ambient" ? 160 : 180))
          .strength((l) => (l.kind === "share" ? 0.6 : l.kind === "ambient" ? 0.18 : 0.18 + l.strength * 0.2))
      )
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(SCENE_W / 2, SCENE_H / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((n) => n.baseRadius + 42))
      .force("x", d3.forceX<GraphNode>((n) => n.targetX).strength(0.14))
      .force("y", d3.forceY<GraphNode>((n) => n.targetY).strength(0.14))
      .force("radial", d3.forceRadial(260, SCENE_W / 2, SCENE_H / 2).strength(0.02))
      .stop();

    for (let i = 0; i < 320; i++) sim.tick();

    return { nodes, links };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShares, agents, snapshots, stateById]);

  // Animation
  const [animatedNodes, setAnimatedNodes] = useState<GraphNode[]>(layout.nodes);

  useEffect(() => {
    setAnimatedNodes((prev) => {
      if (prev.length === 0) return layout.nodes;
      const byId = new Map(prev.map((n) => [n.id, n]));
      return layout.nodes.map((n) => {
        const p = byId.get(n.id);
        return p ? { ...n, x: p.x ?? n.x, y: p.y ?? n.y } : n;
      });
    });
  }, [layout.nodes]);

  useEffect(() => {
    if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    const byId = new Map(animatedNodes.map((n) => [n.id, n]));
    const targets = layout.nodes.map((n) => {
      const prev = byId.get(n.id);
      return {
        id: n.id,
        fromX: prev?.x ?? n.x ?? n.targetX,
        fromY: prev?.y ?? n.y ?? n.targetY,
        toX: n.x ?? n.targetX,
        toY: n.y ?? n.targetY,
      };
    });
    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / TICK_MOTION_MS);
      const e = easeInOutCubic(t);
      setAnimatedNodes(
        layout.nodes.map((n) => {
          const tgt = targets.find((x) => x.id === n.id);
          if (!tgt) return n;
          return { ...n, x: tgt.fromX + (tgt.toX - tgt.fromX) * e, y: tgt.fromY + (tgt.toY - tgt.fromY) * e };
        })
      );
      if (t < 1) animFrameRef.current = requestAnimationFrame(animate);
      else animFrameRef.current = null;
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.nodes]);

  // Enrich rendered links with animated positions + selection highlight
  const renderedLinks = useMemo(
    () =>
      layout.links.map((link) => ({
        ...link,
        source: animatedNodes.find((n) => n.id === link.fromId) ?? link.source,
        target: animatedNodes.find((n) => n.id === link.toId) ?? link.target,
        isHighlighted: link.fromId === selectedAgentId || link.toId === selectedAgentId,
      })),
    [animatedNodes, layout.links, selectedAgentId]
  );

  // Enrich nodes with selection state
  const enrichedNodes = useMemo(
    () =>
      animatedNodes.map((n) => ({
        ...n,
        isSelected: n.id === selectedAgentId,
        radius: n.id === selectedAgentId ? 14 : n.baseRadius,
      })),
    [animatedNodes, selectedAgentId]
  );

  const selectedNode = enrichedNodes.find((n) => n.id === selectedAgentId) ?? null;
  const selectedState = selectedNode ? stateById.get(selectedNode.id) : null;
  const renderedHeight = Math.max(560, containerWidth * (SCENE_H / SCENE_W));

  if (!agents.length) {
    return (
      <div className="flex min-h-[480px] items-center justify-center rounded-xl border border-white/8 bg-[rgba(12,16,26,0.82)]">
        <span className="ui-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-subtle)]">No agents loaded</span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/8 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
      {/* SVG canvas */}
      <div ref={containerRef} className="relative bg-[#06080e]">
        <svg width="100%" height={renderedHeight} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="block">
          <defs>
            {/* Share link gradients */}
            {renderedLinks
              .filter((l) => l.kind === "share")
              .map((l) => (
                <linearGradient key={`grad-${l.id}`} id={`grad-${l.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={l.color} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={l.secondaryColor ?? l.color} stopOpacity="0.9" />
                </linearGradient>
              ))}
            {/* Arrow markers for share links */}
            {renderedLinks
              .filter((l) => l.kind === "share")
              .map((l) => (
                <marker key={`mk-${l.id}`} id={`mk-${l.id}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                  <path d="M0,0 L7,3.5 L0,7 z" fill={l.secondaryColor ?? l.color} opacity="0.9" />
                </marker>
              ))}
          </defs>

          {/* Links */}
          <g>
            {renderedLinks.map((link) => {
              const m = curvePath(link);
              if (!m) return null;

              if (link.kind === "ambient") {
                return (
                  <path
                    key={link.id}
                    d={m.path}
                    fill="none"
                    stroke="rgba(148,163,184,0.1)"
                    strokeWidth={link.isHighlighted ? 1.2 : 0.7}
                    strokeOpacity={link.isHighlighted ? 0.35 : 0.14}
                    strokeDasharray="3 6"
                    strokeLinecap="round"
                  />
                );
              }

              if (link.kind === "trust") {
                return (
                  <g key={link.id}>
                    <path
                      d={m.path}
                      fill="none"
                      stroke={link.isHighlighted ? link.color : "rgba(148,163,184,0.4)"}
                      strokeWidth={link.isHighlighted ? 2 : 0.9 + link.strength * 1.1}
                      strokeOpacity={link.isHighlighted ? 0.6 : 0.2}
                      strokeLinecap="round"
                    />
                    {/* Animated dot on highlighted trust link */}
                    {link.isHighlighted && (
                      <circle r="2" fill={link.color} opacity="0.8">
                        <animateMotion dur="3s" repeatCount="indefinite" path={m.path} />
                      </circle>
                    )}
                  </g>
                );
              }

              // Share link
              return (
                <g key={link.id}>
                  <path
                    d={m.path}
                    fill="none"
                    stroke={`url(#grad-${link.id})`}
                    strokeWidth={link.isHighlighted ? 3 : 2.2}
                    strokeOpacity={link.isHighlighted ? 1 : 0.8}
                    markerEnd={`url(#mk-${link.id})`}
                    strokeLinecap="round"
                  />
                  {/* Two particles travelling the share path */}
                  <circle r="2.5" fill={link.color} opacity="0.9">
                    <animateMotion dur="1.8s" repeatCount="indefinite" path={m.path} />
                  </circle>
                  <circle r="1.8" fill={link.secondaryColor ?? link.color} opacity="0.7">
                    <animateMotion dur="1.8s" begin="0.5s" repeatCount="indefinite" path={m.path} />
                  </circle>
                  {/* Claim label on highlighted share */}
                  {link.isHighlighted && (
                    <g transform={`translate(${0.25 * m.sx + 0.5 * m.cx + 0.25 * m.tx}, ${0.25 * m.sy + 0.5 * m.cy + 0.25 * m.ty})`}>
                      <rect
                        x={-(Math.max(80, link.label.length * 5.8) / 2)}
                        y="-11"
                        width={Math.max(80, link.label.length * 5.8)}
                        height="22"
                        rx="6"
                        fill="rgba(6,8,14,0.92)"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="0.5"
                      />
                      <text textAnchor="middle" dominantBaseline="central" fontSize="10" fontFamily="var(--font-mono)" fill="#c8d4e3" letterSpacing="0.01em">
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
            {enrichedNodes.map((node) => {
              const color = ARCHETYPE_COLORS[node.archetype] ?? "#94a3b8";
              const nx = node.x ?? SCENE_W / 2;
              const ny = node.y ?? SCENE_H / 2;

              return (
                <g
                  key={node.id}
                  transform={`translate(${nx}, ${ny})`}
                  onClick={() => onSelectAgent(node.id)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Selection ring */}
                  {node.isSelected && (
                    <circle r={node.radius + 8} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
                  )}
                  {/* Active ring (sharing this tick) */}
                  {node.isActive && !node.isSelected && (
                    <circle r={node.radius + 6} fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
                  )}
                  {/* Main node circle */}
                  <circle
                    r={node.radius}
                    fill="#070911"
                    stroke={color}
                    strokeWidth={node.isSelected ? 2.2 : 1.4}
                    strokeOpacity={node.isSelected ? 1 : 0.8}
                  />
                  {/* Inner fill dot */}
                  <circle r={Math.max(3, node.radius - 5)} fill={color} opacity={node.isSelected ? 1 : 0.75} />

                  {/* Agent name */}
                  <text
                    y={node.radius + 15}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight={node.isSelected ? "700" : "500"}
                    fill={node.isSelected ? "#f8fafc" : "#94a3b8"}
                    stroke="#06080e"
                    strokeWidth="2.5"
                    paintOrder="stroke"
                  >
                    {shortName(node.name)}
                  </text>
                  {/* Belief % */}
                  <text
                    y={node.radius + 28}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="var(--font-mono)"
                    fill={beliefColor(node.belief)}
                    stroke="#06080e"
                    strokeWidth="2.5"
                    paintOrder="stroke"
                  >
                    {Math.round(node.belief * 100)}%
                    {node.delta !== 0 && (
                      <tspan fill={node.delta > 0 ? "#34d399" : "#fb7185"} fontSize="9">
                        {" "}{node.delta > 0 ? "▲" : "▼"}
                      </tspan>
                    )}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Selected agent card — top right overlay */}
        {selectedNode && (
          <div className="pointer-events-none absolute right-4 top-4 w-[260px] rounded-xl border border-white/10 bg-[rgba(6,8,14,0.9)] px-4 py-3 backdrop-blur-sm">
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: ARCHETYPE_COLORS[selectedNode.archetype] ?? "#94a3b8" }} />
              <span className="text-[13px] font-semibold text-[var(--text-bright)] truncate">{selectedNode.name}</span>
              <span
                className="ui-mono ml-auto text-[9px] uppercase tracking-[0.1em] whitespace-nowrap"
                style={{ color: ARCHETYPE_COLORS[selectedNode.archetype] ?? "var(--text-muted)" }}
              >
                {ARCHETYPE_LABELS[selectedNode.archetype]}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 mb-2.5">
              <NodeStat label="Belief" value={`${Math.round(selectedNode.belief * 100)}%`} color={beliefColor(selectedNode.belief)} />
              <NodeStat
                label="Δ"
                value={`${selectedNode.delta >= 0 ? "+" : ""}${Math.round(selectedNode.delta * 100)}pt`}
                color={selectedNode.delta >= 0 ? "#34d399" : "#fb7185"}
              />
              <NodeStat label="Conf" value={`${Math.round(selectedNode.confidence * 100)}%`} />
            </div>

            {selectedState?.reasoning && (
              <div className="border-t border-white/8 pt-2">
                <div className="ui-mono mb-1 text-[9px] uppercase tracking-[0.12em] text-[var(--text-subtle)]">
                  {selectedState.action === "share_claim" ? "Shared claim" : "Updated belief"}
                </div>
                <p className="line-clamp-3 text-[11px] leading-[1.55] text-[var(--text-secondary)] italic">
                  &ldquo;{selectedState.reasoning}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend row — below canvas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/6 bg-[#06080e] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <LegendItem type="line" color="rgba(148,163,184,0.5)" label="Trust" />
          <LegendItem type="animated" color="#f59e0b" label="Claim share" />
          <LegendItem type="dashed" color="rgba(148,163,184,0.4)" label="Proximity" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(ARCHETYPE_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: ARCHETYPE_COLORS[key] }} />
              <span className="ui-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-subtle)]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function NodeStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-white/6 bg-[rgba(255,255,255,0.02)] px-2 py-1.5">
      <div className="ui-mono mb-0.5 text-[9px] uppercase tracking-[0.1em] text-[var(--text-subtle)]">{label}</div>
      <div className="ui-mono text-[13px] font-semibold" style={{ color: color ?? "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

function LegendItem({ type, color, label }: { type: "line" | "animated" | "dashed"; color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex w-6 items-center">
        <div
          className="h-px w-full"
          style={{
            background: color,
            borderTop: type === "dashed" ? `1px dashed ${color}` : undefined,
          }}
        />
        {type === "animated" && (
          <span
            className="absolute right-0 h-1.5 w-1.5 rounded-full"
            style={{ background: color, animation: "pulse 1.4s ease-in-out infinite" }}
          />
        )}
      </div>
      <span className="ui-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-subtle)]">{label}</span>
    </div>
  );
}
