export type AutocompleteNavState = {
  open: boolean;
  highlightedIndex: number; // -1 = nothing highlighted
};

export type AutocompleteNavAction = "ArrowDown" | "ArrowUp" | "Enter" | "Escape";

const CLOSED: AutocompleteNavState = { open: false, highlightedIndex: -1 };

/**
 * Pure keyboard-navigation reducer for the autocomplete dropdown. `resultCount`
 * is passed in on every call rather than stored in state, since results arrive
 * asynchronously and can change between keystrokes independent of nav state.
 *
 * On "Enter", the caller must read `state.highlightedIndex` *before* dispatching
 * (to know which result was selected) — the reducer only returns the next
 * (closed) state.
 */
export function reduceAutocompleteNav(
  state: AutocompleteNavState,
  action: AutocompleteNavAction,
  resultCount: number
): AutocompleteNavState {
  switch (action) {
    case "ArrowDown": {
      if (resultCount === 0) return CLOSED;
      if (!state.open) return { open: true, highlightedIndex: 0 };
      const next = state.highlightedIndex + 1;
      return { open: true, highlightedIndex: next >= resultCount ? 0 : next };
    }
    case "ArrowUp": {
      if (resultCount === 0) return CLOSED;
      if (!state.open) return { open: true, highlightedIndex: resultCount - 1 };
      const next = state.highlightedIndex - 1;
      return { open: true, highlightedIndex: next < 0 ? resultCount - 1 : next };
    }
    case "Enter":
    case "Escape":
      return CLOSED;
    default:
      return state;
  }
}
