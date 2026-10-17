import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { coursesForUniversity, universityForUser } from "@/lib/market";
import { gbp, levelLabel } from "@/lib/config";
import { Alert, ButtonLink, Empty, Meter, PageHeader, Panel } from "@/components/ui";

export const metadata = { title: "Welcome" };

export default async function UniversityHome() {
  const user = await requireUser("university");
  const uni = await universityForUser(user.id);
  const courses = await coursesForUniversity(uni.id);
  const totals = courses.reduce((t, c) => ({ seats: t.seats + c.seats, left: t.left + c.seatsLeft, open: t.open + c.open, fundLeft: t.fundLeft + c.fundLeft }), { seats: 0, left: 0, open: 0, fundLeft: 0 });
  return (
    <>
      <PageHeader title={`Welcome, ${user.name}`}
        description={courses.length ? `${totals.left} of ${totals.seats} seats left across ${courses.length} ${courses.length === 1 ? "course" : "courses"}. ${totals.open} open ${totals.open === 1 ? "offer" : "offers"}, ${gbp(totals.fundLeft)} of scholarship fund left.` : "Add your first course to start seeing ranked applicants."}
        action={<ButtonLink href="/university/courses/new">Add a course</ButtonLink>} />
      {!uni.worldRanking && (
        <div className="mb-6"><Alert>Add your world ranking in <Link href="/profile" className="font-semibold underline">Profile</Link>. Students who set a minimum ranking only see universities that have one.</Alert></div>
      )}
      {courses.length === 0 ? (
        <Empty title="No courses yet" action={<ButtonLink href="/university/courses/new">Add a course</ButtonLink>}>
          Each course needs a description, its number of seats and a scholarship fund. Applicants are ranked against the description.
        </Empty>
      ) : (
        <Panel as="div">
          <ul className="divide-y divide-line">
            {courses.map((c) => (
              <li key={c.id}>
                <Link href={`/university/courses/${c.id}`} className="group flex items-center gap-6 px-6 py-5 hover:bg-mist/60">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold group-hover:text-teal-dark">{c.name}</p>
                    <p className="text-[15px] text-ink-soft">{levelLabel(c.level)}, {c.subjectArea}{!c.description && <span className="ml-2 font-semibold text-danger">Needs a description</span>}</p>
                  </div>
                  <div className="hidden w-56 sm:block">
                    <p className="mb-1.5 text-[15px] tabular"><strong>{c.seatsLeft}/{c.seats}</strong> <span className="text-ink-soft">seats left</span></p>
                    <Meter value={c.seats - c.seatsLeft} max={c.seats} label={`${c.seats - c.seatsLeft} of ${c.seats} seats filled`} />
                  </div>
                  <div className="hidden w-40 text-right md:block">
                    <p className="text-[15px] font-semibold tabular">{gbp(c.fundLeft)}</p>
                    <p className="text-sm text-ink-faint">fund left, {c.open} open</p>
                  </div>
                  <p className="text-[15px] font-semibold tabular sm:hidden">{c.seatsLeft}/{c.seats}</p>
                  <ChevronRight size={20} className="text-ink-faint" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
