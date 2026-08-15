/**
 * Garde-fou : la GRAMMAIRE MEGGA X — casse, graisse, interlettrage, échelle de
 * texte — sur les surfaces déjà portées.
 *
 * Pourquoi ce fichier existe. Les Réglages (#1197) et le Calendrier (#1199) ont
 * porté cette grammaire écran par écran sans jamais la figer : rien n'empêchait
 * une micro-capitale de revenir par copier-coller depuis une surface non encore
 * migrée. `megga-x-crm-tokens.spec.ts` verrouille les COULEURS et l'échelle CSS,
 * `calendar-palette.spec.ts` et `wizard-palette.spec.ts` les palettes d'écran —
 * personne ne gardait la composition.
 *
 * ── CLIQUET ──────────────────────────────────────────────────────────────────
 * `ZONES` ne liste que ce qui est PORTÉ. Chaque lot y ajoute sa surface en même
 * temps qu'il la nettoie ; une zone absente n'est pas déclarée propre, elle est
 * déclarée non traitée. « Mes biens » est couvert en entier depuis le lot 4.
 *
 * ⚠ Le MOBILE de « Mes biens » vit dans TROIS dossiers — `biens` (la liste),
 * `bien` (la fiche) et `wizard` (la création) —, quand le plan n'en nommait
 * qu'un. Troisième occurrence du même piège après le calendrier et la fiche
 * bureau : le nom d'une surface ne dit pas où elle est rangée.
 *
 * ⚠ CE QUE LA VITRINE FAIT, ELLE, DE LA CAPITALE — mesuré le 11.08.2026, et
 * gardé ici parce que la règle du projet s'en écarte SCIEMMENT. Sa feuille
 * uppercase à 5 endroits, tous des BADGES (`.utp---badge`,
 * `.badge-bg-secondary.v2`) ou l'utilitaire d'opt-in `.text-uppercase`
 * (`.06em`) — jamais un libellé, un sur-titre ni un titre. Les Réglages, le
 * Calendrier et les lots 2-3 sont allés à ZÉRO, badges compris. Réintroduire
 * l'idiome de badge serait donc un geste sur QUATRE surfaces migrées, pas une
 * exception locale : il se décide, il ne se glisse pas dans un lot.
 *
 * ── CE QUE LA RÈGLE DIT, ET D'OÙ ELLE SORT ───────────────────────────────────
 * Mesuré sur `src/styles/megga-x.generated.css`, la feuille de la vitrine :
 *
 * - **Aucune graisse au-dessus de 600.** Répartition réelle de la vitrine :
 *   500 (×31), 600 (×11), 400 (×7), 200 (×2), 300 (×1), 700 (×1). L'unique 700
 *   est `.megga-x strong` — de l'emphase en ligne dans de la prose, pas un
 *   titre. Les classes `.display-*` (14 → 72 px) ne posent AUCUNE graisse par
 *   défaut : elles héritent, et leurs deux modificateurs plafonnent à
 *   `.medium` (500) et `.semi-bold` (600). C'est donc la couleur d'encre qui
 *   porte la hiérarchie, pas la graisse.
 * - **Aucune micro-capitale**, et l'interlettrage POSITIF qui l'accompagne part
 *   avec elle : sur un mot en casse normale, un `letterSpacing` ≥ 0,4 le
 *   disloque. Le seuil laisse passer les valeurs NÉGATIVES — resserrer un titre
 *   d'affichage est un geste de la direction, pas une survivance.
 * - **Les tailles passent par `var(--crm-text-*)`**, jamais par un littéral
 *   (`CLAUDE.md` §3 : ~4 200 valeurs en variables sur 161 fichiers).
 */
import { describe, it, expect } from 'vitest'
import { emptyRoots, readFileSafely, rel, repoPath, scanRoots, type RootSpec } from './helpers/fs-scan'

/**
 * Surfaces PORTÉES. Un lot qui nettoie une zone l'ajoute ici, pas avant.
 *
 * ⚠ `crm-sugar-v3/vitrine` est la palette ET le kit de la FICHE bien, dont
 * `BienDetailSugarV4Page` est l'unique consommateur. Le plan de refonte ne la
 * listait pas — il rangeait la fiche avec la liste, sur la foi d'un grep qui ne
 * voyait que le fichier de page. Une surface n'est pas un dossier.
 *
 * ⚠ Les PAGES passent par leur dossier parent avec un filtre de nom :
 * `scanRoots` parcourt des répertoires, et une racine qui désigne un fichier
 * rendrait zéro — donc une zone verte par vacuité. `emptyRoots` l'attraperait,
 * mais mieux vaut ne pas poser le piège.
 */
const PAGES = new Set([
  'BienDetailSugarV4Page.tsx', 'BiensSugarV2Page.tsx',
  'ContactDetailSugarV3Page.tsx', 'ContactsSugarV2Page.tsx',
  // Le pager Matching et son conteneur d'atelier — les deux dernières surfaces
  // du périmètre bureau. `MatchingAtelierPage` était déjà propre (0 marqueur) ;
  // l'entrer quand même est ce qui empêche qu'il cesse de l'être.
  'MatchingPagerPage.tsx', 'MatchingAtelierPage.tsx',
  // Les trois pages du Pipeline (lot 3, 13 août 2026). `OfferModalSugarV3Page`
  // était déjà propre — 44 lignes qui ne font que monter la modale ; l'entrer
  // quand même est ce qui empêche qu'il cesse de l'être.
  'PipelineSugarV2Page.tsx', 'DealDetailSugarV4Page.tsx', 'OfferModalSugarV3Page.tsx',
  // « Aujourd'hui », la page d'accueil du CRM (lot A1, 15 août 2026). Elle ne
  // porte que le pager et le chrome — les deux pages vivent dans `today/`.
  'TodaySugarPage.tsx',
  // Les trois pages KYC (lot A2). `KycExportPage` et `KycOnboardingPage` sont
  // ROUTÉES — /dashboard/kyc/:id/export et kyc/bienvenue — et le plan du chantier
  // les avait ratées en groupant par DOSSIER : 15 marqueurs invisibles.
  'KycSugarV3Page.tsx', 'KycOnboardingPage.tsx', 'KycExportPage.tsx',
  'VisitModalSugarV3Page.tsx', 'VisitDetailSugarV3Page.tsx', 'DashboardSugarV4Page.tsx',
  'ImportLeadSugarV3Page.tsx', 'JulienSugarV2Page.tsx', 'JourneySugarV2Page.tsx', 'AuditSugarPage.tsx',
  'SettingsSugarV2Page.tsx', 'CalendarSugarV2Page.tsx',
  'ListingFormPage.tsx',
  // Lot 5 (15 août 2026) — les pages réputées PROPRES entrent enfin. Un cliquet
  // ne sert pas qu'à constater : il empêche qu'une surface cesse de l'être.
  // ⚠ `IdentitySugarPage` (14 lignes) et `AuthCallbackPage` ne peignent RIEN ;
  // `WizardSugarV2Page` et `KycReportRenderPage` sont en styles en ligne, donc
  // pleinement vues ; les autres sont en CLASSES et ne sont mesurées que sur la
  // casse, la graisse et l'interlettrage — voir l'inventaire de cécité plus bas.
  'ExternalListingDetailPage.tsx', 'IdentityMobileNotice.tsx', 'IdentitySugarPage.tsx',
  'OnboardingCallPage.tsx', 'WizardSugarV2Page.tsx',
])

/**
 * ⛔ LE CLIQUET NE COUVRAIT PAS `PAGES`, et un contrôle négatif l'a montré.
 *
 * « le cliquet ne recule pas » vérifiait les racines de `ZONES`, puis affirmait
 * que chaque entrée de `PAGES` est bien BALAYÉE — en itérant `PAGES` elle-même.
 * Retirer une page de l'ensemble faisait donc disparaître à la fois la surface
 * ET son assertion : tout restait vert. Une page pouvait quitter le cliquet en
 * silence, ce qui est exactement le mode d'échec que le cliquet existe pour
 * empêcher côté dossiers.
 *
 * Cette liste est écrite À PART, en dur : elle ne peut pas rétrécir avec
 * `PAGES`. Même idiome que la liste des racines acquises.
 */
const PAGES_ACQUISES = [
  'BienDetailSugarV4Page.tsx', 'BiensSugarV2Page.tsx',
  'ContactDetailSugarV3Page.tsx', 'ContactsSugarV2Page.tsx',
  'MatchingPagerPage.tsx', 'MatchingAtelierPage.tsx',
  'PipelineSugarV2Page.tsx', 'DealDetailSugarV4Page.tsx', 'OfferModalSugarV3Page.tsx',
  'TodaySugarPage.tsx',
  'KycSugarV3Page.tsx', 'KycOnboardingPage.tsx', 'KycExportPage.tsx',
  'VisitModalSugarV3Page.tsx', 'VisitDetailSugarV3Page.tsx', 'DashboardSugarV4Page.tsx',
  'ImportLeadSugarV3Page.tsx', 'JulienSugarV2Page.tsx', 'JourneySugarV2Page.tsx', 'AuditSugarPage.tsx',
  'SettingsSugarV2Page.tsx', 'CalendarSugarV2Page.tsx',
  'ListingFormPage.tsx',
  // Lot 5 (15 août 2026) — les pages réputées PROPRES entrent enfin. Un cliquet
  // ne sert pas qu'à constater : il empêche qu'une surface cesse de l'être.
  // ⚠ `IdentitySugarPage` (14 lignes) et `AuthCallbackPage` ne peignent RIEN ;
  // `WizardSugarV2Page` et `KycReportRenderPage` sont en styles en ligne, donc
  // pleinement vues ; les autres sont en CLASSES et ne sont mesurées que sur la
  // casse, la graisse et l'interlettrage — voir l'inventaire de cécité plus bas.
  'ExternalListingDetailPage.tsx', 'IdentityMobileNotice.tsx', 'IdentitySugarPage.tsx',
  'OnboardingCallPage.tsx', 'WizardSugarV2Page.tsx',
]

/**
 * « Contacts » est couvert EN ENTIER depuis le lot 4 (12 août 2026) : le
 * dossier a été porté fichier par fichier — les deux pagers au lot 2, la modale
 * de création au lot 3, la modale WhatsApp, l'écran de premier lancement et les
 * glyphes au lot 4 — et le filtre nommé qui servait de compteur pendant le
 * chantier a disparu avec le dernier fichier.
 *
 * ⚠ `ContactsFirstRun` est mono-thème PAR DÉCISION (fond sombre permanent,
 * textes blancs en dur quel que soit le thème, comme `BiensFirstRun` et la
 * couverture Pipeline). L'exception couvre ses COULEURS, pas sa grammaire : ses
 * graisses sont descendues comme partout ailleurs, et son fond a seulement
 * changé d'ALPHABET — `#0A0B0D` → `MXC_COLOR.n100`, le geste exact de
 * `BiensFirstRun`. Il reste fixe ; il ne suit toujours pas le thème.
 */

/**
 * Pages de la face PUBLIQUE entrées au cliquet. Elles ne vivent PAS dans
 * `src/pages/agent`, donc elles ne peuvent pas passer par `PAGES` : c'est une
 * seconde racine, avec son propre filtre et sa propre liste acquise.
 *
 * ⚠ Les huit pages publiques restantes rendent 0 marqueur AUJOURD'HUI, et ce
 * n'est pas un verdict : mesuré le 15 août 2026, elles sont peintes en CLASSES
 * (de 8 à 57 `className`, ZÉRO `style={{`) et cet instrument ne lit que les
 * styles EN LIGNE. Les entrer ici les déclarerait portées pendant qu'il ne
 * mesurerait rien — c'est la vacuité n°6, « la garde muette prise pour un
 * verdict ». Elles attendent d'être regardées, pas d'être inscrites.
 */
const PAGES_PUBLIQUES = new Set([
  // Lot 2 (15 août 2026). Autonome : son seul import de premier niveau était un
  // hook, et sa palette `RC` vient d'être extraite pour pouvoir être GARDÉE.
  'BuyerReceptionPage.tsx',
  // Lot 3 (15 août 2026). Les deux dernières pages publiques qui rendent des
  // marqueurs. `AppointmentManagePage` monte `kyc-magic-link/` — elle hérite
  // donc du gros du lot 1 et ne porte plus que ses propres littéraux ;
  // `AcceptInvitePage` ne porte AUCUNE couleur, une seule clause la fait rougir.
  'AppointmentManagePage.tsx', 'AcceptInvitePage.tsx',
  // Lot 5 — les neuf dernières pages publiques.
  'AuthCallbackPage.tsx', 'KycPublicPage.tsx', 'KycReportRenderPage.tsx',
  'NotFoundPage.tsx', 'OnboardingCallManagePage.tsx', 'PrivacyPage.tsx',
  'ResetPasswordPage.tsx', 'VisitFeedbackPage.tsx', 'VisitManagePage.tsx',
  'AuthBentoPage.tsx',
])

/** Écrite à part, en dur — elle ne peut pas rétrécir avec l'ensemble surveillé (n°15). */
const PAGES_PUBLIQUES_ACQUISES = [
  'BuyerReceptionPage.tsx', 'AppointmentManagePage.tsx', 'AcceptInvitePage.tsx',
  'AuthCallbackPage.tsx', 'KycPublicPage.tsx', 'KycReportRenderPage.tsx',
  'NotFoundPage.tsx', 'OnboardingCallManagePage.tsx', 'PrivacyPage.tsx',
  'ResetPasswordPage.tsx', 'VisitFeedbackPage.tsx', 'VisitManagePage.tsx',
  'AuthBentoPage.tsx',
]

// ⚠ Typé `RootSpec[]`, pas une forme recopiée à la main : l'ancienne annotation
// ne connaissait pas `keepPath`, donc TypeScript ne l'aurait PAS signalé si un
// lot l'avait mal orthographié — le filtre serait tombé en silence et la zone
// aurait aspiré les fichiers homonymes des autres lots.
const ZONES: RootSpec[] = [
  { root: 'src/components/crm-sugar-wizard', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/crm-sugar/biens', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/crm-sugar-v3/vitrine', keep: (n) => /\.tsx?$/.test(n) },
  // Le CRM mobile ENTIER depuis le 12 août 2026 — seize dossiers d'écrans, plus
  // la coquille et les primitives. Les trois dossiers de « Mes biens » y étaient
  // entrés seuls au lot 4 ; le reste portait encore 29 capitales, 295 graisses
  // ≥ 700, 22 interlettrages et 3 balises à graisse héritée.
  { root: 'src/components/crm-mobile', keep: (n) => /\.tsx?$/.test(n) },
  // ⚠ CHROME PARTAGÉ, pas une surface de « Mes biens ». `SugarShell` porte la
  // barre supérieure et le rail de TOUTE l'app agent — 30 fichiers le montent,
  // de Today aux Réglages. Il entre dans le cliquet parce qu'il est rendu EN
  // PERMANENCE sur les écrans portés, et qu'il est mesuré propre : 0 capitale,
  // 0 graisse ≥ 700, 0 interlettrage, 0 taille en dur, 0 noir Sugar. Son seul
  // hex hors échelle est `#e53935`, le compteur de notifications — sémantique,
  // même famille que `err`.
  // ⚠ CHROME PARTAGÉ — les fichiers posés À LA RACINE de `crm-sugar`, pas dans
  // ses sous-dossiers. `SugarShell` porte la barre supérieure, `LiquidGlassRail`
  // le rail et ses icônes animées, `tokens.ts` la palette que TOUT le CRM lit.
  //
  // ⛔ `keepPath` N'EST PAS UN ORNEMENT. `collect()` récurse et `keep` ne voit
  // que le nom de base : sans lui, retenir `'tokens.ts'` ramènerait AUSSI
  // `crm-sugar/analytics/tokens.ts` — une palette Sugar Pure complète (12 noirs
  // et gris-bleus) appartenant au lot Analytics, qui serait alors déclarée
  // portée sans que personne l'ait regardée. Mesuré avant d'écrire la zone.
  //
  // ⚠ `mockData.ts` et `sugarThemeVars.ts` ENTRENT au lot 1 du chantier « 100 % »
  // (15 août 2026), et ils ne sont pas un oubli qu'on répare : ils étaient les
  // deux SEULS fichiers de la racine que le `keep` nommé laissait dehors, ce qui
  // rendait la zone couverte « à quatre noms près ». Mesurés avant d'entrer : 0
  // marqueur sur les douze clauses. Les nommer coûte deux lignes et ferme le
  // dernier interstice de cette racine — après quoi la liste des noms EST le
  // contenu du dossier, et c'est ce qui la rend vérifiable.
  {
    root: 'src/components/crm-sugar',
    keep: (n) => ['SugarShell.tsx', 'LiquidGlassRail.tsx', 'tokens.ts', 'EtatVide.tsx', 'mockData.ts', 'sugarThemeVars.ts'].includes(n),
    keepPath: (p) => p.split('/').length === 4,
  },
  // Le chrome rendu par les 27 surfaces du CRM (lot 1 du chantier « CRM agent »,
  // 15 août 2026) : recherche, notifications, dropdown de profil.
  // « Aujourd'hui » — l'écran d'accueil du CRM, lot A1 (15 août 2026).
  //
  // ⚠ C'est le dossier le plus RÉCEMMENT écrit du reste (« concept H », page 0
  // installée après la bascule de direction) et il portait quand même 96
  // graisses ≥ 700. La grammaire MEGGA X n'est donc pas encore ce que la main
  // écrit par défaut — ce qui fait du cliquet le livrable qui compte, pas de la
  // passe.
  { root: 'src/components/crm-sugar/today', keep: (n) => /\.tsx?$/.test(n) },
  // KYC — lot A2 (15 août 2026), éclaté sur TROIS dossiers. Le nom d'une surface
  // ne dit pas où elle est rangée : `kyc` (la palette et les cartes), `kyc-pager`
  // (les deux pages du pager) et `kyc-wizard` (l'entonnoir de collecte).
  //
  // ⚠ SURFACE DE CONFORMITÉ : le lot ne touche qu'à la COMPOSITION. Aucun libellé,
  // aucun seuil, aucun statut n'a changé — seulement la casse, la graisse,
  // l'interlettrage, l'échelle et les deux teintes proscrites.
  { root: 'src/components/crm-sugar-v3/kyc', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/crm-sugar-v3/kyc-pager', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/crm-sugar-v3/kyc-wizard', keep: (n) => /\.tsx?$/.test(n) },
  // Visites (lot A3), Analytics (A4) et le parcours d'import de lead — les trois
  // dernières surfaces jamais portées de la vague A.
  //
  // ⚠ Analytics vit dans `analytics/`, PAS dans `dashboard/` : son nom de route
  // (/dashboard/analytics) et son nom de dossier ne coïncident pas, et sa page
  // s'appelle `DashboardSugarV4Page`. Troisième fois que le nom d'une surface ne
  // dit pas où elle est rangée.
  { root: 'src/components/crm-sugar-v3/visite-detail', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/crm-sugar-v3/audit', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/crm-sugar/analytics', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/crm-sugar/journey', keep: (n) => /\.tsx?$/.test(n) },
  // Vague B (16 août 2026) — les deux surfaces dont la COMPOSITION était déjà
  // portée et dont seule la COULEUR restait.
  //
  // ⚠ C'est le fait structurant du plan : « porté » recouvrait DEUX choses que le
  // cerveau confondait. Le Calendrier (#1199) n'avait plus UNE seule faute de
  // grammaire et portait encore douze couleurs ; les Réglages (#1197), douze
  // grammaires contre quarante-trois couleurs. Les traiter comme « à refaire »
  // aurait coûté dix fois leur prix.
  { root: 'src/components/crm-sugar/settings', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/crm-sugar/calendar', keep: (n) => /\.tsx?$/.test(n) },
  // Vague C — ce que le plan rangeait sous « Reste (pages) », et qui n'est pas un
  // reste : les deux sélecteurs d'affichage de la fiche bien (rendus par
  // `/dashboard/listings/:id/edit`) et le bandeau de consentement.
  //
  // ⚠ `ConsentGate` est du CHROME, pas une page : `ProtectedRoute` le monte sur
  // TOUTE route protégée. Le plan le comptait avec les pages parce qu'il vit dans
  // `layout/` ; c'est le ROUTAGE qui dit ce qu'il est.
  //
  // ⛔ `listings` ET `layout` PASSENT DE DEUX NOMS AU DOSSIER ENTIER (lot 1 du
  // chantier « 100 % », 15 août 2026), et c'est le même défaut des deux côtés :
  // une racine qui ne retient que les fichiers d'un lot déclare la zone traitée
  // pendant que ses voisins n'ont jamais été lus. `emptyRoots` ne peut pas le
  // voir — la racine rend bien des fichiers.
  //
  // ⚠ `layout` est du CHROME, et c'est ce qui rend l'écart grave : `App.tsx` et
  // `ProtectedRoute` montent ce dossier AU-DESSUS de `<Routes>`, donc sur les
  // surfaces déjà portées. Deux fichiers sur douze étaient mesurés ; les dix
  // autres — la coquille agent, le rideau de démarrage, la frontière d'erreur,
  // les deux bandeaux LAB, la transition de page, l'en-tête public — rendaient
  // sur des écrans que le cliquet déclarait propres.
  { root: 'src/components/listings', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/layout', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/crm-sugar/search', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/crm-sugar/notifications', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/crm-sugar/profile', keep: (n) => /\.tsx?$/.test(n) },
  // ⛔ LE DOCK MEGGA AI EST DU CHROME, ET AUCUN PLAN NE LE COMPTAIT. `App.tsx`
  // le monte par `CopilotPanelHost`, AU-DESSUS de `<Routes>`, donc sur TOUTE
  // route `/dashboard` — y compris les onze surfaces réputées portées. Mesuré le
  // 15 août 2026 : 114 marqueurs sur 8 fichiers, dont cinq modales de revue
  // presque identiques entre elles.
  { root: 'src/components/ai-copilot/panel', keep: (n) => /\.tsx?$/.test(n) },
  // ⚠ `StaleBundleDetector` avait sa propre racine `layout` — monté globalement
  // dans `App()`, au-dessus de tout le reste. Elle a fusionné avec la racine du
  // dossier entier, juste au-dessus : deux specs sur la même racine faisaient
  // lire ce fichier DEUX fois (`filesPerRoot` accumule en `+=`), et un doublon
  // dans le balayage compte double dans chaque clause.
  // « Contacts » EN ENTIER depuis le lot 4 — voir la note au-dessus de `PAGES`.
  { root: 'src/components/crm-sugar/contacts-pager', keep: (n) => /\.tsx?$/.test(n) },
  // Le Pipeline EN ENTIER depuis le lot 4 du chantier MEGGA X (13 août 2026).
  // ⚠ Sa dette était l'INVERSE de celle des pages : 62 graisses ≥ 700 et ZÉRO
  // taille littérale, quand les deux pages portaient 51 tailles. Un lot qui
  // recopierait l'ordre du chantier précédent chercherait la mauvaise chose.
  { root: 'src/components/crm-sugar/pipeline', keep: (n) => /\.tsx?$/.test(n) },
  // La modale d'offre et les jetons de la fiche deal — la part de `crm-sugar-v3`
  // que la chaîne Pipeline REND réellement.
  //
  // ⛔ ET SEULEMENT ELLE. `crm-sugar-v3` hors `vitrine` porte 199 marqueurs, dont
  // 176 dans `kyc-wizard`, `kyc-pager`, `visite-detail`, `audit` et
  // `primitives` : des écrans que ce chantier n'a jamais ouverts, qui n'ont
  // aucun banc, et que la décision de périmètre (§3.1 du plan, 13 août 2026) a
  // explicitement laissés dehors. Les entrer ici les déclarerait portés sans
  // que personne les ait regardés — l'inverse de ce à quoi sert un cliquet :
  // une zone absente n'est pas déclarée propre, elle est déclarée NON TRAITÉE.
  //
  // ⚠ `tokens.ts` (`SugarV3`) reste dehors pour la même raison, et c'est une
  // décision, pas un oubli : il porte deux noirs Sugar, mais il alimente onze
  // pages hors périmètre. Le reciblage de la chaîne Pipeline est passé par ses
  // palettes LOCALES, pas par lui — la mesure d'ouverture a montré que la fiche
  // ne lui prend qu'un formateur de date.
  {
    root: 'src/components/crm-sugar-v3',
    // ⚠ `primitives.tsx` entre au lot A0 (15 août 2026) — il est le socle des
    // quatre surfaces de la vague A (KYC, Visites, Audit, Import lead), pas du
    // chrome : mesuré, les 27 écrans du CRM ne le montent PAS, et
    // `BienDetailSugarV4Page`, la seule surface portée qui touche à ce dossier,
    // ne lui prend rien.
    //
    // ⛔ `tokens.ts` ENTRE au lot 2 du chantier KYC (16 août 2026), et la
    // décision qui le tenait dehors s'est PÉRIMÉE : elle disait « 13 lecteurs
    // dans des surfaces dont le lot n'est pas passé ». Mesuré à l'ouverture de
    // ce lot, les douze occurrences de `SugarV3.black` vivent TOUTES dans des
    // fichiers déjà balayés — `audit/`, `visite-detail/`, `kyc-wizard/` et trois
    // pages de `PAGES`. Le verrou annoncé n'existait plus ; seul le fichier de
    // jetons restait dehors, et avec lui le noir de Sugar, que la clause
    // `NOIRS` ne pouvait pas voir puisqu'elle ne lit que les fichiers BALAYÉS —
    // le littéral vivait ici, les écrans n'en lisaient que le NOM.
    //
    // ⚠ `keepPath` ancre les cinq noms sur le dossier IMMÉDIAT. Aucun homonyme
    // n'existe aujourd'hui, mais `collect()` RÉCURSE et `keep` ne voit que le
    // nom de base : c'est exactement ainsi qu'une racine `crm-sugar` retenant
    // `tokens.ts` avait ramené la palette d'Analytics (vacuité n° 23).
    keep: (n) => ['icons.tsx', 'dealStepper.ts', 'dealTokens.ts', 'primitives.tsx', 'tokens.ts'].includes(n),
    keepPath: (p) => p.split('/').length === 4,
  },
  // ⛔ LA FACE PUBLIQUE — la première zone de ce cliquet qui n'est PAS vue par
  // un agent (lot 1, 15 août 2026). `kyc-magic-link/` porte le parcours client
  // KYC (`/kyc/:token`) ET la gestion de rendez-vous (`/rendez-vous/:token`) :
  // 1 993 lignes, dont 1 008 pour `MlkScreens.tsx` seul.
  //
  // ⚠ ELLE N'ÉTAIT SOUS AUCUNE DES TRENTE RACINES, et c'est ce qui la
  // distingue des zones entrées jusqu'ici. Sur Analytics et le KYC agent, le
  // cliquet balayait déjà le dossier et ne mesurait « que » la composition ;
  // ici il ne le lisait pas du tout. Personne ne mesurait cette face — ni sa
  // composition, ni sa couleur (voir `mlk-contraste.spec.ts`, lot 0).
  //
  // ⚠ LE PIÈGE DE PÉRIMÈTRE ÉTAIT LE MÊME QU'AU CHANTIER KYC. `KycPublicPage`
  // rend ZÉRO marqueur — mesuré, elle ne porte ni `style={{` ni `className` —
  // et monte une zone qui en porte sept clauses. Grouper par DOSSIER, ou par
  // page, fait rater le périmètre : c'est le ROUTAGE qui dit ce qui est rendu.
  //
  // ⚠ SURFACE CLIENT : le lot ne touche qu'à la COMPOSITION. Aucun libellé,
  // aucune date de rendez-vous, aucune référence de dossier n'a changé —
  // seulement la casse, la graisse, l'interlettrage, l'échelle et le noir de
  // Sugar. Les trois PAGES publiques entrent plus tard, à leurs propres lots.
  { root: 'src/components/kyc-magic-link', keep: (n) => /\.tsx?$/.test(n) },
  // ⛔ LA PAGE **ET** SON MODULE DE JETONS (lot 2, 15 août 2026). Entrer la page
  // seule aurait suffi à faire passer la clause : les littéraux venaient d'être
  // sortis dans `receptionTokens.ts`, et le cliquet n'aurait plus vu que leur
  // NOM. C'est exactement le piège que `crm-sugar-v3/tokens.ts` a posé pendant
  // six lots — le noir de Sugar vivait dans le fichier de jetons, hors balayage.
  { root: 'src/pages/public', keep: (n) => PAGES_PUBLIQUES.has(n) },
  { root: 'src/components/buyer-reception', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/crm-sugar-v3/offer-modal', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/pages/agent', keep: (n) => PAGES.has(n) },
  // ⛔ « Matching · Recherche » entre SANS `MrhMapView.tsx`. La carte est GELÉE
  // par décision (13 août 2026) : le jeton Mapbox est absent du build, donc la
  // branche qui rend réellement est la carte SCHÉMATIQUE — fond dessiné,
  // pastilles de prix positionnées depuis les bornes, survol avec aperçu. Ce
  // n'est pas un carré gris, c'est la surface que l'agent utilise, avec ses
  // couleurs propres (#0F131A / #E9EDF2, eau et parcs en rgba) qui ne sortent
  // d'aucun système de jetons. L'exclure ici est ce qui rend le gel VÉRIFIABLE :
  // une exemption écrite, pas un oubli qu'on relèverait à la relecture.
  // ⛔ `MrhMapView` ENTRE AU LOT 3 (15 août 2026), ET LE GEL AVAIT PERDU SON
  // MOTIF SANS QUE PERSONNE LE VOIE. L'exclusion disait : « le jeton Mapbox est
  // absent du build, donc la branche qui rend réellement est la carte
  // SCHÉMATIQUE ». Mesuré sur l'issue #1061 : son constat n° 1 est ✅ RÉSOLU
  // depuis le 3 août — `VITE_MAPBOX_TOKEN` est posé et inliné dans le bundle,
  // donc en PRODUCTION c'est la carte réelle qui rend. Le motif était vrai à
  // l'écriture et faux deux jours plus tard ; rien ne le disait, parce qu'une
  // exemption ne se relit pas.
  //
  // ⚠ CE QUI RESTE VRAI, ET CE QUI NE L'EST PAS. Le repli schématique rend
  // encore en DEV (le jeton est restreint par referrer, 403 depuis
  // localhost:5173), et ses couleurs de fond — `#0F131A` / `#E9EDF2`, l'eau et
  // les parcs en rgba — ENCODENT une carte : elles ne sortent d'aucun système de
  // jetons et ne le peuvent pas. Mais mesuré site par site, les 40 marqueurs du
  // fichier ne sont PAS cartographiques : les 7 gris-bleus et 2 noirs de Sugar
  // sont des ombres de BOUTONS DE ZOOM, de pastilles de score et d'aperçus au
  // survol — du chrome posé SUR la carte. L'exemption couvrait tout un fichier
  // pour protéger une poignée de teintes de fond.
  { root: 'src/components/matching-recherche', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/matching-atelier', keep: (n) => /\.tsx?$/.test(n) },
  // Les 19 pages de la console super-admin (lot 3 du chantier MEGGA X,
  // 14 août 2026). Le dossier ENTIER, pas une liste de noms : les 19 fichiers
  // ont été traités, et un vingtième qui arriverait doit l'être aussi.
  //
  // ⚠ Leur dette était l'inverse de celle du dossier de composants du Pipeline,
  // et c'est la deuxième fois que la mesure contredit l'ordre attendu : 208
  // tailles littérales ici contre ZÉRO côté composants admin, qui portent eux
  // 45 graisses. Recopier l'ordre du chantier précédent aurait fait chercher la
  // mauvaise chose.
  //
  // ⛔ ET LE CLIQUET NE VOYAIT PAS `AdminKybReviewPage`. Elle rendait 0 marqueur
  // sur 1 502 lignes — non pas parce qu'elle était propre, mais parce qu'elle
  // était peinte en CLASSES (154 `className`, 0 `style={{`) et que cet
  // instrument ne lit que les styles EN LIGNE. Un silence n'est pas un verdict.
  // Elle est passée au style en ligne au même lot, ce qui la rend VISIBLE ici.
  { root: 'src/pages/admin', keep: (n) => /\.tsx?$/.test(n) },
  // Le chrome et les atomes de la console (lot 4, 14 août 2026).
  //
  // ⚠ UNE SEULE racine, et `kit/` est dedans : `collect()` RECURSE. Le lot 4
  // avait ajouté `src/components/admin/kit` en second, sur la croyance que le
  // balayage ne descendait pas — mesuré, les trois fichiers du kit étaient
  // alors lus DEUX fois (27 entrées pour 24 fichiers). Une croyance sur le
  // comportement d'un helper se vérifie dans le helper, pas dans sa docstring.
  // Le kit reste nommé plus bas, en TÉMOIN de balayage : c'est ce qui prouve
  // que la récursion l'atteint vraiment.
  //
  // ⚠ Leur dette est celle des composants du Pipeline, pas celle des pages
  // d'à côté : 58 graisses ≥ 700 et DEUX tailles littérales seulement. La même
  // console porte donc les deux dettes opposées, chacune de son côté de la
  // frontière page/composant.
  { root: 'src/components/admin', keep: (n) => /\.tsx?$/.test(n) },
  // ── Lot 1 du chantier « MEGGA X à 100 % » (15 août 2026) ────────────────────
  //
  // ⛔ CE QUI SE FERME ICI N'EST PAS UNE DETTE, C'EST UN SILENCE. Ces sept zones
  // rendent ZÉRO marqueur sur les douze clauses — mesuré avant de les écrire, et
  // c'est précisément pourquoi elles entrent : une zone absente n'est pas
  // déclarée propre, elle est déclarée NON TRAITÉE, et personne ne peut lire la
  // différence dans un fichier vert. Les entrer coûte sept lignes et transforme
  // « on n'a pas regardé » en « on garde ».
  //
  // ⚠ ET LE COMPTE DU PLAN ÉTAIT FAUX SUR SIX ZONES SUR TREIZE. Il additionnait
  // graisses + capitales + polices, en laissant dehors les tailles hors échelle,
  // les interlettrages, le noir de Sugar et le gris-bleu : `kyc-report` sortait à
  // 45 pour 104 réels, `auth-bento` à 1 pour 24. Un compte de marqueurs est un
  // compte de CLAUSES — écrire lesquelles, sans quoi deux mesures du même dossier
  // ne se comparent pas.
  //
  // ⚠ `crm-sugar-identity` : l'écart annoncé par le plan est TRANCHÉ, et il
  // n'existait pas. Un agent y annonçait « 9 polices en dur » ; le dossier ne
  // contient AUCUN `fontFamily` ni `font:` — zéro au grep brut sur ses neuf
  // fichiers. L'écart venait de la clause des polices, qui ne connaît que
  // `Inter Tight|DM Sans` et à qui Manrope est invisible : compter « les polices
  // en dur » et appliquer la clause ne mesurent pas la même chose. C'est la
  // vacuité n°46 par l'autre bout — là un NOM de jeton aveuglait la garde, ici
  // c'est un nom de POLICE, et il fait sur-compter au lieu de sous-compter.
  { root: 'src/components/ui', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/propertyx', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/onboarding-call', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/skeletons', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/auth', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/map', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/crm-sugar-identity', keep: (n) => /\.tsx?$/.test(n) },
  // ⚠ `auth-bento` — UNE route vivante sur huit coquilles exportées, et les sept
  // autres ont été retirées au même lot. Elle entre au cliquet plutôt que d'être
  // exemptée parce que `/auth/forgot-password/reset` est une surface CLIENT,
  // servie sans compte : le motif « coquille morte » ne couvre pas le chemin qui
  // rend encore. Voir l'en-tête de `src/pages/public/AuthBentoPage.tsx` pour ce
  // que `lint:deadcode` ne voyait pas.
  { root: 'src/components/auth-bento', keep: (n) => /\.tsx?$/.test(n) },
  // ── Lot 3 · les bancs QUI PARTENT EN PRODUCTION ─────────────────────────────
  //
  // ⛔ LE PLAN VOULAIT EXEMPTER `src/pages/dev` EN BLOC, au motif que ce sont des
  // « bancs `import.meta.env.DEV`, jamais servis ». Mesuré dans le bundle
  // construit : HUIT des douze pages ont un chunk dans `dist/assets/`, les
  // quatre autres zéro. Le motif était faux pour les deux tiers du dossier — et
  // une exemption au motif faux est PIRE qu'une absence : une absence se
  // questionne, un motif écrit se croit.
  //
  // Sept de ces huit entrent donc ici comme n'importe quelle surface livrée :
  // ils sont routés sur `app.megga.ch`. Ils ne coûtent que CINQ marqueurs.
  //
  // ⚠ CE N'EST PAS UN AVIS SUR LEUR PRÉSENCE EN PRODUCTION. Que
  // `/dev/sentry-test` — qui déclenche des erreurs Sentry — soit joignable est
  // une question de PRODUIT, posée à part. Ici on constate seulement qu'un
  // fichier livré ne peut pas être exempté au motif qu'il ne l'est pas.
  //
  // ⚠ QUATRE DES CINQ NOMS EXCLUS PORTENT LEUR MOTIF dans `EXEMPTIONS_ECRITES` :
  // ils sont absents du bundle, et la garde `dev-bancs-frontiere.spec.ts` mesure
  // le ternaire qui les en tient absents.
  //
  // ⛔ LE CINQUIÈME EST EXCLU SANS EXEMPTION ÉCRITE, ET C'EST DÉLIBÉRÉ.
  // `MeggaXStyleGuidePage` sert `/design-system/megga-x` — la seule route de
  // design system survivante, et le port de la vitrine. Le mesurer contre la
  // direction qu'il DÉFINIT serait circulaire, mais cette exemption « de
  // nature » n'est pas tranchée : elle est posée à Julien avec celle de
  // `src/components/megga-x` (18 porteurs, même argument). Tant qu'elle ne l'est
  // pas, ce fichier reste une SORTIE NON MOTIVÉE — l'axe A n'est donc pas clos,
  // et la clause de fermeture du dernier lot devra le nommer plutôt que le
  // laisser passer. Écrire un motif ici reviendrait à trancher à sa place.
  {
    root: 'src/pages/dev',
    keep: (n) =>
      /\.tsx$/.test(n) &&
      !['PublicShowcasePage.tsx', 'OnboardingPreviewPage.tsx', 'AdminShowcasePage.tsx',
        'CrmShowcasePage.tsx', 'MeggaXStyleGuidePage.tsx'].includes(n),
  },
]

/**
 * Un fichier par zone acquise RÉCEMMENT, dont on exige qu'il soit réellement
 * balayé.
 *
 * ⛔ `emptyRoots` n'attrape qu'une racine qui ne rend AUCUN fichier. Une racine
 * qui en rend quelques-uns pendant qu'un sous-dossier entier échappe au filtre
 * lui paraît saine — et c'est exactement la forme que prend une régression de
 * couverture. Même idiome que `PAGES_ACQUISES`, appliqué aux dossiers.
 */
const TEMOINS_DE_ZONE = [
  'src/pages/admin/AdminKybReviewPage.tsx',
  'src/components/admin/AdminShell.tsx',
  'src/components/admin/kit/adminKit.tsx',
  // Chrome (lot 1, 15 août 2026). `tokens.ts` et `LiquidGlassRail.tsx` sont
  // nommés parce qu'ils passent par un `keepPath` : si ce filtre se resserrait
  // par accident, la zone rendrait encore des fichiers et `emptyRoots` la
  // croirait saine.
  'src/components/crm-sugar/tokens.ts',
  'src/components/crm-sugar/LiquidGlassRail.tsx',
  // ⚠ `crm-sugar-v3/tokens.ts` passe lui aussi par un `keepPath` (lot 2, 16 août
  // 2026) : si ce filtre se resserrait par accident, la racine rendrait encore
  // ses quatre autres fichiers et `emptyRoots` la croirait saine — pendant que
  // le fichier de jetons, celui qui porte les couleurs, serait sorti du balayage.
  'src/components/crm-sugar-v3/tokens.ts',
  'src/components/crm-sugar/today/PageAujourdhuiH.tsx',
  'src/components/crm-sugar/search/CrmSugarSearch.tsx',
  'src/components/crm-sugar/notifications/SugarNotificationsPopover.tsx',
  'src/components/crm-sugar/profile/SugarProfileDropdown.tsx',
  'src/components/ai-copilot/panel/CopilotPanel.tsx',
  'src/components/layout/StaleBundleDetector.tsx',
  // ⚠ La zone la plus lourde du lot 1 : si le filtre de la face publique se
  // resserrait par accident, la racine rendrait encore ses cinq autres fichiers
  // et `emptyRoots` la croirait saine.
  'src/components/kyc-magic-link/MlkScreens.tsx',
  'src/components/buyer-reception/receptionTokens.ts',
  // Lot 1 du chantier « 100 % » (15 août 2026). Deux témoins, deux raisons
  // DISTINCTES — un témoin qui ne prouve rien de plus qu'`emptyRoots` est du
  // bruit, et cette liste ne vaut que si chaque entrée nomme un mode d'échec
  // qu'`emptyRoots` laisse passer :
  //
  // · `mockData.ts` passe par le `keep` NOMMÉ de la racine `crm-sugar` ET par
  //   son `keepPath`. Si l'un des deux se resserrait, la racine rendrait encore
  //   ses cinq autres fichiers et `emptyRoots` la croirait saine.
  'src/components/crm-sugar/mockData.ts',
  // · `steps/StepAgence.tsx` vit dans un SOUS-DOSSIER. C'est la preuve que la
  //   récursion de `collect()` atteint `crm-sugar-identity/steps/` — cinq des
  //   neuf fichiers de la zone y vivent, et une racine qui ne rendrait que les
  //   quatre du premier niveau ne serait pas vide.
  'src/components/crm-sugar-identity/steps/StepAgence.tsx',
]

/**
 * ⛔ LES ZONES QUI SONT DEHORS *PAR DÉCISION* — et « absent » n'en est pas une.
 *
 * Un lecteur de `ZONES` qui cherche `kyc-report` ne trouve rien, et rien ne
 * distingue « exempté après mesure » de « jamais regardé ». C'est le mode
 * d'échec que tout ce fichier existe pour empêcher, laissé ouvert du côté des
 * SORTIES : le cliquet dit ce qu'il couvre, jamais pourquoi il ne couvre pas.
 *
 * ⚠ CE N'EST PAS UNE LISTE TÉMOIN DE PLUS (n°50). Une seconde liste qui
 * répéterait « kyc-report est dehors » serait désarmée par une édition
 * cohérente — on la retirerait en même temps que la racine. Ici la clause
 * confronte à un TIERS : le fichier de garde doit EXISTER et NOMMER la zone.
 * Supprimer la garde, ou la vider de sa zone, fait rougir le cliquet ; et la
 * garde, de son côté, refuse déjà que la zone entre dans `ZONES`. Les deux
 * verrous tiennent des choses différentes, dans des fichiers différents.
 *
 * ⛔ ET LA MESURE CONTREDIT LE PLAN QUI M'ENVOYAIT ICI. Il donnait `kyc-report`
 * pour « le trou le plus grave », resté hors de toute racine, à 45 marqueurs.
 * Mesuré : 104 marqueurs — et le chiffre 104 était DÉJÀ écrit, avec son
 * raisonnement, dans `kyc-report-frontiere.spec.ts`, commis quatre-vingt-dix
 * commits plus tôt. La zone n'était pas un oubli : c'est l'exemption la plus
 * argumentée du dépôt, et elle porte un déclencheur qui refuse son entrée. Le
 * lot qui aurait « bouché le trou » aurait repeint 104 marqueurs corrects et
 * changé la mise en page d'un document vu par des clients et des autorités.
 */
const EXEMPTIONS_ECRITES: { zone: string; motif: string; garde: string }[] = [
  {
    zone: 'src/components/kyc-report',
    motif:
      'du PAPIER : `PDF_W`/`PDF_H` valent A4 à 96 DPI exactement, la mise en page est en ' +
      'pixels absolus qui valent des millimètres. Ses sur-titres à 9,5 px en capitales ' +
      'espacées sont de la typographie d’imprimé, pas une survivance de Sugar — et aucun ' +
      'barreau de `--crm-text-*` ne vaut 9,5. La COMPOSITION suit le support ; le COLORIS, ' +
      'lui, ne dépend pas du support et reste gardé (noir de Sugar et gris-bleu proscrits).',
    garde: 'tests/unit/kyc-report-frontiere.spec.ts',
  },
  // ── Lot 3 · les quatre bancs ABSENTS DU BUNDLE ─────────────────────────────
  // Un seul motif pour les quatre, et il est MESURÉ : `import.meta.env.DEV` est
  // remplacé par `false` au build, donc la branche d'import disparaît et Vite
  // n'émet aucun chunk. Vérifié dans `dist/assets/` : zéro chunk pour ces
  // quatre, deux pour chacun des huit autres. La garde, elle, ne mesure pas le
  // bundle — elle mesure le TERNAIRE dans `App.tsx`, qui en est la cause et se
  // vérifie sans construire.
  ...['PublicShowcasePage', 'OnboardingPreviewPage', 'AdminShowcasePage', 'CrmShowcasePage'].map((n) => ({
    zone: `src/pages/dev/${n}.tsx`,
    motif:
      `banc de développement ABSENT du bundle : sa déclaration passe par le ternaire ` +
      `\`import.meta.env.DEV\`, remplacé par \`false\` au build, donc Vite n'émet aucun chunk ` +
      `pour lui — mesuré dans dist/assets/. Il n'est jamais servi sur app.megga.ch, et ` +
      `\`${n}\` sème en plus un état (session, intercepteur de fetch) qui n'a aucune excuse ` +
      `dans un bundle déployé.`,
    garde: 'tests/unit/dev-bancs-frontiere.spec.ts',
  })),
  // ── Lot 3 · L'EXEMPTION DE NATURE (tranchée par Julien le 15 août 2026) ─────
  //
  // ⛔ CELLE-CI N'EST PAS DE MÊME ESPÈCE QUE LES AUTRES. Les trois précédentes
  // disent « cette zone n'est pas mesurable par cet instrument » — du papier, un
  // fichier absent du bundle. Celle-ci dit « cette zone EST l'instrument ». Le
  // cliquet mesure les surfaces CONTRE la direction MEGGA X ; le port de la
  // vitrine la DÉFINIT, donc l'y mesurer est circulaire : un écart y serait, par
  // construction, la direction qui change d'avis, jamais une régression.
  //
  // ⚠ ELLE NE REPOSE PAS SUR « LA ZONE EST PROPRE ». Elle l'est — 0 marqueur sur
  // 23 fichiers, mesuré — et c'est rassurant, mais ce n'est PAS le motif : une
  // zone propre entre au cliquet, précisément pour qu'elle le reste. Confondre
  // les deux ferait de « c'est vert » un motif d'exemption, ce qui les rendrait
  // toutes acceptables.
  //
  // ⛔ ET SA CONTREPARTIE EST CE QUI L'EMPÊCHE D'ÊTRE UN BLANC-SEING. Une
  // direction exemptée de son propre cliquet doit être gardée AUTREMENT, sinon
  // « exempté » veut dire « personne ne regarde » : `megga-x.generated.css`,
  // 10 571 lignes et 100 % de la DA, n'était gardée par RIEN. La garde nommée
  // vérifie que le fichier commis est exactement ce que le générateur produit,
  // qu'aucune `url()` ne pend, et qu'aucun `@import` réseau ne bloque le rendu.
  ...[
    { zone: 'src/components/megga-x', quoi: 'le port 1:1 de la vitrine' },
    { zone: 'src/pages/dev/MeggaXStyleGuidePage.tsx', quoi: 'sa vitrine, servie sur /design-system/megga-x' },
  ].map(({ zone, quoi }) => ({
    zone,
    motif:
      `exemption de NATURE : ${quoi}. Le cliquet mesure les surfaces CONTRE la direction ` +
      `MEGGA X ; ce code la DÉFINIT, donc l'y mesurer est circulaire — un écart y serait la ` +
      `direction qui change d'avis, pas une régression. ⚠ Le motif n'est PAS « la zone est ` +
      `propre » (elle l'est, 0 marqueur sur 23 fichiers) : une zone propre entre au cliquet ` +
      `pour qu'elle le reste. Contrepartie, sans quoi l'exemption serait un blanc-seing : la ` +
      `feuille générée est gardée sur sa SOURCE — fichier commis identique au produit du ` +
      `générateur, zéro url() pendante, zéro @import réseau.`,
    garde: 'tests/unit/megga-x-source-frontiere.spec.ts',
  })),
  // ── Lot 5 · les trois FEUILLES de la direction, même motif ─────────────────
  // Le réflexe était de tokeniser leurs `font-size` sur `--crm-text-*`. Mesuré
  // avant de le faire : la feuille de la vitrine ne déclare AUCUNE variable de
  // taille de texte — une seule variable typographique, `--main-font` — et écrit
  // elle-même 141 `font-size` en px. Écrire un px dans une règle `.megga-x` est
  // donc ce que la direction FAIT ; y imposer l'échelle du CRM importerait le
  // vocabulaire du CRM dans la SOURCE de la direction.
  ...['megga-x.css', 'megga-x.generated.css', 'megga-x-additions.css'].map((n) => ({
    zone: `src/styles/${n}`,
    motif:
      `exemption de NATURE, même motif que src/components/megga-x : cette feuille EST la ` +
      `direction, exprimée dans SON vocabulaire. La vitrine ne déclare aucune variable de ` +
      `taille de texte et écrit 141 font-size en px ; lui imposer --crm-text-* serait ` +
      `importer l'échelle du CRM dans la source dont il descend. ⚠ L'exemption porte sur ` +
      `l'ÉCHELLE, pas sur tout : la garde exige que la feuille générée soit le produit exact ` +
      `du générateur, qu'aucune url() ne pende, qu'aucun @import réseau ne bloque le rendu, ` +
      `et que chaque règle des ajouts reste scopée .megga-x — une règle qui fuirait peindrait ` +
      `des surfaces que le cliquet mesure, avec un vocabulaire qu'il n'admet pas.`,
    garde: 'tests/unit/megga-x-source-frontiere.spec.ts',
  })),
]

/**
 * ⛔ LOT 5 · LA GRAMMAIRE DANS LES FEUILLES CSS — le QUATRIÈME langage.
 *
 * Trois notations étaient lues : le style en ligne (`fontWeight:`), la classe
 * (`font-bold`), l'attribut JSX (`fontWeight="800"`). La quatrième — une FEUILLE
 * `.css` — ne l'était pas du tout. Une seule clause y touchait, et seulement
 * pour les `<style>` posés DANS un `.tsx`.
 *
 * ⚠ TROUVÉ À L'ÉCRAN, PAS PAR LECTURE. En vérifiant le lot 3c sur
 * `/dev/matching-atelier`, 43 éléments rendaient une graisse ≥ 700 qu'aucune
 * clause ne voyait — `.sgk-title`, `.eyebrow`, `.big.nums`. Elles vivent dans
 * `atelier.css`, et `matching-atelier` est au cliquet depuis le 13 août : la
 * zone était DÉCLARÉE COUVERTE pendant que toute sa grammaire lui échappait.
 *
 * ── DEUX PIÈGES, DÉJÀ CONNUS DU DÉPÔT, ET QUI ONT FAILLI ÊTRE REPRODUITS ─────
 * Mon relevé brut donnait 6 graisses ≥ 700 dans `globals.css` et un gris-bleu
 * dans `admin-console.css`. Les deux sont FAUX :
 *
 *  · les six graisses sont des descripteurs `@font-face` — elles déclarent quel
 *    FICHIER Objectivity fournit quelle graisse. Interdire ça reviendrait à
 *    interdire de livrer une police en gras. Les blocs `@font-face` sont donc
 *    neutralisés, comme `collect()` neutralise les keyframes ;
 *  · le gris-bleu vit dans le COMMENTAIRE qui explique son retrait. C'est la
 *    forme n°16 : la garde désarmée par sa propre documentation.
 *
 * Après correction : `globals.css`, `admin-console.css`, `mrh.css` et
 * `megga-x.css` rendent ZÉRO. La dette réelle est de 146 marqueurs, dont 143
 * dans une seule feuille.
 */
/**
 * Rend le CSS tel que la clause doit le lire : sans commentaires (n°16) et sans
 * les blocs `@font-face`, dont les `font-weight` sont des descripteurs.
 * Les deux préservent le compte de lignes — un `fichier:ligne` faux coûte plus
 * cher qu'il ne rapporte.
 */
function cssLisible(css: string): string {
  const garderLignes = (bloc: string) => '\n'.repeat((bloc.match(/\n/g) ?? []).length)
  return css.replace(/\/\*[\s\S]*?\*\//g, garderLignes).replace(/@font-face\s*\{[^}]*\}/g, garderLignes)
}

/**
 * Feuille → ce qu'elle porte ENCORE, par espèce. Cliquet à plafond décroissant :
 * le compte ne peut que baisser, et le test suivant refuse toute entrée devenue
 * trop haute.
 *
 * ⛔ POURQUOI UN INVENTAIRE ET NON UNE PASSE. `atelier.css` fait 964 lignes et
 * porte 143 marqueurs : les corriger dans le lot qui POSE la clause noierait la
 * clause dans le diff, et 47 de ses tailles sont hors échelle — donc 47
 * arbitrages visuels sur une surface que l'agent utilise. C'est la conduite que
 * le plan prescrit pour les zones surdimensionnées, appliquée ici.
 *
 * ⚠ `responsive.css` : ses TROIS tailles appartiennent à des sélecteurs MORTS.
 * Mesuré — `.sg-h1`, `.sg-stat-value` et `.sg-grid-coords` n'ont aucun porteur
 * dans `src/`, aucune composition dynamique de classe, et sont absents du
 * bundle construit ; 9 des 15 sélecteurs de cette feuille sont dans ce cas,
 * alors qu'elle est importée par `main.tsx` donc chargée PARTOUT. Ses six
 * sélecteurs vivants ne portent, eux, aucun marqueur. Le retrait de la feuille
 * est une décision de PRODUIT, posée et non prise ici — d'où l'inventaire.
 */
const CSS_ASSUME = new Map<string, { graisse?: number; capitale?: number; interlettrage?: number; taille?: number }>([
  ['src/components/matching-atelier/atelier.css', { graisse: 44, capitale: 5, interlettrage: 6, taille: 88 }],
  ['src/components/crm-sugar-v3/responsive.css', { taille: 3 }],
])

/** Les espèces mesurées dans une feuille, et le motif qui les reconnaît. */
const ESPECES_CSS: { nom: 'graisse' | 'capitale' | 'interlettrage' | 'taille'; voit: (ligne: string) => boolean }[] = [
  { nom: 'graisse', voit: (l) => /font-weight:\s*(700|800|900|bold)\b/.test(l) },
  { nom: 'capitale', voit: (l) => /text-transform:\s*uppercase/.test(l) },
  {
    nom: 'interlettrage',
    // Même seuil que la clause des styles en ligne : seul le POSITIF est visé,
    // et 0,04em vaut 0,4px sur un texte de 10 px.
    voit: (l) => {
      const m = l.match(/letter-spacing:\s*(-?[\d.]+)(px|em|rem)?/)
      if (!m) return false
      const v = Number(m[1])
      return !Number.isNaN(v) && v >= (m[2] === 'em' || m[2] === 'rem' ? 0.04 : 0.4)
    },
  },
  {
    nom: 'taille',
    // ⚠ On compte TOUTE taille littérale, pas seulement celles hors échelle : un
    // 14 px écrit en dur ne bougera pas si l'échelle bouge, et c'est la même
    // dette qu'un 14,5. Le détail « dont N hors échelle » vit dans la docstring,
    // là où il informe, pas dans le seuil, où il ferait deux règles.
    voit: (l) => /font-size:\s*[\d.]+px/.test(l),
  },
]

/**
 * ⛔ CE QUE `keepPath` DOIT LAISSER DEHORS, nommé plutôt que supposé.
 *
 * Le filtre de chemin de la zone `crm-sugar` existe pour une raison précise :
 * sans lui, `keep: n === 'tokens.ts'` ramenait la palette d'Analytics. Un test
 * qui se contenterait de vérifier la présence des témoins passerait au vert le
 * jour où le filtre disparaîtrait — c'est la vacuité n°22, « la couverture ne
 * repose plus sur rien ». On exige donc aussi l'ABSENCE.
 */
/**
 * Le gris-bleu slate-900 de Tailwind, sous ses deux alphabets.
 *
 * ⚠ Il n'a JAMAIS d'écriture hexadécimale dans le dépôt : il entre par une
 * fraction d'opacité. Le motif lit quand même `#0F172A` — une garde qui ne
 * connaît qu'une notation ne garde rien (c'est ainsi que le noir de Sugar avait
 * survécu onze fois en décimal).
 */
const GRIS_BLEU = /#0F172A\b|rgba?\(\s*15\s*,\s*23\s*,\s*42\b/i

/**
 * Fichier → nombre de gris-bleus ENCORE TOLÉRÉS. Relevé le 15 août 2026, sur
 * les zones que le cliquet déclarait déjà portées.
 *
 * ⚠ Ces 36 sites ne sont PAS une dette du lot 1 : ils appartiennent à des
 * surfaces livrées avant que quiconque garde cette teinte. Les corriger ici
 * repeindrait six zones dans un lot qui n'en regarde qu'une, et rendrait tout
 * diff ultérieur inattribuable. Chaque zone les emporte à son propre passage.
 *
 * ⛔ AUCUNE ENTRÉE POUR LE CHROME. Le lot 1 les a tous retirés : si un fichier
 * du chrome réapparaissait ici, ce serait une régression, pas une exemption.
 */
const GRIS_BLEU_ASSUMES = new Map<string, number>([
  ['src/components/crm-mobile/matching/MmMatchingScreen.tsx', 1],
  ['src/components/crm-mobile/more/MrNotifSheet.tsx', 1],
  ['src/components/crm-mobile/tokens.ts', 4],
  ['src/components/crm-sugar-v3/vitrine/vitrineTokens.ts', 3],
  ['src/components/crm-sugar-wizard/steps/Step4Photos.tsx', 1],
  ['src/components/crm-sugar-wizard/tokens.ts', 4],
  ['src/components/crm-sugar/biens/gallery/GalCard.tsx', 2],
  ['src/components/crm-sugar/biens/gallery/GalleryAtoms.tsx', 1],
  ['src/components/crm-sugar/biens/pager/BpFollowupPage.tsx', 4],
  ['src/components/crm-sugar/biens/pager/BpRenewModal.tsx', 1],
  ['src/components/crm-sugar/contacts-pager/ContactDetailPager.tsx', 1],
  ['src/components/crm-sugar/contacts-pager/ContactsPager.tsx', 4],
  ['src/components/crm-sugar/contacts-pager/NewContactModal.tsx', 5],
  ['src/pages/agent/BienDetailSugarV4Page.tsx', 4],
])

// ⚠ `today/data.ts` (lot A1) et `analytics/tokens.ts` (lot A4) en sont SORTIS
// à mesure que leurs zones entraient. Il ne reste que la vague B.
// Rédaction d'origine : `today/data.ts` en est sorti au lot A1 : la zone `today` est entrée dans le
// cliquet, donc ce fichier est désormais balayé LÉGITIMEMENT. C'est le test qui
// l'a signalé, pas une relecture — un garde qui décrit un état doit rougir quand
// l'état change, même si le changement est voulu.
const HORS_ZONE_ATTENDUS = [
]

/** La preuve que le scan voit encore l'arbre — sinon tout passe par vacuité. */
const TEMOIN = 'src/components/crm-sugar-wizard/steps/Step7Publish.tsx'

/**
 * Littéraux de taille assumés, EXPRESSION PAR EXPRESSION — pas par fichier.
 *
 * ⚠ Exempter un FICHIER est trop grossier : `primitives.tsx` porte à la fois une
 * taille calculée légitime et un `14.5 : 13` qui, lui, doit descendre sur
 * l'échelle. Une garde qui les couvre des deux d'un coup laisse passer ce
 * qu'elle prétend surveiller.
 *
 * Deux familles seulement, et rien d'autre :
 *
 * 1. **Au-dessus de l'échelle.** `--crm-text-*` s'arrête à 38 px (`9xl`). Ceux-ci
 *    sont des chiffres d'affichage — le prix, la saisie chiffrée, le titre de
 *    confirmation. La vitrine, elle, monte à 72 px sur ses `.display-*` : il y a
 *    donc une VRAIE question d'échelle derrière (faut-il prolonger `--crm-text-*`
 *    au-delà de 38 ?). Elle se décide, elle ne se règle pas au passage d'un lot
 *    de composition. `32 : 40` reste d'un bloc : 32 a bien un barreau (`7xl`),
 *    mais éclater les deux états d'un même titre entre un jeton et un littéral
 *    est pire que de les assumer ensemble.
 * 2. **Calculées.** Une taille qui suit son conteneur ne peut, par construction,
 *    pas être un barreau.
 */
/**
 * Interlettrages positifs assumés, EXPRESSION PAR EXPRESSION.
 *
 * La règle vise l'interlettrage qui accompagnait la micro-capitale : sur un mot
 * en casse normale, il le disloque. Mais DISLOQUER est parfois précisément ce
 * qu'on veut — un code qu'on lit caractère par caractère pour le recopier n'est
 * pas un mot, et le resserrer le rendrait plus dur à transcrire.
 *
 * ⚠ Cette liste ne doit accueillir que des suites de CARACTÈRES INDÉPENDANTS
 * (codes, empreintes). Un libellé, un sur-titre ou un titre n'y a rien à faire :
 * pour eux, l'interlettrage était la survivance, et il part.
 */
const INTERLETTRAGES_ASSUMES: { motif: RegExp; raison: string }[] = [
  {
    // ⚠ ANCRÉ SUR LA FORME, plus sur la valeur du jour. Le motif exigeait
    // `letterSpacing: 6` — celui de la modale WhatsApp de Contacts — et laissait
    // donc dehors le `8` de la carte d'appairage des Réglages, qui est le MÊME
    // geste sur le MÊME objet. Une exemption ancrée sur un littéral n'exempte
    // pas une famille, elle exempte un site par accident.
    motif: /fontVariantNumeric: 'tabular-nums'/,
    raison: 'un code en chiffres, lu et recopié caractère par caractère',
  },
  {
    // Même famille, autre marqueur : une police à chasse fixe dit qu'on lit la
    // suite caractère par caractère (secret 2FA, empreinte, clé de récupération).
    motif: /fontFamily: 'ui-monospace/,
    raison: 'une suite en chasse fixe — un secret, pas un mot',
  },
]

const TAILLES_ASSUMEES: { motif: RegExp; raison: string }[] = [
  {
    // ⚠ UNE seule entrée pour toute la famille. Plusieurs coefficients existent
    // (0,26 · 0,34 · 0,36 · 0,42) parce que les pastilles ont plusieurs
    // diamètres ; les lister un par un ferait grossir la liste sans rien
    // décider de plus.
    //
    // ⚠ Le motif ancrait sur le NOM `size`, et ratait donc `S * 0.34` —
    // l'avatar de `NewContactModal`, dont la prop s'appelle `S`. Une exemption
    // qui dépend du nom d'une variable locale n'exempte pas une famille, elle
    // exempte un fichier par accident. C'est la FORME qui définit la famille :
    // une taille qui suit son conteneur ne peut pas être un barreau.
    //
    // ⚠ ET IL ANCRAIT AUSSI SUR L'ENVELOPPE. Il connaissait `Math.max(…)` mais
    // pas `Math.round(…)` — l'avatar du kit admin, dont le calcul est le MÊME à
    // l'arrondi près. Même défaut d'un cran plus haut : le nom de la fonction
    // enveloppante n'est pas plus la famille que le nom de la variable. Toute
    // enveloppe `Math.*` est donc admise ; ce qui définit la famille reste
    // « une taille PROPORTIONNELLE à autre chose ».
    motif: /fontSize:\s*(?:Math\.\w+\([^)]*?)?\w+ \* 0\.\d+/,
    raison: 'calculée : une initiale suit le diamètre de sa pastille',
  },
  { motif: /fontSize:\s*104\b/, raison: '104 px — le prix en grand, au-dessus du dernier barreau' },
  { motif: /fontSize:\s*72\b/, raison: '72 px — la saisie chiffrée en grand, au-dessus du barreau' },
  { motif: /fontSize:\s*q === 6 \? 32 : 40\b/, raison: '32/40 px — un même titre à deux densités' },
  {
    // ⚠ RAISON RÉÉCRITE LE 14 AOÛT 2026, et c'est une correction de garde, pas
    // de code. Elle disait « le titre de confirmation » — un site — alors que
    // le motif est ancré sur une VALEUR et couvre donc une famille : trois
    // sites dans les zones du cliquet (le titre de l'étape 8 du wizard, le
    // compteur du premier lancement de « Mes biens », le MRR du poste de
    // plans). Une exemption dont la raison nomme un site pendant que son motif
    // en couvre trois exempte les deux autres PAR ACCIDENT — quatrième forme de
    // `megga/gardes-vacuites`, ici dans sa variante « raison périmée ».
    // ⚠ COMPTE REVU LE 15 AOÛT 2026 : QUATRE sites depuis l'entrée de
    // `crm-sugar-v3/primitives.tsx` au cliquet (son `SgBigStat`). La raison
    // annonçait 3 — et c'est exactement le mode d'échec qu'elle documente
    // elle-même : une raison qui donne un compte se périme sans que le motif
    // bouge. Recompté, jamais estimé.
    motif: /fontSize:\s*44\b/,
    raison: '44 px — les chiffres et titres d’affichage au-dessus du dernier barreau (4 sites)',
  },
  { motif: /fontSize:\s*40\b/, raison: '40 px — le titre du premier lancement, au-dessus du barreau' },
  { motif: /fontSize:\s*48\b/, raison: '48 px — le chiffre d’ouverture de Julien, au-dessus du dernier barreau (1 site)' },
  {
    // Troisième membre de la famille CALCULÉE, après `x * 0.34` et les `em` :
    // un `clamp()` borne une taille entre deux extrêmes et suit la LARGEUR DE LA
    // FENÊTRE entre les deux. Par construction, ce n'est pas un barreau — et ses
    // deux bornes en sont bien, elles, ce qui est le point : l'échelle sert de
    // garde-corps, pas de valeur.
    motif: /fontSize:\s*'clamp\(/,
    raison: 'responsive : un clamp() suit la largeur de la fenêtre (2 sites)',
  },
  {
    // Même famille que les tailles calculées : une valeur en `em` suit son
    // conteneur, donc elle ne PEUT pas être un barreau. Ici le code en ligne du
    // dock MEGGA AI, qui doit rester légèrement plus petit que la prose qui
    // l'entoure quelle que soit la taille de celle-ci.
    motif: /fontSize:\s*'[\d.]+em'/,
    raison: 'relative : le code en ligne suit la taille de sa prose',
  },
  {
    // ⛔ SOUS LE PLANCHER DE L'ÉCHELLE — la symétrie exacte de la famille
    // « au-dessus », six entrées plus haut : `--crm-text-*` COMMENCE à 11 px
    // (`xs`), donc une taille inférieure n'est pas hors échelle par négligence,
    // elle est hors de ce que l'échelle sait exprimer.
    //
    // ⚠ ANCRÉE SUR LA FORME, PAS SUR LA VALEUR, ET C'EST UN RESSERREMENT
    // DÉLIBÉRÉ. La première rédaction exemptait « toute taille < 11 » : mesurée,
    // elle ne couvrait que 4 sites (les 28 autres du dépôt vivent dans
    // `kyc-report`, hors cliquet par l'exemption du papier), donc elle était sûre
    // AUJOURD'HUI — et rien n'aurait empêché un `fontSize: 9` de passer demain
    // dans le Pipeline. Une exemption sûre par l'état du dépôt n'est pas une
    // exemption sûre. Même défaut que l'inventaire du gris-bleu sans son NOMBRE.
    //
    // Deux des quatre sites n'en avaient d'ailleurs pas besoin : les 10,5 px des
    // pastilles sont montés sur `xs` (un demi-pixel). Restent les DEUX que la
    // forme définit : le suffixe « % » d'une pastille de score, qui doit rester
    // plus petit que le nombre qu'il qualifie — sinon il cesse d'être un suffixe.
    motif: /fontSize: [\d.]+, color: sp\.sub \}\}>%/,
    raison: 'sous le plancher : le suffixe « % » d’une pastille de score, plus petit que son nombre (2 sites)',
  },
  {
    // ⚠ LA PAIRE OPTIQUE DES BOUTONS DE ZOOM, ASSUMÉE ENSEMBLE. `+` est à 20 px
    // et `−` à 22 : le signe moins (U+2212) rend plus léger que le plus à taille
    // égale, et les deux px d'écart sont une compensation, pas une négligence.
    //
    // ⛔ ET ON NE LES ÉCLATE PAS. 20 EST un barreau (`4xl`), 22 n'en est pas un :
    // tokeniser l'un et exempter l'autre casserait précisément le rapport qui
    // fait la compensation. C'est l'arbitrage déjà rendu pour `32 : 40` — « éclater
    // les deux états d'un même titre entre un jeton et un littéral est pire que
    // de les assumer ensemble ».
    motif: /fontSize: 2[02], fontWeight: 600, fontFamily: 'inherit', lineHeight: 1/,
    raison: 'la paire optique + / − des boutons de zoom, dans un bouton de 32 px (2 sites)',
  },
]

/**
 * Retire commentaires de ligne et de bloc AVANT analyse. Sans ça, la note qui
 * explique un retrait fait rougir la garde : le garde-fou trébuche sur sa
 * propre documentation. Défaut déjà rencontré sur `t.primary`
 * (`megga-x-crm-tokens.spec.ts`).
 */
function sansCommentaires(code: string): string {
  return code
    // ⚠ Un bloc `/* … */` de N lignes doit rendre N sauts de ligne, pas une
    // espace : sinon tout ce qui suit REMONTE, et chaque `fichier:ligne` que ce
    // spec rapporte désigne la mauvaise ligne. Une garde qui envoie au mauvais
    // endroit coûte plus de temps qu'elle n'en fait gagner.
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => '\n'.repeat((bloc.match(/\n/g) ?? []).length))
    .replace(/\/\/[^\n]*/g, ' ')
}

const scan = scanRoots(ZONES)
const sources = scan.files.map((abs) => {
  const lu = readFileSafely(abs)
  return { chemin: rel(abs), code: lu.status === 'ok' ? sansCommentaires(lu.value) : '' }
})

/** `fichier:ligne` de chaque ligne qui satisfait le prédicat. */
function sites(predicat: (ligne: string) => boolean): string[] {
  const trouves: string[] = []
  for (const { chemin, code } of sources) {
    code.split('\n').forEach((ligne, i) => {
      if (predicat(ligne)) trouves.push(`${chemin}:${i + 1}`)
    })
  }
  return trouves
}

describe('Grammaire MEGGA X — casse, graisse, interlettrage, échelle', () => {
  it('le balayage voit l’arbre', () => {
    expect(emptyRoots(scan), 'racine vide : chemin cassé, pas surface propre').toEqual([])
    expect(scan.unreadable).toEqual([])
    expect(scan.files.length).toBeGreaterThan(10)
    expect(sources.map((s) => s.chemin)).toContain(TEMOIN)
    // Une source vidée par un échec de lecture rendrait tous les tests vrais.
    expect(sources.every((s) => s.code.length > 0)).toBe(true)
  })

  /**
   * Les micro-capitales ne sont pas un détail de goût : elles étaient la marque
   * de fabrique de Sugar pour les sur-titres, et MEGGA X n'en a aucun idiome.
   * Les Réglages en ont retiré 10, le Calendrier 12.
   */
  it('aucune micro-capitale', () => {
    const fautifs = sites((l) => /textTransform:\s*'uppercase'/.test(l))
    expect(fautifs, `micro-capitales restantes :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⚠ Le motif lit l'EXPRESSION entière, pas la valeur qui suit `fontWeight:`.
   * Une première version ancrée sur `fontWeight:\s*[789]00` laissait passer
   * quatre `fontWeight: sel ? 700 : 600` — la graisse y disait l'état
   * sélectionné, en TROISIÈME signal après le fond accentué et l'encre inversée.
   * C'est précisément la forme qu'une garde doit attraper : celle où la valeur
   * proscrite se cache derrière une condition.
   */
  it('aucune graisse au-dessus de 600', () => {
    const fautifs = sites((l) => /fontWeight:[^,}\n]*\b[789]00\b/.test(l))
    expect(fautifs, `graisses ≥ 700 restantes :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ L'ANGLE MORT DE LA GARDE PRÉCÉDENTE : une graisse que la SOURCE ne
   * déclare pas.
   *
   * `<strong>` et `<b>` héritent du preflight Tailwind — `b, strong
   * { font-weight: bolder }` — qui, sur un parent réglé à 500, résout à **700**
   * au rendu. Aucun `fontWeight:` n'apparaît alors dans le code : le test
   * ci-dessus est vert, et l'écran est faux. Trouvé en mesurant l'étape 8 dans
   * le navigateur, pas en lisant le fichier.
   *
   * On interdit donc la BALISE dans les zones portées. Pour de l'emphase, poser
   * un `<span>` avec sa graisse explicite — la seule façon d'être sûr de ce qui
   * sera rendu.
   */
  it('aucune balise qui hérite d’une graisse du preflight', () => {
    const fautifs = sites((l) => /<(strong|b)[\s>]/.test(l))
    expect(fautifs, `balises à graisse héritée :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * Seul l'interlettrage POSITIF est visé, et à partir de 0,4. En dessous il ne
   * se voit pas ; au-dessus de zéro il n'existe que pour aérer des capitales, et
   * appliqué à de la casse normale il disloque le mot. Le négatif est laissé :
   * c'est le resserrement des titres d'affichage, que la vitrine pratique.
   */
  it('aucun interlettrage de micro-capitale', () => {
    const fautifs: string[] = []
    for (const { chemin, code } of sources) {
      const lignes = code.split('\n')
      lignes.forEach((ligne, i) => {
        let positif = false
        for (const m of ligne.matchAll(/letterSpacing:\s*'?(-?\.?[\d.]+)(em)?'?/g)) {
          const v = Number(m[1])
          if (Number.isNaN(v)) continue
          if (m[2] === 'em' ? v >= 0.04 : v >= 0.4) positif = true
        }
        if (!positif) return
        // ⚠ L'exemption se cherche dans le BLOC DE STYLE, pas sur la ligne : le
        // `letterSpacing` et le marqueur qui dit « c'est un code » (chiffres
        // tabulaires, chasse fixe) vivent sur deux lignes voisines dès que le
        // style est écrit en colonne. Une garde qui ne lit qu'une ligne oblige à
        // tout écrire sur une seule — elle contraint la MISE EN FORME du code.
        const bloc = lignes.slice(Math.max(0, i - 8), i + 9).join(' ')
        if (INTERLETTRAGES_ASSUMES.some(({ motif }) => motif.test(bloc))) return
        fautifs.push(`${chemin}:${i + 1}`)
      })
    }
    expect(fautifs, `interlettrage positif ≥ 0,4 :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * Une exemption qui ne correspond plus à rien laisse croire qu'un écart est
   * surveillé alors que la ligne a disparu. Même idiome que les tailles.
   */
  it('chaque exemption d’interlettrage correspond encore à du code', () => {
    const tout = sources.map((s) => s.code).join('\n')
    const mortes = INTERLETTRAGES_ASSUMES.filter(({ motif }) => !motif.test(tout)).map((e) => e.raison)
    expect(mortes, `exemptions sans code :\n  ${mortes.join('\n  ')}`).toEqual([])
  })

  /**
   * Une taille écrite en dur échappe à l'échelle : elle ne bougera pas si
   * l'échelle bouge, et rien ne signale qu'elle en est sortie. Les exceptions
   * sont NOMMÉES par fichier (`TAILLES_ASSUMEES`) — figer l'écart plutôt que
   * l'interdire, même idiome que les palettes.
   */
  /**
   * ⚠ On efface d'abord les jetons `var(--crm-…)`, PUIS on cherche un chiffre.
   * Ancrer sur « `var(` suit immédiatement `fontSize:` » ne marche que pour la
   * forme la plus simple : un ternaire de deux jetons
   * (`big ? 'var(--crm-text-3xl)' : 'var(--crm-text-lg)'`) est parfaitement
   * tokenisé et se faisait pourtant rejeter. Une garde qui refuse du code
   * correct se fait désarmer, pas corriger.
   */
  it('les tailles de texte sortent de l’échelle', () => {
    const fautifs = sites((ligne) => {
      const sansJetons = ligne.replace(/var\(--crm-[a-z0-9-]*\)/g, "''")
      if (!/fontSize:[^,}\n]*\d/.test(sansJetons)) return false
      return !TAILLES_ASSUMEES.some(({ motif }) => motif.test(ligne))
    })
    expect(fautifs, `tailles hors échelle :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ ET LA MÊME RÈGLE EN CSS, que la clause précédente ne peut PAS voir.
   *
   * Elle cherche `fontSize:` — la notation des styles EN LIGNE. Un composant qui
   * pose un `<style>{`…`}</style>` écrit `font-size:`, en kebab, et sort du
   * balayage sans un mot. C'est la vacuité n°10 : la garde ne voit pas un
   * LANGAGE, pas un fichier.
   *
   * ⚠ ET ELLE A CACHÉ UN DÉFAUT RÉEL. La règle mobile de la face publique posait
   * `.mlk-h1 { font-size: 26px !important }` sur des titres dont le plus petit
   * vaut 24 px : trois d'entre eux sortaient PLUS GRANDS sur téléphone que sur
   * bureau. Une règle qui prétend rétrécir et qui agrandit ne se voit ni à la
   * relecture — elle a l'air d'un garde-fou — ni dans la clause d'à côté.
   *
   * ⚠ MESURÉ AVANT D'ÊTRE ÉCRITE : UNE seule occurrence dans les 373 fichiers du
   * cliquet. Cette clause ne peut donc pas allumer une zone que personne n'a
   * regardée — c'est ce qui la rend sûre, et c'est pourquoi le compte est ici.
   */
  it('les tailles écrites en CSS sortent aussi de l’échelle', () => {
    const fautifs = sites((l) => /font-size:\s*[\d.]+px/.test(l))
    expect(fautifs, `taille CSS en dur :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ UN BARREAU CITÉ DOIT EXISTER — sans quoi « tokenisé » ne veut rien dire.
   *
   * La clause ci-dessus efface les `var(--crm-…)` AVANT de chercher un chiffre :
   * elle accepte donc n'importe quel nom, y compris un barreau qui n'a jamais été
   * déclaré. Le navigateur écarte alors la déclaration entière et la taille
   * retombe sur l'HÉRITAGE — silencieusement, du bon côté de la garde.
   *
   * ⚠ TROUVÉ À LA FUSION, PAS PAR RELECTURE. `main` a apporté
   * `fontSize: 'var(--crm-text-base)'` dans la carte de consentement WhatsApp :
   * un nom parfaitement plausible — c'est celui de Tailwind — et absent des
   * TREIZE barreaux de `globals.css`. La clause des tailles était verte dessus.
   *
   * Même famille que la n°17 et la n°40 : une INDIRECTION que la garde ne sait
   * pas résoudre, et qu'elle laisse donc passer. Le remède est le même — la
   * résoudre, et refuser ce qui ne se résout pas.
   */
  it('chaque barreau de texte cité existe vraiment', () => {
    const feuille = readFileSafely(repoPath('src/styles/globals.css'))
    expect(feuille.status, 'globals.css illisible : la clause ne mesure rien').toBe('ok')
    const declares = new Set(
      [...(feuille.status === 'ok' ? feuille.value : '').matchAll(/--crm-text-([a-z0-9]+)\s*:/g)].map((m) => m[1]!),
    )
    // Sans ce témoin, une feuille vidée rendrait « aucun barreau » et la clause
    // accuserait TOUT le dépôt au lieu de rougir sur sa propre cécité.
    expect(declares.size, 'aucun barreau lu dans globals.css — la clause est cassée').toBeGreaterThan(10)

    const inconnus: string[] = []
    for (const { chemin, code } of sources) {
      code.split('\n').forEach((ligne, i) => {
        for (const m of ligne.matchAll(/var\(--crm-text-([a-z0-9]+)\)/g)) {
          if (!declares.has(m[1]!)) inconnus.push(`${chemin}:${i + 1} — --crm-text-${m[1]} n'est pas un barreau`)
        }
      })
    }
    expect(inconnus, `barreau de texte inexistant :\n  ${inconnus.join('\n  ')}`).toEqual([])
  })

  /**
   * Une exemption qui ne correspond plus à rien est un mensonge silencieux : elle
   * laisse croire qu'un écart est surveillé alors que la ligne a disparu.
   */
  it('chaque exemption de taille correspond encore à du code', () => {
    const tout = sources.map((s) => s.code).join('\n')
    const mortes = TAILLES_ASSUMEES.filter(({ motif }) => !motif.test(tout)).map((e) => e.raison)
    expect(mortes, `exemptions sans code :\n  ${mortes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ UN ÉLÉMENT CLIQUABLE NE SE PEINT PAS EN ENCRE.
   *
   * C'est la survivance la plus discrète de Sugar Pure, et AUCUN scan de
   * couleur ne peut l'attraper : le jeton employé est parfaitement légitime
   * (`sp.ink` descend bien de `mxCrmPalette`), c'est son RÔLE qui est faux. La
   * règle du 10 août 2026 dit que l'élément actif porte l'accent `#424bfb` ;
   * peindre un bouton primaire en encre, c'est appliquer l'ancienne règle
   * « l'accent EST l'encre » avec les jetons de la nouvelle.
   *
   * Trouvé à l'écran, pas par un test : sur « Mes biens », le CTA « Créer un
   * bien » sortait en `#030303` quand la pastille de filtre juste à côté sortait
   * en `#424bfb` — deux affordances primaires, deux couleurs, sur la même barre.
   * Défaut identique à celui des Réglages, où `PfSwitch` était noir pendant que
   * `PxfSwitch` était déjà bleu.
   *
   * ⚠ Heuristique textuelle assumée : on regarde si un `background: …ink` a un
   * `<button` ou un `cursor: 'pointer'` dans son voisinage immédiat. Un COMPTEUR
   * en encre reste donc permis — il informe, il ne s'actionne pas.
   */
  it('aucun élément cliquable peint en encre', () => {
    const fautifs: string[] = []
    for (const { chemin, code } of sources) {
      const lignes = code.split('\n')
      lignes.forEach((ligne, i) => {
        if (!/background:\s*\w+\.ink\b/.test(ligne)) return
        // ⚠ ANCRÉ SUR L'ÉLÉMENT, pas sur une fenêtre de lignes. Le voisinage de
        // ±6 lignes attrapait le marqueur d'allure d'`AxDashboard` — un `<div>`
        // informatif — parce qu'un bouton vivait plus bas. Un bloc JSX est une
        // unité du LANGAGE : il ne bouge ni sous un commentaire, ni sous un
        // renommage, et il dit à QUI appartient le `onClick`.
        let d = i
        while (d > 0 && !/<[A-Za-z]/.test(lignes[d]!)) d--
        let f = i
        while (f < lignes.length - 1 && !/\/?>\s*$|}}>/.test(lignes[f]!)) f++
        const element = lignes.slice(d, f + 1).join(' ')
        if (/onClick|cursor:\s*'pointer'/.test(element)) fautifs.push(`${chemin}:${i + 1}`)
      })
    }
    expect(fautifs, `encre en fond d'un élément actionnable :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })
  /**
   * ⛔ LE NOIR DE SUGAR, SOUS SES DEUX ALPHABETS.
   *
   * Les gardes de palette (`wizard-palette`, `bien-palette`) n'inspectent que
   * les OBJETS de jetons. Aucune n'ouvre un fichier de composant — et c'est là
   * que `#0B0C0E` avait survécu 37 fois : le marqueur de carte de l'étape
   * Adresse, la pastille « vendu », les voiles posés sur les photos, les
   * confettis de l'écran de confirmation.
   *
   * ⚠ Le motif lit `#rrggbb` ET `rgba(r,g,b,…)`. Onze de ces occurrences
   * étaient en décimal — `rgba(11,12,14,…)`, exactement la même couleur sous un
   * autre alphabet. Un garde-fou de couleur qui ne connaît qu'une notation ne
   * garde rien, et c'est ainsi que le voile de `sgVeil()` a passé la relecture.
   *
   * Les teintes SÉMANTIQUES restent permises et sont nommées : elles encodent
   * une information que l'échelle ne sait pas porter (statut d'annonce, teinte
   * d'avatar, hue de groupe). Comme partout ici, on fige l'écart au lieu de
   * l'interdire.
   */
  it('aucun noir Sugar ne subsiste dans les composants', () => {
    // ⛔ PAS DE `g` ICI, ET C'EST UNE CORRECTION DE VACUITÉ (15 août 2026).
    //
    // Le motif portait `/gi`, et un littéral de regex est UNIQUE : `.test()` sur
    // un motif global avance `lastIndex` et reprend la ligne SUIVANTE en plein
    // milieu. Une ligne fautive qui suit immédiatement une autre ligne fautive
    // sortait donc du compte. Mesuré sur les 359 fichiers du cliquet : la clause
    // en voyait SIX, il y en avait SEPT — le septième étant
    // `MlkPrimitives.tsx:242`, l'ombre de survol écrite juste sous celle qui,
    // elle, était bien vue.
    //
    // ⚠ Le mode d'échec est celui de toute la famille : silencieux, et du bon
    // côté du seuil. Il ne peut pas se voir en relecture, parce que le motif est
    // JUSTE — c'est son état qui ne l'est pas. `GRIS_BLEU`, plus haut, ne porte
    // pas `g` et n'a jamais eu le défaut.
    const NOIRS = /#0B0C0E\b|#0A0A0F\b|#0A0B0D\b|rgba?\(\s*11\s*,\s*12\s*,\s*14\b/i
    const fautifs = sites((l) => NOIRS.test(l))
    expect(fautifs, `noir Sugar vivant :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LE GRIS-BLEU SLATE-900 — il a traversé QUATRE campagnes toutes portes
   * vertes, et la mesure le dit.
   *
   * `rgba(15,23,42,…)` est le slate-900 de Tailwind (B−R = 27). Le Pipeline
   * l'avait nommé (`sgVoileEncre`) et corrigé CHEZ LUI ; trois specs le gardent,
   * chacune sur sa seule zone (`admin-console-css`, `pipeline-palettes`,
   * `matching-atelier-css`). Aucune ne couvrait le reste, et le cliquet de
   * grammaire n'interdisait que le noir de Sugar.
   *
   * Mesuré le 15 août 2026 sur TOUTES les zones du cliquet : **36 sites
   * survivent dans six zones déclarées PORTÉES** — le wizard (dont 4 dans son
   * fichier de jetons), « Mes biens » (8), la vitrine de la fiche (3), le CRM
   * mobile (6, dont 4 dans ses jetons), Contacts (10) et la fiche bien (4).
   * Il entre toujours par la même porte : une FRACTION D'OPACITÉ. Personne ne
   * relit `rgba(15,23,42,0.022)` en cherchant une couleur.
   *
   * ⚠ CLIQUET À L'ENVERS, ET COMPTÉ. `POLICES_ASSUMEES` exempte un FICHIER ;
   * ici on exempte un fichier ET son NOMBRE. Sans le nombre, un fichier déjà
   * listé pourrait en gagner un de plus sans que rien ne bouge — c'est la
   * quatrième forme de `megga/gardes-vacuites`, l'exemption trop grossière,
   * dont le JSDoc de `TAILLES_ASSUMEES` dit déjà qu'elle « laisse passer ce
   * qu'elle prétend surveiller ». Chaque lot qui nettoie une zone descend ou
   * retire sa ligne ; le test suivant refuse toute entrée devenue trop haute.
   */
  it('aucun gris-bleu slate-900 hors inventaire', () => {
    const trop: string[] = []
    for (const { chemin, code } of sources) {
      const n = code.split('\n').filter((l) => GRIS_BLEU.test(l)).length
      const permis = GRIS_BLEU_ASSUMES.get(chemin) ?? 0
      if (n > permis) trop.push(`${chemin} : ${n} > ${permis} permis`)
    }
    expect(trop, `gris-bleu au-delà de l'inventaire :\n  ${trop.join('\n  ')}`).toEqual([])
  })

  /**
   * L'inventaire ne doit que RÉTRÉCIR : une entrée dont le fichier en porte
   * moins qu'annoncé laisse un crédit ouvert, et le prochain lot pourrait en
   * réintroduire sans rien faire rougir.
   */
  it('l’inventaire du gris-bleu ne garde aucun crédit', () => {
    const perimees: string[] = []
    for (const [chemin, permis] of GRIS_BLEU_ASSUMES) {
      const s = sources.find((x) => x.chemin === chemin)
      if (!s) { perimees.push(`${chemin} : fichier absent du balayage`); continue }
      const n = s.code.split('\n').filter((l) => GRIS_BLEU.test(l)).length
      if (n < permis) perimees.push(`${chemin} : ${n} réels < ${permis} inscrits — descendre le compte`)
    }
    expect(perimees, `inventaire à resserrer :\n  ${perimees.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ UN ALIAS SUFFIT À CONTOURNER LA GARDE PRÉCÉDENTE.
   *
   * `BpRenewModal.tsx` faisait `const accent = sp.ink`, puis peignait son
   * bouton de validation, ses trois pastilles de durée et deux « Terminé » avec
   * `background: accent`. La garde cherchait `background: …ink` : elle était
   * VERTE dans un fichier qu'elle balayait. Nommer une variable ne change pas
   * ce qu'elle contient.
   */
  it('aucun alias ne renomme l’encre en accent', () => {
    const fautifs = sites((l) => /\b(?:const|let)\s+\w*[Aa]ccent\w*\s*=\s*\w+\.ink\b/.test(l))
    expect(fautifs, `l'encre déguisée en accent :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LA MÊME GRAMMAIRE, EN CLASSES — le LANGAGE que les clauses ci-dessus ne
   * lisent pas (vacuité n°10).
   *
   * Elles cherchent `textTransform:`, `fontWeight:`, `letterSpacing:` — la
   * notation des styles EN LIGNE. Une surface peinte en classes Tailwind écrit
   * `uppercase`, `font-bold`, `tracking-wide`, et rend donc ZÉRO sur trois
   * clauses quel que soit son état réel. C'est ce qui rendait sept pages
   * publiques indéchiffrables, et ce qui fait qu'`AcceptInvitePage` est entrée au
   * cliquet du lot 3 en n'y étant mesurée que par la clause des BALISES.
   *
   * ⚠ MESURÉ AVANT D'ÊTRE ÉCRITE — c'est ce qui la rend sûre : NEUF sites au
   * total sur les 303 fichiers du cliquet. Une clause de langage ne peut allumer
   * une zone que personne n'a regardée que si elle est large ; celle-ci ne l'est
   * pas, et le compte est ici pour qu'on puisse le revérifier.
   *
   * ⛔ ET ELLE NE COUVRE PAS TOUT, il faut le dire : les TAILLES restent
   * invisibles en classes. `text-sm` est un barreau de TAILWIND, pas un
   * `var(--crm-text-*)` ; exiger l'un depuis l'autre demanderait de réécrire la
   * page en styles en ligne, ce qui est un geste, pas une clause. Les pages
   * peintes en classes restent donc mesurées sur leur CASSE, leur GRAISSE et
   * leur INTERLETTRAGE — pas sur leur échelle ni sur leurs couleurs.
   */
  /**
   * ⛔ `first-letter:uppercase` N'EST PAS UNE MICRO-CAPITALE — c'en est
   * l'inverse, et la clause le refusait.
   *
   * Trouvé au lot 1 du chantier « 100 % » (15 août 2026) en entrant
   * `src/components/layout` : `OnboardingCallBanner` capitalise l'initiale d'une
   * date rendue en minuscules par `toLocaleDateString` (« lundi 18 août » →
   * « Lundi 18 août »). Le variant Tailwind ne touche qu'UNE LETTRE ; la règle
   * vise le mot ENTIER mis en capitales, qui était l'idiome de sur-titre de
   * Sugar. Le `\b` matchait quand même, le `:` n'étant pas un caractère de mot.
   *
   * ⚠ ET LE REMÈDE NE POUVAIT PAS ÊTRE DE CORRIGER LE CODE. Retirer la classe
   * aurait changé ce que le CLIENT lit — un nom de jour en minuscule au début
   * d'une phrase — pour satisfaire une garde qui visait autre chose. « Une garde
   * qui refuse du code correct se fait désarmer, pas corriger » (JSDoc de la
   * clause des tailles, quatre points plus haut) : c'est la clause qui bouge.
   *
   * ⚠ ON N'EXCLUT PAS TOUS LES VARIANTS, seulement les deux qui portent sur un
   * FRAGMENT. `md:uppercase` reste une micro-capitale — sous un point de rupture,
   * mais le mot entier y passe bien en capitales, et l'exclure ouvrirait la porte
   * que cette clause existe pour fermer.
   */
  it('aucune micro-capitale, en classes non plus', () => {
    const fautifs = sites((l) => /className=[^>]*(?<!first-letter:)(?<!first-line:)\buppercase\b/.test(l))
    expect(fautifs, `micro-capitales en classes :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  it('aucune graisse au-dessus de 600, en classes non plus', () => {
    // `font-bold` = 700, `font-extrabold` = 800, `font-black` = 900.
    // `font-semibold` (600) est le plafond, il reste permis.
    const fautifs = sites((l) => /className=[^>]*\bfont-(bold|extrabold|black)\b/.test(l))
    expect(fautifs, `graisses ≥ 700 en classes :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ ET LA MÊME GRAMMAIRE EN ATTRIBUTS JSX — le TROISIÈME langage (lot 4,
   * 15 août 2026). Vacuité n°10 dans sa variante la plus discrète.
   *
   * Les clauses de style en ligne s'ancrent sur `fontWeight:` — avec les
   * DEUX-POINTS. Un `<text>` SVG écrit `fontWeight="800"`, en ATTRIBUT de
   * présentation, et sort du balayage sans un mot. Ce n'est ni une classe ni un
   * style en ligne : c'est une troisième notation de la même propriété.
   *
   * ⚠ ET LA ZONE ÉTAIT COUVERTE, LE CLIQUET VERT. Les six sites vivaient dans
   * `AxDashboard` et `AxFirstRun` — Analytics, entrée au cliquet à la vague A —
   * pendant que les clauses de graisse et de police y rendaient zéro. Un
   * périmètre juste ne suffit pas si l'instrument ne lit pas le langage.
   *
   * ⚠ MESURÉE AVANT D'ÊTRE ÉCRITE : treize sites au total dans tout `src/`, dans
   * DEUX fichiers — six graisses et sept polices. Cette clause ne peut donc pas
   * allumer une zone que personne n'a regardée.
   */
  it('aucune graisse au-dessus de 600, en attribut JSX non plus', () => {
    const fautifs = sites((l) => /fontWeight=["'{]?\s*["']?\s*[789]00\b/.test(l))
    expect(fautifs, `graisses ≥ 700 en attribut :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  it('aucune micro-capitale ni interlettrage, en attribut JSX non plus', () => {
    const fautifs = sites((l) => /textTransform=["'{]?\s*["']?uppercase|letterSpacing=["'{]/.test(l))
    expect(fautifs, `casse ou interlettrage en attribut :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ B6 — LA POLICE PAR UNE AUTRE CLÉ, deux formes que `fontFamily:` ne voit
   * pas : l'ATTRIBUT (`fontFamily="Manrope"`, sept sites, tous en SVG) et la clé
   * RACCOURCIE `font:` (`crm-sugar-v3/tokens.ts:113` écrit
   * `font: '"Inter Tight", …'`).
   *
   * ⚠ QUELLE police a droit de cité, et OÙ, est gardé à part —
   * `polices-domaines.spec.ts`. Ici on garde seulement qu'aucune NOTATION
   * n'échappe au regard : c'est la frontière entre « la règle » et « le langage
   * dans lequel on peut l'enfreindre ».
   *
   * ⛔ ET LES DEUX NOTATIONS N'ONT PAS LE MÊME RÉGIME — ma première rédaction les
   * confondait, et une clause l'a montré en rougissant sur du code CORRECT.
   *
   *  · `font:` (la clé raccourcie) ne se juge que sur `Inter Tight|DM Sans`,
   *    exactement comme la clause « aucune police écrite en dur » : écrire
   *    Inter Tight en toutes lettres ÉCRASE `--crm-font`, écrire Manrope est un
   *    autre choix — légitime dans son domaine, et c'est `polices-domaines` qui
   *    en décide. `mlkTokens.ts` écrit `font: 'Manrope, …'` pour la face
   *    publique : refuser cette ligne, c'est refuser du code correct.
   *  · L'ATTRIBUT, lui, est refusé quelle que soit la police, et c'est un régime
   *    plus strict pour une raison mécanique : un attribut de présentation SVG
   *    n'accepte PAS `var()`. Il ne peut donc jamais être tokenisé — il ne peut
   *    que figer. Le remède n'est pas de le réécrire mais de le RETIRER :
   *    `font-family` est héritée et s'applique au texte SVG, donc l'absence
   *    d'attribut rend `var(--crm-font)` sans un mot. Mesuré à 0 après le lot 4.
   *
   * ⛔ ET J'AI ÉCRIT LA VACUITÉ n°1 DU DÉPÔT, MOT POUR MOT, EN CROYANT LA
   * CONNAÎTRE. Ma première rédaction cherchait le nom JUSTE APRÈS le guillemet
   * ouvrant — `font:\s*['"`][^'"`]*(Inter Tight…)`. Or la ligne visée s'écrit
   * `font: '"Inter Tight", system-ui, sans-serif'` : un guillemet s'intercale,
   * la classe `[^'"`]*` s'arrête dessus, et la clause était VERTE sur le seul
   * site qu'elle existait pour attraper. C'est exactement le défaut qui avait
   * laissé passer 29 fichiers en août, documenté dans ce dépôt, et je l'ai
   * reproduit en écrivant sa correction. Le motif borne désormais sur le
   * SÉPARATEUR (`[^,;}\n]*`), comme la clause « aucune police écrite en dur »
   * dont il est le jumeau — connaître une vacuité ne protège pas d'elle ;
   * recopier la FORME du remède, si.
   */
  it('aucune police nommée par un attribut ou écrite en dur sous la clé `font:`', () => {
    const fautifs = sites((l) => {
      const sansJeton = l.replace(/var\(--crm-font[^)]*\)/g, 'VAR')
      return /fontFamily=["'{]/.test(sansJeton) || /\bfont:[^,;}\n]*(Inter Tight|DM Sans)/.test(sansJeton)
    })
    expect(fautifs, `police par attribut ou écrite en dur sous \`font:\` :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  it('aucun interlettrage de micro-capitale, en classes non plus', () => {
    // Seul le POSITIF est visé : `tracking-tight`/`tighter` resserrent un titre
    // d'affichage, ce que la vitrine pratique — c'est le pendant du seuil ≥ 0,4.
    const fautifs = sites((l) => /className=[^>]*\btracking-(wide|wider|widest)\b/.test(l))
    expect(fautifs, `interlettrage positif en classes :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ CE QUE L'INSTRUMENT NE VOIT PAS, INVENTORIÉ — sinon « 0 marqueur » se lit
   * « propre » (vacuité n°6, « la garde muette prise pour un verdict »).
   *
   * Ce fichier lit d'abord les styles EN LIGNE. Une page peinte en CLASSES est
   * donc mesurée PARTIELLEMENT, et il faut dire où passe la frontière.
   *
   * ⚠ CE QUE L'INSTRUMENT VOIT DÉSORMAIS, depuis le lot 5 : la CASSE
   * (`uppercase`), la GRAISSE (`font-bold|extrabold|black`) et l'INTERLETTRAGE
   * (`tracking-wide|wider|widest`) — trois clauses jumelles qui lisent le
   * langage des classes.
   *
   * ⛔ CE QU'IL NE VOIT TOUJOURS PAS : l'ÉCHELLE et les COULEURS. `text-sm` est
   * un barreau de TAILWIND, pas un `var(--crm-text-*)` ; `text-gray-500` n'est
   * ni le noir de Sugar ni le gris-bleu, mais ce n'est pas non plus un jeton de
   * thème. Exiger l'un depuis l'autre demanderait de réécrire ces pages en
   * styles en ligne — un geste, pas une clause. C'est pourquoi cet inventaire
   * SURVIT à leur entrée au cliquet : appartenir au cliquet ne veut pas dire
   * être entièrement mesuré, et sans cette liste on lirait l'un pour l'autre.
   *
   * Mesuré le 15 août 2026 sur `src/pages/public` : SEPT des quatorze pages sont
   * peintes en classes, de 8 à 57 `className` pour ZÉRO `style={{`.
   *
   * ⚠ CLIQUET À L'ENVERS, ET DANS LES DEUX SENS : une page qui devient visible
   * (elle gagne des styles en ligne) doit SORTIR de cette liste et entrer dans le
   * cliquet ; une page qui grossit en classes fait rougir aussi. La liste ne peut
   * que rétrécir.
   */
  it('les pages publiques que l’instrument ne voit pas sont inventoriées', () => {
    /** Fichier → nombre de `className=`, relevé le 15 août 2026. */
    const AVEUGLES = new Map<string, number>([
      ['AcceptInvitePage.tsx', 27],
      ['NotFoundPage.tsx', 21],
      ['OnboardingCallManagePage.tsx', 30],
      ['PrivacyPage.tsx', 8],
      ['ResetPasswordPage.tsx', 19],
      ['VisitFeedbackPage.tsx', 46],
      ['VisitManagePage.tsx', 57],
    ])
    const scanPublic = scanRoots([{ root: 'src/pages/public', keep: (n) => /\.tsx$/.test(n) }])
    expect(emptyRoots(scanPublic), 'racine vide : chemin cassé, pas surface propre').toEqual([])
    expect(scanPublic.files.length, 'le balayage ne voit plus les pages publiques').toBeGreaterThan(10)

    const ecarts: string[] = []
    const vues = new Set<string>()
    for (const abs of scanPublic.files) {
      const nom = rel(abs).split('/').pop()!
      const lu = readFileSafely(abs)
      if (lu.status !== 'ok') { ecarts.push(`${nom} : illisible`); continue }
      // ⚠ SUR LA SOURCE BRUTE, commentaires compris : un `style={{` en commentaire
      // ne peint rien, mais un fichier qui n'en a QUE là reste aveugle — et c'est
      // l'aveuglement qu'on mesure, pas la propreté.
      const enLigne = (lu.value.match(/style=\{\{/g) ?? []).length
      const classes = (lu.value.match(/className=/g) ?? []).length
      const aveugle = enLigne === 0 && classes > 0
      const inscrit = AVEUGLES.get(nom)
      vues.add(nom)
      if (aveugle && inscrit === undefined) ecarts.push(`${nom} : ${classes} className, 0 style en ligne — AVEUGLE et non inscrite`)
      else if (aveugle && classes > inscrit!) ecarts.push(`${nom} : ${classes} className > ${inscrit} inscrits — la page grossit hors de vue`)
      else if (!aveugle && inscrit !== undefined) ecarts.push(`${nom} : elle porte ${enLigne} style(s) en ligne — elle est VISIBLE, la sortir de la liste et l'entrer au cliquet`)
    }
    const disparues = [...AVEUGLES.keys()].filter((n) => !vues.has(n))
    expect(ecarts, `l'inventaire de ce que l'instrument ne voit pas a dérivé :\n  ${ecarts.join('\n  ')}`).toEqual([])
    expect(disparues, `inscrite mais absente du balayage :\n  ${disparues.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LES DEUX DOSSIERS DE PAGES SONT COUVERTS EN ENTIER — et c'est cet
   * invariant-là qui tient, pas la liste.
   *
   * ⚠ IL REMPLACE UNE PROTECTION QUE J'AI VUE ÉCHOUER. `PAGES_ACQUISES` est
   * écrite à part pour que retirer une page de l'ensemble surveillé fasse rougir
   * (vacuité n°15) — mais un contrôle négatif l'a prise en défaut : retirer la
   * page des DEUX listes du même geste passait au VERT. C'est la limite
   * inhérente à toute liste témoin, et elle ne se ferme pas en ajoutant une
   * troisième liste : elle se ferme en confrontant à un TIERS que la mutation ne
   * peut pas éditer — ici le système de fichiers.
   *
   * Mesuré le 15 août 2026, au lot 5 : 28 pages dans `src/pages/agent`, 13 dans
   * `src/pages/public`, et TOUTES surveillées. Une page neuve devra donc entrer,
   * ou justifier sa sortie en modifiant cette clause — ce qui se lit dans un
   * diff, contrairement à un oubli.
   */
  it('aucune page n’échappe au cliquet — les deux dossiers sont couverts', () => {
    const manquantes: string[] = []
    for (const [dossier, surveillees] of [
      ['src/pages/agent', PAGES],
      ['src/pages/public', PAGES_PUBLIQUES],
    ] as const) {
      const scan = scanRoots([{ root: dossier, keep: (n) => /\.tsx$/.test(n) }])
      expect(emptyRoots(scan), `racine vide : ${dossier}`).toEqual([])
      // Sans ce plancher, un chemin cassé rendrait « rien à couvrir » et la
      // clause passerait au vert sur un dossier qu'elle ne lit plus.
      expect(scan.files.length, `${dossier} ne rend plus de page`).toBeGreaterThan(10)
      for (const abs of scan.files) {
        const nom = rel(abs).split('/').pop()!
        if (!surveillees.has(nom)) manquantes.push(`${dossier}/${nom}`)
      }
    }
    expect(manquantes, `page hors du cliquet — l'entrer, ou écrire pourquoi :\n  ${manquantes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ UNE ZONE DEHORS DOIT L'ÊTRE PAR ÉCRIT, ET SA GARDE DOIT EXISTER.
   *
   * Trois choses sont exigées, et la troisième est celle qui compte : le fichier
   * de garde nommé doit CITER la zone. Sans elle, la clause se contenterait de
   * vérifier qu'un fichier existe — on pourrait le vider, ou l'écrire sur une
   * autre zone, et le motif s'évaporerait sans que rien ne rougisse. C'est la
   * n°22 (« la couverture ne repose plus sur rien ») appliquée à une sortie.
   *
   * ⚠ ET LA GARDE NOMMÉE FAIT LE CHEMIN INVERSE : `kyc-report-frontiere` refuse
   * que la zone entre dans `ZONES`. Les deux fichiers se tiennent, chacun sur ce
   * que l'autre ne peut pas voir — ce n'est pas une redondance, c'est un verrou
   * croisé. Le retrait de l'un est visible depuis l'autre.
   */
  it('chaque zone laissée dehors l’est par une exemption ÉCRITE, et sa garde la nomme', () => {
    expect(EXEMPTIONS_ECRITES.length, 'plus aucune exemption écrite — la clause ne mesure rien').toBeGreaterThan(0)
    const racines = ZONES.map((z) => z.root)
    // ⚠ Une exemption vise soit une ZONE (racine), soit un FICHIER. Vérifier la
    // seule liste des racines laisserait une exemption de fichier passer alors
    // que le fichier est bel et bien balayé — l'exemption dirait alors le
    // contraire de ce qui se produit, ce qui est pire que pas d'exemption.
    const balayes = new Set(sources.map((s) => s.chemin))
    const defauts: string[] = []
    for (const { zone, motif, garde } of EXEMPTIONS_ECRITES) {
      if (racines.includes(zone) || balayes.has(zone)) {
        defauts.push(`${zone} est À LA FOIS balayée et exemptée — trancher, lire ${garde}`)
      }
      if (motif.trim().length < 40) defauts.push(`${zone} : motif trop court pour être un motif`)
      const lu = readFileSafely(repoPath(garde))
      if (lu.status !== 'ok') {
        defauts.push(`${zone} : sa garde ${garde} est introuvable — l'exemption n'a plus de support`)
        continue
      }
      if (!lu.value.includes(zone)) {
        defauts.push(`${zone} : sa garde ${garde} ne la nomme plus — le motif s'est évaporé`)
      }
    }
    expect(defauts, `exemption sans support :\n  ${defauts.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LA CLAUSE DE FERMETURE — « tout ce qui PEINT est couvert ou exempté ».
   *
   * C'est elle qui fait de « 100 % » un fait gardé plutôt qu'un comptage. Les
   * clauses précédentes vérifient que les zones INSCRITES sont saines ; aucune
   * ne dit ce qui n'est inscrit nulle part. Un dossier neuf plein de styles
   * pouvait arriver sans qu'une seule ligne rougisse — l'absence est le seul
   * état qu'un cliquet, par construction, ne voit pas.
   *
   * ⛔ ET ELLE NE PEUT PAS ÊTRE UNE LISTE (n°50). Une liste témoin protège
   * contre une édition PARTIELLE, jamais contre une édition COHÉRENTE : retirer
   * un fichier de la liste ET du cliquet du même geste passe au vert. Ce qui
   * ferme, c'est un TIERS que la mutation ne peut pas éditer — ici le SYSTÈME DE
   * FICHIERS. On énumère les PORTEURS depuis l'arbre, et chacun doit être balayé
   * ou nommé dans `EXEMPTIONS_ECRITES`. Un porteur neuf devra donc entrer, ou
   * justifier sa sortie DANS UN DIFF.
   *
   * ⚠ « PORTEUR » EST UNE DÉFINITION, ET ELLE EST ÉCRITE ICI : un `.tsx` de
   * `src/` qui contient `style={{`, `className=` ou `<style`. Les hooks, `lib/`
   * et `types/` ne peignent rien et n'ont aucune raison d'entrer dans un
   * dénominateur de direction — les compter ferait baisser le chiffre sans
   * couvrir un pixel de plus.
   *
   * Mesuré le 15 août 2026 : 330 porteurs, 303 balayés, 27 exemptés, ZÉRO
   * orphelin.
   */
  it('tout porteur de src/ est couvert, ou exempté avec un motif', () => {
    const tous = scanRoots([{ root: 'src', keep: (n) => /\.tsx$/.test(n) }])
    expect(emptyRoots(tous), 'racine vide : chemin cassé, pas dépôt sans pages').toEqual([])
    // Sans ce plancher, un arbre déplacé rendrait « rien à couvrir » et la
    // clause passerait au vert sur un dépôt qu'elle ne lit plus.
    expect(tous.files.length, 'src/ ne rend plus de .tsx').toBeGreaterThan(300) // 379 mesurés le 15.08.2026

    const balayes = new Set(sources.map((s) => s.chemin))
    const exempte = (p: string) =>
      EXEMPTIONS_ECRITES.some(({ zone }) => p === zone || p.startsWith(zone + '/'))

    const orphelins: string[] = []
    let porteurs = 0
    for (const abs of tous.files) {
      const lu = readFileSafely(abs)
      if (lu.status !== 'ok') continue
      // ⚠ Sur le fichier BRUT, pas sur sa version sans commentaires : la
      // définition d'un porteur est « ce fichier peint », et un `style={{`
      // commenté reste le signe d'un fichier qui peint.
      if (!/style=\{\{|className=|<style/.test(lu.value)) continue
      porteurs++
      const chemin = rel(abs)
      if (!balayes.has(chemin) && !exempte(chemin)) orphelins.push(chemin)
    }

    // Un dénominateur qui s'effondre rendrait la clause vraie sans rien couvrir.
    expect(porteurs, 'plus aucun porteur trouvé — la définition ou le balayage est cassé').toBeGreaterThan(250)
    expect(
      orphelins,
      `porteur ni balayé ni exempté — l'entrer dans ZONES, ou écrire son motif dans ` +
        `EXEMPTIONS_ECRITES avec la garde qui le porte :\n  ${orphelins.join('\n  ')}`,
    ).toEqual([])
  })

  /**
   * ⛔ LES FEUILLES SONT ÉNUMÉRÉES DEPUIS L'ARBRE, jamais listées. Une liste de
   * chemins se périme au premier `.css` ajouté, et personne ne le verrait — le
   * fichier neuf ne serait simplement pas lu. Même raison que la clause de
   * fermeture : le tiers, c'est le système de fichiers.
   */
  it('chaque feuille CSS de src/ est lue, ou exemptée avec un motif', () => {
    const feuilles = scanRoots([{ root: 'src', keep: (n) => /\.css$/.test(n) }])
    expect(emptyRoots(feuilles), 'racine vide : chemin cassé').toEqual([])
    expect(feuilles.files.length, 'plus aucune feuille — la clause ne mesure rien').toBeGreaterThan(5)
    const exemptees = new Set(EXEMPTIONS_ECRITES.map((e) => e.zone))
    const inconnues = feuilles.files
      .map(rel)
      .filter((p) => !exemptees.has(p) && !CSS_ASSUME.has(p))
      .filter((p) => {
        const lu = readFileSafely(repoPath(p))
        if (lu.status !== 'ok') return false
        const lignes = cssLisible(lu.value).split('\n')
        return ESPECES_CSS.some(({ voit }) => lignes.some(voit))
      })
    expect(
      inconnues,
      `feuille qui porte de la grammaire sans inventaire ni exemption :\n  ${inconnues.join('\n  ')}`,
    ).toEqual([])
  })

  /**
   * Le plafond, par ESPÈCE. Un total unique conflerait quatre dettes qui se
   * paient séparément — et permettrait d'en échanger une contre une autre sans
   * que rien ne bouge.
   */
  it('aucune feuille CSS ne dépasse son inventaire', () => {
    const trop: string[] = []
    for (const [chemin, permis] of CSS_ASSUME) {
      const lu = readFileSafely(repoPath(chemin))
      if (lu.status !== 'ok') { trop.push(`${chemin} : illisible — l'inventaire ne mesure rien`); continue }
      const lignes = cssLisible(lu.value).split('\n')
      for (const { nom, voit } of ESPECES_CSS) {
        const n = lignes.filter(voit).length
        const p = permis[nom] ?? 0
        if (n > p) trop.push(`${chemin} — ${nom} : ${n} > ${p} permis`)
      }
    }
    expect(trop, `grammaire CSS au-delà de l'inventaire :\n  ${trop.join('\n  ')}`).toEqual([])
  })

  /**
   * L'inventaire ne doit que RÉTRÉCIR : une entrée dont la feuille en porte
   * moins qu'annoncé laisse un crédit ouvert, et le prochain lot pourrait en
   * réintroduire sans rien faire rougir. Même idiome que le gris-bleu.
   */
  it('l’inventaire CSS ne garde aucun crédit', () => {
    const perimees: string[] = []
    for (const [chemin, permis] of CSS_ASSUME) {
      const lu = readFileSafely(repoPath(chemin))
      if (lu.status !== 'ok') { perimees.push(`${chemin} : fichier absent`); continue }
      const lignes = cssLisible(lu.value).split('\n')
      for (const { nom, voit } of ESPECES_CSS) {
        const n = lignes.filter(voit).length
        const p = permis[nom] ?? 0
        if (n < p) perimees.push(`${chemin} — ${nom} : ${n} réels < ${p} inscrits — descendre le compte`)
      }
    }
    expect(perimees, `inventaire CSS à resserrer :\n  ${perimees.join('\n  ')}`).toEqual([])
  })

  /**
   * Le cliquet doit RESTER un cliquet : une zone retirée de `ZONES` désarmerait
   * les tests ci-dessus en silence, et le fichier resterait vert.
   */
  it('le cliquet ne recule pas', () => {
    const racines = ZONES.map((z) => z.root)
    for (const acquise of [
      'src/components/crm-sugar-wizard',
      'src/components/crm-sugar/biens',
      'src/components/crm-sugar-v3/vitrine',
      'src/components/crm-mobile',
      'src/components/crm-sugar',
      'src/components/crm-sugar/contacts-pager',
      'src/components/crm-sugar/pipeline',
      'src/components/crm-sugar-v3/offer-modal',
      // La face publique — lot 1 du chantier « la face publique en MEGGA X ».
      'src/components/kyc-magic-link',
      'src/pages/public',
      'src/components/buyer-reception',
      // ⚠ La racine NUE, celle qui porte `tokens.ts` depuis le lot 2 du chantier
      // KYC. Elle manquait à cette liste : les cinq fichiers qu'elle retient
      // pouvaient donc quitter le cliquet sans que rien ne rougisse.
      'src/components/crm-sugar-v3',
      'src/pages/agent',
      'src/components/matching-recherche',
      'src/components/matching-atelier',
      'src/pages/admin',
      'src/components/admin',
      'src/components/crm-sugar/today',
      'src/components/crm-sugar-v3/kyc',
      'src/components/crm-sugar-v3/kyc-pager',
      'src/components/crm-sugar-v3/kyc-wizard',
      'src/components/crm-sugar-v3/visite-detail',
      'src/components/crm-sugar-v3/audit',
      'src/components/crm-sugar/analytics',
      'src/components/crm-sugar/journey',
      'src/components/crm-sugar/settings',
      'src/components/crm-sugar/calendar',
      'src/components/listings',
      'src/components/crm-sugar/search',
      'src/components/crm-sugar/notifications',
      'src/components/crm-sugar/profile',
      'src/components/ai-copilot/panel',
      'src/components/layout',
      // Lot 1 du chantier « 100 % » (15 août 2026).
      'src/components/ui',
      'src/components/propertyx',
      'src/components/onboarding-call',
      'src/components/skeletons',
      'src/components/auth',
      'src/components/map',
      'src/components/crm-sugar-identity',
    ]) expect(racines, `zone retirée du cliquet : ${acquise}`).toContain(acquise)
    // Et les zones acquises sont réellement ATTEINTES — une racine présente
    // dont un sous-dossier échappe au filtre passerait `emptyRoots`.
    const chemins = sources.map((s) => s.chemin)
    for (const t of TEMOINS_DE_ZONE) {
      expect(chemins, `zone non balayée : ${t}`).toContain(t)
    }
    // …et le filtre de chemin tient encore : ces fichiers portent le nom retenu
    // par la zone `crm-sugar` mais vivent dans un sous-dossier d'un AUTRE lot.
    for (const h of HORS_ZONE_ATTENDUS) {
      expect(chemins, `aspiré par accident, hors du lot : ${h}`).not.toContain(h)
    }
    // Les pages sont bien VUES — un filtre de nom qui ne matche rien laisserait
    // la racine non vide (le dossier en contient d'autres) tout en ne gardant
    // aucune d'elles.
    //
    // ⚠ On itère `PAGES_ACQUISES`, PAS `PAGES` : itérer l'ensemble qu'on
    // surveille le fait rétrécir avec lui. C'est ce que le contrôle négatif a
    // montré — retirer une page passait au vert.
    const vues = sources.map((s) => s.chemin.split('/').pop())
    for (const p of PAGES_ACQUISES) {
      expect(PAGES, `page retirée du cliquet : ${p}`).toContain(p)
      expect(vues, `page non balayée : ${p}`).toContain(p)
    }
    for (const p of PAGES_PUBLIQUES_ACQUISES) {
      expect(PAGES_PUBLIQUES, `page publique retirée du cliquet : ${p}`).toContain(p)
      expect(vues, `page publique non balayée : ${p}`).toContain(p)
    }
  })
})
