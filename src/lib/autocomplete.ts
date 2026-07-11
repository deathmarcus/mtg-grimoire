import { Prisma } from "@prisma/client";
import { z } from "zod";

export const MIN_QUERY_LENGTH = 3;
export const MAX_QUERY_LENGTH = 80;
export const AUTOCOMPLETE_LIMIT = 10;

export const autocompleteQuerySchema = z.object({
  q: z.string().trim().min(MIN_QUERY_LENGTH).max(MAX_QUERY_LENGTH),
});

/**
 * Escapes ILIKE wildcard/escape characters (`%`, `_`, `\`) in user input so
 * they're matched literally rather than as pattern metacharacters.
 */
function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Builds the parameterized raw-SQL query used by GET /api/autocomplete.
 *
 * Prioritizes prefix matches (`name ILIKE 'term%'`) over mid-string substring
 * matches by sorting on that boolean expression first, then alphabetically.
 * Wrapped in a subquery because Postgres forbids ORDER BY expressions that
 * aren't in the SELECT list of a bare `SELECT DISTINCT`.
 */
export function buildAutocompleteQuery(
  term: string,
  limit: number = AUTOCOMPLETE_LIMIT
): Prisma.Sql {
  const escaped = escapeLikeTerm(term);
  const containsPattern = `%${escaped}%`;
  const prefixPattern = `${escaped}%`;

  return Prisma.sql`
    SELECT name FROM (
      SELECT DISTINCT name FROM "Card" WHERE name ILIKE ${containsPattern}
    ) t
    ORDER BY (name ILIKE ${prefixPattern}) DESC, name ASC
    LIMIT ${limit}
  `;
}
