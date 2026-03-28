"use client";

type GodseyeLogoProps = {
  subtitle?: string;
  size?: "sm" | "md";
};

export function GodseyeLogo({
  subtitle,
  size = "md",
}: GodseyeLogoProps) {
  const isSmall = size === "sm";

  return (
    <div className="flex items-center gap-3">
      <svg
        width={isSmall ? 34 : 42}
        height={isSmall ? 34 : 42}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="32"
          cy="32"
          r="26"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1.5"
        />
        <path
          d="M10 32c7.6-10 14.8-15 22-15s14.4 5 22 15c-7.6 10-14.8 15-22 15s-14.4-5-22-15Z"
          fill="rgba(245,158,11,0.12)"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="32" r="8.5" fill="var(--accent)" />
        <circle cx="32" cy="32" r="3.4" fill="var(--bg-base)" />
        <path
          d="M47 16c3.4 2.1 6.4 5.2 8.8 9.1"
          stroke="rgba(245,158,11,0.7)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="56.2" cy="28.2" r="2.8" fill="var(--accent)" />
      </svg>

      <div className="min-w-0">
        <div
          className="ui-mono"
          style={{
            fontSize: isSmall ? 12 : 13,
            fontWeight: 700,
            letterSpacing: isSmall ? "0.2em" : "0.26em",
            color: "var(--accent)",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          GODSEYE
        </div>
        {subtitle ? (
          <div
            className="ui-mono mt-1"
            style={{
              fontSize: isSmall ? 9 : 10,
              fontWeight: 600,
              letterSpacing: "0.18em",
              color: "var(--text-subtle)",
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
