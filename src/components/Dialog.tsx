"use client";
import { useEffect, useRef } from "react";

/** Accessible modal built on the native <dialog> element (focus trap and Escape handled by the browser). */
export default function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dlg-title"
      className="w-[calc(100%-2rem)] max-w-lg rounded-xl border border-line p-0 backdrop:bg-ink/40">
      <div className="p-6">
        <h2 id="dlg-title" className="text-xl font-bold">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </dialog>
  );
}
