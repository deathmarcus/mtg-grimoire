# Stock-aware deck building — MVP "señal owned" (F11, #24)

**Fecha**: 2026-07-11 · **Estado**: aprobado en sesión de brainstorming con Marco
**Etapa destino**: Etapa 2 del roadmap (retención) · **Issue padre**: #24

## Objetivo

Explotar la ventaja estructural de tener colección + decks en la misma base: que el
usuario vea, en todo momento, qué parte de cada deck ya posee y cuánto le costaría
completarlo. **El MVP es solo señal + filtro; explícitamente NO incluye sugerencias**
(ni por rol, ni por curva, ni IA externa).

## Decisiones de producto (locked en la sesión)

1. **Alcance MVP**: señal owned + filtro "solo mi colección". Sin sugerencias.
2. **Matching por nombre**, no por printing: cualquier printing tuyo cubre la carta
   del deck. Ambos lados leen `Card.name`, así que los nombres DFC ("A // B") casan
   sin normalización extra. Case-insensitive.
3. **Cantidad-aware**: el deck pide 4 y tienes 2 → "2/4"; el % y el costo cuentan
   las 2 faltantes. Clamp: tener 6 cuando pide 4 cuenta 4/4 (una copia no cubre dos
   slots, un excedente no suma).
4. **Contra la colección completa**: no se descuentan copias "usadas" por otros
   decks. (Posible toggle "descontar mis otros decks" anotado como iteración futura,
   solo si usuarios lo piden.)
5. **Costo de completar: ambos precios** — el del printing que lista el deck
   (principal) y "desde $X" con el printing más barato del catálogo (subtexto).
6. **Superficies (las 4)**: badges por fila en el builder, tile de completitud en el
   header del deck, % en `/decks` (grid y lista), toggle "solo mi colección" en el
   add-card del builder.
7. **Conteo**: mainboard + comandante; Considering/sideboard excluido.
8. **Tierras básicas** cuentan como cualquier carta.

## Arquitectura (enfoque aprobado: on-the-fly, sin denormalizar)

Todo se computa en server components al renderizar. Nada de columnas derivadas ni
invalidación: un import o bulk edit se refleja al instante. A la escala actual
(colecciones de miles, decks de decenas) el costo es una agregación indexada por
render.

### Lógica pura — `src/lib/deck-ownership.ts` (TDD estricto)

```ts
type OwnershipCard = {
  name: string; quantity: number; board: "MAIN" | "SIDE";
  isCommander: boolean; priceUsd: number | null;
};
computeDeckOwnership(
  cards: OwnershipCard[],
  ownedByName: Map<string, number>,   // nombre lowercase → copias totales del usuario
  cheapestByName?: Map<string, number | null>,
): {
  perCard: Map<string, { ownedQty: number; neededQty: number }>; // key: nombre lowercase
  totalNeeded: number; totalOwned: number; pct: number;          // pct entero 0..100
  missing: Array<{ name: string; missingQty: number;
                   deckPrintingCost: number | null; cheapestCost: number | null }>;
  costToComplete: number;        // suma con printing del deck (faltantes con precio)
  costToCompleteCheapest: number;
  costIsApprox: boolean;         // true si algún faltante no tiene precio en catálogo
}
```

Reglas: filtra a MAIN + comandante; agrega cantidades del deck por nombre; clamp
`ownedQty = min(owned, needed)`; faltantes sin precio se excluyen de las sumas y
activan `costIsApprox` (la UI muestra "≈").

### Queries (raw SQL parametrizado, patrón de `/sets`)

- **Builder** (`/decks/[deckId]`): 
  `SELECT lower(c.name), SUM(ci.quantity) FROM "CollectionItem" ci JOIN "Card" c … 
  WHERE ci."userId" = $user AND lower(c.name) IN (nombres del deck) GROUP BY 1`.
  Para el "desde $X": `SELECT lower(name), MIN("latestUsd") FROM "Card" WHERE 
  lower(name) IN (faltantes) AND "latestUsd" IS NOT NULL GROUP BY 1`.
- **Landing** (`/decks`): una sola query agregada para todos los decks del usuario
  (JOIN `DeckCard`→`Card` contra el agregado de colección por nombre) que devuelve
  `deckId → { totalNeeded, totalOwned }`. Sin N+1. El % se deriva con la misma lib.

### UI

- **MainboardTab (3 vistas)**: badge por carta — verde "✓ 4/4" completo, dorado
  "2/4" parcial, rojo "0/3" nada. En Text como chip en la fila; en Stacks/Grid como
  overlay pequeño sobre el arte.
- **Header del deck**: tile junto a valor/nº cartas — "Tienes 42/60 (70%)" + barra
  de progreso (reutiliza `SetProgressBar`) + "Completar: $61.20 · desde $48.90"
  (con "≈" si `costIsApprox`; conversión MXN con provenance FX como el resto).
- **`/decks`**: mini-barra + "70% tuyo" en cada card del grid; columna "% tuyo" en
  la list view.
- **Add-card del builder**: toggle "Solo mi colección" en `InlineCardSearch` →
  parámetro `ownedOnly` en la búsqueda existente; filtra a nombres con
  `EXISTS (CollectionItem del usuario)`. Ortogonal al comportamiento actual.
- **i18n**: todas las strings nuevas en `es.ts` y `en.ts`.

### Bordes y errores

- Colección vacía → 0%, sin errores; deck vacío → sin señal (tile oculto).
- Usuario sin sesión no aplica (todas las superficies son privadas; `/d/[slug]`
  público NO muestra ownership — es del dueño, no del visitante).
- Faltantes sin precio → excluidos de sumas, costo marcado "≈".

## Testing

- **TDD lib pura**: parciales, clamp por exceso, commander incluido, Considering
  excluido, deck/colección vacíos, precios null (`costIsApprox`), pct redondeo.
- **Agregaciones SQL**: evidencia empírica contra DB dev (EXPLAIN + resultados con
  usuario seed), como en F7.
- **`ownedOnly`**: test de la server action/endpoint de búsqueda (con y sin toggle,
  scoping por userId).

## Kill criterion (para NO iterar a sugerencias)

Si tras 8 semanas en producción menos del ~20% de los usuarios activos con decks
interactúan con la señal (toggle `ownedOnly` o vista de faltantes — medido con la
analytics de Etapa 0), F11 se cierra en este MVP y no se invierte en "sugerencias
por rol". Registrado también en `findings.md`.

## Breakdown en issues hijos (AFK, tras aprobar este spec)

1. **Lib + builder**: `deck-ownership.ts` (TDD) + query agregada + badges en las 3
   vistas + tile del header con ambos costos.
2. **Landing `/decks`**: query agregada multi-deck + % en grid y list view.
3. **Filtro `ownedOnly`**: toggle en add-card + parámetro en la búsqueda + tests.

Dependencias: (2) y (3) dependen de la lib de (1); entre sí son independientes.

## Descartado explícitamente en el MVP

- Sugerencias (por rol, curva o cualquier heurística) — condicionadas al kill criterion.
- IA externa (requisito del issue: heurísticas sobre datos propios únicamente).
- Asignación física de copias entre decks (toggle futuro, no MVP).
- Denormalización de % en `Deck` (stale-prone; on-the-fly es suficiente a esta escala).
