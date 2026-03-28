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
  const data: ChartDataPoint[] = [];

  for (let tick = 1; tick <= Math.max(tickData.length, 1); tick++) {
    const snapshot = tickData.find((entry) => entry.tick === tick);
    const row: ChartDataPoint = { tick };

    agents.forEach((agent) => {
      if (snapshot) {
        const state = snapshot.agent_states.find((entry) => entry.agent_id === agent.id);
        row[agent.id] = state
          ? Math.round(state.belief * 100) / 100
          : agent.initial_belief;
      } else {
        row[agent.id] = agent.initial_belief;
      }
    });

    data.push(row);
  }

  return (
    <div className="h-full w-full rounded-[24px] border border-white/8 bg-[rgba(255,255,255,0.02)] p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 14, right: 20, left: 6, bottom: 8 }}
          onClick={(event) => {
            if (event?.activeLabel && onTickSelect) {
              onTickSelect(Number(event.activeLabel));
            }
          }}
        >
          <CartesianGrid
            strokeDasharray="3 5"
            stroke="rgba(255,255,255,0.08)"
            vertical={false}
          />
          <XAxis
            dataKey="tick"
            tick={{ fill: "#8b97ab", fontSize: 11, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            label={{
              value: "TICK",
              position: "insideBottomRight",
              offset: -2,
              fill: "#8b97ab",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
            minTickGap={Math.max(0, Math.floor(totalTicks / 6))}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={(value) => `${Math.round(value * 100)}%`}
            tick={{ fill: "#8b97ab", fontSize: 11, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            width={46}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(10, 14, 22, 0.98)",
              border: "1px solid rgba(245,158,11,0.26)",
              borderRadius: 18,
              boxShadow: "0 18px 50px rgba(0,0,0,0.32)",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              padding: "12px 14px",
            }}
            itemStyle={{ color: "#edf2f8" }}
            labelStyle={{
              color: "#f59e0b",
              marginBottom: 8,
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
            formatter={(value, name) => {
              const numeric = typeof value === "number" ? value : 0;
              const nameValue = typeof name === "string" ? name : String(name ?? "");
              const agent = agents.find((entry) => entry.id === nameValue);
              return [`${Math.round(numeric * 100)}%`, agent?.name ?? nameValue] as [string, string];
            }}
            labelFormatter={(label) => `Tick ${label}`}
            cursor={{ stroke: "rgba(245,158,11,0.28)", strokeWidth: 1.5 }}
          />
          <ReferenceLine
            y={0.5}
            stroke="rgba(255,255,255,0.14)"
            strokeDasharray="5 5"
          />
          {currentTick > 0 && (
            <ReferenceLine
              x={currentTick}
              stroke="rgba(245,158,11,0.6)"
              strokeWidth={1.75}
            />
          )}
          {agents.map((agent) => (
            <Line
              key={agent.id}
              type="monotone"
              dataKey={agent.id}
              stroke={ARCHETYPE_COLORS[agent.archetype] ?? "#ffffff"}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 5,
                fill: ARCHETYPE_COLORS[agent.archetype] ?? "#ffffff",
                stroke: "#0d1119",
                strokeWidth: 2,
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
