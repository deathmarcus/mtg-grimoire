-- Enable trigram search support and add a GIN trigram index on Card.name.
-- Speeds up ILIKE '%term%' substring matches used by the /api/autocomplete
-- endpoint (F3, #16). Without this index, ILIKE substring queries fall back
-- to a full index-only scan of Card_name_idx over the whole catalog (~114k
-- rows), which measured ~25ms in dev — acceptable today but degrades
-- linearly with catalog growth. The trgm index keeps it sublinear.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Card_name_trgm_idx" ON "Card" USING gin (name gin_trgm_ops);
