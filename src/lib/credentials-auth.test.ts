import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { authorizeCredentials } from "./credentials-auth";
import { resetRateLimit } from "./rate-limit";

const PASSWORD = "correct-horse-battery-staple";
let passwordHash: string;

beforeEach(async () => {
  vi.clearAllMocks();
  passwordHash = await bcrypt.hash(PASSWORD, 4);
  mockPrisma.user.findUnique.mockResolvedValue({
    id: "user-1",
    email: "person@example.com",
    name: "Person",
    image: null,
    passwordHash,
  });
});

describe("authorizeCredentials", () => {
  it("returns null for invalid raw credentials without querying the DB", async () => {
    const result = await authorizeCredentials({ email: "not-an-email", password: "short" }, "1.1.1.1");
    expect(result).toBeNull();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns the user shape on successful login", async () => {
    const result = await authorizeCredentials(
      { email: "person@example.com", password: PASSWORD },
      "2.2.2.2"
    );
    expect(result).toEqual({
      id: "user-1",
      email: "person@example.com",
      name: "Person",
      image: null,
    });
  });

  it("returns null when the password is wrong", async () => {
    const result = await authorizeCredentials(
      { email: "person@example.com", password: "wrong-password" },
      "3.3.3.3"
    );
    expect(result).toBeNull();
  });

  it("blocks the 6th failed attempt for the same ip+email without touching the DB or bcrypt", async () => {
    const ip = "4.4.4.4";
    const email = "person@example.com";
    for (let i = 0; i < 5; i++) {
      await authorizeCredentials({ email, password: "wrong-password" }, ip);
    }
    mockPrisma.user.findUnique.mockClear();

    const bcryptSpy = vi.spyOn(bcrypt, "compare");
    const result = await authorizeCredentials({ email, password: "wrong-password" }, ip);

    expect(result).toBeNull();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(bcryptSpy).not.toHaveBeenCalled();
    bcryptSpy.mockRestore();
  });

  it("resets the counter for that key after a successful login", async () => {
    const ip = "5.5.5.5";
    const email = "person@example.com";
    for (let i = 0; i < 4; i++) {
      await authorizeCredentials({ email, password: "wrong-password" }, ip);
    }
    const success = await authorizeCredentials({ email, password: PASSWORD }, ip);
    expect(success).not.toBeNull();

    // Counter reset means we can fail a few more times without hitting the limit immediately.
    const result = await authorizeCredentials({ email, password: "wrong-password" }, ip);
    expect(mockPrisma.user.findUnique).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("does not share the fine-grained limit across different emails on the same ip", async () => {
    const ip = "6.6.6.6";
    resetRateLimit(`login-ip:${ip}`);
    for (let i = 0; i < 5; i++) {
      await authorizeCredentials({ email: "one@example.com", password: "wrong-password" }, ip);
    }
    mockPrisma.user.findUnique.mockClear();

    const result = await authorizeCredentials({ email: "two@example.com", password: "wrong-password" }, ip);
    // Different email => fine-grained limit not exhausted; DB should be queried.
    expect(mockPrisma.user.findUnique).toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
