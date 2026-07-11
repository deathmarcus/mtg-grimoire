import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money-format";
import {
  EXPORT_SCHEMA_VERSION,
  collectionToCsv,
  wishlistToCsv,
  deckToCsv,
  toExportJson,
  type CollectionExportItem,
  type WishlistExportItem,
  type DeckExport,
} from "@/lib/export";

const TYPES = ["collection", "wishlist", "deck"] as const;
const FORMATS = ["csv", "json"] as const;
type ExportType = (typeof TYPES)[number];
type ExportFormat = (typeof FORMATS)[number];

const CARD_SELECT = {
  select: { id: true, name: true, setCode: true, collectorNumber: true },
} as const;

function respond(
  format: ExportFormat,
  type: ExportType,
  csv: string,
  json: unknown
): Response {
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${type}-${date}.${format}`;
  const body = format === "csv" ? csv : JSON.stringify(json, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type":
        format === "csv" ? "text/csv; charset=utf-8" : "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Export-Schema-Version": String(EXPORT_SCHEMA_VERSION),
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const type = params.get("type") as ExportType | null;
  const format = params.get("format") as ExportFormat | null;
  const includeNotes = params.get("notes") === "1";

  if (!type || !TYPES.includes(type) || !format || !FORMATS.includes(format)) {
    return Response.json(
      { error: "Invalid type or format" },
      { status: 400 }
    );
  }
  const opts = { includeNotes };

  if (type === "collection") {
    const rows = await prisma.collectionItem.findMany({
      where: { userId },
      include: { card: CARD_SELECT },
      orderBy: { card: { name: "asc" } },
    });
    const items: CollectionExportItem[] = rows.map((r) => ({
      quantity: r.quantity,
      foil: r.foil,
      language: r.language,
      condition: r.condition,
      acquiredPrice: toNumber(r.acquiredPrice),
      notes: r.notes,
      card: r.card,
    }));
    return respond(
      format,
      type,
      collectionToCsv(items, opts),
      toExportJson("collection", items, opts)
    );
  }

  if (type === "wishlist") {
    const rows = await prisma.wishlistItem.findMany({
      where: { userId },
      include: { card: CARD_SELECT },
      orderBy: { card: { name: "asc" } },
    });
    const items: WishlistExportItem[] = rows.map((r) => ({
      quantityWanted: r.quantityWanted,
      maxPriceUsd: toNumber(r.maxPriceUsd),
      priority: r.priority,
      tag: r.tag,
      notes: r.notes,
      card: r.card,
    }));
    return respond(
      format,
      type,
      wishlistToCsv(items, opts),
      toExportJson("wishlist", items, opts)
    );
  }

  const deckId = params.get("deckId");
  if (!deckId) {
    return Response.json({ error: "deckId is required" }, { status: 400 });
  }
  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId },
    include: { cards: { include: { card: CARD_SELECT } } },
  });
  if (!deck) {
    return Response.json({ error: "Deck not found" }, { status: 404 });
  }
  const deckExport: DeckExport = {
    name: deck.name,
    format: deck.format,
    cards: deck.cards.map((dc) => ({
      quantity: dc.quantity,
      board: dc.board,
      isCommander: dc.isCommander,
      category: dc.category,
      card: dc.card,
    })),
  };
  return respond(
    format,
    "deck",
    deckToCsv(deckExport),
    toExportJson("deck", deckExport, opts)
  );
}
