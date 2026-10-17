import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { route } from "@/lib/api";
import { hashPassword, passwordOk, PASSWORD_RULE, verifyPassword } from "@/lib/auth";
import { RuleError } from "@/lib/market";

export const POST = route(["student", "university", "admin"], z.object({ current: z.string(), next: z.string() }), async (b, user) => {
  if (!verifyPassword(b.current, user.passwordHash)) throw new RuleError("Your current password is not right.");
  if (!passwordOk(b.next)) throw new RuleError(`Choose a stronger password. ${PASSWORD_RULE}`);
  const db = await getDb();
  await db.update(schema.users).set({ passwordHash: hashPassword(b.next) }).where(eq(schema.users.id, user.id));
  return { saved: true };
});
