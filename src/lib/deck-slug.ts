// Public deck sharing — slug generation and share-window helpers (F8 / #21).

import { randomBytes } from "node:crypto";

/** Charset a public slug is allowed to contain — validated before any DB query. */
export const SLUG_CHARSET_RE = /^[a-z0-9-]+$/;

const MAX_SLUG_BASE_LENGTH = 40;
const SUFFIX_LENGTH = 5;
const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

// Short, adjustable deny-list of common ES/EN slurs and obscenities. If a
// deck name's slugified form contains one of these as a whole segment, the
// generated slug drops the name entirely and uses only the random suffix.
// Extend this list as needed — it intentionally stays short and coarse.
const FORBIDDEN_WORDS = [
  "puta",
  "puto",
  "pendejo",
  "mierda",
  "cabron",
  "chinga",
  "verga",
  "nazi",
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "whore",
];

/**
 * Lowercase, strip diacritics, collapse anything outside [a-z0-9] into single
 * hyphens, trim, and cap length. Returns "" when nothing sluggable remains
 * (e.g. a name made only of emoji/CJK).
 */
export function slugify(input: string): string {
  const normalized = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase();

  const collapsed = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (collapsed.length <= MAX_SLUG_BASE_LENGTH) return collapsed;
  return collapsed.slice(0, MAX_SLUG_BASE_LENGTH).replace(/-+$/g, "");
}

/** Whether the slugified base contains a forbidden word as a hyphen-delimited segment. */
export function containsForbiddenWord(slugBase: string): boolean {
  const segments = slugBase.split("-");
  return segments.some((seg) => FORBIDDEN_WORDS.includes(seg));
}

/** Short random alnum suffix, e.g. "x7k2m". Not cryptographically sensitive —
 *  it only needs to make collisions unlikely, not be unguessable. */
export function randomSlugSuffix(length: number = SUFFIX_LENGTH): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SUFFIX_ALPHABET[bytes[i] % SUFFIX_ALPHABET.length];
  }
  return out;
}

/**
 * Build a public deck slug from a deck name: slugify(name) + "-" + random
 * suffix, e.g. "mono-red-burn-x7k2m". If the name has no usable characters
 * or slugifies down to a forbidden word, the slug is just the suffix.
 */
export function generateDeckSlug(
  name: string,
  opts?: { suffix?: () => string }
): string {
  const suffixFn = opts?.suffix ?? randomSlugSuffix;
  const base = slugify(name);
  const suffix = suffixFn();
  if (!base || containsForbiddenWord(base)) return suffix;
  return `${base}-${suffix}`;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A public deck stays noindex until it has been public for at least 7 days
 * (gives the owner a grace period to reconsider/take it down before search
 * engines pick it up). `publicSince` is set once, on first activation, and
 * never reset by later toggles — so this window only ever runs once.
 */
export function shouldIndex(publicSince: Date | null, now: Date): boolean {
  if (!publicSince) return false;
  return now.getTime() - publicSince.getTime() >= SEVEN_DAYS_MS;
}
