import type { FormField } from "./schema";

/** Champs de départ d'une catégorie, calqués sur l'ancien Log Book. Modifiables ensuite dans le Form Builder. */
export const DEFAULT_FIELDS: FormField[] = [
  { name: "docDate", label: "Date", type: "date", required: true },
  { name: "issuer", label: "Nom émetteur", type: "text", required: false },
  { name: "entity", label: "Entreprise", type: "text", required: false },
  { name: "recipient", label: "Nom destinataire", type: "text", required: false },
  { name: "subject", label: "Objet", type: "text", required: false },
];

/** Champs dont la valeur sert de colonne dédiée ; les autres champs restent dans `data`. */
export const COLUMN_FIELDS = ["docDate", "issuer", "entity", "recipient", "subject", "reference"];
