import { redirect } from "next/navigation";
import { currentUser, homeFor } from "@/lib/auth";
import AuthFrame from "@/components/auth/AuthFrame";
import AuthForm from "@/components/auth/AuthForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const u = await currentUser();
  if (u) redirect(homeFor(u.role));
  const { mode } = await searchParams;
  return <AuthFrame><AuthForm initialMode={mode === "signup" ? "signup" : "login"} /></AuthFrame>;
}
