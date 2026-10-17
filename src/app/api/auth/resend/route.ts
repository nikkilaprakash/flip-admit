import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { route } from "@/lib/api";
import { getPending, issueOtp } from "@/lib/auth";
import { RuleError } from "@/lib/market";

export const POST = route(null, null, async () => {
  const p = await getPending();
  if (!p) throw new RuleError("Your sign-in attempt timed out. Start again.");
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, p.userId));
  const r = await issueOtp(user, p.purpose);
  if (r.throttled) throw new RuleError("Wait 30 seconds before asking for another code.");
  return { sent: true };
});
