# ADR-002: Analysis runs client-side; backend is storage only

**Status:** accepted · 2026-10-09

All analysis code lives in `src/core/` (pure TypeScript, no React/network) and runs in the browser.
Supabase (Sprint 5) provides auth + Postgres with RLS only. Instant feedback, works offline, free-tier hosting, and no ML server to deploy.
