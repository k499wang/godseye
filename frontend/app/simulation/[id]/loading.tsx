export default function Loading() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg-base)] px-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, rgba(245,158,11,0.12) 0%, transparent 46%), radial-gradient(circle at 20% 75%, rgba(96,165,250,0.08) 0%, transparent 38%)",
        }}
      />
      <div className="relative w-full max-w-md rounded-[24px] border border-white/8 bg-[rgba(9,12,20,0.74)] p-6 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(245,158,11,0.32)]">
            <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--accent)]" />
          </span>
          <span className="ui-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent)]">
            backend live
          </span>
        </div>

        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text-bright)]">
          Opening replay
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          Restoring agents, trust graph, and first tick stream.
        </p>

        <div className="mt-5 space-y-2.5">
          {[
            ["queue", "done"],
            ["assemble", "live"],
            ["first-tick", "wait"],
          ].map(([step, state]) => (
            <div
              key={step}
              className="flex items-center justify-between rounded-xl border px-3 py-2"
              style={{
                borderColor: state === "wait" ? "rgba(255,255,255,0.1)" : "rgba(245,158,11,0.24)",
                background: state === "wait" ? "rgba(255,255,255,0.02)" : "rgba(245,158,11,0.05)",
              }}
            >
              <span className="ui-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {step}
              </span>
              <span
                className="ui-mono text-[10px] uppercase tracking-[0.16em]"
                style={{
                  color:
                    state === "done"
                      ? "var(--success)"
                      : state === "live"
                        ? "var(--accent)"
                        : "var(--text-subtle)",
                }}
              >
                {state}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
