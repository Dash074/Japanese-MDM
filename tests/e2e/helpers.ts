import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

type Data = { kanji: Record<string, { strokes: { points: [number, number][] }[] }> };
const DATA: Data = JSON.parse(readFileSync("public/data/kanji.json", "utf8"));

/** Reference strokes of a kanji in 0–1 cell coordinates. */
export const strokesOf = (char: string) => DATA.kanji[char].strokes.map((s) => s.points);

/** Draw strokes (0–1 cell coords) on the writing canvas with the mouse, like a learner would. */
export async function draw(page: Page, strokes: [number, number][][]) {
  const canvas = page.getByLabel("Writing area");
  const box = (await canvas.boundingBox())!;
  for (const s of strokes) {
    const at = ([x, y]: [number, number]) => [box.x + x * box.width, box.y + y * box.height] as const;
    await page.mouse.move(...at(s[0]));
    await page.mouse.down();
    for (const p of s.slice(1)) await page.mouse.move(...at(p), { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(60);
  }
}

export async function writeKanji(page: Page, char: string) {
  await draw(page, strokesOf(char));
}

/** Start each test from a clean slate (no saved progress). */
export async function fresh(page: Page) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("__e2e")) {
      localStorage.clear();
      sessionStorage.setItem("__e2e", "1");
    }
  });
}
