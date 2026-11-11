import { z } from "zod";
import type { FormField } from "./schema";

export type ParsedValues = Record<string, string | number | boolean | string[] | null>;
export type ParseResult =
  | { ok: true; values: ParsedValues; files: Record<string, File[]> }
  | { ok: false; error: string };

const isBlank = (v: FormDataEntryValue | null) => v === null || (typeof v === "string" && v.trim() === "");

/** Construit le validateur Zod d'un champ (même logique côté serveur pour tous les formulaires). */
function zodFor(f: FormField): z.ZodTypeAny {
  const v = f.validation ?? {};
  switch (f.type) {
    case "integer": {
      let s = z.number({ message: `${f.label} : nombre entier attendu` }).int(`${f.label} : nombre entier attendu`);
      if (v.min !== undefined) s = s.min(v.min, `${f.label} : minimum ${v.min}`);
      if (v.max !== undefined) s = s.max(v.max, `${f.label} : maximum ${v.max}`);
      return s;
    }
    case "decimal": {
      let s = z.number({ message: `${f.label} : nombre attendu` });
      if (v.min !== undefined) s = s.min(v.min, `${f.label} : minimum ${v.min}`);
      if (v.max !== undefined) s = s.max(v.max, `${f.label} : maximum ${v.max}`);
      return s;
    }
    case "date": return z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${f.label} : date invalide`);
    case "datetime": return z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, `${f.label} : date/heure invalide`);
    case "email": return z.string().email(`${f.label} : email invalide`);
    case "phone": return z.string().regex(/^\+?[0-9 .()-]{6,20}$/, `${f.label} : numéro invalide`);
    case "boolean": return z.boolean();
    case "select": return z.string().refine((x) => f.options?.includes(x), `${f.label} : option invalide`);
    case "multiselect": return z.array(z.string().refine((x) => f.options?.includes(x), `${f.label} : option invalide`));
    default: {
      let s = z.string();
      if (v.min !== undefined) s = s.min(v.min, `${f.label} : ${v.min} caractères minimum`);
      if (v.max !== undefined) s = s.max(v.max, `${f.label} : ${v.max} caractères maximum`);
      if (v.pattern) s = s.regex(new RegExp(v.pattern), v.message ?? `${f.label} : format invalide`);
      return s;
    }
  }
}

/** `draft: true` → les champs obligatoires peuvent rester vides (brouillon) ; les valeurs saisies restent validées. */
export function parseFormData(fields: FormField[], form: FormData, opts: { draft?: boolean } = {}): ParseResult {
  const mustFill = (f: FormField) => f.required && !opts.draft;
  const values: ParsedValues = {};
  const files: Record<string, File[]> = {};
  for (const f of fields) {
    if (f.type === "file") {
      const list = form.getAll(f.name).filter((x): x is File => x instanceof File && x.size > 0);
      if (mustFill(f) && list.length === 0) return { ok: false, error: `${f.label} est obligatoire` };
      if (list.length) files[f.name] = list;
      continue;
    }
    if (f.type === "boolean") { values[f.name] = form.get(f.name) !== null; continue; }
    if (f.type === "multiselect") {
      const arr = form.getAll(f.name).map(String);
      if (mustFill(f) && arr.length === 0) return { ok: false, error: `${f.label} est obligatoire` };
      const r = zodFor(f).safeParse(arr);
      if (!r.success) return { ok: false, error: r.error.issues[0].message };
      values[f.name] = arr; continue;
    }
    const raw = form.get(f.name);
    if (isBlank(raw)) {
      if (mustFill(f)) return { ok: false, error: `${f.label} est obligatoire` };
      values[f.name] = null; continue;
    }
    const str = String(raw).trim();
    const input = f.type === "integer" || f.type === "decimal" ? Number(str) : str;
    const r = zodFor(f).safeParse(input);
    if (!r.success) return { ok: false, error: r.error.issues[0].message };
    values[f.name] = r.data as ParsedValues[string];
  }
  return { ok: true, values, files };
}
