import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { coursesForUniversity, roundState, studentForUniversity, universityForUser } from "@/lib/market";
import { gbp, levelLabel, PERKS, RELATION_LABEL, SCHOLARSHIP_STEPS } from "@/lib/config";
import { Badge, PageHeader, Panel } from "@/components/ui";
import Insight from "@/components/university/Insight";
import OfferPanel from "@/components/university/OfferPanel";

export default async function StudentDetail({ params }: { params: Promise<{ id: string; studentId: string }> }) {
  const user = await requireUser("university");
  const uni = await universityForUser(user.id);
  const { id, studentId } = await params;
  const d = await studentForUniversity(studentId, id, uni.id);
  if (!d) notFound();
  const course = (await coursesForUniversity(uni.id)).find((c) => c.id === id)!;
  const r = await roundState();
  const p = d.student.preferences;
  const prof = d.student.profile;
  const docLabel = { CV: "CV", SOP: "Statement of purpose", LOR: "Recommendation letter" };

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-[15px] text-ink-soft">
        <Link href="/university" className="hover:underline">Courses</Link> <span aria-hidden>/</span>{" "}
        <Link href={`/university/courses/${id}?tab=students`} className="hover:underline">{d.course.name}</Link> <span aria-hidden>/</span> {d.name}
      </nav>
      <PageHeader title={d.name} description={<>Ranked <strong className="text-ink">{d.entry.rank} of {d.total}</strong> for {d.course.name} with a fit score of <strong className="text-ink">{d.entry.score}</strong>. {RELATION_LABEL[d.entry.relation]}.</>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Insight studentId={studentId} courseId={id} />
          <Panel className="p-6">
            <h2 className="text-lg font-bold">What they're looking for</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-sm text-ink-faint">Level</dt><dd className="font-medium">{p ? levelLabel(p.level) : "Not set"}</dd></div>
              <div><dt className="text-sm text-ink-faint">Courses</dt><dd className="font-medium">{p?.areas.join(", ") || "Not set"}</dd></div>
              <div><dt className="text-sm text-ink-faint">Minimum ranking</dt><dd className="font-medium">{p?.minRanking ? `Top ${p.minRanking}` : "Any"}</dd></div>
              <div><dt className="text-sm text-ink-faint">Maximum tuition</dt><dd className="font-medium">{p?.maxTuition ? `${gbp(p.maxTuition)} a year` : "No limit"}</dd></div>
            </dl>
          </Panel>
          {prof && (
            <Panel className="p-6">
              <h2 className="text-lg font-bold">Profile</h2>
              <p className="mt-2 font-semibold">{prof.headline}</p>
              <p className="mt-1 leading-relaxed text-ink-soft">{prof.summary}</p>
              {prof.skills.length > 0 && <ul className="mt-4 space-y-2">{prof.skills.map((s) => <li key={s.skill} className="text-[15px]"><strong>{s.skill}.</strong> {s.evidence && <span className="text-ink-soft">“{s.evidence}”</span>}</li>)}</ul>}
            </Panel>
          )}
          <Panel className="p-6">
            <h2 className="text-lg font-bold">Documents</h2>
            <ul className="mt-3 space-y-2">
              {d.docs.map((doc) => (
                <li key={doc.id}>
                  <a href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-line px-4 py-3 hover:bg-mist">
                    <FileText size={20} className="text-teal" aria-hidden />
                    <span className="flex-1"><span className="font-semibold">{docLabel[doc.kind]}</span> <span className="text-ink-soft">{doc.fileName}</span></span>
                    <span className="text-sm text-teal">Open PDF</span>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <OfferPanel
            courseId={id} studentId={studentId} round={r.round} closed={r.closed}
            tuition={d.course.tuitionFee} years={d.course.durationYears} maxTuition={p?.maxTuition ?? null}
            seatsLeft={course.seats - course.accepted - course.open} fundLeft={course.fundLeft}
            steps={SCHOLARSHIP_STEPS} perks={PERKS} studentStatus={d.student.status}
            market={d.market}
            bid={d.myBid ? { id: d.myBid.id, pct: d.myBid.scholarshipPct, perks: d.myBid.perks, note: d.myBid.note, status: d.myBid.status, updatedRound: d.myBid.updatedRound, total: d.myBid.totalAmount, courseId: d.myBid.courseId } : null}
          />
          {d.student.status === "accepted" && d.myBid?.status === "accepted" && <div className="mt-4"><Badge tone="teal">Contact: {d.email}</Badge></div>}
        </div>
      </div>
    </>
  );
}
