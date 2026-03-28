"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getReport } from "@/lib/api";
import { MOCK_REPORT, MOCK_MARKET } from "@/lib/mockData";

export default function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const isMock = id === "mock";

  const { data, isLoading, error } = useQuery({
    queryKey: ["report", id],
    queryFn: () => getReport(id),
    enabled: !isMock,
  });

  const report = isMock ? MOCK_REPORT : data;

  if (!isMock && isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span
          className="inline-block w-6 h-6 border-2 border-[#F59E0B] border-t-transparent rounded-full"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
      </div>
    );
  }

  if ((!isMock && error) || !report) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="font-mono text-[10px] tracking-widest text-[#EF4444] mb-3">
            REPORT NOT AVAILABLE
          </div>
          <button
            onClick={() => router.back()}
            className="font-mono text-[10px] tracking-widest text-[#6b7280] border border-[rgba(255,255,255,0.08)] px-4 py-2 hover:text-[#F59E0B] transition-colors"
          >
            ← BACK
          </button>
        </div>
      </div>
    );
  }

  const probDelta = report.simulation_probability - report.market_probability;
  const probDeltaDir = probDelta >= 0 ? "+" : "";

  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="font-mono text-[9px] tracking-widest text-[#4b5563] hover:text-[#F59E0B] transition-colors"
          >
            ← SIMULATION
          </button>
          <span className="text-[#2d2d3a]">/</span>
          <span className="font-mono text-[9px] tracking-widest text-[#6b7280]">
            REPORT
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#F59E0B]" />
          <span className="font-mono text-[10px] tracking-widest text-[#F59E0B] font-bold">
            GODSEYE
          </span>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 animate-fade-in-up">
        {/* Probability comparison hero */}
        <div className="mb-8 border border-[rgba(245,158,11,0.2)] p-6">
          <div className="font-mono text-[9px] tracking-widest text-[#4b5563] mb-4">
            PROBABILITY COMPARISON
          </div>
          <div className="grid grid-cols-3 gap-0">
            {/* Polymarket */}
            <div className="text-center p-4 border-r border-[rgba(255,255,255,0.06)]">
              <div className="font-mono text-[9px] tracking-widest text-[#6b7280] mb-2">
                POLYMARKET
              </div>
              <div className="font-mono text-[36px] font-bold text-[#9ca3af] tabular-nums">
                {Math.round(report.market_probability * 100)}%
              </div>
              <div className="font-mono text-[9px] text-[#4b5563] mt-1">
                IMPLIED PROBABILITY
              </div>
            </div>

            {/* Delta */}
            <div className="text-center p-4 border-r border-[rgba(255,255,255,0.06)] flex flex-col items-center justify-center">
              <div
                className="font-mono text-[11px] tracking-widest mb-1 px-2 py-1"
                style={{
                  color: probDelta >= 0 ? "#10B981" : "#EF4444",
                  background:
                    probDelta >= 0
                      ? "rgba(16,185,129,0.1)"
                      : "rgba(239,68,68,0.1)",
                  border: `1px solid ${probDelta >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                }}
              >
                {probDeltaDir}
                {Math.round(probDelta * 100)}pp
              </div>
              <div className="font-mono text-[9px] text-[#4b5563]">
                {probDelta >= 0 ? "SIMULATION HIGHER" : "SIMULATION LOWER"}
              </div>
            </div>

            {/* Simulation */}
            <div className="text-center p-4">
              <div className="font-mono text-[9px] tracking-widest text-[#F59E0B] mb-2">
                SIMULATION
              </div>
              <div
                className="font-mono text-[36px] font-bold tabular-nums"
                style={{
                  color:
                    report.simulation_probability >= 0.65
                      ? "#10B981"
                      : report.simulation_probability >= 0.45
                      ? "#F59E0B"
                      : "#EF4444",
                }}
              >
                {Math.round(report.simulation_probability * 100)}%
              </div>
              <div className="font-mono text-[9px] text-[#4b5563] mt-1">
                AGENT CONSENSUS AT TICK 30
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <Section title="EXECUTIVE SUMMARY">
          <p className="font-mono text-[12px] text-[#9ca3af] leading-relaxed">
            {report.summary}
          </p>
        </Section>

        {/* Key drivers */}
        <Section title="KEY EVIDENCE DRIVERS">
          <div className="flex flex-col gap-2">
            {report.key_drivers.map((driver, i) => (
              <div
                key={i}
                className="flex items-start gap-3 border-l border-[rgba(245,158,11,0.25)] pl-3 py-1"
              >
                <span className="font-mono text-[9px] text-[#4b5563] flex-shrink-0 mt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="font-mono text-[11px] text-[#9ca3af] leading-relaxed">
                  {driver}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* Faction analysis */}
        <Section title="FACTION ANALYSIS">
          <p className="font-mono text-[12px] text-[#9ca3af] leading-relaxed">
            {report.faction_analysis}
          </p>
        </Section>

        {/* Trust insights */}
        <Section title="TRUST NETWORK INSIGHTS">
          <p className="font-mono text-[12px] text-[#9ca3af] leading-relaxed">
            {report.trust_insights}
          </p>
        </Section>

        {/* Recommendation */}
        <div className="mt-6 border border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.03)] p-5">
          <div className="font-mono text-[9px] tracking-widest text-[#10B981] mb-3">
            RECOMMENDATION
          </div>
          <p className="font-mono text-[12px] text-[#d1d5db] leading-relaxed">
            {report.recommendation}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <div className="font-mono text-[9px] text-[#374151]">
            SIMULATION {report.simulation_id.slice(0, 8).toUpperCase()}
          </div>
          <button
            onClick={() => router.push("/")}
            className="font-mono text-[9px] tracking-widest text-[#4b5563] hover:text-[#F59E0B] transition-colors border border-[rgba(255,255,255,0.06)] px-3 py-1.5 hover:border-[rgba(245,158,11,0.25)]"
          >
            NEW SIMULATION →
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <div className="font-mono text-[9px] tracking-widest text-[#4b5563] mb-3">
        {title}
      </div>
      <div className="border-l border-[rgba(255,255,255,0.06)] pl-4">{children}</div>
    </div>
  );
}
