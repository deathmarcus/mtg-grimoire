import { describe, it, expect } from "vitest";
import { reduceAutocompleteNav, type AutocompleteNavState } from "./autocomplete-nav";

const CLOSED: AutocompleteNavState = { open: false, highlightedIndex: -1 };

describe("reduceAutocompleteNav", () => {
  it("ArrowDown on a closed dropdown opens it and highlights the first item", () => {
    const next = reduceAutocompleteNav(CLOSED, "ArrowDown", 3);
    expect(next).toEqual({ open: true, highlightedIndex: 0 });
  });

  it("ArrowDown on a closed dropdown with no results stays closed", () => {
    const next = reduceAutocompleteNav(CLOSED, "ArrowDown", 0);
    expect(next).toEqual({ open: false, highlightedIndex: -1 });
  });

  it("ArrowDown advances the highlighted index", () => {
    const state: AutocompleteNavState = { open: true, highlightedIndex: 0 };
    const next = reduceAutocompleteNav(state, "ArrowDown", 3);
    expect(next).toEqual({ open: true, highlightedIndex: 1 });
  });

  it("ArrowDown wraps from the last item back to the first", () => {
    const state: AutocompleteNavState = { open: true, highlightedIndex: 2 };
    const next = reduceAutocompleteNav(state, "ArrowDown", 3);
    expect(next).toEqual({ open: true, highlightedIndex: 0 });
  });

  it("ArrowUp on a closed dropdown opens it and highlights the last item", () => {
    const next = reduceAutocompleteNav(CLOSED, "ArrowUp", 3);
    expect(next).toEqual({ open: true, highlightedIndex: 2 });
  });

  it("ArrowUp wraps from the first item back to the last", () => {
    const state: AutocompleteNavState = { open: true, highlightedIndex: 0 };
    const next = reduceAutocompleteNav(state, "ArrowUp", 3);
    expect(next).toEqual({ open: true, highlightedIndex: 2 });
  });

  it("Escape closes the dropdown and clears the highlight", () => {
    const state: AutocompleteNavState = { open: true, highlightedIndex: 1 };
    const next = reduceAutocompleteNav(state, "Escape", 3);
    expect(next).toEqual({ open: false, highlightedIndex: -1 });
  });

  it("Enter closes the dropdown (selection is read by the caller before dispatch)", () => {
    const state: AutocompleteNavState = { open: true, highlightedIndex: 1 };
    const next = reduceAutocompleteNav(state, "Enter", 3);
    expect(next).toEqual({ open: false, highlightedIndex: -1 });
  });

  it("Enter with no highlight just closes", () => {
    const state: AutocompleteNavState = { open: true, highlightedIndex: -1 };
    const next = reduceAutocompleteNav(state, "Enter", 3);
    expect(next).toEqual({ open: false, highlightedIndex: -1 });
  });

  it("resultCount shrinking below the current highlight clamps on ArrowDown", () => {
    // e.g. results changed from 5 to 2 between renders
    const state: AutocompleteNavState = { open: true, highlightedIndex: 4 };
    const next = reduceAutocompleteNav(state, "ArrowDown", 2);
    expect(next).toEqual({ open: true, highlightedIndex: 0 });
  });
});
