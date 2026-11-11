import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/services/guard";

const SIZE = 30;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; type?: string; userId?: string; page?: string }> }) {
  await requirePermission("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const where: Prisma.AuditLogWhereInput = {
    ...(sp.action ? { action: { startsWith: sp.action } } : {}),
    ...(sp.type ? { resourceType: sp.type } : {}),
    ...(sp.userId ? { userId: sp.userId } : {}),
  };
  const [total, logs, users, types] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * SIZE, take: SIZE, include: { user: true } }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.auditLog.findMany({ distinct: ["resourceType"], select: { resourceType: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / SIZE));
  const link = (p: number) => {
    const q = new URLSearchParams({ ...(sp.action ? { action: sp.action } : {}), ...(sp.type ? { type: sp.type } : {}), ...(sp.userId ? { userId: sp.userId } : {}), page: String(p) });
    return `/admin/audit?${q}`;
  };
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Historique des opérations</h1>
      <form className="card p-3 flex flex-wrap gap-3 items-end">
        <div><label className="text-xs text-muted">Action (préfixe)</label><input name="action" defaultValue={sp.action} placeholder="document." className="input" /></div>
        <div><label className="text-xs text-muted">Ressource</label>
          <select name="type" defaultValue={sp.type ?? ""} className="input"><option value="">Toutes</option>{types.map((t) => <option key={t.resourceType}>{t.resourceType}</option>)}</select></div>
        <div><label className="text-xs text-muted">Utilisateur</label>
          <select name="userId" defaultValue={sp.userId ?? ""} className="input"><option value="">Tous</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <button className="btn">Filtrer</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted border-b"><tr><th className="p-3">Date</th><th>Utilisateur</th><th>Action</th><th>Ressource</th><th>Détails</th><th>IP</th></tr></thead>
          <tbody className="divide-y">
            {logs.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">Aucune entrée.</td></tr>}
            {logs.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="p-3 whitespace-nowrap">{l.createdAt.toLocaleString("fr-FR")}</td>
                <td>{l.user?.name ?? "—"}</td>
                <td><code className="text-xs">{l.action}</code></td>
                <td>{l.resourceType}<div className="text-[10px] text-muted">{l.resourceId}</div></td>
                <td className="max-w-xs">
                  {(l.oldValues || l.newValues) && (
                    <details><summary className="cursor-pointer text-xs text-muted">Voir</summary>
                      <pre className="text-[10px] whitespace-pre-wrap">{JSON.stringify({ avant: l.oldValues, après: l.newValues }, null, 1)}</pre></details>
                  )}
                </td>
                <td className="text-xs text-muted">{l.ip ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between p-3 border-t text-sm">
          <span className="text-muted">{total} entrée(s) · page {page}/{pages}</span>
          <span className="flex gap-3">{page > 1 && <Link href={link(page - 1)}>← Précédent</Link>}{page < pages && <Link href={link(page + 1)}>Suivant →</Link>}</span>
        </div>
      </div>
    </div>
  );
}
