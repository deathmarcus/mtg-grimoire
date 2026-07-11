/**
 * Pure planning logic for bulk-editing CollectionItem rows (issue #22).
 *
 * A bulk edit applies a partial field change (folder / foil / language /
 * condition) to a set of selected items. Because CollectionItem has a
 * unique index on (userId, collectionId, cardId, foil, language, condition),
 * applying the same change to several items can make two or more rows
 * collide on that key — either with each other, or with an existing row
 * that wasn't part of the selection. This module computes what the DB
 * layer needs to do to resolve those collisions, without touching Prisma.
 *
 * No collision → plain field update.
 * Two+ selected items collapse onto the same key → one survivor (the first
 * in input order) absorbs the summed quantity, the rest are deleted.
 * A selected item's new key matches an existing (unselected) row → that
 * existing row absorbs the quantity, the selected item is deleted.
 */

export type FoilValue = "NORMAL" | "FOIL" | "ETCHED";
export type ConditionValue = "NM" | "LP" | "MP" | "HP" | "DMG";

export interface BulkItemSnapshot {
  id: string;
  cardId: string;
  collectionId: string;
  foil: FoilValue;
  language: string;
  condition: ConditionValue;
  quantity: number;
}

export interface BulkChange {
  collectionId?: string;
  foil?: FoilValue;
  language?: string;
  condition?: ConditionValue;
}

/** An existing CollectionItem row for the same user that is NOT part of the selection. */
export interface ExistingItem {
  id: string;
  cardId: string;
  collectionId: string;
  foil: FoilValue;
  language: string;
  condition: ConditionValue;
}

export interface FieldUpdateOp {
  kind: "fieldUpdate";
  id: string;
  collectionId: string;
  foil: FoilValue;
  language: string;
  condition: ConditionValue;
}

export interface SurvivorUpdateOp {
  kind: "survivorUpdate";
  id: string;
  collectionId: string;
  foil: FoilValue;
  language: string;
  condition: ConditionValue;
  quantity: number;
}

export interface IncrementExistingOp {
  kind: "incrementExisting";
  id: string;
  incrementBy: number;
}

export type BulkEditOp = FieldUpdateOp | SurvivorUpdateOp | IncrementExistingOp;

export interface BulkEditPlan {
  /** No collision: just rewrite the changed fields on this row. */
  fieldUpdates: FieldUpdateOp[];
  /** Two+ selected rows collapsed into one survivor within the selection. */
  survivorUpdates: SurvivorUpdateOp[];
  /** Selected row(s) collapsed into a pre-existing (unselected) row. */
  existingIncrements: IncrementExistingOp[];
  /** Ids of selected rows that got merged away and must be deleted. */
  deletedIds: string[];
}

function targetKey(cardId: string, collectionId: string, foil: string, language: string, condition: string): string {
  return [cardId, collectionId, foil, language, condition].join("::");
}

export function planBulkEdit(
  items: BulkItemSnapshot[],
  change: BulkChange,
  existing: ExistingItem[],
): BulkEditPlan {
  const existingByKey = new Map<string, ExistingItem>();
  for (const e of existing) {
    existingByKey.set(targetKey(e.cardId, e.collectionId, e.foil, e.language, e.condition), e);
  }

  const groups = new Map<
    string,
    { collectionId: string; foil: FoilValue; language: string; condition: ConditionValue; members: BulkItemSnapshot[] }
  >();

  for (const it of items) {
    const collectionId = change.collectionId ?? it.collectionId;
    const foil = change.foil ?? it.foil;
    const language = change.language ?? it.language;
    const condition = change.condition ?? it.condition;
    const key = targetKey(it.cardId, collectionId, foil, language, condition);
    const group = groups.get(key);
    if (group) {
      group.members.push(it);
    } else {
      groups.set(key, { collectionId, foil, language, condition, members: [it] });
    }
  }

  const plan: BulkEditPlan = {
    fieldUpdates: [],
    survivorUpdates: [],
    existingIncrements: [],
    deletedIds: [],
  };

  for (const [key, group] of groups) {
    const { collectionId, foil, language, condition, members } = group;
    const existingMatch = existingByKey.get(key);
    const totalQty = members.reduce((s, m) => s + m.quantity, 0);

    if (existingMatch) {
      plan.existingIncrements.push({
        kind: "incrementExisting",
        id: existingMatch.id,
        incrementBy: totalQty,
      });
      plan.deletedIds.push(...members.map((m) => m.id));
      continue;
    }

    if (members.length === 1) {
      plan.fieldUpdates.push({
        kind: "fieldUpdate",
        id: members[0].id,
        collectionId,
        foil,
        language,
        condition,
      });
      continue;
    }

    const [survivor, ...rest] = members;
    plan.survivorUpdates.push({
      kind: "survivorUpdate",
      id: survivor.id,
      collectionId,
      foil,
      language,
      condition,
      quantity: totalQty,
    });
    plan.deletedIds.push(...rest.map((m) => m.id));
  }

  return plan;
}
