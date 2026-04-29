import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ReplaceButton } from "./ReplaceButton";
import { IconSearch } from "@/components/Icons";

type SearchParams = Promise<{ q?: string }>;

export default async function ReplacePrintingPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { itemId } = await params;
  const { q } = await searchParams;

  const item = await prisma.collectionItem.findUnique({
    where: { id: itemId },
    include: { card: { select: { name: true, setCode: true, collectorNumber: true } } },
  });
  if (!item || item.userId !== user.id) notFound();

  const results =
    q && q.trim().length >= 2
      ? await prisma.card.findMany({
          where: { name: { contains: q.trim(), mode: "insensitive" } },
          orderBy: [{ name: "asc" }, { setCode: "asc" }],
          take: 20,
          select: {
            id: true,
            name: true,
            setCode: true,
            setName: true,
            collectorNumber: true,
            imageSmall: true,
          },
        })
      : [];

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
          Replace printing
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 6 }}>
          Currently: <strong>{item.card.name}</strong> ({item.card.setCode.toUpperCase()} #{item.card.collectorNumber}).
          Search for the correct card below.
        </p>
      </div>

      <form method="GET" className="panel" style={{ overflow: "hidden" }}>
        <div className="panel-head" style={{ gap: 8 }}>
          <IconSearch size={14} className="icon" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search the Scryfall catalog…"
            className="grimoire-input"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-sm">
            Search
          </button>
        </div>
      </form>

      {results.length > 0 && (
        <div className="panel" style={{ overflow: "hidden", padding: 0 }}>
          {results.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 18px",
                borderBottom: "1px solid var(--line-soft)",
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
                  {c.name}
                </div>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
                  {c.setName} · {c.setCode.toUpperCase()} #{c.collectorNumber}
                </div>
              </div>
              <ReplaceButton
                itemId={itemId}
                newCardId={c.id}
                cardName={c.name}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
