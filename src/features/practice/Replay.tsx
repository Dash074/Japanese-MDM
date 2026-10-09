import { useEffect, useState } from "react";
import type { InputStroke } from "../../core/types";

/** Re-draws the learner's strokes in real time (scaled 1.5× faster), for the replay overlay. */
export function Replay({ strokes, size, onDone }: { strokes: InputStroke[]; size: number; onDone: () => void }) {
  const [now, setNow] = useState(0);
  const t0 = strokes[0]?.[0]?.t ?? 0;
  const end = (strokes.at(-1)?.at(-1)?.t ?? t0) - t0;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - start) * 1.5;
      setNow(elapsed);
      if (elapsed < end + 400) raf = requestAnimationFrame(tick);
      else onDone();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end, onDone]);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="pointer-events-none absolute inset-0 h-full w-full">
      {strokes.map((s, i) => {
        const pts = s.filter((p) => p.t - t0 <= now);
        if (pts.length < 2) return null;
        return (
          <polyline
            key={i}
            points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="var(--ai)"
            strokeWidth={Math.max(3, size * 0.022)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
