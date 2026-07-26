## Pages et routes — état au 20 juillet 2026

> **Ce document décrit ce qui EXISTE, pas ce qui était prévu.** Il remplace l'ancienne
> liste « 42 écrans MVP » (spec d'avant le pivot CRM-first), qui annonçait encore une
> HomePage, une SearchPage, un ActionBoardPage, des DocumentsPage et un tunnel
> d'onboarding client supprimés depuis — alors que `CLAUDE.md` la désigne comme source
> de vérité. Un agent qui la suivait partait sur une application qui n'existe plus.
>
> **Source** : `src/App.tsx`. En cas de doute, c'est le code qui tranche, pas ce fichier.
> Le mettre à jour quand on ajoute ou retire une route.

**62 fichiers de pages** dans `src/pages/` : agent 26 · admin 16 · public 11 · dev 5 · particulier 4.

---

### Périmètre

`app.megga.ch` sert **le CRM agent seul**. La vitrine marketing et la marketplace
publique vivent hors de cette application (`megga.ch`, voir `sites/megga-vitrine/`).
Les anciennes URL publiques survivent uniquement comme **redirections** — elles ne
rendent plus aucune page.

---

### 1. CRM agent — `/dashboard/*` (authentifié)

Monté sous `ProtectedRoute`. Deux layouts cohabitent : `AgentSugarLayout` (chrome
courant, la majorité des routes) et `AgentLayout` (génération précédente, encore
active sur l'import de contacts, le détail marché, le formulaire de bien et tout
`/dashboard/admin/*`).

`ResponsiveRoute` aiguille desktop/mobile au niveau de l'élément de route (seuil
768 px) ; quand aucun écran mobile n'est livré, il monte le desktop des deux côtés.

| Route | Écran |
|---|---|
| `/dashboard` | Cockpit « Aujourd'hui » |
| `/dashboard/pipeline` | Pipeline v2 « Sugar Pure » : kanban teinté / liste / timeline (14 stades DB → 8 colonnes UI), célébration de signature + bento de suites, modale « Nouveau deal » plein cadre + création inline |
| `/dashboard/contacts` · `/new` · `/:id` | Liste, création, fiche contact |
| `/dashboard/contacts/import` | Import de leads |
| `/dashboard/import-lead` | Import d'un lead unitaire |
| `/dashboard/listings` · `/new` · `/:id` · `/:id/edit` | Mes biens (pager galerie + à-suivre), wizard « Créer un bien » Sugar v2 (7 étapes), fiche bien V4 (bento mono-page), formulaire d'édition |
| `/dashboard/matching` | Matching acquéreur ↔ bien (pager Atelier + Recherche) |
| `/dashboard/transactions/:id` | Fiche deal V4 « Atelier scindé » (L'acheteur ‖ L'affaire : matching lead ou négociation) |
| `/dashboard/transactions/:id/offre/:kind` | Modale d'offre |
| `/dashboard/visits/new` · `/:id` | Visite : création, détail |
| `/dashboard/calendar` | Agenda (Google / Outlook) |
| `/dashboard/journey` | Parcours client |
| `/dashboard/kyc` · `/:dossierId` | Dossiers LAB/KYC |
| `/dashboard/analytics` | Analytics et commissions |
| `/dashboard/julien` | Copilote MEGGA AI |
| `/dashboard/audit` | Journal d'audit |
| `/dashboard/settings` | Réglages (7 sections : profil, agence, notifications, intégrations, facturation, sécurité, préférences) |
| `/dashboard/market/:externalId` | Détail d'une annonce du marché (`market_listings`) |

**Redirections internes** : `/dashboard/parcours` → `/journey`, `/dashboard/visites/*`
→ `/visits/*`, `/dashboard/marche/:id` → `/market/:id`. `/dashboard/network`,
`/reseau`, `/onboarding`, `/premier-jour` → `/dashboard` (modules retirés).

### 2. Super-admin — `/dashboard/admin/*` (16 pages)

Sous `SuperAdminGuard`, accent violet : accueil, agences, détail agence, utilisateurs,
monitoring, marketplace, conformité, changelog, feature flags, plans, live, sécurité,
NPS, autonomie, usage des outils, apprentissage.


### 3. Pages publiques tokenisées

Ouvertes par un client depuis un lien e-mail, sans compte. Elles portent
`PublicPageHeader` (marque seule, sans navigation — l'ancien `HomeStickyHeader`
éjectait le client vers megga.ch à chaque lien).

| Route | Écran |
|---|---|
| `/kyc/:token` | Formulaire KYC client |
| `/kyc-report/:token` | Rendu du rapport KYC |
| `/reception/:token` | Réception acquéreur |
| `/visit/:id/edit` · `/feedback` | Gestion et retour de visite |
| `/accept-invite/:token` | Acceptation d'invitation |

### 4. Authentification

Le tunnel de connexion vit **sur la vitrine** (`megga.ch/login`). Dans l'app, seule
subsiste la tuyauterie :

| Route | Écran |
|---|---|
| `/auth/callback` | Retour OAuth / magic link ; route l'événement `PASSWORD_RECOVERY` |
| `/auth/forgot-password/reset` | Définition d'un nouveau mot de passe |
| `/reset-password` | Ancienne page de reset — aucun lien entrant dans le dépôt ⚠ |
| `/privacy` | Confidentialité (doublon de `megga.ch/confidentialite.html`) |

Toutes les autres routes `/auth/*`, `/login`, `/register` et leurs alias FR partent
vers la vitrine (`VitrineLoginRedirect`).

⚠ `/reset-password` : les deux flux vivants pointent ailleurs (l'app envoie sur
`/auth/callback?type=recovery`, la vitrine sur `megga.ch/reset-password.html`). La page
paraît morte, mais la liste des URL de redirection autorisées vit dans le **dashboard
Supabase**, hors du dépôt : aucun grep ne peut prouver qu'aucun e-mail déjà envoyé n'y
atterrit. Vérifier là-bas avant de la retirer.

### 5. Redirections hors application

- **Marketplace** → `megga.ch` : `/search`, `/buy`, `/rent`, `/acheter`, `/louer`,
  `/propriete*`, `/listing/:id`, `/about`, `/contact`, `/sell`, `/estimates`,
  `/estimate`, `/services`, `/publish`, `/agents*`, `/agencies` + alias FR.
- **Centre d'aide** → `intercom.help/megga/fr` : `/help/*` et `/aide/*`. Le corpus
  (18 articles FR+EN) vit dans Intercom ; les 12 pages SPA ont été retirées le
  20.07.2026. Un 301 au bord (`public/_redirects`) évite de charger l'app React.
- `/account` · `/compte` → `/dashboard` (compte acheteur retiré).

### 6. Routes de développement — ⚠ publiques, sans authentification

`/design-system/megga-x` (style guide MeggaX), `/dev/mandate-sign`,
`/dev/matching-atelier`, `/dev/sentry-test`, `/dev/mobile`.

Elles ne sont derrière aucune garde. `src/components/megga-x/` (15 fichiers) et
`MandateSignModal` ne sont atteignables que par elles — un second design system qui
ne sert aucun écran de production et survit par sa propre vitrine.

---

### Modules retirés (ne pas recréer sans décision produit)

| Module | Statut |
|---|---|
| Marketplace publique (`/acheter`, `/louer`, fiche bien) | Retirée juin 2026. Backend `market_listings` conservé — il sert le matching. |
| Help Center SPA (12 pages `/help/*`) | Retiré 20.07.2026 → Intercom. |
| Compte acheteur (favoris, recherches, messagerie) | Retiré. |
| Réseau inter-agences | Jamais construit ; prototype supprimé. |
| Onboarding post-login | Retiré 18.07.2026 (agence solo créée au signup). |
| 2FA | N'existe pas — malgré ce qu'affirme `docs/design-system.md`. |
| Annuaire agents/agences | Retiré ; moissonnage coupé le 20.07.2026. |
| Pages Documents / Templates | Jamais construites. |
