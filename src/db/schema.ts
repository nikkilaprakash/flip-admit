import {
  pgTable, pgEnum, text, integer, timestamp, boolean, jsonb, uuid, serial, primaryKey, index, uniqueIndex, real, customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const roleEnum = pgEnum("role", ["student", "university", "admin"]);
export const studentStatusEnum = pgEnum("student_status", ["setup", "live", "accepted", "closed"]);
export const docKindEnum = pgEnum("doc_kind", ["CV", "SOP", "LOR"]);
export const levelEnum = pgEnum("study_level", ["UG", "PGT", "PHD"]);
export const bidStatusEnum = pgEnum("bid_status", ["active", "accepted", "rejected", "declined", "expired"]);
export const otpPurposeEnum = pgEnum("otp_purpose", ["verify_email", "login"]);

// ---------- Accounts ----------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: roleEnum("role").notNull(),
  username: text("username").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("users_username_uq").on(t.username), uniqueIndex("users_email_uq").on(t.email)]);

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purpose: otpPurposeEnum("purpose").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("otp_user_idx").on(t.userId, t.purpose)]);

export const passwordResets = pgTable("password_resets", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

// ---------- Universities ----------
export const universities = pgTable("universities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  worldRanking: integer("world_ranking"),
}, (t) => [uniqueIndex("universities_user_uq").on(t.userId)]);

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id").notNull().references(() => universities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subjectArea: text("subject_area").notNull(),
  level: levelEnum("level").notNull(),
  tuitionFee: integer("tuition_fee").notNull(), // £ per year
  durationYears: integer("duration_years").notNull().default(1),
  seats: integer("seats").notNull().default(100),
  scholarshipFund: integer("scholarship_fund").notNull().default(0), // £ total
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("courses_uni_idx").on(t.universityId)]);

// ---------- Students ----------
export interface Preferences { level: "UG" | "PGT" | "PHD"; areas: string[]; minRanking: number | null; maxTuition: number | null }
export interface StudentProfile {
  headline: string; summary: string;
  skills: { skill: string; evidence: string }[];
  strengths: string[];
  suggestedAreas: { area: string; reason: string }[];
  source: "llm" | "fallback";
}
export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: studentStatusEnum("status").notNull().default("setup"),
  preferences: jsonb("preferences").$type<Preferences>(),
  profile: jsonb("profile").$type<StudentProfile>(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  liveAt: timestamp("live_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("students_user_uq").on(t.userId)]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  kind: docKindEnum("kind").notNull(),
  fileName: text("file_name").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  data: bytea("data").notNull(),
  text: text("text").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("documents_student_idx").on(t.studentId)]);

export const courseFits = pgTable("course_fits", {
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  semantic: real("semantic").notNull(),
  relation: text("relation").notNull(), // exact | related | ai_suggested | none
  method: text("method").notNull(), // embedding model or "local"
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.courseId, t.studentId] })]);

// ---------- Bidding ----------
export const rounds = pgTable("rounds", {
  number: integer("number").primaryKey(), // 1..3
  openedAt: timestamp("opened_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const bids = pgTable("bids", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  universityId: uuid("university_id").notNull().references(() => universities.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  scholarshipPct: integer("scholarship_pct").notNull(),
  annualAmount: integer("annual_amount").notNull(), // £ per year
  totalAmount: integer("total_amount").notNull(), // £ over the course, counted against the fund
  perks: jsonb("perks").$type<string[]>().notNull().default([]),
  note: text("note").notNull().default(""),
  status: bidStatusEnum("status").notNull().default("active"),
  placedRound: integer("placed_round").notNull(),
  updatedRound: integer("updated_round").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("bids_student_idx").on(t.studentId), index("bids_course_idx").on(t.courseId), index("bids_uni_idx").on(t.universityId)]);

export const bidEvents = pgTable("bid_events", {
  id: serial("id").primaryKey(),
  bidId: uuid("bid_id").notNull().references(() => bids.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // placed | raised | accepted | rejected | declined | expired
  round: integer("round"),
  data: jsonb("data"),
  actorUserId: uuid("actor_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Payments ----------
export const paymentIntents = pgTable("payment_intents", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  amountPence: integer("amount_pence").notNull(),
  status: text("status").notNull(), // requires_payment | requires_action | succeeded | failed | refunded | partially_refunded
  cardBrand: text("card_brand"),
  cardLast4: text("card_last4"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("pi_idem_uq").on(t.idempotencyKey)]);

export const ledgerEntries = pgTable("ledger_entries", {
  id: serial("id").primaryKey(),
  paymentIntentId: uuid("payment_intent_id"),
  account: text("account").notNull(),
  debitPence: integer("debit_pence").notNull().default(0),
  creditPence: integer("credit_pence").notNull().default(0),
  memo: text("memo").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- AI ----------
export const aiRuns = pgTable("ai_runs", {
  id: serial("id").primaryKey(),
  task: text("task").notNull(),
  model: text("model").notNull(),
  inputHash: text("input_hash").notNull(),
  output: jsonb("output").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  cacheHits: integer("cache_hits").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("ai_runs_hash_uq").on(t.inputHash)]);

export const embeddings = pgTable("embeddings", {
  key: text("key").primaryKey(), // sha256(model|text)
  model: text("model").notNull(),
  vector: jsonb("vector").$type<number[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actorUserId: uuid("actor_user_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", { key: text("key").primaryKey(), value: text("value").notNull(), flag: boolean("flag") });
