import { z } from "zod";
import { route } from "@/lib/api";
import { decideBid, studentForUser } from "@/lib/market";
export const POST = route<{ action: "accept" | "reject" }, { id: string }>(["student"], z.object({ action: z.enum(["accept", "reject"]) }), async (b, user, { id }) => {
  await decideBid(user.id, (await studentForUser(user.id)).id, id, b.action === "accept");
  return { done: true };
});
