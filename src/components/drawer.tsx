"use client";
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/** Tiroir latéral : plein écran sur mobile, panneau de 560 px sur grand écran. Échap ou clic sur le fond pour fermer. */
export function Drawer({ open, onClose, title, actions, children, footer }: {
  open: boolean; onClose: () => void; title: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="relative flex h-full w-full sm:max-w-[560px] flex-col bg-[var(--background)] shadow-2xl outline-none border-l">
        <header className="flex items-start justify-between gap-3 border-b p-4">
          <h2 id={titleId} className="text-lg font-semibold leading-tight min-w-0">{title}</h2>
          <div className="flex items-center gap-2 shrink-0">
            {actions}
            <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-muted hover:text-fg hover:bg-black/5"><X size={18} /></button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <footer className="border-t p-3">{footer}</footer>}
      </div>
    </div>
  );
}
