export const PERMISSIONS = {
  "documents.view": "Consulter les documents",
  "documents.create": "Créer des documents",
  "documents.update": "Modifier des documents",
  "documents.delete": "Supprimer des documents",
  "documents.export": "Exporter des documents",
  "companies.view": "Consulter les entreprises",
  "companies.manage": "Gérer les entreprises",
  "categories.manage": "Gérer les catégories",
  "forms.manage": "Gérer les formulaires",
  "users.manage": "Gérer les utilisateurs",
  "roles.manage": "Gérer les rôles",
  "settings.manage": "Gérer les paramètres",
  "audit.view": "Consulter l'historique",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
const all = Object.keys(PERMISSIONS) as PermissionKey[];

export const SYSTEM_ROLES: Record<string, { name: string; description: string; permissions: PermissionKey[] }> = {
  SUPER_ADMIN: { name: "Super Administrateur", description: "Accès total à toutes les entreprises", permissions: all },
  ADMIN: {
    name: "Administrateur",
    description: "Gère les entreprises qui lui sont attribuées",
    permissions: all.filter((p) => !["roles.manage", "settings.manage"].includes(p)),
  },
  MANAGER: {
    name: "Manager",
    description: "Crée et modifie les documents de ses entreprises",
    permissions: ["documents.view", "documents.create", "documents.update", "documents.export", "companies.view"],
  },
  USER: {
    name: "Utilisateur",
    description: "Consulte et crée selon ses permissions",
    permissions: ["documents.view", "documents.create", "companies.view"],
  },
};
