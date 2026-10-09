import { Link } from "react-router-dom";
import type { KanjiData } from "../../core/types";
import { mastery, progressOf, useProgress } from "../../lib/progress";
import { Heading } from "../../ui/primitives";

const TINT = ["border-grid bg-surface", "border-ai/40 bg-ai/10", "border-matcha/50 bg-matcha/15"];

export function Library({ data }: { data: KanjiData }) {
  const progress = useProgress((s) => s.kanji);
  const counts = [0, 0, 0];
  data.scope.forEach((c) => counts[mastery(progressOf(progress, c))]++);
  return (
    <section>
      <Heading jp="漢字帳" en="Kanji book · JLPT N5" />
      <p className="mt-2 text-sm text-ink-muted">
        {data.scope.length} kanji · <span className="text-ai">{counts[1]} learning</span> ·{" "}
        <span className="text-matcha">{counts[2]} mastered</span>
      </p>
      <ul className="mt-6 grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
        {data.scope.map((c) => (
          <li key={c}>
            <Link
              to={`/kanji/${c}`}
              title={data.kanji[c].meanings[0]}
              className={`grid aspect-square place-items-center rounded-sm border font-kanji text-2xl transition hover:-translate-y-0.5 hover:border-shu sm:text-3xl ${TINT[mastery(progressOf(progress, c))]}`}
            >
              {c}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
