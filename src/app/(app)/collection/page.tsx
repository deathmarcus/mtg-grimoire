import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatMoney, getLatestFxRate } from "@/lib/money";
import { pickPriceForFinish } from "@/lib/pricing";
import { formatPriceProvenance, formatFxProvenance, latestDate } from "@/lib/price-provenance";
import {
  parseColorsParam,
  parseRarityParam,
  toggleColor,
  type ColorLetter,
  type Rarity,
} from "@/lib/collection-filters";
import { resolveScopedPrefs } from "@/lib/list-prefs";
import { CollectionListView, type CollectionRow } from "./CollectionListView";
import { ExportButtons } from "../ExportButtons";
import { IconSearch } from "@/components/Icons";
import { t, type Locale } from "@/lib/i18n";

type SearchParams = Promise<{
  q?: string;
  folder?: string;
  colors?: string;
  rarity?: string;
}>;

type FilterState = {
  q?: string;
  folder?: string | null;
  colors: ColorLetter[];
  rarity: Rarity | null;
};

function buildUrl(state: FilterState, overrides: Partial<FilterState>): string {
  const merged = { ...state, ...overrides };
  const p = new URLSearchParams();
  if (merged.q) p.set("q", merged.q);
  if (merged.folder) p.set("folder", merged.folder);
  if (merged.colors.length) p.set("colors", merged.colors.join(","));
  if (merged.rarity) p.set("rarity", merged.rarity);
  const s = p.toString();
  return s ? `/collection?${s}` : "/collection";
}

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const colors = parseColorsParam(sp.colors);
  const rarity = parseRarityParam(sp.rarity);

  const [dbUser, collections] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { displayCurrency: true, locale: true, listPrefs: true },
    }),
    prisma.collection.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  const currency = dbUser?.displayCurrency ?? "USD";
  const locale = (dbUser?.locale ?? "es") as Locale;
  const initialPrefs = resolveScopedPrefs(dbUser?.listPrefs, "collection");

  const activeFolder = sp.folder && collections.some((c) => c.id === sp.folder)
    ? sp.folder
    : null;
  const showAll = !activeFolder;

  const state: FilterState = {
    q: sp.q,
    folder: activeFolder,
    colors,
    rarity,
  };

  const cardWhere: Prisma.CardWhereInput = {};
  if (sp.q?.trim()) {
    cardWhere.OR = [
      { name: { contains: sp.q, mode: "insensitive" } },
      { setName: { contains: sp.q, mode: "insensitive" } },
      { setCode: { contains: sp.q, mode: "insensitive" } },
    ];
  }
  if (rarity) cardWhere.rarity = rarity;
  if (colors.length) {
    const includesColorless = colors.includes("C");
    const colored = colors.filter((c) => c !== "C");
    const orClauses: Prisma.CardWhereInput[] = [];
    if (colored.length) orClauses.push({ colors: { hasSome: colored } });
    if (includesColorless) orClauses.push({ colors: { isEmpty: true } });
    if (orClauses.length === 1) {
      Object.assign(cardWhere, orClauses[0]);
    } else {
      cardWhere.AND = [{ OR: orClauses }];
    }
  }

  const whereClause: Prisma.CollectionItemWhereInput = { userId: user.id };
  if (activeFolder) whereClause.collectionId = activeFolder;
  if (Object.keys(cardWhere).length > 0) whereClause.card = cardWhere;

  const [items, { rate, date: fxDate }] = await Promise.all([
    prisma.collectionItem.findMany({
      where: whereClause,
      include: { card: true, collection: { select: { name: true } } },
      orderBy: { card: { name: "asc" } },
    }),
    getLatestFxRate(),
  ]);

  const rows: CollectionRow[] = items.map((it) => {
    const priceUsd = pickPriceForFinish(it.card, it.foil);
    const totalUsd = (priceUsd ?? 0) * it.quantity;
    return {
      itemId: it.id,
      card: {
        name: it.card.name,
        typeLine: it.card.typeLine ?? "",
        colors: it.card.colors,
        cmc: it.card.cmc ?? 0,
        rarity: it.card.rarity,
        setCode: it.card.setCode,
      },
      quantity: it.quantity,
      price: priceUsd,
      totalUsd,
      imageNormal: it.card.imageNormal,
      manaCost: it.card.manaCost ?? "",
      collectorNumber: it.card.collectorNumber,
      foil: it.foil,
      condition: it.condition,
      collectionName: it.collection.name,
    };
  });

  const catalogDate = latestDate(items.map((it) => it.card.updatedAt));
  const provenanceText = formatPriceProvenance("catalog", catalogDate, locale);
  const fxText = currency === "MXN" ? formatFxProvenance(rate, fxDate, locale) : null;

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const totalValue = rows.reduce((s, r) => s + r.totalUsd, 0);

  const ALL_COLORS: ColorLetter[] = ["W", "U", "B", "R", "G", "C"];
  const ALL_RARITIES: Rarity[] = ["common", "uncommon", "rare", "mythic"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Filter bar */}
      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap", gap: 12 }}>
          <form
            method="GET"
            role="search"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <IconSearch size={14} className="icon" />
            <label htmlFor="collection-search" className="sr-only">
              Search collection
            </label>
            {activeFolder && <input type="hidden" name="folder" value={activeFolder} />}
            {colors.length > 0 && (
              <input type="hidden" name="colors" value={colors.join(",")} />
            )}
            {rarity && <input type="hidden" name="rarity" value={rarity} />}
            <input
              id="collection-search"
              name="q"
              type="search"
              defaultValue={sp.q ?? ""}
              placeholder={t("page.collection.search", locale)}
              aria-label={t("page.collection.search", locale)}
              className="grimoire-input"
              style={{ minWidth: "16rem" }}
            />
          </form>

          <div style={{ flex: 1 }} />

          <ExportButtons type="collection" locale={locale} />
          <Link href="/collection/new" className="btn btn-primary btn-sm">
            ＋ {t("action.add", locale)}
          </Link>
        </div>

        {/* Color + rarity row */}
        <div
          className="panel-body"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="eyebrow">Color</span>
            {ALL_COLORS.map((c) => {
              const active = colors.includes(c);
              const dimmed = colors.length > 0 && !active;
              return (
                <Link
                  key={c}
                  href={buildUrl(state, { colors: toggleColor(colors, c) })}
                  aria-pressed={active}
                  aria-label={`Toggle color ${c}`}
                  style={{
                    display: "inline-block",
                    opacity: dimmed ? 0.3 : 1,
                    transform: active ? "scale(1.15)" : "scale(1)",
                    transition: "all 120ms",
                    textDecoration: "none",
                  }}
                >
                  <i className={`ms ms-${c.toLowerCase()} ms-cost ms-shadow`} aria-hidden="true" />
                </Link>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span className="eyebrow">Rarity</span>
            <Link
              href={buildUrl(state, { rarity: null })}
              className={`btn btn-sm ${rarity === null ? "btn-primary" : ""}`}
            >
              All
            </Link>
            {ALL_RARITIES.map((r) => (
              <Link
                key={r}
                href={buildUrl(state, { rarity: rarity === r ? null : r })}
                className={`btn btn-sm ${rarity === r ? "btn-primary" : ""}`}
                style={{ textTransform: "capitalize" }}
              >
                {r[0].toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Folder chips */}
      {collections.length > 1 && (
        <nav
          aria-label="Collection folders"
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}
        >
          <Link
            href={buildUrl(state, { folder: null })}
            className={`chip ${showAll ? "warn" : ""}`}
          >
            {t("page.collection.allFolders", locale)}
          </Link>
          {collections.map((c) => (
            <Link
              key={c.id}
              href={buildUrl(state, { folder: c.id })}
              className={`chip ${activeFolder === c.id ? "warn" : ""}`}
            >
              {c.name}
            </Link>
          ))}
          <Link
            href="/collections"
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 4 }}
          >
            {t("page.collection.manage", locale)}
          </Link>
        </nav>
      )}

      {/* Summary line */}
      <div
        className="mono"
        style={{
          display: "flex",
          gap: 24,
          fontSize: 11,
          color: "var(--ink-3)",
        }}
      >
        <span>
          <span style={{ color: "var(--ink-0)" }}>{items.length}</span> UNIQUE
        </span>
        <span>
          <span style={{ color: "var(--ink-0)" }}>{totalQty.toLocaleString()}</span> TOTAL
        </span>
        <span>
          VALUE:{" "}
          <span style={{ color: "var(--accent)" }}>
            {formatMoney(totalValue, currency, rate)}
          </span>
        </span>
        {rows.length > 0 && (
          <span style={{ color: "var(--ink-3)" }} title={fxText ?? undefined}>
            {provenanceText}
            {fxText ? ` · ${fxText}` : ""}
          </span>
        )}
      </div>

      {/* Content */}
      {rows.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "48px 20px" }}>
          <p style={{ color: "var(--ink-2)", fontSize: 14, marginBottom: 20 }}>
            {t("page.collection.empty", locale)}
          </p>
          {!sp.q && colors.length === 0 && !rarity && (
            <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
              <Link href="/collection/new" className="btn btn-primary">
                {t("page.collection.addFirst", locale)}
              </Link>
              <Link href="/import" className="btn btn-ghost">
                {t("action.import", locale)}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <CollectionListView
          rows={rows}
          currency={currency}
          rate={rate}
          showAll={showAll}
          locale={locale}
          initialPrefs={initialPrefs}
        />
      )}
    </div>
  );
}
