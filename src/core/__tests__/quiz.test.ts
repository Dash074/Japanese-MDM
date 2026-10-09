import type { LogEntry } from "../recommender";
import { makeQuestion, makeQuiz, weakness, type QuestionKind } from "../quiz";
import { rng } from "../synth";
import { DATA } from "./load-data";

const now = Date.UTC(2026, 9, 10);
const e = (kanji: string, errors: LogEntry["errors"] = [], bestMatch = kanji): LogEntry => ({ kanji, errors, bestMatch, at: now - 3600_000 });

describe("quiz questions", () => {
  const kinds: QuestionKind[] = ["meaning-to-kanji", "word-fill", "kanji-to-reading"];

  it.each(kinds)("%s: valid for every N5 kanji that supports it", (kind) => {
    let built = 0;
    for (const c of DATA.scope) {
      const q = makeQuestion(DATA, c, kind, rng(1));
      if (!q) continue;
      built++;
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(4); // 4 distinct options
      expect(q.options.filter((o) => o === q.answer)).toHaveLength(1);
    }
    expect(built).toBeGreaterThan(kind === "word-fill" ? 60 : 95);
  });

  it("uses real look-alikes as distractors", () => {
    const q = makeQuestion(DATA, "右", "meaning-to-kanji", rng(3))!;
    expect(q.options).toContain("左");
  });

  it("word-fill masks the target in context", () => {
    const q = makeQuestion(DATA, "右", "word-fill", rng(1))!;
    expect(q.prompt.main).toBe("□手");
    expect(q.prompt.sub).toContain("みぎて");
  });

  it("never offers a correct reading as a wrong option", () => {
    for (const c of DATA.scope) {
      const q = makeQuestion(DATA, c, "kanji-to-reading", rng(7));
      if (q) expect(q.options.filter((o) => o === q.answer)).toHaveLength(1);
    }
  });
});

describe("makeQuiz", () => {
  it("targets the learner's weak kanji and confusions", () => {
    const log = [
      ...Array.from({ length: 6 }, () => e("右", ["confusion"], "左")),
      ...Array.from({ length: 20 }, () => e("山")), // practised, always clean
    ];
    const w = weakness(log, now);
    expect(w.get("右")!).toBeGreaterThan(w.get("山")!);
    const counts = new Map<string, number>();
    for (let s = 0; s < 200; s++)
      for (const q of makeQuiz(DATA, log, 1, s, now)) counts.set(q.target, (counts.get(q.target) ?? 0) + 1);
    // 右 (6 confusions) should be drawn several times more often than 山 (always clean).
    expect(counts.get("右")!).toBeGreaterThan(3 * (counts.get("山") ?? 0));
  });

  it("works for a brand-new learner", () => {
    const q = makeQuiz(DATA, [], 10, 1, now);
    expect(q.length).toBeGreaterThanOrEqual(5);
    expect(new Set(q.map((x) => x.target)).size).toBe(q.length); // no repeated targets
  });

  it("is reproducible for a seed", () => {
    expect(makeQuiz(DATA, [e("木")], 5, 42, now)).toEqual(makeQuiz(DATA, [e("木")], 5, 42, now));
  });
});
