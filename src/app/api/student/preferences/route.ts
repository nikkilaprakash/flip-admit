import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { route } from "@/lib/api";
import { AREAS } from "@/lib/config";
import { audit, computeFitsForStudent, maybeGoLive, recommendationsFor, RuleError, studentForUser } from "@/lib/market";

const Body = z.object({
  level: z.enum(["UG", "PGT", "PHD"]),
  areas: z.array(z.string()).min(1, "Choose at least one course.").max(3, "Choose up to 3 courses."),
  minRanking: z.number().int().positive().nullable(),
  maxTuition: z.number().int().min(1000, "Set a maximum tuition of at least £1,000.").max(200000).nullable(),
});
export const POST = route(["student"], Body, async (b, user) => {
  if (b.areas.some((a) => !AREAS.includes(a))) throw new RuleError("Pick courses from the list.");
  if (new Set(b.areas).size !== b.areas.length) throw new RuleError("Each course preference should be different.");
  const st = await studentForUser(user.id);
  if (st.status === "accepted" || st.status === "closed") throw new RuleError("Your preferences are locked.");
  const db = await getDb();
  await db.update(schema.students).set({ preferences: b }).where(eq(schema.students.id, st.id));
  if (st.status === "live") await computeFitsForStudent(st.id);
  const live = await maybeGoLive(st.id);
  await audit(user.id, "student.preferences", "student", st.id, b);
  return { saved: true, live, recommendations: await recommendationsFor(st.id) };
});
