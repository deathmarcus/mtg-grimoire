import { prisma } from "@/lib/prisma";

export { formatMoney, toNumber } from "@/lib/money-format";

export async function getLatestUsdToMxn(): Promise<number> {
  const latest = await prisma.fxRate.findFirst({
    orderBy: { snapshotDate: "desc" },
  });
  return latest ? Number(latest.usdToMxn) : 0;
}
