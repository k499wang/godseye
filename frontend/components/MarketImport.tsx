"use client";

import { useState } from "react";
import type { MarketResponse } from "@/lib/types";
import { importMarket } from "@/lib/api";

interface MarketImportProps {
  onImported: (market: MarketResponse) => void;
}

export function MarketImport({ onImported }: MarketImportProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const market = await importMarket(url.trim());
      onImported(market);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to import market. Check the URL and try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="mb-3">
        <label className="block font-mono text-[9px] tracking-[0.25em] text-[#4b5563] mb-2">
          POLYMARKET URL
        </label>
        <div className="flex gap-0">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://polymarket.com/event/will-fed-cut-rates..."
            className="flex-1 bg-[#0d0d14] border border-[rgba(245,158,11,0.2)] border-r-0 px-3 py-2.5 font-mono text-[12px] text-[#e5e7eb] placeholder-[#374151] outline-none focus:border-[rgba(245,158,11,0.5)] transition-colors"
            disabled={loading}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-5 py-2.5 font-mono text-[10px] tracking-widest bg-[#F59E0B] text-[#0a0a0f] font-bold hover:bg-[#fbbf24] disabled:bg-[#4b5563] disabled:text-[#6b7280] disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 border border-[#0a0a0f] border-t-transparent rounded-full animate-spin" />
                IMPORTING
              </span>
            ) : (
              "IMPORT →"
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.05)] px-3 py-2 font-mono text-[11px] text-[#EF4444]">
          {error}
        </div>
      )}

      <p className="mt-2 font-mono text-[10px] text-[#374151]">
        Paste a Polymarket event URL to begin analysis. The market data will be
        fetched and a new analysis session will be created.
      </p>
    </form>
  );
}
