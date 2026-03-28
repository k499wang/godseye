"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGlobe } from "./GlobeContext";
import { CATEGORY_COLOR } from "@/lib/globeData";

export function EventPanel() {
  const { events, selectedEventId, setSelectedEventId, stopAutoSpin } =
    useGlobe();
  const router = useRouter();

  const event = events.find((e) => e.id === selectedEventId) ?? null;
  const isOpen = !!selectedEventId;
  const color = event ? CATEGORY_COLOR[event.category] : "#F59E0B";
  const confidence = event?.confidence_score ?? 0.5;

  const close = useCallback(
    () => setSelectedEventId(null),
    [setSelectedEventId]
  );

  // Keyboard close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [close]);

  return (
    <div
      className="absolute top-0 right-0 h-full z-30 pointer-events-none"
      style={{ width: 400, maxWidth: "100vw" }}
    >
      <div
        className="h-full w-full pointer-events-auto overflow-y-auto"
        style={{
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border-strong)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease",
        }}
      >
        {/* Close */}
        <button
          onClick={close}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 10,
            width: 28,
            height: 28,
            background: "var(--bg-raised)",
            border: "1px solid var(--border-strong)",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="square"
              strokeLinejoin="miter"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {event && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* Hero */}
            <div
              style={{
                position: "relative",
                height: 160,
                flexShrink: 0,
                overflow: "hidden",
                background: `linear-gradient(135deg, ${color}18 0%, #050509 100%)`,
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
                    filter: "saturate(0.7) brightness(0.75)",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(to top, rgba(5,5,9,0.95) 0%, transparent 55%)",
                }}
              />
              {/* Category badge */}
              <span
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 16,
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  padding: "2px 8px",
                  background: `${color}18`,
                  border: `1px solid ${color}66`,
                  color,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: color,
                    marginRight: 6,
                    verticalAlign: "middle",
                  }}
                />
                {event.category.toUpperCase()}
              </span>
            </div>

            {/* Body */}
            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Title */}
              <h2
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--text-bright)",
                  lineHeight: 1.4,
                  margin: 0,
                }}
              >
                {event.title}
              </h2>

              {/* Meta */}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  color: "var(--text-muted)",
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <span>
                  {event.lat.toFixed(1)}°, {event.lng.toFixed(1)}°
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

              {/* Confidence */}
              <div>
                <div style={sectionLabel}>CONFIDENCE</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 6,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: "var(--border-strong)",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.round(confidence * 100)}%`,
                        background:
                          confidence >= 0.75
                            ? "#5a8a5a"
                            : confidence >= 0.55
                            ? "#8a7a3a"
                            : "#8a3030",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.05em",
                      color:
                        confidence >= 0.75
                          ? "#5a8a5a"
                          : confidence >= 0.55
                          ? "#8a7a3a"
                          : "#8a3030",
                    }}
                  >
                    {Math.round(confidence * 100)}%
                  </span>
                </div>
              </div>

              {/* Market question */}
              {event.question && (
                <div>
                  <div style={sectionLabel}>MARKET QUESTION</div>
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--text-secondary)",
                      lineHeight: 1.6,
                      margin: "6px 0 0",
                    }}
                  >
                    {event.question}
                  </p>
                </div>
              )}

              {/* Market signal */}
              {event.probability != null && (
                <div>
                  <div style={sectionLabel}>MARKET SIGNAL</div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: "var(--text-muted)",
                      margin: "6px 0 4px",
                    }}
                  >
                    <span>Current probability</span>
                    <span style={{ color }}>
                      {Math.round(event.probability * 100)}%
                    </span>
                  </div>
                  <div
                    style={{ height: 2, background: "var(--border-strong)" }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${event.probability * 100}%`,
                        background: color,
                      }}
                    />
                  </div>
                  {event.volume && (
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 8,
                        color: "var(--text-muted)",
                        marginTop: 4,
                        letterSpacing: "0.1em",
                      }}
                    >
                      VOL ${(event.volume / 1_000_000).toFixed(1)}M
                    </div>
                  )}
                </div>
              )}

              <div style={{ height: 1, background: "var(--border)" }} />

              {/* CTAs */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {event.simulationId ? (
                  <>
                    <button
                      onClick={() => {
                        stopAutoSpin();
                        router.push(`/simulation/${event.simulationId}`);
                      }}
                      style={{
                        ...ctaBase,
                        borderColor: `${color}66`,
                        color,
                        background: `${color}0d`,
                      }}
                    >
                      ↗ OPEN SIMULATION
                    </button>
                    <button
                      onClick={() => {
                        stopAutoSpin();
                        router.push(`/reports/${event.simulationId}`);
                      }}
                      style={ctaBase}
                    >
                      VIEW REPORT
                    </button>
                  </>
                ) : (
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: "var(--text-muted)",
                      letterSpacing: "0.1em",
                      margin: 0,
                    }}
                  >
                    No simulation linked — import this market to begin.
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

const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 8,
  letterSpacing: "0.18em",
  color: "var(--text-muted)",
  textTransform: "uppercase",
};

const ctaBase: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.12em",
  padding: "9px 14px",
  background: "var(--bg-raised)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};
