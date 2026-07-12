// src/lib/deck-ownership-data.ts
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Copias totales del usuario agregadas por nombre de carta (lowercase).
 * Sin `names` devuelve la colección completa (para /decks landing);
 * con `names` filtra a esos nombres (para el builder de un deck).
 */
export async function getOwnedQuantitiesByName(
  userId: string,
  names?: string[],
): Promise<Record<string, number>> {
  const nameFilter =
    names && names.length > 0
      ? Prisma.sql`AND lower(c.name) = ANY(${names.map((n) => n.toLowerCase())}::text[])`
      : Prisma.empty;
  const rows = await prisma.$queryRaw<Array<{ name: string; qty: number }>>(Prisma.sql`
    SELECT lower(c.name) AS name, SUM(ci.quantity)::int AS qty
    FROM "CollectionItem" ci
    JOIN "Card" c ON c.id = ci."cardId"
    WHERE ci."userId" = ${userId} ${nameFilter}
    GROUP BY 1
  `);
  return Object.fromEntries(rows.map((r) => [r.name, r.qty]));
}

/** Precio del printing más barato del catálogo por nombre (para "desde $X"). */
export async function getCheapestByName(
  names: string[],
): Promise<Record<string, number | null>> {
  if (names.length === 0) return {};
  const rows = await prisma.$queryRaw<Array<{ name: string; cheapest: unknown }>>(Prisma.sql`
    SELECT lower(name) AS name, MIN("latestUsd") AS cheapest
    FROM "Card"
    WHERE lower(name) = ANY(${names.map((n) => n.toLowerCase())}::text[])
      AND "latestUsd" IS NOT NULL
    GROUP BY 1
  `);
  return Object.fromEntries(
    rows.map((r) => [r.name, r.cheapest == null ? null : Number(r.cheapest)]),
  );
}
