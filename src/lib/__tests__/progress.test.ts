import type { Analysis } from "../../core/types";
import { nextLevel, type KanjiProgress } from "../progress";

const base: KanjiProgress = { attempts: 0, clean: 0, streak: 0, fails: 0, level: "trace", best: 0, errors: {}, lastSeen: 0 };
const ok: Analysis = { target: "木", bestMatch: "木", score: 1, mapping: [], errors: [], timing: { totalMs: 0, hesitationMs: 0, meanStrokeMs: 0 } };
const bad: Analysis = { ...ok, errors: [{ type: "order", severity: "major", message: "" }] };

describe("guide-level progression (§4.7)", () => {
  it("promotes trace → hint after 2 clean attempts", () => {
    const a = { ...base, ...nextLevel(base, ok) };
    expect(a.level).toBe("trace");
    expect(nextLevel(a, ok).level).toBe("hint");
  });

  it("demotes after 2 consecutive major errors", () => {
    const p = { ...base, level: "blank" as const };
    const once = { ...p, ...nextLevel(p, bad) };
    expect(once.level).toBe("blank");
    expect(nextLevel(once, bad).level).toBe("hint");
  });

  it("drops from recall after a single major error", () => {
    expect(nextLevel({ ...base, level: "recall" }, bad).level).toBe("blank");
  });

  it("never goes below trace", () => {
    expect(nextLevel({ ...base, fails: 5 }, bad).level).toBe("trace");
  });
});
