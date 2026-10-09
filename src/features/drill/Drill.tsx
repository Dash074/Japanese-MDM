import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { describe, drillFor, type Recommendation } from "../../core/recommender";
import type { KanjiData } from "../../core/types";
import { Button, Card, Hanko, Heading } from "../../ui/primitives";
import { WritingExercise } from "../practice/WritingExercise";

export const drillLink = (r: Recommendation) => `/drill?r=${encodeURIComponent(JSON.stringify(r))}`;

/** 特訓 — targeted drills generated from recommendations (FR-11, FR-12). */
export function Drill({ data }: { data: KanjiData }) {
  const [params] = useSearchParams();
  const rec = useMemo<Recommendation | null>(() => {
    try {
      return JSON.parse(params.get("r") ?? "null");
    } catch {
      return null;
    }
  }, [params]);
  const items = useMemo(() => (rec ? drillFor(data, rec).filter((d) => data.kanji[d.char]?.taught) : []), [data, rec]);
  const [i, setI] = useState(0);
  const [clean, setClean] = useState(0);

  if (!rec || items.length === 0)
    return (
      <section className="py-12 text-center">
        <p className="text-ink-muted">No drill selected.</p>
        <Link to="/" className="text-ai hover:underline">Back to Today</Link>
      </section>
    );

  const info = describe(data, rec);
  if (i >= items.length)
    return (
      <section className="mx-auto max-w-md space-y-5 py-8 text-center">
        <div className="flex justify-center"><Hanko char={clean === items.length ? "優" : "済"} size={96} /></div>
        <Heading jp="特訓完了" en="Drill complete" className="justify-center" />
        <p className="text-ink-muted">{clean} of {items.length} written without mistakes.</p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => { setI(0); setClean(0); }}>↺ Repeat</Button>
          <Link to="/"><Button variant="primary">今日 · Today</Button></Link>
        </div>
      </section>
    );

  const item = items[i];
  return (
    <div className="space-y-4">
      <Card className="!py-3">
        <p className="font-mincho font-bold">{info.title}</p>
        <p className="text-sm text-ink-muted">{info.body}</p>
      </Card>
      <WritingExercise
        key={i}
        data={data}
        char={item.char}
        level={item.level}
        contrast={item.contrast}
        mode="drill"
        eyebrow={`特訓 Drill · ${i + 1} / ${items.length}`}
        allowRetry
        onContinue={(a) => {
          if (a.errors.length === 0) setClean((c) => c + 1);
          setI((x) => x + 1);
        }}
      />
    </div>
  );
}
