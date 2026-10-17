"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, FileText, Loader2, Lock, Plus, ShieldCheck, Sparkles, Trash2, Upload } from "lucide-react";
import type { Preferences, StudentProfile } from "@/db/schema";
import { FIELDS, gbp, LEVELS, RANKING_OPTIONS, RELATION_LABEL, Relation, levelLabel } from "@/lib/config";
import { Alert, Badge, Button, cn, Field, inputCls, Panel, SourceNote } from "../ui";
import Dialog from "../Dialog";

type Doc = { id: string; kind: "CV" | "SOP" | "LOR"; fileName: string; sizeBytes: number };
type Rec = { courseId: string; course: string; area: string; level: string; tuition: number; university: string; ranking: number | null; relation: Relation; score: number };

async function postJson(url: string, body?: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j;
}

function Step({ n, title, done, active, locked, summary, children }: { n: number; title: string; done: boolean; active: boolean; locked?: boolean; summary?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Panel className={cn("p-6 sm:p-7", active && "border-teal/50 ring-1 ring-teal/30")} aria-labelledby={`step-${n}`}>
      <div className="flex items-start gap-4">
        <span aria-hidden className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px] font-bold", done ? "bg-teal text-white" : active ? "bg-ink text-white" : "bg-mist text-ink-faint")}>
          {done ? <Check size={18} /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`step-${n}`} className="text-xl font-bold">{title} <span className="sr-only">{done ? "(complete)" : locked ? "(not available yet)" : ""}</span></h2>
          {summary && <div className="mt-1 text-ink-soft">{summary}</div>}
          {(active || done) && !locked && <div className="mt-5">{children}</div>}
        </div>
      </div>
    </Panel>
  );
}

const KIND_LABEL = { CV: "CV", SOP: "Statement of purpose", LOR: "Recommendation letters" };
const KIND_HINT = { CV: "One PDF.", SOP: "One PDF. The same statement is shown to every university.", LOR: "One to three PDFs." };

function DocumentsStep({ docs, locked, onChange }: { docs: Doc[]; locked: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function upload(kind: string, file: File) {
    setBusy(kind); setErr(null);
    const fd = new FormData(); fd.append("kind", kind); fd.append("file", file);
    const r = await fetch("/api/student/documents", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setErr(`${KIND_LABEL[kind as "CV"]}: ${j.error}`); else onChange();
    setBusy(null);
  }
  return (
    <div className="space-y-3">
      {(["CV", "SOP", "LOR"] as const).map((kind) => {
        const mine = docs.filter((d) => d.kind === kind);
        const canAdd = !locked && (kind === "LOR" ? mine.length < 3 : true);
        return (
          <div key={kind} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{KIND_LABEL[kind]}</p>
                <p className="text-sm text-ink-faint">{KIND_HINT[kind]}</p>
              </div>
              {canAdd && (
                <label className={cn("inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-[15px] font-semibold hover:bg-mist focus-within:ring-2 focus-within:ring-teal", busy === kind && "opacity-60")}>
                  {busy === kind ? <Loader2 size={16} className="animate-spin" aria-hidden /> : mine.length && kind !== "LOR" ? <Upload size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
                  {busy === kind ? "Reading PDF…" : mine.length && kind !== "LOR" ? "Replace" : kind === "LOR" && mine.length ? "Add another" : "Upload PDF"}
                  <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={!!busy}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(kind, f); e.target.value = ""; }} />
                </label>
              )}
            </div>
            {mine.length > 0 && (
              <ul className="mt-3 space-y-2">
                {mine.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-md bg-mist px-3 py-2 text-[15px]">
                    <FileText size={18} className="shrink-0 text-teal" aria-hidden />
                    <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium hover:underline">{d.fileName}</a>
                    <span className="text-sm text-ink-faint">{(d.sizeBytes / 1024).toFixed(0)} KB</span>
                    {!locked && (
                      <button aria-label={`Remove ${d.fileName}`} className="rounded p-1 text-ink-faint hover:text-danger"
                        onClick={async () => { await fetch(`/api/student/documents/${d.id}`, { method: "DELETE" }); onChange(); }}><Trash2 size={16} /></button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {err && <Alert tone="error">{err}</Alert>}
      {locked && <p className="flex items-center gap-2 text-sm text-ink-faint"><Lock size={14} aria-hidden /> Documents are locked once universities can see your application.</p>}
    </div>
  );
}

function Recommendations({ recs }: { recs: Rec[] }) {
  if (!recs.length) return <p className="text-ink-soft">No university has listed a matching course yet. Once they do, they'll see you and can make an offer.</p>;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {recs.map((r) => (
        <li key={r.courseId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{r.course}</p>
            <p className="text-sm text-ink-soft">{r.university}{r.ranking ? `, ranked ${r.ranking} in the world` : ""}</p>
          </div>
          <span className="text-sm text-ink-soft tabular">{gbp(r.tuition)} a year</span>
          <Badge tone={r.relation === "exact" ? "teal" : "neutral"}>{r.score}% match</Badge>
        </li>
      ))}
    </ul>
  );
}

function AnalysisStep({ profile, recs, onDone }: { profile: StudentProfile | null; recs: Rec[]; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!profile) {
    return (
      <div className="space-y-4">
        <p className="text-ink-soft">AI reads your documents, summarises your profile and suggests courses and universities that suit you. This takes about 20 seconds.</p>
        {err && <Alert tone="error">{err}</Alert>}
        <Button disabled={busy} onClick={async () => { setBusy(true); setErr(null); try { await postJson("/api/student/analyse"); onDone(); } catch (e) { setErr((e as Error).message); } setBusy(false); }}>
          {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Sparkles size={18} aria-hidden />}{busy ? "Reading your documents…" : "Analyse my documents"}
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <p className="text-lg font-semibold">{profile.headline}</p>
        <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">{profile.summary}</p>
        <div className="mt-2"><SourceNote source={profile.source} /></div>
      </div>
      {profile.skills.length > 0 && (
        <div>
          <h3 className="font-semibold">Skills we found</h3>
          <ul className="mt-2 flex flex-wrap gap-2">{profile.skills.map((s) => <li key={s.skill} title={s.evidence}><Badge>{s.skill}</Badge></li>)}</ul>
        </div>
      )}
      {profile.suggestedAreas.length > 0 && (
        <div>
          <h3 className="font-semibold">Courses that suit you</h3>
          <ul className="mt-2 space-y-2">
            {profile.suggestedAreas.map((a) => (
              <li key={a.area} className="rounded-lg bg-gold-tint px-4 py-3"><span className="font-semibold">{a.area}.</span> <span className="text-ink-soft">{a.reason}</span></li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h3 className="mb-2 font-semibold">Universities to target</h3>
        <Recommendations recs={recs} />
      </div>
    </div>
  );
}

function PrioritiesStep({ initial, profile, onSaved }: { initial: Preferences | null; profile: StudentProfile | null; onSaved: (live: boolean) => void }) {
  const suggested = profile?.suggestedAreas ?? [];
  const [level, setLevel] = useState<Preferences["level"]>(initial?.level ?? "PGT");
  const [areas, setAreas] = useState<string[]>(initial?.areas?.length ? initial.areas : [suggested[0]?.area ?? ""]);
  const [minRanking, setMinRanking] = useState<number | null>(initial ? initial.minRanking : 200);
  const [maxTuition, setMaxTuition] = useState<string>(initial?.maxTuition ? String(initial.maxTuition) : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const chosen = areas.filter(Boolean);
  const missingSuggestions = suggested.filter((s) => !chosen.includes(s.area));

  return (
    <form className="space-y-6" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setMsg({});
      try {
        const r = await postJson("/api/student/preferences", { level, areas: chosen, minRanking, maxTuition: maxTuition ? Number(maxTuition) : null });
        setMsg({ ok: "Priorities saved." }); onSaved(r.live);
      } catch (er) { setMsg({ err: (er as Error).message }); }
      setBusy(false);
    }}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Study level" htmlFor="lvl">
          <select id="lvl" className={inputCls} value={level} onChange={(e) => setLevel(e.target.value as Preferences["level"])}>
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </Field>
        <Field label="Minimum university ranking" htmlFor="rk" hint="Only universities at or above this world ranking can make you offers.">
          <select id="rk" className={inputCls} value={minRanking ?? ""} onChange={(e) => setMinRanking(e.target.value ? Number(e.target.value) : null)}>
            {RANKING_OPTIONS.map((o) => <option key={o.label} value={o.value ?? ""}>{o.label}</option>)}
          </select>
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Courses you want (up to 3)</legend>
        <p className="text-sm text-ink-faint">Universities with related courses can also reach you. For example, choosing Computer Science includes Artificial Intelligence and Data Science courses.</p>
        {areas.map((a, i) => (
          <div key={i} className="flex gap-2">
            <label className="sr-only" htmlFor={`area-${i}`}>Course preference {i + 1}</label>
            <select id={`area-${i}`} className={inputCls} value={a} onChange={(e) => setAreas(areas.map((x, j) => (j === i ? e.target.value : x)))}>
              <option value="">Choose a course</option>
              {FIELDS.map((f) => (
                <optgroup key={f.field} label={f.field}>
                  {f.areas.map((ar) => <option key={ar} value={ar} disabled={areas.includes(ar) && ar !== a}>{ar}</option>)}
                </optgroup>
              ))}
            </select>
            {areas.length > 1 && <Button type="button" variant="ghost" aria-label={`Remove course preference ${i + 1}`} onClick={() => setAreas(areas.filter((_, j) => j !== i))}><Trash2 size={18} /></Button>}
          </div>
        ))}
        {areas.length < 3 && <Button type="button" variant="secondary" onClick={() => setAreas([...areas, ""])}><Plus size={18} aria-hidden /> Add a course</Button>}
        {missingSuggestions.length > 0 && chosen.length < 3 && (
          <div className="rounded-lg border border-gold/60 bg-gold-tint p-4">
            <p className="flex items-center gap-2 font-semibold"><Sparkles size={16} aria-hidden /> AI thinks these also suit your profile</p>
            <ul className="mt-2 space-y-2">
              {missingSuggestions.map((s) => (
                <li key={s.area} className="flex flex-wrap items-center justify-between gap-2">
                  <span><strong>{s.area}</strong> <span className="text-ink-soft">{s.reason}</span></span>
                  <Button type="button" variant="secondary" className="h-9" onClick={() => setAreas([...chosen, s.area].slice(0, 3))}>Add</Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </fieldset>

      <Field label="Maximum tuition fee per year" htmlFor="mt" hint="Universities above this will see how much scholarship they'd need to offer to fit your budget. Leave empty for no limit.">
        <div className="relative max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">£</span>
          <input id="mt" type="number" min={1000} step={500} inputMode="numeric" className={cn(inputCls, "pl-7")} value={maxTuition} onChange={(e) => setMaxTuition(e.target.value)} />
        </div>
      </Field>
      {msg.err && <Alert tone="error">{msg.err}</Alert>}
      {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
      <Button disabled={busy || !chosen.length}>{busy ? "Saving…" : "Save priorities"}</Button>
    </form>
  );
}

const fmtCard = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
const fmtExp = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };

function PaymentStep({ onPaid }: { onPaid: (live: boolean) => void }) {
  const key = useRef(`idem_${crypto.randomUUID()}`);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [card, setCard] = useState({ name: "", number: "", exp: "", cvc: "" });
  const [busy, setBusy] = useState(false);
  const [threeDs, setThreeDs] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { postJson("/api/payments/intent", { idempotencyKey: key.current }).then((r) => setIntentId(r.id)).catch((e) => setErr(e.message)); }, []);

  async function pay(decision?: "approve" | "decline") {
    if (!intentId) return;
    setBusy(true); setErr(null); setThreeDs(false);
    try {
      const r = await postJson("/api/payments/confirm", { intentId, number: card.number, exp: card.exp, cvc: card.cvc, threeDs: decision });
      if (r.status === "requires_action") setThreeDs(true);
      else if (r.status === "succeeded") onPaid(r.live);
      else setErr(r.message || "Payment failed.");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  return (
    <div className="grid gap-8 md:grid-cols-[1fr_260px]">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); pay(); }}>
        <p className="flex items-center gap-2 text-sm font-semibold text-gold-ink"><span className="rounded bg-gold px-2 py-0.5 text-ink">Test mode</span> No real money is taken.</p>
        <Field label="Name on card" htmlFor="cn"><input id="cn" className={inputCls} autoComplete="cc-name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} required /></Field>
        <Field label="Card number" htmlFor="cc"><input id="cc" className={inputCls} inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234" value={card.number} onChange={(e) => setCard({ ...card, number: fmtCard(e.target.value) })} required /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Expiry date" htmlFor="ce"><input id="ce" className={inputCls} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={card.exp} onChange={(e) => setCard({ ...card, exp: fmtExp(e.target.value) })} required /></Field>
          <Field label="Security code" htmlFor="cv"><input id="cv" className={inputCls} inputMode="numeric" autoComplete="cc-csc" placeholder="123" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })} required /></Field>
        </div>
        {err && <Alert tone="error">{err}</Alert>}
        <Button className="w-full" disabled={busy || !intentId}>{busy ? <><Loader2 size={18} className="animate-spin" aria-hidden /> Processing…</> : "Pay £100"}</Button>
      </form>
      <aside className="space-y-4 text-[15px]">
        <div className="rounded-lg bg-mist p-4">
          <p className="font-semibold">What the £100 covers</p>
          <p className="mt-1 text-ink-soft">£90 becomes a deposit at the university you accept. If no one makes you an offer, you get the full £100 back.</p>
        </div>
        <div className="rounded-lg border border-line p-4">
          <p className="font-semibold">Test cards</p>
          <ul className="mt-2 space-y-1.5">
            {[["4242 4242 4242 4242", "Pays"], ["4000 0000 0000 0002", "Declined"], ["4000 0000 0000 3220", "Asks for 3D Secure"]].map(([n, l]) => (
              <li key={n}><button type="button" className="w-full text-left hover:text-teal" onClick={() => setCard({ ...card, number: n, exp: card.exp || "12/30", cvc: card.cvc || "123", name: card.name || "Test Card" })}>
                <span className="tabular">{n}</span><span className="block text-sm text-ink-faint">{l}</span></button></li>
            ))}
          </ul>
        </div>
      </aside>
      <Dialog open={threeDs} onClose={() => setThreeDs(false)} title="Confirm with your bank">
        <div className="space-y-4 text-center">
          <ShieldCheck className="mx-auto text-teal" size={36} aria-hidden />
          <p className="text-ink-soft">Test 3D Secure check for a £100.00 payment to FlipAdmit.</p>
          <div className="flex justify-center gap-3"><Button variant="secondary" onClick={() => pay("decline")}>Decline</Button><Button onClick={() => pay("approve")}>Approve</Button></div>
        </div>
      </Dialog>
    </div>
  );
}

export default function SetupFlow({ live, cycleClosed, docs, profile, preferences, paid, recommendations }: {
  live: boolean; cycleClosed: boolean; docs: Doc[]; profile: StudentProfile | null; preferences: Preferences | null; paid: boolean; recommendations: Rec[];
}) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const docsDone = docs.some((d) => d.kind === "CV") && docs.some((d) => d.kind === "SOP") && docs.some((d) => d.kind === "LOR");
  const goLive = (isLive: boolean) => { if (isLive) router.push("/student/offers"); router.refresh(); };
  const current = !docsDone ? 1 : !profile ? 2 : !preferences ? 3 : !paid ? 4 : 0;
  const allDone = docsDone && !!profile && !!preferences && paid;

  return (
    <div className="space-y-4">
      {!live && cycleClosed && <Alert tone="info">The admissions cycle is closed. You can prepare your application now and go live when the next cycle opens.</Alert>}
      {!live && allDone && !cycleClosed && <Alert tone="info">Everything is in place. Reload the page if you aren't taken to your offers.</Alert>}
      <Step n={1} title="Upload your documents" done={docsDone} active={current === 1 || live} summary={docsDone ? `${docs.length} PDFs uploaded.` : "Your CV, statement of purpose and at least one recommendation letter."}>
        <DocumentsStep docs={docs} locked={live} onChange={refresh} />
      </Step>
      <Step n={2} title="AI review" done={!!profile} active={current === 2} locked={!docsDone} summary={profile ? undefined : "Course and university suggestions based on your documents."}>
        <AnalysisStep profile={profile} recs={recommendations} onDone={refresh} />
      </Step>
      <Step n={3} title="Your priorities" done={!!preferences} active={current === 3} locked={!profile}
        summary={preferences ? `${levelLabel(preferences.level)} in ${preferences.areas.join(", ")}. ${preferences.minRanking ? `Top ${preferences.minRanking} universities` : "Any ranking"}${preferences.maxTuition ? `, up to ${gbp(preferences.maxTuition)} a year` : ""}.` : "What you want to study and what you can afford."}>
        <PrioritiesStep initial={preferences} profile={profile} onSaved={goLive} />
      </Step>
      <Step n={4} title="Pay and go live" done={paid} active={current === 4} locked={!preferences}
        summary={paid ? (live ? "Paid. Universities can see your application." : "Paid.") : "A one-time £100 fee. Universities see you as soon as it's paid."}>
        {!paid && <PaymentStep onPaid={goLive} />}
      </Step>
    </div>
  );
}
