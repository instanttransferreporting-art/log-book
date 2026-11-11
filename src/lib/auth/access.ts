import type { PermissionKey } from "@/lib/permissions";

/** Utilisateur courant avec ses droits. Module pur (sans next/auth) : testable sans serveur. */
export type CurrentUser = {
  id: string; name: string; email: string; roleKey: string; roleName: string;
  isSuperAdmin: boolean; permissions: Set<string>; companyIds: string[];
  /** Rôle propre à une entreprise (CompanyMembership.roleId) : remplace les permissions globales pour cette entreprise. */
  companyRoles?: Record<string, Set<string>>;
};

export function can(user: CurrentUser, perm: PermissionKey, companyId?: string) {
  if (user.isSuperAdmin) return true;
  const override = companyId ? user.companyRoles?.[companyId] : undefined;
  return (override ?? user.permissions).has(perm);
}

/** Filtre Prisma d'isolation multi-entreprises (sur le modèle Company). */
export function companyScope(user: CurrentUser) {
  return user.isSuperAdmin ? {} : { id: { in: user.companyIds } };
}
