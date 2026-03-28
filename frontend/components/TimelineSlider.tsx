"use client";

import { forwardRef, useEffect, useRef, useState, useCallback, type CSSProperties } from "react";
import { useGlobe } from "./GlobeContext";

function fmt(d: Date): string {
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const TimelineSlider = forwardRef<
  HTMLDivElement,
  {
    rightOffset?: number;
    wide?: boolean;
    style?: CSSProperties;
  }
>(function TimelineSlider({ rightOffset = 0, wide = false, style }, ref) {
  const { timelineMin, timelineMax, timelinePosition, setTimelinePosition } =
    useGlobe();
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const minMs = timelineMin?.getTime() ?? 0;
  const maxMs = timelineMax?.getTime() ?? 0;
  const range = maxMs - minMs || 1;
  const currentMs = timelinePosition?.getTime() ?? maxMs;
  const pct = ((currentMs - minMs) / range) * 100;

  const stopPlay = useCallback(() => {
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPlay = useCallback(() => {
    if (isPlaying) return;
    setIsPlaying(true);
    if (currentMs >= maxMs) {
      setTimelinePosition(new Date(minMs), { preserveAutoSpin: true });
    }
  }, [isPlaying, currentMs, maxMs, minMs, setTimelinePosition]);

  const currentMsRef = useRef(currentMs);
  currentMsRef.current = currentMs;

  useEffect(() => {
    if (!isPlaying) return;
    const step = range / 120;
    intervalRef.current = setInterval(() => {
      const next = currentMsRef.current + step;
      if (next >= maxMs) {
        setIsPlaying(false);
        setTimelinePosition(new Date(maxMs), { preserveAutoSpin: true });
      } else {
        setTimelinePosition(new Date(next), { preserveAutoSpin: true });
      }
    }, 150);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, minMs, maxMs, range, setTimelinePosition]);

  if (!timelineMin || !timelineMax) return null;

  return (
    <div
      ref={ref}
      className="absolute left-0 z-20 px-5"
      style={{
        right: rightOffset + 20,
        bottom: 20,
        transition: "right 0.38s cubic-bezier(0.4, 0, 0.2, 1)",
        ...style,
      }}
    >
      <div
        style={{
          width: wide ? "100%" : "min(860px, 100%)",
          background: "rgba(9, 13, 21, 0.86)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 26,
          padding: "14px 16px 16px",
          backdropFilter: "blur(18px)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
        }}
      >
        <div
          className="mb-3 flex items-center justify-between gap-3"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>Event timeline</span>
          {timelinePosition && (
            <span
              style={{
                color: "var(--text-primary)",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 999,
                padding: "6px 10px",
              }}
            >
              {fmt(timelinePosition)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={isPlaying ? stopPlay : startPlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            style={{
              width: 42,
              height: 42,
              flexShrink: 0,
              background: isPlaying ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${isPlaying ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.14)"}`,
              color: isPlaying ? "var(--accent)" : "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              borderRadius: 999,
              boxShadow: isPlaying ? "0 0 18px rgba(245,158,11,0.15)" : "none",
              transition: "all 0.18s ease",
            }}
          >
            {isPlaying ? (
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20">
                <rect x="5" y="4" width="3" height="12" rx="0.8" />
                <rect x="12" y="4" width="3" height="12" rx="0.8" />
              </svg>
            ) : (
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div
              className="mb-2 flex justify-between gap-3"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                color: "var(--text-muted)",
                textTransform: "uppercase",
              }}
            >
              <span>{fmt(timelineMin)}</span>
              <span>{fmt(timelineMax)}</span>
            </div>

            <div
              className="relative flex items-center"
              style={{ height: 28 }}
            >
              <div
                className="absolute"
                style={{
                  top: "50%",
                  left: 0,
                  right: 0,
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.12)",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              />
              <div
                className="absolute"
                style={{
                  top: "50%",
                  left: 0,
                  width: `${pct}%`,
                  height: 4,
                  borderRadius: 999,
                  background: "linear-gradient(90deg, rgba(245,158,11,0.95) 0%, rgba(251,191,36,0.72) 100%)",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  boxShadow: "0 0 14px rgba(245,158,11,0.25)",
                }}
              />
              <input
                type="range"
                min={minMs}
                max={maxMs}
                value={currentMs}
                onChange={(e) => setTimelinePosition(new Date(Number(e.target.value)))}
                className="relative w-full cursor-pointer bg-transparent"
                style={{ WebkitAppearance: "none", appearance: "none", height: 28, margin: 0 }}
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: #f8fafc;
          border: 3px solid #f59e0b;
          box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.12);
          cursor: pointer;
        }
        input[type='range']::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: #f8fafc;
          border: 3px solid #f59e0b;
          box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.12);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
});
