import { expect, test } from "@playwright/test";
import { draw, fresh, strokesOf, writeKanji } from "./helpers";

/** Learning-study control group (implementation.md §7.5): correct/incorrect only, self-graded reviews. */
test.beforeEach(async ({ page }) => fresh(page));

test("?study=control enrols, hides error explanations, logs the group", async ({ page }) => {
  await page.goto("/?study=control");
  await expect(page).toHaveURL(/\/$/); // param consumed
  await page.goto("/practice/右");
  await expect(page.getByText("Live check")).toHaveCount(0);
  const s = strokesOf("右");
  await draw(page, [s[1], s[0], ...s.slice(2)]);
  await page.getByRole("button", { name: /Check/ }).click();
  await expect(page.getByText("Not quite. Compare with the model.")).toBeVisible();
  await expect(page.getByText("書き順 Stroke order")).toHaveCount(0);
  await expect(page.getByText(/Shape match/)).toHaveCount(0);
  const group = await page.evaluate(() => JSON.parse(localStorage.getItem("fude-progress-v1")!).state.log[0].group);
  expect(group).toBe("control");
});

test("control group self-grades reviews; Next waits for a choice", async ({ page }) => {
  await page.goto("/?study=control");
  await page.goto("/review");
  await page.getByRole("button", { name: /Start writing/ }).click();
  const char = await page.locator(".font-kanji.text-4xl").first().innerText();
  await writeKanji(page, char);
  await page.getByRole("button", { name: /Check/ }).click();
  await expect(page.getByText("How well did you remember it?")).toBeVisible();
  await expect(page.getByRole("button", { name: /Next/ })).toBeDisabled();
  await page.getByRole("button", { name: /Good/ }).click();
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.getByText(/2 \/ 5/)).toBeVisible();
});

test("full group (default) still gets explanations", async ({ page }) => {
  await page.goto("/practice/右");
  const s = strokesOf("右");
  await draw(page, [s[1], s[0], ...s.slice(2)]);
  await page.getByRole("button", { name: /Check/ }).click();
  await expect(page.getByText("書き順 Stroke order").first()).toBeVisible();
});
