"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import { GLOBE_EVENTS, type GlobeEvent, type GlobeEventCategory } from "@/lib/globeData";

// ---------------------------------------------------------------------------
// All categories present in mock data
// ---------------------------------------------------------------------------

const ALL_CATEGORIES: GlobeEventCategory[] = [
  "monetary",
  "geopolitical",
  "election",
  "tech",
  "energy",
  "macro",
];

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface GlobeContextValue {
  events: GlobeEvent[];

  // Filters
  activeFilters: Set<GlobeEventCategory>;
  toggleFilter: (cat: GlobeEventCategory) => void;
  setAllFilters: (active: boolean) => void;

  // Timeline
  timelineMin: Date | null;
  timelineMax: Date | null;
  timelinePosition: Date | null;
  setTimelinePosition: (d: Date) => void;

  // Derived visibility
  visibleIds: Set<string>;

  // Selection
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;

  // Camera focus
  globeFocusTarget: { lat: number; lng: number } | null;
  setGlobeFocusTarget: (t: { lat: number; lng: number } | null) => void;

  // Auto-spin
  isAutoSpinning: boolean;
  stopAutoSpin: () => void;
}

const GlobeContext = createContext<GlobeContextValue | null>(null);

const AUTO_SPIN_RESUME_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function GlobeProvider({ children }: { children: ReactNode }) {
  const [events] = useState<GlobeEvent[]>(GLOBE_EVENTS);
  const [activeFilters, setActiveFilters] = useState<Set<GlobeEventCategory>>(
    new Set(ALL_CATEGORIES)
  );
  const [timelinePosition, setTimelinePositionRaw] = useState<Date | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [globeFocusTarget, setGlobeFocusTarget] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isAutoSpinning, setIsAutoSpinning] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive timeline bounds from event start_times
  const timelineMin = useMemo(() => {
    const times = events
      .map((e) => (e.start_time ? new Date(e.start_time).getTime() : 0))
      .filter(Boolean);
    return times.length ? new Date(Math.min(...times)) : null;
  }, [events]);

  const timelineMax = useMemo(() => {
    const times = events
      .map((e) => (e.start_time ? new Date(e.start_time).getTime() : 0))
      .filter(Boolean);
    return times.length ? new Date(Math.max(...times)) : null;
  }, [events]);

  // Initialise timeline position to max (show all events)
  useEffect(() => {
    if (timelineMax && !timelinePosition) {
      setTimelinePositionRaw(timelineMax);
    }
  }, [timelineMax, timelinePosition]);

  // Derived: which events pass the current filter + timeline
  const visibleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const evt of events) {
      if (!activeFilters.has(evt.category)) continue;
      if (
        timelinePosition &&
        evt.start_time &&
        new Date(evt.start_time) > timelinePosition
      )
        continue;
      ids.add(evt.id);
    }
    return ids;
  }, [events, activeFilters, timelinePosition]);

  const stopAutoSpin = useCallback(() => {
    setIsAutoSpinning(false);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(
      () => setIsAutoSpinning(true),
      AUTO_SPIN_RESUME_MS
    );
  }, []);

  const toggleFilter = useCallback(
    (cat: GlobeEventCategory) => {
      stopAutoSpin();
      setActiveFilters((prev) => {
        const next = new Set(prev);
        next.has(cat) ? next.delete(cat) : next.add(cat);
        return next;
      });
    },
    [stopAutoSpin]
  );

  const setAllFilters = useCallback(
    (active: boolean) => {
      stopAutoSpin();
      setActiveFilters(active ? new Set(ALL_CATEGORIES) : new Set());
    },
    [stopAutoSpin]
  );

  const setTimelinePosition = useCallback(
    (d: Date) => {
      stopAutoSpin();
      setTimelinePositionRaw(d);
    },
    [stopAutoSpin]
  );

  return (
    <GlobeContext.Provider
      value={{
        events,
        activeFilters,
        toggleFilter,
        setAllFilters,
        timelineMin,
        timelineMax,
        timelinePosition,
        setTimelinePosition,
        visibleIds,
        selectedEventId,
        setSelectedEventId,
        globeFocusTarget,
        setGlobeFocusTarget,
        isAutoSpinning,
        stopAutoSpin,
      }}
    >
      {children}
    </GlobeContext.Provider>
  );
}

export function useGlobe(): GlobeContextValue {
  const ctx = useContext(GlobeContext);
  if (!ctx) throw new Error("useGlobe must be used inside GlobeProvider");
  return ctx;
}
