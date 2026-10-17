import OpenAI from "openai";
import crypto from "crypto";
import { z } from "zod";
import { eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

const { aiRuns, embeddings } = schema;
// USD per 1M tokens. Adjust to your Nebius pricing.
const PRICES: Record<string, { in: number; out: number }> = {
  "openai/gpt-oss-120b": { in: 0.15, out: 0.6 },
  "openai/gpt-oss-20b": { in: 0.05, out: 0.2 },
  "Qwen/Qwen3-Embedding-8B": { in: 0.01, out: 0 },
};
const DEFAULT_PRICE = { in: 0.2, out: 0.6 };

let client: OpenAI | null = null;
export const llmEnabled = () => !!process.env.NEBIUS_API_KEY;
function getClient() {
  if (!llmEnabled()) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.NEBIUS_API_KEY, baseURL: process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1" });
  return client;
}

let modelList: Promise<string[]> | null = null;
export function availableModels() {
  const c = getClient();
  if (!c) return Promise.resolve([] as string[]);
  if (!modelList) {
    modelList = c.models.list().then((r) => {
      const ids = r.data.map((m) => m.id);
      console.log(`[llm] Nebius models available (${ids.length}): ${ids.join(", ")}`);
      return ids;
    }).catch((e) => { console.warn("[llm] could not list models:", e?.message); modelList = null; return []; });
  }
  return modelList;
}
async function resolveModel(kind: "main" | "cheap") {
  const wanted = kind === "main" ? process.env.LLM_MODEL_MAIN || "openai/gpt-oss-120b" : process.env.LLM_MODEL_CHEAP || process.env.LLM_MODEL_MAIN || "openai/gpt-oss-120b";
  const ids = await availableModels();
  if (!ids.length || ids.includes(wanted)) return wanted;
  const fb = ids.find((i) => /gpt-oss|instruct|llama|qwen/i.test(i) && !/embed/i.test(i)) || ids[0];
  console.warn(`[llm] ${wanted} not available, using ${fb}`);
  return fb;
}

async function spentToday() {
  const db = await getDb();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [r] = await db.select({ s: sql<number>`coalesce(sum(${aiRuns.costUsd}),0)` }).from(aiRuns).where(gte(aiRuns.createdAt, start));
  return Number(r.s);
}
const overBudget = async () => (await spentToday()) >= Number(process.env.LLM_DAILY_BUDGET_USD || 5);

export type AiResult<T> = { data: T; source: "llm" | "cache" | "fallback" };

/** JSON completion: cached by hash(task, model, prompt), Zod-validated, one retry, deterministic fallback. */
export async function llmJson<T>(o: { task: string; kind: "main" | "cheap"; system: string; user: string; schema: z.ZodType<T>; fallback: () => T; maxTokens?: number }): Promise<AiResult<T>> {
  const c = getClient();
  if (!c) return { data: o.fallback(), source: "fallback" };
  const db = await getDb();
  const model = await resolveModel(o.kind);
  const inputHash = crypto.createHash("sha256").update(`${o.task}|${model}|${o.system}|${o.user}`).digest("hex");
  const [cached] = await db.select().from(aiRuns).where(eq(aiRuns.inputHash, inputHash)).limit(1);
  if (cached) {
    const p = o.schema.safeParse(cached.output);
    if (p.success) {
      await db.update(aiRuns).set({ cacheHits: sql`${aiRuns.cacheHits} + 1` }).where(eq(aiRuns.id, cached.id));
      return { data: p.data, source: "cache" };
    }
  }
  if (await overBudget()) return { data: o.fallback(), source: "fallback" };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await c.chat.completions.create({
        model, temperature: 0.2, max_tokens: o.maxTokens ?? 1500, response_format: { type: "json_object" },
        messages: [{ role: "system", content: o.system + "\nReply with one JSON object only." }, { role: "user", content: o.user }],
      });
      const text = res.choices[0]?.message?.content || "";
      const parsed = o.schema.safeParse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
      const price = PRICES[model] || DEFAULT_PRICE;
      const inTok = res.usage?.prompt_tokens ?? 0, outTok = res.usage?.completion_tokens ?? 0;
      const cost = (inTok * price.in + outTok * price.out) / 1e6;
      if (!parsed.success) {
        await db.insert(aiRuns).values({ task: o.task + ":invalid", model, inputHash: `${inputHash}:bad:${Date.now()}`, output: {}, inputTokens: inTok, outputTokens: outTok, costUsd: cost });
        continue;
      }
      await db.insert(aiRuns).values({ task: o.task, model, inputHash, output: parsed.data as object, inputTokens: inTok, outputTokens: outTok, costUsd: cost })
        .onConflictDoNothing();
      return { data: parsed.data, source: "llm" };
    } catch (e) {
      console.warn(`[llm] ${o.task} attempt ${attempt + 1} failed: ${(e as Error).message}`);
    }
  }
  return { data: o.fallback(), source: "fallback" };
}

// ---------- Embeddings ----------
const STOP = new Set("a an and the of to in for on with at by from is are was be as that this it i my me we our or into have has had their his her they them will would can could also very more most about over".split(" "));
function localEmbed(text: string, dim = 512) {
  const v = new Array(dim).fill(0);
  for (const raw of text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
    if (raw.length < 3 || STOP.has(raw)) continue;
    const t = raw.replace(/(ing|ed|es|s)$/, "");
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
    v[(h >>> 0) % dim] += 1;
  }
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}
export const cosine = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i] * b[i]; return s; };

/** Embeds all texts with one method so vectors are comparable. Uses EMBEDDING_MODEL on Nebius when set, else a local hashed embedding. */
export async function embedAll(texts: string[]): Promise<{ method: string; vectors: number[][] }> {
  const model = process.env.EMBEDDING_MODEL;
  const c = getClient();
  if (!c || !model) return { method: "local", vectors: texts.map((t) => localEmbed(t)) };
  const db = await getDb();
  const keys = texts.map((t) => crypto.createHash("sha256").update(`${model}|${t}`).digest("hex"));
  const out: (number[] | null)[] = await Promise.all(keys.map(async (k) => (await db.select().from(embeddings).where(eq(embeddings.key, k)).limit(1))[0]?.vector ?? null));
  const missing = out.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (missing.length) {
    if (await overBudget()) return { method: "local", vectors: texts.map((t) => localEmbed(t)) };
    try {
      for (let s = 0; s < missing.length; s += 32) {
        const batch = missing.slice(s, s + 32);
        const res = await c.embeddings.create({ model, input: batch.map((i) => texts[i].slice(0, 12000)) });
        const tokens = res.usage?.prompt_tokens ?? 0;
        await db.insert(aiRuns).values({ task: "embed", model, inputHash: `embed:${keys[batch[0]]}:${Date.now()}`, output: { n: batch.length }, inputTokens: tokens, costUsd: (tokens * (PRICES[model]?.in ?? 0.01)) / 1e6 });
        for (let j = 0; j < batch.length; j++) {
          const vec = res.data[j].embedding as number[];
          const n = Math.sqrt(vec.reduce((a, x) => a + x * x, 0)) || 1;
          out[batch[j]] = vec.map((x) => x / n);
          await db.insert(embeddings).values({ key: keys[batch[j]], model, vector: out[batch[j]]! }).onConflictDoNothing();
        }
      }
    } catch (e) {
      console.warn("[llm] embeddings failed, using local:", (e as Error).message);
      return { method: "local", vectors: texts.map((t) => localEmbed(t)) };
    }
  }
  return { method: model, vectors: out as number[][] };
}
/** Maps cosine similarity to 0..1 for the method used (API embeddings sit in a narrower, higher band). */
export function semanticFromCosine(cos: number, method: string) {
  const [lo, span] = method === "local" ? [0.02, 0.45] : [0.25, 0.5];
  return Math.max(0, Math.min(1, (cos - lo) / span));
}

export async function aiUsage() {
  const db = await getDb();
  const [r] = await db.select({
    calls: sql<number>`count(*)`, inTok: sql<number>`coalesce(sum(${aiRuns.inputTokens}),0)`, outTok: sql<number>`coalesce(sum(${aiRuns.outputTokens}),0)`,
    cost: sql<number>`coalesce(sum(${aiRuns.costUsd}),0)`, hits: sql<number>`coalesce(sum(${aiRuns.cacheHits}),0)`,
  }).from(aiRuns);
  return { calls: Number(r.calls), inTok: Number(r.inTok), outTok: Number(r.outTok), cost: Number(r.cost), hits: Number(r.hits), enabled: llmEnabled(), embeddings: process.env.EMBEDDING_MODEL || "local" };
}
