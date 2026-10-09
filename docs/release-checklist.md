# Release checklist — v1.0

Status of every end-to-end check, and the deployment steps that need an account owner.
Re-run the automated part any time with the commands in §1.

## 1. Automated checks (all passing on `release/v1.0`, 2026-10-10)

| Area | Command | Result |
|---|---|---|
| Types, lint | `npm run typecheck && npm run lint` | clean |
| Unit + integration | `npm test` | 176 passing |
| Browser E2E (dev build): journeys, all screens light/dark × desktop/mobile, a11y (WCAG 2.1 AA), study mode, quiz | `npm run e2e` | passing |
| **Golden path on the production build:** new learner → 5-kanji review → mix-up → recommended drill → order error → quiz → dashboard → export (14 attempts with raw pen data) → offline practice | `npx playwright test golden-path --project=pwa` | passing, 0 page errors |
| Production headers (`vercel.json`): strict CSP causes no violations; fonts load; Supabase reachable; deep-link rewrites | `npx playwright test csp --project=pwa` | passing |
| Offline / installable (production build) | `npx playwright test offline --project=pwa` | passing |
| Live Supabase: sync round-trip (attempt, card, raw strokes, study group) | `npm run test:sync` | 9/9 |
| Live Supabase: row-level security | `npm run db:query supabase/tests/rls.sql` | 13/13 |
| Live Supabase: two real browsers on one account | `LIVE=1 npx playwright test live-sync --project=desktop` | passing |
| Live schema = migrations in git | (schema query) | matches; `record_attempts` callable by signed-in users only |
| Error-detection accuracy / robustness | `npm run evaluate`, `npm run robustness` | held-out F1 0.937–0.998; 0% false alarms up to 3× noise |
| Fresh clone installs, tests, builds | `git clone … && npm ci && npm test && npm run build` | passing |
| Secrets in git history | `git log -p \| grep` | none |

## 2. Deploy (needs your accounts)

1. **Push to GitHub:** `git remote add origin <url> && git push -u origin main develop --tags`. CI runs on every push and PR.
2. **Vercel:** *New Project → import the repo*. Framework and build settings come from `vercel.json`. Add environment variables:
   - `VITE_SUPABASE_URL` = `https://skmtjfpwhqcfvylfhycv.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = the publishable key
   - (never add `SUPABASE_ACCESS_TOKEN` to Vercel; it is for local admin scripts only)
3. **Supabase → Authentication → URL configuration:** set *Site URL* to the Vercel URL and add `https://<your-app>.vercel.app/**` to Redirect URLs. (Or give me the URL and I'll do it.)
4. **Email sign-in at study scale:** Supabase's built-in mailer allows **2 sign-in emails per hour for the whole project**, enough for the two of you but not for a 10–20 person study. Configure custom SMTP (*Authentication → Emails → SMTP settings*; e.g. Resend or Brevo free tier), then raise the email rate limit under *Authentication → Rate limits*. Until then, the app shows a clear "please wait a few minutes" message, and practice keeps working locally.
5. **Optional, Google sign-in:** create an OAuth client in Google Cloud, enable the provider in Supabase, then set `VITE_AUTH_GOOGLE=true` in Vercel. The button stays hidden until then.
6. **Smoke test after deploy:** open the URL on a phone and a tablet; practise one kanji; sign in with your email; *Settings → Sync now* shows "Synced".
7. **Revoke** the Supabase personal access token when no more schema changes are needed.

## 3. Not covered by automation (do by hand)

- Real pen tablets: Windows + Wacom/XP-Pen/Huion, iPad + Apple Pencil, Android stylus (`docs/user-manual.md` §1). Use *Settings → Pen test*.
- Receiving and clicking a real sign-in email (the automated tests sign in directly, without email).
- Error detection on **real handwriting**: export → `scripts/import-fixtures.ts` → label → `npm run evaluate`.
