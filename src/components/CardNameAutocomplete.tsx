"use client";

import { useEffect, useRef, useState } from "react";
import {
  reduceAutocompleteNav,
  type AutocompleteNavState,
  type AutocompleteNavAction,
} from "@/lib/autocomplete-nav";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 200;
const CLOSED: AutocompleteNavState = { open: false, highlightedIndex: -1 };

type Props = {
  id: string;
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (name: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
};

/**
 * Controlled text input with a debounced name-suggestion dropdown backed by
 * GET /api/autocomplete. Fully keyboard-navigable (↑/↓/Enter/Esc) and
 * exposes combobox/listbox ARIA roles. Renders its own listbox — callers
 * only need to place it and handle `onSelect`.
 */
export function CardNameAutocomplete({
  id,
  name,
  value,
  onValueChange,
  onSelect,
  placeholder,
  className,
  style,
  ...aria
}: Props) {
  const [results, setResults] = useState<string[]>([]);
  const [nav, setNav] = useState<AutocompleteNavState>(CLOSED);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setNav(CLOSED);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function fetchResults(term: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (term.trim().length < MIN_CHARS) {
      setResults([]);
      setNav(CLOSED);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/autocomplete?q=${encodeURIComponent(term.trim())}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          setResults([]);
          setNav(CLOSED);
          return;
        }
        const data: { results: string[] } = await res.json();
        setResults(data.results);
        setNav(data.results.length > 0 ? { open: true, highlightedIndex: -1 } : CLOSED);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setResults([]);
        setNav(CLOSED);
      }
    }, DEBOUNCE_MS);
  }

  function handleChange(next: string) {
    onValueChange(next);
    fetchResults(next);
  }

  function handleSelect(picked: string) {
    onValueChange(picked);
    onSelect(picked);
    setResults([]);
    setNav(CLOSED);
  }

  function dispatch(action: AutocompleteNavAction) {
    setNav((prev) => reduceAutocompleteNav(prev, action, results.length));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (results.length === 0) return;
      e.preventDefault();
      dispatch(e.key);
      return;
    }
    if (e.key === "Enter") {
      if (nav.open && nav.highlightedIndex >= 0) {
        e.preventDefault();
        handleSelect(results[nav.highlightedIndex]);
      }
      return;
    }
    if (e.key === "Escape") {
      if (nav.open) {
        e.preventDefault();
        dispatch("Escape");
      }
    }
  }

  const listboxId = `${id}-listbox`;
  const activeOptionId =
    nav.open && nav.highlightedIndex >= 0 ? `${id}-option-${nav.highlightedIndex}` : undefined;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        className={className}
        style={style}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setNav((prev) => ({ ...prev, open: true }))}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={nav.open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        {...aria}
      />

      {nav.open && results.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Card name suggestions"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
            margin: "4px 0 0",
            padding: 0,
            listStyle: "none",
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            boxShadow: "0 8px 24px oklch(0 0 0 / 0.4)",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {results.map((r, i) => (
            <li
              key={r}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={nav.highlightedIndex === i}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(r);
              }}
              onMouseEnter={() => setNav({ open: true, highlightedIndex: i })}
              style={{
                padding: "7px 10px",
                fontSize: 13,
                color: "var(--ink-1)",
                cursor: "pointer",
                background: nav.highlightedIndex === i ? "var(--bg-2)" : "transparent",
                borderBottom: "1px solid var(--line-soft)",
              }}
            >
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
