import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { readFile } from "@/lib/services/storage";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non authentifié", { status: 401 });
  const { id } = await params;
  if (!user.isSuperAdmin && !user.companyIds.includes(id)) return new Response("Introuvable", { status: 404 });
  const c = await db.company.findUnique({ where: { id }, select: { logoUrl: true } });
  if (!c?.logoUrl) return new Response("Introuvable", { status: 404 });
  const buf = await readFile(c.logoUrl).catch(() => null);
  if (!buf) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": TYPES[c.logoUrl.split(".").pop() ?? ""] ?? "application/octet-stream", "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
}
