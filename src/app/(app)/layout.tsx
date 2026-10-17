import Logo from "@/components/Logo";
import NavLinks from "@/components/NavLinks";
import ProfileMenu from "@/components/ProfileMenu";
import { requireUser } from "@/lib/auth";
import { roundState, studentForUser } from "@/lib/market";

export const dynamic = "force-dynamic";

const ROUND_HELP: Record<number, string> = {
  1: "Universities are making first offers.",
  2: "Universities can raise their offers once this round.",
  3: "Final round. Offers expire when it closes.",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const r = await roundState();
  let links: { href: string; label: string; exact?: boolean }[] = [];
  if (user.role === "student") {
    const st = await studentForUser(user.id);
    links = st.status === "setup" ? [{ href: "/student/setup", label: "Set up profile" }] : [{ href: "/student/offers", label: "My offers" }, { href: "/student/setup", label: "My application" }];
  } else if (user.role === "university") {
    links = [{ href: "/university", label: "Welcome", exact: true }, { href: "/university/bids", label: "Bid dashboard" }];
  } else links = [{ href: "/admin", label: "Control room" }];

  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Logo href={user.role === "student" ? "/student" : user.role === "university" ? "/university" : "/admin"} />
          <div className="hidden flex-1 sm:block"><NavLinks links={links} /></div>
          <div className="ml-auto flex items-center gap-3">
            <ProfileMenu name={user.name} email={user.email} />
          </div>
        </div>
        <div className="border-t border-line sm:hidden"><div className="mx-auto max-w-6xl overflow-x-auto px-4 py-2"><NavLinks links={links} /></div></div>
      </header>
      <div className="bg-mist">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[15px] sm:px-6" role="status">
          {r.closed ? (
            <><span className="font-semibold">Admissions cycle closed</span><span className="text-ink-soft">Open offers have expired.</span></>
          ) : (
            <>
              <span className="inline-flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full bg-teal" aria-hidden />Round {r.round} of 3 is open</span>
              <span className="text-ink-soft">{ROUND_HELP[r.round!]}</span>
            </>
          )}
        </div>
      </div>
      <main id="main" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </>
  );
}
