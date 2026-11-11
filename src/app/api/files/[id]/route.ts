import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { readFile } from "@/lib/services/storage";
import { getDocumentForUser } from "@/lib/services/documents";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non authentifié", { status: 401 });
  const { id } = await params;
  const att = await db.documentAttachment.findUnique({ where: { id } });
  // Même contrôle d'accès que le document parent
  if (!att || !(await getDocumentForUser(user, att.documentId))) return new Response("Introuvable", { status: 404 });
  const buf = await readFile(att.storageKey).catch(() => null);
  if (!buf) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(att.fileName)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
