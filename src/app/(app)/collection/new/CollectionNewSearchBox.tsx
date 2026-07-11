"use client";

import { useRef, useState } from "react";
import { CardNameAutocomplete } from "@/components/CardNameAutocomplete";
import { IconSearch } from "@/components/Icons";

type Props = { defaultValue: string };

/**
 * Catalog-search box on /collection/new, with name autocomplete. Renders its
 * own GET form (submits to the current page, matching the server-rendered
 * `q` search param page.tsx already reads) so picking a suggestion reuses
 * the existing server-side printings search instead of duplicating it
 * client-side.
 */
export function CollectionNewSearchBox({ defaultValue }: Props) {
  const [q, setQ] = useState(defaultValue);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      method="GET"
      className="panel"
      style={{ overflow: "hidden" }}
    >
      <div className="panel-head" style={{ gap: 8 }}>
        <IconSearch size={14} className="icon" />
        <CardNameAutocomplete
          id="collection-new-q"
          name="q"
          value={q}
          onValueChange={setQ}
          onSelect={(picked) => {
            setQ(picked);
            formRef.current?.requestSubmit();
          }}
          placeholder="Search the Scryfall catalog…"
          className="grimoire-input"
          style={{ flex: 1 }}
          aria-label="Search the card catalog by name"
        />
        <button type="submit" className="btn btn-sm">
          Search
        </button>
      </div>
    </form>
  );
}
