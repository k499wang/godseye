"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getSimulation } from "@/lib/api";
import { GodseyeLogo } from "@/components/GodseyeLogo";
import { MOCK_SIMULATION } from "@/lib/mockData";
import { SimulationReplay } from "@/components/SimulationReplay";
import { POLLING_INTERVAL_MS } from "@/lib/constants";

export default function SimulationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const { id } = use(params);
  const resolvedSearchParams = use(searchParams);
  const router = useRouter();
  const isMock = id === "mock";
  const selectedEventId =
    typeof resolvedSearchParams.event === "string" ? resolvedSearchParams.event : null;
  const backHref = selectedEventId
    ? `/?mode=explore&event=${encodeURIComponent(selectedEventId)}`
    : "/?mode=explore";

  const { data, isLoading, error } = useQuery({
    queryKey: ["simulation", id],
    queryFn: () => getSimulation(id),
    enabled: !isMock,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "running" || status === "building") return POLLING_INTERVAL_MS;
      return false;
    },
  });

  const simulation = isMock ? MOCK_SIMULATION : data;

  if (!isMock && isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-base)]">
        <div className="flex flex-col items-center gap-4">
          <span
            className="inline-block h-7 w-7 rounded-full border-2 border-[var(--accent)] border-t-transparent"
            style={{ animation: "spin 0.8s linear infinite" }}
          />
          <span className="eyebrow text-[var(--text-muted)]">Loading simulation</span>
        </div>
      </div>
    );
  }

  if (!isMock && error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-base)] px-6">
        <div className="surface-card w-full max-w-lg p-8 text-center">
          <div className="eyebrow mb-4 text-[var(--danger)]">Simulation not found</div>
          <button
            onClick={() => router.push(backHref)}
            className="ui-mono rounded-full border border-white/12 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Back home
          </button>
        </div>
      </div>
    );
  }

  if (!simulation) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-base)]">
      <nav className="flex flex-shrink-0 items-center justify-between border-b border-white/8 bg-[rgba(5,7,13,0.88)] px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(backHref)}
            className="ui-mono rounded-full border border-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Back
          </button>
          <button
            onClick={() => router.push("/?mode=explore")}
            className="rounded-full border border-white/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <GodseyeLogo size="sm" />
          </button>
          <div>
            <div className="eyebrow mb-1 text-[var(--accent)]">Society simulation</div>
            <span className="ui-mono text-sm text-[var(--text-secondary)]">
              {id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="ui-mono rounded-full border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Network first
        </div>
      </nav>

      <div className="flex-1 overflow-hidden">
        <SimulationReplay simulation={simulation} />
      </div>
    </div>
  );
}
