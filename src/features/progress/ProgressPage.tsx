import { Link } from "react-router-dom";
import type { ErrorType, KanjiData } from "../../core/types";
import { mastery, progressOf, useProgress } from "../../lib/progress";
import { Card, Heading } from "../../ui/primitives";
import { drillLink } from "../drill/Drill";
import { ERROR_LABEL } from "../practice/labels";

const DAY = 86400000;
const ERROR_ORDER: ErrorType[] = ["order", "direction", "count", "proportion", "position", "ending", "confusion"];

/** 成績 — progress dashboard (FR-13). */
export function ProgressPage({ data }: { data: KanjiData }) {
  const { kanji, cards, log, confusions, settings } = useProgress();
  const control = settings.study === "control"; // study control group: no error analytics
  const now = Date.now();

  const levels = [0, 0, 0];
  data.scope.forEach((c) => levels[mastery(progressOf(kanji, c))]++);

  // Error-type breakdown over the last 30 days, as % of attempts.
  const recent = log.filter((e) => now - e.at < 30 * DAY);
  const errorCounts = ERROR_ORDER.map((t) => ({ t, n: recent.filter((e) => e.errors.includes(t)).length }));
  const maxErr = Math.max(1, ...errorCounts.map((e) => e.n));
  const cleanRate = recent.length ? recent.filter((e) => e.errors.length === 0).length / recent.length : 0;

  // Reviews due per day over the next 7 days (overdue counted today).
  const forecast = Array.from({ length: 7 }, (_, d) => {
    const end = startOfDay(now) + (d + 1) * DAY;
    const start = d === 0 ? -Infinity : end - DAY;
    return Object.values(cards).filter((c) => c.due >= start && c.due < end).length;
  });
  const maxF = Math.max(1, ...forecast);

  // Attempts per day over the last 14 days.
  const activity = Array.from({ length: 14 }, (_, k) => {
    const start = startOfDay(now) - (13 - k) * DAY;
    return log.filter((e) => e.at >= start && e.at < start + DAY).length;
  });
  const maxA = Math.max(1, ...activity);

  const pairs = Object.entries(confusions).sort((a, b) => b[1] - a[1]);
  const struggling = data.scope
    .filter((c) => kanji[c]?.attempts >= 2)
    .map((c) => ({ c, rate: 1 - kanji[c].clean / kanji[c].attempts }))
    .filter((x) => x.rate > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10);

  return (
    <section className="space-y-6">
      <Heading jp="成績" en="Progress" />

      <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_1fr]">
        <Card className="flex flex-col items-center gap-3">
          <MasteryRing total={data.scope.length} learning={levels[1]} mastered={levels[2]} />
          <div className="flex gap-4 text-xs">
            <span className="text-matcha">● {levels[2]} mastered</span>
            <span className="text-ai">● {levels[1]} learning</span>
            <span className="text-ink-muted">● {levels[0]} new</span>
          </div>
        </Card>
        <Card className={control ? "hidden" : ""}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-mincho text-lg font-bold">誤りの種類 · Mistakes by type</h2>
            <span className="text-xs text-ink-muted">last 30 days · {recent.length} attempts · {Math.round(cleanRate * 100)}% clean</span>
          </div>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No attempts yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {errorCounts.map(({ t, n }) => (
                <li key={t} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 sm:w-48">{ERROR_LABEL[t]}</span>
                  <span className="h-2.5 flex-1 rounded-full bg-grid">
                    <span className="block h-2.5 rounded-full bg-shu" style={{ width: `${(n / maxErr) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right tabular-nums text-ink-muted">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-mincho text-lg font-bold">予定 · Reviews in the next 7 days</h2>
          <Bars values={forecast} max={maxF} labels={forecast.map((_, d) => (d === 0 ? "today" : dayName(now + d * DAY)))} tone="bg-ai" />
        </Card>
        <Card>
          <h2 className="font-mincho text-lg font-bold">活動 · Attempts, last 14 days</h2>
          <Bars values={activity} max={maxA} labels={activity.map((_, k) => (k === 13 ? "today" : k % 2 === 1 ? "" : dayName(now - (13 - k) * DAY)))} tone="bg-kincha" />
        </Card>
      </div>

      <div className={`grid gap-4 md:grid-cols-2 ${control ? "hidden" : ""}`}>
        <Card>
          <h2 className="font-mincho text-lg font-bold">混同グラフ · Confusion graph</h2>
          {pairs.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">No look-alike mix-ups recorded.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {pairs.map(([key, n]) => {
                const [target, wrote] = key.split("→");
                return (
                  <li key={key}>
                    <Link
                      to={drillLink({ kind: "confusion", target, wrote, count: n })}
                      className="flex items-center gap-1.5 rounded-sm border border-grid px-2.5 py-1 hover:border-shu"
                      title="Start a drill for this pair"
                    >
                      <span className="font-kanji text-xl">{target}</span>
                      <span className="text-shu">→</span>
                      <span className="font-kanji text-xl text-shu">{wrote}</span>
                      <span className="text-xs text-ink-muted">×{n}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="font-mincho text-lg font-bold">苦手 · Hardest kanji for you</h2>
          {struggling.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Practise a kanji at least twice to see it here.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-5 gap-2">
              {struggling.map(({ c, rate }) => (
                <li key={c}>
                  <Link to={`/kanji/${c}`} className="flex flex-col items-center rounded-sm border border-grid py-1.5 hover:border-shu">
                    <span className="font-kanji text-2xl">{c}</span>
                    <span className="text-[10px] text-shu">{Math.round(rate * 100)}% err</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}

function MasteryRing({ total, learning, mastered }: { total: number; learning: number; mastered: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const m = (mastered / total) * c, l = (learning / total) * c;
  return (
    <svg viewBox="0 0 128 128" className="h-44 w-44" role="img" aria-label={`${mastered} of ${total} mastered`}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="var(--grid)" strokeWidth="12" />
      <circle cx="64" cy="64" r={r} fill="none" stroke="var(--ai)" strokeWidth="12" strokeDasharray={`${m + l} ${c}`} transform="rotate(-90 64 64)" opacity={0.55} />
      <circle cx="64" cy="64" r={r} fill="none" stroke="var(--matcha)" strokeWidth="12" strokeDasharray={`${m} ${c}`} transform="rotate(-90 64 64)" />
      <text x="64" y="62" textAnchor="middle" fontFamily="Shippori Mincho, serif" fontSize="26" fontWeight="700" fill="var(--ink)">{mastered}</text>
      <text x="64" y="80" textAnchor="middle" fontSize="10" fill="var(--ink-muted)">of {total} mastered</text>
    </svg>
  );
}

function Bars({ values, max, labels, tone }: { values: number[]; max: number; labels: string[]; tone: string }) {
  return (
    <div className="mt-4 flex h-36 items-end gap-1.5">
      {values.map((v, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] tabular-nums text-ink-muted">{v || ""}</span>
          <div className={`w-full rounded-t-sm ${tone}`} style={{ height: `${(v / max) * 80}%`, minHeight: v ? 3 : 0 }} />
          <span className="h-3 text-[10px] text-ink-muted">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const dayName = (t: number) => new Date(t).toLocaleDateString("en", { weekday: "short" });
