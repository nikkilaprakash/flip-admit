import { z } from "zod";
import { route } from "@/lib/api";
import { createIntent } from "@/lib/payments";
import { studentForUser } from "@/lib/market";
export const POST = route(["student"], z.object({ idempotencyKey: z.string().min(8) }), async (b, user) => createIntent((await studentForUser(user.id)).id, b.idempotencyKey));
