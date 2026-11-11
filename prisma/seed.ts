import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, SYSTEM_ROLES } from "../src/lib/permissions";
import { DEFAULT_FIELDS } from "../src/lib/forms/defaults";
import { categoryCodeFromName, DEFAULT_REFERENCE_TEMPLATE } from "../src/lib/reference";

const db = new PrismaClient();
const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const ALL = ["Bordereau de livraison", "Contrat de partenariat", "Courrier sortant", "Courrier entrant",
  "Décharge de caisse courante", "Décharge matérielle", "Document Disciplinaire", "Facture définitive",
  "Facture pro forma", "Lettre administrative", "Note de service", "Offre de service", "Ordre de mission", "Procédure"];

const COMPANIES: { name: string; code: string; color: string; cats: string[] }[] = [
  { name: "Instant Transfer", code: "IT", color: "#D4A017", cats: ALL.slice(0, 6) },
  { name: "Technologie Médicale", code: "TM", color: "#0EA5E9", cats: ALL.slice(8, 14) },
  { name: "Universal Cash", code: "UC", color: "#16A34A", cats: ALL },
  { name: "Kamsu T. Eugénie", code: "KTE", color: "#9333EA", cats: ALL },
  { name: "Muffa MC2 Kye Ossi", code: "MMK", color: "#DC2626", cats: ALL },
  { name: "Biostar", code: "BIO", color: "#0D9488", cats: ALL },
  { name: "Finstar CD", code: "FCD", color: "#EA580C", cats: ALL },
  { name: "Finstar CM", code: "FCM", color: "#4F46E5", cats: ALL },
  { name: "Fast Money Transfer", code: "FMT", color: "#DB2777", cats: ALL },
  { name: "PAYCASH", code: "PAY", color: "#65A30D", cats: ALL },
  { name: "IMMOSTAR", code: "IMM", color: "#475569", cats: ALL },
];

async function main() {
  console.log("Seed : rôles et permissions…");
  for (const [key, label] of Object.entries(PERMISSIONS))
    await db.permission.upsert({ where: { key }, update: { label }, create: { key, label } });

  const roles: Record<string, string> = {};
  for (const [key, r] of Object.entries(SYSTEM_ROLES)) {
    const role = await db.role.upsert({
      where: { key }, update: { name: r.name, description: r.description },
      create: { key, name: r.name, description: r.description, isSystem: true },
    });
    roles[key] = role.id;
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    const perms = await db.permission.findMany({ where: { key: { in: r.permissions } } });
    await db.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@logbook.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
  await db.user.upsert({
    where: { email }, update: {},
    create: { email, name: "Super Admin", passwordHash: await bcrypt.hash(password, 12), roleId: roles.SUPER_ADMIN },
  });

  for (const c of COMPANIES) {
    const company = await db.company.upsert({
      where: { code: c.code }, update: {}, create: { name: c.name, code: c.code, color: c.color },
    });
    // En parallèle : la base distante a de la latence, du séquentiel prendrait plusieurs minutes
    await Promise.all(c.cats.map(async (name, i) => {
      const cat = await db.documentCategory.upsert({
        where: { companyId_slug: { companyId: company.id, slug: slug(name) } }, update: {},
        create: { companyId: company.id, name, slug: slug(name), sortOrder: i, code: categoryCodeFromName(name), referenceTemplate: DEFAULT_REFERENCE_TEMPLATE },
      });
      await db.formSchemaVersion.upsert({
        where: { categoryId_version: { categoryId: cat.id, version: 1 } }, update: {},
        create: { categoryId: cat.id, version: 1, fields: DEFAULT_FIELDS, isPublished: true },
      });
    }));
    console.log(`  ✓ ${c.name} (${c.cats.length} catégories)`);
  }
  console.log(`Seed OK — admin: ${email} / ${password}`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
