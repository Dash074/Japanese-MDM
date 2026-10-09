import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { autoRate, formatInterval, GRADE_LABEL, newCard, preview, type Grade } from "../../core/scheduler";
import type { Analysis, KanjiData } from "../../core/types";
import { baseline, progressOf, reviewQueue, useProgress } from "../../lib/progress";
import { GenkoGrid } from "../../ui/InkCanvas";
import { ExampleWords } from "../../ui/ExampleWords";
import { KanjiGlyph } from "../../ui/KanjiGlyph";
import { Button, Card, Hanko, Heading } from "../../ui/primitives";
import { WritingExercise } from "../practice/WritingExercise";

type Item = { char: string; isNew: boolean; retry?: boolean };

/** 復習 — FSRS review session with automatic grading (FR-08, FR-09). */
export function Review({ data }: { data: KanjiData }) {
  const store = useProgress();
  const manual = store.settings.study === "control";
  // Snapshot the queue when the session starts so it doesn't shift under the learner.
  const [queue, setQueue] = useState<Item[]>(() => {
    const q = reviewQueue(data.scope, useProgress.getState());
    return [...q.due.map((char) => ({ char, isNew: false })), ...q.fresh.map((char) => ({ char, isNew: true }))];
  });
  const [i, setI] = useState(0);
  const [intro, setIntro] = useState(true);
  const [override, setOverride] = useState<Grade | null>(null);
  const [tally, setTally] = useState<Record<Grade, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 });

  const item = queue[i];
  const base = useMemo(() => baseline(store.log), [store.log]);
  const rate = useCallback(
    (a: Analysis) => autoRate(a, data.kanji[a.target].strokes.length, base),
    [data, base],
  );

  if (queue.length === 0) return <Empty data={data} />;
  if (!item) return <Done tally={tally} />;

  const entry = data.kanji[item.char];
  const level = item.isNew && !item.retry ? "trace" : progressOf(store.kanji, item.char).level;
  const eyebrow = `復習 Review · ${i + 1} / ${queue.length}${item.isNew ? " · new" : ""}`;

  if (item.isNew && intro && !item.retry)
    return (
      <section className="mx-auto max-w-xl space-y-5">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">{eyebrow}</p>
        <Heading jp="新しい漢字" en="New kanji" />
        <Card className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative aspect-square w-48 shrink-0 rounded-sm bg-bg">
            <svg viewBox="0 0 109 109" className="absolute inset-0 h-full w-full">
              <GenkoGrid />
              <KanjiGlyph key={item.char} entry={entry} animate={0.6} numbers bare />
            </svg>
          </div>
          <div className="space-y-2">
            <p className="font-mincho text-2xl font-bold">{entry.meanings.slice(0, 3).join(", ")}</p>
            <p className="font-kanji text-lg">
              <span className="text-sm text-ink-muted">訓 </span>{entry.kunyomi.join("、") || "—"}
            </p>
            <p className="font-kanji text-lg">
              <span className="text-sm text-ink-muted">音 </span>{entry.onyomi.join("、") || "—"}
            </p>
            <p className="text-sm text-ink-muted">{entry.strokes.length} strokes. Watch the order, then trace it.</p>
            <ExampleWords entry={entry} className="pt-1" />
          </div>
        </Card>
        <Button variant="primary" className="w-full py-3" onClick={() => setIntro(false)} autoFocus>
          書いてみる · Start writing →
        </Button>
      </section>
    );

  const advance = (a: Analysis) => {
    const g = override ?? rate(a);
    store.grade(item.char, g);
    setTally((t) => ({ ...t, [g]: t[g] + 1 }));
    // Failed cards come back once at the end of the session.
    if (g === 1 && !item.retry) setQueue((q) => [...q, { char: item.char, isNew: item.isNew, retry: true }]);
    setOverride(null);
    setIntro(true);
    setI((x) => x + 1);
  };

  return (
    <WritingExercise
      key={`${i}-${item.char}`}
      data={data}
      char={item.char}
      level={level}
      mode="review"
      eyebrow={eyebrow}
      rate={rate}
      onContinue={advance}
      continueLabel="Next →"
      canContinue={!manual || override !== null}
      resultExtra={(a) => (
        <GradePicker card={store.cards[item.char]} auto={rate(a)} chosen={override} onChoose={setOverride} manual={manual} />
      )}
    />
  );
}

/** Grade buttons. Treatment: auto-grade preselected. Control: learner self-rates (auto still logged). */
function GradePicker({ card, auto, chosen, onChoose, manual }: {
  card?: ReturnType<typeof newCard>; auto: Grade; chosen: Grade | null; onChoose: (g: Grade) => void; manual?: boolean;
}) {
  const intervals = preview(card ?? newCard());
  const active = chosen ?? (manual ? null : auto);
  return (
    <div className="mt-5 border-t border-grid pt-4">
      <p className="text-xs text-ink-muted">
        {manual ? (
          "How well did you remember it?"
        ) : (
          <>Auto-graded <b className="text-ink">{GRADE_LABEL[auto].en}</b>. Tap to override.</>
        )}
      </p>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {([1, 2, 3, 4] as Grade[]).map((g) => (
          <button
            key={g}
            onClick={() => onChoose(g)}
            className={`rounded-sm border px-1 py-1.5 text-center text-xs transition ${
              g === active ? (g === 1 ? "border-shu bg-shu/10 text-shu" : "border-ai bg-ai/10 text-ai") : "border-grid text-ink-muted hover:text-ink"
            }`}
          >
            <span className="block font-mincho text-sm">{GRADE_LABEL[g].jp}</span>
            {GRADE_LABEL[g].en} · {formatInterval(intervals[g])}
          </button>
        ))}
      </div>
    </div>
  );
}

function Done({ tally }: { tally: Record<Grade, number> }) {
  const total = tally[1] + tally[2] + tally[3] + tally[4];
  return (
    <section className="mx-auto max-w-md space-y-6 py-8 text-center">
      <div className="flex justify-center"><Hanko char="済" size={96} /></div>
      <Heading jp="お疲れ様でした" en="Session complete" className="justify-center" />
      <div className="grid grid-cols-4 gap-2">
        {([1, 2, 3, 4] as Grade[]).map((g) => (
          <Card key={g} className="!p-3">
            <p className="font-mincho text-2xl font-bold tabular-nums">{tally[g]}</p>
            <p className="text-xs text-ink-muted">{GRADE_LABEL[g].en}</p>
          </Card>
        ))}
      </div>
      <p className="text-sm text-ink-muted">{total} reviews. Your schedule has been updated.</p>
      <Link to="/"><Button variant="primary">今日に戻る · Back to Today</Button></Link>
    </section>
  );
}

function Empty({ data }: { data: KanjiData }) {
  const cards = useProgress((s) => s.cards);
  const next = Math.min(...Object.values(cards).map((c) => c.due));
  return (
    <section className="mx-auto max-w-md space-y-4 py-12 text-center">
      <Heading jp="復習なし" en="Nothing due" className="justify-center" />
      <p className="text-ink-muted">
        {Number.isFinite(next)
          ? `Next review in ${formatTime(next - Date.now())}. You've also used today's new-kanji allowance.`
          : "You've introduced all the kanji for today."}
      </p>
      <Link to="/practice"><Button variant="primary">自由練習 · Free practice</Button></Link>
      <p className="text-xs text-ink-muted">{data.scope.length - Object.keys(cards).length} N5 kanji not yet introduced.</p>
    </section>
  );
}

const formatTime = (ms: number) => (ms <= 0 ? "a moment" : formatInterval(ms));
