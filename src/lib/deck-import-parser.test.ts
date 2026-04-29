import { describe, it, expect } from "vitest";
import { parseDeckImport, type DeckImportRow } from "./deck-import-parser";

describe("parseDeckImport — Moxfield with *CMDR* marker", () => {
  it("detects commander from *CMDR* marker", () => {
    const input = `1 Atraxa, Praetors' Voice (ONE) 268 *CMDR*
4 Sol Ring (cmr) 385`;
    const { rows, detectedCommanderName } = parseDeckImport(input);
    expect(detectedCommanderName).toBe("Atraxa, Praetors' Voice");
    expect(rows[0].isCommander).toBe(true);
    expect(rows[1].isCommander).toBe(false);
  });

  it("strips *CMDR* before parsing the line", () => {
    const input = `1 Atraxa, Praetors' Voice (ONE) 268 *CMDR*`;
    const { rows } = parseDeckImport(input);
    expect(rows[0]).toMatchObject<Partial<DeckImportRow>>({
      quantity: 1,
      name: "Atraxa, Praetors' Voice",
      setCode: "ONE",
      collectorNumber: "268",
    });
  });

  it("is case-insensitive for *CMDR* marker", () => {
    const input = `1 Sol Ring (cmr) 385 *cmdr*`;
    const { rows, detectedCommanderName } = parseDeckImport(input);
    expect(rows[0].isCommander).toBe(true);
    expect(detectedCommanderName).toBe("Sol Ring");
  });
});

describe("parseDeckImport — Moxfield with // Commander section", () => {
  it("marks cards under // Commander section as commander", () => {
    const input = `// Commander
1 Atraxa, Praetors' Voice (ONE) 268
// Mainboard
4 Sol Ring (cmr) 385`;
    const { rows, detectedCommanderName } = parseDeckImport(input);
    expect(rows[0].isCommander).toBe(true);
    expect(rows[1].isCommander).toBe(false);
    expect(detectedCommanderName).toBe("Atraxa, Praetors' Voice");
  });

  it("only sets detectedCommanderName to the first commander card", () => {
    const input = `// Commander
1 Atraxa, Praetors' Voice (ONE) 268
1 Thrasios, Triton Hero (cmr) 46`;
    const { detectedCommanderName } = parseDeckImport(input);
    expect(detectedCommanderName).toBe("Atraxa, Praetors' Voice");
  });

  it("marks cards under // Sideboard section with board SIDE", () => {
    const input = `1 Sol Ring (cmr) 385
// Sideboard
2 Smash to Smithereens (SHM) 110`;
    const { rows } = parseDeckImport(input);
    expect(rows[0].board).toBe("MAIN");
    expect(rows[1].board).toBe("SIDE");
  });
});

describe("parseDeckImport — Moxfield without commander", () => {
  it("returns null detectedCommanderName when no commander marked", () => {
    const input = `4 Sol Ring (cmr) 385
4 Lightning Bolt (2x2) 117`;
    const { detectedCommanderName } = parseDeckImport(input);
    expect(detectedCommanderName).toBeNull();
  });

  it("all rows default to board MAIN and isCommander false", () => {
    const input = `4 Sol Ring (cmr) 385`;
    const { rows } = parseDeckImport(input);
    expect(rows[0].board).toBe("MAIN");
    expect(rows[0].isCommander).toBe(false);
  });

  it("reports unparseable lines as errors", () => {
    const input = `4 Sol Ring (cmr) 385
not a valid line`;
    const { rows, errors } = parseDeckImport(input);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });
});

describe("parseDeckImport — Arena format", () => {
  it("auto-detects Arena format from Deck/Sideboard headers", () => {
    const input = `Deck
4 Lightning Bolt (2x2) 117
1 Island (NEO) 284

Sideboard
2 Negate (IKO) 60`;
    const { rows } = parseDeckImport(input);
    expect(rows).toHaveLength(3);
  });

  it("marks Arena sideboard cards with board SIDE", () => {
    const input = `Deck
1 Sol Ring (cmr) 385

Sideboard
2 Negate (IKO) 60`;
    const { rows } = parseDeckImport(input);
    expect(rows[0].board).toBe("MAIN");
    expect(rows[1].board).toBe("SIDE");
  });

  it("returns no detectedCommanderName for Arena format", () => {
    const input = `Deck
1 Atraxa, Praetors' Voice (ONE) 268`;
    const { detectedCommanderName } = parseDeckImport(input);
    expect(detectedCommanderName).toBeNull();
  });
});

describe("parseDeckImport — Moxfield foil (*F*) and other markers", () => {
  it("parses a foil line with *F* marker", () => {
    const input = `1 Counterspell (CMM) 630 *F*`;
    const { rows, errors } = parseDeckImport(input);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject<Partial<DeckImportRow>>({
      quantity: 1,
      name: "Counterspell",
      setCode: "CMM",
      collectorNumber: "630",
    });
  });

  it("parses a line with both *CMDR* and *F* markers", () => {
    const input = `1 Atraxa, Praetors' Voice (ONE) 268 *CMDR* *F*`;
    const { rows, detectedCommanderName } = parseDeckImport(input);
    expect(rows[0].isCommander).toBe(true);
    expect(detectedCommanderName).toBe("Atraxa, Praetors' Voice");
    expect(rows[0].collectorNumber).toBe("268");
  });

  it("parses a mixed list with foil and non-foil", () => {
    const input = `4 Sol Ring (CMR) 385
1 Counterspell (CMM) 630 *F*`;
    const { rows, errors } = parseDeckImport(input);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
  });
});

describe("parseDeckImport — edge cases", () => {
  it("returns error for empty input", () => {
    const { rows, errors } = parseDeckImport("");
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("returns error for whitespace-only input", () => {
    const { rows, errors } = parseDeckImport("   \n  ");
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("handles card names with commas and apostrophes", () => {
    const input = `1 Korvold, Fae-Cursed King (eld) 329`;
    const { rows } = parseDeckImport(input);
    expect(rows[0].name).toBe("Korvold, Fae-Cursed King");
  });

  it("handles mixed valid and invalid lines", () => {
    const input = `4 Sol Ring (cmr) 385
this is garbage
1 Black Lotus (lea) 232`;
    const { rows, errors } = parseDeckImport(input);
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(1);
  });
});
