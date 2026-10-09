import { checkLastStroke } from "../live";
import { toAttempt } from "../synth";
import { DATA } from "./load-data";

const SIZE = 300; // toAttempt draws on a 300 px cell

describe("live per-stroke check", () => {
  const entry = DATA.kanji["十"];
  const ref = entry.strokes.map((s) => s.points.map(([x, y]) => [x, y] as [number, number]));

  it("accepts the expected next stroke", () => {
    expect(checkLastStroke(entry, toAttempt("十", ref.slice(0, 1)).strokes, SIZE).ok).toBe(true);
  });

  it("flags a reversed stroke", () => {
    const rev = [[...ref[0]].reverse()];
    expect(checkLastStroke(entry, toAttempt("十", rev).strokes, SIZE).reason).toBe("direction");
  });

  it("flags the wrong stroke first", () => {
    expect(checkLastStroke(entry, toAttempt("十", [ref[1]]).strokes, SIZE).reason).toBe("shape");
  });

  it("flags extra strokes", () => {
    expect(checkLastStroke(entry, toAttempt("十", [...ref, ref[0]]).strokes, SIZE).reason).toBe("extra");
  });
});
