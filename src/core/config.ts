/**
 * Every tunable threshold of the analysis engine lives here (NFR-08).
 * Distances are in normalized units (the reference box is 1×1).
 */
export const CONFIG = {
  /** Points per resampled stroke. */
  resampleN: 32,
  /** Strokes shorter than this (fraction of the box) are discarded as taps. */
  minStrokeLength: 0.02,
  /** Weight of the direction (angle) term in the stroke cost. */
  angleWeight: 0.05,
  /** Penalty for leaving a stroke unassigned in the Hungarian matrix. */
  unmatchedCost: 0.35,

  /** Reversed fit must beat forward fit by this much to flag direction. */
  directionMargin: 0.06,
  /** Paired-stroke length ratio deviation that counts as a proportion error. */
  proportionTolerance: 0.35,
  /** …but never flag a length difference smaller than this (protects dots/short strokes). */
  proportionMinDelta: 0.08,
  /** Centroid offset that counts as a position error (minor / major). */
  positionMinor: 0.12,
  positionMajor: 0.22,
  /** A single user stroke this close to two joined ref strokes ⇒ "merged". */
  mergeTolerance: 0.09,

  /** A candidate must beat the target score by this margin to be a confusion. */
  confusionMargin: 0.02,
  /** Mean point distance that maps to score 0. */
  scoreScale: 0.25,

  /** Ending analysis looks at this trailing fraction of the stroke. */
  endingTail: 0.15,
  /** Pen-up gap allowance per stroke before it counts as hesitation (ms). */
  hesitationAllowanceMs: 400,
} as const;
