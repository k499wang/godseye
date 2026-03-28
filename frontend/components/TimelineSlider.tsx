"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useGlobe } from "./GlobeContext";

function fmt(d: Date): string {
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function TimelineSlider({ rightOffset = 0 }: { rightOffset?: number }) {
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
    if (currentMs >= maxMs) setTimelinePosition(new Date(minMs));
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
        setTimelinePosition(new Date(maxMs));
      } else {
        setTimelinePosition(new Date(next));
      }
    }, 150);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, minMs, maxMs, range, setTimelinePosition]);

  if (!timelineMin || !timelineMax) return null;

  return (
    <div
      className="absolute bottom-0 left-0 z-20 px-5 pb-5 pt-8"
      style={{
        right: rightOffset,
        background:
          "linear-gradient(to top, rgba(5,5,9,0.97) 0%, transparent 100%)",
      }}
    >
      {/* Date labels */}
      <div
        className="flex justify-between mb-2 px-1"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.1em",
          color: "var(--text-muted)",
        }}
      >
        <span>{fmt(timelineMin)}</span>
        {timelinePosition && (
          <span style={{ color: "var(--text-secondary)" }}>
            {fmt(timelinePosition)}
          </span>
        )}
        <span>{fmt(timelineMax)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={isPlaying ? stopPlay : startPlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          style={{
            width: 28,
            height: 28,
            flexShrink: 0,
            background: "var(--bg-raised)",
            border: "1px solid var(--border-strong)",
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {isPlaying ? (
            <svg width="11" height="11" fill="currentColor" viewBox="0 0 20 20">
              <rect x="5" y="4" width="3" height="12" />
              <rect x="12" y="4" width="3" height="12" />
            </svg>
          ) : (
            <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div
          className="relative flex-1"
          style={{ height: 20, display: "flex", alignItems: "center" }}
        >
          {/* Track */}
          <div
            className="absolute"
            style={{
              top: "50%",
              left: 0,
              right: 0,
              height: 1,
              background: "var(--border-strong)",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          />
          {/* Progress fill */}
          <div
            className="absolute"
            style={{
              top: "50%",
              left: 0,
              width: `${pct}%`,
              height: 1,
              background: "var(--text-secondary)",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          />
          <input
            type="range"
            min={minMs}
            max={maxMs}
            value={currentMs}
            onChange={(e) => setTimelinePosition(new Date(Number(e.target.value)))}
            className="relative w-full bg-transparent cursor-pointer"
            style={{ WebkitAppearance: "none", appearance: "none", height: 20, margin: 0 }}
          />
        </div>
      </div>

      <style>{`
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 8px;
          height: 16px;
          border-radius: 0;
          background: #c0c0c0;
          border: 1px solid #444444;
          cursor: pointer;
        }
        input[type='range']::-moz-range-thumb {
          width: 8px;
          height: 16px;
          border-radius: 0;
          background: #c0c0c0;
          border: 1px solid #444444;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
