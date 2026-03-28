"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { AgentSummary, TickSnapshot } from "@/lib/types";
import { ARCHETYPE_COLORS } from "@/lib/constants";

interface BeliefChartProps {
  agents: AgentSummary[];
  tickData: TickSnapshot[];
  currentTick: number;
  totalTicks: number;
  onTickSelect?: (tick: number) => void;
}

interface ChartDataPoint {
  tick: number;
  [agentId: string]: number;
}

export function BeliefChart({
  agents,
  tickData,
  currentTick,
  totalTicks,
  onTickSelect,
}: BeliefChartProps) {
  // Build chart data — one row per tick
  const data: ChartDataPoint[] = [];

  for (let t = 1; t <= Math.max(tickData.length, 1); t++) {
    const snap = tickData.find((s) => s.tick === t);
    const row: ChartDataPoint = { tick: t };
    agents.forEach((agent) => {
      if (snap) {
        const state = snap.agent_states.find((s) => s.agent_id === agent.id);
        row[agent.id] = state ? Math.round(state.belief * 100) / 100 : agent.initial_belief;
      } else {
        row[agent.id] = agent.initial_belief;
      }
    });
    data.push(row);
  }

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          onClick={(e) => {
            if (e?.activeLabel && onTickSelect) {
              onTickSelect(Number(e.activeLabel));
            }
          }}
        >
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="tick"
            tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            label={{
              value: "TICK",
              position: "insideBottomRight",
              offset: -4,
              fill: "#4b5563",
              fontSize: 9,
              fontFamily: "var(--font-mono)",
            }}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            width={38}
          />
          <Tooltip
            contentStyle={{
              background: "#0d0d14",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
            labelStyle={{ color: "#F59E0B", marginBottom: 4, fontSize: 10 }}
            formatter={(value, name) => {
              const numVal = typeof value === "number" ? value : 0;
              const nameStr = typeof name === "string" ? name : String(name ?? "");
              const agent = agents.find((a) => a.id === nameStr);
              return [`${Math.round(numVal * 100)}%`, agent?.name ?? nameStr] as [string, string];
            }}
            labelFormatter={(label) => `TICK ${label}`}
            cursor={{ stroke: "rgba(245,158,11,0.2)", strokeWidth: 1 }}
          />
          {/* 50% reference line */}
          <ReferenceLine
            y={0.5}
            stroke="rgba(255,255,255,0.12)"
            strokeDasharray="4 4"
          />
          {/* Current tick reference */}
          {currentTick > 0 && (
            <ReferenceLine
              x={currentTick}
              stroke="rgba(245,158,11,0.5)"
              strokeWidth={1.5}
            />
          )}
          {agents.map((agent) => (
            <Line
              key={agent.id}
              type="monotone"
              dataKey={agent.id}
              stroke={ARCHETYPE_COLORS[agent.archetype] ?? "#ffffff"}
              strokeWidth={1.5}
              dot={false}
              activeDot={{
                r: 4,
                fill: ARCHETYPE_COLORS[agent.archetype] ?? "#ffffff",
                stroke: "#0d0d14",
                strokeWidth: 2,
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
