import { expect, test } from "@playwright/test";
import { fresh, writeKanji, strokesOf, draw } from "./helpers";

/**
 * Visual smoke test: every screen renders, no horizontal scroll, no console errors.
 * Screenshots go to screenshots/ for manual design review.
 */
const SCREENS = ["/", "/review", "/library", "/kanji/右", "/practice/右", "/quiz?seed=1", "/progress", "/settings"];

test.beforeEach(async ({ page }) => fresh(page));

for (const theme of ["light", "dark"] as const)
  test(`all screens render (${theme})`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.addInitScript((t) => localStorage.setItem("fude-theme", t), theme);
    for (const path of SCREENS) {
      await page.goto(path);
      await expect(page.locator("main")).not.toBeEmpty();
      await page.waitForTimeout(300);
      const text = await page.locator("body").innerText();
      expect(text, `bad text on ${path}`).not.toMatch(/\[object Object\]|\bundefined\b|\bNaN\b/);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal scroll on ${path}`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `screenshots/${info.project.name}-${theme}${path.replace(/[/?=]/g, "_") || "_"}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });

test("result screen with errors", async ({ page }, info) => {
  await page.goto("/practice/右");
  const s = strokesOf("右");
  await draw(page, [s[1], s[0], ...s.slice(2)]);
  await page.getByRole("button", { name: /Check/ }).click();
  await page.screenshot({ path: `screenshots/${info.project.name}-result-errors.png`, fullPage: true });
  await page.goto("/practice/山");
  await writeKanji(page, "山");
  await page.getByRole("button", { name: /Check/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `screenshots/${info.project.name}-result-clean.png`, fullPage: true });
});
