# GodSEye Globe-First Redesign — Design Spec

**Date:** 2026-03-28
**Owner:** Person 4 (Frontend)
**Status:** Approved

---

## Overview

Redesign the GodSEye Next.js frontend so the globe is the persistent base layer and all primary interaction happens through overlays — modelled on the Argus reference architecture but keeping GodSEye's visual identity (amber/emerald on near-black, IBM Plex Mono) and simulation/report depth.

---

## Decisions

| Topic | Decision |
|---|---|
| Globe renderer | Keep custom R3F globe (`GlobeScene.tsx`) — more visually sophisticated than react-globe.gl |
| Overlay pattern | FilterBar (top-center) + TimelineSlider (bottom) + EventPanel (right) |
| Sim/Report integration | Hybrid: globe overlays for discovery, separate routes (`/simulation/[id]`, `/reports/[id]`) for full analysis |
| Event panel content | Hybrid: hero image + confidence + summary (intel brief) + probability row + CTAs (market signal) |
| Data source | Real backend API (`/content/points`, `/content/arcs`) with mock fallback |
| Category types | GodSEye's 5 types: monetary, geopolitical, tech, energy, macro |
| Color palette | GodSEye: amber `#F59E0B`, emerald `#10B981`, cyan `#06B6D4`, red `#EF4444`, orange `#F97316` |
| Font | IBM Plex Mono (unchanged) |
| Auto-spin | Stops on user interaction, resumes after 5 minutes of inactivity |

---

## Architecture

### Component Tree

```
app/page.tsx  (GlobeProvider wraps everything)
  ├── GlobeScene          — full-screen R3F canvas, z-index 0
  ├── Header              — top-left wordmark + live status (existing, unchanged)
  ├── FilterBar           — top-center, z-index 20
  ├── TimelineSlider      — bottom, z-index 20
  ├── EventPanel          — right slide-in, z-index 30
  └── scanline overlay    — pointer-events none, z-index 50
```

### State: GlobeContext

```ts
interface GlobeContextValue {
  // Data
  events: GlobeEvent[]
  arcs: ArcData[]

  // Filtering
  activeFilters: Set<GlobeEventCategory>
  toggleFilter: (cat: GlobeEventCategory) => void
  setAllFilters: (active: boolean) => void

  // Timeline
  timelineMin: Date | null
  timelineMax: Date | null
  timelinePosition: Date | null
  setTimelinePosition: (d: Date) => void

  // Derived: IDs of events currently passing filter + timeline
  visibleIds: Set<string>

  // Selection
  selectedEventId: string | null
  setSelectedEventId: (id: string | null) => void

  // Globe camera
  globeFocusTarget: { lat: number; lng: number } | null
  setGlobeFocusTarget: (t: { lat: number; lng: number } | null) => void

  // Auto-spin
  isAutoSpinning: boolean
  stopAutoSpin: () => void
}
```

`visibleIds` is derived inside the provider (useMemo) from events + activeFilters + timelinePosition — never passed as raw state.

---

## Components

### `components/GlobeContext.tsx` (new)

- `GlobeProvider` wraps `app/page.tsx`
- On mount: fetches `/content/points` and `/content/arcs` from the backend; falls back to `GLOBE_EVENTS` mock data if the request fails (so dev still works without a running backend)
- Derives `visibleIds` from `events`, `activeFilters`, and `timelinePosition`
- Auto-spin timer: 5-minute inactivity timeout resets `isAutoSpinning` to true

### `components/FilterBar.tsx` (new)

- `position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 20`
- Reads/writes `activeFilters` from context
- Chips: All · None · separator · Monetary · Geopolitical · Tech · Energy · Macro
- Active chip: colored bg tint + border matching category color
- Inactive chip: transparent bg, muted border
- Clicking any chip calls `stopAutoSpin()`

### `components/TimelineSlider.tsx` (new)

- `position: absolute; bottom: 0; left: 0; right: 0; z-index: 20`
- Gradient fade from `rgba(5,5,9,0.97)` to transparent
- Date labels: min · current · max
- Play/pause button (square, 28×28) + range input scrubber
- Playback: 120 steps across the date range, 150ms per step
- Initialises to `timelineMax` (show all events) on mount
- Slider thumb: rectangular (no border-radius), `#c0c0c0`
- Right edge respects EventPanel width (shifts left by 400px when panel is open)

### `components/EventPanel.tsx` (new — replaces `EventFocusPanel`)

- `position: absolute; top: 0; right: 0; height: 100%; width: 400px; z-index: 30`
- `transform: translateX(100%)` when closed, `translateX(0)` when open — `transition: 0.25s ease`
- Sections (top to bottom):
  1. **Hero** (160px) — `image_url` / `image_s3_url` with `saturate(0.7) brightness(0.75)` filter; fallback gradient; category badge bottom-left
  2. **Title** — bold, `#f0f0f0`
  3. **Meta** — lat/lng + date, muted
  4. **Confidence** — 1px bar, green fill, `confidence_score` value
  5. **Summary** — from `/content/{id}` detail fetch, expandable at 3 lines
  6. **Market Signal** (conditional) — shown if event has a linked prediction market question; probability bar + question text in amber
  7. **Divider**
  8. **CTAs** — "↗ Open Simulation" (amber, navigates to `/simulation/{simulationId}` if `simulationId` is non-null, otherwise navigates to `/` with the event pre-loaded into `MarketImport` for the user to kick off a new simulation); "View Report" (same — navigates to `/reports/{simulationId}` if available, else hidden). For mock `GLOBE_EVENTS` data, `simulationId` is populated so CTAs always work in dev.
  9. **Related events** — from arc connections in context; clicking one calls `setSelectedEventId` + `setGlobeFocusTarget`
- Close button: top-left, `×`
- Keyboard: `Escape` closes

### `components/GlobeScene.tsx` (modified)

New props added:
```ts
interface GlobeSceneProps {
  events: GlobeEvent[]
  visibleIds: Set<string>        // new — controls marker opacity/size
  activeEvent: GlobeEvent | null
  onEventSelect: (e: GlobeEvent) => void
  onFlyComplete: () => void
  onInteraction: () => void      // new — calls stopAutoSpin
}
```

- Markers receive `visibleIds`: hidden markers get `opacity: 0, pointerEvents: none` (not removed — avoids R3F remount flicker)
- `onInteraction` fires on OrbitControls `onStart` event
- `autoRotate` driven by `isAutoSpinning` prop from page

### `app/page.tsx` (modified)

Stripped down to:
```tsx
<GlobeProvider>
  <main className="relative w-screen h-screen overflow-hidden" style={{ background: '#050509' }}>
    <div className="absolute inset-0 z-0"><GlobeScene ... /></div>
    <Header />                   {/* existing header markup, z-20 */}
    <FilterBar />                {/* z-20 */}
    <TimelineSlider />           {/* z-20 */}
    <EventPanel />               {/* z-30 */}
    <ScanlineOverlay />          {/* z-50, pointer-events none */}
  </main>
</GlobeProvider>
```

---

## Data Mapping

Backend `/content/points` returns `ContentPoint[]`:
```ts
{ id, title, event_type, latitude, longitude, published_at, image_url, s3_url }
```

Mapped to `GlobeEvent`:
```ts
{
  id, title,
  category: mapEventTypeToCategory(event_type),   // e.g. financial_markets → monetary
  lat: latitude, lng: longitude,
  region: '',           // not in backend — omit or derive from coords
  question: '',         // not in backend — omit unless prediction market data available
  probability: null,    // null = hide Market Signal section in panel
  simulationId: null,   // real backend events have no pre-existing simulation; CTAs adapt (see EventPanel spec)
  image_url, image_s3_url: s3_url,
  confidence_score: 0.5,  // backend doesn't return this; default to 0.5 for all real events
}
```

Event type mapping:
| Backend `event_type` | GodSEye category |
|---|---|
| `financial_markets` | `monetary` |
| `geopolitics` | `geopolitical` |
| `policy_regulation` | `geopolitical` |
| `trade_supply_chain` | `macro` |
| `energy_commodities` | `energy` |
| `climate_disasters` | `macro` |
| `tech` (if present) | `tech` |

---

## Files Unchanged

- `components/SimulationReplay.tsx`
- `components/BeliefChart.tsx`
- `components/AgentDebateFeed.tsx`
- `components/TrustNetwork.tsx`
- `components/MarketImport.tsx`
- `app/simulation/[id]/page.tsx`
- `app/reports/[id]/page.tsx`
- `lib/types.ts`
- `lib/mockData.ts`
- `lib/constants.ts`
- `next.config.ts`

---

## Files Deleted

- `components/EventFocusPanel.tsx` — replaced by `EventPanel.tsx`

---

## CSS / Global Styles

Add to `globals.css`:
- CSS variables: `--bg-base`, `--bg-surface`, `--bg-raised`, `--border`, `--border-strong`, `--text-bright`, `--text-primary`, `--text-secondary`, `--text-muted` — mirrors Argus values but adapted to GodSEye dark palette
- Range input thumb styles (rectangular, for TimelineSlider)
- Thin scrollbar (3px) for EventPanel scroll

---

## Error Handling

- Backend unavailable: fall back to `GLOBE_EVENTS` mock data silently — globe still renders with mock markers
- Event detail fetch fails: EventPanel still shows from context data (title, lat/lng, category), Summary section simply hidden
- Image load fails: fallback to gradient hero background
