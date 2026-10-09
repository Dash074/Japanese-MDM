import { meanPointDist, resample, reversed } from "./geometry";
import { CONFIG } from "./config";
import type { InputStroke, KanjiEntry } from "./types";

export type LiveVerdict = { ok: boolean; refStroke: number; reason?: "direction" | "shape" | "extra" };

/** Live tolerance in canvas-frame units (the writing cell is the 1×1 reference box). */
const LIVE_TOLERANCE = 0.14;

/**
 * Live per-stroke check (FR-07): compares the newest stroke against the *expected next*
 * reference stroke in the writing cell's own frame (the cell maps 1:1 onto the KanjiVG box).
 * Cheap and order-aware; the full analysis still runs on Check.
 */
export function checkLastStroke(entry: KanjiEntry, strokes: InputStroke[], size: number): LiveVerdict {
  const j = strokes.length - 1;
  if (j >= entry.strokes.length) return { ok: false, refStroke: j, reason: "extra" };
  const u = resample(strokes[j].map((p) => [p.x / size, p.y / size]), CONFIG.resampleN);
  const r = entry.strokes[j].points;
  const fwd = meanPointDist(u, r), rev = meanPointDist(reversed(u), r);
  if (rev < fwd - CONFIG.directionMargin && rev < LIVE_TOLERANCE) return { ok: false, refStroke: j, reason: "direction" };
  return fwd < LIVE_TOLERANCE ? { ok: true, refStroke: j } : { ok: false, refStroke: j, reason: "shape" };
}
