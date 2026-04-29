import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getLatestUsdToMxn } from "@/lib/money";
import {
  parseSearchParams,
  buildSearchWhere,
  applyOwnershipToWhere,
  buildOrderBy,
  PAGE_SIZE,
  type SearchFilters,
} from "@/lib/search-filters";
import { rarityOrder } from "@/lib/collection-filters";
import { SearchFilters as SearchFiltersPanel } from "./SearchFilters";
import { SearchResultCard } from "./SearchResultCard";
import { Pagination } from "./Pagination";
import { t, type Locale } from "@/lib/i18n";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ searchParams }: Props) {
  const user = await requireUser();
  const rawParams = await searchParams;
  const filters = parseSearchParams(rawParams as Record<string, string | undefined>);

  const [dbUser, rate] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { displayCurrency: true, locale: true },
    }),
    getLatestUsdToMxn(),
  ]);
  const currency = dbUser?.displayCurrency ?? "USD";
  const locale = (dbUser?.locale ?? "es") as Locale;

  // Resolve ownership card IDs up front (avoids subquery complexity in Prisma)
  let collectionCardIds: string[] = [];
  let wishlistCardIds: string[] = [];

  if (filters.ownership !== "any") {
    if (
      filters.ownership === "in_collection" ||
      filters.ownership === "not_in_collection"
    ) {
      const items = await prisma.collectionItem.findMany({
        where: { userId: user.id },
        select: { cardId: true },
        distinct: ["cardId"],
      });
      collectionCardIds = items.map((i) => i.cardId);
    } else if (filters.ownership === "on_wishlist") {
      const items = await prisma.wishlistItem.findMany({
        where: { userId: user.id },
        select: { cardId: true },
      });
      wishlistCardIds = items.map((i) => i.cardId);
    }
  }

  // Build where clause
  let where = buildSearchWhere(filters, null);
  where = applyOwnershipToWhere(
    where,
    filters.ownership,
    collectionCardIds,
    wishlistCardIds
  );

  // Count total matching cards for pagination
  const totalCount = await prisma.card.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(filters.page, totalPages);

  const orderBy = buildOrderBy(filters.sort);
  const skip = (safePage - 1) * PAGE_SIZE;

  const cards = await prisma.card.findMany({
    where,
    orderBy,
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      setCode: true,
      setName: true,
      rarity: true,
      manaCost: true,
      imageNormal: true,
      latestUsd: true,
    },
  });

  // Apply in-memory rarity sort (mythic → rare → uncommon → common, then name)
  let sortedCards = cards;
  if (filters.sort === "rarity") {
    sortedCards = [...cards].sort((a, b) => {
      const ra = rarityOrder(a.rarity);
      const rb = rarityOrder(b.rarity);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }

  // Build owned count map for badge display
  // Only fetch if user might own cards in result set
  const cardIds = sortedCards.map((c) => c.id);
  const ownedItems =
    cardIds.length > 0
      ? await prisma.collectionItem.findMany({
          where: {
            userId: user.id,
            cardId: { in: cardIds },
          },
          select: { cardId: true, quantity: true },
        })
      : [];

  const ownedMap = new Map<string, number>();
  for (const item of ownedItems) {
    ownedMap.set(item.cardId, (ownedMap.get(item.cardId) ?? 0) + item.quantity);
  }

  const effectiveFilters: SearchFilters = { ...filters, page: safePage };

  const hasQuery =
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
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1
          className="serif"
          style={{ fontSize: 26, margin: 0, marginBottom: 4 }}
        >
          {t("page.search.title", locale)}
        </h1>
        <p
          className="mono"
          style={{ fontSize: 11, color: "var(--ink-3)", margin: 0 }}
        >
          Search the catalog of{" "}
          <span style={{ color: "var(--ink-1)" }}>
            {totalCount.toLocaleString()}
          </span>{" "}
          {hasQuery ? "matching" : ""} cards
        </p>
      </div>

      <div className="search-shell">
        {/* Sidebar filters */}
        <SearchFiltersPanel filters={effectiveFilters} />

        {/* Results area */}
        <div className="search-results-area">
          {/* Result count + sort indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
              <span style={{ color: "var(--ink-0)" }}>
                {totalCount.toLocaleString()}
              </span>{" "}
              result{totalCount !== 1 ? "s" : ""}
              {totalPages > 1 && (
                <span>
                  {" "}· page{" "}
                  <span style={{ color: "var(--ink-1)" }}>{safePage}</span> of{" "}
                  <span style={{ color: "var(--ink-1)" }}>{totalPages}</span>
                </span>
              )}
            </span>
          </div>

          {sortedCards.length === 0 ? (
            <div
              className="panel"
              style={{ padding: "48px 20px", textAlign: "center" }}
            >
              <p
                style={{
                  color: "var(--ink-2)",
                  fontSize: 14,
                  marginBottom: 8,
                }}
              >
                No cards match your filters.
              </p>
              <p
                className="mono"
                style={{ fontSize: 11, color: "var(--ink-3)" }}
              >
                Try broadening your search or clearing some filters.
              </p>
            </div>
          ) : (
            <>
              <div className="search-results">
                {sortedCards.map((card) => (
                  <SearchResultCard
                    key={card.id}
                    card={card}
                    ownedCount={ownedMap.get(card.id) ?? 0}
                    currency={currency}
                    rate={rate}
                  />
                ))}
              </div>
              <Pagination filters={effectiveFilters} totalPages={totalPages} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
