import { CONFIG } from "../config";
import { centroid, meanPointDist, pathLength, resample } from "../geometry";
import type { MatchResult } from "../matcher";
import type { Ending, InputStroke, Path, StrokeError } from "../types";

const n = (i: number) => i + 1; // 0-based → human stroke number

/** Longest increasing subsequence; returns the set of indices that are part of it. */
function lisIndices(seq: number[]): Set<number> {
  const tails: number[] = [], tailIdx: number[] = [], prev: number[] = new Array(seq.length).fill(-1);
  seq.forEach((v, i) => {
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = v;
    tailIdx[lo] = i;
    prev[i] = lo > 0 ? tailIdx[lo - 1] : -1;
  });
  const keep = new Set<number>();
  for (let i = tailIdx[tails.length - 1] ?? -1; i >= 0; i = prev[i]) keep.add(i);
  return keep;
}

const fitsJoined = (u: Path, a: Path, b: Path) =>
  meanPointDist(u, resample([...a, ...b], CONFIG.resampleN)) < CONFIG.mergeTolerance;

export function countErrors(m: MatchResult): StrokeError[] {
  const errors: StrokeError[] = [];
  const { user, ref, mapping, inverse } = m;

  inverse.forEach((ui, j) => {
    if (ui >= 0) return;
    // Missing ref stroke j: was it merged into a neighbour's user stroke?
    for (const k of [j - 1, j + 1]) {
      const uk = inverse[k];
      if (k < 0 || k >= ref.length || uk === undefined || uk < 0) continue;
      const [a, b] = k < j ? [ref[k], ref[j]] : [ref[j], ref[k]];
      if (fitsJoined(user[uk], a, b)) {
        const [lo, hi] = [Math.min(j, k), Math.max(j, k)];
        errors.push({
          type: "count", severity: "major", refStroke: j, userStroke: uk,
          message: `Strokes ${n(lo)} and ${n(hi)} should be written separately, not as one line.`,
        });
        return;
      }
    }
    errors.push({ type: "count", severity: "major", refStroke: j, message: `Stroke ${n(j)} is missing.` });
  });

  mapping.forEach((j, i) => {
    if (j >= 0) return;
    // Extra user stroke i: is it the second half of a split ref stroke?
    for (const k of [i - 1, i + 1]) {
      const r = mapping[k];
      if (k < 0 || k >= user.length || r === undefined || r < 0) continue;
      const [a, b] = k < i ? [user[k], user[i]] : [user[i], user[k]];
      if (meanPointDist(resample([...a, ...b], CONFIG.resampleN), ref[r]) < CONFIG.mergeTolerance) {
        errors.push({
          type: "count", severity: "major", refStroke: r, userStroke: i,
          message: `Stroke ${n(r)} should be one continuous line — you lifted the pen part-way.`,
        });
        return;
      }
    }
    errors.push({ type: "count", severity: "major", userStroke: i, message: `Your stroke ${n(i)} is an extra stroke.` });
  });
  return errors;
}

export function orderErrors(m: MatchResult): StrokeError[] {
  const written = m.mapping.map((j, i) => ({ i, j })).filter((x) => x.j >= 0);
  const keep = lisIndices(written.map((x) => x.j));
  const displaced = written.filter((_, k) => !keep.has(k));
  const severity = displaced.length > 1 || displaced.some((d) => Math.abs(d.i - d.j) > 1) ? "major" : "minor";
  return displaced.map(({ i, j }) => ({
    type: "order" as const, severity, refStroke: j, userStroke: i,
    message: `You wrote stroke ${n(j)} ${ordinal(n(i))}; it should be written ${ordinal(n(j))}.`,
  }));
}

export function directionErrors(m: MatchResult): StrokeError[] {
  const out: StrokeError[] = [];
  m.fits.forEach((f, i) => {
    if (f && f.rev < f.fwd - CONFIG.directionMargin)
      out.push({
        type: "direction", severity: "major", refStroke: m.mapping[i], userStroke: i,
        message: `Stroke ${n(m.mapping[i])} is written in the wrong direction.`,
      });
  });
  return out;
}

export function positionErrors(m: MatchResult): StrokeError[] {
  const out: StrokeError[] = [];
  m.mapping.forEach((j, i) => {
    if (j < 0) return;
    const [ux, uy] = centroid(m.user[i]), [rx, ry] = centroid(m.ref[j]);
    const off = Math.hypot(ux - rx, uy - ry);
    if (off < CONFIG.positionMinor) return;
    const dir = Math.abs(ux - rx) > Math.abs(uy - ry) ? (ux > rx ? "right" : "left") : uy > ry ? "low" : "high";
    out.push({
      type: "position", severity: off >= CONFIG.positionMajor ? "major" : "minor", refStroke: j, userStroke: i,
      message: `Stroke ${n(j)} is placed too far ${dir}.`,
    });
  });
  return out;
}

export function proportionErrors(m: MatchResult): StrokeError[] {
  const out: StrokeError[] = [];
  m.mapping.forEach((j, i) => {
    if (j < 0) return;
    // Smoothed length so hand jitter doesn't inflate short strokes; absolute floor for dots.
    const uLen = pathLength(smooth(m.user[i])), rLen = pathLength(smooth(m.ref[j]));
    const ratio = uLen / (rLen || 1);
    if (Math.abs(uLen - rLen) <= Math.max(CONFIG.proportionTolerance * rLen, CONFIG.proportionMinDelta)) return;
    out.push({
      type: "proportion", severity: "minor", refStroke: j, userStroke: i,
      message: `Stroke ${n(j)} is too ${ratio > 1 ? "long" : "short"} compared with the rest of the kanji.`,
    });
  });
  return out;
}

/** Ending (tome/hane/harai) — only meaningful with real pen timing/pressure. Always minor. */
export function endingErrors(m: MatchResult, raw: InputStroke[], endings: Ending[]): StrokeError[] {
  const out: StrokeError[] = [];
  m.mapping.forEach((j, i) => {
    const want = endings[j];
    const s = raw[i];
    if (j < 0 || !want || !s || s.length < 8) return;
    const got = detectEnding(s);
    if (got && got !== want)
      out.push({
        type: "ending", severity: "minor", refStroke: j, userStroke: i,
        message: `Stroke ${n(j)} should end with ${ENDING_HINT[want]}.`,
      });
  });
  return out;
}

const ENDING_HINT: Record<Exclude<Ending, null>, string> = {
  tome: "a firm stop (とめ tome)",
  hane: "a small flick (はね hane)",
  harai: "a tapering sweep (はらい harai)",
};

export function detectEnding(s: InputStroke): Ending {
  const speeds: number[] = [];
  for (let k = 1; k < s.length; k++) {
    const dt = Math.max(1, s[k].t - s[k - 1].t);
    speeds.push(Math.hypot(s[k].x - s[k - 1].x, s[k].y - s[k - 1].y) / dt);
  }
  const tailStart = Math.floor(s.length * (1 - CONFIG.endingTail));
  const median = [...speeds].sort((a, b) => a - b)[speeds.length >> 1] || 1e-6;
  const tailSpeed = speeds.slice(tailStart - 1).reduce((a, b) => a + b, 0) / Math.max(1, speeds.length - tailStart + 1);

  // Hane: sharp turn in the tail.
  const a = s[tailStart - 1], b = s[Math.min(s.length - 2, tailStart + 1)], c = s[s.length - 1];
  const turn = Math.abs(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x));
  if (Math.min(turn, 2 * Math.PI - turn) > Math.PI / 3) return "hane";

  const pressures = s.map((q) => q.p ?? 0.5);
  const peak = Math.max(...pressures);
  const endP = pressures.slice(tailStart).reduce((x, y) => x + y, 0) / (s.length - tailStart);
  if (tailSpeed > 0.8 * median && endP < 0.7 * peak) return "harai";
  if (tailSpeed < 0.6 * median) return "tome";
  return null;
}

/** Moving-average smoothing (window 5), endpoints kept. */
function smooth(p: Path): Path {
  return p.map((q, k) => {
    if (k === 0 || k === p.length - 1) return q;
    const w = p.slice(Math.max(0, k - 2), k + 3);
    return [w.reduce((s, v) => s + v[0], 0) / w.length, w.reduce((s, v) => s + v[1], 0) / w.length];
  });
}

function ordinal(k: number) {
  const s = ["th", "st", "nd", "rd"], v = k % 100;
  return k + (s[(v - 20) % 10] || s[v] || s[0]);
}
