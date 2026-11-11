import { getCurrentUser } from "@/lib/auth/session";
import { categoryActivity } from "@/lib/services/activity";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const entries = await categoryActivity(user, id);
  if (!entries) return Response.json({ error: "Interdit" }, { status: 403 });
  return Response.json({ entries }, { headers: { "Cache-Control": "no-store" } });
}
