import { describe, expect, it } from "vitest";
import { fieldsSchema, toTechName, type FormField } from "@/lib/forms/schema";
import { parseFormData } from "@/lib/forms/validate";

const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};

const fields: FormField[] = [
  { name: "subject", label: "Objet", type: "text", required: true, validation: { min: 3, max: 20 } },
  { name: "amount", label: "Montant", type: "decimal", required: false, validation: { min: 0 } },
  { name: "qty", label: "Quantité", type: "integer", required: false },
  { name: "kind", label: "Type", type: "select", required: false, options: ["A", "B"] },
  { name: "tags", label: "Tags", type: "multiselect", required: false, options: ["x", "y"] },
  { name: "mail", label: "Email", type: "email", required: false },
  { name: "urgent", label: "Urgent", type: "boolean", required: false },
  { name: "code", label: "Code", type: "text", required: false, validation: { pattern: "^[A-Z]{2}\\d+$", message: "Code invalide" } },
];

describe("parseFormData", () => {
  it("accepte des valeurs valides et convertit les types", () => {
    const r = parseFormData(fields, fd({ subject: "Facture", amount: "12.5", qty: "3", kind: "A", tags: ["x", "y"], mail: "a@b.co", urgent: "on" }));
    expect(r).toMatchObject({ ok: true, values: { subject: "Facture", amount: 12.5, qty: 3, kind: "A", tags: ["x", "y"], urgent: true } });
  });
  it("refuse un champ obligatoire vide", () => {
    expect(parseFormData(fields, fd({ subject: "  " }))).toEqual({ ok: false, error: "Objet est obligatoire" });
  });
  it("respecte min/max de longueur", () => {
    expect(parseFormData(fields, fd({ subject: "ab" })).ok).toBe(false);
    expect(parseFormData(fields, fd({ subject: "x".repeat(21) })).ok).toBe(false);
  });
  it("refuse nombre invalide, entier décimal, borne min", () => {
    expect(parseFormData(fields, fd({ subject: "Test", amount: "abc" })).ok).toBe(false);
    expect(parseFormData(fields, fd({ subject: "Test", qty: "1.5" })).ok).toBe(false);
    expect(parseFormData(fields, fd({ subject: "Test", amount: "-1" })).ok).toBe(false);
  });
  it("refuse une option hors liste et un email invalide", () => {
    expect(parseFormData(fields, fd({ subject: "Test", kind: "Z" })).ok).toBe(false);
    expect(parseFormData(fields, fd({ subject: "Test", tags: ["x", "nope"] })).ok).toBe(false);
    expect(parseFormData(fields, fd({ subject: "Test", mail: "pas-un-email" })).ok).toBe(false);
  });
  it("applique l'expression régulière avec message personnalisé", () => {
    expect(parseFormData(fields, fd({ subject: "Test", code: "ab1" }))).toEqual({ ok: false, error: "Code invalide" });
    expect(parseFormData(fields, fd({ subject: "Test", code: "AB12" })).ok).toBe(true);
  });
  it("ignore les champs inconnus envoyés par le client", () => {
    const r = parseFormData(fields, fd({ subject: "Test", hack: "x" }));
    expect(r.ok && "hack" in r.values).toBe(false);
  });
});

describe("fieldsSchema", () => {
  const base = { label: "L", type: "text" as const, required: false };
  it("refuse les noms techniques en double", () => {
    expect(fieldsSchema.safeParse([{ ...base, name: "a" }, { ...base, name: "a" }]).success).toBe(false);
  });
  it("exige des options pour les listes", () => {
    expect(fieldsSchema.safeParse([{ ...base, name: "a", type: "select" }]).success).toBe(false);
  });
  it("refuse une regex invalide et un nom technique invalide", () => {
    expect(fieldsSchema.safeParse([{ ...base, name: "a", validation: { pattern: "(" } }]).success).toBe(false);
    expect(fieldsSchema.safeParse([{ ...base, name: "1bad" }]).success).toBe(false);
  });
  it("refuse un formulaire vide", () => {
    expect(fieldsSchema.safeParse([]).success).toBe(false);
  });
});

describe("toTechName", () => {
  it("génère un nom technique camelCase sans accents", () => {
    expect(toTechName("Date de départ")).toBe("dateDeDepart");
    expect(toTechName("Montant TTC")).toBe("montantTTC");
  });
});
