import { z } from "zod";
import { route } from "@/lib/api";
import { finishReset, passwordOk, PASSWORD_RULE } from "@/lib/auth";
import { RuleError } from "@/lib/market";

export const POST = route(null, z.object({ token: z.string().min(10), password: z.string() }), async (b) => {
  if (!passwordOk(b.password)) throw new RuleError(`Choose a stronger password. ${PASSWORD_RULE}`);
  const err = await finishReset(b.token, b.password);
  if (err) throw new RuleError(err);
  return { done: true };
});
