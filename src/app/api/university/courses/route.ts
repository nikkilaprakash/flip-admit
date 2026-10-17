import { getDb, schema } from "@/db";
import { route } from "@/lib/api";
import { CourseBody } from "@/lib/course-schema";
import { audit, computeFitsForCourse, universityForUser } from "@/lib/market";

export const POST = route(["university"], CourseBody, async (b, user) => {
  const uni = await universityForUser(user.id);
  const db = await getDb();
  const [c] = await db.insert(schema.courses).values({ ...b, universityId: uni.id }).returning();
  if (c.description) await computeFitsForCourse(c.id);
  await audit(user.id, "course.create", "course", c.id);
  return { id: c.id };
});
