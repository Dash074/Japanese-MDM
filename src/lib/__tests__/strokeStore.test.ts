import { decode, encode } from "../strokeStore";

describe("raw stroke encoding", () => {
  it("round-trips with 0.1 px / 1 ms / 0.01 pressure precision", () => {
    const raw = {
      size: 412.6,
      device: "pen" as const,
      strokes: [
        [{ x: 10.04, y: 20.06, t: 1000, p: 0.512 }, { x: 30.3, y: 40.4, t: 1016.4, p: 0.7 }],
        [{ x: 5, y: 6, t: 1500 }],
      ],
    };
    const back = decode(encode(raw));
    expect(back.size).toBe(413);
    expect(back.device).toBe("pen");
    expect(back.strokes[0][0]).toEqual({ x: 10, y: 20.1, t: 1000, p: 0.51 });
    expect(back.strokes[0][1].t).toBe(1016);
    expect(back.strokes[1][0]).toEqual({ x: 5, y: 6, t: 1500 }); // no pressure → none invented
  });

  it("is much smaller than the raw JSON", () => {
    const strokes = [Array.from({ length: 80 }, (_, i) => ({ x: i * 3.14159, y: i * 2.71828, t: 1e6 + i * 8.33, p: 0.5 + i / 400 }))];
    const raw = { size: 400, device: "pen" as const, strokes };
    expect(JSON.stringify(encode(raw)).length).toBeLessThan(JSON.stringify(raw).length * 0.5);
  });
});
