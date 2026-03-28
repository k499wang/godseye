"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import { EventFocusPanel } from "@/components/EventFocusPanel";
import { GLOBE_EVENTS } from "@/lib/globeData";
import type { GlobeEvent } from "@/lib/globeData";

// Three.js must not run in SSR
const GlobeScene = dynamic(() => import("@/components/GlobeScene"), {
  ssr: false,
  loading: () => <GlobeLoader />,
});

// ---------------------------------------------------------------------------
// Loading state while canvas initialises
// ---------------------------------------------------------------------------

function GlobeLoader() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "1.5px solid rgba(245,158,11,0.15)",
          borderTop: "1.5px solid #F59E0B",
          animation: "spin 1s linear infinite",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 10,
          letterSpacing: "0.3em",
          color: "#4b5563",
        }}
      >
        INITIALISING GLOBE
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend pill
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { key: "monetary", label: "MONETARY", color: "#F59E0B" },
  { key: "geopolitical", label: "GEOPOLITICAL", color: "#EF4444" },
  { key: "tech", label: "TECHNOLOGY", color: "#06B6D4" },
  { key: "energy", label: "ENERGY", color: "#10B981" },
  { key: "macro", label: "MACRO", color: "#F97316" },
] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GlobePage() {
  const [activeEvent, setActiveEvent] = useState<GlobeEvent | null>(null);
  const handleEventSelect = useCallback((event: GlobeEvent) => {
    setActiveEvent(event);
  }, []);

  const handleClose = useCallback(() => {
    setActiveEvent(null);
  }, []);

  const handleFlyComplete = useCallback(() => {
    // fly complete — reserved for future use (e.g. triggering panel entrance)
  }, []);

  return (
    <main
      className="relative w-full h-screen overflow-hidden"
      style={{ background: "#050509" }}
    >
      {/* ── Deep-space vignette ── */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(5,5,9,0.75) 100%)",
        }}
      />

      {/* ── Globe canvas ── */}
      <div className="absolute inset-0 z-0">
        <GlobeScene
          events={GLOBE_EVENTS}
          activeEvent={activeEvent}
          onEventSelect={handleEventSelect}
          onFlyComplete={handleFlyComplete}
        />
      </div>

      {/* ── Header ── */}
      <header
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,5,9,0.8) 0%, transparent 100%)",
        }}
      >
        {/* Wordmark */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              style={{
                width: 8,
                height: 8,
                background: "#F59E0B",
                boxShadow: "0 0 12px #F59E0B",
              }}
            />
          </div>
          <div>
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.3em",
                color: "#F59E0B",
              }}
            >
              GODSEYE
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 9,
                letterSpacing: "0.25em",
                color: "#374151",
                display: "block",
                marginTop: 1,
              }}
            >
              PREDICTION MARKET INTELLIGENCE
            </span>
          </div>
        </div>

        {/* Status bar */}
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "#4b5563",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span>
            <span style={{ color: "#10B981" }}>●</span> LIVE
          </span>
          <span>{GLOBE_EVENTS.length} ACTIVE MARKETS</span>
          <span style={{ color: "#374151" }}>
            {new Date().toUTCString().slice(0, 16).toUpperCase()}
          </span>
        </div>
      </header>

      {/* ── Bottom legend + hint ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex items-end justify-between px-6 py-5"
        style={{
          background:
            "linear-gradient(0deg, rgba(5,5,9,0.85) 0%, transparent 100%)",
          pointerEvents: activeEvent ? "none" : "auto",
          opacity: activeEvent ? 0 : 1,
          transition: "opacity 0.35s ease",
        }}
      >
        {/* Category legend */}
        <div className="flex items-center gap-4 flex-wrap">
          {CATEGORIES.map((cat) => (
            <div
              key={cat.key}
              className="flex items-center gap-1.5"
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 9,
                letterSpacing: "0.2em",
                color: "#6b7280",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: cat.color,
                  boxShadow: `0 0 4px ${cat.color}`,
                }}
              />
              {cat.label}
            </div>
          ))}
        </div>

        {/* Interaction hint */}
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "#374151",
            textAlign: "right",
          }}
        >
          DRAG TO ROTATE · CLICK MARKER TO ANALYSE
        </div>
      </div>

      {/* ── Event focus panel ── */}
      <EventFocusPanel event={activeEvent} onClose={handleClose} />

      {/* ── Scanline overlay (subtle texture) ── */}
      <div
        className="absolute inset-0 pointer-events-none z-50"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.012) 3px, rgba(0,0,0,0.012) 4px)",
        }}
      />
    </main>
  );
}
