import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { can, requireUser } from "@/lib/auth/session";
import { effectiveFields, getCategoryForUser } from "@/lib/services/documents";
import { buildColumns, cellText, parseListColumns, parseQuery, queryDocuments } from "@/lib/services/document-query";
import type { FormField } from "@/lib/forms/schema";
import { SelectAll } from "@/components/select-all";
import { ActivityButton, AnchorButtons, DocumentsWorkspace, NewDocumentButton, OpenView } from "@/components/documents/workspace";

const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ code: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { code, slug } = await params;
  const user = await requireUser();
  const category = await getCategoryForUser(user, code, slug);
  if (!category) notFound();
  const sp = await searchParams;
  const q = parseQuery(sp);
  const fields = (category.schemas[0]?.fields ?? []) as FormField[];
  const columns = buildColumns(fields, parseListColumns(category.listColumns));
  const docParam = typeof sp.doc === "string" && /^[a-z0-9]{10,40}$/i.test(sp.doc) ? sp.doc : undefined;

  const base = { categoryId: category.id, deletedAt: null };
  const now = new Date();
  const [{ total, rows }, all, month, year, creators, maxNum] = await Promise.all([
    queryDocuments(category.id, q, { paginate: true }),
    db.document.count({ where: base }),
    db.document.count({ where: { ...base, createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } } }),
    db.document.count({ where: { ...base, createdAt: { gte: new Date(now.getFullYear(), 0, 1) } } }),
    db.user.findMany({ where: { documents: { some: { categoryId: category.id } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.document.aggregate({ where: { categoryId: category.id }, _max: { number: true } }),
  ]);

  const canCreate = can(user, "documents.create", category.companyId) && category.company.isActive && category.isActive && !category.archivedAt;
  const canExport = can(user, "documents.export", category.companyId);
  const canSeeActivity = can(user, "audit.view", category.companyId);
  const pages = Math.max(1, Math.ceil(total / q.size));

  // Date du document qui précède chacune des lignes (pour pré-remplir « avant »)
  const prev = rows.length
    ? await db.$queryRaw<{ id: string; prev: Date | null }[]>`
        SELECT d.id, (SELECT MAX(p."docDate") FROM "Document" p WHERE p."categoryId" = d."categoryId" AND p."deletedAt" IS NULL AND p."docDate" < d."docDate") AS prev
        FROM "Document" d WHERE d.id IN (${Prisma.join(rows.map((r) => r.id))})`
    : [];
  const prevOf = new Map(prev.map((p) => [p.id, p.prev]));

  const filters: Record<string, string> = { q: q.q, status: q.status, from: q.from, to: q.to, userId: q.userId, reference: q.reference, size: String(q.size) };
  const href = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, sort: q.sort, dir: q.dir, ...extra })) if (v) p.set(k, v);
    return `/c/${code}/${slug}?${p.toString()}`;
  };
  const stats: [string, number][] = [["Total", all], ["Ce mois", month], ["Cette année", year]];
  // Responsive : les colonnes secondaires disparaissent progressivement sur petits écrans (tout reste visible dans le détail)
  const hideSmall = (key: string) => (key.startsWith("data.") || key === "subject" || key === "createdBy" ? "hidden xl:table-cell" : key === "entity" ? "hidden lg:table-cell" : key === "status" ? "hidden sm:table-cell" : "");

  return (
    <DocumentsWorkspace
      categoryId={category.id} categoryName={category.name} companyName={category.company.name}
      fields={effectiveFields(fields, category.referenceTemplate)}
      refInfo={{ template: category.referenceTemplate, categoryCode: category.code, companyCode: category.company.code, nextNumber: (maxNum._max.number ?? 0) + 1 }}
      canCreate={canCreate} canSeeActivity={canSeeActivity} initialDocId={docParam}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted">{category.company.name}</p>
            <h1 className="text-2xl font-semibold">{category.name}</h1>
            {category.description && <p className="text-sm text-muted">{category.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {canSeeActivity && <ActivityButton />}
            {canCreate && <NewDocumentButton>Nouveau document</NewDocumentButton>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {stats.map(([l, v]) => (
            <div key={l} className="card p-3 sm:p-4"><div className="text-xs sm:text-sm text-muted">{l}</div><div className="text-xl sm:text-2xl font-semibold">{v}</div></div>
          ))}
        </div>

        <form method="get" className="card p-3 grid gap-2 grid-cols-2 md:grid-cols-6 items-end">
          <input type="hidden" name="sort" value={q.sort} /><input type="hidden" name="dir" value={q.dir} />
          <div className="col-span-2"><label className="text-xs text-muted">Recherche globale</label><input name="q" defaultValue={q.q} placeholder="Référence, objet, valeurs…" className="input" /></div>
          <div><label className="text-xs text-muted">Référence</label><input name="reference" defaultValue={q.reference} className="input" /></div>
          <div><label className="text-xs text-muted">Du</label><input type="date" name="from" defaultValue={q.from} className="input" /></div>
          <div><label className="text-xs text-muted">Au</label><input type="date" name="to" defaultValue={q.to} className="input" /></div>
          <div><label className="text-xs text-muted">Statut</label>
            <select name="status" defaultValue={q.status} className="input"><option value="">Tous</option><option value="ACTIVE">Actif</option><option value="DRAFT">Brouillon</option><option value="ARCHIVED">Archivé</option></select></div>
          <div><label className="text-xs text-muted">Saisi par</label>
            <select name="userId" defaultValue={q.userId} className="input"><option value="">Tous</option>{creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="text-xs text-muted">Par page</label>
            <select name="size" defaultValue={String(q.size)} className="input">{[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></div>
          <div className="col-span-2 flex gap-2"><button className="btn">Filtrer</button><Link href={`/c/${code}/${slug}`} className="btn !bg-transparent !text-muted border">Réinitialiser</Link></div>
        </form>

        <form method="get" action="/api/export" className="card overflow-hidden">
          <input type="hidden" name="category" value={category.id} />
          {Object.entries({ ...filters, sort: q.sort, dir: q.dir }).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b text-sm">
            <span className="text-muted">{total} résultat(s)<span className="hidden sm:inline"> — cochez des lignes pour n&apos;exporter que la sélection</span></span>
            {canExport && (
              <span className="flex gap-2">
                {[["xlsx", "Excel"], ["csv", "CSV"], ["pdf", "PDF"]].map(([f, l]) => (
                  <button key={f} name="format" value={f} className="btn !py-1 !px-3 !bg-transparent !text-fg border">{l}</button>
                ))}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm leading-6">
              <thead className="text-left text-muted border-b bg-black/[.02]">
                <tr>
                  <th className="px-4 py-3.5 w-10"><SelectAll /></th>
                  {columns.map((c) => (
                    <th key={c.key} className={`px-3 py-3.5 font-medium whitespace-nowrap ${hideSmall(c.key)}`}>
                      {c.sortable ? (
                        <Link href={href({ sort: c.key, dir: q.sort === c.key && q.dir === "asc" ? "desc" : "asc", page: "1" })} className="hover:text-fg">
                          {c.label}{q.sort === c.key ? (q.dir === "asc" ? " ▲" : " ▼") : ""}
                        </Link>
                      ) : c.label}
                    </th>
                  ))}
                  {canCreate && <th className="px-3 py-3.5 font-medium text-center whitespace-nowrap">Avant / Après</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 && <tr><td colSpan={columns.length + 2} className="p-8 text-center text-muted">Aucun document ne correspond.</td></tr>}
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-black/5 align-top">
                    <td className="px-4 py-3.5"><input type="checkbox" name="ids" value={d.id} aria-label={`Sélectionner ${d.number}`} /></td>
                    {columns.map((c) => (
                      <td key={c.key} className={`px-3 py-3.5 ${c.key === "number" ? "whitespace-nowrap" : ""} ${c.key === "reference" ? "min-w-56 font-mono text-xs leading-5" : "min-w-24"} ${hideSmall(c.key)}`}>
                        {c.key === "number" || c.key === "reference"
                          ? <OpenView id={d.id} className="text-left font-medium text-primary-hover hover:underline break-all">{cellText(d, c.key) || "—"}</OpenView>
                          : cellText(d, c.key) || "—"}
                      </td>
                    ))}
                    {canCreate && (
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        <AnchorButtons id={d.id} number={d.number} date={isoDay(d.docDate)} prevDate={isoDay(prevOf.get(d.id) ?? null)} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-t text-sm">
            <span className="text-muted">Page {Math.min(q.page, pages)} / {pages}</span>
            <span className="flex gap-3">
              {q.page > 1 && <Link href={href({ page: String(q.page - 1) })}>← Précédent</Link>}
              {q.page < pages && <Link href={href({ page: String(q.page + 1) })}>Suivant →</Link>}
            </span>
          </div>
        </form>
      </div>
    </DocumentsWorkspace>
  );
}
