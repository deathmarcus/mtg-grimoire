"use client";

import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 768px)";

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Post-mount matchMedia check. Always returns false during SSR/first paint
 * (hydration-safe) and flips to true shortly after mount on narrow viewports.
 * Used to fall back "stacks" view to "text" on mobile — see F5 (#18).
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
