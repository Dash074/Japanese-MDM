import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Device, InputPoint, InputStroke } from "../core/types";

type Props = {
  strokes: InputStroke[];
  onChange: (strokes: InputStroke[], device: Device) => void;
  onStrokeEnd?: (strokes: InputStroke[], device: Device) => void;
  disabled?: boolean;
  /** Layers drawn under the ink (grid, trace guide). Rendered in a 109×109 viewBox. */
  children?: ReactNode;
  onSize?: (px: number) => void;
};

const PALM_WINDOW_MS = 800;

/**
 * Square writing surface. Captures pen / touch / mouse via Pointer Events,
 * including coalesced high-rate samples and pressure/tilt (FR-04, NFR-02).
 */
export function InkCanvas({ strokes, onChange, onStrokeEnd, disabled, children, onSize }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const current = useRef<InputStroke | null>(null);
  const device = useRef<Device>("mouse");
  const lastPen = useRef(0);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const width = useCallback((p: InputPoint) => {
    const base = Math.max(3, size * 0.022);
    return device.current === "pen" && p.p !== undefined ? base * (0.45 + 0.9 * p.p) : base;
  }, [size]);

  const inkColor = () => getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#1e1b18";

  const drawSegment = useCallback((ctx: CanvasRenderingContext2D, a: InputPoint, b: InputPoint) => {
    ctx.lineWidth = (width(a) + width(b)) / 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }, [width]);

  const redraw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = inkColor();
    ctx.fillStyle = inkColor();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokesRef.current) {
      if (s.length === 1) {
        ctx.beginPath();
        ctx.arc(s[0].x, s[0].y, width(s[0]) / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 1; i < s.length; i++) drawSegment(ctx, s[i - 1], s[i]);
    }
  }, [size, width, drawSegment]);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const px = Math.floor(e.contentRect.width);
      setSize(px);
      onSize?.(px);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onSize]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !size) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    redraw();
  }, [size, redraw]);

  useEffect(redraw, [strokes, redraw]);

  const toPoint = (e: PointerEvent): InputPoint => {
    const r = canvas.current!.getBoundingClientRect();
    const pt: InputPoint = { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp };
    if (e.pointerType === "pen") {
      pt.p = e.pressure;
      if (e.tiltX || e.tiltY) {
        pt.tiltX = e.tiltX;
        pt.tiltY = e.tiltY;
      }
    }
    return pt;
  };

  const accept = (e: React.PointerEvent) => {
    if (disabled) return false;
    if (e.pointerType === "pen") lastPen.current = e.timeStamp;
    // Palm rejection: ignore touches while a pen is in use.
    if (e.pointerType === "touch" && e.timeStamp - lastPen.current < PALM_WINDOW_MS) return false;
    if (e.pointerType === "mouse" && e.button !== 0) return false;
    return true;
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!accept(e) || current.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    device.current = e.pointerType === "pen" ? "pen" : e.pointerType === "touch" ? "touch" : "mouse";
    current.current = [toPoint(e.nativeEvent)];
    redraw();
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = current.current;
    if (!s) return;
    if (e.pointerType === "pen") lastPen.current = e.timeStamp;
    const ctx = canvas.current!.getContext("2d")!;
    ctx.strokeStyle = inkColor();
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const pt = toPoint(ev);
      const prev = s[s.length - 1];
      if (Math.hypot(pt.x - prev.x, pt.y - prev.y) < 0.75) continue;
      s.push(pt);
      drawSegment(ctx, prev, pt);
    }
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = current.current;
    if (!s) return;
    current.current = null;
    if (e.type === "pointerup") s.push(toPoint(e.nativeEvent));
    const next = [...strokesRef.current, s];
    onChange(next, device.current);
    onStrokeEnd?.(next, device.current);
  };

  return (
    <div ref={wrap} className="relative aspect-square w-full select-none rounded-sm bg-surface shadow-[0_1px_0_var(--grid),0_8px_24px_-12px_rgba(0,0,0,0.25)]">
      <svg viewBox="0 0 109 109" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <GenkoGrid />
        {children}
      </svg>
      <canvas
        ref={canvas}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ touchAction: "none", cursor: disabled ? "default" : "crosshair" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Writing area"
      />
    </div>
  );
}

/** 練習帳 practice-paper cell: border + dashed 十字 cross guides. */
export function GenkoGrid() {
  return (
    <g stroke="var(--grid)" fill="none">
      <rect x="0.75" y="0.75" width="107.5" height="107.5" strokeWidth="1.5" />
      <path d="M54.5 2V107M2 54.5H107" strokeWidth="0.8" strokeDasharray="3 3" />
    </g>
  );
}
