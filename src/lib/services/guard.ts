import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { can, requireUser, type CurrentUser } from "@/lib/auth/session";
import type { PermissionKey } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";

/** Exige une permission côté serveur. */
export async function requirePermission(perm: PermissionKey) {
  const user = await requireUser();
  if (!can(user, perm)) redirect("/?error=forbidden");
  return user;
}

/** Exige l'accès à une entreprise (super admin = toutes). */
export function assertCompanyAccess(user: CurrentUser, companyId: string) {
  if (!user.isSuperAdmin && !user.companyIds.includes(companyId)) redirect("/?error=forbidden");
}

export function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

export async function audit(
  user: CurrentUser,
  action: string,
  resourceType: string,
  resourceId: string | null,
  oldValues?: Prisma.InputJsonValue,
  newValues?: Prisma.InputJsonValue,
) {
  const h = await headers();
  await db.auditLog.create({
    data: {
      userId: user.id, action, resourceType, resourceId,
      oldValues: oldValues ?? undefined, newValues: newValues ?? undefined,
      ip: h.get("x-forwarded-for")?.split(",")[0] ?? null,
    },
  });
}

export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
