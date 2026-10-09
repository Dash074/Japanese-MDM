import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type { LogEntry } from "../core/recommender";
import { newCard, review, type Baseline, type Grade, type StoredCard } from "../core/scheduler";
import type { Analysis, ErrorType } from "../core/types";

export type GuideLevel = "trace" | "hint" | "blank" | "recall";
export const GUIDE_LEVELS: GuideLevel[] = ["trace", "hint", "blank", "recall"];

export type KanjiProgress = {
  attempts: number;
  clean: number;
  /** Consecutive clean attempts at the current guide level. */
  streak: number;
  /** Consecutive attempts with a major error. */
  fails: number;
  level: GuideLevel;
  best: number;
  errors: Partial<Record<ErrorType, number>>;
  lastSeen: number;
};

export type Mode = "practice" | "review" | "drill";

/** Attempt log entry: recommender input + timing for personal baselines + raw data for export (FR-14). */
export type AttemptLog = LogEntry & {
  mode: Mode;
  level: GuideLevel;
  device: string;
  score: number;
  strokes: number;
  ms: number;
  hesitationMs: number;
  group?: StudyGroup;
  auto?: Grade;
  grade?: Grade;
  /** Stable client-side id (idempotent upload). */
  id: string;
  synced?: boolean;
};

/**
 * Study group for the learning study (implementation.md §7.5).
 * "full" = error-aware feedback (treatment); "control" = correct/incorrect only + manual grading.
 */
export type StudyGroup = "full" | "control";
export type Settings = { dailyNew: number; live: boolean; study: StudyGroup };

type State = {
  kanji: Record<string, KanjiProgress>;
  /** Personal confusion graph: "target→written" → count. */
  confusions: Record<string, number>;
  /** FSRS review cards; a kanji gets one when first introduced in a review session. */
  cards: Record<string, StoredCard>;
  log: AttemptLog[];
  newToday: { day: string; chars: string[] };
  settings: Settings;
  /** Kanji whose review card changed since the last upload. */
  dirtyCards: string[];

  record: (a: Analysis, meta: { mode: Mode; level: GuideLevel; device: string; strokes: number; auto?: Grade }) => string;
  /** (record returns the new attempt id, used to key its raw strokes.) */
  grade: (char: string, g: Grade, now?: number) => StoredCard;
  setSettings: (s: Partial<Settings>) => void;
  /** A quiz answer that picked a look-alike counts toward the personal confusion graph. */
  recordQuizConfusion: (target: string, chosen: string) => void;
  reset: () => void;
  markSynced: (ids: string[]) => void;
  clearDirty: (chars: string[]) => void;
  mergeRemote: (cards: Record<string, StoredCard>, entries: AttemptLog[], levels?: Record<string, GuideLevel>) => void;
};

const LOG_LIMIT = 2000;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const fresh = (): KanjiProgress => ({
  attempts: 0, clean: 0, streak: 0, fails: 0, level: "trace", best: 0, errors: {}, lastSeen: 0,
});

export const today = (now = Date.now()) => new Date(now).toLocaleDateString("sv"); // YYYY-MM-DD, local

/** Clean attempts needed at each level before fading the guide (implementation.md §4.7). */
const PROMOTE: Record<GuideLevel, number> = { trace: 2, hint: 2, blank: 3, recall: Infinity };

export function nextLevel(p: KanjiProgress, a: Analysis): Pick<KanjiProgress, "level" | "streak" | "fails"> {
  const major = a.errors.some((e) => e.severity === "major");
  const idx = GUIDE_LEVELS.indexOf(p.level);
  if (!major && a.errors.length <= 2) {
    const streak = p.streak + 1;
    if (streak >= PROMOTE[p.level]) return { level: GUIDE_LEVELS[idx + 1], streak: 0, fails: 0 };
    return { level: p.level, streak, fails: 0 };
  }
  if (!major) return { level: p.level, streak: 0, fails: 0 };
  const fails = p.fails + 1;
  // Recall drops after one major error; other levels after two in a row.
  if ((p.level === "recall" || fails >= 2) && idx > 0) return { level: GUIDE_LEVELS[idx - 1], streak: 0, fails: 0 };
  return { level: p.level, streak: 0, fails };
}

const INITIAL = {
  kanji: {},
  confusions: {},
  cards: {},
  log: [],
  newToday: { day: "", chars: [] },
  settings: { dailyNew: 5, live: true, study: "full" } as Settings,
  dirtyCards: [] as string[],
};

export const useProgress = create<State>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      record: (a, meta) => {
        const s = get();
        const prev = s.kanji[a.target] ?? fresh();
        const errors = { ...prev.errors };
        for (const e of a.errors) errors[e.type] = (errors[e.type] ?? 0) + 1;
        const next: KanjiProgress = {
          ...prev,
          // Guide level only adapts on attempts made at the learner's own level.
          ...(meta.level === prev.level ? nextLevel(prev, a) : {}),
          attempts: prev.attempts + 1,
          clean: prev.clean + (a.errors.length === 0 ? 1 : 0),
          best: Math.max(prev.best, a.bestMatch === a.target ? a.score : 0),
          errors,
          lastSeen: Date.now(),
        };
        const confusions = { ...s.confusions };
        if (a.bestMatch !== a.target) {
          const key = `${a.target}→${a.bestMatch}`;
          confusions[key] = (confusions[key] ?? 0) + 1;
        }
        const entry: AttemptLog = {
          id: newId(), kanji: a.target, at: Date.now(), errors: a.errors.map((e) => e.type), bestMatch: a.bestMatch,
          mode: meta.mode, group: s.settings.study, level: meta.level, device: meta.device, score: Math.round(a.score * 1000) / 1000,
          strokes: meta.strokes, ms: Math.round(a.timing.totalMs), hesitationMs: Math.round(a.timing.hesitationMs), auto: meta.auto,
        };
        // A guide-level change must reach other devices: mark the kanji's card for upload.
        const levelChanged = next.level !== prev.level && !!s.cards[a.target];
        set({
          kanji: { ...s.kanji, [a.target]: next },
          confusions,
          log: [...s.log, entry].slice(-LOG_LIMIT),
          ...(levelChanged ? { dirtyCards: [...new Set([...s.dirtyCards, a.target])] } : {}),
        });
        return entry.id;
      },
      grade: (char, g, now = Date.now()) => {
        const s = get();
        const isNew = !s.cards[char];
        const card = review(s.cards[char] ?? newCard(now), g, now);
        const day = today(now);
        const newToday = isNew
          ? { day, chars: [...(s.newToday.day === day ? s.newToday.chars : []), char] }
          : s.newToday;
        // Attach the final grade to the latest log entry for this kanji.
        const log = [...s.log];
        for (let i = log.length - 1; i >= 0; i--)
          if (log[i].kanji === char && log[i].mode === "review") {
            log[i] = { ...log[i], grade: g, synced: false };
            break;
          }
        set({ cards: { ...s.cards, [char]: card }, newToday, log, dirtyCards: [...new Set([...s.dirtyCards, char])] });
        return card;
      },
      markSynced: (ids) => {
        const set_ = new Set(ids);
        set({ log: get().log.map((e) => (set_.has(e.id) ? { ...e, synced: true } : e)) });
      },
      clearDirty: (chars) => set({ dirtyCards: get().dirtyCards.filter((c) => !chars.includes(c)) }),
      mergeRemote: (cards, entries, levels = {}) => {
        const s = get();
        const merged = { ...s.cards };
        // Latest review wins (implementation.md §4.10).
        for (const [k, c] of Object.entries(cards))
          if (!merged[k] || (c.last_review ?? 0) > (merged[k].last_review ?? 0)) merged[k] = c;
        const known = new Set(s.log.map((e) => e.id));
        const added = entries.filter((e) => !known.has(e.id));

        // Fold only newly pulled attempts into the per-kanji counters and the confusion graph,
        // so a second device shows the same progress without double-counting.
        const kanji = { ...s.kanji };
        const confusions = { ...s.confusions };
        for (const e of added) {
          const p = { ...(kanji[e.kanji] ?? { ...fresh(), level: levels[e.kanji] ?? "trace" }) };
          p.errors = { ...p.errors };
          for (const t of e.errors) p.errors[t] = (p.errors[t] ?? 0) + 1;
          p.attempts += 1;
          p.clean += e.errors.length === 0 ? 1 : 0;
          p.best = Math.max(p.best, e.bestMatch === e.kanji ? e.score : 0);
          p.lastSeen = Math.max(p.lastSeen, e.at);
          kanji[e.kanji] = p;
          if (e.bestMatch !== e.kanji) {
            const key = `${e.kanji}→${e.bestMatch}`;
            confusions[key] = (confusions[key] ?? 0) + 1;
          }
        }
        // Guide level from the cloud for kanji this device has never practised.
        for (const [k, level] of Object.entries(levels)) if (!s.kanji[k]) kanji[k] = { ...(kanji[k] ?? fresh()), level };

        const log = [...s.log, ...added].sort((a, b) => a.at - b.at).slice(-LOG_LIMIT);
        set({ cards: merged, log, kanji, confusions });
      },
      recordQuizConfusion: (target, chosen) => {
        const key = `${target}→${chosen}`;
        set({ confusions: { ...get().confusions, [key]: (get().confusions[key] ?? 0) + 1 } });
      },
      setSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      reset: () => set(INITIAL),
    }),
    {
      name: "fude-progress-v1",
      version: 3,
      migrate: (old, version) => {
        const s = { ...INITIAL, ...(old as object) } as unknown as State;
        // v3: attempts need ids for sync.
        if (version < 3) s.log = s.log.map((e) => ({ ...e, id: e.id ?? newId() }));
        s.settings = { ...INITIAL.settings, ...s.settings };
        return s;
      },
      storage: createJSONStorage(safeStorage),
    },
  ),
);

function safeStorage(): StateStorage {
  try {
    localStorage.setItem("__t", "1");
    localStorage.removeItem("__t");
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
  }
}

export const progressOf = (p: Record<string, KanjiProgress>, c: string) => p[c] ?? fresh();

/** 0 new · 1 learning · 2 mastered — drives library tile tint. */
export function mastery(p: KanjiProgress): 0 | 1 | 2 {
  if (p.attempts === 0) return 0;
  return p.level === "recall" && p.clean >= 3 ? 2 : 1;
}

const median = (xs: number[]) => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};

/** Personal speed/hesitation baselines from the last 50 clean attempts. */
export function baseline(log: AttemptLog[]): Baseline {
  const clean = log.filter((e) => e.errors.length === 0 && e.strokes > 0).slice(-50);
  if (clean.length < 5) return {};
  return {
    msPerStroke: median(clean.map((e) => e.ms / e.strokes)),
    hesitationMs: median(clean.map((e) => e.hesitationMs)),
  };
}

/** Today's review queue: due cards (oldest first), then new kanji up to the daily limit. */
export function reviewQueue(
  scope: string[],
  s: Pick<State, "cards" | "newToday" | "settings">,
  now = Date.now(),
): { due: string[]; fresh: string[] } {
  const due = Object.entries(s.cards)
    .filter(([, c]) => c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([k]) => k);
  const introduced = s.newToday.day === today(now) ? s.newToday.chars.length : 0;
  const allowance = due.length > 20 ? 0 : Math.max(0, s.settings.dailyNew - introduced);
  const fresh = scope.filter((c) => !s.cards[c]).slice(0, allowance);
  return { due, fresh };
}

/**
 * Next kanji for free practice: kanji in progress (not yet at Recall) first, least recently seen;
 * otherwise the next new kanji in teaching order; otherwise the stalest mastered one.
 */
export function pickNext(data: { scope: string[] }, p: Record<string, KanjiProgress>, exclude?: string): string {
  const pool = data.scope.filter((c) => c !== exclude);
  const learning = pool
    .filter((c) => p[c] && p[c].attempts > 0 && mastery(p[c]) === 1)
    .sort((a, b) => p[a].lastSeen - p[b].lastSeen);
  // Keep at most 5 kanji "in flight" before introducing a new one.
  if (learning.length >= 5) return learning[0];
  const fresh = pool.find((c) => !p[c] || p[c].attempts === 0);
  if (fresh) return fresh;
  if (learning.length) return learning[0];
  return [...pool].sort((a, b) => (p[a]?.lastSeen ?? 0) - (p[b]?.lastSeen ?? 0))[0] ?? data.scope[0];
}
