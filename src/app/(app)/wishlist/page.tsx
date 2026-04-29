import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatMoney, getLatestUsdToMxn } from "@/lib/money";
import { pickPriceForFinish } from "@/lib/pricing";
import { computeGap } from "@/lib/wishlist-helpers";
import { toNumber } from "@/lib/money-format";
import { IconPlus, IconSearch } from "@/components/Icons";
import { WishlistCard } from "./WishlistCard";
import { WishlistViewToggle } from "./WishlistViewToggle";
import { t, type Locale } from "@/lib/i18n";

type SearchParams = Promise<{ q?: string; tag?: string; view?: string }>;

export default async function WishlistPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { q, tag, view: viewRaw } = await searchParams;
  const view: "grid" | "table" = viewRaw === "table" ? "table" : "grid";

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { displayCurrency: true, locale: true },
  });
  const currency = dbUser?.displayCurrency ?? "USD";
  const locale = (dbUser?.locale ?? "es") as Locale;

  const where: Prisma.WishlistItemWhereInput = {
    userId: user.id,
  };
  if (tag) where.tag = tag;
  if (q?.trim()) {
    where.card = {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { setName: { contains: q, mode: "insensitive" } },
        { setCode: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const [items, rate, tags] = await Promise.all([
    prisma.wishlistItem.findMany({
      where,
      include: { card: true },
      orderBy: [{ priority: "desc" }, { card: { name: "asc" } }],
    }),
    getLatestUsdToMxn(),
    prisma.wishlistItem.findMany({
      where: { userId: user.id, tag: { not: null } },
      select: { tag: true },
      distinct: ["tag"],
      orderBy: { tag: "asc" },
    }),
  ]);

  const uniqueTags = tags.map((t) => t.tag!).filter(Boolean);

  const buildHref = (overrides: { tag?: string | null; view?: "grid" | "table" }) => {
    const p = new URLSearchParams();
    const nextTag = overrides.tag !== undefined ? overrides.tag : tag;
    const nextView = overrides.view !== undefined ? overrides.view : view;
    if (nextTag) p.set("tag", nextTag);
    if (q) p.set("q", q);
    if (nextView !== "grid") p.set("view", nextView);
    const s = p.toString();
    return s ? `/wishlist?${s}` : "/wishlist";
  };

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
            <label htmlFor="wishlist-search" className="sr-only">
              Search wishlist
            </label>
            {tag && <input type="hidden" name="tag" value={tag} />}
            {view !== "grid" && <input type="hidden" name="view" value={view} />}
            <input
              id="wishlist-search"
              name="q"
              type="search"
              defaultValue={q ?? ""}
              placeholder="Search by name or set…"
              className="grimoire-input"
              style={{ minWidth: "16rem" }}
            />
          </form>
          <div style={{ flex: 1 }} />
          <WishlistViewToggle
            current={view}
            buildHref={(v) => buildHref({ view: v })}
          />
          <Link href="/wishlist/add" className="btn btn-primary btn-sm">
            <IconPlus size={12} /> Add
          </Link>
          <Link href="/wishlist/import" className="btn btn-ghost btn-sm">
            Import deck
          </Link>
        </div>
      </div>

      {/* Tag chips */}
      {uniqueTags.length > 0 && (
        <nav
          aria-label="Wishlist tags"
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}
        >
          <Link
            href={buildHref({ tag: null })}
            className={`chip ${!tag ? "warn" : ""}`}
          >
            All
          </Link>
          {uniqueTags.map((t) => (
            <Link
              key={t}
              href={buildHref({ tag: t })}
              className={`chip ${tag === t ? "warn" : ""}`}
            >
              {t}
            </Link>
          ))}
        </nav>
      )}

      {/* Summary */}
      <div
        className="mono"
        style={{ fontSize: 11, color: "var(--ink-3)" }}
      >
        <span style={{ color: "var(--ink-0)" }}>{items.length}</span> items
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "48px 20px" }}>
          <p style={{ color: "var(--ink-2)", fontSize: 14, marginBottom: 20 }}>
            {q ? t("page.collection.empty", locale) : t("page.wishlist.empty", locale)}
          </p>
          {!q && (
            <Link href="/wishlist/add" className="btn btn-primary">
              {t("page.wishlist.addFirst", locale)}
            </Link>
          )}
        </div>
      ) : view === "grid" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 14,
          }}
        >
          {items.map((item) => {
            const currentUsd = pickPriceForFinish(item.card, "NORMAL");
            const maxUsd = toNumber(item.maxPriceUsd);
            return (
              <WishlistCard
                key={item.id}
                id={item.id}
                name={item.card.name}
                setCode={item.card.setCode}
                rarity={item.card.rarity}
                imageSmall={item.card.imageSmall}
                priority={item.priority}
                quantityWanted={item.quantityWanted}
                currentUsd={currentUsd}
                maxPriceUsd={maxUsd}
                tag={item.tag}
                notes={item.notes}
                currency={currency}
                rate={rate}
              />
            );
          })}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="panel hidden md:block" style={{ overflow: "hidden" }}>
            <table className="tbl">
              <caption className="sr-only">Wishlist items</caption>
              <thead>
                <tr>
                  <th>Card</th>
                  <th>Set</th>
                  <th>Priority</th>
                  <th className="num">Wanted</th>
                  <th className="num">Current</th>
                  <th className="num">Max</th>
                  <th className="num">Gap</th>
                  <th>Tag</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const currentUsd = pickPriceForFinish(item.card, "NORMAL");
                  const maxUsd = toNumber(item.maxPriceUsd);
                  const gap = computeGap(currentUsd, maxUsd);
                  return (
                    <tr key={item.id} style={{ cursor: "pointer" }}>
                      <td>
                        <Link
                          href={`/wishlist/${item.id}`}
                          style={{
                            fontFamily: "var(--font-crimson-pro), Georgia, serif",
                            fontSize: 14,
                            color: "var(--ink-0)",
                            textDecoration: "none",
                          }}
                        >
                          {item.card.name}
                        </Link>
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>
                          {item.card.setCode.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <PriorityBadge priority={item.priority} />
                      </td>
                      <td className="num">{item.quantityWanted}</td>
                      <td className="num">
                        {formatMoney(currentUsd, currency, rate)}
                      </td>
                      <td className="num">
                        {maxUsd != null ? formatMoney(maxUsd, currency, rate) : "—"}
                      </td>
                      <td className="num">
                        <GapDisplay gap={gap} currency={currency} rate={rate} />
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                          {item.tag ?? "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="panel md:hidden" style={{ padding: 0 }}>
            {items.map((item) => {
              const currentUsd = pickPriceForFinish(item.card, "NORMAL");
              const maxUsd = toNumber(item.maxPriceUsd);
              const gap = computeGap(currentUsd, maxUsd);
              return (
                <Link
                  key={item.id}
                  href={`/wishlist/${item.id}`}
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
                        fontFamily: "var(--font-crimson-pro), Georgia, serif",
                        fontSize: 14,
                        color: "var(--ink-0)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.card.name}
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}
                    >
                      {item.card.setCode.toUpperCase()} · {item.quantityWanted}× ·{" "}
                      <PriorityBadge priority={item.priority} />
                      {item.tag && <span style={{ marginLeft: 4 }}>· {item.tag}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>
                      {formatMoney(currentUsd, currency, rate)}
                    </div>
                    <GapDisplay gap={gap} currency={currency} rate={rate} />
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const chipClass =
    priority === "HIGH" ? "neg" : priority === "MEDIUM" ? "warn" : "";
  return <span className={`chip ${chipClass}`}>{priority}</span>;
}

function GapDisplay({
  gap,
  currency,
  rate,
}: {
  gap: number | null;
  currency: "USD" | "MXN";
  rate: number;
}) {
  if (gap == null) {
    return (
      <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
        —
      </span>
    );
  }
  const isGood = gap <= 0;
  return (
    <span className={`chip ${isGood ? "pos" : "neg"}`} style={{ fontSize: 10 }}>
      {isGood ? "▼" : "▲"} {formatMoney(Math.abs(gap), currency, rate)}
    </span>
  );
}
