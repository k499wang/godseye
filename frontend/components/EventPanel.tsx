"use client";

import axios from "axios";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useGlobe } from "./GlobeContext";
import { CATEGORY_COLOR } from "@/lib/globeData";
import { buildWorld, generateClaims, getPolymarketQuote, importMarket } from "@/lib/api";

export function EventPanel() {
  const {
    events,
    selectedEventId,
    setSelectedEventId,
    setGlobeFocusTarget,
    stopAutoSpin,
    refreshEvents,
  } = useGlobe();
  const router = useRouter();
  const [isActionPending, setIsActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [liveProbability, setLiveProbability] = useState<number | null | undefined>(undefined);
  const [isResolvingLiveProbability, setIsResolvingLiveProbability] = useState(false);

  const event = events.find((entry) => entry.id === selectedEventId) ?? null;
  const isOpen = !!selectedEventId;
  const color = event ? CATEGORY_COLOR[event.category] : "#f59e0b";
  const probability = event?.probability ?? liveProbability ?? null;
  const confidence = event?.confidence_score ?? probability;

  const close = useCallback(() => {
    setSelectedEventId(null);
    setGlobeFocusTarget(null);
  }, [setGlobeFocusTarget, setSelectedEventId]);

  useEffect(() => {
    const handler = (eventKey: KeyboardEvent) => {
      if (eventKey.key === "Escape") close();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [close]);

  useEffect(() => {
    setActionError(null);
    setIsActionPending(false);
  }, [selectedEventId]);

  useEffect(() => {
    setIsDemoMode(false);
  }, [selectedEventId]);

  useEffect(() => {
    let cancelled = false;

    setLiveProbability(undefined);
    setIsResolvingLiveProbability(false);

    if (!event?.marketUrl) return;
    if (event.confidence_score != null || event.probability != null) return;

    setIsResolvingLiveProbability(true);

    void getPolymarketQuote(event.marketUrl)
      .then((quote) => {
        if (!cancelled) {
          setLiveProbability(quote.probability);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLiveProbability(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsResolvingLiveProbability(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [event?.confidence_score, event?.marketUrl, event?.probability]);

  const primaryActionLabel = useMemo(() => {
    if (!event) return "";
    if (event.simulationId) return "Open simulation";
    if (event.sessionId) return "Start simulation";
    return "Import and start simulation";
  }, [event]);

  const handlePrimaryAction = useCallback(async () => {
    if (!event || isActionPending) return;

    if (event.simulationId) {
      stopAutoSpin();
      router.push(
        `/simulation/${event.simulationId}?event=${encodeURIComponent(event.id)}${isDemoMode ? "&demo=1" : ""}`
      );
      return;
    }

    setActionError(null);
    setIsActionPending(true);

    try {
      let sessionId = event.sessionId;
      let marketId = event.marketId;

      if (!sessionId) {
        const imported = await importMarket(event.marketUrl);
        sessionId = imported.session_id;
        marketId = imported.id;
      }

      if (!marketId) {
        throw new Error("Imported market is missing its market id.");
      }

      await generateClaims(marketId);
      const builtSimulation = await buildWorld(sessionId, { demo: isDemoMode });
      stopAutoSpin();
      router.push(
        `/simulation/${builtSimulation.id}?event=${encodeURIComponent(event.id)}${isDemoMode ? "&demo=1" : ""}`
      );
      void refreshEvents();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        if (typeof detail === "string") {
          setActionError(detail);
        } else if (typeof detail?.detail === "string") {
          setActionError(detail.detail);
        } else {
          setActionError(error.message || "Could not start the simulation for this market.");
        }
      } else if (error instanceof Error) {
        setActionError(error.message);
      } else {
        setActionError("Could not start the simulation for this market.");
      }
    } finally {
      setIsActionPending(false);
    }
  }, [event, isActionPending, isDemoMode, refreshEvents, router, stopAutoSpin]);

  return (
    <div
      className="pointer-events-none absolute right-0 top-0 z-30 h-full"
      style={{ width: 430, maxWidth: "100vw" }}
    >
      <div
        className="pointer-events-auto h-full w-full overflow-y-auto"
        style={{
          paddingTop: 8,
          background: "linear-gradient(180deg, rgba(13,17,25,0.97) 0%, rgba(8,11,18,0.99) 100%)",
          borderLeft: "1px solid var(--border-strong)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.34)",
          overscrollBehaviorY: "contain",
          scrollbarGutter: "stable",
        }}
      >
        <button
          onClick={close}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 10,
            width: 34,
            height: 34,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 999,
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        {event && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                position: "relative",
                height: 172,
                flexShrink: 0,
                overflow: "hidden",
                background: `linear-gradient(135deg, ${color}22 0%, rgba(5,7,13,0.94) 100%)`,
              }}
            >
              {event.image_url && (
                <img
                  src={event.image_url}
                  alt={event.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    filter: "saturate(0.7) brightness(0.72)",
                  }}
                  onError={(image) => {
                    (image.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}

              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(to top, rgba(5,7,13,0.96) 0%, rgba(5,7,13,0.28) 55%, transparent 100%)",
                }}
              />

              <div style={{ position: "absolute", left: 24, right: 24, bottom: 22 }}>
                <span
                  className="ui-mono"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: `${color}14`,
                    border: `1px solid ${color}66`,
                    color,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: color,
                    }}
                  />
                  {event.category}
                </span>
              </div>
            </div>

            <div
              style={{
                padding: "18px 22px 42px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "var(--text-bright)",
                    lineHeight: 1.15,
                    letterSpacing: "-0.03em",
                    margin: 0,
                  }}
                >
                  {event.title}
                </h2>
                <div
                  className="ui-mono"
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    display: "flex",
                    gap: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    {event.lat.toFixed(1)} deg, {event.lng.toFixed(1)} deg
                  </span>
                  {event.region && <span>{event.region}</span>}
                  {event.start_time && (
                    <span>
                      {new Date(event.start_time).toLocaleDateString("en-CA", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
              </div>

              <PanelSection label="Confidence">
                {confidence != null ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                    <div
                      style={{
                        flex: 1,
                        height: 8,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.08)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round(confidence * 100)}%`,
                          borderRadius: 999,
                          background:
                            confidence >= 0.75
                              ? "var(--success)"
                              : confidence >= 0.55
                                ? "var(--accent)"
                                : "var(--danger)",
                        }}
                      />
                    </div>
                    <span
                      className="ui-mono"
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color:
                          confidence >= 0.75
                            ? "var(--success)"
                            : confidence >= 0.55
                              ? "var(--accent)"
                              : "var(--danger)",
                      }}
                    >
                      {Math.round(confidence * 100)}%
                    </span>
                  </div>
                ) : (
                  <div
                    className="ui-mono"
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: isResolvingLiveProbability
                        ? "var(--text-muted)"
                        : "var(--danger)",
                    }}
                  >
                    {isResolvingLiveProbability
                      ? "Fetching live Polymarket probability"
                      : "Live probability unavailable"}
                  </div>
                )}
              </PanelSection>

              {!event.simulationId && (
                <PanelSection label="Launch mode">
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      marginTop: 10,
                      padding: "14px 16px",
                      borderRadius: 18,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      cursor: isActionPending ? "default" : "pointer",
                      opacity: isActionPending ? 0.7 : 1,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span
                        className="ui-mono"
                        style={{
                          fontSize: 11,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "var(--text-bright)",
                        }}
                      >
                        Demo mode
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          lineHeight: 1.5,
                          color: "var(--text-secondary)",
                        }}
                      >
                        Uses fallback agent profiles and runs a shorter 10-tick simulation.
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-pressed={isDemoMode}
                      disabled={isActionPending}
                      onClick={() => setIsDemoMode((value) => !value)}
                      style={{
                        position: "relative",
                        width: 56,
                        height: 32,
                        flexShrink: 0,
                        borderRadius: 999,
                        border: `1px solid ${isDemoMode ? `${color}88` : "rgba(255,255,255,0.14)"}`,
                        background: isDemoMode ? `${color}22` : "rgba(255,255,255,0.06)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 3,
                          left: isDemoMode ? 27 : 3,
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: isDemoMode ? color : "rgba(255,255,255,0.82)",
                          transition: "left 0.2s ease, background 0.2s ease",
                        }}
                      />
                    </button>
                  </label>
                </PanelSection>
              )}

              {event.question && (
                <PanelSection label="Market question">
                  <p style={bodyCopy}>{event.question}</p>
                </PanelSection>
              )}

              {probability != null && (
                <PanelSection label="Market signal">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 14,
                      color: "var(--text-secondary)",
                      margin: "8px 0 8px",
                    }}
                  >
                    <span>Current probability</span>
                    <span style={{ color, fontWeight: 700 }}>{Math.round(probability * 100)}%</span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${probability * 100}%`,
                          background: color,
                          borderRadius: 999,
                        }}
                    />
                  </div>
                  {event.volume && (
                    <div
                      className="ui-mono"
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                      }}
                    >
                      Volume ${(event.volume / 1_000_000).toFixed(1)}M
                    </div>
                  )}
                </PanelSection>
              )}

              <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={handlePrimaryAction}
                  disabled={isActionPending}
                  style={{
                    ...primaryButton,
                    borderColor: `${color}66`,
                    color,
                    background: `${color}12`,
                    opacity: isActionPending ? 0.7 : 1,
                    cursor: isActionPending ? "wait" : "pointer",
                  }}
                >
                  {isActionPending ? "Launching simulation..." : primaryActionLabel}
                </button>

                {event.simulationId ? (
                  <>
                    {event.simulationStatus === "complete" && (
                      <button
                        onClick={() => {
                          stopAutoSpin();
                          router.push(
                            `/reports/${event.simulationId}?event=${encodeURIComponent(event.id)}`
                          );
                        }}
                        style={secondaryButton}
                      >
                        View report
                      </button>
                    )}
                  </>
                ) : (
                  <p className="ui-mono" style={{ fontSize: 12, letterSpacing: "0.14em", color: "var(--text-muted)", margin: 0, textTransform: "uppercase" }}>
                    {event.isImported
                      ? "Imported and ready. Start a simulation for this market."
                      : "Live Polymarket market. Import it to start a simulation."}
                  </p>
                )}

                {actionError && (
                  <p
                    className="ui-mono"
                    style={{
                      fontSize: 12,
                      letterSpacing: "0.08em",
                      color: "var(--danger)",
                      margin: 0,
                    }}
                  >
                    {actionError}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PanelSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div style={sectionLabel}>{label}</div>
      {children}
    </div>
  );
}

const sectionLabel: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.18em",
  color: "var(--text-muted)",
  textTransform: "uppercase",
};

const bodyCopy: CSSProperties = {
  fontSize: 16,
  color: "var(--text-secondary)",
  lineHeight: 1.75,
  margin: "8px 0 0",
};

const primaryButton: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  padding: "13px 16px",
  background: "rgba(245,158,11,0.08)",
  border: "1px solid rgba(245,158,11,0.28)",
  borderRadius: 999,
  color: "var(--accent)",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};

const secondaryButton: CSSProperties = {
  ...primaryButton,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "var(--text-primary)",
};
