"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { ArrowUp } from "lucide-react";
import { gbp, levelLabel } from "@/lib/config";
import { Alert, Badge, Button, Empty, Panel } from "../ui";
import Dialog from "../Dialog";

type Offer = {
  id: string; university: string; ranking: number | null; course: string; level: string; tuition: number; years: number;
  pct: number; annual: number; total: number; perks: string[]; note: string; status: string; raised: boolean; round: number;
};

function Celebrate({ offer }: { offer: Offer }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#0E6B66", "#F2B544", "#172033", "#ffffff"];
    confetti({ particleCount: 140, spread: 75, origin: { y: 0.35 }, colors });
    const t = setTimeout(() => confetti({ particleCount: 90, spread: 110, origin: { y: 0.4 }, colors }), 450);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-[17px] font-semibold text-teal">Congratulations</p>
      <h1 className="mt-2 text-[34px] font-extrabold leading-tight sm:text-[44px]">You're going to {offer.university}</h1>
      <p className="mt-3 text-lg text-ink-soft">You accepted their offer for {offer.course}. They've been told, and your other offers have been declined for you.</p>
      <Panel className="mt-10 border-gold p-8 text-left ring-4 ring-gold/25">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xl font-bold">{offer.course}</p>
            <p className="text-ink-soft">{offer.university}{offer.ranking ? `, ranked ${offer.ranking} in the world` : ""}. {levelLabel(offer.level)}, {offer.years} {offer.years === 1 ? "year" : "years"}.</p>
          </div>
          <Badge tone="gold">Accepted</Badge>
        </div>
        <dl className="mt-6 grid gap-5 sm:grid-cols-3">
          <div><dt className="text-sm text-ink-faint">Scholarship</dt><dd className="text-2xl font-bold tabular">{offer.pct}%</dd></div>
          <div><dt className="text-sm text-ink-faint">Worth per year</dt><dd className="text-2xl font-bold tabular">{gbp(offer.annual)}</dd></div>
          <div><dt className="text-sm text-ink-faint">You pay per year</dt><dd className="text-2xl font-bold tabular">{gbp(offer.tuition - offer.annual)}</dd></div>
        </dl>
        {offer.perks.length > 0 && <p className="mt-6 text-ink-soft"><span className="font-semibold text-ink">Also included:</span> {offer.perks.join(", ")}.</p>}
        {offer.note && <blockquote className="mt-4 border-l-4 border-gold pl-4 text-ink-soft">{offer.note}</blockquote>}
        <p className="mt-6 text-sm text-ink-faint">£90 of your fee has been credited to {offer.university} as a deposit.</p>
      </Panel>
    </div>
  );
}

export default function OffersBoard({ offers, accepted, maxTuition, cycleClosed }: { offers: Offer[]; accepted: Offer | null; maxTuition: number | null; cycleClosed: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<{ offer: Offer; action: "accept" | "reject" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (accepted) return <Celebrate offer={accepted} />;

  const open = offers.filter((o) => o.status === "active");
  const past = offers.filter((o) => o.status !== "active");

  async function decide() {
    if (!confirm) return;
    setBusy(true); setErr(null);
    const r = await fetch(`/api/student/offers/${confirm.offer.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: confirm.action }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false); setConfirm(null);
    if (!r.ok) setErr(j.error); else router.refresh();
  }

  return (
    <div className="space-y-8">
      {err && <Alert tone="error">{err}</Alert>}
      {open.length === 0 ? (
        <Empty title={cycleClosed ? "No open offers" : "No offers yet"}>
          {cycleClosed ? "Offers that weren't accepted expired when the cycle closed." : "We'll email you as soon as a university makes an offer."}
        </Empty>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <caption className="sr-only">Your offers, ranked by scholarship value</caption>
              <thead>
                <tr className="border-b border-line text-sm text-ink-faint">
                  <th scope="col" className="w-12 px-5 py-3 font-medium">#</th>
                  <th scope="col" className="px-3 py-3 font-medium">University and course</th>
                  <th scope="col" className="px-3 py-3 font-medium">Scholarship</th>
                  <th scope="col" className="px-3 py-3 font-medium">Extra perks</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium"><span className="sr-only">Decision</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {open.map((o, i) => {
                  const pay = o.tuition - o.annual;
                  return (
                    <tr key={o.id} className={i === 0 ? "bg-gold-tint/40" : ""}>
                      <td className="px-5 py-4 align-top text-lg font-bold tabular">{i + 1}</td>
                      <td className="px-3 py-4 align-top">
                        <p className="font-semibold">{o.university}</p>
                        <p className="text-[15px] text-ink-soft">{o.course}</p>
                        {o.ranking && <p className="text-sm text-ink-faint">World ranking {o.ranking}</p>}
                      </td>
                      <td className="px-3 py-4 align-top">
                        <p className="flex items-center gap-2 font-semibold tabular">{o.pct}% <span className="font-normal text-ink-soft">({gbp(o.annual)} a year)</span>
                          {o.raised && <Badge tone="teal"><ArrowUp size={12} aria-hidden /> Raised in round {o.round}</Badge>}</p>
                        <p className="text-sm text-ink-soft tabular">You pay {gbp(pay)} of {gbp(o.tuition)} a year</p>
                        {maxTuition !== null && pay > maxTuition && <p className="text-sm text-danger">Above your {gbp(maxTuition)} budget</p>}
                      </td>
                      <td className="px-3 py-4 align-top text-[15px]">{o.perks.length ? o.perks.join(", ") : <span className="text-ink-faint">None</span>}
                        {o.note && <p className="mt-1 text-sm italic text-ink-soft">“{o.note}”</p>}</td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex justify-end gap-2">
                          <Button variant="danger" className="h-10" onClick={() => setConfirm({ offer: o, action: "reject" })} aria-label={`Decline offer from ${o.university}`}>Decline</Button>
                          <Button className="h-10" onClick={() => setConfirm({ offer: o, action: "accept" })} aria-label={`Accept offer from ${o.university}`}>Accept</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {past.length > 0 && (
        <details className="rounded-xl border border-line p-5">
          <summary className="cursor-pointer font-semibold">Past offers ({past.length})</summary>
          <ul className="mt-4 divide-y divide-line">
            {past.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[15px]">
                <span><strong>{o.university}</strong>, {o.course}, {o.pct}% scholarship</span>
                <Badge>{o.status === "rejected" ? "You declined" : o.status === "declined" ? "Declined when you accepted another" : "Expired"}</Badge>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.action === "accept" ? `Accept ${confirm.offer.university}?` : `Decline ${confirm?.offer.university}?`}>
        {confirm && (
          <div className="space-y-5">
            <p className="text-ink-soft">
              {confirm.action === "accept"
                ? `You'll take up ${confirm.offer.course} with a ${confirm.offer.pct}% scholarship. This is final: your other offers will be declined automatically.`
                : "The university won't be able to make you another offer. This can't be undone."}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant={confirm.action === "accept" ? "primary" : "danger"} disabled={busy} onClick={decide}>
                {busy ? "Saving…" : confirm.action === "accept" ? "Accept offer" : "Decline offer"}</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
