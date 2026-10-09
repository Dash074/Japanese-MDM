import type { KanjiEntry } from "../core/types";

/** Example words with the kanji highlighted, reading in small kana above (ruby). */
export function ExampleWords({ entry, className = "" }: { entry: KanjiEntry; className?: string }) {
  if (!entry.examples?.length) return null;
  return (
    <ul className={`space-y-1.5 ${className}`}>
      {entry.examples.map((e) => (
        <li key={e.word} className="flex items-baseline gap-3">
          <ruby className="font-kanji text-xl">
            {[...e.word].map((ch, i) => (
              <span key={i} className={ch === entry.char ? "text-shu" : undefined}>{ch}</span>
            ))}
            <rt className="text-[10px] text-ink-muted">{e.reading}</rt>
          </ruby>
          <span className="text-sm text-ink-muted">{e.meaning}</span>
        </li>
      ))}
    </ul>
  );
}
