import { describe, it, expect } from "vitest";
import {
  parseMoxfieldTxt,
  parseArchidektCsv,
  parseDeckList,
  type DeckRow,
} from "./deck-parser";

describe("parseMoxfieldTxt", () => {
  it("parses standard lines: qty name (setCode) collectorNumber", () => {
    const input = `1 Sol Ring (cmr) 385
4 Lightning Bolt (2x2) 117`;
    const { rows, errors } = parseMoxfieldTxt(input);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual<DeckRow>({
      quantity: 1,
      name: "Sol Ring",
      setCode: "cmr",
      collectorNumber: "385",
    });
    expect(rows[1]).toEqual<DeckRow>({
      quantity: 4,
      name: "Lightning Bolt",
      setCode: "2x2",
      collectorNumber: "117",
    });
    expect(errors).toHaveLength(0);
  });

  it("skips section headers (// Commander, // Mainboard)", () => {
    const input = `// Commander
1 Atraxa, Praetors' Voice (cm2) 10
// Mainboard
4 Sol Ring (cmr) 385`;
    const { rows } = parseMoxfieldTxt(input);
    expect(rows).toHaveLength(2);
  });

  it("skips blank lines", () => {
    const input = `1 Sol Ring (cmr) 385

4 Lightning Bolt (2x2) 117
`;
    const { rows } = parseMoxfieldTxt(input);
    expect(rows).toHaveLength(2);
  });

  it("reports unparseable lines as errors", () => {
    const input = `1 Sol Ring (cmr) 385
garbage line here
4 Lightning Bolt (2x2) 117`;
    const { rows, errors } = parseMoxfieldTxt(input);
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/line 2/i);
  });

  it("handles names with commas and apostrophes", () => {
    const input = `1 Korvold, Fae-Cursed King (eld) 329`;
    const { rows } = parseMoxfieldTxt(input);
    expect(rows[0].name).toBe("Korvold, Fae-Cursed King");
  });
});

describe("parseArchidektCsv", () => {
  it("parses CSV with standard Archidekt headers", () => {
    const input = `Quantity,Name,Set,Collector Number
1,Sol Ring,cmr,385
4,Lightning Bolt,2x2,117`;
    const { rows, errors } = parseArchidektCsv(input);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual<DeckRow>({
      quantity: 1,
      name: "Sol Ring",
      setCode: "cmr",
      collectorNumber: "385",
    });
    expect(errors).toHaveLength(0);
  });

  it("handles quoted fields with commas", () => {
    const input = `Quantity,Name,Set,Collector Number
1,"Korvold, Fae-Cursed King",eld,329`;
    const { rows } = parseArchidektCsv(input);
    expect(rows[0].name).toBe("Korvold, Fae-Cursed King");
  });

  it("skips rows with missing required fields", () => {
    const input = `Quantity,Name,Set,Collector Number
1,Sol Ring,cmr,385
,,, `;
    const { rows, errors } = parseArchidektCsv(input);
    expect(rows).toHaveLength(1);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("parseDeckList", () => {
  it("auto-detects Moxfield .txt format", () => {
    const input = `1 Sol Ring (cmr) 385
4 Lightning Bolt (2x2) 117`;
    const { rows } = parseDeckList(input);
    expect(rows).toHaveLength(2);
  });

  it("auto-detects Archidekt .csv format", () => {
    const input = `Quantity,Name,Set,Collector Number
1,Sol Ring,cmr,385`;
    const { rows } = parseDeckList(input);
    expect(rows).toHaveLength(1);
  });

  it("returns error for empty input", () => {
    const { rows, errors } = parseDeckList("");
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
});
