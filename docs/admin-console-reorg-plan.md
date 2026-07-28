# Console super-admin — audit complet & plan de réorganisation

> **Généré le 28.07.2026** (audit Fable 5 : 4 agents de lecture + vérifications directes
> code, prod HTTP et base Supabase). **À exécuter par Opus, phase par phase — 1 phase = 1 PR,
> dans l'ordre.** Ce fichier est le contrat d'exécution ; il est supprimé en phase F.
>
> Toute affirmation `fichier:ligne` ci-dessous a été vérifiée sur la branche
> `claude/crm-admin-console-audit-234c20` (base = main `7df2448a`). Les lignes bougeront
> avec les premières PRs : re-greper avant d'éditer.

---

## 0. État des lieux (vérifié, ne pas re-déduire)

**Architecture actuelle.** La console est une **surface du CRM** montée sous
`/dashboard/admin/*` depuis le 28.07.2026 (commits `fc607078` → `a90839b0`, 12:05–15:17) :
`src/App.tsx:453` → `AdminConsoleRoute` (gate `useSuperAdminGate` + audit
`admin_log_console_entry`) → `AdminThemeProvider` → `AdminConsoleRoutes` (17 pages lazy) →
`AdminShell` (chrome Sugar : cadre pager rayon 26, rail 300 px, accent violet réservé au
repère de contexte). L'app autonome `admin.megga.ch` est **retirée** (projet Pages et DNS
supprimés — vérifié : HTTP 000, 0 réponse). Entrées CRM : dropdown profil Sugar
(`SugarProfileDropdown.tsx:229`) + ⌘K (`CrmSugarSearch.tsx:326,548`), gatées
`useSuperAdminGate`.

**Volumétrie.** 17 pages (`src/pages/admin/`), 27 composants (`src/components/admin/` dont
`kit/` 3 fichiers), 24 hooks, ~14,4k LOC hors i18n, namespace i18n `admin` complet en
4 langues. Côté données : 15 tables, ~30 RPC, 7 edge functions, 2 canaux realtime
(conformes `useId()` + cleanup).

**Ce qui est SAIN — ne pas y toucher :**
- Le modèle de sécurité : gate UX (`useSuperAdminGate`, rôle d'abord, RPC `is_super_admin`
  en retrait seulement) + mur réel en DB (91 gardes `is_super_admin()` sur les RPC,
  allowlist e-mail en dur lue dans `auth.users`) + edges gardées
  `_shared/require-super-admin.ts` (Bearer → rôle → `super_admin_allowlist_match`,
  vérifiée existante en prod). RLS actif sur les 8 tables admin. Advisors : rien de neuf
  (seul ERROR = `spatial_ref_sys` PostGIS, ACCEPTÉ — ne pas « re-fixer »).
- Le kit est massivement adopté : `AdminPage` dans les 17 pages, `AdminCard` ×32,
  `AdminSkeleton` ×28, `AdminEmpty` ×27, `AdminPill` ×24… **Zéro orphelin** parmi les
  27 composants et 24 hooks. Zéro `any`, zéro `bg-white`/`text-gray-*`/hex sauvage.
- Les tests sont déjà migrés au nouveau monde : `playwright.admin.config.ts` lance
  `npm run dev -- --port 5174` (plus de `dev:admin`), `tests/e2e-admin/admin-coverage.spec.ts`
  visite les 17 routes `/dashboard/admin/*` avec gardes anti-redirect. 8 specs backend
  admin vivantes. `deploy-admin.yml`, `vite.admin.config.ts`, `index.admin.html`,
  `AdminApp.tsx`, `main.admin.tsx` : tous supprimés proprement.
- L'audit d'ouverture fonctionne en prod (`admin_console_entered`, dernier event 28.07
  13:42 UTC) ; l'impersonation reste audit-first (`admin_log_impersonation` bloquante).
- ⛔ **Décisions passées à ne PAS reproposer** : pas de Cloudflare Access devant la console
  (posé puis retiré — et le domaine n'existe plus) ; pas de 2FA (retiré #873, assumé) ;
  pas de résidence EU DeepSeek ; `src/lib/` et `src/hooks/` restent PLATS.

**La fusion du 28.07 est propre côté backend/CI mais inachevée côté frontend/edge web** :
c'est l'objet des phases A et B.

---

## 1. Constats classés

### P0 — la console est cassée en production (2 causes indépendantes)

**P0-1 · Redirect edge fantôme.** `public/_redirects:55-60` contient encore
`/dashboard/admin → https://admin.megga.ch/ 302` (+ splat), posé à l'isolation, jamais
retiré à la fusion. Évalué AU BORD avant le fallback SPA ⇒ en prod, **tout accès direct,
F5, favori ou lien profond sur la console 302 vers un domaine qui ne résout plus**
(mesuré : `curl app.megga.ch/dashboard/admin` → 302 → HTTP 000). Seule la navigation
interne React Router fonctionne. Angle mort : le dev server Vite ignore `_redirects`,
donc la suite e2e-admin est verte pendant que la prod est morte.

**P0-2 · Liens internes restés absolus (ère « routes à la racine »).** Le rail préfixe
`ADMIN_CONSOLE_PATH` (`AdminShell.tsx:150`) mais **aucune page ne le fait**
(vérifié : 0 import dans `src/pages/admin/`). Conséquences en l'état :
- clic sur une ligne d'agence ⇒ 404 (`AdminAgenciesPage.tsx:306` et `:351` → `/agencies/:id`) ;
- bouton « Retour » de la fiche agence ⇒ `/agencies` ⇒ `MarketplaceDisabledRedirect`
  (`App.tsx:383`) ⇒ **éjection hors du CRM vers la vitrine** (`AdminAgencyDetailPage.tsx:118`) ;
- lien agence du tableau users ⇒ 404 (`AdminUsersPage.tsx:325`) ; idem `UserDrawer.tsx:180`
  et `AgencyUsageOverview.tsx:91` ;
- **toute sélection dans la recherche ⌘K de la console** ⇒ 404
  (`useAdminSearch.ts:47/54/61` : `/agencies/:id`, `/users`, `/marketplace`) ;
- redirection post-création d'agence ⇒ 404 (`CreateAgencyModal.tsx:44`).

### P1 — vestiges actifs & écrans qui mentent

1. **Impersonation inter-origines obsolète** : `openImpersonationInCrm`
   (`src/lib/adminEntry.ts:37-40`) fait `window.open('https://app.megga.ch/...')` alors que
   console et CRM partagent la même origine ; **depuis un dev local sans `VITE_APP_URL`,
   ça ouvre la PROD**. Docstrings « les deux applications ne partagent NI localStorage NI
   cookies » fausses (adminEntry.ts:29-35, ImpersonationHandoff.tsx:4-10, UserDrawer.tsx:230-232,
   AdminAgencyDetailPage.tsx:324-326, AdminShell.tsx:175, AdminThemeProvider.tsx:14).
2. **Commentaires de sécurité mensongers (AAL2)** : 8 fichiers edge prétendent que la garde
   exige l'AAL2 ; ni `require-super-admin.ts` ni `is_super_admin()` SQL ne le font (2FA
   retiré #873 — vérifié, 0 check dans le code) : `admin-stripe-metrics/index.ts:16`,
   `admin-monitoring/index.ts:44`, `admin-user-lifecycle/index.ts:14`,
   `admin-dsar-export/index.ts:14`, `delete-account/index.ts:62`,
   `backfill-cf-images/index.ts:56`, `audit-pdf-export/index.ts:17,269`,
   `ai-billing-monitor/index.ts:79`.
3. **« Claude » affiché dans l'UI** (interdit par CLAUDE.md, et Anthropic retiré du runtime
   #829) : 2 tuiles + 1 série de graphe mortes-à-zéro dans `AdminMonitoringPage.tsx:328-339,354,373-374`,
   branches `provider?.startsWith('claude')` dans `useAIBilling.ts:80,111`.
4. **« Portail vendeur » encore vendu dans la grille des plans** (module supprimé 26.07) :
   `src/lib/plans.ts:40/60/80`, affiché par AdminPlansPage.
5. **`ticket_created`** mappé dans AdminDashboardPage:33/41/53 — le support maison est
   retiré, l'événement n'est plus jamais émis.
6. **Audit d'ouverture dégradé par la fusion** : `adminConsoleAudit.ts:13` dédoublonne par
   **chargement de page** (flag module-scope). En SPA, entrer/sortir/re-entrer dans la
   console sans F5 n'est plus journalisé — la granularité voulue est « une entrée de
   console = une ligne ».
7. **Écrans qui mentent** : badge « temps réel » sur un polling 30 s (`ActivityLog.tsx:99`) ;
   bento « Alertes » du dashboard = 10 derniers events **toutes actions confondues**
   (`useAdminStats.ts:61-73`) ; `WeeklyReportPreview.tsx:27-32` affiche « envoyé ✓ » même
   sur échec (l'`error` d'invoke n'est jamais lu).

### P2 — robustesse (erreurs, perf, base)

8. **États d'erreur absents de 12 pages sur 17** : un échec réseau se déguise en état vide.
   Manquants : Compliance, SecurityAudit, Plans, FeatureFlags, Nps, Changelog (lot produit) ;
   Dashboard, Agencies, AgencyDetail, Users (liste), Marketplace, LiveFeed (lot cœur).
   Complets et à imiter : Learning, ToolUsage, Autonomy (+ AiCosts). Le kit a déjà
   `AdminError` (7 usages).
9. **Erreurs avalées** : `useAdminSearch.ts:35-39` (`.error` jamais lu + pas d'abort →
   résultats fantômes/course) ; `useAdminAgencies.ts:46`, `useAdminUsers.ts:41`,
   `useAdminCompliance.ts:46-53`, `useAdminModeration.ts:48`, `useAdminMonitoring.ts:98`
   (repli silencieux 0/« Inconnu »/« unknown »). Mutations sans feedback d'échec :
   `useFeatureFlags` (aucun onError), changelog/annonces (pas de toast).
10. **Destructif sans garde-fou** : suppression d'une entrée changelog
    (`AdminChangelogPage.tsx:162`) et d'une annonce (`AnnouncementsTab.tsx:130`) **sans
    confirmation** ; boutons destructifs `opacity-0 group-hover:opacity-100` invisibles au
    clavier (`AdminChangelogPage.tsx:164`, `AnnouncementsTab.tsx:112`,
    `AdminAgencyDetailPage.tsx:328`) ; `window.confirm`/`window.prompt` natifs pour
    suspendre/supprimer un compte (`UserDrawer.tsx:265,299`) alors que la modale Sugar
    existe (`ModerationActionDialog`).
11. **Perf** : `count: 'exact'` sur `market_listings` ~90k dans
    `AdminMonitoringPage.tsx:59` + tri `last_seen_at DESC` sans index partiel couvrant
    (`:60`) — violation CLAUDE.md §7 côté page ; **9× `count:'exact'` dont 2 sur
    market_listings, exécutés toutes les heures** par l'edge `admin-monitoring`
    (`index.ts:112-113` et alentours) ; requête **morte** `platform_metrics` 7 j à chaque
    montage du monitoring (`useAdminMonitoring.ts:163-176`, `metricsHistory` jamais
    destructuré) ; non-bornés : `properties` avec colonne `photos`
    (`useAdminModeration.ts:39-43`), `properties`/`transactions` par agence
    (`useAdminAgencies.ts:135-158`), `kyc_cases` entier (`useAdminCompliance.ts:38`),
    `admin_nps_responses` entier (`useAdminNps.ts:49`) ; LiveFeed invalide à chaque INSERT
    sans debounce (`useAdminLiveFeed.ts:53-55`).
12. **Base** : table `admin_notes` orpheline (baseline:3089, **0 ligne** vérifié, 0 usage
    code) ; RPC `get_admin_support_stats` orpheline (support retiré ; seul « appelant » =
    `types/database.ts:5586`) ; `platform_metrics` **sans rétention** (27 675 lignes
    depuis le 16.04, +~11/h pour toujours) ; 10 casts `as unknown as` dans 8 hooks parce
    que les types Supabase générés ne connaissent pas ~6 RPC récentes.

### P3 — cohérence, i18n, a11y, nommage

13. **Duplication → kit** (sites précis dans les rapports, résumé) : bloc pagination ~60 l.
    ×5 (Agencies:427-496, Users:356-434, Marketplace:384-466, Compliance:509-556,
    SecurityAudit:449-496) ; champ recherche à loupe ×6 ; pilules de filtre segmentées ×9
    (une seule extraite : `StatusPills` d'EndUsers) ; bandeau info/erreur ×3 ; voile
    modal rgba+blur ×4 (AdminShell:323, AdminSearchDialog:83, AgencyQuotaForm:93,
    UserDrawer:120) ; champ « surface creuse + liseré inset » ×6 ; `initialsOf` ×3 ;
    `SkeletonRows` ×3 ; tuile KPI ×3 variantes (AdminStat kit / HealthTile Monitoring:584-615 /
    OpsStat AdminOpsPanels:47-60) + `AdminKpiCard` = adaptateur d'AdminStat (prop `compact`
    sans effet) ; trio filtered/safePage/paginated copié ×3 (→ `useClientPagination`) ;
    hairline recalculée à la main ×4 ; deux dropdowns à voile dont un Échap mort
    (`AdminPlansPage.tsx:112` — le pattern correct est celui de FeatureFlags:54-59) ;
    logique seuils CapCell (AgencyUsageOverview:20) vs QuotaBar (AgencyUsagePanel:36).
14. **Incohérences 2-façons-de-faire** : clés React Query `'admin-*'` vs `['admin','…']` ;
    préfixe i18n `admin:` vs clés nues (les DEUX mélangés dans AdminPlansPage) ; 4 façons
    de formater les dates dont 3 figées en `fr` quel que soit l'UI (SecurityAudit:19/66,
    ToolUsage:142 `'fr-CH'`, `formatRelativeDate` utils.ts:73) ; export CSV traduit
    (SecurityAudit) vs clés brutes FR (Compliance:317, Agencies:225-229) ; « tableau » =
    vraie `<table>` (majorité) vs div-grid de `<Link>` (Agencies:330-425 — avec `<button>`
    imbriqué dans `<Link>`, HTML invalide :410-422) vs piles flex (SecurityAudit) ;
    3 patterns de révélation d'action au clavier dont 2 cassés — le bon est
    `:focus-within` (Marketplace:190) ; `PageTransition` sur 2 pages seulement (Users:117,
    Marketplace) ; « temps réel » vrai (LiveFeed) vs badge mensonger (ActivityLog).
15. **i18n** : AdminMonitoringPage = pire page — bloc Flatfox FR en dur (:206-221),
    section IA FR en dur (:294-346), 3 clés absentes couvertes par `defaultValue` FR
    (:121-124, :237 ⇒ français affiché en DE/EN/IT) ; `AUDIT_ACTION_LABELS` FR sans
    accents en dur (`useSecurityAudit.ts:47-67`) + aria-labels FR en dur (:458,489) ;
    fuites ponctuelles (NPS tooltip `etoile` :182, pluriel `reponse{s}` :215 ; pluriel
    « agent(s) » Agencies:316 ; « Aujourd'hui » BillingDashboard:197 ; replis 'Inconnu',
    'Utilisateur', 'Agence'/'Bien') ; libellés de `PLANS` entiers en FR dur (plans.ts) ;
    clés des inboxes end-users restées sous `marketplace.*` ; **~50 clés mortes ×4 langues**
    (blocs `support.*` et `notifications.*` d'admin.json).
16. **A11y** : boutons destructifs invisibles au clavier (cf. P2-10) ; ligne agence
    focusable mais bouton focusé invisible (`AdminAgenciesPage:240-244` vs le pattern
    correct Marketplace) ; `role="listbox"` sans `role="option"` (Plans:115,
    FeatureFlags:101) ; Échap mort (Plans:112) ; `<label>` sans `htmlFor`
    (Changelog:183/211/223) ; dépliables sans `aria-expanded` (LiveFeed:169-181,
    Compliance chevrons OK par aria-label) ; onglets sans `aria-pressed`/`role="tab"`
    (Compliance:357, AgencyDetail:146-177) ; actions de modération **absentes du mobile**
    (Marketplace:261-292) ; champ traits sans label (Learning:177) ; `title` seul sans
    `aria-label` (Marketplace:355-374) ; `height: 100vh` au lieu de `100dvh`
    (AdminShell:263).
17. **Nommage** : `AdminChangelogPage.tsx` exporte `AdminCommunicationPage` (:33) ;
    `AdminOpsPanels` → 3 exports sans rapport avec le nom de fichier ;
    `AdminModerationInbox` → `{SellerLeadsInbox, ContactMessagesInbox}` ;
    hooks sans préfixe admin (`useActivityLog`, `useAgencyInvoices`, `useOnboardingTracker`,
    `useRealtimeHealth`) + `useAnnouncementsAdmin` inversé ; page/route « marketplace »
    alors qu'elle modère les biens CRM `properties` (la marketplace publique n'existe plus) ;
    icônes de nav dupliquées (users ×2, broadcast ×2, shield ×2, sparkle ×3 —
    AdminShell:68-94).
18. **Thème** : `AdminThemeProvider` ne restaure pas `data-theme` au démontage — retour au
    CRM en navigation interne = attribut de la console qui colle jusqu'au prochain effect
    du provider CRM (les deux clés de thème ne sont pas liées).
19. **Docs/cerveau périmés** (routine CLAUDE.md obligatoire) : CLAUDE.md §8 (app séparée,
    build:admin, megga-admin — tout faux) ; `docs/system-map.md` :62 (« portail vendeur »
    dans le résumé), :97-114 (console isolée), :161 (tableau : AdminAuthGate, jetons en
    fragment, routes racine), :379-387 (dev:admin/build:admin/deploy-admin.yml) ;
    `docs/pages.md` :12/30/60-64 (« 16 pages », `SuperAdminGuard`, `AgentLayout` sur
    /dashboard/admin, liste sans end-users) ; en-tête d'`admin-console.css` (« les 16 pages
    en classes sémantiques » — les 17 pages sont en styles inline Sugar désormais ; la
    feuille sert le focus ring WCAG, scrollbars, placeholder et `.adm-ghost`/`.adm-row`
    utilisés par 3 pages) ; commentaires « tickets de support » (useAdminSearch.ts:2,
    AdminSearchDialog.tsx:3) ; seed cerveau `.claude-flow/knowledge/megga-memory.seed.json`
    (nœuds `super-admin`, `audiences`, `dev-ci`).

---

## 2. Plan d'exécution — 6 PRs séquentielles

> Chaque PR : branche depuis main à jour, gates verts AVANT push (voir §4), merge, puis
> vérifier le déploiement réel avant d'attaquer la suivante. Ne PAS empiler les PRs.

### PR A — Hotfix : rendre la console joignable en prod (≈ 1 h, à merger en premier)

1. **`public/_redirects`** : supprimer le bloc lignes 55-60 (commentaire + 2 règles
   `admin.megga.ch`). Le fallback SPA `/*  /index.html  200` suffit.
2. **Re-préfixer les 10 liens absolus** avec `ADMIN_CONSOLE_PATH` (import depuis
   `@/lib/adminEntry`) : `AdminAgenciesPage.tsx:306,351` · `AdminAgencyDetailPage.tsx:118` ·
   `AdminUsersPage.tsx:325` · `UserDrawer.tsx:180` · `AgencyUsageOverview.tsx:91` ·
   `useAdminSearch.ts:47,54,61` · `CreateAgencyModal.tsx:44`. Puis balayage de contrôle :
   `git grep -nE "['\"\`]/(agencies|users|end-users|marketplace|monitoring|compliance|changelog|feature-flags|plans|live|security|nps|autonomy|tool-usage|learning)" -- src/pages/admin src/components/admin src/hooks/useAdmin*`
   — chaque hit restant doit être préfixé ou justifié.
3. **Verrous anti-régression** : (a) spec unit `tests/unit/redirects-guard.spec.ts` qui lit
   `public/_redirects` et échoue si une cible `admin.megga.ch` (ou tout host absolu sur
   `/dashboard/*`) apparaît — c'est le seul filet possible, Vite ignore `_redirects` ;
   (b) dans `tests/e2e-admin/admin-coverage.spec.ts`, ajouter UN parcours cliqué :
   liste agences → clic 1ʳᵉ ligne → fiche → « Retour » → liste (attrape la classe de bug
   « lien absolu », que la visite directe d'URL ne voit pas).
4. **Après merge** : attendre le workflow `deploy-app.yml` sur le SHA du merge, puis
   `curl -sI https://app.megga.ch/dashboard/admin` doit répondre **200** (plus de 302).

### PR B — Purge des vestiges de l'app autonome (≈ ½ journée)

1. **`src/lib/adminEntry.ts` réécrit** : garder `ADMIN_CONSOLE_PATH` ; remplacer
   `openImpersonationInCrm` par une version **relative à l'origine** :
   `window.open('/dashboard?impersonate='+encodeURIComponent(id), '_blank', 'noopener')`
   (décision §3-2 : on garde l'onglet séparé). Supprimer `CRM_APP_URL` et toute mention
   `VITE_APP_URL` ; adapter les 2 appelants (`UserDrawer.tsx:233`,
   `AdminAgencyDetailPage.tsx:326`). `ImpersonationHandoff` ne change pas (il fait déjà le
   travail côté CRM, audit-first).
2. **Purger les docstrings du monde à 2 origines** : adminEntry.ts:20-21/29-35,
   ImpersonationHandoff.tsx:4-10, UserDrawer.tsx:230-232, AdminAgencyDetailPage.tsx:324-326,
   AdminShell.tsx:175-176 et :229-236 (le commentaire du dock parle encore de « cette
   origine »), AdminThemeProvider.tsx:14, AdminConsoleRoutes.tsx:4-6 (garder une ligne
   d'historique, retirer le mode d'emploi du double montage).
3. **Purger les 8 mentions AAL2** des edges (liste P1-2) — le commentaire doit décrire la
   garde réelle : Bearer + rôle + allowlist.
4. **Audit d'entrée par ENTRÉE de console** : déplacer le dédoublonnage de
   `adminConsoleAudit.ts` du module vers le cycle de vie d'`AdminConsoleRoute` — journaliser
   à chaque montage `allowed` (un `useRef` par montage suffit ; garder best-effort +
   1 relance + Sentry). En dev StrictMode double-monte : le ref le gère. Supprimer le flag
   module-scope `entryLogged`.
5. **Thème** : cleanup d'`AdminThemeProvider` au démontage — restaurer `data-theme` depuis
   la clé du CRM (même clé `megga.sugar.dark`) pour que le retour CRM en navigation interne
   ne garde pas le thème console. Tester à la main : CRM sombre → console claire → retour.
6. **`admin-console.css`** : réécrire l'en-tête (rôle réel : variables re-teintées pour les
   restes en classes sémantiques, focus ring WCAG — NE PAS le retirer, piège #972 —,
   scrollbars, placeholder, `.adm-ghost`/`.adm-row` utilisés par FeatureFlags/Plans/
   SecurityAudit) ; corriger « 16 pages ». Le slimming réel attend la PR E.
7. **Divers** : commentaires « tickets de support » (useAdminSearch.ts:2,
   AdminSearchDialog.tsx:3) ; « notifications » au pied de rail (AdminShell.tsx:171) ;
   note `AdminBillingCard.tsx:171-175` contredite par admin-console.css:130.
8. *(Optionnel, si le temps)* : écouteur `storage`/contexte pour `useImpersonate` (état
   par instance aujourd'hui — avec l'onglet séparé conservé, le bug est théorique ; le
   documenter si non traité).

### PR C — Honnêteté des données & états d'erreur (≈ 1 journée)

1. **Ajouter l'état d'erreur (kit `AdminError` + retry)** aux 12 pages listées en P2-8.
   Modèle à copier : `AdminLearningPage.tsx:77-108` (bandeau si cache affichable, erreur
   pleine sinon — le pourquoi y est documenté).
2. **Arrêter d'avaler** : `useAdminSearch` lit les `.error` + AbortController ;
   WeeklyReportPreview vérifie l'`error` d'invoke (fini le « envoyé ✓ » sur 500) ;
   `useFeatureFlags`/`useChangelog`/`useAnnouncementsAdmin` : `onError` + toast (pattern
   AdminPlansPage:85-91).
3. **Dire vrai** : badge « temps réel » d'ActivityLog → libellé « auto-refresh 30 s »
   (i18n) OU branchement sur le canal realtime existant — décision §3-5 : renommer,
   pas de 2ᵉ canal ; bento « Alertes » du dashboard → filtrer `severity in (warn,critical)`
   côté requête (`useAdminStats.ts:64-69`) et garder le titre.
4. **Confirmations destructives** : nouvel atome `AdminConfirm` (modale Sugar, createPortal
   z-[100]) ; l'utiliser pour suppression changelog, suppression annonce, et remplacer
   `window.confirm`/`window.prompt` d'UserDrawer (la saisie du motif de suspension devient
   un champ de la modale). Boutons destructifs : `opacity-0 group-hover:opacity-100`
   → ajouter `focus-visible:opacity-100` / porter le pattern `:focus-within`
   de Marketplace:190 partout (3 sites P2-10 + Agencies:240-244).
5. **Empty state manquant** : table des edge functions filtrée à vide
   (AdminMonitoringPage:434-474).

### PR D — Perf & base (≈ 1 journée, contient une migration)

1. **`count:'exact'` bannis** : `AdminMonitoringPage.tsx:59` → `count:'estimated'` (l'usage
   est un KPI de monitoring, l'estimation suffit) ; edge `admin-monitoring/index.ts` :
   passer les 9 comptages en `estimated` (mêmes clauses). Si le tri
   `last_seen_at DESC` sur `(source_portal,status)` reste (:60), créer l'index partiel
   couvrant dans la migration ci-dessous ; sinon le retirer.
2. **Requête morte** : supprimer `metricsHistory` (`useAdminMonitoring.ts:163-176` + son
   type) — MrrSparkline lit déjà `platform_metrics` de son côté.
3. **Borner** : `useAdminModeration.ts:39-43` → colonnes explicites sans `photos` (ou
   `photos->0` pour la vignette) + `.limit(200)` ; `useAdminAgencies.ts:135-158`
   (`properties`, `transactions` par agence) → `.limit(100)` + compte `estimated` pour les
   totaux ; `useAdminCompliance.ts:38` → `.order(created_at, desc).limit(500)` ;
   `useAdminNps.ts:49` → `.limit(200)` (les stats agrégées passent sur les 200 dernières —
   l'indiquer en sous-titre) ; documenter le choix « chargement complet accepté » sur
   `profiles`/`agencies` (volumes pilote) en en-tête des hooks.
4. **Debounce** l'invalidation du live feed (300 ms, `useAdminLiveFeed.ts:53-55`).
5. **Migration DB** (nommage 14 chiffres, idempotente `IF EXISTS` — voir §4) :
   `DROP TABLE IF EXISTS admin_notes` (0 ligne vérifié 28.07) ;
   `DROP FUNCTION IF EXISTS get_admin_support_stats()` (orpheline) ;
   rétention `platform_metrics` : décision §3-4 — purge > 180 j exécutée par l'edge
   `admin-monitoring` à chaque run (un `DELETE ... WHERE recorded_at < now()-interval '180 days'`,
   pas de nouveau cron) ; index partiel du point 1 si conservé.
6. **Types Supabase régénérés** après la migration (`supabase gen types` → `src/types/database.ts`),
   puis suppression des 10 casts `as unknown as` (Autonomy:25, Learning:29/43, ToolUsage:26,
   OpsHealth:22/59, Compliance:127, EndUsers:34, IntegrationsHealth:28, Moderation:57) et
   du double-cast `useCronHealth.ts:15-17`.
7. Gates spécifiques : `npm run test:backend` (specs admin-*), `deno check` sur les edges
   touchées, e2e admin.

### PR E — Kit, cohérence UI, i18n, a11y (le gros morceau, ≈ 2-3 jours, découpable en E1/E2/E3)

**E1 · Étendre le kit** (`src/components/admin/kit/`) :
- `AdminPager` (pagination numérotée desktop+mobile — remplace les 5 copies) +
  hook `useClientPagination` (trio filtered/safePage/paginated ×3) ;
- `AdminSegment` (pilules segmentées filtre/onglet — remplace les 9 variantes) ;
- `AdminSearchInput` (champ + loupe ×6) ;
- `AdminBanner` (bandeau info/erreur ×3, calqué sur Learning) ;
- `AdminOverlay` (voile modal ×4) ; `AdminField`/`AdminSelect` (champ creuse+inset ×6) ;
- `AdminConfirm` si pas déjà fait en PR C ;
- exposer un ton `hairline` dans `useAdminSugar`/kitCore (4 recalculs à la main) ;
- `MONO` et `initialsOf` → kitCore (×2/×3) ; dé-exporter `ADMIN_ICON_SIZE`/`ADMIN_ICON_STROKE`
  (0 usage externe) ;
- fusion des tuiles KPI : tout sur `AdminStat` ; supprimer `AdminKpiCard` (3 pages
  appelantes), `HealthTile` (Monitoring), `OpsStat` (AdminOpsPanels) ; unifier
  CapCell/QuotaBar ;
- un seul dropdown-à-voile (pattern Échap document-listener de FeatureFlags:54-59) —
  corriger l'Échap mort de Plans:112 ; `role="option"` sur les listbox.

**E2 · Normalisation dans les 17 pages** :
- remplacer les copies par les atomes E1 (sites listés en P3-13) ;
- « rangée cliquable » : bannir `<button>` dans `<Link>` (Agencies:410-422) — porter le
  pattern `tr role="button"` d'AdminUsersPage:254-277 sur Agencies (et passer Agencies en
  vraie table par la même occasion) ; SecurityAudit passe en `AdminTh/Td` ;
- révélation d'actions : `:focus-within` partout (référence Marketplace:190) ;
- retirer `PageTransition` des 2 pages (AdminPage anime déjà l'entrée) ;
- clés React Query : convention unique `['admin', '…']` (aligner les `'admin-*'`) —
  attention aux invalidations croisées (Plans invalide les clés billing : les renommer
  ensemble, greper chaque `invalidateQueries`) ;
- mobile modération : ajouter les actions aux cartes mobiles (Marketplace:261-292) ;
- `height: 100dvh` (AdminShell:263) ;
- a11y restants : `aria-expanded` (LiveFeed, Compliance), `aria-pressed` onglets
  (Compliance:357), `htmlFor` (Changelog:183/211/223), `aria-label` sur les boutons à
  `title` seul (Marketplace:355-374), label du champ traits (Learning:177), select d'action
  du LiveFeed (395-409).

**E3 · i18n & libellés** (utiliser le skill `i18n-sync` — 4 langues à CHAQUE ajout) :
- AdminMonitoringPage : bloc Flatfox + section IA → clés ; créer les 3 clés manquantes
  (`monitoring.errorTitle`/`errorDesc`, `cronHealth.errorDesc`) et retirer les `defaultValue` ;
- `AUDIT_ACTION_LABELS` → clés i18n (avec accents) + aria-labels pagination ;
- helper commun d'export CSV avec colonnes traduites (SecurityAudit fait foi ; corriger
  Compliance:317 et Agencies:225-229) ;
- UN formateur de dates admin locale-aware (`i18n.language`) — remplacer les 3 figés ;
- fuites : NPS:182/215, Agencies:316, BillingDashboard:197, replis 'Inconnu'/'Utilisateur'/
  'Agence'/'Bien', libellés `PLANS` (plans.ts → clés) — et retirer la ligne
  « Portail vendeur » (P1-4), les tuiles « Claude » (P1-3), le mapping `ticket_created`
  (P1-5) si pas déjà tombés ;
- déplacer les clés `marketplace.*` des inboxes vers `endUsers.*` ; purger les blocs morts
  `support.*` et `notifications.*` des 4 admin.json ; normaliser le préfixe (`admin:` via
  `useTranslation('admin')` par défaut — trancher UNE convention, l'appliquer partout) ;
- préfixe i18n mixte d'AdminPlansPage → unifié.

**E4 · Renommages (décision §3-1)** :
- route `/dashboard/admin/marketplace` → `/dashboard/admin/moderation` : renommer
  `AdminMarketplacePage.tsx` → `AdminModerationPage.tsx` (**`git mv`**), route + entrée de
  nav + clé i18n `nav.adminModeration`, `<Navigate>` de l'ancien chemin, mettre à jour
  `useAdminSearch` et `tests/e2e-admin/admin-coverage.spec.ts` ;
- `git mv AdminChangelogPage.tsx AdminCommunicationPage.tsx` (le fichier suit l'export) +
  import dans AdminConsoleRoutes ;
- icônes de nav : dédupliquer (users/broadcast/shield/sparkle) avec des glyphes MEIcon
  distincts par page ;
- fichiers ≠ exports : scinder `AdminOpsPanels` et `AdminModerationInbox` n'est PAS requis —
  renommer seulement si trivial ; ne PAS déplacer les hooks locaux si ça grossit la PR
  (les noter en dette). ⛔ Pas de sous-dossiers dans `components/admin/` (hors `kit/`
  existant), pas de réorganisation de `src/hooks`/`src/lib`.

### PR F — Docs, cerveau, clôture (≈ 2 h)

1. **CLAUDE.md §8**, remplacer le paragraphe Super-Admin par (adapter si E4 a renommé) :
   > **Super-Admin :** surface du CRM montée sous `/dashboard/admin/*` (l'app autonome
   > `admin.megga.ch` a été retirée le 28.07.2026 — plus de build:admin ni de projet Pages
   > dédié). 17 pages lazy (accent violet réservé au repère de contexte), nav groupée en
   > 5 sections, chrome Sugar (`AdminShell`, kit `admin/kit/`). Garde :
   > `AdminConsoleRoute` → `useSuperAdminGate` (UX) + `is_super_admin()` rôle+allowlist en
   > DB + `_shared/require-super-admin.ts` sur les edges. Entrées : dropdown profil Sugar
   > + ⌘K. Chaque ouverture journalisée (`admin_console_entered`) ; impersonation
   > audit-first via `?impersonate=<id>` (RPC `admin_log_impersonation`).
2. **docs/system-map.md** : :62 (retirer « portail vendeur » du résumé), :97-114 (console =
   surface CRM), :161 (réécrire la ligne du tableau), :379-387 (retirer dev:admin/
   build:admin/deploy-admin.yml) ; **docs/pages.md** : :12 (admin 17), :30 (retirer
   `/dashboard/admin` d'AgentLayout), :60-64 (guard réel + liste avec end-users).
3. **Cerveau** : réécrire les nœuds `super-admin`, `audiences`, `dev-ci` du seed
   (`.claude-flow/knowledge/megga-memory.seed.json`) puis `npm run ruflo:seed`.
4. **docs/CHANGELOG.md** : entrée synthétique (fusion + hotfix + réorganisation).
5. **Supprimer ce fichier** (`docs/admin-console-reorg-plan.md`).

---

## 3. Décisions prises (recommandation appliquée — contester avant exécution si désaccord)

1. **Renommage `marketplace` → `moderation`** : OUI (le nom actuel désigne un module qui
   n'existe plus ; la page modère les biens CRM). Avec redirect legacy.
2. **Impersonation** : conserver l'ouverture dans un **onglet séparé**, mais en URL
   **relative à l'origine** (supprime `CRM_APP_URL` et le risque dev→prod ; ne touche pas
   à `ImpersonationHandoff` qui marche).
3. **Pas de nouveau realtime** pour ActivityLog : on renomme le badge (honnêteté), on ne
   multiplie pas les canaux.
4. **Rétention `platform_metrics`** : 180 jours, purge dans l'edge `admin-monitoring`
   (pas de nouveau cron).
5. **DROP `admin_notes` + `get_admin_support_stats`** : OUI (0 ligne / 0 appelant, vérifiés
   le 28.07 en prod).
6. **Structure des dossiers** : inchangée (components/admin plat + kit/ ; hooks/lib plats).
   La réorganisation est ici une consolidation kit + nommage, pas un déménagement.
7. **Pas de Cloudflare Access** ni autre porte au bord : décision produit déjà prise,
   le domaine admin n'existe plus.

## 4. Garde-fous d'exécution pour Opus (pièges connus du dépôt)

- **Worktree** : `npm ci` dans le worktree avant tout build (« build failure » classique) ;
  si des sous-agents sont lancés, leur imposer `cd` dans le worktree et vérifier le SHA.
- **Gates par PR** : `npm run build` (tsc -b + vite — ⚠ `tsc -p` ne vérifie RIEN),
  `npm run lint`, `npm run lint:deadcode`, `npm run test:unit` ; e2e admin
  (`npm run test:e2e:admin`) pour A/C/E ; `npm run test:backend` + `deno check` pour D et
  toute edge touchée. Build vert AVANT push ; vérifier que la CI a tourné sur le SHA
  réellement mergé.
- **Commits** : une PR = un lot ; commiter en fin de lot, pas à chaque retouche.
- **Migrations** : nommage 14 chiffres (`YYYYMMDDHHMMSS_…`), idempotentes (`IF EXISTS` sur
  l'objet créé/droppé — le deploy rejoue tout stamp >= aujourd'hui), jamais modifier une
  migration appliquée.
- **i18n** : toute chaîne UI nouvelle/déplacée passe par le skill `i18n-sync` (FR/DE/EN/IT
  synchrones) ; jamais « Claude »/« Anthropic » dans l'interface.
- **A11y Sugar** : jamais `outline: none` (piège #972) — l'anneau de focus vit dans
  `admin-console.css` et doit survivre au slimming.
- **Après chaque merge** : le déploiement Cloudflare part de main — vérifier l'objet réel
  (curl / écran) et pas seulement la CI verte.

## 5. Annexe — inventaire données (vérifié en prod le 28.07)

- **Tables consommées (15)** : activity_events, admin_nps_responses, agencies,
  agency_usage_quotas, contact_messages, contacts, kyc_cases, moderation_actions,
  platform_announcements, platform_metrics, profiles, properties, seller_leads,
  subscriptions, transactions. Toutes existantes, RLS actif.
- **RPC consommées (26 + gardes)** : toutes existantes en prod, y compris hors-préfixe
  (get_agency_stats, get_agency_activity_summary, get_onboarding_milestones,
  get_whatsapp_tool_usage_stats, get_cron_health, pg_database_size_mb, storage_size_mb).
  Orpheline à dropper : `get_admin_support_stats`. Gardes : `is_super_admin`,
  `super_admin_allowlist(_match)` OK.
- **Edges consommées (7)** : admin-agency-lifecycle, admin-dsar-export,
  admin-stripe-metrics, admin-stripe-agency-billing, admin-user-lifecycle, delete-account,
  weekly-report ; + `admin-monitoring` (cron hourly `platform-metrics-hourly`). Aucune
  orpheline.
- **Santé par page** (sain → sale) : EndUsers · Autonomy · ToolUsage · Learning · Users ·
  FeatureFlags · AgencyDetail · LiveFeed · Dashboard · Nps · Compliance · Agencies ·
  Changelog · Plans · Marketplace · SecurityAudit · **Monitoring** (la plus chargée :
  §7 violé, i18n en dur, tuiles Claude, requête fantôme).
