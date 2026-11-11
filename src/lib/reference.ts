/**
 * Référence automatique d'un document, ex. N°0605/CS/DG/IT/DG/OCSA/1011/2026
 *   N°{num}/{cat}/{issuer}/{company}/{recipient}/{entity}/{ddmm}/{yyyy}
 *
 * Le numéro d'ordre {num} est attribué à la création (jamais d'après la date) : insérer un courrier
 * « avant » ou « après » un autre, ou à une date passée, ne renumérote donc jamais l'existant.
 */
export const DEFAULT_REFERENCE_TEMPLATE = "N°{num}/{cat}/{issuer}/{company}/{recipient}/{entity}/{ddmm}/{yyyy}";

export const REFERENCE_TOKENS: Record<string, string> = {
  num: "Numéro d'ordre (4 chiffres)", cat: "Code de la catégorie (CS, CE…)", company: "Code de l'entreprise du groupe",
  issuer: "Initiales de l'émetteur", recipient: "Initiales du destinataire", entity: "Initiales de l'entreprise tierce",
  ddmm: "Jour + mois (JJMM)", dd: "Jour", mm: "Mois", yyyy: "Année", yy: "Année (2 chiffres)",
};

const STOP_WORDS = new Set(["de", "du", "des", "la", "le", "les", "d", "l", "et", "a", "au", "aux"]);
const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Initiales : « DIRECTEUR GENERAL » → DG ; « S A A R » → SAAR ; mot unique → ses 4 premières lettres. */
export function initials(value: string | null | undefined): string {
  const words = strip(value ?? "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 4);
  return words.map((w) => w[0]).join("");
}

/** Code de catégorie par défaut : initiales des mots significatifs (« Courrier sortant » → CS). */
export function categoryCodeFromName(name: string): string {
  const words = strip(name).toUpperCase().split(/[^A-Z0-9]+/).filter((w) => w && !STOP_WORDS.has(w.toLowerCase()));
  return (words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 3)).slice(0, 6);
}

export type ReferenceContext = {
  number: number; categoryCode?: string | null; companyCode?: string | null;
  issuer?: string | null; recipient?: string | null; entity?: string | null;
  date?: Date | null; // date du document, interprétée en UTC
};

export function buildReference(template: string, c: ReferenceContext): string {
  const d = c.date ?? null;
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  const values: Record<string, string> = {
    num: pad(c.number, 4),
    cat: (c.categoryCode ?? "").toUpperCase(),
    company: (c.companyCode ?? "").toUpperCase(),
    issuer: initials(c.issuer), recipient: initials(c.recipient), entity: initials(c.entity),
    dd: d ? pad(d.getUTCDate()) : "", mm: d ? pad(d.getUTCMonth() + 1) : "",
    ddmm: d ? pad(d.getUTCDate()) + pad(d.getUTCMonth() + 1) : "",
    yyyy: d ? String(d.getUTCFullYear()) : "", yy: d ? String(d.getUTCFullYear()).slice(-2) : "",
  };
  // Un segment (entre « / ») dont tous les champs sont vides est supprimé : pas de « // » dans la référence.
  return template.split("/").flatMap((segment) => {
    const tokens = [...segment.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (tokens.length && tokens.every((t) => !(values[t] ?? ""))) return [];
    return [segment.replace(/\{(\w+)\}/g, (_, t: string) => values[t] ?? "")];
  }).join("/");
}

/** Vérifie un modèle saisi par un administrateur. Retourne un message d'erreur ou null. */
export function validateTemplate(template: string): string | null {
  if (template.length > 200) return "Modèle de référence trop long";
  const unknown = [...template.matchAll(/\{(\w*)\}/g)].map((m) => m[1]).filter((t) => !(t in REFERENCE_TOKENS));
  if (unknown.length) return `Champ inconnu dans le modèle : {${unknown[0]}}`;
  if (!template.includes("{num}")) return "Le modèle doit contenir {num} (numéro d'ordre) pour rester unique";
  return null;
}
