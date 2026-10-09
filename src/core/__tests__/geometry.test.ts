import { angleDiff, normalize, pathLength, resample } from "../geometry";
import { hungarian } from "../matcher/hungarian";

describe("geometry", () => {
  it("resamples to n equally spaced points", () => {
    const r = resample([[0, 0], [1, 0]], 5);
    expect(r).toHaveLength(5);
    expect(r[2][0]).toBeCloseTo(0.5);
  });

  it("keeps path length when resampling a polyline", () => {
    const p: [number, number][] = [[0, 0], [1, 0], [1, 1]];
    expect(pathLength(resample(p, 33))).toBeCloseTo(2, 2);
  });

  it("normalize is scale- and translation-invariant", () => {
    const a = normalize([[[0, 0], [2, 1]]]);
    const b = normalize([[[10, 10], [50, 30]]]);
    a[0].forEach((p, i) => {
      expect(p[0]).toBeCloseTo(b[0][i][0]);
      expect(p[1]).toBeCloseTo(b[0][i][1]);
    });
  });

  it("angleDiff wraps around", () => {
    expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
  });
});

describe("hungarian", () => {
  it("finds the optimal assignment", () => {
    expect(hungarian([[4, 1, 3], [2, 0, 5], [3, 2, 2]])).toEqual([1, 0, 2]);
  });
});
