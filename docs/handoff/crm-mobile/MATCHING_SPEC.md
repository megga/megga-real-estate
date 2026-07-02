# Spec d'implémentation — Matching mobile (CRM MEGGA, Sugar Pure)

> Statut : prête à coder. Porte l'écran **Matching** desktop (Atelier) en mobile, écran par écran.
> Réutilise `useAtelierMatching` + ses gestes purs **tel quel** (zéro régression backend).
> Styles inline + tokens `useMobileTokens`, i18n `t()` (lint `no-literal-string`), primitives P1 existantes.
> KYC **non-bloquant**. Undo 5 s + flush au démontage **obligatoires** (contrat audit).

---

## 0. Constat de départ (vérifié dans le code)

- Hook données + gestes : `src/hooks/useAtelierMatching.ts` — **seul** hook du Matching, à réutiliser. Gestes = fonctions **pures** exportées (`execSendDossier/execRelance/execSnooze/execDismiss/execReact/execWake`), pas des hooks.
- Undo Gmail-style : `src/components/matching-atelier/pendingTriage.ts` (`PendingRegistry`, `UNDO_WINDOW_MS = 4500`, `AtelierGestes`). À **réinstancier** côté mobile, à **flush** au démontage.
- Câblage de référence (à recopier mentalement) : `src/pages/agent/MatchingAtelierPage.tsx` (l.54‑156) — `registryRef`, `useEffect(() => () => registry.flushAll(), [registry])`, construction de `GesteContext`, `matchIndex`, `gestes = useMemo(...)`, scan `matching-engine`.
- i18n : namespace `matching` **complet FR/DE/EN/IT** (`src/i18n/locales/*/matching.json`). Sous-arbre utile = `matching.atelier.*`, `matching.tabs.*`, `matching.atelierKyc.*`, `matching.confirm.*`, `matching.aiHint.*`. **Ne pas** toucher `matching.scoreCard/panel/send.*` (ancien écran retiré).
- Routing : **`App.tsx:510` `<Route path="matching" element={<MatchingAtelierPage />} />` n'est PAS dans un `ResponsiveRoute`.** Les mobiles voient aujourd'hui le triptyque desktop. Le port doit envelopper cette route comme `pipeline` (l.490).
- Harnais demo : `/dev/mobile` = `MobileShowcasePage` (no-auth) ; il instancie déjà `<MobilePipelineScreen demo />` et `<MobileTodayScreen demo />`. On y ajoute `<MobileMatchingScreen demo />`. Pattern flag établi : `demo`/`demoData` sur le Screen, données réelles sinon.

---

## 1. Architecture

### 1.1 Navigation deux-temps (liste ↔ focus), tout in-page

Reproduire le pattern proto (`crm-matching-mobile.jsx`) : **un seul** composant route, deux couches superposées, pas de sous-route.

- **VUE 1 — Liste d'acheteurs** (`MobileMatchingScreen`) : header + H1 + barre filtres + liste `MmBuyerCard` + (TabBar via `MobileShell variant="tabs"`).
- **VUE 2 — Focus** (`MmFocus`, `position:absolute; inset:0; zIndex:30`) glisse depuis la droite. Transition fidèle : liste recule `translateX(-22%) brightness(.96)`, focus `translateX(100% → 0)` `.34s cubic-bezier(.4,0,.2,1)`, ombre `-24px`.
- Ouverture : `setSel(group)` puis `setOpen(true)` après 24 ms. Retour : `setOpen(false)` puis `setSel(null)` après 340 ms (garder le contenu pendant la sortie).
- État focus piloté par `?contact=<id>` (cohérent desktop `openBuyerPivot/closeBuyerPivot`) **ou** state local en mode demo. Recommandation : state local `sel/open` pour l'animation + sync `searchParams` non-bloquant (replace) pour le deep-link, exactement comme desktop.

### 1.2 Pivot ACHETEUR (et non annonce)

Le mobile est un **inbox par acheteur** ; le hook desktop est pivoté **par annonce** (`pivots`). Le pont propre, sans re-fetch :

- Construire `buyerGroups` à partir de `pivots` : aplatir `pivots[].buyers`, regrouper par `buyer.id`, garder `topScore = max(score)`, trier `topScore desc`, ne garder que les groupes avec ≥1 match. (Équivalent mobile de `mmBuildGroups`.)
- Pour les biens d'un acheteur dans le focus : appeler **`poolFor(contactId, null)`** → `AtelierPoolMatch[]` (déjà trié score desc, exclut `ignored`/`rejected`). C'est la source des `MmMatchCard`.
- `topBien` (photo de couverture `MmBuyerCard`) = `poolFor(id,null)[0].L` (meilleur match). Photo = `L.gallery[0]?.url`, fallback icône bien.
- KYC badge : `buyer.kyc === 'verified'` → `MmVerifiedBadge`. `buyer.kyc` vient déjà du hook (`mapKycStatus`).

> Conséquence : **un acheteur = N matchId** (un par bien). Chaque geste agit sur **le matchId du bien concerné**, pas sur l'acheteur. Bien identifier `matchId` via `AtelierPoolMatch.matchId`.

### 1.3 Sous-écrans Réglages / Nouvelle recherche

- **Réglages du matching** (`crm-matching-settings-mobile.jsx`) : overlay plein écran, 3 modes (wide/balanced/precise), persiste `localStorage 'megga-matching-mode'` (default `balanced`). **Aucun backend** (les poids vivent server-side `app_config.matching_scoring_v2`). Port direct, théme via `useMobileTokens`, i18n. **À garder minimal et honnête** : c'est un sélecteur de largeur de filet, pas un éditeur de poids.
- **Nouvelle recherche** (`crm-matching-newsearch-mobile.jsx`) : overlay, 6 sections, `mmQuickMatch` client-side. **Hors périmètre câblage Atelier** : la création de critères = `contacts.search_criteria` (vit dans `useContacts.ts`/`useContactMemory.ts`), et le pont matching utilise `client_searches` **côté engine (DB)**, pas l'UI. **Décision** : porter l'écran en **shell visuel demo-only** (le `mmQuickMatch` reste client, sans écriture DB) ET, pour la vraie création, router vers le flux contact existant. Ne **pas** inventer d'écriture `search_criteria`/`client_searches` ici. À confirmer produit : soit (a) demo-only + lien « créer la recherche sur la fiche contact », soit (b) brancher `useContactMemory` plus tard. Par défaut on livre (a).

### 1.4 Stratégie demo (`demo` / `demoData`)

- `MobileMatchingScreen({ demo = false })`. Si `demo` : `buyerGroups` viennent d'un VM figé `DEMO_GROUPS` (couper `useAtelierMatching` via `enabled` n'est pas nécessaire — en `/dev/mobile` no-auth, `agencyId` est `undefined` donc le hook renvoie `[]` ; on bypass simplement avec le flag).
- View-model découplé : définir `interface BuyerGroupVM { id; first; last; av; kyc; topScore; bienCount; coverUrl; coverTitle }` + `interface FocusVM { buyer: BuyerVM; pool: PoolMatchVM[] }`. Un mapper `pivotsToGroups(pivots)` (réel) et `DEMO_GROUPS`/`DEMO_FOCUS` (figés). Le composant ne lit **que** le VM → testable et harnais-friendly.
- **En demo, AUCUN geste n'écrit** : les `gestes` deviennent des no-op qui ne font que le toast + la mutation d'état local (`sent`/`scheduled` Set). Calquer `MobilePipelineScreen` (`if (!demo) updateStage.mutate(...)`).

---

## 2. Blocs à construire

Tous sous `src/components/crm-mobile/matching/`. Réemploi systématique de `MEIcon`, `MeggaWordmark`, `useMobileTokens`, primitives P1.

| Fichier | Rôle | Hook / donnée | Note fidélité |
|---|---|---|---|
| `MobileMatchingPage.tsx` | Route. `<MobileShell variant="tabs"><MobileMatchingScreen /></MobileShell>` | — | Calque de `MobilePipelinePage`. |
| `MobileMatchingScreen.tsx` | VUE 1 + orchestration focus + registry + gestes | `useAtelierMatching()` (réel) ; `DEMO_GROUPS` (demo) | Header pt safe-area, H1 28/800 ls‑1, sous-titre `N acheteurs actifs`, barre filtres bleed `-18`. |
| `MmBuyerCard.tsx` | Carte acheteur (VUE 1) | `BuyerGroupVM` | Radius 22, photo cover h216 + dégradé, kebab rond 32 blur, avatar `av` = **identité** (jamais accent), `MmVerifiedBadge` si verified, compteur `N bien(s)`. **`hideVerdict`** en liste (ni jauge ni pill). |
| `MmVerifiedBadge.tsx` | Sceau KYC vérifié | `kyc === 'verified'` | Sceau bleu `tk.kycSeal` 8 lobes, coche en négatif (evenodd). Seul effet KYC visible en liste. |
| `MmVerdict.tsx` | Pilule verdict qualitatif | `score` | Seuils 90/75/60 → Excellent/Très bon/Bon/À explorer. Skin `onPhoto` vs `cardSubtle/ink`. Score chiffré **interne**, jamais affiché. Utilisé dans le focus, pas la liste. |
| `MmFocus.tsx` | VUE 2 plein écran | `buyerFor(id)` + `poolFor(id,null)` (réel) ; `DEMO_FOCUS` | Header retour rond 40, bloc Critères (eyebrow + grille 2col), bloc Biens correspondants, barre dossier collante conditionnelle, toast. Gère Set `sent/scheduled`. |
| `MmEditField.tsx` | Critère éditable inline | `buyer.criteria` | Carte radius 14. **Lecture seule réelle au v1** (cf. §3 « Affiner »). Édition inline = demo/visuel ; la mutation `search_criteria` n'est pas dans le périmètre Atelier. Afficher Budget via formateur CHF. |
| `MmMatchCard.tsx` | Bien correspondant (focus) | `PoolMatchVM` (= `AtelierPoolMatch.L`) | Radius 18, photo h116 (→ fiche), prix `Vente CHF Xk` / `Location CHF …/mois`. `hideVerdict`+`hideReasons` ici. Boutons **Planifier** (ghost) + **Envoyer**/**Envoyé**. |
| `MmKyc.tsx` | Chip KYC rappel doux | `buyer.kyc` | `verified`(vert)/`pending`(orange)/`none`→« KYC à compléter » (muted/shield). **JAMAIS rouge bloquant.** Libellés `matching.atelierKyc.*`. |
| `MmBienSheet.tsx` | Fiche annonce plein écran | `PoolMatchVM.L` (`AtelierListing` complet) | Hero+galerie, specs 3col, **Pourquoi ce match** (raisons `ok:true` seules), diffusion+stats. Réutiliser au max le rendu desktop `SgaListing`/`format.ts`. Wide ≥680 → 2 col. |
| `MmSendModal.tsx` | Confirmation envoi (HITL) | — | 2 étapes compose→preview, canal E‑mail/WhatsApp (vert `#25D366` **marque only**). **Doit appeler le geste `send` réel** (pas un faux envoi). Human-in-the-loop = exigence. |
| `MmVisitModal.tsx` | Proposer/replanifier visite | — | Durées 30/45/60/90, 3 créneaux (mock en v1). CTA → geste `visit` (navigate vers flux visite). Désactivé tant qu'aucun slot. |
| `vm.ts` | View-models + mappers + DEMO_* | `pivotsToGroups`, `poolToFocus`, `DEMO_GROUPS`, `DEMO_FOCUS` | Découple présentation des rows. |

Sous-écrans (peuvent rester proches du proto, théme + i18n) :

| Fichier | Rôle | Note |
|---|---|---|
| `MmMatchingSettings.tsx` | Réglages (3 modes) | `localStorage 'megga-matching-mode'`. Aucun backend. Glyphes SVG. |
| `MmNewSearch.tsx` | Nouvelle recherche | Demo-only / shell visuel en v1 (cf §1.3). `mmQuickMatch` client. **Pas** d'écriture DB. |

---

## 3. Gestes câblés (mutation exacte)

Construire `gestes: AtelierGestes` **comme `MatchingAtelierPage` l.80‑116** (recopier la structure). Pré-requis identiques :

```ts
const registryRef = useRef<PendingRegistry | null>(null)
if (!registryRef.current) registryRef.current = new PendingRegistry()
const registry = registryRef.current
useEffect(() => () => registry.flushAll(), [registry])   // CRITIQUE — flush au démontage

const ctx: GesteContext | null = useMemo(() => profile?.agency_id ? {
  agencyId: profile.agency_id,
  userId: profile.id ?? user?.id ?? '',
  agentName: profile.full_name ?? t('atelier.defaultAgentName'),
  agentPhone: profile.phone ?? null,
} : null, [profile, user, t])

// matchId → { buyer, listing } construit en aplatissant pivots (comme desktop)
```

| Geste mobile | Quand | Exécuteur (pur) | Mutation DB exacte |
|---|---|---|---|
| **Envoyer** (`MmMatchCard`/`MmSendModal`) | toujours, par bien | `registry.defer(() => execSendDossier(ctx, buyer, listing))` | `matches.update{status:'sent',sent_via:'email',sent_at:now}` + deal (rattache `transactions` actif `contact_buyer_id` sinon insert `new_lead`/`active`) + `activity_events 'dossier_envoye'` + `reminders.insert 'follow_up_sent_property' +5j match_id` + `invoke('send-property-email')` si email. **Toast `seeDeal` → `flushNow()` pour récupérer `dealId`.** |
| **Relancer** (focus, si `status==='no-reply'`) | dossier sans retour | `registry.defer(() => execRelance(ctx, buyer, listing))` | `matches.update{sent_at:now}` (reste `sent`) + `activity_events 'relance'` + reminder existant du match repoussé +5j (sinon insert) + `invoke('send-relance-email')`. |
| **Plus tard** (`MmBuyerCard` menu / focus) | report +7j | `registry.defer(async () => { await execSnooze(ctx, buyer); return null })` | `matches.update{snoozed_until:+7j}` + `reminders.insert type 'custom' channel 'notification' +7j`. |
| **Écarter** (menu kebab → `SgConfirmDestructive`) | retirer de la liste | `registry.defer(async () => { await execDismiss(buyer); return null })` | `matches.update{status:'ignored'}` **uniquement**. Aucun deal/timeline. |
| **Intéressé / Pas intéressé** | **NON exposé sur cet écran** | `execReact` existe mais l'engagement ici est **reçu** (statuts `liked/viewed` via `mapStatus`), pas émis par l'agent. Ne **pas** ajouter de boutons réaction. | (réservé à la réception/desktop) |
| **Réactiver** (un reporté) | hors queue, immédiat | `execWake(matchId).then(refresh)` | `matches.update{snoozed_until:null}` + `reminders.update{status:'cancelled'}`. Pas de `defer`. |
| **Visite** (`MmVisitModal`) | si `listing.kind==='property'` | `registry.flushAll(); navigate('/dashboard/visits/new?bienId=<L.id>&contactId=<buyer.id>')` | **Aucune écriture DB ici.** Router vers le flux visite (mobile s'il existe, sinon route desktop partagée). |
| **Scan** (état vide) | bouton « Lancer un scan » | `supabase.functions.invoke('matching-engine',{body:{mode:'scan-all',agency_id:ctx.agencyId}})` puis `refresh()` | Seul appel edge depuis la page. |

Garde-fous (cf. §6 risques) : `onError: showError`, `onSettled: refresh`. Toast d'undo avec « Annuler » avant l'écriture (la primitive `SgToast` doit exposer une action undo → si elle ne le fait pas encore, ajouter un toast à action, sinon le contrat undo 5 s est faux).

---

## 4. i18n

### À réutiliser (déjà FR/DE/EN/IT, ns `matching`)

- Onglets file : `matching.tabs.{all,to-send,engaged,no-reply}`
- Badges KYC : `matching.atelierKyc.{verified,pending,stale,none}`
- Toasts undo : `matching.atelier.toast.{sent,relance,later,interested,rejected,skipped,backInQueue,seeDeal}` (params `{name}`,`{date}`,`{title}`)
- Gestes / libellés : `matching.atelier.{proposeVisit,dismiss,later,start,followUpOtherChannel,interested,notInterested,reactivate,reactivateNow,backOn,seeDeal,snoozed,snoozedCount}`
- États : `matching.atelier.error.{title,desc,retry}` · `matching.atelier.empty.{title,desc,scanCta,scanning}` · `matching.atelier.queueDone.{title,desc}`
- Chrome focus : `matching.atelier.{closeAtelier,buyerTitle,listingTitle,backToListing,defaultAgentName,buyerQueue,searchBuyer,queueEmpty,noBuyerLeft,matchedListings,matchedListingsCount}`
- Détail/critères/fiche : `matching.atelier.{whyMatches,strengths,attentionPoints,compatibilityScoreEst,searchProfile,budget,targetZones,minSurface,proposeToBuyer,kycSoftReminder,fullListing,viewListing,salePrice,rentPrice,pricePerM2,monthlyCharges,sectionSpecs,sectionFeatures,sectionDescription,sectionLocation,spec*}`
- Confirmation HITL : `matching.confirm.*`
- Hint IA : `matching.aiHint.*` (`composeAiHint` est pur → réutilisable tel quel)
- Nav partagée : `common:nav.{matching,search}`, `common:actions.options`

### À ajouter (clés mobile-spécifiques absentes — proposer)

- `matching.mobile.activeBuyers` → « {{count}} acheteur·s actif·s » (sous-titre H1)
- `matching.mobile.verdict.{excellent,veryGood,good,explore}` (si `mMatchLabel` n'a pas déjà d'équivalent ; sinon réutiliser un set existant — **grep avant d'ajouter**)
- `matching.mobile.bienCount` → « {{count}} bien·s »
- `matching.mobile.dossierBar` → « {{count}} bien·s au dossier · prêt à envoyer à {{name}} » + `matching.mobile.sendDossier`
- `matching.mobile.criteriaModified` + `matching.mobile.relaunch` + `matching.mobile.relaunchDone` (si l'édition inline est activée ; sinon différer)
- `matching.mobile.settings.{title,sub,howMany,wide,balanced,precise,recommended,save}` (réglages) — **vérifier** si le proto n'a pas déjà mappé sur des clés existantes
- `matching.mobile.newSearch.*` (si on porte autre chose qu'un shell demo)

> Avant d'ajouter une clé : `grep` le namespace `matching` — beaucoup de libellés du proto existent déjà sous `atelier.*`. Toute clé ajoutée passe par `i18n-sync` (4 langues) sinon `parity:ci` bloque.

---

## 5. Routing & demo

- **Wrapper responsive** : remplacer `App.tsx:510` par
  `<Route path="matching" element={<ResponsiveRoute desktop={<MatchingAtelierPage />} mobile={<MobileMatchingPage />} />} />`
  (calque exact de `pipeline` l.490). `MobileMatchingPage` en `lazy(() => import('@/components/crm-mobile/matching/MobileMatchingPage'))`.
- **Harnais** : ajouter `<MobileMatchingScreen demo />` dans `src/pages/dev/MobileShowcasePage.tsx` (à côté de `MobilePipelineScreen demo`). No-auth, données figées `DEMO_GROUPS`/`DEMO_FOCUS`. Permet de valider l'animation liste↔focus, les modales et les sous-écrans sans session.

---

## 6. Risques (à ne pas casser)

1. **Undo 5 s** : l'écriture réelle ne part qu'à l'expiration via `PendingRegistry.defer`. **Ne pas** écrire `matches` par une mutation React Query directe → l'undo deviendrait mensonger. Toujours `registry.defer(...)` + handle `{cancel,flushNow}`. Le toast doit offrir « Annuler » (vérifier que `SgToast` supporte une action ; sinon l'ajouter).
2. **`flushAll()` au démontage** : `useEffect(() => () => registry.flushAll(), [registry])`. Sans ça, les gestes en attente (non annulés) ne s'exécutent jamais → perte silencieuse d'envois/snooze/dismiss. Idem `flushAll()` avant toute `navigate` (visite, voir le deal, retour).
3. **`flushNow()`** : utilisé par « Voir le deal → » pour forcer l'exécution et récupérer `dealId`. Ne pas le supprimer si le bouton existe en mobile.
4. **Ne pas contourner `execReact`** : `matches.status='interested'|'rejected'` doit passer par un UPDATE pour déclencher `set_match_response_at` + `log_match_reaction`. (Sur cet écran, réaction non exposée — donc surtout : ne pas écrire `response_at` à la main ailleurs.)
5. **Audit `activity_events` obligatoire** : `execSendDossier`/`execRelance` appellent `logEvent` (`actor_kind:'user'`, `category:'deal'`). Comme on réutilise les exécuteurs purs, c'est garanti — **ne pas** réimplémenter une variante mobile qui sauterait l'audit.
6. **`reminders.match_id`** : sert de dédup avec l'automation-engine (+3j). Préservé car on passe par `execSendDossier`. Ne pas réécrire l'insert.
7. **RLS / profil** : `ctx` est `null` sans `profile.agency_id` → les gestes no-op. Gérer l'état chargement profil (skeleton) avant d'activer les boutons d'action. En `/dev/mobile`, `demo` court-circuite (aucune écriture).
8. **`snoozed_until` UI + DB** : la file masque via `isSnoozed(snoozedUntil)` ET `execSnooze` écrit `+7j`. `poolFor`/`pivots` excluent déjà `ignored`/`rejected` ; cohérence à préserver.
9. **Pivot acheteur vs annonce** : un acheteur a N matchId. Chaque geste cible **le matchId du bien**, pas l'acheteur. Le mauvais `matchId` enverrait/écarterait le mauvais bien.
10. **`MmMatchCard` n'a pas de déclencheur « ajouter au dossier »** dans le proto (incohérence relevée) → la barre dossier collante peut rester inatteignable. **Décision** : en v1, l'envoi se fait **par bien** via `MmSendModal` (geste `send`), et la barre dossier multi-biens est différée (ou alimentée par un long-press / toggle explicite à ajouter). Ne pas livrer une barre dossier morte.
11. **Pas de virtualisation** : `useAtelierMatching` charge tous les matches de l'agence (order score desc, pas de `count` exact — OK). Acceptable mobile au volume pilote ; surveiller si gros volume.
12. **Couleurs** : avatar `av` = identité (jamais accent UI) ; WhatsApp `#25D366` = marque only ; rouge `tk.danger` réservé destructif (Écarter) à fond plein texte blanc ; tons good/warm réservés aux pastilles d'engagement data-only. Accent unique = `tk.accent` (noir clair / blanc cassé sombre).
