import { z } from "zod";
import { LIST_VIEW_MODES, GROUP_BY_OPTIONS, SORT_BY_OPTIONS } from "./list-controls";
import type { ListViewMode, GroupBy, SortBy } from "./list-controls";

export type ListPrefsScope = "collection" | "deck";

export interface ScopedListPrefs {
  view: ListViewMode;
  group: GroupBy;
  sort: SortBy;
}

export type ListPrefs = Partial<Record<ListPrefsScope, ScopedListPrefs>>;

export const listPrefsScopeSchema = z.enum(["collection", "deck"]);

export const scopedListPrefsSchema = z.object({
  view: z.enum(LIST_VIEW_MODES as [ListViewMode, ...ListViewMode[]]),
  group: z.enum(GROUP_BY_OPTIONS as [GroupBy, ...GroupBy[]]),
  sort: z.enum(SORT_BY_OPTIONS as [SortBy, ...SortBy[]]),
});

export const DEFAULT_SCOPED_PREFS: ScopedListPrefs = {
  view: "text",
  group: "none",
  sort: "name",
};

/** Reads prefs for a scope out of the raw Json? column, falling back to defaults on any shape mismatch. */
export function resolveScopedPrefs(raw: unknown, scope: ListPrefsScope): ScopedListPrefs {
  if (raw === null || typeof raw !== "object") return DEFAULT_SCOPED_PREFS;
  const candidate = (raw as Record<string, unknown>)[scope];
  const parsed = scopedListPrefsSchema.safeParse(candidate);
  return parsed.success ? parsed.data : DEFAULT_SCOPED_PREFS;
}
