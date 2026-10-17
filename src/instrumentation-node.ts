import { getDb } from "./db";
import { ensureAdmin } from "./lib/auth";
import { availableModels } from "./lib/llm";
import { mailConfigured } from "./lib/mail";

export async function init() {
  await getDb();
  await ensureAdmin();
  if (!mailConfigured()) console.log("[mail] SMTP not configured: emails (including sign-in codes) are printed in this console.");
  await availableModels();
}
