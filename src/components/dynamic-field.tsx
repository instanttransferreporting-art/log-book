"use client";
import { useId } from "react";
import type { FormField } from "@/lib/forms/schema";

/** Date du jour (locale de l'utilisateur) au format attendu par <input type="date">. */
export const todayLocal = () => new Date().toLocaleDateString("en-CA");
export const nowLocal = () => `${todayLocal()}T${new Date().toTimeString().slice(0, 5)}`;

/** Rendu d'un champ dynamique. Utilisé par l'aperçu du Form Builder et par le tiroir de saisie / consultation. */
export function DynamicField({ field, name, defaultValue, disabled = false }: { field: FormField; name?: string; defaultValue?: unknown; disabled?: boolean }) {
  const id = useId();
  const n = name ?? field.name;
  const dv = String(Array.isArray(defaultValue) ? "" : (defaultValue ?? field.defaultValue ?? ""));
  const common = { id, name: n, required: field.required, placeholder: field.placeholder, disabled, className: "input disabled:opacity-100 disabled:bg-black/[.04] disabled:cursor-default" };
  let control: React.ReactNode;
  switch (field.type) {
    case "textarea":
    case "richtext":
      control = <textarea {...common} rows={field.type === "richtext" ? 6 : 3} defaultValue={dv} />; break;
    case "integer": control = <input {...common} type="number" step={1} min={field.validation?.min} max={field.validation?.max} defaultValue={dv} />; break;
    case "decimal": control = <input {...common} type="number" step="any" min={field.validation?.min} max={field.validation?.max} defaultValue={dv} />; break;
    case "date": control = <input {...common} type="date" defaultValue={dv} />; break;
    case "datetime": control = <input {...common} type="datetime-local" defaultValue={dv} />; break;
    case "email": control = <input {...common} type="email" defaultValue={dv} />; break;
    case "phone": control = <input {...common} type="tel" defaultValue={dv} />; break;
    case "file": control = disabled ? null : <input {...common} type="file" multiple />; break;
    case "boolean":
      control = <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={n} disabled={disabled} defaultChecked={dv === "true"} /> Oui</label>; break;
    case "select":
      control = (
        <select {...common} defaultValue={dv}>
          <option value="">— Choisir —</option>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ); break;
    case "multiselect":
      control = (
        <div className="flex flex-wrap gap-3 text-sm">
          {field.options?.map((o) => (
            <label key={o} className="flex items-center gap-1">
              <input type="checkbox" name={n} value={o} disabled={disabled} defaultChecked={Array.isArray(defaultValue) && defaultValue.includes(o)} />{o}
            </label>
          ))}
        </div>
      ); break;
    default:
      control = <input {...common} type="text" defaultValue={dv} pattern={field.validation?.pattern} minLength={field.validation?.min} maxLength={field.validation?.max} />;
  }
  if (field.type === "file" && disabled) return null;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">{field.label}{field.required && !disabled && <span className="text-danger"> *</span>}</label>
      {control}
      {field.description && !disabled && <p className="text-xs text-muted">{field.description}</p>}
    </div>
  );
}
