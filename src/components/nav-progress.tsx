"use client";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Barre de progression en haut de l'écran : démarre au clic sur un lien interne, s'arrête quand la page a changé. */
function Bar() {
  const path = usePathname();
  const search = useSearchParams().toString();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => { // navigation terminée
    setWidth(100);
    const t = setTimeout(() => { setActive(false); setWidth(0); }, 250);
    return () => clearTimeout(t);
  }, [path, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname + url.search === location.pathname + location.search) return;
      setActive(true); setWidth(15);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => { // progression "rampante" tant que la page charge
    if (!active || width >= 100) return;
    const t = setTimeout(() => setWidth((w) => Math.min(w + (90 - w) * 0.15, 90)), 200);
    return () => clearTimeout(t);
  }, [active, width]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div className="h-full bg-primary shadow-[0_0_8px_var(--primary)] transition-[width,opacity] duration-200"
        style={{ width: `${width}%`, opacity: active ? 1 : 0 }} />
    </div>
  );
}

export function NavProgress() {
  return <Suspense fallback={null}><Bar /></Suspense>;
}
