"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { fieldsSchema, type FormField } from "@/lib/forms/schema";
import { availableColumns } from "@/lib/services/document-query";
import { DEFAULT_FIELDS } from "@/lib/forms/defaults";
import { categoryCodeFromName, DEFAULT_REFERENCE_TEMPLATE, validateTemplate } from "@/lib/reference";
import { checkLogo, deleteFile, saveFile } from "@/lib/services/storage";
import { audit, assertCompanyAccess, fail, requirePermission, slugify } from "@/lib/services/guard";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide");

// ───────── Entreprises ─────────
const companySchema = z.object({
  name: z.string().min(2, "Nom trop court").max(100),
  code: z.string().min(2, "Code trop court").max(10).regex(/^[A-Za-z0-9]+$/, "Code alphanumérique uniquement"),
  description: z.string().max(500).optional(),
  color,
});

export async function createCompany(form: FormData) {
  const user = await requirePermission("companies.manage");
  if (!user.isSuperAdmin) fail("/admin/companies", "Seul un Super Administrateur peut créer une entreprise");
  const p = companySchema.safeParse({ name: str(form, "name"), code: str(form, "code").toUpperCase(), description: str(form, "description") || undefined, color: str(form, "color") || "#D4A017" });
  if (!p.success) fail("/admin/companies", p.error.issues[0].message);
  if (await db.company.findUnique({ where: { code: p.data.code } })) fail("/admin/companies", "Ce code existe déjà");
  const c = await db.company.create({ data: p.data });
  await audit(user, "company.create", "Company", c.id, undefined, p.data);
  revalidatePath("/", "layout");
  redirect(`/admin/companies/${c.id}`);
}

export async function updateCompany(id: string, form: FormData) {
  const user = await requirePermission("companies.manage");
  assertCompanyAccess(user, id);
  const path = `/admin/companies/${id}`;
  const p = companySchema.safeParse({ name: str(form, "name"), code: str(form, "code").toUpperCase(), description: str(form, "description") || undefined, color: str(form, "color") });
  if (!p.success) fail(path, p.error.issues[0].message);
  const dup = await db.company.findFirst({ where: { code: p.data.code, NOT: { id } } });
  if (dup) fail(path, "Ce code existe déjà");
  const old = await db.company.findUniqueOrThrow({ where: { id } });
  await db.company.update({ where: { id }, data: p.data });
  await audit(user, "company.update", "Company", id, { name: old.name, code: old.code, color: old.color }, p.data);
  revalidatePath("/", "layout");
  redirect(path);
}

export async function toggleCompany(id: string) {
  const user = await requirePermission("companies.manage");
  assertCompanyAccess(user, id);
  const c = await db.company.findUniqueOrThrow({ where: { id } });
  await db.company.update({ where: { id }, data: { isActive: !c.isActive } });
  await audit(user, c.isActive ? "company.deactivate" : "company.activate", "Company", id);
  revalidatePath("/", "layout");
}

// ───────── Catégories ─────────
export async function createCategory(companyId: string, form: FormData) {
  const user = await requirePermission("categories.manage");
  assertCompanyAccess(user, companyId);
  const path = `/admin/companies/${companyId}`;
  const name = str(form, "name");
  if (name.length < 2) fail(path, "Nom de catégorie trop court");
  const slug = slugify(name);
  if (await db.documentCategory.findUnique({ where: { companyId_slug: { companyId, slug } } })) fail(path, "Cette catégorie existe déjà");
  const last = await db.documentCategory.aggregate({ where: { companyId }, _max: { sortOrder: true } });
  const cat = await db.documentCategory.create({
    data: {
      companyId, name, slug, description: str(form, "description") || null,
      code: categoryCodeFromName(name), referenceTemplate: DEFAULT_REFERENCE_TEMPLATE,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
      // Schéma par défaut : modifiable ensuite via le Form Builder (Lot 4)
      schemas: { create: { version: 1, isPublished: true, fields: DEFAULT_FIELDS } },
    },
  });
  await audit(user, "category.create", "DocumentCategory", cat.id, undefined, { companyId, name });
  revalidatePath("/", "layout");
  redirect(path);
}

export async function updateCategory(id: string, form: FormData) {
  const user = await requirePermission("categories.manage");
  const cat = await db.documentCategory.findUniqueOrThrow({ where: { id } });
  assertCompanyAccess(user, cat.companyId);
  const path = `/admin/companies/${cat.companyId}`;
  const name = str(form, "name");
  const order = Number.parseInt(str(form, "sortOrder"), 10);
  if (name.length < 2) fail(path, "Nom de catégorie trop court");
  const slug = slugify(name);
  const dup = await db.documentCategory.findFirst({ where: { companyId: cat.companyId, slug, NOT: { id } } });
  if (dup) fail(path, "Ce nom existe déjà dans l'entreprise");
  const code = str(form, "code").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || null;
  const templateRaw = str(form, "referenceTemplate");
  const referenceTemplate = templateRaw || null; // vide = pas de référence automatique (saisie manuelle)
  if (referenceTemplate) { const err = validateTemplate(referenceTemplate); if (err) fail(path, err); }
  await db.documentCategory.update({ where: { id }, data: { name, slug, code, referenceTemplate, sortOrder: Number.isFinite(order) ? order : cat.sortOrder } });
  await audit(user, "category.update", "DocumentCategory", id, { name: cat.name, sortOrder: cat.sortOrder, code: cat.code, referenceTemplate: cat.referenceTemplate }, { name, sortOrder: order, code, referenceTemplate });
  revalidatePath("/", "layout");
  redirect(path);
}

export async function toggleCategoryArchive(id: string) {
  const user = await requirePermission("categories.manage");
  const cat = await db.documentCategory.findUniqueOrThrow({ where: { id } });
  assertCompanyAccess(user, cat.companyId);
  await db.documentCategory.update({ where: { id }, data: { archivedAt: cat.archivedAt ? null : new Date() } });
  await audit(user, cat.archivedAt ? "category.restore" : "category.archive", "DocumentCategory", id);
  revalidatePath("/", "layout");
}

// ───────── Utilisateurs ─────────
const userSchema = z.object({
  name: z.string().min(2, "Nom trop court"),
  email: z.string().email("Email invalide").toLowerCase(),
  roleId: z.string().min(1, "Rôle requis"),
});

async function checkRoleAssignable(user: Awaited<ReturnType<typeof requirePermission>>, roleId: string, path: string) {
  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role) fail(path, "Rôle introuvable");
  if (role.key === "SUPER_ADMIN" && !user.isSuperAdmin) fail(path, "Vous ne pouvez pas attribuer ce rôle");
}

/** Rôle propre à une entreprise (champ `role_<companyId>`) : vide = rôle global. SUPER_ADMIN non attribuable ici. */
async function companyRoleOverrides(user: Awaited<ReturnType<typeof requirePermission>>, form: FormData, companyIds: string[], path: string) {
  const out: Record<string, string | null> = {};
  for (const cid of companyIds) {
    const rid = str(form, `role_${cid}`);
    if (!rid) { out[cid] = null; continue; }
    const role = await db.role.findUnique({ where: { id: rid } });
    if (!role || role.key === "SUPER_ADMIN") fail(path, "Rôle d'entreprise invalide");
    await checkRoleAssignable(user, rid, path);
    out[cid] = rid;
  }
  return out;
}

export async function createUser(form: FormData) {
  const user = await requirePermission("users.manage");
  const path = "/admin/users";
  const p = userSchema.safeParse({ name: str(form, "name"), email: str(form, "email"), roleId: str(form, "roleId") });
  if (!p.success) fail(path, p.error.issues[0].message);
  const password = str(form, "password");
  if (password.length < 8) fail(path, "Mot de passe : 8 caractères minimum");
  if (await db.user.findUnique({ where: { email: p.data.email } })) fail(path, "Email déjà utilisé");
  await checkRoleAssignable(user, p.data.roleId, path);
  const companyIds = form.getAll("companyIds").map(String).filter((id) => user.isSuperAdmin || user.companyIds.includes(id));
  const overrides = await companyRoleOverrides(user, form, companyIds, path);
  const created = await db.user.create({
    data: { ...p.data, passwordHash: await bcrypt.hash(password, 12), memberships: { create: companyIds.map((companyId) => ({ companyId, roleId: overrides[companyId] ?? null })) } },
  });
  await audit(user, "user.create", "User", created.id, undefined, { email: p.data.email, roleId: p.data.roleId, companyIds });
  revalidatePath(path);
  redirect(path);
}

export async function updateUser(id: string, form: FormData) {
  const user = await requirePermission("users.manage");
  const path = "/admin/users";
  const target = await db.user.findUniqueOrThrow({ where: { id }, include: { memberships: true, role: true } });
  if (target.role.key === "SUPER_ADMIN" && !user.isSuperAdmin) fail(path, "Action non autorisée");
  const p = userSchema.safeParse({ name: str(form, "name"), email: str(form, "email"), roleId: str(form, "roleId") });
  if (!p.success) fail(path, p.error.issues[0].message);
  await checkRoleAssignable(user, p.data.roleId, path);
  const dup = await db.user.findFirst({ where: { email: p.data.email, NOT: { id } } });
  if (dup) fail(path, "Email déjà utilisé");

  const manageable = (cid: string) => user.isSuperAdmin || user.companyIds.includes(cid);
  const wanted = new Set(form.getAll("companyIds").map(String).filter(manageable));
  const current = target.memberships.map((m) => m.companyId);
  const toRemove = current.filter((c) => manageable(c) && !wanted.has(c));
  const toAdd = [...wanted].filter((c) => !current.includes(c));

  const newPassword = str(form, "password");
  if (newPassword && newPassword.length < 8) fail(path, "Mot de passe : 8 caractères minimum");
  const overrides = await companyRoleOverrides(user, form, [...wanted], path);
  await db.$transaction([
    ...[...wanted].filter((c) => current.includes(c)).map((c) => db.companyMembership.update({ where: { userId_companyId: { userId: id, companyId: c } }, data: { roleId: overrides[c] ?? null } })),
    db.user.update({ where: { id }, data: { ...p.data, ...(newPassword ? { passwordHash: await bcrypt.hash(newPassword, 12) } : {}) } }),
    db.companyMembership.deleteMany({ where: { userId: id, companyId: { in: toRemove } } }),
    db.companyMembership.createMany({ data: toAdd.map((companyId) => ({ userId: id, companyId, roleId: overrides[companyId] ?? null })) }),
  ]);
  await audit(user, "user.update", "User", id, { roleId: target.roleId, companyIds: current }, { roleId: p.data.roleId, added: toAdd, removed: toRemove, passwordReset: !!newPassword });
  revalidatePath(path);
  redirect(path);
}

export async function toggleUser(id: string) {
  const user = await requirePermission("users.manage");
  if (id === user.id) fail("/admin/users", "Vous ne pouvez pas désactiver votre propre compte");
  const target = await db.user.findUniqueOrThrow({ where: { id }, include: { role: true } });
  if (target.role.key === "SUPER_ADMIN" && !user.isSuperAdmin) fail("/admin/users", "Action non autorisée");
  await db.user.update({ where: { id }, data: { isActive: !target.isActive } });
  await audit(user, target.isActive ? "user.deactivate" : "user.activate", "User", id);
  revalidatePath("/admin/users");
}

// ───────── Rôles ─────────
export async function saveRolePermissions(roleId: string, form: FormData) {
  const user = await requirePermission("roles.manage");
  const role = await db.role.findUniqueOrThrow({ where: { id: roleId }, include: { permissions: { include: { permission: true } } } });
  if (role.key === "SUPER_ADMIN") fail("/admin/roles", "Le rôle Super Administrateur n'est pas modifiable");
  const keys = form.getAll("perm").map(String).filter((k) => k in PERMISSIONS);
  const perms = await db.permission.findMany({ where: { key: { in: keys } } });
  await db.$transaction([
    db.rolePermission.deleteMany({ where: { roleId } }),
    db.rolePermission.createMany({ data: perms.map((p) => ({ roleId, permissionId: p.id })) }),
  ]);
  await audit(user, "role.permissions", "Role", roleId, { permissions: role.permissions.map((p) => p.permission.key) }, { permissions: keys });
  revalidatePath("/admin/roles");
  redirect("/admin/roles?saved=1");
}

// ───────── Form Builder ─────────
export async function saveFormSchema(categoryId: string, form: FormData) {
  const user = await requirePermission("forms.manage");
  const cat = await db.documentCategory.findUniqueOrThrow({ where: { id: categoryId } });
  assertCompanyAccess(user, cat.companyId);
  const path = `/admin/companies/${cat.companyId}/forms/${categoryId}`;
  let raw: unknown;
  try { raw = JSON.parse(String(form.get("fields") ?? "[]")); } catch { fail(path, "Données invalides"); }
  const parsed = fieldsSchema.safeParse(raw);
  if (!parsed.success) fail(path, parsed.error.issues[0].message);

  const latest = await db.formSchemaVersion.findFirst({ where: { categoryId }, orderBy: { version: "desc" } });
  if (latest && JSON.stringify(latest.fields) === JSON.stringify(parsed.data)) fail(path, "Aucune modification à publier");
  // Une version publiée est immuable : on crée toujours une nouvelle version. Les documents existants gardent la leur.
  const created = await db.formSchemaVersion.create({
    data: { categoryId, version: (latest?.version ?? 0) + 1, fields: parsed.data, isPublished: true },
  });
  await audit(user, "form.publish", "FormSchemaVersion", created.id, latest ? { version: latest.version } : undefined, { version: created.version, fields: parsed.data.length });
  revalidatePath(path);
  redirect(`${path}?saved=${created.version}`);
}

// ───────── Logo d'entreprise ─────────
export async function uploadCompanyLogo(id: string, form: FormData) {
  const user = await requirePermission("companies.manage");
  assertCompanyAccess(user, id);
  const path = `/admin/companies/${id}`;
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) fail(path, "Choisissez une image");
  const err = checkLogo(file);
  if (err) fail(path, err);
  const old = await db.company.findUniqueOrThrow({ where: { id } });
  const key = await saveFile(file);
  await db.company.update({ where: { id }, data: { logoUrl: key } });
  if (old.logoUrl) await deleteFile(old.logoUrl);
  await audit(user, "company.logo", "Company", id);
  revalidatePath("/", "layout");
  redirect(path);
}

export async function removeCompanyLogo(id: string) {
  const user = await requirePermission("companies.manage");
  assertCompanyAccess(user, id);
  const old = await db.company.findUniqueOrThrow({ where: { id } });
  if (old.logoUrl) await deleteFile(old.logoUrl);
  await db.company.update({ where: { id }, data: { logoUrl: null } });
  await audit(user, "company.logo.remove", "Company", id);
  revalidatePath("/", "layout");
  redirect(`/admin/companies/${id}`);
}

// ───────── Colonnes de la liste ─────────
export async function saveListColumns(categoryId: string, form: FormData) {
  const user = await requirePermission("forms.manage");
  const cat = await db.documentCategory.findUniqueOrThrow({ where: { id: categoryId }, include: { schemas: { orderBy: { version: "desc" }, take: 1 } } });
  assertCompanyAccess(user, cat.companyId);
  const path = `/admin/companies/${cat.companyId}/forms/${categoryId}`;
  const allowed = new Set(availableColumns((cat.schemas[0]?.fields ?? []) as FormField[]).map((c) => c.key));
  const keys = form.getAll("col").map(String).filter((k) => allowed.has(k) && k !== "number");
  const reset = form.get("reset") !== null;
  await db.documentCategory.update({ where: { id: categoryId }, data: { listColumns: reset ? Prisma.DbNull : keys } });
  await audit(user, "category.listColumns", "DocumentCategory", categoryId, { listColumns: (cat.listColumns as string[] | null) ?? "défaut" }, { listColumns: reset ? "défaut" : keys });
  revalidatePath("/", "layout");
  redirect(`${path}?cols=1`);
}
