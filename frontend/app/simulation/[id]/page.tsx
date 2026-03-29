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
            className="ui-mono rounded-full border border-white/12 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
            <div className="eyebrow mb-1 text-[var(--accent)]">Simulation replay</div>
            <span className="ui-mono text-sm text-[var(--text-secondary)]">
              {id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>

        {statusLabel && (
          <div className="ui-mono rounded-full border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
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
              className="ui-mono rounded-full border border-white/12 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
              className="ui-mono rounded-full border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)] transition hover:bg-[rgba(245,158,11,0.14)]"
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
  const currentStepIndex =
    !simulation
      ? 0
      : simulation.status === "pending"
        ? 1
        : simulation.status === "building"
          ? 2
          : 3;

  const steps = [
    {
      label: "Connect",
      detail: "Loading simulation record and restoring saved state.",
    },
    {
      label: "Initialize",
      detail: isAutoStarting
        ? "Starting the live run and locking the current market state."
        : "Preparing the run shell and validating agents and claims.",
    },
    {
      label: "Assemble",
      detail: "Building the agent society, dossiers, and trust scaffolding.",
    },
    {
      label: "First Tick",
      detail: "Running the opening interactions and streaming the first replay frame.",
    },
  ];

  const progress = ((currentStepIndex + (simulation?.status === "running" ? 1 : 0)) / steps.length) * 100;
  const statusLabel =
    !simulation
      ? "Connecting to simulation"
      : simulation.status === "pending"
        ? "Initializing live run"
        : simulation.status === "building"
          ? "Building agent society"
          : "Generating first tick";

  return (
    <div className="w-full max-w-[74rem] rounded-[26px] border border-white/6 bg-[rgba(10,14,22,0.92)] shadow-[0_16px_44px_rgba(0,0,0,0.16)]">
      <div className="grid min-h-[560px] grid-cols-[1.25fr_0.95fr]">
        <div className="flex flex-col justify-between border-r border-white/6 p-8">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <GodseyeLogo size="sm" />
              <div className="ui-mono rounded-full border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.06)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                {statusLabel}
              </div>
            </div>

            <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
              Simulation boot sequence
            </div>
            <h1 className="max-w-2xl text-[2rem] font-semibold tracking-[-0.04em] text-[var(--text-bright)]">
              Bringing the simulation online tick by tick.
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[var(--text-secondary)]">
              The model is loading the existing run, assembling the agent network, and generating the opening interactions before the replay becomes interactive.
            </p>
          </div>

          <div className="mt-10">
            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              <span>Progress</span>
              <span className="ui-mono text-[var(--text-bright)]">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),#60a5fa)] transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between p-8">
          <div className="space-y-3.5">
            {steps.map((step, index) => {
              const state =
                index < currentStepIndex
                  ? "done"
                  : index === currentStepIndex
                    ? "active"
                    : "pending";

              return (
                <div
                  key={step.label}
                  className="rounded-[18px] border px-4 py-3 transition-all duration-500"
                  style={{
                    borderColor:
                      state === "done"
                        ? "rgba(52,211,153,0.26)"
                        : state === "active"
                          ? "rgba(245,158,11,0.28)"
                          : "rgba(255,255,255,0.08)",
                    background:
                      state === "done"
                        ? "rgba(52,211,153,0.06)"
                        : state === "active"
                          ? "rgba(245,158,11,0.08)"
                          : "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="mb-1.5 flex items-center gap-3">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full border ui-mono text-[10px] font-bold"
                      style={{
                        borderColor:
                          state === "done"
                            ? "rgba(52,211,153,0.3)"
                            : state === "active"
                              ? "rgba(245,158,11,0.35)"
                              : "rgba(255,255,255,0.12)",
                        color:
                          state === "done"
                            ? "var(--success)"
                            : state === "active"
                              ? "var(--accent)"
                              : "var(--text-muted)",
                        background:
                          state === "done"
                            ? "rgba(52,211,153,0.12)"
                            : state === "active"
                              ? "rgba(245,158,11,0.12)"
                              : "rgba(255,255,255,0.02)",
                      }}
                    >
                      {state === "done" ? "OK" : String(index + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <div className="ui-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {step.label}
                      </div>
                      <div className="text-[13px] font-medium text-[var(--text-bright)]">
                        {state === "active" ? "In progress" : state === "done" ? "Complete" : "Queued"}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] leading-4.5 text-[var(--text-secondary)]">{step.detail}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-[18px] border border-white/6 bg-[rgba(255,255,255,0.018)] p-4">
            <div className="ui-mono mb-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Live context
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12px] text-[var(--text-secondary)]">
              <div>
                <div className="ui-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Simulation ID
                </div>
                <div className="mt-1 text-[var(--text-bright)]">{simulationId.slice(0, 8).toUpperCase()}</div>
              </div>
              <div>
                <div className="ui-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Current status
                </div>
                <div className="mt-1 text-[var(--text-bright)]">{simulation?.status ?? "loading"}</div>
              </div>
              <div>
                <div className="ui-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Agents loaded
                </div>
                <div className="mt-1 text-[var(--text-bright)]">{simulation?.agents.length ?? 0}</div>
              </div>
              <div>
                <div className="ui-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Ticks available
                </div>
                <div className="mt-1 text-[var(--text-bright)]">{simulation?.tick_data.length ?? 0}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
