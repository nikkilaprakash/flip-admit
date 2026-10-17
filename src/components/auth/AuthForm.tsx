"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GraduationCap, Landmark } from "lucide-react";
import { Alert, Button, cn, Field, inputCls, Panel, textareaCls } from "../ui";

type Mode = "login" | "signup" | "verify";
async function post(url: string, body?: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j;
}

export default function AuthForm({ initialMode }: { initialMode: "login" | "signup" }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [purpose, setPurpose] = useState<"login" | "verify_email">("login");
  const [cooldown, setCooldown] = useState(0);
  const [f, setF] = useState({ role: "student" as "student" | "university", name: "", address: "", username: "", email: "", password: "", worldRanking: "", code: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { if (cooldown > 0) { const t = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(t); } }, [cooldown]);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  const switchMode = (m: Mode) => { setMode(m); setErr(null); };

  if (mode === "verify") {
    return (
      <Panel className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{purpose === "verify_email" ? "Verify your email" : "Check your email"}</h1>
        <p className="mt-2 text-ink-soft">We sent a 6-digit code to <strong className="text-ink">{sentTo}</strong>. It expires in 10 minutes.</p>
        <form className="mt-6 space-y-5" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await post("/api/auth/verify", { code: f.code }); router.push(r.home); router.refresh(); }); }}>
          <Field label="Code" htmlFor="code">
            <input id="code" className={cn(inputCls, "h-14 text-center text-2xl font-bold tracking-[0.5em]")} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
              value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, "") })} />
          </Field>
          {err && <Alert tone="error">{err}</Alert>}
          <Button className="w-full" disabled={busy || f.code.length !== 6}>{busy ? "Checking…" : purpose === "verify_email" ? "Verify and continue" : "Sign in"}</Button>
        </form>
        <div className="mt-5 flex items-center justify-between text-[15px]">
          <button className="font-semibold text-teal hover:underline disabled:text-ink-faint disabled:no-underline" disabled={cooldown > 0}
            onClick={() => run(async () => { await post("/api/auth/resend"); setCooldown(30); })}>{cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}</button>
          <button className="text-ink-soft hover:underline" onClick={() => switchMode("login")}>Start again</button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="p-6 sm:p-8">
      <div role="tablist" aria-label="Sign in or create an account" className="mb-7 grid grid-cols-2 rounded-lg bg-mist p-1">
        {(["login", "signup"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
            className={cn("h-10 rounded-md text-[15px] font-semibold", mode === m ? "bg-white text-ink shadow-sm" : "text-ink-soft")}>{m === "login" ? "Sign in" : "Create account"}</button>
        ))}
      </div>

      {mode === "login" ? (
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); run(async () => {
          const r = await post("/api/auth/login", { username: f.username, password: f.password });
          setSentTo(r.email); setPurpose(r.purpose); setCooldown(30); setMode("verify");
        }); }}>
          <Field label="Username or email" htmlFor="u"><input id="u" className={inputCls} autoComplete="username" value={f.username} onChange={set("username")} required /></Field>
          <Field label="Password" htmlFor="p"><input id="p" type="password" className={inputCls} autoComplete="current-password" value={f.password} onChange={set("password")} required /></Field>
          <div className="text-right"><Link href="/forgot-password" className="text-[15px] font-semibold text-teal hover:underline">Forgot password?</Link></div>
          {err && <Alert tone="error">{err}</Alert>}
          <Button className="w-full" disabled={busy}>{busy ? "Signing in…" : "Continue"}</Button>
          <p className="text-center text-sm text-ink-faint">We'll email you a one-time code to confirm it's you.</p>
        </form>
      ) : (
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); run(async () => {
          const r = await post("/api/auth/signup", { ...f, worldRanking: f.role === "university" && f.worldRanking ? Number(f.worldRanking) : null });
          setSentTo(r.email); setPurpose("verify_email"); setCooldown(30); setMode("verify");
        }); }}>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">I am a</legend>
            <div className="grid grid-cols-2 gap-3">
              {([["student", "Student", GraduationCap], ["university", "University", Landmark]] as const).map(([v, label, Icon]) => (
                <label key={v} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-semibold", f.role === v ? "border-teal bg-teal-tint text-teal-dark ring-1 ring-teal" : "border-line hover:bg-mist")}>
                  <input type="radio" name="role" value={v} checked={f.role === v} onChange={() => setF({ ...f, role: v })} className="sr-only" />
                  <Icon size={20} aria-hidden /> {label}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={f.role === "university" ? "University name" : "Full name"} htmlFor="n"><input id="n" className={inputCls} autoComplete={f.role === "student" ? "name" : "organization"} value={f.name} onChange={set("name")} required /></Field>
          <Field label="Address" htmlFor="a"><textarea id="a" rows={2} className={textareaCls} autoComplete="street-address" value={f.address} onChange={set("address")} required /></Field>
          {f.role === "university" && (
            <Field label="World ranking (optional)" htmlFor="wr" hint="Your current QS World University Ranking. Students can filter by ranking, so universities without one only reach students who accept any ranking.">
              <input id="wr" type="number" min={1} className={inputCls} value={f.worldRanking} onChange={set("worldRanking")} />
            </Field>
          )}
          <Field label="Email" htmlFor="e" hint={f.role === "university" ? "Use your official .ac.uk address." : "Use a personal address such as Gmail or Outlook."}>
            <input id="e" type="email" className={inputCls} autoComplete="email" value={f.email} onChange={set("email")} required />
          </Field>
          <Field label="Username" htmlFor="un"><input id="un" className={inputCls} autoComplete="username" value={f.username} onChange={set("username")} required /></Field>
          <Field label="Password" htmlFor="pw" hint="At least 8 characters, with a letter and a number."><input id="pw" type="password" className={inputCls} autoComplete="new-password" value={f.password} onChange={set("password")} required /></Field>
          {err && <Alert tone="error">{err}</Alert>}
          <Button className="w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</Button>
        </form>
      )}
    </Panel>
  );
}
