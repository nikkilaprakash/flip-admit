import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { route } from "@/lib/api";
import { CourseBody } from "@/lib/course-schema";
import { audit, computeFitsForCourse, RuleError, universityForUser } from "@/lib/market";

export const PATCH = route<import("zod").infer<typeof CourseBody>, { id: string }>(["university"], CourseBody, async (b, user, { id }) => {
  const uni = await universityForUser(user.id);
  const db = await getDb();
  const [c] = await db.select().from(schema.courses).where(and(eq(schema.courses.id, id), eq(schema.courses.universityId, uni.id)));
  if (!c) throw new RuleError("Course not found.");
  const [agg] = await db.select({
    seats: sql<number>`count(*)`, committed: sql<number>`coalesce(sum(${schema.bids.totalAmount}),0)`,
  }).from(schema.bids).where(and(eq(schema.bids.courseId, id), inArray(schema.bids.status, ["active", "accepted"])));
  if (b.seats < Number(agg.seats)) throw new RuleError(`You already have ${agg.seats} open or accepted offers on this course, so seats can't go below that.`);
  if (b.scholarshipFund < Number(agg.committed)) throw new RuleError(`£${Number(agg.committed).toLocaleString("en-GB")} is already committed to offers, so the fund can't go below that.`);
  const hasBids = Number(agg.seats) > 0;
  if (hasBids && (b.level !== c.level || b.tuitionFee !== c.tuitionFee || b.durationYears !== c.durationYears)) throw new RuleError("Level, tuition and duration are fixed once you have open offers on this course.");
  await db.update(schema.courses).set({ ...b, updatedAt: new Date() }).where(eq(schema.courses.id, id));
  const textChanged = b.description !== c.description || b.subjectArea !== c.subjectArea || b.name !== c.name || b.level !== c.level;
  if (b.description && textChanged) await computeFitsForCourse(id);
  await audit(user.id, "course.update", "course", id);
  return { saved: true };
});
