import Link from "next/link";

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="FlipAdmit home">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#0E6B66" />
        <path d="M8 19.5 14 8l6 11.5" stroke="#F2B544" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.6 15h6.8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span className="text-[19px] font-bold tracking-tight text-ink">FlipAdmit</span>
    </Link>
  );
}
