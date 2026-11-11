import { z } from "zod";

export const FIELD_TYPES = {
  text: "Texte court",
  textarea: "Texte long",
  richtext: "Texte enrichi",
  integer: "Nombre entier",
  decimal: "Nombre décimal",
  date: "Date",
  datetime: "Date et heure",
  select: "Liste déroulante",
  multiselect: "Sélection multiple",
  boolean: "Oui / Non",
  email: "Email",
  phone: "Téléphone",
  file: "Pièce jointe",
} as const;
export type FieldType = keyof typeof FIELD_TYPES;
export const OPTION_TYPES: FieldType[] = ["select", "multiselect"];

export const fieldSchema = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/, "Nom technique invalide (lettres, chiffres, _ ; commence par une lettre)"),
  label: z.string().min(1, "Libellé requis").max(100),
  type: z.enum(Object.keys(FIELD_TYPES) as [FieldType, ...FieldType[]]),
  required: z.boolean().default(false),
  description: z.string().max(300).optional(),
  placeholder: z.string().max(100).optional(),
  defaultValue: z.string().max(300).optional(),
  options: z.array(z.string().min(1).max(100)).optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().max(200).optional(),
    message: z.string().max(200).optional(),
  }).optional(),
});
export type FormField = z.infer<typeof fieldSchema>;

export const fieldsSchema = z.array(fieldSchema).min(1, "Ajoutez au moins un champ").max(60).superRefine((fields, ctx) => {
  const seen = new Set<string>();
  fields.forEach((f, i) => {
    if (seen.has(f.name)) ctx.addIssue({ code: "custom", message: `Nom technique en double : ${f.name}`, path: [i, "name"] });
    seen.add(f.name);
    if (OPTION_TYPES.includes(f.type) && !f.options?.length)
      ctx.addIssue({ code: "custom", message: `Le champ « ${f.label} » doit avoir au moins une option`, path: [i, "options"] });
    if (f.validation?.pattern) {
      try { new RegExp(f.validation.pattern); } catch { ctx.addIssue({ code: "custom", message: `Expression régulière invalide pour « ${f.label} »`, path: [i, "validation"] }); }
    }
  });
});

export const toTechName = (label: string) =>
  label.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : "")).replace(/^[^a-zA-Z]+/, "").replace(/^./, (c) => c.toLowerCase()).slice(0, 40);
