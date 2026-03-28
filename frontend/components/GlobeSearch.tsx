"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { GLOBE_EVENTS, CATEGORY_COLOR, type GlobeEvent } from "@/lib/globeData";

const SUGGESTIONS = [
  "Fed",
  "inflation",
  "oil",
  "election",
  "Taiwan",
  "rates",
  "Bitcoin",
  "Gaza",
  "tariffs",
  "China",
  "Ukraine",
  "OPEC",
];

function searchEvents(query: string): GlobeEvent[] {
  const value = query.trim().toLowerCase();
  if (!value) return [];

  return GLOBE_EVENTS.filter(
    (event) =>
      event.title.toLowerCase().includes(value) ||
      event.region.toLowerCase().includes(value) ||
      event.category.toLowerCase().includes(value) ||
      event.question.toLowerCase().includes(value)
  ).slice(0, 5);
}

export function GlobeSearch({
  onSelect,
}: {
  onSelect: (event: GlobeEvent) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const interval = setInterval(
      () => setPlaceholderIndex((index) => (index + 1) % SUGGESTIONS.length),
      2800
    );
    return () => clearInterval(interval);
  }, []);

  const results = searchEvents(query);
  const showDropdown = focused && (results.length > 0 || query.length > 0);

  const handleSelect = useCallback(
    (event: GlobeEvent) => {
      setQuery("");
      setFocused(false);
      onSelect(event);
    },
    [onSelect]
  );

  return (
    <div style={{ position: "relative", width: 320, maxWidth: "72vw" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          background: focused ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${
            focused ? "rgba(245,158,11,0.34)" : "rgba(255,255,255,0.12)"
          }`,
          borderRadius: 999,
          backdropFilter: "blur(16px)",
          boxShadow: focused ? "0 0 24px rgba(245,158,11,0.12)" : "none",
          transition: "all 0.2s ease",
        }}
      >
        <svg
          width="15"
          height="15"
          fill="none"
          stroke={focused ? "#f59e0b" : "#8b97ab"}
          strokeWidth="2"
          viewBox="0 0 24 24"
          style={{ flexShrink: 0, transition: "stroke 0.2s" }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>

        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 160)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setQuery("");
              setFocused(false);
              inputRef.current?.blur();
            }

            if (event.key === "Enter" && results.length > 0) {
              handleSelect(results[0]);
            }
          }}
          placeholder={`Search "${SUGGESTIONS[placeholderIndex]}"`}
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
            width: "100%",
            caretColor: "var(--accent)",
          }}
        />

        {query && (
          <button
            onClick={() => setQuery("")}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            x
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "rgba(13,17,25,0.98)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 18,
            backdropFilter: "blur(18px)",
            overflow: "hidden",
            zIndex: 100,
            boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
          }}
        >
          {results.length === 0 ? (
            <div
              className="ui-mono"
              style={{
                padding: "14px 16px",
                fontSize: 12,
                color: "var(--text-muted)",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              No markets found
            </div>
          ) : (
            results.map((event, index) => (
              <button
                key={event.id}
                onMouseDown={() => handleSelect(event)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 16px",
                  background: "transparent",
                  border: "none",
                  borderBottom:
                    index < results.length - 1
                      ? "1px solid rgba(255,255,255,0.06)"
                      : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  transition: "background 0.12s",
                }}
                onMouseEnter={(target) => {
                  target.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={(target) => {
                  target.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: CATEGORY_COLOR[event.category],
                    flexShrink: 0,
                    boxShadow: `0 0 10px ${CATEGORY_COLOR[event.category]}66`,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {event.title}
                  </div>
                  <div
                    className="ui-mono"
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      letterSpacing: "0.14em",
                      marginTop: 3,
                      textTransform: "uppercase",
                    }}
                  >
                    {event.region} . {event.category}
                  </div>
                </div>
                {event.probability != null && (
                  <span
                    className="ui-mono"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: CATEGORY_COLOR[event.category],
                      flexShrink: 0,
                    }}
                  >
                    {Math.round(event.probability * 100)}%
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
