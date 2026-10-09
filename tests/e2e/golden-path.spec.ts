import { expect, test, type Page } from "@playwright/test";
import { draw, fresh, strokesOf, writeKanji } from "./helpers";

/**
 * Release check: a brand-new learner's complete first session on the PRODUCTION build,
 * in one continuous browser session (no state injected).
 */
test.beforeEach(async ({ page }) => fresh(page));

async function currentKanji(page: Page) {
  return (await page.locator(".font-kanji.text-4xl").first().innerText()).trim();
}

test("new learner: review session → mix-up → recommended drill → quiz → progress → export → offline", async ({ page, context }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. Today: a new learner is offered 5 new kanji.
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Review.*5 new/ })).toBeVisible();
  await page.getByRole("button", { name: /Review.*5 new/ }).click();

  // 2. Review session: intro → write → auto-grade → next, for all 5 new kanji.
  for (let k = 1; k <= 5; k++) {
    await expect(page.getByText(new RegExp(`${k} / 5 · new`))).toBeVisible();
    await page.getByRole("button", { name: /Start writing/ }).click();
    await writeKanji(page, await currentKanji(page));
    await page.getByRole("button", { name: /Check/ }).click();
    await expect(page.getByText(/Auto-graded/)).toBeVisible();
    await page.getByRole("button", { name: /Next/ }).click();
  }
  await expect(page.getByText("お疲れ様でした")).toBeVisible();

  // 3. Practise 右 but write 左, twice: a look-alike mix-up.
  for (let k = 0; k < 2; k++) {
    await page.goto("/practice/右");
    await writeKanji(page, "左");
    await page.getByRole("button", { name: /Check/ }).click();
    await expect(page.getByText("Look-alike!")).toBeVisible();
  }

  // 4. Today now recommends the 右 ⇄ 左 drill; do the whole drill.
  await page.goto("/");
  await page.getByRole("link", { name: /特訓 右 ⇄ 左/ }).click();
  for (let k = 1; k <= 6; k++) {
    await expect(page.getByText(new RegExp(`特訓 Drill · ${k} / 6`))).toBeVisible();
    // Recall prompt hides the kanji; the drill alternates 右 / 左.
    await writeKanji(page, k % 2 ? "右" : "左");
    await page.getByRole("button", { name: /Check/ }).click();
    await expect(page.getByText("Beautiful — no mistakes.")).toBeVisible();
    await page.getByRole("button", { name: /Next/ }).click();
  }
  await expect(page.getByText("特訓完了")).toBeVisible();
  await expect(page.getByText("6 of 6 written without mistakes.")).toBeVisible();

  // 5. A stroke-order mistake is explained.
  await page.goto("/practice/右");
  const s = strokesOf("右");
  await draw(page, [s[1], s[0], ...s.slice(2)]);
  await page.getByRole("button", { name: /Check/ }).click();
  await expect(page.getByText("書き順 Stroke order").first()).toBeVisible();

  // 6. Quiz to the end.
  await page.goto("/quiz?seed=7");
  for (let k = 0; k < 10; k++) {
    await expect(page.getByText(new RegExp(`小テスト Quiz · ${k + 1} / 10`))).toBeVisible();
    await page.keyboard.press("1");
    await expect(page.getByRole("status")).toBeVisible();
    await page.keyboard.press("Enter");
  }
  await expect(page.getByText("小テスト完了")).toBeVisible();

  // 7. Progress reflects the session.
  await page.goto("/progress");
  await expect(page.getByText("誤りの種類 · Mistakes by type")).toBeVisible();
  await expect(page.getByRole("link", { name: /Start a drill for this pair|右.*左/ }).first()).toBeVisible();

  // 8. Export contains every written attempt with raw pen data.
  await page.goto("/settings");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Export JSON/ }).click()]);
  const body = JSON.parse(Buffer.concat(await (await download.createReadStream()).toArray()).toString());
  expect(body.log).toHaveLength(5 + 2 + 6 + 1);
  expect(body.log.every((e: { raw?: { strokes: unknown[] } }) => e.raw && e.raw.strokes.length > 0)).toBe(true);

  // 9. Offline: the app keeps working and remembers everything.
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker?.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto("/library");
  await expect(page.getByText(/learning/)).toBeVisible();
  await page.goto("/practice/山");
  await writeKanji(page, "山");
  await page.getByRole("button", { name: /Check/ }).click();
  await expect(page.getByText("Beautiful — no mistakes.")).toBeVisible();
  await context.setOffline(false);

  expect(errors).toEqual([]);
});
