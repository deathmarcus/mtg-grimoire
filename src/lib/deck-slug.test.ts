import { describe, it, expect } from "vitest";
import {
  slugify,
  containsForbiddenWord,
  generateDeckSlug,
  shouldIndex,
  SLUG_CHARSET_RE,
} from "./deck-slug";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Mono Red Burn")).toBe("mono-red-burn");
  });

  it("strips accents and diacritics", () => {
    expect(slugify("Ñandú Aggró Résumé")).toBe("nandu-aggro-resume");
  });

  it("collapses punctuation and symbols into single hyphens", () => {
    expect(slugify("Aetherflux!! Reservoir // Combo")).toBe(
      "aetherflux-reservoir-combo"
    );
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Storm Deck--  ")).toBe("storm-deck");
  });

  it("caps length at 40 characters without a trailing hyphen", () => {
    const long = "a".repeat(30) + " " + "b".repeat(30);
    const result = slugify(long);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result.endsWith("-")).toBe(false);
  });

  it("returns an empty string for names with no sluggable characters", () => {
    expect(slugify("💥🔥")).toBe("");
  });

  it("only produces charset-safe output", () => {
    expect(SLUG_CHARSET_RE.test(slugify("Ñandú Aggró!! 2024"))).toBe(true);
  });
});

describe("containsForbiddenWord", () => {
  it("flags a forbidden word as a whole segment", () => {
    expect(containsForbiddenWord("mierda-deck")).toBe(true);
    expect(containsForbiddenWord(slugify("Shit Tier Deck"))).toBe(true);
  });

  it("does not flag a forbidden word as a substring of another word", () => {
    // "assassin" contains "ass"-like substrings in some naive filters — ours
    // matches whole hyphen-delimited segments only.
    expect(containsForbiddenWord("assassin-tribal")).toBe(false);
  });

  it("is case-insensitive because input is already slugified/lowercased", () => {
    expect(containsForbiddenWord(slugify("FUCK Around Deck"))).toBe(true);
  });
});

describe("generateDeckSlug", () => {
  it("appends the injected suffix to the slugified name", () => {
    const slug = generateDeckSlug("Mono Red Burn", { suffix: () => "x7k2m" });
    expect(slug).toBe("mono-red-burn-x7k2m");
  });

  it("falls back to the bare suffix when the name is entirely unsluggable", () => {
    const slug = generateDeckSlug("🔥🔥🔥", { suffix: () => "x7k2m" });
    expect(slug).toBe("x7k2m");
  });

  it("falls back to the bare suffix when the slugified name contains a forbidden word", () => {
    const slug = generateDeckSlug("Puta Madre Deck", { suffix: () => "x7k2m" });
    expect(slug).toBe("x7k2m");
  });

  it("uses a real random suffix by default and stays charset-safe", () => {
    const slug = generateDeckSlug("Izzet Spells");
    expect(SLUG_CHARSET_RE.test(slug)).toBe(true);
    expect(slug.startsWith("izzet-spells-")).toBe(true);
  });
});

describe("shouldIndex", () => {
  it("is false when publicSince is null", () => {
    expect(shouldIndex(null, new Date())).toBe(false);
  });

  it("is false when public for less than 7 days", () => {
    const now = new Date("2026-07-11T00:00:00Z");
    const publicSince = new Date("2026-07-08T00:00:00Z"); // 3 days
    expect(shouldIndex(publicSince, now)).toBe(false);
  });

  it("is true at exactly 7 days (boundary)", () => {
    const publicSince = new Date("2026-07-01T00:00:00Z");
    const now = new Date("2026-07-08T00:00:00Z"); // exactly 7 days later
    expect(shouldIndex(publicSince, now)).toBe(true);
  });

  it("is true when public for more than 7 days", () => {
    const publicSince = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-07-11T00:00:00Z");
    expect(shouldIndex(publicSince, now)).toBe(true);
  });
});
