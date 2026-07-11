// In-memory sliding-window rate limiter. The app runs as a single Next.js
// instance, so a process-local Map is sufficient — no Redis needed.

const MAX_TRACKED_KEYS = 10_000;
const IDLE_EVICTION_MS = 60 * 60 * 1000;

type Entry = {
  timestamps: number[];
};

const store = new Map<string, Entry>();

function pruneExpired(entry: Entry, now: number, windowMs: number): void {
  const cutoff = now - windowMs;
  while (entry.timestamps.length > 0 && entry.timestamps[0] <= cutoff) {
    entry.timestamps.shift();
  }
}

function pruneStoreIfLarge(): void {
  if (store.size <= MAX_TRACKED_KEYS) return;
  const now = Date.now();
  for (const [key, entry] of store) {
    const last = entry.timestamps[entry.timestamps.length - 1];
    if (entry.timestamps.length === 0 || now - last > IDLE_EVICTION_MS) {
      store.delete(key);
    }
  }
  if (store.size <= MAX_TRACKED_KEYS) return;
  // Hard cap: under a flood of fresh keys nothing is idle, so evict the
  // oldest keys (by last activity) until we are back at the limit.
  const byLastActivity = [...store.entries()].sort(
    (a, b) =>
      (a[1].timestamps[a[1].timestamps.length - 1] ?? 0) -
      (b[1].timestamps[b[1].timestamps.length - 1] ?? 0)
  );
  const excess = store.size - MAX_TRACKED_KEYS;
  for (let i = 0; i < excess; i++) {
    store.delete(byLastActivity[i][0]);
  }
}

export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }
  pruneExpired(entry, now, opts.windowMs);

  if (entry.timestamps.length >= opts.limit) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = Math.max(0, oldest + opts.windowMs - now);
    return { allowed: false, retryAfterMs };
  }

  entry.timestamps.push(now);
  pruneStoreIfLarge();
  return { allowed: true, retryAfterMs: 0 };
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}

export function getClientIp(headers: Headers): string {
  // Take the RIGHTMOST x-forwarded-for value: Caddy appends the real socket
  // IP at the end and does not strip client-sent values, so leftmost entries
  // are attacker-controlled. This assumes exactly ONE trusted proxy hop
  // (Caddy); if a CDN is ever placed in front, revisit this.
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

// Test-only helpers.
export function __resetRateLimitStore(): void {
  store.clear();
}

export function __rateLimitStoreSize(): number {
  return store.size;
}
