"use client";

import { ReactNode, use, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useRouter } from "next/navigation";
import { getPaperTrading, getReport, getSimulation } from "@/lib/api";
import { GodseyeLogo } from "@/components/GodseyeLogo";
import { PaperTradeDrawer } from "@/components/PaperTradeDrawer";
import { MOCK_PAPER_TRADING, MOCK_REPORT, MOCK_MARKET } from "@/lib/mockData";

export default function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ event?: string; trade?: string }>;
}) {
  const { id } = use(params);
  const resolvedSearchParams = use(searchParams);
  const router = useRouter();
  const isMock = id === "mock";
  const openTradeFromQuery = resolvedSearchParams.trade === "1";
  const selectedEventId =
    typeof resolvedSearchParams.event === "string" ? resolvedSearchParams.event : null;
  const backHref = selectedEventId
    ? `/?mode=explore&event=${encodeURIComponent(selectedEventId)}`
    : "/?mode=explore";
  const simulationHref = selectedEventId
    ? `/simulation/${id}?event=${encodeURIComponent(selectedEventId)}`
    : `/simulation/${id}`;

  const { data, isLoading, error } = useQuery({
    queryKey: ["report", id],
    queryFn: () => getReport(id),
    enabled: !isMock,
    retry: false,
    refetchInterval: (query) => {
      if (isMock) return false;
      if (query.state.data) return false;
      const err = query.state.error;
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return 2000;
      }
      return false;
    },
  });
  const { data: simulation } = useQuery({
    queryKey: ["simulation-for-report", id],
    queryFn: () => getSimulation(id),
    enabled: !isMock && !data,
    retry: false,
    refetchInterval: (query) => {
      if (query.state.data?.status === "complete" && !data) return 2000;
      if (
        query.state.data?.status === "running" ||
        query.state.data?.status === "building" ||
        query.state.data?.status === "pending"
      ) {
        return 2000;
      }
      return false;
    },
  });

  const report = isMock ? MOCK_REPORT : data;
  const [isTradeDrawerOpen, setIsTradeDrawerOpen] = useState(openTradeFromQuery);
  const {
    data: paperTradingData,
    refetch: refetchPaperTrading,
  } = useQuery({
    queryKey: ["paper-trading", report?.id],
    queryFn: () => getPaperTrading(report!.id),
    enabled: !!report && !isMock,
  });

  useEffect(() => {
    if (openTradeFromQuery) {
      setIsTradeDrawerOpen(true);
    }
  }, [openTradeFromQuery]);

  const storyBeats = useMemo(
    () => toStoryBeats(report?.summary ?? "", report?.key_drivers ?? [], 3),
    [report?.summary, report?.key_drivers],
  );
  const factionBeats = useMemo(
    () => splitIntoBeats(report?.faction_analysis ?? "", 3),
    [report?.faction_analysis],
  );
  const trustBeats = useMemo(
    () => splitIntoBeats(report?.trust_insights ?? "", 3),
    [report?.trust_insights],
  );
  const recommendationBeat = useMemo(
    () => oneLine(report?.recommendation ?? "", 170),
    [report?.recommendation],
  );

  if (!isMock && isLoading) {
    return (
      <BackendLoadState
        title="Hydrating report"
        detail="Fetching final simulation snapshot and report record."
        phase="fetch"
        simulationStatus={simulation?.status}
      />
    );
  }

  const waitingForReport =
    !isMock &&
    !report &&
    (
      isLoading ||
      simulation?.status === "running" ||
      simulation?.status === "building" ||
      simulation?.status === "pending" ||
      simulation?.status === "complete"
    );

  if (waitingForReport) {
    return (
      <BackendLoadState
        title="Assembling briefing"
        detail="Simulation is complete, waiting for final report materialization. Auto-refreshing every 2s."
        phase="render"
        simulationStatus={simulation?.status}
        action={
          <button
            onClick={() => router.push(simulationHref)}
<<<<<<< HEAD
            className="ui-mono mt-6 border border-white/15 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
=======
            className="ui-mono mt-5 rounded-full border border-white/15 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
>>>>>>> de28969a2a3f4c523abfa31ab12644db298dba6d
          >
            Back to simulation
          </button>
        }
      />
    );
  }

  if ((!isMock && error) || !report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-6">
        <div className="surface-card w-full max-w-lg p-8 text-center">
          <div className="eyebrow mb-4 text-[var(--danger)]">Report unavailable</div>
          <h1 className="mb-3 text-3xl font-semibold tracking-tight text-[var(--text-bright)]">
            We could not load this briefing.
          </h1>
          <p className="mx-auto max-w-md text-base leading-7 text-[var(--text-secondary)]">
            The report endpoint is either still wiring up or this simulation does not
            have a completed report yet.
          </p>
          <button
            onClick={() => router.push(backHref)}
            className="ui-mono mt-6 border border-white/15 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Back to market
          </button>
        </div>
      </div>
    );
  }

  const marketQuestion = isMock
    ? MOCK_MARKET.question
    : "Prediction market simulation briefing";
  const marketLabel = isMock
    ? MOCK_MARKET.polymarket_id.replace(/-/g, " ")
    : report.simulation_id;
  const reportLead = "Tape: live. Model: simulated.";
  const paperTrading = isMock ? MOCK_PAPER_TRADING : paperTradingData ?? { position: null, trades: [] };

  const probDelta = report.simulation_probability - report.market_probability;
  const absDelta = Math.abs(probDelta);
  const deltaLabel = `${probDelta >= 0 ? "+" : ""}${Math.round(probDelta * 100)}pp`;
  const simulationTone =
    report.simulation_probability >= 0.65
      ? "High-conviction yes"
      : report.simulation_probability >= 0.5
        ? "Leaning yes"
        : report.simulation_probability >= 0.4
          ? "Knife-edge"
          : "Leaning no";
  const deltaTone = probDelta >= 0 ? "Simulation above market" : "Simulation below market";
  const signalTone = absDelta >= 0.08 ? "Meaningful divergence" : "Tight range";
  return (
    <>
      <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
        <nav className="border-b border-white/8 bg-[rgba(5,7,13,0.88)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(backHref)}
                className="ui-mono border border-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                Back
              </button>
              <div className="hidden h-4 w-px bg-white/10 sm:block" />
              <div>
                <button
                  onClick={() => router.push("/?mode=explore")}
                  className="bg-transparent border-none p-0 cursor-pointer"
                  aria-label="Go to explore mode"
                >
                  <GodseyeLogo subtitle="Report" size="sm" />
                </button>
                <div className="text-sm text-[var(--text-secondary)]">
                  Simulation {report.simulation_id.slice(0, 8).toUpperCase()}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 justify-end">
              <Pill tone="accent">{isMock ? "Demo mode" : "Live data"}</Pill>
              <button
                onClick={() => router.push(simulationHref)}
                className="ui-mono border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)] transition hover:bg-[rgba(245,158,11,0.14)]"
              >
                View simulation
              </button>
              <button
                onClick={() => router.push("/?mode=explore")}
                className="ui-mono border border-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition hover:border-white/25 hover:text-[var(--text-primary)]"
              >
                New analysis
              </button>
            </div>
          </div>
        </nav>

        <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-8 py-10 pb-18 sm:px-12 sm:py-12 sm:pb-24 lg:px-20">
          <section className="grid gap-10 border-y border-white/10 py-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0 opacity-90"
              style={{
                background:
                  "radial-gradient(circle at top left, rgba(245,158,11,0.18) 0%, transparent 42%), radial-gradient(circle at 85% 15%, rgba(59,130,246,0.14) 0%, transparent 34%)",
              }}
            />

            <div className="relative">
              <div className="eyebrow mb-4 text-[var(--accent)]">Market briefing</div>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-[var(--text-bright)] sm:text-5xl">
                {marketQuestion}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
                {reportLead}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Pill>{marketLabel}</Pill>
                <Pill>{signalTone}</Pill>
                <Pill tone={probDelta >= 0 ? "success" : "danger"}>{deltaTone}</Pill>
                {isMock && <Pill>Vol ${formatVolume(MOCK_MARKET.volume)}</Pill>}
              </div>

<<<<<<< HEAD
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="border border-white/10 bg-[rgba(9,13,22,0.75)] p-5">
                  <div className="eyebrow mb-3">Executive read</div>
                  <p className="report-copy">{report.summary}</p>
                </div>
                <div className="border border-white/10 bg-[rgba(9,13,22,0.75)] p-5">
                  <div className="eyebrow mb-3">Model stance</div>
                  <div className="text-2xl font-semibold tracking-tight text-[var(--text-bright)]">
                    {simulationTone}
                  </div>
                  <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">
                    The simulation settles {deltaTone.toLowerCase()} with a spread of{" "}
                    <span className="font-semibold text-[var(--text-bright)]">{deltaLabel}</span>.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-4 border border-[rgba(245,158,11,0.16)] bg-[rgba(245,158,11,0.05)] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="eyebrow mb-2 text-[var(--accent)]">Trade</div>
                    <div className="text-xl font-semibold tracking-tight text-[var(--text-bright)]">
                      {paperTrading.position
                        ? `You are trade long ${paperTrading.position.side.toUpperCase()}`
                        : "Bet this market after reading the simulation"}
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                      Save a trade position directly from the report and track it against the current market probability.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsTradeDrawerOpen(true)}
                    className="ui-mono border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.12)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)] transition hover:bg-[rgba(245,158,11,0.18)]"
                  >
                    {paperTrading.position ? "Add to trade position" : "Trade this market"}
                  </button>
                </div>

                {paperTrading.position && (
                  <PaperPositionHero
                    side={paperTrading.position.side}
                    avgEntryPrice={paperTrading.position.avg_entry_price}
                    currentPrice={paperTrading.position.current_price}
                    totalCost={paperTrading.position.total_cost}
                    currentValue={paperTrading.position.current_value}
                    unrealizedPnl={paperTrading.position.unrealized_pnl}
                    unrealizedPnlPct={paperTrading.position.unrealized_pnl_pct}
                    shares={paperTrading.position.shares}
                  />
                )}
=======
              <div className="mt-8 border-l border-white/16 pl-4">
                <div className="eyebrow mb-3">Story</div>
                <ol className="space-y-2.5">
                  {storyBeats.map((beat, index) => (
                    <li key={`${beat}-${index}`} className="flex items-start gap-3 text-sm leading-6 text-[var(--text-secondary)]">
                      <span className="ui-mono inline-block w-5 text-[10px] font-semibold text-[var(--text-muted)]">
                        {index + 1}.
                      </span>
                      <span>{`Beat ${index + 1}: ${toFragment(beat, 84)}`}</span>
                    </li>
                  ))}
                </ol>
>>>>>>> de28969a2a3f4c523abfa31ab12644db298dba6d
              </div>
            </div>
          </div>

<<<<<<< HEAD
            <ReportVisual
              marketProbability={report.market_probability}
              simulationProbability={report.simulation_probability}
              deltaLabel={deltaLabel}
              deltaPositive={probDelta >= 0}
            />
          </section>

          <section className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Polymarket"
            value={formatPercent(report.market_probability)}
            detail="Current implied probability"
          />
          <MetricCard
            label="Simulation"
            value={formatPercent(report.simulation_probability)}
            detail="Consensus after agent interaction"
            tone={probabilityTone(report.simulation_probability)}
          />
          <MetricCard
            label="Spread"
            value={deltaLabel}
            detail={deltaTone}
            tone={probDelta >= 0 ? "success" : "danger"}
          />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <ReportCard
            eyebrow="Recommendation"
            title="Trading implication"
            accent={probDelta >= 0 ? "success" : "danger"}
          >
            <p className="text-lg leading-8 text-[var(--text-primary)]">
              {report.recommendation}
            </p>
          </ReportCard>

          <ReportCard eyebrow="Framework" title="What the simulation is capturing">
            <ul className="space-y-3 text-base leading-7 text-[var(--text-secondary)]">
              <li>Claim generation and evidence weighting.</li>
              <li>Belief shifts across multiple forecaster archetypes.</li>
              <li>Trust-network effects and information-sharing clusters.</li>
              <li>Consensus formation compared with live market pricing.</li>
            </ul>
          </ReportCard>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <ReportCard eyebrow="Drivers" title="Key evidence drivers">
            <div className="space-y-3">
              {report.key_drivers.map((driver, index) => {
                const isPositive = /positive|upward|dovish|approaching/i.test(driver);
                return (
                  <div
                    key={driver}
                    className="border border-white/8 bg-[rgba(255,255,255,0.025)] p-4"
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <span
                        className="ui-mono inline-flex h-8 w-8 items-center justify-center border text-xs font-semibold"
                        style={{
                          borderColor: isPositive ? "rgba(52,211,153,0.32)" : "rgba(245,158,11,0.28)",
                          color: isPositive ? "var(--success)" : "var(--accent)",
                          background: isPositive ? "rgba(52,211,153,0.1)" : "rgba(245,158,11,0.08)",
                        }}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="eyebrow">
                        {isPositive ? "Supportive signal" : "Counter-signal"}
                      </span>
=======
            <aside className="border-l border-white/14 pl-6">
              <div className="space-y-4">
                <div>
                  <div className="eyebrow mb-2">Snapshot</div>
                  <div className="space-y-1.5 text-sm text-[var(--text-secondary)]">
                    <div>
                      Market: <span className="text-[var(--text-bright)]">{formatPercent(report.market_probability)}</span>
                    </div>
                    <div>
                      Simulation: <span className="text-[var(--text-bright)]">{formatPercent(report.simulation_probability)}</span>
                    </div>
                    <div>
                      Spread: <span className="text-[var(--text-bright)]">{deltaLabel}</span>
                    </div>
                    <div>
                      Stance: <span className="text-[var(--text-bright)]">{simulationTone}</span>
>>>>>>> de28969a2a3f4c523abfa31ab12644db298dba6d
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <MiniProbabilityRail label="Market" value={report.market_probability} color="#93c5fd" />
                  <MiniProbabilityRail
                    label="Simulation"
                    value={report.simulation_probability}
                    color={probDelta >= 0 ? "#34d399" : "#fb7185"}
                  />
                </div>

                <div className="pt-2">
                  <div className="eyebrow mb-2 text-[var(--accent)]">Trade</div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    {paperTrading.position ? `Position: ${paperTrading.position.side.toUpperCase()} long` : "No position"}
                  </div>
                  <button
                    onClick={() => setIsTradeDrawerOpen(true)}
                    className="ui-mono mt-3 border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.12)] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)] transition hover:bg-[rgba(245,158,11,0.18)]"
                  >
                    {paperTrading.position ? "Add" : "Trade"}
                  </button>
                </div>

                {paperTrading.position && (
                  <div className="pt-2">
                    <PaperPositionHero
                      side={paperTrading.position.side}
                      avgEntryPrice={paperTrading.position.avg_entry_price}
                      currentPrice={paperTrading.position.current_price}
                      totalCost={paperTrading.position.total_cost}
                      currentValue={paperTrading.position.current_value}
                      unrealizedPnl={paperTrading.position.unrealized_pnl}
                      unrealizedPnlPct={paperTrading.position.unrealized_pnl_pct}
                      shares={paperTrading.position.shares}
                    />
                  </div>
                )}
              </div>
            </aside>
          </section>

          <section className="grid gap-10 border-y border-white/10 py-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="eyebrow mb-3">Recommendation</div>
              <div className="text-lg font-semibold tracking-tight text-[var(--text-bright)]">
                {`Call: ${toFragment(recommendationBeat, 96)}`}
              </div>

              <div className="mt-8">
                <div className="eyebrow mb-3">Top drivers</div>
                <ul className="space-y-2.5 text-sm leading-6 text-[var(--text-secondary)]">
                  {report.key_drivers.slice(0, 4).map((driver, index) => (
                    <li key={`${driver}-${index}`} className="flex items-start gap-3 border-l border-white/14 pl-3">
                      <span className="ui-mono inline-block w-6 text-[10px] text-[var(--text-muted)]">{index + 1}.</span>
                      <span>{`D${index + 1}: ${toFragment(driver, 86)}`}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-l border-white/14 pl-6">
              <div className="eyebrow mb-3">Signal quality</div>
              <div className="space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
                <div>{`Gap: ${absDelta >= 0.1 ? "large" : "small"}`}</div>
                <div>{`Read: ${absDelta >= 0.1 ? "mispricing setup" : "timing edge"}`}</div>
                <div>Risk: catalyst + liquidity</div>
              </div>

              <div className="mt-7 space-y-5">
                <div>
                  <div className="eyebrow mb-2">Faction</div>
                  <ul className="space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {factionBeats.slice(0, 2).map((beat, index) => (
                      <li key={`${beat}-${index}`} className="border-l border-white/14 pl-3">
                        {`F${index + 1}: ${toFragment(beat, 74)}`}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="eyebrow mb-2">Trust</div>
                  <ul className="space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {trustBeats.slice(0, 2).map((beat, index) => (
                      <li key={`${beat}-${index}`} className="border-l border-white/14 pl-3">
                        {`T${index + 1}: ${toFragment(beat, 74)}`}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <footer className="flex flex-col gap-4 border-t border-white/8 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="eyebrow mb-1">Report trace</div>
              <div className="text-sm text-[var(--text-secondary)]">
                Report {report.id.slice(0, 8).toUpperCase()} • Sim {report.simulation_id.slice(0, 8).toUpperCase()}.
              </div>
            </div>
            <button
              onClick={() => router.push(simulationHref)}
              className="ui-mono border border-white/12 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Return to replay
            </button>
          </footer>
          <div className="h-12 sm:h-20" aria-hidden="true" />
        </div>
      </div>
      <PaperTradeDrawer
        open={isTradeDrawerOpen}
        onClose={() => setIsTradeDrawerOpen(false)}
        marketId={report.market_id}
        simulationId={report.simulation_id}
        reportId={report.id}
        marketProbability={report.market_probability}
        simulationProbability={report.simulation_probability}
        recommendation={report.recommendation}
        paperTrading={paperTrading}
        onSubmitted={() => {
          if (!isMock) {
            void refetchPaperTrading();
          }
        }}
      />
    </>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "success" | "danger" | "warning";
}) {
  const color =
    tone === "success"
      ? "var(--success)"
      : tone === "danger"
        ? "var(--danger)"
        : tone === "warning"
          ? "var(--accent)"
          : "var(--text-bright)";

  return (
    <div className="border-y border-white/10 py-4">
      <div className="eyebrow mb-5">{label}</div>
      <div className="metric-display" style={{ color }}>
        {value}
      </div>
      <div className="mt-2 text-sm text-[var(--text-secondary)]">{detail}</div>
    </div>
  );
}

function ReportCard({
  eyebrow,
  title,
  children,
  accent,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  accent?: "success" | "danger";
}) {
  const accentColor =
    accent === "success"
      ? "rgba(52,211,153,0.28)"
      : accent === "danger"
        ? "rgba(251,113,133,0.25)"
        : "rgba(255,255,255,0.08)";

  return (
    <div className="border-l-2 px-4 py-3 sm:px-5" style={{ borderColor: accentColor }}>
      <div className="eyebrow mb-3">{eyebrow}</div>
      <h2 className="mb-3 text-xl font-semibold tracking-tight text-[var(--text-bright)]">
        {title}
      </h2>
      {children}
    </div>
  );
}

// TODO: Replace this generated visual block with backend-provided market imagery
// once the report payload exposes report_image_url or visual theme metadata.
function ReportVisual({
  marketProbability,
  simulationProbability,
  deltaLabel,
  deltaPositive,
}: {
  marketProbability: number;
  simulationProbability: number;
  deltaLabel: string;
  deltaPositive: boolean;
}) {
  const deltaColor = deltaPositive ? "var(--success)" : "var(--danger)";

  return (
    <div className="relative overflow-hidden border-y border-white/10 py-6 sm:py-7">
      <div
        className="pointer-events-none absolute inset-0 opacity-95"
        style={{
          background:
            "radial-gradient(circle at 18% 22%, rgba(96,165,250,0.18) 0%, transparent 34%), radial-gradient(circle at 82% 78%, rgba(245,158,11,0.18) 0%, transparent 30%)",
        }}
      />

      <div className="relative flex h-full flex-col">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">Signal spread</div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-bright)]">
              Generated market visual
            </h2>
          </div>
          <span
            className="ui-mono border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
            style={{
              color: deltaColor,
              borderColor: deltaPositive ? "rgba(52,211,153,0.34)" : "rgba(251,113,133,0.3)",
              background: deltaPositive ? "rgba(52,211,153,0.1)" : "rgba(251,113,133,0.08)",
            }}
          >
            {deltaLabel}
          </span>
        </div>

<<<<<<< HEAD
        <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-end gap-4 border border-white/8 bg-[rgba(5,7,13,0.58)] px-5 pb-5 pt-10">
=======
        <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-end gap-4 border-y border-white/12 bg-[rgba(5,7,13,0.58)] px-5 pb-5 pt-10">
>>>>>>> de28969a2a3f4c523abfa31ab12644db298dba6d
          <SignalBar
            label="Market"
            value={marketProbability}
            color="#93c5fd"
            glow="rgba(147,197,253,0.32)"
          />
          <div className="mb-8 h-px w-10 bg-white/10" />
          <SignalBar
            label="Simulation"
            value={simulationProbability}
            color={deltaPositive ? "#34d399" : "#fb7185"}
            glow={deltaPositive ? "rgba(52,211,153,0.28)" : "rgba(251,113,133,0.26)"}
          />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
<<<<<<< HEAD
          <div className="border border-white/8 bg-[rgba(255,255,255,0.03)] p-4">
=======
          <div className="border-l border-white/14 pl-4">
>>>>>>> de28969a2a3f4c523abfa31ab12644db298dba6d
            <div className="eyebrow mb-2">Interpretation</div>
            <div className="text-sm leading-6 text-[var(--text-secondary)]">
              Derived from market and simulation probabilities.
            </div>
          </div>
<<<<<<< HEAD
          <div className="border border-white/8 bg-[rgba(255,255,255,0.03)] p-4">
=======
          <div className="border-l border-white/14 pl-4">
>>>>>>> de28969a2a3f4c523abfa31ab12644db298dba6d
            <div className="eyebrow mb-2">Next step</div>
            <div className="text-sm leading-6 text-[var(--text-secondary)]">
              Replace with backend visual pack when available.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalBar({
  label,
  value,
  color,
  glow,
}: {
  label: string;
  value: number;
  color: string;
  glow: string;
}) {
  const height = Math.max(84, Math.round(value * 260));

  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 text-sm font-medium text-[var(--text-secondary)]">{label}</div>
      <div className="relative flex h-[260px] items-end">
        <div
          className="w-24 border border-white/10"
          style={{
            height,
            background: `linear-gradient(180deg, ${color} 0%, rgba(12,17,25,0.22) 100%)`,
            boxShadow: `0 0 38px ${glow}`,
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/15" />
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-bright)]">
        {formatPercent(value)}
      </div>
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: "accent" | "success" | "danger";
}) {
  const styles =
    tone === "accent"
      ? {
          color: "var(--accent)",
          borderColor: "rgba(245,158,11,0.28)",
          background: "rgba(245,158,11,0.08)",
        }
      : tone === "success"
        ? {
            color: "var(--success)",
            borderColor: "rgba(52,211,153,0.28)",
            background: "rgba(52,211,153,0.08)",
          }
        : tone === "danger"
          ? {
              color: "var(--danger)",
              borderColor: "rgba(251,113,133,0.25)",
              background: "rgba(251,113,133,0.08)",
            }
          : {
              color: "var(--text-secondary)",
              borderColor: "rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
            };

  return (
    <span
      className="ui-mono inline-flex border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]"
      style={styles}
    >
      {children}
    </span>
  );
}

function PaperPositionHero({
  side,
  avgEntryPrice,
  currentPrice,
  totalCost,
  currentValue,
  unrealizedPnl,
  unrealizedPnlPct,
  shares,
}: {
  side: "yes" | "no";
  avgEntryPrice: number;
  currentPrice: number;
  totalCost: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  shares: number;
}) {
  const pnlPositive = unrealizedPnl >= 0;

  return (
    <div className="grid gap-3 md:grid-cols-5">
      <PositionMetric label="Side" value={side.toUpperCase()} />
      <PositionMetric label="Entry" value={formatPercent(avgEntryPrice)} />
      <PositionMetric label="Mark" value={formatPercent(currentPrice)} />
      <PositionMetric label="Shares" value={shares.toFixed(2)} />
      <PositionMetric
        label="PnL"
        value={`${pnlPositive ? "+" : ""}$${Math.abs(unrealizedPnl).toFixed(2)}`}
        detail={`${pnlPositive ? "+" : ""}${(unrealizedPnlPct * 100).toFixed(1)}%`}
        tone={pnlPositive ? "success" : "danger"}
      />
      <PositionMetric label="Cost" value={`$${totalCost.toFixed(2)}`} />
      <PositionMetric label="Value" value={`$${currentValue.toFixed(2)}`} />
    </div>
  );
}

function PositionMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "success" | "danger";
}) {
  return (
<<<<<<< HEAD
    <div className="border border-white/8 bg-[rgba(255,255,255,0.03)] px-4 py-3">
=======
    <div className="border-l border-white/14 px-4 py-2">
>>>>>>> de28969a2a3f4c523abfa31ab12644db298dba6d
      <div className="eyebrow mb-1">{label}</div>
      <div
        className="text-base font-semibold"
        style={{
          color:
            tone === "success"
              ? "var(--success)"
              : tone === "danger"
                ? "var(--danger)"
                : "var(--text-bright)",
        }}
      >
        {value}
      </div>
      {detail && <div className="mt-1 text-xs text-[var(--text-muted)]">{detail}</div>}
    </div>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatVolume(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function MiniProbabilityRail({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
        <span>{label}</span>
        <span className="ui-mono text-[var(--text-bright)]">{formatPercent(value)}</span>
      </div>
      <div className="h-1.5 w-full bg-white/8">
        <div
          className="h-full"
          style={{ width: `${Math.max(2, Math.round(value * 100))}%`, background: color }}
        />
      </div>
    </div>
  );
}

function probabilityTone(value: number): "success" | "danger" | "warning" {
  if (value >= 0.65) return "success";
  if (value <= 0.4) return "danger";
  return "warning";
}

function toFragment(text: string, maxLength = 88): string {
  return oneLine(text, maxLength).replace(/[.!?]+$/g, "");
}

function oneLine(text: string, maxLength = 160): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function splitIntoBeats(text: string, maxItems: number): string[] {
  const raw = text
    .split(/(?<=[.!?])\s+/)
    .map((line) => oneLine(line, 140))
    .filter(Boolean);

  if (raw.length >= maxItems) {
    return raw.slice(0, maxItems);
  }

  return [oneLine(text, 140)];
}

function toStoryBeats(summary: string, drivers: string[], maxItems: number): string[] {
  const beats = [oneLine(summary, 135), ...drivers.map((driver) => oneLine(driver, 120))]
    .filter(Boolean)
    .slice(0, maxItems);

  if (beats.length === 0) return ["No summary available yet."];
  return beats;
}

function BackendLoadState({
  title,
  detail,
  phase,
  simulationStatus,
  action,
}: {
  title: string;
  detail: string;
  phase: "fetch" | "render";
  simulationStatus?: string;
  action?: ReactNode;
}) {
  const steps = [
    { id: "queue", label: "queue" },
    { id: "build", label: "build" },
    { id: "materialize", label: "materialize" },
  ] as const;

  const activeIndex = phase === "fetch" ? 1 : 2;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg-base)] px-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(245,158,11,0.12) 0%, transparent 44%), radial-gradient(circle at 20% 85%, rgba(96,165,250,0.08) 0%, transparent 36%)",
        }}
      />
      <div className="relative w-full max-w-md rounded-[24px] border border-white/8 bg-[rgba(9,12,20,0.74)] p-6 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(245,158,11,0.32)]">
            <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--accent)]" />
          </span>
          <span className="ui-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent)]">
            backend pipeline
          </span>
        </div>

        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text-bright)]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>

        <div className="mt-5 space-y-2.5">
          {steps.map((step, index) => {
            const done = index < activeIndex;
            const active = index === activeIndex;
            return (
              <div
                key={step.id}
                className="flex items-center justify-between rounded-xl border px-3 py-2"
                style={{
                  borderColor: done || active ? "rgba(245,158,11,0.24)" : "rgba(255,255,255,0.09)",
                  background:
                    done || active ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.02)",
                }}
              >
                <span className="ui-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  {step.label}
                </span>
                <span
                  className="ui-mono text-[10px] uppercase tracking-[0.14em]"
                  style={{
                    color: done ? "var(--success)" : active ? "var(--accent)" : "var(--text-subtle)",
                  }}
                >
                  {done ? "done" : active ? "live" : "wait"}
                </span>
              </div>
            );
          })}
        </div>

        {simulationStatus && (
          <div className="ui-mono mt-4 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            simulation: {simulationStatus}
          </div>
        )}

        {action}
      </div>
    </div>
  );
}
