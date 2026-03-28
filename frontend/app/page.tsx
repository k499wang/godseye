"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MarketImport } from "@/components/MarketImport";
import { generateClaims, buildWorld, startSimulation } from "@/lib/api";
import type { MarketResponse } from "@/lib/types";

type Step = "import" | "generating" | "building" | "starting" | "done" | "error";

const STEP_LABELS: Record<Step, string> = {
  import: "READY",
  generating: "GENERATING CLAIMS",
  building: "BUILDING WORLD",
  starting: "STARTING SIMULATION",
  done: "LAUNCHED",
  error: "ERROR",
};

export default function HomePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("import");
  const [market, setMarket] = useState<MarketResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImported(m: MarketResponse) {
    setMarket(m);
    setError(null);

    try {
      setStep("generating");
      await generateClaims(m.id);

      setStep("building");
      const sim = await buildWorld(m.session_id);

      setStep("starting");
      const started = await startSimulation(sim.id);

      setStep("done");
      router.push(`/simulation/${started.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Pipeline failed. Check the backend.";
      setError(msg);
      setStep("error");
    }
  }

  function handleUseMock() {
    router.push(`/simulation/mock`);
  }

  return (
    <main className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-[rgba(255,255,255,0.06)] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#F59E0B]" />
            <span className="font-mono text-[11px] tracking-[0.3em] text-[#F59E0B] font-bold">
              GODSEYE
            </span>
          </div>
          <span className="text-[#2d2d3a] font-mono text-[10px]">
            PREDICTION MARKET SIMULATOR
          </span>
        </div>
        <div className="font-mono text-[9px] tracking-widest text-[#374151]">
          MULTI-AGENT ANALYSIS SYSTEM v1.0
        </div>
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 animate-fade-in-up">
        <div className="mb-8 text-center">
          <div className="font-mono text-[9px] tracking-[0.4em] text-[#4b5563] mb-3">
            POWERED BY GEMINI · K2-THINK · APOLLO.IO
          </div>
          <h1 className="text-[clamp(28px,4vw,48px)] font-bold tracking-tight text-white mb-4 font-mono">
            Simulate the Market
          </h1>
          <p className="font-mono text-[12px] text-[#6b7280] max-w-lg mx-auto leading-relaxed">
            Import a Polymarket prediction market. 12 AI agents — each with real
            professional personas sourced from Apollo.io — debate the evidence
            over 30 simulation ticks. Watch beliefs converge. Read the final
            report.
          </p>
        </div>

        {/* Import form / pipeline status */}
        <div className="w-full max-w-2xl">
          {step === "import" || step === "error" ? (
            <MarketImport onImported={handleImported} />
          ) : (
            <div className="border border-[rgba(245,158,11,0.2)] p-6">
              <PipelineStatus step={step} market={market} />
            </div>
          )}

          {error && step === "error" && (
            <div className="mt-3 border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.05)] px-3 py-2 font-mono text-[11px] text-[#EF4444]">
              {error}
            </div>
          )}

          {(step === "import" || step === "error") && (
            <>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
                <span className="font-mono text-[9px] tracking-widest text-[#374151]">OR</span>
                <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
              </div>
              <button
                onClick={handleUseMock}
                className="mt-4 w-full py-2.5 font-mono text-[10px] tracking-widest text-[#6b7280] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(245,158,11,0.25)] hover:text-[#9ca3af] transition-colors"
              >
                VIEW DEMO WITH MOCK DATA →
              </button>
            </>
          )}
        </div>

        {/* Feature grid */}
        <div className="mt-16 grid grid-cols-3 gap-px max-w-2xl w-full border border-[rgba(255,255,255,0.06)]">
          {[
            {
              label: "12 AGENTS",
              desc: "6 archetypes × 2 agents, each with real Apollo.io professional backgrounds",
            },
            {
              label: "30 TICKS",
              desc: "Each tick: every agent reads evidence, updates belief, or shares a claim",
            },
            {
              label: "FULL REPORT",
              desc: "Probability comparison, faction analysis, trust insights, recommendation",
            },
          ].map((f) => (
            <div key={f.label} className="p-4 bg-[rgba(255,255,255,0.015)]">
              <div className="font-mono text-[10px] tracking-widest text-[#F59E0B] mb-2">
                {f.label}
              </div>
              <div className="font-mono text-[10px] text-[#6b7280] leading-relaxed">
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function PipelineStatus({
  step,
  market,
}: {
  step: Step;
  market: MarketResponse | null;
}) {
  const steps: Step[] = ["generating", "building", "starting", "done"];
  const currentIdx = steps.indexOf(step);

  return (
    <div>
      {market && (
        <div className="mb-4 pb-4 border-b border-[rgba(255,255,255,0.06)]">
          <div className="font-mono text-[9px] tracking-widest text-[#4b5563] mb-1">
            MARKET IMPORTED
          </div>
          <div className="font-mono text-[12px] text-[#e5e7eb] leading-relaxed">
            {market.question}
          </div>
          <div className="flex gap-4 mt-1">
            <span className="font-mono text-[10px] text-[#6b7280]">
              POLYMARKET:{" "}
              <span className="text-[#F59E0B]">
                {Math.round(market.current_probability * 100)}%
              </span>
            </span>
            <span className="font-mono text-[10px] text-[#6b7280]">
              VOL: ${(market.volume / 1e6).toFixed(1)}M
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {steps.map((s, i) => {
          const done = i < currentIdx || step === "done";
          const active = i === currentIdx && step !== "done";
          return (
            <div key={s} className="flex items-center gap-3">
              <div
                className="w-5 h-5 flex items-center justify-center flex-shrink-0 border"
                style={{
                  borderColor: done
                    ? "#10B981"
                    : active
                    ? "#F59E0B"
                    : "rgba(255,255,255,0.1)",
                  background: done
                    ? "rgba(16,185,129,0.1)"
                    : active
                    ? "rgba(245,158,11,0.1)"
                    : "transparent",
                }}
              >
                {done ? (
                  <span className="text-[10px] text-[#10B981]">✓</span>
                ) : active ? (
                  <span
                    className="inline-block w-2 h-2 border border-[#F59E0B] border-t-transparent rounded-full"
                    style={{ animation: "spin 0.8s linear infinite" }}
                  />
                ) : (
                  <span className="w-1 h-1 bg-[rgba(255,255,255,0.15)] rounded-full" />
                )}
              </div>
              <span
                className="font-mono text-[10px] tracking-widest"
                style={{
                  color: done ? "#10B981" : active ? "#F59E0B" : "#374151",
                }}
              >
                {STEP_LABELS[s]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
