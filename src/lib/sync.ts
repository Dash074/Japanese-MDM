import type { StoredCard } from "../core/scheduler";
import type { ErrorType } from "../core/types";
import type { AttemptLog, GuideLevel } from "./progress";
import { useProgress } from "./progress";
import { encode, loadStrokes } from "./strokeStore";
import { supabase } from "./supabase";

/* ---------- Pure row mapping (unit-tested) ---------- */

export type AttemptRow = {
  client_id: string; kanji: string; mode: string; level: string; device: string; best_match: string;
  score: number; errors: string[]; strokes: number; ms: number; hesitation_ms: number;
  auto?: number; grade?: number; at: number; group?: string; raw?: unknown;
};

export const toAttemptPayload = (e: AttemptLog, raw?: unknown): AttemptRow => ({
  client_id: e.id, kanji: e.kanji, mode: e.mode, level: e.level, device: e.device, best_match: e.bestMatch,
  score: e.score, errors: e.errors, strokes: e.strokes, ms: e.ms, hesitation_ms: e.hesitationMs,
  auto: e.auto, grade: e.grade, at: e.at, group: e.group, ...(raw ? { raw } : {}),
});

type DbAttempt = {
  client_id: string; kanji: string; mode: string; guide_level: string; device: string; best_match: string;
  score: number; errors: string[]; stroke_count: number; duration_ms: number; hesitation_ms: number;
  auto_rating: number | null; final_rating: number | null; client_created_at: string; study_group?: string | null;
};

export const fromAttemptRow = (r: DbAttempt): AttemptLog => ({
  id: r.client_id, kanji: r.kanji, at: Date.parse(r.client_created_at), errors: r.errors as ErrorType[],
  bestMatch: r.best_match, mode: r.mode as AttemptLog["mode"], level: r.guide_level as GuideLevel, device: r.device,
  score: r.score, strokes: r.stroke_count, ms: r.duration_ms, hesitationMs: r.hesitation_ms,
  auto: (r.auto_rating ?? undefined) as AttemptLog["auto"], grade: (r.final_rating ?? undefined) as AttemptLog["grade"],
  ...(r.study_group ? { group: r.study_group as AttemptLog["group"] } : {}),
  synced: true,
});

type DbCard = {
  kanji: string; guide_level: string; due: string; stability: number; difficulty: number; elapsed_days: number;
  scheduled_days: number; reps: number; lapses: number; state: number; last_review: string | null;
};

export const toCardRow = (user_id: string, kanji: string, c: StoredCard, level: GuideLevel) => ({
  user_id, kanji, guide_level: level, due: new Date(c.due).toISOString(), stability: c.stability,
  difficulty: c.difficulty, elapsed_days: c.elapsed_days, scheduled_days: c.scheduled_days, reps: c.reps,
  lapses: c.lapses, state: c.state, last_review: c.last_review ? new Date(c.last_review).toISOString() : null,
  updated_at: new Date().toISOString(),
});

export const fromCardRow = (r: DbCard): StoredCard => ({
  due: Date.parse(r.due), stability: r.stability, difficulty: r.difficulty, elapsed_days: r.elapsed_days,
  scheduled_days: r.scheduled_days, reps: r.reps, lapses: r.lapses, state: r.state,
  last_review: r.last_review ? Date.parse(r.last_review) : undefined,
});

/** Attempts ready to upload: review attempts wait for their grade (or 5 minutes). */
export function pendingAttempts(log: AttemptLog[], now = Date.now()): AttemptLog[] {
  return log.filter((e) => !e.synced && (e.mode !== "review" || e.grade !== undefined || now - e.at > 5 * 60_000));
}

/* ---------- Sync runner ---------- */

export type SyncStatus = { state: "off" | "idle" | "syncing" | "error"; lastSync?: number; message?: string };
let status: SyncStatus = { state: supabase ? "idle" : "off" };
const listeners = new Set<(s: SyncStatus) => void>();
const emit = (s: SyncStatus) => {
  status = s;
  listeners.forEach((l) => l(s));
};
export const getSyncStatus = () => status;
export const onSyncStatus = (l: (s: SyncStatus) => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

let running: Promise<void> | null = null;

/** Push pending attempts + changed cards, then pull anything newer from other devices. */
export function syncNow(): Promise<void> {
  if (!supabase) return Promise.resolve();
  return (running ??= run().finally(() => (running = null)));
}

async function run() {
  const db = supabase!;
  const { data: auth } = await db.auth.getUser();
  const user = auth.user;
  if (!user || !navigator.onLine) return;
  emit({ ...status, state: "syncing" });
  try {
    const s = useProgress.getState();

    const pending = pendingAttempts(s.log);
    for (let i = 0; i < pending.length; i += 200) {
      const batch = pending.slice(i, i + 200);
      const raws = await Promise.all(batch.map((e) => loadStrokes(e.id)));
      const payload = batch.map((e, k) => toAttemptPayload(e, raws[k] ? encode(raws[k]!) : undefined));
      const { error } = await db.rpc("record_attempts", { batch: payload });
      if (error) throw error;
      useProgress.getState().markSynced(batch.map((e) => e.id));
    }

    const dirty = [...s.dirtyCards];
    if (dirty.length) {
      const rows = dirty
        .filter((k) => s.cards[k])
        .map((k) => toCardRow(user.id, k, s.cards[k], s.kanji[k]?.level ?? "trace"));
      const { error } = await db.from("cards").upsert(rows);
      if (error) throw error;
      useProgress.getState().clearDirty(dirty);
    }

    const [cards, attempts] = await Promise.all([
      db.from("cards").select("*"),
      db.from("attempts").select("*").order("client_created_at", { ascending: false }).limit(2000),
    ]);
    if (cards.error) throw cards.error;
    if (attempts.error) throw attempts.error;
    useProgress.getState().mergeRemote(
      Object.fromEntries((cards.data as DbCard[]).map((r) => [r.kanji, fromCardRow(r)])),
      (attempts.data as DbAttempt[]).map(fromAttemptRow),
      Object.fromEntries((cards.data as DbCard[]).map((r) => [r.kanji, r.guide_level as GuideLevel])),
    );
    emit({ state: "idle", lastSync: Date.now() });
  } catch (e) {
    emit({ ...status, state: "error", message: e instanceof Error ? e.message : String(e) });
  }
}

/** Start background sync: on sign-in, when coming back online, and every 60 s. */
export function startSync() {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") void syncNow();
  });
  const online = () => void syncNow();
  window.addEventListener("online", online);
  const timer = window.setInterval(() => void syncNow(), 60_000);
  return () => {
    data.subscription.unsubscribe();
    window.removeEventListener("online", online);
    window.clearInterval(timer);
  };
}
