# Stock-aware Deck Building MVP (F11, #24) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Señal "owned" cantidad-aware en decks (badges por fila, tile de completitud con costo, % en /decks) + filtro "solo mi colección" en el add-card del builder. Sin sugerencias.

**Architecture:** Cómputo on-the-fly en server components: una lib pura (`computeDeckOwnership`) cruza las cantidades del deck contra un agregado de la colección por nombre (raw SQL). Nada denormalizado. Matching por nombre lowercase, clamp por cantidad, mainboard + comandante.

**Tech Stack:** Next.js 16 App Router, Prisma 6 ($queryRaw con Prisma.sql), vitest, i18n propio (`t(key, locale)`), tokens Grimoire en `globals.css`.

**Spec:** `docs/superpowers/specs/2026-07-11-stock-aware-deck-building-design.md` — leerlo antes de empezar.

**Convenciones del repo que DEBES seguir:**
- Node: `source ~/.nvm/nvm.sh && nvm use` antes de cualquier npm.
- TDD estricto: test primero, verifica ROJO, implementa, verifica VERDE, commit.
- Commits en español, conventional commits, cuerpo `Refs #24`.
- `git add` con rutas explícitas, nunca `-A` ni `.`.
- Strings user-facing SIEMPRE en `src/lib/i18n/es.ts` Y `en.ts`.
- Los props server→client deben ser JSON-serializables (por eso la lib usa `Record`, no `Map`).

---

## File Structure

| Archivo | Rol |
|---|---|
| `src/lib/deck-ownership.ts` (nuevo) | Lógica pura: `computeDeckOwnership` |
| `src/lib/deck-ownership.test.ts` (nuevo) | Tests TDD de la lib |
| `src/lib/deck-ownership-data.ts` (nuevo) | Queries: `getOwnedQuantitiesByName`, `getCheapestByName` |
| `src/lib/deck-ownership-data.test.ts` (nuevo) | Tests con vi.mock de prisma |
| `src/app/(app)/decks/[deckId]/OwnedBadge.tsx` (nuevo) | Badge ✓ 4/4 · 2/4 · 0/3 |
| `src/app/(app)/decks/[deckId]/page.tsx` (mod) | Computa ownership, tile en header, pasa perCard |
| `src/app/(app)/decks/[deckId]/DeckBuilder.tsx` (mod) | Prop pass-through `ownership` |
| `src/app/(app)/decks/[deckId]/MainboardTab.tsx` (mod) | Badge en TextRow/StackCard/GridTile |
| `src/app/(app)/decks/page.tsx` (mod) | % por deck (una query de colección) |
| `src/app/(app)/decks/DecksClient.tsx` + `DeckListView.tsx` (mod) | UI del % |
| `src/app/(app)/decks/actions.ts` (mod) | `searchCardsForDeck` con `ownedOnly` |
| `src/app/(app)/decks/[deckId]/InlineCardSearch.tsx` (mod) | Toggle "Solo mi colección" |
| `src/app/globals.css` (mod) | `.owned-badge` variantes |
| `src/lib/i18n/{es,en}.ts` (mod) | Keys nuevas |

---

### Task 1: Lib pura `computeDeckOwnership` (TDD)

**Files:**
- Create: `src/lib/deck-ownership.ts`
- Test: `src/lib/deck-ownership.test.ts`

- [ ] **Step 1.1: Escribir los tests que fallan**

```ts
// src/lib/deck-ownership.test.ts
import { describe, it, expect } from "vitest";
import { computeDeckOwnership, type OwnershipCard } from "./deck-ownership";

const card = (over: Partial<OwnershipCard>): OwnershipCard => ({
  name: "Lightning Bolt",
  quantity: 1,
  board: "MAIN",
  isCommander: false,
  priceUsd: 1,
  ...over,
});

describe("computeDeckOwnership", () => {
  it("deck vacío → 0/0, pct 0, sin faltantes", () => {
    const r = computeDeckOwnership([], {});
    expect(r).toMatchObject({
      totalNeeded: 0, totalOwned: 0, pct: 0,
      missing: [], costToComplete: 0, costToCompleteCheapest: 0, costIsApprox: false,
    });
  });

  it("cuenta parcial cantidad-aware: pide 4, tienes 2 → 2/4 y faltan 2", () => {
    const r = computeDeckOwnership(
      [card({ quantity: 4, priceUsd: 2 })],
      { "lightning bolt": 2 },
    );
    expect(r.perCard["lightning bolt"]).toEqual({ ownedQty: 2, neededQty: 4 });
    expect(r.totalOwned).toBe(2);
    expect(r.totalNeeded).toBe(4);
    expect(r.pct).toBe(50);
    expect(r.missing).toEqual([
      { name: "Lightning Bolt", missingQty: 2, deckPrintingCost: 2, cheapestCost: null },
    ]);
    expect(r.costToComplete).toBe(4); // 2 faltantes × $2
  });

  it("clamp por exceso: tienes 6 cuando pide 4 → 4/4, pct 100", () => {
    const r = computeDeckOwnership([card({ quantity: 4 })], { "lightning bolt": 6 });
    expect(r.perCard["lightning bolt"]).toEqual({ ownedQty: 4, neededQty: 4 });
    expect(r.pct).toBe(100);
    expect(r.missing).toEqual([]);
  });

  it("matching case-insensitive por nombre", () => {
    const r = computeDeckOwnership(
      [card({ name: "LIGHTNING BOLT" })],
      { "lightning bolt": 1 },
    );
    expect(r.pct).toBe(100);
  });

  it("agrega filas del deck con el mismo nombre antes de comparar", () => {
    const r = computeDeckOwnership(
      [card({ quantity: 2 }), card({ quantity: 2 })],
      { "lightning bolt": 3 },
    );
    expect(r.perCard["lightning bolt"]).toEqual({ ownedQty: 3, neededQty: 4 });
  });

  it("excluye board SIDE, incluye comandante", () => {
    const r = computeDeckOwnership(
      [
        card({ name: "Sol Ring", board: "MAIN", quantity: 1 }),
        card({ name: "Atraxa", board: "MAIN", isCommander: true, quantity: 1 }),
        card({ name: "Opt", board: "SIDE", quantity: 3 }),
      ],
      {},
    );
    expect(r.totalNeeded).toBe(2); // Sol Ring + Atraxa; Opt fuera
    expect(r.perCard["opt"]).toBeUndefined();
  });

  it("costo con ambos precios: printing del deck y más barato", () => {
    const r = computeDeckOwnership(
      [card({ name: "Force of Will", quantity: 1, priceUsd: 80 })],
      {},
      { "force of will": 55 },
    );
    expect(r.costToComplete).toBe(80);
    expect(r.costToCompleteCheapest).toBe(55);
    expect(r.missing[0]).toEqual({
      name: "Force of Will", missingQty: 1, deckPrintingCost: 80, cheapestCost: 55,
    });
  });

  it("cheapest cae al precio del deck si no hay dato más barato", () => {
    const r = computeDeckOwnership([card({ quantity: 2, priceUsd: 3 })], {});
    expect(r.costToCompleteCheapest).toBe(6);
  });

  it("faltante sin precio en ningún lado → excluido de sumas y costIsApprox", () => {
    const r = computeDeckOwnership(
      [card({ name: "Oscura", quantity: 2, priceUsd: null }), card({ quantity: 1, priceUsd: 5 })],
      {},
    );
    expect(r.costIsApprox).toBe(true);
    expect(r.costToComplete).toBe(5);
    expect(r.costToCompleteCheapest).toBe(5);
  });

  it("pct redondea al entero más cercano", () => {
    const r = computeDeckOwnership([card({ quantity: 3 })], { "lightning bolt": 1 });
    expect(r.pct).toBe(33);
  });
});
```

- [ ] **Step 1.2: Verificar ROJO**

Run: `source ~/.nvm/nvm.sh && nvm use && npx vitest run src/lib/deck-ownership.test.ts`
Expected: FAIL — "Cannot find module './deck-ownership'".

- [ ] **Step 1.3: Implementar la lib**

```ts
// src/lib/deck-ownership.ts
/**
 * Señal "owned" para decks (F11 #24): cruza las cantidades del deck contra
 * la colección del usuario agregada por nombre. Matching por nombre lowercase
 * (cualquier printing cubre), cantidad-aware con clamp, mainboard + comandante.
 * Spec: docs/superpowers/specs/2026-07-11-stock-aware-deck-building-design.md
 */

export type OwnershipCard = {
  name: string;
  quantity: number;
  board: "MAIN" | "SIDE";
  isCommander: boolean;
  priceUsd: number | null;
};

export type MissingCard = {
  name: string;
  missingQty: number;
  deckPrintingCost: number | null;
  cheapestCost: number | null;
};

export type DeckOwnership = {
  /** key: nombre lowercase */
  perCard: Record<string, { ownedQty: number; neededQty: number }>;
  totalNeeded: number;
  totalOwned: number;
  /** entero 0..100, Math.round */
  pct: number;
  missing: MissingCard[];
  /** suma con el precio del printing que lista el deck (faltantes con precio) */
  costToComplete: number;
  /** suma con el printing más barato del catálogo; cae al del deck si falta */
  costToCompleteCheapest: number;
  /** true si algún faltante quedó fuera de las sumas por no tener precio */
  costIsApprox: boolean;
};

export function computeDeckOwnership(
  cards: OwnershipCard[],
  ownedByName: Record<string, number>,
  cheapestByName?: Record<string, number | null>,
): DeckOwnership {
  // Agrega cantidades del deck por nombre (mainboard + comandante)
  const needed = new Map<
    string,
    { neededQty: number; priceUsd: number | null; displayName: string }
  >();
  for (const c of cards) {
    if (c.board !== "MAIN" && !c.isCommander) continue;
    const key = c.name.toLowerCase();
    const cur = needed.get(key);
    if (cur) {
      cur.neededQty += c.quantity;
      if (cur.priceUsd === null) cur.priceUsd = c.priceUsd;
    } else {
      needed.set(key, { neededQty: c.quantity, priceUsd: c.priceUsd, displayName: c.name });
    }
  }

  const perCard: DeckOwnership["perCard"] = {};
  const missing: MissingCard[] = [];
  let totalNeeded = 0;
  let totalOwned = 0;
  let costToComplete = 0;
  let costToCompleteCheapest = 0;
  let costIsApprox = false;

  for (const [key, info] of needed) {
    const ownedQty = Math.min(ownedByName[key] ?? 0, info.neededQty);
    perCard[key] = { ownedQty, neededQty: info.neededQty };
    totalNeeded += info.neededQty;
    totalOwned += ownedQty;

    const missingQty = info.neededQty - ownedQty;
    if (missingQty === 0) continue;

    const cheapestCost = cheapestByName?.[key] ?? null;
    missing.push({
      name: info.displayName,
      missingQty,
      deckPrintingCost: info.priceUsd,
      cheapestCost,
    });

    if (info.priceUsd === null) costIsApprox = true;
    else costToComplete += info.priceUsd * missingQty;

    const cheapEffective = cheapestCost ?? info.priceUsd;
    if (cheapEffective !== null) costToCompleteCheapest += cheapEffective * missingQty;
  }

  const pct = totalNeeded === 0 ? 0 : Math.round((totalOwned / totalNeeded) * 100);

  return {
    perCard,
    totalNeeded,
    totalOwned,
    pct,
    missing,
    costToComplete,
    costToCompleteCheapest,
    costIsApprox,
  };
}
```

- [ ] **Step 1.4: Verificar VERDE**

Run: `npx vitest run src/lib/deck-ownership.test.ts`
Expected: 10 passed.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/deck-ownership.ts src/lib/deck-ownership.test.ts
git commit -m "feat(decks): lib pura computeDeckOwnership para señal owned

Refs #24"
```

---

### Task 2: Data helpers `getOwnedQuantitiesByName` / `getCheapestByName` (TDD con vi.mock)

**Files:**
- Create: `src/lib/deck-ownership-data.ts`
- Test: `src/lib/deck-ownership-data.test.ts`

- [ ] **Step 2.1: Escribir los tests que fallan**

```ts
// src/lib/deck-ownership-data.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { getOwnedQuantitiesByName, getCheapestByName } from "./deck-ownership-data";

beforeEach(() => vi.clearAllMocks());

describe("getOwnedQuantitiesByName", () => {
  it("construye el record nombre→qty desde las filas", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { name: "lightning bolt", qty: 4 },
      { name: "sol ring", qty: 1 },
    ]);
    const r = await getOwnedQuantitiesByName("user-1");
    expect(r).toEqual({ "lightning bolt": 4, "sol ring": 1 });
  });

  it("colección vacía → record vacío", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    expect(await getOwnedQuantitiesByName("user-1")).toEqual({});
  });

  it("pasa los nombres lowercased como parámetro cuando se filtran", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    await getOwnedQuantitiesByName("user-1", ["Lightning BOLT"]);
    const sql = mockPrisma.$queryRaw.mock.calls[0][0];
    expect(sql.values).toContain("user-1");
    expect(sql.values.flat()).toContain("lightning bolt");
  });
});

describe("getCheapestByName", () => {
  it("nombres vacíos → sin query", async () => {
    expect(await getCheapestByName([])).toEqual({});
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("convierte Decimal-like a number", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ name: "force of will", cheapest: "55.30" }]);
    expect(await getCheapestByName(["Force of Will"])).toEqual({ "force of will": 55.3 });
  });
});
```

- [ ] **Step 2.2: Verificar ROJO**

Run: `npx vitest run src/lib/deck-ownership-data.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 2.3: Implementar**

```ts
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
```

- [ ] **Step 2.4: Verificar VERDE + evidencia empírica**

Run: `npx vitest run src/lib/deck-ownership-data.test.ts` → 5 passed.

Después, evidencia contra la DB dev (catálogo real): script one-off `scripts/tmp-verify-ownership.ts` que llame a ambas funciones con un userId real y 2-3 nombres, imprima resultados y borre nada. Ejecutar con `npx tsx scripts/tmp-verify-ownership.ts`, pegar output en el commit message o en el reporte, y **borrar el script** (no se commitea).

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/deck-ownership-data.ts src/lib/deck-ownership-data.test.ts
git commit -m "feat(decks): queries agregadas de colección por nombre para señal owned

Refs #24"
```

---

### Task 3: Builder — badges por fila + tile de completitud en header

**Files:**
- Create: `src/app/(app)/decks/[deckId]/OwnedBadge.tsx`
- Modify: `src/app/(app)/decks/[deckId]/page.tsx`
- Modify: `src/app/(app)/decks/[deckId]/DeckBuilder.tsx` (props pass-through)
- Modify: `src/app/(app)/decks/[deckId]/MainboardTab.tsx` (TextRow, StackCard, GridTile)
- Modify: `src/app/globals.css`, `src/lib/i18n/es.ts`, `src/lib/i18n/en.ts`

Sin test de componente (convención del repo: sin jsdom; la lógica ya está testeada en Task 1). Verificación por lint + build + smoke.

- [ ] **Step 3.1: i18n keys** — añadir a `es.ts`:

```ts
  // Deck ownership (F11 #24)
  "deck.owned.title": "Tienes",
  "deck.owned.complete": "Completar",
  "deck.owned.from": "desde",
  "deck.owned.yours": "tuyo",
  "deck.search.ownedOnly": "Solo mi colección",
```

y a `en.ts`:

```ts
  // Deck ownership (F11 #24)
  "deck.owned.title": "You own",
  "deck.owned.complete": "To complete",
  "deck.owned.from": "from",
  "deck.owned.yours": "yours",
  "deck.search.ownedOnly": "My collection only",
```

- [ ] **Step 3.2: CSS** — añadir a `globals.css` (junto a las clases de chips existentes):

```css
/* Owned badge — señal de posesión en filas de deck (F11 #24) */
.owned-badge {
  font-family: var(--font-jetbrains-mono), monospace;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--r-sm);
  white-space: nowrap;
  flex-shrink: 0;
}
.owned-badge.is-full { color: var(--pos); background: oklch(0.35 0.08 150 / 0.25); }
.owned-badge.is-partial { color: var(--accent); background: var(--accent-bg); }
.owned-badge.is-none { color: var(--neg); background: oklch(0.35 0.1 25 / 0.25); }
```

- [ ] **Step 3.3: Componente `OwnedBadge`**

```tsx
// src/app/(app)/decks/[deckId]/OwnedBadge.tsx
export function OwnedBadge({ owned, needed }: { owned: number; needed: number }) {
  const cls =
    owned >= needed ? "is-full" : owned === 0 ? "is-none" : "is-partial";
  return (
    <span className={`owned-badge ${cls}`} title={`${owned}/${needed}`}>
      {owned >= needed ? "✓ " : ""}
      {owned}/{needed}
    </span>
  );
}
```

- [ ] **Step 3.4: `page.tsx` del deck** — tras cargar `deck`, computar ownership y render del tile:

```tsx
// imports nuevos:
import { computeDeckOwnership } from "@/lib/deck-ownership";
import { getOwnedQuantitiesByName, getCheapestByName } from "@/lib/deck-ownership-data";
import { SetProgressBar } from "@/components/SetProgressBar";
import { t } from "@/lib/i18n";

// después de `const sideCards = …` (línea ~72):
const deckNames = [...new Set(mainCards.map((c) => c.card.name))];
const ownedByName = await getOwnedQuantitiesByName(user.id, deckNames);
const prelim = computeDeckOwnership(
  mainCards.map((c) => ({
    name: c.card.name,
    quantity: c.quantity,
    board: "MAIN" as const,
    isCommander: c.isCommander,
    priceUsd: toNumber(c.card.latestUsd),
  })),
  ownedByName,
);
const cheapestByName = await getCheapestByName(prelim.missing.map((m) => m.name));
const ownership = computeDeckOwnership(
  mainCards.map((c) => ({
    name: c.card.name,
    quantity: c.quantity,
    board: "MAIN" as const,
    isCommander: c.isCommander,
    priceUsd: toNumber(c.card.latestUsd),
  })),
  ownedByName,
  cheapestByName,
);
```

Tile en el header panel, entre el bloque "Total value" y `PublicShareToggle` (misma fila flex):

```tsx
{ownership.totalNeeded > 0 && (
  <div style={{ textAlign: "right", minWidth: 180 }}>
    <div className="eyebrow">{t("deck.owned.title", locale)}</div>
    <SetProgressBar
      owned={ownership.totalOwned}
      total={ownership.totalNeeded}
      pct={ownership.pct}
    />
    {ownership.missing.length > 0 && (
      <div
        style={{
          fontFamily: "var(--font-jetbrains-mono), monospace",
          fontSize: 11,
          color: "var(--ink-2)",
          marginTop: 2,
        }}
      >
        {t("deck.owned.complete", locale)}:{" "}
        {ownership.costIsApprox ? "≈" : ""}
        {formatMoney(ownership.costToComplete, currency, rate)}
        {" · "}
        {t("deck.owned.from", locale)}{" "}
        {ownership.costIsApprox ? "≈" : ""}
        {formatMoney(ownership.costToCompleteCheapest, currency, rate)}
      </div>
    )}
  </div>
)}
```

Y pasar a `DeckBuilder`: `ownership={ownership.perCard}`.

- [ ] **Step 3.5: `DeckBuilder.tsx`** — añadir al type `Props` y destructuring:

```ts
ownership: Record<string, { ownedQty: number; neededQty: number }>;
```

y pasarlo a `<MainboardTab … ownership={ownership} />` (a los DOS usos si hay más de uno).

- [ ] **Step 3.6: `MainboardTab.tsx`** — añadir `ownership` al type `Props` del componente exportado y derivar por carta. En `TextRow`, `StackCard` y `GridTile`: añadir prop opcional `ownedInfo?: { ownedQty: number; neededQty: number }` y renderizar `<OwnedBadge owned={ownedInfo.ownedQty} needed={ownedInfo.neededQty} />` cuando exista — en TextRow junto al nombre (antes del warning de color), en StackCard/GridTile como overlay pequeño en la esquina superior izquierda del arte:

```tsx
// lookup en el cuerpo de MainboardTab, al mapear cartas:
const ownedInfo = ownership[c.card.name.toLowerCase()];
```

```tsx
// overlay para StackCard/GridTile (dentro del contenedor del arte, que es position:relative):
{ownedInfo && (
  <span style={{ position: "absolute", top: 4, left: 4, zIndex: 2 }}>
    <OwnedBadge owned={ownedInfo.ownedQty} needed={ownedInfo.neededQty} />
  </span>
)}
```

`SideboardRow` NO recibe badge (Considering excluido por spec).

- [ ] **Step 3.7: Verificar**

Run: `npm test` (todo verde), `npm run lint` (0 errores), `npm run build` (verde).
Smoke: `npm run dev`, abrir un deck con cartas que posees parcialmente → badges correctos y tile con % y costos.

- [ ] **Step 3.8: Commit**

```bash
git add "src/app/(app)/decks/[deckId]/OwnedBadge.tsx" "src/app/(app)/decks/[deckId]/page.tsx" \
  "src/app/(app)/decks/[deckId]/DeckBuilder.tsx" "src/app/(app)/decks/[deckId]/MainboardTab.tsx" \
  src/app/globals.css src/lib/i18n/es.ts src/lib/i18n/en.ts
git commit -m "feat(decks): badges owned por fila y tile de completitud en el builder

Refs #24"
```

---

### Task 4: `/decks` landing — % poseído por deck

**Files:**
- Modify: `src/app/(app)/decks/page.tsx`
- Modify: `src/app/(app)/decks/DecksClient.tsx`
- Modify: `src/app/(app)/decks/DeckListView.tsx`

- [ ] **Step 4.1: `page.tsx`** — añadir `name: true` al select de `card` (dentro de `cards.select.card.select`), cargar el agregado UNA vez y computar por deck:

```tsx
// imports nuevos:
import { computeDeckOwnership } from "@/lib/deck-ownership";
import { getOwnedQuantitiesByName } from "@/lib/deck-ownership-data";

// después de cargar `decks` (una sola query para toda la colección, sin N+1):
const ownedByName = await getOwnedQuantitiesByName(user.id);

// dentro del map de deckStats, añadir:
const ownership = computeDeckOwnership(
  deck.cards.map((c) => ({
    name: c.card.name,
    quantity: c.quantity,
    board: "MAIN" as const,
    isCommander: false,
    priceUsd: null,
  })),
  ownedByName,
);
// …y al objeto retornado:
ownedPct: ownership.totalNeeded > 0 ? ownership.pct : null,
```

(El select de `cards` ya filtra `board: "MAIN"`, así que `board: "MAIN"` fijo es correcto.)

- [ ] **Step 4.2: `DecksClient.tsx`** — añadir `ownedPct: number | null` al type del deck que recibe. En la card del grid, bajo la línea de formato/valor:

```tsx
{deck.ownedPct !== null && (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
    <span
      style={{
        display: "inline-block", width: 60, height: 4,
        background: "var(--bg-3)", borderRadius: 2, overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <span style={{ display: "block", height: 4, width: `${deck.ownedPct}%`, background: "var(--accent)" }} />
    </span>
    <span
      style={{
        fontFamily: "var(--font-jetbrains-mono), monospace",
        fontSize: 10, color: "var(--accent)",
      }}
    >
      {deck.ownedPct}% {ownedLabel}
    </span>
  </div>
)}
```

`ownedLabel` llega por props desde `page.tsx`: `ownedLabel={t("deck.owned.yours", locale)}` (mismo patrón que `emptyLabel`). Pasarlo también a `DeckListView`.

- [ ] **Step 4.3: `DeckListView.tsx`** — columna nueva "% {ownedLabel}" tras el formato, celda:

```tsx
<td className="num">
  {deck.ownedPct !== null ? `${deck.ownedPct}%` : "—"}
</td>
```

(Ajustar el header de la tabla en el mismo archivo; respeta la estructura `.tbl` existente.)

- [ ] **Step 4.4: Verificar**

Run: `npm test` && `npm run lint` && `npm run build` — todo verde.
Smoke: `/decks` muestra % en grid y lista, coherente con el % del builder de cada deck.

- [ ] **Step 4.5: Commit**

```bash
git add "src/app/(app)/decks/page.tsx" "src/app/(app)/decks/DecksClient.tsx" "src/app/(app)/decks/DeckListView.tsx"
git commit -m "feat(decks): % de colección poseída por deck en /decks

Refs #24"
```

---

### Task 5: Filtro "solo mi colección" en el add-card (TDD de la action)

**Files:**
- Modify: `src/app/(app)/decks/actions.ts` (`searchCardsForDeck`)
- Test: `src/app/(app)/decks/actions.test.ts` (añadir casos)
- Modify: `src/app/(app)/decks/[deckId]/InlineCardSearch.tsx`

- [ ] **Step 5.1: Tests que fallan** — añadir a `actions.test.ts` (seguir el patrón vi.mock existente del archivo; el mock de prisma ya existe ahí):

```ts
describe("searchCardsForDeck ownedOnly", () => {
  it("con ownedOnly restringe a nombres presentes en la colección del usuario", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { name: "Lightning Bolt" },
      { name: "Sol Ring" },
    ]);
    mockPrisma.card.findMany.mockResolvedValue([]);
    await searchCardsForDeck("bolt", { ownedOnly: true });
    // la query de nombres es del usuario de sesión
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    // y el findMany filtra por esos nombres (solo los que matchean el término)
    expect(mockPrisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { in: ["Lightning Bolt"] } },
      }),
    );
  });

  it("con ownedOnly y ningún nombre matcheando → [] sin query al catálogo", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ name: "Sol Ring" }]);
    const r = await searchCardsForDeck("bolt", { ownedOnly: true });
    expect(r).toEqual([]);
    expect(mockPrisma.card.findMany).not.toHaveBeenCalled();
  });

  it("sin ownedOnly conserva el comportamiento actual (contains insensitive)", async () => {
    mockPrisma.card.findMany.mockResolvedValue([]);
    await searchCardsForDeck("bolt");
    expect(mockPrisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: "bolt", mode: "insensitive" } },
      }),
    );
  });
});
```

Nota: si el mock de prisma del archivo no tiene `$queryRaw`, añadirlo al objeto `vi.hoisted` existente.

- [ ] **Step 5.2: Verificar ROJO** — `npx vitest run "src/app/(app)/decks/actions.test.ts"` → FAIL (firma sin opts / where distinto).

- [ ] **Step 5.3: Implementar** — reemplazar `searchCardsForDeck` en `actions.ts`:

```ts
export async function searchCardsForDeck(
  query: string,
  opts?: { ownedOnly?: boolean },
): Promise<CardSearchResult[]> {
  const user = await requireUser();
  const q = query.trim();
  if (q.length < 2) return [];

  let where: Prisma.CardWhereInput = { name: { contains: q, mode: "insensitive" } };

  if (opts?.ownedOnly) {
    // Nombres únicos de la colección del usuario (pocos miles como mucho);
    // el matching del término se hace en memoria para no duplicar el ILIKE.
    const owned = await prisma.$queryRaw<Array<{ name: string }>>(Prisma.sql`
      SELECT DISTINCT c.name
      FROM "CollectionItem" ci
      JOIN "Card" c ON c.id = ci."cardId"
      WHERE ci."userId" = ${user.id}
    `);
    const ql = q.toLowerCase();
    const names = owned
      .map((o) => o.name)
      .filter((n) => n.toLowerCase().includes(ql))
      .slice(0, 100);
    if (names.length === 0) return [];
    where = { name: { in: names } };
  }

  const cards = await prisma.card.findMany({
    where,
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
```

(Verificar que `Prisma` esté importado de `@prisma/client` en `actions.ts`; si no, añadirlo.)

- [ ] **Step 5.4: Verificar VERDE** — la suite del archivo pasa completa.

- [ ] **Step 5.5: Toggle en `InlineCardSearch.tsx`** — nuevo state + checkbox + prop de label:

```tsx
// Props pasa a: { deckId: string; ownedOnlyLabel: string }
const [ownedOnly, setOwnedOnly] = useState(false);
```

En `handleQueryChange`, la llamada pasa a `searchCardsForDeck(q, { ownedOnly })`. Como `ownedOnly` vive en un closure del debounce, incluirlo en el fetch leyendo un ref (`ownedOnlyRef.current`) o re-disparando la búsqueda al togglear:

```tsx
const ownedOnlyRef = useRef(false);
function toggleOwnedOnly() {
  const next = !ownedOnly;
  setOwnedOnly(next);
  ownedOnlyRef.current = next;
  if (query.trim().length >= 2) handleQueryChange(query); // re-buscar con el filtro nuevo
}
// …en el debounce: searchCardsForDeck(q, { ownedOnly: ownedOnlyRef.current })
```

Checkbox junto al input (antes del board selector):

```tsx
<label
  style={{
    display: "flex", alignItems: "center", gap: 5,
    fontFamily: "var(--font-jetbrains-mono), monospace",
    fontSize: 10, color: ownedOnly ? "var(--accent)" : "var(--ink-2)",
    cursor: "pointer", whiteSpace: "nowrap",
  }}
>
  <input type="checkbox" checked={ownedOnly} onChange={toggleOwnedOnly} />
  {ownedOnlyLabel}
</label>
```

En `DeckBuilder.tsx`, donde se renderiza `<InlineCardSearch deckId={deckId} />`, pasar `ownedOnlyLabel={t("deck.search.ownedOnly", locale)}` — `DeckBuilder` ya recibe `locale`; importar `t` de `@/lib/i18n`.

- [ ] **Step 5.6: Verificar** — `npm test` && `npm run lint` && `npm run build` verdes. Smoke: togglear el filtro con un término que posees y otro que no.

- [ ] **Step 5.7: Commit**

```bash
git add "src/app/(app)/decks/actions.ts" "src/app/(app)/decks/actions.test.ts" \
  "src/app/(app)/decks/[deckId]/InlineCardSearch.tsx" "src/app/(app)/decks/[deckId]/DeckBuilder.tsx"
git commit -m "feat(decks): filtro 'solo mi colección' en el add-card del builder

Refs #24"
```

---

### Task 6: Verificación final y cierre

- [ ] **Step 6.1**: Suite completa — `npm test` (todo verde; anotar el count), `npm run lint` (0 errores; 4 warnings preexistentes OK), `npm run build` (verde).
- [ ] **Step 6.2**: Smoke integral con la DB dev: deck Commander parcialmente poseído → badges en las 3 vistas, tile con ambos costos, % en /decks coherente, filtro ownedOnly con y sin resultados, colección vacía (usuario nuevo) no rompe nada.
- [ ] **Step 6.3**: Actualizar `progress.md` con la sesión (patrón de las entradas existentes).
- [ ] **Step 6.4**: El merge a main lleva `Closes #24` en el cuerpo del commit de merge.

---

## Self-check del ejecutor

- La vista pública `/d/[slug]` NO debe tocar nada de ownership (es del dueño, no del visitante) — verificar que ningún cambio se filtró allí.
- `perCard` viaja server→client como `Record` plano (nunca `Map`).
- Ningún string user-facing hardcodeado: grep de los literales nuevos en los componentes.
