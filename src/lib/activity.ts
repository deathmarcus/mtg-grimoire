import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export type ActivityType =
  | "add"
  | "delete"
  | "import"
  | "wishlist_add";

export type AddPayload = {
  cardId: string;
  cardName: string;
  quantity: number;
  foil: string;
};

export type DeletePayload = {
  cardId: string;
  cardName: string;
  quantity: number;
};

export type ImportPayload = {
  inserted: number;
  merged: number;
  total: number;
  collectionName: string;
  replaced: boolean;
};

export type WishlistAddPayload = {
  cardId: string;
  cardName: string;
  quantityWanted: number;
};

export type ActivityPayload =
  | AddPayload
  | DeletePayload
  | ImportPayload
  | WishlistAddPayload;

export async function logActivity(
  userId: string,
  type: ActivityType,
  payload: ActivityPayload,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        type,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Non-critical: never fail user actions because of activity logging.
  }
}

export type ActivityEntry = {
  id: string;
  type: ActivityType;
  payload: ActivityPayload;
  createdAt: Date;
};

export async function getRecentActivity(
  userId: string,
  limit = 10,
): Promise<ActivityEntry[]> {
  const rows = await prisma.activityLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type as ActivityType,
    payload: r.payload as unknown as ActivityPayload,
    createdAt: r.createdAt,
  }));
}
