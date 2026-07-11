import { describe, it, expect } from "vitest";
import { isScryfallId } from "./scryfall-id";

describe("isScryfallId", () => {
  it("accepts a valid lowercase UUID", () => {
    expect(isScryfallId("f295b713-1d6b-4cc7-89a1-7cb0916f0b18")).toBe(true);
  });

  it("accepts a valid uppercase UUID", () => {
    expect(isScryfallId("F295B713-1D6B-4CC7-89A1-7CB0916F0B18")).toBe(true);
  });

  it("rejects an id containing a slash", () => {
    expect(isScryfallId("f295b713-1d6b-4cc7-89a1-7cb0916f0b18/../secrets")).toBe(false);
  });

  it("rejects an id containing a question mark", () => {
    expect(isScryfallId("f295b713-1d6b-4cc7-89a1-7cb0916f0b18?x=1")).toBe(false);
  });

  it("rejects an id containing a hash", () => {
    expect(isScryfallId("f295b713-1d6b-4cc7-89a1-7cb0916f0b18#frag")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isScryfallId("")).toBe(false);
  });

  it("rejects an almost-UUID (wrong segment length)", () => {
    expect(isScryfallId("f295b713-1d6b-4cc7-89a1-7cb0916f0b1")).toBe(false);
  });
});
