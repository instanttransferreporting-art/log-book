import { getCurrentUser } from "@/lib/auth/session";
import { documentActivity, getDocumentDetail } from "@/lib/services/activity";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const detail = await getDocumentDetail(user, id);
  if (!detail) return Response.json({ error: "Introuvable" }, { status: 404 });
  const activity = detail.canSeeActivity ? await documentActivity(user, id) : null;
  return Response.json({ detail, activity }, { headers: { "Cache-Control": "no-store" } });
}
