import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { CurrentUser } from "./access";

export { can, companyScope, type CurrentUser } from "./access";

/** Charge l'utilisateur, son rôle, ses permissions et les entreprises accessibles. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      memberships: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    },
  });
  if (!user || !user.isActive) return null;
  return {
    id: user.id, name: user.name, email: user.email, roleKey: user.role.key, roleName: user.role.name,
    isSuperAdmin: user.role.key === "SUPER_ADMIN",
    permissions: new Set(user.role.permissions.map((p) => p.permission.key)),
    companyIds: user.memberships.map((m) => m.companyId),
    companyRoles: Object.fromEntries(
      user.memberships.filter((m) => m.role).map((m) => [m.companyId, new Set(m.role!.permissions.map((p) => p.permission.key))]),
    ),
  };
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}
