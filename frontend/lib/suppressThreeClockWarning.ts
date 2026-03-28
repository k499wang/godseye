const CLOCK_DEPRECATION =
  "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.";

declare global {
  interface Window {
    __godseyeThreeClockWarningPatched__?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__godseyeThreeClockWarningPatched__) {
  const originalWarn = console.warn.bind(console);

  console.warn = (...args: unknown[]) => {
    const [firstArg] = args;
    if (typeof firstArg === "string" && firstArg.includes(CLOCK_DEPRECATION)) {
      return;
    }

    originalWarn(...args);
  };

  window.__godseyeThreeClockWarningPatched__ = true;
}

export {};
