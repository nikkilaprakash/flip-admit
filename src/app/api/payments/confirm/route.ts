import { z } from "zod";
import { route } from "@/lib/api";
import { confirmIntent } from "@/lib/payments";
import { maybeGoLive, studentForUser } from "@/lib/market";

export const POST = route(["student"], z.object({
  intentId: z.string().uuid(), number: z.string(), exp: z.string(), cvc: z.string(), threeDs: z.enum(["approve", "decline"]).optional(),
}), async (b, user) => {
  const st = await studentForUser(user.id);
  const r = await confirmIntent(st.id, b.intentId, b, b.threeDs);
  const live = r.status === "succeeded" ? await maybeGoLive(st.id) : false;
  return { ...r, live };
});
