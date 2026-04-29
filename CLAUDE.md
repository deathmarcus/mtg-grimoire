# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Mtgcollection** — a multi-user web app for tracking Magic: The Gathering collections. MVP is personal inventory; Phase 2 adds price tracking (USD native with MXN conversion); long-term vision is a small SaaS for friends.

Production domain: `mtg.marcocastaneda.dev` (VPS, Docker Compose).

## Commands

All Node commands must run under **Node ≥ 22** (see `.nvmrc`). If `nvm` is present: `nvm use`.

- `npm run dev` — start Next.js dev server at `http://localhost:3000`
- `npm run build` — production build (runs `next build` with Turbopack)
- `npm run start` — serve the production build
- `npm run lint` — ESLint via `eslint-config-next`
- `docker compose up -d` — start the local Postgres 16 dev database (port 5432, user/pass/db all `mtg`)
- `docker compose down` — stop dev database (data persists in the `mtg_db_data` volume)
- `npx prisma migrate dev --name <name>` — create + apply a migration in dev
- `npx prisma migrate deploy` — apply pending migrations (used in prod deploy)
- `npx prisma studio` — inspect the DB in a browser UI
- `npx tsx scripts/<script>.ts` — run a one-off TypeScript script (sync jobs, etc.)

Before first run: `cp .env.example .env` and fill in `AUTH_SECRET` (`openssl rand -base64 32`) and, optionally, Google OAuth credentials.

## Architecture

### Stack
Next.js 16 (App Router, TypeScript, Tailwind 4) • Prisma + Postgres 16 • Auth.js v5 (credentials + Google OAuth) • Caddy reverse proxy in prod.

### Data model (see `prisma/schema.prisma` once Phase 2 lands)
- **`Card`** — global, shared catalog. Keyed by the Scryfall UUID. Populated by a nightly sync script from Scryfall bulk data. One row per printing.
- **`CardPrice`** — weekly price snapshots (`priceUsd`, `priceUsdFoil`, `priceUsdEtched`). **Snapshotted only for cards that at least one user owns**, not for the full 100k-row catalog. This keeps price history cheap.
- **`FxRate`** — weekly `usdToMxn` snapshot fetched from a keyless FX API. Display-time MXN conversion uses the `FxRate` of the same snapshot date, so historical values stay internally consistent.
- **`CollectionItem`** — per-user inventory. Unique index on `(userId, cardId, foil, language, condition)` — rows are **aggregated with a `quantity` column**, not one row per physical copy.
- **Auth.js tables** (`User`, `Account`, `Session`, `VerificationToken`) via `@auth/prisma-adapter`.

### Sync jobs (`scripts/`)
Run via cron on the host (not inside the web container hot path). Each script imports the same Prisma client as the app.
- **Daily, 04:00** — `sync-scryfall-catalog.ts`: downloads the Scryfall `default_cards` bulk JSON and upserts `Card`.
- **Weekly, Sunday** — `sync-scryfall-prices.ts` + `sync-fx.ts`: snapshots prices for owned cards only, then fetches USD→MXN. Combined via `sync-weekly.ts`.
- **Live fallback** — during CSV import, if a Scryfall ID is unknown to the local catalog (e.g., fresh set), the importer fetches that single card from the Scryfall API at 10 req/s and upserts it. Imports never fail due to a stale catalog.

### Import flow (Manabox CSV)
Upload → parse → **preview** (summary: new / merged / not-found) → confirm → apply. Two modes: **add** (default, upserts and sums `quantity`) and **replace** (wipes the user's `CollectionItem` rows first, with an extra confirm). No "sync" mode — partial CSVs make diffs dangerous.

Manabox's export already carries the Scryfall UUID per row, so matching is unambiguous (no name/set fuzzy matching).

### Views (MVP)
`/login`, `/signup`, `/dashboard`, `/collection` (grid ↔ table toggle, preference persisted on `User`), `/collection/[itemId]` (detail + price history), `/import`, `/collection/new` (manual add with autocomplete against the local `Card` table).

Card images are served **directly from the Scryfall CDN** (`cards.scryfall.io`) via `next/image` — no local caching, no image download job.

### Design system — "Grimoire" (migrating from "Arcanist's Ledger")
Dark-only, warm sepia-tinted palette (oklch), three-font system: **Crimson Pro** (serif display), **Inter** (UI), **JetBrains Mono** (data/labels). Subtle border-radius (3/6/10px). Aged gold accent (`oklch(0.78 0.14 78)`). Sidebar navigation (220px fixed). Tokens live in `src/app/globals.css` under `:root` with legacy aliases for backward compat, exposed to Tailwind 4 via `@theme inline`. Full design reference in `findings.md` under "Design System — Grimoire (ACTIVO)".

Design prototype source: Claude Design handoff bundle (extracted to `/tmp/mtg-collector/project/` — `styles.css`, `*.jsx`, `data.js`).

### Deployment
Docker Compose with three services: `web` (Next.js), `db` (Postgres 16), `caddy` (reverse proxy + automatic Let's Encrypt TLS for `mtg.marcocastaneda.dev`). Build happens on the VPS via `./deploy.sh`:

```
git pull && docker compose -f docker-compose.prod.yml build web \
  && docker compose -f docker-compose.prod.yml run --rm web npx prisma migrate deploy \
  && docker compose -f docker-compose.prod.yml up -d
```

Backups: `pg_dump` piped from the `db` container via `docker compose exec -T db` into a host directory.

### Cron jobs (production VPS)

Add to the VPS crontab (`crontab -e`). Replace `/home/USER/mtg_collection` with the actual repo path.

```crontab
# MTG Collection — sync jobs
# Catalog sync daily at 04:00 (all cards, ~24s, ~114k rows)
0 4 * * * cd /home/USER/mtg_collection && docker compose -f docker-compose.prod.yml exec -T web npm run sync:catalog >> /var/log/mtg-catalog.log 2>&1

# Weekly prices + FX on Sunday at 05:00 (owned cards only)
0 5 * * 0 cd /home/USER/mtg_collection && docker compose -f docker-compose.prod.yml exec -T web npm run sync:weekly >> /var/log/mtg-weekly.log 2>&1

# Daily DB backup at 03:00 (before catalog sync)
# Creates /var/backups/mtg/ if needed; keeps 30 days
0 3 * * * mkdir -p /var/backups/mtg && docker compose -f /home/USER/mtg_collection/docker-compose.prod.yml exec -T db pg_dump -U mtg mtg | gzip > /var/backups/mtg/mtg_$(date +\%Y\%m\%d).sql.gz && find /var/backups/mtg -name "*.sql.gz" -mtime +30 -delete
```

Notes:
- `exec -T` disables pseudo-TTY allocation (required for non-interactive cron).
- Sync scripts use env vars already present inside the `web` container — no extra config needed.
- Backup pipes through host gzip; no bind mount required in docker-compose.prod.yml.
- Log files rotate manually or via `logrotate`; add entries to `/etc/logrotate.d/mtg` if desired.

## Planning files

This project uses the `planning-with-files` workflow. **Read `task_plan.md`, `findings.md`, and `progress.md` at the start of every session** — they carry phase progress, locked decisions, and external-content findings (Scryfall, Manabox format, the design system) that are load-bearing for almost every task.
