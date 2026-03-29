"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useCallback, useEffect, useRef, useState } from "react";

export function WalletButton() {
  const { publicKey, wallet, wallets, select, connect, disconnect, connecting, connected } =
    useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const phantomWallet = wallets.find((entry) => entry.adapter.name === "Phantom");
  const phantomReadyState = phantomWallet?.readyState ?? WalletReadyState.Unsupported;
  const phantomAvailable =
    phantomReadyState === WalletReadyState.Installed ||
    phantomReadyState === WalletReadyState.Loadable;

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  const pendingConnect = useRef(false);

  useEffect(() => {
    if (pendingConnect.current && wallet && !connected && !connecting) {
      pendingConnect.current = false;
      connect().catch(() => {
        setStatusMessage("Wallet connection was rejected or could not be completed.");
      });
    }
  }, [wallet, connected, connecting, connect]);

  useEffect(() => {
    if (connected) {
      setStatusMessage(null);
    }
  }, [connected]);

  const handleConnect = useCallback(async () => {
    setStatusMessage(null);

    if (!phantomAvailable) {
      window.open("https://phantom.app/", "_blank", "noopener,noreferrer");
      setStatusMessage("Phantom was not detected in this browser. Opened install page.");
      return;
    }

    try {
      if (!wallet || wallet.adapter.name !== "Phantom") {
        pendingConnect.current = true;
        select(phantomWallet?.adapter.name ?? null);
      } else {
        await connect();
      }
    } catch {
      setStatusMessage("Wallet connection was rejected or could not be completed.");
    }
  }, [wallet, select, connect, phantomAvailable, phantomWallet]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setMenuOpen(false);
    setStatusMessage(null);
  }, [disconnect]);

  const truncatedAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  if (connected && truncatedAddress) {
    return (
      <div ref={ref} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setMenuOpen((p) => !p)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 14px",
            borderRadius: 999,
            background: "rgba(171,71,188,0.12)",
            border: "1px solid rgba(171,71,188,0.35)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "#ce93d8",
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            transition: "all 0.18s ease",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--success)",
              boxShadow: "0 0 10px var(--success)",
              flexShrink: 0,
            }}
          />
          {truncatedAddress}
        </button>

        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              minWidth: 200,
              padding: "12px 14px",
              borderRadius: 16,
              background: "rgba(10, 14, 23, 0.94)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(18px)",
              boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
              animation: "fadeIn 0.15s ease",
              zIndex: 50,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: 8,
              }}
            >
              Connected wallet
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-primary)",
                wordBreak: "break-all",
                lineHeight: 1.5,
                marginBottom: 12,
              }}
            >
              {publicKey?.toBase58()}
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(publicKey?.toBase58() ?? "");
                setMenuOpen(false);
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                marginBottom: 6,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Copy address
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(251,113,133,0.2)",
                background: "rgba(251,113,133,0.08)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--danger)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 14px",
          borderRadius: 999,
          background: "rgba(171,71,188,0.1)",
          border: "1px solid rgba(171,71,188,0.32)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#ce93d8",
          cursor: connecting ? "wait" : "pointer",
          backdropFilter: "blur(8px)",
          opacity: connecting ? 0.6 : 1,
          transition: "all 0.18s ease",
        }}
      >
        <PhantomIcon />
        {connecting ? "Connecting..." : phantomAvailable ? "Connect" : "Install Phantom"}
      </button>

      {statusMessage && (
        <div
          style={{
            maxWidth: 220,
            padding: "8px 10px",
            borderRadius: 12,
            background: "rgba(10, 14, 23, 0.92)",
            border: "1px solid rgba(255,255,255,0.1)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            lineHeight: 1.5,
            color: "var(--text-secondary)",
            textAlign: "right",
          }}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}

function PhantomIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 128 128" fill="none">
      <circle cx="64" cy="64" r="64" fill="rgba(171,71,188,0.25)" />
      <path
        d="M110.584 64.914H99.142C99.142 41.07 79.742 21.67 55.898 21.67C32.467 21.67 13.305 40.388 12.631 63.655C11.942 87.474 33.079 107.33 56.898 107.33H60.898C81.598 107.33 110.584 88.664 110.584 64.914Z"
        fill="#ce93d8"
      />
      <circle cx="44" cy="62" r="7" fill="#1a1225" />
      <circle cx="72" cy="62" r="7" fill="#1a1225" />
    </svg>
  );
}
