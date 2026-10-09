/**
 * Turn a Settings → Export JSON file into regression fixtures (implementation.md Sprint 3).
 *
 *   npx tsx scripts/import-fixtures.ts fude-export-2026-10-12.json --writer darshan
 *
 * Writes tests/fixtures/<writer>/<kanji>-<id>.json. `expected` is the engine's current verdict
 * (a snapshot: the fixture test fails if a change alters it). `label` starts as null; fill it with
 * what a human says the mistake really was, e.g. { "errors": ["order"] } or { "errors": [] }.
 * `npm run evaluate` reports engine accuracy against these human labels.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "../src/core/analyze.ts";
import type { Device, ErrorType, InputStroke, KanjiData } from "../src/core/types.ts";

export type Fixture = {
  target: string;
  writer: string;
  device: Device;
  size: number;
  strokes: InputStroke[];
  expected: { bestMatch: string; errors: ErrorType[] };
  label: { errors: ErrorType[]; bestMatch?: string; note?: string } | null;
};

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  console.error("usage: tsx scripts/import-fixtures.ts <export.json> --writer <name>");
  process.exit(1);
}
const writer = rest[rest.indexOf("--writer") + 1] ?? "anon";
const data: KanjiData = JSON.parse(readFileSync("public/data/kanji.json", "utf8"));
const exp = JSON.parse(readFileSync(file, "utf8")) as {
  log: { id: string; kanji: string; raw?: { size: number; device: Device; strokes: InputStroke[] } }[];
};

const dir = join("tests/fixtures", writer.replace(/[^\w-]/g, "_"));
mkdirSync(dir, { recursive: true });
let written = 0, skipped = 0;
for (const e of exp.log) {
  if (!e.raw || !data.kanji[e.kanji]) {
    skipped++;
    continue;
  }
  const out = join(dir, `${e.kanji}-${e.id.slice(0, 8)}.json`);
  if (existsSync(out)) {
    skipped++;
    continue;
  }
  const a = analyze(data, { target: e.kanji, ...e.raw });
  const fx: Fixture = {
    target: e.kanji, writer, device: e.raw.device, size: e.raw.size, strokes: e.raw.strokes,
    expected: { bestMatch: a.bestMatch, errors: [...new Set(a.errors.map((x) => x.type))].sort() },
    label: null,
  };
  writeFileSync(out, JSON.stringify(fx));
  written++;
}
console.log(`${written} fixtures written to ${dir} (${skipped} skipped: no raw strokes or already imported)`);
