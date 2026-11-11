# PROMPT MASTER — CONCEPTION ET DÉVELOPPEMENT D'UN SYSTÈME DE LOG BOOK PROFESSIONNEL

## 1. TON RÔLE

Tu interviens en tant que **Lead Software Architect, Senior Full-Stack Engineer, Database Architect et Senior UI/UX Designer**.

Tu dois concevoir et développer une application professionnelle de gestion documentaire et de registres administratifs (Log Book), destinée à plusieurs entreprises appartenant à une même organisation.

Je ne veux pas une simple reproduction de l'application existante. Je veux une solution moderne, évolutive, sécurisée, maintenable, configurable et agréable à utiliser.

Tu dois appliquer les bonnes pratiques de l'ingénierie logicielle, notamment :

- Clean Architecture lorsque pertinente.
- Separation of Concerns.
- SOLID Principles.
- DRY et KISS.
- RBAC (Role-Based Access Control).
- Multi-tenancy.
- Database normalization.
- Type safety.
- Validation côté client et serveur.
- Audit logging.
- Automated testing.

Tu dois prendre des décisions techniques réfléchies et justifier les choix architecturaux importants.

---

## 2. CONTEXTE ET PROBLÈMES À RÉSOUDRE

L'application actuelle est un ancien système de Log Book permettant d'enregistrer différents types de documents (des correspondances) pour plusieurs entreprises.

On y retrouve notamment :

**Entreprises existantes (exemples) :**
- Instant Transfer
- Technologie Médicale
- Universal Cash
- Kamsu T. Eugénie
- Muffa MC2 Kye Ossi
- Biostar
- Finstar CD
- Finstar CM
- Fast Money Transfer
- PAYCASH
- IMMOSTAR

Il ya des rubrique documentaire pour chacun:


Chaque entreprise possède ses propres rubriques documentaires.
- Bordereau de livraison
- Contrat de partenariat
- Courrier sortant
- Courrier entrant
- Décharge de caisse courante
- Décharge matérielle
- Document Disciplinaire
- Facture definitive
- Facture pro Forma
- Lettre administrative
- Note de service
- Offre de service
- Ordre de mission
- Procédure

Exemples :

Instant Transfer :
- Bordereau de livraison
- Contrat de partenariat
- Courrier sortant
- Courrier entrant
- Décharge de caisse courante
- Décharge matérielle
...

Technologie Médicale :
- Facture pro forma
- Lettre administrative
- Note de service
- Offre de service
- Ordre de mission
- Procédure
...

Chaque rubrique dispose d'un formulaire de création et d'un tableau permettant de consulter les documents enregistrés.

### Problèmes de l'ancien système

- Interface vieillissante et peu ergonomique.
- Navigation peu intuitive.
- Configuration inexistante.
- Impossible d'ajouter une entreprise sans modifier le code source.
- Impossible de créer dynamiquement de nouvelles catégories documentaires.
- Formulaires difficilement personnalisables.
- Gestion des utilisateurs et des permissions limitée.
- Peu de possibilités de recherche et de filtrage.
- Maintenance difficile.
- Forte dépendance au développeur initial.

**La nouvelle application doit éliminer ces limitations à travers une architecture entièrement configurable.**

---

## 3. VISION DU PRODUIT

Développer une application web centralisée permettant de gérer les documents administratifs de plusieurs entreprises.

Le système doit permettre :

1. De créer et gérer plusieurs entreprises.
2. D'associer des catégories documentaires à chaque entreprise.
3. De configurer les formulaires de chaque catégorie.
4. D'enregistrer et consulter les documents.
5. De rechercher, filtrer, modifier et exporter les données.
6. De gérer les utilisateurs et leurs permissions.
7. De consulter l'historique des opérations.
8. De personnaliser les paramètres de fonctionnement.

### Principe architectural fondamental

**Aucune entreprise, catégorie documentaire ou structure de formulaire ne doit être codée en dur.**

Tout doit être pilotable depuis le panneau d'administration.

Exemple :

Un administrateur crée une entreprise appelée « Nouvelle Société ».

Il peut ensuite :
- Lui attribuer une couleur et un logo(optionel).
- Créer une catégorie « Factures ».
- Créer une catégorie « Courriers entrants ».
- Configurer les champs de chaque formulaire.
- Définir les utilisateurs autorisés à accéder à cette entreprise.
- Définir les permissions associées.

L'application génère automatiquement la navigation, les formulaires et les tableaux correspondants.

Aucune modification du code source ne doit être nécessaire pour ces opérations.

---

## 4. ARCHITECTURE FONCTIONNELLE

L'application doit être organisée autour de deux grands espaces.

### A. APPLICATION UTILISATEUR

#### 4.1. Dashboard

Créer un tableau de bord moderne présentant :

- Nombre total de documents enregistrés.
- Nombre de documents enregistrés aujourd'hui.
- Nombre de documents enregistrés cette semaine.
- Nombre d'entreprises actives.
- Nombre de catégories documentaires.
- Activité récente.
- Répartition des documents par entreprise.
- Répartition des documents par catégorie.
- Évolution des enregistrements dans le temps.

Les statistiques doivent être dynamiques et provenir de la base de données.

Prévoir des filtres temporels : aujourd'hui, cette semaine, ce mois, cette année et période personnalisée.

#### 4.2. Navigation latérale dynamique

Créer une sidebar professionnelle, moderne et intuitive.

Elle doit afficher :

- Logo et nom de l'application.
- Dashboard.
- Liste dynamique des entreprises.
- Catégories documentaires de chaque entreprise.
- Paramètres du compte.

Les entreprises doivent être présentées sous forme de groupes repliables.

Lorsqu'on développe une entreprise, ses catégories documentaires apparaissent.

Exemple :

TECHNOLOGIE MÉDICALE
- Factures pro forma
- Lettres administratives
- Notes de service
- Offres de service
- Ordres de mission

INSTANT TRANSFER
- Bordereaux de livraison
- Contrats de partenariat
- Courriers entrants
- Courriers sortants

La sidebar doit être générée automatiquement depuis la base de données.

Prévoir :
- Recherche rapide d'une entreprise ou d'une catégorie.
- Possibilité de réduire la sidebar.
- État actif clairement visible.
- Navigation responsive.
- Gestion élégante d'un grand nombre d'entreprises.

#### 4.3. Gestion des documents

Chaque catégorie documentaire doit disposer d'un espace indépendant.

Exemple : Technologie Médicale > Factures pro forma.

La page doit comporter :

**En-tête :**
- Nom de l'entreprise.
- Nom de la catégorie.
- Description éventuelle.
- Bouton d'ajout d'un document.
- Actions d'exportation.

**Zone de statistiques :**
- Nombre total de documents.
- Documents du mois.
- Documents de l'année.

**Tableau des documents :**
- Numéro d'enregistrement.
- Référence.
- Émetteur.
- Destinataire.
- Objet.
- Date.
- Utilisateur ayant effectué l'enregistrement.
- Actions.

Les colonnes doivent être configurables en fonction des champs définis dans la catégorie documentaire.

Prévoir :
- Pagination côté serveur.
- Recherche globale.
- Filtres avancés.
- Tri des colonnes.
- Sélection multiple.
- Export Excel, CSV et PDF.
- Consultation détaillée.
- Modification selon les permissions.
- Archivage.
- Suppression contrôlée.

Les tableaux doivent être agréables à utiliser, même avec plusieurs milliers d'enregistrements.

#### 4.4. Création d'un document

Créer un formulaire moderne avec une expérience utilisateur soignée.

Exemple de formulaire « Facture pro forma » :

- Date.
- Nom de l'entreprise émettrice.
- Nom de l'entreprise destinataire.
- Objet.
- Référence.

Les champs doivent être générés dynamiquement à partir de la configuration de la catégorie.

Types de champs à prendre en charge :

- Texte court.
- Texte long.
- Nombre entier.
- Nombre décimal.
- Date.
- Date et heure.
- Liste déroulante.
- Sélection multiple.
- Champ booléen.
- Email.
- Téléphone.
- Pièce jointe.
- Zone de texte enrichie si nécessaire.

Chaque champ doit pouvoir avoir :
- Un libellé.
- Un nom technique.
- Une description.
- Une valeur par défaut.
- Une indication de saisie.
- Un caractère obligatoire ou facultatif.
- Des options pour les champs de sélection.
- Un ordre d'affichage.
- Des règles de validation.

Prévoir également :
- Messages de validation explicites.
- Confirmation après enregistrement.
- Protection contre les doubles soumissions.
- Possibilité de sauvegarder un brouillon si pertinent.

**Important :** le système doit conserver la structure des documents existants même si un administrateur modifie ultérieurement la configuration d'un formulaire. Prévoir une gestion des versions de schémas de formulaires.

---

## 5. PANNEAU D'ADMINISTRATION

C'est l'une des parties les plus importantes du projet.

Créer un véritable espace d'administration indépendant de l'interface utilisateur.

Il doit être accessible uniquement aux utilisateurs autorisés.

### 5.1. Dashboard administrateur

Afficher :
- Nombre d'entreprises.
- Nombre d'utilisateurs.
- Nombre de catégories.
- Nombre total de documents.
- Activité récente.
- Statistiques globales.

### 5.2. Gestion des entreprises

Créer une page CRUD complète permettant :

- D'ajouter une entreprise.
- De modifier une entreprise.
- De désactiver ou réactiver une entreprise.
- De consulter ses informations.
- De gérer son logo.
- De définir sa couleur d'identification.
- De définir sa description.
- De gérer les utilisateurs associés.

Champs proposés :

- Nom de l'entreprise.
- Code unique.
- Description.
- Logo.
- Couleur.
- Statut.
- Date de création.

Une entreprise désactivée ne doit plus être disponible pour les nouveaux enregistrements, mais ses anciens documents doivent rester consultables selon les permissions.

### 5.3. Gestion des catégories documentaires

Créer une interface permettant de gérer les catégories de chaque entreprise.

Fonctionnalités :

- Ajouter une catégorie.
- Modifier une catégorie.
- Supprimer ou archiver une catégorie.
- Modifier son nom.
- Définir sa description.
- Choisir une icône.
- Définir son ordre d'affichage.
- Activer ou désactiver la catégorie.
- Configurer ses champs.
- Définir les permissions d'accès.

Une catégorie doit obligatoirement appartenir à une entreprise.

### 5.4. Form Builder — Constructeur de formulaires

Développer un véritable constructeur de formulaires dynamique.

L'administrateur doit pouvoir créer un formulaire sans écrire une seule ligne de code.

Exemple :

Il crée une catégorie « Ordre de mission ».

Il ajoute les champs suivants :

| Libellé | Type | Obligatoire |
|---|---|---|
| Date | Date | Oui |
| Nom de l'employé | Texte | Oui |
| Destination | Texte | Oui |
| Motif | Texte long | Oui |
| Date de départ | Date | Oui |
| Date de retour | Date | Non |
| Référence | Texte | Non |

Il peut réorganiser les champs, modifier leurs propriétés et visualiser le résultat dans un aperçu.

Le système doit automatiquement générer le formulaire de saisie correspondant.

Prévoir une architecture permettant de versionner les formulaires et de conserver la compatibilité avec les anciens enregistrements.

### 5.5. Gestion des utilisateurs

Créer un module complet de gestion des utilisateurs :

- Ajouter un utilisateur.
- Modifier ses informations.
- Activer ou désactiver son compte.
- Réinitialiser son mot de passe.
- Attribuer un rôle.
- Associer une ou plusieurs entreprises.
- Définir ses permissions.

### 5.6. Gestion des rôles et permissions

Mettre en place un RBAC propre.

Rôles proposés :

**Super Administrateur**
- Accès à toutes les entreprises.
- Gestion complète des paramètres.
- Gestion des utilisateurs.
- Gestion des rôles.
- Gestion des catégories et formulaires.
- Consultation de tous les documents.

**Administrateur**
- Gestion des entreprises qui lui sont attribuées.
- Gestion de leurs catégories.
- Gestion des utilisateurs autorisés dans son périmètre.
- Gestion des documents selon ses permissions.

**Manager**
- Consultation des documents de ses entreprises.
- Création et modification des documents.
- Accès aux statistiques autorisées.

**Utilisateur**
- Consultation des documents autorisés.
- Création de documents selon ses permissions.

Les permissions doivent être granulaires.

Exemples :
- documents.view
- documents.create
- documents.update
- documents.delete
- documents.export
- companies.view
- companies.manage
- categories.manage
- forms.manage
- users.manage
- settings.manage

Ne jamais se contenter de masquer les boutons dans le frontend. Toutes les permissions doivent être vérifiées côté serveur.

---

## 6. HISTORIQUE ET TRAÇABILITÉ

Créer un module d'audit permettant de connaître les opérations effectuées.

Pour chaque action importante, enregistrer :

- Utilisateur.
- Action effectuée.
- Type de ressource.
- Identifiant de la ressource.
- Anciennes valeurs pertinentes.
- Nouvelles valeurs pertinentes.
- Date et heure.
- Adresse IP si disponible et nécessaire.

Exemples :

- Création d'un document.
- Modification d'un document.
- Suppression ou archivage.
- Création d'une entreprise.
- Modification d'une catégorie.
- Création d'un utilisateur.
- Modification des permissions.

Les journaux d'audit doivent être protégés contre les modifications par les utilisateurs ordinaires.

---

## 7. RECHERCHE ET FILTRAGE

Créer une recherche globale permettant de retrouver rapidement un document.

La recherche doit pouvoir porter sur :
- Référence.
- Objet.
- Émetteur.
- Destinataire.
- Valeurs des champs configurés.
- Entreprise.
- Catégorie.

Prévoir des filtres combinables :

- Entreprise.
- Catégorie.
- Période.
- Utilisateur.
- Statut.
- Référence.

Les recherches doivent être optimisées côté serveur.

---

## 8. DESIGN SYSTEM ET EXPÉRIENCE UTILISATEUR

Je veux une interface digne d'un logiciel SaaS professionnel moderne.

Inspiration :
- Linear.
- Notion.
- Stripe Dashboard.
- Vercel Dashboard.
- Modern Enterprise SaaS.

Éviter absolument de reproduire le design Bootstrap ancien visible dans les captures.

### Direction artistique

- Interface minimaliste.
- Design élégant et professionnel.
- Espaces bien maîtrisés.
- Typographie moderne et lisible.
- Hiérarchie visuelle claire.
- Couleurs sobres.
- Icônes cohérentes.
- Bordures fines.
- Ombres discrètes.
- Cartes modernes.
- Tableaux élégants.

Palette suggérée :
Primary: #D4A017 (Golden Yellow)

Primary Hover: #B8860B

Secondary: #1E293B (Navy Slate)

Background: #F8FAFC

Surface: #FFFFFF

Text Primary: #0F172A

Text Secondary: #64748B

Success: #16A34A

Warning: #F59E0B

Danger: #DC2626

Border: #E2E8F0

Si tu peux ajouter un effet de glass / frosted au syteme je serai ravis

### Composants à développer

- Sidebar responsive.
- Header.
- Breadcrumbs.
- Page headers.
- Stat cards.
- Data tables.
- Search bars.
- Advanced filters.
- Dialogs.
- Drawers.
- Dropdown menus.
- Form fields.
- Empty states.
- Loading skeletons.
- Toast notifications.
- Confirmation dialogs.

Prévoir un mode sombre si cela reste cohérent avec l'architecture et le calendrier du projet.

### Responsive Design

L'application doit fonctionner correctement sur :
- Desktop.
- Laptop.
- Tablette.
- Mobile.

L'expérience desktop doit être particulièrement soignée, car l'application sera principalement utilisée dans un environnement professionnel.

L'interface doit être en français par défaut, avec une architecture permettant l'ajout d'autres langues.

---

## 9. ARCHITECTURE TECHNIQUE

Avant de choisir ou de modifier les technologies, inspecte le projet existant.

Si le repository contient déjà une architecture fonctionnelle, analyse-la et préserve les éléments pertinents.

Si le projet est vierge, privilégie une stack moderne et maintenable.

Stack de référence :

- Next.js 15+ avec App Router.
- React 19.
- TypeScript strict.
- Tailwind CSS.
- shadcn/ui.
- PostgreSQL.
- Prisma ORM.
- Auth.js ou une solution d'authentification adaptée.
- Zod pour la validation.
- React Hook Form pour les formulaires dynamiques.
- TanStack Table pour les tableaux complexes.
- Recharts pour les graphiques.
- Lucide React pour les icônes.

Pour les fichiers :
- Prévoir un stockage adapté et sécurisé.
- Ne pas stocker directement les fichiers binaires dans les tables principales.
- Contrôler les types MIME et les tailles.
- Appliquer les permissions lors du téléchargement.

Pour les exports :
- Excel.
- CSV.
- PDF.

Utiliser des bibliothèques adaptées à chaque format.

### Architecture logicielle

Séparer clairement :

- Présentation.
- Composants UI.
- Logique métier.
- Services applicatifs.
- Accès aux données.
- Validation.
- Authentification.
- Autorisation.

Éviter les composants gigantesques, les fichiers monolithiques et la duplication de code.

Les règles métier ne doivent pas être dispersées dans les composants React.

### Modèle de données

Concevoir un schéma relationnel robuste comprenant notamment :

- User.
- Role.
- Permission.
- Company.
- CompanyMembership.
- DocumentCategory.
- FormSchema.
- Document.
- DocumentAttachment.
- AuditLog.

Tu peux ajouter d'autres entités si les besoins architecturaux le justifient.

Pour les documents configurables, choisir une stratégie de stockage adaptée aux données dynamiques, par exemple JSONB pour les valeurs des champs, tout en conservant des relations SQL normalisées pour les entités principales.

Prévoir :
- Indexation des champs de recherche.
- Contraintes d'intégrité.
- Relations explicites.
- Identifiants uniques.
- Timestamps.
- Soft delete lorsque pertinent.
- Gestion des versions de formulaires.

### Multi-tenancy et sécurité

L'application doit garantir l'isolation des données entre les entreprises selon les permissions.

Un utilisateur associé à Technologie Médicale ne doit pas pouvoir accéder aux données d'Instant Transfer sans autorisation.

Les contrôles doivent être effectués côté serveur, au niveau des services et des requêtes de données.

Prévoir également :
- Protection contre les accès non autorisés.
- Validation de toutes les entrées.
- Protection des sessions.
- Gestion sécurisée des mots de passe.
- Protection contre les attaques courantes.
- Journalisation des opérations sensibles.

---

## 10. QUALITÉ ET MAINTENABILITÉ

Je veux une application que d'autres développeurs pourront reprendre et maintenir facilement.

Exigences :

- TypeScript strict.
- Code lisible et documenté lorsque nécessaire.
- Composants réutilisables.
- Services métier indépendants de l'interface.
- Gestion centralisée des erreurs.
- Pas de données fictives dans les fonctionnalités de production.
- Pas de permissions simulées.
- Pas de boutons sans fonctionnalité.
- Pas de pages purement décoratives.
- Pas de logique métier dupliquée.

Prévoir :
- Tests unitaires.
- Tests d'intégration.
- Tests des permissions.
- Tests des formulaires dynamiques.
- Tests des opérations CRUD.
- Tests des accès interentreprises.
- Tests end-to-end des parcours critiques.

Créer également :
- README complet.
- Instructions d'installation.
- Documentation des variables d'environnement.
- Documentation de la base de données.
- Instructions de déploiement.
- Données de démonstration via un système de seed.

---

## 11. MÉTHODE DE TRAVAIL ATTENDUE

Ne commence pas immédiatement à générer des dizaines de fichiers.

Travaille comme un véritable ingénieur logiciel senior.

### PHASE 1 — AUDIT ET CONCEPTION

1. Inspecter l'intégralité du repository.
2. Identifier les technologies présentes.
3. Comprendre l'architecture existante.
4. Identifier les contraintes techniques.
5. Proposer l'architecture cible.
6. Définir le modèle de données.
7. Définir les rôles et permissions.
8. Proposer une structure de dossiers.
9. Identifier les risques techniques.

Présenter un plan d'implémentation clair avant de commencer les développements importants.

### PHASE 2 — FONDATIONS

Développer :
- Configuration du projet.
- Base de données.
- Authentification.
- Gestion des rôles et permissions.
- Layout principal.
- Design system.
- Sidebar dynamique.
- Navigation.
- Dashboard.

### PHASE 3 — CONFIGURATION ADMINISTRATIVE

Développer :
- CRUD des entreprises.
- CRUD des catégories.
- Gestion des utilisateurs.
- Gestion des rôles.
- Constructeur de formulaires.
- Gestion des permissions.

Cette phase doit permettre de configurer l'application sans toucher au code.

### PHASE 4 — GESTION DOCUMENTAIRE

Développer :
- Formulaires dynamiques.
- Création des documents.
- Consultation détaillée.
- Modification.
- Archivage.
- Pièces jointes.
- Tableaux dynamiques.
- Recherche et filtres.
- Exportations.

### PHASE 5 — QUALITÉ ET FINALISATION

Développer :
- Audit logs.
- Tests.
- Optimisations.
- Gestion des erreurs.
- Responsive design.
- Documentation.
- Données de démonstration.
- Préparation au déploiement.

---

## 12. RÈGLES IMPORTANTES POUR CLAUDE CODE

1. Ne détruis jamais une fonctionnalité existante sans avoir analysé son utilité.
2. Ne remplace pas une architecture fonctionnelle sans justification.
3. Ne crée pas de fichiers inutiles.
4. Ne duplique pas les composants.
5. Ne code pas les entreprises et catégories directement dans le frontend.
6. Ne crée pas un formulaire différent codé manuellement pour chaque catégorie.
7. Les formulaires doivent être générés à partir des configurations enregistrées en base de données.
8. Ne simule jamais une persistance avec localStorage.
9. Toutes les opérations importantes doivent réellement communiquer avec la base de données.
10. Les contrôles de sécurité doivent être réalisés côté serveur.
11. Respecte les relations entre les entreprises, les catégories et les documents.
12. Prévois les migrations de base de données.
13. Vérifie le fonctionnement après chaque grande fonctionnalité.
14. Ne laisse pas de fonctionnalités critiques sous forme de TODO.
15. Si une décision technique est incertaine, analyse les alternatives et choisis la solution la plus cohérente.

Lorsque tu travailles sur une fonctionnalité, termine-la proprement avant de passer à la suivante.

Ne cherche pas simplement à produire rapidement beaucoup de code. Privilégie la qualité, la cohérence et la maintenabilité.

---

## 13. CRITÈRES DE VALIDATION FINALE

Le projet sera considéré comme réussi lorsque les scénarios suivants fonctionneront réellement :

**Scénario 1 : Création d'une entreprise**

Un Super Administrateur crée une entreprise « Nouvelle Société ».

Elle apparaît automatiquement dans la sidebar.

**Scénario 2 : Création d'une catégorie**

L'administrateur ajoute une catégorie « Factures » à cette entreprise.

La catégorie apparaît automatiquement dans son menu.

**Scénario 3 : Configuration d'un formulaire**

L'administrateur crée les champs de la catégorie « Factures » avec le Form Builder.

Le formulaire de saisie est automatiquement généré.

**Scénario 4 : Enregistrement d'un document**

Un utilisateur autorisé ouvre « Nouvelle Société > Factures », remplit le formulaire et enregistre un document.

Le document apparaît immédiatement dans le tableau correspondant.

**Scénario 5 : Recherche**

L'utilisateur recherche une référence et retrouve le document correspondant.

**Scénario 6 : Permissions**

Un utilisateur d'une entreprise ne peut pas accéder aux documents d'une autre entreprise sans autorisation.

**Scénario 7 : Modification de configuration**

L'administrateur ajoute un nouveau champ à un formulaire.

Les anciens documents restent accessibles et leurs anciennes valeurs ne sont pas perdues.

**Scénario 8 : Exportation**

Un utilisateur autorisé exporte les documents filtrés au format Excel ou PDF.

**Scénario 9 : Traçabilité**

Un administrateur consulte l'historique et identifie qui a créé ou modifié un document.

Tous ces scénarios doivent être testés.

---

## OBJECTIF FINAL

Construire un véritable logiciel professionnel de gestion documentaire multi-entreprises.

Je veux une application :
- Moderne visuellement.
- Agréable à manipuler.
- Facile à administrer.
- Entièrement configurable.
- Sécurisée.
- Évolutive.
- Performante.
- Facile à maintenir.

**La priorité absolue est la configurabilité.**

Je ne veux plus jamais dépendre d'un développeur pour ajouter une entreprise, une catégorie documentaire ou un nouveau formulaire.

L'application doit être conçue pour évoluer avec les besoins de l'organisation, sans nécessiter de modifications du code source pour les opérations de configuration courantes.

Agis comme si tu développais un produit destiné à être utilisé quotidiennement par plusieurs dizaines d'entreprises et plusieurs centaines d'utilisateurs.

Commence par la PHASE 1 : audit du repository et proposition d'architecture. Ne passe pas directement à l'implémentation sans avoir compris le projet.
