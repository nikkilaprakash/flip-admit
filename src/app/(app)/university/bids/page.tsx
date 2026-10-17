import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { coursesForUniversity, universityBids, universityForUser } from "@/lib/market";
import { gbp } from "@/lib/config";
import { Badge, ButtonLink, Empty, PageHeader, Panel } from "@/components/ui";

export const metadata = { title: "Bid dashboard" };
const STATUS: Record<string, { label: string; tone: "teal" | "gold" | "neutral" | "danger" }> = {
  active: { label: "Open", tone: "gold" }, accepted: { label: "Accepted", tone: "teal" }, rejected: { label: "Declined by student", tone: "neutral" },
  declined: { label: "Accepted elsewhere", tone: "neutral" }, expired: { label: "Expired", tone: "neutral" },
};

export default async function BidDashboard() {
  const user = await requireUser("university");
  const uni = await universityForUser(user.id);
  const [rows, courses] = await Promise.all([universityBids(uni.id), coursesForUniversity(uni.id)]);
  const open = rows.filter((r) => r.bid.status === "active");
  const closed = rows.filter((r) => r.bid.status !== "active");
  const t = courses.reduce((a, c) => ({ seats: a.seats + c.seats, left: a.left + c.seatsLeft, fund: a.fund + c.scholarshipFund, fundLeft: a.fundLeft + c.fundLeft }), { seats: 0, left: 0, fund: 0, fundLeft: 0 });
  const committedOpen = open.reduce((s, r) => s + r.bid.totalAmount, 0);

  const Table = ({ items }: { items: typeof rows }) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <thead><tr className="border-b border-line text-sm text-ink-faint">
          <th scope="col" className="px-6 py-3 font-medium">Student</th><th scope="col" className="px-3 py-3 font-medium">Course</th>
          <th scope="col" className="px-3 py-3 font-medium">Funding allocated</th><th scope="col" className="px-3 py-3 font-medium">Perks</th>
          <th scope="col" className="px-6 py-3 font-medium">Status</th>
        </tr></thead>
        <tbody className="divide-y divide-line">
          {items.map(({ bid, course, studentName }) => (
            <tr key={bid.id} className="hover:bg-mist/60">
              <td className="px-6 py-4"><Link href={`/university/courses/${course.id}/students/${bid.studentId}`} className="font-semibold text-teal-dark hover:underline">{studentName}</Link></td>
              <td className="px-3 py-4 text-[15px]">{course.name}</td>
              <td className="px-3 py-4 tabular"><span className="font-semibold">{gbp(bid.totalAmount)}</span> <span className="text-[15px] text-ink-soft">({bid.scholarshipPct}%, {gbp(bid.annualAmount)} a year)</span></td>
              <td className="px-3 py-4 text-[15px] text-ink-soft">{bid.perks.length ? bid.perks.join(", ") : "None"}</td>
              <td className="px-6 py-4"><Badge tone={STATUS[bid.status].tone}>{STATUS[bid.status].label}</Badge>{bid.status === "active" && <p className="mt-1 text-sm text-ink-faint">Last changed in round {bid.updatedRound}</p>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageHeader title="Bid dashboard" description="Every offer you've made. Open a student to raise an offer." />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel className="p-5"><p className="text-sm text-ink-faint">Open offers</p><p className="mt-1 text-2xl font-bold tabular">{open.length}</p></Panel>
        <Panel className="p-5"><p className="text-sm text-ink-faint">Allocated to open offers</p><p className="mt-1 text-2xl font-bold tabular">{gbp(committedOpen)}</p></Panel>
        <Panel className="p-5"><p className="text-sm text-ink-faint">Fund left</p><p className="mt-1 text-2xl font-bold tabular">{gbp(t.fundLeft)}</p><p className="text-sm text-ink-faint">of {gbp(t.fund)}</p></Panel>
        <Panel className="p-5"><p className="text-sm text-ink-faint">Seats left</p><p className="mt-1 text-2xl font-bold tabular">{t.left}/{t.seats}</p></Panel>
      </div>
      {rows.length === 0 ? (
        <Empty title="No offers yet" action={<ButtonLink href="/university">Go to your courses</ButtonLink>}>Open a course, choose the Students tab and pick a student to make your first offer.</Empty>
      ) : (
        <div className="space-y-8">
          <Panel as="div"><h2 className="border-b border-line px-6 py-4 text-lg font-bold">Open offers</h2>{open.length ? <Table items={open} /> : <p className="px-6 py-6 text-ink-soft">No open offers right now.</p>}</Panel>
          {closed.length > 0 && <Panel as="div"><h2 className="border-b border-line px-6 py-4 text-lg font-bold">Decided and expired</h2><Table items={closed} /></Panel>}
          <Panel as="div">
            <h2 className="border-b border-line px-6 py-4 text-lg font-bold">By course</h2>
            <ul className="divide-y divide-line">
              {courses.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                  <Link href={`/university/courses/${c.id}?tab=students`} className="font-semibold hover:underline">{c.name}</Link>
                  <span className="text-[15px] text-ink-soft tabular">{c.seatsLeft}/{c.seats} seats left, {gbp(c.fundLeft)} fund left, {c.open} open</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}
