import { CONFIG } from "../config";
import { angle, angleDiff, meanPointDist, normalize, resample, reversed } from "../geometry";
import type { Path, Vec } from "../types";
import { hungarian } from "./hungarian";

export type PairFit = { fwd: number; rev: number; cost: number };

export type MatchResult = {
  /** Aligned user strokes (in reference space). */
  user: Path[];
  ref: Path[];
  /** user index → ref index, -1 if unmatched. */
  mapping: number[];
  /** ref index → user index, -1 if unmatched. */
  inverse: number[];
  fits: (PairFit | null)[]; // per user stroke
  score: number;
};

export function pairFit(u: Path, r: Path): PairFit {
  const fwd = meanPointDist(u, r);
  const ru = reversed(u);
  const rev = meanPointDist(ru, r);
  const ra = angle(r);
  const cost = Math.min(
    fwd + CONFIG.angleWeight * angleDiff(angle(u), ra),
    rev + CONFIG.angleWeight * angleDiff(angle(ru), ra),
  );
  return { fwd, rev, cost };
}

function assign(user: Path[], ref: Path[]) {
  const n = Math.max(user.length, ref.length);
  const cost = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i < user.length && j < ref.length ? pairFit(user[i], ref[j]).cost : CONFIG.unmatchedCost,
    ),
  );
  const a = hungarian(cost);
  const mapping = user.map((_, i) => (a[i] < ref.length && cost[i][a[i]] < CONFIG.unmatchedCost * 2 ? a[i] : -1));
  return mapping;
}

/** Least-squares uniform scale + translation mapping matched user points onto ref points. */
function fitSimilarity(user: Path[], ref: Path[], mapping: number[]): (p: Vec) => Vec {
  const us: Vec[] = [], rs: Vec[] = [];
  // Robust fit: ignore outlier pairs (a misplaced stroke must not drag the whole alignment).
  const pairs = mapping.map((j, i) => ({ i, j, fit: j >= 0 ? pairFit(user[i], ref[j]) : null }));
  const costs = pairs.filter((p) => p.fit).map((p) => Math.min(p.fit!.fwd, p.fit!.rev)).sort((a, b) => a - b);
  const cutoff = Math.max(0.03, 1.5 * (costs[(costs.length - 1) >> 1] ?? 0));
  const inliers = pairs.filter((p) => p.fit && Math.min(p.fit.fwd, p.fit.rev) <= cutoff);
  const use = inliers.length >= 2 ? inliers : pairs.filter((p) => p.fit);
  use.forEach(({ i, j, fit }) => {
    if (!fit) return;
    const u = fit.rev < fit.fwd ? reversed(user[i]) : user[i];
    u.forEach((p, k) => {
      us.push(p);
      rs.push(ref[j][k]);
    });
  });
  if (us.length < 2) return (p) => p;
  const mean = (a: Vec[]): Vec => [a.reduce((s, p) => s + p[0], 0) / a.length, a.reduce((s, p) => s + p[1], 0) / a.length];
  const mu = mean(us), mr = mean(rs);
  let num = 0, den = 0;
  for (let k = 0; k < us.length; k++) {
    const ux = us[k][0] - mu[0], uy = us[k][1] - mu[1];
    num += ux * (rs[k][0] - mr[0]) + uy * (rs[k][1] - mr[1]);
    den += ux * ux + uy * uy;
  }
  const s = den > 1e-9 ? Math.max(0.5, Math.min(2, num / den)) : 1;
  return ([x, y]) => [s * (x - mu[0]) + mr[0], s * (y - mu[1]) + mr[1]];
}

export function prepare(paths: Path[]): Path[] {
  return normalize(paths).map((p) => resample(p, CONFIG.resampleN));
}

/**
 * Match user strokes against reference strokes (both already `prepare`d).
 * Two passes: bbox alignment → assignment → similarity refit → reassignment,
 * so a missing or extra stroke doesn't distort the scale of the whole attempt.
 */
export function match(userPrepared: Path[], refPrepared: Path[]): MatchResult {
  let user = userPrepared;
  let mapping = assign(user, refPrepared);
  for (let iter = 0; iter < 3; iter++) {
    const tf = fitSimilarity(user, refPrepared, mapping);
    user = user.map((p) => p.map(tf));
    mapping = assign(user, refPrepared);
  }
  const inverse = refPrepared.map(() => -1);
  mapping.forEach((j, i) => {
    if (j >= 0) inverse[j] = i;
  });
  const fits = user.map((u, i) => (mapping[i] >= 0 ? pairFit(u, refPrepared[mapping[i]]) : null));

  // Score: average best-direction distance; unmatched strokes on either side count as worst case.
  const slots = Math.max(user.length, refPrepared.length) || 1;
  let total = 0;
  fits.forEach((f) => (total += f ? Math.min(f.fwd, f.rev, CONFIG.scoreScale) : CONFIG.scoreScale));
  total += (slots - user.length) * CONFIG.scoreScale; // missing ref strokes
  const score = Math.max(0, 1 - total / slots / CONFIG.scoreScale);

  return { user, ref: refPrepared, mapping, inverse, fits, score };
}
