import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getLatestUsdToMxn } from "@/lib/money";
import { toNumber } from "@/lib/money-format";
import { CollectionList } from "./CollectionList";
import { CreateCollectionForm } from "./CreateCollectionForm";

export default async function CollectionsPage() {
  const user = await requireUser();

  const [dbUser, collections, items] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { displayCurrency: true },
    }),
    prisma.collection.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        sortOrder: true,
        isDefault: true,
        excludeFromTotals: true,
        _count: { select: { items: true } },
      },
    }),
    // All items sorted by price desc — first per collectionId = cover art
    prisma.collectionItem.findMany({
      where: { userId: user.id },
      orderBy: { card: { latestUsd: "desc" } },
      select: {
        collectionId: true,
        quantity: true,
        card: { select: { imageNormal: true, latestUsd: true } },
      },
    }),
  ]);

  const currency = dbUser?.displayCurrency ?? "USD";
  const fxRate = await getLatestUsdToMxn();

  // Build cover image and total value per collection
  const coverMap = new Map<string, string | null>();
  const valueMap = new Map<string, number>();

  for (const item of items) {
    if (!coverMap.has(item.collectionId)) {
      coverMap.set(item.collectionId, item.card.imageNormal ?? null);
    }
    const price = toNumber(item.card.latestUsd) ?? 0;
    valueMap.set(
      item.collectionId,
      (valueMap.get(item.collectionId) ?? 0) + price * item.quantity,
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Organize your grimoire
        </div>
        <h1
          style={{
            fontFamily: "var(--font-crimson-pro), Georgia, serif",
            fontSize: 24,
            fontWeight: 500,
          }}
        >
          Folders
        </h1>
      </div>

      <CreateCollectionForm />

      <CollectionList
        collections={collections.map((c) => ({
          id: c.id,
          name: c.name,
          isDefault: c.isDefault,
          excludeFromTotals: c.excludeFromTotals,
          itemCount: c._count.items,
          coverImageUrl: coverMap.get(c.id) ?? null,
          totalValue: valueMap.get(c.id) ?? 0,
        }))}
        currency={currency}
        fxRate={fxRate}
      />
    </div>
  );
}
