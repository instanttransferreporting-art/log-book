"use client";
import { useCallback, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar, type NavCompany, type NavLabels } from "./sidebar";

/** Cadre de l'application : sidebar fixe sur grand écran, menu coulissant sur mobile / tablette. */
export function AppShell({ companies, isAdmin, labels, headerRight, children }: {
  companies: NavCompany[]; isAdmin: boolean; labels: NavLabels; headerRight: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <div className="flex min-h-screen">
      <Sidebar companies={companies} isAdmin={isAdmin} labels={labels} mobileOpen={open} onClose={close} />
      <div className="flex-1 min-w-0">
        <header className="glass sticky top-0 z-20 flex items-center gap-2 px-3 py-2.5 sm:px-6 sm:py-3 border-b">
          <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" className="rounded-lg p-2 text-muted hover:text-fg hover:bg-black/5 lg:hidden"><Menu size={20} /></button>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">{headerRight}</div>
        </header>
        <main className="p-3 sm:p-6 max-w-[1800px] mx-auto">{children}</main>
      </div>
    </div>
  );
}
