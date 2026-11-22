import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DISCLAIMER } from "@/lib/copy";

const SRC = path.resolve(__dirname, "..", "src");

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(tsx?|css)$/.test(name) ? [p] : [];
  });
}

describe("copy rules", () => {
  it("uses the exact disclaimer line", () => {
    expect(DISCLAIMER).toBe(
      "A novelty registry for fun and affection. Titles have no legal or official status.",
    );
  });

  it("renders the disclaimer in the root layout so every page carries it", () => {
    const layout = readFileSync(path.join(SRC, "app", "layout.tsx"), "utf8");
    expect(layout).toContain("{DISCLAIMER}");
  });

  it("never uses official, legal, certified or accredited outside the disclaimer", () => {
    const banned = /\b(official|legal|certified|accredited)\b/i;
    const offenders: string[] = [];
    const files = [...sourceFiles(path.join(SRC, "app")), ...sourceFiles(path.join(SRC, "components"))];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8").split(DISCLAIMER).join("");
      if (banned.test(text)) offenders.push(path.relative(SRC, file));
    }
    expect(offenders).toEqual([]);
  });
});
