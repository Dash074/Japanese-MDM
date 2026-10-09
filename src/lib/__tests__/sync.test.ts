import { newCard, review } from "../../core/scheduler";
import type { AttemptLog } from "../progress";
import { useProgress } from "../progress";
import { fromAttemptRow, fromCardRow, pendingAttempts, toAttemptPayload, toCardRow } from "../sync";

const entry = (over: Partial<AttemptLog> = {}): AttemptLog => ({
  id: "a1", kanji: "木", at: Date.UTC(2026, 9, 1), errors: ["order"], bestMatch: "木", mode: "practice",
  level: "trace", device: "pen", score: 0.9, strokes: 4, ms: 3000, hesitationMs: 0, ...over,
});

describe("sync row mapping", () => {
  it("round-trips an attempt through the DB row shape", () => {
    const p = toAttemptPayload(entry({ auto: 3, grade: 2 }));
    const back = fromAttemptRow({
      client_id: p.client_id, kanji: p.kanji, mode: p.mode, guide_level: p.level, device: p.device,
      best_match: p.best_match, score: p.score, errors: p.errors, stroke_count: p.strokes, duration_ms: p.ms,
      hesitation_ms: p.hesitation_ms, auto_rating: p.auto ?? null, final_rating: p.grade ?? null,
      client_created_at: new Date(p.at).toISOString(),
    });
    expect(back).toEqual({ ...entry({ auto: 3, grade: 2 }), synced: true });
  });

  it("round-trips an FSRS card", () => {
    const c = review(newCard(Date.UTC(2026, 9, 1)), 3, Date.UTC(2026, 9, 1));
    const row = toCardRow("u", "木", c, "hint");
    expect(row.guide_level).toBe("hint");
    expect(fromCardRow(row)).toEqual(c);
  });
});

describe("pendingAttempts", () => {
  const now = Date.UTC(2026, 9, 1, 12);
  it("skips synced attempts", () => expect(pendingAttempts([entry({ synced: true })], now)).toEqual([]));
  it("holds an ungraded review attempt for 5 minutes", () => {
    expect(pendingAttempts([entry({ mode: "review", at: now - 60_000 })], now)).toHaveLength(0);
    expect(pendingAttempts([entry({ mode: "review", at: now - 6 * 60_000 })], now)).toHaveLength(1);
    expect(pendingAttempts([entry({ mode: "review", at: now, grade: 3 })], now)).toHaveLength(1);
  });
});

describe("mergeRemote", () => {
  beforeEach(() => useProgress.getState().reset());
  it("keeps the most recently reviewed card and dedupes attempts", () => {
    const t = Date.UTC(2026, 9, 1);
    const older = review(newCard(t), 3, t), newer = review(newCard(t), 1, t + 1000);
    useProgress.setState({ cards: { 木: older }, log: [entry()] });
    useProgress.getState().mergeRemote({ 木: newer }, [entry(), entry({ id: "a2" })]);
    const s = useProgress.getState();
    expect(s.cards["木"]).toEqual(newer);
    expect(s.log.map((e) => e.id)).toEqual(["a1", "a2"]);
  });
});

describe("second device (pull from another device)", () => {
  beforeEach(() => useProgress.getState().reset());
  it("rebuilds per-kanji progress, confusions and guide level from pulled attempts", () => {
    const t = Date.UTC(2026, 9, 1);
    const pulled = [
      entry({ id: "r1", kanji: "右", errors: ["confusion"], bestMatch: "左", at: t }),
      entry({ id: "r2", kanji: "右", errors: [], bestMatch: "右", score: 0.97, at: t + 1000 }),
    ];
    useProgress.getState().mergeRemote({ 右: review(newCard(t), 3, t) }, pulled, { 右: "blank" });
    const s = useProgress.getState();
    expect(s.kanji["右"]).toMatchObject({ attempts: 2, clean: 1, best: 0.97, level: "blank", errors: { confusion: 1 } });
    expect(s.confusions["右→左"]).toBe(1);
  });

  it("does not double-count attempts this device already has", () => {
    useProgress.setState({ kanji: { 木: { attempts: 1, clean: 0, streak: 0, fails: 0, level: "hint", best: 0.9, errors: { order: 1 }, lastSeen: 1 } }, log: [entry()] });
    useProgress.getState().mergeRemote({}, [entry()], { 木: "trace" });
    expect(useProgress.getState().kanji["木"]).toMatchObject({ attempts: 1, level: "hint" }); // local level kept
  });
});

describe("guide level changes reach the cloud", () => {
  beforeEach(() => useProgress.getState().reset());
  it("marks the card dirty when practice promotes the guide level", () => {
    const t = Date.UTC(2026, 9, 1);
    useProgress.setState({ cards: { 木: review(newCard(t), 3, t) }, dirtyCards: [] });
    const clean = { target: "木", bestMatch: "木", score: 1, mapping: [0], errors: [], timing: { totalMs: 1, hesitationMs: 0, meanStrokeMs: 1 } };
    const meta = { mode: "practice" as const, level: "trace" as const, device: "mouse", strokes: 4 };
    useProgress.getState().record(clean, meta);
    expect(useProgress.getState().dirtyCards).toEqual([]); // still trace (needs 2 clean)
    useProgress.getState().record(clean, meta);
    expect(useProgress.getState().kanji["木"].level).toBe("hint");
    expect(useProgress.getState().dirtyCards).toEqual(["木"]);
  });
});
