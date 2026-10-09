import type { Path, Vec } from "../types";

export const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function pathLength(p: Path): number {
  let len = 0;
  for (let i = 1; i < p.length; i++) len += dist(p[i - 1], p[i]);
  return len;
}

/** Resample a polyline to n points equally spaced along its length. */
export function resample(p: Path, n: number): Path {
  if (p.length === 0) return [];
  if (p.length === 1) return Array.from({ length: n }, () => [p[0][0], p[0][1]] as Vec);
  const total = pathLength(p);
  if (total === 0) return Array.from({ length: n }, () => [p[0][0], p[0][1]] as Vec);
  const step = total / (n - 1);
  const out: Path = [[p[0][0], p[0][1]]];
  let acc = 0;
  let prev: Vec = p[0];
  for (let i = 1; i < p.length && out.length < n; i++) {
    let cur: Vec = p[i];
    let d = dist(prev, cur);
    while (acc + d >= step && out.length < n) {
      const t = (step - acc) / d;
      const q: Vec = [prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])];
      out.push(q);
      prev = q;
      d = dist(prev, cur);
      acc = 0;
    }
    acc += d;
    prev = cur;
    cur = p[i];
  }
  while (out.length < n) out.push([p[p.length - 1][0], p[p.length - 1][1]]);
  return out;
}

export function bbox(paths: Path[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths)
    for (const [x, y] of p) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/**
 * Fit a set of strokes into the unit box: scale uniformly by the longer side
 * and centre. Applied to both user and reference strokes so they are comparable.
 */
export function normalize(paths: Path[]): Path[] {
  const b = bbox(paths);
  const side = Math.max(b.w, b.h) || 1;
  const ox = (side - b.w) / 2;
  const oy = (side - b.h) / 2;
  return paths.map((p) => p.map(([x, y]) => [(x - b.minX + ox) / side, (y - b.minY + oy) / side] as Vec));
}

export function centroid(p: Path): Vec {
  let x = 0, y = 0;
  for (const q of p) {
    x += q[0];
    y += q[1];
  }
  return [x / p.length, y / p.length];
}

/** Overall direction of a stroke (start → end) in radians. */
export function angle(p: Path): number {
  const a = p[0], b = p[p.length - 1];
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
}

/** Mean distance between corresponding points of two equally sampled paths. */
export function meanPointDist(a: Path, b: Path): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += dist(a[i], b[i]);
  return s / a.length;
}

export const reversed = (p: Path): Path => [...p].reverse();
