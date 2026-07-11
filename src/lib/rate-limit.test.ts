import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkRateLimit,
  resetRateLimit,
  getClientIp,
  __resetRateLimitStore,
  __rateLimitStoreSize,
} from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    __resetRateLimitStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows attempts up to the limit", () => {
    const key = "test:allow";
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, { limit: 5, windowMs: 1000 }).allowed).toBe(true);
    }
  });

  it("blocks the attempt after the limit is reached", () => {
    const key = "test:block";
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, { limit: 5, windowMs: 1000 });
    }
    const result = checkRateLimit(key, { limit: 5, windowMs: 1000 });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("does not count a blocked attempt toward future checks", () => {
    const key = "test:no-count";
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, { limit: 5, windowMs: 1000 });
    }
    // Blocked attempts, should not add more entries.
    checkRateLimit(key, { limit: 5, windowMs: 1000 });
    checkRateLimit(key, { limit: 5, windowMs: 1000 });

    vi.advanceTimersByTime(1001);
    expect(checkRateLimit(key, { limit: 5, windowMs: 1000 }).allowed).toBe(true);
  });

  it("allows attempts again after the window expires", () => {
    const key = "test:expire";
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, { limit: 5, windowMs: 1000 });
    }
    expect(checkRateLimit(key, { limit: 5, windowMs: 1000 }).allowed).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(checkRateLimit(key, { limit: 5, windowMs: 1000 }).allowed).toBe(true);
  });

  it("resetRateLimit unblocks a key", () => {
    const key = "test:reset";
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, { limit: 5, windowMs: 1000 });
    }
    expect(checkRateLimit(key, { limit: 5, windowMs: 1000 }).allowed).toBe(false);

    resetRateLimit(key);

    expect(checkRateLimit(key, { limit: 5, windowMs: 1000 }).allowed).toBe(true);
  });

  it("keeps independent keys unaffected by one another", () => {
    const keyA = "test:a";
    const keyB = "test:b";
    for (let i = 0; i < 5; i++) {
      checkRateLimit(keyA, { limit: 5, windowMs: 1000 });
    }
    expect(checkRateLimit(keyA, { limit: 5, windowMs: 1000 }).allowed).toBe(false);
    expect(checkRateLimit(keyB, { limit: 5, windowMs: 1000 }).allowed).toBe(true);
  });

  it("bounds the store size even when all keys are fresh (hard eviction)", () => {
    const opts = { limit: 5, windowMs: 60 * 60 * 1000 };
    for (let i = 0; i < 10_500; i++) {
      checkRateLimit(`flood:${i}`, opts);
    }
    expect(__rateLimitStoreSize()).toBeLessThanOrEqual(10_000);
  });
});

describe("getClientIp", () => {
  it("takes the rightmost x-forwarded-for value (appended by the trusted proxy)", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(headers)).toBe("5.6.7.8");
  });

  it("ignores client-spoofed leftmost values", () => {
    const headers = new Headers({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" });
    expect(getClientIp(headers)).toBe("203.0.113.7");
  });

  it("handles a single x-forwarded-for value", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("skips empty trailing segments", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, " });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "9.8.7.6" });
    expect(getClientIp(headers)).toBe("9.8.7.6");
  });

  it("falls back to unknown when no headers are present", () => {
    const headers = new Headers();
    expect(getClientIp(headers)).toBe("unknown");
  });
});
