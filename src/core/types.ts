/** Raw input sample from the canvas. Coordinates are in canvas pixels; t in ms. */
export type InputPoint = {
  x: number;
  y: number;
  t: number;
  p?: number; // pressure 0–1 (pen only)
  tiltX?: number;
  tiltY?: number;
};
export type InputStroke = InputPoint[];

export type Device = "pen" | "touch" | "mouse";

export type Attempt = {
  target: string;
  strokes: InputStroke[];
  device: Device;
  /** Canvas side length in px, so coordinates can be interpreted. */
  size: number;
};

/** 2-D point in the normalized unit box. */
export type Vec = [number, number];
export type Path = Vec[];

export type Ending = "tome" | "hane" | "harai" | null;

export type RefStroke = {
  /** Original KanjiVG path data (109×109 viewBox) for rendering/animation. */
  d: string;
  /** Resampled points in 0–1 coordinates. */
  points: Path;
  type: string;
  ending: Ending;
};

export type KanjiEntry = {
  char: string;
  taught: boolean; // false → distractor only
  strokes: RefStroke[];
  components: string[];
  meanings: string[];
  onyomi: string[];
  kunyomi: string[];
  grade?: number;
  examples?: { word: string; reading: string; meaning: string }[];
};

export type KanjiData = {
  scope: string[]; // taught kanji in teaching order
  kanji: Record<string, KanjiEntry>;
  confusables: Record<string, string[]>;
};

export type ErrorType =
  | "order"
  | "direction"
  | "count"
  | "proportion"
  | "position"
  | "ending"
  | "confusion";

export type Severity = "minor" | "major";

export type StrokeError = {
  type: ErrorType;
  severity: Severity;
  /** 0-based reference stroke index, if applicable. */
  refStroke?: number;
  /** 0-based user stroke index, if applicable. */
  userStroke?: number;
  message: string;
};

export type Analysis = {
  target: string;
  bestMatch: string;
  /** 0–1 shape similarity to the target. */
  score: number;
  /** userStroke index → refStroke index (-1 = unmatched extra stroke). */
  mapping: number[];
  errors: StrokeError[];
  timing: { totalMs: number; hesitationMs: number; meanStrokeMs: number };
};
