"use client";

import { use, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getSimulation, startSimulation } from "@/lib/api";
import { GodseyeLogo } from "@/components/GodseyeLogo";
import { MOCK_SIMULATION } from "@/lib/mockData";
import { SimulationReplay } from "@/components/SimulationReplay";
import { POLLING_INTERVAL_MS } from "@/lib/constants";
import type { SimulationResponse } from "@/lib/types";
import { supabase } from "@/lib/supabase";

export default function SimulationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ event?: string; demo?: string }>;
}) {
  const { id } = use(params);
  const resolvedSearchParams = use(searchParams);
  const router = useRouter();
  const isMock = id === "mock";
  const isDemoMode = resolvedSearchParams.demo === "1";
  const selectedEventId =
    typeof resolvedSearchParams.event === "string" ? resolvedSearchParams.event : null;
  const backHref = selectedEventId
    ? `/?mode=explore&event=${encodeURIComponent(selectedEventId)}`
    : "/?mode=explore";
  const [isAutoStarting, setIsAutoStarting] = useState(false);
  const queryClient = useQueryClient();
  const autoStartRequestedRef = useRef<string | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["simulation", id],
    queryFn: () => getSimulation(id),
    enabled: !isMock,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "running" || status === "building" || status === "pending") {
        return POLLING_INTERVAL_MS;
      }
      return false;
    },
  });

  const simulation = isMock ? MOCK_SIMULATION : data;
  const simulationStatus = simulation?.status ?? null;

  useEffect(() => {
    autoStartRequestedRef.current = null;
    setIsAutoStarting(false);
  }, [id]);

  useEffect(() => {
    if (isMock) return;

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current !== null) return;
      refreshTimeoutRef.current = window.setTimeout(() => {
        refreshTimeoutRef.current = null;
        void queryClient.invalidateQueries({ queryKey: ["simulation", id] });
      }, 150);
    };

    const channel = supabase
      .channel(`simulation-live:${id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "simulations",
        filter: `id=eq.${id}`,
      }, scheduleRefresh)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "agents",
        filter: `simulation_id=eq.${id}`,
      }, scheduleRefresh)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "claim_shares",
        filter: `simulation_id=eq.${id}`,
      }, scheduleRefresh)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "reports",
        filter: `simulation_id=eq.${id}`,
      }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [id, isMock, queryClient]);

  useEffect(() => {
    if (isMock || !simulation) return;
    if (simulationStatus !== "pending") return;
    if (autoStartRequestedRef.current === simulation.id) return;

    autoStartRequestedRef.current = simulation.id;
    setIsAutoStarting(true);
    startSimulation(simulation.id, { demo: isDemoMode })
      .then((nextSimulation) => {
        queryClient.setQueryData(["simulation", simulation.id], nextSimulation);
      })
      .catch(() => undefined)
      .finally(() => {
        setIsAutoStarting(false);
        void refetch();
      });
  }, [isDemoMode, isMock, queryClient, refetch, simulation, simulationStatus]);

  const showLoadingState =
    !isMock &&
    (isLoading ||
      !simulation ||
      simulation.status === "pending" ||
      (simulation.status === "building" && simulation.agents.length === 0));

  if (showLoadingState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-6 py-8">
        <SimulationLoadState
          simulation={simulation ?? null}
          simulationId={id}
          isAutoStarting={isAutoStarting}
        />
      </div>
    );
  }

  if (!isMock && error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-6 py-8">
        <div className="surface-card w-full max-w-lg p-8 text-center">
          <div className="eyebrow mb-4 text-[var(--danger)]">Simulation not found</div>
          <button
            onClick={() => router.push(backHref)}
            className="ui-mono border border-white/12 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Back home
          </button>
        </div>
      </div>
    );
  }

  if (!simulation) return null;

  const reportReady = simulation.status === "complete";
  const statusLabel =
    simulation.status === "building"
      ? "Building agent society..."
      : simulation.status === "pending" || isAutoStarting
        ? "Starting live simulation..."
        : simulation.status === "running"
          ? "Simulation live"
          : null;

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-white/6 bg-[rgba(5,7,13,0.84)] px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(backHref)}
            className="ui-mono border border-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Back
          </button>
          <button
            onClick={() => router.push("/?mode=explore")}
            className="border border-white/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <GodseyeLogo size="sm" />
          </button>
          <div>
            <div className="eyebrow mb-1 text-[var(--accent)]">Simulation replay</div>
            <span className="ui-mono text-sm text-[var(--text-secondary)]">
              {id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>

        {statusLabel && (
          <div className="ui-mono border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            {statusLabel}
          </div>
        )}

        {reportReady && (
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                router.push(
                  selectedEventId
                    ? `/reports/${simulation.id}?event=${encodeURIComponent(selectedEventId)}&trade=1`
                    : `/reports/${simulation.id}?trade=1`
                )
              }
              className="ui-mono border border-white/12 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Trade
            </button>
            <button
              onClick={() =>
                router.push(
                  selectedEventId
                    ? `/reports/${simulation.id}?event=${encodeURIComponent(selectedEventId)}`
                    : `/reports/${simulation.id}`
                )
              }
              className="ui-mono border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)] transition hover:bg-[rgba(245,158,11,0.14)]"
            >
              View report
            </button>
          </div>
        )}
      </nav>

      <div>
        <SimulationReplay simulation={simulation} />
      </div>
    </div>
  );
}

function SimulationLoadState({
  simulation,
  simulationId,
  isAutoStarting,
}: {
  simulation: SimulationResponse | null;
  simulationId: string;
  isAutoStarting: boolean;
}) {
  const steps = ["queue", "assemble", "first-tick"] as const;
  const status = simulation?.status;
  const activeIndex =
    !simulation || status === "pending"
      ? 0
      : status === "building"
        ? 1
        : 2;
  const headline =
    !simulation
      ? "Connecting replay"
      : status === "pending"
        ? isAutoStarting
          ? "Starting simulation"
          : "Preparing run"
        : status === "building"
          ? "Building agents"
          : "Streaming first tick";

  return (
    <div className="relative w-full max-w-2xl overflow-hidden border border-white/8 bg-[rgba(8,11,18,0.76)] p-7 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(245,158,11,0.14), transparent 52%), radial-gradient(circle at 0% 100%, rgba(96,165,250,0.09), transparent 42%)",
        }}
      />

      <div className="relative">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-7 w-7 items-center justify-center border border-[rgba(245,158,11,0.3)]">
            <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--accent)]" />
          </span>
          <span className="ui-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent)]">
            backend live
          </span>
        </div>

        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-bright)]">{headline}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          Wiring simulation state, trust graph, and replay frames.
        </p>

        <div className="mt-6 space-y-2.5">
          {steps.map((step, index) => {
            const done = index < activeIndex;
            const live = index === activeIndex;
            return (
              <div
                key={step}
                className="flex items-center justify-between border px-3 py-2"
                style={{
                  borderColor: done || live ? "rgba(245,158,11,0.24)" : "rgba(255,255,255,0.1)",
                  background: done || live ? "rgba(245,158,11,0.05)" : "rgba(255,255,255,0.02)",
                }}
              >
                <span className="ui-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">{step}</span>
                <span
                  className="ui-mono text-[10px] uppercase tracking-[0.16em]"
                  style={{
                    color: done ? "var(--success)" : live ? "var(--accent)" : "var(--text-subtle)",
                  }}
                >
                  {done ? "done" : live ? "live" : "wait"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="ui-mono mt-4 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
          sim {simulationId.slice(0, 8).toUpperCase()} • status {simulation?.status ?? "loading"}
        </div>
      </div>
    </div>
  );
}
