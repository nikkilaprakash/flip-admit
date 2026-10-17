import Link from "next/link";
import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...a: Parameters<typeof clsx>) => twMerge(clsx(...a));

const BTN = {
  primary: "bg-teal text-white hover:bg-teal-dark",
  secondary: "bg-white text-ink border border-line hover:bg-mist",
  ghost: "text-ink hover:bg-mist",
  gold: "bg-gold text-ink hover:brightness-95",
  danger: "bg-white text-danger border border-line hover:bg-danger-tint",
};
export type Variant = keyof typeof BTN;
const btnBase = "inline-flex items-center justify-center gap-2 rounded-lg px-4 h-11 text-[15px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export function Button({ variant = "primary", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={cn(btnBase, BTN[variant], className)} {...p} />;
}
export function ButtonLink({ href, variant = "primary", className, children }: { href: string; variant?: Variant; className?: string; children: React.ReactNode }) {
  return <Link href={href} className={cn(btnBase, BTN[variant], className)}>{children}</Link>;
}

export const inputCls = "block w-full h-11 rounded-lg border border-line bg-white px-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25 disabled:bg-mist";
export const textareaCls = "block w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25";

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">{label}</label>
      {children}
      {hint && !error && <p className="text-sm text-ink-faint">{hint}</p>}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}

export function Panel({ className, children, as: As = "section", ...p }: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" }) {
  return <As className={cn("rounded-xl border border-line bg-white", className)} {...p}>{children}</As>;
}

const BADGE = {
  neutral: "bg-mist text-ink-soft",
  teal: "bg-teal-tint text-teal-dark",
  gold: "bg-gold-tint text-gold-ink",
  danger: "bg-danger-tint text-danger",
};
export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof BADGE; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap", BADGE[tone], className)}>{children}</span>;
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: React.ReactNode }) {
  const c = { info: "bg-mist text-ink border-line", error: "bg-danger-tint text-danger border-danger/20", success: "bg-teal-tint text-teal-dark border-teal/20" }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-lg border px-4 py-3 text-[15px]", c)}>{children}</div>;
}

export function PageHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-[28px] font-bold leading-tight sm:text-[32px]">{title}</h1>
        {description && <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-mist/50 px-6 py-12 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-ink-soft">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 w-full overflow-hidden rounded-full bg-mist-deep">
      <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Tabs({ items }: { items: { href: string; label: string; active: boolean }[] }) {
  return (
    <nav aria-label="Sections" className="mb-8 flex gap-1 border-b border-line">
      {items.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined}
          className={cn("-mb-px border-b-2 px-4 py-3 text-[15px] font-semibold", t.active ? "border-teal text-teal-dark" : "border-transparent text-ink-soft hover:text-ink")}>{t.label}</Link>
      ))}
    </nav>
  );
}

export function SourceNote({ source }: { source: string }) {
  return <span className="text-[13px] text-ink-faint">{source === "fallback" ? "Generated without AI (no API key or AI unavailable)" : "Generated by AI"}</span>;
}
