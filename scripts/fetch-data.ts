/**
 * Downloads raw source data into data/raw (git-ignored):
 *  - KANJIDIC2 (EDRDG, CC BY-SA 4.0)
 *  - KanjiVG SVGs (Ulrich Apel, CC BY-SA 3.0) for every in-scope kanji + distractor
 * Then freezes data/n5-list.json from KANJIDIC2's old-JLPT level 4 (≈ N5).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";
import { DISTRACTORS } from "./confusables.seed.ts";

const RAW = "data/raw";
const VG_DIR = join(RAW, "kanjivg");
const KANJIDIC_URL = "http://www.edrdg.org/kanjidic/kanjidic2.xml.gz";
const KANJIVG_URL = (hex: string) =>
  `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${hex}.svg`;

export const kanjiHex = (c: string) => c.codePointAt(0)!.toString(16).padStart(5, "0");

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  mkdirSync(VG_DIR, { recursive: true });

  const dicPath = join(RAW, "kanjidic2.xml");
  if (!existsSync(dicPath)) {
    console.log("Downloading KANJIDIC2…");
    writeFileSync(dicPath, gunzipSync(await download(KANJIDIC_URL)));
  }

  if (!existsSync("data/n5-list.json")) {
    const parser = new XMLParser({ ignoreAttributes: true, processEntities: false });
    const doc = parser.parse(readFileSync(dicPath, "utf8"));
    const n5 = (doc.kanjidic2.character as { literal: string; misc?: { jlpt?: number; freq?: number } }[])
      .filter((c) => c.misc?.jlpt === 4)
      .sort((a, b) => (a.misc?.freq ?? 9999) - (b.misc?.freq ?? 9999))
      .map((c) => c.literal);
    writeFileSync("data/n5-list.json", JSON.stringify(n5, null, 0) + "\n");
    console.log(`Froze data/n5-list.json with ${n5.length} kanji`);
  }

  const n5: string[] = JSON.parse(readFileSync("data/n5-list.json", "utf8"));
  const all = [...new Set([...n5, ...DISTRACTORS])];
  for (const c of all) {
    const out = join(VG_DIR, `${kanjiHex(c)}.svg`);
    if (existsSync(out)) continue;
    writeFileSync(out, await download(KANJIVG_URL(kanjiHex(c))));
    process.stdout.write(c);
  }
  console.log(`\nKanjiVG: ${all.length} files ready`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
