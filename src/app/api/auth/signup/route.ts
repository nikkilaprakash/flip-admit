import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { route } from "@/lib/api";
import { emailRuleError, hashPassword, issueOtp, passwordOk, PASSWORD_RULE, setPending } from "@/lib/auth";
import { RuleError } from "@/lib/market";

const Body = z.object({
  role: z.enum(["student", "university"], { message: "Choose whether you are a student or a university." }),
  name: z.string().trim().min(2, "Enter your full name (or the university's name)."),
  address: z.string().trim().min(5, "Enter your address."),
  username: z.string().trim().min(3, "Usernames need at least 3 characters.").max(32).regex(/^[a-zA-Z0-9._-]+$/, "Usernames can use letters, numbers, dots, dashes and underscores."),
  email: z.string().trim().toLowerCase(),
  password: z.string(),
  worldRanking: z.number().int().min(1).max(5000).nullable().optional(),
});

export const POST = route(null, Body, async (b) => {
  const emailErr = emailRuleError(b.role, b.email);
  if (emailErr) throw new RuleError(emailErr);
  if (!passwordOk(b.password)) throw new RuleError(`Choose a stronger password. ${PASSWORD_RULE}`);
  const db = await getDb();
  const clash = await db.select({ username: schema.users.username, email: schema.users.email }).from(schema.users)
    .where(or(eq(schema.users.username, b.username), eq(schema.users.email, b.email))).limit(1);
  if (clash[0]) throw new RuleError(clash[0].email === b.email ? "An account with this email already exists. Sign in instead." : "That username is taken. Try another.");
  const [user] = await db.insert(schema.users).values({ role: b.role, name: b.name, address: b.address, username: b.username, email: b.email, passwordHash: hashPassword(b.password) }).returning();
  if (b.role === "university") await db.insert(schema.universities).values({ userId: user.id, worldRanking: b.worldRanking ?? null });
  else await db.insert(schema.students).values({ userId: user.id });
  await issueOtp(user, "verify_email");
  await setPending(user.id, "verify_email");
  return { next: "verify", email: user.email };
});
