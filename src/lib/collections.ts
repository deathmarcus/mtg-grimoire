import { prisma } from "./prisma";

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
