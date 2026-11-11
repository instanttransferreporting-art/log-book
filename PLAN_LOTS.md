# Plan de réalisation — Log Book (découpé en lots)

Projet vierge (seul CONTEXT_LOG_BOOK.md existait) → stack de référence : Next.js 15 (App Router), React 19, TypeScript strict, Tailwind, PostgreSQL + Prisma, Auth.js, Zod, React Hook Form, TanStack Table, Recharts, Lucide.

## Décisions d'architecture clés
- **Multi-tenancy** : colonne `companyId` sur Category/Document + vérification systématique dans la couche service (`lib/services/*`) via `getAccessibleCompanyIds(user)`.
- **Formulaires dynamiques** : `FormSchemaVersion` (JSON de champs, versionné, immuable une fois publié). `Document.schemaVersionId` + `Document.data` (JSONB). Un ajout de champ crée une nouvelle version ; les anciens documents gardent la leur.
- **RBAC** : `Role` ↔ `Permission` (clés `documents.view`, …) + portée par `CompanyMembership` (rôle par entreprise). Vérifications uniquement côté serveur (services / server actions / route handlers).
- **Audit** : table `AuditLog` en append-only, écrite par un helper unique `audit()`.
- **Fichiers** : stockage disque (`storage/`), métadonnées en base, téléchargement via route protégée.
- **Rien en dur** : entreprises, catégories, champs viennent de la base.

## Lots
| Lot | Contenu | Livrable vérifiable |
|---|---|---|
| **0** | Audit + architecture (ce document) | Plan validé |
| **1** | Fondations : projet Next/TS/Tailwind, Prisma schéma complet, migrations, seed (rôles, permissions, super admin, entreprises/catégories de démo), Auth.js (credentials, sessions), RBAC (`can()`), design system (tokens, glass, dark) | `npm run dev` + connexion fonctionnelle |
| **2** | Layout app : sidebar dynamique (entreprises repliables, recherche, réduction, responsive), header, breadcrumbs, dashboard avec stats DB et filtres temporels | Sidebar générée depuis la DB |
| **3** | Admin : dashboard admin, CRUD entreprises (logo, couleur, statut), CRUD catégories, utilisateurs, rôles/permissions, memberships | Scénarios 1, 2, 6 |
| **4** | Form Builder (champs, types, réordonnancement, aperçu, versions) | Scénarios 3, 7 |
| **5** | Documents : formulaire dynamique (RHF+Zod généré), création, détail, modification, archivage, pièces jointes | Scénario 4 |
| **6** | Tableaux dynamiques TanStack (pagination serveur, tri, filtres, recherche globale), exports Excel/CSV/PDF | Scénarios 5, 8 |
| **7** | Audit logs UI, tests (unitaires, permissions, inter-entreprises, E2E Playwright), perf, i18n, README, déploiement | Scénario 9 + tests verts |

Ordre d'exécution : 1 → 2 → 3 → 4 → 5 → 6 → 7, chaque lot terminé et vérifié avant le suivant.
