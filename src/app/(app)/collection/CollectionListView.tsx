"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Currency } from "@prisma/client";
import { groupCards, sortCards, type ListItem } from "@/lib/list-controls";
import type { ScopedListPrefs } from "@/lib/list-prefs";
import { ListControls } from "@/components/ListControls";
import { useIsMobile } from "@/lib/useIsMobile";
import { formatMoney } from "@/lib/money";
import { RarityDot } from "@/components/RarityDot";
import { ManaCost } from "@/components/ManaCost";
import { CardHoverPreview } from "@/components/CardHoverPreview";
import { LANGUAGES } from "@/lib/languages";
import { IconTrash } from "@/components/Icons";
import { bulkUpdateItems, bulkDeleteItems, type BulkChangeInput } from "./actions";
import { t, type Locale } from "@/lib/i18n";

export type CollectionRow = ListItem & {
  itemId: string;
  imageNormal: string | null;
  manaCost: string;
  collectorNumber: string;
  foil: "NORMAL" | "FOIL" | "ETCHED";
  condition: string;
  collectionName: string;
  totalUsd: number;
};

type Folder = { id: string; name: string };

type Props = {
  rows: CollectionRow[];
  currency: Currency;
  rate: number;
  showAll: boolean;
  locale: Locale;
  initialPrefs: ScopedListPrefs;
  folders: Folder[];
};

export function CollectionListView({ rows, currency, rate, showAll, locale, initialPrefs, folders }: Props) {
  const [prefs, setPrefs] = useState(initialPrefs);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();
  const router = useRouter();
  const effectiveView = isMobile && prefs.view === "stacks" ? "text" : prefs.view;

  const groups = useMemo(
    () => groupCards(sortCards(rows, prefs.sort), prefs.group),
    [rows, prefs.sort, prefs.group],
  );

  function toggle(itemId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected(new Set(rows.map((r) => r.itemId)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function afterBulkAction() {
    clearSelection();
    router.refresh();
  }

  const selectionProps = { selected, onToggle: toggle };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
        <ListControls scope="collection" prefs={prefs} onChange={setPrefs} locale={locale} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllFiltered}>
          {t("bulk.selectAllFiltered", locale)} ({rows.length})
        </button>
      </div>

      {effectiveView === "grid" && (
        <GroupedSections groups={groups} render={(g) => (
          <GridView rows={g.items} currency={currency} rate={rate} showAll={showAll} {...selectionProps} />
        )} />
      )}
      {effectiveView === "stacks" && (
        <GroupedSections groups={groups} render={(g) => (
          <StacksView rows={g.items} currency={currency} rate={rate} {...selectionProps} />
        )} />
      )}
      {effectiveView === "text" && (
        <GroupedSections groups={groups} render={(g) => (
          <TextView rows={g.items} currency={currency} rate={rate} showAll={showAll} {...selectionProps} />
        )} />
      )}

      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          itemIds={[...selected]}
          folders={folders}
          locale={locale}
          onClear={clearSelection}
          onDone={afterBulkAction}
        />
      )}
    </div>
  );
}

function GroupedSections({
  groups,
  render,
}: {
  groups: ReturnType<typeof groupCards<CollectionRow>>;
  render: (g: ReturnType<typeof groupCards<CollectionRow>>[number]) => React.ReactNode;
}) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {g.label && (
            <div className="eyebrow" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{g.label}</span>
              <span style={{ color: "var(--accent)" }}>{g.items.length}</span>
            </div>
          )}
          {render(g)}
        </div>
      ))}
    </>
  );
}

// ── Selection checkbox (shared) ─────────────────────────────────────────────

/** Stops the click from bubbling into an ancestor <Link> so the checkbox toggles instead of navigating. */
function SelectCheckbox({
  checked,
  onToggle,
  cardName,
  style,
}: {
  checked: boolean;
  onToggle: () => void;
  cardName: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onClick={(e) => e.stopPropagation()}
      onChange={onToggle}
      aria-label={`Select ${cardName}`}
      style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer", ...style }}
    />
  );
}

type SelectionProps = {
  selected: Set<string>;
  onToggle: (itemId: string) => void;
};

// ── Grid view (existing visual grid) ────────────────────────────────────────

function GridView({
  rows,
  currency,
  rate,
  showAll,
  selected,
  onToggle,
}: {
  rows: CollectionRow[];
  currency: Currency;
  rate: number;
  showAll: boolean;
} & SelectionProps) {
  return (
    <div className="coll-grid">
      {rows.map((r) => (
        <Link
          key={r.itemId}
          href={`/collection/${r.itemId}`}
          className={`coll-card${r.foil !== "NORMAL" ? " is-foil" : ""}`}
          style={{ position: "relative" }}
        >
          <div style={{ position: "absolute", top: 8, left: 8, zIndex: 2 }}>
            <SelectCheckbox checked={selected.has(r.itemId)} onToggle={() => onToggle(r.itemId)} cardName={r.card.name} />
          </div>
          <div className="card-art">
            {r.imageNormal ? (
              <Image src={r.imageNormal} alt={r.card.name} width={244} height={340} unoptimized />
            ) : (
              <div aria-hidden="true" style={{ width: "100%", height: "100%", background: "var(--bg-2)" }} />
            )}
          </div>
          <div className="coll-card-qty">×{r.quantity}</div>
          <div className="coll-card-meta">
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <RarityDot rarity={r.card.rarity} />
              <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                {r.card.setCode.toUpperCase()} · {r.collectorNumber}
              </span>
            </div>
            <div className="coll-card-name">{r.card.name}</div>
            <div className="coll-card-price">{formatMoney(r.totalUsd, currency, rate)}</div>
            {showAll && (
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  color: "var(--accent)",
                  background: "oklch(0.78 0.14 78 / 0.12)",
                  borderRadius: 3,
                  padding: "1px 5px",
                  marginTop: 3,
                  display: "inline-block",
                }}
              >
                {r.collectionName}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Stacks view (Archidekt-style stacked card art, reuses deck-column CSS) ──

function StacksView({
  rows,
  currency,
  rate,
  selected,
  onToggle,
}: { rows: CollectionRow[]; currency: Currency; rate: number } & SelectionProps) {
  return (
    <div className="deck-columns">
      <div className="deck-column" style={{ width: "100%" }}>
        {rows.map((r) => (
          <Link key={r.itemId} href={`/collection/${r.itemId}`} className="deck-stack-item" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
            <div className="deck-stack-row">
              <SelectCheckbox checked={selected.has(r.itemId)} onToggle={() => onToggle(r.itemId)} cardName={r.card.name} />
              <ManaCost cost={r.manaCost} />
              {r.quantity > 1 && <span className="deck-stack-qty">{r.quantity}×</span>}
              <span className="deck-stack-name">{r.card.name}</span>
              <span className="deck-stack-price">{formatMoney(r.totalUsd, currency, rate)}</span>
            </div>
            <div className="deck-stack-img">
              {r.imageNormal ? (
                <Image
                  src={r.imageNormal}
                  alt={r.card.name}
                  width={220}
                  height={308}
                  unoptimized
                  style={{ width: "100%", height: "auto", display: "block", borderRadius: "0 0 6px 6px" }}
                />
              ) : (
                <div style={{ height: 140, background: "var(--bg-3)" }} />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Text view (existing table/list) ─────────────────────────────────────────

function TextView({
  rows,
  currency,
  rate,
  showAll,
  selected,
  onToggle,
}: {
  rows: CollectionRow[];
  currency: Currency;
  rate: number;
  showAll: boolean;
} & SelectionProps) {
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.itemId));

  function toggleAll() {
    if (allChecked) {
      rows.forEach((r) => selected.has(r.itemId) && onToggle(r.itemId));
    } else {
      rows.forEach((r) => !selected.has(r.itemId) && onToggle(r.itemId));
    }
  }

  return (
    <>
      {/* Desktop table */}
      <div className="panel hidden md:block" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <caption className="sr-only">Collection items</caption>
          <thead>
            <tr>
              <th style={{ width: 24 }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  aria-label="Select all rows in this view"
                  style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer" }}
                />
              </th>
              <th></th>
              <th>Card</th>
              <th>Cost</th>
              <th>Set</th>
              {showAll && <th>Folder</th>}
              <th className="num">Qty</th>
              <th>Finish</th>
              <th>Cond.</th>
              <th className="num">Unit</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.itemId} style={{ cursor: "pointer" }}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(r.itemId)}
                    onChange={() => onToggle(r.itemId)}
                    aria-label={`Select ${r.card.name}`}
                    style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer" }}
                  />
                </td>
                <td style={{ width: 24 }}>
                  <RarityDot rarity={r.card.rarity} />
                </td>
                <td>
                  <CardHoverPreview imageUrl={r.imageNormal} cardName={r.card.name}>
                    <Link
                      href={`/collection/${r.itemId}`}
                      style={{
                        fontFamily: "var(--font-crimson-pro), Georgia, serif",
                        fontSize: 14,
                        color: "var(--ink-0)",
                        textDecoration: "none",
                      }}
                    >
                      {r.card.name}
                    </Link>
                  </CardHoverPreview>
                </td>
                <td>
                  <ManaCost cost={r.manaCost} />
                </td>
                <td>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>
                    {r.card.setCode.toUpperCase()}
                  </span>
                </td>
                {showAll && (
                  <td>
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      {r.collectionName}
                    </span>
                  </td>
                )}
                <td className="num">{r.quantity}</td>
                <td>
                  {r.foil === "NORMAL" ? (
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      —
                    </span>
                  ) : (
                    <span className="foil-chip">{r.foil}</span>
                  )}
                </td>
                <td>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    {r.condition}
                  </span>
                </td>
                <td className="num">{formatMoney(r.price ?? null, currency, rate)}</td>
                <td className="num" style={{ color: "var(--accent)" }}>
                  {formatMoney(r.totalUsd, currency, rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="panel md:hidden" style={{ padding: 0 }}>
        {rows.map((r) => (
          <Link
            key={r.itemId}
            href={`/collection/${r.itemId}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 18px",
              borderBottom: "1px solid var(--line-soft)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <SelectCheckbox checked={selected.has(r.itemId)} onToggle={() => onToggle(r.itemId)} cardName={r.card.name} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <RarityDot rarity={r.card.rarity} />
                <CardHoverPreview imageUrl={r.imageNormal} cardName={r.card.name} style={{ minWidth: 0, overflow: "hidden" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-crimson-pro), Georgia, serif",
                      fontSize: 14,
                      color: "var(--ink-0)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "block",
                    }}
                  >
                    {r.card.name}
                  </span>
                </CardHoverPreview>
              </div>
              <div
                className="mono"
                style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}
              >
                <span>
                  {r.card.setCode.toUpperCase()} · {r.quantity}× · {r.condition}
                  {showAll && ` · ${r.collectionName}`}
                </span>
                {r.foil !== "NORMAL" && <span className="foil-chip">{r.foil}</span>}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>
                {formatMoney(r.totalUsd, currency, rate)}
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
                {formatMoney(r.price ?? null, currency, rate)}/u
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

// ── Bulk action bar (issue #22) ─────────────────────────────────────────────

function BulkActionBar({
  count,
  itemIds,
  folders,
  locale,
  onClear,
  onDone,
}: {
  count: number;
  itemIds: string[];
  folders: Folder[];
  locale: Locale;
  onClear: () => void;
  onDone: () => void;
}) {
  const [folderId, setFolderId] = useState("");
  const [foil, setFoil] = useState("");
  const [language, setLanguage] = useState("");
  const [condition, setCondition] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChange = folderId !== "" || foil !== "" || language !== "" || condition !== "";

  function resetFields() {
    setFolderId("");
    setFoil("");
    setLanguage("");
    setCondition("");
  }

  function onApply() {
    if (!hasChange) return;
    setError(null);
    setNotice(null);
    const change: BulkChangeInput = {};
    if (folderId) change.collectionId = folderId;
    if (foil) change.foil = foil as BulkChangeInput["foil"];
    if (language) change.language = language;
    if (condition) change.condition = condition as BulkChangeInput["condition"];

    startTransition(async () => {
      const res = await bulkUpdateItems(itemIds, change);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.merged > 0) {
        setNotice(t("bulk.mergedNotice", locale).replace("{merged}", String(res.merged)));
      }
      resetFields();
      onDone();
    });
  }

  function onDelete() {
    const ok = window.confirm(t("bulk.deleteConfirm", locale).replace("{count}", String(count)));
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await bulkDeleteItems(itemIds);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div
      className="panel"
      style={{
        position: "sticky",
        bottom: 12,
        zIndex: 10,
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        padding: "10px 16px",
        border: "1px solid var(--accent)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
      }}
    >
      <span className="mono" style={{ fontSize: 12, color: "var(--accent)", whiteSpace: "nowrap" }}>
        {count} {t("bulk.selected", locale)}
      </span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onClear} disabled={isPending}>
        {t("bulk.clearSelection", locale)}
      </button>

      <div style={{ width: 1, height: 22, background: "var(--line-soft)" }} />

      <select
        value={folderId}
        onChange={(e) => setFolderId(e.target.value)}
        className="grimoire-input"
        style={{ fontSize: 12 }}
        aria-label={t("bulk.moveToFolder", locale)}
      >
        <option value="">{t("bulk.moveToFolder", locale)}</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>

      <select
        value={foil}
        onChange={(e) => setFoil(e.target.value)}
        className="grimoire-input"
        style={{ fontSize: 12 }}
        aria-label={t("label.foil", locale)}
      >
        <option value="">{t("bulk.noChange", locale)}</option>
        <option value="NORMAL">NORMAL</option>
        <option value="FOIL">FOIL</option>
        <option value="ETCHED">ETCHED</option>
      </select>

      <select
        value={condition}
        onChange={(e) => setCondition(e.target.value)}
        className="grimoire-input"
        style={{ fontSize: 12 }}
        aria-label={t("label.condition", locale)}
      >
        <option value="">{t("bulk.noChange", locale)}</option>
        {["NM", "LP", "MP", "HP", "DMG"].map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="grimoire-input"
        style={{ fontSize: 12 }}
        aria-label={t("label.language", locale)}
      >
        <option value="">{t("bulk.noChange", locale)}</option>
        {LANGUAGES.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={onApply}
        disabled={isPending || !hasChange}
      >
        {isPending ? "…" : t("bulk.applyChanges", locale)}
      </button>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        className="btn btn-sm"
        onClick={onDelete}
        disabled={isPending}
        style={{ color: "var(--neg)", borderColor: "var(--neg)" }}
      >
        <IconTrash size={12} />
        {t("bulk.deleteSelected", locale)}
      </button>

      {error && (
        <span className="chip neg" style={{ width: "100%" }}>
          {error}
        </span>
      )}
      {notice && (
        <span className="mono" style={{ width: "100%", fontSize: 11, color: "var(--ink-3)" }}>
          {notice}
        </span>
      )}
    </div>
  );
}
