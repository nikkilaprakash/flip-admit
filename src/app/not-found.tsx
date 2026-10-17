import Logo from "@/components/Logo";
import { ButtonLink } from "@/components/ui";
export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="flex justify-center"><Logo /></div>
      <h1 className="mt-10 text-3xl font-bold">We couldn't find that page</h1>
      <p className="mt-3 text-ink-soft">It may have moved, or you may not have access to it.</p>
      <ButtonLink href="/" className="mt-8">Go to the home page</ButtonLink>
    </main>
  );
}
