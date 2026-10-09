import { autoRate, newCard, preview, review } from "../scheduler";
import type { Analysis, StrokeError } from "../types";

const base: Analysis = {
  target: "木", bestMatch: "木", score: 1, mapping: [0, 1, 2, 3], errors: [],
  timing: { totalMs: 4000, hesitationMs: 0, meanStrokeMs: 600 },
};
const err = (severity: "major" | "minor"): StrokeError => ({ type: "position", severity, message: "" });

describe("autoRate (§4.7)", () => {
  it("Again on confusion", () => expect(autoRate({ ...base, bestMatch: "本" }, 4)).toBe(1));
  it("Again on 2 major errors", () => expect(autoRate({ ...base, errors: [err("major"), err("major")] }, 4)).toBe(1));
  it("Hard on 1 major error", () => expect(autoRate({ ...base, errors: [err("major")] }, 4)).toBe(2));
  it("Hard on 3 minor errors", () => expect(autoRate({ ...base, errors: [err("minor"), err("minor"), err("minor")] }, 4)).toBe(2));
  it("Hard when hesitating far more than usual", () =>
    expect(autoRate({ ...base, timing: { ...base.timing, hesitationMs: 3000 } }, 4, { hesitationMs: 500 })).toBe(2));
  it("Good on a clean attempt without baseline", () => expect(autoRate(base, 4)).toBe(3));
  it("Good with ≤2 minor errors", () => expect(autoRate({ ...base, errors: [err("minor")] }, 4)).toBe(3));
  it("Easy when clean and faster than personal baseline", () =>
    expect(autoRate(base, 4, { msPerStroke: 2000 })).toBe(4));
});

describe("FSRS wrapper", () => {
  const now = Date.UTC(2026, 9, 1);
  it("schedules Good further out than Again", () => {
    const p = preview(newCard(now), now);
    expect(p[3]).toBeGreaterThan(p[1]);
    expect(p[4]).toBeGreaterThanOrEqual(p[3]);
  });
  it("round-trips through JSON", () => {
    const c = review(newCard(now), 3, now);
    const back = JSON.parse(JSON.stringify(c));
    expect(review(back, 3, c.due).reps).toBe(2);
  });
});
