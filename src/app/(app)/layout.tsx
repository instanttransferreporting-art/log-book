import { db } from "@/lib/db";
import { requireUser, companyScope, can } from "@/lib/auth/session";
import { signOut } from "@/lib/auth";
import { getLocale, getT } from "@/lib/i18n";
import { LogOut } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitch } from "@/components/locale-switch";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const rows = await db.company.findMany({
    where: { isActive: true, ...companyScope(user) },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, code: true, color: true, logoUrl: true,
      categories: { where: { isActive: true, archivedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, slug: true } },
    },
  });
  const avatar = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const companies = rows.map(({ logoUrl, ...c }) => ({ ...c, hasLogo: !!logoUrl }));
  return (
    <AppShell
      companies={companies} isAdmin={can(user, "companies.manage")}
      labels={{ dashboard: t("nav.dashboard"), admin: t("nav.admin"), search: t("nav.search"), collapse: t("nav.collapse") }}
      headerRight={
        <>
          <LocaleSwitch locale={locale} />
          <ThemeToggle />
          <div className="flex items-center gap-2.5 rounded-xl border bg-[var(--surface)] px-2.5 py-1.5 shadow-sm" title={user.email}>
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{avatar}</span>
            <div className="hidden min-w-0 leading-tight sm:block">
              <div className="max-w-40 truncate text-sm font-medium">{user.name}</div>
              <div className="max-w-40 truncate text-xs text-muted">{user.roleName}</div>
            </div>
          </div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button aria-label={t("header.logout")} title={t("header.logout")} className="flex items-center gap-2 rounded-xl border bg-[var(--surface)] px-3 py-2 text-sm text-muted shadow-sm transition-colors hover:border-danger hover:text-danger">
              <LogOut size={16} /><span className="hidden sm:inline">{t("header.logout")}</span>
            </button>
          </form>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
