import { describe, expect, it } from "vitest";
import { buildReference, categoryCodeFromName, DEFAULT_REFERENCE_TEMPLATE, initials, validateTemplate } from "@/lib/reference";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("initials", () => {
  it("reproduit les exemples de l'ancien système", () => {
    expect(initials("DIRECTEUR GENERAL")).toBe("DG");
    expect(initials("ORANGE CAMEROUN S A")).toBe("OCSA");
    expect(initials("S A A R")).toBe("SAAR");
    expect(initials("ETOUNDI ANTOINE")).toBe("EA");
    expect(initials("Direction générale")).toBe("DG");
  });
  it("mot unique : 4 premières lettres ; vide : vide", () => {
    expect(initials("Orange")).toBe("ORAN");
    expect(initials("  ")).toBe("");
    expect(initials(null)).toBe("");
  });
});

describe("categoryCodeFromName", () => {
  it("CS / CE pour les courriers, ignore les mots vides", () => {
    expect(categoryCodeFromName("Courrier sortant")).toBe("CS");
    expect(categoryCodeFromName("Courrier entrant")).toBe("CE");
    expect(categoryCodeFromName("Décharge de caisse courante")).toBe("DCC");
    expect(categoryCodeFromName("Procédure")).toBe("PRO");
  });
});

describe("buildReference", () => {
  const base = { categoryCode: "CS", companyCode: "IT", issuer: "DIRECTEUR GENERAL", entity: "ORANGE CAMEROUN S A", recipient: "DIRECTEUR GENERAL" };
  it("reproduit N°0605/CS/DG/IT/DG/OCSA/1011/2026", () => {
    // L'ancien système affiche 11/10/2026 au format mm/jj : c'est le 10 novembre → JJMM = 1011
    expect(buildReference(DEFAULT_REFERENCE_TEMPLATE, { ...base, number: 605, date: utc(2026, 11, 10) }))
      .toBe("N°0605/CS/DG/IT/DG/OCSA/1011/2026");
  });
  it("reproduit N°0604/CS/DG/IT/EA/SAAR/2810/2026", () => {
    expect(buildReference(DEFAULT_REFERENCE_TEMPLATE, { ...base, entity: "S A A R", recipient: "ETOUNDI ANTOINE", number: 604, date: utc(2026, 10, 28) }))
      .toBe("N°0604/CS/DG/IT/EA/SAAR/2810/2026");
  });
  it("la date choisie (passée ou future) détermine JJMM/année, le numéro reste séquentiel", () => {
    const past = buildReference(DEFAULT_REFERENCE_TEMPLATE, { ...base, number: 606, date: utc(2026, 3, 5) });
    const future = buildReference(DEFAULT_REFERENCE_TEMPLATE, { ...base, number: 607, date: utc(2027, 1, 2) });
    expect(past).toBe("N°0606/CS/DG/IT/DG/OCSA/0503/2026");
    expect(future).toBe("N°0607/CS/DG/IT/DG/OCSA/0201/2027");
  });
  it("supprime les segments vides au lieu de laisser « // »", () => {
    expect(buildReference(DEFAULT_REFERENCE_TEMPLATE, { number: 1, categoryCode: "CE", companyCode: "IT", date: utc(2026, 1, 9) }))
      .toBe("N°0001/CE/IT/0901/2026");
  });
});

describe("validateTemplate", () => {
  it("exige {num} et refuse les champs inconnus", () => {
    expect(validateTemplate(DEFAULT_REFERENCE_TEMPLATE)).toBeNull();
    expect(validateTemplate("{cat}/{yyyy}")).toMatch(/\{num\}/);
    expect(validateTemplate("{num}/{bidon}")).toMatch(/bidon/);
  });
});
