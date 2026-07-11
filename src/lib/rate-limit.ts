// In-memory sliding-window rate limiter. The app runs as a single Next.js
// instance, so a process-local Map is sufficient — no Redis needed.

const MAX_TRACKED_KEYS = 10_000;

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
    if (entry.timestamps.length === 0 || now - entry.timestamps[entry.timestamps.length - 1] > 60 * 60 * 1000) {
      store.delete(key);
    }
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
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
