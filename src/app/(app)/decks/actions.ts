"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

// ---------------------------------------------------------------------------
// Deck CRUD
// ---------------------------------------------------------------------------

const deckSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  format: z.string().max(60).trim().default(""),
  description: z.string().max(1000).trim().optional(),
});

export async function createDeck(formData: FormData) {
  const user = await requireUser();
  const parsed = deckSchema.safeParse({
    name: formData.get("name"),
    format: formData.get("format") ?? "",
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) return { error: "Invalid input" };

  const deck = await prisma.deck.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      format: parsed.data.format,
      description: parsed.data.description ?? null,
    },
  });

  revalidatePath("/decks");
  redirect(`/decks/${deck.id}`);
}

export async function updateDeck(deckId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = deckSchema.safeParse({
    name: formData.get("name"),
    format: formData.get("format") ?? "",
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) return { error: "Invalid input" };

  await prisma.deck.updateMany({
    where: { id: deckId, userId: user.id },
    data: {
      name: parsed.data.name,
      format: parsed.data.format,
      description: parsed.data.description ?? null,
    },
  });

  revalidatePath("/decks");
  revalidatePath(`/decks/${deckId}`);
  return { ok: true };
}

export async function deleteDeck(deckId: string) {
  const user = await requireUser();
  await prisma.deck.deleteMany({
    where: { id: deckId, userId: user.id },
  });
  revalidatePath("/decks");
  redirect("/decks");
}

// ---------------------------------------------------------------------------
// DeckCard CRUD
// ---------------------------------------------------------------------------

const addCardSchema = z.object({
  cardId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  board: z.enum(["MAIN", "SIDE"]).default("MAIN"),
  isCommander: z.coerce.boolean().default(false),
});

export async function addCardToDeck(deckId: string, formData: FormData) {
  const user = await requireUser();

  // Verify deck ownership
  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId: user.id },
    select: { id: true },
  });
  if (!deck) return { error: "Deck not found" };

  const parsed = addCardSchema.safeParse({
    cardId: formData.get("cardId"),
    quantity: formData.get("quantity") ?? 1,
    board: formData.get("board") ?? "MAIN",
    isCommander: formData.get("isCommander") === "true",
  });
  if (!parsed.success) return { error: "Invalid input" };

  const d = parsed.data;

  await prisma.deckCard.upsert({
    where: {
      deckId_cardId_board: { deckId, cardId: d.cardId, board: d.board },
    },
    create: {
      deckId,
      cardId: d.cardId,
      quantity: d.quantity,
      board: d.board,
      isCommander: d.isCommander,
    },
    update: {
      quantity: { increment: d.quantity },
    },
  });

  revalidatePath(`/decks/${deckId}`);
  return { ok: true };
}

export async function removeCardFromDeck(deckId: string, deckCardId: string) {
  const user = await requireUser();

  // Verify deck ownership before deleting
  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId: user.id },
    select: { id: true },
  });
  if (!deck) return { error: "Deck not found" };

  await prisma.deckCard.delete({
    where: { id: deckCardId },
  });

  revalidatePath(`/decks/${deckId}`);
  return { ok: true };
}

const updateCardSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(99),
  isCommander: z.coerce.boolean().optional(),
  board: z.enum(["MAIN", "SIDE"]).optional(),
  category: z.string().max(64).optional().nullable(),
  cardId: z.string().optional(),
});

export async function updateDeckCard(deckId: string, deckCardId: string, formData: FormData) {
  const user = await requireUser();

  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId: user.id },
    select: { id: true },
  });
  if (!deck) return { error: "Deck not found" };

  const rawCategory = formData.get("category");
  const parsed = updateCardSchema.safeParse({
    quantity: formData.get("quantity"),
    isCommander: formData.get("isCommander") === "true" ? true : undefined,
    board: formData.get("board") ?? undefined,
    category: rawCategory !== null ? String(rawCategory) || null : undefined,
    cardId: formData.get("cardId") ?? undefined,
  });
  if (!parsed.success) return { error: "Invalid input" };

  const d = parsed.data;
  await prisma.deckCard.update({
    where: { id: deckCardId },
    data: {
      quantity: d.quantity,
      ...(d.isCommander !== undefined && { isCommander: d.isCommander }),
      ...(d.board !== undefined && { board: d.board }),
      ...(d.category !== undefined && { category: d.category }),
      ...(d.cardId !== undefined && { cardId: d.cardId }),
    },
  });

  revalidatePath(`/decks/${deckId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Card search (for inline add)
// ---------------------------------------------------------------------------

export type CardSearchResult = {
  id: string;
  name: string;
  setCode: string;
  manaCost: string | null;
  imageSmall: string | null;
  latestUsd: number | null;
};

export type PrintingResult = {
  id: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  imageSmall: string | null;
  latestUsd: number | null;
};

export async function getPrintingsByName(name: string): Promise<PrintingResult[]> {
  await requireUser();
  const printings = await prisma.card.findMany({
    where: { name: { equals: name, mode: "insensitive" } },
    orderBy: [{ setName: "asc" }, { collectorNumber: "asc" }],
    select: {
      id: true,
      setCode: true,
      setName: true,
      collectorNumber: true,
      imageSmall: true,
      latestUsd: true,
    },
  });
  return printings.map((c) => ({
    id: c.id,
    setCode: c.setCode,
    setName: c.setName,
    collectorNumber: c.collectorNumber,
    imageSmall: c.imageSmall,
    latestUsd: c.latestUsd ? Number(c.latestUsd) : null,
  }));
}

export async function searchCardsForDeck(query: string): Promise<CardSearchResult[]> {
  await requireUser();
  const q = query.trim();
  if (q.length < 2) return [];

  const cards = await prisma.card.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: 12,
    select: {
      id: true,
      name: true,
      setCode: true,
      manaCost: true,
      imageSmall: true,
      latestUsd: true,
    },
  });

  return cards.map((c) => ({
    id: c.id,
    name: c.name,
    setCode: c.setCode,
    manaCost: c.manaCost,
    imageSmall: c.imageSmall,
    latestUsd: c.latestUsd ? Number(c.latestUsd) : null,
  }));
}
