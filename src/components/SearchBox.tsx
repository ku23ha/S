"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SearchSource } from "@/lib/analytics";
import { track } from "@/lib/analytics-client";
import type { CheckResult } from "@/lib/check";
import { TITLE_MAX_LENGTH, TITLE_PREFIX, type Tier } from "@/lib/titles";
import { ResultCard, type SearchState } from "@/components/ResultCard";

const DEBOUNCE_MS = 250;

export function SearchBox({
  autoFocus = false,
  label = "Search a title",
  refSlug,
  initialValue = "",
  source,
}: {
  source: SearchSource;
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

  // Focus without scrolling, so a certificate above the box stays in view.
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

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
        const result = body as CheckResult;
        setState({ kind: "result", result });
        track("title_searched", {
          result: result.status === "not_allowed" ? "blocked" : result.status,
          tier: result.status === "not_allowed" ? null : result.title.tier,
          source,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({ kind: "error", message: "Try again in a moment." });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, source]);

  const focusAtEnd = (text: string, tier: Tier | null = null) => {
    track("variant_clicked", { tier });
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
      <div className="flex items-center rounded-2xl border-2 border-ink bg-white shadow-[0_6px_24px_-12px_rgba(28,25,23,0.35)] focus-within:ring-4 focus-within:ring-gold-soft">
        <span className="shrink-0 select-none pl-4 font-display text-base font-semibold text-gold-deep sm:text-lg" aria-hidden="true">
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
          maxLength={TITLE_MAX_LENGTH + 20}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Dad"
          aria-describedby={`${id}-hint`}
          className="min-w-0 flex-1 bg-transparent px-2 py-4 text-base outline-none placeholder:text-neutral-400 sm:text-lg"
        />
      </div>
      <p id={`${id}-hint`} className="sr-only">
        Type the rest of the title after {TITLE_PREFIX}. Results update as you type.
      </p>
      <ResultCard state={value.trim() === "" ? { kind: "empty" } : state} refSlug={refSlug} onPick={focusAtEnd} onPlace={focusAtEnd} />
    </div>
  );
}
