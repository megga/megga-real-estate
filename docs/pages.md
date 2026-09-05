## Pages et routes — état au 20 juillet 2026

> **Ce document décrit ce qui EXISTE, pas ce qui était prévu.** Il remplace l'ancienne
> liste « 42 écrans MVP » (spec d'avant le pivot CRM-first), qui annonçait encore une
> HomePage, une SearchPage, un ActionBoardPage, des DocumentsPage et un tunnel
> d'onboarding client supprimés depuis — alors que `CLAUDE.md` la désigne comme source
> de vérité. Un agent qui la suivait partait sur une application qui n'existe plus.
>
> **Source** : `src/App.tsx`. En cas de doute, c'est le code qui tranche, pas ce fichier.
> Le mettre à jour quand on ajoute ou retire une route.

**71 fichiers `.tsx`** dans `src/pages/` : agent 27 · admin 19 · public 13 · dev 12 — mesuré le 05.09.2026
(`find src/pages -name '*.tsx' | wc -l`). S'y ajoutent 8 fixtures `.ts` dans `dev/`, qui ne sont pas des pages.
⚠ Il n'existe **aucun** dossier `particulier/` : il est parti avec le portail vendeur le 26.07.2026. La
ventilation précédente ne sommait donc pas seulement faux, elle ne sommait pas à son propre total —
26+17+11+5+4 = 63 pour « 62 » annoncés. ⚠ Aucune porte ne mesure ce chiffre : le remesurer à chaque ajout
ou retrait de route, sinon il se périme en silence.

---

### Périmètre

`app.megga.ch` sert **le CRM agent seul**. La vitrine marketing et la marketplace
publique vivent hors de cette application (`megga.ch`, voir `sites/megga-vitrine/`).
Les anciennes URL publiques survivent uniquement comme **redirections** — elles ne
rendent plus aucune page.

---

### 1. CRM agent — `/dashboard/*` (authentifié)

Monté sous `ProtectedRoute` → `AgentLayout`, **seul layout du CRM** (monté une fois, `App.tsx:551-554`).
Il ne peint aucun chrome : il fournit le thème, le contexte copilote, le bandeau d'usurpation, l'hôte de
recherche et la garde d'identité légale.

⚠ **Cette phrase a opposé pendant trois semaines deux layouts portant LE MÊME NOM.** Le renommage global du
16.08.2026 (`51750cda`, « plus aucun Sugar dans le code ») a réécrit `AgentSugarLayout` en `AgentLayout`
jusque dans la prose, qui ne distinguait donc plus rien, et la coquille legacy que sa seconde moitié
décrivait a depuis été retirée. Les trois routes citées comme « génération précédente » ne tiennent pas
davantage : `/dashboard/contacts/import` n'existe **nulle part** dans `src/` (seul `import-lead` subsiste),
et le détail marché comme le formulaire de bien sont des enfants de la même route que les autres.

Le chrome est porté par les **pages**, via [`CrmWorkspace`](../src/components/crm/CrmWorkspace.tsx)
(PR #1277, 04.09.2026) : barre latérale repliable `CrmSidebar` (264 px ouverte, 84 repliée) et `CrmTabsBar`
au-dessus du contenu. Mesuré le 05.09.2026 : **20 fichiers** la montent, et `CrmSidebar` n'a plus qu'un seul
importeur direct — `CrmWorkspace`. ⛔ Monter `<CrmSidebar>` en direct livre un écran sans onglets.

⚠ Le **fournisseur** d'onglets est hissé dans `AgentLayout`, la **barre** ne l'est pas, et l'asymétrie est
délibérée : le layout est le seul endroit qui ne se remonte pas à la navigation, donc le seul d'où une pile
survit à un clic ; hisser la barre l'aurait posée sur la console super-admin et sur `IdentityShell`. Pas
d'onglets sans fournisseur (bancs `/dev/*`) ni sur mobile, qui a sa propre barre.

La console super-admin porte son propre chrome (`AdminShell`) : ni barre latérale, ni onglets.

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
| `/dashboard/audit` | Journal d'audit |
| `/dashboard/rendez-vous-accueil` | Réservation de l'appel d'accueil avec l'équipe MEGGA, à la sortie du wizard d'identité. Écran passable, jamais bloquant |
| `/dashboard/settings` | Réglages (7 sections : profil, agence, notifications, intégrations, facturation, sécurité, préférences) |
| `/dashboard/market/:externalId` | Détail d'une annonce du marché (`market_listings`) |

**Redirections internes** : `/dashboard/parcours` → `/journey`, `/dashboard/visites/*`
→ `/visits/*`, `/dashboard/marche/:id` → `/market/:id`. `/dashboard/network`,
`/reseau`, `/onboarding`, `/premier-jour`, `/julien` → `/dashboard` (modules retirés).

⚠ `/dashboard/julien` figurait dans le tableau ci-dessus comme un **écran** : la page copilote a été
supprimée le 16.08.2026 (`635c563b`, mergé par #1205) et la route ne fait plus que rediriger. Le copilote
n'a qu'une surface, le dock — ouvert par le bouton rond ✦ posé à droite de la barre d'onglets par la
PR #1277, par ⌘K, depuis le pipeline et depuis le matching. ⚠ Le commentaire de `src/App.tsx:643` date la
suppression du **17** août : il a été écrit dans le commit de suppression lui-même, daté du **16** — c'est
le commentaire qui avance d'un jour.

### 2. Super-admin — `/dashboard/admin/*` (18 pages)

Surface du CRM depuis le 28.07.2026 (l'application autonome `admin.megga.ch` a été
retirée). Montée par `AdminConsoleRoute`, qui gate sur `useSuperAdminGate` et
journalise chaque entrée ; le chrome vient d'`AdminShell`, l'accent violet ne sert
que de repère de contexte.

Accueil, agences (+ détail), utilisateurs, clients finaux, **appels d'accueil**,
monitoring, **modération**,
conformité, communication, feature flags, plans, live, sécurité, NPS, autonomie,
usage des outils, apprentissage.

⚠️ `/dashboard/admin/marketplace` redirige vers `/moderation` : la page a porté le nom
du module marketplace jusqu'à son renommage, des liens le visent peut-être encore.


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
| `/rendez-vous/:token` | Gestion de l'appel d'accueil (replanifier, annuler) |

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

### 6. Routes de développement — une seule part en production

⛔ **Ce paragraphe portait cinq affirmations, dont quatre fausses** (remesuré le 05.09.2026).

`/design-system/megga-x` est la **seule** de ces routes servie sur `app.megga.ch` : déclarée en `lazy()` nu
(`App.tsx:145`), hors `ProtectedRoute`, sans authentification. Ce n'est pas un banc mais la dernière route de
design system survivante (CLAUDE.md §3), servie délibérément.

Les **onze bancs `/dev/*`** sont tous conditionnés à `import.meta.env.DEV`, remplacé par `false` au build :
la branche d'import tombe en code mort et Vite n'émet aucun chunk. Relevé dans `App.tsx` : **11 ternaires,
un seul `lazy()` nu**. Un banc livré n'est pas seulement du poids mort, c'est une surface que personne ne
teste, ouverte à qui connaît l'URL — `/dev/sentry-test` **déclenche** des erreurs Sentry.

⚠ Trois régimes de gel, qui ne donnent pas le même écran en production :

| Bancs | Ce qu'il en reste dans le bundle déployé |
|---|---|
| `/dev/matching-atelier` · `sentry-test` · `mobile` · `biens` · `contacts` · `pipeline` · `modales` · `public/*` | la route matche encore, mais son élément vaut `() => null` ⇒ page blanche, **pas** un 404 |
| `/dev/onboarding` | la `<Route>` elle-même est dans le bloc `DEV` ⇒ catch-all `path="*"` → `NotFoundPage` |
| `/dev/crm` · `/dev/admin` | branchés dans `App()` **avant** `<BrowserRouter>` (leur banc porte son propre routeur). ⚠ Invisibles à un `grep path=` : c'est ce qui les a fait manquer aux inventaires précédents |

La frontière est **syntaxique**, donc vérifiable sans construire, et
[`dev-bancs-frontiere.spec.ts`](../tests/unit/dev-bancs-frontiere.spec.ts) la garde. Pourquoi ces bancs
existent, et c'est la même raison à chaque fois : sans session, `ProtectedRoute` fait un
`window.location.replace` **absolu** vers la vitrine — on croit regarder localhost et on est en production.

⛔ `src/components/megga-x/` (**23 fichiers**) n'est **pas** un second design system qui survivrait par sa
propre vitrine : c'est la direction **unique** du CRM depuis le 10.08.2026 (PR #1194), et **90 fichiers hors
`src/pages/dev/`** l'importent. `/dev/mandate-sign` et `MandateSignModal` n'existent plus nulle part.

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
