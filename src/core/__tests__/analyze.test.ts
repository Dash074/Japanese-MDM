import { analyze } from "../analyze";
import { INJECT, refOf, rng, toAttempt } from "../synth";
import { DATA } from "./load-data";

const types = (c: string, paths: ReturnType<typeof refOf>) =>
  analyze(DATA, toAttempt(c, paths)).errors.map((e) => e.type);

describe("invariants (§7.2)", () => {
  it.each(DATA.scope)("%s: reference matches itself with no errors", (c) => {
    const a = analyze(DATA, toAttempt(c, refOf(DATA, c)));
    expect(a.errors).toEqual([]);
    expect(a.bestMatch).toBe(c);
    expect(a.score).toBeGreaterThan(0.98);
  });

  it("is deterministic", () => {
    const at = toAttempt("右", refOf(DATA, "右"));
    expect(analyze(DATA, at)).toEqual(analyze(DATA, at));
  });
});

describe("specific mistakes", () => {
  it("右 with strokes 1 and 2 swapped → order error", () => {
    const p = refOf(DATA, "右");
    [p[0], p[1]] = [p[1], p[0]];
    expect(types("右", p)).toContain("order");
  });

  it("十 with the vertical stroke reversed → direction error on stroke 2", () => {
    const p = refOf(DATA, "十");
    p[1].reverse();
    const a = analyze(DATA, toAttempt("十", p));
    expect(a.errors).toEqual([expect.objectContaining({ type: "direction", refStroke: 1 })]);
  });

  it("国 with a stroke missing → count error", () => {
    const p = refOf(DATA, "国");
    p.splice(4, 1);
    expect(types("国", p)).toContain("count");
  });

  it("三 with a stroke missing is recognised as 二", () => {
    const p = refOf(DATA, "三");
    p.splice(1, 1);
    expect(analyze(DATA, toAttempt("三", p)).bestMatch).toBe("二");
  });

  it("writing 左 when asked for 右 → confusion", () => {
    const a = analyze(DATA, toAttempt("右", refOf(DATA, "左")));
    expect(a.bestMatch).toBe("左");
    expect(a.errors[0].type).toBe("confusion");
  });

  it("writing 入 when asked for 人 → confusion", () => {
    expect(analyze(DATA, toAttempt("人", refOf(DATA, "入"))).bestMatch).toBe("入");
  });

  it("every injector produces its expected error on 木", () => {
    const r = rng(1);
    for (const [name, inject] of Object.entries(INJECT)) {
      if (name === "clean") continue;
      const inj = inject(DATA, "木", r)!;
      expect({ name, got: types("木", inj.paths) }).toEqual({ name, got: expect.arrayContaining([inj.expect]) });
    }
  });
});
