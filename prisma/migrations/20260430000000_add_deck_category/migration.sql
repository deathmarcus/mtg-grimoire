-- Add optional category field to DeckCard for user-defined grouping (Ramp, Draw, Removal, etc.)
ALTER TABLE "DeckCard" ADD COLUMN "category" TEXT;
