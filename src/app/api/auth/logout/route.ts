import { route } from "@/lib/api";
import { endSession } from "@/lib/auth";
export const POST = route(null, null, async () => { await endSession(); return { done: true }; });
