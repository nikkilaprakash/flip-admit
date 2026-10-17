"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { gbp } from "@/lib/config";
import { Alert, Badge, Button, cn, Field, Panel, textareaCls } from "../ui";
import Dialog from "../Dialog";

type Bid = { id: string; pct: number; perks: string[]; note: string; status: string; updatedRound: number; total: number; courseId: string };

export default function OfferPanel(p: {
  courseId: string; studentId: string; round: number | null; closed: boolean; tuition: number; years: number; maxTuition: number | null;
  seatsLeft: number; fundLeft: number; steps: number[]; perks: string[]; studentStatus: string;
  market: { competing: { pct: number; perks: string[] }[]; highestPct: number | null }; bid: Bid | null;
}) {
  const router = useRouter();
  const active = p.bid?.status === "active" ? p.bid : null;
  const [pct, setPct] = useState(active?.pct ?? 0);
  const [perks, setPerks] = useState<string[]>(active?.perks ?? []);
  const [note, setNote] = useState(active?.note ?? "");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  const annual = Math.round((pct / 100) * p.tuition);
  const total = annual * p.years;
  const extraFund = total - (active?.total ?? 0);
  const needForBudget = p.maxTuition && p.tuition > p.maxTuition ? Math.ceil(((p.tuition - p.maxTuition) / p.tuition) * 100) : null;
  const toLead = p.market.highestPct !== null ? p.steps.find((s) => s > p.market.highestPct!) ?? null : null;

  const header = <h2 className="text-lg font-bold">{active ? "Your offer" : "Make an offer"}</h2>;

  // Terminal and locked states
  if (p.bid && p.bid.status !== "active") {
    const text: Record<string, string> = {
      accepted: "They accepted your offer. A seat on this course is now filled.", rejected: "They declined your offer. You can't make another one.",
      declined: "They accepted another university's offer.", expired: "Your offer expired when the cycle closed.",
    };
    return <Panel className="p-6">{header}<p className="mt-3"><Badge tone={p.bid.status === "accepted" ? "teal" : "neutral"}>{p.bid.pct}% scholarship</Badge></p><p className="mt-3 text-ink-soft">{text[p.bid.status]}</p></Panel>;
  }
  if (!active && p.studentStatus !== "live") return <Panel className="p-6">{header}<p className="mt-3 text-ink-soft">This student isn't taking offers any more.</p></Panel>;
  if (p.closed || !p.round) return <Panel className="p-6">{header}<p className="mt-3 text-ink-soft">The admissions cycle is closed.</p></Panel>;
  const unchanged = active && pct === active.pct && perks.length === active.perks.length;
  return (
    <Panel className="p-6">
      {header}
      {active && <p className="mt-1 text-[15px] text-ink-soft">Currently {active.pct}%. Offers can be raised any number of times, never lowered.</p>}
      <div className="mt-5 space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Scholarship (share of tuition)</legend>
          <div className="grid grid-cols-5 gap-1.5">
            {p.steps.map((s) => {
              const disabled = !!active && s < active.pct;
              return (
                <label key={s} className={cn("flex cursor-pointer flex-col items-center rounded-lg border py-2 text-[15px] font-semibold",
                  pct === s ? "border-teal bg-teal text-white" : "border-line hover:bg-mist", disabled && "cursor-not-allowed opacity-40")}>
                  <input type="radio" name="pct" className="sr-only" value={s} checked={pct === s} disabled={disabled} onChange={() => setPct(s)} />{s}%
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-[15px] tabular">{gbp(annual)} a year, <strong>{gbp(total)}</strong> over {p.years} {p.years === 1 ? "year" : "years"}</p>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Extra perks</legend>
          <div className="space-y-2">
            {p.perks.map((perk) => {
              const locked = !!active?.perks.includes(perk);
              return (
                <label key={perk} className="flex items-center gap-3 text-[15px]">
                  <input type="checkbox" className="h-5 w-5 accent-[#0E6B66]" checked={perks.includes(perk)} disabled={locked}
                    onChange={(e) => setPerks(e.target.checked ? [...perks, perk] : perks.filter((x) => x !== perk))} />{perk}
                </label>
              );
            })}
          </div>
        </fieldset>
        <Field label="Message to the student (optional)" htmlFor="note"><textarea id="note" rows={3} maxLength={500} className={textareaCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>

        <div className="space-y-2 rounded-lg bg-mist p-4 text-[15px]">
          <Market {...p.market} />
          {toLead !== null && <p>To beat the highest offer, go to <strong>{toLead}%</strong> or add perks.</p>}
          {needForBudget !== null && <p>Their budget is {gbp(p.maxTuition!)} a year. Offer at least <strong>{needForBudget}%</strong> to bring the fee within it.</p>}
          <p className="text-ink-soft tabular">Fund left on this course: {gbp(p.fundLeft)}. {active ? "Seat already reserved." : `Seats you can still offer: ${p.seatsLeft}.`}</p>
          {extraFund > p.fundLeft && <p className="font-semibold text-danger">This offer needs {gbp(extraFund)}, more than the fund left.</p>}
        </div>
        {msg.err && <Alert tone="error">{msg.err}</Alert>}
        {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
        <Button className="w-full" disabled={!!unchanged || extraFund > p.fundLeft || (!active && p.seatsLeft <= 0)} onClick={() => setConfirm(true)}>{active ? "Raise offer" : "Send offer"}</Button>
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={active ? "Raise this offer?" : "Send this offer?"}>
        <p className="text-ink-soft">{pct}% scholarship ({gbp(total)} in total){perks.length ? ` with ${perks.join(", ").toLowerCase()}` : ""}. It can't be lowered or withdrawn, and you can raise it multiple times.</p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button disabled={busy} onClick={async () => {
            setBusy(true); setMsg({});
            const r = await fetch("/api/university/bids", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ courseId: p.courseId, studentId: p.studentId, scholarshipPct: pct, perks, note }) });
            const j = await r.json().catch(() => ({}));
            setBusy(false); setConfirm(false);
            if (!r.ok) setMsg({ err: j.error }); else { setMsg({ ok: active ? "Offer raised. The student has been emailed." : "Offer sent. The student has been emailed." }); router.refresh(); }
          }}>{busy ? "Sending…" : active ? "Raise offer" : "Send offer"}</Button>
        </div>
      </Dialog>
    </Panel>
  );
}

function Market({ competing, highestPct }: { competing: { pct: number; perks: string[] }[]; highestPct: number | null }) {
  if (!competing.length) return <p>No other university has made this student an offer yet.</p>;
  return (
    <div>
      <p>{competing.length} other {competing.length === 1 ? "university has" : "universities have"} made offers. Highest scholarship: <strong>{highestPct}%</strong>.</p>
      <ul className="mt-2 space-y-1 text-ink-soft">
        {competing.map((offer, i) => <li key={`${offer.pct}-${i}`}>{offer.pct}% scholarship{offer.perks.length ? ` · ${offer.perks.join(", ")}` : ""}</li>)}
      </ul>
    </div>
  );
}
