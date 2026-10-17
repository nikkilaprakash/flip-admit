import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { route } from "@/lib/api";
import { issueOtp, setPending, verifyPassword } from "@/lib/auth";
import { RuleError } from "@/lib/market";

const Body = z.object({ username: z.string().trim().min(1, "Enter your username."), password: z.string().min(1, "Enter your password.") });

export const POST = route(null, Body, async (b) => {
  const db = await getDb();
  const id = b.username.toLowerCase();
  const [user] = await db.select().from(schema.users).where(or(eq(schema.users.username, b.username), eq(schema.users.email, id))).limit(1);
  if (!user || !verifyPassword(b.password, user.passwordHash)) throw new RuleError("That username and password don't match.");
  const purpose = user.emailVerifiedAt ? "login" : "verify_email";
  await issueOtp(user, purpose);
  await setPending(user.id, purpose);
  return { next: "verify", email: user.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2"), purpose };
});
