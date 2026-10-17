import AuthFrame from "@/components/auth/AuthFrame";
import Reset from "@/components/auth/Reset";
export const metadata = { title: "Choose a new password" };
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AuthFrame><Reset token={token ?? ""} /></AuthFrame>;
}
