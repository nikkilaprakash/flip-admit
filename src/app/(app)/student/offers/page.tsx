import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { offersForStudent, roundState, studentForUser } from "@/lib/market";
import { PageHeader } from "@/components/ui";
import OffersBoard from "@/components/student/OffersBoard";

export const metadata = { title: "My offers" };

export default async function OffersPage() {
  const user = await requireUser("student");
  const st = await studentForUser(user.id);
  if (st.status === "setup") redirect("/student/setup");
  const r = await roundState();
  const rows = await offersForStudent(st.id);
  const offers = rows.map(({ bid, course, uniName, ranking }) => ({
    id: bid.id, university: uniName, ranking, course: course.name, level: course.level, tuition: course.tuitionFee, years: course.durationYears,
    pct: bid.scholarshipPct, annual: bid.annualAmount, total: bid.totalAmount, perks: bid.perks, note: bid.note, status: bid.status,
    raised: bid.updatedRound > bid.placedRound, round: bid.updatedRound,
  }));
  const accepted = offers.find((o) => o.status === "accepted");
  return (
    <>
      {!accepted && (
        <PageHeader title={`Hi ${user.name.split(" ")[0]}`}
          description={st.status === "closed" ? "This admissions cycle has closed." : offers.some((o) => o.status === "active")
            ? "Here are your offers, best funded first. Universities can still raise them until Round 3 closes."
            : "Universities that match your priorities can now see your application. Offers will appear here, and we'll email you when one arrives."} />
      )}
      <OffersBoard offers={offers} accepted={accepted ?? null} maxTuition={st.preferences?.maxTuition ?? null} cycleClosed={r.closed} />
    </>
  );
}
