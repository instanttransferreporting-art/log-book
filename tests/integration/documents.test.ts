import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/access";
import { SYSTEM_ROLES } from "@/lib/permissions";
import { createDocument, getCategoryForUser, getDocumentForUser, ServiceError, setArchived, softDelete, updateDocument } from "@/lib/services/documents";
import { queryDocuments, parseQuery } from "@/lib/services/document-query";

const run = Date.now().toString(36).toUpperCase();
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };

const mk = (roleKey: string, id: string, companyIds: string[]): CurrentUser => ({
  id, name: id, email: `${id}@t.io`, roleKey, roleName: roleKey, isSuperAdmin: roleKey === "SUPER_ADMIN",
  permissions: new Set(SYSTEM_ROLES[roleKey].permissions), companyIds,
});

let A: { id: string; code: string }, B: { id: string; code: string };
let catA: { id: string; slug: string }, catB: { id: string; slug: string };
let userA: CurrentUser, userB: CurrentUser, manager: CurrentUser, admin: CurrentUser;

beforeAll(async () => {
  const roles = await db.role.findMany();
  const rid = (k: string) => roles.find((r) => r.key === k)!.id;
  const mkCompany = async (code: string) => {
    const c = await db.company.create({ data: { code, name: `Test ${code}` } });
    const cat = await db.documentCategory.create({
      data: { companyId: c.id, name: "Factures", slug: "factures", schemas: { create: { version: 1, isPublished: true, fields: [
        { name: "docDate", label: "Date", type: "date", required: true },
        { name: "subject", label: "Objet", type: "text", required: true },
        { name: "reference", label: "Référence", type: "text", required: false },
      ] } } },
    });
    return { c, cat };
  };
  const a = await mkCompany(`TA${run}`), b = await mkCompany(`TB${run}`);
  A = a.c; B = b.c; catA = a.cat; catB = b.cat;
  const users = await Promise.all(["ua", "ub", "mg"].map((n, i) =>
    db.user.create({ data: { email: `${n}${run}@t.io`, name: n, passwordHash: "x", roleId: rid(i === 2 ? "MANAGER" : "USER") } })));
  userA = mk("USER", users[0].id, [A.id]);
  userB = mk("USER", users[1].id, [B.id]);
  manager = mk("MANAGER", users[2].id, [A.id]);
  admin = mk("SUPER_ADMIN", users[2].id, []);
});

afterAll(async () => {
  await db.document.deleteMany({ where: { companyId: { in: [A.id, B.id] } } });
  await db.company.deleteMany({ where: { id: { in: [A.id, B.id] } } });
  await db.user.deleteMany({ where: { email: { endsWith: `${run}@t.io`.toLowerCase() } } });
  await db.$disconnect();
});

describe("isolation inter-entreprises (scénario 6)", () => {
  it("un utilisateur ne voit pas les catégories d'une autre entreprise", async () => {
    expect(await getCategoryForUser(userA, A.code, catA.slug)).not.toBeNull();
    expect(await getCategoryForUser(userA, B.code, catB.slug)).toBeNull();
  });
  it("un utilisateur ne peut pas créer de document dans une autre entreprise", async () => {
    await expect(createDocument(userA, catB.id, fd({ docDate: "2026-01-01", subject: "intrusion" }))).rejects.toThrow(ServiceError);
    expect(await db.document.count({ where: { categoryId: catB.id } })).toBe(0);
  });
  it("un utilisateur ne peut ni lire, ni modifier, ni supprimer un document d'une autre entreprise", async () => {
    const { doc } = await createDocument(userB, catB.id, fd({ docDate: "2026-01-01", subject: "Secret B" }));
    expect(await getDocumentForUser(userA, doc.id)).toBeNull();
    await expect(updateDocument(manager, doc.id, fd({ docDate: "2026-01-01", subject: "piraté" }))).rejects.toThrow("Document introuvable");
    await expect(softDelete(admin, doc.id)).resolves.toBeTruthy(); // le Super Admin, lui, y a accès
  });
  it("le Super Administrateur accède à toutes les entreprises", async () => {
    expect(await getCategoryForUser(admin, B.code, catB.slug)).not.toBeNull();
  });
});

describe("permissions côté serveur", () => {
  it("un Utilisateur ne peut pas modifier, archiver ni supprimer", async () => {
    const { doc } = await createDocument(userA, catA.id, fd({ docDate: "2026-02-01", subject: "Doc A" }));
    await expect(updateDocument(userA, doc.id, fd({ docDate: "2026-02-01", subject: "x" }))).rejects.toThrow("Action non autorisée");
    await expect(setArchived(userA, doc.id, true)).rejects.toThrow("Action non autorisée");
    await expect(softDelete(manager, doc.id)).rejects.toThrow("Action non autorisée"); // Manager sans documents.delete
  });
  it("sans documents.view, aucune catégorie n'est accessible", async () => {
    const none: CurrentUser = { ...userA, permissions: new Set() };
    expect(await getCategoryForUser(none, A.code, catA.slug)).toBeNull();
  });
});

describe("création et formulaires dynamiques (scénarios 4 et 7)", () => {
  it("numérote les documents par catégorie, sans doublon sous concurrence", async () => {
    const before = await db.document.count({ where: { categoryId: catA.id } });
    const res = await Promise.all(Array.from({ length: 6 }, (_, i) => createDocument(manager, catA.id, fd({ docDate: "2026-03-01", subject: `Concurrent ${i}` }))));
    const numbers = res.map((r) => r.doc.number);
    expect(new Set(numbers).size).toBe(6);
    expect(Math.min(...numbers)).toBe(before + 1);
  });
  it("rejette les données invalides côté serveur", async () => {
    await expect(createDocument(manager, catA.id, fd({ docDate: "pas-une-date", subject: "x" }))).rejects.toThrow(ServiceError);
    await expect(createDocument(manager, catA.id, fd({ docDate: "2026-03-01" }))).rejects.toThrow("Objet est obligatoire");
  });
  it("les anciens documents gardent leur version et leurs valeurs après ajout d'un champ", async () => {
    const { doc } = await createDocument(manager, catA.id, fd({ docDate: "2026-04-01", subject: "Avant v2", reference: "R-1" }));
    const v1 = await db.formSchemaVersion.findUniqueOrThrow({ where: { categoryId_version: { categoryId: catA.id, version: 1 } } });
    await db.formSchemaVersion.create({ data: { categoryId: catA.id, version: 2, isPublished: true,
      fields: [...(v1.fields as object[]), { name: "montant", label: "Montant", type: "decimal", required: true }] } });

    const reread = await getDocumentForUser(manager, doc.id);
    expect(reread?.schemaVersionId).toBe(v1.id);
    expect((reread?.data as Record<string, unknown>).reference).toBe("R-1");

    // Modifier l'ancien document n'exige PAS le nouveau champ obligatoire
    await expect(updateDocument(manager, doc.id, fd({ docDate: "2026-04-01", subject: "Modifié", reference: "R-1" }))).resolves.toBeTruthy();
    // Un nouveau document utilise la v2 et exige le nouveau champ
    await expect(createDocument(manager, catA.id, fd({ docDate: "2026-04-02", subject: "Sans montant" }))).rejects.toThrow("Montant est obligatoire");
    const { doc: d2 } = await createDocument(manager, catA.id, fd({ docDate: "2026-04-02", subject: "Avec montant", montant: "99.9" }));
    expect((d2.data as Record<string, unknown>).montant).toBe(99.9);
  });
  it("refuse la création dans une entreprise désactivée mais garde la consultation", async () => {
    await db.company.update({ where: { id: A.id }, data: { isActive: false } });
    await expect(createDocument(manager, catA.id, fd({ docDate: "2026-05-01", subject: "x", montant: "1" }))).rejects.toThrow(ServiceError);
    expect(await getCategoryForUser(manager, A.code, catA.slug)).not.toBeNull();
    await db.company.update({ where: { id: A.id }, data: { isActive: true } });
  });
});

describe("recherche et filtres (scénario 5)", () => {
  it("retrouve par référence, par valeur dynamique, et pagine côté serveur", async () => {
    await createDocument(manager, catA.id, fd({ docDate: "2026-06-01", subject: "Recherche", reference: "ZZ-UNIQUE-77", montant: "5" }));
    const byRef = await queryDocuments(catA.id, parseQuery({ q: "zz-unique-77" }), { paginate: true });
    expect(byRef.total).toBe(1);
    const byData = await queryDocuments(catA.id, parseQuery({ q: "99.9" }), { paginate: true });
    expect(byData.total).toBeGreaterThanOrEqual(1);
    const page = await queryDocuments(catA.id, parseQuery({ size: "10", page: "1" }), { paginate: true });
    expect(page.rows.length).toBeLessThanOrEqual(10);
    expect(page.total).toBeGreaterThan(10 - 1);
  });
  it("la recherche ne déborde pas sur une autre catégorie et échappe les jokers SQL", async () => {
    const other = await queryDocuments(catB.id, parseQuery({ q: "ZZ-UNIQUE-77" }), { paginate: true });
    expect(other.total).toBe(0);
    const wildcard = await queryDocuments(catA.id, parseQuery({ q: "%" }), { paginate: true });
    expect(wildcard.total).toBe(0);
  });
});

describe("brouillons et rôle par entreprise", () => {
  it("un brouillon accepte des champs obligatoires vides, puis se publie après validation complète", async () => {
    const d = new FormData(); d.append("intent", "draft"); d.append("reference", "BR-1");
    const { doc } = await createDocument(manager, catA.id, d);
    expect(doc.status).toBe("DRAFT");
    const p = new FormData(); p.append("intent", "publish"); p.append("reference", "BR-1");
    await expect(updateDocument(manager, doc.id, p)).rejects.toThrow("est obligatoire");
    const ok = new FormData(); ok.append("intent", "publish"); ok.append("docDate", "2026-07-01"); ok.append("subject", "Complet"); ok.append("montant", "3");
    await updateDocument(manager, doc.id, ok);
    expect((await db.document.findUniqueOrThrow({ where: { id: doc.id } })).status).toBe("ACTIVE");
  });
  it("un document actif ne peut pas redevenir brouillon", async () => {
    const { doc } = await createDocument(manager, catA.id, fd({ docDate: "2026-07-02", subject: "Actif", montant: "1" }));
    await expect(updateDocument(manager, doc.id, fd({ intent: "draft", subject: "x" }))).rejects.toThrow(ServiceError);
  });
  it("le rôle propre à l'entreprise donne le droit de suppression dans cette entreprise seulement", async () => {
    const { doc } = await createDocument(manager, catA.id, fd({ docDate: "2026-07-03", subject: "À supprimer", montant: "1" }));
    await expect(softDelete(manager, doc.id)).rejects.toThrow("Action non autorisée");
    const elevated: CurrentUser = { ...manager, companyRoles: { [A.id]: new Set([...manager.permissions, "documents.delete"]) } };
    await expect(softDelete(elevated, doc.id)).resolves.toBeTruthy();
  });
});

describe("référence automatique, avant / après", () => {
  let catR: { id: string };
  const fr = (o: Record<string, string>) => fd({ docDate: "2026-11-10", issuer: "DIRECTEUR GENERAL", entity: "ORANGE CAMEROUN S A", recipient: "DIRECTEUR GENERAL", ...o });
  beforeAll(async () => {
    catR = await db.documentCategory.create({
      data: { companyId: A.id, name: "Courrier sortant", slug: "courrier-sortant", code: "CS", referenceTemplate: "N°{num}/{cat}/{issuer}/{company}/{recipient}/{entity}/{ddmm}/{yyyy}",
        schemas: { create: { version: 1, isPublished: true, fields: [
          { name: "docDate", label: "Date de sortie", type: "date", required: true },
          { name: "issuer", label: "Nom émetteur", type: "text", required: false },
          { name: "entity", label: "Entreprise", type: "text", required: false },
          { name: "recipient", label: "Nom destinataire", type: "text", required: false },
          { name: "reference", label: "Référence", type: "text", required: false },
        ] } } },
    });
  });
  it("génère la référence à partir du numéro, de la catégorie, de l'entreprise et de la date", async () => {
    const { doc } = await createDocument(manager, catR.id, fr({}));
    expect(doc.reference).toBe(`N°0001/CS/DG/${A.code}/DG/OCSA/1011/2026`);
    expect(doc.entity).toBe("ORANGE CAMEROUN S A");
  });
  it("ignore une référence saisie à la main quand un modèle est défini", async () => {
    const { doc } = await createDocument(manager, catR.id, fr({ reference: "PIRATE" }));
    expect(doc.reference).not.toContain("PIRATE");
  });
  it("créer à une date passée ou future ne renumérote ni ne casse rien : ordre de création conservé", async () => {
    const before = await db.document.findMany({ where: { categoryId: catR.id }, orderBy: { number: "asc" } });
    const past = await createDocument(manager, catR.id, fr({ docDate: "2026-03-05" }), { anchorId: before[0].id, position: "before" });
    const future = await createDocument(manager, catR.id, fr({ docDate: "2027-01-02" }), { anchorId: before[0].id, position: "after" });
    expect(past.doc.number).toBe(before.length + 1);
    expect(future.doc.number).toBe(before.length + 2);
    expect(past.doc.reference).toContain("/0503/2026");
    expect(future.doc.reference).toContain("/0201/2027");
    const after = await db.document.findMany({ where: { id: { in: before.map((b) => b.id) } }, orderBy: { number: "asc" } });
    expect(after.map((d) => d.reference)).toEqual(before.map((d) => d.reference)); // références existantes inchangées
    const refs = (await db.document.findMany({ where: { categoryId: catR.id } })).map((d) => d.reference);
    expect(new Set(refs).size).toBe(refs.length); // toutes uniques
  });
  it("refuse un document de repère d'une autre catégorie", async () => {
    const other = await db.document.findFirstOrThrow({ where: { categoryId: catA.id } });
    await expect(createDocument(manager, catR.id, fr({}), { anchorId: other.id, position: "after" })).rejects.toThrow("Document de repère introuvable");
  });
  it("la référence est figée à la modification, sauf régénération demandée", async () => {
    const { doc } = await createDocument(manager, catR.id, fr({}));
    await updateDocument(manager, doc.id, fr({ docDate: "2026-12-24", recipient: "ETOUNDI ANTOINE" }));
    expect((await db.document.findUniqueOrThrow({ where: { id: doc.id } })).reference).toBe(doc.reference);
    await updateDocument(manager, doc.id, fr({ docDate: "2026-12-24", recipient: "ETOUNDI ANTOINE", regenerateReference: "on" }));
    const re = await db.document.findUniqueOrThrow({ where: { id: doc.id } });
    expect(re.reference).toBe(`N°${String(doc.number).padStart(4, "0")}/CS/DG/${A.code}/EA/OCSA/2412/2026`);
    expect(re.number).toBe(doc.number);
  });
});

describe("audit immuable (scénario 9)", () => {
  it("interdit la modification et la suppression d'une entrée d'audit", async () => {
    const log = await db.auditLog.create({ data: { userId: manager.id, action: "test.audit", resourceType: "Test" } });
    await expect(db.auditLog.update({ where: { id: log.id }, data: { action: "falsifié" } })).rejects.toThrow();
    await expect(db.auditLog.delete({ where: { id: log.id } })).rejects.toThrow();
  });
});
