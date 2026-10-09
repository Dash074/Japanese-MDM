import { detectEnding } from "../classifier";
import { analyze } from "../analyze";
import { refOf, toAttempt } from "../synth";
import type { InputStroke } from "../types";
import { DATA } from "./load-data";

/**
 * Synthetic pen strokes with realistic endings (implementation.md §4.6 "ending"):
 *  tome  — the pen decelerates to a stop before lifting
 *  harai — the pen keeps speed while pressure fades (tapering sweep)
 *  hane  — a short sharp flick in a new direction at the end
 */
const N = 40;
function stroke(speed: (f: number) => number, pressure: (f: number) => number, dir: (f: number) => number = () => 0): InputStroke {
  const pts: InputStroke = [];
  let x = 50, y = 50, t = 0;
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    pts.push({ x, y, t, p: pressure(f) });
    const v = speed(f), a = dir(f);
    x += Math.cos(a) * v * 8;
    y += Math.sin(a) * v * 8;
    t += 8;
  }
  return pts;
}
const steady = () => 1;
const firm = () => 0.6;

describe("detectEnding", () => {
  it("tome: decelerates to a stop", () => {
    expect(detectEnding(stroke((f) => (f < 0.8 ? 1 : Math.max(0.05, 1 - (f - 0.8) * 5)), firm))).toBe("tome");
  });

  it("harai: keeps speed while pressure fades", () => {
    expect(detectEnding(stroke((f) => (f < 0.8 ? 1 : 1.3), (f) => (f < 0.8 ? 0.7 : 0.7 - (f - 0.8) * 3)))).toBe("harai");
  });

  it("hane: sharp flick at the end", () => {
    expect(detectEnding(stroke(steady, firm, (f) => (f < 0.9 ? Math.PI / 2 : -Math.PI / 4)))).toBe("hane");
  });

  it("an even stroke with constant pressure is not classified", () => {
    expect(detectEnding(stroke(steady, firm))).toBeNull();
  });

  it("a gentle curve is not mistaken for hane", () => {
    expect(detectEnding(stroke(steady, firm, (f) => (f * Math.PI) / 6))).toBeNull();
  });
});

describe("ending feedback in full analysis", () => {
  /** 人 written from the reference, with pen timing/pressure; stroke 2 (㇏, a sweep) ends as chosen. */
  function hito(lastEnding: "tome" | "harai") {
    const at = toAttempt("人", refOf(DATA, "人"));
    at.device = "pen";
    at.strokes = at.strokes.map((s, si) =>
      s.map((p, i) => {
        const f = i / (s.length - 1);
        const stop = si === 1 && lastEnding === "tome" && f > 0.8;
        const fade = (si === 0 || lastEnding === "harai") && f > 0.8;
        // Re-time points: a stop compresses distance per time (slows down) by stretching time.
        return { ...p, t: p.t + (stop ? (f - 0.8) * 2000 : 0), p: fade ? 0.7 - (f - 0.8) * 3 : 0.7 };
      }),
    );
    return analyze(DATA, at);
  }

  it("a sweep (harai) written as a sweep → no ending advice", () => {
    expect(hito("harai").errors.filter((e) => e.type === "ending")).toEqual([]);
  });

  it("a sweep written as a hard stop → minor ending advice on stroke 2", () => {
    const errs = hito("tome").errors.filter((e) => e.type === "ending");
    expect(errs).toEqual([expect.objectContaining({ refStroke: 1, severity: "minor" })]);
  });

  it("mouse input never gets ending advice", () => {
    const at = toAttempt("人", refOf(DATA, "人"));
    expect(analyze(DATA, at).errors.filter((e) => e.type === "ending")).toEqual([]);
  });
});
