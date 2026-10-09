import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { env, sql } from "../../scripts/db.ts";
import { fresh, writeKanji } from "./helpers";

/**
 * Live two-device sync against the real Supabase project. Opt-in (touches the live DB):
 *   LIVE=1 npx playwright test live-sync --project=desktop
 * Creates a temporary confirmed user, signs two separate browsers in as that user,
 * practises on device A, and checks device B shows the same progress. Deletes the user after.
 */
test.skip(!process.env.LIVE, "set LIVE=1 to run against the live Supabase project");
test.describe.configure({ mode: "serial" });

const ID = "44444444-4444-4444-4444-444444444444";
const EMAIL = "two-devices@fude.test";
const PW = `pw-${Date.now()}`;
const REF = new URL(env.VITE_SUPABASE_URL).hostname.split(".")[0];

test.beforeAll(async () => {
  await sql(`delete from auth.users where id = '${ID}'`);
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
    raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('${ID}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${EMAIL}',
    extensions.crypt('${PW}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')`);
  await sql(`insert into auth.identities (user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values ('${ID}', '${ID}', '{"sub":"${ID}","email":"${EMAIL}","email_verified":true}', 'email', now(), now(), now())`);
});
test.afterAll(async () => {
  await sql(`delete from auth.users where id = '${ID}'`);
});

/** A fresh browser ("device") already signed in as the test user. */
async function device(browser: Browser): Promise<Page> {
  const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.auth.signInWithPassword({ email: EMAIL, password: PW });
  if (error) throw error;
  const context = await browser.newContext();
  const page = await context.newPage();
  await fresh(page);
  await page.addInitScript(([key, session]) => localStorage.setItem(key, session), [`sb-${REF}-auth-token`, JSON.stringify(data.session)]);
  return page;
}

async function syncNow(page: Page) {
  await page.goto("/settings");
  await expect(page.getByText(EMAIL)).toBeVisible();
  await page.getByRole("button", { name: /Sync now/ }).click();
  await expect(page.getByText(/^Synced/)).toBeVisible({ timeout: 15_000 });
}

test("progress made on device A appears on device B", async ({ browser }) => {
  test.slow();
  const a = await device(browser);
  // Device A: two correct 右 (promotes Trace → Hint) and one 右/左 mix-up.
  for (const k of ["右", "右", "左"]) {
    await a.goto("/practice/右");
    await writeKanji(a, k);
    await a.getByRole("button", { name: /Check/ }).click();
    await expect(a.getByText(k === "右" ? "Beautiful — no mistakes." : "Look-alike!")).toBeVisible();
  }
  await syncNow(a);
  const [{ n }] = await sql<{ n: number }>(`select count(*)::int as n from public.attempts where user_id = '${ID}'`);
  expect(n).toBe(3);
  const [{ s }] = await sql<{ s: number }>(`select count(*)::int as s from public.attempts where user_id = '${ID}' and strokes is not null`);
  expect(s).toBe(3); // raw pen data uploaded too

  // Device B: brand-new browser, same account.
  const b = await device(browser);
  await syncNow(b);
  await b.goto("/kanji/右");
  await expect(b.getByText(/3 attempts · 2 clean/)).toBeVisible();
  await b.goto("/");
  await expect(b.getByText("× 1")).toBeVisible(); // 右→左 mix-up visible in "Look-alikes you mix up"
});
