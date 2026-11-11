import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/lib/services/guard";
import { saveRolePermissions } from "../actions";

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  await requirePermission("roles.manage");
  const { error, saved } = await searchParams;
  const roles = await db.role.findMany({ orderBy: { name: "asc" }, include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Rôles & permissions</h1>
      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-success">Permissions enregistrées.</p>}
      {roles.map((r) => {
        const has = new Set(r.permissions.map((p) => p.permission.key));
        const locked = r.key === "SUPER_ADMIN";
        return (
          <form key={r.id} action={saveRolePermissions.bind(null, r.id)} className="card p-4 space-y-3">
            <div className="flex justify-between">
              <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted">{r.description} · {r._count.users} utilisateur(s)</div></div>
              {!locked && <button className="btn">Enregistrer</button>}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-sm">
              {Object.entries(PERMISSIONS).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" name="perm" value={k} defaultChecked={has.has(k)} disabled={locked} />
                  <span>{label}</span><code className="text-[10px] text-muted">{k}</code>
                </label>
              ))}
            </div>
          </form>
        );
      })}
    </div>
  );
}
