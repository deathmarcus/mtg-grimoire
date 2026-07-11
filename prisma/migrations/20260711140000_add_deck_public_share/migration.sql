-- Public deck sharing (F8 / #21): view-only /d/<slug> pages.
ALTER TABLE "Deck" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Deck" ADD COLUMN "slug" TEXT;
ALTER TABLE "Deck" ADD COLUMN "publicSince" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Deck_slug_key" ON "Deck"("slug");
