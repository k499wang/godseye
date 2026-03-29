"use client";

import { ReactNode, use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getPaperTrading, getReport } from "@/lib/api";
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
    if (openTradeFromQuery) setIsTradeDrawerOpen(true);
  }, [openTradeFromQuery]);

  if (!isMock && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
        <div className="flex flex-col items-center gap-4">
          <span
            className="inline-block h-8 w-8 rounded-full border-2 border-[var(--accent)] border-t-transparent"
            style={{ animation: "spin 0.8s linear infinite" }}
          />
          <span className="eyebrow text-[var(--text-muted)]">Loading report</span>
        </div>
      </div>
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
            The report may still be generating, or this simulation has not completed yet.
          </p>
          <button
            onClick={() => router.push(backHref)}
            className="ui-mono mt-6 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
  const paperTrading = isMock ? MOCK_PAPER_TRADING : paperTradingData ?? { position: null, trades: [] };

  const probDelta = report.simulation_probability - report.market_probability;
  const absDelta = Math.abs(probDelta);
  const deltaLabel = `${probDelta >= 0 ? "+" : ""}${Math.round(probDelta * 100)}pp`;
  const simulationTone =
    report.simulation_probability >= 0.65
      ? "High-conviction YES"
      : report.simulation_probability >= 0.5
        ? "Leaning YES"
        : report.simulation_probability >= 0.4
          ? "Knife-edge"
          : "Leaning NO";
  const deltaTone = probDelta >= 0 ? "Simulation above market" : "Simulation below market";

  return (
    <>
      <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
        {/* Nav */}
        <nav className="border-b border-white/8 bg-[rgba(5,7,13,0.88)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(backHref)}
                className="ui-mono rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] transition hover:border-white/22 hover:text-[var(--text-primary)]"
              >
                Back
              </button>
              <div className="hidden h-4 w-px bg-white/10 sm:block" />
              <button
                onClick={() => router.push("/?mode=explore")}
                className="bg-transparent border-none p-0 cursor-pointer"
              >
                <GodseyeLogo subtitle="Report" size="sm" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(simulationHref)}
                className="ui-mono rounded-lg border border-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] transition hover:border-white/25 hover:text-[var(--text-primary)]"
              >
                View simulation
              </button>
            </div>
          </div>
        </nav>

        <article className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
          {/* Header */}
          <header className="mb-10">
            <div className="ui-mono mb-3 text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Simulation {report.simulation_id.slice(0, 8).toUpperCase()}
            </div>
            <h1 className="text-[2.4rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[var(--text-bright)] sm:text-[2.8rem]">
              {marketQuestion}
            </h1>
          </header>

          {/* Probability headline */}
          <section className="mb-10 grid grid-cols-3 gap-px overflow-hidden rounded-[16px] border border-white/10">
            <ProbCell
              label="Market"
              value={Math.round(report.market_probability * 100)}
              suffix="%"
              color="var(--text-bright)"
            />
            <ProbCell
              label="Simulation"
              value={Math.round(report.simulation_probability * 100)}
              suffix="%"
              color={report.simulation_probability >= 0.5 ? "var(--success)" : "var(--danger)"}
            />
            <ProbCell
              label="Spread"
              value={`${probDelta >= 0 ? "+" : ""}${Math.round(probDelta * 100)}`}
              suffix="pp"
              color={probDelta >= 0 ? "var(--success)" : "var(--danger)"}
              detail={simulationTone}
            />
          </section>

          {/* Probability bars */}
          <section className="mb-12">
            <div className="space-y-3">
              <ProbBar label="Market" value={report.market_probability} color="#60a5fa" />
              <ProbBar
                label="Simulation"
                value={report.simulation_probability}
                color={probDelta >= 0 ? "#34d399" : "#fb7185"}
              />
            </div>
          </section>

          {/* Summary */}
          <Section label="Executive summary">
            <p className="text-[17px] leading-[1.8] text-[var(--text-secondary)]">{report.summary}</p>
          </Section>

          {/* Recommendation */}
          <Section label="Recommendation">
            <div
              className="rounded-[12px] border-l-[3px] bg-[rgba(255,255,255,0.02)] py-4 pl-5 pr-4"
              style={{ borderColor: probDelta >= 0 ? "var(--success)" : "var(--danger)" }}
            >
              <p className="text-[17px] leading-[1.8] text-[var(--text-primary)]">{report.recommendation}</p>
            </div>
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              {deltaTone}. Spread: {deltaLabel}.{" "}
              {absDelta >= 0.08
                ? "This divergence may flag a potential mispricing worth investigating."
                : "The tight spread suggests the market is fairly priced."}
            </p>
          </Section>

          {/* Key drivers */}
          <Section label="Key evidence drivers">
            <ol className="space-y-4">
              {report.key_drivers.map((driver, i) => (
                <li key={i} className="flex gap-4">
                  <span className="ui-mono mt-0.5 shrink-0 text-[13px] font-semibold text-[var(--accent)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-[16px] leading-[1.75] text-[var(--text-secondary)]">{driver}</p>
                </li>
              ))}
            </ol>
          </Section>

          {/* Faction analysis */}
          <Section label="Faction analysis">
            <p className="text-[16px] leading-[1.8] text-[var(--text-secondary)]">{report.faction_analysis}</p>
          </Section>

          {/* Trust insights */}
          <Section label="Trust network">
            <p className="text-[16px] leading-[1.8] text-[var(--text-secondary)]">{report.trust_insights}</p>
          </Section>

          {/* Paper trading */}
          <div className="mt-12 rounded-xl border border-white/10 bg-[rgba(255,255,255,0.02)] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="ui-mono mb-1 text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Paper trading</div>
                <div className="text-[15px] font-medium text-[var(--text-bright)]">
                  {paperTrading.position
                    ? `Paper long ${paperTrading.position.side.toUpperCase()}`
                    : "Test your thesis with a paper trade"}
                </div>
              </div>
              <button
                onClick={() => setIsTradeDrawerOpen(true)}
                className="ui-mono shrink-0 rounded-lg border border-white/14 bg-[rgba(255,255,255,0.05)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)] transition hover:bg-[rgba(255,255,255,0.08)]"
              >
                {paperTrading.position ? "Add to position" : "Place paper trade"}
              </button>
            </div>
            {paperTrading.position && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniMetric label="Side" value={paperTrading.position.side.toUpperCase()} />
                <MiniMetric label="Entry" value={`${Math.round(paperTrading.position.avg_entry_price * 100)}%`} />
                <MiniMetric label="Mark" value={`${Math.round(paperTrading.position.current_price * 100)}%`} />
                <MiniMetric
                  label="PnL"
                  value={`${paperTrading.position.unrealized_pnl >= 0 ? "+" : ""}$${Math.abs(paperTrading.position.unrealized_pnl).toFixed(2)}`}
                  color={paperTrading.position.unrealized_pnl >= 0 ? "var(--success)" : "var(--danger)"}
                />
              </div>
            )}
          </div>

          {/* Trace */}
          <footer className="mt-10 border-t border-white/8 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="ui-mono text-[11px] tracking-[0.12em] text-[var(--text-muted)]">
                Report {report.id.slice(0, 8).toUpperCase()} / Simulation {report.simulation_id.slice(0, 8).toUpperCase()}
              </div>
              <button
                onClick={() => router.push(simulationHref)}
                className="ui-mono rounded-lg border border-white/12 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] transition hover:border-white/22 hover:text-[var(--text-primary)]"
              >
                Return to replay
              </button>
            </div>
          </footer>
        </article>
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
          if (!isMock) void refetchPaperTrading();
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function ProbCell({
  label,
  value,
  suffix,
  color,
  detail,
}: {
  label: string;
  value: number | string;
  suffix: string;
  color: string;
  detail?: string;
}) {
  return (
    <div className="bg-[rgba(255,255,255,0.02)] px-5 py-5 text-center">
      <div className="ui-mono mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</div>
      <div className="text-[2rem] font-bold tracking-[-0.03em] sm:text-[2.4rem]" style={{ color }}>
        {value}
        <span className="text-[1rem] font-medium text-[var(--text-muted)]">{suffix}</span>
      </div>
      {detail && (
        <div className="ui-mono mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{detail}</div>
      )}
    </div>
  );
}

function ProbBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="ui-mono w-20 shrink-0 text-right text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </span>
      <div className="relative h-6 flex-1 overflow-hidden rounded-[6px] bg-[rgba(255,255,255,0.05)]">
        <div
          className="absolute inset-y-0 left-0 rounded-[6px]"
          style={{ width: `${pct}%`, background: color, opacity: 0.8 }}
        />
      </div>
      <span className="ui-mono w-10 text-[13px] font-bold" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </h2>
      {children}
    </section>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-[8px] bg-[rgba(255,255,255,0.04)] px-3 py-2">
      <div className="ui-mono text-[9px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</div>
      <div className="ui-mono mt-0.5 text-[14px] font-semibold" style={{ color: color ?? "var(--text-bright)" }}>
        {value}
      </div>
    </div>
  );
}
