import { db } from "@/lib/db";
import { requirePermission } from "@/lib/services/guard";

export default async function AdminHome() {
  const user = await requirePermission("companies.manage");
  const cScope = user.isSuperAdmin ? {} : { id: { in: user.companyIds } };
  const dScope = user.isSuperAdmin ? {} : { companyId: { in: user.companyIds } };
  const [companies, users, categories, documents, logs] = await Promise.all([
    db.company.count({ where: cScope }),
    db.user.count({ where: user.isSuperAdmin ? {} : { memberships: { some: { companyId: { in: user.companyIds } } } } }),
    db.documentCategory.count({ where: { company: cScope } }),
    db.document.count({ where: { ...dScope, deletedAt: null } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { user: true } }),
  ]);
  const stats: [string, number][] = [["Entreprises", companies], ["Utilisateurs", users], ["Catégories", categories], ["Documents", documents]];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Administration</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(([l, v]) => (
          <div key={l} className="card p-4"><div className="text-sm text-muted">{l}</div><div className="text-3xl font-semibold mt-1">{v}</div></div>
        ))}
      </div>
      <div className="card p-4">
        <h2 className="font-medium mb-3">Activité récente</h2>
        {logs.length === 0 ? <p className="text-sm text-muted">Aucune activité.</p> : (
          <ul className="divide-y text-sm">
            {logs.map((l) => (
              <li key={l.id} className="py-2 flex justify-between gap-4">
                <span><code className="text-xs bg-black/5 rounded px-1.5 py-0.5">{l.action}</code> {l.resourceType}</span>
                <span className="text-muted">{l.user?.name ?? "—"} · {l.createdAt.toLocaleString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
