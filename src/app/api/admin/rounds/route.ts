import { z } from "zod";
import { route } from "@/lib/api";
import { advanceRound, startNewCycle } from "@/lib/market";

export const POST = route(["admin"], z.object({ action: z.enum(["advance", "new-cycle"]) }), async (b, user) => {
  if (b.action === "advance") return advanceRound(user.id);
  await startNewCycle(user.id);
  return { round: 1 };
});
