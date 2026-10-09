# ADR-001: Deterministic stroke matching instead of a CNN

**Status:** accepted · 2026-10-09

## Context
The core feature is explaining *why* an attempt is wrong (order, direction, count, proportion, position, look-alike). An image classifier can only tell *what* was written. Training one also needs a large dataset and GPU time, and its output can't be explained.

## Decision
Because the target kanji is always known, attempts are *verified* against KanjiVG reference strokes:
normalize → resample (32 pts) → cost matrix (forward/reversed) → Hungarian assignment → robust similarity refit → rule-based classifiers.
Confusion is detected by matching the same attempt against the target's look-alike set.

## Consequences
+ No training data, explainable per-stroke feedback, ~5 ms per attempt in the browser, fully unit-testable.
+ Evaluated with synthetic error injection (`npm run evaluate`).
− Cannot recognise arbitrary kanji outside the target + look-alike set (not needed in v1).
− Thresholds need tuning on real handwriting (Sprint 3 fixtures).
