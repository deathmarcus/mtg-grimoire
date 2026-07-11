"use client";

import { useTransition } from "react";
import {
  LIST_VIEW_MODES,
  GROUP_BY_OPTIONS,
  SORT_BY_OPTIONS,
  type ListViewMode,
  type GroupBy,
  type SortBy,
} from "@/lib/list-controls";
import type { ScopedListPrefs, ListPrefsScope } from "@/lib/list-prefs";
import { setListPrefs } from "@/app/(app)/actions";
import { t, type Locale } from "@/lib/i18n";

type Props = {
  scope: ListPrefsScope;
  prefs: ScopedListPrefs;
  onChange: (prefs: ScopedListPrefs) => void;
  locale: Locale;
};

/** Compact Grimoire toolbar: View / Group / Sort — shared by /collection and /decks/[id]. */
export function ListControls({ scope, prefs, onChange, locale }: Props) {
  const [isPending, startTransition] = useTransition();

  function update(patch: Partial<ScopedListPrefs>) {
    const next = { ...prefs, ...patch };
    onChange(next);
    startTransition(() => void setListPrefs(scope, next));
  }

  return (
    <div
      style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}
      aria-busy={isPending}
    >
      <Segment
        label={t("list.view.label", locale)}
        value={prefs.view}
        options={LIST_VIEW_MODES}
        optionLabel={(v) => t(`list.view.${v}`, locale)}
        onSelect={(v) => update({ view: v as ListViewMode })}
      />
      <Segment
        label={t("list.group.label", locale)}
        value={prefs.group}
        options={GROUP_BY_OPTIONS}
        optionLabel={(v) => t(`list.group.${v}`, locale)}
        onSelect={(v) => update({ group: v as GroupBy })}
      />
      <Segment
        label={t("list.sort.label", locale)}
        value={prefs.sort}
        options={SORT_BY_OPTIONS}
        optionLabel={(v) => t(`list.sort.${v}`, locale)}
        onSelect={(v) => update({ sort: v as SortBy })}
      />
    </div>
  );
}

function Segment<T extends string>({
  label,
  value,
  options,
  optionLabel,
  onSelect,
}: {
  label: string;
  value: T;
  options: readonly T[];
  optionLabel: (v: T) => string;
  onSelect: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span className="eyebrow">{label}</span>
      <div className="toggle-group">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={opt === value}
            className={opt === value ? "active" : ""}
            onClick={() => onSelect(opt)}
          >
            {optionLabel(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}
