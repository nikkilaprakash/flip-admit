"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, inputCls, Panel, textareaCls } from "./ui";

async function send(url: string, method: string, body: unknown) {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't save.");
}

export default function ProfileForms(p: { role: string; name: string; address: string; email: string; username: string; worldRanking: number | null }) {
  const router = useRouter();
  const [d, setD] = useState({ name: p.name, address: p.address, worldRanking: p.worldRanking ? String(p.worldRanking) : "" });
  const [pw, setPw] = useState({ current: "", next: "" });
  const [m1, setM1] = useState<{ ok?: string; err?: string }>({});
  const [m2, setM2] = useState<{ ok?: string; err?: string }>({});
  return (
    <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
      <Panel className="p-6">
        <h2 className="text-lg font-bold">Your details</h2>
        <form className="mt-5 space-y-5" onSubmit={async (e) => {
          e.preventDefault(); setM1({});
          try { await send("/api/profile", "PATCH", { name: d.name, address: d.address, ...(p.role === "university" ? { worldRanking: d.worldRanking ? Number(d.worldRanking) : null } : {}) }); setM1({ ok: "Saved." }); router.refresh(); }
          catch (er) { setM1({ err: (er as Error).message }); }
        }}>
          <Field label={p.role === "university" ? "University name" : "Full name"} htmlFor="pn"><input id="pn" className={inputCls} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} required /></Field>
          <Field label="Address" htmlFor="pa"><textarea id="pa" rows={3} className={textareaCls} value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} required /></Field>
          {p.role === "university" && (
            <Field label="World ranking" htmlFor="pr" hint="Students can require a minimum ranking. Leave empty if you're unranked.">
              <input id="pr" type="number" min={1} className={inputCls} value={d.worldRanking} onChange={(e) => setD({ ...d, worldRanking: e.target.value })} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4 text-[15px]">
            <div><p className="text-sm text-ink-faint">Email</p><p className="font-medium break-all">{p.email}</p></div>
            <div><p className="text-sm text-ink-faint">Username</p><p className="font-medium">{p.username}</p></div>
          </div>
          {m1.err && <Alert tone="error">{m1.err}</Alert>}
          {m1.ok && <Alert tone="success">{m1.ok}</Alert>}
          <Button>Save details</Button>
        </form>
      </Panel>
      <Panel className="p-6">
        <h2 className="text-lg font-bold">Change password</h2>
        <form className="mt-5 space-y-5" onSubmit={async (e) => {
          e.preventDefault(); setM2({});
          try { await send("/api/profile/password", "POST", pw); setM2({ ok: "Password changed." }); setPw({ current: "", next: "" }); }
          catch (er) { setM2({ err: (er as Error).message }); }
        }}>
          <Field label="Current password" htmlFor="cp"><input id="cp" type="password" autoComplete="current-password" className={inputCls} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></Field>
          <Field label="New password" htmlFor="np" hint="At least 8 characters, with a letter and a number."><input id="np" type="password" autoComplete="new-password" className={inputCls} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></Field>
          {m2.err && <Alert tone="error">{m2.err}</Alert>}
          {m2.ok && <Alert tone="success">{m2.ok}</Alert>}
          <Button variant="secondary">Change password</Button>
          <p className="text-sm text-ink-faint">Every sign-in also needs a one-time code sent to {p.email}.</p>
        </form>
      </Panel>
    </div>
  );
}
