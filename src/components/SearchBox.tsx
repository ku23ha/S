"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CheckResult } from "@/lib/check";
import { TITLE_MAX_LENGTH, TITLE_PREFIX } from "@/lib/titles";
import { ResultCard, type SearchState } from "@/components/ResultCard";

const DEBOUNCE_MS = 250;

export function SearchBox({
  autoFocus = false,
  label = "Search a title",
  refSlug,
  initialValue = "",
}: {
  autoFocus?: boolean;
  label?: string;
  /** Slug of the certificate this search box sits on, for loop attribution. */
  refSlug?: string;
  initialValue?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);
  const [state, setState] = useState<SearchState>({ kind: "empty" });

  useEffect(() => {
    const q = value.trim();
    if (q === "") return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState({ kind: "checking" });
      try {
        const res = await fetch(`/api/titles/check?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const body: unknown = await res.json();
        if (!res.ok) {
          const message =
            typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
              ? body.error
              : "Try again in a moment.";
          setState({ kind: "error", message });
          return;
        }
        setState({ kind: "result", result: body as CheckResult });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({ kind: "error", message: "Try again in a moment." });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const focusAtEnd = (text: string) => {
    setValue(text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(text.length, text.length);
    });
  };

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="flex items-center rounded-xl border-2 border-neutral-900 bg-white focus-within:ring-4 focus-within:ring-amber-300 dark:border-neutral-200 dark:bg-neutral-950">
        <span className="shrink-0 select-none pl-3 text-base font-semibold sm:text-lg" aria-hidden="true">
          {TITLE_PREFIX}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="search"
          autoFocus={autoFocus}
          maxLength={TITLE_MAX_LENGTH + 20}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Dad"
          aria-describedby={`${id}-hint`}
          className="min-w-0 flex-1 bg-transparent px-2 py-3 text-base outline-none placeholder:text-neutral-400 sm:text-lg"
        />
      </div>
      <p id={`${id}-hint`} className="sr-only">
        Type the rest of the title after {TITLE_PREFIX}. Results update as you type.
      </p>
      <ResultCard state={value.trim() === "" ? { kind: "empty" } : state} refSlug={refSlug} onPick={focusAtEnd} onPlace={focusAtEnd} />
    </div>
  );
}
