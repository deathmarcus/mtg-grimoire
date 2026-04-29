// Quick dev seed: adds a handful of well-known cards to the first user's
// collection so the UI has something to render. Idempotent: re-running it
// just bumps quantities via the unique (userId, cardId, foil, language, condition) key.

import "dotenv/config";
import { PrismaClient, FoilKind, Condition } from "@prisma/client";

const prisma = new PrismaClient();

// (name, setCode, foil, quantity, condition)
const WANT: Array<[string, string, FoilKind, number, Condition]> = [
  ["Sol Ring", "cmr", "NORMAL", 4, "NM"],
  ["Lightning Bolt", "2x2", "NORMAL", 4, "NM"],
  ["Counterspell", "mh2", "NORMAL", 3, "LP"],
  ["Swords to Plowshares", "2x2", "FOIL", 1, "NM"],
  ["Rhystic Study", "cmr", "NORMAL", 1, "NM"],
  ["Thoughtseize", "2x2", "NORMAL", 2, "LP"],
  ["Force of Will", "2x2", "NORMAL", 1, "MP"],
  ["Cultivate", "cmm", "NORMAL", 4, "NM"],
  ["Path to Exile", "2x2", "NORMAL", 2, "NM"],
  ["Black Lotus", "lea", "NORMAL", 1, "HP"],
];

async function main() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("No users. Sign up at /signup first, then re-run.");
  console.log(`→ Seeding collection for ${user.email}`);

  const defaultCollection = await prisma.collection.upsert({
    where: { userId_name: { userId: user.id, name: "Mi colección" } },
    create: { userId: user.id, name: "Mi colección", isDefault: true, sortOrder: 0 },
    update: {},
    select: { id: true },
  });
  const collectionId = defaultCollection.id;

  let added = 0;
  for (const [name, setCode, foil, quantity, condition] of WANT) {
    const card = await prisma.card.findFirst({
      where: { name, setCode },
      orderBy: { collectorNumber: "asc" },
    });
    if (!card) {
      console.warn(`  skip: ${name} [${setCode}] not in Card table`);
      continue;
    }

    await prisma.collectionItem.upsert({
      where: {
        userId_collectionId_cardId_foil_language_condition: {
          userId: user.id,
          collectionId,
          cardId: card.id,
          foil,
          language: "en",
          condition,
        },
      },
      create: {
        userId: user.id,
        collectionId,
        cardId: card.id,
        quantity,
        foil,
        language: "en",
        condition,
      },
      update: { quantity },
    });
    console.log(`  + ${quantity}× ${card.name} [${card.setCode}] ${foil} ${condition}`);
    added++;
  }

  console.log(`✓ Seeded ${added} collection items`);
}

main()
  .catch((err) => {
    console.error("✗ Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
