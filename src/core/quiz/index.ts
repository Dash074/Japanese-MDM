/**
 * Confusion-aware quiz generation (Objective 7).
 * Questions target the learner's weak kanji and use each kanji's real look-alikes as
 * distractors, so a quiz probes exactly the confusions the learner is prone to.
 */
import type { LogEntry } from "../recommender";
import { rng, type Rng } from "../synth";
import type { KanjiData } from "../types";

export type QuestionKind = "meaning-to-kanji" | "word-fill" | "kanji-to-reading";

export type Question = {
  kind: QuestionKind;
  /** The kanji being tested. */
  target: string;
  /** What to show: a meaning, a masked word, or a word to read. */
  prompt: { main: string; sub?: string };
  options: string[];
  answer: string;
  /** Short explanation shown after answering. */
  explain: string;
};

const shuffle = <T>(xs: T[], r: Rng) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Up to n look-alike kanji for a target (taught or distractor), padded with random taught kanji. */
function kanjiDistractors(data: KanjiData, target: string, n: number, r: Rng): string[] {
  const look = (data.confusables[target] ?? []).filter((c) => data.kanji[c] && c !== target);
  const pad = shuffle(data.scope.filter((c) => c !== target && !look.includes(c)), r);
  return [...look.slice(0, n), ...pad].slice(0, n);
}

/**
 * Weight per kanji: error rate and confusion count in the recent log, plus a small base so
 * unseen practised kanji still appear. Only kanji the learner has met are quizzed.
 */
export function weakness(log: LogEntry[], now = Date.now()): Map<string, number> {
  const recent = log.filter((e) => now - e.at < 30 * 86400000);
  const w = new Map<string, number>();
  for (const e of recent) {
    const add = 0.2 + (e.errors.length ? 1 : 0) + (e.bestMatch !== e.kanji ? 2 : 0);
    w.set(e.kanji, (w.get(e.kanji) ?? 0) + add);
  }
  return w;
}

function pickTargets(weights: Map<string, number>, n: number, r: Rng): string[] {
  const pool = [...weights.entries()];
  const out: string[] = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, [, v]) => s + v, 0);
    let x = r() * total;
    const idx = pool.findIndex(([, v]) => (x -= v) <= 0);
    const [k] = pool.splice(idx === -1 ? pool.length - 1 : idx, 1)[0];
    out.push(k);
  }
  return out;
}

export function makeQuestion(data: KanjiData, target: string, kind: QuestionKind, r: Rng): Question | null {
  const k = data.kanji[target];
  if (!k?.taught) return null;
  const meaning = k.meanings[0] ?? "";
  if (kind === "meaning-to-kanji") {
    if (!meaning) return null;
    const options = shuffle([target, ...kanjiDistractors(data, target, 3, r)], r);
    return {
      kind, target, options, answer: target,
      prompt: { main: `“${meaning}”`, sub: "Which kanji means this?" },
      explain: `${target} = “${meaning}”.`,
    };
  }
  const words = (k.examples ?? []).filter((e) => e.word.length > 1);
  if (kind === "word-fill") {
    const w = words[Math.floor(r() * words.length)];
    if (!w) return null;
    const masked = [...w.word].map((ch) => (ch === target ? "□" : ch)).join("");
    const options = shuffle([target, ...kanjiDistractors(data, target, 3, r)], r);
    return {
      kind, target, options, answer: target,
      prompt: { main: masked, sub: `${w.reading} · “${w.meaning}”` },
      explain: `${w.word} (${w.reading}) = “${w.meaning}”.`,
    };
  }
  // kanji-to-reading: read a word containing the target; distractors are other words' readings.
  const all = (k.examples ?? []);
  const w = all[Math.floor(r() * all.length)];
  if (!w) return null;
  const others = shuffle(
    data.scope.flatMap((c) => (c === target ? [] : data.kanji[c].examples ?? [])).map((e) => e.reading),
    r,
  );
  // Prefer readings of similar length so the answer can't be guessed from length alone.
  const near = others.filter((x) => Math.abs(x.length - w.reading.length) <= 1 && x !== w.reading);
  const distract = [...new Set([...near, ...others.filter((x) => x !== w.reading)])].slice(0, 3);
  if (distract.length < 3) return null;
  return {
    kind, target, options: shuffle([w.reading, ...distract], r), answer: w.reading,
    prompt: { main: w.word, sub: "How is this read?" },
    explain: `${w.word} is read ${w.reading}: “${w.meaning}”.`,
  };
}

const KINDS: QuestionKind[] = ["meaning-to-kanji", "word-fill", "kanji-to-reading"];

/**
 * Build a quiz of up to n questions. Targets are drawn by weakness (errors, confusions);
 * if the learner has met fewer kanji than that, the first kanji in teaching order fill in.
 */
export function makeQuiz(data: KanjiData, log: LogEntry[], n = 10, seed = Date.now(), now = Date.now()): Question[] {
  const r = rng(seed);
  const weights = weakness(log, now);
  for (const c of data.scope.slice(0, Math.max(5, n))) if (!weights.has(c)) weights.set(c, 0.1);
  const targets = pickTargets(weights, n, r);
  const qs: Question[] = [];
  targets.forEach((t, i) => {
    for (let tries = 0; tries < KINDS.length; tries++) {
      const q = makeQuestion(data, t, KINDS[(i + tries) % KINDS.length], r);
      if (q) {
        qs.push(q);
        break;
      }
    }
  });
  return qs;
}
