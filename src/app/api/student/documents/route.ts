import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { currentUser } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { MAX_UPLOAD_BYTES } from "@/lib/config";
import { audit, studentForUser } from "@/lib/market";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "student") return fail("Sign in as a student to upload documents.", 401);
  const st = await studentForUser(user.id);
  if (st.status !== "setup") return fail("Your documents are locked because universities can already see your profile.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") || "");
  if (!(file instanceof File)) return fail("Choose a PDF file to upload.");
  if (!["CV", "SOP", "LOR"].includes(kind)) return fail("Unknown document type.");
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") return fail("Upload a PDF file.");
  if (file.size > MAX_UPLOAD_BYTES) return fail("That PDF is larger than 8 MB. Export a smaller version and try again.");
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 5).toString() !== "%PDF-") return fail("That file isn't a valid PDF.");
  let text = "";
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    text = (await extractText(pdf, { mergePages: true })).text.replace(/[ \t]+\n/g, "\n").trim();
  } catch { return fail("We couldn't read that PDF. Try exporting it again from Word or Google Docs."); }
  if (text.length < 80) return fail("This PDF has almost no readable text. If it's a scan, export it as a text PDF instead.");
  const db = await getDb();
  if (kind !== "LOR") await db.delete(schema.documents).where(and(eq(schema.documents.studentId, st.id), eq(schema.documents.kind, kind as "CV")));
  else {
    const lors = await db.select({ id: schema.documents.id }).from(schema.documents).where(and(eq(schema.documents.studentId, st.id), eq(schema.documents.kind, "LOR")));
    if (lors.length >= 3) return fail("You can upload up to 3 letters of recommendation. Remove one first.");
  }
  const [doc] = await db.insert(schema.documents).values({ studentId: st.id, kind: kind as "CV", fileName: file.name, sizeBytes: file.size, data: buf, text: text.slice(0, 60000) })
    .returning({ id: schema.documents.id, kind: schema.documents.kind, fileName: schema.documents.fileName });
  // New documents invalidate an earlier analysis.
  await db.update(schema.students).set({ profile: null }).where(eq(schema.students.id, st.id));
  await audit(user.id, "document.upload", "document", doc.id, { kind });
  return ok(doc);
}
