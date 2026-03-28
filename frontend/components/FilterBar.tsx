"use client";

import { forwardRef, type CSSProperties } from "react";
import { useGlobe } from "./GlobeContext";
import { CATEGORY_COLOR, type GlobeEventCategory } from "@/lib/globeData";

const CATEGORIES: { key: GlobeEventCategory; label: string }[] = [
  { key: "monetary", label: "MONETARY" },
  { key: "geopolitical", label: "GEOPOLITICAL" },
  { key: "election", label: "ELECTION" },
  { key: "tech", label: "TECHNOLOGY" },
  { key: "energy", label: "ENERGY" },
  { key: "macro", label: "MACRO" },
];

export const FilterBar = forwardRef<
  HTMLDivElement,
  {
    dimmed?: boolean;
    style?: CSSProperties;
    onHoverChange?: (hovered: boolean) => void;
  }
>(function FilterBar({ dimmed = false, style, onHoverChange }, ref) {
  const { activeFilters, toggleFilter, setAllFilters } = useGlobe();
  const allActive = activeFilters.size === CATEGORIES.length;
  const noneActive = activeFilters.size === 0;

  return (
    <div
      ref={ref}
      className="absolute left-5 z-20 flex items-center gap-2 px-3 py-2 flex-wrap justify-start"
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      style={{
        top: 74,
        background: "rgba(5,5,9,0.88)",
        border: "1px solid var(--border-strong)",
        backdropFilter: "blur(8px)",
        maxWidth: "min(820px, calc(100vw - 480px))",
        borderRadius: 18,
        opacity: dimmed ? 0.16 : 1,
        transition: "opacity 0.18s ease",
        pointerEvents: "auto",
        ...style,
      }}
    >
      <button
        onClick={() => setAllFilters(true)}
        style={{
          ...chipBase,
          ...(allActive ? chipActive : chipInactive),
        }}
      >
        ALL
      </button>
      <button
        onClick={() => setAllFilters(false)}
        style={{
          ...chipBase,
          ...(noneActive ? chipActive : chipInactive),
        }}
      >
        NONE
      </button>

      <div style={{ width: 1, height: 14, background: "var(--border-strong)", margin: "0 2px" }} />

      {CATEGORIES.map(({ key, label }) => {
        const active = activeFilters.has(key);
        const color = CATEGORY_COLOR[key];
        return (
          <button
            key={key}
            onClick={() => toggleFilter(key)}
            style={{
              ...chipBase,
              color: active ? color : "var(--text-muted)",
              background: active ? `${color}12` : "transparent",
              border: `1px solid ${active ? `${color}66` : "var(--border)"}`,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: active ? color : "var(--border-strong)",
                marginRight: 6,
                verticalAlign: "middle",
              }}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
});

const chipBase: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.12em",
  padding: "3px 8px",
  cursor: "pointer",
  transition: "all 0.15s",
};

const chipActive: React.CSSProperties = {
  background: "var(--bg-raised)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

const chipInactive: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--text-muted)",
};
