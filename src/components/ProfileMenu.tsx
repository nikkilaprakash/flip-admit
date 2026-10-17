"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, UserRound } from "lucide-react";

export default function ProfileMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen(!open)}
        className="grid h-10 w-10 place-items-center rounded-full bg-ink text-sm font-bold text-white hover:bg-ink-soft">{initials}</button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-40 w-64 rounded-xl border border-line bg-white p-2 shadow-lg">
          <div className="px-3 py-2">
            <p className="truncate font-semibold">{name}</p>
            <p className="truncate text-sm text-ink-faint">{email}</p>
          </div>
          <hr className="my-1 border-line" />
          <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 hover:bg-mist"><UserRound size={18} aria-hidden /> Profile and security</Link>
          <button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-mist"
            onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }}>
            <LogOut size={18} aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
