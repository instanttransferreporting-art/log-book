import { db } from "@/lib/db";
import { requirePermission } from "@/lib/services/guard";
import { createUser, toggleUser, updateUser } from "../actions";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requirePermission("users.manage");
  const { error } = await searchParams;
  const companyWhere = me.isSuperAdmin ? {} : { id: { in: me.companyIds } };
  const [users, roles, companies] = await Promise.all([
    db.user.findMany({
      where: me.isSuperAdmin ? {} : { OR: [{ memberships: { some: { companyId: { in: me.companyIds } } } }, { id: me.id }] },
      orderBy: { name: "asc" }, include: { role: true, memberships: true },
    }),
    db.role.findMany({ where: me.isSuperAdmin ? {} : { key: { not: "SUPER_ADMIN" } }, orderBy: { name: "asc" } }),
    db.company.findMany({ where: companyWhere, orderBy: { name: "asc" } }),
  ]);

  const CompanyChecks = ({ memberships }: { memberships: { companyId: string; roleId: string | null }[] }) => (
    <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
      {companies.map((c) => {
        const m = memberships.find((x) => x.companyId === c.id);
        return (
          <div key={c.id} className="flex items-center gap-2">
            <label className="flex items-center gap-1 flex-1"><input type="checkbox" name="companyIds" value={c.id} defaultChecked={!!m} />{c.name}</label>
            <select name={`role_${c.id}`} defaultValue={m?.roleId ?? ""} className="input !w-36 !py-0.5 !text-xs" aria-label={`Rôle pour ${c.name}`}>
              <option value="">Rôle global</option>
              {roles.filter((r) => r.key !== "SUPER_ADMIN").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Utilisateurs</h1>
      {error && <p className="text-sm text-danger">{error}</p>}

      <details className="card p-4">
        <summary className="cursor-pointer font-medium text-sm">+ Nouvel utilisateur</summary>
        <form action={createUser} className="grid gap-3 md:grid-cols-2 mt-3">
          <div><label className="text-xs text-muted">Nom</label><input name="name" required className="input" /></div>
          <div><label className="text-xs text-muted">Email</label><input name="email" type="email" required className="input" /></div>
          <div><label className="text-xs text-muted">Mot de passe initial</label><input name="password" type="password" minLength={8} required autoComplete="new-password" className="input" /></div>
          <div><label className="text-xs text-muted">Rôle</label>
            <select name="roleId" className="input">{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
          <div className="md:col-span-2"><label className="text-xs text-muted">Entreprises (et rôle propre à l&apos;entreprise, optionnel)</label><CompanyChecks memberships={[]} /></div>
          <div><button className="btn">Créer</button></div>
        </form>
      </details>

      <div className="space-y-3">
        {users.map((u) => (
          <details key={u.id} className="card p-4">
            <summary className="cursor-pointer flex items-center justify-between text-sm">
              <span><span className="font-medium">{u.name}</span> <span className="text-muted">· {u.email}</span></span>
              <span className="text-muted">{u.role.name} · {u.isActive ? "Actif" : "Désactivé"}</span>
            </summary>
            <form action={updateUser.bind(null, u.id)} className="grid gap-3 md:grid-cols-2 mt-3">
              <div><label className="text-xs text-muted">Nom</label><input name="name" defaultValue={u.name} className="input" /></div>
              <div><label className="text-xs text-muted">Email</label><input name="email" type="email" defaultValue={u.email} className="input" /></div>
              <div><label className="text-xs text-muted">Rôle</label>
                <select name="roleId" defaultValue={u.roleId} className="input">
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  {!roles.some((r) => r.id === u.roleId) && <option value={u.roleId}>{u.role.name}</option>}
                </select></div>
              <div><label className="text-xs text-muted">Nouveau mot de passe (laisser vide pour conserver)</label><input name="password" type="password" autoComplete="new-password" className="input" /></div>
              <div className="md:col-span-2"><label className="text-xs text-muted">Entreprises (et rôle propre à l&apos;entreprise, optionnel)</label><CompanyChecks memberships={u.memberships} /></div>
              <div><button className="btn">Enregistrer</button></div>
            </form>
            {u.id !== me.id && (
              <form action={toggleUser.bind(null, u.id)} className="mt-2">
                <button className="text-xs text-danger">{u.isActive ? "Désactiver le compte" : "Réactiver le compte"}</button>
              </form>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}
