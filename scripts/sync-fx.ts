// Weekly USD -> MXN FX snapshot.
// Default source: open.er-api.com (keyless, free, no signup).

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type OpenErApiResponse = {
  result: string;
  base_code: string;
  rates: Record<string, number>;
  time_last_update_utc?: string;
};

async function main() {
  const started = Date.now();
  const url = process.env.FX_API_URL || "https://open.er-api.com/v6/latest/USD";
  console.log(`→ Fetching FX from ${url}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`FX fetch failed: ${res.status}`);
  const json = (await res.json()) as OpenErApiResponse;
  if (json.result !== "success") throw new Error("FX API returned non-success");

  const rate = json.rates?.MXN;
  if (typeof rate !== "number") throw new Error("No MXN rate in response");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  await prisma.fxRate.upsert({
    where: { snapshotDate: today },
    create: { snapshotDate: today, usdToMxn: rate.toFixed(6), source: "open.er-api.com" },
    update: { usdToMxn: rate.toFixed(6), source: "open.er-api.com" },
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`✓ USD→MXN = ${rate} (snapshot ${today.toISOString().slice(0, 10)}) in ${elapsed}s`);
}

main()
  .catch((err) => {
    console.error("✗ FX sync failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
