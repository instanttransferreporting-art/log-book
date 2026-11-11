import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAllFailures, isLocked, recordFailure, resetFailures } from "@/lib/auth/rate-limit";
import { can, type CurrentUser } from "@/lib/auth/access";
import { resolvePeriod } from "@/lib/services/stats";
import { dictionaries, LOCALES } from "@/lib/i18n/dictionaries";
import { checkLogo } from "@/lib/services/storage";
import { parseFormData } from "@/lib/forms/validate";

describe("limitation des tentatives de connexion", () => {
  beforeEach(() => { process.env.LOGIN_MAX_ATTEMPTS = "5"; clearAllFailures(); });
  afterEach(() => { delete process.env.LOGIN_MAX_ATTEMPTS; });
  it("est désactivée par défaut : aucun blocage, même après de nombreux échecs", () => {
    delete process.env.LOGIN_MAX_ATTEMPTS;
    for (let i = 0; i < 50; i++) recordFailure("c@x.io", "ip");
    expect(isLocked("c@x.io", "ip")).toBe(false);
  });
  it("verrouille après 5 échecs puis libère après la fenêtre", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) recordFailure("a@x.io", "1.1.1.1", t0);
    expect(isLocked("a@x.io", "1.1.1.1", t0)).toBe(false);
    recordFailure("a@x.io", "1.1.1.1", t0);
    expect(isLocked("a@x.io", "1.1.1.1", t0)).toBe(true);
    expect(isLocked("A@X.io", "1.1.1.1", t0)).toBe(true); // insensible à la casse
    expect(isLocked("a@x.io", "2.2.2.2", t0)).toBe(false); // autre IP
    expect(isLocked("a@x.io", "1.1.1.1", t0 + 16 * 60_000)).toBe(false);
  });
  it("un succès remet le compteur à zéro", () => {
    for (let i = 0; i < 5; i++) recordFailure("b@x.io", "ip");
    resetFailures("b@x.io", "ip");
    expect(isLocked("b@x.io", "ip")).toBe(false);
  });
});

describe("rôle propre à une entreprise", () => {
  const base: CurrentUser = {
    id: "u", name: "U", email: "u@x.io", roleKey: "USER", roleName: "Utilisateur", isSuperAdmin: false,
    permissions: new Set(["documents.view"]), companyIds: ["A", "B"],
    companyRoles: { A: new Set(["documents.view", "documents.update", "documents.delete"]) },
  };
  it("remplace les permissions globales pour cette entreprise uniquement", () => {
    expect(can(base, "documents.delete", "A")).toBe(true);
    expect(can(base, "documents.delete", "B")).toBe(false);
    expect(can(base, "documents.delete")).toBe(false);
  });
  it("peut aussi restreindre par rapport au rôle global", () => {
    const u = { ...base, permissions: new Set(["documents.view", "documents.delete"]), companyRoles: { A: new Set(["documents.view"]) } };
    expect(can(u, "documents.delete", "A")).toBe(false);
    expect(can(u, "documents.delete", "B")).toBe(true);
  });
});

describe("périodes du dashboard", () => {
  const now = new Date(2026, 10, 11, 15, 30); // mercredi 11 novembre 2026
  it("aujourd'hui / semaine (lundi) / mois / année", () => {
    expect(resolvePeriod("today", undefined, undefined, now)).toEqual({ from: new Date(2026, 10, 11), to: new Date(2026, 10, 12) });
    expect(resolvePeriod("week", undefined, undefined, now).from).toEqual(new Date(2026, 10, 9));
    expect(resolvePeriod("month", undefined, undefined, now)).toEqual({ from: new Date(2026, 10, 1), to: new Date(2026, 11, 1) });
    expect(resolvePeriod("year", undefined, undefined, now)).toEqual({ from: new Date(2026, 0, 1), to: new Date(2027, 0, 1) });
  });
  it("période personnalisée inclusive, repli sur le mois si invalide", () => {
    expect(resolvePeriod("custom", "2026-03-01", "2026-03-31", now)).toEqual({ from: new Date(2026, 2, 1), to: new Date(2026, 3, 1) });
    expect(resolvePeriod("custom", "2026-03-31", "2026-03-01", now).from).toEqual(new Date(2026, 10, 1));
    expect(resolvePeriod("custom", "n'importe quoi", undefined, now).from).toEqual(new Date(2026, 10, 1));
  });
});

describe("i18n", () => {
  it("chaque langue a toutes les clés du français", () => {
    for (const l of LOCALES) for (const k of Object.keys(dictionaries.fr)) expect(dictionaries[l][k], `${l}:${k}`).toBeTruthy();
  });
});

describe("logo", () => {
  it("accepte PNG/JPEG/WebP, refuse SVG et fichiers trop gros", () => {
    expect(checkLogo(new File(["x"], "a.png", { type: "image/png" }))).toBeNull();
    expect(checkLogo(new File(["<svg/>"], "a.svg", { type: "image/svg+xml" }))).not.toBeNull();
    expect(checkLogo(new File([new Uint8Array(1024 * 1024 + 1)], "a.png", { type: "image/png" }))).not.toBeNull();
  });
});

describe("brouillons", () => {
  const fields = [{ name: "subject", label: "Objet", type: "text" as const, required: true }, { name: "mail", label: "Email", type: "email" as const, required: false }];
  const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };
  it("autorise les champs obligatoires vides mais valide les valeurs saisies", () => {
    expect(parseFormData(fields, fd({}), { draft: true }).ok).toBe(true);
    expect(parseFormData(fields, fd({}), { draft: false }).ok).toBe(false);
    expect(parseFormData(fields, fd({ mail: "pas-un-mail" }), { draft: true }).ok).toBe(false);
  });
});
