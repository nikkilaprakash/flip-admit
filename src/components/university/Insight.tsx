"use client";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Alert, Panel, SourceNote } from "../ui";

type Data = { summary: string; fitJustification: string; strengths: string[]; considerations: string[]; source: string };

export default function Insight({ studentId, courseId }: { studentId: string; courseId: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/university/insight?studentId=${studentId}&courseId=${courseId}`).then(async (r) => {
      const j = await r.json(); if (r.ok) setD(j); else setErr(j.error);
    }).catch(() => setErr("Couldn't load the AI summary."));
  }, [studentId, courseId]);
  return (
    <Panel className="border-gold/60 bg-gold-tint/40 p-6" aria-busy={!d && !err}>
      <h2 className="flex items-center gap-2 text-lg font-bold"><Sparkles size={18} aria-hidden /> AI summary</h2>
      {err && <div className="mt-3"><Alert tone="error">{err}</Alert></div>}
      {!d && !err && (
        <div className="mt-4 space-y-2" aria-label="Loading summary">
          {[90, 75, 82].map((w) => <div key={w} className="h-3.5 animate-pulse rounded bg-gold/25" style={{ width: `${w}%` }} />)}
        </div>
      )}
      {d && (
        <div className="mt-3 space-y-4">
          <p className="leading-relaxed">{d.summary}</p>
          <div><h3 className="font-semibold">Why this ranking</h3><p className="mt-1 leading-relaxed text-ink-soft">{d.fitJustification}</p></div>
          {d.strengths.length > 0 && <div><h3 className="font-semibold">Strengths</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-ink-soft">{d.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>}
          {d.considerations.length > 0 && <div><h3 className="font-semibold">Worth checking</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-ink-soft">{d.considerations.map((s) => <li key={s}>{s}</li>)}</ul></div>}
          <SourceNote source={d.source} />
        </div>
      )}
    </Panel>
  );
}
