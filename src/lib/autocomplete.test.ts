import { describe, it, expect } from "vitest";
import {
  autocompleteQuerySchema,
  buildAutocompleteQuery,
  MIN_QUERY_LENGTH,
  MAX_QUERY_LENGTH,
} from "./autocomplete";

describe("autocompleteQuerySchema", () => {
  it("rejects queries shorter than the minimum", () => {
    const result = autocompleteQuerySchema.safeParse({ q: "bo" });
    expect(result.success).toBe(false);
  });

  it("rejects queries longer than the maximum", () => {
    const result = autocompleteQuerySchema.safeParse({ q: "a".repeat(MAX_QUERY_LENGTH + 1) });
    expect(result.success).toBe(false);
  });

  it("accepts a query at the minimum length", () => {
    const result = autocompleteQuerySchema.safeParse({ q: "a".repeat(MIN_QUERY_LENGTH) });
    expect(result.success).toBe(true);
  });

  it("trims whitespace before checking length", () => {
    const result = autocompleteQuerySchema.safeParse({ q: "  bo  " });
    expect(result.success).toBe(false); // "bo" trimmed is only 2 chars
  });

  it("rejects a missing q", () => {
    const result = autocompleteQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("buildAutocompleteQuery", () => {
  it("parameterizes the contains, prefix, and limit values (no raw string interpolation)", () => {
    const sql = buildAutocompleteQuery("bolt", 10);
    expect(sql.values).toEqual(["%bolt%", "bolt%", 10]);
    expect(sql.sql).toContain("ILIKE");
    expect(sql.sql).toContain("DISTINCT name");
    expect(sql.sql).not.toContain("bolt");
  });

  it("escapes ILIKE metacharacters in the term so they match literally", () => {
    const sql = buildAutocompleteQuery("100%_off\\");
    expect(sql.values[0]).toBe("%100\\%\\_off\\\\%");
    expect(sql.values[1]).toBe("100\\%\\_off\\\\%");
  });

  it("defaults the limit to 10", () => {
    const sql = buildAutocompleteQuery("bolt");
    expect(sql.values[2]).toBe(10);
  });
});
