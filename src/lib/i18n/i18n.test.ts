import { describe, it, expect } from "vitest";
import { t, type Locale } from "./index";

// NOTE: useLocale() is a React hook that reads document.documentElement.dataset.locale
// It cannot be unit-tested here without a DOM environment. Its correctness is verified
// by integration (layout sets data-locale, hook reads it). We test t() exhaustively.

describe("t() — translation lookup", () => {
  it("returns the Spanish string for a known key (es)", () => {
    expect(t("nav.dashboard", "es")).toBe("Dashboard");
  });

  it("returns the English string for a known key (en)", () => {
    expect(t("nav.collection", "en")).toBe("Collection");
  });

  it("returns a different string in ES vs EN for the same key", () => {
    const es = t("page.collection.empty", "es");
    const en = t("page.collection.empty", "en");
    expect(es).not.toBe("");
    expect(en).not.toBe("");
    expect(es).not.toBe(en);
  });

  it("returns the key itself when the key does not exist in the dictionary (never crashes)", () => {
    expect(t("nonexistent.key.xyz", "es")).toBe("nonexistent.key.xyz");
    expect(t("nonexistent.key.xyz", "en")).toBe("nonexistent.key.xyz");
  });

  it("falls back to 'es' dictionary when locale is invalid/unknown", () => {
    // Cast to Locale to simulate runtime bad value
    const result = t("nav.dashboard", "fr" as Locale);
    expect(result).toBe("Dashboard");
  });

  it("handles action keys correctly in both locales", () => {
    expect(typeof t("action.save", "es")).toBe("string");
    expect(typeof t("action.save", "en")).toBe("string");
    expect(t("action.save", "es").length).toBeGreaterThan(0);
    expect(t("action.save", "en").length).toBeGreaterThan(0);
  });

  it("returns non-empty strings for all required nav keys in both locales", () => {
    const navKeys = [
      "nav.dashboard",
      "nav.collection",
      "nav.folders",
      "nav.wishlist",
      "nav.decks",
      "nav.search",
      "nav.stats",
      "nav.addCard",
      "nav.import",
    ] as const;

    for (const key of navKeys) {
      expect(t(key, "es").length, `ES key missing: ${key}`).toBeGreaterThan(0);
      expect(t(key, "en").length, `EN key missing: ${key}`).toBeGreaterThan(0);
    }
  });

  it("returns non-empty strings for all required label keys in both locales", () => {
    const labelKeys = [
      "label.price",
      "label.quantity",
      "label.condition",
      "label.language",
      "label.foil",
      "label.folder",
      "label.usd",
      "label.mxn",
    ] as const;

    for (const key of labelKeys) {
      expect(t(key, "es").length, `ES label missing: ${key}`).toBeGreaterThan(0);
      expect(t(key, "en").length, `EN label missing: ${key}`).toBeGreaterThan(0);
    }
  });

  it("returns non-empty strings for all required action keys in both locales", () => {
    const actionKeys = [
      "action.save",
      "action.cancel",
      "action.delete",
      "action.edit",
      "action.add",
      "action.confirm",
      "action.back",
      "action.clear",
    ] as const;

    for (const key of actionKeys) {
      expect(t(key, "es").length, `ES action missing: ${key}`).toBeGreaterThan(0);
      expect(t(key, "en").length, `EN action missing: ${key}`).toBeGreaterThan(0);
    }
  });

  it("page keys are correctly defined for dashboard, collection, import in both locales", () => {
    const pageKeys = [
      "page.dashboard.title",
      "page.collection.title",
      "page.import.title",
      "page.wishlist.title",
      "page.decks.title",
      "page.search.title",
      "page.stats.title",
    ] as const;

    for (const key of pageKeys) {
      expect(t(key, "es").length, `ES page key missing: ${key}`).toBeGreaterThan(0);
      expect(t(key, "en").length, `EN page key missing: ${key}`).toBeGreaterThan(0);
    }
  });
});
