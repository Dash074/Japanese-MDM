import { CONFIG } from "./config";
import {
  countErrors,
  directionErrors,
  endingErrors,
  orderErrors,
  positionErrors,
  proportionErrors,
} from "./classifier";
import { pathLength } from "./geometry";
import { match, prepare, type MatchResult } from "./matcher";
import type { Analysis, Attempt, InputStroke, KanjiData, Path } from "./types";

const refCache = new Map<string, Path[]>();
function refPaths(data: KanjiData, char: string): Path[] {
  let r = refCache.get(char);
  if (!r) {
    r = prepare(data.kanji[char].strokes.map((s) => s.points));
    refCache.set(char, r);
  }
  return r;
}

/** Drop accidental taps; keeps raw strokes aligned with the prepared ones. */
function cleanStrokes(strokes: InputStroke[], size: number): InputStroke[] {
  return strokes.filter((s) => s.length > 0 && pathLength(s.map((p) => [p.x / size, p.y / size])) >= CONFIG.minStrokeLength);
}

export function matchAgainst(data: KanjiData, user: Path[], char: string): MatchResult {
  return match(user, refPaths(data, char));
}

function timing(strokes: InputStroke[]) {
  if (strokes.length === 0) return { totalMs: 0, hesitationMs: 0, meanStrokeMs: 0 };
  const first = strokes[0][0].t, last = strokes[strokes.length - 1].at(-1)!.t;
  let hesitation = 0, drawing = 0;
  strokes.forEach((s, i) => {
    drawing += s.at(-1)!.t - s[0].t;
    if (i > 0) hesitation += Math.max(0, s[0].t - strokes[i - 1].at(-1)!.t - CONFIG.hesitationAllowanceMs);
  });
  return { totalMs: last - first, hesitationMs: hesitation, meanStrokeMs: drawing / strokes.length };
}

/** Full analysis of one attempt (FR-05). */
export function analyze(data: KanjiData, attempt: Attempt): Analysis {
  const raw = cleanStrokes(attempt.strokes, attempt.size);
  const t = timing(raw);
  if (raw.length === 0)
    return { target: attempt.target, bestMatch: attempt.target, score: 0, mapping: [], errors: [], timing: t };

  const user = prepare(raw.map((s) => s.map((p) => [p.x, p.y] as [number, number])));
  const m = matchAgainst(data, user, attempt.target);

  // Confusion: does a look-alike fit clearly better than the target?
  let best = { char: attempt.target, score: m.score };
  for (const c of data.confusables[attempt.target] ?? []) {
    if (!data.kanji[c]) continue;
    const s = matchAgainst(data, user, c).score;
    if (s > best.score + CONFIG.confusionMargin) best = { char: c, score: s };
  }
  if (best.char !== attempt.target) {
    const k = data.kanji[best.char];
    return {
      target: attempt.target, bestMatch: best.char, score: m.score, mapping: m.mapping, timing: t,
      errors: [{
        type: "confusion", severity: "major",
        message: `This looks like ${best.char}${k.meanings[0] ? ` (“${k.meanings[0]}”)` : ""}, not ${attempt.target}.`,
      }],
    };
  }

  const endings = data.kanji[attempt.target].strokes.map((s) => s.ending);
  // Structural errors first; when strokes are missing/extra, fine-grained shape
  // feedback is unreliable and noisy, so it is withheld.
  const structural = [...countErrors(m), ...orderErrors(m), ...directionErrors(m)];
  const hasCount = structural.some((e) => e.type === "count");
  const errors = [
    ...structural,
    ...(hasCount ? [] : [...positionErrors(m), ...proportionErrors(m)]),
    ...(attempt.device === "pen" ? endingErrors(m, raw, endings) : []),
  ];
  return { target: attempt.target, bestMatch: attempt.target, score: m.score, mapping: m.mapping, errors, timing: t };
}
