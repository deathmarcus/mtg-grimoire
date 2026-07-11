"use server";

import { revalidatePath } from "next/cache";
import type { Currency, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import type { Locale } from "@/lib/i18n";
import {
  listPrefsScopeSchema,
  scopedListPrefsSchema,
  type ListPrefsScope,
  type ScopedListPrefs,
} from "@/lib/list-prefs";

export async function setDisplayCurrency(currency: Currency) {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { displayCurrency: currency },
  });
  revalidatePath("/dashboard");
  revalidatePath("/collection");
  revalidatePath("/collection/[itemId]", "page");
}

export async function setLocale(locale: string) {
  // Validate — only accept known locales
  if (locale !== "es" && locale !== "en") return;
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { locale: locale as Locale },
  });
  revalidatePath("/", "layout");
}

export type SetListPrefsResult = { ok: true } | { ok: false; error: string };

/** F5 (#18): persist View/Group/Sort prefs for one scope ("collection" | "deck") into User.listPrefs. */
export async function setListPrefs(
  scope: unknown,
  prefs: unknown,
): Promise<SetListPrefsResult> {
  const parsedScope = listPrefsScopeSchema.safeParse(scope);
  const parsedPrefs = scopedListPrefsSchema.safeParse(prefs);
  if (!parsedScope.success || !parsedPrefs.success) {
    return { ok: false, error: "Invalid list prefs" };
  }

  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { listPrefs: true },
  });
  const current =
    dbUser?.listPrefs && typeof dbUser.listPrefs === "object" && !Array.isArray(dbUser.listPrefs)
      ? (dbUser.listPrefs as unknown as Partial<Record<ListPrefsScope, ScopedListPrefs>>)
      : ({} as Partial<Record<ListPrefsScope, ScopedListPrefs>>);

  const next = { ...current, [parsedScope.data]: parsedPrefs.data };

  await prisma.user.update({
    where: { id: user.id },
    data: { listPrefs: next as Prisma.InputJsonValue },
  });

  // Sin revalidatePath: la vista ya cambió optimista en el cliente y la pref
  // solo importa en el próximo full-load; revalidar aquí refetchea toda la
  // colección en cada clic del toolbar.
  return { ok: true };
}
