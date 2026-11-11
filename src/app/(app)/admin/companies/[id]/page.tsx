import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertCompanyAccess, requirePermission } from "@/lib/services/guard";
import { can } from "@/lib/auth/session";
import { createCategory, removeCompanyLogo, toggleCategoryArchive, updateCategory, updateCompany, uploadCompanyLogo } from "../../actions";

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = await requirePermission("companies.manage");
  const { id } = await params;
  const { error } = await searchParams;
  assertCompanyAccess(user, id);
  const company = await db.company.findUnique({
    where: { id },
    include: {
      categories: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { documents: true } } } },
      memberships: { include: { user: true } },
    },
  });
  if (!company) notFound();
  const canCats = can(user, "categories.manage");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{company.name}</h1>
      {error && <p className="text-sm text-danger">{error}</p>}

      <form action={updateCompany.bind(null, id)} className="card p-4 grid gap-3 md:grid-cols-2">
        <div><label className="text-xs text-muted">Nom</label><input name="name" defaultValue={company.name} required className="input" /></div>
        <div><label className="text-xs text-muted">Code</label><input name="code" defaultValue={company.code} required className="input uppercase" /></div>
        <div className="md:col-span-2"><label className="text-xs text-muted">Description</label><textarea name="description" defaultValue={company.description ?? ""} className="input" rows={2} /></div>
        <div><label className="text-xs text-muted">Couleur</label><input name="color" type="color" defaultValue={company.color} className="h-9 w-14 rounded border block" /></div>
        <div className="md:col-span-2"><button className="btn">Enregistrer</button></div>
      </form>

      <section className="card p-4 flex items-center gap-4">
        {company.logoUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={`/api/companies/${id}/logo`} alt="Logo" className="size-14 rounded-lg object-contain border" />
          : <div className="size-14 rounded-lg border grid place-items-center text-xs text-muted">Logo</div>}
        <form action={uploadCompanyLogo.bind(null, id)} className="flex items-center gap-2 text-sm">
          <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="text-xs" />
          <button className="btn !py-1.5">Téléverser</button>
        </form>
        {company.logoUrl && <form action={removeCompanyLogo.bind(null, id)}><button className="text-xs text-danger">Retirer</button></form>}
        <span className="text-xs text-muted">PNG, JPEG ou WebP · 1 Mo max · optionnel</span>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Catégories documentaires ({company.categories.length})</h2>
        {canCats && (
          <form action={createCategory.bind(null, id)} className="card p-3 flex gap-3 items-end">
            <div className="flex-1"><label className="text-xs text-muted">Nouvelle catégorie</label><input name="name" required className="input" placeholder="Factures" /></div>
            <button className="btn">Ajouter</button>
          </form>
        )}
        <div className="card divide-y">
          {company.categories.map((k) => (
            <div key={k.id} className="p-3 flex flex-wrap items-center gap-3 text-sm">
              <form action={updateCategory.bind(null, k.id)} className="flex flex-1 min-w-64 flex-wrap gap-2 items-center">
                <input name="sortOrder" type="number" defaultValue={k.sortOrder} className="input !w-16" aria-label="Ordre" disabled={!canCats} />
                <input name="name" defaultValue={k.name} className="input flex-1 min-w-40" disabled={!canCats} />
                <input name="code" defaultValue={k.code ?? ""} placeholder="Code" maxLength={8} className="input !w-20 uppercase" aria-label="Code de la catégorie (ex. CS)" disabled={!canCats} />
                <input name="referenceTemplate" defaultValue={k.referenceTemplate ?? ""} placeholder="Modèle de référence (vide = saisie manuelle)" className="input basis-full font-mono !text-xs" aria-label="Modèle de référence" disabled={!canCats} />
                {canCats && <button className="text-xs text-primary-hover">Enregistrer</button>}
              </form>
              {can(user, "forms.manage") && <Link href={`/admin/companies/${id}/forms/${k.id}`} className="text-xs text-primary-hover">Formulaire</Link>}
              <span className="text-muted w-24 text-right">{k._count.documents} doc(s)</span>
              {canCats && (
                <form action={toggleCategoryArchive.bind(null, k.id)}>
                  <button className="text-xs text-muted hover:text-fg w-20">{k.archivedAt ? "Restaurer" : "Archiver"}</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-2">Utilisateurs associés ({company.memberships.length})</h2>
        <div className="card p-3 text-sm">
          {company.memberships.length === 0 ? <span className="text-muted">Aucun. Associez-les depuis la page Utilisateurs.</span> :
            company.memberships.map((m) => m.user.name).join(", ")}
        </div>
      </section>
    </div>
  );
}
