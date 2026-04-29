import { describe, it, expect } from "vitest";
import { slugifyCollectionName, validateCollectionName } from "./collection-helpers";

describe("slugifyCollectionName", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugifyCollectionName("Mi colección")).toBe("mi-coleccion");
  });

  it("strips diacritics", () => {
    expect(slugifyCollectionName("Mazo Rojo Ñoño")).toBe("mazo-rojo-nono");
  });

  it("collapses multiple spaces and trims", () => {
    expect(slugifyCollectionName("  Mythics   &   Rares  ")).toBe("mythics-rares");
  });

  it("removes non-alphanumeric except hyphens", () => {
    expect(slugifyCollectionName("Vender!!! (urgente)")).toBe("vender-urgente");
  });

  it("returns empty string for input with no usable chars", () => {
    expect(slugifyCollectionName("!!!")).toBe("");
  });
});

describe("validateCollectionName", () => {
  it("accepts a normal name", () => {
    expect(validateCollectionName("Mythics")).toEqual({ ok: true, value: "Mythics" });
  });

  it("trims surrounding whitespace", () => {
    expect(validateCollectionName("  Vender  ")).toEqual({ ok: true, value: "Vender" });
  });

  it("rejects empty or whitespace-only names", () => {
    expect(validateCollectionName("")).toEqual({ ok: false, error: "El nombre es obligatorio" });
    expect(validateCollectionName("   ")).toEqual({ ok: false, error: "El nombre es obligatorio" });
  });

  it("rejects names longer than 50 characters", () => {
    const long = "a".repeat(51);
    const result = validateCollectionName(long);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/50/);
  });

  it("rejects names that slugify to nothing", () => {
    const result = validateCollectionName("!!!");
    expect(result.ok).toBe(false);
  });
});
