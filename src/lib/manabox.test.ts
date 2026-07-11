import { describe, it, expect } from "vitest";
import { parseManaboxCsv } from "./manabox";

describe("parseManaboxCsv — Scryfall ID normalization", () => {
  it("lowercases an uppercase Scryfall ID", () => {
    const csv = [
      "Name,Set code,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Condition,Language",
      'Llanowar Elves,dom,168,normal,common,1,123,F295B713-1D6B-4CC7-89A1-7CB0916F0B18,,near_mint,en',
    ].join("\n");
    const { rows, errors } = parseManaboxCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].scryfallId).toBe("f295b713-1d6b-4cc7-89a1-7cb0916f0b18");
  });
});
