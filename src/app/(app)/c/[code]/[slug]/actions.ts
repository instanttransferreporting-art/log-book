"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/services/guard";
import { createDocument, ServiceError, setArchived, softDelete, updateDocument } from "@/lib/services/documents";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Les actions retournent un résultat (pas de redirection) : l'interface reste dans le tiroir. */
async function run<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try { return { ok: true, ...(await fn()) }; } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Une erreur inattendue est survenue" };
  }
}

const refresh = (companyCode: string, slug: string) => revalidatePath(`/c/${companyCode}/${slug}`);

export async function createDocumentAction(categoryId: string, form: FormData) {
  const user = await requireUser();
  const anchorId = String(form.get("_anchorId") ?? "") || undefined;
  const position = form.get("_position") === "before" ? "before" : form.get("_position") === "after" ? "after" : undefined;
  return run(async () => {
    const { doc, cat } = await createDocument(user, categoryId, form, { anchorId, position });
    await audit(user, "document.create", "Document", doc.id, undefined, {
      number: doc.number, reference: doc.reference, ...(anchorId ? { inserted: position, relativeTo: anchorId } : {}),
    });
    refresh(cat.company.code, cat.slug);
    return { id: doc.id, number: doc.number, reference: doc.reference };
  });
}

export async function updateDocumentAction(id: string, form: FormData) {
  const user = await requireUser();
  return run(async () => {
    const { before, after, doc } = await updateDocument(user, id, form);
    await audit(user, "document.update", "Document", id, before as never, after as never);
    refresh(doc.company.code, doc.category.slug);
    return {};
  });
}

export async function archiveDocumentAction(id: string, archived: boolean) {
  const user = await requireUser();
  return run(async () => {
    const doc = await setArchived(user, id, archived);
    await audit(user, archived ? "document.archive" : "document.restore", "Document", id);
    refresh(doc.company.code, doc.category.slug);
    return {};
  });
}

export async function deleteDocumentAction(id: string) {
  const user = await requireUser();
  return run(async () => {
    const doc = await softDelete(user, id);
    await audit(user, "document.delete", "Document", id);
    refresh(doc.company.code, doc.category.slug);
    return {};
  });
}
