import { drillFor, recommend, type LogEntry } from "../recommender";
import { DATA } from "./load-data";

const now = Date.UTC(2026, 9, 9);
const e = (kanji: string, errors: LogEntry["errors"] = [], bestMatch = kanji, daysAgo = 0): LogEntry => ({
  kanji, errors, bestMatch, at: now - daysAgo * 86400000,
});

describe("recommend (§4.8)", () => {
  it("suggests a confusion drill after 2 confusions", () => {
    const r = recommend(DATA, [e("右", ["confusion"], "左"), e("右", ["confusion"], "左")], 0, now);
    expect(r[0]).toMatchObject({ kind: "confusion", target: "右", wrote: "左" });
  });
  it("ignores a single confusion", () => {
    expect(recommend(DATA, [e("右", ["confusion"], "左")], 0, now)).toEqual([]);
  });
  it("ignores events older than 14 days", () => {
    const old = [e("右", ["confusion"], "左", 20), e("右", ["confusion"], "左", 20)];
    expect(recommend(DATA, old, 0, now)).toEqual([]);
  });
  it("flags stroke order when ≥30% of attempts", () => {
    const r = recommend(DATA, [e("書", ["order"]), e("書"), e("書")], 0, now);
    expect(r).toContainEqual(expect.objectContaining({ kind: "order", kanji: "書" }));
  });
  it("direction needs ≥3 different kanji", () => {
    const two = [e("十", ["direction"]), e("木", ["direction"])];
    expect(recommend(DATA, two, 0, now).some((r) => r.kind === "direction")).toBe(false);
    expect(recommend(DATA, [...two, e("人", ["direction"])], 0, now)[0].kind).toBe("direction");
  });
  it("puts clearing reviews first when > 20 due", () => {
    expect(recommend(DATA, [], 25, now)[0].kind).toBe("clear-reviews");
  });
  it("returns at most 3", () => {
    const log = ["右", "人", "日", "木"].flatMap((k) => [e(k, ["confusion"], "X"), e(k, ["confusion"], "X")]);
    expect(recommend(DATA, log, 0, now)).toHaveLength(3);
  });
});

describe("drillFor", () => {
  it("alternates two taught look-alikes", () => {
    const d = drillFor(DATA, { kind: "confusion", target: "右", wrote: "左", count: 2 });
    expect(d.map((x) => x.char).join("")).toBe("右左右左右左");
  });
  it("uses a non-N5 look-alike only as contrast", () => {
    const d = drillFor(DATA, { kind: "confusion", target: "木", wrote: "末", count: 2 });
    expect(d.every((x) => x.char === "木" && x.contrast === "末")).toBe(true);
  });
});
