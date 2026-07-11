import { prisma } from "@/lib/prisma";

export { formatMoney, toNumber } from "@/lib/money-format";

export async function getLatestUsdToMxn(): Promise<number> {
  const latest = await prisma.fxRate.findFirst({
    orderBy: { snapshotDate: "desc" },
  });
  return latest ? Number(latest.usdToMxn) : 0;
}

/** Same lookup as getLatestUsdToMxn, but also returns the snapshot date so
 * callers can disclose FX freshness next to MXN-converted prices. */
export async function getLatestFxRate(): Promise<{ rate: number; date: Date | null }> {
  const latest = await prisma.fxRate.findFirst({
    orderBy: { snapshotDate: "desc" },
  });
  return { rate: latest ? Number(latest.usdToMxn) : 0, date: latest?.snapshotDate ?? null };
}
