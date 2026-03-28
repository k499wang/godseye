"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getSimulation } from "@/lib/api";
import { MOCK_SIMULATION } from "@/lib/mockData";
import { SimulationReplay } from "@/components/SimulationReplay";
import { POLLING_INTERVAL_MS } from "@/lib/constants";

export default function SimulationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const isMock = id === "mock";

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
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <span
            className="inline-block w-6 h-6 border-2 border-[#F59E0B] border-t-transparent rounded-full"
            style={{ animation: "spin 0.8s linear infinite" }}
          />
          <span className="font-mono text-[10px] tracking-widest text-[#4b5563]">
            LOADING SIMULATION
          </span>
        </div>
      </div>
    );
  }

  if (!isMock && error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="font-mono text-[10px] tracking-widest text-[#EF4444] mb-3">
            SIMULATION NOT FOUND
          </div>
          <button
            onClick={() => router.push("/")}
            className="font-mono text-[10px] tracking-widest text-[#6b7280] border border-[rgba(255,255,255,0.08)] px-4 py-2 hover:text-[#F59E0B] transition-colors"
          >
            ← BACK HOME
          </button>
        </div>
      </div>
    );
  }

  if (!simulation) return null;

  const reportReady = simulation.status === "complete";

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Nav bar */}
      <nav className="flex items-center justify-between px-4 py-2 border-b border-[rgba(255,255,255,0.06)] flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="font-mono text-[9px] tracking-widest text-[#4b5563] hover:text-[#F59E0B] transition-colors"
          >
            ← GODSEYE
          </button>
          <span className="text-[#2d2d3a]">/</span>
          <span className="font-mono text-[9px] tracking-widest text-[#6b7280]">
            SIMULATION {id.slice(0, 8).toUpperCase()}
          </span>
        </div>
        {reportReady && (
          <button
            onClick={() => router.push(`/reports/${simulation.id}`)}
            className="font-mono text-[9px] tracking-widest px-3 py-1.5 bg-[rgba(245,158,11,0.1)] text-[#F59E0B] border border-[rgba(245,158,11,0.3)] hover:bg-[rgba(245,158,11,0.2)] transition-colors"
          >
            VIEW REPORT →
          </button>
        )}
      </nav>

      {/* Main */}
      <div className="flex-1 overflow-hidden">
        <SimulationReplay simulation={simulation} />
      </div>
    </div>
  );
}
