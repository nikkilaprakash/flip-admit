import { z } from "zod";
import { AREAS, gbp, levelLabel, RELATION_LABEL, Relation } from "./config";
import { llmJson } from "./llm";
import type { StudentProfile } from "@/db/schema";

// ---------- Keyword fallback for subject areas ----------
const AREA_KEYWORDS: Record<string, string[]> = {
  "Computer Science": ["programming", "software", "algorithm", "java", "python", "computer", "systems", "web"],
  "Artificial Intelligence": ["machine learning", "deep learning", "neural", "pytorch", "tensorflow", "nlp", "llm", "computer vision", "artificial intelligence"],
  "Data Science": ["data", "analytics", "pandas", "sql", "statistics", "visualisation", "visualization", "dashboard"],
  Cybersecurity: ["security", "cyber", "penetration", "cryptography", "network security", "vulnerability"],
  "Software Engineering": ["react", "backend", "api", "microservices", "devops", "cloud", "aws", "spring"],
  Economics: ["economics", "econometrics", "policy", "macroeconomic", "microeconomic"],
  Finance: ["finance", "trading", "investment", "portfolio", "banking", "valuation", "quant"],
  "Business Management": ["business", "management", "strategy", "operations", "startup", "entrepreneur"],
  Accounting: ["accounting", "audit", "tax", "bookkeeping"],
  Marketing: ["marketing", "brand", "campaign", "social media", "seo"],
  "Mechanical Engineering": ["mechanical", "cad", "solidworks", "thermodynamics", "manufacturing"],
  "Electrical Engineering": ["electrical", "circuit", "electronics", "embedded", "pcb", "signal"],
  "Civil Engineering": ["civil", "structural", "construction", "geotechnical"],
  "Chemical Engineering": ["chemical engineering", "process engineering", "reactor"],
  "Aerospace Engineering": ["aerospace", "aircraft", "aerodynamics", "satellite", "rocket"],
  Mathematics: ["mathematics", "maths", "calculus", "algebra", "proof", "olympiad"],
  Physics: ["physics", "quantum", "astrophysics", "optics"],
  Chemistry: ["chemistry", "organic", "spectroscopy", "synthesis"],
  Statistics: ["statistics", "statistical", "probability", "bayesian", "regression"],
  Biology: ["biology", "genetics", "ecology", "cell", "molecular"],
  "Biomedical Sciences": ["biomedical", "clinical", "laboratory", "pathology"],
  Medicine: ["medicine", "medical", "hospital", "patient", "clinical placement"],
  Pharmacy: ["pharmacy", "pharmacology", "drug"],
  Psychology: ["psychology", "cognitive", "behaviour", "behavior", "mental health"],
  "Public Health": ["public health", "epidemiology", "health policy"],
  Law: ["law", "legal", "court", "litigation", "moot"],
  Politics: ["politics", "political", "government", "parliament"],
  "International Relations": ["international relations", "diplomacy", "geopolitics"],
  Sociology: ["sociology", "social research", "inequality"],
  History: ["history", "historical", "archive"],
  "English Literature": ["literature", "poetry", "novel", "writing"],
  Architecture: ["architecture", "architectural", "urban design"],
  Design: ["design", "figma", "ux", "ui", "product design"],
  "Media and Communication": ["media", "journalism", "communication", "film"],
  Music: ["music", "composition", "orchestra"],
  "Fine Art": ["art", "painting", "sculpture", "exhibition"],
};

const SKILLS = ["Python", "PyTorch", "TensorFlow", "SQL", "Java", "C++", "JavaScript", "TypeScript", "React", "AWS", "Machine learning", "Deep learning", "NLP",
  "Computer vision", "Statistics", "Data visualisation", "Excel", "R", "MATLAB", "CAD", "SolidWorks", "Financial modelling", "Econometrics", "Research",
  "Laboratory techniques", "Public speaking", "Leadership", "Project management", "Figma", "Writing"];
const sentences = (t: string) => t.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 20);

export function heuristicProfile(docs: { cv: string; sop: string; lors: string[] }): StudentProfile {
  const all = [docs.cv, docs.sop, ...docs.lors].join("\n");
  const low = all.toLowerCase();
  const scored = AREAS.map((a) => ({ area: a, hits: (AREA_KEYWORDS[a] || []).filter((k) => low.includes(k)) }))
    .filter((x) => x.hits.length).sort((a, b) => b.hits.length - a.hits.length).slice(0, 3);
  // Drop contact lines so they never surface as "strengths".
  const sents = sentences(all).filter((s) => !/@|\+?\d[\d\s]{8,}|linkedin|github\.com/i.test(s));
  const wordRe = (k: string) => new RegExp(`(^|[^a-z])${k.toLowerCase().replace(/[+]/g, "\\+")}([^a-z]|$)`);
  const skills = SKILLS.filter((k) => wordRe(k).test(low)).slice(0, 8)
    .map((k) => ({ skill: k, evidence: (sents.find((s) => wordRe(k).test(s.toLowerCase())) || "").slice(0, 180) }));
  const achievements = sents.filter((s) => /\d/.test(s) && s.length > 40).slice(0, 4);
  return {
    headline: scored.length ? `Applicant with a background in ${scored.map((s) => s.area).slice(0, 2).join(" and ")}` : "Applicant profile",
    summary: sentences(docs.sop).slice(0, 2).join(" ") || sents.slice(0, 2).join(" "),
    skills,
    strengths: achievements,
    suggestedAreas: scored.map((s) => ({ area: s.area, reason: `Your documents mention ${s.hits.slice(0, 3).join(", ")}.` })),
    source: "fallback",
  };
}

const ProfileSchema = z.object({
  headline: z.string().max(200),
  summary: z.string(),
  skills: z.array(z.object({ skill: z.string(), evidence: z.string() })).max(10),
  strengths: z.array(z.string()).max(6),
  suggestedAreas: z.array(z.object({ area: z.string(), reason: z.string() })).max(5),
});

/** Reads the student's CV, SOP and LORs and builds a profile plus suggested subject areas. */
export async function analyseStudent(docs: { cv: string; sop: string; lors: string[] }, level: string): Promise<StudentProfile> {
  const res = await llmJson({
    task: "analyse-student", kind: "main", maxTokens: 1800,
    system: `You are an admissions adviser. Read the applicant's CV, statement of purpose and reference letters.
Return: headline (max 15 words), summary (3 sentences, third person, factual), skills (each with a short evidence quote copied from the documents),
strengths (3-5 concrete achievements with numbers where present), suggestedAreas (2-4 subject areas that best fit this person, each with a one-sentence reason grounded in the documents).
suggestedAreas[].area MUST be one of: ${AREAS.join(", ")}. Never invent facts.`,
    user: `Intended level: ${levelLabel(level)}\n\nCV:\n${docs.cv.slice(0, 9000)}\n\nSTATEMENT OF PURPOSE:\n${docs.sop.slice(0, 5000)}\n\n${docs.lors.map((l, i) => `REFERENCE ${i + 1}:\n${l.slice(0, 4000)}`).join("\n\n")}`,
    schema: ProfileSchema,
    fallback: () => heuristicProfile(docs),
  });
  const data = { ...res.data, suggestedAreas: res.data.suggestedAreas.filter((s) => AREAS.includes(s.area)) };
  if (res.source !== "fallback" && !data.suggestedAreas.length) data.suggestedAreas = heuristicProfile(docs).suggestedAreas;
  return { ...data, source: res.source === "fallback" ? "fallback" : "llm" };
}

export function profileText(p: StudentProfile | null, docsText = "") {
  if (!p) return docsText.slice(0, 4000);
  return [p.headline, p.summary, ...p.skills.map((s) => s.skill), ...p.strengths, ...p.suggestedAreas.map((s) => s.area), docsText.slice(0, 3000)].join("\n");
}

// ---------- Insight for universities ----------
const InsightSchema = z.object({
  summary: z.string(),
  fitJustification: z.string(),
  strengths: z.array(z.string()).max(5),
  considerations: z.array(z.string()).max(4),
});
export type Insight = z.infer<typeof InsightSchema> & { source: "llm" | "cache" | "fallback" };

export async function studentInsight(args: {
  profile: StudentProfile | null; course: { name: string; subjectArea: string; level: string; description: string; tuitionFee: number };
  fitScore: number; rank: number; total: number; relation: Relation; maxTuition: number | null;
}): Promise<Insight> {
  const { profile, course, fitScore, rank, total, relation, maxTuition } = args;
  const fallback = () => ({
    summary: profile?.summary || "No profile summary available yet.",
    fitJustification: `Ranked ${rank} of ${total} for ${course.name} with a fit score of ${fitScore}/100. ${RELATION_LABEL[relation]}.` +
      (profile?.skills.length ? ` Relevant skills: ${profile.skills.slice(0, 3).map((s) => s.skill).join(", ")}.` : ""),
    strengths: profile?.strengths.slice(0, 3) ?? [],
    considerations: maxTuition && course.tuitionFee > maxTuition
      ? [`Tuition of ${gbp(course.tuitionFee)} is above the student's limit of ${gbp(maxTuition)}. A scholarship of at least ${Math.ceil(((course.tuitionFee - maxTuition) / course.tuitionFee) * 100)}% closes the gap.`] : [],
  });
  const res = await llmJson({
    task: "student-insight", kind: "main", maxTokens: 900,
    system: "You brief a university admissions officer on one applicant for one course. Be specific and factual, cite evidence from the profile, never invent. summary: 2-3 sentences. fitJustification: 2-3 sentences explaining the given rank and fit score for this course. strengths: up to 4 bullet points. considerations: up to 3 risks or gaps (empty if none).",
    user: `Course: ${course.name} (${course.subjectArea}, ${levelLabel(course.level)}). Tuition ${gbp(course.tuitionFee)}/year.\nCourse description: ${course.description.slice(0, 3000)}\n\nApplicant rank for this course: ${rank} of ${total}. Fit score ${fitScore}/100. Preference match: ${RELATION_LABEL[relation]}. Student's maximum tuition: ${maxTuition ? gbp(maxTuition) : "not set"}.\n\nApplicant profile:\n${JSON.stringify(profile ?? {}, null, 1).slice(0, 5000)}`,
    schema: InsightSchema,
    fallback,
  });
  return { ...res.data, source: res.source };
}
