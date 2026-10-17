import { route } from "@/lib/api";
import { studentInsight } from "@/lib/ai";
import { RuleError, studentForUniversity, universityForUser } from "@/lib/market";

export const GET = route(["university"], null, async (_b, user, _p, req) => {
  const url = new URL(req.url);
  const uni = await universityForUser(user.id);
  const d = await studentForUniversity(url.searchParams.get("studentId") || "", url.searchParams.get("courseId") || "", uni.id);
  if (!d) throw new RuleError("Student not found for this course.");
  return studentInsight({
    profile: d.student.profile, course: d.course, fitScore: d.entry.score, rank: d.entry.rank, total: d.total,
    relation: d.entry.relation, maxTuition: d.student.preferences?.maxTuition ?? null,
  });
});
