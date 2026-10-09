/**
 * Live sync smoke test against the real Supabase project (npm run test:sync).
 * Creates a temporary confirmed user, signs in with the publishable key exactly like the app,
 * pushes an attempt + card through the app's own mapping functions, reads them back, and
 * deletes the user (cascade removes all its rows).
 */
import { createClient } from "@supabase/supabase-js";
import { newCard, review } from "../src/core/scheduler/index.ts";
import type { AttemptLog } from "../src/lib/progress.ts";
import { fromAttemptRow, fromCardRow, toAttemptPayload, toCardRow } from "../src/lib/sync.ts";
import { encode } from "../src/lib/strokeStore.ts";
import { env, sql } from "./db.ts";

const ID = "33333333-3333-3333-3333-333333333333", EMAIL = "sync-smoke@fude.test", PW = `pw-${Date.now()}`;
const cleanup = () => sql(`delete from auth.users where id = '${ID}'`);
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` ${detail}` : ""}`);
  if (!ok) failed++;
};

await cleanup();
await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('${ID}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${EMAIL}',
  extensions.crypt('${PW}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')`);
await sql(`insert into auth.identities (user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  values ('${ID}', '${ID}', '{"sub":"${ID}","email":"${EMAIL}","email_verified":true}', 'email', now(), now(), now())`);

try {
  const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: s, error } = await db.auth.signInWithPassword({ email: EMAIL, password: PW });
  check("sign in with publishable key", !error, error?.message);
  if (error) throw error;

  const attempt: AttemptLog = { id: "smoke-1", kanji: "右", at: Date.UTC(2026, 9, 10, 9), errors: ["order"], bestMatch: "右",
    mode: "review", level: "blank", device: "pen", score: 0.913, strokes: 5, ms: 4200, hesitationMs: 300, auto: 2, grade: 3, group: "control" };
  const raw = encode({ size: 400, device: "pen", strokes: [[{ x: 10, y: 20, t: 5, p: 0.5 }, { x: 30, y: 40, t: 21, p: 0.8 }]] });
  const r1 = await db.rpc("record_attempts", { batch: [toAttemptPayload(attempt, raw)] });
  check("record_attempts inserts 1", r1.data === 1, r1.error?.message);
  const r1b = await db.rpc("record_attempts", { batch: [toAttemptPayload(attempt)] });
  check("re-sent attempt is ignored", r1b.data === 0, r1b.error?.message);

  const card = review(review(newCard(Date.UTC(2026, 9, 1)), 3, Date.UTC(2026, 9, 1)), 3, Date.UTC(2026, 9, 4));
  const r2 = await db.from("cards").upsert([toCardRow(s.user.id, "右", card, "blank")]);
  check("cards upsert", !r2.error, r2.error?.message);

  const a = await db.from("attempts").select("*");
  const gotA = fromAttemptRow(a.data![0]) as Record<string, unknown>, wantA = { ...attempt, synced: true } as Record<string, unknown>;
  const diff = Object.keys(wantA).filter((k) => JSON.stringify(gotA[k]) !== JSON.stringify(wantA[k])).map((k) => `${k}: sent ${JSON.stringify(wantA[k])} got ${JSON.stringify(gotA[k])}`);
  check("attempt round-trips exactly", diff.length === 0, diff.join("; "));
  const c = await db.from("cards").select("*").eq("kanji", "右").single();
  const back = fromCardRow(c.data);
  check("card round-trips exactly", JSON.stringify(back) === JSON.stringify(card), JSON.stringify({ sent: card.stability, got: back.stability }));
  const e = await db.from("error_stats").select("error_type,count");
  const deepEq = (x: unknown, y: unknown): boolean =>
    typeof x !== "object" || x === null || typeof y !== "object" || y === null
      ? x === y
      : Object.keys(x).length === Object.keys(y).length && Object.keys(x).every((k) => deepEq((x as never)[k], (y as never)[k]));
  check("raw strokes stored", deepEq(a.data![0].strokes, raw), deepEq(a.data![0].strokes, raw) ? "" : `${JSON.stringify(raw)} vs ${JSON.stringify(a.data![0].strokes)}`);
  check("error_stats updated", e.data?.[0]?.error_type === "order" && e.data?.[0]?.count === 1);
} finally {
  await cleanup();
  const [{ n }] = await sql<{ n: number }>(`select count(*)::int as n from public.attempts where user_id = '${ID}'`);
  check("cleanup removed test data", n === 0);
}
process.exit(failed ? 1 : 0);
