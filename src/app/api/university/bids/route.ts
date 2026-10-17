import { z } from "zod";
import { route } from "@/lib/api";
import { placeOrRaiseBid, universityForUser } from "@/lib/market";

const Body = z.object({
  courseId: z.string().uuid(), studentId: z.string().uuid(), scholarshipPct: z.number().int(),
  perks: z.array(z.string()).max(5), note: z.string().trim().max(500).default(""),
});
export const POST = route(["university"], Body, async (b, user) => {
  const uni = await universityForUser(user.id);
  const bid = await placeOrRaiseBid(user.id, uni.id, { ...b, note: b.note ?? "" });
  return { id: bid.id };
});
