import Logo from "@/components/Logo";
import { ButtonLink } from "@/components/ui";

export const dynamic = "force-dynamic";

const ROUND_WINDOWS = ["September-December", "January-March", "April-July"];

function currentRound() {
  const month = new Date().getMonth();
  const round = month >= 8 ? 1 : month <= 2 ? 2 : month <= 6 ? 3 : null;
  return round ? { number: round, window: ROUND_WINDOWS[round - 1] } : null;
}

const STUDENT_STEPS = [
  ["Upload your documents", "Your CV, statement of purpose and up to three recommendation letters, as PDFs."],
  ["Tell us what you want", "Pick up to three courses, a minimum university ranking and the most you can pay in tuition. AI suggests courses that fit your profile."],
  ["Compare and accept", "Universities make scholarship offers across three rounds and can raise them. Accept the one you want."],
];
const UNI_STEPS = [
  ["Add your courses", "Describe each course and set its seats and scholarship fund."],
  ["See ranked applicants", "Students whose preferences match your course are ranked by fit, with an AI summary of each profile."],
  ["Make and raise offers", "Offer a scholarship and perks. Track seats and funds as students accept."],
];

function RoundRow({ round, period, current }: { round: number; period: string; current: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-lg border bg-white px-5 py-4 ${current ? "border-teal ring-2 ring-teal/20" : "border-line"}`}>
      <span className="font-semibold">Round {round}</span>
      <span className="text-right text-ink-soft">{period}</span>
      {current && <span className="shrink-0 text-sm font-semibold text-teal">Current</span>}
    </div>
  );
}

export default function Welcome() {
  const activeRound = currentRound();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <ButtonLink href="/login" variant="secondary">Sign in</ButtonLink>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div>
            <h1 className="text-[42px] font-extrabold leading-[1.05] tracking-tight sm:text-[56px]">Let universities compete for you.</h1>
            <p className="mt-6 max-w-xl text-[19px] leading-relaxed text-ink-soft">
              Upload your application once. Universities that match what you want make scholarship offers, raise them across three rounds, and you choose the one to accept.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <ButtonLink href="/login" className="h-12 px-6 text-base">Launch FlipAdmit</ButtonLink>
              <span className="text-[15px] text-ink-faint">Students and UK universities</span>
            </div>
            <p className="mt-4 text-[15px] text-ink-faint" aria-live="polite">
              {activeRound ? `Current admissions round: Round ${activeRound.number} (${activeRound.window}).` : "The admissions cycle is between rounds. Round 1 begins in September."}
            </p>
          </div>
          <div aria-label="Admissions round schedule" className="mx-auto w-full max-w-md">
            <div className="space-y-3">
              <RoundRow round={1} period={ROUND_WINDOWS[0]} current={activeRound?.number === 1} />
              <RoundRow round={2} period={ROUND_WINDOWS[1]} current={activeRound?.number === 2} />
              <RoundRow round={3} period={ROUND_WINDOWS[2]} current={activeRound?.number === 3} />
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-mist">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-2">
            {[["If you're a student", STUDENT_STEPS], ["If you're a university", UNI_STEPS]].map(([title, steps]) => (
              <div key={title as string}>
                <h2 className="text-2xl font-bold">{title as string}</h2>
                <ol className="mt-6 space-y-6">
                  {(steps as string[][]).map(([t, d], i) => (
                    <li key={t} className="flex gap-4">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[15px] font-bold text-teal ring-1 ring-line">{i + 1}</span>
                      <div><p className="text-[17px] font-semibold">{t}</p><p className="mt-1 leading-relaxed text-ink-soft">{d}</p></div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-8 md:grid-cols-3">
            <div><h3 className="text-lg font-bold">One fee, refunded if nothing comes</h3><p className="mt-2 leading-relaxed text-ink-soft">Students pay £100 once. If no university makes an offer by the end of the cycle, you get it all back.</p></div>
            <div><h3 className="text-lg font-bold">Offers only go up</h3><p className="mt-2 leading-relaxed text-ink-soft">A university can raise its offer once per round but can never lower or withdraw it.</p></div>
            <div><h3 className="text-lg font-bold">Verified accounts</h3><p className="mt-2 leading-relaxed text-ink-soft">Universities sign up with an .ac.uk address. Every sign-in is confirmed with a one-time code sent by email.</p></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-[15px] text-ink-faint sm:px-6">
          <Logo />
          <ButtonLink href="/login">Launch FlipAdmit</ButtonLink>
        </div>
      </footer>
    </div>
  );
}
