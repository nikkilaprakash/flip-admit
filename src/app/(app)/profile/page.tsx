import { requireUser } from "@/lib/auth";
import { universityForUser } from "@/lib/market";
import { PageHeader } from "@/components/ui";
import ProfileForms from "@/components/ProfileForms";

export const metadata = { title: "Profile" };
export default async function ProfilePage() {
  const user = await requireUser();
  const uni = user.role === "university" ? await universityForUser(user.id) : null;
  return (
    <>
      <PageHeader title="Profile and security" />
      <ProfileForms role={user.role} name={user.name} address={user.address} email={user.email} username={user.username} worldRanking={uni?.worldRanking ?? null} />
    </>
  );
}
