// Migration des catégories existantes vers le modèle « référence automatique » (idempotent).
//  - renseigne le code et le modèle de référence s'ils sont absents
//  - publie une nouvelle version du formulaire (Date, Nom émetteur, Entreprise, Nom destinataire, Objet + champs personnalisés)
//    pour les catégories dont le formulaire n'a pas encore le champ « entity ». Les documents existants gardent leur version.
import { PrismaClient } from "@prisma/client";
import { DEFAULT_FIELDS, COLUMN_FIELDS } from "../src/lib/forms/defaults";
import { categoryCodeFromName, DEFAULT_REFERENCE_TEMPLATE } from "../src/lib/reference";
import type { FormField } from "../src/lib/forms/schema";

const db = new PrismaClient();

async function main() {
  const cats = await db.documentCategory.findMany({ include: { schemas: { orderBy: { version: "desc" }, take: 1 } } });
  let updated = 0, published = 0;
  for (const c of cats) {
    const data: { code?: string; referenceTemplate?: string } = {};
    if (!c.code) data.code = categoryCodeFromName(c.name);
    if (!c.referenceTemplate) data.referenceTemplate = DEFAULT_REFERENCE_TEMPLATE;
    if (Object.keys(data).length) { await db.documentCategory.update({ where: { id: c.id }, data }); updated++; }

    const latest = c.schemas[0];
    const fields = ((latest?.fields ?? []) as unknown as FormField[]);
    if (latest && !fields.some((f) => f.name === "entity")) {
      const custom = fields.filter((f) => !COLUMN_FIELDS.includes(f.name));
      await db.formSchemaVersion.create({ data: { categoryId: c.id, version: latest.version + 1, isPublished: true, fields: [...DEFAULT_FIELDS, ...custom] as object[] } });
      published++;
    }
  }
  console.log(`Catégories : ${cats.length} — mises à jour : ${updated} — nouvelles versions de formulaire : ${published}`);
}
main().finally(() => db.$disconnect());
