import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { can, type CurrentUser } from "@/lib/auth/access";
import type { PermissionKey } from "@/lib/permissions";
import type { FormField } from "@/lib/forms/schema";
import { parseFormData, type ParsedValues } from "@/lib/forms/validate";
import { buildReference } from "@/lib/reference";
import { checkFile, saveFile } from "./storage";

export class ServiceError extends Error {}

/** Catégorie accessible à l'utilisateur (isolation inter-entreprises) ou null. */
export async function getCategoryForUser(user: CurrentUser, code: string, slug: string) {
  const cat = await db.documentCategory.findFirst({
    where: { slug, company: { code, ...(user.isSuperAdmin ? {} : { id: { in: user.companyIds } }) } },
    include: { company: true, schemas: { orderBy: { version: "desc" }, take: 1 } },
  });
  return cat && can(user, "documents.view", cat.companyId) ? cat : null;
}

/** Document accessible (non supprimé) avec sa version de schéma d'origine. */
export async function getDocumentForUser(user: CurrentUser, id: string) {
  const doc = await db.document.findFirst({
    where: { id, deletedAt: null, ...(user.isSuperAdmin ? {} : { companyId: { in: user.companyIds } }) },
    include: { company: true, category: true, schemaVersion: true, createdBy: true, attachments: true },
  });
  return doc && can(user, "documents.view", doc.companyId) ? doc : null;
}

function assertPerm(user: CurrentUser, perm: PermissionKey, companyId?: string) {
  if (!can(user, perm, companyId)) throw new ServiceError("Action non autorisée");
}

/** Si la catégorie génère la référence, le champ « reference » du formulaire n'est ni affiché ni saisi. */
export function effectiveFields(fields: FormField[], referenceTemplate: string | null | undefined) {
  return referenceTemplate ? fields.filter((f) => f.name !== "reference") : fields;
}

const str = (v: ParsedValues[string] | undefined) => (typeof v === "string" && v ? v : null);

function columns(values: ParsedValues) {
  const d = str(values.docDate);
  return {
    docDate: d ? new Date(`${d.slice(0, 10)}T00:00:00.000Z`) : null,
    issuer: str(values.issuer), recipient: str(values.recipient), entity: str(values.entity), subject: str(values.subject),
  };
}

async function storeFiles(documentId: string, files: Record<string, File[]>, values: ParsedValues, existing: ParsedValues = {}) {
  for (const list of Object.values(files)) for (const f of list) { const e = checkFile(f); if (e) throw new ServiceError(e); }
  for (const [name, list] of Object.entries(files)) {
    const ids = Array.isArray(existing[name]) ? [...(existing[name] as string[])] : [];
    for (const f of list) {
      const a = await db.documentAttachment.create({
        data: { documentId, fileName: f.name.slice(0, 200), mimeType: f.type, size: f.size, storageKey: await saveFile(f) },
      });
      ids.push(a.id);
    }
    values[name] = ids;
  }
  for (const [k, v] of Object.entries(existing)) if (!(k in values) && Array.isArray(v) && !(k in files)) values[k] = v;
}

export type CreateOptions = { anchorId?: string; position?: "before" | "after" };

export async function createDocument(user: CurrentUser, categoryId: string, form: FormData, opts: CreateOptions = {}) {
  const cat = await db.documentCategory.findUnique({ where: { id: categoryId }, include: { company: true, schemas: { orderBy: { version: "desc" }, take: 1 } } });
  if (!cat || (!user.isSuperAdmin && !user.companyIds.includes(cat.companyId))) throw new ServiceError("Accès refusé");
  assertPerm(user, "documents.create", cat.companyId);
  if (!cat.company.isActive || !cat.isActive || cat.archivedAt) throw new ServiceError("Cette catégorie n'accepte plus de nouveaux documents");
  const schema = cat.schemas[0];
  if (!schema) throw new ServiceError("Aucun formulaire configuré");
  if (opts.anchorId) {
    // Le document de repère doit appartenir à la même catégorie (et donc à une entreprise accessible)
    const anchor = await db.document.findFirst({ where: { id: opts.anchorId, categoryId, deletedAt: null }, select: { id: true } });
    if (!anchor) throw new ServiceError("Document de repère introuvable");
  }
  const draft = form.get("intent") === "draft";
  const parsed = parseFormData(effectiveFields(schema.fields as FormField[], cat.referenceTemplate), form, { draft });
  if (!parsed.ok) throw new ServiceError(parsed.error);
  for (const list of Object.values(parsed.files)) for (const f of list) { const e = checkFile(f); if (e) throw new ServiceError(e); }

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const doc = await db.$transaction(async (tx) => {
        const max = await tx.document.aggregate({ where: { categoryId }, _max: { number: true } });
        const number = (max._max.number ?? 0) + 1; // ordre de création : indépendant de la date choisie
        const cols = columns(parsed.values);
        const reference = cat.referenceTemplate
          ? buildReference(cat.referenceTemplate, {
              number, categoryCode: cat.code, companyCode: cat.company.code, issuer: cols.issuer, recipient: cols.recipient, entity: cols.entity, date: cols.docDate,
            })
          : str(parsed.values.reference);
        const data = { ...parsed.values, ...(reference ? { reference } : {}) };
        return tx.document.create({
          data: {
            companyId: cat.companyId, categoryId, schemaVersionId: schema.id, createdById: user.id, status: draft ? "DRAFT" : "ACTIVE",
            number, reference, data: data as Prisma.InputJsonValue, ...cols,
          },
        });
      });
      if (Object.keys(parsed.files).length) {
        const values = { ...(doc.data as ParsedValues) };
        await storeFiles(doc.id, parsed.files, values);
        await db.document.update({ where: { id: doc.id }, data: { data: values as Prisma.InputJsonValue } });
      }
      return { doc, cat };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; // collision de numéro → réessai
      throw e;
    }
  }
  throw new ServiceError("Impossible d'attribuer un numéro, réessayez");
}

export async function updateDocument(user: CurrentUser, id: string, form: FormData) {
  const doc = await getDocumentForUser(user, id);
  if (!doc) throw new ServiceError("Document introuvable");
  assertPerm(user, "documents.update", doc.companyId);
  if (doc.status === "ARCHIVED") throw new ServiceError("Un document archivé n'est pas modifiable");
  const draft = form.get("intent") === "draft";
  if (draft && doc.status !== "DRAFT") throw new ServiceError("Seul un brouillon peut être enregistré comme brouillon");
  // On valide avec le schéma d'ORIGINE du document : ses anciennes valeurs restent cohérentes.
  const template = doc.category.referenceTemplate;
  const parsed = parseFormData(effectiveFields(doc.schemaVersion.fields as FormField[], template), form, { draft });
  if (!parsed.ok) throw new ServiceError(parsed.error);
  const old = doc.data as ParsedValues;
  const values: ParsedValues = { ...parsed.values };
  await storeFiles(doc.id, parsed.files, values, old);
  const cols = columns(values);

  // La référence est figée (elle a pu être communiquée) sauf demande explicite de régénération.
  let reference = doc.reference;
  if (template && form.get("regenerateReference") === "on") {
    reference = buildReference(template, {
      number: doc.number, categoryCode: doc.category.code, companyCode: doc.company.code, issuer: cols.issuer, recipient: cols.recipient, entity: cols.entity, date: cols.docDate,
    });
  } else if (!template) {
    reference = str(values.reference);
  }
  if (reference) values.reference = reference;
  await db.document.update({
    where: { id },
    data: { data: values as Prisma.InputJsonValue, ...cols, reference, status: draft ? "DRAFT" : "ACTIVE" },
  });
  return { before: old, after: values, doc };
}

export async function setArchived(user: CurrentUser, id: string, archived: boolean) {
  const doc = await getDocumentForUser(user, id);
  if (!doc) throw new ServiceError("Document introuvable");
  assertPerm(user, "documents.update", doc.companyId);
  await db.document.update({ where: { id }, data: { status: archived ? "ARCHIVED" : "ACTIVE" } });
  return doc;
}

export async function softDelete(user: CurrentUser, id: string) {
  const doc = await getDocumentForUser(user, id);
  if (!doc) throw new ServiceError("Document introuvable");
  assertPerm(user, "documents.delete", doc.companyId);
  await db.document.update({ where: { id }, data: { deletedAt: new Date() } });
  return doc;
}
