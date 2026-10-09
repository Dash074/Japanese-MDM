import type { ErrorType, KanjiData } from "../types";

/** One analysed attempt as remembered by the learner model. */
export type LogEntry = {
  kanji: string;
  at: number;
  errors: ErrorType[];
  bestMatch: string;
};

export type Recommendation =
  | { kind: "confusion"; target: string; wrote: string; count: number }
  | { kind: "order"; kanji: string; rate: number }
  | { kind: "direction"; kanji: string[] }
  | { kind: "ending"; kanji: string[] }
  | { kind: "proportion"; kanji: string; lookalike?: string }
  | { kind: "clear-reviews"; due: number };

const WINDOW_MS = 14 * 24 * 3600 * 1000;
const MAX = 3;

/**
 * Rule-based recommendations from the learner's recent mistakes (implementation.md §4.8).
 * Ranked by frequency × recency; at most 3 shown.
 */
export function recommend(data: KanjiData, log: LogEntry[], dueCount: number, now = Date.now()): Recommendation[] {
  const recent = log.filter((e) => now - e.at <= WINDOW_MS);
  const weight = (at: number) => 1 - (now - at) / WINDOW_MS / 2; // 1.0 today → 0.5 at 14 days
  const scored: { r: Recommendation; score: number }[] = [];

  if (dueCount > 20) scored.push({ r: { kind: "clear-reviews", due: dueCount }, score: 100 });

  // Confusion pairs seen ≥ 2 times.
  const pairs = new Map<string, { n: number; w: number }>();
  for (const e of recent)
    if (e.bestMatch !== e.kanji) {
      const k = `${e.kanji}→${e.bestMatch}`;
      const p = pairs.get(k) ?? { n: 0, w: 0 };
      pairs.set(k, { n: p.n + 1, w: p.w + weight(e.at) });
    }
  for (const [k, p] of pairs)
    if (p.n >= 2) {
      const [target, wrote] = k.split("→");
      scored.push({ r: { kind: "confusion", target, wrote, count: p.n }, score: 10 * p.w });
    }

  // Per-kanji error rates.
  const byKanji = new Map<string, LogEntry[]>();
  for (const e of recent) byKanji.set(e.kanji, [...(byKanji.get(e.kanji) ?? []), e]);
  const directionKanji: string[] = [], endingKanji: string[] = [];
  let directionW = 0, endingW = 0;
  for (const [kanji, es] of byKanji) {
    const with_ = (t: ErrorType) => es.filter((e) => e.errors.includes(t));
    const order = with_("order");
    if (es.length >= 3 && order.length / es.length >= 0.3)
      scored.push({
        r: { kind: "order", kanji, rate: order.length / es.length },
        score: 6 * order.reduce((s, e) => s + weight(e.at), 0),
      });
    const prop = with_("proportion");
    if (prop.length >= 2) {
      const lookalike = (data.confusables[kanji] ?? [])[0];
      scored.push({ r: { kind: "proportion", kanji, lookalike }, score: 4 * prop.reduce((s, e) => s + weight(e.at), 0) });
    }
    const dir = with_("direction");
    if (dir.length) {
      directionKanji.push(kanji);
      directionW += dir.reduce((s, e) => s + weight(e.at), 0);
    }
    const end = with_("ending");
    if (end.length >= 2) {
      endingKanji.push(kanji);
      endingW += end.reduce((s, e) => s + weight(e.at), 0);
    }
  }
  if (directionKanji.length >= 3) scored.push({ r: { kind: "direction", kanji: directionKanji }, score: 5 * directionW });
  if (endingKanji.length >= 2) scored.push({ r: { kind: "ending", kanji: endingKanji }, score: 3 * endingW });

  return scored.sort((a, b) => b.score - a.score).slice(0, MAX).map((s) => s.r);
}

export type DrillItem = { char: string; level: "trace" | "hint" | "blank" | "recall"; contrast?: string };

/** Turn a recommendation into a concrete drill sequence (FR-12). */
export function drillFor(data: KanjiData, r: Recommendation): DrillItem[] {
  const taught = (c: string) => data.kanji[c]?.taught;
  switch (r.kind) {
    case "confusion":
      // Both taught: alternate recall of A and B. Otherwise: write the target, with the look-alike shown for contrast.
      return taught(r.wrote)
        ? [r.target, r.wrote, r.target, r.wrote, r.target, r.wrote].map((c, i) => ({
            char: c, level: "recall" as const, contrast: i % 2 ? r.target : r.wrote,
          }))
        : [
            { char: r.target, level: "blank", contrast: r.wrote },
            { char: r.target, level: "blank", contrast: r.wrote },
            { char: r.target, level: "recall", contrast: r.wrote },
            { char: r.target, level: "recall", contrast: r.wrote },
          ];
    case "order":
      return [
        { char: r.kanji, level: "trace" },
        { char: r.kanji, level: "trace" },
        { char: r.kanji, level: "hint" },
        { char: r.kanji, level: "blank" },
      ];
    case "proportion":
      return [
        { char: r.kanji, level: "blank", contrast: r.lookalike },
        { char: r.kanji, level: "blank", contrast: r.lookalike },
        { char: r.kanji, level: "recall" },
      ];
    case "direction":
    case "ending":
      return r.kanji.slice(0, 4).flatMap((c) => [
        { char: c, level: "trace" as const },
        { char: c, level: "blank" as const },
      ]);
    case "clear-reviews":
      return [];
  }
}

export function describe(data: KanjiData, r: Recommendation): { title: string; body: string } {
  switch (r.kind) {
    case "confusion":
      return {
        title: `特訓 ${r.target} ⇄ ${r.wrote}`,
        body: `You wrote ${r.wrote} instead of ${r.target} ${r.count} times. Practise telling them apart.`,
      };
    case "order":
      return {
        title: `書き順 ${r.kanji}`,
        body: `Stroke order slipped in ${Math.round(r.rate * 100)}% of your recent ${r.kanji} attempts. Watch, trace, then write.`,
      };
    case "direction":
      return {
        title: "方向 Stroke direction",
        body: `Strokes go top→bottom and left→right. Reversed strokes appeared in ${r.kanji.join(" ")}.`,
      };
    case "ending":
      return { title: "止め・跳ね・払い Endings", body: `Practise stops, flicks and sweeps on ${r.kanji.join(" ")}.` };
    case "proportion":
      return {
        title: `長さ ${r.kanji}`,
        body: `Stroke lengths in ${r.kanji} are off${r.lookalike ? `. Compare it with ${r.lookalike}` : ""}.`,
      };
    case "clear-reviews":
      return { title: "復習 Clear reviews first", body: `${r.due} reviews are due. New kanji are paused until you catch up.` };
  }
  void data;
}
