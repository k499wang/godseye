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
import { GLOBE_EVENTS, browseItemToGlobeEvent, type GlobeEvent, type GlobeEventCategory } from "@/lib/globeData";
import { browseMarkets, refreshMarkets } from "@/lib/api";

const ALL_CATEGORIES: GlobeEventCategory[] = [
  "monetary",
  "geopolitical",
  "election",
  "tech",
  "energy",
  "macro",
];

interface GlobeContextValue {
  events: GlobeEvent[];
  isLoadingEvents: boolean;
  refreshEvents: () => Promise<void>;
  activeFilters: Set<GlobeEventCategory>;
  toggleFilter: (cat: GlobeEventCategory) => void;
  setAllFilters: (active: boolean) => void;
  timelineMin: Date | null;
  timelineMax: Date | null;
  timelinePosition: Date | null;
  setTimelinePosition: (
    date: Date,
    options?: { preserveAutoSpin?: boolean }
  ) => void;
  visibleIds: Set<string>;
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
  globeFocusTarget: { lat: number; lng: number } | null;
  setGlobeFocusTarget: (target: { lat: number; lng: number } | null) => void;
  isAutoSpinning: boolean;
  autoSpinEnabled: boolean;
  isZoomedIn: boolean;
  setIsZoomedIn: (value: boolean) => void;
  stopAutoSpin: () => void;
  setAutoSpinEnabled: (enabled: boolean) => void;
}

const GlobeContext = createContext<GlobeContextValue | null>(null);

const AUTO_SPIN_RESUME_MS = 6000;

export function GlobeProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<GlobeEvent[]>(GLOBE_EVENTS);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  useEffect(() => {
    let cancelled = false;
    browseMarkets()
      .then((res) => {
        if (!cancelled) setEvents(res.markets.map(browseItemToGlobeEvent));
      })
      .catch(() => {/* keep GLOBE_EVENTS fallback on failure */});
    return () => { cancelled = true; };
  }, []);

  const refreshEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    try {
      const res = await refreshMarkets();
      setEvents(res.markets.map(browseItemToGlobeEvent));
    } catch {
      // keep current events on failure
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);
  const [activeFilters, setActiveFilters] = useState<Set<GlobeEventCategory>>(
    new Set(ALL_CATEGORIES)
  );
  const [timelinePosition, setTimelinePositionRaw] = useState<Date | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [globeFocusTarget, setGlobeFocusTarget] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [autoSpinEnabled, setAutoSpinEnabledState] = useState(true);
  const [isAutoSpinning, setIsAutoSpinning] = useState(true);
  const [isZoomedIn, setIsZoomedInState] = useState(false);

  const isZoomedInRef = useRef(false);
  const autoSpinEnabledRef = useRef(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timelineMin = useMemo(() => {
    const times = events
      .map((event) => (event.start_time ? new Date(event.start_time).getTime() : 0))
      .filter(Boolean);
    return times.length ? new Date(Math.min(...times)) : null;
  }, [events]);

  const timelineMax = useMemo(() => {
    const times = events
      .map((event) => (event.start_time ? new Date(event.start_time).getTime() : 0))
      .filter(Boolean);
    return times.length ? new Date(Math.max(...times)) : null;
  }, [events]);

  useEffect(() => {
    if (timelineMax && !timelinePosition) {
      setTimelinePositionRaw(timelineMax);
    }
  }, [timelineMax, timelinePosition]);

  const visibleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const event of events) {
      if (!activeFilters.has(event.category)) continue;
      if (
        timelinePosition &&
        event.start_time &&
        new Date(event.start_time) > timelinePosition
      ) {
        continue;
      }
      ids.add(event.id);
    }
    return ids;
  }, [events, activeFilters, timelinePosition]);

  const clearResumeTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
  }, []);

  const scheduleResume = useCallback(() => {
    if (!autoSpinEnabledRef.current) return;
    clearResumeTimer();
    inactivityTimer.current = setTimeout(() => {
      if (autoSpinEnabledRef.current && !isZoomedInRef.current) {
        setIsAutoSpinning(true);
      }
    }, AUTO_SPIN_RESUME_MS);
  }, [clearResumeTimer]);

  const stopAutoSpin = useCallback(() => {
    setIsAutoSpinning(false);

    if (!autoSpinEnabledRef.current) {
      clearResumeTimer();
      return;
    }

    if (!isZoomedInRef.current) {
      scheduleResume();
    } else {
      clearResumeTimer();
    }
  }, [clearResumeTimer, scheduleResume]);

  const setAutoSpinEnabled = useCallback(
    (enabled: boolean) => {
      autoSpinEnabledRef.current = enabled;
      setAutoSpinEnabledState(enabled);
      clearResumeTimer();

      if (enabled && !isZoomedInRef.current) {
        setIsAutoSpinning(true);
      } else {
        setIsAutoSpinning(false);
      }
    },
    [clearResumeTimer]
  );

  const setIsZoomedIn = useCallback(
    (zoomed: boolean) => {
      isZoomedInRef.current = zoomed;
      setIsZoomedInState(zoomed);

      if (zoomed) {
        setIsAutoSpinning(false);
        clearResumeTimer();
      } else if (autoSpinEnabledRef.current) {
        scheduleResume();
      }
    },
    [clearResumeTimer, scheduleResume]
  );

  const toggleFilter = useCallback(
    (category: GlobeEventCategory) => {
      stopAutoSpin();
      setActiveFilters((previous) => {
        const next = new Set(previous);
        next.has(category) ? next.delete(category) : next.add(category);
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
    (date: Date, options?: { preserveAutoSpin?: boolean }) => {
      if (!options?.preserveAutoSpin) {
        stopAutoSpin();
      }
      setTimelinePositionRaw(date);
    },
    [stopAutoSpin]
  );

  return (
    <GlobeContext.Provider
      value={{
        events,
        isLoadingEvents,
        refreshEvents,
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
        autoSpinEnabled,
        isZoomedIn,
        setIsZoomedIn,
        stopAutoSpin,
        setAutoSpinEnabled,
      }}
    >
      {children}
    </GlobeContext.Provider>
  );
}

export function useGlobe(): GlobeContextValue {
  const context = useContext(GlobeContext);
  if (!context) throw new Error("useGlobe must be used inside GlobeProvider");
  return context;
}
