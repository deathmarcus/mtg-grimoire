// Weekly price snapshot.
// Writes one CardPrice row per owned card (any user), using the latestUsd*
// fields maintained by the daily catalog sync. We don't re-hit Scryfall here.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const started = Date.now();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // All distinct cardIds that at least one user owns or has on their wishlist.
  const owned = await prisma.collectionItem.findMany({
    select: { cardId: true },
    distinct: ["cardId"],
  });
  const wished = await prisma.wishlistItem.findMany({
    select: { cardId: true },
    distinct: ["cardId"],
  });
  const allCardIds = [...new Set([
    ...owned.map((o) => o.cardId),
    ...wished.map((w) => w.cardId),
  ])];
  console.log(`→ ${owned.length} owned + ${wished.length} wished = ${allCardIds.length} distinct cards`);

  if (allCardIds.length === 0) {
    console.log("✓ Nothing to snapshot (empty collections & wishlist).");
    return;
  }

  // Pull latestUsd* from Card for those ids in one query.
  const cards = await prisma.card.findMany({
    where: { id: { in: allCardIds } },
    select: {
      id: true,
      latestUsd: true,
      latestUsdFoil: true,
      latestUsdEtched: true,
    },
  });

  // Upsert one snapshot per (cardId, today). Unique constraint on (cardId, snapshotDate).
  let written = 0;
  for (const c of cards) {
    await prisma.cardPrice.upsert({
      where: { cardId_snapshotDate: { cardId: c.id, snapshotDate: today } },
      create: {
        cardId: c.id,
        snapshotDate: today,
        priceUsd: c.latestUsd,
        priceUsdFoil: c.latestUsdFoil,
        priceUsdEtched: c.latestUsdEtched,
      },
      update: {
        priceUsd: c.latestUsd,
        priceUsdFoil: c.latestUsdFoil,
        priceUsdEtched: c.latestUsdEtched,
      },
    });
    written++;
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`✓ Snapshotted ${written} prices in ${elapsed}s`);
}

main()
  .catch((err) => {
    console.error("✗ Price snapshot failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
