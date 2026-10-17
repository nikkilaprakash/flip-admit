import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { mails } from "./mail";

const { users, sessions, otpCodes, passwordResets } = schema;
export type Role = "student" | "university" | "admin";
export type User = typeof users.$inferSelect;

const SESSION_COOKIE = "fa_session";
const PENDING_COOKIE = "fa_pending"; // user id waiting for an OTP, signed
const SESSION_DAYS = 7;
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const secret = () => process.env.AUTH_SECRET || "dev-only-secret-change-me";

// ---------- Passwords (scrypt, built into Node) ----------
export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}
export function verifyPassword(pw: string, stored: string) {
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, "hex"));
}
export const PASSWORD_RULE = "At least 8 characters, with a letter and a number.";
export const passwordOk = (pw: string) => pw.length >= 8 && /[a-z]/i.test(pw) && /\d/.test(pw);

// ---------- Email rules ----------
export function emailRuleError(role: Role, email: string): string | null {
  const e = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return "Enter a valid email address.";
  if (role === "university" && !e.endsWith(".ac.uk")) return "University accounts need an official .ac.uk email address.";
  if (role === "student" && e.endsWith(".ac.uk")) return ".ac.uk addresses are for university staff accounts. Use a personal email such as Gmail or Outlook.";
  return null;
}

// ---------- Pending 2FA state (signed cookie, no session yet) ----------
function sign(v: string) { return `${v}.${crypto.createHmac("sha256", secret()).update(v).digest("hex").slice(0, 32)}`; }
function unsign(s: string | undefined) {
  if (!s) return null;
  const i = s.lastIndexOf(".");
  const v = s.slice(0, i);
  return sign(v) === s ? v : null;
}
export async function setPending(userId: string, purpose: "verify_email" | "login") {
  (await cookies()).set(PENDING_COOKIE, sign(`${userId}|${purpose}|${Date.now()}`), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 900 });
}
export async function getPending() {
  const v = unsign((await cookies()).get(PENDING_COOKIE)?.value);
  if (!v) return null;
  const [userId, purpose, ts] = v.split("|");
  if (Date.now() - Number(ts) > 900_000) return null;
  return { userId, purpose: purpose as "verify_email" | "login" };
}
export async function clearPending() { (await cookies()).delete(PENDING_COOKIE); }

// ---------- One-time codes ----------
export async function issueOtp(user: User, purpose: "verify_email" | "login") {
  const db = await getDb();
  const recent = await db.select().from(otpCodes).where(and(eq(otpCodes.userId, user.id), eq(otpCodes.purpose, purpose))).orderBy(desc(otpCodes.createdAt)).limit(1);
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < 30_000) return { throttled: true };
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await db.update(otpCodes).set({ consumedAt: new Date() }).where(and(eq(otpCodes.userId, user.id), eq(otpCodes.purpose, purpose), isNull(otpCodes.consumedAt)));
  await db.insert(otpCodes).values({ userId: user.id, purpose, codeHash: sha(code + user.id), expiresAt: new Date(Date.now() + 10 * 60_000) });
  await mails.otp(user.email, code, purpose);
  return { throttled: false };
}
export async function checkOtp(userId: string, purpose: "verify_email" | "login", code: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select().from(otpCodes)
    .where(and(eq(otpCodes.userId, userId), eq(otpCodes.purpose, purpose), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.createdAt)).limit(1);
  if (!row) return "That code has expired. Send a new one.";
  if (row.attempts >= 5) return "Too many attempts. Send a new code.";
  if (row.codeHash !== sha(code.trim() + userId)) {
    await db.update(otpCodes).set({ attempts: row.attempts + 1 }).where(eq(otpCodes.id, row.id));
    return "That code is not right. Check the email and try again.";
  }
  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row.id));
  return null;
}

// ---------- Sessions ----------
export async function startSession(userId: string) {
  const db = await getDb();
  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(sessions).values({ tokenHash: sha(token), userId, expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && (process.env.APP_URL || "").startsWith("https"), path: "/", maxAge: SESSION_DAYS * 86400 });
}
export async function endSession() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) await (await getDb()).delete(sessions).where(eq(sessions.tokenHash, sha(token)));
  c.delete(SESSION_COOKIE);
}
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db.select({ user: users }).from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  return row?.user ?? null;
}
export const homeFor = (role: Role) => (role === "student" ? "/student" : role === "university" ? "/university" : "/admin");
export async function requireUser(role?: Role): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (role && u.role !== role) redirect(homeFor(u.role));
  return u;
}

// ---------- Password reset ----------
export async function startReset(email: string) {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
  if (!u) return; // never reveal whether an account exists
  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(passwordResets).values({ tokenHash: sha(token), userId: u.id, expiresAt: new Date(Date.now() + 3600_000) });
  await mails.reset(u.email, token);
}
export async function finishReset(token: string, password: string): Promise<string | null> {
  const db = await getDb();
  const [r] = await db.select().from(passwordResets).where(and(eq(passwordResets.tokenHash, sha(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date()))).limit(1);
  if (!r) return "This reset link has expired or was already used. Request a new one.";
  await db.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, r.userId));
  await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.tokenHash, r.tokenHash));
  await db.delete(sessions).where(eq(sessions.userId, r.userId));
  return null;
}

// ---------- Admin bootstrap ----------
export async function ensureAdmin() {
  const { ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  const db = await getDb();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.username, ADMIN_USERNAME)).limit(1);
  if (exists) return;
  await db.insert(users).values({
    role: "admin", username: ADMIN_USERNAME, email: ADMIN_EMAIL.toLowerCase(), passwordHash: hashPassword(ADMIN_PASSWORD),
    name: "Platform admin", emailVerifiedAt: new Date(),
  });
  console.log(`[auth] created admin account "${ADMIN_USERNAME}"`);
}
