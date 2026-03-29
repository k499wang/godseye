"use client";

import dynamic from "next/dynamic";
import { forwardRef, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useGlobe } from "@/components/GlobeContext";
import { FilterBar } from "@/components/FilterBar";
import { TimelineSlider } from "@/components/TimelineSlider";
import { EventPanel } from "@/components/EventPanel";
import { GlobeSearch } from "@/components/GlobeSearch";
import { GodseyeLogo } from "@/components/GodseyeLogo";
import { WalletButton } from "@/components/WalletButton";
import { CATEGORY_COLOR } from "@/lib/globeData";
import type { GlobeEvent } from "@/lib/globeData";

const GlobeScene = dynamic(() => import("@/components/GlobeScene"), {
  ssr: false,
  loading: () => <GlobeLoader />,
});

type PageMode = "intro" | "explore" | "timeline";

export function GlobeHomePage({
  initialMode,
  initialSelectedEventId,
}: {
  initialMode: Exclude<PageMode, "timeline">;
  initialSelectedEventId: string | null;
}) {
  const router = useRouter();
  const {
    events,
    visibleIds,
    selectedEventId,
    setSelectedEventId,
    globeFocusTarget,
    setGlobeFocusTarget,
    isAutoSpinning,
    autoSpinEnabled,
    setAutoSpinEnabled,
    setIsZoomedIn,
    stopAutoSpin,
  } = useGlobe();

  const [mode, setMode] = useState<PageMode>(initialMode);
  const [showCountryBorders, setShowCountryBorders] = useState(true);
  const [showControlsMenu, setShowControlsMenu] = useState(false);
  const [filterHovered, setFilterHovered] = useState(false);
  const [topChromeHovered, setTopChromeHovered] = useState(false);
  const [topControlsOverlap, setTopControlsOverlap] = useState(false);

  const controlsMenuRef = useRef<HTMLDivElement | null>(null);
  const filterBarRef = useRef<HTMLDivElement | null>(null);
  const topRightRef = useRef<HTMLDivElement | null>(null);
  const exploreSnapshotRef = useRef<{
    selectedEventId: string | null;
    focusTarget: { lat: number; lng: number } | null;
  } | null>(null);

  const activeEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const inIntro = mode === "intro";
  const inExplore = mode === "explore";
  const inTimeline = mode === "timeline";
  const panelOpen = inExplore && !!selectedEventId;

  const marketCountTone =
    events.length >= 12
      ? "var(--success)"
      : events.length >= 6
        ? "var(--accent)"
        : "#93c5fd";
  const marketCountLabel =
    events.length >= 12 ? "High coverage" : events.length >= 6 ? "Active set" : "Limited set";

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const updateOverlap = () => {
      const filterRect = filterBarRef.current?.getBoundingClientRect();
      const topRightRect = topRightRef.current?.getBoundingClientRect();

      if (!filterRect || !topRightRect || inIntro) {
        setTopControlsOverlap(false);
        return;
      }

      const overlaps =
        filterRect.left < topRightRect.right &&
        filterRect.right > topRightRect.left &&
        filterRect.top < topRightRect.bottom &&
        filterRect.bottom > topRightRect.top;

      setTopControlsOverlap(overlaps);
    };

    const frame = requestAnimationFrame(updateOverlap);
    const resizeObserver = new ResizeObserver(() => updateOverlap());

    if (filterBarRef.current) resizeObserver.observe(filterBarRef.current);
    if (topRightRef.current) resizeObserver.observe(topRightRef.current);

    window.addEventListener("resize", updateOverlap);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateOverlap);
    };
  }, [inIntro, inTimeline, panelOpen, showControlsMenu]);

  useEffect(() => {
    if (!showControlsMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!controlsMenuRef.current?.contains(event.target as Node)) {
        setShowControlsMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showControlsMenu]);

  useEffect(() => {
    if (!inExplore) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.code === "Space" || event.key === " ")) return;

      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTypingTarget) return;

      event.preventDefault();
      setAutoSpinEnabled(!autoSpinEnabled);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [autoSpinEnabled, inExplore, setAutoSpinEnabled]);

  useEffect(() => {
    if (!initialSelectedEventId) {
      setSelectedEventId(null);
      setGlobeFocusTarget(null);
      return;
    }

    const matchedEvent = events.find((event) => event.id === initialSelectedEventId);
    if (!matchedEvent) return;

    setMode("explore");
    stopAutoSpin();
    setSelectedEventId(matchedEvent.id);
    setGlobeFocusTarget({ lat: matchedEvent.lat, lng: matchedEvent.lng });
  }, [
    events,
    initialSelectedEventId,
    setGlobeFocusTarget,
    setSelectedEventId,
    stopAutoSpin,
  ]);

  const handleExplore = useCallback(() => {
    setMode("explore");
    router.replace("/?mode=explore", { scroll: false });
  }, [router]);

  const handleEnterTimeline = useCallback(() => {
    exploreSnapshotRef.current = {
      selectedEventId,
      focusTarget: globeFocusTarget,
    };
    setShowControlsMenu(false);
    setMode("timeline");
    setSelectedEventId(null);
    setGlobeFocusTarget(null);
  }, [globeFocusTarget, selectedEventId, setGlobeFocusTarget, setSelectedEventId]);

  const handleExitTimeline = useCallback(() => {
    const snapshot = exploreSnapshotRef.current;
    setMode("explore");
    setSelectedEventId(snapshot?.selectedEventId ?? null);
    setGlobeFocusTarget(snapshot?.focusTarget ?? null);
  }, [setGlobeFocusTarget, setSelectedEventId]);

  const handleBack = useCallback(() => {
    setSelectedEventId(null);
    setGlobeFocusTarget(null);
    router.replace("/?mode=explore", { scroll: false });
  }, [router, setGlobeFocusTarget, setSelectedEventId]);

  const handleEventSelect = useCallback(
    (event: GlobeEvent) => {
      setSelectedEventId(event.id);
      setGlobeFocusTarget({ lat: event.lat, lng: event.lng });

      if (mode === "timeline") return;

      stopAutoSpin();
      setMode("explore");
      router.replace(`/?mode=explore&event=${encodeURIComponent(event.id)}`, {
        scroll: false,
      });
    },
    [mode, router, setSelectedEventId, setGlobeFocusTarget, stopAutoSpin]
  );

  const handleSearchSelect = useCallback(
    (event: GlobeEvent) => {
      setSelectedEventId(event.id);
      setGlobeFocusTarget({ lat: event.lat, lng: event.lng });

      if (mode === "timeline") return;

      stopAutoSpin();
      setMode("explore");
      router.replace(`/?mode=explore&event=${encodeURIComponent(event.id)}`, {
        scroll: false,
      });
    },
    [mode, router, setSelectedEventId, setGlobeFocusTarget, stopAutoSpin]
  );

  const dimTopControls = topControlsOverlap && !topChromeHovered;
  const dimFilterBar = topControlsOverlap && !filterHovered;
  const showTopChrome = inExplore || inTimeline;

  return (
    <main
      className="relative h-screen w-screen overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse 90% 65% at 18% 28%, rgba(45,12,90,0.55) 0%, transparent 55%),
          radial-gradient(ellipse 65% 50% at 82% 72%, rgba(10,35,100,0.45) 0%, transparent 52%),
          radial-gradient(ellipse 45% 35% at 58% 5%, rgba(65,15,65,0.3) 0%, transparent 48%),
          radial-gradient(ellipse 100% 100% at 50% 50%, #0c0c22 0%, #06060f 60%, #030309 100%)
        `.replace(/\s+/g, " "),
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 68%, rgba(6,6,18,0.5) 100%)",
        }}
      />

      <div className="absolute inset-0 z-0">
        <GlobeScene
          events={events}
          visibleIds={visibleIds}
          activeEvent={activeEvent}
          onEventSelect={handleEventSelect}
          showCountryBorders={showCountryBorders}
          onFlyComplete={() => undefined}
          onInteraction={stopAutoSpin}
          onZoomChange={setIsZoomedIn}
          isAutoSpinning={inTimeline ? false : isAutoSpinning}
        />
      </div>

      {inIntro && <IntroPanel onExplore={handleExplore} />}

      <header
        className="absolute left-0 right-0 top-0 z-20 px-5 py-4"
        style={{
          background:
            "linear-gradient(180deg, rgba(13,17,25,0.72) 0%, rgba(13,17,25,0.08) 70%, transparent 100%)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 18,
          }}
        >
          <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 14 }}>
            {inTimeline ? (
              <button type="button" onClick={handleExitTimeline} style={backButtonStyle}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to globe
              </button>
            ) : (
              <>
                {inExplore && panelOpen && (
                  <button type="button" onClick={handleBack} style={backButtonStyle}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleExplore}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                  aria-label="Go to explore mode"
                >
                  <GodseyeLogo
                    subtitle={inIntro ? "Prediction market intelligence" : undefined}
                    size="sm"
                  />
                </button>
              </>
            )}
          </div>

          {showTopChrome && (
            <div
              ref={topRightRef}
              onMouseEnter={() => setTopChromeHovered(true)}
              onMouseLeave={() => setTopChromeHovered(false)}
              style={{
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: 16,
                opacity: dimTopControls ? 0.16 : 1,
                transition: "opacity 0.18s ease",
              }}
            >
              <GlobeSearch onSelect={handleSearchSelect} />
              <WalletButton />
              {inExplore && (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.16em",
                    color: "var(--text-primary)",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    textTransform: "uppercase",
                  }}
                >
                  <span
                    style={{
                      padding: "7px 12px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <span style={{ color: "var(--success)" }}>●</span> Live
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 12px",
                      borderRadius: 999,
                      background: `${marketCountTone}14`,
                      border: `1px solid ${marketCountTone}55`,
                      color: marketCountTone,
                      backdropFilter: "blur(8px)",
                      boxShadow: `0 0 18px ${marketCountTone}1f`,
                    }}
                    title={marketCountLabel}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: marketCountTone,
                        boxShadow: `0 0 10px ${marketCountTone}`,
                      }}
                    />
                    {events.length} markets
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {showTopChrome && (
        <FilterBar
          ref={filterBarRef}
          dimmed={dimFilterBar}
          onHoverChange={setFilterHovered}
          style={
            inTimeline
              ? {
                  top: 78,
                  left: 118,
                  maxWidth: "min(760px, calc(100vw - 470px))",
                }
              : undefined
          }
        />
      )}

      {inExplore && (
        <>
          <EventPanel />
          <ControlsMenu
            ref={controlsMenuRef}
            open={showControlsMenu}
            onToggleOpen={() => setShowControlsMenu((previous) => !previous)}
            autoSpinEnabled={autoSpinEnabled}
            isAutoSpinning={isAutoSpinning}
            onAutoSpinChange={setAutoSpinEnabled}
            showCountryBorders={showCountryBorders}
            onCountryBordersChange={setShowCountryBorders}
            onTimelineSelect={handleEnterTimeline}
          />
        </>
      )}

      {inTimeline && (
        <TimelineSlider
          wide
          style={{
            left: 0,
            right: 0,
            bottom: 20,
          }}
        />
      )}
    </main>
  );
}

function GlobeLoader() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "1.5px solid rgba(245,158,11,0.15)",
          borderTop: "1.5px solid var(--accent)",
          animation: "spin 1s linear infinite",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        Initialising globe
      </span>
    </div>
  );
}

function IntroPanel({ onExplore }: { onExplore: () => void }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "clamp(92px, 18vh, 156px)",
        left: 40,
        transform: "none",
        width: 380,
        maxWidth: "calc(100vw - 32px)",
        zIndex: 30,
        animation: "slideInLeft 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards",
      }}
    >
      <div
        className="surface-card"
        style={{
          padding: "30px 30px 26px",
          backdropFilter: "blur(22px)",
          background: "rgba(13,17,25,0.82)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: "var(--accent)",
            marginBottom: 14,
            textTransform: "uppercase",
          }}
        >
          Quick start
        </div>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 36,
            fontWeight: 700,
            color: "var(--text-bright)",
            margin: "0 0 12px",
            lineHeight: 1.04,
            letterSpacing: "-0.05em",
          }}
        >
          GodSEye
        </h1>

        <p
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "var(--text-primary)",
            margin: "0 0 10px",
            lineHeight: 1.7,
          }}
        >
          Your prediction markets, made legible.
        </p>

        <p
          style={{
            fontSize: 15,
            color: "var(--text-secondary)",
            margin: "0 0 20px",
            lineHeight: 1.8,
          }}
        >
          Explore global market hotspots, open a market, and follow how simulated
          forecasters debate their way toward a new consensus.
        </p>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            margin: "0 0 24px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Try searching "Taiwan" or "Fed rates"
        </p>

        <button
          type="button"
          onClick={onExplore}
          style={{
            width: "100%",
            padding: "13px 20px",
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.4)",
            borderRadius: 999,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--accent)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = "rgba(245,158,11,0.18)";
            event.currentTarget.style.boxShadow = "0 0 20px rgba(245,158,11,0.18)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = "rgba(245,158,11,0.1)";
            event.currentTarget.style.boxShadow = "none";
          }}
        >
          Explore markets
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px 12px",
            marginTop: 22,
            paddingTop: 18,
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {(
            [
              ["monetary", "Monetary"],
              ["geopolitical", "Geopolitical"],
              ["election", "Election"],
              ["tech", "Technology"],
              ["energy", "Energy"],
              ["macro", "Macro"],
            ] as const
          ).map(([category, label]) => (
            <span
              key={category}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: CATEGORY_COLOR[category],
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: CATEGORY_COLOR[category],
                  display: "inline-block",
                }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const ControlsMenu = forwardRef<
  HTMLDivElement,
  {
    open: boolean;
    onToggleOpen: () => void;
    autoSpinEnabled: boolean;
    isAutoSpinning: boolean;
    onAutoSpinChange: (enabled: boolean) => void;
    showCountryBorders: boolean;
    onCountryBordersChange: (enabled: boolean) => void;
    onTimelineSelect: () => void;
  }
>(function ControlsMenu(
  {
    open,
    onToggleOpen,
    autoSpinEnabled,
    isAutoSpinning,
    onAutoSpinChange,
    showCountryBorders,
    onCountryBordersChange,
    onTimelineSelect,
  },
  ref
) {
  const rotationStatus = !autoSpinEnabled
    ? "Rotation disabled"
    : isAutoSpinning
      ? "Rotation active"
      : "Paused while you interact";

  const rotationStatusColor = !autoSpinEnabled
    ? "var(--text-muted)"
    : isAutoSpinning
      ? "var(--success)"
      : "var(--accent)";

  return (
    <div
      ref={ref}
      className="absolute bottom-0 left-0 z-30"
      style={{
        padding: "0 20px 110px",
        pointerEvents: "auto",
      }}
    >
      {open && (
        <div
          className="surface-card"
          style={{
            width: 286,
            padding: "16px 16px 14px",
            marginBottom: 14,
            background: "rgba(10, 14, 23, 0.9)",
            backdropFilter: "blur(18px)",
            boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
            animation: "fadeIn 0.22s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--text-primary)",
                }}
              >
                Globe controls
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: rotationStatusColor,
                }}
              >
                {rotationStatus}
              </div>
            </div>

            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: rotationStatusColor,
                boxShadow: `0 0 16px ${rotationStatusColor}`,
                flexShrink: 0,
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <SwitchRow
              label="Auto-rotation"
              description="Keep the globe moving in the standard explore view."
              checked={autoSpinEnabled}
              onChange={onAutoSpinChange}
            />
            <SwitchRow
              label="Country borders"
              description="Show or hide the softer national outlines over the globe."
              checked={showCountryBorders}
              onChange={onCountryBordersChange}
            />
          </div>

          <button
            type="button"
            onClick={onTimelineSelect}
            style={{
              width: "100%",
              marginTop: 12,
              padding: "12px 14px",
              borderRadius: 16,
              border: "1px solid rgba(245,158,11,0.22)",
              background: "rgba(245,158,11,0.08)",
              color: "var(--accent)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            Open timeline view
          </button>

          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid rgba(255,255,255,0.08)",
              fontSize: 13,
              lineHeight: 1.7,
              color: "var(--text-secondary)",
            }}
          >
            Drag to rotate, click a marker to analyse, and open timeline view for the
            scrub-only historical layout.
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onToggleOpen}
        aria-label={open ? "Close globe controls" : "Open globe controls"}
        aria-expanded={open}
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: "rgba(12, 16, 26, 0.88)",
          border: "1px solid rgba(255,255,255,0.14)",
          color: "var(--text-bright)",
          cursor: "pointer",
          backdropFilter: "blur(12px)",
          boxShadow: open
            ? "0 0 0 1px rgba(245,158,11,0.18), 0 18px 36px rgba(0,0,0,0.28)"
            : "0 14px 32px rgba(0,0,0,0.24)",
          transition: "all 0.18s ease",
        }}
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
          <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h13M21 17h-2" />
          <circle cx="16" cy="7" r="2" fill="currentColor" stroke="none" />
          <circle cx="8" cy="12" r="2" fill="currentColor" stroke="none" />
          <circle cx="19" cy="17" r="2" fill="currentColor" stroke="none" />
        </svg>
      </button>
    </div>
  );
});

function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 14,
        padding: "12px 12px 11px",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        background: checked ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--text-primary)",
            marginBottom: 5,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--text-secondary)",
          }}
        >
          {description}
        </div>
      </div>

      <span
        aria-hidden="true"
        style={{
          position: "relative",
          width: 44,
          height: 24,
          flexShrink: 0,
          borderRadius: 999,
          marginTop: 1,
          background: checked ? "rgba(16,185,129,0.34)" : "rgba(148,163,184,0.2)",
          border: `1px solid ${checked ? "rgba(16,185,129,0.42)" : "rgba(148,163,184,0.16)"}`,
          transition: "all 0.18s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 22 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: checked ? "#dcfce7" : "#e5e7eb",
            boxShadow: checked ? "0 0 14px rgba(16,185,129,0.2)" : "none",
            transition: "left 0.18s ease, background 0.18s ease",
          }}
        />
      </span>
    </button>
  );
}

const backButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 14px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 999,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--text-primary)",
  cursor: "pointer",
  backdropFilter: "blur(8px)",
};
