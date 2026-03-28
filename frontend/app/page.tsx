"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import { GlobeProvider, useGlobe } from "@/components/GlobeContext";
import { FilterBar } from "@/components/FilterBar";
import { TimelineSlider } from "@/components/TimelineSlider";
import { EventPanel } from "@/components/EventPanel";
import type { GlobeEvent } from "@/lib/globeData";

// Three.js must not run in SSR
const GlobeScene = dynamic(() => import("@/components/GlobeScene"), {
  ssr: false,
  loading: () => <GlobeLoader />,
});

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
          fontFamily: "var(--font-mono)",
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
// Inner page — reads from GlobeContext
// ---------------------------------------------------------------------------

function GlobePage() {
  const {
    events,
    visibleIds,
    selectedEventId,
    setSelectedEventId,
    isAutoSpinning,
    stopAutoSpin,
  } = useGlobe();

  const activeEvent =
    events.find((e) => e.id === selectedEventId) ?? null;

  const handleEventSelect = useCallback(
    (event: GlobeEvent) => {
      stopAutoSpin();
      setSelectedEventId(event.id);
    },
    [setSelectedEventId, stopAutoSpin]
  );

  const handleFlyComplete = useCallback(() => {}, []);

  const panelOpen = !!selectedEventId;

  return (
    <main
      className="relative w-screen h-screen overflow-hidden"
      style={{ background: "#080810" }}
    >
      {/* Deep-space vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 65%, rgba(8,8,16,0.4) 100%)",
        }}
      />

      {/* Globe — full screen base layer */}
      <div className="absolute inset-0 z-0">
        <GlobeScene
          events={events}
          visibleIds={visibleIds}
          activeEvent={activeEvent}
          onEventSelect={handleEventSelect}
          onFlyComplete={handleFlyComplete}
          onInteraction={stopAutoSpin}
          isAutoSpinning={isAutoSpinning}
        />
      </div>

      {/* Header */}
      <header
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,5,9,0.8) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      >
        <div className="flex items-center gap-3" style={{ pointerEvents: "auto" }}>
          <div
            style={{
              width: 8,
              height: 8,
              background: "#F59E0B",
              boxShadow: "0 0 12px #F59E0B",
            }}
          />
          <div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
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
                fontFamily: "var(--font-mono)",
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

        <div
          style={{
            fontFamily: "var(--font-mono)",
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
          <span>{events.length} ACTIVE MARKETS</span>
          <span style={{ color: "#374151" }}>
            {new Date().toUTCString().slice(0, 16).toUpperCase()}
          </span>
        </div>
      </header>

      {/* Filter bar — top-center overlay */}
      <FilterBar />

      {/* Timeline slider — bottom overlay, shifts left when panel open */}
      <TimelineSlider rightOffset={panelOpen ? 400 : 0} />

      {/* Event panel — right slide-in */}
      <EventPanel />

      {/* Bottom hint — fades when panel open */}
      <div
        className="absolute bottom-0 left-0 z-10 pb-16 pl-6 pointer-events-none"
        style={{
          opacity: panelOpen ? 0 : 1,
          transition: "opacity 0.35s ease",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "#374151",
          }}
        >
          DRAG TO ROTATE · CLICK MARKER TO ANALYSE
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Export — wraps with provider
// ---------------------------------------------------------------------------

export default function Page() {
  return (
    <GlobeProvider>
      <GlobePage />
    </GlobeProvider>
  );
}
