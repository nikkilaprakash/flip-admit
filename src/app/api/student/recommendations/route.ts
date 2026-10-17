import { route } from "@/lib/api";
import { recommendationsFor, studentForUser } from "@/lib/market";
export const GET = route(["student"], null, async (_b, user) => recommendationsFor((await studentForUser(user.id)).id));
