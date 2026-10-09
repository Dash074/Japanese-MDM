import { createStore, del, entries, get, keys, set, type UseStore } from "idb-keyval";
import type { Device, InputStroke } from "../core/types";

/**
 * Raw pen data per attempt (FR-14), kept in IndexedDB rather than localStorage because it is
 * ~10× larger than the attempt summary. Compact encoding: integer px, per-stroke relative ms,
 * pressure ×100. Only the newest MAX attempts are kept.
 */
export type RawAttempt = { size: number; device: Device; strokes: InputStroke[] };
type Encoded = { s: number; d: Device; t0: number; k: number[][][] }; // k: stroke → [x, y, dt, p?]

const MAX = 500;
let store: UseStore | null = null;
const db = () => (store ??= createStore("fude-strokes", "attempts"));
const available = () => typeof indexedDB !== "undefined";

export function encode(r: RawAttempt): Encoded {
  const t0 = r.strokes[0]?.[0]?.t ?? 0;
  return {
    s: Math.round(r.size),
    d: r.device,
    t0,
    k: r.strokes.map((s) =>
      s.map((p) => {
        const row = [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.t - t0)];
        if (p.p !== undefined) row.push(Math.round(p.p * 100));
        return row;
      }),
    ),
  };
}

export function decode(e: Encoded): RawAttempt {
  return {
    size: e.s,
    device: e.d,
    strokes: e.k.map((s) => s.map(([x, y, dt, p]) => ({ x, y, t: e.t0 + dt, ...(p !== undefined ? { p: p / 100 } : {}) }))),
  };
}

export async function saveStrokes(id: string, r: RawAttempt): Promise<void> {
  if (!available()) return;
  try {
    await set(id, { at: Date.now(), e: encode(r) }, db());
    const all = await keys(db());
    if (all.length > MAX * 1.1) {
      const dated = (await entries<string, { at: number }>(db())).sort((a, b) => a[1].at - b[1].at);
      await Promise.all(dated.slice(0, dated.length - MAX).map(([k]) => del(k, db())));
    }
  } catch {
    /* storage full or blocked — raw strokes are best-effort */
  }
}

export async function loadStrokes(id: string): Promise<RawAttempt | undefined> {
  if (!available()) return undefined;
  try {
    const v = await get<{ e: Encoded }>(id, db());
    return v ? decode(v.e) : undefined;
  } catch {
    return undefined;
  }
}

export async function loadAllStrokes(): Promise<Record<string, RawAttempt>> {
  if (!available()) return {};
  try {
    return Object.fromEntries((await entries<string, { e: Encoded }>(db())).map(([k, v]) => [k, decode(v.e)]));
  } catch {
    return {};
  }
}
