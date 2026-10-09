import { expect, test } from "@playwright/test";
import { writeKanji } from "./helpers";

/** NFR-04: after one online visit, the installed app works fully offline. */
test("practice works offline after the first visit", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Second online load goes through the now-active service worker and fills its cache.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.goto("/practice/山");
  await expect(page.getByLabel("Writing area")).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel("Writing area")).toBeVisible();
  await writeKanji(page, "山");
  await page.getByRole("button", { name: /Check/ }).click();
  await expect(page.getByText("Beautiful — no mistakes.")).toBeVisible();

  // A different route, never visited, also loads offline (SPA shell fallback).
  await page.goto("/library");
  await expect(page.getByRole("link", { name: "右" })).toBeVisible();
});

test("manifest is valid for installation", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.display).toBe("standalone");
  expect(m.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
  expect((await request.get("/icon-512.png")).ok()).toBe(true);
});
