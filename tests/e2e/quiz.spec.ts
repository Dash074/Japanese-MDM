import { expect, test } from "@playwright/test";
import { fresh } from "./helpers";

/** Objective 7: confusion-aware quiz. */
test.beforeEach(async ({ page }) => fresh(page));

test("quiz: answer by keyboard, see feedback, finish with a score", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /小テスト quiz/ }).click();
  await expect(page.getByText(/小テスト Quiz · 1 \/ 10/)).toBeVisible();
  for (let k = 0; k < 10; k++) {
    await page.keyboard.press("1");
    await expect(page.getByText(/正解 Correct\.|惜しい Not quite\./)).toBeVisible();
    await page.keyboard.press("Enter");
  }
  await expect(page.getByText("小テスト完了")).toBeVisible();
  await expect(page.getByRole("button", { name: /New quiz/ })).toBeVisible();
});

test("quiz: choosing a wrong look-alike kanji is added to the confusion graph", async ({ page }) => {
  await page.goto("/quiz?seed=1");
  const answers = page.getByRole("group", { name: "Answers" }).getByRole("button");
  for (let k = 0; k < 10; k++) {
    const kind = await page.getByText(/小テスト Quiz · \d+ \/ 10/).innerText();
    if (/Reading/.test(kind)) {
      await answers.nth(0).click();
    } else {
      // Kanji options: pick the first one that turns out wrong, i.e. not highlighted as the answer.
      await answers.nth(0).click();
      // Wait for the feedback to render before reading it (avoids a race).
      const feedback = await page.getByRole("status").innerText();
      if (feedback.includes("惜しい Not quite.")) {
        const picked = (await answers.nth(0).innerText()).split("\n").pop()!.trim();
        const confusions = await page.evaluate(() => JSON.parse(localStorage.getItem("fude-progress-v1")!).state.confusions);
        expect(Object.keys(confusions).some((key) => key.endsWith(`→${picked}`))).toBe(true);
        return;
      }
    }
    await page.getByRole("button", { name: /Next/ }).click();
  }
  throw new Error("seed 1 produced no wrong kanji pick; choose another seed");
});
