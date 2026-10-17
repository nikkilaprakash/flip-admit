"use client";
import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Field, inputCls, Panel } from "../ui";

export default function Reset({ token }: { token: string }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState<string | null>(null);
  if (!token) return <Panel className="p-6 sm:p-8"><Alert tone="error">This reset link is incomplete. Request a new one.</Alert><Link href="/forgot-password" className="mt-4 inline-block font-semibold text-teal hover:underline">Request a new link</Link></Panel>;
  return (
    <Panel className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      {state === "done" ? (
        <div className="mt-4 space-y-5"><Alert tone="success">Password changed. You've been signed out everywhere else.</Alert><Link href="/login" className="font-semibold text-teal hover:underline">Sign in</Link></div>
      ) : (
        <form className="mt-5 space-y-5" onSubmit={async (e) => {
          e.preventDefault(); setErr(null);
          if (pw !== pw2) { setErr("The two passwords don't match."); return; }
          setState("busy");
          const r = await fetch("/api/auth/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password: pw }) });
          if (r.ok) setState("done"); else { setErr((await r.json()).error); setState("idle"); }
        }}>
          <Field label="New password" htmlFor="p1" hint="At least 8 characters, with a letter and a number."><input id="p1" type="password" autoComplete="new-password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} required /></Field>
          <Field label="Repeat new password" htmlFor="p2"><input id="p2" type="password" autoComplete="new-password" className={inputCls} value={pw2} onChange={(e) => setPw2(e.target.value)} required /></Field>
          {err && <Alert tone="error">{err}</Alert>}
          <Button className="w-full" disabled={state === "busy"}>Save new password</Button>
        </form>
      )}
    </Panel>
  );
}
