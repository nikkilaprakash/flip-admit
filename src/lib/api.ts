import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, Role, User } from "./auth";
import { RuleError } from "./market";

export const ok = (data: unknown) => NextResponse.json(data);
export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Route wrapper: role check, Zod body validation, readable errors. */
export function route<T, P = Record<string, string>>(
  roles: Role[] | null, schema: z.ZodType<T> | null,
  fn: (body: T, user: User, params: P, req: Request) => Promise<unknown>,
) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      const user = await currentUser();
      if (roles) {
        if (!user) return fail("Your session has ended. Sign in again.", 401);
        if (!roles.includes(user.role)) return fail("You don't have access to this.", 403);
      }
      let body = {} as T;
      if (schema) {
        const parsed = schema.safeParse(await req.json().catch(() => ({})));
        if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Check the form and try again.");
        body = parsed.data;
      }
      return ok(await fn(body, user as User, (await ctx?.params) ?? ({} as P), req));
    } catch (e) {
      if (e instanceof RuleError) return fail(e.message);
      console.error(e);
      return fail("Something went wrong on our side. Try again.", 500);
    }
  };
}
