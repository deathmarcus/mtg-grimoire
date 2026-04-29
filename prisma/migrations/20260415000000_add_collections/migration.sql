-- Phase 8: add Collection model, backfill existing CollectionItems to a default
-- "Mi colección" per user, and replace the unique index to include collectionId.

-- 1. Create Collection table
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "excludeFromTotals" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Collection_userId_idx" ON "Collection"("userId");
CREATE UNIQUE INDEX "Collection_userId_name_key" ON "Collection"("userId", "name");

ALTER TABLE "Collection" ADD CONSTRAINT "Collection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Seed a default "Mi colección" for every existing user
INSERT INTO "Collection" ("id", "userId", "name", "sortOrder", "isDefault", "excludeFromTotals", "createdAt", "updatedAt")
SELECT
    'seed_default_' || "id",
    "id",
    'Mi colección',
    0,
    true,
    false,
    NOW(),
    NOW()
FROM "User";

-- 3. Add collectionId to CollectionItem as nullable so we can backfill
ALTER TABLE "CollectionItem" ADD COLUMN "collectionId" TEXT;

-- 4. Backfill: every existing item goes to its owner's default collection
UPDATE "CollectionItem" ci
SET "collectionId" = c."id"
FROM "Collection" c
WHERE c."userId" = ci."userId" AND c."isDefault" = true;

-- 5. Enforce NOT NULL now that every row has a value
ALTER TABLE "CollectionItem" ALTER COLUMN "collectionId" SET NOT NULL;

-- 6. Replace unique index: add collectionId to the tuple
DROP INDEX "CollectionItem_userId_cardId_foil_language_condition_key";
CREATE UNIQUE INDEX "CollectionItem_userId_collectionId_cardId_foil_language_con_key"
    ON "CollectionItem"("userId", "collectionId", "cardId", "foil", "language", "condition");

CREATE INDEX "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");

-- 7. Add FK CollectionItem -> Collection (Restrict: deletes handled in app code)
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey"
    FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
