// Reference data used by both sides of the marketplace. Not demo data: these are the options users pick from.

export type Level = "UG" | "PGT" | "PHD";
export const LEVELS: { value: Level; label: string; years: number }[] = [
  { value: "UG", label: "Undergraduate", years: 3 },
  { value: "PGT", label: "Master's", years: 1 },
  { value: "PHD", label: "PhD", years: 4 },
];
export const levelLabel = (l: string) => LEVELS.find((x) => x.value === l)?.label ?? l;

/** Subject areas grouped into fields. Courses in the same field count as related (intersecting or a subset). */
export const FIELDS: { field: string; areas: string[] }[] = [
  { field: "Computing", areas: ["Computer Science", "Artificial Intelligence", "Data Science", "Cybersecurity", "Software Engineering"] },
  { field: "Business and economics", areas: ["Economics", "Finance", "Business Management", "Accounting", "Marketing"] },
  { field: "Engineering", areas: ["Mechanical Engineering", "Electrical Engineering", "Civil Engineering", "Chemical Engineering", "Aerospace Engineering"] },
  { field: "Physical and mathematical sciences", areas: ["Mathematics", "Physics", "Chemistry", "Statistics"] },
  { field: "Life and health sciences", areas: ["Biology", "Biomedical Sciences", "Medicine", "Pharmacy", "Psychology", "Public Health"] },
  { field: "Law and social sciences", areas: ["Law", "Politics", "International Relations", "Sociology", "History", "English Literature"] },
  { field: "Design and media", areas: ["Architecture", "Design", "Media and Communication", "Music", "Fine Art"] },
];
export const AREAS = FIELDS.flatMap((f) => f.areas);
export const fieldOf = (area: string) => FIELDS.find((f) => f.areas.includes(area))?.field ?? null;

// Cross-field overlaps that are common in practice.
const BRIDGES: [string, string][] = [
  ["Data Science", "Statistics"], ["Data Science", "Mathematics"], ["Artificial Intelligence", "Mathematics"],
  ["Finance", "Mathematics"], ["Economics", "Statistics"], ["Computer Science", "Mathematics"],
  ["Biomedical Sciences", "Chemistry"], ["Electrical Engineering", "Physics"], ["Psychology", "Biology"],
];

export type Relation = "exact" | "related" | "ai_suggested" | "none";
export const RELATION_LABEL: Record<Relation, string> = {
  exact: "Matches a preferred course",
  related: "Related to a preferred course",
  ai_suggested: "Suggested by AI from their documents",
  none: "Outside their preferences",
};
export const RELATION_WEIGHT: Record<Relation, number> = { exact: 1, ai_suggested: 0.85, related: 0.7, none: 0.2 };

export function relationTo(courseArea: string, preferred: string[], aiSuggested: string[]): Relation {
  if (preferred.includes(courseArea)) return "exact";
  const f = fieldOf(courseArea);
  const bridged = preferred.some((p) => BRIDGES.some(([a, b]) => (a === p && b === courseArea) || (b === p && a === courseArea)));
  if (bridged || preferred.some((p) => fieldOf(p) === f)) return "related";
  if (aiSuggested.includes(courseArea)) return "ai_suggested";
  return "none";
}

export const SCHOLARSHIP_STEPS = [0, 25, 50, 75, 100];
export const PERKS = [
  "Accommodation guarantee",
  "Paid placement year",
  "Industry mentorship",
  "Research assistantship",
  "Travel and conference fund",
];
export const RANKING_OPTIONS: { value: number | null; label: string }[] = [
  { value: 50, label: "Top 50" }, { value: 100, label: "Top 100" }, { value: 200, label: "Top 200" },
  { value: 500, label: "Top 500" }, { value: null, label: "Any ranking" },
];

export const STUDENT_FEE_PENCE = 10000;
export const PLATFORM_CUT_PENCE = 1000;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
export const pence = (p: number) => "£" + (p / 100).toFixed(2);
