import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { route } from "@/lib/api";
import { RuleError, studentForUser } from "@/lib/market";

export const DELETE = route<unknown, { id: string }>(["student"], null, async (_b, user, { id }) => {
  const st = await studentForUser(user.id);
  if (st.status !== "setup") throw new RuleError("Your documents are locked because universities can already see your profile.");
  const db = await getDb();
  await db.delete(schema.documents).where(and(eq(schema.documents.id, id), eq(schema.documents.studentId, st.id)));
  await db.update(schema.students).set({ profile: null }).where(eq(schema.students.id, st.id));
  return { removed: true };
});
