import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { currentUser } from "@/lib/auth";
import { fail } from "@/lib/api";

// Streams a stored PDF. Owners, admins, and universities (once the student is visible in the marketplace) may view it.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user) return fail("Sign in to view documents.", 401);
  const db = await getDb();
  const [row] = await db.select({ doc: schema.documents, st: schema.students }).from(schema.documents)
    .innerJoin(schema.students, eq(schema.students.id, schema.documents.studentId)).where(eq(schema.documents.id, id)).limit(1);
  if (!row) return fail("Document not found.", 404);
  const allowed = user.role === "admin" || (user.role === "student" && row.st.userId === user.id) || (user.role === "university" && row.st.status !== "setup");
  if (!allowed) return fail("You don't have access to this document.", 403);
  return new Response(new Uint8Array(row.doc.data), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${encodeURIComponent(row.doc.fileName)}"`, "Cache-Control": "private, no-store" },
  });
}
