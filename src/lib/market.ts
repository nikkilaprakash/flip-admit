import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Preferences, StudentProfile } from "@/db/schema";
import { LEVELS, PLATFORM_CUT_PENCE, RELATION_WEIGHT, Relation, relationTo, SCHOLARSHIP_STEPS, PERKS, STUDENT_FEE_PENCE } from "./config";
import { cosine, embedAll, semanticFromCosine } from "./llm";
import { profileText } from "./ai";
import { mails } from "./mail";

const { users, students, documents, universities, courses, courseFits, bids, bidEvents, rounds, paymentIntents, ledgerEntries, auditLog } = schema;
export class RuleError extends Error {}

export async function audit(actorUserId: string | null, action: string, entity: string, entityId: string | null, data?: unknown) {
  const db = await getDb();
  await db.insert(auditLog).values({ actorUserId, action, entity, entityId, data: data as object });
}

// ================= Rounds =================
export interface RoundState { round: number | null; closed: boolean; openedAt: Date | null }
export async function roundState(): Promise<RoundState> {
  const db = await getDb();
  let rows = await db.select().from(rounds).orderBy(asc(rounds.number));
  if (!rows.length) {
    await db.insert(rounds).values({ number: 1, openedAt: new Date() }).onConflictDoNothing();
    rows = await db.select().from(rounds).orderBy(asc(rounds.number));
  }
  const open = rows.find((r) => r.openedAt && !r.closedAt);
  if (open) return { round: open.number, closed: false, openedAt: open.openedAt };
  return { round: null, closed: true, openedAt: null };
}
export async function currentRoundOrThrow() {
  const s = await roundState();
  if (s.closed || !s.round) throw new RuleError("The admissions cycle is closed.");
  return s.round;
}

export async function advanceRound(adminId: string) {
  const db = await getDb();
  const s = await roundState();
  if (s.closed || !s.round) throw new RuleError("The cycle is already closed.");
  await db.update(rounds).set({ closedAt: new Date() }).where(eq(rounds.number, s.round));
  if (s.round < 3) {
    await db.insert(rounds).values({ number: s.round + 1, openedAt: new Date() }).onConflictDoUpdate({ target: rounds.number, set: { openedAt: new Date(), closedAt: null } });
    await audit(adminId, "round.open", "round", String(s.round + 1));
    return { round: s.round + 1, closed: false };
  }
  // Round 3 closed: open offers expire, students who did not accept are refunded.
  const expired = await db.update(bids).set({ status: "expired", updatedAt: new Date() }).where(eq(bids.status, "active")).returning({ id: bids.id });
  for (const b of expired) await db.insert(bidEvents).values({ bidId: b.id, type: "expired", round: 3 });
  const live = await db.select().from(students).where(eq(students.status, "live"));
  for (const st of live) {
    const [any] = await db.select({ n: sql<number>`count(*)` }).from(bids).where(eq(bids.studentId, st.id));
    await refund(st.id, Number(any.n) > 0 ? "partial" : "full");
    await db.update(students).set({ status: "closed" }).where(eq(students.id, st.id));
  }
  await audit(adminId, "cycle.close", "round", "3", { expired: expired.length, refunded: live.length });
  return { round: null, closed: true };
}

export async function startNewCycle(adminId: string) {
  const db = await getDb();
  const s = await roundState();
  if (!s.closed) throw new RuleError("Close the current cycle first.");
  await db.delete(rounds);
  await db.insert(rounds).values({ number: 1, openedAt: new Date() });
  await audit(adminId, "cycle.start", "round", "1");
}

// ================= Students =================
export async function studentForUser(userId: string) {
  const db = await getDb();
  const [s] = await db.select().from(students).where(eq(students.userId, userId)).limit(1);
  if (s) return s;
  const [created] = await db.insert(students).values({ userId }).returning();
  return created;
}
export async function studentDocs(studentId: string) {
  const db = await getDb();
  return db.select({ id: documents.id, kind: documents.kind, fileName: documents.fileName, sizeBytes: documents.sizeBytes, uploadedAt: documents.uploadedAt, text: documents.text })
    .from(documents).where(eq(documents.studentId, studentId)).orderBy(asc(documents.kind), asc(documents.uploadedAt));
}
export function docsComplete(docs: { kind: string }[]) {
  return docs.some((d) => d.kind === "CV") && docs.some((d) => d.kind === "SOP") && docs.some((d) => d.kind === "LOR");
}
export async function setupProgress(studentId: string) {
  const db = await getDb();
  const [s] = await db.select().from(students).where(eq(students.id, studentId));
  const docs = await studentDocs(studentId);
  return { docs: docsComplete(docs), analysed: !!s.profile, preferences: !!s.preferences, paid: !!s.paidAt, live: s.status !== "setup", student: s, documents: docs };
}

/** Goes live once documents, analysis, preferences and payment are all in place. */
export async function maybeGoLive(studentId: string) {
  const p = await setupProgress(studentId);
  if (p.live || !p.docs || !p.analysed || !p.preferences || !p.paid) return false;
  await currentRoundOrThrow();
  const db = await getDb();
  await db.update(students).set({ status: "live", liveAt: new Date() }).where(eq(students.id, studentId));
  await computeFitsForStudent(studentId);
  await audit(p.student.userId, "student.live", "student", studentId);
  return true;
}

// ================= Fit =================
function courseText(c: typeof courses.$inferSelect) { return `${c.name}. ${c.subjectArea}. ${c.description}`; }
async function studentText(st: typeof students.$inferSelect) {
  const docs = await studentDocs(st.id);
  return profileText(st.profile, docs.map((d) => d.text).join("\n"));
}
function scoreFrom(semantic: number, relation: Relation) { return Math.round(100 * (0.7 * semantic + 0.3 * RELATION_WEIGHT[relation])); }

async function storeFits(rows: { courseId: string; studentId: string; semantic: number; relation: Relation; method: string }[]) {
  const db = await getDb();
  for (const r of rows) {
    const v = { ...r, score: scoreFrom(r.semantic, r.relation), computedAt: new Date() };
    await db.insert(courseFits).values(v).onConflictDoUpdate({ target: [courseFits.courseId, courseFits.studentId], set: v });
  }
}
export async function computeFitsForStudent(studentId: string) {
  const db = await getDb();
  const [st] = await db.select().from(students).where(eq(students.id, studentId));
  if (!st?.profile) return;
  const level = st.preferences?.level;
  const cs = (await db.select().from(courses).where(ne(courses.description, ""))).filter((c) => !level || c.level === level);
  if (!cs.length) return;
  const { method, vectors } = await embedAll([await studentText(st), ...cs.map(courseText)]);
  const prefs = st.preferences?.areas ?? [];
  const ai = st.profile.suggestedAreas.map((a) => a.area);
  await storeFits(cs.map((c, i) => ({ courseId: c.id, studentId, method, semantic: semanticFromCosine(cosine(vectors[0], vectors[i + 1]), method), relation: relationTo(c.subjectArea, prefs, ai) })));
}
export async function computeFitsForCourse(courseId: string) {
  const db = await getDb();
  const [c] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!c?.description) return;
  const sts = (await db.select().from(students).where(and(eq(students.status, "live"), isNotNull(students.profile)))).filter((s) => s.preferences?.level === c.level);
  if (!sts.length) return;
  const { method, vectors } = await embedAll([courseText(c), ...(await Promise.all(sts.map(studentText)))]);
  await storeFits(sts.map((s, i) => ({ courseId, studentId: s.id, method, semantic: semanticFromCosine(cosine(vectors[0], vectors[i + 1]), method),
    relation: relationTo(c.subjectArea, s.preferences?.areas ?? [], s.profile?.suggestedAreas.map((a) => a.area) ?? []) })));
}

/** Course and university recommendations for a student, from real courses in the database. */
export async function recommendationsFor(studentId: string, limit = 6) {
  const db = await getDb();
  const [st] = await db.select().from(students).where(eq(students.id, studentId));
  if (!st?.profile) return [];
  const level = st.preferences?.level;
  const cs = await db.select({ c: courses, uniName: users.name, ranking: universities.worldRanking }).from(courses)
    .innerJoin(universities, eq(universities.id, courses.universityId)).innerJoin(users, eq(users.id, universities.userId))
    .where(ne(courses.description, ""));
  const pool = cs.filter((x) => !level || x.c.level === level);
  if (!pool.length) return [];
  const { method, vectors } = await embedAll([await studentText(st), ...pool.map((x) => courseText(x.c))]);
  const prefs = st.preferences?.areas ?? [];
  const ai = st.profile.suggestedAreas.map((a) => a.area);
  return pool.map((x, i) => {
    const relation = relationTo(x.c.subjectArea, prefs.length ? prefs : ai, ai);
    return { courseId: x.c.id, course: x.c.name, area: x.c.subjectArea, level: x.c.level, tuition: x.c.tuitionFee, university: x.uniName, ranking: x.ranking, relation,
      score: scoreFrom(semanticFromCosine(cosine(vectors[0], vectors[i + 1]), method), relation) };
  }).filter((r) => r.relation !== "none").sort((a, b) => b.score - a.score).slice(0, limit);
}

// ================= Universities and courses =================
export async function universityForUser(userId: string) {
  const db = await getDb();
  const [u] = await db.select().from(universities).where(eq(universities.userId, userId)).limit(1);
  if (u) return u;
  const [created] = await db.insert(universities).values({ userId }).returning();
  return created;
}
export async function courseStats(courseIds: string[]) {
  const db = await getDb();
  if (!courseIds.length) return new Map<string, { accepted: number; open: number; committed: number }>();
  const rows = await db.select({
    courseId: bids.courseId,
    accepted: sql<number>`count(*) filter (where ${bids.status} = 'accepted')`,
    open: sql<number>`count(*) filter (where ${bids.status} = 'active')`,
    committed: sql<number>`coalesce(sum(${bids.totalAmount}) filter (where ${bids.status} in ('active','accepted')),0)`,
  }).from(bids).where(inArray(bids.courseId, courseIds)).groupBy(bids.courseId);
  return new Map(rows.map((r) => [r.courseId, { accepted: Number(r.accepted), open: Number(r.open), committed: Number(r.committed) }]));
}
export async function coursesForUniversity(uniId: string) {
  const db = await getDb();
  const cs = await db.select().from(courses).where(eq(courses.universityId, uniId)).orderBy(asc(courses.name));
  const stats = await courseStats(cs.map((c) => c.id));
  return cs.map((c) => {
    const s = stats.get(c.id) ?? { accepted: 0, open: 0, committed: 0 };
    return { ...c, ...s, seatsLeft: c.seats - s.accepted, fundLeft: c.scholarshipFund - s.committed };
  });
}

export async function rankedStudentsForCourse(courseId: string, uniId: string) {
  const db = await getDb();
  const [c] = await db.select().from(courses).where(eq(courses.id, courseId));
  const [uni] = await db.select().from(universities).where(eq(universities.id, uniId));
  const rows = await db.select({ fit: courseFits, st: students, name: users.name }).from(courseFits)
    .innerJoin(students, eq(students.id, courseFits.studentId)).innerJoin(users, eq(users.id, students.userId))
    .where(eq(courseFits.courseId, courseId)).orderBy(desc(courseFits.score));
  const myBids = await db.select().from(bids).where(and(eq(bids.universityId, uniId)));
  const out = rows.filter(({ st, fit }) => {
    const bid = myBids.find((b) => b.studentId === st.id);
    if (bid) return true; // always show students we already made offers to
    if (st.status !== "live") return false;
    if (fit.relation === "none") return false;
    const min = st.preferences?.minRanking;
    if (min && (!uni.worldRanking || uni.worldRanking > min)) return false;
    return true;
  });
  return out.map(({ fit, st, name }, i) => {
    const bid = myBids.find((b) => b.studentId === st.id);
    const max = st.preferences?.maxTuition ?? null;
    return {
      rank: i + 1, studentId: st.id, name, score: fit.score, relation: fit.relation as Relation, status: st.status,
      headline: st.profile?.headline ?? "", topSkills: (st.profile?.skills ?? []).slice(0, 3).map((s) => s.skill),
      overBudget: !!max && c.tuitionFee > max, maxTuition: max,
      bid: bid ? { id: bid.id, pct: bid.scholarshipPct, status: bid.status, courseId: bid.courseId } : null,
    };
  });
}

/** Everything a university needs on the student detail page. Enforces visibility. */
export async function studentForUniversity(studentId: string, courseId: string, uniId: string) {
  const db = await getDb();
  const [c] = await db.select().from(courses).where(and(eq(courses.id, courseId), eq(courses.universityId, uniId)));
  if (!c) return null;
  const ranked = await rankedStudentsForCourse(courseId, uniId);
  const entry = ranked.find((r) => r.studentId === studentId);
  if (!entry) return null;
  const [row] = await db.select({ st: students, user: users }).from(students).innerJoin(users, eq(users.id, students.userId)).where(eq(students.id, studentId));
  const docs = await studentDocs(studentId);
  const [myBid] = await db.select().from(bids).where(and(eq(bids.studentId, studentId), eq(bids.universityId, uniId))).orderBy(desc(bids.createdAt)).limit(1);
  const competing = await db.select({ pct: bids.scholarshipPct, perks: bids.perks }).from(bids)
    .where(and(eq(bids.studentId, studentId), eq(bids.status, "active"), ne(bids.universityId, uniId)));
  return {
    course: c, entry, total: ranked.length, student: row.st, name: row.user.name, email: row.user.email,
    docs: docs.map(({ text: _t, ...d }) => d), myBid: myBid ?? null,
    market: { competing, highestPct: competing.length ? Math.max(...competing.map((x) => x.pct)) : null },
  };
}

// ================= Bids =================
export interface BidInput { courseId: string; studentId: string; scholarshipPct: number; perks: string[]; note: string }

export async function placeOrRaiseBid(userId: string, uniId: string, input: BidInput) {
  const round = await currentRoundOrThrow();
  if (!SCHOLARSHIP_STEPS.includes(input.scholarshipPct)) throw new RuleError("Choose a scholarship of 0, 25, 50, 75 or 100%.");
  if (input.perks.some((p) => !PERKS.includes(p))) throw new RuleError("Unknown perk.");
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from courses where id = ${input.courseId} for update`);
    const [c] = await tx.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.universityId, uniId)));
    if (!c) throw new RuleError("Course not found.");
    if (!c.description) throw new RuleError("Add a course description before making offers.");
    const [st] = await tx.select().from(students).where(eq(students.id, input.studentId));
    if (!st) throw new RuleError("Student not found.");
    const existing = (await tx.select().from(bids).where(and(eq(bids.studentId, st.id), eq(bids.universityId, uniId)))).find((b) => b.status === "active");
    if (!existing && st.status !== "live") throw new RuleError("This student is not taking offers.");
    if (st.preferences?.level !== c.level) throw new RuleError("This course is not at the student's study level.");
    const years = c.durationYears || LEVELS.find((l) => l.value === c.level)!.years;
    const annual = Math.round((input.scholarshipPct / 100) * c.tuitionFee);
    const total = annual * years;
    const [agg] = await tx.select({
      accepted: sql<number>`count(*) filter (where ${bids.status} = 'accepted')`,
      open: sql<number>`count(*) filter (where ${bids.status} = 'active')`,
      committed: sql<number>`coalesce(sum(${bids.totalAmount}) filter (where ${bids.status} in ('active','accepted')),0)`,
    }).from(bids).where(eq(bids.courseId, c.id));

    if (existing) {
      if (existing.courseId !== c.id) throw new RuleError("You already have an open offer to this student for another course.");
      if (input.scholarshipPct < existing.scholarshipPct) throw new RuleError("Offers can be raised but not lowered.");
      if (existing.perks.some((p) => !input.perks.includes(p))) throw new RuleError("Perks already offered cannot be removed.");
      if (input.scholarshipPct === existing.scholarshipPct && input.perks.length === existing.perks.length) throw new RuleError("Raise the scholarship or add a perk to update this offer.");
      if (Number(agg.committed) - existing.totalAmount + total > c.scholarshipFund) throw new RuleError(`Not enough scholarship fund left on ${c.name}.`);
      const [b] = await tx.update(bids).set({ scholarshipPct: input.scholarshipPct, annualAmount: annual, totalAmount: total, perks: input.perks, note: input.note, updatedRound: round, updatedAt: new Date() })
        .where(eq(bids.id, existing.id)).returning();
      await tx.insert(bidEvents).values({ bidId: b.id, type: "raised", round, actorUserId: userId, data: { from: existing.scholarshipPct, to: input.scholarshipPct, perks: input.perks } });
      return { bid: b, raised: true, course: c, studentUserId: st.userId };
    }
    const prior = (await tx.select().from(bids).where(and(eq(bids.studentId, st.id), eq(bids.universityId, uniId)))).find((b) => b.status === "rejected");
    if (prior) throw new RuleError("This student declined your earlier offer.");
    if (Number(agg.accepted) + Number(agg.open) >= c.seats) throw new RuleError(`No seats left to offer on ${c.name}. Increase seats in the course details if you have more capacity.`);
    if (Number(agg.committed) + total > c.scholarshipFund) throw new RuleError(`Not enough scholarship fund left on ${c.name}. Remaining: £${(c.scholarshipFund - Number(agg.committed)).toLocaleString("en-GB")}.`);
    const [b] = await tx.insert(bids).values({ courseId: c.id, universityId: uniId, studentId: st.id, scholarshipPct: input.scholarshipPct, annualAmount: annual, totalAmount: total,
      perks: input.perks, note: input.note, placedRound: round, updatedRound: round }).returning();
    await tx.insert(bidEvents).values({ bidId: b.id, type: "placed", round, actorUserId: userId, data: { pct: input.scholarshipPct, perks: input.perks } });
    return { bid: b, raised: false, course: c, studentUserId: st.userId };
  });
  const [stUser] = await db.select().from(users).where(eq(users.id, result.studentUserId));
  const [uniUser] = await db.select().from(users).where(eq(users.id, userId));
  await mails.newOffer(stUser.email, uniUser.name, result.course.name, result.raised);
  await audit(userId, result.raised ? "bid.raise" : "bid.place", "bid", result.bid.id, input);
  return result.bid;
}

export async function offersForStudent(studentId: string) {
  const db = await getDb();
  const rows = await db.select({ bid: bids, course: courses, uniName: users.name, ranking: universities.worldRanking }).from(bids)
    .innerJoin(courses, eq(courses.id, bids.courseId)).innerJoin(universities, eq(universities.id, bids.universityId)).innerJoin(users, eq(users.id, universities.userId))
    .where(eq(bids.studentId, studentId));
  return rows.sort((a, b) => b.bid.annualAmount - a.bid.annualAmount || b.bid.perks.length - a.bid.perks.length || (a.ranking ?? 9999) - (b.ranking ?? 9999));
}

export async function decideBid(userId: string, studentId: string, bidId: string, accept: boolean) {
  const db = await getDb();
  const round = await currentRoundOrThrow();
  const out = await db.transaction(async (tx) => {
    const [st] = await tx.select().from(students).where(eq(students.id, studentId));
    if (st.status !== "live") throw new RuleError(st.status === "accepted" ? "You have already accepted an offer." : "You are not taking offers right now.");
    const [b] = await tx.select().from(bids).where(and(eq(bids.id, bidId), eq(bids.studentId, studentId)));
    if (!b || b.status !== "active") throw new RuleError("This offer is no longer open.");
    if (!accept) {
      await tx.update(bids).set({ status: "rejected", updatedAt: new Date() }).where(eq(bids.id, b.id));
      await tx.insert(bidEvents).values({ bidId: b.id, type: "rejected", round, actorUserId: userId });
      return { bid: b, declinedOthers: [] as string[] };
    }
    await tx.execute(sql`select id from courses where id = ${b.courseId} for update`);
    const [c] = await tx.select().from(courses).where(eq(courses.id, b.courseId));
    const [{ n }] = await tx.select({ n: sql<number>`count(*)` }).from(bids).where(and(eq(bids.courseId, c.id), eq(bids.status, "accepted")));
    if (Number(n) >= c.seats) throw new RuleError("This course has just filled its last seat. Choose another offer.");
    await tx.update(bids).set({ status: "accepted", updatedAt: new Date() }).where(eq(bids.id, b.id));
    await tx.insert(bidEvents).values({ bidId: b.id, type: "accepted", round, actorUserId: userId });
    const others = await tx.update(bids).set({ status: "declined", updatedAt: new Date() }).where(and(eq(bids.studentId, studentId), eq(bids.status, "active"))).returning({ id: bids.id });
    for (const o of others) await tx.insert(bidEvents).values({ bidId: o.id, type: "declined", round, actorUserId: userId });
    await tx.update(students).set({ status: "accepted" }).where(eq(students.id, studentId));
    return { bid: b, declinedOthers: others.map((o) => o.id) };
  });
  if (accept) await commitSplit(studentId, out.bid.universityId);
  // Notify universities.
  const [stUser] = await db.select().from(users).where(eq(users.id, userId));
  const notify = await db.select({ email: users.email, course: courses.name, id: bids.id }).from(bids)
    .innerJoin(universities, eq(universities.id, bids.universityId)).innerJoin(users, eq(users.id, universities.userId)).innerJoin(courses, eq(courses.id, bids.courseId))
    .where(inArray(bids.id, [out.bid.id, ...out.declinedOthers]));
  for (const n of notify) await mails.decision(n.email, stUser.name, n.course, accept && n.id === out.bid.id);
  await audit(userId, accept ? "bid.accept" : "bid.reject", "bid", bidId);
}

export async function universityBids(uniId: string) {
  const db = await getDb();
  return db.select({ bid: bids, course: courses, studentName: users.name }).from(bids)
    .innerJoin(courses, eq(courses.id, bids.courseId)).innerJoin(students, eq(students.id, bids.studentId)).innerJoin(users, eq(users.id, students.userId))
    .where(eq(bids.universityId, uniId)).orderBy(desc(bids.updatedAt));
}

// ================= Ledger =================
async function ledger(account: string, debit: number, credit: number, memo: string, piId: string | null) {
  const db = await getDb();
  await db.insert(ledgerEntries).values({ account, debitPence: debit, creditPence: credit, memo, paymentIntentId: piId });
}
async function paidIntent(studentId: string) {
  const db = await getDb();
  const [pi] = await db.select().from(paymentIntents).where(and(eq(paymentIntents.studentId, studentId), eq(paymentIntents.status, "succeeded"))).limit(1);
  return pi;
}
export async function recordPayment(piId: string, studentId: string, amount: number) {
  await ledger(`student_card:${studentId}`, amount, 0, "Student fee paid (test mode)", piId);
  await ledger("escrow", 0, amount, "Held in escrow", piId);
}
async function commitSplit(studentId: string, uniId: string) {
  const pi = await paidIntent(studentId);
  if (!pi) return;
  await ledger("escrow", STUDENT_FEE_PENCE, 0, "Offer accepted: escrow released", pi.id);
  await ledger("platform_revenue", 0, PLATFORM_CUT_PENCE, "Platform fee", pi.id);
  await ledger(`university_payable:${uniId}`, 0, STUDENT_FEE_PENCE - PLATFORM_CUT_PENCE, "Deposit credited to university", pi.id);
}
async function refund(studentId: string, kind: "full" | "partial") {
  const pi = await paidIntent(studentId);
  if (!pi) return;
  const db = await getDb();
  await ledger("escrow", STUDENT_FEE_PENCE, 0, `${kind === "full" ? "Full" : "Partial"} refund: escrow released`, pi.id);
  if (kind === "full") await ledger(`student_card:${studentId}`, 0, STUDENT_FEE_PENCE, "Refund: no offers received", pi.id);
  else {
    await ledger(`student_card:${studentId}`, 0, STUDENT_FEE_PENCE - PLATFORM_CUT_PENCE, "Refund: offers received, none accepted", pi.id);
    await ledger("platform_revenue", 0, PLATFORM_CUT_PENCE, "Platform fee retained", pi.id);
  }
  await db.update(paymentIntents).set({ status: kind === "full" ? "refunded" : "partially_refunded" }).where(eq(paymentIntents.id, pi.id));
}
export async function ledgerSummary() {
  const db = await getDb();
  const bal = await db.select({ account: ledgerEntries.account, b: sql<number>`sum(${ledgerEntries.creditPence} - ${ledgerEntries.debitPence})` }).from(ledgerEntries).groupBy(ledgerEntries.account);
  const get = (a: string) => Number(bal.find((x) => x.account === a)?.b ?? 0);
  const payables = bal.filter((x) => x.account.startsWith("university_payable:")).reduce((t, x) => t + Number(x.b), 0);
  const [tot] = await db.select({ d: sql<number>`coalesce(sum(${ledgerEntries.debitPence}),0)`, c: sql<number>`coalesce(sum(${ledgerEntries.creditPence}),0)` }).from(ledgerEntries);
  return { escrow: get("escrow"), revenue: get("platform_revenue"), payables, balanced: Number(tot.d) === Number(tot.c) };
}

export type Prefs = Preferences;
export type Profile = StudentProfile;
export { isNull };
