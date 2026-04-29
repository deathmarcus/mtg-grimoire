"use server";

import { revalidatePath } from "next/cache";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import type { Locale } from "@/lib/i18n";

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
