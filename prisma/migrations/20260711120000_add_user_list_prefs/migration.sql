-- F5 (#18): per-scope View/Group/Sort preferences.
-- Single JSON column instead of multiplying columns per scope (collection, deck, ...).
-- Legacy User.collectionView (ViewMode enum) is left untouched — see findings.md.
ALTER TABLE "User" ADD COLUMN "listPrefs" JSONB;
