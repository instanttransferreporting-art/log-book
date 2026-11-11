# Log Book — gestion documentaire multi-entreprises

Application web où **entreprises, catégories documentaires et formulaires sont entièrement configurables** depuis l'espace d'administration, sans toucher au code.

Stack : Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind 4 · PostgreSQL · Prisma 6 · Auth.js · Zod · exceljs · jsPDF · Vitest.

## Démarrage rapide (développement)

```bash
npm install
cp .env.example .env        # puis adapter DATABASE_URL / AUTH_SECRET
npm run db:start            # PostgreSQL embarqué local (port 5433) — terminal dédié
npm run db:migrate          # applique les migrations
npm run db:seed             # rôles, permissions, super admin, entreprises de démo
npm run dev                 # http://localhost:3000
```

Le seed crée `admin@logbook.local` (mot de passe par défaut `Admin123!`, surchargeable via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`). **À changer avant toute mise en ligne.**
En production, utilisez un vrai PostgreSQL : `npm run db:start` est réservé au développement.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL |
| `AUTH_SECRET` | Secret de signature des sessions (obligatoire en production) |
| `AUTH_TRUST_HOST` | `true` derrière un proxy |
| `STORAGE_DIR` | Dossier des pièces jointes (défaut `./storage`) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Compte créé par le seed |

## Architecture

```
src/
  app/(app)/            pages protégées : dashboard, c/[code]/[slug] (documents), admin/
  app/api/              auth, téléchargement protégé de fichiers, exports
  components/           sidebar, form-builder, dynamic-field, …
  lib/
    auth/               Auth.js, session, access.ts (can / companyScope : module pur)
    forms/              schema.ts (champs + Zod), validate.ts (validation serveur dynamique)
    services/           logique métier : documents, requêtes/recherche, stockage, guard (droits + audit)
    permissions.ts      permissions et rôles système
prisma/                 schema, migrations, seed
tests/                  unitaires + intégration (base dédiée logbook_test)
```

Choix clés :
- **Multi-tenancy** : `companyId` sur catégories et documents ; chaque service filtre par `companyScope` / `companyIds` de l'utilisateur. Les permissions sont vérifiées **côté serveur** (services, actions, routes API), jamais seulement dans l'UI.
- **Formulaires dynamiques** : `FormSchemaVersion` (JSON) est **immuable une fois publiée** ; toute modification crée une version. Chaque `Document` référence sa version d'origine et stocke ses valeurs en JSONB. Ajouter un champ ne casse donc aucun ancien document.
- **RBAC** : `Role` ↔ `Permission` (ex. `documents.view`, `forms.manage`). Rôles système : Super Administrateur, Administrateur, Manager, Utilisateur ; les permissions de chaque rôle sont éditables (hors Super Admin).
- **Audit** : table `AuditLog` en ajout seul, **protégée par un trigger PostgreSQL** (UPDATE/DELETE refusés).
- **Fichiers** : hors base (`STORAGE_DIR`), nom de stockage = UUID, types MIME et taille (10 Mo) contrôlés, téléchargement via `/api/files/[id]` avec les droits du document parent.
- **Exports** : Excel, CSV, PDF (max 10 000 lignes), neutralisation de l'injection de formules.

## Base de données

Modèles : `User`, `Role`, `Permission`, `RolePermission`, `Company`, `CompanyMembership`, `DocumentCategory`, `FormSchemaVersion`, `Document`, `DocumentAttachment`, `AuditLog`. Voir `prisma/schema.prisma`. Index sur `(companyId, categoryId, createdAt)`, `reference`, `docDate` ; unicité `(categoryId, number)` pour la numérotation.

Migrations : `npm run db:migrate` (dev) · `npx prisma migrate deploy` (production).

## Tests

```bash
npm test            # unitaires + intégration (Vitest)
npm run test:e2e    # parcours critiques dans un vrai navigateur (Playwright)
```

Nécessitent PostgreSQL démarré (`npm run db:start`). Les deux suites utilisent une base séparée `logbook_test` (créée et migrée automatiquement) ; les E2E lancent leur propre serveur sur le port 3100 (dossier `.next-e2e`) et n'interfèrent pas avec le serveur de développement. Au premier usage : `npx playwright install chromium`.

- **Vitest** : validation des formulaires dynamiques, matrice des permissions, rôle par entreprise, isolation inter-entreprises, numérotation concurrente, anciens documents après changement de formulaire, brouillons, recherche, périodes du dashboard, limitation de connexion, i18n, immuabilité de l'audit.
- **Playwright** : connexion, thème, dashboard, création entreprise → catégorie → formulaire → utilisateur (donc CRUD d'administration), saisie / brouillon / recherche / export CSV, isolation entre entreprises, historique d'audit.

## Déploiement

1. PostgreSQL géré (ou autonome) + variables d'environnement ci-dessus (`AUTH_SECRET` fort).
2. `npm ci && npx prisma migrate deploy && npx prisma db seed`
3. `npm run build && npm start` derrière un reverse proxy HTTPS.
4. Sauvegarder la base **et** `STORAGE_DIR`. Le dossier de fichiers doit être persistant (volume).
5. Changer le mot de passe du compte super admin.

## Saisie des documents (tiroirs) et référence automatique

- La **création, la consultation et la modification** se font dans un **tiroir latéral** (aucune redirection). À l'ouverture, tous les champs date sont pré-remplis avec la date du jour.
- Cliquer sur une ligne ouvre le **détail en lecture seule** (champs grisés) ; le bouton **Modifier** n'apparaît que si l'utilisateur a le droit `documents.update`.
- Colonnes du tableau calquées sur l'ancien Log Book : `#`, Référence, Date, Émetteur, Entreprise, Destinataire (+ champs configurés).
- **Avant / Après** (boutons + de chaque ligne) : créent une correspondance à une date précise. « Après » pré-remplit la date de la ligne ; « Avant » celle du document qui la précède dans le temps.
- **Référence automatique**, par catégorie, via un modèle (page Administration › entreprise › catégorie). Défaut :
  `N°{num}/{cat}/{issuer}/{company}/{recipient}/{entity}/{ddmm}/{yyyy}` → ex. `N°0605/CS/DG/IT/DG/OCSA/1011/2026`.
  Jetons : `num` (numéro d'ordre), `cat` (code de la catégorie : CS, CE…), `company` (code de l'entreprise), `issuer` / `recipient` / `entity` (initiales), `ddmm`, `dd`, `mm`, `yyyy`, `yy`. Un segment dont tous les jetons sont vides est supprimé. Modèle vide = saisie manuelle.
- **Le numéro d'ordre suit l'ordre de création**, jamais la date : créer avant / après / à une date passée ou future ne renumérote rien et ne peut pas casser une référence existante. La référence est **figée** à la modification (case « Régénérer la référence » pour la recalculer).
- **Journal d'activité** (bouton sur la page de catégorie, et section « Activité » dans chaque détail) : qui a créé / modifié / archivé / supprimé, quand, avec les valeurs avant → après. Réservé à la permission `audit.view`.

### Mise à jour d'une base existante

```bash
npm run db:migrate      # ajoute code / modèle de référence / entreprise
npm run db:backfill     # renseigne code + modèle, publie un formulaire v+1 (Date, Émetteur, Entreprise, Destinataire, Objet + champs perso)
```

## Fonctionnalités transverses

- **Thème** clair / sombre / système (bouton dans l'en-tête, mémorisé, sans flash au chargement).
- **Responsive** : menu coulissant sur mobile et tablette, tableaux à défilement horizontal avec colonnes secondaires masquées, tiroirs plein écran sur téléphone.
- **Logo** : `public/icon.png` (déclinaisons `public/logo.png`, `public/favicon-128.png`, `public/apple-icon.png`).
- **Langues** : français (défaut) et anglais pour la coque (navigation, connexion, dashboard). Ajouter une langue = un dictionnaire dans `src/lib/i18n/dictionaries.ts`.
- **Dashboard** : filtres Aujourd'hui / Semaine / Mois / Année / personnalisé, graphiques (évolution, par entreprise, par catégorie).
- **Logo d'entreprise** (PNG/JPEG/WebP, 1 Mo) affiché dans la sidebar.
- **Brouillons** : champs obligatoires non exigés tant que le document n'est pas publié.
- **Rôle par entreprise** : à l'association d'un utilisateur à une entreprise, un rôle propre peut remplacer son rôle global pour cette entreprise.
- **Connexion** : 5 échecs / 15 min par couple email+IP, puis blocage temporaire.

## Limites connues

- Seule la coque de l'interface est traduite en anglais ; l'administration, les formulaires et les messages métier restent en français.
- Le tableau est trié par numéro (ordre de création) par défaut ; trier par date est possible, mais deux documents de même date restent départagés par leur numéro (pas de position manuelle « juste avant X »).
- Limitation de connexion en mémoire du processus (instance unique) ; pas d'authentification à deux facteurs.
- Le rôle par entreprise ne s'applique qu'aux permissions documentaires ; l'espace d'administration reste régi par le rôle global.
- Pas de glisser-déposer dans le Form Builder (boutons monter / descendre).
