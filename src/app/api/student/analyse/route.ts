import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { route } from "@/lib/api";
import { analyseStudent } from "@/lib/ai";
import { audit, docsComplete, recommendationsFor, RuleError, studentDocs, studentForUser } from "@/lib/market";

export const POST = route(["student"], null, async (_b, user) => {
  const st = await studentForUser(user.id);
  const docs = await studentDocs(st.id);
  if (!docsComplete(docs)) throw new RuleError("Upload your CV, statement of purpose and at least one recommendation letter first.");
  const profile = await analyseStudent({
    cv: docs.find((d) => d.kind === "CV")!.text, sop: docs.find((d) => d.kind === "SOP")!.text, lors: docs.filter((d) => d.kind === "LOR").map((d) => d.text),
  }, st.preferences?.level ?? "PGT");
  const db = await getDb();
  await db.update(schema.students).set({ profile }).where(eq(schema.students.id, st.id));
  await audit(user.id, "ai.analyse", "student", st.id, { source: profile.source });
  return { profile, recommendations: await recommendationsFor(st.id) };
});
