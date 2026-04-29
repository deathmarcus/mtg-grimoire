#!/usr/bin/env bash
set -euo pipefail

# Deploy script for mtg.marcocastaneda.dev
# Run on the VPS from the project directory.

git pull --ff-only
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml run --rm web npx prisma migrate deploy
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
