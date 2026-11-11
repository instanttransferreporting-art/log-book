// Pour ajouter une langue : ajouter le code dans LOCALES, puis un dictionnaire (les clés absentes retombent sur le français).
export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

const fr: Record<string, string> = {
  "nav.dashboard": "Dashboard", "nav.admin": "Administration", "nav.search": "Rechercher…", "nav.collapse": "Réduire",
  "header.logout": "Déconnexion",
  "login.title": "Connectez-vous pour continuer", "login.email": "Email", "login.password": "Mot de passe",
  "login.submit": "Se connecter", "login.error": "Email ou mot de passe incorrect.", "login.locked": "Trop de tentatives. Réessayez dans quelques minutes.",
  "dash.title": "Dashboard", "dash.documents": "Documents", "dash.companies": "Entreprises actives", "dash.categories": "Catégories",
  "dash.recent": "Activité récente", "dash.empty": "Aucun document enregistré pour le moment.",
  "dash.byCompany": "Documents par entreprise", "dash.byCategory": "Documents par catégorie", "dash.evolution": "Évolution des enregistrements",
  "dash.period.today": "Aujourd'hui", "dash.period.week": "Cette semaine", "dash.period.month": "Ce mois", "dash.period.year": "Cette année", "dash.period.custom": "Personnalisé",
  "dash.from": "Du", "dash.to": "Au", "dash.apply": "Appliquer", "dash.noData": "Aucune donnée sur la période.",
  "theme.light": "Thème clair", "theme.dark": "Thème sombre", "theme.system": "Thème du système",
};

const en: Record<string, string> = {
  "nav.dashboard": "Dashboard", "nav.admin": "Administration", "nav.search": "Search…", "nav.collapse": "Collapse",
  "header.logout": "Sign out",
  "login.title": "Sign in to continue", "login.email": "Email", "login.password": "Password",
  "login.submit": "Sign in", "login.error": "Incorrect email or password.", "login.locked": "Too many attempts. Try again in a few minutes.",
  "dash.title": "Dashboard", "dash.documents": "Documents", "dash.companies": "Active companies", "dash.categories": "Categories",
  "dash.recent": "Recent activity", "dash.empty": "No documents recorded yet.",
  "dash.byCompany": "Documents by company", "dash.byCategory": "Documents by category", "dash.evolution": "Registrations over time",
  "dash.period.today": "Today", "dash.period.week": "This week", "dash.period.month": "This month", "dash.period.year": "This year", "dash.period.custom": "Custom",
  "dash.from": "From", "dash.to": "To", "dash.apply": "Apply", "dash.noData": "No data for this period.",
  "theme.light": "Light theme", "theme.dark": "Dark theme", "theme.system": "System theme",
};

export const dictionaries: Record<Locale, Record<string, string>> = { fr, en };
