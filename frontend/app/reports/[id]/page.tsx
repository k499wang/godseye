"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const { id } = use(params);
  const resolvedSearchParams = use(searchParams);
  const router = useRouter();
  const selectedEventId =
    typeof resolvedSearchParams.event === "string" ? resolvedSearchParams.event : null;
  const simulationHref = selectedEventId
    ? `/simulation/${id}?event=${encodeURIComponent(selectedEventId)}`
    : `/simulation/${id}`;

  useEffect(() => {
    router.replace(simulationHref);
  }, [router, simulationHref]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
      <div className="flex flex-col items-center gap-4">
        <span
          className="inline-block h-8 w-8 rounded-full border-2 border-[var(--accent)] border-t-transparent"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
        <span className="eyebrow text-[var(--text-muted)]">
          Redirecting to society simulation
        </span>
      </div>
    </div>
  );
}
