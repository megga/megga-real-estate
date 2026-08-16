# Plan d'implémentation — CRM MEGGA mobile responsive (Sugar Pure)

> Source de vérité = le **mobile** (handoff `docs/handoff/crm-mobile/`). La réconciliation desktop est un chantier **séparé et différé** (cf. `HANDOFF_MOBILE_VS_DESKTOP.md`). Zéro régression desktop, KYC non-bloquant, C2PA gardé / virtual-staging IA retiré, i18n via `t()` (lint `no-literal-string` en ERROR).

---

## 1. Architecture responsive + shell + routing

### Bascule responsive — par wrapper d'élément de route, pas au layout

Le chrome Sugar (`CrmTopNav` + `CrmIconRail` 128px) **n'est pas dans le layout** : `AgentLayout` ne rend que des providers (`ThemeProvider > CopilotContextProvider > ImpersonateBanner + <Outlet/> + CrmSugarSearchHost + NpsSurvey`). Chaque page agent instancie elle-même son shell. Conséquence : impossible de masquer le chrome desktop par un simple switch de layout.

**Décision : un composant `ResponsiveRoute({ desktop, mobile })`** qui fait `const isMobile = useIsMobile(); return isMobile ? mobile : desktop`. Appliqué route par route dans `App.tsx`. Les providers restent dans `AgentLayout` et couvrent les deux branches (le mobile hérite gratuitement du thème, du copilote, de l'impersonate banner).

- `useIsMobile()` = `useMediaQuery('(max-width: 768px)')`, déjà présent (`src/hooks/useMediaQuery.ts`), initialisé correctement au premier paint (`useState(() => window.matchMedia(query).matches)`), pas de flash desktop→mobile.
- **Seuil unique binaire = 768.** V1 ne crée pas de 3e arbre tablette : 768–1024 reçoit le desktop. `useIsTablet` reste disponible pour des ajustements internes futurs.
- Au franchissement de 768px : remount complet de la branche (arbres distincts, perte d'état local non persisté) — acceptable, cas rare.

### Shell mobile

`src/components/crm-mobile/shell/MobileShell.tsx` :
- **Header** simple (wordmark MEGGA + cloche → `MrNotifSheet`), sans status-bar iOS proto.
- `<Outlet/>` ou children selon le branchement (voir §2).
- **Pilule de tab bar flottante** `MobileTabBar` (port 1:1 de `NavTabBar` proto) : `position: fixed; bottom: calc(22px + safe-area)`, 5 onglets (today/pipeline/matching/agenda/more). **Onglet actif déduit de `useLocation().pathname`** via `pathnameToTab()`, `navigate(route)` au tap.
- Les routes **détail/création** (transactions/:id, listings/:id|new, contacts/:id|import, visits/*, kyc/:id, offre) **masquent la tab bar** via `isDetailRoute(pathname)` → header bouton-retour rond à la place.
- `<main>` scrollable de chaque écran : `padding-bottom: calc(94px + safe-area)` pour dégager la pilule fixe.

### Masquage du chrome desktop dans les pages

Le chrome desktop est rendu **dans chaque page** (ex. `TodayPage` L325). Pour ne pas l'afficher sur mobile **sans dupliquer la page**, deux options possibles :
- **(retenu)** Le mobile vit dans des **fichiers `*MobilePage.tsx` séparés** → `ResponsiveRoute` rend l'un OU l'autre. Le fichier desktop n'est jamais modifié, donc aucun risque de toucher un pixel desktop. Pas besoin d'early-return dans les pages desktop.
- (rejeté) Early-return conditionnel `if (isMobile) return null` autour des `<CrmTopNav/>` dans ~12 pages : plus invasif, touche les fichiers desktop.

### Routing — mapping écrans → routes existantes

| Écran mobile | Route existante | Note |
|---|---|---|
| today | `/dashboard` | index |
| pipeline | `/dashboard/pipeline` | |
| matching | `/dashboard/matching` | |
| agenda | `/dashboard/calendar` | l'onglet « Agenda » mappe sur `calendar` |
| more (hub) | **`/dashboard/more`** (NOUVELLE) | hub mobile pur |
| contacts | `/dashboard/contacts` | |
| contact détail | `/dashboard/contacts/:id` | détail (no tab bar) |
| contact-new | `/dashboard/contacts/import` (ou `/contacts/new`) | modal in-page desktop |
| biens (liste) | `/dashboard/listings` | |
| bien fiche | `/dashboard/listings/:id` | détail |
| wizard | `/dashboard/listings/new` | détail (no tab bar) |
| deal | `/dashboard/transactions/:id` | détail |
| matching offre | `/dashboard/transactions/:id/offre/:kind` | détail |
| parcours | `/dashboard/journey` (+ alias `/parcours`) | |
| kyc | `/dashboard/kyc` (+ `/kyc/:dossierId`) | |
| analytics | `/dashboard/analytics` | |
| settings | `/dashboard/settings` | |
| agenda time-block | sous-vue de calendar | |
| relance | sous-vue de today (overlay `RelanceSession`) | createPortal |

**Second layout (`AgentLayout`).** Les vues détail mobiles `contacts/:id`, `listings/new`, `listings/:id/edit`, `market/:externalId`, `import-lead` vivent sous `AgentLayout`, **pas** `AgentLayout`. Il faut aussi y appliquer `ResponsiveRoute` (mobile = page détail avec header retour, sans tab bar), sinon ces fiches s'ouvrent avec le chrome desktop sur mobile.

---

## 2. Arborescence `src/components/crm-mobile/**` + branchements

```
src/components/crm-mobile/
  tokens.ts                      # MT_LIGHT/MT_DARK/MT_STAGE + danger/destructive/kycSeal, table phases unique
  MobileThemeProvider.tsx        # contexte MTCtx, dark dérivé de useTheme() (data-theme) — pas de localStorage parallèle
  shell/
    MobileShell.tsx              # header + Outlet + MobileTabBar fixe
    MobileTabBar.tsx             # pilule flottante 5 onglets, actif déduit de useLocation
    MobileHeaderBack.tsx         # header bouton-retour rond (vues détail)
    ResponsiveRoute.tsx          # { desktop, mobile } -> isMobile ? mobile : desktop
    routeMatchers.ts             # pathnameToTab(), isDetailRoute()
  primitives/
    SgSheet.tsx                  # re-skin de ui/Sheet.tsx, surface Sugar, radius 22
    SgActionMenu.tsx             # port .tsx de crm-action-menu (sheet/overlay/fixed), danger séparé
    SgToast.tsx                  # pilule noire centrée-bas, provider parallèle (pas ui/Toast)
    SgConfirmDestructive.tsx     # bottom-card #8E1F3D, CTA blanc sans icône
  today/    MobileTodayScreen.tsx, MobileTodayPage.tsx
  pipeline/ MobilePipelineScreen.tsx, ...
  deal/     MobileDealScreen.tsx
  matching/ MobileMatchingScreen.tsx
  agenda/   MobileAgendaScreen.tsx (liste + time-block)
  biens/    MobileBiensScreen.tsx
  bien/     MobileBienVitrineScreen.tsx
  wizard/   MobileWizardScreen.tsx
  contacts/ MobileContactsListScreen.tsx, MobileContactDetailScreen.tsx, MobileNewContactScreen.tsx
  kyc/      MobileKycScreen.tsx
  parcours/ MobileParcoursScreen.tsx
  analytics/MobileAnalyticsScreen.tsx
  settings/ MobileSettingsScreen.tsx + sections/*
  more/     MobileMoreScreen.tsx, MrNotifSheet.tsx
  relance/  MobileRelanceSession.tsx
  mandat/   MobileMandatSummaryScreen.tsx
```

Atomes partagés réutilisés tels quels (mécanique neutre, theming indépendant) : `src/components/ui/Pressable.tsx`, `src/hooks/useReducedMotion.ts`, `useSwipeNavigation.ts`, `useFocusTrap.ts`. Icônes : `src/components/propertyx/MEIcon.tsx` (source unique), enrichie des ~12 glyphes manquants du handoff (whatsapp, smartphone, laptop, door, villa, land, warehouse, megaphone, magic-wand, broadcast).

### Points d'insertion

- **`src/App.tsx`** : envelopper chaque `element={<XxxSugarPage/>}` du bloc `<Route path="/dashboard" element={AgentLayout}>` (L472-517) en `element={<ResponsiveRoute desktop={<XxxSugarPage/>} mobile={<XxxMobilePage/>} />}`. Idem dans le bloc `AgentLayout` pour les vues détail. Ajouter `<Route path="more" element={<ResponsiveRoute desktop={<Navigate to="/dashboard/settings"/>} mobile={<MobileMorePage/>} />} />`. Branches en `lazy()` comme l'existant. Migration page par page : `mobile={desktop}` en no-op tant que l'écran mobile n'est pas livré.
- **`AgentLayout.tsx`** : inchangé (providers couvrent les deux branches). Le `MobileShell` est rendu côté `*MobilePage.tsx` (chaque page mobile s'enveloppe dans `MobileShell`), pas dans le layout — ainsi le desktop ne voit jamais le shell mobile.

---

## 3. Stratégie tokens

**Un seul module canonique** `src/components/crm-mobile/tokens.ts`, en promouvant `MT_LIGHT`/`MT_DARK`/`MT_STAGE` de `crm-mobile-today.jsx` (déjà Sugar Pure : accent `#0B0C0E` light / `#F2F2F6` dark, surfaces `#FFFFFF`, ombres douces seules, `cardBorder` transparent en light, Manrope, tabular-nums, CHF apostrophe).

Consolidations à intégrer (5 divergences relevées dans le handoff) :
1. **canvas vs pageBg** : un seul `canvas` (gradient radial) ET un `pageBg` aplat explicites. Supprimer les `pageBg` re-dérivés localement (`mkPal` KYC `#E9ECF1`/`#121316`, biens) au profit du token central.
2. **table phases pipeline unique** (light + dark) couvrant les 6 phases : Mandat `#1E5BC6`, Préparation/Visites `#0891B2`, Offre `#C45A00`, Compromis `#059669`, Acte `#0B0C0E` — remplace MT_STAGE + `PIPE_PHASES.color/darkColor` (aligner Offre/Compromis qui divergent aujourd'hui).
3. **tokens danger/destructive** : `#8E1F3D` light / `#E0738C` dark (+ `riskBg`/`riskFg` orange existants) — tue les rouges en dur des toasts/CTA perdu.
4. **token `kycSeal`** : `#0041D9` (sceau vérifié).
5. **`MTCtx` Provider** dont `dark` dérive de `useTheme()` (`data-theme`), **pas** d'un `localStorage('megga-mobile-dark')` parallèle.

**À NE PAS faire** : baser le module sur `src/components/crm/tokens.ts` (primary `#0041D9` bleu desktop) ni hériter de `today/tk.ts` dont l'accent dark est bleu `#6F8CFF` (non conforme Sugar Pure ; à réaligner dans un second temps, hors V1). Le port `.jsx → .ts` doit préfixer les noms pour éviter les collisions (scope global Babel des maquettes).

---

## 4. Phases d'implémentation ordonnées (socle → feuilles)

| Phase | Surfaces | Rationale | Effort |
|---|---|---|---|
| **P0 — Socle** | tokens.ts, MobileThemeProvider, MobileShell, MobileTabBar, MobileHeaderBack, ResponsiveRoute, routeMatchers, branchement App.tsx (no-op mobile=desktop) | Rien d'autre ne peut être branché sans la coque + le switch responsive. Prouve zéro régression desktop avant toute feature. | M |
| **P1 — Primitives** | SgSheet, SgActionMenu, SgToast, SgConfirmDestructive, MEIcon (glyphes manquants) | Toutes les feuilles dépendent des bottom-sheets / toast pilule / confirmation destructive. Re-skin, pas réécriture. | M |
| **P2 — Hubs de navigation** | more (hub), notifications (feuille) | « Plus » est la porte d'entrée des écrans secondaires + valide la tab bar et le branchement notif. Lecture seule, peu de gestes. | M |
| **P3 — Cockpit** | today, relance | Écran d'accueil (onglet 1), réutilise `useFocusQueue` + gestes audités. Relance = overlay enfant de today. | L |
| **P4 — Pipeline & deal** | pipeline, deal | Onglets 2 ; réutilise `usePipelineScreen` + mutation stage (audit par trigger DB). KYC non-bloquant strict. | L (pipeline M / deal L) |
| **P5 — Matching** | matching | Onglet 3 ; `useAtelierMatching` + PendingRegistry undo 5s. Feuilles envoyer/visite. | L |
| **P6 — Agenda** | agenda (liste + time-block) | Onglet 4 ; `useCalendarScreen` + créer visite/reminder. | L |
| **P7 — Biens** | biens (liste), bien fiche, wizard, mandat | Sous « Plus ». Fiche = re-skin de la page déjà câblée. Wizard = `handlePublish` réutilisé. Mandat = synthèse IA (mock côté desktop, à flaguer). | L |
| **P8 — Contacts** | contacts liste, contact détail, contact-new | Sous « Plus ». `useContactsScreen` + détail v2 (WhatsApp, insight, KYC rappel doux). | L (liste/new M, détail L) |
| **P9 — Conformité & pilotage** | kyc, parcours, analytics, settings | Sous « Plus ». KYC = garde LBA art.9 verbatim. Analytics = re-disposition du même `AxPeriodData`. Settings = mêmes hooks live. | L (analytics/parcours M, kyc/settings L) |

Chaque phase : extraire la logique data du desktop dans un hook/controller partagé quand pertinent (ex. `useBienVitrineController`), porter le markup en grammaire mobile, brancher loading/empty/error, i18n bloquant + parité FR/EN, `npm run build` (tsc -b) avant push.

---

## 5. Contraintes globales

- **i18n** : `useTranslation('<ns existant>')` (les 15 ns existent) ; 100 % des chaînes FR en `t()`, clé ajoutée dans `fr/<ns>.json` ET `en/<ns>.json`. `lint:i18n` (ERROR sur `crm/**`, `pages/agent/**`) + `i18n:parity:ci` bloquants.
- **CHF** : `formatCHF` de `src/lib/utils.ts` (type-defensive, apostrophe suisse). Pas `crmFmtCHF`/`pxFormatCHF`.
- **KYC non-bloquant partout** : aucun verrou pipeline/envoi/parcours. Rappel doux uniquement. Garde d'intégrité autorisée : édition d'identité d'un contact vérifié → modale d'avertissement (verified→pending). Garde LBA art.9 KYC (`screeningGuard`/`canMarkAll`) copiée verbatim.
- **Virtual staging IA retiré V1** ; **C2PA gardé**.
- **MEGGA AI non-intrusive** : proposition + confirmation humaine, jamais d'action auto. Scores = « estimation ». Jamais « automatique »/« garanti ».
- **Zéro emoji**, icônes SVG stroke. **tabular-nums** sur tous les nombres.
- **Cibles tactiles ≥ 44px**, `prefers-reduced-motion` respecté, safe-area-inset.
- **Zéro régression desktop** : fichiers mobiles séparés, aucun style partagé inline, providers non dupliqués (uniquement dans le layout).
- **RLS / agency gate** : tous les hooks dépendent de `profile.agency_id` du JWT ; gestes inertes si null (P0 pilote). Pas de filtre tenant côté client.
- **Audit trail** : `activity_events` pour toute action mobile (`logFocusGesture`, etc.), `agency_id` + `actor_id`. Ne pas court-circuiter ni double-compter (stage_change écrit par trigger DB).
- **Pas de données fabriquées** : consommer les hooks live, empty-states honnêtes. Retirer les seeds mock (Gregory, CHF 7.6M, 47, photos Unsplash, refs MG-2026-101, owner lié, energy, publishedTo, scores conf mandat).

---

## 6. Réconciliations desktop différées (chantier séparé)

Le mobile fait foi. À traiter **hors** du port mobile (cf. `HANDOFF_MOBILE_VS_DESKTOP.md`) :

1. **Pipeline desktop** — retirer le verrou KYC bloquant.
2. **Wizard desktop** — retirer étape Options + Staging Studio + badges staging + blocs payants (Mise en avant / Visite vidéo).
3. **Mes biens desktop** — porter actions ••• (Dupliquer / Changer statut / Retirer diffusion / Supprimer + confirmation `#8E1F3D`), ajouter Importer / Trier, trancher le sort des soumissions vendeurs (`BnSubmissionsBanner`/`Drawer`).
4. **Contact détail desktop** — ajouter la modale d'invalidation KYC.
5. **Settings desktop** — construire les sections placeholder 2–5, figer le bandeau A/B/C.
6. **Notifications desktop** — répercuter les nettoyages (check « Tout lire », chevrons →).
7. **Analytics** — aligner les métriques mobile ↔ cockpit desktop (un seul jeu de chiffres).
8. **Nouveau contact** — décider mobile simplifié vs autocomplete adresse + cantons desktop.
9. **Agenda** — confirmer la parité time-blocking.
10. **Code mort** — nettoyer `MWStepOptions` / `MW_STAGE_STYLES` orphelins.

---

## 7. Questions ouvertes

- **Variantes du hub « Plus »** (A list / B grid / C sections) : défaut A (list) pour V1, à confirmer produit.
- **Tuile WhatsApp** du hub « Plus » : aucune route ni écran agent → retirer en V1.
- **Pastille notif header** : aucun hook de notifs agent (`useAdminNotifications` est admin-scope) → masquer la pastille tant qu'aucune source réelle.
- **Overlay MTCommand mobile** (recherche/copilote IA) : réutiliser `openSugarSearch` → `CrmSugarSearchHost` (ne pas reconstruire un faux moteur streaming).
- **Tone pills relance + geste « appeler » + persistance localStorage** : inventés par la maquette, absents du backend → retirer ou étendre le backend (décision produit).
- **Synthèse IA mandat** : extraction = mock côté desktop (`MOCK_EXTRACTION`), pas d'EF d'extraction de clauses → garder le mock honnête ou bâtir `extract-mandate` (chantier séparé). Scores de confiance à ne pas fabriquer.
- **Drill analytics (`records`)** : `null` en prod → « détails indisponibles », pas de mock.
- **Soumissions vendeurs** (suppression totale vs reformulation) et **blocs Mise en avant / Visite vidéo** (abandon V1 vs replacement).
- **Persistance serveur thème/langue** (settings) : garder localStorage live + save best-effort, ou trancher `useUiPreferences`.

---

## 8. Risques

- **i18n bloquant** : une seule chaîne FR codée en dur sous `crm/**` ou `pages/agent/**` casse la CI (ERROR). Extraire 100 % AVANT merge ; ajouter chaque clé en fr **et** en.
- **Double layout** : oublier `AgentLayout` pour les vues détail mobiles → fiches en chrome desktop sur mobile.
- **Pilule fixe** : sans `padding-bottom: calc(94px+safe-area)` sur le `<main>` de chaque écran, le contenu passe sous la barre.
- **Double source de thème** : un `localStorage('megga-mobile-dark')` parallèle désynchronise du `ThemeProvider`. Brancher sur `useTheme()`.
- **Dérivations locales de tokens** (`mkPal`, danger en dur) : changer le token central ne se propagera pas tant qu'elles subsistent — migration doit les supprimer.
- **Phases pipeline divergentes** (Offre `#C45A00` vs `#B4570A`, Compromis `#059669` vs `#066B45`) : choisir la valeur canonique sinon régression visuelle.
- **Réintroduire un verrou KYC** ou **un badge/étape staging IA** en copiant une vieille maquette = régression compliance directe.
- **Fabriquer des données** (scores conf mandat, owner lié, energy, probability deal, identityVerified, risk, ville contact, carte VISA Stripe, sparkline +18 %) viole « données honnêtes ». Cacher ou dériver, jamais hardcoder.
- **Doublon de hooks matching** (`useMatching` vs `useAtelierMatching`) : brancher le mobile sur `useAtelierMatching`, invalider les deux queryKeys après écriture, respecter l'undo 5s PendingRegistry.
- **Remount au resize 768px** : perte d'état local non persisté — ne pas y mettre de formulaire non sauvegardé.
- **Collisions de noms globaux** (scope Babel `.jsx`) : à la conversion `.tsx`, préfixer les composants, passer en imports ES (pas `window.*`).
- **Photos wizard non persistées** (mock `addStock`) : câbler `useUploadPropertyPhotos` post-create sinon régression « préserver le fonctionnel ».
- **Recherche vendeur wizard** : remplacer le mock `CRM_CONTACTS` par `useContacts` sinon id non-UUID → lien vendeur perdu silencieusement.

---

## 9. Corrections post-revue adverse (à appliquer AVANT P0) ✅ vérifiées dans le code

La revue adversariale a trouvé 2 blocages d'archi/compliance réels (lignes confirmées dans le code courant). Le plan ci-dessus est amendé comme suit.

### 9.1 BLOQUANT — double chrome / double tab bar sous `AgentLayout`
**Fait** : `AgentLayout.tsx` rend `Sidebar` + un header mobile `md:hidden` (L56) + `Breadcrumb` + `<BottomTabBar/>` (`fixed bottom-0 z-50 md:hidden`, L88) autour de l'`<Outlet/>`. Les routes `contacts/:id`, `listings/new`, `listings/:id/edit`, `market/:externalId`, `contacts/import` (+ tout `admin/*`) vivent sous CE layout. `ResponsiveRoute` au niveau `element=` **ne masque pas** le chrome du layout parent → sous 768px : header legacy **+** `MobileShell`, et **2 barres d'onglets** (`BottomTabBar` legacy + `MobileTabBar`).

**Décision retenue : rendre `AgentLayout` mobile-aware** (et NON déplacer des routes — déplacer stripperait la nav desktop des pages legacy `ListingFormPage`/`ExternalListingDetailPage`). Dans `AgentLayoutInner`, `const isMobile = useIsMobile()` ; si `isMobile`, retourner uniquement `<>{ImpersonateBanner}<main>{Outlet}</main></>` — **pas** de Sidebar, **pas** de header `md:hidden`, **pas** de Breadcrumb, **pas** de `BottomTabBar`. La page mobile (via `ResponsiveRoute`) fournit son propre `MobileShell`. **Desktop ≥768 strictement inchangé** (neutralisation gatée sur `isMobile`).
- `AgentLayout` reste tel quel (déjà sans chrome) — rien à neutraliser.
- **Note admin** : `admin/*` étant aussi sous `AgentLayout`, un super-admin sur mobile perdra la tab bar legacy. **Accepté** (admin = outil desktop super-admin, hors cible mobile V1). À documenter, pas un blocage.
- **Bonus desktop** : `ContactDetailPage` rend déjà son propre `CrmTopNav` tout en étant sous `AgentLayout` (Sidebar) → double chrome **desktop existant aujourd'hui**. Hors scope strict, mais à signaler dans la réconciliation desktop.

### 9.2 BLOQUANT — le garde-fou i18n ne couvre PAS `crm-mobile/**`
**Fait** : `eslint.config.js` `lockedFamilies` verrouille `crm/**`, `crm-dossiers/**`, `crm-wizard/**`, `matching-atelier/**`, `ai-copilot/**`, `kyc-report/**`, `pages/agent/**` — **pas** `src/components/crm-mobile/**` (où vivra ~tout le code mobile). Le risque #1 du §8 (« une chaîne FR casse la CI ») est donc **FAUX en l'état** : les écrans mobiles échapperaient silencieusement au `no-literal-string`.
**Correctif P0 obligatoire** : ajouter `'src/components/crm-mobile/**/*.{ts,tsx}'` à `lockedFamilies` **avant la 1ʳᵉ PR mobile**, et re-vérifier que `parity:ci` (fr ET en) couvre chaque clé ajoutée.

### 9.3 Blocages fonctionnels à traiter comme tels (pas « nice-to-have »)
- **Wizard photos** (P7) : `WizardShell.tsx:141` transforme tout `File` en `''` puis filtre → **0 photo persistée**. Le wizard mobile DOIT câbler `useUploadPropertyPhotos` (`useProperties.ts`) en post-create. Blocage fonctionnel.
- **Nouveau contact** (P8) : câbler `useCreateContact` (`@/hooks/useContacts:124`), **jamais** l'homonyme `useCreateContactMessage` (`useContactMessage.ts:39`, qui ne crée qu'un message).
- **Matching** (P5) : brancher sur `useAtelierMatching` (pas `useMatching`), invalider les deux queryKeys après écriture, respecter l'undo 5 s `PendingRegistry`.

### 9.4 Précisions à intégrer aux phases (fidélité / omissions revue)
- **Critères d'acceptation par écran** : reprendre verbatim les valeurs du handoff (rayons 28/22/18/14/12/999, ombres `shadowSm/shadow/shadowLg`, entrée `sgFadeUp/mwFadeUp .45–.5s`), clair **et** sombre — pas seulement le README.
- **Fiche bien** (P7) : confirmer la parité des **4 onglets** (Aperçu / Performance / Demandes / Historique) + galerie plein écran (lightbox).
- **Détail affaire** (P4) : couvrir négociation **offre/contre-offre** + parties acheteur/bien ; `deal.probability` = donnée à NE PAS fabriquer → dériver du stage ou masquer l'anneau.
- **Agenda time-block** (P6) : résoudre la parité time-blocking (pas un simple listing) ; `useCalendarScreen` n'a pas de types KYC/offre.
- **Suspense** : définir un skeleton mobile dédié pour les branches `lazy()` (sinon `SmartPageLoader` affiche un squelette desktop).
- **`SgSheet`** : wrapper **isolé** de `ui/Sheet` (ne pas modifier `Sheet.tsx`, sinon fuite de tokens Sugar vers les usages desktop). Pas de `layoutId` partagé entre branches desktop/mobile (transition shared-element parasite au resize).
- **Empty-state agency nulle** : réutiliser le pattern des pages Sugar desktop (gestes inertes si `profile.agency_id` null).
- **Feuille notif** (P2) : masquer les deep-links morts (`ctaTo=''`/`body=''`) plutôt que livrer une feuille creuse.
- **Hors V1 explicitement** : onboarding / premier-jour, écran **QR Code device-pairing**, `admin/*` mobile, tuile WhatsApp du hub Plus (aucune route agent).

### 9.5 Verdict revue : **GO-avec-réserves** (les 2 blocages ci-dessus levés en P0 → GO).
