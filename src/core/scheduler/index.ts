import { createEmptyCard, fsrs, generatorParameters, Rating, type Card } from "ts-fsrs";
import type { Analysis } from "../types";

/** 1 Again · 2 Hard · 3 Good · 4 Easy (same values as ts-fsrs Rating). */
export type Grade = 1 | 2 | 3 | 4;
export const GRADE_LABEL: Record<Grade, { jp: string; en: string }> = {
  1: { jp: "もう一度", en: "Again" },
  2: { jp: "難しい", en: "Hard" },
  3: { jp: "良い", en: "Good" },
  4: { jp: "簡単", en: "Easy" },
};

/** The learner's own baselines, so "fast" and "hesitant" are personal, not absolute. */
export type Baseline = { msPerStroke?: number; hesitationMs?: number };

/**
 * Automatic FSRS grading from an analysed attempt (implementation.md §4.7).
 * Replaces self-rating; the learner may still override.
 */
export function autoRate(a: Analysis, strokeCount: number, base: Baseline = {}): Grade {
  const major = a.errors.filter((e) => e.severity === "major").length;
  const minor = a.errors.length - major;
  if (a.mapping.length === 0 || a.bestMatch !== a.target || major >= 2) return 1;

  const hesitant = base.hesitationMs !== undefined && a.timing.hesitationMs > 2 * Math.max(base.hesitationMs, 300);
  if (major === 1 || minor >= 3 || hesitant) return 2;

  const fast =
    base.msPerStroke !== undefined && a.timing.totalMs / Math.max(1, strokeCount) < 0.8 * base.msPerStroke;
  if (a.errors.length === 0 && fast && a.timing.hesitationMs === 0) return 4;
  return 3;
}

/** JSON-safe FSRS card (dates as epoch ms) for persistence. */
export type StoredCard = Omit<Card, "due" | "last_review"> & { due: number; last_review?: number };

const f = fsrs(generatorParameters({ enable_fuzz: true, maximum_interval: 365 }));

const toCard = (s: StoredCard): Card => ({
  ...s,
  due: new Date(s.due),
  last_review: s.last_review !== undefined ? new Date(s.last_review) : undefined,
});
const fromCard = (c: Card): StoredCard => ({
  ...c,
  due: c.due.getTime(),
  last_review: c.last_review ? c.last_review.getTime() : undefined,
});

export const newCard = (now = Date.now()): StoredCard => fromCard(createEmptyCard(new Date(now)));

export function review(card: StoredCard, grade: Grade, now = Date.now()): StoredCard {
  return fromCard(f.next(toCard(card), new Date(now), grade as unknown as Rating.Again).card);
}

/** Interval the card would get for each grade, for showing "Good → 3d" on buttons. */
export function preview(card: StoredCard, now = Date.now()): Record<Grade, number> {
  const out = {} as Record<Grade, number>;
  for (const g of [1, 2, 3, 4] as Grade[]) out[g] = review(card, g, now).due - now;
  return out;
}

export function formatInterval(ms: number): string {
  const min = ms / 60000;
  if (min < 60) return `${Math.max(1, Math.round(min))}m`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)}d`;
  return `${Math.round(d / 30)}mo`;
}

export const isDue = (c: StoredCard, now = Date.now()) => c.due <= now;
