/**
 * Synthetic error injection (implementation.md §7.3): turns reference strokes into
 * realistic "user attempts" with a known, injected mistake.
 */
import { centroid } from "../geometry";
import type { Attempt, ErrorType, InputStroke, KanjiData, Path } from "../types";

export type Rng = () => number;

/** Deterministic PRNG (mulberry32) so evaluation runs are reproducible. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIZE = 300;

export type NoiseOpts = { jitter: number; scale: number; rotate: number; shift: number };
export const DEFAULT_NOISE: NoiseOpts = { jitter: 0.006, scale: 0.15, rotate: 5, shift: 0.05 };

/** Apply human-like noise: global scale/rotation/shift and per-point jitter. */
export function humanize(paths: Path[], r: Rng, o: NoiseOpts = DEFAULT_NOISE): Path[] {
  const s = 1 + (r() * 2 - 1) * o.scale;
  const th = ((r() * 2 - 1) * o.rotate * Math.PI) / 180;
  const dx = (r() * 2 - 1) * o.shift, dy = (r() * 2 - 1) * o.shift;
  const cos = Math.cos(th), sin = Math.sin(th);
  return paths.map((p) =>
    p.map(([x, y]) => {
      const cx = x - 0.5, cy = y - 0.5;
      return [
        0.5 + s * (cx * cos - cy * sin) + dx + (r() * 2 - 1) * o.jitter,
        0.5 + s * (cx * sin + cy * cos) + dy + (r() * 2 - 1) * o.jitter,
      ] as [number, number];
    }),
  );
}

/** Convert unit-box paths into a timed Attempt as if drawn on a SIZE px canvas. */
export function toAttempt(target: string, paths: Path[]): Attempt {
  let t = 0;
  const strokes: InputStroke[] = paths.map((p) => {
    const s = p.map(([x, y]) => ({ x: x * SIZE, y: y * SIZE, t: (t += 12) }));
    t += 300;
    return s;
  });
  return { target, strokes, device: "mouse", size: SIZE };
}

const clone = (paths: Path[]): Path[] => paths.map((p) => p.map(([x, y]) => [x, y] as [number, number]));
const pick = (r: Rng, n: number) => Math.floor(r() * n);

export type Injection = { expect: ErrorType | "clean"; paths: Path[]; target: string; note: string } | null;

/** Each injector returns null when not applicable to the kanji (e.g. too few strokes). */
export const INJECT: Record<string, (data: KanjiData, char: string, r: Rng) => Injection> = {
  clean: (d, c) => ({ expect: "clean", target: c, paths: refOf(d, c), note: "clean" }),

  swapOrder: (d, c, r) => {
    const p = refOf(d, c);
    if (p.length < 2) return null;
    const i = pick(r, p.length - 1);
    [p[i], p[i + 1]] = [p[i + 1], p[i]];
    return { expect: "order", target: c, paths: p, note: `swap ${i + 1}/${i + 2}` };
  },

  reverse: (d, c, r) => {
    const p = refOf(d, c);
    const i = pick(r, p.length);
    p[i] = [...p[i]].reverse();
    return { expect: "direction", target: c, paths: p, note: `reverse ${i + 1}` };
  },

  delete: (d, c, r) => {
    const p = refOf(d, c);
    if (p.length < 3) return null;
    const i = pick(r, p.length);
    p.splice(i, 1);
    return { expect: "count", target: c, paths: p, note: `delete ${i + 1}` };
  },

  split: (d, c, r) => {
    const p = refOf(d, c);
    const i = pick(r, p.length);
    const mid = p[i].length >> 1;
    p.splice(i, 1, p[i].slice(0, mid + 1), p[i].slice(mid + 1));
    return { expect: "count", target: c, paths: p, note: `split ${i + 1}` };
  },

  scale: (d, c, r) => {
    const p = refOf(d, c);
    if (p.length < 3) return null;
    const i = pick(r, p.length);
    const f = r() < 0.5 ? 0.45 : 1.7;
    const [cx, cy] = centroid(p[i]);
    p[i] = p[i].map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f]);
    return { expect: "proportion", target: c, paths: p, note: `scale ${i + 1} ×${f}` };
  },

  shift: (d, c, r) => {
    const p = refOf(d, c);
    if (p.length < 3) return null;
    const i = pick(r, p.length);
    const mag = 0.18 + r() * 0.12, a = r() * 2 * Math.PI;
    p[i] = p[i].map(([x, y]) => [x + mag * Math.cos(a), y + mag * Math.sin(a)]);
    return { expect: "position", target: c, paths: p, note: `shift ${i + 1}` };
  },

  confuse: (d, c, r) => {
    const others = (d.confusables[c] ?? []).filter((x) => d.kanji[x]);
    if (others.length === 0) return null;
    const o = others[pick(r, others.length)];
    return { expect: "confusion", target: c, paths: refOf(d, o), note: `wrote ${o}` };
  },
};

export function refOf(d: KanjiData, c: string): Path[] {
  return clone(d.kanji[c].strokes.map((s) => s.points));
}
