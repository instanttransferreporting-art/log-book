import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/services/guard";
import { createCompany, toggleCompany } from "../actions";

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requirePermission("companies.manage");
  const { error } = await searchParams;
  const companies = await db.company.findMany({
    where: user.isSuperAdmin ? {} : { id: { in: user.companyIds } },
    orderBy: { name: "asc" },
    include: { _count: { select: { categories: true, documents: true, memberships: true } } },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Entreprises</h1>
      {error && <p className="text-sm text-danger">{error}</p>}
      {user.isSuperAdmin && (
        <form action={createCompany} className="card p-4 grid gap-3 md:grid-cols-[2fr_1fr_auto_auto] items-end">
          <div><label className="text-xs text-muted">Nom</label><input name="name" required className="input" placeholder="Nouvelle Société" /></div>
          <div><label className="text-xs text-muted">Code unique</label><input name="code" required className="input uppercase" maxLength={10} /></div>
          <div><label className="text-xs text-muted">Couleur</label><input name="color" type="color" defaultValue="#D4A017" className="h-9 w-14 rounded border" /></div>
          <button className="btn">Ajouter</button>
        </form>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted border-b"><tr><th className="p-3">Entreprise</th><th>Code</th><th>Catégories</th><th>Documents</th><th>Utilisateurs</th><th>Statut</th><th /></tr></thead>
          <tbody className="divide-y">
            {companies.map((c) => (
              <tr key={c.id}>
                <td className="p-3"><span className="inline-block size-2.5 rounded-full mr-2" style={{ background: c.color }} />
                  <Link href={`/admin/companies/${c.id}`} className="font-medium hover:underline">{c.name}</Link></td>
                <td>{c.code}</td><td>{c._count.categories}</td><td>{c._count.documents}</td><td>{c._count.memberships}</td>
                <td>{c.isActive ? <span className="text-success">Active</span> : <span className="text-muted">Désactivée</span>}</td>
                <td className="pr-3 text-right">
                  <form action={toggleCompany.bind(null, c.id)}><button className="text-xs text-muted hover:text-fg">{c.isActive ? "Désactiver" : "Réactiver"}</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
