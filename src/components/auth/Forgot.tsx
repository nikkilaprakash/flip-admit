"use client";
import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Field, inputCls, Panel } from "../ui";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Panel className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold">Reset your password</h1>
      {state === "sent" ? (
        <div className="mt-4 space-y-5">
          <Alert tone="success">If an account uses {email}, we've sent a link to reset the password. It expires in 1 hour.</Alert>
          <Link href="/login" className="font-semibold text-teal hover:underline">Back to sign in</Link>
        </div>
      ) : (
        <form className="mt-5 space-y-5" onSubmit={async (e) => {
          e.preventDefault(); setState("busy"); setErr(null);
          const r = await fetch("/api/auth/forgot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
          if (r.ok) setState("sent"); else { setErr((await r.json()).error); setState("idle"); }
        }}>
          <p className="text-ink-soft">Enter the email on your account and we'll send you a reset link.</p>
          <Field label="Email" htmlFor="e"><input id="e" type="email" className={inputCls} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          {err && <Alert tone="error">{err}</Alert>}
          <Button className="w-full" disabled={state === "busy"}>Send reset link</Button>
          <Link href="/login" className="block text-center text-[15px] text-ink-soft hover:underline">Back to sign in</Link>
        </form>
      )}
    </Panel>
  );
}
