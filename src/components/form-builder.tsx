"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { FIELD_TYPES, OPTION_TYPES, toTechName, type FieldType, type FormField } from "@/lib/forms/schema";
import { DynamicField } from "./dynamic-field";

export function FormBuilder({ initial, action }: { initial: FormField[]; action: (form: FormData) => Promise<void> }) {
  const [fields, setFields] = useState<FormField[]>(initial);
  const [sel, setSel] = useState(0);
  const cur = fields[sel] as FormField | undefined;

  const patch = (i: number, p: Partial<FormField>) => setFields(fields.map((f, k) => (k === i ? { ...f, ...p } : f)));
  const add = () => {
    let n = fields.length + 1;
    while (fields.some((f) => f.name === `champ${n}`)) n++;
    setFields([...fields, { name: `champ${n}`, label: `Nouveau champ ${n}`, type: "text", required: false }]);
    setSel(fields.length);
  };
  const remove = (i: number) => { setFields(fields.filter((_, k) => k !== i)); setSel(Math.max(0, i - 1)); };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= fields.length) return;
    const c = [...fields]; [c[i], c[j]] = [c[j], c[i]]; setFields(c); setSel(j);
  };
  const numOrUndef = (v: string) => (v === "" ? undefined : Number(v));

  return (
    <form action={action} noValidate className="grid gap-4 lg:grid-cols-[260px_1fr_1fr]">
      <input type="hidden" name="fields" value={JSON.stringify(fields)} />

      <div className="card p-3 space-y-2 h-fit">
        <div className="text-sm font-medium">Champs ({fields.length})</div>
        {fields.map((f, i) => (
          <div key={i} className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-sm ${i === sel ? "border-primary bg-primary/10" : ""}`}>
            <button type="button" onClick={() => setSel(i)} className="flex-1 text-left truncate">{f.label}{f.required && " *"}</button>
            <button type="button" onClick={() => move(i, -1)} aria-label="Monter" className="text-muted hover:text-fg"><ArrowUp size={14} /></button>
            <button type="button" onClick={() => move(i, 1)} aria-label="Descendre" className="text-muted hover:text-fg"><ArrowDown size={14} /></button>
            <button type="button" onClick={() => remove(i)} aria-label="Supprimer" className="text-danger"><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={add} className="flex items-center gap-1 text-sm text-primary-hover"><Plus size={14} /> Ajouter un champ</button>
        <button className="btn w-full mt-2">Publier une nouvelle version</button>
      </div>

      <div className="card p-4 space-y-3 h-fit">
        <div className="text-sm font-medium">Propriétés</div>
        {!cur ? <p className="text-sm text-muted">Aucun champ.</p> : (
          <>
            <div><label className="text-xs text-muted">Libellé</label>
              <input className="input" value={cur.label} onChange={(e) => patch(sel, { label: e.target.value })} /></div>
            <div><label className="text-xs text-muted">Nom technique</label>
              <div className="flex gap-2">
                <input className="input" value={cur.name} onChange={(e) => patch(sel, { name: e.target.value })} />
                <button type="button" className="text-xs text-muted whitespace-nowrap" onClick={() => patch(sel, { name: toTechName(cur.label) || cur.name })}>Auto</button>
              </div></div>
            <div><label className="text-xs text-muted">Type</label>
              <select className="input" value={cur.type} onChange={(e) => patch(sel, { type: e.target.value as FieldType })}>
                {Object.entries(FIELD_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cur.required} onChange={(e) => patch(sel, { required: e.target.checked })} /> Obligatoire</label>
            {OPTION_TYPES.includes(cur.type) && (
              <div><label className="text-xs text-muted">Options (une par ligne)</label>
                <textarea className="input" rows={4} value={(cur.options ?? []).join("\n")}
                  onChange={(e) => patch(sel, { options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} /></div>
            )}
            <div><label className="text-xs text-muted">Description</label>
              <input className="input" value={cur.description ?? ""} onChange={(e) => patch(sel, { description: e.target.value || undefined })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-muted">Indication de saisie</label>
                <input className="input" value={cur.placeholder ?? ""} onChange={(e) => patch(sel, { placeholder: e.target.value || undefined })} /></div>
              <div><label className="text-xs text-muted">Valeur par défaut</label>
                <input className="input" value={cur.defaultValue ?? ""} onChange={(e) => patch(sel, { defaultValue: e.target.value || undefined })} /></div>
            </div>
            {["text", "textarea", "integer", "decimal"].includes(cur.type) && (
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-muted">{cur.type.startsWith("t") ? "Longueur min" : "Valeur min"}</label>
                  <input type="number" className="input" value={cur.validation?.min ?? ""} onChange={(e) => patch(sel, { validation: { ...cur.validation, min: numOrUndef(e.target.value) } })} /></div>
                <div><label className="text-xs text-muted">{cur.type.startsWith("t") ? "Longueur max" : "Valeur max"}</label>
                  <input type="number" className="input" value={cur.validation?.max ?? ""} onChange={(e) => patch(sel, { validation: { ...cur.validation, max: numOrUndef(e.target.value) } })} /></div>
              </div>
            )}
            {cur.type === "text" && (
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-muted">Expression régulière</label>
                  <input className="input" value={cur.validation?.pattern ?? ""} onChange={(e) => patch(sel, { validation: { ...cur.validation, pattern: e.target.value || undefined } })} /></div>
                <div><label className="text-xs text-muted">Message d&apos;erreur</label>
                  <input className="input" value={cur.validation?.message ?? ""} onChange={(e) => patch(sel, { validation: { ...cur.validation, message: e.target.value || undefined } })} /></div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card p-4 space-y-4 h-fit">
        <div className="text-sm font-medium">Aperçu</div>
        {fields.map((f, i) => <DynamicField key={`${i}-${f.type}-${f.options?.join()}`} field={f} name={`preview_${i}`} />)}
      </div>
    </form>
  );
}
