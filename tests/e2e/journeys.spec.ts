import { expect, test } from "@playwright/test";
import { draw, fresh, strokesOf, writeKanji } from "./helpers";

/** Key user journeys (implementation.md §7.4). */
test.beforeEach(async ({ page }) => fresh(page));

test("library → 山 → practise correctly → hanko", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("link", { name: "山" }).click();
  await page.getByRole("button", { name: /Practice/ }).click();
  await writeKanji(page, "山");
  await page.getByRole("button", { name: /Check/ }).click();
  await expect(page.getByText("Beautiful — no mistakes.")).toBeVisible();
  await expect(page.getByLabel(/Seal:/)).toBeVisible();
});

test("右 with strokes 1 and 2 swapped → stroke-order error", async ({ page }) => {
  await page.goto("/practice/右");
  const s = strokesOf("右");
  await draw(page, [s[1], s[0], ...s.slice(2)]);
  await page.keyboard.press("Enter");
  await expect(page.getByText("書き順 Stroke order").first()).toBeVisible();
});

test("writing 左 for 右 twice → look-alike + drill recommended on Today", async ({ page }) => {
  test.slow();
  for (let k = 0; k < 2; k++) {
    await page.goto("/practice/右");
    await writeKanji(page, "左");
    await page.getByRole("button", { name: /Check/ }).click();
    await expect(page.getByText("Look-alike!")).toBeVisible();
  }
  await page.goto("/");
  const card = page.getByRole("link", { name: /特訓 右 ⇄ 左/ });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByText(/特訓 Drill · 1 \/ 6/)).toBeVisible();
});

test("review: new kanji intro → write → auto-grade → next", async ({ page }) => {
  await page.goto("/review");
  await expect(page.getByText("新しい漢字")).toBeVisible();
  const first = (await page.locator("text=/1 \\/ 5 · new/").count()) > 0;
  expect(first).toBe(true);
  await page.getByRole("button", { name: /Start writing/ }).click();
  const char = await page.locator(".font-kanji.text-4xl").first().innerText();
  await writeKanji(page, char);
  await page.getByRole("button", { name: /Check/ }).click();
  await expect(page.getByText(/Auto-graded/)).toBeVisible();
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.getByText(/2 \/ 5/)).toBeVisible();
  // The reviewed kanji now has a card → appears in the dashboard forecast.
  await page.goto("/progress");
  await expect(page.getByText("予定 · Reviews in the next 7 days")).toBeVisible();
});

test("settings: export attempts as JSON", async ({ page }) => {
  await page.goto("/practice/一");
  await writeKanji(page, "一");
  await page.getByRole("button", { name: /Check/ }).click();
  await page.goto("/settings");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Export JSON/ }).click()]);
  const body = JSON.parse(await (await download.createReadStream())!.toArray().then((b) => Buffer.concat(b).toString()));
  expect(body.log).toHaveLength(1);
  expect(body.log[0].kanji).toBe("一");
  expect(body.log[0].raw.strokes[0].length).toBeGreaterThan(5); // raw pen data included (FR-14)
  if (process.env.SAVE_EXPORT) await download.saveAs(process.env.SAVE_EXPORT);
});

test("guide-level promotion keeps the result on screen", async ({ page }) => {
  // Two clean attempts at Trace promote 山 to Hint; the second result must stay visible.
  for (let k = 0; k < 2; k++) {
    await page.goto("/practice/山");
    await writeKanji(page, "山");
    await page.getByRole("button", { name: /Check/ }).click();
    await expect(page.getByText("Beautiful — no mistakes.")).toBeVisible();
  }
  await page.waitForTimeout(300);
  await expect(page.getByText("Beautiful — no mistakes.")).toBeVisible();
  await expect(page.getByText(/Guide level up/)).toBeVisible();
});
