# 筆 Fude — Smart Kanji Learning System

A confusion-aware, pen-first kanji practice app for **JLPT N5**. Write a kanji with a graphics tablet, stylus, finger or mouse. Fude tells you *which* stroke went wrong and *why*: stroke order, direction, count, proportion, position, stroke ending, or writing a look-alike kanji.

See [implementation.md](docs/implementation.md) for the full SDLC plan, [progress.md](docs/progress.md) for status, the [user guide](docs/user-manual.md), the [technical evaluation](docs/evaluation/technical-report.md), and the [release checklist](docs/release-checklist.md) (deploy steps).

## Quick start

```bash
npm install
npm run data:fetch   # downloads KANJIDIC2 + KanjiVG into data/raw (one-off)
npm run data:build   # builds public/data/kanji.json
npm run dev          # http://localhost:5173
```

`public/data/kanji.json` is committed, so `data:fetch`/`data:build` are only needed when changing scope or the pipeline.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit + invariant tests (Vitest) |
| `npm run evaluate` | Synthetic error-detection evaluation → `docs/evaluation/synthetic-results.md` |
| `npm run lint` / `npm run typecheck` | Static checks (also run in CI) |
| `npm run e2e` | Playwright journeys + screenshots of every screen (light/dark, desktop/mobile) → `screenshots/` |
| `npm run db:query <file.sql>` | Run SQL / migrations on the Supabase project (needs `SUPABASE_ACCESS_TOKEN`) |
| `npm run test:sync` | Live sync smoke test against Supabase (temporary user, cleaned up) |
| `npm run study:report` | Learning-study report (full vs control group) from the live DB → `docs/evaluation/study-report.md` |
| `npm run build` | Production build (installable, works offline after the first visit) |

## Enabling accounts & cloud sync (optional)

The app works fully offline without a backend. To enable sign-in and sync:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/migrations/20261010000000_init.sql`](supabase/migrations/20261010000000_init.sql) (tables, RLS policies, `record_attempts` function).
3. Authentication → URL configuration: add `http://localhost:5173` (and your deployed URL) to redirect URLs. Optionally enable the Google provider.
4. Copy `.env.example` to `.env` and fill in the project URL and anon key (Project settings → API).
5. Restart `npm run dev`. Sign in from Settings (設).

## Project layout

```
src/core/        Pure TypeScript analysis engine: no React, fully unit-tested
  geometry/      normalize, resample, distances
  matcher/       cost matrix + Hungarian assignment + robust alignment
  classifier/    one rule set per error type
  synth/         synthetic error injection (tests + evaluation)
  analyze.ts     analyze(attempt) → Analysis   (incl. look-alike confusion)
  live.ts        live per-stroke check
  scheduler/     FSRS (ts-fsrs) + automatic grading
  recommender/   rule-based recommendations → drill sequences
  quiz/          confusion-aware quiz generation
src/features/    Screens: home 今日, review 復習, library 漢字帳, practice 練習, drill 特訓, quiz 小テスト, progress 成績, settings 設定
src/ui/          Themed components: InkCanvas, KanjiGlyph, Hanko…
src/theme/       Colour tokens (washi / sumi / shu / ai), light + dark
scripts/         Data pipeline + evaluation
docs/            ADRs, evaluation results
```

## Status

| Sprint | Status |
|---|---|
| 0 Setup | ✅ scaffold, CI, templates, ADRs |
| 1 Data + canvas | ✅ 103 N5 kanji + 26 look-alike distractors; pen canvas with pressure |
| 2 Matcher | ✅ order / direction / count / position / proportion / confusion |
| 3 Synthetic evaluation | ✅ all held-out F1 ≥ 0.93, 0% false positives on clean attempts; ⏳ real handwriting fixtures |
| 4 Practice MVP | ✅ guide levels, live check, result highlighting, replay, local progress |
| 5 Backend (Supabase) | ✅ code: schema + RLS, magic link/Google auth, offline-first sync · ⚠️ needs a Supabase project to switch on |
| 6 FSRS + recommendations + drills | ✅ auto-graded FSRS reviews, new-kanji intro, rule-based recommendations, confusion/order/proportion drills |
| 7 Dashboard + polish | ✅ progress dashboard, settings, pen test, export, WCAG AA audit, confusion-aware quizzes · ⏳ LLM extras |
| 8 Testing + release | ✅ release candidate v1.0.0-rc.1: golden-path, CSP, offline, live-backend checks · ⏳ deploy, device matrix, UAT |

## Licences

Code: choose a licence before publishing. Data: see [data/LICENSE.md](data/LICENSE.md) (KanjiVG CC BY-SA 3.0, KANJIDIC2 CC BY-SA 4.0).
