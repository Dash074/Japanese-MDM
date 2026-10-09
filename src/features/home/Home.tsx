import { Link } from "react-router-dom";
import { describe, recommend } from "../../core/recommender";
import type { ErrorType, KanjiData } from "../../core/types";
import { mastery, pickNext, progressOf, reviewQueue, useProgress } from "../../lib/progress";
import { Button, Card, Heading } from "../../ui/primitives";
import { drillLink } from "../drill/Drill";
import { ERROR_LABEL } from "../practice/labels";

export function Home({ data }: { data: KanjiData }) {
  const store = useProgress();
  const { kanji: progress, confusions } = store;
  const next = pickNext(data, progress);
  const queue = reviewQueue(data.scope, store);
  // Study control group gets no error-driven guidance (implementation.md §7.5).
  const control = store.settings.study === "control";
  const recs = control ? [] : recommend(data, store.log, queue.due.length).filter((r) => r.kind !== "clear-reviews");
  const practised = data.scope.filter((c) => progressOf(progress, c).attempts > 0);
  const mastered = data.scope.filter((c) => mastery(progressOf(progress, c)) === 2);

  // Aggregate error profile across kanji.
  const totals: Partial<Record<ErrorType, number>> = {};
  for (const c of practised)
    for (const [t, n] of Object.entries(progress[c].errors)) totals[t as ErrorType] = (totals[t as ErrorType] ?? 0) + n;
  const topErrors = (Object.entries(totals) as [ErrorType, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const pairs = Object.entries(confusions).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <section className="space-y-8">
      <div className="seigaiha -mx-4 px-4 py-6 sm:mx-0 sm:rounded-sm sm:px-8 sm:py-8">
        <div className="rounded-sm bg-bg/95 p-5 shadow-sm sm:inline-block sm:p-6">
          <Heading jp="今日" en="Today" />
          <p className="mt-2 max-w-md text-ink-muted">
            Write kanji with your pen, mouse or finger. Fude will tell you <em>which</em> stroke went wrong, and why.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {queue.due.length + queue.fresh.length > 0 ? (
              <Link to="/review">
                <Button variant="primary" className="px-6 py-3 text-base">
                  復習 · Review {queue.due.length > 0 && <b>{queue.due.length} due</b>}
                  {queue.due.length > 0 && queue.fresh.length > 0 && " + "}
                  {queue.fresh.length > 0 && <span>{queue.fresh.length} new</span>}
                </Button>
              </Link>
            ) : (
              <Link to={`/practice/${next}`}>
                <Button variant="primary" className="px-6 py-3 text-base">
                  練習 · Practise <span className="font-kanji text-xl">{next}</span>
                </Button>
              </Link>
            )}
            {queue.due.length + queue.fresh.length > 0 && (
              <Link to={`/practice/${next}`} className="text-sm text-ai hover:underline">or free practice →</Link>
            )}
            <Link to="/quiz" className="text-sm text-ai hover:underline">小テスト quiz →</Link>
          </div>
          {queue.due.length > 20 && (
            <p className="mt-3 text-sm text-shu">{queue.due.length} reviews due. New kanji are paused until you catch up.</p>
          )}
        </div>
      </div>

      {recs.length > 0 && (
        <div>
          <h2 className="mb-3 font-mincho text-lg font-bold">おすすめ · Recommended for you</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {recs.map((r, i) => {
              const d = describe(data, r);
              return (
                <Link key={i} to={drillLink(r)} className="group">
                  <Card className="h-full transition group-hover:border-shu">
                    <p className="font-mincho font-bold">{d.title}</p>
                    <p className="mt-1 text-sm text-ink-muted">{d.body}</p>
                    <p className="mt-3 text-sm text-shu">特訓を始める · Start drill →</p>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Stat jp="練習済" en="Practised" value={practised.length} of={data.scope.length} />
        <Stat jp="習得" en="Mastered" value={mastered.length} of={data.scope.length} tone="text-matcha" />
        <Stat
          jp="試行"
          en="Attempts"
          value={practised.reduce((s, c) => s + progress[c].attempts, 0)}
        />
      </div>

      <div className={`grid gap-4 md:grid-cols-2 ${control ? "hidden" : ""}`}>
        <Card>
          <h2 className="font-mincho text-lg font-bold">弱点 · Your weak spots</h2>
          {topErrors.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">No mistakes recorded yet. Your error profile will appear here.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {topErrors.map(([t, n]) => (
                <li key={t} className="flex items-center gap-3 text-sm">
                  <span className="w-44 shrink-0">{ERROR_LABEL[t]}</span>
                  <span className="h-2 flex-1 rounded-full bg-grid">
                    <span className="block h-2 rounded-full bg-shu" style={{ width: `${(n / topErrors[0][1]) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right tabular-nums text-ink-muted">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="font-mincho text-lg font-bold">混同 · Look-alikes you mix up</h2>
          {pairs.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">None yet. When you write one kanji for another, the pair shows up here.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pairs.map(([key, n]) => {
                const [target, wrote] = key.split("→");
                return (
                  <li key={key} className="flex items-center gap-3">
                    <span className="font-kanji text-2xl">{target}</span>
                    <span className="text-ink-muted">→ wrote</span>
                    <span className="font-kanji text-2xl text-shu">{wrote}</span>
                    <span className="text-xs text-ink-muted">× {n}</span>
                    <Link to={drillLink({ kind: "confusion", target, wrote, count: n })} className="ml-auto text-sm text-ai hover:underline">drill →</Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}

function Stat({ jp, en, value, of, tone = "" }: { jp: string; en: string; value: number; of?: number; tone?: string }) {
  return (
    <Card className="!p-3 sm:!p-5">
      <p className="text-[10px] uppercase tracking-[0.15em] sm:text-xs sm:tracking-[0.2em] text-ink-muted">
        <span className="hidden font-mincho sm:inline">{jp} · </span>{en}
      </p>
      <p className={`mt-1 font-mincho text-2xl sm:text-3xl font-bold tabular-nums ${tone}`}>
        {value}
        {of !== undefined && <span className="text-xs font-normal sm:text-base text-ink-muted"> / {of}</span>}
      </p>
    </Card>
  );
}
