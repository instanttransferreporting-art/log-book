import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { FormField } from "@/lib/forms/schema";

export const STANDARD_FIELDS = ["docDate", "issuer", "entity", "recipient", "subject", "reference"];
export const SORTABLE = ["number", "reference", "issuer", "recipient", "entity", "subject", "docDate", "createdAt", "status"] as const;
type SortKey = (typeof SORTABLE)[number];

export type DocQuery = {
  q: string; status: "" | "ACTIVE" | "ARCHIVED" | "DRAFT"; from: string; to: string; userId: string; reference: string;
  sort: SortKey; dir: "asc" | "desc"; page: number; size: number; ids: string[];
};

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const validDate = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : "");

export function parseQuery(raw: Raw): DocQuery {
  const sort = one(raw.sort) as SortKey;
  const size = Number.parseInt(one(raw.size), 10);
  const ids = raw.ids ? (Array.isArray(raw.ids) ? raw.ids : [raw.ids]) : [];
  return {
    q: one(raw.q).trim().slice(0, 100),
    status: ["ACTIVE", "ARCHIVED", "DRAFT"].includes(one(raw.status)) ? (one(raw.status) as DocQuery["status"]) : "",
    from: validDate(one(raw.from)), to: validDate(one(raw.to)),
    userId: one(raw.userId).slice(0, 40), reference: one(raw.reference).trim().slice(0, 100),
    sort: SORTABLE.includes(sort) ? sort : "number",
    dir: one(raw.dir) === "asc" ? "asc" : "desc",
    page: Math.max(1, Number.parseInt(one(raw.page), 10) || 1),
    size: [10, 25, 50, 100].includes(size) ? size : 25,
    ids: ids.filter((i) => /^[a-z0-9]{10,40}$/i.test(i)),
  };
}

/** Construit la requête. L'appelant fournit une catégorie déjà vérifiée côté accès (isolation inter-entreprises). */
export async function queryDocuments(categoryId: string, q: DocQuery, opts: { paginate: boolean; max?: number }) {
  const where: Prisma.DocumentWhereInput = { categoryId, deletedAt: null };
  if (q.status) where.status = q.status;
  if (q.userId) where.createdById = q.userId;
  if (q.reference) where.reference = { contains: q.reference, mode: "insensitive" };
  if (q.from || q.to) where.createdAt = { ...(q.from ? { gte: new Date(`${q.from}T00:00:00.000Z`) } : {}), ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999Z`) } : {}) };
  if (q.ids.length) where.id = { in: q.ids };

  if (q.q) {
    // Recherche globale : colonnes standard + toutes les valeurs dynamiques (JSONB converti en texte)
    const like = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Document"
      WHERE "categoryId" = ${categoryId} AND "deletedAt" IS NULL
        AND (reference ILIKE ${like} OR subject ILIKE ${like} OR issuer ILIKE ${like} OR recipient ILIKE ${like} OR entity ILIKE ${like} OR data::text ILIKE ${like})
      LIMIT 5000`;
    const found = rows.map((r) => r.id);
    where.id = q.ids.length ? { in: found.filter((i) => q.ids.includes(i)) } : { in: found };
  }

  const orderBy = { [q.sort]: q.dir } as Prisma.DocumentOrderByWithRelationInput;
  const total = await db.document.count({ where });
  const rows = await db.document.findMany({
    where, orderBy: [orderBy, { id: "desc" }], include: { createdBy: { select: { name: true } } },
    ...(opts.paginate ? { skip: (q.page - 1) * q.size, take: q.size } : { take: opts.max ?? 10000 }),
  });
  return { total, rows };
}

export type Column = { key: string; label: string; sortable: boolean; wide?: boolean };

/** Toutes les colonnes possibles pour un formulaire (avant filtrage par la configuration de la catégorie). */
export function availableColumns(fields: FormField[]): Column[] {
  const has = (n: string) => fields.some((f) => f.name === n);
  const label = (n: string, fallback: string) => fields.find((f) => f.name === n)?.label ?? fallback;
  const cols: Column[] = [
    { key: "number", label: "#", sortable: true },
    { key: "reference", label: "Référence", sortable: true, wide: true },
    { key: "docDate", label: label("docDate", "Date"), sortable: true },
  ];
  if (has("issuer")) cols.push({ key: "issuer", label: label("issuer", "Émetteur"), sortable: true });
  if (has("entity")) cols.push({ key: "entity", label: label("entity", "Entreprise"), sortable: true });
  if (has("recipient")) cols.push({ key: "recipient", label: label("recipient", "Destinataire"), sortable: true });
  if (has("subject")) cols.push({ key: "subject", label: label("subject", "Objet"), sortable: true });
  const extra = fields.filter((f) => !STANDARD_FIELDS.includes(f.name) && f.type !== "file" && f.type !== "richtext")
    .map((f): Column => ({ key: `data.${f.name}`, label: f.label, sortable: false }));
  return [...cols, ...extra, { key: "createdBy", label: "Saisi par", sortable: false }, { key: "status", label: "Statut", sortable: true }];
}

/** Colonnes affichées par défaut : l'objet et « saisi par » restent dans le détail. */
const HIDDEN_BY_DEFAULT = new Set(["subject", "createdBy"]);

/**
 * Colonnes de la liste. `visible` = configuration de la catégorie (clés) ; null = défaut ; "all" = tout (exports).
 * Le numéro est toujours affiché ; l'ordre est celui du formulaire.
 */
export function buildColumns(fields: FormField[], visible: string[] | null | "all" = null): Column[] {
  const all = availableColumns(fields);
  if (visible === "all") return all;
  if (Array.isArray(visible)) return all.filter((c) => c.key === "number" || visible.includes(c.key));
  return all.filter((c) => !HIDDEN_BY_DEFAULT.has(c.key));
}

/** Lit la configuration stockée (Json) de façon défensive. */
export function parseListColumns(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : null;
}

type Row = Awaited<ReturnType<typeof queryDocuments>>["rows"][number];

/** Valeur textuelle d'une cellule (utilisée par le tableau et les exports). */
export function cellText(row: Row, key: string): string {
  switch (key) {
    case "number": return String(row.number).padStart(4, "0");
    case "docDate": return row.docDate ? row.docDate.toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "";
    case "createdBy": return row.createdBy.name;
    case "status": return row.status === "ARCHIVED" ? "Archivé" : row.status === "DRAFT" ? "Brouillon" : "Actif";
    case "reference": case "issuer": case "entity": case "recipient": case "subject": return row[key] ?? "";
    default: {
      if (!key.startsWith("data.")) return "";
      const v = (row.data as Record<string, unknown>)[key.slice(5)];
      if (v === null || v === undefined) return "";
      if (typeof v === "boolean") return v ? "Oui" : "Non";
      return Array.isArray(v) ? v.join(", ") : String(v);
    }
  }
}
