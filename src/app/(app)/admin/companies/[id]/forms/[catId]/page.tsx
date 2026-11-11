import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertCompanyAccess, requirePermission } from "@/lib/services/guard";
import { FormBuilder } from "@/components/form-builder";
import type { FormField } from "@/lib/forms/schema";
import { saveFormSchema, saveListColumns } from "../../../../actions";
import { availableColumns, buildColumns, parseListColumns } from "@/lib/services/document-query";

export default async function FormBuilderPage({ params, searchParams }: {
  params: Promise<{ id: string; catId: string }>; searchParams: Promise<{ error?: string; saved?: string; cols?: string }>;
}) {
  const user = await requirePermission("forms.manage");
  const { id, catId } = await params;
  const { error, saved, cols } = await searchParams;
  assertCompanyAccess(user, id);
  const cat = await db.documentCategory.findFirst({
    where: { id: catId, companyId: id },
    include: { company: true, schemas: { orderBy: { version: "desc" }, include: { _count: { select: { documents: true } } } } },
  });
  if (!cat) notFound();
  const current = cat.schemas[0];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted"><Link href={`/admin/companies/${id}`} className="hover:underline">{cat.company.name}</Link> › {cat.name}</p>
      <h1 className="text-2xl font-semibold">Formulaire « {cat.name} » <span className="text-sm font-normal text-muted">version {current?.version ?? 0}</span></h1>
      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-success">Version {saved} publiée. Les documents existants conservent leur version d&apos;origine.</p>}
      <FormBuilder initial={(current?.fields as FormField[]) ?? []} action={saveFormSchema.bind(null, catId)} />
      {current && (() => {
        const fields = current.fields as FormField[];
        const shown = new Set(buildColumns(fields, parseListColumns(cat.listColumns)).map((c) => c.key));
        return (
          <form action={saveListColumns.bind(null, catId)} className="card p-4 space-y-3">
            <div>
              <div className="font-medium">Colonnes de la liste</div>
              <p className="text-xs text-muted">Choisissez ce qui apparaît dans le tableau. Tout reste consultable dans le détail du document, et les exports contiennent toutes les colonnes.</p>
            </div>
            {cols && <p className="text-sm text-success">Colonnes enregistrées.</p>}
            <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              {availableColumns(fields).map((c) => (
                <label key={c.key} className="flex items-center gap-2">
                  <input type="checkbox" name="col" value={c.key} defaultChecked={shown.has(c.key)} disabled={c.key === "number"} />
                  {c.label}{c.key === "number" && <span className="text-xs text-muted">(toujours affiché)</span>}
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button className="btn">Enregistrer les colonnes</button>
              <button name="reset" value="1" className="btn !bg-transparent !text-muted border">Rétablir le défaut</button>
            </div>
          </form>
        );
      })()}
      <div className="card p-3 text-sm">
        <div className="font-medium mb-1">Historique des versions</div>
        {cat.schemas.map((s) => (
          <div key={s.id} className="flex justify-between text-muted"><span>v{s.version} — {(s.fields as unknown[]).length} champ(s)</span><span>{s._count.documents} document(s) · {s.createdAt.toLocaleDateString("fr-FR")}</span></div>
        ))}
      </div>
    </div>
  );
}
