"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button } from "../ui";
import Dialog from "../Dialog";

export default function RoundControl({ round, closed }: { round: number | null; closed: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const action = closed ? "new-cycle" : "advance";
  const label = closed ? "Start a new cycle" : round === 3 ? "Close round 3 and end the cycle" : `Close round ${round} and open round ${(round ?? 0) + 1}`;
  return (
    <>
      <Button variant={round === 3 ? "danger" : "primary"} onClick={() => setConfirm(true)}>{label}</Button>
      {err && <div className="mt-3"><Alert tone="error">{err}</Alert></div>}
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={label}>
        <p className="text-ink-soft">{round === 3 ? "All open offers will expire and students who haven't accepted will be refunded. This can't be undone." : closed ? "Round 1 opens and universities can make offers again." : "Universities will be able to raise their offers once in the new round."}</p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button disabled={busy} onClick={async () => {
            setBusy(true); setErr(null);
            const r = await fetch("/api/admin/rounds", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
            const j = await r.json().catch(() => ({}));
            setBusy(false); setConfirm(false);
            if (!r.ok) setErr(j.error); else router.refresh();
          }}>{busy ? "Working…" : "Confirm"}</Button>
        </div>
      </Dialog>
    </>
  );
}
