"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, History, Pencil, Plus, Trash2 } from "lucide-react";
import type { FormField } from "@/lib/forms/schema";
import { buildReference } from "@/lib/reference";
import { Drawer } from "@/components/drawer";
import { DynamicField, nowLocal, todayLocal } from "@/components/dynamic-field";
import { archiveDocumentAction, createDocumentAction, deleteDocumentAction, updateDocumentAction } from "@/app/(app)/c/[code]/[slug]/actions";
import type { ActivityEntry, DocumentDetail } from "@/lib/services/activity";

export type RefInfo = { template: string | null; categoryCode: string | null; companyCode: string; nextNumber: number };
type Anchor = { id: string; number: number; position: "before" | "after" };
type Mode =
  | { kind: "closed" }
  | { kind: "create"; anchor?: Anchor; date: string }
  | { kind: "view"; id: string; flash?: string }
  | { kind: "edit"; id: string }
  | { kind: "activity" };

type Api = { openCreate: (o?: { anchor?: Anchor; date?: string }) => void; openView: (id: string) => void; openActivity: () => void };
const Ctx = createContext<Api | null>(null);
const useApi = () => { const c = useContext(Ctx); if (!c) throw new Error("DocumentsWorkspace manquant"); return c; };

const fmtDate = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
const STATUS: Record<string, string> = { DRAFT: "Brouillon", ACTIVE: "Actif", ARCHIVED: "Archivé" };

export function DocumentsWorkspace({ categoryId, categoryName, companyName, fields, refInfo, canCreate, canSeeActivity, initialDocId, children }: {
  categoryId: string; categoryName: string; companyName: string; fields: FormField[]; refInfo: RefInfo;
  canCreate: boolean; canSeeActivity: boolean; initialDocId?: string; children: React.ReactNode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialDocId ? { kind: "view", id: initialDocId } : { kind: "closed" });
  const close = useCallback(() => setMode({ kind: "closed" }), []);

  const api = useMemo<Api>(() => ({
    openCreate: (o) => canCreate && setMode({ kind: "create", anchor: o?.anchor, date: o?.date || todayLocal() }),
    openView: (id) => setMode({ kind: "view", id }),
    openActivity: () => canSeeActivity && setMode({ kind: "activity" }),
  }), [canCreate, canSeeActivity]);

  const title = mode.kind === "create" ? "Nouveau document" : mode.kind === "activity" ? "Journal d'activité" : mode.kind === "edit" ? "Modifier le document" : "Détail du document";

  return (
    <Ctx.Provider value={api}>
      {children}
      <Drawer open={mode.kind !== "closed"} onClose={close} title={<>{title}<div className="text-xs font-normal text-muted mt-0.5">{companyName} › {categoryName}</div></>}>
        {mode.kind === "create" && (
          <CreatePanel key={`${mode.date}-${mode.anchor?.id}-${mode.anchor?.position}`} categoryId={categoryId} fields={fields} refInfo={refInfo} anchor={mode.anchor} date={mode.date}
            onCreated={(id, reference, number) => { router.refresh(); setMode({ kind: "view", id, flash: `Document n° ${String(number).padStart(4, "0")} enregistré${reference ? ` — ${reference}` : ""}` }); }}
            onCancel={close} />
        )}
        {(mode.kind === "view" || mode.kind === "edit") && (
          <ViewEditPanel key={mode.id} id={mode.id} editing={mode.kind === "edit"} flash={mode.kind === "view" ? mode.flash : undefined}
            onEdit={() => setMode({ kind: "edit", id: mode.id })} onView={(flash) => { router.refresh(); setMode({ kind: "view", id: mode.id, flash }); }}
            onCancelEdit={() => setMode({ kind: "view", id: mode.id })} onGone={() => { router.refresh(); close(); }} />
        )}
        {mode.kind === "activity" && <ActivityPanel categoryId={categoryId} onOpen={(id) => setMode({ kind: "view", id })} />}
      </Drawer>
    </Ctx.Provider>
  );
}

// ───────── Boutons utilisables depuis le tableau (rendu serveur) ─────────
export function NewDocumentButton({ className = "btn", children }: { className?: string; children: React.ReactNode }) {
  const { openCreate } = useApi();
  return <button type="button" onClick={() => openCreate()} className={className}><Plus size={16} />{children}</button>;
}
export function ActivityButton() {
  const { openActivity } = useApi();
  return <button type="button" onClick={openActivity} className="btn !bg-transparent !text-fg border"><History size={16} />Journal d&apos;activité</button>;
}
export function OpenView({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const { openView } = useApi();
  return <button type="button" onClick={() => openView(id)} className={className ?? "text-left hover:underline"}>{children}</button>;
}
/** Boutons « avant » / « après » d'une ligne : créent un document daté par rapport à celui-ci. */
export function AnchorButtons({ id, number, date, prevDate }: { id: string; number: number; date: string | null; prevDate: string | null }) {
  const { openCreate } = useApi();
  const btn = "grid size-7 place-items-center rounded-md hover:bg-black/10";
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" title={`Créer avant le n° ${number}`} aria-label={`Créer avant le n° ${number}`} className={`${btn} text-danger`}
        onClick={() => openCreate({ anchor: { id, number, position: "before" }, date: prevDate ?? date ?? undefined })}><Plus size={16} /></button>
      <button type="button" title={`Créer après le n° ${number}`} aria-label={`Créer après le n° ${number}`} className={`${btn} text-success`}
        onClick={() => openCreate({ anchor: { id, number, position: "after" }, date: date ?? undefined })}><Plus size={16} /></button>
    </span>
  );
}

// ───────── Création ─────────
function initialValues(fields: FormField[], date: string) {
  const v: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "date") v[f.name] = f.name === "docDate" ? date : todayLocal();
    if (f.type === "datetime") v[f.name] = f.name === "docDate" ? `${date}T${new Date().toTimeString().slice(0, 5)}` : nowLocal();
  }
  return v;
}

function ReferencePreview({ refInfo, form }: { refInfo: RefInfo; form: React.RefObject<HTMLFormElement | null> }) {
  const [text, setText] = useState("");
  const update = useCallback(() => {
    if (!refInfo.template || !form.current) return;
    const fd = new FormData(form.current);
    const d = String(fd.get("docDate") ?? "").slice(0, 10);
    setText(buildReference(refInfo.template, {
      number: refInfo.nextNumber, categoryCode: refInfo.categoryCode, companyCode: refInfo.companyCode,
      issuer: String(fd.get("issuer") ?? ""), recipient: String(fd.get("recipient") ?? ""), entity: String(fd.get("entity") ?? ""),
      date: d ? new Date(`${d}T00:00:00Z`) : null,
    }));
  }, [refInfo, form]);
  useEffect(() => { update(); const f = form.current; f?.addEventListener("input", update); f?.addEventListener("change", update); return () => { f?.removeEventListener("input", update); f?.removeEventListener("change", update); }; }, [update, form]);
  if (!refInfo.template) return null;
  return (
    <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
      <div className="text-xs text-muted">Référence (aperçu — générée automatiquement à l&apos;enregistrement)</div>
      <div className="font-mono text-sm break-all">{text}</div>
    </div>
  );
}

function CreatePanel({ categoryId, fields, refInfo, anchor, date, onCreated, onCancel }: {
  categoryId: string; fields: FormField[]; refInfo: RefInfo; anchor?: Anchor; date: string;
  onCreated: (id: string, reference: string | null, number: number) => void; onCancel: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const init = useMemo(() => initialValues(fields, date), [fields, date]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return; // protection contre la double soumission
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    if (anchor) { fd.set("_anchorId", anchor.id); fd.set("_position", anchor.position); }
    setError(null);
    start(async () => {
      const r = await createDocumentAction(categoryId, fd);
      if (r.ok) onCreated(r.id, r.reference, r.number); else setError(r.error);
    });
  };

  return (
    <form ref={form} onSubmit={submit} className="space-y-4">
      {anchor && (
        <div className="rounded-lg border bg-black/[.03] p-2.5 text-sm">
          Correspondance à insérer <strong>{anchor.position === "before" ? "avant" : "après"}</strong> le n° {String(anchor.number).padStart(4, "0")}.
          <span className="block text-xs text-muted">La date est pré-remplie, modifiable. Le numéro d&apos;ordre est attribué à la création : aucune référence existante ne change.</span>
        </div>
      )}
      <ReferencePreview refInfo={refInfo} form={form} />
      {error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-sm text-danger">{error}</p>}
      {fields.map((f) => <DynamicField key={f.name} field={f} defaultValue={init[f.name]} />)}
      <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap gap-2 border-t bg-[var(--background)] p-3">
        <button name="intent" value="publish" disabled={pending} className="btn disabled:opacity-60">{pending ? "Enregistrement…" : "Enregistrer"}</button>
        <button name="intent" value="draft" formNoValidate disabled={pending} className="btn !bg-transparent !text-fg border disabled:opacity-60">Brouillon</button>
        <button type="button" onClick={onCancel} className="ml-auto text-sm text-muted hover:text-fg">Annuler</button>
      </div>
    </form>
  );
}

// ───────── Détail / modification ─────────
function ViewEditPanel({ id, editing, flash, onEdit, onView, onCancelEdit, onGone }: {
  id: string; editing: boolean; flash?: string; onEdit: () => void; onView: (flash?: string) => void; onCancelEdit: () => void; onGone: () => void;
}) {
  const [data, setData] = useState<{ detail: DocumentDetail; activity: ActivityEntry[] | null } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`/api/documents/${id}`, { cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error(r.status === 404 ? "Document introuvable ou accès refusé" : "Chargement impossible"); return r.json(); })
      .then((j) => alive && setData(j))
      .catch((e: Error) => alive && setLoadError(e.message));
    return () => { alive = false; };
  }, [id, version]);

  if (loadError) return <p role="alert" className="text-sm text-danger">{loadError}</p>;
  if (!data) return <div className="space-y-3" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-black/10" />)}</div>;
  const { detail: d, activity } = data;

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    setError(null);
    start(async () => {
      const r = await updateDocumentAction(id, fd);
      if (r.ok) { setVersion((v) => v + 1); setData(null); onView("Modifications enregistrées"); } else setError(r.error);
    });
  };
  const toggleArchive = () => start(async () => {
    const r = await archiveDocumentAction(id, d.status !== "ARCHIVED");
    if (r.ok) { setVersion((v) => v + 1); setData(null); onView(d.status === "ARCHIVED" ? "Document restauré" : "Document archivé"); } else setError(r.error);
  });
  const remove = () => start(async () => {
    const r = await deleteDocumentAction(id);
    if (r.ok) onGone(); else { setError(r.error); setConfirmDelete(false); }
  });

  const header = (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">n° {String(d.number).padStart(4, "0")}</span>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${d.status === "DRAFT" ? "border-warning text-warning" : d.status === "ARCHIVED" ? "text-muted" : "border-success text-success"}`}>{STATUS[d.status]}</span>
        {d.canEdit && !editing && (
          <button type="button" onClick={onEdit} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-black/5"><Pencil size={13} />Modifier</button>
        )}
      </div>
      {d.reference && <div className="rounded-lg border bg-black/[.03] p-2.5"><div className="text-xs text-muted">Référence</div><div className="font-mono text-sm break-all">{d.reference}</div></div>}
      {flash && <p className="rounded-lg border border-success/40 bg-success/10 p-2 text-sm text-success">{flash}</p>}
      {error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-sm text-danger">{error}</p>}
    </div>
  );

  const body = d.fields.map((f) => <DynamicField key={`${f.name}-${editing}-${data.detail.updatedAt}`} field={f} defaultValue={d.data[f.name]} disabled={!editing} />);
  const attachments = d.attachments.length > 0 && (
    <div className="space-y-1">
      <div className="text-sm font-medium">Pièces jointes</div>
      {d.attachments.map((a) => <a key={a.id} href={`/api/files/${a.id}`} className="block text-sm text-primary-hover hover:underline">{a.fileName}</a>)}
    </div>
  );

  if (editing) {
    return (
      <form onSubmit={save} className="space-y-4">
        {header}
        {body}
        {attachments}
        {d.hasTemplate && <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="regenerateReference" className="mt-1" /><span>Régénérer la référence avec les nouvelles valeurs<span className="block text-xs text-muted">Par défaut la référence existante est conservée, car elle a pu être communiquée.</span></span></label>}
        <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap gap-2 border-t bg-[var(--background)] p-3">
          <button name="intent" value="publish" disabled={pending} className="btn disabled:opacity-60">{pending ? "Enregistrement…" : d.status === "DRAFT" ? "Publier" : "Enregistrer"}</button>
          {d.status === "DRAFT" && <button name="intent" value="draft" formNoValidate disabled={pending} className="btn !bg-transparent !text-fg border disabled:opacity-60">Enregistrer le brouillon</button>}
          <button type="button" onClick={onCancelEdit} className="ml-auto text-sm text-muted hover:text-fg">Annuler</button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      <div className="space-y-4">{body}</div>
      {attachments}
      <div className="rounded-lg border p-2.5 text-xs text-muted">
        Saisi par {d.createdBy} le {fmtDate(d.createdAt)} · dernière modification {fmtDate(d.updatedAt)} · formulaire v{d.schemaVersion}
      </div>
      {(d.canArchive || d.canDelete) && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          {d.canArchive && d.status !== "DRAFT" && (
            <button type="button" onClick={toggleArchive} disabled={pending} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
              {d.status === "ARCHIVED" ? <><ArchiveRestore size={15} />Restaurer</> : <><Archive size={15} />Archiver</>}
            </button>
          )}
          {d.canDelete && !confirmDelete && <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-sm text-danger"><Trash2 size={15} />Supprimer</button>}
          {d.canDelete && confirmDelete && (
            <span className="inline-flex items-center gap-2 text-sm">Supprimer ce document ?
              <button type="button" onClick={remove} disabled={pending} className="rounded-md bg-danger px-2 py-1 text-xs text-white">Oui, supprimer</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-muted">Non</button>
            </span>
          )}
        </div>
      )}
      {activity && <ActivityList entries={activity} />}
    </div>
  );
}

// ───────── Journal d'activité ─────────
function ActivityList({ entries, onOpen }: { entries: ActivityEntry[]; onOpen?: (id: string) => void }) {
  if (entries.length === 0) return <p className="text-sm text-muted">Aucune activité enregistrée.</p>;
  return (
    <section aria-label="Activité" className="space-y-2">
      {onOpen === undefined && <h3 className="text-sm font-medium">Activité</h3>}
      <ul className="divide-y rounded-lg border">
        {entries.map((e) => (
          <li key={e.id} className="p-2.5 text-sm">
            <div className="flex flex-wrap justify-between gap-x-3">
              <span><strong>{e.user}</strong> {e.label}{" "}
                {onOpen && e.documentId && e.number !== null && <button type="button" onClick={() => onOpen(e.documentId!)} className="font-medium text-primary-hover hover:underline">n° {String(e.number).padStart(4, "0")}</button>}
              </span>
              <time className="text-xs text-muted">{fmtDate(e.at)}</time>
            </div>
            {onOpen && e.reference && <div className="font-mono text-[11px] text-muted break-all">{e.reference}</div>}
            {e.changes.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-muted">
                {e.changes.map((c) => <li key={c.label}><span className="text-fg">{c.label}</span> : {c.from} → {c.to}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActivityPanel({ categoryId, onOpen }: { categoryId: string; onOpen: (id: string) => void }) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/categories/${categoryId}/activity`, { cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error("Accès refusé"); return r.json(); })
      .then((j) => alive && setEntries(j.entries))
      .catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [categoryId]);
  if (error) return <p role="alert" className="text-sm text-danger">{error}</p>;
  if (!entries) return <div aria-busy="true" className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-black/10" />)}</div>;
  return <ActivityList entries={entries} onOpen={onOpen} />;
}
