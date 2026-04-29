import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { EditForm } from "./EditForm";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const user = await requireUser();
  const { itemId } = await params;

  const [item, collections] = await Promise.all([
    prisma.collectionItem.findUnique({
      where: { id: itemId },
      include: { card: { select: { name: true, setCode: true, collectorNumber: true, foilAvailable: true, nonfoilAvailable: true, etchedAvailable: true } } },
    }),
    prisma.collection.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  if (!item || item.userId !== user.id) notFound();

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
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          {item.card.setCode.toUpperCase()} #{item.card.collectorNumber}
        </div>
        <h1
          style={{
            fontFamily: "var(--font-crimson-pro), Georgia, serif",
            fontSize: 24,
            fontWeight: 500,
          }}
        >
          Edit — {item.card.name}
        </h1>
      </div>

      <EditForm
        itemId={itemId}
        current={{
          quantity: item.quantity,
          foil: item.foil,
          language: item.language,
          condition: item.condition,
          collectionId: item.collectionId,
          acquiredPrice: item.acquiredPrice?.toString() ?? "",
          notes: item.notes ?? "",
        }}
        card={{
          foilAvailable: item.card.foilAvailable,
          etchedAvailable: item.card.etchedAvailable,
        }}
        collections={collections}
      />
    </div>
  );
}
