import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { KanjiData } from "../../core/types";
import { GUIDE_LEVELS, pickNext, progressOf, useProgress, type GuideLevel } from "../../lib/progress";
import { LEVEL_LABEL } from "./labels";
import { WritingExercise } from "./WritingExercise";

/** Free practice on any kanji, at the learner's guide level or one they choose. */
export function Practice({ data }: { data: KanjiData }) {
  const params = useParams();
  const navigate = useNavigate();
  const progress = useProgress((s) => s.kanji);
  const char = params.char && data.kanji[params.char]?.taught ? params.char : pickNext(data, progress);
  const [levelOverride, setLevelOverride] = useState<GuideLevel | null>(null);
  const level = levelOverride ?? progressOf(progress, char).level;

  useEffect(() => setLevelOverride(null), [char]);

  return (
    <WritingExercise
      data={data}
      char={char}
      level={level}
      mode="practice"
      eyebrow="練習 Practice"
      allowRetry
      onContinue={() => navigate(`/practice/${pickNext(data, useProgress.getState().kanji, char)}`)}
      toolbar={GUIDE_LEVELS.map((l) => (
        <button
          key={l}
          onClick={() => setLevelOverride(l)}
          className={`rounded-full border px-2.5 py-1 ${l === level ? "border-ai bg-ai/10 text-ai" : "border-grid text-ink-muted hover:text-ink"}`}
        >
          {LEVEL_LABEL[l].jp} {LEVEL_LABEL[l].en}
        </button>
      ))}
    />
  );
}
