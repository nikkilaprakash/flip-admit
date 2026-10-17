import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { STUDENT_FEE_PENCE } from "./config";
import { audit, recordPayment, RuleError } from "./market";

const { paymentIntents, students } = schema;

export function luhn(num: string) {
  const d = num.replace(/\D/g, "");
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
  return d.length >= 12 && sum % 10 === 0;
}
const brandOf = (d: string) => (/^4/.test(d) ? "Visa" : /^5[1-5]/.test(d) ? "Mastercard" : /^3[47]/.test(d) ? "Amex" : "Card");

export function validateCard(number: string, exp: string, cvc: string): string | null {
  if (!luhn(number)) return "That card number isn't valid. Check the digits.";
  const m = exp.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m) return "Enter the expiry date as MM/YY.";
  const month = +m[1], year = 2000 + +m[2];
  if (month < 1 || month > 12) return "The expiry month must be between 01 and 12.";
  if (new Date(year, month, 1) <= new Date()) return "This card has expired.";
  if (!/^\d{3,4}$/.test(cvc)) return "The security code is 3 digits on the back of the card.";
  return null;
}

export async function createIntent(studentId: string, idempotencyKey: string) {
  const db = await getDb();
  const [existing] = await db.select().from(paymentIntents).where(eq(paymentIntents.idempotencyKey, idempotencyKey)).limit(1);
  if (existing) return existing;
  const [paid] = await db.select().from(paymentIntents).where(and(eq(paymentIntents.studentId, studentId), eq(paymentIntents.status, "succeeded"))).limit(1);
  if (paid) throw new RuleError("You have already paid.");
  const [pi] = await db.insert(paymentIntents).values({ studentId, amountPence: STUDENT_FEE_PENCE, status: "requires_payment", idempotencyKey }).onConflictDoNothing().returning();
  return pi ?? (await db.select().from(paymentIntents).where(eq(paymentIntents.idempotencyKey, idempotencyKey)))[0];
}

/** Simulated gateway webhook. The only place a successful payment touches the ledger. */
async function webhook(type: "succeeded" | "failed", intentId: string) {
  const db = await getDb();
  const [pi] = await db.select().from(paymentIntents).where(eq(paymentIntents.id, intentId));
  if (!pi || pi.status === "succeeded") return;
  if (type === "failed") { await db.update(paymentIntents).set({ status: "failed" }).where(eq(paymentIntents.id, intentId)); return; }
  await db.update(paymentIntents).set({ status: "succeeded" }).where(eq(paymentIntents.id, intentId));
  await db.update(students).set({ paidAt: new Date() }).where(eq(students.id, pi.studentId));
  await recordPayment(pi.id, pi.studentId, pi.amountPence);
  await audit(null, "payment.succeeded", "payment_intent", pi.id);
}

export async function confirmIntent(studentId: string, intentId: string, card: { number: string; exp: string; cvc: string }, threeDs?: "approve" | "decline") {
  const db = await getDb();
  const [pi] = await db.select().from(paymentIntents).where(and(eq(paymentIntents.id, intentId), eq(paymentIntents.studentId, studentId)));
  if (!pi) throw new RuleError("Payment not found. Reload the page.");
  if (pi.status === "succeeded") return { status: "succeeded" as const };
  const err = validateCard(card.number, card.exp, card.cvc);
  if (err) throw new RuleError(err);
  const digits = card.number.replace(/\D/g, "");
  // Never store the full card number or security code.
  await db.update(paymentIntents).set({ cardBrand: brandOf(digits), cardLast4: digits.slice(-4), status: "processing" }).where(eq(paymentIntents.id, intentId));
  let outcome: "succeeded" | "failed" | "requires_action" = digits === "4000000000000002" ? "failed" : digits === "4000000000003220" ? "requires_action" : "succeeded";
  if (outcome === "requires_action") {
    if (!threeDs) { await db.update(paymentIntents).set({ status: "requires_action" }).where(eq(paymentIntents.id, intentId)); return { status: outcome }; }
    outcome = threeDs === "approve" ? "succeeded" : "failed";
  }
  await new Promise((r) => setTimeout(r, 1200));
  await webhook(outcome, intentId);
  return { status: outcome, message: outcome === "failed" ? "Your card was declined. Try another card." : undefined };
}
