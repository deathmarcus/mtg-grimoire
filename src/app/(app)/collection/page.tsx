import Link from "next/link";
import Image from "next/image";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatMoney, getLatestUsdToMxn } from "@/lib/money";
import { pickPriceForFinish } from "@/lib/pricing";
import {
  parseColorsParam,
  parseRarityParam,
  parseSortParam,
  rarityOrder,
  toggleColor,
  type ColorLetter,
  type Rarity,
  type SortKey,
} from "@/lib/collection-filters";
import { ViewToggle } from "./ViewToggle";
import { IconSearch } from "@/components/Icons";
import { RarityDot } from "@/components/RarityDot";
import { ManaCost } from "@/components/ManaCost";
import { t, type Locale } from "@/lib/i18n";

type SearchParams = Promise<{
  q?: string;
  folder?: string;
  colors?: string;
  rarity?: string;
  sort?: string;
}>;

type FilterState = {
  q?: string;
  folder?: string | null;
  colors: ColorLetter[];
  rarity: Rarity | null;
  sort: SortKey;
};

function buildUrl(state: FilterState, overrides: Partial<FilterState>): string {
  const merged = { ...state, ...overrides };
  const p = new URLSearchParams();
  if (merged.q) p.set("q", merged.q);
  if (merged.folder) p.set("folder", merged.folder);
  if (merged.colors.length) p.set("colors", merged.colors.join(","));
  if (merged.rarity) p.set("rarity", merged.rarity);
  if (merged.sort !== "name") p.set("sort", merged.sort);
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
  const sort = parseSortParam(sp.sort);

  const [dbUser, collections] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { collectionView: true, displayCurrency: true, locale: true },
    }),
    prisma.collection.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  const viewMode = dbUser?.collectionView ?? "GRID";
  const currency = dbUser?.displayCurrency ?? "USD";
  const locale = (dbUser?.locale ?? "es") as Locale;

  const activeFolder = sp.folder && collections.some((c) => c.id === sp.folder)
    ? sp.folder
    : null;
  const showAll = !activeFolder;

  const state: FilterState = {
    q: sp.q,
    folder: activeFolder,
    colors,
    rarity,
    sort,
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

  const orderBy: Prisma.CollectionItemOrderByWithRelationInput =
    sort === "price"
      ? { card: { latestUsd: { sort: "desc", nulls: "last" } } }
      : { card: { name: "asc" } };

  const [items, rate] = await Promise.all([
    prisma.collectionItem.findMany({
      where: whereClause,
      include: { card: true, collection: { select: { name: true } } },
      orderBy,
    }),
    getLatestUsdToMxn(),
  ]);

  let rows = items.map((it) => {
    const priceUsd = pickPriceForFinish(it.card, it.foil);
    const totalUsd = (priceUsd ?? 0) * it.quantity;
    return { it, priceUsd, totalUsd };
  });

  if (sort === "rarity") {
    rows = [...rows].sort((a, b) => {
      const ra = rarityOrder(a.it.card.rarity);
      const rb = rarityOrder(b.it.card.rarity);
      if (ra !== rb) return ra - rb;
      return a.it.card.name.localeCompare(b.it.card.name);
    });
  }

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const totalValue = rows.reduce((s, r) => s + r.totalUsd, 0);

  const ALL_COLORS: ColorLetter[] = ["W", "U", "B", "R", "G", "C"];
  const ALL_RARITIES: Rarity[] = ["common", "uncommon", "rare", "mythic"];
  const SORTS: { key: SortKey; label: string }[] = [
    { key: "price", label: "Value ↓" },
    { key: "name", label: "Name A–Z" },
    { key: "rarity", label: "Rarity" },
  ];

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
            {sort !== "name" && <input type="hidden" name="sort" value={sort} />}
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

          <ViewToggle current={viewMode} />
        </div>

        {/* Color + rarity + sort row */}
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
                  <span className={`mana-pip ${c.toLowerCase()}`}>{c}</span>
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

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span className="eyebrow">Sort</span>
            {SORTS.map((s) => (
              <Link
                key={s.key}
                href={buildUrl(state, { sort: s.key })}
                className={`btn btn-sm ${sort === s.key ? "btn-primary" : ""}`}
              >
                {s.label}
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
      </div>

      {/* Content */}
      {rows.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "48px 20px" }}>
          <p style={{ color: "var(--ink-2)", fontSize: 14, marginBottom: 20 }}>
            {sp.q || colors.length > 0 || rarity ? t("page.collection.empty", locale) : t("page.collection.empty", locale)}
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
      ) : viewMode === "GRID" ? (
        <GridView rows={rows} currency={currency} rate={rate} showAll={showAll} />
      ) : (
        <TableView rows={rows} currency={currency} rate={rate} showAll={showAll} />
      )}
    </div>
  );
}

type Row = {
  it: Awaited<ReturnType<typeof prisma.collectionItem.findMany>>[number] & {
    card: NonNullable<Awaited<ReturnType<typeof prisma.card.findUnique>>>;
    collection: { name: string };
  };
  priceUsd: number | null;
  totalUsd: number;
};

function GridView({
  rows,
  currency,
  rate,
  showAll,
}: {
  rows: Row[];
  currency: "USD" | "MXN";
  rate: number;
  showAll: boolean;
}) {
  return (
    <div className="coll-grid">
      {rows.map(({ it, totalUsd }) => (
        <Link
          key={it.id}
          href={`/collection/${it.id}`}
          className="coll-card"
        >
          <div className="card-art">
            {it.card.imageNormal ? (
              <Image
                src={it.card.imageNormal}
                alt={it.card.name}
                width={244}
                height={340}
                unoptimized
              />
            ) : (
              <div
                aria-hidden="true"
                style={{ width: "100%", height: "100%", background: "var(--bg-2)" }}
              />
            )}
          </div>
          {it.quantity > 1 && (
            <div className="coll-card-qty">×{it.quantity}</div>
          )}
          {it.foil !== "NORMAL" && (
            <div className="coll-card-foil">{it.foil}</div>
          )}
          <div className="coll-card-meta">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              <RarityDot rarity={it.card.rarity} />
              <span
                className="mono"
                style={{ fontSize: 10, color: "var(--ink-3)" }}
              >
                {it.card.setCode.toUpperCase()} · {it.card.collectorNumber}
              </span>
            </div>
            <div className="coll-card-name">{it.card.name}</div>
            <div className="coll-card-price">
              {formatMoney(totalUsd, currency, rate)}
            </div>
            {showAll && (
              <div
                className="mono"
                style={{ fontSize: 9, color: "var(--ink-3)", marginTop: 2 }}
              >
                {it.collection.name}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

function TableView({
  rows,
  currency,
  rate,
  showAll,
}: {
  rows: Row[];
  currency: "USD" | "MXN";
  rate: number;
  showAll: boolean;
}) {
  return (
    <>
      {/* Desktop table */}
      <div className="panel hidden md:block" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <caption className="sr-only">Collection items</caption>
          <thead>
            <tr>
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
            {rows.map(({ it, priceUsd, totalUsd }) => (
              <tr key={it.id} style={{ cursor: "pointer" }}>
                <td style={{ width: 24 }}>
                  <RarityDot rarity={it.card.rarity} />
                </td>
                <td>
                  <Link
                    href={`/collection/${it.id}`}
                    style={{
                      fontFamily: "var(--font-crimson-pro), Georgia, serif",
                      fontSize: 14,
                      color: "var(--ink-0)",
                      textDecoration: "none",
                    }}
                  >
                    {it.card.name}
                  </Link>
                </td>
                <td>
                  <ManaCost cost={it.card.manaCost} />
                </td>
                <td>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>
                    {it.card.setCode.toUpperCase()}
                  </span>
                </td>
                {showAll && (
                  <td>
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      {it.collection.name}
                    </span>
                  </td>
                )}
                <td className="num">{it.quantity}</td>
                <td>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    {it.foil === "NORMAL" ? "—" : it.foil}
                  </span>
                </td>
                <td>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    {it.condition}
                  </span>
                </td>
                <td className="num">
                  {formatMoney(priceUsd ?? null, currency, rate)}
                </td>
                <td className="num" style={{ color: "var(--accent)" }}>
                  {formatMoney(totalUsd, currency, rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="panel md:hidden" style={{ padding: 0 }}>
        {rows.map(({ it, priceUsd, totalUsd }) => (
          <Link
            key={it.id}
            href={`/collection/${it.id}`}
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
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 2,
                }}
              >
                <RarityDot rarity={it.card.rarity} />
                <span
                  style={{
                    fontFamily: "var(--font-crimson-pro), Georgia, serif",
                    fontSize: 14,
                    color: "var(--ink-0)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {it.card.name}
                </span>
              </div>
              <div
                className="mono"
                style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}
              >
                {it.card.setCode.toUpperCase()} · {it.quantity}× ·{" "}
                {it.foil === "NORMAL" ? it.condition : `${it.foil} ${it.condition}`}
                {showAll && ` · ${it.collection.name}`}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div
                className="mono"
                style={{ fontSize: 12, color: "var(--accent)" }}
              >
                {formatMoney(totalUsd, currency, rate)}
              </div>
              <div
                className="mono"
                style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}
              >
                {formatMoney(priceUsd ?? null, currency, rate)}/u
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
