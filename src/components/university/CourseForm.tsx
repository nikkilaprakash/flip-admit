"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FIELDS, LEVELS } from "@/lib/config";
import { Alert, Button, cn, Field, inputCls, textareaCls } from "../ui";

export type CourseValues = { name: string; subjectArea: string; level: "UG" | "PGT" | "PHD"; tuitionFee: number; durationYears: number; seats: number; scholarshipFund: number; description: string };

export default function CourseForm({ id, initial, lockedMoney }: { id?: string; initial?: CourseValues; lockedMoney?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<CourseValues>(initial ?? { name: "", subjectArea: "", level: "PGT", tuitionFee: 0, durationYears: 1, seats: 100, scholarshipFund: 0, description: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const num = (k: keyof CourseValues) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value === "" ? 0 : Number(e.target.value) });

  return (
    <form className="space-y-6" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setMsg({});
      const r = await fetch(id ? `/api/university/courses/${id}` : "/api/university/courses", { method: id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) });
      const j = await r.json().catch(() => ({}));
      setBusy(false);
      if (!r.ok) return setMsg({ err: j.error });
      if (!id) { router.push(`/university/courses/${j.id}?tab=students`); return; }
      setMsg({ ok: v.description ? "Saved. Applicants have been re-ranked against this description." : "Saved." }); router.refresh();
    }}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Course name" htmlFor="cname"><input id="cname" className={inputCls} placeholder="MSc Data Science" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required /></Field>
        <Field label="Subject area" htmlFor="carea" hint="Used to match students' course preferences.">
          <select id="carea" className={inputCls} value={v.subjectArea} onChange={(e) => setV({ ...v, subjectArea: e.target.value })} required>
            <option value="">Choose a subject area</option>
            {FIELDS.map((f) => <optgroup key={f.field} label={f.field}>{f.areas.map((a) => <option key={a}>{a}</option>)}</optgroup>)}
          </select>
        </Field>
        <Field label="Level" htmlFor="clevel">
          <select id="clevel" className={inputCls} value={v.level} disabled={lockedMoney}
            onChange={(e) => { const l = e.target.value as CourseValues["level"]; setV({ ...v, level: l, durationYears: LEVELS.find((x) => x.value === l)!.years }); }}>
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </Field>
        <Field label="Length in years" htmlFor="cdur"><input id="cdur" type="number" min={1} max={7} className={inputCls} value={v.durationYears || ""} onChange={num("durationYears")} disabled={lockedMoney} required /></Field>
        <Field label="Tuition fee per year (£)" htmlFor="ctui" hint="The fee before any scholarship."><input id="ctui" type="number" min={0} step={100} inputMode="numeric" className={inputCls} value={v.tuitionFee || ""} onChange={num("tuitionFee")} disabled={lockedMoney} required /></Field>
        <Field label="Total seats" htmlFor="cseats"><input id="cseats" type="number" min={1} className={inputCls} value={v.seats || ""} onChange={num("seats")} required /></Field>
        <Field label="Scholarship fund (£)" htmlFor="cfund" hint="The total you can award on this course. Each offer reserves its full value until it's declined.">
          <input id="cfund" type="number" min={0} step={1000} inputMode="numeric" className={inputCls} value={v.scholarshipFund || ""} onChange={num("scholarshipFund")} required />
        </Field>
      </div>
      <Field label="Course description" htmlFor="cdesc" hint="What students study, the skills you look for, modules, careers. Applicants are ranked against this text, so be specific.">
        <textarea id="cdesc" rows={9} className={cn(textareaCls)} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </Field>
      {lockedMoney && <p className="text-sm text-ink-faint">Level, length and tuition are fixed because this course has offers.</p>}
      {msg.err && <Alert tone="error">{msg.err}</Alert>}
      {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
      <Button disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Create course"}</Button>
    </form>
  );
}
