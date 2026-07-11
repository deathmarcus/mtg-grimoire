import { prisma } from "./prisma";

/**
 * Resolve a client-supplied collectionId to one the user actually owns.
 * Falsy id → the user's default collection. Foreign/unknown id → null.
 */
export async function requireOwnedCollectionId(
  userId: string,
  collectionId: string | null | undefined,
): Promise<string | null> {
  if (!collectionId) return getDefaultCollectionId(userId);
  const owned = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
    select: { id: true },
  });
  return owned?.id ?? null;
}

export async function getDefaultCollectionId(userId: string): Promise<string> {
  const def = await prisma.collection.findFirst({
    where: { userId, isDefault: true },
    select: { id: true },
  });
  if (def) return def.id;
  const created = await prisma.collection.create({
    data: { userId, name: "Mi colección", isDefault: true, sortOrder: 0 },
    select: { id: true },
  });
  return created.id;
}
