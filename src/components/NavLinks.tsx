"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

export default function NavLinks({ links }: { links: { href: string; label: string; exact?: boolean }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1">
      {links.map((l) => {
        const active = l.exact ? path === l.href : path === l.href || path.startsWith(l.href + "/");
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
            className={cn("rounded-lg px-3 py-2 text-[15px] font-medium", active ? "bg-mist text-ink" : "text-ink-soft hover:bg-mist hover:text-ink")}>{l.label}</Link>
        );
      })}
    </nav>
  );
}
