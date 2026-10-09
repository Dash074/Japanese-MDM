import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { analyze } from "../../core/analyze";
import { checkLastStroke, type LiveVerdict } from "../../core/live";
import type { Grade } from "../../core/scheduler";
import type { Analysis, Device, InputStroke, KanjiData } from "../../core/types";
import { GUIDE_LEVELS, useProgress, type GuideLevel, type Mode } from "../../lib/progress";
import { saveStrokes } from "../../lib/strokeStore";
import { InkCanvas } from "../../ui/InkCanvas";
import { KanjiGlyph } from "../../ui/KanjiGlyph";
import { Button, Card, Hanko, Pill } from "../../ui/primitives";
import { ERROR_LABEL, LEVEL_LABEL } from "./labels";
import { Replay } from "./Replay";

type Props = {
  data: KanjiData;
  char: string;
  level: GuideLevel;
  mode: Mode;
  /** Small label above the prompt, e.g. "復習 · 3 / 12". */
  eyebrow: string;
  /** A look-alike to show as "not this one" (confusion / proportion drills). */
  contrast?: string;
  /** Computes the automatic FSRS grade (review mode). */
  rate?: (a: Analysis) => Grade;
  /** Extra content in the result panel (e.g. grade buttons). */
  resultExtra?: (a: Analysis) => ReactNode;
  /** Label + handler for the primary button after Check; Enter also triggers it. */
  continueLabel?: string;
  onContinue: (a: Analysis) => void;
  /** Allow "Again" (rewrite the same kanji) after Check. */
  allowRetry?: boolean;
  /** false disables the continue button and Enter (e.g. until a grade is chosen). */
  canContinue?: boolean;
  /** Extra controls below the canvas (e.g. level chips). */
  toolbar?: ReactNode;
};

/** Shared writing surface + analysis + feedback for Practice, Review and Drill. */
export function WritingExercise(p: Props) {
  const { data, char, level } = p;
  const entry = data.kanji[char];
  const record = useProgress((s) => s.record);
  const settings = useProgress((s) => s.settings);
  const setSettings = useProgress((s) => s.setSettings);
  /** Study control group: correct/incorrect only, no explanations (implementation.md §7.5). */
  const control = settings.study === "control";

  const [strokes, setStrokes] = useState<InputStroke[]>([]);
  const [device, setDevice] = useState<Device>("mouse");
  const [size, setSize] = useState(0);
  const [result, setResult] = useState<Analysis | null>(null);
  /** Guide level this attempt was written at (the stored level may change once it is recorded). */
  const [attemptLevel, setAttemptLevel] = useState<GuideLevel | null>(null);
  const [flash, setFlash] = useState<LiveVerdict | null>(null);
  const [replaying, setReplaying] = useState(false);

  const reset = useCallback(() => {
    setStrokes([]);
    setResult(null);
    setFlash(null);
    setReplaying(false);
    setAttemptLevel(null);
  }, []);

  // Reset when the kanji or the chosen level changes, but not when recording this attempt
  // promoted/demoted the guide level: the result must stay on screen (new level applies next time).
  const resultRef = useRef(result);
  resultRef.current = result;
  const prevChar = useRef(char);
  useEffect(() => {
    if (prevChar.current === char && resultRef.current) return;
    prevChar.current = char;
    reset();
  }, [char, level, reset]);

  const { rate, mode, onContinue, canContinue } = p;
  const check = useCallback(() => {
    if (!strokes.length || result) return;
    const a = analyze(data, { target: char, strokes, device, size });
    setResult(a);
    setAttemptLevel(level);
    const id = record(a, { mode, level, device, strokes: strokes.length, auto: rate?.(a) });
    void saveStrokes(id, { size, device, strokes });
  }, [strokes, result, data, char, device, size, record, mode, level, rate]);

  const undo = useCallback(() => {
    if (result) return;
    setStrokes((s) => s.slice(0, -1));
    setFlash(null);
  }, [result]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (!result) check();
        else if (canContinue !== false) onContinue(result);
      } else if (e.key === "Escape") reset();
      else if ((e.ctrlKey || e.metaKey) && e.key === "z") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [check, reset, undo, result, onContinue, canContinue]);

  const onStrokeEnd = (next: InputStroke[]) => {
    if (control || !settings.live || level === "recall" || !size) return;
    const v = checkLastStroke(entry, next, size);
    setFlash(v.ok ? null : v);
  };

  // Which user / reference strokes to highlight in the result.
  const { userBad, refBad } = useMemo(() => {
    const userBad = new Map<number, string>(), refBad: Record<number, string> = {};
    if (control) return { userBad, refBad };
    result?.errors.forEach((e) => {
      const color = e.severity === "major" ? "var(--shu)" : "var(--kincha)";
      if (e.userStroke !== undefined && userBad.get(e.userStroke) !== "var(--shu)") userBad.set(e.userStroke, color);
      if (e.refStroke !== undefined && refBad[e.refStroke] !== "var(--shu)") refBad[e.refStroke] = color;
    });
    return { userBad, refBad };
  }, [result, control]);

  const clean = result && result.errors.length === 0;
  // Recall prompt: a word in context with the target masked (□手 みぎて "right hand"), else a bare reading.
  const cue = entry.examples?.find((e) => e.word.length > 1) ?? entry.examples?.[0];
  const masked = cue ? [...cue.word].map((ch) => (ch === char ? "□" : ch)).join("") : "";
  const reading = entry.kunyomi[0]?.replace(/\..*/, "").replace(/-/g, "") || entry.onyomi[0] || "";
  const contrast = p.contrast ? data.kanji[p.contrast] : undefined;

  return (
    <section className="grid gap-6 md:grid-cols-[minmax(0,440px)_1fr]">
      <div>
        {/* Prompt */}
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">{p.eyebrow} · {LEVEL_LABEL[level].en}</p>
            {level === "recall" && !result ? (
              cue ? (
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-kanji text-4xl" aria-label={`Write the missing kanji in ${cue.reading}`}>{masked}</span>
                  <span className="font-mincho text-xl font-bold">{cue.reading}</span>
                  <span className="text-ink-muted">“{cue.meaning}”</span>
                </p>
              ) : (
                <p className="font-mincho text-2xl font-bold">
                  {reading} <span className="text-base font-normal text-ink-muted">· “{entry.meanings[0]}”</span>
                </p>
              )
            ) : (
              <p className="flex items-baseline gap-3">
                <span className="font-kanji text-4xl">{char}</span>
                <span className="text-ink-muted">“{entry.meanings[0]}” · {entry.strokes.length} strokes</span>
              </p>
            )}
          </div>
          {contrast ? (
            <div className="flex items-center gap-2 rounded-sm border border-dashed border-shu/50 px-2 py-1" title="Don't confuse with this one">
              <span className="text-xs text-shu">not</span>
              <span className="font-kanji text-2xl text-ink-muted">{contrast.char}</span>
              {contrast.meanings[0] && <span className="text-xs text-ink-muted">“{contrast.meanings[0]}”</span>}
            </div>
          ) : (
            <Link to={`/kanji/${char}`} className="text-sm text-ai hover:underline">details →</Link>
          )}
        </div>

        {/* Writing surface */}
        <div className="relative">
          <InkCanvas
            strokes={strokes}
            onChange={(s, d) => {
              setStrokes(s);
              setDevice(d);
            }}
            onStrokeEnd={onStrokeEnd}
            disabled={!!result}
            onSize={setSize}
          >
            {!result && level === "trace" && <KanjiGlyph entry={entry} color="var(--ai)" opacity={0.2} numbers bare />}
            {!result && level === "hint" && <KanjiGlyph entry={entry} upTo={1} color="var(--ai)" opacity={0.25} numbers bare />}
            {result && <KanjiGlyph entry={entry} color="var(--ink-muted)" opacity={0.18} bare />}
          </InkCanvas>
          {result && size > 0 && !replaying && (
            <svg viewBox={`0 0 ${size} ${size}`} className="pointer-events-none absolute inset-0 h-full w-full">
              {strokes.map((s, i) =>
                userBad.has(i) ? (
                  <polyline key={i} points={s.map((q) => `${q.x},${q.y}`).join(" ")} fill="none" stroke={userBad.get(i)}
                    strokeWidth={Math.max(4, size * 0.026)} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
                ) : null,
              )}
            </svg>
          )}
          {replaying && (
            <div className="absolute inset-0 rounded-sm bg-surface">
              <Replay strokes={strokes} size={size} onDone={() => setReplaying(false)} />
            </div>
          )}
          {flash && !result && (
            <p role="status" className="absolute inset-x-3 bottom-3 rounded-sm bg-shu/90 px-3 py-1.5 text-center text-sm text-on-shu">
              {flash.reason === "direction" && `Stroke ${flash.refStroke + 1}: other direction`}
              {flash.reason === "shape" && `Stroke ${flash.refStroke + 1} doesn't look right — undo and retry?`}
              {flash.reason === "extra" && `${char} has only ${entry.strokes.length} strokes`}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!result ? (
            <>
              <Button onClick={undo} disabled={!strokes.length} title="Ctrl+Z">↶ Undo</Button>
              <Button onClick={reset} disabled={!strokes.length} title="Esc">✕ Clear</Button>
              <Button variant="primary" className="ml-auto" onClick={check} disabled={!strokes.length} title="Enter">✓ Check</Button>
            </>
          ) : (
            <>
              <Button onClick={() => setReplaying(true)} disabled={replaying}>▶ Replay mine</Button>
              {p.allowRetry && <Button onClick={reset}>↺ Again</Button>}
              <Button variant="primary" className="ml-auto" onClick={() => onContinue(result)} title="Enter" disabled={p.canContinue === false}>
                {p.continueLabel ?? "Next →"}
              </Button>
            </>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
          {p.toolbar}
          {!control && (
            <label className="ml-auto flex items-center gap-1.5 text-ink-muted">
              <input type="checkbox" checked={settings.live} onChange={(e) => setSettings({ live: e.target.checked })}
                className="accent-[var(--shu)]" />
              Live check
            </label>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-muted">{LEVEL_LABEL[level].help} Input: {device}.</p>
      </div>

      {/* Feedback */}
      <div className="space-y-4">
        {!result ? (
          <Card>
            <p className="font-mincho text-lg">一画一画、丁寧に。</p>
            <p className="mt-1 text-sm text-ink-muted">
              Write each stroke carefully, then press <b>Check</b> (or Enter).
              {control
                ? " You'll see whether it was correct, next to the model."
                : " You'll see which stroke went wrong and why: order, direction, count, length, position, or a look-alike kanji."}
            </p>
          </Card>
        ) : (
          <>
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">Result</p>
                  <p className="mt-1 font-mincho text-2xl font-bold">
                    {clean
                      ? "Beautiful — no mistakes."
                      : control
                        ? "Not quite. Compare with the model."
                        : result.bestMatch !== char
                        ? "Look-alike!"
                        : `${result.errors.length} thing${result.errors.length > 1 ? "s" : ""} to fix`}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {!control && `Shape match ${Math.round(result.score * 100)}% · `}
                    {(result.timing.totalMs / 1000).toFixed(1)} s
                    {result.timing.hesitationMs > 0 && ` · paused ${(result.timing.hesitationMs / 1000).toFixed(1)} s`}
                  </p>
                </div>
                {clean && <Hanko char={result.score > 0.93 ? "優" : "良"} />}
              </div>
              {!clean && !control && (
                <ul className="mt-4 space-y-2">
                  {result.errors.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Pill tone={e.severity === "major" ? "shu" : "muted"}>{ERROR_LABEL[e.type]}</Pill>
                      <span className="pt-0.5">{e.message}</span>
                    </li>
                  ))}
                </ul>
              )}
              {attemptLevel && attemptLevel !== level && (
                <p className="mt-4 text-sm" role="status">
                  {GUIDE_LEVELS.indexOf(level) > GUIDE_LEVELS.indexOf(attemptLevel) ? (
                    <span className="text-matcha">▲ Guide level up → {LEVEL_LABEL[level].jp} {LEVEL_LABEL[level].en}. Less help next time.</span>
                  ) : (
                    <span className="text-ink-muted">▼ Guide level → {LEVEL_LABEL[level].jp} {LEVEL_LABEL[level].en}. More help next time.</span>
                  )}
                </p>
              )}
              {p.resultExtra?.(result)}
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">
                Model{Object.keys(refBad).length ? " · strokes to fix highlighted" : ""}
              </p>
              <div className="mt-2 flex items-center gap-6">
                <KanjiGlyph entry={entry} numbers highlight={refBad} className="h-36 w-36 rounded-sm bg-bg" />
                {!control && result.bestMatch !== char && (
                  <div className="text-center">
                    <KanjiGlyph entry={data.kanji[result.bestMatch]} color="var(--ink-muted)" className="h-24 w-24 rounded-sm bg-bg" />
                    <p className="mt-1 text-xs text-ink-muted">you wrote {result.bestMatch}</p>
                  </div>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </section>
  );
}
