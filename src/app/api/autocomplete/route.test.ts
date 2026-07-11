import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: { $queryRaw: vi.fn() },
}));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "./route";
import { __resetRateLimitStore } from "@/lib/rate-limit";

function req(qs: string) {
  return new Request(`http://localhost/api/autocomplete?${qs}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetRateLimitStore();
  mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  mockPrisma.$queryRaw.mockResolvedValue([{ name: "Lightning Bolt" }]);
});

describe("GET /api/autocomplete", () => {
  it("returns 401 without a session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(req("q=bolt"));
    expect(res.status).toBe(401);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns 400 when q is shorter than 3 characters", async () => {
    const res = await GET(req("q=bo"));
    expect(res.status).toBe(400);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns 400 when q is missing", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(400);
  });

  it("returns 400 when q exceeds 80 characters", async () => {
    const res = await GET(req(`q=${"a".repeat(81)}`));
    expect(res.status).toBe(400);
  });

  it("returns deduplicated name results for a valid query", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { name: "Lightning Bolt" },
      { name: "Lightning Strike" },
    ]);
    const res = await GET(req("q=light"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ results: ["Lightning Bolt", "Lightning Strike"] });
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns 429 with Retry-After once the per-user rate limit is exceeded", async () => {
    for (let i = 0; i < 30; i++) {
      const res = await GET(req("q=bolt"));
      expect(res.status).toBe(200);
    }
    const res = await GET(req("q=bolt"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).not.toBeNull();
  });

  it("scopes the rate limit per user so one user's requests don't block another", async () => {
    for (let i = 0; i < 30; i++) {
      await GET(req("q=bolt"));
    }
    expect((await GET(req("q=bolt"))).status).toBe(429);

    mockAuth.mockResolvedValue({ user: { id: "user-2" } });
    expect((await GET(req("q=bolt"))).status).toBe(200);
  });
});
