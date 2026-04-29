// Daily Scryfall catalog sync.
// Downloads the `default_cards` bulk JSON and upserts every row into `Card`.
// Keeps latestUsd* fresh so the weekly price snapshot can just copy them.

import "dotenv/config";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { PrismaClient, Prisma } from "@prisma/client";
import chain from "stream-chain";
import { parser } from "stream-json";
import streamArray from "stream-json/streamers/stream-array";
import {
  SCRYFALL_API,
  fetchJson,
  headers,
  toCardRow,
  type CardRow,
  type ScryfallBulkDataList,
  type ScryfallCard,
} from "./lib/scryfall";

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

async function main() {
  const started = Date.now();
  console.log("→ Fetching bulk-data index…");
  const index = await fetchJson<ScryfallBulkDataList>(`${SCRYFALL_API}/bulk-data`);
  const entry = index.data.find((e) => e.type === "default_cards");
  if (!entry) throw new Error("default_cards bulk not found");
  console.log(`→ ${entry.name} · ${(entry.size / 1024 / 1024).toFixed(1)} MB · ${entry.updated_at}`);

  const res = await fetch(entry.download_uri, { headers: headers() });
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);
  console.log("→ Streaming + parsing JSON…");

  // The bulk JSON is a top-level array. Pipe the response body through a
  // streaming parser so we never hold the whole string in memory (it's >512 MB
  // and exceeds Node's max string size).
  const nodeStream = Readable.fromWeb(res.body as never);

  let buffer: CardRow[] = [];
  let processed = 0;

  const flush = async () => {
    if (buffer.length === 0) return;
    await upsertBatch(buffer);
    processed += buffer.length;
    if (processed % 5000 < BATCH_SIZE) {
      console.log(`  ${processed.toLocaleString()} cards`);
    }
    buffer = [];
  };

  const stream = chain([nodeStream, parser(), streamArray()]);

  await pipeline(stream, async function* (source) {
    for await (const item of source as AsyncIterable<{ value: ScryfallCard }>) {
      buffer.push(toCardRow(item.value));
      if (buffer.length >= BATCH_SIZE) {
        await flush();
      }
      yield;
    }
  });
  await flush();

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`✓ Catalog sync complete · ${processed.toLocaleString()} cards in ${elapsed}s`);
}

async function upsertBatch(rows: CardRow[]) {
  // Batch upsert via raw SQL INSERT ... ON CONFLICT DO UPDATE.
  // Much faster than N Prisma upserts for 100k+ rows.
  if (rows.length === 0) return;

  const values = rows.map(
    (r) => Prisma.sql`(
      ${r.id}, ${r.oracleId}, ${r.name}, ${r.setCode}, ${r.setName},
      ${r.collectorNumber}, ${r.rarity}, ${r.lang},
      ${r.manaCost}, ${r.cmc}, ${r.typeLine}, ${r.oracleText},
      ${r.colors}::text[], ${r.colorIdentity}::text[],
      ${r.imageSmall}, ${r.imageNormal}, ${r.imageLarge},
      ${r.foilAvailable}, ${r.nonfoilAvailable}, ${r.etchedAvailable},
      ${r.latestUsd}::numeric, ${r.latestUsdFoil}::numeric, ${r.latestUsdEtched}::numeric,
      ${r.legalities ? JSON.stringify(r.legalities) : null}::jsonb,
      ${r.scryfallUpdatedAt}, NOW(), NOW()
    )`,
  );

  await prisma.$executeRaw`
    INSERT INTO "Card" (
      "id", "oracleId", "name", "setCode", "setName",
      "collectorNumber", "rarity", "lang",
      "manaCost", "cmc", "typeLine", "oracleText",
      "colors", "colorIdentity",
      "imageSmall", "imageNormal", "imageLarge",
      "foilAvailable", "nonfoilAvailable", "etchedAvailable",
      "latestUsd", "latestUsdFoil", "latestUsdEtched",
      "legalities",
      "scryfallUpdatedAt", "createdAt", "updatedAt"
    )
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("id") DO UPDATE SET
      "oracleId"        = EXCLUDED."oracleId",
      "name"            = EXCLUDED."name",
      "setCode"         = EXCLUDED."setCode",
      "setName"         = EXCLUDED."setName",
      "collectorNumber" = EXCLUDED."collectorNumber",
      "rarity"          = EXCLUDED."rarity",
      "lang"            = EXCLUDED."lang",
      "manaCost"        = EXCLUDED."manaCost",
      "cmc"             = EXCLUDED."cmc",
      "typeLine"        = EXCLUDED."typeLine",
      "oracleText"      = EXCLUDED."oracleText",
      "colors"          = EXCLUDED."colors",
      "colorIdentity"   = EXCLUDED."colorIdentity",
      "imageSmall"      = EXCLUDED."imageSmall",
      "imageNormal"     = EXCLUDED."imageNormal",
      "imageLarge"      = EXCLUDED."imageLarge",
      "foilAvailable"   = EXCLUDED."foilAvailable",
      "nonfoilAvailable" = EXCLUDED."nonfoilAvailable",
      "etchedAvailable" = EXCLUDED."etchedAvailable",
      "latestUsd"       = EXCLUDED."latestUsd",
      "latestUsdFoil"   = EXCLUDED."latestUsdFoil",
      "latestUsdEtched" = EXCLUDED."latestUsdEtched",
      "legalities"      = EXCLUDED."legalities",
      "scryfallUpdatedAt" = EXCLUDED."scryfallUpdatedAt",
      "updatedAt"       = NOW()
  `;
}

main()
  .catch((err) => {
    console.error("✗ Catalog sync failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
