import es from "./es";
import en from "./en";

export type Locale = "es" | "en";

const DICTIONARIES: Record<Locale, Record<string, string>> = { es, en };

/**
 * Look up a translation key for the given locale.
 * Falls back to Spanish if the locale is unknown.
 * Falls back to the key itself if the key is missing in the dictionary.
 */
export function t(key: string, locale: Locale): string {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES["es"];
  return dict[key] ?? key;
}

/**
 * Client-side hook that reads the locale from the <html data-locale="..."> attribute
 * written by the server layout. Falls back to "es".
 *
 * This file is imported by both server and client modules so we guard the
 * document access at call-time (not module-load-time) to avoid SSR errors.
 */
export function useLocale(): Locale {
  if (typeof document === "undefined") return "es";
  const raw = document.documentElement.dataset.locale;
  return raw === "en" ? "en" : "es";
}
