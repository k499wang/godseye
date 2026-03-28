"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { GlobeEvent } from "@/lib/globeData";
import { CATEGORY_COLOR } from "@/lib/globeData";

interface EventFocusPanelProps {
  event: GlobeEvent | null;
  onClose: () => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  monetary: "MONETARY POLICY",
  geopolitical: "GEOPOLITICS",
  election: "ELECTION",
  tech: "TECHNOLOGY",
  energy: "ENERGY",
  macro: "MACROECONOMICS",
};

function ProbabilityBar({ probability }: { probability: number }) {
  const pct = Math.round(probability * 100);
  const color =
    probability >= 0.65 ? "#10B981" : probability >= 0.4 ? "#F59E0B" : "#EF4444";

  return (
    <div>
      <div className="flex items-end justify-between mb-1.5">
        <span
          className="font-mono text-[11px] tracking-widest"
          style={{ color: "#6b7280" }}
        >
          POLYMARKET PROBABILITY
        </span>
        <span
          className="font-mono text-[28px] font-bold tabular-nums leading-none"
          style={{ color }}
        >
          {pct}%
        </span>
      </div>
      <div className="h-px w-full bg-[rgba(255,255,255,0.07)] relative overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}80, ${color})`,
          }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="font-mono text-[9px] text-[#374151]">NO</span>
        <span className="font-mono text-[9px] text-[#374151]">YES</span>
      </div>
    </div>
  );
}

export function EventFocusPanel({ event, onClose }: EventFocusPanelProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isVisible = !!event;
  const color = event ? CATEGORY_COLOR[event.category] ?? "#F59E0B" : "#F59E0B";

  function handleAnalyze() {
    onClose();
    // Give panel close animation time to start before routing
    setTimeout(() => router.push("/"), 100);
  }

  function handleMockSim() {
    router.push(`/simulation/${event?.simulationId ?? "mock"}`);
  }

  function handleReport() {
    router.push(`/reports/${event?.simulationId ?? "mock"}`);
  }

  return (
    <>
      {/* Backdrop: click to close */}
      <div
        className="fixed inset-0 z-20"
        style={{
          pointerEvents: isVisible ? "auto" : "none",
          background: isVisible ? "rgba(0,0,0,0.15)" : "transparent",
          transition: "background 0.4s ease",
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full z-30 flex flex-col"
        style={{
          width: "clamp(300px, 28vw, 400px)",
          background:
            "linear-gradient(180deg, rgba(10,10,18,0.97) 0%, rgba(8,8,14,0.99) 100%)",
          borderLeft: `1px solid ${isVisible ? color + "30" : "transparent"}`,
          transform: isVisible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.3s ease",
          backdropFilter: "blur(12px)",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {event && (
          <>
            {/* Top accent line */}
            <div
              className="h-0.5 w-full flex-shrink-0"
              style={{
                background: `linear-gradient(90deg, ${color}, transparent)`,
              }}
            />

            <div className="flex flex-col gap-6 p-6 flex-1">
              {/* Header */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="font-mono text-[9px] tracking-[0.25em] px-2 py-1"
                    style={{
                      color,
                      background: `${color}12`,
                      border: `1px solid ${color}25`,
                    }}
                  >
                    {CATEGORY_LABEL[event.category] ?? event.category.toUpperCase()}
                  </div>
                  <button
                    onClick={onClose}
                    className="font-mono text-[10px] tracking-widest text-[#4b5563] hover:text-[#9ca3af] transition-colors px-2 py-1"
                    aria-label="Close panel"
                  >
                    ✕ ESC
                  </button>
                </div>

                <h2
                  className="font-mono text-[18px] font-bold text-white leading-tight mb-1"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {event.title}
                </h2>
                <div className="font-mono text-[10px] text-[#4b5563] tracking-widest">
                  {event.region.toUpperCase()}
                  {event.volume && (
                    <span className="ml-3 text-[#374151]">
                      VOL ${(event.volume / 1e6).toFixed(1)}M
                    </span>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-[rgba(255,255,255,0.05)]" />

              {/* Market question */}
              <div>
                <div className="font-mono text-[9px] tracking-[0.25em] text-[#4b5563] mb-2">
                  MARKET QUESTION
                </div>
                <p className="font-mono text-[12px] text-[#c9d1d9] leading-relaxed">
                  {event.question}
                </p>
              </div>

              {/* Probability */}
              <ProbabilityBar probability={event.probability} />

              {/* Divider */}
              <div className="h-px bg-[rgba(255,255,255,0.05)]" />

              {/* What GodSEye does */}
              <div>
                <div className="font-mono text-[9px] tracking-[0.25em] text-[#4b5563] mb-3">
                  INTELLIGENCE ANALYSIS
                </div>
                <div className="flex flex-col gap-2 font-mono text-[10px] text-[#6b7280]">
                  {[
                    "12 expert agents debate the evidence",
                    "30 simulation ticks — belief convergence",
                    "Trust network + faction analysis",
                    "Final probability vs. market consensus",
                  ].map((line, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="w-1 h-1 flex-shrink-0"
                        style={{ background: color }}
                      />
                      {line}
                    </div>
                  ))}
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-2 mt-auto">
                {/* Primary: mock sim (always available) */}
                <button
                  onClick={handleMockSim}
                  className="w-full py-3 font-mono text-[11px] tracking-widest font-bold transition-all"
                  style={{
                    background: color,
                    color: "#0a0a0f",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.opacity = "0.88")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.opacity = "1")
                  }
                >
                  ▶ OPEN SIMULATION
                </button>

                {/* Secondary: view report */}
                <button
                  onClick={handleReport}
                  className="w-full py-2.5 font-mono text-[10px] tracking-widest transition-colors"
                  style={{
                    border: `1px solid ${color}35`,
                    color: "#9ca3af",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      color + "70";
                    (e.currentTarget as HTMLButtonElement).style.color = "#e5e7eb";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      color + "35";
                    (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af";
                  }}
                >
                  VIEW REPORT →
                </button>

                {/* Tertiary: import real market */}
                <button
                  onClick={handleAnalyze}
                  className="w-full py-2 font-mono text-[9px] tracking-widest text-[#4b5563] hover:text-[#6b7280] transition-colors"
                >
                  IMPORT FROM POLYMARKET
                </button>
              </div>
            </div>

            {/* Bottom accent */}
            <div
              className="h-px w-full flex-shrink-0"
              style={{
                background: `linear-gradient(90deg, transparent, ${color}20)`,
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
