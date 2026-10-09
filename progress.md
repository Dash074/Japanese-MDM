# Progress Log — 筆 Fude

Running record of what is done, in progress, and next. Plan: [implementation.md](implementation.md).
Legend: ✅ done · 🔄 in progress · ⏳ not started · ⚠️ blocked / needs input

_Last updated: 2026-10-10_

## Summary

| Sprint | Scope | Status |
|---|---|---|
| 0 | Setup: scaffold, CI, templates, ADRs | ✅ (first commit ⏳) |
| 1 | Data pipeline + ink canvas | ✅ (incl. example words) |
| 2 | Matcher core | ✅ |
| 3 | Synthetic evaluation | ✅ · fixture pipeline ready, waiting on real handwriting ⚠️ |
| 4 | Practice MVP | ✅ |
| 5 | Backend: Supabase auth + sync | ✅ live: 6 migrations, RLS 13/13, sync smoke test 9/9 |
| 6 | FSRS + recommendations + drills | ✅ |
| 7 | Dashboard + polish + quizzes | ✅ WCAG 2.1 AA audit passing; confusion-aware quizzes (LLM extras ⏳) |
| 8 | Testing, UAT, release | ✅ release-ready (`release/v1.0`, tag `v1.0.0-rc.1`) · deploy, device matrix, UAT need accounts/devices ⚠️ |

## Key numbers
- **Scope:** 103 N5 kanji (KANJIDIC2 old-JLPT level 4) + 26 non-N5 look-alike distractors
- **Tests:** 176 unit/integration (Vitest) + 24 E2E (Playwright: journeys, screens, axe accessibility, study mode, offline) + 1 opt-in live two-device E2E (`LIVE=1`) + 9 live sync checks (`npm run test:sync`) + 13 live RLS checks (`supabase/tests/rls.sql`)
- **Error detection (held-out synthetic, 7,680 attempts):** F1 order 0.996 · direction 0.998 · count 0.978 · proportion 0.980 · position 0.968 · look-alike 0.937 · 0% false positives on clean attempts
- **Robustness:** macro F1 ≥ 0.968 with 0% false alarms up to 3× normal handwriting noise (±45% scale, ±15° tilt)
- **Analysis speed:** p95 ≈ 4.6 ms per attempt
- **Bundle:** ~82 KB gzipped JS

## ⚠️ Needs input from the team
1. **Revoke or rotate the Supabase access token** (`SUPABASE_ACCESS_TOKEN` in `.env`) when you no longer need me to run migrations. It controls every project in the account. It is git-ignored and verified absent from the build.
2. **Real handwriting:** 30+ attempts each on a tablet → Settings → Export JSON → `npx tsx scripts/import-fixtures.ts <file> --writer <name>`, then fill in each fixture's `label` (what the mistake really was). `npm run evaluate` then reports real-data accuracy.
3. **Git:** the go-ahead for the first commit and a GitHub remote (CI runs once pushed).
4. **Hosting:** a Vercel account for preview and production deploys.

---

## Sprint 0 — Setup ✅
- ✅ Vite + React 18 + TypeScript (strict) + Tailwind; ESLint; Vitest; Playwright
- ✅ Folder structure per implementation.md §4.3
- ✅ GitHub Actions CI: lint → typecheck → unit tests → build, then E2E with screenshot artifacts
- ✅ PR template, user-story and bug issue templates
- ✅ ADR-001 (deterministic matching), ADR-002 (client-side analysis), ADR-003 (N5 scope)
- ✅ Git history: root commit on `main`; 12 conventional commits on `develop` (data, core, tests, UI, app, sync, PWA, E2E, docs); feature branches merged with `--no-ff`. History scanned: no secrets. A fresh clone installs, tests and builds
- ⏳ GitHub remote (push), then PR `develop` → `main`
- ⏳ Vercel project

## Sprint 1 — Data + canvas ✅
- ✅ `npm run data:fetch`: downloads KANJIDIC2 + KanjiVG, freezes `data/n5-list.json`
- ✅ `npm run data:build` → `public/data/kanji.json`
- ✅ Look-alike sets: curated seeds + computed similarity
- ✅ `InkCanvas`: Pointer Events, coalesced samples, pressure width, palm rejection, undo/clear
- ✅ Genkō grid, stroke-order animation, theme tokens (light/dark)
- ✅ Curated example words (`data/examples.json`, 1–2 per kanji, validated at build: every N5 kanji covered, every word contains its kanji); shown on kanji pages and new-kanji intros, with furigana
- ✅ Fixed school grade showing as `[object Object]` (dictionary parser); screen test now fails on `[object Object]` / `undefined` / `NaN` text

## Sprint 2 — Matcher ✅
- ✅ Geometry, Hungarian assignment, robust similarity refit
- ✅ Classifiers: count (missing / extra / merged / split), order, direction, position, proportion, ending (pen only, advisory), confusion
- ✅ Ending detection tested: synthetic pen strokes with stop / sweep / flick speed and pressure profiles (5 tests); full-analysis check that a sweep written as a hard stop gets minor advice, and mouse input never does (3 tests)

## Sprint 3 — Evaluation ✅
- ✅ Synthetic error injection + `npm run evaluate` → `docs/evaluation/synthetic-results.md`
- ✅ Invariant tests (every kanji matches itself with 0 errors; deterministic)
- ✅ Raw pen data saved per attempt (IndexedDB, compact encoding, newest 500) and included in JSON export + cloud sync (FR-14)
- ✅ `scripts/import-fixtures.ts`: export → `tests/fixtures/<writer>/*.json`; `fixtures.test.ts` replays them (snapshot); `npm run evaluate` adds a real-handwriting section from human `label`s. Pipeline verified end-to-end with a browser export
- ✅ Robustness sweep (`npm run robustness` → `docs/evaluation/robustness.md`): noise 0.5–4×. It found false alarms on tilted or shaky writing (15% at 3×); traced to missing rotation correction and jitter-inflated length; fixed with Procrustes alignment (±20° cap) and coarse-path length. Now 0% at 3×, 8.8% at 4× (was 39%)
- ⚠️ Real pen attempts from the team (none yet)

## Sprint 4 — Practice MVP ✅
- ✅ Practice screen with 4 guide levels, live check, error list, highlighted strokes (major = vermilion, minor = gold, on both canvas and model), replay, hanko
- ✅ Library + kanji detail
- ✅ Local persistence (localStorage, in-memory fallback), versioned migrations (v1 → v3)

## Sprint 5 — Backend ✅
- ✅ Migration `supabase/migrations/20261010000000_init.sql`: profiles, cards, attempts, confusions, error_stats; RLS on every table; profile-on-signup trigger; `record_attempts(batch)` RPC (idempotent via client ids, updates counters)
- ✅ `src/lib/supabase.ts`: client only when env vars are set; the app runs local-only otherwise
- ✅ `src/lib/sync.ts`: offline-first sync. Pushes pending attempts (review attempts wait for their grade) and changed cards, then pulls from other devices; latest review wins. Runs on sign-in, when coming back online, and every 60 s
- ✅ Account card in Settings: email magic link, Google OAuth, sync status, sync now, sign out
- ✅ Guest progress is uploaded on first sign-in (it's already in the local log)
- ✅ Unit tests: row mapping round-trips, pending rules, merge, second-device rebuild, guide-level changes marked for upload
- ✅ **Bug fixed:** a second device pulled attempts and cards but not per-kanji progress, guide levels or mix-up pairs (Kanji book and dashboard looked empty). Newly pulled attempts are now folded in without double-counting
- ✅ **Bug fixed:** guide-level changes from practice never reached the cloud (card not marked for upload)
- ✅ Live two-device E2E (`LIVE=1 npx playwright test live-sync`): two real browsers on one temporary account; device B shows device A's attempts, clean count and mix-up pair; raw strokes uploaded; user deleted after
- ✅ Project connected (`.env`): publishable key verified with supabase-js; Account card live; E2E still 11/11
- ✅ Migrations applied via Management API (`npm run db:query <file>`):
  - `…000000_init.sql`: tables, RLS, signup trigger, `record_attempts`
  - `…000100_restrict_rpc.sql`: only signed-in users may call `record_attempts`
  - `…000200_card_precision.sql`: FSRS stability/difficulty and score to double precision (float4 drifted on every sync)
  - `…000300_score_precision.sql`: `record_attempts` keeps full score precision
  - `…000400_raw_strokes.sql`: `attempts.strokes` jsonb (raw pen data)
  - `…000500_study_group.sql`: `attempts.study_group` ('full' / 'control')
- ✅ RLS test `supabase/tests/rls.sql`: 13/13. A user cannot read or write another user's rows; signed-out callers blocked; duplicate uploads ignored; counters updated; test users removed
- ✅ Live sync smoke test `npm run test:sync`: 9/9 (incl. raw strokes + study group). Temp user signs in with the publishable key, pushes an attempt + card through the app's mapping code, both round-trip exactly, cleanup verified
- ✅ Auth config: site URL `http://localhost:5173`; redirect allow-list `localhost:5173`, `localhost:4173`; email sign-in on, Google off
- ✅ Admin token kept out of the browser bundle (no `VITE_` prefix; checked `dist/`)
- ⏳ Google sign-in: needs a Google Cloud OAuth client, then enable the provider in Supabase (optional)
- ⏳ Add the production URL to the auth redirect list once deployed

## Sprint 6 — Personalization ✅
- ✅ FSRS via ts-fsrs; automatic grading from errors + personal baselines; one-tap override; auto vs final grade logged
- ✅ Review session: due + new (daily limit), new-kanji intro, failed cards re-queued once, new kanji paused at > 20 due
- ✅ Recommender (14-day window, max 3) + drills (confusion, order, proportion, direction, ending)

## Sprint 7 — Dashboard + polish ✅
- ✅ Progress dashboard; Settings with pen test, export, reset
- ✅ Responsive pass from screenshots: compact stat cards on mobile, readable hero, pills that don't wrap, clearer stroke-order message
- ✅ Installable offline app (PWA): manifest, 筆 icons (192/512/maskable, rendered with Shippori Mincho), hand-written service worker (`public/sw.js`): app shell + kanji data precached, network-first navigation with offline fallback, fonts cached, Supabase untouched. E2E on the production build: practise offline after one visit; unvisited routes load offline
- ✅ No horizontal scroll and no console errors on any screen (checked automatically, mobile + desktop, light + dark)
- ✅ Accessibility: axe-core WCAG 2.1 A/AA audit of every screen + result panel, light and dark (`tests/e2e/a11y.spec.ts`), zero violations. Fixed: light-mode vermilion / matcha / gold contrast; dark-mode text on vermilion (new `--on-shu` token)
- ✅ Recall prompt shows a word in context with the kanji masked (□手 みぎて “right hand”)
- ✅ **Quizzes (Objective 7):** `src/core/quiz` generates 10-question quizzes weighted toward the learner's weak kanji and mix-ups (30-day log). Three kinds: meaning → kanji, fill-in-the-word (□手 みぎて), kanji → reading. Distractors are the kanji's real look-alikes (e.g. 大 vs 天 犬 太); readings are matched by length so the answer can't be guessed. A wrong look-alike pick is added to the confusion graph. Keyboard 1–4 / Enter; `?seed=N` for reproducible quizzes. 9 unit + 2 E2E tests; in the screen and accessibility sweeps
- ⏳ Optional LLM mnemonics / LLM-written quiz items (needs an API key)

## Sprint 8 — Testing + release 🔄
- ✅ Playwright E2E (`npm run e2e`): practise → hanko; swapped strokes → order error; 右/左 confusion → drill recommended; review intro → auto-grade → next; export JSON; all screens render
- ✅ Screenshots of every screen saved to `screenshots/` (git-ignored; uploaded as a CI artifact)
- ✅ **Bug fixed (found by the live test):** the result disappeared when an attempt promoted the guide level (Practice and Review). The result now stays, with a "▲ Guide level up" note; E2E regression test added
- ✅ Docs: `docs/user-manual.md` (learners and study participants), `docs/evaluation/technical-report.md` (method, results, defects found, limitations)
- ⏳ Device matrix (§7.6): Wacom/XP-Pen on Windows, iPad + Pencil, Android
- ✅ Study mode for the learning study (§7.5): enrol by link `?study=control` / `?study=full` or in Settings. Control = correct/incorrect only (no explanations, highlights, live check, shape score, recommendations, error analytics) and self-graded reviews (auto-grade still logged). Group recorded on every attempt and synced. 3 E2E tests
- ✅ `npm run study:report`: full vs control from the live DB (participants, clean rate, first- vs last-third improvement, review recall, auto-vs-final grade agreement, errors per attempt by type, per-participant table) → `docs/evaluation/study-report.md`. Verified with seeded data (all figures checked by hand), then cleaned up
- ⏳ UAT with 5–10 classmates; run the learning study
- ✅ **Release readiness pass** (`docs/release-checklist.md`):
  - golden-path E2E on the production build: a new learner's whole first session (review, mix-up, drill, order error, quiz, dashboard, export with raw strokes, offline) with 0 page errors
  - `vercel.json`: SPA deep-link rewrites, cache headers (service worker never cached, hashed assets immutable), strict CSP + security headers; E2E proves the CSP breaks nothing (fonts, Supabase, all screens)
  - fixed: the Google button was shown while the provider is disabled (now behind `VITE_AUTH_GOOGLE`); auth errors translated (incl. the 2-emails/hour limit of Supabase's built-in mailer)
  - live checks: sync 9/9, RLS 13/13, two-device E2E, schema matches migrations
  - promotion E2E marked slow (passes 5/5 alone; timed out only under parallel load)
- ⚠️ Production deploy: needs GitHub + Vercel; custom SMTP for study-scale sign-in (checklist §2)

---

## Change log
- **2026-10-09:** Sprints 0–4 built: data pipeline, matcher, evaluation, practice MVP.
- **2026-10-09:** Sprints 6–7 built: FSRS reviews, recommendations, drills, dashboard, settings.
- **2026-10-10:** Added progress.md. Playwright E2E + screenshot suite (11 passing). UI fixes from the screenshot review. Sprint 5 backend code (schema, RLS, auth, offline-first sync), switched off until Supabase is configured.
- **2026-10-10:** Connected Supabase project. Applied 4 migrations via the Management API; live RLS test 13/13; live sync smoke test 8/8. Found and fixed a float4 precision bug in FSRS card and score storage. Configured auth redirect URLs. Next: Vercel deploy (+ its redirect URL), optional Google sign-in.
- **2026-10-10:** Accessibility audit (axe, WCAG 2.1 AA) passing after contrast fixes. Raw strokes stored, exported and synced; fixture import + real-data evaluation pipeline. Example words for all 103 kanji; recall prompt in context. Study mode (control/full) for §7.5. Fixed `[object Object]` grade bug. Migrations 5 and 6 applied.
- **2026-10-10:** Ending-detection tests (8). Offline/installable PWA with E2E on the production build. Study report script verified against seeded data. 161 unit + 18 E2E passing.
- **2026-10-10:** Sync bug hunt: fixed second-device progress rebuild and guide-level upload. Live two-device browser test added and passing; it uncovered and led to fixing the vanishing-result-on-promotion bug. Wrote the user manual and technical evaluation report. 164 unit + 19 E2E passing.
- **2026-10-10:** First git history (13 commits, verified fresh-clone build, no secrets). Objective 7: confusion-aware quizzes on `feat/quiz`, merged into `develop`. 173 unit + 21 E2E passing.
- **2026-10-10:** Robustness sweep; fixed false alarms on tilted/shaky writing (rotation-aware alignment, jitter-tolerant length). Main F1 up for 5 of 6 types, position −0.006.
- **2026-10-10:** Release readiness: golden-path E2E on the production build, vercel.json (rewrites, caching, CSP) with CSP verified, Google-button gating, friendly auth errors, all live checks green. Release candidate `v1.0.0-rc.1` merged to `main`.
