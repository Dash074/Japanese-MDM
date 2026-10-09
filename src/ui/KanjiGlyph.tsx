import type { KanjiEntry } from "../core/types";

type Props = {
  entry: KanjiEntry;
  /** Draw only the first n strokes (hint mode). */
  upTo?: number;
  color?: string;
  opacity?: number;
  numbers?: boolean;
  /** Stroke-order animation; seconds per stroke. */
  animate?: number;
  /** Ref stroke index → highlight colour. */
  highlight?: Record<number, string>;
  /** Render as a bare <g> for embedding inside another 109×109 SVG. */
  bare?: boolean;
  className?: string;
};

/** Reference kanji from KanjiVG paths (viewBox 109×109). */
export function KanjiGlyph({ entry, upTo, color = "var(--ink)", opacity = 1, numbers, animate, highlight = {}, bare, className }: Props) {
  const strokes = entry.strokes.slice(0, upTo ?? entry.strokes.length);
  const g = (
    <g opacity={opacity} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {strokes.map((s, i) => (
        <path
          key={`${entry.char}-${i}-${animate ?? 0}`}
          d={s.d}
          stroke={highlight[i] ?? color}
          strokeWidth={highlight[i] ? 4.5 : 3.2}
          pathLength={1}
          style={
            animate
              ? { strokeDasharray: 1, strokeDashoffset: 1, animation: `draw ${animate}s ease-in-out ${i * animate}s forwards` }
              : undefined
          }
        />
      ))}
      {numbers &&
        strokes.map((s, i) => {
          const [x, y] = s.points[0];
          return (
            <text key={`n${i}`} x={x * 109 - 3} y={y * 109 - 2} fontSize="6.5" fill="var(--shu)" stroke="none"
              fontFamily="Zen Kaku Gothic New, sans-serif" fontWeight={700} textAnchor="end">
              {i + 1}
            </text>
          );
        })}
    </g>
  );
  if (bare) return g;
  return (
    <svg viewBox="0 0 109 109" className={className} role="img" aria-label={`Kanji ${entry.char}`}>
      {g}
    </svg>
  );
}
