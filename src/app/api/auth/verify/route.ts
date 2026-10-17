import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { route } from "@/lib/api";
import { checkOtp, clearPending, getPending, homeFor, startSession } from "@/lib/auth";
import { RuleError } from "@/lib/market";

export const POST = route(null, z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email.") }), async (b) => {
  const p = await getPending();
  if (!p) throw new RuleError("Your sign-in attempt timed out. Start again.");
  const err = await checkOtp(p.userId, p.purpose, b.code);
  if (err) throw new RuleError(err);
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, p.userId));
  if (p.purpose === "verify_email") await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, user.id));
  await startSession(user.id);
  await clearPending();
  return { home: homeFor(user.role) };
});
