import { db } from "@/lib/db";
import { can, type CurrentUser } from "@/lib/auth/access";
import type { FormField } from "@/lib/forms/schema";
import { ACTION_LABELS, describeChanges, type Change } from "@/lib/changes";
import { effectiveFields, getDocumentForUser } from "./documents";

export type DocumentDetail = {
  id: string; number: number; reference: string | null; status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  company: string; category: string; hasTemplate: boolean; schemaVersion: number;
  fields: FormField[]; data: Record<string, unknown>; attachments: { id: string; fileName: string }[];
  createdBy: string; createdAt: string; updatedAt: string;
  canEdit: boolean; canArchive: boolean; canDelete: boolean; canSeeActivity: boolean;
};

export type ActivityEntry = {
  id: string; action: string; label: string; user: string; at: string;
  number: number | null; reference: string | null; documentId: string | null; changes: Change[];
};

export async function getDocumentDetail(user: CurrentUser, id: string): Promise<DocumentDetail | null> {
  const doc = await getDocumentForUser(user, id);
  if (!doc) return null;
  const archived = doc.status === "ARCHIVED";
  return {
    id: doc.id, number: doc.number, reference: doc.reference, status: doc.status,
    company: doc.company.name, category: doc.category.name, hasTemplate: !!doc.category.referenceTemplate, schemaVersion: doc.schemaVersion.version,
    fields: effectiveFields(doc.schemaVersion.fields as FormField[], doc.category.referenceTemplate),
    data: doc.data as Record<string, unknown>,
    attachments: doc.attachments.map((a) => ({ id: a.id, fileName: a.fileName })),
    createdBy: doc.createdBy.name, createdAt: doc.createdAt.toISOString(), updatedAt: doc.updatedAt.toISOString(),
    canEdit: can(user, "documents.update", doc.companyId) && !archived,
    canArchive: can(user, "documents.update", doc.companyId),
    canDelete: can(user, "documents.delete", doc.companyId),
    canSeeActivity: can(user, "audit.view", doc.companyId),
  };
}

async function toEntries(logs: Awaited<ReturnType<typeof loadLogs>>, labelsByDoc: Map<string, Record<string, string>>): Promise<ActivityEntry[]> {
  const docIds = [...new Set(logs.map((l) => l.resourceId).filter((x): x is string => !!x))];
  const docs = await db.document.findMany({ where: { id: { in: docIds } }, select: { id: true, number: true, reference: true } });
  return logs.map((l) => {
    const d = docs.find((x) => x.id === l.resourceId);
    const nv = (l.newValues ?? null) as Record<string, unknown> | null;
    const ov = (l.oldValues ?? null) as Record<string, unknown> | null;
    const changes = l.action === "document.update" ? describeChanges(labelsByDoc.get(l.resourceId ?? "") ?? {}, ov, nv, new Set(["reference"])) : [];
    return {
      id: l.id, action: l.action, label: ACTION_LABELS[l.action] ?? l.action, user: l.user?.name ?? "—", at: l.createdAt.toISOString(),
      number: d?.number ?? null, reference: d?.reference ?? null, documentId: l.resourceId, changes,
    };
  });
}

const loadLogs = (ids: string[]) => db.auditLog.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: "desc" }, include: { user: true } });

async function labelMap(docIds: string[]) {
  const docs = await db.document.findMany({ where: { id: { in: docIds } }, select: { id: true, schemaVersion: { select: { fields: true } } } });
  return new Map(docs.map((d) => [d.id, Object.fromEntries((d.schemaVersion.fields as FormField[]).map((f) => [f.name, f.label]))]));
}

/** Historique d'un document (nécessite audit.view pour l'entreprise du document). */
export async function documentActivity(user: CurrentUser, documentId: string): Promise<ActivityEntry[] | null> {
  const doc = await getDocumentForUser(user, documentId);
  if (!doc || !can(user, "audit.view", doc.companyId)) return null;
  const ids = await db.auditLog.findMany({ where: { resourceType: "Document", resourceId: documentId }, select: { id: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const logs = await loadLogs(ids.map((i) => i.id));
  return toEntries(logs, await labelMap([documentId]));
}

/** Journal d'activité d'une catégorie : dernières opérations sur ses documents (nécessite audit.view). */
export async function categoryActivity(user: CurrentUser, categoryId: string, limit = 60): Promise<ActivityEntry[] | null> {
  const cat = await db.documentCategory.findFirst({ where: { id: categoryId, ...(user.isSuperAdmin ? {} : { companyId: { in: user.companyIds } }) } });
  if (!cat || !can(user, "audit.view", cat.companyId)) return null;
  const rows = await db.$queryRaw<{ id: string; rid: string }[]>`
    SELECT a.id, a."resourceId" AS rid FROM "AuditLog" a JOIN "Document" d ON d.id = a."resourceId"
    WHERE a."resourceType" = 'Document' AND d."categoryId" = ${categoryId}
    ORDER BY a."createdAt" DESC LIMIT ${limit}`;
  const logs = await loadLogs(rows.map((r) => r.id));
  return toEntries(logs, await labelMap([...new Set(rows.map((r) => r.rid))]));
}
