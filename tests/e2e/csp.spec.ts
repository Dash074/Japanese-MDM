import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { env } from "../../scripts/db.ts";
import { fresh, writeKanji } from "./helpers";

/**
 * Production headers from vercel.json applied to the production build: the strict CSP must not
 * break any screen, the web fonts, or calls to Supabase.
 */
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const CSP: string = vercel.headers[0].headers.find((h: { key: string }) => h.key === "Content-Security-Policy").value;

test.beforeEach(async ({ page }) => {
  await fresh(page);
  // Add the production CSP to every same-origin document response, as Vercel would.
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (req.resourceType() !== "document" || !req.url().startsWith("http://localhost")) return route.continue();
    const res = await route.fetch();
    await route.fulfill({ response: res, headers: { ...res.headers(), "content-security-policy": CSP } });
  });
});

test("strict CSP: no violations across screens, practice, fonts and Supabase", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && violations.push(m.text()));
  for (const path of ["/", "/review", "/library", "/kanji/右", "/quiz?seed=1", "/progress", "/settings"]) {
    await page.goto(path);
    await expect(page.locator("main")).not.toBeEmpty();
  }
  await page.goto("/practice/山");
  await writeKanji(page, "山");
  await page.getByRole("button", { name: /Check/ }).click();
  await expect(page.getByText("Beautiful — no mistakes.")).toBeVisible();

  // Web fonts loaded under font-src / style-src.
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px "Klee One"', "山"))).toBe(true);

  // Supabase reachable under connect-src (real request from inside the page).
  const status = await page.evaluate(
    async ([url, key]) => (await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })).status,
    [env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY],
  );
  expect(status).toBe(200);
  expect(violations).toEqual([]);
});

test("deep links are rewritten to the app (vercel.json)", async () => {
  const rule = new RegExp(`^${vercel.rewrites[0].source.replace("/(", "/(")}$`);
  for (const p of ["/practice/右", "/kanji/山", "/quiz", "/settings"]) expect(rule.test(p), p).toBe(true);
  for (const p of ["/assets/index-abc.js", "/data/kanji.json", "/sw.js", "/manifest.webmanifest", "/icon-192.png"]) expect(rule.test(p), p).toBe(false);
});
