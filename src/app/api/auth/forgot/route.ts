import { z } from "zod";
import { route } from "@/lib/api";
import { startReset } from "@/lib/auth";

export const POST = route(null, z.object({ email: z.string().trim().email("Enter the email address on your account.") }), async (b) => {
  await startReset(b.email);
  return { sent: true }; // same answer whether or not the account exists
});
