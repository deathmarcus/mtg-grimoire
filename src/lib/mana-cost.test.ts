import { describe, expect, test } from "vitest";
import { parseManaCost } from "./mana-cost";

describe("parseManaCost", () => {
  test("returns empty array for null/undefined/empty", () => {
    expect(parseManaCost(null)).toEqual([]);
    expect(parseManaCost(undefined)).toEqual([]);
    expect(parseManaCost("")).toEqual([]);
  });

  test("parses single colored symbol", () => {
    expect(parseManaCost("{R}")).toEqual([{ kind: "color", value: "R" }]);
  });

  test("parses single generic numeric symbol", () => {
    expect(parseManaCost("{3}")).toEqual([{ kind: "generic", value: "3" }]);
  });

  test("parses mixed cost in order", () => {
    expect(parseManaCost("{3}{U}{U}")).toEqual([
      { kind: "generic", value: "3" },
      { kind: "color", value: "U" },
      { kind: "color", value: "U" },
    ]);
  });

  test("parses X cost as variable", () => {
    expect(parseManaCost("{X}{R}{R}")).toEqual([
      { kind: "variable", value: "X" },
      { kind: "color", value: "R" },
      { kind: "color", value: "R" },
    ]);
  });

  test("parses hybrid mana symbols", () => {
    expect(parseManaCost("{2/W}{U/B}")).toEqual([
      { kind: "hybrid", value: "2/W" },
      { kind: "hybrid", value: "U/B" },
    ]);
  });

  test("parses phyrexian mana", () => {
    expect(parseManaCost("{W/P}")).toEqual([{ kind: "phyrexian", value: "W/P" }]);
  });

  test("parses colorless mana symbol C", () => {
    expect(parseManaCost("{C}{C}")).toEqual([
      { kind: "colorless", value: "C" },
      { kind: "colorless", value: "C" },
    ]);
  });

  test("ignores garbage outside braces", () => {
    expect(parseManaCost("garbage{R}more")).toEqual([{ kind: "color", value: "R" }]);
  });
});
