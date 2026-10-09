import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { makeQuiz, type Question } from "../../core/quiz";
import type { KanjiData } from "../../core/types";
import { useProgress } from "../../lib/progress";
import { Button, Card, Hanko, Heading } from "../../ui/primitives";

const KIND_LABEL: Record<Question["kind"], string> = {
  "meaning-to-kanji": "意味 Meaning",
  "word-fill": "穴埋め Fill in",
  "kanji-to-reading": "読み Reading",
};

/** 小テスト — confusion-aware multiple-choice quiz (Objective 7). Keys 1–4 answer, Enter continues. */
export function Quiz({ data }: { data: KanjiData }) {
  const recordQuizConfusion = useProgress((s) => s.recordQuizConfusion);
  // ?seed=N makes a quiz reproducible (tests, study sessions).
  const [params] = useSearchParams();
  const [seed, setSeed] = useState(() => Number(params.get("seed")) || Date.now());
  const questions = useMemo(() => makeQuiz(data, useProgress.getState().log, 10, seed), [data, seed]);
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<Question[]>([]);

  const q = questions[i];
  const answer = useCallback(
    (opt: string) => {
      if (!q || chosen) return;
      setChosen(opt);
      if (opt === q.answer) setScore((s) => s + 1);
      else {
        setMissed((m) => [...m, q]);
        if (data.kanji[opt]) recordQuizConfusion(q.target, opt); // picked a look-alike kanji
      }
    },
    [q, chosen, data, recordQuizConfusion],
  );
  const next = useCallback(() => {
    setChosen(null);
    setI((x) => x + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!q) return;
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length && !chosen) answer(q.options[n - 1]);
      else if (e.key === "Enter" && chosen) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, chosen, answer, next]);

  const restart = () => {
    setSeed(Date.now());
    setI(0);
    setScore(0);
    setMissed([]);
    setChosen(null);
  };

  if (!q)
    return (
      <section className="mx-auto max-w-lg space-y-6 py-6 text-center">
        <div className="flex justify-center">
          <Hanko char={score === questions.length ? "優" : score >= questions.length * 0.7 ? "良" : "済"} size={96} />
        </div>
        <Heading jp="小テスト完了" en="Quiz complete" className="justify-center" />
        <p className="font-mincho text-3xl font-bold tabular-nums">
          {score} <span className="text-base font-normal text-ink-muted">/ {questions.length}</span>
        </p>
        {missed.length > 0 && (
          <Card className="text-left">
            <h2 className="text-sm font-bold">復習しよう · Worth another look</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {[...new Set(missed.map((m) => m.target))].map((c) => (
                <li key={c}>
                  <Link to={`/practice/${c}`} className="block rounded-sm border border-grid px-3 py-1 font-kanji text-2xl hover:border-shu">
                    {c}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <div className="flex justify-center gap-2">
          <Button onClick={restart}>↺ New quiz</Button>
          <Link to="/"><Button variant="primary">今日 · Today</Button></Link>
        </div>
      </section>
    );

  const isKanjiOptions = q.kind !== "kanji-to-reading";
  return (
    <section className="mx-auto max-w-xl space-y-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">
          小テスト Quiz · {i + 1} / {questions.length} · {KIND_LABEL[q.kind]}
        </p>
        <p className="text-sm tabular-nums text-ink-muted">{score} correct</p>
      </div>
      <Card className="py-8 text-center">
        <p className={q.kind === "meaning-to-kanji" ? "font-mincho text-3xl font-bold" : "font-kanji text-5xl"}>{q.prompt.main}</p>
        {q.prompt.sub && <p className="mt-3 text-ink-muted">{q.prompt.sub}</p>}
      </Card>
      <div className="grid grid-cols-2 gap-3" role="group" aria-label="Answers">
        {q.options.map((opt, k) => {
          const state = !chosen ? "" : opt === q.answer ? "border-matcha bg-matcha/15" : opt === chosen ? "border-shu bg-shu/10" : "opacity-50";
          return (
            <button
              key={opt}
              onClick={() => answer(opt)}
              disabled={!!chosen}
              className={`relative rounded-sm border border-grid bg-surface py-4 transition hover:border-ink/40 disabled:cursor-default ${state}`}
            >
              <span className="absolute left-2 top-1.5 text-[10px] text-ink-muted">{k + 1}</span>
              <span className={isKanjiOptions ? "font-kanji text-4xl" : "font-kanji text-2xl"}>{opt}</span>
            </button>
          );
        })}
      </div>
      {chosen && (
        <Card className="flex items-center justify-between gap-4" >
          <p role="status" className="text-sm">
            <b className={chosen === q.answer ? "text-matcha" : "text-shu"}>{chosen === q.answer ? "正解 Correct." : "惜しい Not quite."}</b>{" "}
            {q.explain}
            {chosen !== q.answer && data.kanji[chosen] && ` (${chosen} = “${data.kanji[chosen].meanings[0]}”)`}
          </p>
          <Button variant="primary" onClick={next} autoFocus>
            Next →
          </Button>
        </Card>
      )}
    </section>
  );
}
