"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { PRIMARY_FORMATS } from "@/lib/card-detail";
import { toggleColor, type ColorLetter, type Rarity } from "@/lib/collection-filters";
import { buildSearchUrl, type SearchFilters, type OwnershipFilter, type SearchSortKey } from "@/lib/search-filters";

type Props = {
  filters: SearchFilters;
};

const ALL_COLORS: ColorLetter[] = ["W", "U", "B", "R", "G", "C"];
const ALL_RARITIES: Rarity[] = ["common", "uncommon", "rare", "mythic"];
const SORT_OPTIONS: { key: SearchSortKey; label: string }[] = [
  { key: "name", label: "Name A–Z" },
  { key: "price_desc", label: "Price ↓" },
  { key: "price_asc", label: "Price ↑" },
  { key: "rarity", label: "Rarity" },
];
const OWNERSHIP_OPTIONS: { value: OwnershipFilter; label: string }[] = [
  { value: "any", label: "All cards" },
  { value: "in_collection", label: "In my collection" },
  { value: "not_in_collection", label: "Not in collection" },
  { value: "on_wishlist", label: "On wishlist" },
];

export function SearchFilters({ filters }: Props) {
  const router = useRouter();

  const navigate = useCallback(
    (overrides: Partial<SearchFilters>) => {
      // Reset to page 1 on any filter change
      router.push(buildSearchUrl({ ...filters, ...overrides, page: 1 }));
    },
    [filters, router]
  );

  const handleQSubmit = useCallback(
    (e: React.SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const q = (form.elements.namedItem("q") as HTMLInputElement).value;
      navigate({ q });
    },
    [navigate]
  );

  const handleClearAll = useCallback(() => {
    router.push("/search");
  }, [router]);

  const hasActiveFilters =
    filters.q !== "" ||
    filters.colors.length > 0 ||
    filters.rarity !== null ||
    filters.format !== null ||
    filters.cmcMin !== null ||
    filters.cmcMax !== null ||
    filters.priceMin !== null ||
    filters.priceMax !== null ||
    filters.ownership !== "any";

  return (
    <aside className="search-filters panel">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <span className="eyebrow">Filters</span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, padding: "3px 8px" }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Text search */}
      <div className="field" style={{ marginBottom: 16 }}>
        <label htmlFor="search-q">Text search</label>
        <form onSubmit={handleQSubmit} role="search">
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            key={filters.q}
            placeholder="Name or set…"
            className="grimoire-input"
            style={{ width: "100%" }}
          />
        </form>
      </div>

      {/* Colors */}
      <div className="field" style={{ marginBottom: 16 }}>
        <label>Colors</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          {ALL_COLORS.map((c) => {
            const active = filters.colors.includes(c);
            const dimmed = filters.colors.length > 0 && !active;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                aria-label={`Toggle color ${c}`}
                onClick={() => navigate({ colors: toggleColor(filters.colors, c) })}
                style={{
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  opacity: dimmed ? 0.3 : 1,
                  transform: active ? "scale(1.2)" : "scale(1)",
                  transition: "all 120ms",
                }}
              >
                <i className={`ms ms-${c.toLowerCase()} ms-cost ms-shadow`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Rarity */}
      <div className="field" style={{ marginBottom: 16 }}>
        <label>Rarity</label>
        <div
          style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}
        >
          <button
            type="button"
            onClick={() => navigate({ rarity: null })}
            className={`btn btn-sm ${filters.rarity === null ? "btn-primary" : ""}`}
          >
            All
          </button>
          {ALL_RARITIES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() =>
                navigate({ rarity: filters.rarity === r ? null : r })
              }
              className={`btn btn-sm ${filters.rarity === r ? "btn-primary" : ""}`}
              style={{ textTransform: "capitalize" }}
            >
              {r[0].toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Format */}
      <div className="field" style={{ marginBottom: 16 }}>
        <label htmlFor="search-format">Format (legal)</label>
        <select
          id="search-format"
          value={filters.format ?? ""}
          onChange={(e) =>
            navigate({ format: e.target.value || null })
          }
          className="grimoire-select"
        >
          <option value="">Any format</option>
          {PRIMARY_FORMATS.map((f) => (
            <option key={f} value={f}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* CMC range */}
      <div className="field" style={{ marginBottom: 16 }}>
        <label>CMC range</label>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
          <input
            type="number"
            min={0}
            max={20}
            placeholder="Min"
            defaultValue={filters.cmcMin ?? ""}
            key={`cmcMin-${filters.cmcMin}`}
            onBlur={(e) => {
              const val = e.target.value;
              navigate({ cmcMin: val ? parseFloat(val) : null });
            }}
            className="grimoire-input"
            style={{ width: "70px" }}
            aria-label="CMC minimum"
          />
          <span className="eyebrow" style={{ flexShrink: 0 }}>to</span>
          <input
            type="number"
            min={0}
            max={20}
            placeholder="Max"
            defaultValue={filters.cmcMax ?? ""}
            key={`cmcMax-${filters.cmcMax}`}
            onBlur={(e) => {
              const val = e.target.value;
              navigate({ cmcMax: val ? parseFloat(val) : null });
            }}
            className="grimoire-input"
            style={{ width: "70px" }}
            aria-label="CMC maximum"
          />
        </div>
      </div>

      {/* Price range */}
      <div className="field" style={{ marginBottom: 16 }}>
        <label>Price USD</label>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Min"
            defaultValue={filters.priceMin ?? ""}
            key={`priceMin-${filters.priceMin}`}
            onBlur={(e) => {
              const val = e.target.value;
              navigate({ priceMin: val ? parseFloat(val) : null });
            }}
            className="grimoire-input"
            style={{ width: "70px" }}
            aria-label="Price minimum USD"
          />
          <span className="eyebrow" style={{ flexShrink: 0 }}>to</span>
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Max"
            defaultValue={filters.priceMax ?? ""}
            key={`priceMax-${filters.priceMax}`}
            onBlur={(e) => {
              const val = e.target.value;
              navigate({ priceMax: val ? parseFloat(val) : null });
            }}
            className="grimoire-input"
            style={{ width: "70px" }}
            aria-label="Price maximum USD"
          />
        </div>
      </div>

      {/* Ownership */}
      <div className="field" style={{ marginBottom: 16 }}>
        <label>Ownership</label>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginTop: 4,
          }}
        >
          {OWNERSHIP_OPTIONS.map(({ value, label }) => (
            <label
              key={value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "var(--ink-1)",
                padding: "4px 0",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="ownership"
                value={value}
                checked={filters.ownership === value}
                onChange={() => navigate({ ownership: value })}
                style={{ accentColor: "var(--accent)" }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div className="field">
        <label htmlFor="search-sort">Sort by</label>
        <select
          id="search-sort"
          value={filters.sort}
          onChange={(e) =>
            navigate({ sort: e.target.value as SearchSortKey })
          }
          className="grimoire-select"
          style={{ marginTop: 4 }}
        >
          {SORT_OPTIONS.map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
