import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { CollectionList } from "./CollectionList";
import { CreateCollectionForm } from "./CreateCollectionForm";

export default async function CollectionsPage() {
  const user = await requireUser();
  const collections = await prisma.collection.findMany({
    where: { userId: user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      isDefault: true,
      excludeFromTotals: true,
      _count: { select: { items: true } },
    },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Organize your grimoire</div>
        <h1
          style={{
            fontFamily: "var(--font-crimson-pro), Georgia, serif",
            fontSize: 24,
            fontWeight: 500,
          }}
        >
          Folders
        </h1>
      </div>

      <CreateCollectionForm />

      <CollectionList
        collections={collections.map((c) => ({
          id: c.id,
          name: c.name,
          isDefault: c.isDefault,
          excludeFromTotals: c.excludeFromTotals,
          itemCount: c._count.items,
        }))}
      />
    </div>
  );
}
