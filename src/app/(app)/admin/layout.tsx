import Link from "next/link";
import { requirePermission } from "@/lib/services/guard";
import { can } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermission("companies.manage");
  const tabs = [
    ["/admin", "Vue d'ensemble", true],
    ["/admin/companies", "Entreprises", can(user, "companies.manage")],
    ["/admin/users", "Utilisateurs", can(user, "users.manage")],
    ["/admin/roles", "Rôles & permissions", can(user, "roles.manage")],
    ["/admin/audit", "Historique", can(user, "audit.view")],
  ] as const;
  return (
    <div className="space-y-5">
      <nav className="flex gap-1 overflow-x-auto whitespace-nowrap border-b text-sm">
        {tabs.filter((t) => t[2]).map(([href, label]) => (
          <Link key={href} href={href} className="px-3 py-2 text-muted hover:text-fg">{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
