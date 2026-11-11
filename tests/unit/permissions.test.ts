import { describe, expect, it } from "vitest";
import { can, companyScope, type CurrentUser } from "@/lib/auth/access";
import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/permissions";

const user = (roleKey: string, companyIds: string[] = []): CurrentUser => ({
  id: "u", name: "U", email: "u@x.io", roleKey, roleName: roleKey, isSuperAdmin: roleKey === "SUPER_ADMIN",
  permissions: new Set(SYSTEM_ROLES[roleKey].permissions), companyIds,
});

describe("RBAC", () => {
  it("le Super Administrateur possède toutes les permissions", () => {
    for (const p of Object.keys(PERMISSIONS)) expect(can(user("SUPER_ADMIN"), p as never)).toBe(true);
  });
  it("l'Utilisateur ne peut ni supprimer, ni exporter, ni administrer", () => {
    const u = user("USER");
    for (const p of ["documents.delete", "documents.export", "companies.manage", "users.manage", "forms.manage", "roles.manage"] as const)
      expect(can(u, p)).toBe(false);
    expect(can(u, "documents.create")).toBe(true);
  });
  it("le Manager peut modifier et exporter mais pas administrer", () => {
    const m = user("MANAGER");
    expect(can(m, "documents.update")).toBe(true);
    expect(can(m, "documents.export")).toBe(true);
    expect(can(m, "users.manage")).toBe(false);
  });
  it("l'Administrateur ne gère ni rôles ni paramètres globaux", () => {
    const a = user("ADMIN");
    expect(can(a, "forms.manage")).toBe(true);
    expect(can(a, "roles.manage")).toBe(false);
  });
});

describe("companyScope", () => {
  it("limite aux entreprises rattachées sauf Super Administrateur", () => {
    expect(companyScope(user("USER", ["c1", "c2"]))).toEqual({ id: { in: ["c1", "c2"] } });
    expect(companyScope(user("SUPER_ADMIN"))).toEqual({});
  });
});
