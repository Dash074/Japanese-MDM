import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "quiet";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-shu text-on-shu hover:brightness-110 shadow-sm",
  ghost: "border border-ink/25 text-ink hover:border-ink/60 bg-transparent",
  quiet: "text-ink-muted hover:text-ink bg-transparent",
};

export function Button({ variant = "ghost", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-sm px-4 py-2 text-sm font-medium tracking-wide transition
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai
        disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-sm border border-grid bg-surface p-5 ${className}`}>{children}</div>;
}

/** Bilingual heading: Japanese in Mincho + English label. */
export function Heading({ jp, en, className = "" }: { jp: string; en: string; className?: string }) {
  return (
    <h1 className={`flex items-baseline gap-3 ${className}`}>
      <span className="font-mincho text-3xl font-bold">{jp}</span>
      <span className="text-sm uppercase tracking-[0.2em] text-ink-muted">{en}</span>
    </h1>
  );
}

/** 判子 hanko seal shown after a clean attempt. */
export function Hanko({ char, size = 72 }: { char: string; size?: number }) {
  return (
    <div
      className="animate-stamp grid place-items-center rounded-full border-[3px] border-shu font-mincho font-bold text-shu"
      style={{ width: size, height: size, fontSize: size * 0.5, boxShadow: "inset 0 0 0 3px var(--surface), inset 0 0 0 4.5px var(--shu)" }}
      aria-label={`Seal: ${char}`}
    >
      {char}
    </div>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "shu" | "ai" | "matcha" }) {
  const c = { muted: "text-ink-muted border-grid", shu: "text-shu border-shu/40", ai: "text-ai border-ai/40", matcha: "text-matcha border-matcha/40" }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${c}`}>{children}</span>;
}
