# Fude 筆 — User Guide

Fude helps you learn to **write** the 103 JLPT N5 kanji. You write each kanji with a pen, your finger or a mouse, and Fude tells you **which stroke went wrong and why**.

---

## 1. Getting started

1. Open the link you were given in **Chrome, Edge or Safari**.
2. **Recommended:** install it. In Chrome, click the install icon in the address bar; on iPad, tap Share → *Add to Home Screen*. After the first visit it works **without internet**.
3. **Optional:** sign in (設 Settings → Account → enter your email → click the link you receive). Signing in saves your progress online so you can switch devices. Without signing in, progress stays in this browser.

### Using a pen tablet
- Pen tablets (Wacom, XP-Pen, Huion), iPad + Apple Pencil, and phone styluses all work. A mouse works too.
- Check your pen in **設 Settings → Pen test**. It should say **pen**, and the pressure should change as you press.
- **Windows:** if it says "mouse" or the pressure stays at 0.50, turn on *Windows Ink* in your tablet driver's settings.
- **Screenless tablets** (you look at the monitor, not the pen): write a little larger and slower than usual.

---

## 2. The screens

| Tab | What it's for |
|---|---|
| **今日 Today** | Your starting point: start today's reviews, see your weak spots and recommended drills. |
| **復習 Review** | Daily session: kanji that are due, plus a few new ones. |
| **漢字帳 Kanji** | All 103 kanji. Colour = progress (plain = new, blue = learning, green = mastered). Tap one for details. |
| **成績 Progress** | Charts: mastery, mistakes by type, upcoming reviews, kanji you mix up. |
| **設 Settings** | Account, new kanji per day, live check, pen test, export your data. |

---

## 3. Writing a kanji

1. Write inside the square. The dashed cross helps with balance.
2. **Undo** (Ctrl+Z) removes the last stroke; **Clear** (Esc) starts again.
3. Press **Check** (or Enter).

### Guide levels
Fude gives you less help as you improve:

| Level | What you see |
|---|---|
| なぞる **Trace** | A faint model to write over, with stroke numbers |
| ヒント **Hint** | Only the first stroke |
| 白紙 **Blank** | An empty square; the kanji is shown in the prompt |
| 想起 **Recall** | Only a word with the kanji missing, e.g. **□手 みぎて "right hand"** — write it from memory |

Two or three clean attempts move you up a level. Repeated big mistakes move you down. You can pick a level yourself on the Practice screen.

### Live check
With **Live check** on, Fude warns you right after a wrong stroke (wrong direction, wrong shape, or too many strokes), so you can undo it immediately.

---

## 4. Understanding the feedback

After **Check** you'll see either a seal (良 good, 優 excellent) or a list of things to fix. Wrong strokes are coloured on your writing and on the model: **red** = must fix, **gold** = small issue.

| Label | Meaning | Example |
|---|---|---|
| 書き順 **Stroke order** | Strokes written in the wrong order | 右: the ノ comes before the 一 (but 左 is the opposite!) |
| 方向 **Direction** | A stroke drawn backwards | Horizontal strokes go left → right; vertical ones top → bottom |
| 画数 **Stroke count** | A stroke missing or extra, two strokes joined, or one split | 口 is 3 strokes, not 4 |
| 長さ **Proportion** | A stroke too long or too short | 土 (long bottom line) vs 士 (long top line) |
| 位置 **Position** | A stroke in the wrong place | |
| 止め・跳ね・払い **Ending** | Stop, flick or sweep at the end of a stroke (pen only; advice, never marked wrong) | 人: the right stroke sweeps out and fades |
| 混同 **Look-alike** | You wrote a different, similar kanji | 右 → 左, 人 → 入 |

**▶ Replay mine** plays back how you wrote it. **↺ Again** lets you write the same kanji again.

---

## 5. Reviews and memory

Fude schedules each kanji to come back just before you would forget it (spaced repetition, FSRS).

- After each review, Fude **grades it for you** (Again / Hard / Good / Easy) from your mistakes and your speed. Tap another grade if you disagree. Each button shows when the kanji will come back.
- Kanji you get wrong come back at the end of the same session.
- New kanji start with a short introduction: stroke animation, readings and example words.
- If more than 20 reviews are waiting, new kanji pause until you catch up.

---

## 6. Drills (特訓)

When Fude notices a pattern, it suggests a short drill on the Today screen. For example:
- **Look-alikes:** you wrote 左 for 右 twice → write 右 and 左 alternately from memory.
- **Stroke order:** order mistakes in 書 → watch, trace twice, then write.
- **Direction / proportion / endings:** focused practice on the kanji where it happened.

---

## 7. Your data and privacy

- Without an account, everything stays in your browser.
- With an account, your attempts (including the pen movements) are stored in the project's database. Only you can see your own data.
- **Settings → Export** downloads everything as JSON or CSV.
- **Settings → Reset** deletes the progress stored in this browser.

---

## 8. For study participants

If you were given a link containing `?study=…`, you are part of a learning study. Your group is shown in **Settings → Study group**; **please don't change it**. Depending on your group, you may see detailed feedback or just correct/incorrect. Both groups learn the same kanji. Please practise about **15 minutes a day** for the study period.

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| Pen draws nothing / draws with the side button | Check the pen in Settings → Pen test; on Windows enable Windows Ink |
| Palm makes marks (touch screens) | Touches are ignored while the pen is writing and for a moment after. If a palm mark appears before your first stroke, press Undo |
| "Sync failed" | Check your connection and press **Sync now**. Your work is kept and uploaded later |
| The sign-in link opens a blank page | Open the link in the same browser where you requested it |
| Feedback seems wrong | Export your data (Settings → Export JSON) and send it to the team with a note on which attempt |
