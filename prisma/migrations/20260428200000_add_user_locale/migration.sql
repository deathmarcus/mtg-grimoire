-- Phase 19: add locale preference to User
ALTER TABLE "User" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'es';
