"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronDown, LayoutDashboard, Search, PanelLeftClose, PanelLeft, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavLabels = { dashboard: string; admin: string; search: string; collapse: string };
export type NavCompany = { id: string; name: string; code: string; color: string; hasLogo: boolean; categories: { id: string; name: string; slug: string }[] };

export function Sidebar({ companies, isAdmin, labels, mobileOpen = false, onClose = () => {} }: { companies: NavCompany[]; isAdmin: boolean; labels: NavLabels; mobileOpen?: boolean; onClose?: () => void }) {
  const path = usePathname();
  // Ferme le menu mobile après chaque navigation
  useEffect(() => { onClose(); }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const term = q.trim().toLowerCase();

  const list = companies
    .map((c) => ({
      ...c,
      categories: term && !c.name.toLowerCase().includes(term) ? c.categories.filter((k) => k.name.toLowerCase().includes(term)) : c.categories,
    }))
    .filter((c) => !term || c.name.toLowerCase().includes(term) || c.categories.length > 0);

  return (
    <>
    {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />}
    <aside className={cn(
      "glass max-lg:bg-[var(--surface)] fixed inset-y-0 left-0 z-40 flex h-screen w-72 max-w-[85vw] flex-col border-r transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:transition-[width]",
      mobileOpen ? "translate-x-0" : "-translate-x-full", collapsed ? "lg:w-16" : "lg:w-72",
    )}>
      <div className={cn("flex gap-2 p-3", collapsed ? "lg:flex-col lg:items-center" : "items-center justify-between")}>
        <Link href="/" className="flex items-center gap-2 min-w-0" aria-label="Log Book">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white p-0.5 shadow-sm ring-1 ring-black/5">
            <Image src="/logo.png" alt="" width={40} height={40} priority className="size-9 object-contain" />
          </span>
          {!collapsed && <span className="font-semibold text-lg truncate">Log Book</span>}
        </Link>
        <button onClick={() => setCollapsed(!collapsed)} aria-label={labels.collapse} className="hidden rounded-lg p-1.5 text-muted hover:bg-black/5 hover:text-fg lg:block">
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
      {!collapsed && (
        <div className="px-3 pb-2 relative">
          <Search size={14} className="absolute left-6 top-3 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.search} className="input pl-8" />
        </div>
      )}
      <nav className="flex-1 overflow-y-auto px-2 space-y-1 text-sm">
        <Link href="/" className={cn("flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-black/5", path === "/" && "bg-primary/15 text-primary font-medium")}>
          <LayoutDashboard size={16} />{!collapsed && labels.dashboard}
        </Link>
        {list.map((c) => {
          const isOpen = term ? true : (open[c.id] ?? path.startsWith(`/c/${c.code}`));
          return (
            <div key={c.id}>
              <button onClick={() => setOpen({ ...open, [c.id]: !isOpen })} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-black/5 uppercase text-xs font-semibold tracking-wide">
                {c.hasLogo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`/api/companies/${c.id}/logo`} alt="" className="size-4 rounded object-contain shrink-0" />
                  : <span className="size-2.5 rounded-full shrink-0" style={{ background: c.color }} />}
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{c.name}</span>
                    <ChevronDown size={14} className={cn("transition", isOpen && "rotate-180")} />
                  </>
                )}
              </button>
              {!collapsed && isOpen && (
                <div className="ml-5 border-l pl-2 space-y-0.5">
                  {c.categories.map((k) => {
                    const href = `/c/${c.code}/${k.slug}`;
                    return (
                      <Link key={k.id} href={href} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-muted hover:bg-black/5 hover:text-fg", path === href && "bg-primary/15 text-primary font-medium")}>
                        <FileText size={13} /><span className="truncate">{k.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      {isAdmin && (
        <Link href="/admin" className="m-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-black/5">
          <Settings size={16} />{!collapsed && labels.admin}
        </Link>
      )}
    </aside>
    </>
  );
}
