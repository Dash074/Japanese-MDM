import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "../analyze";
import type { Device, ErrorType, InputStroke } from "../types";
import { DATA } from "./load-data";

/**
 * Real-handwriting regression fixtures (tests/fixtures/<writer>/*.json, made by
 * scripts/import-fixtures.ts). Fails if an engine change alters a recorded verdict;
 * if the change is intended, re-import or update `expected`.
 */
type Fixture = {
  target: string; device: Device; size: number; strokes: InputStroke[];
  expected: { bestMatch: string; errors: ErrorType[] };
};

const ROOT = "tests/fixtures";
const files = existsSync(ROOT)
  ? readdirSync(ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .flatMap((d) => readdirSync(join(ROOT, d.name)).filter((f) => f.endsWith(".json")).map((f) => join(ROOT, d.name, f)))
  : [];

describe.skipIf(files.length === 0)("real handwriting fixtures", () => {
  it.each(files)("%s", (file) => {
    const fx: Fixture = JSON.parse(readFileSync(file, "utf8"));
    const a = analyze(DATA, { target: fx.target, strokes: fx.strokes, device: fx.device, size: fx.size });
    expect({ bestMatch: a.bestMatch, errors: [...new Set(a.errors.map((e) => e.type))].sort() }).toEqual(fx.expected);
  });
});
