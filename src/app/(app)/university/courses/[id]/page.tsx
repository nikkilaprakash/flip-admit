import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { coursesForUniversity, rankedStudentsForCourse, universityForUser } from "@/lib/market";
import { gbp, levelLabel, RELATION_LABEL } from "@/lib/config";
import { Badge, ButtonLink, Empty, Meter, PageHeader, Panel, Tabs } from "@/components/ui";
import CourseForm from "@/components/university/CourseForm";

export default async function CoursePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser("university");
  const uni = await universityForUser(user.id);
  const { id } = await params;
  const { tab = "details" } = await searchParams;
  const course = (await coursesForUniversity(uni.id)).find((c) => c.id === id);
  if (!course) notFound();
  const db = await getDb();
  const hasOffers = (await db.select({ id: schema.bids.id }).from(schema.bids).where(and(eq(schema.bids.courseId, id))).limit(1)).length > 0;
  const base = `/university/courses/${id}`;

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-[15px] text-ink-soft"><Link href="/university" className="hover:underline">Courses</Link> <span aria-hidden>/</span> {course.name}</nav>
      <PageHeader title={course.name} description={`${levelLabel(course.level)} in ${course.subjectArea}. ${gbp(course.tuitionFee)} a year for ${course.durationYears} ${course.durationYears === 1 ? "year" : "years"}.`} />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Panel className="p-5"><p className="text-sm text-ink-faint">Seats left</p><p className="mt-1 text-2xl font-bold tabular">{course.seatsLeft}/{course.seats}</p><div className="mt-3"><Meter value={course.seats - course.seatsLeft} max={course.seats} label="Seats filled" /></div></Panel>
        <Panel className="p-5"><p className="text-sm text-ink-faint">Open offers</p><p className="mt-1 text-2xl font-bold tabular">{course.open}</p></Panel>
        <Panel className="p-5"><p className="text-sm text-ink-faint">Scholarship fund left</p><p className="mt-1 text-2xl font-bold tabular">{gbp(course.fundLeft)}</p><p className="text-sm text-ink-faint">of {gbp(course.scholarshipFund)}</p></Panel>
      </div>
      <Tabs items={[{ href: `${base}?tab=details`, label: "Details", active: tab !== "students" }, { href: `${base}?tab=students`, label: "Students", active: tab === "students" }]} />
      {tab === "students" ? <StudentsTab courseId={id} uniId={uni.id} hasDescription={!!course.description} base={base} /> : (
        <Panel className="max-w-3xl p-6 sm:p-8">
          <CourseForm id={id} lockedMoney={hasOffers} initial={{ name: course.name, subjectArea: course.subjectArea, level: course.level, tuitionFee: course.tuitionFee, durationYears: course.durationYears, seats: course.seats, scholarshipFund: course.scholarshipFund, description: course.description }} />
        </Panel>
      )}
    </>
  );
}

async function StudentsTab({ courseId, uniId, hasDescription, base }: { courseId: string; uniId: string; hasDescription: boolean; base: string }) {
  if (!hasDescription) {
    return <Empty title="Add a course description first" action={<ButtonLink href={`${base}?tab=details`}>Write the description</ButtonLink>}>
      Applicants are ranked by how well their documents fit your description, so the list appears once you've written one.
    </Empty>;
  }
  const rows = await rankedStudentsForCourse(courseId, uniId);
  if (!rows.length) {
    return <Empty title="No matching applicants yet">
      Applicants appear here when they're looking for this subject (or a related one) at this level, and your ranking meets their minimum. New applicants are added automatically.
    </Empty>;
  }
  return (
    <Panel as="div">
      <p className="border-b border-line px-6 py-4 text-[15px] text-ink-soft">{rows.length} {rows.length === 1 ? "applicant" : "applicants"}, best fit first. Open a student to see their documents, an AI summary and to make an offer.</p>
      <ol className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.studentId}>
            <Link href={`${base}/students/${r.studentId}`} className="group flex items-center gap-5 px-6 py-4 hover:bg-mist/60">
              <span className="w-8 text-xl font-bold text-ink-faint tabular" aria-label={`Rank ${r.rank}`}>{r.rank}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold group-hover:text-teal-dark">{r.name}</p>
                <p className="truncate text-[15px] text-ink-soft">{r.headline}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone={r.relation === "exact" ? "teal" : "neutral"}>{RELATION_LABEL[r.relation]}</Badge>
                  {r.overBudget && <Badge tone="gold">Tuition above their budget</Badge>}
                  {r.bid && <Badge tone={r.bid.status === "accepted" ? "teal" : r.bid.status === "active" ? "gold" : "neutral"}>{r.bid.status === "active" ? `Your offer: ${r.bid.pct}%` : r.bid.status === "accepted" ? "Accepted your offer" : `Offer ${r.bid.status}`}</Badge>}
                  {r.status === "accepted" && r.bid?.status !== "accepted" && <Badge>Accepted elsewhere</Badge>}
                </div>
              </div>
              <div className="w-24 text-right"><p className="text-xl font-bold tabular">{r.score}</p><p className="text-sm text-ink-faint">fit</p></div>
              <ChevronRight size={20} className="text-ink-faint" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
