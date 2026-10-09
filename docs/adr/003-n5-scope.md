# ADR-003: Scope limited to N5; out-of-scope look-alikes are distractors only

**Status:** accepted · 2026-10-09

The taught set is the 103 kanji at old-JLPT level 4 in KANJIDIC2 (`data/n5-list.json`).
Non-N5 look-alikes (末 未 牛 犬 …) are included in `kanji.json` with `taught: false`. They are used only to detect confusions and are never taught.
Expanding to N4 = change the list and re-run `npm run data:build`.
