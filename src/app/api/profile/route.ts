import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { route } from "@/lib/api";
import { audit, universityForUser } from "@/lib/market";

const Body = z.object({
  name: z.string().trim().min(2, "Enter a name."), address: z.string().trim().min(5, "Enter an address."),
  worldRanking: z.number().int().min(1).max(5000).nullable().optional(),
});
export const PATCH = route(["student", "university", "admin"], Body, async (b, user) => {
  const db = await getDb();
  await db.update(schema.users).set({ name: b.name, address: b.address }).where(eq(schema.users.id, user.id));
  if (user.role === "university" && b.worldRanking !== undefined) {
    const uni = await universityForUser(user.id);
    await db.update(schema.universities).set({ worldRanking: b.worldRanking }).where(eq(schema.universities.id, uni.id));
  }
  await audit(user.id, "profile.update", "user", user.id);
  return { saved: true };
});
