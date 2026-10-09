import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ErrorType, KanjiData } from "../../core/types";
import { progressOf, useProgress } from "../../lib/progress";
import { GenkoGrid } from "../../ui/InkCanvas";
import { KanjiGlyph } from "../../ui/KanjiGlyph";
import { ExampleWords } from "../../ui/ExampleWords";
import { Button, Card, Pill } from "../../ui/primitives";
import { ERROR_LABEL } from "../practice/labels";

export function KanjiDetail({ data }: { data: KanjiData }) {
  const { char = "" } = useParams();
  const entry = data.kanji[char];
  const [play, setPlay] = useState(1);
  const p = useProgress((s) => progressOf(s.kanji, char));
  if (!entry?.taught) return <p className="py-20 text-center">This kanji is not in the N5 scope.</p>;

  const errs = Object.entries(p.errors) as [ErrorType, number][];
  return (
    <section className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
      <div>
        <div className="relative aspect-square w-full rounded-sm bg-surface">
          <svg viewBox="0 0 109 109" className="absolute inset-0 h-full w-full">
            <GenkoGrid />
            <KanjiGlyph key={play} entry={entry} animate={0.6} numbers bare />
          </svg>
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => setPlay((x) => x + 1)}>▶ Replay</Button>
          <Link to={`/practice/${char}`} className="flex-1">
            <Button variant="primary" className="w-full">練習 Practice</Button>
          </Link>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <p className="font-mincho text-3xl font-bold">{entry.meanings.slice(0, 3).join(", ")}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {entry.strokes.length} strokes{entry.grade ? ` · school grade ${entry.grade}` : ""}
          </p>
        </div>
        <Card>
          <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-muted">音読み on</dt>
            <dd className="font-kanji text-lg">{entry.onyomi.join("、") || "—"}</dd>
            <dt className="text-ink-muted">訓読み kun</dt>
            <dd className="font-kanji text-lg">{entry.kunyomi.join("、") || "—"}</dd>
            <dt className="text-ink-muted">部品 parts</dt>
            <dd className="font-kanji text-lg">{entry.components.join(" ") || "—"}</dd>
          </dl>
        </Card>
        <Card>
          <h2 className="text-sm font-bold">例 · Example words</h2>
          <ExampleWords entry={entry} className="mt-3" />
        </Card>
        <Card>
          <h2 className="text-sm font-bold">似ている漢字 · Look-alikes</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(data.confusables[char] ?? []).map((c) =>
              data.kanji[c]?.taught ? (
                <Link key={c} to={`/kanji/${c}`} className="rounded-sm border border-grid px-2.5 py-1 font-kanji text-xl hover:border-shu">
                  {c}
                </Link>
              ) : (
                <span
                  key={c}
                  className="rounded-sm border border-dashed border-grid px-2.5 py-1 font-kanji text-xl text-ink-muted"
                  title="Not in N5 (look-alike only)"
                >
                  {c}
                </span>
              ),
            )}
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-bold">あなたの記録 · Your record</h2>
          {p.attempts === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Not practised yet.</p>
          ) : (
            <div className="mt-2 space-y-2 text-sm">
              <p>
                {p.attempts} attempts · {p.clean} clean · guide <Pill tone="ai">{p.level}</Pill>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {errs.map(([t, n]) => (
                  <Pill key={t} tone="shu">
                    {ERROR_LABEL[t]} × {n}
                  </Pill>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
