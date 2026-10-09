import { useRef, useState } from "react";
import { useProgress } from "../../lib/progress";
import { loadAllStrokes } from "../../lib/strokeStore";
import { Button, Card, Heading } from "../../ui/primitives";
import { Account } from "../auth/Account";

/** 設定 — settings, pen test and data export (FR-14, FR-15). */
export function Settings() {
  const { settings, setSettings, log, cards, kanji, reset } = useProgress();
  const [confirming, setConfirming] = useState(false);

  const download = (name: string, body: string, type: string) => {
    const url = URL.createObjectURL(new Blob([body], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  const stamp = new Date().toISOString().slice(0, 10);
  // Raw strokes (from IndexedDB) are attached per attempt so exports can become test fixtures.
  const exportJson = async () => {
    const raw = await loadAllStrokes();
    const withRaw = log.map((e) => (raw[e.id] ? { ...e, raw: raw[e.id] } : e));
    const body = { version: 1, exportedAt: new Date().toISOString(), kanji, cards, log: withRaw };
    download(`fude-export-${stamp}.json`, JSON.stringify(body), "application/json");
  };
  const exportCsv = () => {
    const cols = ["at", "kanji", "mode", "level", "device", "bestMatch", "score", "strokes", "ms", "hesitationMs", "errors", "auto", "grade"] as const;
    const rows = log.map((e) =>
      cols.map((c) => (c === "at" ? new Date(e.at).toISOString() : c === "errors" ? e.errors.join("|") : String(e[c] ?? ""))).join(","),
    );
    download(`fude-attempts-${stamp}.csv`, [cols.join(","), ...rows].join("\n"), "text/csv");
  };

  return (
    <section className="max-w-2xl space-y-5">
      <Heading jp="設定" en="Settings" />

      <Account />

      <Card className="space-y-4">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block font-bold">新しい漢字 · New kanji per day</span>
            <span className="text-sm text-ink-muted">How many new kanji review sessions introduce each day.</span>
          </span>
          <select
            value={settings.dailyNew}
            onChange={(e) => setSettings({ dailyNew: Number(e.target.value) })}
            className="rounded-sm border border-grid bg-bg px-2 py-1"
          >
            {[0, 3, 5, 8, 10, 15].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block font-bold">即時チェック · Live stroke check</span>
            <span className="text-sm text-ink-muted">Flag a wrong stroke as soon as you lift the pen (not in Recall mode).</span>
          </span>
          <input type="checkbox" checked={settings.live} onChange={(e) => setSettings({ live: e.target.checked })}
            className="h-5 w-5 accent-[var(--shu)]" />
        </label>
      </Card>

      <PenTest />

      <Card className="space-y-2">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block font-bold">研究 · Study group</span>
            <span className="text-sm text-ink-muted">
              For the learning study. <b>Full</b>: error-aware feedback and recommendations. <b>Control</b>: correct / incorrect only,
              self-graded reviews. Enrol participants with a link ending in <code>?study=control</code> or <code>?study=full</code>.
            </span>
          </span>
          <select
            value={settings.study}
            onChange={(e) => setSettings({ study: e.target.value as "full" | "control" })}
            className="rounded-sm border border-grid bg-bg px-2 py-1"
            aria-label="Study group"
          >
            <option value="full">Full</option>
            <option value="control">Control</option>
          </select>
        </label>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">データ · Your data</h2>
        <p className="text-sm text-ink-muted">
          {log.length} attempts and {Object.keys(cards).length} review cards are stored in this browser. Export them for research or backup.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void exportJson()} disabled={!log.length}>⬇ Export JSON</Button>
          <Button onClick={exportCsv} disabled={!log.length}>⬇ Export CSV</Button>
          {!confirming ? (
            <Button variant="quiet" className="ml-auto text-shu" onClick={() => setConfirming(true)}>Reset all progress…</Button>
          ) : (
            <span className="ml-auto flex items-center gap-2 text-sm">
              Delete everything?
              <Button variant="primary" onClick={() => { reset(); setConfirming(false); }}>Yes, reset</Button>
              <Button onClick={() => setConfirming(false)}>Cancel</Button>
            </span>
          )}
        </div>
      </Card>
    </section>
  );
}

/** Live readout of pointer type, pressure, tilt and sample rate, to confirm a tablet works. */
function PenTest() {
  const [info, setInfo] = useState<{ type: string; pressure: number; tilt: string; hz: number } | null>(null);
  const times = useRef<number[]>([]);
  const onMove = (e: React.PointerEvent) => {
    if (e.buttons === 0 && e.pointerType !== "pen") return;
    const evs = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of evs) times.current.push(ev.timeStamp);
    times.current = times.current.filter((t) => e.timeStamp - t < 1000);
    setInfo({
      type: e.pointerType,
      pressure: e.pressure,
      tilt: e.tiltX || e.tiltY ? `${e.tiltX}°, ${e.tiltY}°` : "—",
      hz: times.current.length,
    });
  };
  return (
    <Card className="space-y-3">
      <h2 className="font-bold">ペンテスト · Pen test</h2>
      <div
        onPointerMove={onMove}
        onPointerDown={onMove}
        style={{ touchAction: "none" }}
        className="grid h-32 place-items-center rounded-sm border border-dashed border-grid bg-bg text-sm text-ink-muted"
      >
        {info ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-ink">
            <dt className="text-ink-muted">Device</dt><dd>{info.type}</dd>
            <dt className="text-ink-muted">Pressure</dt><dd className="tabular-nums">{info.pressure.toFixed(2)}</dd>
            <dt className="text-ink-muted">Tilt</dt><dd>{info.tilt}</dd>
            <dt className="text-ink-muted">Samples/s</dt><dd className="tabular-nums">{info.hz}</dd>
          </dl>
        ) : (
          "Draw or hover here with your pen"
        )}
      </div>
      <p className="text-xs text-ink-muted">
        If the device shows “mouse” or pressure stays at 0.50 with a Wacom/XP-Pen/Huion, enable Windows Ink in the tablet driver settings.
      </p>
    </Card>
  );
}
