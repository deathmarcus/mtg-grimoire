-- F7 (#20): Set completion — add fields needed to classify printings by set
-- type and release date, and to distinguish promos/variations from the
-- "counts toward completion" set of printings.
ALTER TABLE "Card" ADD COLUMN "releasedAt" DATE;
ALTER TABLE "Card" ADD COLUMN "setType" TEXT;
ALTER TABLE "Card" ADD COLUMN "promo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Card" ADD COLUMN "variation" BOOLEAN NOT NULL DEFAULT false;

-- Partial index tuned for the /sets aggregation and /sets/[setCode] queries:
-- both filter by setCode + the "counts for completion" predicate
-- (promo = false AND variation = false AND lang = 'en'). A partial index
-- keyed on setCode only over the qualifying rows keeps the aggregation scan
-- small without indexing the full ~114k-row catalog.
CREATE INDEX IF NOT EXISTS "Card_setCode_completion_idx"
  ON "Card" ("setCode")
  WHERE "promo" = false AND "variation" = false AND "lang" = 'en';
