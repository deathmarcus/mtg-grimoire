import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ReplaceButton } from "./ReplaceButton";

export default async function ReplacePrintingPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const user = await requireUser();
  const { itemId } = await params;

  const item = await prisma.collectionItem.findUnique({
    where: { id: itemId },
    include: { card: { select: { id: true, name: true, setCode: true, collectorNumber: true } } },
  });
  if (!item || item.userId !== user.id) notFound();

  const printings = await prisma.card.findMany({
    where: { name: item.card.name },
    orderBy: [{ setName: "asc" }, { collectorNumber: "asc" }],
    select: {
      id: true,
      name: true,
      setCode: true,
      setName: true,
      collectorNumber: true,
      imageSmall: true,
      latestUsd: true,
    },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
      <div>
        <Link
          href={`/collection/${itemId}`}
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 12 }}
        >
          ← Back to detail
        </Link>
        <h1
          style={{
            fontFamily: "var(--font-crimson-pro), Georgia, serif",
            fontSize: 24,
            fontWeight: 500,
          }}
        >
          Change printing
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 6 }}>
          Currently: <strong>{item.card.name}</strong> ({item.card.setCode.toUpperCase()} #{item.card.collectorNumber}).
          Select a different edition below.
        </p>
      </div>

      <div className="panel" style={{ overflow: "hidden", padding: 0 }}>
        {printings.map((c) => {
          const isCurrent = c.id === item.card.id;
          return (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 18px",
                borderBottom: "1px solid var(--line-soft)",
                background: isCurrent ? "oklch(0.78 0.14 78 / 0.06)" : undefined,
                opacity: isCurrent ? 0.6 : 1,
              }}
            >
              {c.imageSmall && (
                <Image
                  src={c.imageSmall}
                  alt={c.name}
                  width={48}
                  height={67}
                  style={{ width: 48, height: "auto", borderRadius: 2 }}
                  unoptimized
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-crimson-pro), Georgia, serif",
                    fontSize: 14,
                    color: "var(--ink-0)",
                  }}
                >
                  {c.setName}
                </div>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
                  {c.setCode.toUpperCase()} #{c.collectorNumber}
                  {c.latestUsd != null && ` · $${Number(c.latestUsd).toFixed(2)}`}
                </div>
              </div>
              {isCurrent ? (
                <span className="mono" style={{ fontSize: 10, color: "var(--accent)" }}>
                  CURRENT
                </span>
              ) : (
                <ReplaceButton itemId={itemId} newCardId={c.id} cardName={c.setName} />
              )}
            </div>
          );
        })}
        {printings.length === 0 && (
          <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
            No other printings found in the catalog.
          </div>
        )}
      </div>
    </div>
  );
}
