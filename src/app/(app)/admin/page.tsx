import { desc, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { aiUsage } from "@/lib/llm";
import { mailConfigured } from "@/lib/mail";
import { ledgerSummary, roundState } from "@/lib/market";
import { pence } from "@/lib/config";
import { PageHeader, Panel } from "@/components/ui";
import RoundControl from "@/components/admin/RoundControl";

export const metadata = { title: "Control room" };

export default async function AdminPage() {
  await requireUser("admin");
  const db = await getDb();
  const [r, ledger, ai] = await Promise.all([roundState(), ledgerSummary(), aiUsage()]);
  const count = async (q: Promise<{ n: number }[]>) => Number((await q)[0].n);
  const [unis, liveStudents, accepted, openBids] = await Promise.all([
    count(db.select({ n: sql<number>`count(*)` }).from(schema.universities)),
    count(db.select({ n: sql<number>`count(*)` }).from(schema.students).where(sql`${schema.students.status} = 'live'`)),
    count(db.select({ n: sql<number>`count(*)` }).from(schema.students).where(sql`${schema.students.status} = 'accepted'`)),
    count(db.select({ n: sql<number>`count(*)` }).from(schema.bids).where(sql`${schema.bids.status} = 'active'`)),
  ]);
  const log = await db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.id)).limit(25);
  const stat = (label: string, value: string | number) => <Panel className="p-5"><p className="text-sm text-ink-faint">{label}</p><p className="mt-1 text-2xl font-bold tabular">{value}</p></Panel>;
  return (
    <>
      <PageHeader title="Control room" description="Run the admissions cycle and check payments, AI usage and email." />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat("Universities", unis)}{stat("Students taking offers", liveStudents)}{stat("Students placed", accepted)}{stat("Open offers", openBids)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-6">
          <h2 className="text-lg font-bold">Rounds</h2>
          <p className="mt-1 text-ink-soft">{r.closed ? "The cycle is closed." : `Round ${r.round} of 3 is open.`} Closing round 3 expires open offers and refunds students who didn't accept one.</p>
          <div className="mt-5"><RoundControl round={r.round} closed={r.closed} /></div>
        </Panel>
        <Panel className="p-6">
          <h2 className="text-lg font-bold">Payments</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <div><dt className="text-sm text-ink-faint">Held in escrow</dt><dd className="text-xl font-bold tabular">{pence(ledger.escrow)}</dd></div>
            <div><dt className="text-sm text-ink-faint">Platform revenue</dt><dd className="text-xl font-bold tabular">{pence(ledger.revenue)}</dd></div>
            <div><dt className="text-sm text-ink-faint">Owed to universities</dt><dd className="text-xl font-bold tabular">{pence(ledger.payables)}</dd></div>
            <div><dt className="text-sm text-ink-faint">Ledger</dt><dd className={`text-xl font-bold ${ledger.balanced ? "text-teal" : "text-danger"}`}>{ledger.balanced ? "Balanced" : "Out of balance"}</dd></div>
          </dl>
        </Panel>
        <Panel className="p-6">
          <h2 className="text-lg font-bold">AI</h2>
          <p className="mt-1 text-ink-soft">{ai.enabled ? "Connected to Nebius." : "No NEBIUS_API_KEY set. AI features use built-in fallbacks."} Embeddings: {ai.embeddings}.</p>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <div><dt className="text-sm text-ink-faint">Calls</dt><dd className="text-xl font-bold tabular">{ai.calls}</dd></div>
            <div><dt className="text-sm text-ink-faint">Cached answers reused</dt><dd className="text-xl font-bold tabular">{ai.hits}</dd></div>
            <div><dt className="text-sm text-ink-faint">Tokens in / out</dt><dd className="font-bold tabular">{ai.inTok.toLocaleString()} / {ai.outTok.toLocaleString()}</dd></div>
            <div><dt className="text-sm text-ink-faint">Estimated spend</dt><dd className="font-bold tabular">${ai.cost.toFixed(4)}</dd></div>
          </dl>
        </Panel>
        <Panel className="p-6">
          <h2 className="text-lg font-bold">Email</h2>
          <p className="mt-1 text-ink-soft">{mailConfigured() ? `Sending through ${process.env.SMTP_HOST} with Nodemailer.` : "SMTP isn't configured, so emails (including sign-in codes) are printed in the server console."}</p>
        </Panel>
      </div>
      <Panel className="mt-6 p-6">
        <h2 className="text-lg font-bold">Recent activity</h2>
        <ul className="mt-4 divide-y divide-line text-[15px]">
          {log.map((l) => <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2.5"><span className="font-medium">{l.action}</span><span className="text-ink-faint tabular">{l.createdAt.toLocaleString("en-GB")}</span></li>)}
          {!log.length && <li className="py-2 text-ink-soft">Nothing yet.</li>}
        </ul>
      </Panel>
    </>
  );
}
