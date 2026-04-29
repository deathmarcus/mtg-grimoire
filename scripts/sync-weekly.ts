// Entry point for the weekly cron. Runs FX first, then price snapshots.
// Each sub-script re-creates its own PrismaClient; keep them independent so
// a failure in one doesn't prevent the other from running next week.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function run(script: string) {
  const p = resolve(__dirname, script);
  console.log(`\n── ${script} ──`);
  const res = spawnSync("npx", ["tsx", p], { stdio: "inherit" });
  if (res.status !== 0) {
    console.error(`✗ ${script} exited with ${res.status}`);
    return false;
  }
  return true;
}

const ok1 = run("sync-fx.ts");
const ok2 = run("sync-scryfall-prices.ts");
process.exitCode = ok1 && ok2 ? 0 : 1;
