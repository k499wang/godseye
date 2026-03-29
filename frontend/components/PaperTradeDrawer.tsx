"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { placePaperOrder } from "@/lib/api";
import type { PaperTradingResponse } from "@/lib/types";

interface PaperTradeDrawerProps {
  open: boolean;
  onClose: () => void;
  marketId: string;
  simulationId?: string | null;
  reportId?: string | null;
  marketProbability: number;
  simulationProbability: number;
  recommendation: string;
  paperTrading: PaperTradingResponse;
  onSubmitted: (response: PaperTradingResponse) => void;
}

const PRESET_AMOUNTS = [10, 25, 50, 100];

function RecommendationText({ text }: { text: string }) {
  const parts = text.split("•").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return <p className="mt-4 text-sm leading-6 text-(--text-secondary)">{text}</p>;
  }
  return (
    <div className="mt-4 space-y-3 text-sm leading-6 text-(--text-secondary)">
      {parts.map((part, i) => (
        <p key={i}>{i === 0 ? part : `• ${part}`}</p>
      ))}
    </div>
  );
}

export function PaperTradeDrawer({
  open,
  onClose,
  marketId,
  simulationId,
  reportId,
  marketProbability,
  simulationProbability,
  recommendation,
  paperTrading,
  onSubmitted,
}: PaperTradeDrawerProps) {
  const { publicKey, connected, signMessage, wallet } = useWallet();
  const [side, setSide] = useState<"yes" | "no">(
    simulationProbability >= marketProbability ? "yes" : "no"
  );
  const [amountInput, setAmountInput] = useState("25");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: placePaperOrder,
    onSuccess: (response) => {
      setError(null);
      onSubmitted(response);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: { detail?: string } | string } } })?.response
          ?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
        return;
      }
      if (typeof detail?.detail === "string") {
        setError(detail.detail);
        return;
      }
      setError("Could not place paper order.");
    },
  });

  const parsedAmount = Number(amountInput);
  const sidePrice = side === "yes" ? marketProbability : 1 - marketProbability;
  const estimatedShares =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && sidePrice > 0
      ? parsedAmount / sidePrice
      : 0;
  const existingSide = paperTrading.position?.side ?? null;
  const sideLocked = existingSide !== null && existingSide !== side;

  const spreadLabel = useMemo(() => {
    const delta = simulationProbability - marketProbability;
    return `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}pp`;
  }, [marketProbability, simulationProbability]);
  const walletAddress = publicKey?.toBase58() ?? null;
  const walletSupportsSigning = typeof signMessage === "function";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[rgba(3,5,10,0.72)] backdrop-blur-sm"
      style={{ fontFamily: "var(--font-dm-sans), var(--font-sans)" }}
    >
      <button
        type="button"
        aria-label="Close trade drawer"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[rgba(7,10,18,0.97)] p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow mb-2 text-[var(--accent)]">Trade this market</div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-bright)]">
              Put the report into a position
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-mono border border-white/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-(--text-secondary) transition hover:border-white/25 hover:text-(--text-primary)"
          >
            Close
          </button>
        </div>

        <div className="space-y-4">
          <div className="border border-white/10 bg-[rgba(255,255,255,0.03)] p-4">
            <div className="eyebrow mb-3">Signal</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="Market" value={formatPercent(marketProbability)} />
              <Metric label="Simulation" value={formatPercent(simulationProbability)} />
              <Metric label="Spread" value={spreadLabel} />
              <Metric label="Bias" value={simulationProbability >= marketProbability ? "YES" : "NO"} />
            </div>
            <RecommendationText text={recommendation} />
          </div>

          <div className="border border-white/10 bg-[rgba(255,255,255,0.03)] p-4">
            <div className="eyebrow mb-3">Choose side</div>
            <div className="grid grid-cols-2 gap-3">
              {(["yes", "no"] as const).map((option) => {
                const active = side === option;
                const locked = existingSide !== null && existingSide !== option;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={locked}
                    onClick={() => setSide(option)}
                    className="border px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      borderColor: active ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)",
                      background: active ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div className="ui-mono text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Buy {option}
                    </div>
                    <div className="mt-2 text-xl font-semibold text-[var(--text-bright)]">
                      {formatPercent(option === "yes" ? marketProbability : 1 - marketProbability)}
                    </div>
                  </button>
                );
              })}
            </div>
            {existingSide && (
              <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
                This analysis context is locked to your existing {existingSide.toUpperCase()} trade position.
              </p>
            )}
          </div>

          <div className="border border-white/10 bg-[rgba(255,255,255,0.03)] p-4">
            <div className="eyebrow mb-3">Phantom approval</div>
            <div className="border border-white/8 bg-[rgba(255,255,255,0.02)] px-4 py-4">
              <div className="ui-mono text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Wallet status
              </div>
              <div className="mt-2 text-sm text-(--text-secondary)">
                {connected && walletAddress
                  ? `Connected to ${wallet?.adapter.name ?? "wallet"}: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
                  : "Connect Phantom from the globe header before placing a trade."}
              </div>
              {connected && !walletSupportsSigning && (
                <div className="mt-3 text-sm text-[var(--danger)]">
                  This wallet does not support message signing.
                </div>
              )}
              <div className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
                Buying a trade position now requires a real Phantom message signature, but it still records only a paper trade in this app.
              </div>
            </div>
          </div>

          <div className="border border-white/10 bg-[rgba(255,255,255,0.03)] p-4">
            <div className="eyebrow mb-3">Position size</div>
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setAmountInput(String(amount))}
                  className="ui-mono border border-white/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-(--text-secondary) transition hover:border-(--accent) hover:text-(--accent)"
                >
                  ${amount}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="eyebrow mb-2 block">Custom amount</span>
              <input
                type="number"
                min="1"
                step="1"
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                className="w-full border border-white/10 bg-[rgba(4,6,12,0.88)] px-4 py-3 text-base text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
              />
            </label>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Metric label="Entry price" value={formatPercent(sidePrice)} />
              <Metric label="Estimated shares" value={estimatedShares.toFixed(2)} />
            </div>

            {error && (
              <div className="mt-4 border border-[rgba(239,68,68,0.24)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={
                mutation.isPending ||
                sideLocked ||
                !connected ||
                !walletAddress ||
                !walletSupportsSigning ||
                !Number.isFinite(parsedAmount) ||
                parsedAmount <= 0
              }
              onClick={async () => {
                setError(null);
                if (!connected || !walletAddress || !walletSupportsSigning || !signMessage) {
                  setError("Connect Phantom and allow message signing before placing a trade order.");
                  return;
                }

                try {
                  const signedMessage = [
                    "GodsEye trade approval",
                    `Market: ${marketId}`,
                    reportId ? `Report: ${reportId}` : null,
                    simulationId ? `Simulation: ${simulationId}` : null,
                    `Side: ${side.toUpperCase()}`,
                    `Amount: $${parsedAmount.toFixed(2)}`,
                    `Market probability: ${formatPercent(marketProbability)}`,
                    `Simulation probability: ${formatPercent(simulationProbability)}`,
                    `Timestamp: ${new Date().toISOString()}`,
                  ]
                    .filter(Boolean)
                    .join("\n");

                  const encodedMessage = new TextEncoder().encode(signedMessage);
                  const signature = await signMessage(encodedMessage);

                  mutation.mutate({
                    market_id: marketId,
                    simulation_id: simulationId,
                    report_id: reportId,
                    side,
                    amount: parsedAmount,
                    wallet_address: walletAddress,
                    signed_message: signedMessage,
                    wallet_signature: toBase64(signature),
                  });
                } catch {
                  setError("Phantom signature was rejected or could not be completed.");
                }
              }}
              className="ui-mono mt-5 w-full border border-[rgba(245,158,11,0.32)] bg-[rgba(245,158,11,0.1)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)] transition hover:bg-[rgba(245,158,11,0.16)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending
                ? "Waiting for signature..."
                : `Sign & buy ${side.toUpperCase()} paper position`}
            </button>
          </div>

          {paperTrading.trades.length > 0 && (
            <div className="border border-white/10 bg-[rgba(255,255,255,0.03)] p-4">
              <div className="eyebrow mb-3">Recent orders</div>
              <div className="space-y-3">
                {paperTrading.trades.slice(0, 5).map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between border border-white/8 bg-[rgba(255,255,255,0.02)] px-4 py-3"
                  >
                    <div>
                      <div className="ui-mono text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        Buy {trade.side}
                      </div>
                      <div className="mt-1 text-sm text-(--text-secondary)">
                        {new Date(trade.created_at).toLocaleString()}
                      </div>
                      {trade.wallet_address && (
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          Signed by {trade.wallet_address.slice(0, 4)}...{trade.wallet_address.slice(-4)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[var(--text-bright)]">
                        ${trade.amount.toFixed(2)}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {trade.shares.toFixed(2)} @ {formatPercent(trade.price)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/8 bg-[rgba(255,255,255,0.02)] px-3 py-3">
      <div className="eyebrow mb-1">{label}</div>
      <div className="text-sm font-semibold text-[var(--text-bright)]">{value}</div>
    </div>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
