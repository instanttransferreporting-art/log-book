export type Change = { label: string; from: string; to: string };

const show = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
};

/** Différences lisibles entre deux jeux de valeurs (les pièces jointes sont ignorées : ce sont des identifiants). */
export function describeChanges(
  labels: Record<string, string>, before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined,
  skip: Set<string> = new Set(),
): Change[] {
  if (!before || !after) return [];
  const out: Change[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (skip.has(key)) continue;
    if (JSON.stringify(before[key] ?? null) === JSON.stringify(after[key] ?? null)) continue;
    out.push({ label: labels[key] ?? key, from: show(before[key]), to: show(after[key]) });
  }
  return out;
}

export const ACTION_LABELS: Record<string, string> = {
  "document.create": "a créé le document",
  "document.update": "a modifié le document",
  "document.archive": "a archivé le document",
  "document.restore": "a restauré le document",
  "document.delete": "a supprimé le document",
  "document.export": "a exporté les documents",
};
