import { analyze } from "../../core/analyze";
import { DATA } from "../../core/__tests__/load-data";
import { drillFor, recommend } from "../../core/recommender";
import { autoRate } from "../../core/scheduler";
import { refOf, toAttempt } from "../../core/synth";
import { reviewQueue, useProgress } from "../progress";

const meta = (strokes: number) => ({ mode: "review" as const, level: "trace" as const, device: "mouse", strokes });

describe("learning loop (integration)", () => {
  beforeEach(() => useProgress.getState().reset());

  it("new kanji → clean attempt → Good → scheduled into the future", () => {
    const s = useProgress.getState();
    const { fresh } = reviewQueue(DATA.scope, s);
    expect(fresh).toHaveLength(5);
    const char = fresh[0];
    const a = analyze(DATA, toAttempt(char, refOf(DATA, char)));
    const g = autoRate(a, DATA.kanji[char].strokes.length);
    expect(g).toBe(3);
    s.record(a, meta(a.mapping.length));
    const card = useProgress.getState().grade(char, g);
    expect(card.due).toBeGreaterThan(Date.now());
    const after = reviewQueue(DATA.scope, useProgress.getState());
    expect(after.fresh).not.toContain(char);
    expect(after.fresh).toHaveLength(4); // daily allowance consumed
  });

  it("repeated 右→左 confusion → Again + confusion drill recommendation", () => {
    for (let k = 0; k < 2; k++) {
      const a = analyze(DATA, toAttempt("右", refOf(DATA, "左")));
      expect(autoRate(a, 5)).toBe(1);
      useProgress.getState().record(a, meta(5));
    }
    const s = useProgress.getState();
    expect(s.confusions["右→左"]).toBe(2);
    const [rec] = recommend(DATA, s.log, 0);
    expect(rec).toMatchObject({ kind: "confusion", target: "右", wrote: "左" });
    expect(drillFor(DATA, rec).length).toBeGreaterThan(0);
  });

  it("pauses new kanji when more than 20 reviews are due", () => {
    const s = useProgress.getState();
    for (const c of DATA.scope.slice(0, 21)) s.grade(c, 1, Date.now() - 7 * 86400000);
    const q = reviewQueue(DATA.scope, useProgress.getState());
    expect(q.due.length).toBe(21);
    expect(q.fresh).toEqual([]);
  });
});
