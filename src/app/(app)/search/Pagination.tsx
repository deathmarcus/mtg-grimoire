"use client";

import Link from "next/link";
import { buildSearchUrl, type SearchFilters } from "@/lib/search-filters";

type Props = {
  filters: SearchFilters;
  totalPages: number;
};

export function Pagination({ filters, totalPages }: Props) {
  if (totalPages <= 1) return null;

  const current = filters.page;
  const hasPrev = current > 1;
  const hasNext = current < totalPages;

  const prevUrl = buildSearchUrl(filters, { page: current - 1 });
  const nextUrl = buildSearchUrl(filters, { page: current + 1 });

  return (
    <nav
      aria-label="Search results pagination"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "24px 0 8px",
      }}
    >
      {hasPrev ? (
        <Link href={prevUrl} className="btn btn-sm" aria-label="Previous page">
          ← Prev
        </Link>
      ) : (
        <span
          className="btn btn-sm"
          aria-disabled="true"
          style={{ opacity: 0.35, cursor: "default", pointerEvents: "none" }}
        >
          ← Prev
        </span>
      )}

      <span
        className="mono"
        style={{ fontSize: 12, color: "var(--ink-2)" }}
        aria-current="page"
        aria-label={`Page ${current} of ${totalPages}`}
      >
        {current} / {totalPages}
      </span>

      {hasNext ? (
        <Link href={nextUrl} className="btn btn-sm" aria-label="Next page">
          Next →
        </Link>
      ) : (
        <span
          className="btn btn-sm"
          aria-disabled="true"
          style={{ opacity: 0.35, cursor: "default", pointerEvents: "none" }}
        >
          Next →
        </span>
      )}
    </nav>
  );
}
