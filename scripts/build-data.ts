/**
 * Builds public/data/kanji.json from data/raw (run `npm run data:fetch` first).
 * Contains taught N5 kanji, distractors, and a look-alike (confusables) map.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";
import { svgPathProperties } from "svg-path-properties";
import { resample } from "../src/core/geometry/index.ts";
import { CONFIG } from "../src/core/config.ts";
import type { Ending, KanjiData, KanjiEntry, Path, RefStroke } from "../src/core/types.ts";
import { SEED_SETS } from "./confusables.seed.ts";

const VG_BOX = 109;
const round = (n: number) => Math.round(n * 1000) / 1000;
const hex = (c: string) => c.codePointAt(0)!.toString(16).padStart(5, "0");

/** Map a KanjiVG stroke type to the expected stroke ending; null = don't check. */
export function endingFor(type: string): Ending {
  const base = type.replace(/[ab]$/, "");
  if (type !== base && !type.endsWith("b")) return null; // "a" variants are ambiguous
  if (["㇒", "㇏", "㇓", "㇀"].includes(base)) return "harai";
  if (["㇚", "㇁", "㇟", "㇆", "㇂", "㇉", "㇈", "㇌", "㇙", "㇖", "㇠", "㇡", "㇢"].includes(base)) return "hane";
  if (["㇐", "㇑", "㇔"].includes(base)) return "tome";
  return null;
}

function parseSvg(svg: string): { strokes: RefStroke[]; components: string[] } {
  const strokes: RefStroke[] = [];
  for (const m of svg.matchAll(/<path[^>]*?kvg:type="([^"]*)"[^>]*?\sd="([^"]+)"/g)) {
    const [, type, d] = m;
    const props = new svgPathProperties(d);
    const len = props.getTotalLength();
    const dense: Path = [];
    for (let i = 0; i <= 64; i++) {
      const p = props.getPointAtLength((len * i) / 64);
      dense.push([p.x / VG_BOX, p.y / VG_BOX]);
    }
    const points = resample(dense, CONFIG.resampleN).map(([x, y]) => [round(x), round(y)] as [number, number]);
    strokes.push({ d, points, type, ending: endingFor(type) });
  }
  const components = [
    ...new Set(
      [...svg.matchAll(/<g id="kvg:[0-9a-f]+-g\d+"[^>]*?kvg:element="([^"]+)"/g)].map((m) => m[1]),
    ),
  ];
  return { strokes, components };
}

type DicChar = {
  literal: string;
  misc?: { grade?: { "#text": string } };
  reading_meaning?: {
    rmgroup?: {
      reading?: Rec | Rec[];
      meaning?: (string | Rec) | (string | Rec)[];
    };
  };
};
type Rec = { "#text": string; "@_r_type"?: string; "@_m_lang"?: string };
const arr = <T>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

function loadDictionary(chars: Set<string>): Map<string, DicChar> {
  const parser = new XMLParser({ ignoreAttributes: false, processEntities: false, alwaysCreateTextNode: true });
  const doc = parser.parse(readFileSync("data/raw/kanjidic2.xml", "utf8"));
  const out = new Map<string, DicChar>();
  for (const c of doc.kanjidic2.character as { literal: { "#text": string } }[]) {
    const lit = c.literal["#text"];
    if (chars.has(lit)) out.set(lit, { ...(c as unknown as DicChar), literal: lit });
  }
  return out;
}

/** Levenshtein distance over stroke-type sequences. */
function editDistance(a: string[], b: string[]): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

function similarity(a: KanjiEntry, b: KanjiEntry): number {
  const ca = new Set(a.components), cb = new Set(b.components);
  const inter = [...ca].filter((x) => cb.has(x) || x === b.char).length + (cb.has(a.char) ? 1 : 0);
  const union = new Set([...ca, ...cb]).size || 1;
  const comp = Math.min(1, inter / union);
  const ta = a.strokes.map((s) => s.type[0]), tb = b.strokes.map((s) => s.type[0]);
  const edit = 1 - editDistance(ta, tb) / Math.max(ta.length, tb.length);
  const count = 1 - Math.abs(ta.length - tb.length) / Math.max(ta.length, tb.length);
  return 0.5 * comp + 0.3 * edit + 0.2 * count;
}

function main() {
  const scope: string[] = JSON.parse(readFileSync("data/n5-list.json", "utf8"));
  const scopeSet = new Set(scope);
  const all = [...new Set([...scope, ...SEED_SETS.flat()])];
  const dic = loadDictionary(new Set(all));

  const kanji: Record<string, KanjiEntry> = {};
  for (const c of all) {
    const svg = readFileSync(join("data/raw/kanjivg", `${hex(c)}.svg`), "utf8");
    const { strokes, components } = parseSvg(svg);
    const d = dic.get(c);
    const rm = d?.reading_meaning?.rmgroup;
    const readings = arr(rm?.reading);
    kanji[c] = {
      char: c,
      taught: scopeSet.has(c),
      strokes,
      components,
      meanings: arr(rm?.meaning)
        .filter((m): m is Rec => typeof m === "object" && !m["@_m_lang"])
        .map((m) => m["#text"]),
      onyomi: readings.filter((r) => r["@_r_type"] === "ja_on").map((r) => r["#text"]),
      kunyomi: readings.filter((r) => r["@_r_type"] === "ja_kun").map((r) => r["#text"]),
      grade: d?.misc?.grade ? Number(d.misc.grade["#text"]) : undefined,
    };
  }

  // Curated example words (data/examples.json): every taught kanji must have ≥1 and each word must contain it.
  const examples: Record<string, [string, string, string][]> = JSON.parse(readFileSync("data/examples.json", "utf8"));
  for (const c of scope) {
    const ex = examples[c];
    if (!ex?.length) throw new Error(`data/examples.json: no examples for ${c}`);
    for (const [w] of ex) if (!w.includes(c)) throw new Error(`data/examples.json: ${w} does not contain ${c}`);
    kanji[c].examples = ex.map(([word, reading, meaning]) => ({ word, reading, meaning }));
  }

  const confusables: Record<string, string[]> = {};
  for (const c of scope) {
    const seeded = SEED_SETS.filter((s) => s.includes(c)).flat().filter((x) => x !== c);
    const computed = all
      .filter((x) => x !== c && !seeded.includes(x))
      .map((x) => ({ x, s: similarity(kanji[c], kanji[x]) }))
      .filter((r) => r.s >= 0.55)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.x);
    confusables[c] = [...new Set([...seeded, ...computed])].slice(0, 8);
  }

  const data: KanjiData = { scope, kanji, confusables };
  mkdirSync("public/data", { recursive: true });
  writeFileSync("public/data/kanji.json", JSON.stringify(data));
  const taught = Object.values(kanji).filter((k) => k.taught).length;
  console.log(`kanji.json: ${taught} taught, ${all.length - taught} distractors`);
  for (const c of ["右", "木", "人", "日"]) console.log(`  ${c} → ${confusables[c].join(" ")}`);
}

main();
