# Matching · lot E1 — la bascule au bureau · plan d'exécution

> **Pour un agent :** SOUS-COMPÉTENCE REQUISE — `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`, tâche par tâche. Les étapes sont des cases à cocher.

**But :** le fil de matchs devient le Matching du bureau. « Matching » s'ouvre sur lui ; un lien d'« Aujourd'hui » ou d'une fiche y atterrit sur la bonne ligne, une seule fois ; une agence sans acheteur y trouve comment démarrer ; un mandat qui n'est plus en vente ne se propose plus nulle part ; un deal perdu ne reçoit plus de geste neuf ; le moteur renote une recherche modifiée ; l'atelier de bureau et le catalogue d'« Aujourd'hui » disparaissent. Rien ne part vers l'acheteur.

**Conception :** [2026-09-27-matching-lot-e1-bureau-design.md](../specs/2026-09-27-matching-lot-e1-bureau-design.md), validée par Julien le 27.09.2026 section par section, avec ses trois précisions et les trois décisions prises pendant l'écriture de ce plan (le copilote WhatsApp suit la règle du mandat en vente, §5.3 ; le titre de « Sa boucle », §5.5 ; un deal perdu, §5.8). **Étape 5a** de la [feuille de route](../feuille-de-route.md).

**Architecture :** aucune table ni fonction de base neuve — deux fonctions du copilote (lot D2, pas en production) sont corrigées en place. Les gestes quittent l'atelier pour `src/lib/matchingGestes.ts` avant qu'il soit retiré ; « en vente » et « deal ouvert » ont chacun UNE définition, lue partout où elle compte ; une arrivée porte un jeton dans sa navigation, rangé dans la tranche de son onglet une fois appliqué ; le moteur renote, par l'écrivain du lot B, les couples « à proposer » d'une recherche modifiée et, chaque nuit, ceux d'une version ancienne.

**Pile :** React 18 / TypeScript strict / React Query (écrans), Deno (Edge Function `matching-engine`, copilote WhatsApp), PostgreSQL (deux fonctions du lot D2 corrigées en place), Vitest (unitaire ; `tests/backend` contre une base locale).

**Branche :** `megga/matching-lot-e`, partie de `megga/matching-lot-d2`.

**Méthode d'écriture :** chaque tâche a été JOUÉE dans une copie jetable du dépôt avant d'être écrite, jusqu'au vert, puis sa section a été rejouée mécaniquement sur une copie neuve ; l'arbre obtenu était identique à l'octet. Le plan entier a ensuite été rejoué d'un bloc depuis son seul texte, sur une copie neuve du point de départ (28.09.2026) : 480 instructions, aucune en échec, arbre identique à l'octet, `tsc -b --force` à 0.

> ⚠ **Les commits attendent le signal de Julien** (« committe ») : ils se jouent tous à la fin (tâche 17), **un commit par sujet**, dans l'ordre des tâches. Pendant l'exécution, on enchaîne sans commiter — et on prend une PHOTO de l'arbre après chaque tâche (`git write-tree` dans un index temporaire), qui servira à bâtir chaque commit à l'identique.

> ⚠ **Aucune migration neuve.** La tâche 10 corrige en place deux fonctions de `20260924200000_matching_whatsapp.sql` (lot D2, pas en production), et la tâche 1 deux de ses commentaires : cette migration s'applique à la main AVANT la fusion, avec toute la pile, depuis l'état final de la branche. **À la fusion, sur accord de Julien :** la version du moteur passe à 4 (`app_config.matching_scoring_v2.version`, conception §5.7) ; la nuit suivante renote les couples « à proposer ».

> ⛔ **Rien ne part vers l'acheteur.** E1 n'ajoute aucune sortie et en retire une (le message pré-rempli de « Planifier une visite » pour un acquéreur compatible, tâche 5). `tests/unit/matching-sans-sortie.spec.ts` suit chaque fichier déplacé ou neuf.

> ⚠ **Les specs de la base (`tests/backend/`) se jouent en local, sur colima, avant la fusion** (procédure à la tâche 17) : `backend.yml` ne tourne que sur une PR ou un push vers `main`, et c'est ce jeu-là qui a trouvé, le 27.09.2026, l'épingle de région manquante des lots B et C.

> ⚠ **La suite unitaire se joue SEULE**, jamais en parallèle de `tsc`, d'`eslint` ou de `deno check` : les délais de 5 s sautent et les faux rouges s'enchaînent. Une spec qui rougit se rejoue d'abord seule. Trois échecs locaux sont connus et hors sujet : `mail/imap`, `mail/mime-parse`, `safe-internal-path`.

> ⚠ **`npx tsc -b --force`, jamais sans `--force`** dans une copie dont le `node_modules` est un lien vers le dossier principal : le `tsbuildinfo` partagé (`node_modules/.tmp`) ferait sauter la vérification.

> ⚠ **La fusion reste à la fin, avec toute la pile.** E1 suffit à D1 et D2 ; E2 (le téléphone) suit.

---

## Les fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `src/lib/matchingGestes.ts` | **Créer.** Les gestes du matching (fil, fiche d'un mandat, mobile) : exécuteurs, références des biens, types propres. Un seul écrivain par geste. | 1 (5, 6, 10) |
| `src/lib/matchingAnnulation.ts` | **Déplacer** (ex-`matching-atelier/pendingTriage.ts`). La file d'annulation des gestes. | 1 |
| `src/hooks/useAtelierMatching.ts` | Réduit à la lecture du modèle de l'atelier, que seul l'écran mobile lit encore (retirée au lot E2). | 1, 15 |
| `src/components/matching-fil/filModele.ts`, `filBoucle.ts`, `src/hooks/useMatchingFil.ts` | Le fil lit l'état des mandats (« en vente ») ; les recherches actives. | 2, 12 |
| `src/components/matching-fil/filQuiPour.ts`, `QuiPourFiche.tsx`, `FilQuiPourCeBien.tsx` | « Qui pour ce bien ? » sans les refus ; jamais sur un mandat hors vente. | 3 |
| `src/components/crm/contacts-pager/saBoucle.ts`, `ContactDetailPager.tsx`, `src/hooks/useContactSentMatches.ts` | « Sa boucle » : les biens revenus, le mandat hors vente, le titre de la liste. | 4, 8 |
| `src/components/crm/biens/fiche/visiteurs.ts` | **Créer.** Qui visite, qui reçoit un message, ce que fait la création d'une visite. | 5 (10) |
| `src/components/crm/biens/fiche/PlanifierVisite.tsx`, `src/hooks/useVisitDetail.ts` | « Planifier une visite » d'un mandat suit la règle du fil pour un acquéreur compatible. | 5 |
| `src/hooks/useAgentNotifications.ts` | `match_reactive` dans la cloche. | 6 |
| `supabase/functions/_shared/whatsapp-matching-outils.ts`, `whatsapp-i18n.ts`, `whatsapp-matching.ts` | Le copilote refuse « proposé » sur un mandat hors vente. | 2, 7 |
| `supabase/functions/_shared/matching-renotation.ts`, `supabase/functions/matching-engine/index.ts` | La renotation : `match-contact` et le rattrapage de nuit de `scan-all`. | 9 |
| `src/lib/dealOuvert.ts` | **Créer.** Un deal ouvert : UNE définition, lue par la fiche et les gestes. | 10 |
| `supabase/migrations/20260924200000_matching_whatsapp.sql` | Migration du lot D2 (pas en production) : deux fonctions corrigées en place (deal ouvert), deux commentaires. | 1, 10 |
| `src/lib/jetonArrivee.ts`, `src/hooks/useArrivee.ts` | **Créer.** Une arrivée s'applique une fois par navigation. | 11 (12) |
| `src/components/matching-fil/filLiens.ts`, `MatchingFil.tsx`, les pages qui ouvrent le fil ou la fiche avec une arrivée | Les liens d'arrivée portent un jeton ; les écrans le consomment. | 11, 12 |
| `src/components/matching-fil/filDemarrage.ts` | **Créer.** L'état de la page 0 : chargement, erreur, couverture, aucun match, fil. | 12 |
| `src/components/matching-fil/MatchingFirstRun.tsx` | **Déplacer** (ex-`matching-atelier/`). La couverture de premier lancement, textes corrigés. | 12 |
| `src/pages/agent/ContactsPage.tsx` | `?nouveau=1` ouvre la création d'un contact (arrivée à jeton). | 12 |
| `src/pages/agent/MatchingPage.tsx` | Le fil en page 0, l'arrivée sur lui. | 11, 13, 15 |
| `src/pages/agent/MatchingAtelierPage.tsx` | **Supprimer.** | 13 |
| `src/pages/agent/TodayPage.tsx`, `src/components/crm/today/TodayNavContext.tsx`, `kit.tsx` | « Aujourd'hui » à une page. | 14 |
| `src/components/crm/today/PageCatalogue.tsx` | **Supprimer.** | 14 |
| `src/components/matching-atelier/` | **Supprimer** le dossier : dix composants, `constants.ts`, `atelier.css` ; ses survivants relogés. | 15 |
| `src/components/matching-recherche/MrhIcon.tsx` | **Déplacer** (ex-`matching-atelier/AtlIcon.tsx`). | 15 |
| `src/components/crm-mobile/matching/types.ts`, `format.ts`, `composeAiHint.ts` | **Déplacer** (ex-`matching-atelier/`). Le modèle de l'atelier, lu par le seul mobile jusqu'au lot E2. | 15 |
| `src/pages/dev/MatchingShowcasePage.tsx`, `matchingAtelierFixtures.ts` | **Supprimer** (le banc `/dev/matching-atelier`). | 15 |
| `src/pages/dev/rechercheDuBanc.ts`, `CrmShowcasePage.tsx`, `crmFixtures.ts`, `matchingFilBanc.tsx` | Le banc `/dev/crm` : la couverture, « Sans match », un mandat vendu, les états démo de la Recherche. | 4, 12, 15 |
| `eslint.config.js`, `scripts/lint-i18n-hardcoded.mjs`, `scripts/i18n-scan.mjs` | La garde i18n vise `matching-fil`. | 15 |
| `src/i18n/locales/{fr,de,en,it}/*.json` | `matching` (3, 12, 16 : 214 clés retirées), `listings` (5), `common` (6), `contacts` (8), `dashboard` (14 : 79 clés retirées). | 3, 5, 6, 8, 12, 14, 16 |
| `tests/unit/matching-gestes-module.spec.ts`, `fiche-planifier-visite.spec.ts`, `deal-ouvert.spec.ts`, `jeton-arrivee.spec.tsx`, `matching-fil-demarrage.spec.ts`, `banc-matching-e1.spec.ts`, `matching-pager.spec.tsx`, `aujourdhui-une-page.spec.ts`, `matching-atelier-retire.spec.ts`, `matching-cles-mortes.spec.ts` | **Créer.** Une spec par règle neuve. | 1, 5, 10-16 |
| `tests/backend/matching-renotation.spec.ts` ; `tests/backend/matching-gestes-contrat.spec.ts` (ex-`atelier-matching-loop.spec.ts`) ; `tests/backend/matching-whatsapp.spec.ts` (W7) | Les specs de la base, jouées en local à la tâche 17. | 9, 15, 10 |
| `tests/unit/matching-sans-sortie.spec.ts`, `megga-x-grammar.spec.ts`, `couleur-barreaux.spec.ts`, `megga-x-crm-tokens.spec.ts`, `etat-vide.spec.ts`, `dev-bancs-frontiere.spec.ts`, `matching-contraste.spec.ts` et les autres gardes à chemins en dur | Suivent chaque déplacement ; les cliquets ne font que descendre. | 1-16 |

---

## Tâche 1 : Les gestes quittent l'atelier

Le fil de matchs emprunte à l'atelier de bureau ses exécuteurs de gestes, sa file d'annulation et ses deux types de geste — `AcheteurGeste` et `BienGeste`, des `Pick` des types de l'atelier (`useAtelierMatching.ts:520-521`) ; « Aujourd'hui » (`execProposer`), la Recherche (`isSnoozed`) et l'écran mobile (ses exécuteurs, `PendingRegistry`) aussi. Or l'atelier de bureau part au lot E1 (tâche 12), et sa lecture avec l'écran mobile au lot E2. Relogement A (conception §6.2, décidé par Julien le 27.09.2026) : les exécuteurs et ce qu'ils portent — les références des biens, les statuts d'une relance ouverte, `isSnoozed`, `rattacherDeal`, le contexte des gestes — passent dans `src/lib/matchingGestes.ts`, avec des types écrits en propre ; la file d'annulation devient `src/lib/matchingAnnulation.ts`. **Déplacement sans changement de comportement** : le code des exécuteurs est recopié à l'identique, messages de console `[atelier] …` compris (`matching-fil-gestes.spec.ts:318` en lit un) ; `useAtelierMatching.ts` ne garde que sa lecture (1 157 → 445 lignes), sans ré-export de compatibilité ; chaque importeur suit. Les commentaires qui donnaient l'ancienne adresse des gestes (« `useMatchingFil` tire statiquement `useAtelierMatching` », « `execProposer` (useAtelierMatching) »…) deviendraient faux : ils sont corrigés, deux commentaires de la migration du lot D2 compris — elle n'est pas en production (choix à valider).

**Fichiers :**
- Créer : `tests/unit/matching-gestes-module.spec.ts`
- Créer : `src/lib/matchingGestes.ts`
- Déplacer : `src/components/matching-atelier/pendingTriage.ts` → `src/lib/matchingAnnulation.ts`
- Modifier : `src/hooks/useAtelierMatching.ts`
- Modifier (imports) : `src/components/matching-fil/MatchingFil.tsx`, `src/components/matching-fil/FilConclure.tsx`, `src/hooks/useMatchingFil.ts`, `src/hooks/useAjouterSelection.ts`, `src/components/crm/today/PageCatalogue.tsx`, `src/pages/agent/MatchingAtelierPage.tsx`, `src/components/matching-atelier/AtelierStage.tsx`, `src/components/matching-atelier/AtlAcheteurMode.tsx`, `src/pages/dev/MatchingShowcasePage.tsx`, `src/components/crm-mobile/matching/MmMatchingScreen.tsx`, `src/components/crm-mobile/matching/vm.ts`
- Modifier (commentaires qui donnaient l'ancienne adresse) : `src/components/matching-fil/filModele.ts`, `src/hooks/useAnciensProspects.ts`, `src/hooks/useQuiPourCeBien.ts`, `src/hooks/useAcquereursNouveauMandat.ts`, `src/hooks/usePigeAcheteurs.ts`, `src/hooks/useContactSentMatches.ts`, `src/hooks/useMatching.ts`, `src/components/crm/today/useFocusQueue.ts`, `tests/backend/atelier-matching-loop.spec.ts`, `supabase/migrations/20260924200000_matching_whatsapp.sql`
- Modifier (specs et garde) : `tests/unit/matching-fil-gestes.spec.ts`, `tests/unit/matching-whatsapp-sql.spec.ts`, `tests/unit/matching-sans-sortie.spec.ts`

- [ ] **Étape 1 : Écrire le test qui échoue**

La garde lit les deux modules neufs : aucun import de l'atelier, aucun type emprunté, plus aucun exécuteur exporté par la lecture de l'atelier, plus de seconde file d'annulation.

Créer `tests/unit/matching-gestes-module.spec.ts` :

```ts
/**
 * Garde : les gestes du matching ne dépendent d'aucune surface (conception du lot E1, §6.2).
 *
 * Le fil de matchs et l'écran mobile posent les mêmes gestes, et la Recherche en lit la règle du report : un seul
 * écrivain par geste, `src/lib/matchingGestes.ts`, et une seule file d'annulation, `src/lib/matchingAnnulation.ts`.
 * L'atelier de bureau disparaît au lot E1, sa lecture (`useAtelierMatching`) avec l'écran mobile au lot E2 : ce que le
 * fil écrit ne doit dépendre ni de l'un ni de l'autre.
 *
 * Ce que cette spec refuse :
 *   · un import, depuis l'un des deux modules, du dossier de l'atelier (`matching-atelier/`) ou de sa lecture
 *     (`useAtelierMatching`) : retirer l'atelier casserait le fil ;
 *   · un type de geste emprunté à ceux de l'atelier (`Pick` d'un type `Atelier…`) : `AcheteurGeste` et `BienGeste`
 *     sont écrits en propre, avec les seuls champs que les gestes lisent ;
 *   · un exécuteur (`exec…`) encore exporté par `useAtelierMatching`, ou un ré-export qui l'y ramènerait : deux
 *     adresses pour un geste, dont l'une meurt avec l'atelier ;
 *   · une seconde file d'annulation sous son ancien nom (`matching-atelier/pendingTriage.ts`).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const R = process.cwd()
const GESTES = 'src/lib/matchingGestes.ts'
const ANNULATION = 'src/lib/matchingAnnulation.ts'
const LECTURE = 'src/hooks/useAtelierMatching.ts'

function lire(chemin: string): string {
  expect(existsSync(join(R, chemin)), `${chemin} introuvable`).toBe(true)
  return readFileSync(join(R, chemin), 'utf8')
}

/** Commentaires blanchis : un en-tête peut NOMMER l'atelier sans en dépendre. */
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')

/** Les modules qu'un code importe : statiquement, dynamiquement ou pour ses seuls effets. */
function importes(code: string): string[] {
  const motif = /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm
  return [...code.matchAll(motif)].map((m) => m[1] ?? m[2] ?? m[3])
}

describe('les gestes du matching ne dépendent d’aucune surface', () => {
  it.each([GESTES, ANNULATION])('%s n’importe rien de l’atelier', (chemin) => {
    const modules = importes(sansCommentaires(lire(chemin)))
    expect(modules.length, `aucun import lu dans ${chemin} : la garde ne mesurerait plus rien`).toBeGreaterThan(0)
    expect(modules.filter((m) => /matching-atelier\/|useAtelierMatching/.test(m))).toEqual([])
  })

  it.each([GESTES, ANNULATION])('%s n’emprunte aucun type de l’atelier', (chemin) => {
    expect(sansCommentaires(lire(chemin))).not.toMatch(/Pick<\s*Atelier/)
  })

  it('AcheteurGeste et BienGeste sont déclarés dans le module des gestes', () => {
    const code = sansCommentaires(lire(GESTES))
    expect(code).toMatch(/^export (?:interface|type) AcheteurGeste\b/m)
    expect(code).toMatch(/^export (?:interface|type) BienGeste\b/m)
  })

  it('la lecture de l’atelier n’exporte plus aucun exécuteur', () => {
    const code = sansCommentaires(lire(LECTURE))
    const declaration = /^export\s+(?:async\s+)?(?:function|const|let)\s+(exec[A-Z]\w*)/gm
    const declares = [...code.matchAll(declaration)].map((m) => m[1])
    const reexportes = [...code.matchAll(/^export\s*(?:type\s*)?\{([^}]*)\}/gm)]
      .flatMap((m) => m[1].split(','))
      .map((n) => n.trim())
      .filter((n) => /\bexec[A-Z]/.test(n))
    expect([...declares, ...reexportes]).toEqual([])
    expect(/^export\s+\*/m.test(code), 'un `export *` y ramènerait les exécuteurs').toBe(false)
  })

  it('la file d’annulation n’a qu’une adresse', () => {
    expect(existsSync(join(R, 'src/components/matching-atelier/pendingTriage.ts'))).toBe(false)
  })
})
```

```bash
npx vitest run tests/unit/matching-gestes-module.spec.ts
```

Attendu : ÉCHEC, 7 tests sur 7 : `src/lib/matchingGestes.ts introuvable` (trois fois), `src/lib/matchingAnnulation.ts introuvable` (deux fois), `expected [ 'execProposer', …(11) ] to deeply equal []` (les douze exécuteurs encore exportés par `useAtelierMatching.ts`), et `expected true to be false` (`pendingTriage.ts` existe encore).

- [ ] **Étape 2 : Créer le module des gestes**

Tout ce qui suit la fonction `useAtelierMatching` (lignes 487 à 1 157 : `isSnoozed`, puis `GesteContext` … `logEvent`), plus `refAnnonceMarche` (l. 171-173) et `refBienInterne` (l. 218-219), recopiés à l'octet près, SAUF :
- l'en-tête `/** */` : le rôle et le pourquoi (un geste, un écrivain), puis la liste des gestes et les deux « ⛔ » repris de l'en-tête du hook ;
- `refAnnonceMarche`, `refBienInterne` et `isSnoozed` en tête, sous l'intertitre « Ce que les gestes portent » ; l'intertitre des exécuteurs ne dit plus « Appelés par la page » ;
- `ResultatProposition` : la file d'annulation s'appelle `matchingAnnulation`, et un rejet « rend la ligne » (le texte ne décrivait que l'atelier : « remonte l'atelier ») ;
- `AcheteurGeste` et `BienGeste` écrits en propre (interfaces aux champs documentés, mêmes champs et mêmes types que les `Pick` qu'ils remplacent) ;
- `execProposerSelection` et `execReact` : `Pick<AcheteurGeste, …>` au lieu de `Pick<AtelierBuyer, …>`.

Dépendances coupées : les seuls liens à l'atelier étaient `AtelierBuyer` et `AtelierListing` (les deux `Pick` des types de geste, et ceux d'`execProposerSelection` et d'`execReact`) ; les autres imports sont `@/lib/supabase`, `@/lib/intercom`, `@/lib/intercom-milestones`, trois types de `@/types/database`, et deux types du FIL, en `import type` (`MotifRefus` de `filBoucle`, `CorrectionChangement` de `filApprendre`). Les imports de la lecture (`react`, TanStack, `useAuth`, `mapKycStatus`, `composeAiHint`, `fmtBudgetRange`, les types de l'atelier) ne viennent pas.

Créer `src/lib/matchingGestes.ts` :

```ts
/**
 * Les gestes du matching : les exécuteurs de ce que l'agent CONSIGNE sur un match, et ce qu'ils portent — la
 * référence d'un bien, la règle du report, les statuts d'une relance ouverte, le deal rattaché.
 *
 * ⛔ UN GESTE, UN ÉCRIVAIN. Le fil de matchs et l'écran mobile posent les mêmes gestes, et la Recherche en lit la
 * règle du report : tous passent par ce module, pour que le match, le deal, la relance et la ligne de journal d'un
 * geste soient les mêmes d'où qu'on le pose. Il ne dépend d'aucune surface : ses types (`AcheteurGeste`,
 * `BienGeste`) ne portent que ce que les gestes lisent, et chaque écran y ramène sa propre forme.
 *
 * Gestes (ceux qui font sortir un match partent APRÈS la fenêtre d'annulation de l'écran, `matchingAnnulation` —
 * undo Gmail-style : rien n'est écrit tant que le toast offre « Annuler ») :
 *   proposer     → « Je l'ai proposé » : le match, s'il est encore 'suggested' → 'sent',
 *                  sent_via='agent' + Deal new_lead (créé ou rattaché) + activity_events
 *                  'match_propose' + relance interne +3 j + jalon Intercom first_match_sent.
 *                  Plus rien à proposer → rien d'autre n'est écrit (`deja`)
 *   proposerSelection → ses matchs encore 'suggested' → 'sent' 'agent' + UN deal,
 *                  UN 'match_propose', UNE relance +3 j, sur les SEULS matchs marqués (fil)
 *   relance      → « J'ai relancé » : matches.sent_at=now + activity_events 'relance' +
 *                  relance de proposition repoussée +3 j
 *   react        → Intéressé / Pas intéressé : matches.status + relance de proposition close
 *   snooze       → matches.snoozed_until=+7 j + reminder 'custom' à échéance
 *                  (la ligne « de retour » remonte dans Aujourd'hui) + 'match_reporte'
 *   dismiss      → matches.status='ignored' (le moteur ne re-propose jamais
 *                  un couple existant — aucun deal) + activity_events 'match_ecarte'
 *   wake         → snoozed_until=null + reminder annulé (immédiat, hors queue)
 *   repondre     → (fil, lot B) Intéressé / Pas intéressé + motif : matches.status, motif, note ; la
 *                  relance de la PROPOSITION se clôt par trigger quand plus aucun de ses biens n'attend
 *   pasEncore    → (fil) la relance de la proposition repoussée de +3 j, si le bien attend encore ; rien
 *                  sur le match
 *   planifierVisite → (fil) match 'visit_planned' + visite interne (mandat) ou événement « visite » de
 *                  l'agenda (annonce du marché) + deal avancé ; aucune invitation
 *   ajusterRecherche / ignorerCorrection → (fil) « Apprendre » : la correction validée (edge
 *                  matching-engine, mode rescore-search, la SEULE clé corrigée) ou ses refus pris en compte
 *
 * ⛔ Une relance qui ne se pose pas FAIT LEVER le geste (`poserRelance`) : sans elle, l'agent n'est jamais
 * rappelé de noter la réponse, et l'échec ne se lisait qu'en console.
 *
 * ⛔ Aucun geste n'écrit à l'acheteur — ni e-mail, ni lien, ni WhatsApp (décision de
 * Julien, 21.09.2026 : le matching reste chez l'agent). L'agent présente les biens par
 * ses propres moyens ; le CRM consigne et lui rappelle de noter la réponse.
 */
import { supabase } from '@/lib/supabase'
import { INTERCOM_EVENTS } from '@/lib/intercom'
import { markIntercomMilestone } from '@/lib/intercom-milestones'
import type { Enums, Json, TablesInsert } from '@/types/database'
import type { MotifRefus } from '@/components/matching-fil/filBoucle'
import type { CorrectionChangement } from '@/components/matching-fil/filApprendre'

// ─── Ce que les gestes portent ──────────────────────────────────────────

/** Référence affichée d'une annonce du marché — la même dans l'atelier et dans le fil de matchs. */
export const refAnnonceMarche = (portail: string | null, sourceId: string | null, id: string): string =>
  `MG-${portail === 'flatfox' ? 'FL' : 'MK'}-${sourceId ?? id.slice(0, 6)}`

/** Référence affichée d'un bien interne — la même dans l'atelier et dans le fil de matchs. */
export const refBienInterne = (id: string): string => `MG-IN-${id.slice(0, 6).toUpperCase()}`

/** true tant que le report (snooze) d'un match n'est pas échu. */
export const isSnoozed = (until: string | null): boolean =>
  until != null && new Date(until).getTime() > Date.now()

// ═══════════════════ Gestes métier (exécuteurs) ═══════════════════════════
// Ceux qui font sortir un match partent APRÈS la fenêtre d'annulation (5 s) — cf. en-tête.

export interface GesteContext {
  agencyId: string
  userId: string
}

/**
 * Ce qu'une proposition rend à son appelant et, par lui, au registre d'annulation (`matchingAnnulation`) :
 * le deal, pour « Voir le deal → », et `deja`.
 *
 * `deja` : aucun des matchs n'était encore à proposer à cet acheteur — déjà proposé, répondu ou
 * écarté entre-temps (un collègue, un autre onglet, un double geste), ou d'un autre acheteur. RIEN
 * d'autre n'est alors écrit : ni deal, ni journal, ni relance. C'est un RÉSULTAT et non une erreur :
 * l'état voulu est déjà là, ou a été tranché autrement. Un rejet passerait par `onError`, qui dit
 * « échec » à l'agent et rend la ligne ; l'appelant rafraîchit, et la file se remet d'accord.
 */
export interface ResultatProposition {
  dealId: string | null
  deja: boolean
}

/**
 * Ce qu'un geste lit d'un acheteur et d'un bien, et rien de plus : le journal et la relance nomment
 * l'acheteur, le bien par sa référence et son titre ; le deal se rattache par le genre et l'id du
 * bien. Écrits en propre, sans rien emprunter à la forme d'un écran : chaque surface a la sienne et
 * n'en passe que ces champs — les exécuteurs restent la source UNIQUE des écritures, et ne leur
 * demandent que ce qu'ils lisent.
 */
export interface AcheteurGeste {
  /** L'id du CONTACT, pas celui du match. */
  id: string
  matchId: string
  first: string
  last: string
  /** Le score du match, consigné au journal. */
  score: number
}

/** Le bien d'un geste : son genre et son id rattachent le deal, sa référence et son titre le nomment. */
export interface BienGeste {
  /** `property` : un bien en mandat (`properties`) ; `market` : une annonce du marché (`market_listings`). */
  kind: 'property' | 'market'
  id: string
  /** `refBienInterne` ou `refAnnonceMarche`. */
  ref: string
  title: string
}

/**
 * Le deal d'un acheteur à qui l'on propose un bien : l'actif le plus récent s'il existe — un bien en
 * mandat y est rattaché s'il n'en porte aucun, jamais écrasé —, sinon un `new_lead` créé sur ce bien.
 * Partagé par la proposition d'un bien et celle d'une sélection, pour qu'elles ne divergent pas.
 */
async function rattacherDeal(ctx: GesteContext, contactId: string, listing: Pick<BienGeste, 'kind' | 'id'>): Promise<string> {
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, property_id')
    .eq('agency_id', ctx.agencyId)
    .eq('contact_buyer_id', contactId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  if (existing && existing.length > 0) {
    const deal = existing[0] as { id: string; property_id: string | null }
    if (listing.kind === 'property' && !deal.property_id) {
      await supabase.from('transactions').update({ property_id: listing.id }).eq('id', deal.id)
    }
    return deal.id
  }
  const insert: TablesInsert<'transactions'> = {
    agency_id: ctx.agencyId,
    contact_buyer_id: contactId,
    assigned_to: ctx.userId,
    stage: 'new_lead',
    status: 'active',
  }
  if (listing.kind === 'property') insert.property_id = listing.id
  else insert.market_listing_id = listing.id
  const { data: created, error } = await supabase.from('transactions').insert(insert).select('id').single()
  if (error) throw error
  return (created as { id: string }).id
}

/**
 * « Je l'ai proposé » (E) — l'agent a présenté le bien à l'acheteur, par ses propres moyens.
 *
 * ⛔ LE CRM N'ENVOIE RIEN À L'ACHETEUR (décision de Julien, 21.09.2026 : le matching reste chez
 * l'agent). Le geste consigne : le match passe `sent` avec `sent_via = 'agent'`, le deal est
 * rattaché (ou créé en `new_lead`), une ligne `match_propose` au journal, et UNE relance interne
 * à +3 jours (canal `task`) pour que l'agent consigne la réponse.
 *
 * Le marquage ne touche le match que s'il est ENCORE `suggested` et qu'il est bien celui de CET
 * acheteur. ⛔ Sinon, un double geste (ou celui d'un collègue) réécrivait un match déjà proposé, voire
 * `interested`, en `sent`, et posait un deuxième deal, une deuxième ligne de journal, une deuxième
 * relance. Aucune ligne marquée : rien d'autre n'est écrit, `deja` le dit (cf. `ResultatProposition`).
 */
export async function execProposer(
  ctx: GesteContext,
  buyer: AcheteurGeste,
  listing: BienGeste,
): Promise<ResultatProposition> {
  // 1. Match → proposé par l'agent, s'il est encore à proposer
  const { data: marques, error: mErr } = await supabase
    .from('matches')
    .update({ status: 'sent', sent_via: 'agent', sent_at: new Date().toISOString() })
    .eq('id', buyer.matchId)
    .eq('contact_id', buyer.id)
    .eq('status', 'suggested')
    .select('id')
  if (mErr) throw mErr
  if (!marques || marques.length === 0) return { dealId: null, deja: true }
  // Jalon Intercom (une première proposition par agent). Signal seul : ni le bien ni l'acheteur ne partent.
  void markIntercomMilestone(INTERCOM_EVENTS.FIRST_MATCH_SENT)

  // 2. Deal : rattacher au deal actif existant, sinon créer en new_lead
  const dealId = await rattacherDeal(ctx, buyer.id, listing)

  // 3. Timeline contact (consignation systématique)
  await logEvent(ctx, {
    action: 'match_propose',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last} · ${listing.title}`,
    metadata: { match_ids: [buyer.matchId], deal_id: dealId, bien_refs: [listing.ref], nombre: 1, score: buyer.score },
  })

  // 4. La relance interne : l'agent notera la réponse de l'acheteur
  await poserRelance(ctx, {
    contactId: buyer.id,
    matchId: buyer.matchId,
    matchIds: [buyer.matchId],
    dealId,
    propertyId: listing.kind === 'property' ? listing.id : null,
    message: `Retour de ${buyer.first} ${buyer.last} sur ${listing.ref}`,
  })

  return { dealId, deja: false }
}

/** Un bien d'une sélection du marché, tel que la proposition le consigne. */
export interface PropositionSelection { matchId: string; score: number; bien: BienGeste }

/**
 * « J'ai proposé N biens » — la sélection du marché d'un acheteur, que l'agent lui a présentée par ses
 * propres moyens. ⛔ Rien ne part vers l'acheteur (décision du 21.09.2026) : même consignation que
 * `execProposer`, pour la sélection entière.
 *
 * Le marquage ne touche que les matchs encore `suggested` DE CET ACHETEUR. ⛔ Sans cette restriction, un
 * match déjà `interested` ou `ignored` repris dans la sélection serait réécrit en `sent` : il sortirait
 * de « Réponses », et la réponse consignée par l'agent serait perdue.
 *
 * ⛔ LE SUIVI NE PORTE QUE CE QUI A ÉTÉ MARQUÉ : le journal (`match_ids`, `bien_refs`, `nombre`), le deal
 * et la relance se calculent sur les matchs que la base a réellement réécrits, pas sur ceux qu'on lui a
 * soumis. Aucun : rien d'autre n'est écrit, `deja` le dit (cf. `ResultatProposition`).
 *
 * ⛔ UN GESTE, UN SUIVI : un deal, UNE ligne de journal et UNE relance à +3 j pour la sélection entière.
 * Appeler `execProposer` N fois poserait N relances identiques pour le même acheteur dans
 * « Aujourd'hui ». Le deal et la relance portent le MEILLEUR bien de la sélection.
 */
export async function execProposerSelection(
  ctx: GesteContext,
  acheteur: Pick<AcheteurGeste, 'id' | 'first' | 'last'>,
  propositions: readonly PropositionSelection[],
): Promise<ResultatProposition> {
  if (propositions.length === 0) return { dealId: null, deja: true }
  const { data: marques, error: mErr } = await supabase
    .from('matches')
    .update({ status: 'sent', sent_via: 'agent', sent_at: new Date().toISOString() })
    .in('id', propositions.map((p) => p.matchId))
    .eq('contact_id', acheteur.id)
    .eq('status', 'suggested')
    .select('id')
  if (mErr) throw mErr
  const marquesIds = new Set((marques ?? []).map((r) => r.id))
  const proposees = propositions.filter((p) => marquesIds.has(p.matchId))
  if (proposees.length === 0) return { dealId: null, deja: true }
  void markIntercomMilestone(INTERCOM_EVENTS.FIRST_MATCH_SENT)

  const meilleur = proposees.reduce((a, b) => (b.score > a.score ? b : a))
  const dealId = await rattacherDeal(ctx, acheteur.id, meilleur.bien)
  const n = proposees.length
  const biens = `${n} bien${n > 1 ? 's' : ''}`

  await logEvent(ctx, {
    action: 'match_propose',
    contactId: acheteur.id,
    label: `${acheteur.first} ${acheteur.last} · ${biens}`,
    metadata: {
      match_ids: proposees.map((p) => p.matchId), deal_id: dealId, bien_refs: proposees.map((p) => p.bien.ref), nombre: n,
    },
  })

  // Une sélection du marché ne porte aucun bien en mandat : la relance n'en nomme pas.
  await poserRelance(ctx, {
    contactId: acheteur.id,
    matchId: meilleur.matchId,
    // TOUS les biens marqués : le trigger `fermer_relance_proposition` clôt la relance au dernier répondu.
    matchIds: proposees.map((p) => p.matchId),
    dealId,
    propertyId: null,
    message: `Retour de ${acheteur.first} ${acheteur.last} sur ${biens} proposé${n > 1 ? 's' : ''}`,
  })

  return { dealId, deja: false }
}

/**
 * « J'ai relancé » (R) — l'agent a relancé l'acheteur lui-même ; le CRM repousse la relance interne.
 *
 * ⛔ Rien ne part vers l'acheteur (décision du 21.09.2026) : le geste lui envoyait jusque-là un e-mail
 * de relance. Pas de nouveau deal ; le match reste `sent`, `sent_at` date la dernière sollicitation.
 */
export async function execRelance(
  ctx: GesteContext,
  buyer: AcheteurGeste,
  listing: BienGeste,
): Promise<void> {
  // 1. Dernière sollicitation = maintenant (le match reste 'sent' / sans retour)
  const { error: mErr } = await supabase
    .from('matches')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', buyer.matchId)
  if (mErr) throw mErr

  // 2. Timeline
  await logEvent(ctx, {
    action: 'relance',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last} · ${listing.title}`,
    metadata: { match_id: buyer.matchId, bien_ref: listing.ref, canal: 'agent' },
  })

  // 3. Relance interne repoussée de 3 j (celle du match, sinon posée). Seule la relance de
  // PROPOSITION se reprend, la plus récente : un match porte aussi le rappel d'un report
  // (`custom`, « de retour dans la file »), que ce geste ne doit ni dater ni réécrire.
  // ⛔ Une lecture ou un report refusés font lever, comme la pose (`poserRelance`) : avalés, l'un reposait
  // une seconde relance, l'autre laissait croire la relance repoussée.
  const message = `Retour de ${buyer.first} ${buyer.last} sur ${listing.ref}, après relance`
  const { data: pending, error: lErr } = await supabase
    .from('reminders')
    .select('id')
    .eq('match_id', buyer.matchId)
    .eq('type', 'follow_up_sent_property')
    .in('status', ['pending', 'triggered'])
    .order('created_at', { ascending: false })
    .limit(1)
  if (lErr) throw lErr
  if (pending && pending.length > 0) {
    const { error: rErr } = await supabase
      .from('reminders')
      .update({ trigger_at: inDays(DELAI_RELANCE_JOURS), status: 'pending', message_template: message })
      .eq('id', (pending[0] as { id: string }).id)
    if (rErr) throw rErr
  } else {
    await poserRelance(ctx, {
      contactId: buyer.id,
      matchId: buyer.matchId,
      matchIds: [buyer.matchId],
      dealId: null,
      propertyId: listing.kind === 'property' ? listing.id : null,
      message,
    })
  }
}

/** « Plus tard » (P) — snooze +7 j sur le match, retour visible dans Aujourd'hui, consigné au journal */
export async function execSnooze(ctx: GesteContext, buyer: AcheteurGeste): Promise<void> {
  const until = inDays(7)
  const { error } = await supabase
    .from('matches')
    .update({ snoozed_until: until })
    .eq('id', buyer.matchId)
  if (error) throw error

  await supabase.from('reminders').insert({
    agency_id: ctx.agencyId,
    contact_id: buyer.id,
    match_id: buyer.matchId,
    type: 'custom',
    trigger_rule: 'manual',
    trigger_days: 7,
    trigger_at: until,
    status: 'pending',
    channel: 'notification',
    message_template: `${buyer.first} ${buyer.last} — acheteur reporté, de retour dans la file matching`,
  })

  await logEvent(ctx, {
    action: 'match_reporte',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last}`,
    metadata: { match_id: buyer.matchId, jusqu_au: until, score: buyer.score },
  })
}

/** « Écarter » (X) — le couple n'est plus jamais proposé. Aucun deal ; consigné au journal. */
export async function execDismiss(ctx: GesteContext, buyer: AcheteurGeste): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'ignored' })
    .eq('id', buyer.matchId)
  if (error) throw error

  await logEvent(ctx, {
    action: 'match_ecarte',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last}`,
    metadata: { match_id: buyer.matchId, score: buyer.score },
  })
}

/** La réponse de l'acheteur à un bien proposé, consignée par l'agent (Intéressé / Pas intéressé).
 *  Pose matches.status -> déclenche set_match_response_at (response_at) + log_match_reaction
 *  (audit, tracé `actor_kind = 'user'`) — la boucle se ferme chez l'agent.
 *
 *  La réponse est là : la relance de proposition du match (« Retour de … ») n'a plus d'objet et
 *  passe `done`. Sans ça, elle remontait dans « Aujourd'hui » pour un acheteur qui avait répondu.
 *  Un refus est signalé sans faire lever : la réponse, elle, est consignée.
 *  ⚠ Atelier et mobile seulement (inchangés au lot B) : le fil consigne par `execRepondre`, sans clore par
 *  `match_id` — une sélection n'a qu'une relance, que le trigger clôt au dernier bien répondu. */
export async function execReact(
  buyer: Pick<AcheteurGeste, 'matchId'>,
  reaction: 'interested' | 'rejected',
): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status: reaction })
    .eq('id', buyer.matchId)
  if (error) throw error

  const { error: rErr } = await supabase
    .from('reminders')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('match_id', buyer.matchId)
    .eq('type', 'follow_up_sent_property')
    .in('status', ['pending', 'triggered'])
  if (rErr) console.error('[atelier] reminder close failed', rErr)
}

/** Réactivation manuelle anticipée d'un reporté (parking) — immédiat */
export async function execWake(matchId: string): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ snoozed_until: null })
    .eq('id', matchId)
  if (error) throw error
  await supabase
    .from('reminders')
    .update({ status: 'cancelled' })
    .eq('match_id', matchId)
    .eq('type', 'custom')
    .in('status', ['pending', 'triggered'])
}

// ═══════════════════ La boucle dans le fil (lot B) ════════════════════════
// Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4.4 à §4.6.

/** La réponse de l'acheteur, consignée par l'agent depuis le fil. */
export type ReponseAcheteur =
  | { genre: 'interested' }
  | { genre: 'rejected'; motif: MotifRefus; note: string | null }

/**
 * « Intéressé » / « Pas intéressé » (+ motif) — la réponse de l'acheteur à un bien proposé, consignée par
 * l'agent (§4.4).
 *
 * Les triggers font le reste, quel que soit l'écrivain : `set_match_response_at` date la réponse,
 * `log_match_reaction` l'inscrit au journal, motif compris, et `fermer_relance_proposition` clôt la relance de
 * la proposition quand plus AUCUN de ses biens n'attend. ⛔ Pas de clôture par `match_id` ici, contrairement à
 * `execReact` : une sélection de trois biens n'a qu'UNE relance, portée par son meilleur bien — la clore sur la
 * réponse à ce seul bien laissait les deux autres sans suivi.
 *
 * Seulement depuis l'étape d'avant : « Intéressé » répond à un bien PROPOSÉ ; « Pas intéressé » aussi, ou
 * revient sur un intérêt (« À conclure »). Rien de réécrit : `deja` (un collègue a répondu entre-temps).
 */
export async function execRepondre(
  buyer: Pick<AcheteurGeste, 'id' | 'matchId'>,
  reponse: ReponseAcheteur,
): Promise<{ deja: boolean }> {
  const ecriture = reponse.genre === 'interested'
    ? { status: 'interested', reaction_motif: null, reaction_note: null, apprentissage_at: null }
    : { status: 'rejected', reaction_motif: reponse.motif, reaction_note: reponse.note?.trim() || null, apprentissage_at: null }
  const { data, error } = await supabase
    .from('matches')
    .update(ecriture)
    .eq('id', buyer.matchId)
    .eq('contact_id', buyer.id)
    .in('status', reponse.genre === 'interested' ? ['sent'] : ['sent', 'interested'])
    .select('id')
  if (error) throw error
  return { deja: !data || data.length === 0 }
}

/**
 * Les statuts d'une relance ENCORE OUVERTE : `snoozed` compris, que pose « Repousser » dans « Aujourd'hui »
 * (`useReminders`). Oubliée, une relance repoussée n'était plus vue : « En attente » perdait son échéance et
 * « Pas encore » en posait une seconde. Même liste que `fermer_relance_proposition` (migration du lot B).
 */
export const STATUTS_RELANCE_OUVERTE = ['pending', 'triggered', 'snoozed']

/**
 * « Pas encore » — l'acheteur n'a pas décidé : rien sur le match, la relance de SA proposition est repoussée
 * de trois jours (§4.4). La relance est celle qui COUVRE le bien (`match_ids`, ou `match_id` pour une
 * proposition d'un seul bien) : dans une sélection, elle est portée par un autre bien. Aucune : une relance
 * est posée.
 *
 * ⛔ Seulement si le bien attend ENCORE sa réponse (`sent`, de cet acheteur) : un collègue qui a répondu
 * entre-temps a clos la relance, et « Pas encore » en reposait une pour un bien déjà répondu. Rien d'écrit
 * alors : `deja`, comme les autres gestes de la boucle.
 */
export async function execPasEncore(ctx: GesteContext, buyer: AcheteurGeste, listing: BienGeste): Promise<{ deja: boolean }> {
  const { data: enAttente, error: mErr } = await supabase
    .from('matches')
    .select('id')
    .eq('id', buyer.matchId)
    .eq('contact_id', buyer.id)
    .eq('status', 'sent')
  if (mErr) throw mErr
  if (!enAttente || enAttente.length === 0) return { deja: true }
  const { data: enCours, error: lErr } = await supabase
    .from('reminders')
    .select('id, match_id, match_ids')
    .eq('contact_id', buyer.id)
    .eq('type', 'follow_up_sent_property')
    .in('status', STATUTS_RELANCE_OUVERTE)
    .order('created_at', { ascending: false })
  if (lErr) throw lErr
  const relance = ((enCours ?? []) as { id: string; match_id: string | null; match_ids: string[] | null }[])
    .find((r) => (r.match_ids ?? (r.match_id ? [r.match_id] : [])).includes(buyer.matchId))
  if (relance) {
    const { error } = await supabase
      .from('reminders')
      .update({ trigger_at: inDays(DELAI_RELANCE_JOURS), status: 'pending' })
      .eq('id', relance.id)
    if (error) throw error
  } else {
    await poserRelance(ctx, {
      contactId: buyer.id,
      matchId: buyer.matchId,
      matchIds: [buyer.matchId],
      dealId: null,
      propertyId: listing.kind === 'property' ? listing.id : null,
      // « Retour de {prénom} » n'élide pas (« de Emma ») : le nom vient après les deux-points.
      message: `Retour : ${buyer.first} ${buyer.last} sur ${listing.ref}`,
    })
  }
  await logEvent(ctx, {
    action: 'match_pas_encore',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last} · ${listing.title}`,
    metadata: { match_id: buyer.matchId, bien_ref: listing.ref, relance_id: relance?.id ?? null },
  })
  return { deja: false }
}

/** Le créneau d'une visite planifiée depuis le fil. */
export interface VisiteAPlanifier {
  /** Début, ISO. */
  debut: string
  dureeMinutes: number
  /** Adresse du bien, pour l'agenda. */
  lieu: string | null
}

/** Les étapes d'un deal AVANT la visite : « Planifier une visite » l'y fait avancer, jamais reculer. */
const ETAPES_AVANT_VISITE: Enums<'transaction_stage'>[] = ['new_lead', 'to_qualify', 'active_search', 'to_recontact']

/**
 * « Planifier une visite » (§4.5) — depuis « À conclure », EN INTERNE : rien n'est envoyé à l'acheteur, ni
 * invitation ni lien (comme l'outil `schedule_visit` du copilote).
 *
 * Le match passe `visit_planned` D'ABORD, et seulement s'il est encore « intéressé » : un double geste ne pose
 * pas deux visites. Puis le deal (l'actif, sinon un `new_lead`, `rattacherDeal`), puis la visite : un bien EN
 * MANDAT reçoit une ligne `visits` (sa fiche, son bon) ; une annonce du MARCHÉ, que l'agence ne détient pas
 * (`visits.property_id` n'accepte qu'un mandat), un événement `visite` de l'agenda (`calendar_events`, qui se
 * journalise lui-même). Le deal avance à `visit_planned` s'il était avant. Une visite refusée rend au match son
 * « intéressé » : il reste dans « À conclure ».
 *
 * ⛔ Aucun rappel au client non plus : `visit-reminders-j1` écrit à l'acheteur la veille de toute visite `planned`
 * dont `reminder_sent` est faux (`send-visit-email`). Posé à la création, il ne part pas — le matching reste chez
 * l'agent, et aucun envoi au client ne part sans sa validation (CLAUDE.md §5).
 */
export async function execPlanifierVisite(
  ctx: GesteContext,
  buyer: AcheteurGeste,
  listing: BienGeste,
  visite: VisiteAPlanifier,
): Promise<{ deja: boolean }> {
  const { data: marques, error: mErr } = await supabase
    .from('matches')
    .update({ status: 'visit_planned' })
    .eq('id', buyer.matchId)
    .eq('contact_id', buyer.id)
    .eq('status', 'interested')
    .select('id')
  if (mErr) throw mErr
  if (!marques || marques.length === 0) return { deja: true }

  try {
    const dealId = await rattacherDeal(ctx, buyer.id, listing)
    if (listing.kind === 'property') {
      const { data: v, error: vErr } = await supabase
        .from('visits')
        .insert({
          agency_id: ctx.agencyId,
          agent_id: ctx.userId,
          property_id: listing.id,
          contact_id: buyer.id,
          transaction_id: dealId,
          scheduled_at: visite.debut,
          duration_minutes: visite.dureeMinutes,
          status: 'planned',
          visit_type: 'sur_place',
          buyer_name: `${buyer.first} ${buyer.last}`.trim() || null,
          // Le rappel J-1 ne part pas : voir la docstring.
          reminder_sent: true,
        })
        .select('id')
        .single()
      if (vErr) throw vErr
      await logEvent(ctx, {
        action: 'visit_scheduled',
        contactId: buyer.id,
        label: `${buyer.first} ${buyer.last} · ${listing.title}`,
        categorie: 'contact',
        metadata: { match_id: buyer.matchId, visit_id: (v as { id: string }).id, deal_id: dealId, bien_ref: listing.ref, scheduled_at: visite.debut },
      })
    } else {
      const fin = new Date(Date.parse(visite.debut) + visite.dureeMinutes * 60_000).toISOString()
      const { error: eErr } = await supabase.from('calendar_events').insert({
        agency_id: ctx.agencyId,
        type: 'visite',
        title: `Visite · ${listing.title}`.slice(0, 200),
        starts_at: visite.debut,
        ends_at: fin,
        contact_id: buyer.id,
        location: visite.lieu,
      })
      if (eErr) throw eErr
    }
    const { error: dErr } = await supabase
      .from('transactions')
      .update({ stage: 'visit_planned' })
      .eq('id', dealId)
      .in('stage', ETAPES_AVANT_VISITE)
    if (dErr) console.error('[atelier] deal stage advance failed', dErr)
  } catch (err) {
    await supabase.from('matches').update({ status: 'interested' }).eq('id', buyer.matchId).eq('status', 'visit_planned')
    throw err
  }
  return { deja: false }
}

/** Une correction de recherche proposée par « Apprendre », telle que ses deux gestes la lisent. */
export interface CorrectionGeste {
  contactId: string
  /** Prénom et nom de l'acheteur : le sujet de la ligne de journal. */
  nom: string
  rechercheId: string
  motif: string
  refusIds: readonly string[]
}

/**
 * « Ajuster la recherche » (§4.6) — la correction validée par l'agent.
 *
 * TOUT se fait côté serveur, en UN appel (`matching-engine`, mode `rescore-search`) : les matchs à proposer
 * sont renotés par le VRAI barème avec les critères corrigés, puis, d'un bloc, la clé corrigée est posée (et sur
 * la fiche si elle portait les mêmes critères), les refus pris en compte et UNE ligne `recherche_ajustee` écrite
 * au journal. ⛔ Critères écrits d'abord par le client, un échec de la renotation effaçait la correction de
 * l'écran (plus d'écart à proposer) sans rien avoir renoté ; ici, un échec la laisse, et la même validation se
 * rejoue.
 *
 * ⛔ SEULE LA CLÉ CORRIGÉE PART, jamais les critères entiers : ceux que le fil a lus peuvent dater, et les
 * renvoyer écrasait ce qu'un collègue avait changé entre-temps sur une autre clé.
 */
export async function execAjusterRecherche(
  c: CorrectionGeste,
  changement: Pick<CorrectionChangement, 'cle' | 'apres'>,
): Promise<{ reevalues: number; ecartes: number }> {
  const { data, error } = await supabase.functions.invoke('matching-engine', {
    body: {
      mode: 'rescore-search', client_search_id: c.rechercheId, correction: { cle: changement.cle, valeur: changement.apres },
      motif: c.motif, refus_ids: [...c.refusIds],
    },
  })
  if (error) throw error
  const r = (data ?? {}) as { reevalues?: unknown; ecartes?: unknown }
  return {
    reevalues: typeof r.reevalues === 'number' ? r.reevalues : 0,
    ecartes: typeof r.ecartes === 'number' ? r.ecartes : 0,
  }
}

/**
 * « Ignorer » une correction : ses refus sont pris en compte sans rien corriger. Deux NOUVEAUX refus pour ce
 * motif en proposeront une autre.
 */
export async function execIgnorerCorrection(ctx: GesteContext, c: CorrectionGeste): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ apprentissage_at: new Date().toISOString() })
    .in('id', [...c.refusIds])
    .eq('client_search_id', c.rechercheId)
    .eq('status', 'rejected')
  if (error) throw error
  await logEvent(ctx, {
    action: 'correction_ignoree',
    contactId: c.contactId,
    // Le sujet sous le titre (`detailFor`) : l'acheteur, comme les autres gestes du matching. Le code du
    // motif (« prix ») s'y lisait tel quel ; il reste dans les métadonnées.
    label: c.nom,
    // Famille `contact`, comme `recherche_ajustee` : c'est la recherche de l'acheteur qui est en jeu.
    categorie: 'contact',
    metadata: { client_search_id: c.rechercheId, motif: c.motif, match_ids: [...c.refusIds] },
  })
}

// ─── privé ──────────────────────────────────────────────────────────────
const inDays = (d: number): string => new Date(Date.now() + d * 864e5).toISOString()

/** Délai de la relance interne : posée par « Je l'ai proposé », repoussée d'autant par « J'ai relancé ». */
const DELAI_RELANCE_JOURS = 3

/**
 * La relance interne d'une proposition : une tâche de l'agent (canal `task`), jamais un message à
 * l'acheteur. Elle remplace la relance J+3 automatique d'`automation-engine`, retirée au lot A : elle
 * doublait celle-ci et pouvait écrire au client. Partagée par les gestes pour qu'ils ne divergent pas.
 *
 * `match_ids` ne s'écrit que pour une proposition de PLUSIEURS biens (une sélection n'a qu'une relance) : le
 * trigger `fermer_relance_proposition` la clôt quand plus aucun n'attend, et lit `match_id` seul là où elle
 * manque. ⛔ Écrite à chaque relance, la colonne partait aussi de l'atelier, du mobile et d'« Aujourd'hui » —
 * en production, dont l'écran part AVANT la migration qui la crée (CLAUDE.md §8) : PostgREST refusait
 * l'insertion (`PGRST204`), et le refus était avalé.
 *
 * ⛔ Un refus FAIT LEVER : le geste le dit (le toast de son appelant) au lieu de passer pour réussi sans
 * relance — l'agent n'aurait jamais été rappelé de noter la réponse. Ce qui est déjà écrit (le match, le deal,
 * le journal) reste, et la relecture qui suit l'échec le montre.
 */
async function poserRelance(
  ctx: GesteContext,
  r: { contactId: string; matchId: string; matchIds: readonly string[]; dealId: string | null; propertyId: string | null; message: string },
): Promise<void> {
  const relance: TablesInsert<'reminders'> = {
    agency_id: ctx.agencyId,
    contact_id: r.contactId,
    property_id: r.propertyId,
    transaction_id: r.dealId,
    match_id: r.matchId,
    type: 'follow_up_sent_property',
    trigger_rule: 'manual',
    trigger_days: DELAI_RELANCE_JOURS,
    trigger_at: inDays(DELAI_RELANCE_JOURS),
    status: 'pending',
    channel: 'task',
    message_template: r.message,
  }
  if (r.matchIds.length > 1) relance.match_ids = [...r.matchIds]
  const { error } = await supabase.from('reminders').insert(relance)
  if (error) throw error
}

async function logEvent(
  ctx: GesteContext,
  e: { action: string; contactId: string; label: string; metadata: Record<string, unknown>; categorie?: 'deal' | 'contact' },
): Promise<void> {
  const { error } = await supabase.from('activity_events').insert({
    agency_id: ctx.agencyId,
    actor_id: ctx.userId,
    actor_kind: 'user',
    action: e.action,
    entity_type: 'contact',
    entity_id: e.contactId,
    // `visit_scheduled` est de la famille `contact`, comme l'écrit le copilote (whatsapp-actions), et
    // `correction_ignoree` comme `recherche_ajustee` ; les autres gestes du matching font avancer le deal.
    category: e.categorie ?? 'deal',
    severity: 'info',
    object_label: e.label,
    metadata: e.metadata as Json,
  })
  // Consignation = exigence du contrat ; une erreur RLS ne doit pas passer inaperçue
  if (error) console.error('[atelier] activity_events insert failed', error)
}
```

- [ ] **Étape 3 : Déplacer la file d'annulation**

```bash
git mv src/components/matching-atelier/pendingTriage.ts src/lib/matchingAnnulation.ts
```

Son en-tête ne parle plus de l'atelier seul, et `ResultatProposition` vient du module des gestes.

Dans `src/lib/matchingAnnulation.ts`, remplacer :

```ts
// Atelier Matching — exécution différée des gestes (undo 5 s, style Gmail).
//
// Un triage ne touche PAS la base tant que le toast offre « Annuler » :
// l'UI sort la row immédiatement (état local), l'écriture réelle (match,
// deal, timeline, relance interne) part à l'expiration de la fenêtre. Aucune
// n'écrit à l'acheteur : le matching reste chez l'agent (21.09.2026).
// Annuler = rien n'a jamais été écrit. « Voir le deal → » force l'exécution
// immédiate (flushNow) pour obtenir l'id du deal. À la fermeture de la page,
// tout ce qui est en attente est exécuté (l'agent n'a pas annulé).

import type { ResultatProposition } from '@/hooks/useAtelierMatching'
```

par :

```ts
/**
 * Matching — la file d'annulation des gestes : exécution différée (undo 5 s, style Gmail).
 *
 * Un triage ne touche PAS la base tant que le toast offre « Annuler » :
 * l'UI sort la row immédiatement (état local), l'écriture réelle (match,
 * deal, timeline, relance interne) part à l'expiration de la fenêtre. Aucune
 * n'écrit à l'acheteur : le matching reste chez l'agent (21.09.2026).
 * Annuler = rien n'a jamais été écrit. « Voir le deal → » force l'exécution
 * immédiate (flushNow) pour obtenir l'id du deal. À la fermeture de la page,
 * tout ce qui est en attente est exécuté (l'agent n'a pas annulé).
 *
 * Un seul mécanisme pour les écrans qui posent les gestes du matching (`matchingGestes`) : le fil de matchs et
 * l'écran mobile y diffèrent les mêmes écritures, sous la même fenêtre (`UNDO_WINDOW_MS`) ; chacun tient son
 * registre, monté et vidé avec lui.
 */
import type { ResultatProposition } from '@/lib/matchingGestes'
```

Dans `src/lib/matchingAnnulation.ts`, remplacer :

```ts
  /** Exécute tout ce qui attend encore (fermeture de l'atelier) */
```

par :

```ts
  /** Exécute tout ce qui attend encore (fermeture de l'écran) */
```

- [ ] **Étape 4 : Réduire `useAtelierMatching.ts` à sa lecture**

Le hook garde `useAtelierMatching` et ce qu'il utilise (`mapMarketListing`, `mapProperty`, `mapReasons`, `mapStatus`, la palette d'avatars…) ; il importe du module des gestes les trois fonctions que sa lecture appelle.

Dans `src/hooks/useAtelierMatching.ts`, remplacer :

```ts
// Atelier Matching — données + gestes métier (contrat HANDOFF_MATCHING_COUTURES).
//
// Données : matches (+ contact + property/market_listing) groupés par annonce
// pivot (`p:<uuid>` interne / `m:<uuid>` veille marché) + KYC du dernier
// dossier acheteur par contact. Le mode « Par acheteur » réutilise les mêmes
// matches re-groupés par contact (poolFor).
//
// Gestes (exécutés par la page APRÈS la fenêtre d'annulation de 5 s — undo
// Gmail-style : rien n'est écrit tant que le toast offre « Annuler ») :
//   proposer     → « Je l'ai proposé » : le match, s'il est encore 'suggested' → 'sent',
//                  sent_via='agent' + Deal new_lead (créé ou rattaché) + activity_events
//                  'match_propose' + relance interne +3 j + jalon Intercom first_match_sent.
//                  Plus rien à proposer → rien d'autre n'est écrit (`deja`)
//   proposerSelection → ses matchs encore 'suggested' → 'sent' 'agent' + UN deal,
//                  UN 'match_propose', UNE relance +3 j, sur les SEULS matchs marqués (fil)
//   relance      → « J'ai relancé » : matches.sent_at=now + activity_events 'relance' +
//                  relance de proposition repoussée +3 j
//   react        → Intéressé / Pas intéressé : matches.status + relance de proposition close
//   snooze       → matches.snoozed_until=+7 j + reminder 'custom' à échéance
//                  (la ligne « de retour » remonte dans Aujourd'hui) + 'match_reporte'
//   dismiss      → matches.status='ignored' (le moteur ne re-propose jamais
//                  un couple existant — aucun deal) + activity_events 'match_ecarte'
//   wake         → snoozed_until=null + reminder annulé (immédiat, hors queue)
//   repondre     → (fil, lot B) Intéressé / Pas intéressé + motif : matches.status, motif, note ; la
//                  relance de la PROPOSITION se clôt par trigger quand plus aucun de ses biens n'attend
//   pasEncore    → (fil) la relance de la proposition repoussée de +3 j, si le bien attend encore ; rien
//                  sur le match
//   planifierVisite → (fil) match 'visit_planned' + visite interne (mandat) ou événement « visite » de
//                  l'agenda (annonce du marché) + deal avancé ; aucune invitation
//   ajusterRecherche / ignorerCorrection → (fil) « Apprendre » : la correction validée (edge
//                  matching-engine, mode rescore-search, la SEULE clé corrigée) ou ses refus pris en compte
//
// ⛔ Une relance qui ne se pose pas FAIT LEVER le geste (`poserRelance`) : sans elle, l'agent n'est jamais
// rappelé de noter la réponse, et l'échec ne se lisait qu'en console.
//
// ⛔ Aucun geste n'écrit à l'acheteur — ni e-mail, ni lien, ni WhatsApp (décision de
// Julien, 21.09.2026 : le matching reste chez l'agent). L'agent présente les biens par
// ses propres moyens ; le CRM consigne et lui rappelle de noter la réponse.

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { INTERCOM_EVENTS } from '@/lib/intercom'
import { markIntercomMilestone } from '@/lib/intercom-milestones'
import { useAuth } from '@/hooks/useAuth'
import { mapKycStatus } from '@/lib/crmAdapters'
import type { Enums, Json, TablesInsert } from '@/types/database'
import type { SearchCriteria } from '@/types/contact'
import type { KycCase } from '@/types/kyc'
import type { MotifRefus } from '@/components/matching-fil/filBoucle'
import type { CorrectionChangement } from '@/components/matching-fil/filApprendre'
import { composeAiHint } from '@/components/matching-atelier/composeAiHint'
```

par :

```ts
// Atelier Matching — données (contrat HANDOFF_MATCHING_COUTURES).
//
// Données : matches (+ contact + property/market_listing) groupés par annonce
// pivot (`p:<uuid>` interne / `m:<uuid>` veille marché) + KYC du dernier
// dossier acheteur par contact. Le mode « Par acheteur » réutilise les mêmes
// matches re-groupés par contact (poolFor).
//
// Les gestes que l'agent pose sur ces matchs ne sont pas ici : ils vivent dans
// `@/lib/matchingGestes`, que le fil de matchs partage — un seul écrivain par geste.

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { mapKycStatus } from '@/lib/crmAdapters'
import { isSnoozed, refAnnonceMarche, refBienInterne } from '@/lib/matchingGestes'
import type { SearchCriteria } from '@/types/contact'
import type { KycCase } from '@/types/kyc'
import { composeAiHint } from '@/components/matching-atelier/composeAiHint'
```

Dans `src/hooks/useAtelierMatching.ts`, remplacer :

```ts
/** Référence affichée d'une annonce du marché — la même dans l'atelier et dans le fil de matchs. */
export const refAnnonceMarche = (portail: string | null, sourceId: string | null, id: string): string =>
  `MG-${portail === 'flatfox' ? 'FL' : 'MK'}-${sourceId ?? id.slice(0, 6)}`

/** Bien de veille marché (market_listings) → AtelierListing : clé `m:<id>`, prix courant + prix barré si baisse détectée. */
```

par :

```ts
/** Bien de veille marché (market_listings) → AtelierListing : clé `m:<id>`, prix courant + prix barré si baisse détectée. */
```

Dans `src/hooks/useAtelierMatching.ts`, remplacer :

```ts
/** Référence affichée d'un bien interne — la même dans l'atelier et dans le fil de matchs. */
export const refBienInterne = (id: string): string => `MG-IN-${id.slice(0, 6).toUpperCase()}`

/** Bien interne (properties) → AtelierListing : clé `p:<id>`, jours-sur-marché dérivés de created_at. */
```

par :

```ts
/** Bien interne (properties) → AtelierListing : clé `p:<id>`, jours-sur-marché dérivés de created_at. */
```

Puis supprimer tout ce qui suit la fonction `useAtelierMatching` : de la ligne vide qui la suit jusqu'à la fin du fichier — `isSnoozed`, puis l'intertitre « Gestes métier (exécuteurs) » et tout ce qui vient après, jusqu'à `logEvent` (672 lignes, recopiées à l'étape 2). Le fichier finit alors sur l'accolade qui ferme `useAtelierMatching`, suivie d'un seul saut de ligne :

```bash
node -e "const fs = require('fs'); const f = 'src/hooks/useAtelierMatching.ts'; const s = fs.readFileSync(f, 'utf8'); const i = s.indexOf('\n\n/** true tant que le report (snooze)'); if (i < 0) throw new Error('repère introuvable'); fs.writeFileSync(f, s.slice(0, i + 1))"
wc -l src/hooks/useAtelierMatching.ts && tail -n 3 src/hooks/useAtelierMatching.ts
```

Attendu : `445 src/hooks/useAtelierMatching.ts`, puis `    refresh,`, `  }`, `}`.

- [ ] **Étape 5 : Les importeurs suivent**

Aucun ré-export : chaque importeur prend les gestes à `@/lib/matchingGestes` et la file à `@/lib/matchingAnnulation` ; l'atelier et le mobile gardent `useAtelierMatching` pour leur lecture.

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
import {
  execAjusterRecherche, execDismiss, execIgnorerCorrection, execPasEncore, execPlanifierVisite, execProposer,
  execProposerSelection, execRepondre, execSnooze, execWake,
  type CorrectionGeste, type GesteContext, type ReponseAcheteur, type VisiteAPlanifier,
} from '@/hooks/useAtelierMatching'
import { useMatchingFil, versGeste } from '@/hooks/useMatchingFil'
import { PAS_SELECTION, useSelectionMarche } from '@/hooks/useSelectionMarche'
import { PendingRegistry, UNDO_WINDOW_MS } from '@/components/matching-atelier/pendingTriage'
```

par :

```tsx
import {
  execAjusterRecherche, execDismiss, execIgnorerCorrection, execPasEncore, execPlanifierVisite, execProposer,
  execProposerSelection, execRepondre, execSnooze, execWake,
  type CorrectionGeste, type GesteContext, type ReponseAcheteur, type VisiteAPlanifier,
} from '@/lib/matchingGestes'
import { useMatchingFil, versGeste } from '@/hooks/useMatchingFil'
import { PAS_SELECTION, useSelectionMarche } from '@/hooks/useSelectionMarche'
import { PendingRegistry, UNDO_WINDOW_MS } from '@/lib/matchingAnnulation'
```

Dans `src/components/matching-fil/FilConclure.tsx`, remplacer :

```tsx
import type { VisiteAPlanifier } from '@/hooks/useAtelierMatching'
```

par :

```tsx
import type { VisiteAPlanifier } from '@/lib/matchingGestes'
```

Dans `src/hooks/useMatchingFil.ts`, remplacer :

```ts
import {
  refAnnonceMarche, refBienInterne, STATUTS_RELANCE_OUVERTE, type AcheteurGeste, type BienGeste,
} from '@/hooks/useAtelierMatching'
```

par :

```ts
import {
  refAnnonceMarche, refBienInterne, STATUTS_RELANCE_OUVERTE, type AcheteurGeste, type BienGeste,
} from '@/lib/matchingGestes'
```

Dans `src/hooks/useMatchingFil.ts`, remplacer :

```ts
// importeurs ne changent pas. « Aujourd'hui » et « Sa boucle » les prennent à la source — ce module tire
// `useAtelierMatching` statiquement.
```

par :

```ts
// importeurs ne changent pas. « Aujourd'hui » et « Sa boucle » les prennent à la source — ce module tire
// statiquement celui des gestes (`matchingGestes`).
```

Dans `src/hooks/useMatchingFil.ts`, remplacer :

```ts
/** Ce que les exécuteurs de l'atelier lisent d'un match du fil : ils restent la source unique des écritures. */
```

par :

```ts
/** Ce que les exécuteurs de `matchingGestes` lisent d'un match du fil : ils restent la source unique des écritures. */
```

Dans `src/hooks/useAjouterSelection.ts`, remplacer :

```ts
import { isSnoozed } from '@/hooks/useAtelierMatching'
```

par :

```ts
import { isSnoozed } from '@/lib/matchingGestes'
```

Dans `src/components/crm/today/PageCatalogue.tsx`, remplacer :

```tsx
import {
  execProposer, refAnnonceMarche, refBienInterne, type AcheteurGeste, type BienGeste, type GesteContext,
} from '@/hooks/useAtelierMatching'
```

par :

```tsx
import {
  execProposer, refAnnonceMarche, refBienInterne, type AcheteurGeste, type BienGeste, type GesteContext,
} from '@/lib/matchingGestes'
```

Dans `src/pages/agent/MatchingAtelierPage.tsx`, remplacer :

```tsx
import {
  execDismiss,
  execReact,
  execProposer,
  execRelance,
  execSnooze,
  execWake,
  useAtelierMatching,
  type GesteContext,
} from '@/hooks/useAtelierMatching'
import { useAgencyProperties } from '@/hooks/useProperties'
import AtelierStage from '@/components/matching-atelier/AtelierStage'
import MatchingFirstRun from '@/components/matching-atelier/MatchingFirstRun'
import { useCrmDark } from '@/lib/crmDark'
import { PendingRegistry, type AtelierGestes } from '@/components/matching-atelier/pendingTriage'
```

par :

```tsx
import {
  execDismiss,
  execReact,
  execProposer,
  execRelance,
  execSnooze,
  execWake,
  type GesteContext,
} from '@/lib/matchingGestes'
import { useAtelierMatching } from '@/hooks/useAtelierMatching'
import { useAgencyProperties } from '@/hooks/useProperties'
import AtelierStage from '@/components/matching-atelier/AtelierStage'
import MatchingFirstRun from '@/components/matching-atelier/MatchingFirstRun'
import { useCrmDark } from '@/lib/crmDark'
import { PendingRegistry, type AtelierGestes } from '@/lib/matchingAnnulation'
```

Dans `src/components/matching-atelier/AtelierStage.tsx`, remplacer :

```tsx
import { isSnoozed } from '@/hooks/useAtelierMatching'
import { useEcranActif } from '@/hooks/useEcranActif'
import type { AtelierGestes, PendingHandle } from './pendingTriage'
```

par :

```tsx
import { isSnoozed } from '@/lib/matchingGestes'
import { useEcranActif } from '@/hooks/useEcranActif'
import type { AtelierGestes, PendingHandle } from '@/lib/matchingAnnulation'
```

Dans `src/components/matching-atelier/AtlAcheteurMode.tsx`, remplacer :

```tsx
import { isSnoozed } from '@/hooks/useAtelierMatching'
import { useEcranActif } from '@/hooks/useEcranActif'
import type { AtelierBuyer, AtelierPoolMatch, TriageKind } from './types'
import type { AtelierGestes, PendingHandle } from './pendingTriage'
```

par :

```tsx
import { isSnoozed } from '@/lib/matchingGestes'
import { useEcranActif } from '@/hooks/useEcranActif'
import type { AtelierBuyer, AtelierPoolMatch, TriageKind } from './types'
import type { AtelierGestes, PendingHandle } from '@/lib/matchingAnnulation'
```

Dans `src/pages/dev/MatchingShowcasePage.tsx`, remplacer :

```tsx
import type { AtelierGestes, PendingHandle } from '@/components/matching-atelier/pendingTriage'
```

par :

```tsx
import type { AtelierGestes, PendingHandle } from '@/lib/matchingAnnulation'
```

Dans `src/components/crm-mobile/matching/MmMatchingScreen.tsx`, remplacer :

```tsx
import {
  execDismiss,
  execReact,
  execProposer,
  execRelance,
  execSnooze,
  execWake,
  useAtelierMatching,
  type GesteContext,
} from '@/hooks/useAtelierMatching'
import { PendingRegistry, type AtelierGestes, type PendingHandle } from '@/components/matching-atelier/pendingTriage'
```

par :

```tsx
import {
  execDismiss,
  execReact,
  execProposer,
  execRelance,
  execSnooze,
  execWake,
  type GesteContext,
} from '@/lib/matchingGestes'
import { useAtelierMatching } from '@/hooks/useAtelierMatching'
import { PendingRegistry, type AtelierGestes, type PendingHandle } from '@/lib/matchingAnnulation'
```

Dans `src/components/crm-mobile/matching/MmMatchingScreen.tsx`, remplacer :

```tsx
 * `useAtelierMatching` + ses exécuteurs purs via `PendingRegistry` (undo 5 s,
```

par :

```tsx
 * `useAtelierMatching` + les exécuteurs purs de `matchingGestes` via `PendingRegistry` (undo 5 s,
```

Dans `src/components/crm-mobile/matching/vm.ts`, remplacer :

```ts
import { isSnoozed } from '@/hooks/useAtelierMatching'
```

par :

```ts
import { isSnoozed } from '@/lib/matchingGestes'
```

- [ ] **Étape 6 : Les commentaires qui donnaient l'ancienne adresse**

Après le déplacement, `useMatchingFil` ne tire plus `useAtelierMatching` mais le module des gestes : huit commentaires disaient le contraire (le huitième, dans `useMatchingFil.ts` lui-même, est corrigé à l'étape 5), et la raison qu'ils donnent (une fiche n'a pas à charger `useMatchingFil` pour une chaîne) tient toujours. Trois autres nommaient le hook comme la maison des gestes.

Dans `src/components/matching-fil/filModele.ts`, remplacer :

```ts
 * « Aujourd'hui » l'importe, et `useMatchingFil` tire statiquement `useAtelierMatching` — l'écran mobile le chargeait
 * pour une chaîne.
```

par :

```ts
 * « Aujourd'hui » l'importe, et `useMatchingFil` tire statiquement le module des gestes (`matchingGestes`) — l'écran
 * mobile le chargeait pour une chaîne.
```

Dans `src/components/matching-fil/filModele.ts`, remplacer :

```ts
// bien ? » — les partagent. Elles vivent ici, pas dans un module de hook : `useMatchingFil` tire statiquement
// `useAtelierMatching`, et une fiche n'a pas à le charger pour lire une ligne.
```

par :

```ts
// bien ? » — les partagent. Elles vivent ici, pas dans un module de hook : `useMatchingFil` tire statiquement
// le module des gestes (`matchingGestes`), et une fiche n'a pas à le charger pour lire une ligne.
```

Dans `src/hooks/useAnciensProspects.ts`, remplacer :

```ts
 * ⚠ `CLE_FIL` vient du module pur du fil (`filModele`), pas de `useMatchingFil`, qui tire statiquement
 * `useAtelierMatching` : les deux fiches de bien montent ce hook (`QuiPourCeBien`) et n'ont pas à le charger.
```

par :

```ts
 * ⚠ `CLE_FIL` vient du module pur du fil (`filModele`), pas de `useMatchingFil`, qui tire statiquement le module
 * des gestes (`matchingGestes`) : les deux fiches de bien montent ce hook (`QuiPourCeBien`) et n'ont pas à le charger.
```

Dans `src/hooks/useQuiPourCeBien.ts`, remplacer :

```ts
 * ⚠ `CLE_FIL` et `lire` viennent du module pur du fil (`filModele`), pas de `useMatchingFil`, qui tire statiquement
 * `useAtelierMatching` : une fiche n'a pas à le charger.
```

par :

```ts
 * ⚠ `CLE_FIL` et `lire` viennent du module pur du fil (`filModele`), pas de `useMatchingFil`, qui tire statiquement
 * le module des gestes (`matchingGestes`) : une fiche n'a pas à le charger.
```

Dans `src/hooks/useAcquereursNouveauMandat.ts`, remplacer :

```ts
 * ⚠ `lire` vient du module pur du fil (`filModele`), pas de `useMatchingFil`, qui tire statiquement
 * `useAtelierMatching` : ni « Nouveau bien » ni Mes biens n'ont à le charger.
```

par :

```ts
 * ⚠ `lire` vient du module pur du fil (`filModele`), pas de `useMatchingFil`, qui tire statiquement
 * le module des gestes (`matchingGestes`) : ni « Nouveau bien » ni Mes biens n'ont à le charger.
```

Dans `src/hooks/usePigeAcheteurs.ts`, remplacer :

```ts
 * ⚠ `CLE_FIL` vient du module pur du fil (`filModele`), pas de `useMatchingFil`, qui tire statiquement
 * `useAtelierMatching` : la Recherche n'a pas à le charger pour une chaîne.
```

par :

```ts
 * ⚠ `CLE_FIL` vient du module pur du fil (`filModele`), pas de `useMatchingFil`, qui tire statiquement
 * le module des gestes (`matchingGestes`) : la Recherche n'a pas à le charger pour une chaîne.
```

Dans `src/hooks/useContactSentMatches.ts`, remplacer :

```ts
 * ⚠ `lire` vient du module pur du fil (`filModele`), pas de `useMatchingFil`, qui tire statiquement
 * `useAtelierMatching` : la fiche n'a pas à le charger.
```

par :

```ts
 * ⚠ `lire` vient du module pur du fil (`filModele`), pas de `useMatchingFil`, qui tire statiquement
 * le module des gestes (`matchingGestes`) : la fiche n'a pas à le charger.
```

Dans `src/hooks/useMatching.ts`, remplacer :

```ts
 * n'est PAS ici : il passe par `execProposer` (useAtelierMatching), seul à poser le
```

par :

```ts
 * n'est PAS ici : il passe par `execProposer` (matchingGestes), seul à poser le
```

Dans `src/components/crm/today/useFocusQueue.ts`, remplacer :

```ts
  // CLAUDE.md §5 « audit pour toute action ». Même pattern que useAtelierMatching
```

par :

```ts
  // CLAUDE.md §5 « audit pour toute action ». Même pattern que matchingGestes
```

Dans `tests/backend/atelier-matching-loop.spec.ts`, remplacer :

```ts
// NB : les écritures reproduisent celles de src/hooks/useAtelierMatching.ts
```

par :

```ts
// NB : les écritures reproduisent celles de src/lib/matchingGestes.ts
```

Deux commentaires de la migration du lot D2 (appliquée nulle part en production) ; `matching-whatsapp-sql.spec.ts` compare les corps sans leurs commentaires (`nu`), rien n'y change.

Dans `supabase/migrations/20260924200000_matching_whatsapp.sql`, remplacer :

```sql
-- Les règles des gestes du fil (`useAtelierMatching` : execProposer, execRepondre, execPasEncore), À L'IDENTIQUE,
```

par :

```sql
-- Les règles des gestes du fil (`matchingGestes` : execProposer, execRepondre, execPasEncore), À L'IDENTIQUE,
```

Dans `supabase/migrations/20260924200000_matching_whatsapp.sql`, remplacer :

```sql
  -- La référence du fil (`refBienInterne` / `refAnnonceMarche`, useAtelierMatching.ts) : la phrase de relance
```

par :

```sql
  -- La référence du fil (`refBienInterne` / `refAnnonceMarche`, matchingGestes.ts) : la phrase de relance
```

- [ ] **Étape 7 : Les specs et la garde « sans sortie »**

Les deux specs qui importaient du hook prennent le module des gestes. `matching-fil-gestes` perd son mock de `useAuth` : il ne servait qu'au chargement du hook, que le module des gestes n'importe pas. La garde « sans sortie » lit les deux modules neufs.

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer :

```ts
  execProposerSelection, execReact, execRelance, execRepondre, execSnooze,
} from '@/hooks/useAtelierMatching'
```

par :

```ts
  execProposerSelection, execReact, execRelance, execRepondre, execSnooze,
} from '@/lib/matchingGestes'
```

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer :

```ts
vi.mock('@/lib/intercom', () => ({ INTERCOM_EVENTS: { FIRST_MATCH_SENT: 'first_match_sent' } }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({}) }))
```

par :

```ts
vi.mock('@/lib/intercom', () => ({ INTERCOM_EVENTS: { FIRST_MATCH_SENT: 'first_match_sent' } }))
```

Dans `tests/unit/matching-whatsapp-sql.spec.ts`, remplacer :

```ts
import { refAnnonceMarche, refBienInterne } from '@/hooks/useAtelierMatching'
import { LIMITE_ECHO, STATUTS_COMPATIBLES, STATUTS_DE_DEPART, STATUT_D_ARRIVEE } from '../../supabase/functions/_shared/whatsapp-matching'

// Le hook n'est importé ici que pour ses deux fonctions PURES (refBienInterne, refAnnonceMarche) — ni l'une ni
// l'autre ne touche `supabase`. Les mocks ne servent qu'à permettre le CHARGEMENT du module (mêmes noms que
// tests/unit/matching-fil-gestes.spec.ts, qui importe déjà ce hook sous vitest).
```

par :

```ts
import { refAnnonceMarche, refBienInterne } from '@/lib/matchingGestes'
import { LIMITE_ECHO, STATUTS_COMPATIBLES, STATUTS_DE_DEPART, STATUT_D_ARRIVEE } from '../../supabase/functions/_shared/whatsapp-matching'

// Le module des gestes n'est importé ici que pour ses deux fonctions PURES (refBienInterne, refAnnonceMarche) — ni
// l'une ni l'autre ne touche `supabase`. Les mocks ne servent qu'à permettre le CHARGEMENT du module (mêmes noms que
// tests/unit/matching-fil-gestes.spec.ts, qui importe déjà ce module sous vitest).
```

Dans `tests/unit/matching-whatsapp-sql.spec.ts`, remplacer :

```ts
 * (refBienInterne / refAnnonceMarche, useAtelierMatching) — importées ici pour de vrai, jamais retapées.
```

par :

```ts
 * (refBienInterne / refAnnonceMarche, matchingGestes) — importées ici pour de vrai, jamais retapées.
```

Dans `tests/unit/matching-sans-sortie.spec.ts`, remplacer :

```ts
  'src/hooks/useAtelierMatching.ts',
  'src/hooks/useMatching.ts',
```

par :

```ts
  'src/hooks/useAtelierMatching.ts',
  // Lot E1 : les exécuteurs des gestes et la file d'annulation, que partagent le fil et le mobile.
  'src/lib/matchingGestes.ts',
  'src/lib/matchingAnnulation.ts',
  'src/hooks/useMatching.ts',
```

- [ ] **Étape 8 : Lancer le test**

```bash
npx vitest run tests/unit/matching-gestes-module.spec.ts
```

Attendu : PASS, 7 tests sur 7.

- [ ] **Étape 9 : Vérifier**

```bash
grep -rn "useAtelierMatching\|pendingTriage" src tests scripts supabase
```

Attendu : plus aucun import de `pendingTriage`, et `useAtelierMatching` importé par ses seuls lecteurs (`MatchingAtelierPage.tsx:33`, `MmMatchingScreen.tsx:20`). Restent, tous vrais : sa définition (`useAtelierMatching.ts:292`), ses appels (`MatchingAtelierPage.tsx:60`, `MmMatchingScreen.tsx:66`), neuf commentaires sur la LECTURE (`types.ts:2`, `mockData.ts:258`, `usePipelineScreen.ts:6`, `useContactsScreen.ts:13`, `crmAdapters.ts:3` et `:133`, `usePigeAcheteurs.ts:12`, `MatchingAtelierPage.tsx:6`, `MmMatchingScreen.tsx:52`), les gardes par chemin (`matching-sans-sortie.spec.ts:36`, `couleur-barreaux.spec.ts:198`, `matching-contraste.spec.ts:218`, la spec neuve) et la migration appliquée `20260719110000_close_anon_market_reads.sql:11`.

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx vitest run tests/unit/matching-gestes-module.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/matching-whatsapp-sql.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/matching-contraste.spec.ts tests/unit/whatsapp-matching-fil.spec.ts tests/unit/ajouter-selection.spec.tsx tests/unit/dev-bancs-frontiere.spec.ts tests/unit/etat-vide.spec.ts tests/unit/fiche-qui-pour.spec.ts tests/unit/focus-audit.spec.ts tests/unit/matching-fil-apprendre.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-signaux.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/redirection-ouverte.spec.ts tests/unit/sa-boucle.spec.ts tests/unit/i18n-globs-vivants.spec.ts tests/unit/megga-x-crm-tokens.spec.ts
```

Attendu : PASS, 21 fichiers, 486 tests (toutes les specs qui chargent ou lisent un fichier touché).

```bash
npm run lint:deadcode
```

Attendu : `✓ Aucun export mort` (`mapMarketListing`, `mapProperty` et `PropositionSelection` restent « used in module »).

```bash
npx eslint --quiet src/lib/matchingGestes.ts src/lib/matchingAnnulation.ts src/hooks/useAtelierMatching.ts src/components/matching-fil/MatchingFil.tsx src/components/matching-fil/FilConclure.tsx src/components/matching-fil/filModele.ts src/hooks/useMatchingFil.ts src/hooks/useAjouterSelection.ts src/components/crm/today/PageCatalogue.tsx src/components/crm/today/useFocusQueue.ts src/pages/agent/MatchingAtelierPage.tsx src/components/matching-atelier/AtelierStage.tsx src/components/matching-atelier/AtlAcheteurMode.tsx src/pages/dev/MatchingShowcasePage.tsx src/components/crm-mobile/matching/MmMatchingScreen.tsx src/components/crm-mobile/matching/vm.ts src/hooks/useMatching.ts src/hooks/useAnciensProspects.ts src/hooks/useQuiPourCeBien.ts src/hooks/useAcquereursNouveauMandat.ts src/hooks/usePigeAcheteurs.ts src/hooks/useContactSentMatches.ts tests/unit/matching-gestes-module.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/matching-whatsapp-sql.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/backend/atelier-matching-loop.spec.ts
npm run lint:i18n
```

Attendu : ESLint sans sortie ; `✓ i18n garde-fou OK` (des fichiers des familles verrouillées sont touchés, en imports seulement).

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint` en parallèle) :

```bash
npx vitest run
```

Attendu : 339 fichiers verts sur 342 ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`.

---

## Tâche 2 : Le fil lit l'état des mandats (décision 12a)

Le fil ne lit ni le statut d'un mandat ni sa suppression (`useMatchingFil.ts:252-254`, `LigneBien`) et ses constructeurs ne filtrent que sur le statut du match (`construireFil`, `construireAttente`, `construireAConclure`, `construireCorrections`) : un mandat vendu, archivé, réservé ou en brouillon reste « à proposer », ses revenus et ses reportés avec lui, et son en-tête ouvre encore « Qui pour ce bien ? ». Décision 12a de Julien (conception §5.3, principe « une règle, une source ») : un mandat est **en vente** s'il est `active` et non supprimé — la règle du copilote WhatsApp (`occasion` de `bienDeMandat`, que `vueGetMatches` applique aux « à proposer », aux revenus et aux reportés), reprise à l'identique. La lecture porte le statut sur le bien (`enVente`, `statut`) et, comme le copilote, ne lit pas un mandat supprimé (`.is('deleted_at', null)`) ; `construireFil` écarte un mandat hors vente (`horsVente`) : ses suggestions, ses revenus, ses reportés et son en-tête — donc « Qui pour ce bien ? », qui n'a pas d'autre entrée dans le fil. « En attente » et « À conclure » le gardent et écrivent son état avec le vocabulaire de Mes biens (`listings:status.*`, aucune clé neuve). « Apprendre » n'est pas touché : un refus dit quelque chose de l'acheteur, pas du bien. Les compteurs d'onglets dérivent des constructeurs (`vue.compte`, `vue.reportes`) : ils suivent ce qui est montré ; les filtres Bien et Acheteur ne proposent plus un mandat hors vente qui n'a que des matchs à proposer. Les commentaires du copilote qui disaient que le fil « garde tous les mandats » ou que la règle « attend la décision 12 » deviennent faux : ils sont rectifiés, sans toucher à son comportement (conception §7).

Choix à valider : « non supprimé » s'applique à la lecture, comme au copilote — un super-administrateur, que `super_admin_read_all_properties` laisse lire un mandat supprimé, ne le voit plus dans le fil, comme un agent ; l'état écrit reprend `listings:status.*`, donc `archived` s'écrit « Archivé » (la conception donnait « Retiré » en exemple) ; `record_match_outcome` du copilote consigne encore « proposé » sur un mandat hors vente (conception §7 : le copilote ne change pas), et son commentaire le dit.

**Fichiers :**
- Modifier (tests) : `tests/unit/matching-fil-modele.spec.ts`, `tests/unit/matching-fil-boucle.spec.ts`, `tests/unit/matching-fil-apprendre.spec.ts`, `tests/unit/whatsapp-matching-fil.spec.ts`
- Modifier (modèle) : `src/components/matching-fil/filModele.ts`, `src/components/matching-fil/filBoucle.ts`
- Modifier (lecture) : `src/hooks/useMatchingFil.ts`
- Modifier (écran) : `src/components/matching-fil/MatchingFil.tsx`, `src/components/matching-fil/FilRetours.tsx`, `src/components/matching-fil/FilListeBoucle.tsx`, `src/components/matching-fil/FilConclure.tsx`, `src/components/matching-fil/FilQuiPourCeBien.tsx`
- Modifier (commentaires et titres du copilote) : `supabase/functions/_shared/whatsapp-matching.ts`, `supabase/functions/_shared/whatsapp-matching-outils.ts`, `supabase/functions/_shared/whatsapp-i18n.ts`, `supabase/functions/_shared/whatsapp-matching-outils.test.ts`, `supabase/functions/_shared/whatsapp-matching.test.ts`

- [ ] **Étape 1 : Écrire les tests qui échouent**

Le modèle du fil : un mandat vendu dont la suggestion, le bien revenu et le reporté sortent d'« À proposer », avec son en-tête (« Qui pour ce bien ? »). La boucle : le même mandat gardé dans « En attente » (`sent`) et « À conclure » (`interested`), son état écrit, et chaque statut hors vente libellé dans les quatre langues. « Apprendre » : son refus compte encore. Le copilote : `enVente` du fil égale `occasion` du copilote, statut par statut.

Dans `tests/unit/matching-fil-modele.spec.ts`, remplacer :

```ts
import {
  bienDeCle, cleBien, cleEquipement, cleSelection, compterHistorique, construireFil, construireSelections, contactDeSelection,
  criteresNonTenus, initiales, lignesCriteres, optionsFiltres, palierScore, precoches, premierEcart,
  type FilBien, type FilFiltres, type FilMatch, type FilSelectionResume,
} from '@/components/matching-fil/filModele'
```

par :

```ts
import {
  bienDeCle, cleBien, cleEquipement, cleSelection, compterHistorique, construireFil, construireSelections, contactDeSelection,
  criteresNonTenus, horsVente, initiales, lignesCriteres, optionsFiltres, palierScore, precoches, premierEcart,
  type FilBien, type FilFiltres, type FilMatch, type FilSelectionResume, type SuiviMatch,
} from '@/components/matching-fil/filModele'
```

Dans `tests/unit/matching-fil-modele.spec.ts`, remplacer :

```ts
  it('l’en-tête d’un bien est une ligne de l’ordre, pas du compte', () => {
    const vue = construireFil([match('m2', 91, champel, emma)], SANS_FILTRE, MAINTENANT)
    expect(vue.ordre[0]).toBe(cleBien('p1'))
    expect(bienDeCle(vue.ordre[0]!)).toBe('p1')
    expect(bienDeCle('m2')).toBeNull()
    expect(vue.compte).toBe(1)
  })
})
```

par :

```ts
  it('l’en-tête d’un bien est une ligne de l’ordre, pas du compte', () => {
    const vue = construireFil([match('m2', 91, champel, emma)], SANS_FILTRE, MAINTENANT)
    expect(vue.ordre[0]).toBe(cleBien('p1'))
    expect(bienDeCle(vue.ordre[0]!)).toBe('p1')
    expect(bienDeCle('m2')).toBeNull()
    expect(vue.compte).toBe(1)
  })
})

describe('lot E1 — un mandat qui n’est plus en vente ne se propose plus (décision 12a)', () => {
  const vendu = bien('p9', { titre: 'Villa vendue', enVente: false, statut: 'sold' })
  const champel = bien('p1', { titre: 'Champel', enVente: true, statut: 'active' })
  const julie = acheteur('c9', { prenom: 'Julie', nom: 'Morand' })
  const emma = acheteur('c7', { prenom: 'Emma', nom: 'Schneider' })
  // Refusé pour le prix, revenu par une baisse : un match encore à proposer, qui garde son suivi.
  const revenu: SuiviMatch = {
    statut: 'suggested', proposeLe: '2026-09-01T10:00:00.000Z', reponduLe: '2026-09-02T10:00:00.000Z', motif: 'prix',
    note: null, prixPropose: 3_450_000, apprisLe: null,
  }

  it('ni sa suggestion, ni son bien revenu, ni son reporté n’entrent dans « À proposer » ; le compte suit', () => {
    const vue = construireFil([
      match('m1', 95, vendu, julie),
      match('m2', 92, vendu, emma, { suivi: revenu }),
      match('m3', 88, vendu, emma, { reporteJusquau: '2026-09-30T00:00:00.000Z' }),
      match('m4', 70, champel, julie),
    ], SANS_FILTRE, MAINTENANT)
    expect(vue.groupes.map((g) => g.bien.id)).toEqual(['p1'])
    expect(vue.reportes).toEqual([])
    expect(vue.compte).toBe(1)
    expect(vue.ordre).toEqual(['bien:p1', 'm4'])
  })

  it('« Qui pour ce bien ? » ne s’offre plus : son en-tête n’est plus une ligne du fil', () => {
    const vue = construireFil([match('m1', 95, vendu, julie)], SANS_FILTRE, MAINTENANT)
    expect(vue.ordre).not.toContain(cleBien('p9'))
    expect(vue.groupes).toEqual([])
  })

  it('seul `enVente: false` retire : un bien sans le drapeau (une annonce, un bien lu hors du fil) reste à proposer', () => {
    expect(horsVente(vendu)).toBe(true)
    expect(horsVente(champel)).toBe(false)
    expect(horsVente(bien('p2'))).toBe(false)
    expect(construireFil([match('m5', 80, bien('p2'), emma)], SANS_FILTRE, MAINTENANT).ordre).toEqual(['bien:p2', 'm5'])
  })
})
```

Dans `tests/unit/matching-fil-boucle.spec.ts`, remplacer :

```ts
import { describe, expect, it } from 'vitest'
import {
  cleAttente, construireAConclure, construireAttente, ongletValide, signalPrix, type RelanceProposition,
} from '@/components/matching-fil/filBoucle'
import type { FilBien, FilFiltres, FilMatch, SuiviMatch } from '@/components/matching-fil/filModele'
```

par :

```ts
import { describe, expect, it } from 'vitest'
import {
  cleAttente, cleEtatMandat, construireAConclure, construireAttente, ongletValide, signalPrix, type RelanceProposition,
} from '@/components/matching-fil/filBoucle'
import type { FilBien, FilFiltres, FilMatch, SuiviMatch } from '@/components/matching-fil/filModele'
import { Constants } from '@/types/database'
import biensFr from '@/i18n/locales/fr/listings.json'
import biensDe from '@/i18n/locales/de/listings.json'
import biensEn from '@/i18n/locales/en/listings.json'
import biensIt from '@/i18n/locales/it/listings.json'
```

Dans `tests/unit/matching-fil-boucle.spec.ts`, remplacer :

```ts
  it('la clé d’une ligne d’attente ne se confond pas avec un id de match', () => {
    expect(cleAttente('c9')).toBe('attente:c9')
  })
})
```

par :

```ts
  it('la clé d’une ligne d’attente ne se confond pas avec un id de match', () => {
    expect(cleAttente('c9')).toBe('attente:c9')
  })
})

describe('lot E1 — un mandat qui n’est plus en vente garde sa place dans la boucle, son état écrit (décision 12a)', () => {
  const julie = acheteur('c9', 'Julie')
  const vendu = bien('p9', { enVente: false, statut: 'sold' })

  it('« En attente » garde son bien proposé, « À conclure » son intéressé : la réponse se consigne encore', () => {
    const attente = construireAttente([match('m14', julie, {}, { bien: vendu })], [], SANS_FILTRE, MAINTENANT)
    expect(attente.map((l) => [l.acheteur.id, l.matchs.map((m) => m.id)])).toEqual([['c9', ['m14']]])
    const conclure = construireAConclure([match('m6', julie, { statut: 'interested' }, { bien: vendu })], SANS_FILTRE)
    expect(conclure.map((m) => m.id)).toEqual(['m6'])
  })

  it('son état s’écrit avec le vocabulaire de Mes biens ; un bien en vente ou du marché n’en écrit aucun', () => {
    expect(cleEtatMandat(vendu)).toBe('listings:status.sold')
    expect(cleEtatMandat(bien('p10', { enVente: false, statut: 'reserved' }))).toBe('listings:status.reserved')
    expect(cleEtatMandat(bien('p1', { enVente: true, statut: 'active' }))).toBeNull()
    expect(cleEtatMandat(bien('a1', { marche: { ref: 'MG-FL-1', sourceUrl: null } }))).toBeNull()
  })

  it('chaque statut d’un mandat hors vente a son libellé, dans les quatre langues', () => {
    const LIBELLES: Record<string, { status: Record<string, string> }> = { fr: biensFr, de: biensDe, en: biensEn, it: biensIt }
    const statuts = Constants.public.Enums.property_status.filter((s) => s !== 'active')
    expect(statuts.length).toBeGreaterThan(0)
    for (const statut of statuts) {
      expect(cleEtatMandat(bien('p', { enVente: false, statut }))).toBe(`listings:status.${statut}`)
      for (const [langue, j] of Object.entries(LIBELLES)) expect(j.status[statut], `${langue} · ${statut}`).toMatch(/\S/)
    }
  })
})
```

Dans `tests/unit/matching-fil-apprendre.spec.ts`, remplacer :

```ts
  it('les plus récentes d’abord', () => {
```

par :

```ts
  it('lot E1 : le refus d’un mandat qui n’est plus en vente compte encore — il dit quelque chose de l’acheteur, pas du bien', () => {
    const [c] = construireCorrections([
      m('m16', { prixPropose: 1_580_000 }, { enVente: false, statut: 'sold' }),
      m('m14', { prixPropose: 1_560_000 }),
    ])
    expect(c!.refus.map((x) => x.id)).toEqual(['m16', 'm14'])
    expect(c!.changement).toMatchObject({ cle: 'budget_max', apres: 1_550_000 })
  })

  it('les plus récentes d’abord', () => {
```

Dans `tests/unit/whatsapp-matching-fil.spec.ts`, remplacer :

```ts
 * fausse ou sans raison, et les deux doivent écarter EXACTEMENT les mêmes lignes.
 *
 * Conception : docs/superpowers/specs/2026-09-24-matching-lot-d2-whatsapp-design.md, §3 (« une règle, une source »).
```

par :

```ts
 * fausse ou sans raison, et les deux doivent écarter EXACTEMENT les mêmes lignes.
 *
 * Une règle va dans l'autre sens : « en vente » est celle du copilote (`occasion`, `bienDeMandat`), que le fil applique
 * depuis le lot E1 (décision 12a : `enVente`, `versBien`). Elle est confrontée elle aussi, statut par statut.
 *
 * Conception : docs/superpowers/specs/2026-09-24-matching-lot-d2-whatsapp-design.md, §3 (« une règle, une source »).
```

Dans `tests/unit/whatsapp-matching-fil.spec.ts`, remplacer :

```ts
import { versAction, ecrire, type LigneAction } from '@/components/crm/today/matchingDuJour'
import { lireMatching } from '../../supabase/functions/_shared/morning-brief-data'
```

par :

```ts
import { versAction, ecrire, type LigneAction } from '@/components/crm/today/matchingDuJour'
import { lireMatching } from '../../supabase/functions/_shared/morning-brief-data'
import { Constants } from '@/types/database'
```

Dans `tests/unit/whatsapp-matching-fil.spec.ts`, remplacer :

```ts
  it.each(CAS)('%s', (_n, genre, o) => {
    const { fil, copie } = deuxFormes(genre, o)
    expect(garder(copie)).toEqual(garder(fil))
  })
})
```

par :

```ts
  it.each(CAS)('%s', (_n, genre, o) => {
    const { fil, copie } = deuxFormes(genre, o)
    expect(garder(copie)).toEqual(garder(fil))
  })
})

describe('« en vente » : la règle du copilote (`occasion`), que le fil applique (lot E1, décision 12a)', () => {
  it.each([...Constants.public.Enums.property_status])('un mandat « %s »', (status) => {
    const { fil, copie } = deuxFormes('mandat', { status })
    expect(fil.enVente).toBe(copie.occasion)
    expect(fil.statut).toBe(copie.statutMandat)
  })
})
```

Dans `tests/unit/whatsapp-matching-fil.spec.ts`, remplacer (le commentaire annonçait une divergence non testée) :

```ts
  // Mandat ACTIF : une occasion dans les deux mondes — la divergence sur `occasion` reste À CONFIRMER par
  // Julien (décision 12, lot D1 ; docs/superpowers/feuille-de-route.md), pas testée ici. `publieIlYA` porte
  // le signal « nouveau mandat » ou son absence.
```

par :

```ts
  // Mandat ACTIF : une occasion dans les deux mondes (« en vente », confronté plus haut, statut par statut).
  // `publieIlYA` porte le signal « nouveau mandat » ou son absence.
```

```bash
npx vitest run tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-apprendre.spec.ts tests/unit/whatsapp-matching-fil.spec.ts
```

Attendu : ÉCHEC, `Tests  10 failed | 203 passed (213)` : dans le modèle, `expected [ 'p9', 'p1' ] to deeply equal [ 'p1' ]`, `expected [ 'bien:p9', 'm1' ] to not include 'bien:p9'` et `horsVente is not a function` ; dans la boucle, `cleEtatMandat is not a function` (deux fois) ; dans la confrontation, `expected undefined to be false` (`draft`, `reserved`, `sold`, `archived`) et `expected undefined to be true` (`active`). Les deux tests qui gardent ce qui ne doit PAS bouger — « En attente » et « À conclure » gardent le mandat, son refus nourrit « Apprendre » — passent déjà : aucun constructeur de la boucle ne filtre sur le bien.

- [ ] **Étape 2 : Le modèle : `enVente`, `statut`, `horsVente`, et « À proposer »**

Dans `src/components/matching-fil/filModele.ts`, remplacer :

```ts
  /** Lot C, signal : la signature du mandat ou sa mise en service, la plus récente des deux. */
  mandatLe?: string | null
}
```

par :

```ts
  /** Lot C, signal : la signature du mandat ou sa mise en service, la plus récente des deux. */
  mandatLe?: string | null
  /**
   * Lot E1 (décision 12a). Un mandat EN VENTE : `active` et non supprimé, la règle du copilote WhatsApp (`occasion`,
   * `get_matches`) — le fil ne lit pas un mandat supprimé. `false` : il ne se propose plus (`horsVente`). Absent : une
   * annonce du marché, ou un bien lu hors du fil.
   */
  enVente?: boolean
  /** Lot E1. Le statut d'un mandat (`properties.status`) : l'état qu'« En attente » et « À conclure » écrivent. */
  statut?: string | null
}
```

Dans `src/components/matching-fil/filModele.ts`, remplacer :

```ts
/**
 * Le fil « À traiter » : groupes par bien, reportés à part, compte et ordre de lecture. L'ordre : score
 * décroissant, puis — à score égal — ce qui porte un signal (`signal`, lot C : `aUnSignal` de filSignaux.ts ;
 * absent, aucun), puis le plus récent, puis l'id : un ordre TOTAL, donc une navigation stable. Un groupe se
 * range par son premier match. ⚠ Le comparateur est PASSÉ, pas importé : filSignaux lit ce module.
 * ⚠ Le copilote WhatsApp (lot D2) recopie ce comparateur (`avant`, local, non exporté) dans `vueGetMatches`
 * (`_shared/whatsapp-matching.ts`) : confronté par `tests/unit/whatsapp-matching-fil.spec.ts`, par la sortie
 * publique de `construireFil` puisque `avant` lui-même ne l'est pas.
 */
export function construireFil(
  matchs: readonly FilMatch[], filtres: FilFiltres, maintenant: number, signal: (m: FilMatch) => boolean = () => false,
): FilVue {
  const avant = (a: FilMatch, b: FilMatch): number =>
    b.score - a.score || Number(signal(b)) - Number(signal(a)) || temps(b.creeLe) - temps(a.creeLe) || a.id.localeCompare(b.id)
  const reportes: FilMatch[] = []
  const parBien = new Map<string, { bien: FilBien; matchs: FilMatch[] }>()
  for (const m of matchs) {
    if (!passeFiltres(m, filtres)) continue
```

par :

```ts
/**
 * Un mandat qui n'est plus en vente (lot E1, décision 12a, conception §5.3) : il ne se propose plus. Ses suggestions,
 * ses biens revenus et ses reportés sortent d'« À proposer » (`construireFil`), et avec eux l'en-tête qui ouvre « Qui
 * pour ce bien ? ». « En attente » et « À conclure » le gardent, son état écrit : une réponse en cours se consigne
 * encore. Ses refus nourrissent encore « Apprendre » : un refus dit quelque chose de l'acheteur, pas du bien.
 */
export const horsVente = (b: FilBien): boolean => b.enVente === false

/**
 * Le fil « À traiter » : groupes par bien, reportés à part, compte et ordre de lecture. L'ordre : score
 * décroissant, puis — à score égal — ce qui porte un signal (`signal`, lot C : `aUnSignal` de filSignaux.ts ;
 * absent, aucun), puis le plus récent, puis l'id : un ordre TOTAL, donc une navigation stable. Un groupe se
 * range par son premier match. ⚠ Le comparateur est PASSÉ, pas importé : filSignaux lit ce module.
 * ⚠ Le copilote WhatsApp (lot D2) recopie ce comparateur (`avant`, local, non exporté) dans `vueGetMatches`
 * (`_shared/whatsapp-matching.ts`) : confronté par `tests/unit/whatsapp-matching-fil.spec.ts`, par la sortie
 * publique de `construireFil` puisque `avant` lui-même ne l'est pas.
 * ⚠ Lot E1 : un mandat qui n'est plus en vente n'y entre pas (`horsVente`), ni en ligne, ni en reporté.
 */
export function construireFil(
  matchs: readonly FilMatch[], filtres: FilFiltres, maintenant: number, signal: (m: FilMatch) => boolean = () => false,
): FilVue {
  const avant = (a: FilMatch, b: FilMatch): number =>
    b.score - a.score || Number(signal(b)) - Number(signal(a)) || temps(b.creeLe) - temps(a.creeLe) || a.id.localeCompare(b.id)
  const reportes: FilMatch[] = []
  const parBien = new Map<string, { bien: FilBien; matchs: FilMatch[] }>()
  for (const m of matchs) {
    if (horsVente(m.bien) || !passeFiltres(m, filtres)) continue
```

- [ ] **Étape 3 : La boucle : l'état écrit (`cleEtatMandat`)**

L'état se dit avec les libellés de Mes biens (`listings:status.*`, déjà dans les quatre langues) : une clé, rendue par l'écran, comme `cleMotif`.

Dans `src/components/matching-fil/filBoucle.ts`, remplacer :

```ts
 * ⛔ LE SIGNAL DE PRIX SE CALCULE SUR `prix_propose` SEULEMENT, posé par la base au geste « Je l'ai
 * proposé » (trigger `set_match_prix_propose`). Sans lui, pas de signal : le premier prix de l'annonce ne dit
 * rien de ce que l'acheteur a vu.
 */
import { passeFiltres, temps, type FilFiltres, type FilMatch } from './filModele'
```

par :

```ts
 * ⛔ LE SIGNAL DE PRIX SE CALCULE SUR `prix_propose` SEULEMENT, posé par la base au geste « Je l'ai
 * proposé » (trigger `set_match_prix_propose`). Sans lui, pas de signal : le premier prix de l'annonce ne dit
 * rien de ce que l'acheteur a vu.
 *
 * ⚠ Lot E1 (décision 12a) : ces deux onglets GARDENT un mandat qui n'est plus en vente — une réponse en cours se
 * consigne encore — et écrivent son état (`cleEtatMandat`) ; « À proposer » ne le montre plus (`horsVente`).
 */
import { horsVente, passeFiltres, temps, type FilBien, type FilFiltres, type FilMatch } from './filModele'
```

Dans `src/components/matching-fil/filBoucle.ts`, remplacer :

```ts
export const cleMotif = (code: string | null | undefined): string | null =>
  (code && (MOTIFS_REFUS as readonly string[]).includes(code) ? `fil.motifs.${code}` : null)
```

par :

```ts
export const cleMotif = (code: string | null | undefined): string | null =>
  (code && (MOTIFS_REFUS as readonly string[]).includes(code) ? `fil.motifs.${code}` : null)

/**
 * La clé i18n de l'état d'un mandat qui n'est plus en vente (lot E1), dans le vocabulaire de Mes biens
 * (`listings:status.*` : « Vendu », « Archivé », « Réservé », « Brouillon ») ; `null` pour un bien en vente ou une
 * annonce du marché. Pas de libellé propre au fil : l'état d'un bien se dit partout de la même façon.
 */
export const cleEtatMandat = (b: FilBien): string | null =>
  (horsVente(b) && b.statut ? `listings:status.${b.statut}` : null)
```

- [ ] **Étape 4 : La lecture : le statut du mandat, jamais un mandat supprimé**

Dans `src/hooks/useMatchingFil.ts`, remplacer :

```ts
 * ⚠ Le filtre « bien en mandat » est posé DEUX fois : `not(property_id, is, null)` pour la base, et
 * côté client pour le banc, qui ne connaît pas l'opérateur `not`.
 *
```

par :

```ts
 * ⚠ Le filtre « bien en mandat » est posé DEUX fois : `not(property_id, is, null)` pour la base, et
 * côté client pour le banc, qui ne connaît pas l'opérateur `not`.
 *
 * ⚠ LE STATUT D'UN MANDAT EST LU (lot E1, décision 12a) : « en vente » s'il est `active` et non supprimé — la règle du
 * copilote WhatsApp (`occasion`, `get_matches`), confrontée par `whatsapp-matching-fil.spec.ts`. Porté sur le bien
 * (`enVente`, `statut`), il retire un mandat d'« À proposer » (`horsVente`). Un mandat supprimé n'est pas lu du tout
 * (`deleted_at`), comme par le copilote : la RLS d'un agent le masque déjà, pas celle d'un super-administrateur
 * (`super_admin_read_all_properties`).
 *
```

Dans `src/hooks/useMatchingFil.ts`, remplacer :

```ts
  /** Lot C. */
  bedrooms: number | string | null; condition: string | null; year_built: number | string | null
  off_market: boolean | null; mandate_signed_at: string | null; published_at: string | null
}
```

par :

```ts
  /** Lot C. */
  bedrooms: number | string | null; condition: string | null; year_built: number | string | null
  off_market: boolean | null; mandate_signed_at: string | null; published_at: string | null
  /** Lot E1 : `draft`, `active`, `reserved`, `sold` ou `archived` — en vente s'il est `active`. */
  status: string | null
}
```

Dans `src/hooks/useMatchingFil.ts`, remplacer :

```ts
    // `mandate_signed_at` n'est posé que par « Nouveau bien » (0 mandat sur 6 en production le 22.09.2026) :
    // la mise en service (`published_at`) date aussi un nouveau mandat.
    mandatLe: plusRecente(b.mandate_signed_at, b.published_at),
  }
}
```

par :

```ts
    // `mandate_signed_at` n'est posé que par « Nouveau bien » (0 mandat sur 6 en production le 22.09.2026) :
    // la mise en service (`published_at`) date aussi un nouveau mandat.
    mandatLe: plusRecente(b.mandate_signed_at, b.published_at),
    // Lot E1 (décision 12a) : la règle d'`occasion` du copilote (`bienDeMandat`), à l'identique.
    enVente: b.status === 'active', statut: b.status,
  }
}
```

Dans `src/hooks/useMatchingFil.ts`, remplacer :

```ts
      ? lire<LigneBien>(
        supabase.from('properties')
          .select('id, title, type, transaction_type, price, rooms, surface_m2, address, city, canton, features, photos, bedrooms, condition, year_built, off_market, mandate_signed_at, published_at')
          .in('id', bienIds),
      )
```

par :

```ts
      ? lire<LigneBien>(
        supabase.from('properties')
          .select('id, title, type, transaction_type, price, rooms, surface_m2, address, city, canton, features, photos, bedrooms, condition, year_built, off_market, mandate_signed_at, published_at, status')
          .in('id', bienIds)
          .is('deleted_at', null),
      )
```

Dans `src/hooks/useMatchingFil.ts`, remplacer :

```ts
    // Un contact ou un bien que la RLS ne rend pas : on n'invente pas la ligne.
```

par :

```ts
    // Un contact ou un bien que la lecture ne rend pas (la RLS, un mandat supprimé) : on n'invente pas la ligne.
```

- [ ] **Étape 5 : L'écran : les filtres, et l'état écrit dans « Retours de … » et « À conclure »**

`MatchingFil` ne change que ses choix de filtre ; « Qui pour ce bien ? » n'a pas d'autre entrée que l'en-tête d'un groupe d'« À proposer », que `construireFil` ne produit plus pour un mandat hors vente. L'état s'écrit en tête des détails d'un bien de « Retours de … », après le titre sur la ligne d'« À conclure », avant le prix dans son panneau. Aucun littéral de style n'est ajouté.

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
 * ⚠ TROIS ONGLETS, un par temps de la boucle (§5) : « À proposer » (les recherches à ajuster, les biens en
 * mandat, une ligne « Marché » par acheteur), « En attente » (une ligne par acheteur ; le panneau est la
 * feuille « Retours de … »), « À conclure » (une ligne par bien qui intéresse ; le panneau planifie la
 * visite). L'onglet est rangé dans l'ONGLET du CRM, comme les filtres ; la sélection reste locale.
 *
```

par :

```tsx
 * ⚠ TROIS ONGLETS, un par temps de la boucle (§5) : « À proposer » (les recherches à ajuster, les biens en
 * mandat, une ligne « Marché » par acheteur), « En attente » (une ligne par acheteur ; le panneau est la
 * feuille « Retours de … »), « À conclure » (une ligne par bien qui intéresse ; le panneau planifie la
 * visite). L'onglet est rangé dans l'ONGLET du CRM, comme les filtres ; la sélection reste locale.
 *
 * ⚠ Lot E1 (décision 12a) : un mandat qui n'est plus en vente (`horsVente`) sort d'« À proposer », son en-tête et
 * donc « Qui pour ce bien ? » avec lui ; « En attente » et « À conclure » le gardent, son état écrit.
 *
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
import {
  bienDeCle, cleSelection, construireFil, construireSelections, contactDeSelection, optionsFiltres, precoches,
  type FilFiltres, type FilMatch,
} from './filModele'
```

par :

```tsx
import {
  bienDeCle, cleSelection, construireFil, construireSelections, contactDeSelection, horsVente, optionsFiltres, precoches,
  type FilFiltres, type FilMatch,
} from './filModele'
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
  // Les acheteurs de la boucle comptent aussi, même sans rien à proposer ; le filtre Bien ne vise que les
  // biens en mandat (`optionsFiltres`).
  const options = useMemo(() => optionsFiltres(
    [...matchs, ...boucle.filter((m) => !m.bien.marche)], selections, boucle.filter((m) => m.bien.marche).map((m) => m.acheteur),
  ), [matchs, boucle, selections])
```

par :

```tsx
  // Les acheteurs de la boucle comptent aussi, même sans rien à proposer ; le filtre Bien ne vise que les
  // biens en mandat (`optionsFiltres`). Un mandat qui n'est plus en vente n'y entre que par la boucle : ses matchs à
  // proposer ne sont plus des lignes, un choix qui ne mènerait qu'à eux ne mènerait à rien.
  const options = useMemo(() => optionsFiltres(
    [...matchs.filter((m) => !horsVente(m.bien)), ...boucle.filter((m) => !m.bien.marche)], selections,
    boucle.filter((m) => m.bien.marche).map((m) => m.acheteur),
  ), [matchs, boucle, selections])
```

Dans `src/components/matching-fil/FilRetours.tsx`, remplacer :

```tsx
 * ⚠ Le titre est le NOM de l'acheteur, comme dans la sélection du marché — pas « Retours de Julie » : le
 * français élide devant une voyelle (« d'Emma »), et une interpolation ne le sait pas.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { initiales, palierScore, type FilMatch } from './filModele'
import type { FilAttente, MotifRefus } from './filBoucle'
```

par :

```tsx
 * ⚠ Le titre est le NOM de l'acheteur, comme dans la sélection du marché — pas « Retours de Julie » : le
 * français élide devant une voyelle (« d'Emma »), et une interpolation ne le sait pas.
 *
 * ⚠ Un mandat qui n'est plus en vente garde sa place (lot E1) : son état s'écrit en tête du bien (« Vendu · CHF … »).
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { initiales, palierScore, type FilMatch } from './filModele'
import { cleEtatMandat, type FilAttente, type MotifRefus } from './filBoucle'
```

Dans `src/components/matching-fil/FilRetours.tsx`, remplacer :

```tsx
  const signal = texteSignal(m, t)
  const propose = m.suivi?.proposeLe
  const details = [prixBien(m.bien, t), m.bien.ville, propose ? t('fil.retours.proposeLe', { date: dateCourte(propose) }) : null]
    .filter(Boolean).join(' · ')
```

par :

```tsx
  const signal = texteSignal(m, t)
  const propose = m.suivi?.proposeLe
  const etat = cleEtatMandat(m.bien)
  const details = [
    etat ? t(etat) : null, prixBien(m.bien, t), m.bien.ville, propose ? t('fil.retours.proposeLe', { date: dateCourte(propose) }) : null,
  ].filter(Boolean).join(' · ')
```

Dans `src/components/matching-fil/FilListeBoucle.tsx`, remplacer :

```tsx
 * `MatchingFil` qui porte le clavier. Une relance échue le dit, icône d'écart à l'appui ; un bien proposé
 * dont le prix a baissé depuis aussi (§4.6 : « sa ligne d'En attente porte le signal »).
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { initiales, type FilMatch } from './filModele'
import { cleAttente, type FilAttente } from './filBoucle'
```

par :

```tsx
 * `MatchingFil` qui porte le clavier. Une relance échue le dit, icône d'écart à l'appui ; un bien proposé
 * dont le prix a baissé depuis aussi (§4.6 : « sa ligne d'En attente porte le signal »).
 *
 * ⚠ Un mandat qui n'est plus en vente garde sa ligne d'« À conclure » (lot E1) : son état suit son titre.
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { initiales, type FilMatch } from './filModele'
import { cleAttente, cleEtatMandat, type FilAttente } from './filBoucle'
```

Dans `src/components/matching-fil/FilListeBoucle.tsx`, remplacer :

```tsx
  const { t } = useTranslation('matching')
  const repondu = m.suivi?.reponduLe
  return (
```

par :

```tsx
  const { t } = useTranslation('matching')
  const repondu = m.suivi?.reponduLe
  const etat = cleEtatMandat(m.bien)
  const titre = [m.bien.titre, etat ? t(etat) : null].filter(Boolean).join(' · ')
  return (
```

Dans `src/components/matching-fil/FilListeBoucle.tsx`, remplacer :

```tsx
          {repondu ? t('fil.conclure.ligne', { titre: m.bien.titre, date: dateCourte(repondu) }) : m.bien.titre}
```

par :

```tsx
          {repondu ? t('fil.conclure.ligne', { titre, date: dateCourte(repondu) }) : titre}
```

Dans `src/components/matching-fil/FilConclure.tsx`, remplacer :

```tsx
 * ⚠ « Pas intéressé » (N) reste possible : un intérêt peut retomber, et sans ce geste la ligne n'aurait pas
 * de sortie.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, format } from 'date-fns'
import type { CrmPalette } from '@/components/crm/tokens'
import type { VisiteAPlanifier } from '@/lib/matchingGestes'
import { initiales, palierScore, type FilMatch } from './filModele'
import type { MotifRefus } from './filBoucle'
```

par :

```tsx
 * ⚠ « Pas intéressé » (N) reste possible : un intérêt peut retomber, et sans ce geste la ligne n'aurait pas
 * de sortie.
 *
 * ⚠ Un mandat qui n'est plus en vente garde sa place (lot E1) : son état s'écrit avant son prix.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, format } from 'date-fns'
import type { CrmPalette } from '@/components/crm/tokens'
import type { VisiteAPlanifier } from '@/lib/matchingGestes'
import { initiales, palierScore, type FilMatch } from './filModele'
import { cleEtatMandat, type MotifRefus } from './filBoucle'
```

Dans `src/components/matching-fil/FilConclure.tsx`, remplacer :

```tsx
  const { bien, acheteur } = m
  const debut = date && heure ? new Date(`${date}T${heure}:00`) : null
```

par :

```tsx
  const { bien, acheteur } = m
  const etat = cleEtatMandat(bien)
  const debut = date && heure ? new Date(`${date}T${heure}:00`) : null
```

Dans `src/components/matching-fil/FilConclure.tsx`, remplacer :

```tsx
            <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
              {[prixBien(bien, t), bien.adresse, bien.ville].filter(Boolean).join(' · ')}
            </p>
            {bien.marche
```

par :

```tsx
            <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
              {[etat ? t(etat) : null, prixBien(bien, t), bien.adresse, bien.ville].filter(Boolean).join(' · ')}
            </p>
            {bien.marche
```

Le panneau « Qui pour ce bien ? » du fil demande d'office les anciens prospects (`avecAnciens`), que le moteur ne note que pour un mandat actif (404 sinon) : ce qui le garantit s'écrit à côté.

Dans `src/components/matching-fil/FilQuiPourCeBien.tsx`, remplacer :

```tsx
 * anciens prospects. Les prescripteurs attendent le modèle relationnel (étape 6) : pas de section vide.
 *
```

par :

```tsx
 * anciens prospects. Les prescripteurs attendent le modèle relationnel (étape 6) : pas de section vide.
 *
 * ⚠ Il ne s'ouvre que sur un mandat EN VENTE (lot E1) : un mandat qui ne l'est plus n'a plus d'en-tête dans « À
 * proposer » (`horsVente`). D'où les anciens prospects demandés d'office (`avecAnciens`) : le moteur ne les note que
 * pour un mandat actif.
 *
```

- [ ] **Étape 6 : Le copilote : les commentaires qui disaient le fil autrement**

Aucun comportement ne change (conception §7) : la règle `occasion` était déjà la sienne ; ce qui devient faux, c'est ce qu'il disait du fil et de la décision 12, qui est tranchée.

Dans `supabase/functions/_shared/whatsapp-matching.ts`, remplacer :

```ts
   * n'est plus une occasion »). ⚠ DIFFÈRE du fil, qui garde tous les mandats quel que soit leur statut — à confirmer
   * par Julien avant de la généraliser ailleurs (décision 12, lot D1).
   */
```

par :

```ts
   * n'est plus une occasion »). Le fil l'applique aussi (lot E1, décision 12a de Julien : `enVente`, `versBien`) ;
   * `tests/unit/whatsapp-matching-fil.spec.ts` confronte les deux.
   */
```

Dans `supabase/functions/_shared/whatsapp-matching.ts`, remplacer :

```ts
    // cours s'ils y sont déjà. Cette règle DIFFÈRE du fil, qui garde tous les mandats quel que soit leur statut : à
    // confirmer par Julien avant de la généraliser (décision 12, lot D1).
    occasion: l.status === 'active',
```

par :

```ts
    // cours s'ils y sont déjà. Le fil applique la même règle (lot E1, décision 12a).
    occasion: l.status === 'active',
```

Dans `supabase/functions/_shared/whatsapp-matching-outils.ts`, remplacer :

```ts
 * relance sur un bien parti. Un mandat garde sa place quel que soit son statut, comme dans le fil : la règle
 * `occasion` des mandats attend la décision 12 du lot D1 (Julien).
 */
```

par :

```ts
 * relance sur un bien parti. Un mandat garde sa place quel que soit son statut : cette consignation ne lit pas son
 * `occasion`, que le fil et `get_matches` appliquent (décision 12a) — l'y étendre attend l'accord de Julien.
 */
```

Dans `supabase/functions/_shared/whatsapp-i18n.ts`, remplacer :

```ts
 * plus ; rien n'est consigné. Les MANDATS n'ont pas cette règle : celle de leur `occasion` attend la décision 12 du
 * lot D1 (Julien).
 */
```

par :

```ts
 * plus ; rien n'est consigné. Les MANDATS n'ont pas cette règle ici : la consignation ne lit pas leur `occasion`
 * (`proposable`, whatsapp-matching-outils.ts).
 */
```

Dans `supabase/functions/_shared/whatsapp-matching-outils.test.ts`, remplacer :

```ts
  it('un MANDAT vendu se propose encore, comme dans le fil : la règle `occasion` des mandats attend la décision 12 du lot D1', async () => {
```

par :

```ts
  it('un MANDAT vendu se consigne encore « proposé » : la consignation ne lit pas `occasion`, que le fil applique (décision 12a)', async () => {
```

Dans `supabase/functions/_shared/whatsapp-matching.test.ts`, remplacer :

```ts
  it('seul `active` est une occasion : draft et reserved en sont exclus SANS être « retirés » (règle du point du matin, à confirmer — décision 12, lot D1)', () => {
```

par :

```ts
  it('seul `active` est une occasion : draft et reserved en sont exclus SANS être « retirés » (règle du point du matin et du fil — décision 12a)', () => {
```

Dans `supabase/functions/_shared/whatsapp-matching.test.ts`, remplacer :

```ts
  it('un mandat « reserved » est hors « à proposer » (pas une occasion) sans être étiqueté retiré — règle du point du matin, à confirmer (décision 12, lot D1)', () => {
```

par :

```ts
  it('un mandat « reserved » est hors « à proposer » (pas une occasion) sans être étiqueté retiré — règle du point du matin et du fil (décision 12a)', () => {
```

- [ ] **Étape 7 : Lancer les tests**

```bash
npx vitest run tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-apprendre.spec.ts tests/unit/whatsapp-matching-fil.spec.ts
```

Attendu : PASS, `Test Files  4 passed (4)`, `Tests  213 passed (213)`.

- [ ] **Étape 8 : Vérifier**

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx eslint --quiet src/components/matching-fil/filModele.ts src/components/matching-fil/filBoucle.ts src/hooks/useMatchingFil.ts src/components/matching-fil/MatchingFil.tsx src/components/matching-fil/FilRetours.tsx src/components/matching-fil/FilListeBoucle.tsx src/components/matching-fil/FilConclure.tsx src/components/matching-fil/FilQuiPourCeBien.tsx tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-apprendre.spec.ts tests/unit/whatsapp-matching-fil.spec.ts supabase/functions/_shared/whatsapp-matching.ts supabase/functions/_shared/whatsapp-matching-outils.ts supabase/functions/_shared/whatsapp-i18n.ts supabase/functions/_shared/whatsapp-matching-outils.test.ts supabase/functions/_shared/whatsapp-matching.test.ts
deno check --no-lock supabase/functions/_shared/whatsapp-matching.ts supabase/functions/_shared/whatsapp-matching-outils.ts supabase/functions/_shared/whatsapp-i18n.ts
```

Attendu : ESLint sans sortie ; `deno check` rend trois lignes `Check …` et sort à 0.

```bash
npm run lint:deadcode
npm run lint:i18n
npm run i18n:parity:ci
npm run i18n:coverage:ci
```

Attendu : `✓ Aucun export mort` (`horsVente` et `cleEtatMandat` ont chacun leurs lecteurs dans `src/`) ; `✓ i18n garde-fou OK` ; parité `0 manquante(s), 0 orpheline(s)` ; couverture `✓ Aucune régression vs référence` — aucune clé n'est ajoutée, l'état reprend `listings:status.*`.

Les specs qui chargent ou lisent un fichier touché, cliquet de grammaire compris (seuls des textes s'ajoutent à l'écran, aucun littéral de style) :

```bash
npx vitest run tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-apprendre.spec.ts tests/unit/whatsapp-matching-fil.spec.ts tests/unit/fiche-qui-pour.spec.ts tests/unit/fil-liens-arrivee.spec.ts tests/unit/matching-du-jour.spec.ts tests/unit/matching-fil-signaux.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/matching-whatsapp-sql.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/sa-boucle.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/matching-contraste.spec.ts tests/unit/banc-matching-boucle.spec.ts tests/unit/banc-matching-d1.spec.ts tests/unit/banc-matching-explique.spec.ts supabase/functions/_shared/whatsapp-matching.test.ts supabase/functions/_shared/whatsapp-matching-outils.test.ts supabase/functions/_shared/whatsapp-i18n.test.ts supabase/functions/_shared/whatsapp-actions.test.ts supabase/functions/_shared/whatsapp-confirm-buttons.test.ts supabase/functions/_shared/whatsapp-phantom-action.test.ts
```

Attendu : PASS, `Test Files  24 passed (24)`, `Tests  820 passed (820)`. Le banc `/dev/crm` ne change pas : ses trois mandats et ceux du catalogue sont `active` (`crmFixtures.ts`), et son intercepteur applique `is` (`bancSupabase.ts`).

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint`, ni `deno` en parallèle) :

```bash
npx vitest run
```

Attendu : 339 fichiers verts sur 342 ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`.

---

## Tâche 3 : « Qui pour ce bien ? » sans les refus (décision 13a), et plus d'« à proposer » sur un mandat qui n'est plus en vente (décision 12a)

Le panneau « Qui pour ce bien ? » du fil prend ses acquéreurs dans tout ce que le fil connaît du mandat — ses matchs à proposer ET sa boucle (`MatchingFil.tsx`, `compatibles`), que le fil lit refus compris pour « Apprendre » (`STATUTS_BOUCLE`, `useMatchingFil.ts`) —, alors que les fiches ne comptent que `STATUTS_COMPATIBLES` (`filQuiPour.ts`, lu par `useQuiPourCeBien`) : le même mandat pouvait compter plus d'acquéreurs dans le fil que sur sa fiche, un refus écrit « Pas intéressé·e » parmi eux. Décision 13a de Julien (conception §5.4) : le panneau du fil lit `STATUTS_COMPATIBLES`, par une règle pure du modèle partagé (`compatiblesDuFil`) ; les refus sortent de la liste, donc du compte (le titre compte ce qu'on lui passe) ; un match à proposer jamais proposé, qui n'a pas de suivi (`suiviAProposer`), compte comme `suggested`. Côté fiche, décision 12a (« une seule règle ») : depuis la tâche 2, « À proposer » ne montre plus un mandat qui n'est plus en vente, et « Ouvrir » sur l'un de ses acquéreurs à proposer menait à une ligne absente — l'arrivée était abandonnée. La fiche d'un mandat reprend le traitement de l'annonce retirée : son état, déjà chargé (`bien.status`, par `useProperty`, qui ne lit pas un mandat supprimé), passe en `horsVente` ; ses acquéreurs à proposer — revenus et reportés compris — perdent « Ouvrir », un proposé ou un intéressé garde sa place (« Retours de … », « À conclure »), et une ligne dit pourquoi. La décision d'« Ouvrir », jusqu'ici écrite dans `QuiPourFiche`, passe telle quelle dans le modèle pur (`lienCompatible`) pour s'éprouver sans écran ; l'annonce retirée n'y change pas de comportement. Le texte de l'annonce (« Annonce retirée du marché ») ne vaut pas pour un mandat vendu, archivé, réservé ou en brouillon : une clé neuve, `fil.quiPour.horsVente`, dans les quatre langues. Le lien « Planifier une visite » de la fiche relève de la tâche 5.

Choix à valider : les lignes de la fiche gardent leur état (« À proposer », « Revenu · refusé à … », « Reporté jusqu'au … »), comme sur une annonce retirée — c'est la ligne en tête qui dit que le bien ne se propose plus ; le texte neuf dit « n'est plus disponible », ni « en vente » (faux pour une location) ni « sur le marché » (se confondrait avec Off-market, qui se propose).

**Fichiers :**
- Modifier (test) : `tests/unit/fiche-qui-pour.spec.ts`
- Modifier (modèle) : `src/components/matching-fil/filQuiPour.ts`
- Modifier (panneau du fil) : `src/components/matching-fil/MatchingFil.tsx`, `src/components/matching-fil/FilQuiPourCeBien.tsx`
- Modifier (fiche) : `src/components/matching-fil/QuiPourFiche.tsx`, `src/pages/agent/ListingDetailPage.tsx`
- Modifier (i18n) : `src/i18n/locales/fr/matching.json`, `src/i18n/locales/de/matching.json`, `src/i18n/locales/en/matching.json`, `src/i18n/locales/it/matching.json`

- [ ] **Étape 1 : Écrire les tests qui échouent**

Le panneau du fil : un refus absent de la liste et du compte, un match jamais proposé présent, chaque statut confronté à `STATUTS_COMPATIBLES`. La fiche : sur un mandat vendu, un acquéreur à proposer (revenu et reporté compris) ne mène nulle part, un proposé et un intéressé gardent leur place ; l'annonce retirée, même règle. La lecture du code : le panneau passe par la règle, la fiche d'un mandat passe son état.

Dans `tests/unit/fiche-qui-pour.spec.ts`, remplacer :

```ts
/**
 * « Qui pour ce bien ? » (lots C et D1, conception §7) : un compatible REPORTÉ dit jusqu'à quand, un REVENU dit à quel
 * prix il avait été refusé — ni l'un ni l'autre ne passe pour une suggestion ordinaire —, et une fiche lit les matchs DU
 * bien, jamais ceux de l'agence.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  etatCompatible, STATUTS_COMPATIBLES, trierCompatibles, versCompatible, type Compatible,
} from '@/components/matching-fil/filQuiPour'
```

par :

```ts
/**
 * « Qui pour ce bien ? » (lots C et D1, conception §7) : un compatible REPORTÉ dit jusqu'à quand, un REVENU dit à quel
 * prix il avait été refusé — ni l'un ni l'autre ne passe pour une suggestion ordinaire —, et une fiche lit les matchs DU
 * bien, jamais ceux de l'agence.
 *
 * Lot E1 : le panneau du fil compte les compatibles comme les fiches, sans les refus (décision 13a) ; sur une fiche, un
 * compatible à proposer d'un bien qui ne se propose plus — annonce retirée, mandat qui n'est plus en vente (décision
 * 12a) — ne mène nulle part dans le fil.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  compatiblesDuFil, etatCompatible, lienCompatible, STATUTS_COMPATIBLES, trierCompatibles, versCompatible, type Compatible,
} from '@/components/matching-fil/filQuiPour'
```

Dans `tests/unit/fiche-qui-pour.spec.ts`, remplacer :

```ts
  it('sans acheteur lisible, rien', () => {
    expect(versCompatible(ligne, undefined)).toBeNull()
  })
})
```

par :

```ts
  it('sans acheteur lisible, rien', () => {
    expect(versCompatible(ligne, undefined)).toBeNull()
  })
})

describe('lot E1 — « Qui pour ce bien ? » du fil compte comme les fiches, sans les refus (décision 13a)', () => {
  // Ce que le fil connaît d'un mandat : ses matchs à proposer (sans suivi s'ils n'ont jamais été proposés) et sa boucle,
  // refus compris — le fil les lit pour « Apprendre ».
  const surLeBien = (c: Compatible, bienId = 'p1') => ({ ...c, bien: { id: bienId } })
  const connus = [
    surLeBien({ ...base, id: 'm-jamais' }),
    surLeBien({ ...suivi('suggested', { motif: 'prix', prixPropose: 3_450_000 }), id: 'm-revenu' }),
    surLeBien({ ...base, id: 'm-reporte', reporteJusquau: '2026-09-30T00:00:00Z' }),
    surLeBien({ ...suivi('sent'), id: 'm-propose' }),
    surLeBien({ ...suivi('interested'), id: 'm-interesse' }),
    surLeBien({ ...suivi('visit_planned'), id: 'm-visite' }),
    surLeBien({ ...suivi('rejected', { motif: 'quartier' }), id: 'm-refus' }),
    surLeBien({ ...base, id: 'm-autre-bien' }, 'p2'),
    { ...base, id: 'm-annonce', bien: { id: 'p1', marche: { ref: 'MG-FL-1', sourceUrl: null } } },
  ]

  it('un refus sort de la liste, donc du compte ; un match jamais proposé reste', () => {
    const compatibles = compatiblesDuFil(connus, 'p1')
    expect(compatibles.map((m) => m.id)).toEqual(['m-jamais', 'm-revenu', 'm-reporte', 'm-propose', 'm-interesse', 'm-visite'])
    // Le panneau titre « N acquéreurs compatibles » sur ce qu'on lui passe (`QuiPourCeBien`) : 6, pas 7.
    expect(trierCompatibles(compatibles)).toHaveLength(6)
  })

  it('un statut passe s’il est dans `STATUTS_COMPATIBLES`, la liste des fiches, et seulement alors', () => {
    for (const statut of ['suggested', 'sent', 'interested', 'visit_planned', 'rejected'] as const) {
      const garde = compatiblesDuFil([surLeBien({ ...suivi(statut), id: statut })], 'p1').length === 1
      expect(garde, statut).toBe((STATUTS_COMPATIBLES as readonly string[]).includes(statut))
    }
  })
})

describe('lot E1 — sur la fiche d’un mandat qui n’est plus en vente, « Ouvrir » ne mène plus à « À proposer » (décision 12a)', () => {
  const vendu = { marche: false, occasion: false }
  const enVente = { marche: false, occasion: true }

  it('un acquéreur à proposer, revenu ou reporté ne mène nulle part : le fil ne propose plus ce mandat', () => {
    expect(lienCompatible(base, vendu, T)).toBeNull()
    expect(lienCompatible(suivi('suggested', { motif: 'prix', prixPropose: 3_450_000 }), vendu, T)).toBeNull()
    expect(lienCompatible({ ...base, reporteJusquau: '2026-09-30T00:00:00Z' }, vendu, T)).toBeNull()
    // En vente, le même mène à sa ligne d'« À proposer ».
    expect(lienCompatible(base, enVente, T)).toBe('ligne=m1&contact=c1')
  })

  it('un proposé ou un intéressé garde sa place : « Retours de … » et « À conclure » gardent le mandat', () => {
    expect(lienCompatible(suivi('sent'), vendu, T)).toBe('attente=c1')
    expect(lienCompatible(suivi('interested'), vendu, T)).toBe('onglet=aConclure&ligne=m1&contact=c1')
  })

  it('une annonce retirée suit la même règle : son acquéreur à proposer n’a plus de ligne « Marché »', () => {
    expect(lienCompatible(base, { marche: true, occasion: false }, T)).toBeNull()
    expect(lienCompatible(base, { marche: true, occasion: true }, T)).toBe('ligne=marche%3Ac1&contact=c1')
    expect(lienCompatible(suivi('sent'), { marche: true, occasion: false }, T)).toBe('attente=c1')
  })
})
```

Dans `tests/unit/fiche-qui-pour.spec.ts`, remplacer :

```ts
    expect(source('src/hooks/useQuiPourCeBien.ts')).toMatch(/queryKey: \[CLE_FIL, CLE_QUI_POUR/)
    expect(source('src/hooks/useAnciensProspects.ts')).toMatch(/invalidateQueries\(\{ queryKey: \[CLE_FIL\] \}\)/)
  })
})
```

par :

```ts
    expect(source('src/hooks/useQuiPourCeBien.ts')).toMatch(/queryKey: \[CLE_FIL, CLE_QUI_POUR/)
    expect(source('src/hooks/useAnciensProspects.ts')).toMatch(/invalidateQueries\(\{ queryKey: \[CLE_FIL\] \}\)/)
  })

  it('lot E1 : le panneau du fil trie par la règle des fiches, et la fiche d’un mandat dit s’il est encore en vente', () => {
    expect(source('src/components/matching-fil/MatchingFil.tsx')).toMatch(/compatiblesDuFil\(\[\.\.\.visibles, \.\.\.visiblesBoucle\], bienQuiPour\)/)
    // La règle du fil (`enVente`, `versBien`) : un mandat est en vente s'il est `active` ; la fiche ne lit pas un mandat
    // supprimé (`useProperty`).
    expect(source('src/pages/agent/ListingDetailPage.tsx')).toMatch(/horsVente=\{bien\.status !== 'active'\}/)
    expect(source('src/components/matching-fil/QuiPourFiche.tsx')).toMatch(/occasion: !retiree && !horsVente/)
  })
})
```

```bash
npx vitest run tests/unit/fiche-qui-pour.spec.ts
```

Attendu : ÉCHEC, `Tests  6 failed | 15 passed (21)` : `compatiblesDuFil is not a function` (deux fois), `lienCompatible is not a function` (trois fois), et la lecture du code, `expected '/**\n * Matching — le FIL DE MATCHS (…' to match /compatiblesDuFil\(\[\.\.\.visibles, \…/`.

- [ ] **Étape 2 : Le modèle : `compatiblesDuFil` et `lienCompatible`**

`compatiblesDuFil` est générique, comme `trierCompatibles` : le fil lui passe ses `FilMatch` et les récupère tels quels. `lienCompatible` reprend à l'identique le code d'« Ouvrir » de `QuiPourFiche` (le report jugé par `etatCompatible`, la place par `lienPlace`), le drapeau `retiree` devenant `occasion` — le mot du copilote WhatsApp pour un bien qui se propose encore, annonce ou mandat.

Dans `src/components/matching-fil/filQuiPour.ts`, remplacer :

```ts
/**
 * « Qui pour ce bien ? » (lots C et D1) — modèle PUR partagé par le panneau du fil et les deux fiches : la forme d'un
 * acquéreur compatible, et ce qu'on écrit de son état. Ni React, ni Supabase, ni traduction.
 *
 * ⚠ Un match REPORTÉ dit jusqu'à quand ; un bien REVENU (refusé pour le prix, revenu par une baisse) dit à quel prix il
 * avait été refusé — ni l'un ni l'autre n'est une suggestion ordinaire (conception de D1, §7).
 */
import { cleMotif } from './filBoucle'
import { nombreOuNull, temps, type FilMatch, type SuiviMatch } from './filModele'

/**
 * Les statuts d'un acquéreur compatible — ceux qu'un refus n'a pas écartés : à proposer (reportés compris), proposés,
 * intéressés, en visite. Lus par les fiches (`useQuiPourCeBien`) et l'écran de fin de « Nouveau bien »
 * (`useAcquereursNouveauMandat`).
```

par :

```ts
/**
 * « Qui pour ce bien ? » (lots C et D1) — modèle PUR partagé par le panneau du fil et les deux fiches : la forme d'un
 * acquéreur compatible, ce qu'on écrit de son état, et où « Ouvrir » le mène depuis une fiche. Ni React, ni Supabase, ni
 * traduction.
 *
 * ⚠ Un match REPORTÉ dit jusqu'à quand ; un bien REVENU (refusé pour le prix, revenu par une baisse) dit à quel prix il
 * avait été refusé — ni l'un ni l'autre n'est une suggestion ordinaire (conception de D1, §7).
 * ⚠ Lot E1 : le panneau du fil compte les MÊMES compatibles que les fiches (`compatiblesDuFil`, décision 13a) ; depuis
 * une fiche, un compatible à proposer d'un bien qui ne se propose plus ne mène nulle part (`lienCompatible`, décision 12a).
 */
import { cleMotif } from './filBoucle'
import { lienPlace } from './filLiens'
import { nombreOuNull, temps, type FilBien, type FilMatch, type SuiviMatch } from './filModele'

/**
 * Les statuts d'un acquéreur compatible — ceux qu'un refus n'a pas écartés : à proposer (reportés compris), proposés,
 * intéressés, en visite. Lus par les fiches (`useQuiPourCeBien`), le panneau du fil (`compatiblesDuFil`) et l'écran de
 * fin de « Nouveau bien » (`useAcquereursNouveauMandat`).
```

Dans `src/components/matching-fil/filQuiPour.ts`, remplacer :

```ts
export const STATUTS_COMPATIBLES = ['suggested', 'sent', 'interested', 'visit_planned'] as const

/** Un acquéreur compatible : ce que le fil sait d'un match, ou ce qu'une fiche en lit. */
```

par :

```ts
export const STATUTS_COMPATIBLES = ['suggested', 'sent', 'interested', 'visit_planned'] as const

/**
 * Les acquéreurs compatibles d'un mandat parmi les matchs que le fil connaît : ceux de son panneau « Qui pour ce bien ? »
 * (lot E1, décision 13a), à la définition des fiches (`STATUTS_COMPATIBLES`). Ses refus, que le fil lit dans sa boucle
 * pour « Apprendre », n'en sont pas : ils sortent du compte et de la liste. Un match à proposer jamais proposé n'a pas de
 * suivi (`suiviAProposer`) : il compte comme `suggested`. Une annonce du marché n'y entre pas : le panneau est celui d'un
 * mandat.
 */
export const compatiblesDuFil = <T extends Pick<FilMatch, 'suivi'> & { bien: Pick<FilBien, 'id' | 'marche'> }>(
  matchs: readonly T[], bienId: string,
): T[] => matchs.filter((m) => m.bien.id === bienId && !m.bien.marche
  && (STATUTS_COMPATIBLES as readonly string[]).includes(m.suivi?.statut ?? 'suggested'))

/** Un acquéreur compatible : ce que le fil sait d'un match, ou ce qu'une fiche en lit. */
```

Dans `src/components/matching-fil/filQuiPour.ts`, remplacer :

```ts
  const motif = cleMotif(s.motif)
  return motif ? { cle: 'refuse', motif } : { cle: 'refuseSansMotif' }
}
```

par :

```ts
  const motif = cleMotif(s.motif)
  return motif ? { cle: 'refuse', motif } : { cle: 'refuseSansMotif' }
}

/**
 * Où « Ouvrir » mène un compatible depuis une fiche : la requête de sa place dans le fil (`lienPlace`), ou `null` s'il
 * n'en a pas — une ligne sans place ne mène nulle part (conception de D1, §6). Un bien qui n'est plus une OCCASION (le
 * mot du copilote WhatsApp) n'a plus de ligne à proposer : une annonce retirée du marché, que la ligne « Marché » écarte ;
 * un mandat qui n'est plus en vente, qu'« À proposer » écarte (lot E1, décision 12a). Ses compatibles à proposer —
 * revenus et reportés compris — ne mènent donc nulle part ; un proposé ou un intéressé garde sa place, « Retours de … »
 * et « À conclure » gardant le bien. Le report se juge par la règle même qui écrit « Reporté jusqu'au … »
 * (`etatCompatible`) : libellé et absence d'« Ouvrir » ne peuvent pas se contredire.
 */
export function lienCompatible(m: Compatible, bien: { marche: boolean; occasion: boolean }, maintenant: number): string | null {
  const statut = m.suivi?.statut ?? 'suggested'
  if (!bien.occasion && statut === 'suggested') return null
  const reporte = etatCompatible(m, maintenant).cle === 'reporte'
  return lienPlace({ id: m.id, statut, contactId: m.acheteur.id, marche: bien.marche, reporte })
}
```

- [ ] **Étape 3 : Le panneau du fil lit la règle des fiches**

Le panneau ne s'ouvre que sur un mandat en vente (tâche 2 : un mandat hors vente n'a plus d'en-tête dans « À proposer ») : `compatiblesDuFil` n'a pas à lire l'état du bien. Les acheteurs déjà en deal restent dans le panneau du fil, que la fiche écarte (conception §10, en attente).

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
import { construireCorrections, filtrerCorrections, type Correction, type CorrectionChangement } from './filApprendre'
import { aUnSignal } from './filSignaux'
```

par :

```tsx
import { construireCorrections, filtrerCorrections, type Correction, type CorrectionChangement } from './filApprendre'
import { compatiblesDuFil } from './filQuiPour'
import { aUnSignal } from './filSignaux'
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
  // Ses acquéreurs compatibles : ses matchs que le fil connaît, à proposer (reportés compris) et de la boucle.
  const compatibles = useMemo(
    () => (bienQuiPour ? [...visibles, ...visiblesBoucle].filter((m) => m.bien.id === bienQuiPour && !m.bien.marche) : []),
    [bienQuiPour, visibles, visiblesBoucle],
  )
```

par :

```tsx
  // Ses acquéreurs compatibles (lot E1, décision 13a) : ses matchs que le fil connaît, comptés comme sur les fiches
  // (`STATUTS_COMPATIBLES`) — à proposer (reportés et revenus compris), proposés, intéressés, en visite. Ses refus, que la
  // boucle porte pour « Apprendre », sortent du compte et de la liste.
  const compatibles = useMemo(
    () => (bienQuiPour ? compatiblesDuFil([...visibles, ...visiblesBoucle], bienQuiPour) : []),
    [bienQuiPour, visibles, visiblesBoucle],
  )
```

Dans `src/components/matching-fil/FilQuiPourCeBien.tsx`, remplacer :

```tsx
  /** Ses matchs connus du fil : à proposer, reportés, et ceux de la boucle. */
  compatibles: FilMatch[]
```

par :

```tsx
  /**
   * Ses acquéreurs compatibles connus du fil (`compatiblesDuFil`) : à proposer, reportés, revenus, proposés, intéressés,
   * en visite — pas ses refus, comme sur les fiches.
   */
  compatibles: FilMatch[]
```

- [ ] **Étape 4 : La fiche d'un mandat qui n'est plus en vente**

`QuiPourFiche` reçoit `horsVente` à côté de `retiree` : deux situations, deux textes, une même conséquence (`occasion: !retiree && !horsVente`). La fiche d'un mandat lit l'état qu'elle a déjà chargé ; aucune requête n'est ajoutée. Aucun littéral de style : la ligne reprend le style `aide` de la ligne de l'annonce retirée.

Dans `src/components/matching-fil/QuiPourFiche.tsx`, remplacer :

```tsx
/**
 * « Qui pour ce bien ? » sur une fiche (lot D1, conception §7) : la lecture CIBLÉE des matchs du bien
 * (`useQuiPourCeBien`), ses états de lecture, et les listes partagées avec le fil (`QuiPourCeBien`). « Ouvrir » mène à la
 * place du match dans le fil (`lienPlace`) ; la fiche fait la navigation.
 *
 * ⚠ Une ligne sans place ne mène nulle part (conception §6, la règle de « Sa boucle ») : un match REPORTÉ est hors de
 * l'ordre du fil, et un compatible À PROPOSER sur une annonce RETIRÉE n'est dans aucune ligne « Marché » — le fil écarte
 * les annonces retirées (`ml.status is distinct from 'removed'`). « Ouvrir » mènerait alors à une ligne où ce bien n'est
 * pas. Un bien proposé ou intéressé garde sa place : « Retours de … » et « À conclure » ne filtrent pas l'annonce.
 */
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { useQuiPourCeBien } from '@/hooks/useQuiPourCeBien'
import { lienPlace } from './filLiens'
import { etatCompatible } from './filQuiPour'
import { FilBouton } from './filAtomes'
import QuiPourCeBien from './QuiPourCeBien'
```

par :

```tsx
/**
 * « Qui pour ce bien ? » sur une fiche (lot D1, conception §7) : la lecture CIBLÉE des matchs du bien
 * (`useQuiPourCeBien`), ses états de lecture, et les listes partagées avec le fil (`QuiPourCeBien`). « Ouvrir » mène à la
 * place du match dans le fil (`lienCompatible`, sur `lienPlace`) ; la fiche fait la navigation.
 *
 * ⚠ Une ligne sans place ne mène nulle part (conception §6, la règle de « Sa boucle ») : un match REPORTÉ est hors de
 * l'ordre du fil, et un compatible À PROPOSER sur une annonce RETIRÉE n'est dans aucune ligne « Marché » — le fil écarte
 * les annonces retirées (`ml.status is distinct from 'removed'`). « Ouvrir » mènerait alors à une ligne où ce bien n'est
 * pas. Un bien proposé ou intéressé garde sa place : « Retours de … » et « À conclure » ne filtrent pas l'annonce.
 * ⚠ Lot E1 (décision 12a) : même règle pour un mandat qui n'est plus en vente — « À proposer » l'écarte (`horsVente`),
 * « Retours de … » et « À conclure » le gardent. Les deux cas passent par `lienCompatible` (filQuiPour.ts).
 */
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { useQuiPourCeBien } from '@/hooks/useQuiPourCeBien'
import { lienCompatible } from './filQuiPour'
import { FilBouton } from './filAtomes'
import QuiPourCeBien from './QuiPourCeBien'
```

Dans `src/components/matching-fil/QuiPourFiche.tsx`, remplacer :

```tsx
  /** L'annonce du marché est retirée (`removed`) : un compatible à proposer n'a plus de place dans le fil. */
  retiree?: boolean
  /** Les acheteurs à ne pas lister : déjà en deal sur ce bien, la fiche les montre ailleurs. */
  exclure?: ReadonlySet<string>
  onOuvrirFil: (requete: string) => void
  onVoirContact: (contactId: string) => void
}

export default function QuiPourFiche({
  sp, genre, bienId, location, avecAnciens, retiree = false, exclure, onOuvrirFil, onVoirContact,
}: Props) {
```

par :

```tsx
  /** L'annonce du marché est retirée (`removed`) : un compatible à proposer n'a plus de place dans le fil. */
  retiree?: boolean
  /**
   * Lot E1 (décision 12a) : le mandat n'est plus en vente — il n'est pas `active`, la règle du fil (`enVente`). Un
   * compatible à proposer n'a plus de place dans le fil, comme sur une annonce retirée.
   */
  horsVente?: boolean
  /** Les acheteurs à ne pas lister : déjà en deal sur ce bien, la fiche les montre ailleurs. */
  exclure?: ReadonlySet<string>
  onOuvrirFil: (requete: string) => void
  onVoirContact: (contactId: string) => void
}

export default function QuiPourFiche({
  sp, genre, bienId, location, avecAnciens, retiree = false, horsVente = false, exclure, onOuvrirFil, onVoirContact,
}: Props) {
```

Dans `src/components/matching-fil/QuiPourFiche.tsx`, remplacer :

```tsx
        ouvrir={(m) => {
          const statut = m.suivi?.statut ?? 'suggested'
          if (retiree && statut === 'suggested') return null
          // Le report se juge par la règle même qui écrit « Reporté jusqu'au … » : libellé et absence d'« Ouvrir »
          // ne peuvent pas se contredire.
          const reporte = etatCompatible(m, q.chargeLe).cle === 'reporte'
          const requete = lienPlace({ id: m.id, statut, contactId: m.acheteur.id, marche: genre === 'annonce', reporte })
          return requete ? () => onOuvrirFil(requete) : null
        }}
```

par :

```tsx
        ouvrir={(m) => {
          const requete = lienCompatible(m, { marche: genre === 'annonce', occasion: !retiree && !horsVente }, q.chargeLe)
          return requete ? () => onOuvrirFil(requete) : null
        }}
```

Dans `src/components/matching-fil/QuiPourFiche.tsx`, remplacer :

```tsx
      {/* Retirée, ses acquéreurs à proposer perdent « Ouvrir » : la ligne dit pourquoi, sinon l'absence du geste se
          lirait comme une panne. */}
      {retiree && <p style={aide}>{t('fil.quiPour.retiree')}</p>}
      {corps}
```

par :

```tsx
      {/* Retirée ou hors vente, ses acquéreurs à proposer perdent « Ouvrir » : la ligne dit pourquoi, sinon l'absence du
          geste se lirait comme une panne. */}
      {retiree && <p style={aide}>{t('fil.quiPour.retiree')}</p>}
      {horsVente && <p style={aide}>{t('fil.quiPour.horsVente')}</p>}
      {corps}
```

Dans `src/pages/agent/ListingDetailPage.tsx`, remplacer :

```tsx
                  {/* Anciens prospects : un mandat ACTIF seulement. Le moteur ne note que lui (sur un brouillon, un
                      bien réservé, vendu ou archivé, l'appel partait pour un 404), et on ne propose pas un bien vendu. */}
                  <QuiPourFiche sp={sp} genre="mandat" bienId={id ?? null} location={bien.transaction_type === 'rent'}
                    avecAnciens={bien.status === 'active'} exclure={enDeal}
```

par :

```tsx
                  {/* Anciens prospects : un mandat ACTIF seulement. Le moteur ne note que lui (sur un brouillon, un
                      bien réservé, vendu ou archivé, l'appel partait pour un 404), et on ne propose pas un bien vendu.
                      Hors vente (lot E1, décision 12a : la règle du fil), ses acquéreurs à proposer n'ont plus de ligne
                      dans le fil : ils perdent « Ouvrir », et le bloc dit pourquoi. */}
                  <QuiPourFiche sp={sp} genre="mandat" bienId={id ?? null} location={bien.transaction_type === 'rent'}
                    avecAnciens={bien.status === 'active'} horsVente={bien.status !== 'active'} exclure={enDeal}
```

La clé neuve suit `retiree`, au ton de ses deux voisines ; même second membre que la ligne de l'annonce retirée, dans chaque langue.

Dans `src/i18n/locales/fr/matching.json`, remplacer :

```json
      "retiree": "Annonce retirée du marché : on ne peut plus la proposer à ses acquéreurs."
    }
```

par :

```json
      "retiree": "Annonce retirée du marché : on ne peut plus la proposer à ses acquéreurs.",
      "horsVente": "Ce bien n'est plus disponible : on ne peut plus le proposer à ses acquéreurs."
    }
```

Dans `src/i18n/locales/de/matching.json`, remplacer :

```json
      "retiree": "Inserat vom Markt zurückgezogen: Es wird seinen Käufern nicht mehr vorgeschlagen."
    }
```

par :

```json
      "retiree": "Inserat vom Markt zurückgezogen: Es wird seinen Käufern nicht mehr vorgeschlagen.",
      "horsVente": "Objekt nicht mehr verfügbar: Es wird seinen Käufern nicht mehr vorgeschlagen."
    }
```

Dans `src/i18n/locales/en/matching.json`, remplacer :

```json
      "retiree": "Listing withdrawn from the market: it is no longer proposed to its buyers."
    }
```

par :

```json
      "retiree": "Listing withdrawn from the market: it is no longer proposed to its buyers.",
      "horsVente": "Property no longer available: it is no longer proposed to its buyers."
    }
```

Dans `src/i18n/locales/it/matching.json`, remplacer :

```json
      "retiree": "Annuncio ritirato dal mercato: non viene più proposto ai suoi acquirenti."
    }
```

par :

```json
      "retiree": "Annuncio ritirato dal mercato: non viene più proposto ai suoi acquirenti.",
      "horsVente": "Immobile non più disponibile: non viene più proposto ai suoi acquirenti."
    }
```

- [ ] **Étape 5 : Lancer le test**

```bash
npx vitest run tests/unit/fiche-qui-pour.spec.ts
```

Attendu : PASS, `Test Files  1 passed (1)`, `Tests  21 passed (21)`.

- [ ] **Étape 6 : Vérifier**

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx eslint --quiet src/components/matching-fil/filQuiPour.ts src/components/matching-fil/QuiPourFiche.tsx src/components/matching-fil/MatchingFil.tsx src/components/matching-fil/FilQuiPourCeBien.tsx src/pages/agent/ListingDetailPage.tsx tests/unit/fiche-qui-pour.spec.ts
```

Attendu : aucune sortie.

```bash
npm run lint:deadcode
npm run lint:i18n
npm run i18n:parity:ci
npm run i18n:coverage:ci
npm run lint:prose
```

Attendu : `✓ Aucun export mort` (`compatiblesDuFil` est lu par `MatchingFil`, `lienCompatible` par `QuiPourFiche`) ; `✓ i18n garde-fou OK` ; parité `0 manquante(s), 0 orpheline(s)` (les « possiblement non traduites » restent 1 860) ; couverture `✓ Aucune régression vs référence` (`matching` passe de 789 à 790 clés, toujours 2 non traduites) ; `✓ Typographie MEGGA OK — 56 fichiers i18n, 0 tell.`

Les gardes de la grammaire et de la sortie vers l'acheteur (aucun littéral de style, aucune sortie ajoutés) :

```bash
npx vitest run tests/unit/megga-x-grammar.spec.ts tests/unit/matching-sans-sortie.spec.ts
```

Attendu : PASS, `Test Files  2 passed (2)`, `Tests  51 passed (51)`.

Les specs qui chargent ou lisent un fichier touché :

```bash
npx vitest run tests/unit/fiche-qui-pour.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/whatsapp-matching-fil.spec.ts tests/unit/fil-liens-arrivee.spec.ts tests/unit/matching-du-jour.spec.ts tests/unit/matching-fil-apprendre.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-signaux.spec.ts tests/unit/matching-whatsapp-sql.spec.ts tests/unit/megga-x-crm-tokens.spec.ts tests/unit/mrh-bouge.spec.tsx tests/unit/sa-boucle.spec.ts tests/unit/bien-palette.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/matching-contraste.spec.ts tests/unit/banc-matching-d1.spec.ts tests/unit/i18n-listes.spec.ts tests/unit/polices-domaines.spec.ts tests/unit/redirection-ouverte.spec.ts tests/unit/statut-clair.spec.ts tests/unit/etat-vide.spec.ts supabase/functions/_shared/whatsapp-matching.test.ts supabase/functions/_shared/whatsapp-matching-outils.test.ts
```

Attendu : PASS, `Test Files  25 passed (25)`, `Tests  736 passed (736)`. Le banc `/dev/crm` ne change pas : ses deux refus (m14, m16) portent sur des annonces du marché, que le panneau d'un mandat ne lit pas, et ses mandats comme le bien de `/dev/biens` sont `active`.

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint` en parallèle) :

```bash
npx vitest run
```

Attendu : 339 fichiers verts sur 342 ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`.

---

## Tâche 4 : « Sa boucle » et les biens revenus (décisions 10a et 12a)

« Sa boucle » (fiche contact, `construireSaBoucle`, `saBoucle.ts`) compte ses « Proposés » sur toute sa liste (`proposes: biens.length`) : un bien revenu — refusé pour le prix, redevenu `suggested` par une baisse — y comptait, alors que le fil ne le compte pas dans « Déjà proposé » (`compterHistorique`, `filModele.ts` : `sent`, `interested`, `rejected`, `visit_planned`). Décision 10a de Julien (conception §5.5) : un bien revenu n'est plus compté parmi les « Proposés » ; il reste dans la liste, et « à traiter » s'il a une place dans le fil. Depuis la tâche 2, « À proposer » ne montre plus un mandat qui n'est plus en vente, revenus compris : « Sa boucle » gardait le revenu d'un tel mandat « à traiter », avec un lien vers une ligne absente. Décision 12a (« disparaît partout ») : il est traité comme un revenu sur une annonce retirée, que `bienBoucle` écarte déjà — il reste dans la liste, sans lien ni geste attendu (`mandatsHorsVente`, à côté d'`annoncesRetirees`) ; un bien proposé, intéressé ou en visite garde ce qu'il avait, « Retours de … » et « À conclure » gardant le mandat. La règle est celle de la tâche 2 : en vente s'il est `active` et non supprimé. L'état se lit sur la jointure `property:properties(...)` de `useContactSentMatches`, que ses deux lectures (la boucle, les revenus) partagent (`COLONNES`). Pour un agent, la RLS masque déjà un mandat supprimé (jointure nulle, pas de ligne) ; un super-administrateur le lit encore (`super_admin_read_all_properties`) : la jointure lit aussi `deleted_at`, et ce mandat n'a pas de ligne non plus, comme dans le fil. Le banc `/dev/crm` n'applique pas `select`, ses lignes portent leurs jointures : celles des mandats prennent le `status` de la table (`active`), sans quoi le revenu d'Antoine (m5) perdrait sa place (`banc-matching-d1.spec.ts`). `ContactDetailPager` ne change pas : il affiche `compteurs`.

Choix à valider : le titre de la liste, « Biens proposés (N) » (`fiche.loop.transmittedCount`, sur `loop.biens.length`), compte toujours un bien revenu, que la liste montre avec sa pastille « Revenu » — une fiche qui en a un dit « 4 Proposés » en tête et « Biens proposés (5) » sur sa liste ; « non supprimé » se lit sur la jointure (`deleted_at`) : un super-administrateur ne voit plus un mandat supprimé dans « Sa boucle », comme dans le fil depuis la tâche 2.

**Fichiers :**
- Modifier (test) : `tests/unit/sa-boucle.spec.ts`
- Modifier (modèle) : `src/components/crm/contacts-pager/saBoucle.ts`
- Modifier (lecture) : `src/hooks/useContactSentMatches.ts`
- Modifier (banc) : `src/pages/dev/crmFixtures.ts`

- [ ] **Étape 1 : Écrire les tests qui échouent**

10a : l'attente existante des compteurs passe de 5 à 4 « Proposés » ; un revenu sort du compte et reste « à traiter » ; les compteurs sont confrontés à `compterHistorique`, la règle du fil. 12a : le revenu d'un mandat vendu reste dans la liste sans lien ni geste attendu ; chaque statut de mandat est confronté à `active` ; un proposé et un intéressé sur un mandat vendu gardent leur place ; un mandat supprimé qu'un super-administrateur lit encore n'a pas de ligne. La lecture : la jointure d'un mandat porte `status` et `deleted_at`. Les deux tests qui posent un bien revenu sur un mandat en vente donnent à sa jointure l'état qu'elle porte maintenant (`active`) : sans lui, le mandat ne serait plus en vente.

Dans `tests/unit/sa-boucle.spec.ts`, remplacer :

```ts
/**
 * « Sa boucle » (lot D1, conception §6) : toute la boucle, lisible — une visite planifiée a son état, un bien revenu
 * reste là, un motif n'est jamais un code brut, l'ordre ne bouge pas d'une lecture à l'autre, chaque bien mène à sa
 * place dans le fil ; un bien revenu qui n'y a pas de place — reporté, ou sur une annonce retirée — ne mène nulle part,
 * et un mandat que la RLS masque n'a pas de ligne.
 */
import { describe, expect, it } from 'vitest'
import type { SearchCriteria } from '@/types/contact'
import { construireSaBoucle, type LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'
import { cleMotif } from '@/components/matching-fil/filBoucle'
```

par :

```ts
/**
 * « Sa boucle » (lot D1, conception §6) : toute la boucle, lisible — une visite planifiée a son état, un bien revenu
 * reste là, un motif n'est jamais un code brut, l'ordre ne bouge pas d'une lecture à l'autre, chaque bien mène à sa
 * place dans le fil ; un bien revenu qui n'y a pas de place — reporté, ou sur une annonce retirée — ne mène nulle part,
 * et un mandat que la RLS masque n'a pas de ligne.
 *
 * Lot E1 : un bien revenu ne compte plus parmi les « Proposés », comme dans le fil (décision 10a) ; sur un mandat qui
 * n'est plus en vente, il ne mène plus nulle part (décision 12a) ; un mandat supprimé n'a pas de ligne, même lu par un
 * super-administrateur.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { SearchCriteria } from '@/types/contact'
import { Constants } from '@/types/database'
import { construireSaBoucle, type LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'
import { cleMotif } from '@/components/matching-fil/filBoucle'
import { compterHistorique } from '@/components/matching-fil/filModele'
```

Dans `tests/unit/sa-boucle.spec.ts`, remplacer :

```ts
  it('un bien revenu reste dans la boucle, et mène à sa ligne dans le fil', () => {
    const mandat = ligne('m5', 'suggested', {
      reaction_motif: 'prix', prix_propose: 3_450_000, property_id: 'p2', market_listing_id: null, market_listing: null,
      property: { title: 'Villa · Cologny', price: 3_200_000, transaction_type: 'sale' },
    })
```

par :

```ts
  it('un bien revenu reste dans la boucle, et mène à sa ligne dans le fil', () => {
    // La jointure d'un mandat porte son état (lot E1) : en vente, il garde sa ligne d'« À proposer ».
    const mandat = ligne('m5', 'suggested', {
      reaction_motif: 'prix', prix_propose: 3_450_000, property_id: 'p2', market_listing_id: null, market_listing: null,
      property: { title: 'Villa · Cologny', price: 3_200_000, transaction_type: 'sale', status: 'active' },
    })
```

Dans `tests/unit/sa-boucle.spec.ts`, remplacer :

```ts
    const mandat = (snoozed_until: string) => ligne('m5', 'suggested', {
      reaction_motif: 'prix', property_id: 'p2', market_listing_id: null, market_listing: null,
      property: { title: 'Villa · Cologny', price: 3_200_000, transaction_type: 'sale' }, snoozed_until,
    })
```

par :

```ts
    const mandat = (snoozed_until: string) => ligne('m5', 'suggested', {
      reaction_motif: 'prix', property_id: 'p2', market_listing_id: null, market_listing: null,
      property: { title: 'Villa · Cologny', price: 3_200_000, transaction_type: 'sale', status: 'active' }, snoozed_until,
    })
```

Dans `tests/unit/sa-boucle.spec.ts`, remplacer (l'attente que 10a change) :

```ts
  it('les compteurs : proposés, intéressés (visites comprises), pas intéressés', () => {
    const b = boucle([
      ligne('m1', 'sent'), ligne('m2', 'interested'), ligne('m3', 'visit_planned'), ligne('m4', 'rejected'),
      ligne('m5', 'suggested', { reaction_motif: 'prix' }),
    ])
    expect(b.compteurs).toEqual({ proposes: 5, interesses: 2, refuses: 1 })
    expect(b.aTraiter.map((x) => x.m.id)).toEqual(['m2', 'm5'])
  })
```

par :

```ts
  it('les compteurs : proposés, intéressés (visites comprises), pas intéressés — un bien revenu n’est pas « Proposé »', () => {
    const b = boucle([
      ligne('m1', 'sent'), ligne('m2', 'interested'), ligne('m3', 'visit_planned'), ligne('m4', 'rejected'),
      ligne('m5', 'suggested', { reaction_motif: 'prix' }),
    ])
    // Lot E1 (décision 10a) : 4, pas 5. Le bien revenu (m5) est à proposer de nouveau, et le fil ne le compte pas dans
    // « Déjà proposé » (`compterHistorique`) ; il reste dans la liste, et « à traiter ».
    expect(b.compteurs).toEqual({ proposes: 4, interesses: 2, refuses: 1 })
    expect(b.biens).toHaveLength(5)
    expect(b.aTraiter.map((x) => x.m.id)).toEqual(['m2', 'm5'])
  })
```

Les tests neufs suivent le dernier bloc du fichier.

Dans `tests/unit/sa-boucle.spec.ts`, remplacer :

```ts
    expect(cleMotif('recherche_ajustee')).toBeNull()
    expect(cleMotif(null)).toBeNull()
  })
})
```

par :

```ts
    expect(cleMotif('recherche_ajustee')).toBeNull()
    expect(cleMotif(null)).toBeNull()
  })
})

describe('lot E1 — un bien revenu n’est plus compté parmi les « Proposés » (décision 10a)', () => {
  it('il reste « à traiter » et mène à sa ligne du fil, hors du compte des « Proposés »', () => {
    const b = boucle([ligne('m1', 'sent'), ligne('m5', 'suggested', { reaction_motif: 'prix' })])
    expect(b.compteurs).toEqual({ proposes: 1, interesses: 0, refuses: 0 })
    expect(b.aTraiter.map((x) => x.m.id)).toEqual(['m5'])
    expect(b.biens.find((x) => x.m.id === 'm5')).toMatchObject({ etat: 'revenu', lien: 'ligne=marche%3Ac9&contact=c9' })
  })

  it('« Proposés » et « Intéressés » se comptent comme « Déjà proposé » dans le fil (`compterHistorique`)', () => {
    const lignes = [
      ligne('m1', 'sent'), ligne('m2', 'interested'), ligne('m3', 'visit_planned'),
      ligne('m4', 'rejected', { reaction_motif: 'prix' }), ligne('m5', 'suggested', { reaction_motif: 'prix' }),
    ]
    const { proposes, interesses } = boucle(lignes).compteurs
    const fil = compterHistorique(lignes.map((l) => ({ contact_id: ACHETEUR.id, status: l.status })))
    expect({ proposes, interesses }).toEqual(fil.get(ACHETEUR.id))
  })
})

describe('lot E1 — un bien revenu sur un mandat qui n’est plus en vente ne mène plus nulle part (décision 12a)', () => {
  // Refusé pour le prix à CHF 3'450'000, revenu par une baisse ; la jointure porte l'état du mandat.
  const surMandat = (id: string, status: string, etatMandat: string, champs: Partial<LigneBoucleContact> = {}) =>
    ligne(id, status, {
      property_id: 'p2', market_listing_id: null, market_listing: null,
      property: { title: 'Villa · Cologny', price: 3_200_000, transaction_type: 'sale', status: etatMandat }, ...champs,
    })
  const revenu = { reaction_motif: 'prix', prix_propose: 3_450_000 }

  it('vendu, son revenu reste dans la boucle, sans lien ni geste attendu : le fil ne propose plus ce mandat', () => {
    const b = boucle([surMandat('m5', 'suggested', 'sold', revenu)])
    expect(b.biens).toHaveLength(1)
    expect(b.biens[0]).toMatchObject({ etat: 'revenu', lien: null })
    expect(b.aTraiter).toEqual([])
    expect(b.compteurs).toEqual({ proposes: 0, interesses: 0, refuses: 0 })
  })

  it('seul `active` est en vente — la règle du fil et du copilote, statut par statut', () => {
    for (const etatMandat of Constants.public.Enums.property_status) {
      const b = boucle([surMandat('m5', 'suggested', etatMandat, revenu)])
      expect(b.biens[0]!.lien, etatMandat).toBe(etatMandat === 'active' ? 'ligne=m5&contact=c9' : null)
      expect(b.aTraiter.map((x) => x.m.id), etatMandat).toEqual(etatMandat === 'active' ? ['m5'] : [])
    }
  })

  it('proposé ou intéressé, un bien garde sa place — « Retours de … » et « À conclure » gardent le mandat ; une visite n’en a pas', () => {
    const b = boucle([
      surMandat('m1', 'sent', 'sold'), surMandat('m2', 'interested', 'sold'), surMandat('m3', 'visit_planned', 'sold'),
    ])
    expect(Object.fromEntries(b.biens.map((x) => [x.m.id, x.lien]))).toEqual({
      m1: 'attente=c9', m2: 'onglet=aConclure&ligne=m2&contact=c9', m3: null,
    })
    expect(b.aTraiter.map((x) => x.m.id)).toEqual(['m2'])
  })

  it('supprimé, un mandat n’a pas de ligne, même lu par un super-administrateur : le fil ne le lit pas', () => {
    const supprime = surMandat('m9', 'sent', 'active', {
      property: { title: 'Villa · Cologny', price: 3_200_000, transaction_type: 'sale', status: 'active', deleted_at: il(3) },
    })
    const b = boucle([supprime, ligne('m1', 'sent')])
    expect(b.biens.map((x) => x.m.id)).toEqual(['m1'])
    expect(b.compteurs).toEqual({ proposes: 1, interesses: 0, refuses: 0 })
  })
})

describe('lot E1 — la lecture de « Sa boucle » (`useContactSentMatches`)', () => {
  it('la jointure d’un mandat porte son état et sa suppression : sans eux, « en vente » ne se lit pas', () => {
    const source = readFileSync(join(process.cwd(), 'src/hooks/useContactSentMatches.ts'), 'utf8')
    const colonnes = /property:properties\(([^)]*)\)/.exec(source)?.[1]?.split(',').map((c) => c.trim()) ?? []
    expect(colonnes).toEqual(expect.arrayContaining(['status', 'deleted_at']))
  })
})
```

```bash
npx vitest run tests/unit/sa-boucle.spec.ts
```

Attendu : ÉCHEC, `Tests  7 failed | 15 passed (22)` : les compteurs, `expected { proposes: 5, interesses: 2, …(1) } to deeply equal { proposes: 4, interesses: 2, …(1) }` ; le revenu hors du compte, `expected { proposes: 2, interesses: +0, …(1) } to deeply equal { proposes: 1, interesses: +0, …(1) }` ; la confrontation au fil, `expected { proposes: 5, interesses: 2 } to deeply equal { proposes: 4, interesses: 2 }` ; le mandat vendu, `expected { …(3) } to match object { etat: 'revenu', lien: null }` ; statut par statut, `draft: expected 'ligne=m5&contact=c9' to be null` ; le mandat supprimé, `expected [ 'm1', 'm9' ] to deeply equal [ 'm1' ]` ; la lecture, `expected [ 'title', 'address', 'city', …(8) ] to deeply equal { Object ($$typeof, sample, ...) }`. Le test qui garde ce qui ne doit PAS bouger — un proposé et un intéressé sur un mandat vendu gardent leur place — passe déjà : aucune règle de `bienBoucle` ne lit le bien d'un match de la boucle.

- [ ] **Étape 2 : Le modèle : un revenu hors des « Proposés », et sans lien sur un mandat qui n'est plus en vente**

`mandatsHorsVente` se remplit comme `annoncesRetirees`, sur la jointure de la ligne, et `bienBoucle` les lit ensemble : un revenu dessus garde sa ligne, sans lien — donc hors d'« À traiter », qui ne retient qu'un revenu qui a un lien. Un mandat supprimé ne va pas jusque-là : `versMatch` ne rend pas sa ligne, comme quand la RLS le masque.

Dans `src/components/crm/contacts-pager/saBoucle.ts`, remplacer :

```ts
 * ⚠ Un mandat SUPPRIMÉ n'a pas de ligne : la RLS le masque, sa jointure revient nulle, et le fil jette ces matchs
 * (`useMatchingFil`). Gardé, il s'affichait sans nom, avec un lien vers une place où le fil ne le porte pas.
```

par :

```ts
 * ⚠ Un mandat SUPPRIMÉ n'a pas de ligne : la RLS le masque, sa jointure revient nulle, et le fil jette ces matchs
 * (`useMatchingFil`). Gardé, il s'affichait sans nom, avec un lien vers une place où le fil ne le porte pas. Un
 * super-administrateur le lit encore (`super_admin_read_all_properties`) : sa jointure dit `deleted_at`, et il n'a pas
 * de ligne non plus — le fil ne lit pas un mandat supprimé (lot E1).
```

Dans `src/components/crm/contacts-pager/saBoucle.ts`, remplacer :

```ts
 * ⚠ Ni un bien revenu sur une annonce du marché RETIRÉE (`removed`, lu sur sa jointure) : une annonce retirée n'est plus
 * une occasion, et la ligne « Marché » du fil l'exclut. Même règle que `matching_actions_du_jour` pour l'annonce retirée
 * SEULEMENT : cette RPC écarte aussi le revenu sur un mandat vendu ou retiré, que la fiche GARDE, parce que le fil garde
 * ces mandats (sa lecture ne filtre pas leur statut). Un bien proposé ou intéressé sur une annonce retirée garde sa
 * place : « Retours de … » et « À conclure » ne filtrent pas l'annonce.
```

par :

```ts
 * ⚠ Ni un bien revenu qui n'est plus une OCCASION, son état lu sur sa jointure : une annonce du marché RETIRÉE
 * (`removed`), que la ligne « Marché » du fil exclut ; un mandat qui n'est plus EN VENTE (lot E1, décision 12a : il
 * n'est pas `active`, la règle du fil et du copilote WhatsApp), qu'« À proposer » exclut. La règle de
 * `matching_actions_du_jour`, qui écarte le revenu sur l'un et l'autre. Un bien proposé ou intéressé garde sa place :
 * « Retours de … » et « À conclure » ne filtrent ni l'annonce ni le mandat.
 * ⚠ Un bien revenu ne compte pas parmi les « Proposés » (lot E1, décision 10a) : il est à proposer de nouveau, et le fil
 * ne le compte pas non plus (« Déjà proposé », `compterHistorique`). Il reste « à traiter » s'il a une place.
```

Dans `src/components/crm/contacts-pager/saBoucle.ts`, remplacer :

```ts
  /** Celui d'une annonce du marché (`removed` : retirée) ; la jointure d'un mandat ne le lit pas. */
  status?: string | null
}
```

par :

```ts
  /** Celui d'une annonce du marché (`removed` : retirée) ou d'un mandat (`active` : en vente, lot E1). */
  status?: string | null
  /** Celui d'un mandat : un super-administrateur lit encore un mandat supprimé, pas un agent (lot E1). */
  deleted_at?: string | null
}
```

Dans `src/components/crm/contacts-pager/saBoucle.ts`, remplacer :

```ts
  /**
   * Ce qui attend un geste de l'agent : les intéressés, puis les biens revenus qui ont une place dans le fil — un revenu
   * reporté n'attend rien avant son retour, l'agent l'a lui-même remis à plus tard ; un revenu sur une annonce retirée
   * n'est plus une occasion.
   */
  aTraiter: BienBoucle[]
  /** Les corrections de recherche en attente (« Apprendre »), et où les ouvrir. */
  corrections: { c: Correction; lien: string }[]
  compteurs: { proposes: number; interesses: number; refuses: number }
}
```

par :

```ts
  /**
   * Ce qui attend un geste de l'agent : les intéressés, puis les biens revenus qui ont une place dans le fil — un revenu
   * reporté n'attend rien avant son retour, l'agent l'a lui-même remis à plus tard ; un revenu sur une annonce retirée ou
   * sur un mandat qui n'est plus en vente n'est plus une occasion.
   */
  aTraiter: BienBoucle[]
  /** Les corrections de recherche en attente (« Apprendre »), et où les ouvrir. */
  corrections: { c: Correction; lien: string }[]
  /**
   * L'en-tête : les biens proposés, dont les intéressés (visites comprises) et les refusés — comptés comme « Déjà
   * proposé » dans le fil (`compterHistorique`). Un bien revenu n'en est pas (lot E1, décision 10a) : il est à proposer
   * de nouveau.
   */
  compteurs: { proposes: number; interesses: number; refuses: number }
}
```

Dans `src/components/crm/contacts-pager/saBoucle.ts`, remplacer :

```ts
/** Un match de la fiche, dans la forme du fil ; `null` sans bien — un mandat que la RLS masque n'en a pas. */
function versMatch(l: LigneBoucleContact, acheteur: FilMatch['acheteur'], criteres: SearchCriteria | null): FilMatch | null {
  const bienId = l.property_id ?? l.market_listing_id
  if (!bienId) return null
  // Un mandat supprimé revient sans jointure : `properties_select_agency` exige `deleted_at is null`. La règle du fil :
  // on n'invente pas la ligne. Un mandat seulement — la RLS ne masque jamais une annonce du marché.
  if (l.property_id != null && premiere(l.property) == null) return null
  const marche = l.property_id == null
  const b = premiere(l.property) ?? premiere(l.market_listing)
```

par :

```ts
/** Un match de la fiche, dans la forme du fil ; `null` sans bien — un mandat masqué par la RLS, ou supprimé, n'en a pas. */
function versMatch(l: LigneBoucleContact, acheteur: FilMatch['acheteur'], criteres: SearchCriteria | null): FilMatch | null {
  const bienId = l.property_id ?? l.market_listing_id
  if (!bienId) return null
  // Un mandat supprimé revient sans jointure : `properties_select_agency` exige `deleted_at is null`. La règle du fil :
  // on n'invente pas la ligne. Un mandat seulement — la RLS ne masque jamais une annonce du marché. Un
  // super-administrateur le lit encore, sa jointure le dit (`deleted_at`) : pas de ligne non plus.
  const mandat = premiere(l.property)
  if (l.property_id != null && (mandat == null || mandat.deleted_at != null)) return null
  const marche = l.property_id == null
  const b = mandat ?? premiere(l.market_listing)
```

Dans `src/components/crm/contacts-pager/saBoucle.ts`, remplacer :

```ts
function bienBoucle(m: FilMatch, maintenant: number, annoncesRetirees: ReadonlySet<string>): BienBoucle | null {
  const s = m.suivi
  const etat = s ? ETATS[s.statut] : undefined
  if (!s || !etat) return null
  if (etat === 'revenu' && s.prixPropose == null && s.motif == null) return null
  // Une annonce retirée n'est plus une occasion, et la ligne « Marché » du fil l'exclut : un revenu dessus n'a plus de
  // place ; les autres statuts gardent la leur. Même règle que `matching_actions_du_jour` pour l'annonce retirée
  // SEULEMENT — cette RPC écarte aussi un mandat vendu ou retiré, que le fil garde, donc la fiche aussi.
  if (etat === 'revenu' && annoncesRetirees.has(m.bien.id)) return { m, etat, lien: null }
```

par :

```ts
function bienBoucle(
  m: FilMatch, maintenant: number, annoncesRetirees: ReadonlySet<string>, mandatsHorsVente: ReadonlySet<string>,
): BienBoucle | null {
  const s = m.suivi
  const etat = s ? ETATS[s.statut] : undefined
  if (!s || !etat) return null
  if (etat === 'revenu' && s.prixPropose == null && s.motif == null) return null
  // Un bien qui n'est plus une occasion — une annonce retirée, que la ligne « Marché » du fil exclut ; un mandat qui
  // n'est plus en vente, qu'« À proposer » exclut (lot E1, décision 12a) — n'a plus de place pour un revenu ; les autres
  // statuts gardent la leur. La règle de `matching_actions_du_jour`, qui écarte le revenu sur l'un et l'autre.
  if (etat === 'revenu' && (annoncesRetirees.has(m.bien.id) || mandatsHorsVente.has(m.bien.id))) {
    return { m, etat, lien: null }
  }
```

Dans `src/components/crm/contacts-pager/saBoucle.ts`, remplacer :

```ts
  // Les annonces du marché retirées, lues sur la jointure de leur match : un revenu dessus n'a plus de place (`bienBoucle`).
  const annoncesRetirees = new Set<string>()
  for (const l of lignes) {
    if (vus.has(l.id)) continue
    vus.add(l.id)
    const m = versMatch(l, acheteur, l.client_search_id ? criteres.get(l.client_search_id) ?? null : null)
    if (!m) continue
    matchs.push(m)
    if (m.bien.marche && premiere(l.market_listing)?.status === 'removed') annoncesRetirees.add(m.bien.id)
  }
  const biens = matchs
    .flatMap((m) => { const b = bienBoucle(m, maintenant, annoncesRetirees); return b ? [b] : [] })
    .sort((a, b) => temps(b.m.suivi?.proposeLe ?? null) - temps(a.m.suivi?.proposeLe ?? null) || a.m.id.localeCompare(b.m.id))
  return {
    biens,
    aTraiter: [...biens.filter((b) => b.etat === 'interesse'), ...biens.filter((b) => b.etat === 'revenu' && b.lien != null)],
    corrections: construireCorrections(matchs).map((c) => ({ c, lien: lienFil({ ligne: c.cle, contact: acheteur.id }) })),
    compteurs: {
      proposes: biens.length,
```

par :

```ts
  // Les annonces du marché retirées, lues sur la jointure de leur match : un revenu dessus n'a plus de place (`bienBoucle`).
  const annoncesRetirees = new Set<string>()
  // Lot E1 (décision 12a) : les mandats qui ne sont plus en vente, lus de même — en vente s'il est `active`, la règle
  // du fil (`versBien`) et du copilote WhatsApp (`occasion`). Un mandat supprimé n'a déjà plus de ligne (`versMatch`).
  const mandatsHorsVente = new Set<string>()
  for (const l of lignes) {
    if (vus.has(l.id)) continue
    vus.add(l.id)
    const m = versMatch(l, acheteur, l.client_search_id ? criteres.get(l.client_search_id) ?? null : null)
    if (!m) continue
    matchs.push(m)
    if (m.bien.marche && premiere(l.market_listing)?.status === 'removed') annoncesRetirees.add(m.bien.id)
    if (!m.bien.marche && premiere(l.property)?.status !== 'active') mandatsHorsVente.add(m.bien.id)
  }
  const biens = matchs
    .flatMap((m) => { const b = bienBoucle(m, maintenant, annoncesRetirees, mandatsHorsVente); return b ? [b] : [] })
    .sort((a, b) => temps(b.m.suivi?.proposeLe ?? null) - temps(a.m.suivi?.proposeLe ?? null) || a.m.id.localeCompare(b.m.id))
  return {
    biens,
    aTraiter: [...biens.filter((b) => b.etat === 'interesse'), ...biens.filter((b) => b.etat === 'revenu' && b.lien != null)],
    corrections: construireCorrections(matchs).map((c) => ({ c, lien: lienFil({ ligne: c.cle, contact: acheteur.id }) })),
    compteurs: {
      // Un bien revenu est à proposer de nouveau, pas « proposé » (lot E1, décision 10a) : la règle du fil.
      proposes: biens.filter((b) => b.etat !== 'revenu').length,
```

- [ ] **Étape 3 : La lecture : l'état et la suppression du mandat sur sa jointure**

Une seule constante, `COLONNES`, sert les deux lectures (la boucle et les revenus) : les deux lisent l'état du mandat.

Dans `src/hooks/useContactSentMatches.ts`, remplacer :

```ts
const STATUTS_BOUCLE = ['sent', 'interested', 'rejected', 'visit_planned']
/** Le match et son bien, colonnes légères (§7 de CLAUDE.md) ; le `status` d'une annonce dit qu'elle est retirée (`saBoucle`). */
const COLONNES = 'id, status, score, sent_at, response_at, reaction_motif, reaction_note, prix_propose, apprentissage_at,'
  + ' client_search_id, snoozed_until, property_id, market_listing_id,'
  + ' property:properties(title, address, city, canton, price, rooms, surface_m2, photos, type, transaction_type, features),'
```

par :

```ts
const STATUTS_BOUCLE = ['sent', 'interested', 'rejected', 'visit_planned']
/**
 * Le match et son bien, colonnes légères (§7 de CLAUDE.md) ; le `status` d'un bien dit s'il est encore une occasion —
 * une annonce retirée, un mandat qui n'est plus en vente (lot E1) —, et `deleted_at` qu'un mandat est supprimé, ce que
 * seul un super-administrateur lit encore (`saBoucle`). Les deux lectures partagent ces colonnes.
 */
const COLONNES = 'id, status, score, sent_at, response_at, reaction_motif, reaction_note, prix_propose, apprentissage_at,'
  + ' client_search_id, snoozed_until, property_id, market_listing_id,'
  + ' property:properties(title, address, city, canton, price, rooms, surface_m2, photos, type, transaction_type, features, status, deleted_at),'
```

- [ ] **Étape 4 : Lancer les tests, banc compris**

```bash
npx vitest run tests/unit/sa-boucle.spec.ts tests/unit/banc-matching-d1.spec.ts
```

Attendu : `Test Files  1 failed | 1 passed (2)`, `Tests  1 failed | 28 passed (29)` : `sa-boucle.spec.ts` passe (22 tests) ; dans `banc-matching-d1.spec.ts`, `« Sa boucle » d’Antoine garde son bien revenu` échoue, `expected { …(3) } to match object { etat: 'revenu', …(1) }`. Le banc n'applique pas `select` : la jointure que porte la ligne de m5 (`COLOGNY_EMBARQUE`) n'a pas de `status`, et son mandat n'est plus en vente pour « Sa boucle ».

- [ ] **Étape 5 : Le banc porte l'état de ses mandats**

Les quatre jointures `property` des matchs du banc (Champel, Cologny, Florissant et le loft `pb32` d'Emma) prennent le `status` de leur ligne dans `properties` : `active`, les quatre.

Dans `src/pages/dev/crmFixtures.ts`, remplacer :

```ts
/** Les jointures `property` des matchs — le banc n'applique pas `select`, la ligne les porte. */
const CHAMPEL_EMBARQUE = {
  title: 'Appartement 4,5 pièces · Champel', price: 1_450_000, address: 'Avenue de Champel 12',
  city: 'Genève', canton: 'GE', postal_code: '1206', rooms: 4.5, bedrooms: 3, surface_m2: 118,
  photos: [PHOTO.champel], type: 'apartment', description: 'Lumineux, traversant, deux balcons.',
  features: ['Balcon', 'Ascenseur'], floor: 4, year_built: 1968, charges_monthly: 420,
}
const COLOGNY_EMBARQUE = {
  title: 'Villa individuelle · Cologny', price: 3_200_000, address: 'Chemin de Ruth 8',
  city: 'Cologny', canton: 'GE', postal_code: '1223', rooms: 7, bedrooms: 5, surface_m2: 260,
  photos: [PHOTO.cologny], type: 'house', description: 'Villa contemporaine avec piscine, jardin arboré de 1 200 m² et vue sur le lac.',
  features: ['Piscine', 'Jardin', 'Garage double', 'Vue lac'], floor: null, year_built: 2011, charges_monthly: null,
}
```

par :

```ts
/**
 * Les jointures `property` des matchs — le banc n'applique pas `select`, la ligne les porte. Leur `status` est celui de
 * la table : « Sa boucle » le lit, et un mandat qui ne l'aurait pas n'y serait plus en vente (lot E1).
 */
const CHAMPEL_EMBARQUE = {
  title: 'Appartement 4,5 pièces · Champel', price: 1_450_000, address: 'Avenue de Champel 12',
  city: 'Genève', canton: 'GE', postal_code: '1206', rooms: 4.5, bedrooms: 3, surface_m2: 118,
  photos: [PHOTO.champel], type: 'apartment', description: 'Lumineux, traversant, deux balcons.',
  features: ['Balcon', 'Ascenseur'], floor: 4, year_built: 1968, charges_monthly: 420, status: 'active',
}
const COLOGNY_EMBARQUE = {
  title: 'Villa individuelle · Cologny', price: 3_200_000, address: 'Chemin de Ruth 8',
  city: 'Cologny', canton: 'GE', postal_code: '1223', rooms: 7, bedrooms: 5, surface_m2: 260,
  photos: [PHOTO.cologny], type: 'house', description: 'Villa contemporaine avec piscine, jardin arboré de 1 200 m² et vue sur le lac.',
  features: ['Piscine', 'Jardin', 'Garage double', 'Vue lac'], floor: null, year_built: 2011, charges_monthly: null, status: 'active',
}
```

Dans `src/pages/dev/crmFixtures.ts`, remplacer :

```ts
  photos: [unsplash(PHOTOS_APPART[9]!)], type: 'apartment', description: 'Attique traversant, terrasse de 60 m² et vue sur le lac.',
  features: ['Terrasse', 'Ascenseur', 'Vue lac'], floor: 7, year_built: 1972, charges_monthly: 690,
}
```

par :

```ts
  photos: [unsplash(PHOTOS_APPART[9]!)], type: 'apartment', description: 'Attique traversant, terrasse de 60 m² et vue sur le lac.',
  features: ['Terrasse', 'Ascenseur', 'Vue lac'], floor: 7, year_built: 1972, charges_monthly: 690, status: 'active',
}
```

Dans `src/pages/dev/crmFixtures.ts`, remplacer :

```ts
      property: { title: 'Loft 2,5 pièces · Genève', price: 1_290_000, city: 'Genève', canton: 'GE', rooms: 2.5, surface_m2: 86, photos: [], type: 'apartment' },
```

par :

```ts
      property: { title: 'Loft 2,5 pièces · Genève', price: 1_290_000, city: 'Genève', canton: 'GE', rooms: 2.5, surface_m2: 86, photos: [], type: 'apartment', status: 'active' },
```

- [ ] **Étape 6 : Relancer les tests**

```bash
npx vitest run tests/unit/sa-boucle.spec.ts tests/unit/banc-matching-d1.spec.ts
```

Attendu : PASS, `Test Files  2 passed (2)`, `Tests  29 passed (29)`.

- [ ] **Étape 7 : Vérifier**

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx eslint --quiet src/components/crm/contacts-pager/saBoucle.ts src/hooks/useContactSentMatches.ts src/pages/dev/crmFixtures.ts tests/unit/sa-boucle.spec.ts
npm run lint:deadcode
```

Attendu : ESLint sans sortie ; `✓ Aucun export mort` (aucun export ajouté ni retiré). Aucune clé i18n ni aucun texte d'écran n'est touché : les portes i18n ne sont pas concernées.

Les specs qui chargent ou lisent un fichier touché — la fiche et ses bancs, `crmFixtures` et ses lecteurs, les gardes de la grammaire et de la sortie vers l'acheteur, et le modèle du fil dont « Sa boucle » reprend le compte :

```bash
npx vitest run tests/unit/sa-boucle.spec.ts tests/unit/banc-matching-d1.spec.ts tests/unit/banc-matching-boucle.spec.ts tests/unit/banc-matching-explique.spec.ts tests/unit/banc-contacts-roles.spec.ts tests/unit/banc-supabase.spec.ts tests/unit/contacts-contraste.spec.ts tests/unit/contacts-note-contrat.spec.ts tests/unit/dev-bancs-frontiere.spec.ts tests/unit/etat-vide.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/megga-x-crm-tokens.spec.ts tests/unit/megga-x-source-frontiere.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/redirection-ouverte.spec.ts tests/unit/calendrier-libelles.spec.ts tests/unit/poussee-dock.spec.ts tests/unit/region-fonctions.spec.ts tests/unit/stockage-inventaire.spec.ts tests/unit/matching-fil-modele.spec.ts tests/unit/fiche-qui-pour.spec.ts
```

Attendu : PASS, `Test Files  22 passed (22)`, `Tests  316 passed (316)`. Le banc `/dev/contacts` (`DEMO_FICHE_LOOP`) passe de 8 à 7 « Proposés » : son bien revenu (m5) n'y compte plus ; ses biens sont des annonces du marché, aucun mandat.

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint` en parallèle) :

```bash
npx vitest run
```

Attendu : `Test Files  3 failed | 339 passed (342)` ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`.

---

## Tâche 5 : « Planifier une visite » d'un mandat (décision 9c)

« Planifier une visite » de la fiche d'un mandat (`PlanifierVisite`, monté par `ListingDetailPage`) propose d'abord les acheteurs des deals du bien, puis ses acquéreurs compatibles (`useQuiPourCeBien`, sans les acheteurs en deal) ; un deal y compte quel que soit son état, perdu compris (`useTransactions()` filtré sur le bien) ; son dernier pas pré-remplit à TOUT visiteur un message au client, WhatsApp (`buildWaMeUrl`) et e-mail (`mailto:`) ; et la visite part par `useCreateAgentVisit`, qui ne pose pas `reminder_sent` — `visit-reminders-j1` écrit alors au client la veille — et ne touche pas au match. Le fil fait l'inverse depuis la décision de Julien du 21.09.2026 (`execPlanifierVisite` : un match « intéressé » passe `visit_planned`, le deal est rattaché ou ouvert et avance, `reminder_sent` est posé, rien ne part au client), comme le copilote WhatsApp (`wa_matching_visite`, lot D2 : la visite toujours écrite sans rappel, le match ne bouge que s'il est `interested`). Décision 9c (conception §5.6, précisions confirmées par Julien le 27.09.2026) : un acquéreur compatible reste proposé, sans aucun message pré-rempli ; sa visite suit la règle du fil — `reminder_sent`, son match en « visite planifiée » s'il est `interested`, par l'écrivain du fil, et un match `suggested` ou `sent` ne bouge pas ; le pré-remplissage reste pour un acheteur en deal OUVERT sur ce bien, et un deal perdu n'en fait pas un. Décision 12a (tâches 2 à 4) : un mandat qui n'est plus en vente (`bien.status !== 'active'`, lu par `useProperty`, qui ne lit pas un mandat supprimé) ne propose plus que ses acheteurs en deal ouvert. Les statuts d'un deal (`transactions.status`) sont `active`, `on_hold`, `cancelled` et `completed` : sont ouverts `active` et `on_hold` (suspendu, le Pipeline le garde) ; `completed` est un deal gagné (« Terminer » du bento signé), `cancelled` un deal annulé. ⚠ « Perdu » n'est pas un statut : c'est l'étape `lost`, que « Marquer perdu » du Pipeline écrit seule, le statut restant `active` — un deal ouvert se lit donc sur le statut ET l'étape. Les trois décisions (quels visiteurs, qui a droit au pré-remplissage, que fait la création) sortent du composant dans un module pur, `visiteurs.ts`, qui entre dans `matching-sans-sortie.spec.ts` ; `PlanifierVisite` les appelle, et fige à l'écriture le droit au message (relu ensuite, le deal que la visite d'un intéressé vient d'ouvrir le ferait paraître). L'écrivain du fil est réutilisé plutôt que doublé : il accepte les détails du formulaire (visio, bon de visite, point de rendez-vous, `details`) et rend la visite écrite (`visiteId`, pour « Ouvrir la visite ») ; `useCreateAgentVisit` sort sa ligne dans deux fonctions (`ligneVisite`, `detailsVisite` — la même ligne qu'avant) et gagne `reminderSent`. `onPlanned` rafraîchit aussi « Qui pour ce bien ? » (`CLE_FIL`).

Choix à valider : `on_hold` compte comme ouvert, et `archived_at` (un deal rangé hors du Pipeline, « sans le perdre ») n'est pas lu ; un visiteur hors du matching — un contact du carnet sans match compatible, un visiteur créé sur place — garde le message pré-rempli et le rappel de la veille (la conception ne retire que la sortie du matching, §3.1) ; tant que les compatibles du bien ne sont pas lus (ou si leur lecture échoue), seuls un acheteur en deal ouvert et un visiteur créé sur place ont le message et le rappel ; un acquéreur intéressé dont le match a bougé avant l'écriture (`deja`) a quand même sa visite, sans rappel, son match intact (la règle de `wa_matching_visite`) ; un acquéreur compatible choisi dans le carnet sur un mandat qui n'est plus en vente suit la même règle (« À conclure » garde ce mandat) ; l'écran d'après dit, à la place du bloc « Confirmer au visiteur » : « Rien n'est envoyé à {{prenom}}, ni confirmation ni rappel la veille. » (`fiche.visite.rienEnvoye`, quatre langues).

**Fichiers :**
- Créer (test) : `tests/unit/fiche-planifier-visite.spec.ts`
- Modifier (tests) : `tests/unit/matching-fil-gestes.spec.ts`, `tests/unit/matching-sans-sortie.spec.ts`
- Créer (règles) : `src/components/crm/biens/fiche/visiteurs.ts`
- Modifier (écrivain du fil) : `src/lib/matchingGestes.ts`
- Modifier (visite de la fiche) : `src/hooks/useVisitDetail.ts`
- Modifier (formulaire) : `src/components/crm/biens/fiche/PlanifierVisite.tsx`
- Modifier (fiche) : `src/pages/agent/ListingDetailPage.tsx`
- Modifier (i18n) : `src/i18n/locales/fr/listings.json`, `src/i18n/locales/de/listings.json`, `src/i18n/locales/en/listings.json`, `src/i18n/locales/it/listings.json`

- [ ] **Étape 1 : Écrire les tests qui échouent**

Les règles, sur trois acheteurs d'un même mandat : Marc, en deal ouvert (et compatible, intéressé) ; Paul, compatible, dont le deal sur ce bien est perdu ; Julie, compatible sans deal. Un deal ouvert, statut par statut et étape par étape ; les visiteurs proposés, en vente et hors vente ; le message pré-rempli refusé à un compatible (perdu compris), gardé pour un deal ouvert et hors du matching ; ce que fait la création, match par match ; la ligne `visits` qui porte `reminder_sent`. L'écrivain du fil : il rend la visite écrite et prend les détails de la fiche, jamais le rappel. La garde « sans sortie » lit le module neuf.

Créer `tests/unit/fiche-planifier-visite.spec.ts` :

```ts
/**
 * « Planifier une visite » depuis la fiche d'un mandat (lot E1, conception §5.6, décision 9c) : qui est proposé comme
 * visiteur, à qui un message de confirmation est préparé, ce que fait la création — la règle du fil et du copilote
 * WhatsApp (`wa_matching_visite`), une seule.
 *
 * Ce que cette spec refuse :
 *   · un message pré-rempli (WhatsApp, e-mail) ou un rappel la veille pour un acquéreur compatible — un deal perdu n'en
 *     fait pas un acheteur en cours ;
 *   · un match « intéressé » qui ne passerait pas par l'écrivain du fil, ou un match d'un autre statut qui bougerait ;
 *   · un pré-remplissage ou un rappel retirés à un acheteur en deal ouvert, ou à un visiteur hors du matching ;
 *   · un message ou un rappel préparés pour un contact dont on ne sait pas encore s'il est du matching ;
 *   · un acquéreur compatible proposé sur un mandat qui n'est plus en vente.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Constants } from '@/types/database'
import type { Compatible } from '@/components/matching-fil/filQuiPour'
import {
  creationVisite, dealOuvert, preRemplissagePermis, visiteursLies, type ContexteVisite, type DealDuBien,
} from '@/components/crm/biens/fiche/visiteurs'
import { ligneVisite, type CreateVisitInput } from '@/hooks/useVisitDetail'

type Statut = 'suggested' | 'sent' | 'interested' | 'visit_planned'

/** Un acquéreur compatible du mandat ; sans statut, une suggestion jamais proposée, qui n'a pas de suivi. */
const compatible = (contactId: string, prenom: string, score: number, statut?: Statut): Compatible => ({
  id: `m-${contactId}`, score, reporteJusquau: null, acheteur: { id: contactId, prenom, nom: 'Morand' },
  ...(statut ? {
    suivi: { statut, proposeLe: '2026-09-20T09:00:00Z', reponduLe: null, motif: null, note: null, prixPropose: null, apprisLe: null },
  } : {}),
})
const deal = (id: string, contactId: string, status: string, stage: string): DealDuBien => ({ id, contact_buyer_id: contactId, status, stage })

/**
 * Marc : en deal ouvert sur le bien, et compatible (intéressé). Paul : compatible, son deal sur ce bien est PERDU — l'étape
 * `lost`, le statut resté `active`, ce qu'écrit « Marquer perdu ». Julie : compatible, sans deal.
 */
const contexte = (julie?: Statut, enVente = true, paul: Statut = 'sent'): ContexteVisite => ({
  deals: [deal('d-marc', 'c-marc', 'active', 'offer'), deal('d-paul', 'c-paul', 'active', 'lost')],
  compatibles: [compatible('c-julie', 'Julie', 92, julie), compatible('c-marc', 'Marc', 88, 'interested'), compatible('c-paul', 'Paul', 81, paul)],
  enVente,
})
const NOMS: Record<string, string> = { 'c-marc': 'Marc Morand', 'c-paul': 'Paul Morand', 'c-julie': 'Julie Morand' }
const nomDe = (id: string): string | null => NOMS[id] ?? null

describe('un deal ouvert', () => {
  it('statut par statut : `active` et `on_hold` sont ouverts ; `completed` (gagné) et `cancelled` (annulé) ne le sont pas', () => {
    for (const status of Constants.public.Enums.transaction_status) {
      expect(dealOuvert({ status, stage: 'offer' }), status).toBe(status === 'active' || status === 'on_hold')
    }
  })

  it('un deal perdu n’en est pas un : « perdu » est l’étape `lost`, son statut reste ouvert', () => {
    for (const stage of Constants.public.Enums.transaction_stage) {
      expect(dealOuvert({ status: 'active', stage }), stage).toBe(stage !== 'lost')
      expect(dealOuvert({ status: 'on_hold', stage }), stage).toBe(stage !== 'lost')
    }
  })
})

describe('les visiteurs proposés', () => {
  it('les acheteurs en deal ouvert d’abord, puis les acquéreurs compatibles ; un deal perdu ne fait pas un acheteur en cours', () => {
    expect(visiteursLies(contexte(), nomDe)).toEqual([
      { contactId: 'c-marc', nom: 'Marc Morand', dealId: 'd-marc' },
      { contactId: 'c-julie', nom: 'Julie Morand', score: 92 },
      { contactId: 'c-paul', nom: 'Paul Morand', score: 81 },
    ])
  })

  it('un mandat qui n’est plus en vente ne propose que ses acheteurs en deal ouvert', () => {
    expect(visiteursLies(contexte(undefined, false), nomDe)).toEqual([{ contactId: 'c-marc', nom: 'Marc Morand', dealId: 'd-marc' }])
  })
})

describe('le message de confirmation pré-rempli (WhatsApp, e-mail)', () => {
  it('refusé à un acquéreur compatible sans deal, et à celui dont le deal sur ce bien est perdu', () => {
    expect(preRemplissagePermis('c-julie', contexte())).toBe(false)
    expect(preRemplissagePermis('c-paul', contexte())).toBe(false)
  })

  it('gardé pour un acheteur en deal ouvert, même compatible', () => {
    expect(preRemplissagePermis('c-marc', contexte())).toBe(true)
  })

  it('gardé pour un visiteur hors du matching : un contact du carnet, un visiteur créé sur place', () => {
    expect(preRemplissagePermis('c-carnet', contexte())).toBe(true)
    expect(preRemplissagePermis(null, contexte())).toBe(true)
  })

  it('refusé à un acquéreur compatible choisi dans le carnet, même sur un mandat qui n’est plus en vente', () => {
    expect(preRemplissagePermis('c-julie', contexte(undefined, false))).toBe(false)
  })

  it('ses compatibles pas encore lus : on ne sait pas qui est du matching, seuls un acheteur en deal ouvert et un visiteur créé sur place y ont droit', () => {
    const nonLus: ContexteVisite = { ...contexte(), compatibles: null }
    expect(preRemplissagePermis('c-carnet', nonLus)).toBe(false)
    expect(creationVisite('c-carnet', nonLus)).toEqual({ fil: null, dealId: null, rappelVeille: false })
    expect(preRemplissagePermis('c-marc', nonLus)).toBe(true)
    expect(preRemplissagePermis(null, nonLus)).toBe(true)
    expect(creationVisite(null, nonLus)).toEqual({ fil: null, dealId: null, rappelVeille: true })
  })
})

describe('ce que fait la création', () => {
  it('un acquéreur intéressé passe par l’écrivain du fil (son match, son deal), sans rappel la veille', () => {
    expect(creationVisite('c-julie', contexte('interested'))).toEqual({
      fil: { id: 'c-julie', matchId: 'm-c-julie', first: 'Julie', last: 'Morand', score: 92 },
      dealId: null,
      rappelVeille: false,
    })
  })

  it('à proposer, proposé ou déjà en visite : la visite seule, son match ne bouge pas, et pas de rappel la veille', () => {
    for (const statut of [undefined, 'suggested', 'sent', 'visit_planned'] as const) {
      expect(creationVisite('c-julie', contexte(statut)), String(statut)).toEqual({ fil: null, dealId: null, rappelVeille: false })
    }
  })

  it('un deal perdu : la visite ne s’y rattache pas, et l’acquéreur suit la règle du fil', () => {
    expect(creationVisite('c-paul', contexte())).toEqual({ fil: null, dealId: null, rappelVeille: false })
    expect(creationVisite('c-paul', contexte(undefined, true, 'interested'))).toEqual({
      fil: { id: 'c-paul', matchId: 'm-c-paul', first: 'Paul', last: 'Morand', score: 81 },
      dealId: null,
      rappelVeille: false,
    })
  })

  it('un acheteur en deal ouvert : la visite rejoint son deal et le rappel part ; même intéressé, son match ne bouge pas', () => {
    expect(creationVisite('c-marc', contexte())).toEqual({ fil: null, dealId: 'd-marc', rappelVeille: true })
  })

  it('hors du matching, un contact du carnet ou un visiteur créé sur place : la visite seule, avec son rappel', () => {
    expect(creationVisite('c-carnet', contexte())).toEqual({ fil: null, dealId: null, rappelVeille: true })
    expect(creationVisite(null, contexte())).toEqual({ fil: null, dealId: null, rappelVeille: true })
  })
})

describe('la visite écrite par la fiche (`ligneVisite`)', () => {
  const ENTREE: CreateVisitInput = { bienId: 'p1', contactId: 'c-julie', scheduledAt: '2026-10-02T12:00:00.000Z', durationMinutes: 45 }

  it('un acquéreur compatible : `reminder_sent` est posé, `visit-reminders-j1` ne lui écrit pas la veille', () => {
    const { dealId, rappelVeille } = creationVisite('c-julie', contexte('sent'))
    expect(ligneVisite({ ...ENTREE, dealId, reminderSent: !rappelVeille }, 'ag-1', 'u-1')).toMatchObject({
      agency_id: 'ag-1', agent_id: 'u-1', property_id: 'p1', contact_id: 'c-julie', transaction_id: null, status: 'planned',
      reminder_sent: true,
    })
  })

  it('un acheteur en deal ouvert : rien ne change, la colonne garde son défaut et le rappel part', () => {
    const { dealId, rappelVeille } = creationVisite('c-marc', contexte())
    const ligne = ligneVisite({ ...ENTREE, contactId: 'c-marc', dealId, reminderSent: !rappelVeille }, 'ag-1', 'u-1')
    expect(ligne).toMatchObject({ contact_id: 'c-marc', transaction_id: 'd-marc' })
    expect(ligne).not.toHaveProperty('reminder_sent')
  })
})

describe('la fiche lit ces règles (lecture du code)', () => {
  const source = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

  it('`PlanifierVisite` appelle les trois règles, et confie un acquéreur intéressé à l’écrivain du fil', () => {
    const code = source('src/components/crm/biens/fiche/PlanifierVisite.tsx')
    for (const appel of ['visiteursLies(', 'preRemplissagePermis(', 'creationVisite(', 'execPlanifierVisite(']) {
      expect(code, appel).toContain(appel)
    }
  })

  it('la fiche d’un mandat lui passe ses deals, ses acquéreurs compatibles une fois lus, et son état', () => {
    expect(source('src/pages/agent/ListingDetailPage.tsx')).toMatch(
      /deals: dealsForBien, compatibles: quiPour\.aDesDonnees \? quiPour\.compatibles : null, enVente: bien\.status === 'active'/,
    )
  })
})
```

Le faux client des gestes rend désormais la ligne créée par table (`visite-neuve` dans `visits`), pour que la visite rendue par l'écrivain du fil se distingue du deal.

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer :

```ts
 * Une écriture suivie de `select(…)` rend ses lignes, comme PostgREST : par défaut celles que ses
 * filtres `id` désignent (toutes réécrites), sinon `h.retours['update:matches']` — c'est ainsi qu'un
 * match qui n'est plus `suggested` se simule : la base n'en réécrit aucune ligne.
 */
```

par :

```ts
 * Une écriture suivie de `select(…)` rend ses lignes, comme PostgREST : par défaut celles que ses
 * filtres `id` désignent (toutes réécrites), sinon `h.retours['update:matches']` — c'est ainsi qu'un
 * match qui n'est plus `suggested` se simule : la base n'en réécrit aucune ligne. Une insertion
 * suivie de `single()` rend la ligne créée : `visite-neuve` dans `visits`, `deal-neuf` ailleurs.
 */
```

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer :

```ts
          const data = erreur ? null
            : unique ? { id: 'deal-neuf' }
```

par :

```ts
          const data = erreur ? null
            : unique ? { id: table === 'visits' ? 'visite-neuve' : 'deal-neuf' }
```

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer :

```ts
  it('un bien en mandat : match → visit_planned, visite `planned` rattachée au deal, deal avancé, journal', async () => {
    await expect(execPlanifierVisite(CTX, ACHETEUR, MANDAT, VISITE)).resolves.toEqual({ deja: false })
```

par :

```ts
  it('un bien en mandat : match → visit_planned, visite `planned` rattachée au deal, deal avancé, journal', async () => {
    // La visite écrite est rendue : la fiche d'un mandat l'ouvre (« Ouvrir la visite »).
    await expect(execPlanifierVisite(CTX, ACHETEUR, MANDAT, VISITE)).resolves.toEqual({ deja: false, visiteId: 'visite-neuve' })
```

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer :

```ts
  it('une annonce du marché : un événement « visite » de l’agenda, jamais une ligne `visits`', async () => {
    await execPlanifierVisite(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'), VISITE)
```

par :

```ts
  it('une annonce du marché : un événement « visite » de l’agenda, jamais une ligne `visits`', async () => {
    await expect(execPlanifierVisite(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'), VISITE)).resolves.toEqual({ deja: false, visiteId: null })
```

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer :

```ts
  it('un match qui n’est plus « intéressé » : rien d’autre, `deja`', async () => {
    h.retours['update:matches'] = []
    await expect(execPlanifierVisite(CTX, ACHETEUR, MANDAT, VISITE)).resolves.toEqual({ deja: true })
    expect(h.appels.map((a) => `${a.genre}:${a.table}`)).toEqual(['update:matches'])
  })
```

par :

```ts
  it('un match qui n’est plus « intéressé » : rien d’autre, `deja`', async () => {
    h.retours['update:matches'] = []
    await expect(execPlanifierVisite(CTX, ACHETEUR, MANDAT, VISITE)).resolves.toEqual({ deja: true, visiteId: null })
    expect(h.appels.map((a) => `${a.genre}:${a.table}`)).toEqual(['update:matches'])
  })

  it('lot E1 : ce que la fiche d’un mandat y ajoute entre dans la visite (visio, bon, rendez-vous), jamais le rappel la veille', async () => {
    const details = {
      visit_type: 'video', video_link: 'https://meet.example/visite', bon: { docId: 'doc-1', signedAt: null },
      qualification: { rendezVous: 'Code 4521' },
    }
    await expect(execPlanifierVisite(CTX, ACHETEUR, MANDAT, { ...VISITE, details })).resolves.toEqual({ deja: false, visiteId: 'visite-neuve' })
    expect(ecrit('insert:visits').valeurs).toMatchObject({ ...details, transaction_id: 'deal-neuf', reminder_sent: true })
    expect(h.invoke).not.toHaveBeenCalled()
  })
```

Dans `tests/unit/matching-sans-sortie.spec.ts`, remplacer :

```ts
  'src/components/crm/biens/nouveau/LigneAcquereurs.tsx',
```

par :

```ts
  'src/components/crm/biens/nouveau/LigneAcquereurs.tsx',
  // Lot E1 : les règles de « Planifier une visite » sur la fiche d'un mandat, dont celle qui refuse le message pré-rempli
  // à un acquéreur du matching (`preRemplissagePermis`). Le formulaire (`PlanifierVisite`) reste hors du périmètre, comme
  // une page hôte : il prépare ce message pour un acheteur en deal ouvert, et c'est cette règle qui en décide.
  'src/components/crm/biens/fiche/visiteurs.ts',
```

```bash
npx vitest run tests/unit/fiche-planifier-visite.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/matching-sans-sortie.spec.ts
```

Attendu : ÉCHEC, `Test Files  3 failed (3)`, `Tests  5 failed | 58 passed (63)` : la spec neuve ne se charge pas, `Failed to resolve import "@/components/crm/biens/fiche/visiteurs"` ; dans les gestes, `expected { deja: false } to deeply equal { deja: false, …(1) }` (le mandat, et les détails de la fiche), `expected { deja: false } to deeply equal { deja: false, visiteId: null }` (l'annonce) et `expected { deja: true } to deeply equal { deja: true, visiteId: null }` ; la garde, `src/components/crm/biens/fiche/visiteurs.ts introuvable: expected 0 to be greater than 0`.

- [ ] **Étape 2 : Les règles, pures**

Créer `src/components/crm/biens/fiche/visiteurs.ts` :

```ts
/**
 * « Planifier une visite » depuis la fiche d'un mandat (`PlanifierVisite`) — les règles, PURES : qui proposer comme
 * visiteur, à qui préparer un message de confirmation, ce que fait la création. Ni React, ni Supabase, ni traduction.
 *
 * Lot E1 (conception §5.6, décision 9c) : la règle du fil et du copilote WhatsApp (`wa_matching_visite`), une seule.
 *   · Un acquéreur COMPATIBLE du mandat (`useQuiPourCeBien`) sans deal ouvert dessus reste proposé, mais rien ne lui
 *     est préparé : ni message, ni rappel la veille. « Intéressé », son match passe « visite planifiée » et son deal
 *     s'ouvre ou avance, par l'écrivain du fil (`execPlanifierVisite`) ; à proposer, proposé ou déjà en visite, son match
 *     ne bouge pas — sa réponse se consigne dans le fil.
 *   · Un acheteur en deal OUVERT sur ce bien garde le message et le rappel, et sa visite rejoint son deal.
 *   · Un mandat qui n'est plus en vente ne propose plus ses acquéreurs compatibles : seuls ses acheteurs en deal ouvert.
 * Un visiteur hors du matching (un contact du carnet sans match compatible, un visiteur créé sur place) garde le
 * message et le rappel : la règle vise ce que produit le matching, pas la confirmation d'une visite (conception §3.1).
 *
 * ⚠ « Perdu » n'est pas un statut de deal : c'est l'étape `lost` — « Marquer perdu » du Pipeline n'écrit qu'elle, le
 * statut reste `active`. Un deal ouvert se lit donc sur les deux (`dealOuvert`).
 */
import type { Compatible } from '@/components/matching-fil/filQuiPour'
import type { AcheteurGeste } from '@/lib/matchingGestes'

/** Un deal du bien, tel que la fiche le lit (`useTransactions`, filtré sur le bien, le plus récent d'abord). */
export interface DealDuBien {
  id: string
  contact_buyer_id: string | null
  status: string
  stage: string
}

/** Ce que la fiche d'un mandat sait des gens liés au bien. */
export interface ContexteVisite {
  /** Ses deals, tout statut. */
  deals: readonly DealDuBien[]
  /**
   * Ses acquéreurs compatibles (`useQuiPourCeBien`), quel que soit l'état du mandat ; `null` tant qu'ils ne sont pas lus
   * (ou si la lecture a échoué) — on ne sait pas encore qui est un acquéreur du matching.
   */
  compatibles: readonly Compatible[] | null
  /** En vente (`active`, la règle du fil) : ses acquéreurs compatibles se proposent encore. */
  enVente: boolean
}

/** Une personne déjà liée au bien : acheteur d'un deal ouvert, ou acquéreur compatible. */
export interface VisiteurLie {
  contactId: string
  nom: string
  /** Deal OUVERT de ce contact sur ce bien : la visite s'y rattache. */
  dealId?: string | null
  /** Score du moteur, pour un acquéreur compatible. */
  score?: number | null
}

/**
 * Ce que fait la création. `fil` : l'écrivain du fil d'abord (`execPlanifierVisite`), pour un acquéreur INTÉRESSÉ — son
 * match passe « visite planifiée », son deal s'ouvre ou avance, et le rappel la veille ne part pas. Sinon, ou s'il ne
 * l'est plus quand la visite s'écrit, la visite seule (`useCreateAgentVisit`) : rattachée à `dealId`, et avec le rappel
 * la veille si `rappelVeille` — la règle du message pré-rempli (`preRemplissagePermis`).
 */
export interface CreationVisite {
  fil: AcheteurGeste | null
  dealId: string | null
  rappelVeille: boolean
}

/**
 * Les statuts d'un deal ouvert (`transactions.status`) : `active`, et `on_hold`, un deal suspendu que le Pipeline garde.
 * `completed` est un deal gagné (« Terminer »), `cancelled` un deal annulé.
 */
const STATUTS_OUVERTS: readonly string[] = ['active', 'on_hold']

/** Un deal ouvert : d'un statut ouvert, et pas perdu. */
export const dealOuvert = (d: Pick<DealDuBien, 'status' | 'stage'>): boolean =>
  STATUTS_OUVERTS.includes(d.status) && d.stage !== 'lost'

/** Le deal ouvert d'un contact sur ce bien, le plus récent. */
const dealOuvertDe = (contactId: string, c: ContexteVisite): DealDuBien | null =>
  c.deals.find((d) => d.contact_buyer_id === contactId && dealOuvert(d)) ?? null

/** Les acquéreurs du matching : les compatibles sans deal ouvert sur ce bien. */
const acquereurs = (c: ContexteVisite): Compatible[] =>
  (c.compatibles ?? []).filter((m) => dealOuvertDe(m.acheteur.id, c) == null)

/**
 * Qui proposer d'abord : les acheteurs en deal ouvert sur ce bien, puis ses acquéreurs compatibles s'il est en vente.
 * Un contact n'y figure qu'une fois, à sa première place. `nomDe` : son nom dans le carnet, `null` s'il n'y est pas —
 * un acheteur qu'on ne peut pas nommer n'est pas proposé.
 */
export function visiteursLies(c: ContexteVisite, nomDe: (contactId: string) => string | null): VisiteurLie[] {
  const enDeal = c.deals.filter(dealOuvert).flatMap((d) => {
    const nom = d.contact_buyer_id ? nomDe(d.contact_buyer_id) : null
    return d.contact_buyer_id && nom != null ? [{ contactId: d.contact_buyer_id, nom, dealId: d.id }] : []
  })
  const compatibles = c.enVente
    ? acquereurs(c).map((m) => ({ contactId: m.acheteur.id, nom: `${m.acheteur.prenom} ${m.acheteur.nom}`.trim(), score: m.score }))
    : []
  return [...enDeal, ...compatibles].filter((l, i, tous) => tous.findIndex((x) => x.contactId === l.contactId) === i)
}

/**
 * Le message de confirmation pré-rempli : refusé à un acquéreur du matching, qu'il ait été choisi dans « Sur ce bien »
 * ou dans le carnet, sur un mandat en vente ou non — rien du matching ne part vers l'acheteur. `null` : un visiteur créé
 * sur place, hors du matching. ⚠ Tant que les compatibles ne sont pas lus, seuls un acheteur en deal ouvert et un
 * visiteur créé sur place y ont droit : on ne sait pas si un autre contact est un acquéreur du matching, et rien ne part.
 */
export function preRemplissagePermis(contactId: string | null, c: ContexteVisite): boolean {
  if (contactId == null || dealOuvertDe(contactId, c) != null) return true
  return c.compatibles != null && !c.compatibles.some((m) => m.acheteur.id === contactId)
}

/**
 * Ce que fait la création de la visite d'un contact (cf. `CreationVisite`) ; `null` : un visiteur créé sur place, qui n'a
 * ni deal ni match.
 */
export function creationVisite(contactId: string | null, c: ContexteVisite): CreationVisite {
  const deal = contactId == null ? null : dealOuvertDe(contactId, c)
  const acquereur = contactId == null || deal ? null : c.compatibles?.find((m) => m.acheteur.id === contactId) ?? null
  return {
    fil: acquereur?.suivi?.statut === 'interested'
      ? { id: acquereur.acheteur.id, matchId: acquereur.id, first: acquereur.acheteur.prenom, last: acquereur.acheteur.nom, score: acquereur.score }
      : null,
    dealId: deal?.id ?? null,
    rappelVeille: preRemplissagePermis(contactId, c),
  }
}
```

- [ ] **Étape 3 : L'écrivain du fil prend les détails de la fiche et rend la visite**

`details` s'étale dans la ligne `visits` AVANT `reminder_sent: true`, que son type ne porte pas : la fiche ne peut pas rouvrir le rappel. Le fil (`MatchingFil`) ne lit que `deja`, et ne change pas.

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
 *   planifierVisite → (fil) match 'visit_planned' + visite interne (mandat) ou événement « visite » de
 *                  l'agenda (annonce du marché) + deal avancé ; aucune invitation
```

par :

```ts
 *   planifierVisite → (fil, et fiche d'un mandat pour un acquéreur intéressé) match 'visit_planned' +
 *                  visite interne (mandat) ou événement « visite » de l'agenda (annonce du marché) + deal
 *                  avancé ; aucune invitation
```

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
/** Le créneau d'une visite planifiée depuis le fil. */
export interface VisiteAPlanifier {
  /** Début, ISO. */
  debut: string
  dureeMinutes: number
  /** Adresse du bien, pour l'agenda. */
  lieu: string | null
}
```

par :

```ts
/**
 * Le créneau d'une visite planifiée par l'écrivain du fil : depuis « À conclure », ou depuis la fiche d'un mandat pour
 * un acquéreur intéressé (lot E1, `PlanifierVisite`).
 */
export interface VisiteAPlanifier {
  /** Début, ISO. */
  debut: string
  dureeMinutes: number
  /** Adresse du bien, pour l'agenda. */
  lieu: string | null
  /**
   * Ce que la fiche d'un mandat pose en plus sur la visite (`detailsVisite`) : le mode et le lien d'une visio, le bon de
   * visite, le point de rendez-vous. Le fil n'en pose aucun : une visite sur place, sans bon.
   */
  details?: Pick<TablesInsert<'visits'>, 'visit_type' | 'video_link' | 'bon' | 'qualification'>
}
```

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
 * ⛔ Aucun rappel au client non plus : `visit-reminders-j1` écrit à l'acheteur la veille de toute visite `planned`
 * dont `reminder_sent` est faux (`send-visit-email`). Posé à la création, il ne part pas — le matching reste chez
 * l'agent, et aucun envoi au client ne part sans sa validation (CLAUDE.md §5).
 */
export async function execPlanifierVisite(
  ctx: GesteContext,
  buyer: AcheteurGeste,
  listing: BienGeste,
  visite: VisiteAPlanifier,
): Promise<{ deja: boolean }> {
  const { data: marques, error: mErr } = await supabase
    .from('matches')
    .update({ status: 'visit_planned' })
    .eq('id', buyer.matchId)
    .eq('contact_id', buyer.id)
    .eq('status', 'interested')
    .select('id')
  if (mErr) throw mErr
  if (!marques || marques.length === 0) return { deja: true }

  try {
    const dealId = await rattacherDeal(ctx, buyer.id, listing)
    if (listing.kind === 'property') {
      const { data: v, error: vErr } = await supabase
        .from('visits')
        .insert({
          agency_id: ctx.agencyId,
          agent_id: ctx.userId,
          property_id: listing.id,
          contact_id: buyer.id,
          transaction_id: dealId,
          scheduled_at: visite.debut,
          duration_minutes: visite.dureeMinutes,
          status: 'planned',
          visit_type: 'sur_place',
          buyer_name: `${buyer.first} ${buyer.last}`.trim() || null,
          // Le rappel J-1 ne part pas : voir la docstring.
          reminder_sent: true,
        })
        .select('id')
        .single()
      if (vErr) throw vErr
      await logEvent(ctx, {
        action: 'visit_scheduled',
        contactId: buyer.id,
        label: `${buyer.first} ${buyer.last} · ${listing.title}`,
        categorie: 'contact',
        metadata: { match_id: buyer.matchId, visit_id: (v as { id: string }).id, deal_id: dealId, bien_ref: listing.ref, scheduled_at: visite.debut },
      })
```

par :

```ts
 * ⛔ Aucun rappel au client non plus : `visit-reminders-j1` écrit à l'acheteur la veille de toute visite `planned`
 * dont `reminder_sent` est faux (`send-visit-email`). Posé à la création, il ne part pas — le matching reste chez
 * l'agent, et aucun envoi au client ne part sans sa validation (CLAUDE.md §5).
 *
 * Rend la visite écrite (`visiteId`, qu'ouvre la fiche d'un mandat) ; une annonce du marché n'en a pas, son événement
 * d'agenda se lit dans le Calendrier.
 */
export async function execPlanifierVisite(
  ctx: GesteContext,
  buyer: AcheteurGeste,
  listing: BienGeste,
  visite: VisiteAPlanifier,
): Promise<{ deja: boolean; visiteId: string | null }> {
  const { data: marques, error: mErr } = await supabase
    .from('matches')
    .update({ status: 'visit_planned' })
    .eq('id', buyer.matchId)
    .eq('contact_id', buyer.id)
    .eq('status', 'interested')
    .select('id')
  if (mErr) throw mErr
  if (!marques || marques.length === 0) return { deja: true, visiteId: null }

  let visiteId: string | null = null
  try {
    const dealId = await rattacherDeal(ctx, buyer.id, listing)
    if (listing.kind === 'property') {
      const { data: v, error: vErr } = await supabase
        .from('visits')
        .insert({
          agency_id: ctx.agencyId,
          agent_id: ctx.userId,
          property_id: listing.id,
          contact_id: buyer.id,
          transaction_id: dealId,
          scheduled_at: visite.debut,
          duration_minutes: visite.dureeMinutes,
          status: 'planned',
          visit_type: 'sur_place',
          buyer_name: `${buyer.first} ${buyer.last}`.trim() || null,
          ...visite.details,
          // Le rappel J-1 ne part pas : voir la docstring. Après les détails de la fiche, qui ne le rouvrent pas.
          reminder_sent: true,
        })
        .select('id')
        .single()
      if (vErr) throw vErr
      visiteId = (v as { id: string }).id
      await logEvent(ctx, {
        action: 'visit_scheduled',
        contactId: buyer.id,
        label: `${buyer.first} ${buyer.last} · ${listing.title}`,
        categorie: 'contact',
        metadata: { match_id: buyer.matchId, visit_id: visiteId, deal_id: dealId, bien_ref: listing.ref, scheduled_at: visite.debut },
      })
```

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
  } catch (err) {
    await supabase.from('matches').update({ status: 'interested' }).eq('id', buyer.matchId).eq('status', 'visit_planned')
    throw err
  }
  return { deja: false }
}
```

par :

```ts
  } catch (err) {
    await supabase.from('matches').update({ status: 'interested' }).eq('id', buyer.matchId).eq('status', 'visit_planned')
    throw err
  }
  return { deja: false, visiteId }
}
```

- [ ] **Étape 4 : La visite de la fiche : sa ligne, et le rappel de la veille**

Le bon de visite et la qualification sortent de `useCreateAgentVisit` sans changer d'une virgule (`detailsVisite`) : la fiche les passe à l'écrivain du fil pour un acquéreur intéressé. La ligne entière devient `ligneVisite`, qui n'écrit `reminder_sent` que pour couper le rappel — pour tout autre visiteur, la colonne garde son défaut, comme avant.

Dans `src/hooks/useVisitDetail.ts`, remplacer :

```ts
  /** Point de rendez-vous / accès (code, étage…) — sans colonne, rangé dans `qualification`. */
  rendezVous?: string | null
}

/** Crée une visite côté agent ; génère optionnellement le bon de visite et les toggles d'automatisation. */
export function useCreateAgentVisit() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateVisitInput) => {
      if (!profile?.agency_id) {
        throw new Error('Création visite : agence introuvable')
      }
      const bon: VisitBon | null = input.generateBon
        ? {
            generatedAt: new Date().toISOString(),
            signedAt: null,
            docId: `doc-${crypto.randomUUID().slice(0, 8)}`,
            visitorNames: input.visitorNames ?? [],
            visitorIds: input.visitorIds ?? [input.contactId],
          }
        : null

      const qualification =
        input.automations || input.generateBon || input.rendezVous
          ? {
              automations: {
                generateBon: !!input.generateBon,
                emailVisitor: input.automations?.emailVisitor ?? false,
                askSignature: input.automations?.askSignature ?? false,
              },
              ...(input.rendezVous ? { rendezVous: input.rendezVous } : {}),
            }
          : null

      const { data, error } = await supabase
        .from('visits')
        .insert({
          agency_id: profile.agency_id,
          property_id: input.bienId,
          contact_id: input.contactId,
          transaction_id: input.dealId ?? null,
          scheduled_at: input.scheduledAt,
          duration_minutes: input.durationMinutes,
          agent_id: user?.id ?? null,
          status: 'planned',
          visit_type: input.visitType ?? 'sur_place',
          video_link: input.videoLink ?? null,
          bon: bon as unknown as Json,
          rapport: null,
          qualification: qualification as unknown as Json,
        } as unknown as TablesInsert<'visits'>)
        .select('id')
        .single()
```

par :

```ts
  /** Point de rendez-vous / accès (code, étage…) — sans colonne, rangé dans `qualification`. */
  rendezVous?: string | null
  /**
   * Aucun rappel la veille au client : `visit-reminders-j1` écrit à l'acheteur de toute visite `planned` dont
   * `reminder_sent` est faux. Posé pour un acquéreur du matching (lot E1, `PlanifierVisite`) : rien ne lui part.
   */
  reminderSent?: boolean
}

/**
 * Ce que le formulaire de l'agent pose sur une visite en plus de son créneau : le mode, le lien d'une visio, le bon de
 * visite et la qualification (automatisations, point de rendez-vous). Une seule forme, que la visite s'écrive ici ou par
 * l'écrivain du fil, à qui la fiche d'un mandat confie celle d'un acquéreur intéressé (`execPlanifierVisite`).
 */
export function detailsVisite(input: CreateVisitInput): Pick<TablesInsert<'visits'>, 'visit_type' | 'video_link' | 'bon' | 'qualification'> {
  const bon: VisitBon | null = input.generateBon
    ? {
        generatedAt: new Date().toISOString(),
        signedAt: null,
        docId: `doc-${crypto.randomUUID().slice(0, 8)}`,
        visitorNames: input.visitorNames ?? [],
        visitorIds: input.visitorIds ?? [input.contactId],
      }
    : null

  const qualification =
    input.automations || input.generateBon || input.rendezVous
      ? {
          automations: {
            generateBon: !!input.generateBon,
            emailVisitor: input.automations?.emailVisitor ?? false,
            askSignature: input.automations?.askSignature ?? false,
          },
          ...(input.rendezVous ? { rendezVous: input.rendezVous } : {}),
        }
      : null

  return {
    visit_type: input.visitType ?? 'sur_place',
    video_link: input.videoLink ?? null,
    bon: bon as unknown as Json,
    qualification: qualification as unknown as Json,
  }
}

/** La ligne `visits` d'une visite créée par l'agent ; `reminder_sent` n'est écrit que pour couper le rappel la veille. */
export function ligneVisite(input: CreateVisitInput, agencyId: string, agentId: string | null): TablesInsert<'visits'> {
  return {
    agency_id: agencyId,
    property_id: input.bienId,
    contact_id: input.contactId,
    transaction_id: input.dealId ?? null,
    scheduled_at: input.scheduledAt,
    duration_minutes: input.durationMinutes,
    agent_id: agentId,
    status: 'planned',
    ...detailsVisite(input),
    rapport: null,
    ...(input.reminderSent ? { reminder_sent: true } : {}),
  }
}

/** Crée une visite côté agent ; génère optionnellement le bon de visite et les toggles d'automatisation. */
export function useCreateAgentVisit() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateVisitInput) => {
      if (!profile?.agency_id) {
        throw new Error('Création visite : agence introuvable')
      }
      const { data, error } = await supabase
        .from('visits')
        .insert(ligneVisite(input, profile.agency_id, user?.id ?? null))
        .select('id')
        .single()
```

- [ ] **Étape 5 : Le formulaire appelle les règles**

La liste « Sur ce bien » vient de `visiteursLies` (le nom d'un acheteur en deal, lu dans le carnet que le formulaire charge déjà) ; le droit au message et la création se décident à l'écriture, sur le visiteur CHOISI — un visiteur créé sur place n'a pas encore d'id, il n'est pas du matching. Un acquéreur intéressé passe par l'écrivain du fil ; s'il ne l'est plus (`deja`), la visite part quand même par `useCreateAgentVisit`, sans rappel. Sans droit au message, l'écran d'après n'a ni le bloc « Confirmer au visiteur » (ni message, ni bouton WhatsApp, ni lien e-mail) ; il dit que rien n'est envoyé.

Dans `src/components/crm/biens/fiche/PlanifierVisite.tsx`, remplacer :

```tsx
 * ── CE QU'UN AGENT FAIT QUAND IL POSE UNE VISITE, DANS L'ORDRE DE L'ÉCRAN ────
 *   1. Qui    — d'abord les gens DÉJÀ liés au bien (acheteurs en cours, suggestions
 *               MEGGA AI), puis tout le carnet, ou un visiteur neuf créé sur place.
 *   2. Quand  — un CALENDRIER mensuel (une visite se pose souvent à une date précise, des
 *               semaines à l'avance — la bande de 14 jours du premier jet ne le permettait
 *               pas), les heures au quart d'heure, ou une heure libre ; les visites de
 *               l'agence sont MONTRÉES (un conflit se signale, il ne bloque pas).
 *   3. Où     — sur place (adresse du bien + point de rendez-vous / accès) ou en visio.
 *   4. Après  — bon de visite prêt à signer ; la visite rejoint le deal du visiteur
 *               sur ce bien s'il en a un, et le Calendrier (qui lit `visits`).
 *   5. Confirmer au client — WhatsApp ou e-mail PRÉ-REMPLIS, que l'agent envoie
 *               lui-même : aucun envoi automatique (validation humaine, CLAUDE.md §5).
 *
 * ⚠ Le point de rendez-vous est rangé dans `qualification.rendezVous` : il n'a pas de
 * colonne, et il sert d'abord au message de confirmation, où le client en a besoin.
 */
```

par :

```tsx
 * ── CE QU'UN AGENT FAIT QUAND IL POSE UNE VISITE, DANS L'ORDRE DE L'ÉCRAN ────
 *   1. Qui    — d'abord les gens DÉJÀ liés au bien (acheteurs en deal ouvert, acquéreurs
 *               compatibles), puis tout le carnet, ou un visiteur neuf créé sur place.
 *   2. Quand  — un CALENDRIER mensuel (une visite se pose souvent à une date précise, des
 *               semaines à l'avance — la bande de 14 jours du premier jet ne le permettait
 *               pas), les heures au quart d'heure, ou une heure libre ; les visites de
 *               l'agence sont MONTRÉES (un conflit se signale, il ne bloque pas).
 *   3. Où     — sur place (adresse du bien + point de rendez-vous / accès) ou en visio.
 *   4. Après  — bon de visite prêt à signer ; la visite rejoint le deal OUVERT du
 *               visiteur sur ce bien s'il en a un, et le Calendrier (qui lit `visits`).
 *   5. Confirmer au client — WhatsApp ou e-mail PRÉ-REMPLIS, que l'agent envoie
 *               lui-même : aucun envoi automatique (validation humaine, CLAUDE.md §5).
 *               Jamais pour un acquéreur du matching : ni message, ni rappel la veille.
 *
 * ⚠ Le point de rendez-vous est rangé dans `qualification.rendezVous` : il n'a pas de
 * colonne, et il sert d'abord au message de confirmation, où le client en a besoin.
 *
 * ⚠ Lot E1 (conception §5.6) : qui est proposé, à qui un message est préparé et ce que
 * fait la création se décident dans `visiteurs.ts`, pur — la règle du fil et du copilote
 * WhatsApp. Un acquéreur INTÉRESSÉ passe par l'écrivain du fil (`execPlanifierVisite`) :
 * son match passe « visite planifiée », son deal s'ouvre ou avance, et les détails du
 * formulaire (visio, bon, point de rendez-vous) entrent dans sa visite (`detailsVisite`).
 */
```

Dans `src/components/crm/biens/fiche/PlanifierVisite.tsx`, remplacer :

```tsx
import { useContacts, useCreateContact } from '@/hooks/useContacts'
import { useCreateAgentVisit } from '@/hooks/useVisitDetail'
import { useVisits } from '@/hooks/useVisits'
import { useAuth } from '@/hooks/useAuth'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { pickAvatarBg } from '@/lib/crmAdapters'
import { buildWaMeUrl } from '@/lib/waMeUrl'
import { majusculeInitiale } from '@/lib/utils'
import type { Property } from '@/types/listing'

/** Une personne déjà liée au bien : acheteur d'un deal, ou suggestion du moteur. */
export interface VisiteurLie {
  contactId: string
  nom: string
  /** Deal de CE contact sur CE bien — la visite s'y rattache. */
  dealId?: string | null
  /** Score MEGGA AI (estimation), pour une suggestion. */
  score?: number | null
}

interface Props {
  bien: Property
  dark: boolean
  sp: CrmPalette
  vx: VxPalette
  liees: VisiteurLie[]
  onClose: () => void
```

par :

```tsx
import { useContacts, useCreateContact } from '@/hooks/useContacts'
import { detailsVisite, useCreateAgentVisit, type CreateVisitInput } from '@/hooks/useVisitDetail'
import { useVisits } from '@/hooks/useVisits'
import { useAuth } from '@/hooks/useAuth'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { pickAvatarBg } from '@/lib/crmAdapters'
import { execPlanifierVisite, refBienInterne } from '@/lib/matchingGestes'
import { buildWaMeUrl } from '@/lib/waMeUrl'
import { majusculeInitiale } from '@/lib/utils'
import type { Property } from '@/types/listing'
import { creationVisite, preRemplissagePermis, visiteursLies, type ContexteVisite } from './visiteurs'

interface Props {
  bien: Property
  dark: boolean
  sp: CrmPalette
  vx: VxPalette
  /** Les gens liés au bien : ses deals, ses acquéreurs compatibles, son état (`visiteurs.ts`). */
  contexte: ContexteVisite
  onClose: () => void
```

Dans `src/components/crm/biens/fiche/PlanifierVisite.tsx`, remplacer :

```tsx
export default function PlanifierVisite({ bien, dark, sp, vx, liees, onClose, onPlanned, onOpenVisit, demo }: Props) {
```

par :

```tsx
export default function PlanifierVisite({ bien, dark, sp, vx, contexte, onClose, onPlanned, onOpenVisit, demo }: Props) {
```

Dans `src/components/crm/biens/fiche/PlanifierVisite.tsx`, remplacer :

```tsx
  const [erreur, setErreur] = useState<string | null>(null)
  const [planifiee, setPlanifiee] = useState<{ id: string | null } | null>(null)

  const isRent = bien.transaction_type === 'rent'
  const adresse = [bien.address, [bien.postal_code, bien.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const lieeDe = (id: string | null) => (id ? liees.find((l) => l.contactId === id) ?? null : null)
```

par :

```tsx
  const [erreur, setErreur] = useState<string | null>(null)
  // `preRempli` : le message de confirmation est-il préparé — décidé à l'écriture (`planifier`).
  const [planifiee, setPlanifiee] = useState<{ id: string | null; preRempli: boolean } | null>(null)

  const isRent = bien.transaction_type === 'rent'
  const adresse = [bien.address, [bien.postal_code, bien.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  // Le nom d'un acheteur en deal, lu dans le carnet : absent, il n'est pas proposé.
  const nomDe = (id: string) => {
    const c = (contacts ?? []).find((x) => x.id === id)
    return c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : null
  }
  const liees = visiteursLies(contexte, nomDe)
  const lieeDe = (id: string | null) => (id ? liees.find((l) => l.contactId === id) ?? null : null)
```

Dans `src/components/crm/biens/fiche/PlanifierVisite.tsx`, remplacer :

```tsx
    try {
      let v = visiteur
      if (!v && nouveau) {
        v = { id: null, prenom: nouveau.prenom.trim(), nom: nouveau.nom.trim(), phone: nouveau.phone.trim() || null, email: nouveau.email.trim() || null }
        if (!demo) {
          // L'id est posé ici : la réponse de l'insertion ne le rend pas toujours (cf. hook).
          const id = crypto.randomUUID()
          await creerContact.mutateAsync({
            id, firstName: v.prenom, lastName: v.nom, email: v.email, phone: v.phone ?? undefined,
            type: isRent ? 'tenant' : 'buyer',
          })
          v = { ...v, id }
        }
        setVisiteur(v)
      }
      if (demo || !v?.id) { setPlanifiee({ id: null }); return }
      const extra = accompagnants.split(',').map((s) => s.trim()).filter(Boolean)
      const creee = await creerVisite({
        bienId: bien.id,
        contactId: v.id,
        dealId: lieeDe(v.id)?.dealId ?? null,
        scheduledAt: debut.toISOString(),
        durationMinutes: duree,
        generateBon: bon,
        visitorNames: [`${v.prenom} ${v.nom}`.trim(), ...extra],
        visitorIds: [v.id],
        visitType: mode,
        videoLink: mode === 'video' ? lienVisio.trim() : null,
        rendezVous: mode === 'sur_place' ? rendezVous.trim() || null : null,
      })
      setPlanifiee({ id: creee?.id ?? null })
      onPlanned()
```

par :

```tsx
    try {
      // Le visiteur CHOISI ; un visiteur créé sur place n'a pas encore d'id : il n'est pas du matching (`null`).
      const choisi = visiteur?.id ?? null
      // Décidé à l'écriture, une fois : relu ensuite, le deal que cette visite vient d'ouvrir ferait paraître le message.
      const preRempli = preRemplissagePermis(choisi, contexte)
      const creation = creationVisite(choisi, contexte)
      let v = visiteur
      if (!v && nouveau) {
        v = { id: null, prenom: nouveau.prenom.trim(), nom: nouveau.nom.trim(), phone: nouveau.phone.trim() || null, email: nouveau.email.trim() || null }
        if (!demo) {
          // L'id est posé ici : la réponse de l'insertion ne le rend pas toujours (cf. hook).
          const id = crypto.randomUUID()
          await creerContact.mutateAsync({
            id, firstName: v.prenom, lastName: v.nom, email: v.email, phone: v.phone ?? undefined,
            type: isRent ? 'tenant' : 'buyer',
          })
          v = { ...v, id }
        }
        setVisiteur(v)
      }
      if (demo || !v?.id) { setPlanifiee({ id: null, preRempli }); return }
      const extra = accompagnants.split(',').map((s) => s.trim()).filter(Boolean)
      const entree: CreateVisitInput = {
        bienId: bien.id,
        contactId: v.id,
        dealId: creation.dealId,
        scheduledAt: debut.toISOString(),
        durationMinutes: duree,
        generateBon: bon,
        visitorNames: [`${v.prenom} ${v.nom}`.trim(), ...extra],
        visitorIds: [v.id],
        visitType: mode,
        videoLink: mode === 'video' ? lienVisio.trim() : null,
        rendezVous: mode === 'sur_place' ? rendezVous.trim() || null : null,
        reminderSent: !creation.rappelVeille,
      }
      // Un acquéreur intéressé : l'écrivain du fil. S'il ne l'est plus (`deja`), la visite s'écrit quand même, sans
      // toucher son match — la règle de `wa_matching_visite`.
      let parLeFil: { id: string | null } | null = null
      if (creation.fil && profile?.agency_id) {
        const r = await execPlanifierVisite(
          { agencyId: profile.agency_id, userId: profile.id },
          creation.fil,
          { kind: 'property', id: bien.id, ref: refBienInterne(bien.id), title: bien.title },
          { debut: entree.scheduledAt, dureeMinutes: duree, lieu: adresse || null, details: detailsVisite(entree) },
        )
        if (!r.deja) parLeFil = { id: r.visiteId }
      }
      const creee = parLeFil ?? await creerVisite(entree)
      setPlanifiee({ id: creee.id, preRempli })
      onPlanned()
```

Dans `src/components/crm/biens/fiche/PlanifierVisite.tsx`, remplacer :

```tsx
  // ── Message de confirmation — l'agent l'ENVOIE lui-même ──
  const message = debut && visiteur ? t(mode === 'video' ? 'fiche.visite.message.video' : 'fiche.visite.message.surPlace', {
```

par :

```tsx
  // ── Message de confirmation — l'agent l'ENVOIE lui-même ; jamais à un acquéreur du matching (`preRempli`) ──
  const message = planifiee?.preRempli && debut && visiteur ? t(mode === 'video' ? 'fiche.visite.message.video' : 'fiche.visite.message.surPlace', {
```

Dans `src/components/crm/biens/fiche/PlanifierVisite.tsx`, remplacer :

```tsx
                <div style={{ marginTop: 'var(--crm-space-xs)', fontSize: 'var(--crm-text-md)', color: vx.muted }}>
                  {demo ? t('fiche.visite.demo') : t('fiche.visite.dansCalendrier')}
                </div>
              </div>
            </div>

            <Section n={5} titre={t('fiche.visite.confirmer.titre')} vx={vx}>
              <div style={{ fontSize: 'var(--crm-text-md)', color: vx.muted, marginTop: 'calc(-1 * var(--crm-space-md))' }}>{t('fiche.visite.confirmer.aide')}</div>
              <div style={{ padding: 'var(--crm-space-xl)', borderRadius: 'var(--crm-radius-lg)', background: vx.cardSub, color: vx.inkSoft, fontSize: 'var(--crm-text-lg)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {message}
              </div>
              <div style={{ display: 'flex', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
                {visiteur?.phone ? (
                  <a href={buildWaMeUrl(visiteur.phone, message)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', background: vx.black, color: vx.onAccent, fontSize: 'var(--crm-text-md)', fontWeight: 600, textDecoration: 'none' }}>
                    <MEIcon name="message" size={14} />{t('fiche.visite.confirmer.whatsapp')}
                  </a>
                ) : null}
                {mailto ? (
                  <a href={mailto} className="pv-puce" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', background: vx.cardSub, color: vx.inkSoft, fontSize: 'var(--crm-text-md)', fontWeight: 600, textDecoration: 'none' }}>
                    <MEIcon name="mail" size={14} />{t('fiche.visite.confirmer.email')}
                  </a>
                ) : null}
                {!visiteur?.phone && !mailto && (
                  <span style={{ fontSize: 'var(--crm-text-md)', color: vx.muted }}>{t('fiche.visite.confirmer.aucunCanal')}</span>
                )}
              </div>
            </Section>
```

par :

```tsx
                <div style={{ marginTop: 'var(--crm-space-xs)', fontSize: 'var(--crm-text-md)', color: vx.muted }}>
                  {demo ? t('fiche.visite.demo') : t('fiche.visite.dansCalendrier')}
                </div>
                {!planifiee.preRempli && (
                  <div style={{ marginTop: 'var(--crm-space-xs)', fontSize: 'var(--crm-text-md)', color: vx.muted }}>
                    {t('fiche.visite.rienEnvoye', { prenom: visiteur?.prenom ?? '' })}
                  </div>
                )}
              </div>
            </div>

            {/* Un acquéreur du matching n'a ni message, ni bouton, ni lien (`preRemplissagePermis`). */}
            {planifiee.preRempli && (
              <Section n={5} titre={t('fiche.visite.confirmer.titre')} vx={vx}>
                <div style={{ fontSize: 'var(--crm-text-md)', color: vx.muted, marginTop: 'calc(-1 * var(--crm-space-md))' }}>{t('fiche.visite.confirmer.aide')}</div>
                <div style={{ padding: 'var(--crm-space-xl)', borderRadius: 'var(--crm-radius-lg)', background: vx.cardSub, color: vx.inkSoft, fontSize: 'var(--crm-text-lg)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {message}
                </div>
                <div style={{ display: 'flex', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
                  {visiteur?.phone ? (
                    <a href={buildWaMeUrl(visiteur.phone, message)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', background: vx.black, color: vx.onAccent, fontSize: 'var(--crm-text-md)', fontWeight: 600, textDecoration: 'none' }}>
                      <MEIcon name="message" size={14} />{t('fiche.visite.confirmer.whatsapp')}
                    </a>
                  ) : null}
                  {mailto ? (
                    <a href={mailto} className="pv-puce" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', background: vx.cardSub, color: vx.inkSoft, fontSize: 'var(--crm-text-md)', fontWeight: 600, textDecoration: 'none' }}>
                      <MEIcon name="mail" size={14} />{t('fiche.visite.confirmer.email')}
                    </a>
                  ) : null}
                  {!visiteur?.phone && !mailto && (
                    <span style={{ fontSize: 'var(--crm-text-md)', color: vx.muted }}>{t('fiche.visite.confirmer.aucunCanal')}</span>
                  )}
                </div>
              </Section>
            )}
```

- [ ] **Étape 6 : La fiche passe ses deals, ses acquéreurs compatibles et son état**

La liste des visiteurs quitte la page pour le module pur ; ses compatibles ne passent qu'une fois lus (`aDesDonnees`, qui reste vrai si un rafraîchissement échoue sur des données déjà là). `enDeal` reste : il sert encore à « Qui pour ce bien ? » (`exclure`), qui écarte tout acheteur en deal — le point « En attente » de la conception (§10).

Dans `src/pages/agent/ListingDetailPage.tsx`, remplacer :

```tsx
import QuiPourFiche from '@/components/matching-fil/QuiPourFiche'
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
```

par :

```tsx
import QuiPourFiche from '@/components/matching-fil/QuiPourFiche'
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
import { CLE_FIL } from '@/components/matching-fil/filModele'
```

Dans `src/pages/agent/ListingDetailPage.tsx`, remplacer :

```tsx
import PlanifierVisite, { type VisiteurLie } from '@/components/crm/biens/fiche/PlanifierVisite'
```

par :

```tsx
import PlanifierVisite from '@/components/crm/biens/fiche/PlanifierVisite'
```

Dans `src/pages/agent/ListingDetailPage.tsx`, remplacer :

```tsx
  const enDeal = new Set(dealsForBien.map(d => d.contact_buyer_id).filter((x): x is string => !!x))
  const compatibles = quiPour.compatibles.filter(m => !enDeal.has(m.acheteur.id))
  // KYC acheteurs : rappel doux (non-bloquant).
```

par :

```tsx
  const enDeal = new Set(dealsForBien.map(d => d.contact_buyer_id).filter((x): x is string => !!x))
  // KYC acheteurs : rappel doux (non-bloquant).
```

Dans `src/pages/agent/ListingDetailPage.tsx`, remplacer :

```tsx
  const planifierVisite = () => setVisiteOpen(true)
  // Qui proposer d'abord : les acheteurs en cours sur ce bien, puis les acquéreurs compatibles.
  const liees: VisiteurLie[] = [
    ...dealsForBien.flatMap(d => {
      const c = d.contact_buyer_id ? contactsById.get(d.contact_buyer_id) : null
      return c ? [{ contactId: c.id, nom: `${c.first_name} ${c.last_name}`.trim(), dealId: d.id }] : []
    }),
    ...compatibles.map(m => ({ contactId: m.acheteur.id, nom: `${m.acheteur.prenom} ${m.acheteur.nom}`.trim(), score: m.score })),
  ].filter((l, i, tous) => tous.findIndex(x => x.contactId === l.contactId) === i)
```

par :

```tsx
  const planifierVisite = () => setVisiteOpen(true)
```

Dans `src/pages/agent/ListingDetailPage.tsx`, remplacer :

```tsx
                liees={liees}
                demo={!!demoData}
                onClose={() => setVisiteOpen(false)}
                onPlanned={() => { void queryClient.invalidateQueries({ queryKey: ['bien-visites', id] }) }}
```

par :

```tsx
                contexte={{ deals: dealsForBien, compatibles: quiPour.aDesDonnees ? quiPour.compatibles : null, enVente: bien.status === 'active' }}
                demo={!!demoData}
                onClose={() => setVisiteOpen(false)}
                onPlanned={() => {
                  void queryClient.invalidateQueries({ queryKey: ['bien-visites', id] })
                  // « Qui pour ce bien ? » aussi : la visite d'un acquéreur intéressé fait passer son match en « visite planifiée ».
                  void queryClient.invalidateQueries({ queryKey: [CLE_FIL] })
                }}
```

- [ ] **Étape 7 : Le texte de l'écran d'après, quatre langues**

Dans `src/i18n/locales/fr/listings.json`, remplacer :

```json
      "dansCalendrier": "Elle apparaît dans votre Calendrier et dans les visites du bien.",
```

par :

```json
      "dansCalendrier": "Elle apparaît dans votre Calendrier et dans les visites du bien.",
      "rienEnvoye": "Rien n’est envoyé à {{prenom}}, ni confirmation ni rappel la veille.",
```

Dans `src/i18n/locales/de/listings.json`, remplacer :

```json
      "dansCalendrier": "Sie erscheint in Ihrem Kalender und bei den Besichtigungen des Objekts.",
```

par :

```json
      "dansCalendrier": "Sie erscheint in Ihrem Kalender und bei den Besichtigungen des Objekts.",
      "rienEnvoye": "{{prenom}} erhält nichts, weder eine Bestätigung noch eine Erinnerung am Vortag.",
```

Dans `src/i18n/locales/en/listings.json`, remplacer :

```json
      "dansCalendrier": "It appears in your Calendar and in the property’s viewings.",
```

par :

```json
      "dansCalendrier": "It appears in your Calendar and in the property’s viewings.",
      "rienEnvoye": "Nothing is sent to {{prenom}}, neither a confirmation nor a reminder the day before.",
```

Dans `src/i18n/locales/it/listings.json`, remplacer :

```json
      "dansCalendrier": "Compare nel suo Calendario e nelle visite dell’immobile.",
```

par :

```json
      "dansCalendrier": "Compare nel suo Calendario e nelle visite dell’immobile.",
      "rienEnvoye": "A {{prenom}} non viene inviato nulla, né una conferma né un promemoria il giorno prima.",
```

- [ ] **Étape 8 : Relancer les tests**

```bash
npx vitest run tests/unit/fiche-planifier-visite.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/matching-sans-sortie.spec.ts
```

Attendu : PASS, `Test Files  3 passed (3)`, `Tests  81 passed (81)`.

- [ ] **Étape 9 : Vérifier**

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx eslint --quiet src/components/crm/biens/fiche/visiteurs.ts src/components/crm/biens/fiche/PlanifierVisite.tsx src/pages/agent/ListingDetailPage.tsx src/hooks/useVisitDetail.ts src/lib/matchingGestes.ts tests/unit/fiche-planifier-visite.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/matching-sans-sortie.spec.ts
```

Attendu : aucune sortie.

```bash
npm run lint:deadcode
npm run lint:i18n
npm run i18n:parity:ci
npm run i18n:coverage:ci
npm run lint:prose
```

Attendu : `✓ Aucun export mort` (`visiteursLies`, `preRemplissagePermis`, `creationVisite` et `ContexteVisite` sont lus par `PlanifierVisite`, `detailsVisite` aussi ; `dealOuvert`, `ligneVisite` et les types du module ne servent qu'en leur module et aux specs, ce que la porte tolère) ; `✓ i18n garde-fou OK` ; parité `0 manquante(s), 0 orpheline(s)` (les « possiblement non traduites » restent 1 860) ; couverture `✓ Aucune régression vs référence` (`listings` passe de 1 534 à 1 535 clés, toujours 5 non traduites) ; `✓ Typographie MEGGA OK — 56 fichiers i18n, 0 tell.`

Les gardes de la grammaire et de la sortie vers l'acheteur (aucun littéral de style ajouté ni retiré : le bloc « Confirmer au visiteur » n'est que conditionné, la ligne neuve n'écrit que des jetons) :

```bash
npx vitest run tests/unit/megga-x-grammar.spec.ts tests/unit/matching-sans-sortie.spec.ts
```

Attendu : PASS, `Test Files  2 passed (2)`, `Tests  51 passed (51)`.

Les specs qui chargent ou lisent un fichier touché — les gestes et leurs lecteurs (le fil, la Recherche, le copilote confronté), la fiche et ses gardes, les bancs du matching :

```bash
npx vitest run tests/unit/fiche-planifier-visite.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/matching-gestes-module.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/fiche-qui-pour.spec.ts tests/unit/bien-palette.spec.ts tests/unit/biens-contraste.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/megga-x-crm-tokens.spec.ts tests/unit/megga-x-source-frontiere.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/polices-domaines.spec.ts tests/unit/statut-clair.spec.ts tests/unit/redirection-ouverte.spec.ts tests/unit/region-fonctions.spec.ts tests/unit/etat-vide.spec.ts tests/unit/dev-bancs-frontiere.spec.ts tests/unit/i18n-listes.spec.ts tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/whatsapp-matching-fil.spec.ts tests/unit/matching-whatsapp-sql.spec.ts tests/unit/ajouter-selection.spec.tsx tests/unit/banc-matching-d1.spec.ts tests/unit/banc-matching-boucle.spec.ts tests/unit/banc-matching-explique.spec.ts tests/unit/nouveau-bien-completude.spec.ts tests/unit/stockage-inventaire.spec.ts
```

Attendu : PASS, `Test Files  28 passed (28)`, `Tests  501 passed (501)`. Le banc `/dev/biens` ne change pas : sans session, il ne lit ni deal ni compatible, et son seul visiteur possible, créé sur place, garde le message pré-rempli.

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint` en parallèle) :

```bash
npx vitest run
```

Attendu : `Test Files  3 failed | 340 passed (343)` ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`.

---

## Tâche 6 : « Réactiver » au journal (conception §5.2)

« Réactiver » (`execWake`, `src/lib/matchingGestes.ts`) remet un match reporté à proposer — `snoozed_until` vidé, son rappel `custom` annulé — sans rien écrire au journal, alors que « Plus tard » (`execSnooze`, action `match_reporte`) et « Écarter » (`execDismiss`, action `match_ecarte`) y écrivent leur ligne depuis le lot 1 du fil. CLAUDE.md §5 : « Audit trail : `activity_events` pour toute action ». Conception §5.2 : `execWake` écrit sa ligne, comme les deux autres. Elle prend leur forme exacte, par le même écrivain (`logEvent`) : acteur `user`, l'acheteur pour sujet (`entity_type` `contact`, `object_label` prénom et nom), la famille `deal` des gestes du matching, et les métadonnées d'« Écarter » (`match_id`, `score`) ; l'action s'appelle `match_reactive`, participe passé sans accent comme ses deux voisines (et comme `prospect_reactive`, lot C). Relevé avant d'écrire : `activity_events.action` n'a aucune contrainte en base (les CHECK de la table portent sur `actor_kind`, `category` et `severity`, baseline) ; deux registres la nomment dans le code. Le premier est le libellé de chaque action, `common:audit.action.*` dans les quatre langues, que `auditActionLabel` lit pour le journal d'audit, la cloche et la chronologie de la fiche contact mobile (`prettifyAction`) — sans lui, la ligne s'afficherait « Match reactive », l'identifiant déridé. Le second est le type de chaque action pour la cloche, `KIND_PAR_ACTION` (`useAgentNotifications.ts`), explicite pour chaque action connue : le motif `match` rangerait déjà celle-ci en « Matching », mais la table les nomme toutes, `match_reporte` et `match_ecarte` compris. La fiche contact de bureau n'affiche pas `activity_events`. Pour nommer l'agence, l'agent et l'acheteur, l'exécuteur prend la signature des deux autres, `(ctx, buyer)` : le fil passe le match reporté entier de sa liste (`FilListe` → `reactiver` → `versGeste`) ; l'atelier et l'écran mobile le retrouvent dans leur `matchIndex`, comme pour « Plus tard » — le mobile ne fait que remplir `AtelierGestes.wake`, que son écran n'appelle pas (sa section « Reportés » est différée).

Choix à valider : les métadonnées sont celles d'« Écarter » (`match_id`, `score`), sans l'échéance du report que la réactivation devance (`jusqu_au`, que porte la ligne de « Plus tard ») ; la famille `deal`, comme « Plus tard » et « Écarter » ; les libellés « Match réactivé », « Match reaktiviert », « Match reactivated », « Match riattivato », sur le vocabulaire du bouton (`fil.reactiver`) et de « Match reporté » ; le mobile et l'atelier suivent la signature (sans contexte d'agent ou sans le match dans leur index, rien n'est écrit, comme leur « Plus tard ») ; la spec de base `tests/backend/atelier-matching-loop.spec.ts`, qui rejoue à la main les écritures de « Plus tard » et de la réactivation sans leurs lignes de journal, n'est pas touchée.

**Fichiers :**
- Modifier (test) : `tests/unit/matching-fil-gestes.spec.ts`
- Modifier (exécuteur) : `src/lib/matchingGestes.ts`
- Modifier (appelants) : `src/components/matching-fil/MatchingFil.tsx`, `src/components/matching-fil/FilListe.tsx`, `src/pages/agent/MatchingAtelierPage.tsx`, `src/components/crm-mobile/matching/MmMatchingScreen.tsx`
- Modifier (type de la cloche) : `src/hooks/useAgentNotifications.ts`
- Modifier (i18n) : `src/i18n/locales/fr/common.json`, `src/i18n/locales/de/common.json`, `src/i18n/locales/en/common.json`, `src/i18n/locales/it/common.json`

- [ ] **Étape 1 : Écrire les tests qui échouent**

Trois tests, dans le bloc du journal : la réactivation écrit sa ligne, de la forme de celles de « Plus tard » et d'« Écarter » ; refusée, elle lève sans ligne au journal ; les trois actions ont leur libellé, dans les quatre langues, et le journal affiche celui de `match_reactive`.

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer :

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  execAjusterRecherche, execDismiss, execIgnorerCorrection, execPasEncore, execPlanifierVisite, execProposer,
  execProposerSelection, execReact, execRelance, execRepondre, execSnooze,
} from '@/lib/matchingGestes'
```

par :

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  execAjusterRecherche, execDismiss, execIgnorerCorrection, execPasEncore, execPlanifierVisite, execProposer,
  execProposerSelection, execReact, execRelance, execRepondre, execSnooze, execWake,
} from '@/lib/matchingGestes'
import { auditActionLabel } from '@/lib/auditActionLabel'
```

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer :

```ts
  it('Écarter ignore le match ET écrit `match_ecarte`', async () => {
    await execDismiss(CTX, ACHETEUR)
    expect(seq()).toEqual(['update:matches', 'insert:activity_events'])
    expect(ecritures()[0]!.valeurs).toEqual({ status: 'ignored' })
    expect(ecritures()[1]!.valeurs).toMatchObject({ action: 'match_ecarte', entity_id: 'c-1', metadata: { match_id: 'm-1', score: 90 } })
  })
})
```

par :

```ts
  it('Écarter ignore le match ET écrit `match_ecarte`', async () => {
    await execDismiss(CTX, ACHETEUR)
    expect(seq()).toEqual(['update:matches', 'insert:activity_events'])
    expect(ecritures()[0]!.valeurs).toEqual({ status: 'ignored' })
    expect(ecritures()[1]!.valeurs).toMatchObject({ action: 'match_ecarte', entity_id: 'c-1', metadata: { match_id: 'm-1', score: 90 } })
  })

  it('Réactiver rend le match à proposer, annule son rappel ET écrit `match_reactive`', async () => {
    await execWake(CTX, ACHETEUR)
    expect(seq()).toEqual(['update:matches', 'update:reminders', 'insert:activity_events'])
    expect(ecritures()[0]!.valeurs).toEqual({ snoozed_until: null })
    expect(ecritures()[0]!.filtres).toEqual(['id=m-1'])
    expect(ecritures()[1]!.valeurs).toEqual({ status: 'cancelled' })
    expect(ecritures()[1]!.filtres).toEqual(['match_id=m-1', 'type=custom', 'status in pending,triggered'])
    // La ligne de « Plus tard » et d'« Écarter » : même acteur, même famille, le match et son score.
    expect(ecritures()[2]!.valeurs).toMatchObject({
      agency_id: 'ag-1', actor_id: 'u-1', actor_kind: 'user', action: 'match_reactive', entity_type: 'contact',
      entity_id: 'c-1', category: 'deal', object_label: 'Julie Morand', metadata: { match_id: 'm-1', score: 90 },
    })
  })

  it('une réactivation refusée fait lever, sans ligne au journal', async () => {
    h.erreurs['update:matches'] = { message: 'refus', code: '42501' }
    await expect(execWake(CTX, ACHETEUR)).rejects.toMatchObject({ code: '42501' })
    expect(seq()).toEqual(['update:matches'])
  })

  it('les trois lignes ont leur libellé au journal, dans les quatre langues', () => {
    for (const langue of ['fr', 'de', 'en', 'it']) {
      const brut = readFileSync(join(process.cwd(), `src/i18n/locales/${langue}/common.json`), 'utf8')
      const table = (JSON.parse(brut) as { audit: { action: Record<string, string> } }).audit.action
      for (const action of ['match_reporte', 'match_ecarte', 'match_reactive']) {
        expect(table[action] ?? '', `${langue} : ${action}`).toMatch(/\S/)
      }
    }
    // Ce que le journal, la cloche et la fiche mobile affichent : sans libellé, l'identifiant déridé (« Match reactive »).
    expect(auditActionLabel('match_reactive')).toBe('Match réactivé')
  })
})
```

```bash
npx vitest run tests/unit/matching-fil-gestes.spec.ts
```

Attendu : ÉCHEC, `Tests  2 failed | 46 passed (48)` : la réactivation, `expected [ Array(2) ] to deeply equal [ 'update:matches', …(2) ]` (la ligne `insert:activity_events` manque) ; les libellés, `fr : match_reactive: expected '' to match /\S/`. Le test du refus passe déjà : un refus fait lever avant toute autre écriture, ce qui ne doit pas bouger.

- [ ] **Étape 2 : L'exécuteur écrit sa ligne**

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
 *   wake         → snoozed_until=null + reminder annulé (immédiat, hors queue)
```

par :

```ts
 *   wake         → snoozed_until=null + reminder annulé (immédiat, hors queue) + 'match_reactive'
```

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
/** Réactivation manuelle anticipée d'un reporté (parking) — immédiat */
export async function execWake(matchId: string): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ snoozed_until: null })
    .eq('id', matchId)
  if (error) throw error
  await supabase
    .from('reminders')
    .update({ status: 'cancelled' })
    .eq('match_id', matchId)
    .eq('type', 'custom')
    .in('status', ['pending', 'triggered'])
}
```

par :

```ts
/** « Réactiver » — réactivation manuelle anticipée d'un reporté (parking), immédiate ; consignée au journal */
export async function execWake(ctx: GesteContext, buyer: AcheteurGeste): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ snoozed_until: null })
    .eq('id', buyer.matchId)
  if (error) throw error
  await supabase
    .from('reminders')
    .update({ status: 'cancelled' })
    .eq('match_id', buyer.matchId)
    .eq('type', 'custom')
    .in('status', ['pending', 'triggered'])

  await logEvent(ctx, {
    action: 'match_reactive',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last}`,
    metadata: { match_id: buyer.matchId, score: buyer.score },
  })
}
```

- [ ] **Étape 3 : Les appelants passent l'agent et l'acheteur**

Le fil : la liste des reportés passe le match entier, `reactiver` en tire l'acheteur (`versGeste`), comme « Pas encore ».

Dans `src/components/matching-fil/FilListe.tsx`, remplacer :

```ts
  onChoisir: (id: string) => void
  onReactiver: (id: string) => void
```

par :

```ts
  onChoisir: (id: string) => void
  /** « Réactiver » un reporté : le match entier, dont l'acheteur que nomme sa ligne de journal. */
  onReactiver: (m: FilMatch) => void
```

Dans `src/components/matching-fil/FilListe.tsx`, remplacer :

```tsx
              <button type="button" onClick={unSeulClic(() => onReactiver(m.id))} style={{
```

par :

```tsx
              <button type="button" onClick={unSeulClic(() => onReactiver(m))} style={{
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
  const reactiver = useCallback((id: string) => {
    // Un double clic ne réveille pas deux fois (deux écritures, deux annulations de rappel).
    if (reveils.current.has(id)) return
    reveils.current.add(id)
    // ⚠ `rafraichir` rend la promesse d'invalidation : `.then(rafraichir)` l'ADOPTE, donc `.finally`
    // n'ouvre le verrou qu'une fois le rafraîchissement retombé — pas dès l'écriture de `execWake`.
    // Sans ça, un second clic pendant le rafraîchissement encore en vol rouvrait une seconde écriture.
    execWake(id).then(rafraichir)
      .catch(() => toast.error(t('fil.erreurGeste')))
      .finally(() => reveils.current.delete(id))
  }, [rafraichir, toast, t])
```

par :

```tsx
  const reactiver = useCallback((m: FilMatch) => {
    // La ligne de journal nomme l'agence et l'agent : sans contexte d'agent, rien ne s'écrit. Un double clic ne
    // réveille pas deux fois (deux écritures, deux annulations de rappel, deux lignes de journal).
    if (!ctx || reveils.current.has(m.id)) return
    reveils.current.add(m.id)
    // ⚠ `rafraichir` rend la promesse d'invalidation : `.then(rafraichir)` l'ADOPTE, donc `.finally`
    // n'ouvre le verrou qu'une fois le rafraîchissement retombé — pas dès l'écriture de `execWake`.
    // Sans ça, un second clic pendant le rafraîchissement encore en vol rouvrait une seconde écriture.
    execWake(ctx, versGeste(m).acheteur).then(rafraichir)
      .catch(() => toast.error(t('fil.erreurGeste')))
      .finally(() => reveils.current.delete(m.id))
  }, [ctx, rafraichir, toast, t])
```

L'atelier et l'écran mobile retrouvent l'acheteur dans leur `matchIndex`, comme leur « Plus tard ».

Dans `src/pages/agent/MatchingAtelierPage.tsx`, remplacer :

```tsx
    wake: matchId => { void execWake(matchId).then(refresh).catch(showError) },
```

par :

```tsx
    wake: matchId => {
      const e = matchIndex.get(matchId)
      if (!e || !ctx) return
      void execWake(ctx, e.buyer).then(refresh).catch(showError)
    },
```

Dans `src/components/crm-mobile/matching/MmMatchingScreen.tsx`, remplacer :

```tsx
    wake: (matchId) => { void execWake(matchId).then(refresh).catch(() => echec(matchId)) },
```

par :

```tsx
    wake: (matchId) => {
      const e = matchIndex.get(matchId)
      if (!e || !ctx) return
      void execWake(ctx, e.buyer).then(refresh).catch(() => echec(matchId))
    },
```

- [ ] **Étape 4 : Le libellé du journal, quatre langues, et le type de la cloche**

Dans `src/i18n/locales/fr/common.json`, remplacer :

```json
      "match_reporte": "Match reporté",
```

par :

```json
      "match_reporte": "Match reporté",
      "match_reactive": "Match réactivé",
```

Dans `src/i18n/locales/de/common.json`, remplacer :

```json
      "match_reporte": "Match zurückgestellt",
```

par :

```json
      "match_reporte": "Match zurückgestellt",
      "match_reactive": "Match reaktiviert",
```

Dans `src/i18n/locales/en/common.json`, remplacer :

```json
      "match_reporte": "Match postponed",
```

par :

```json
      "match_reporte": "Match postponed",
      "match_reactive": "Match reactivated",
```

Dans `src/i18n/locales/it/common.json`, remplacer :

```json
      "match_reporte": "Match rinviato",
```

par :

```json
      "match_reporte": "Match rinviato",
      "match_reactive": "Match riattivato",
```

Dans `src/hooks/useAgentNotifications.ts`, remplacer :

```ts
  match_reporte: 'matching', match_ecarte: 'matching', match_propose: 'matching',
```

par :

```ts
  match_reporte: 'matching', match_ecarte: 'matching', match_propose: 'matching', match_reactive: 'matching',
```

- [ ] **Étape 5 : Relancer le test**

```bash
npx vitest run tests/unit/matching-fil-gestes.spec.ts
```

Attendu : PASS, `Test Files  1 passed (1)`, `Tests  48 passed (48)`.

- [ ] **Étape 6 : Vérifier**

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx eslint --quiet src/lib/matchingGestes.ts src/components/matching-fil/MatchingFil.tsx src/components/matching-fil/FilListe.tsx src/pages/agent/MatchingAtelierPage.tsx src/components/crm-mobile/matching/MmMatchingScreen.tsx src/hooks/useAgentNotifications.ts tests/unit/matching-fil-gestes.spec.ts
```

Attendu : aucune sortie.

```bash
npm run lint:deadcode
npm run lint:i18n
npm run i18n:parity:ci
npm run i18n:coverage:ci
npm run lint:prose
```

Attendu : `✓ Aucun export mort` (aucun export ajouté ni retiré) ; `✓ i18n garde-fou OK` ; parité `0 manquante(s), 0 orpheline(s)` (les « possiblement non traduites » restent 1 860) ; couverture `✓ Aucune régression vs référence` (`common` passe de 560 à 561 clés, toujours 6 non traduites en allemand et 1 en italien) ; `✓ Typographie MEGGA OK — 56 fichiers i18n, 0 tell.`

La garde de la sortie vers l'acheteur (la ligne de journal ne sort pas de l'agence) :

```bash
npx vitest run tests/unit/matching-sans-sortie.spec.ts
```

Attendu : PASS, `Test Files  1 passed (1)`, `Tests  18 passed (18)`.

Les specs qui chargent ou lisent un fichier touché — les gestes et leur module, le journal et la cloche (ils lisent la table `audit.action`), les gardes de la grammaire, des couleurs et de la sortie, l'atelier, les bancs du matching, le fil et la confrontation du copilote, l'inventaire du stockage et les gardes i18n :

```bash
npx vitest run tests/unit/matching-fil-gestes.spec.ts tests/unit/matching-gestes-module.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/agent-notifications-scenarios.spec.ts tests/unit/agent-notifications-titles.spec.ts tests/unit/agent-notifications-perimetre.spec.tsx tests/unit/audit-journal-categories.spec.ts tests/unit/audit-journal-lignes.spec.ts tests/unit/audit-journal-acteurs.spec.tsx tests/unit/audit-journal-perimetre.spec.tsx tests/unit/messagerie-timeline.spec.ts tests/unit/messagerie-journal.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/megga-x-crm-tokens.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/matching-contraste.spec.ts tests/unit/matching-atelier-css.spec.ts tests/unit/dev-bancs-frontiere.spec.ts tests/unit/banc-matching-d1.spec.ts tests/unit/banc-matching-boucle.spec.ts tests/unit/banc-matching-explique.spec.ts tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/fil-liens-arrivee.spec.ts tests/unit/whatsapp-matching-fil.spec.ts tests/unit/stockage-inventaire.spec.ts tests/unit/i18n-listes.spec.ts tests/unit/i18n-globs-vivants.spec.ts
```

Attendu : PASS, `Test Files  28 passed (28)`, `Tests  506 passed (506)`.

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint` en parallèle) :

```bash
npx vitest run
```

Attendu : `Test Files  3 failed | 340 passed (343)` ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`.

---

## Tâche 7 : Le copilote WhatsApp suit la même règle (décision 12a, conception §5.3)

`get_matches` (copilote WhatsApp, lot D2) écarte déjà d'« à proposer » un bien qui n'est plus une OCCASION (`BienWa.occasion`, `whatsapp-matching.ts`) : une annonce que le marché a retirée, un mandat qui n'est pas `active` — et un mandat supprimé n'a pas de ligne (`lireBiens` lit `deleted_at is null`). C'est la règle « en vente » que le fil applique depuis la tâche 2, et que `whatsapp-matching-fil.spec.ts` confronte à `enVente`, statut par statut. Mais `record_match_outcome` ne la lisait pas : sa préparation (`prepareRecordMatchOutcome`, `whatsapp-matching-outils.ts`) ne retirait des biens que « propose » peut viser qu'une annonce retirée (`proposable` : `!(b.genre === 'annonce' && b.retire)`), et son commentaire disait que l'y étendre attendait l'accord de Julien. Décision de Julien du 27.09.2026 (conception §5.3) : il refuse « Je l'ai proposé » sur un mandat qui n'est plus en vente, comme `get_matches` l'écarte. `proposable` lit donc `occasion` — pour une annonce, `occasion` vaut exactement l'ancien test (`status !== 'removed'`) : rien ne change pour elles. Les deux refus qui nommaient des biens qui ne se proposent plus (une page complète où rien ne se propose, un texte qui n'a désigné que de tels biens) disaient « retirée du marché », faux pour un mandat : un refus neuf, `consignerPlusDisponible` (« n'est plus disponible », le mot de la fiche d'un mandat depuis la tâche 3 — « en vente » serait faux pour une location), en français et en anglais, au ton de son voisin, choisi par `refusNonProposables` ; des annonces seules gardent leur refus à l'identique. Les autres réponses (intéressé, pas intéressé, pas encore) se cherchent parmi les biens déjà proposés (`STATUTS_DE_DEPART`) et `aViser` ne filtre que pour « propose » : elles restent possibles sur un mandat vendu, qu'« En attente » et « À conclure » gardent. Relevé avant d'écrire : la fonction de base `wa_matching_consigner` (`20260924200000_matching_whatsapp.sql`) ne porte aucune garde de cet ordre — pour « propose », elle ne lit ni l'état du mandat ni celui de l'annonce, et `wa_matching_biens_de_l_acheteur` ne filtre pas non plus l'état — : la migration n'est pas touchée. `whatsapp-matching-fil.spec.ts` confronte `occasion` au fil ; `proposable` lit cette même règle, la confrontation reste vraie sans changer. Le refus neuf entre dans la liste des refus que la garde des confirmations simulées ne prend jamais pour une action (`whatsapp-phantom-action.test.ts`).

Choix à valider : le texte du refus — « « Villa · Cologny » n'est plus disponible : il ne se propose plus. Rien n'est consigné. » (pluriel « ne sont plus disponibles : ils ne se proposent plus »), en anglais « is no longer available: it can't be proposed any more. Nothing recorded. » —, sans l'état du mandat (vendu, réservé…), que `get_matches` donne déjà au modèle ; une annonce retirée visée avec un mandat hors vente est nommée dans le même refus « plus disponibles » ; `wa_matching_consigner` ne revérifie pas l'état du bien entre la question et le « oui » (pas plus pour une annonce retirée) : un mandat vendu dans cet intervalle serait encore consigné « proposé ».

**Fichiers :**
- Modifier (tests) : `supabase/functions/_shared/whatsapp-matching-outils.test.ts`, `supabase/functions/_shared/whatsapp-phantom-action.test.ts`
- Modifier (refus) : `supabase/functions/_shared/whatsapp-i18n.ts`
- Modifier (règle) : `supabase/functions/_shared/whatsapp-matching-outils.ts`
- Modifier (commentaire de la règle) : `supabase/functions/_shared/whatsapp-matching.ts`

- [ ] **Étape 1 : Écrire les tests qui échouent**

La préparation, sur des mandats de chaque statut : seul `active` se propose ; le refus nomme ce qui ne l'est plus, au singulier et au pluriel ; mêlé à un mandat en vente, celui-ci seul et la question ; « Ceux que je vois » ne le nomme pas ; sans texte, avec une annonce retirée ; les trois autres réponses restent possibles sur un mandat vendu déjà proposé. Le test qui figeait l'ancienne règle (« un MANDAT vendu se consigne encore « proposé » ») est remplacé. Le refus, à l'égalité exacte, en français et en anglais ; et jamais pris pour une confirmation simulée.

Dans `supabase/functions/_shared/whatsapp-matching-outils.test.ts`, remplacer :

```ts
import {
  confirmConsigner, consigne, consignerAnnonceRetiree, consignerAucunBien, consignerEchoTropLarge, consignerPlusieursBiens,
  consignerTropDeBiens, consignerTropLarge,
} from './whatsapp-i18n'
```

par :

```ts
import {
  confirmConsigner, consigne, consignerAnnonceRetiree, consignerAucunBien, consignerEchoTropLarge, consignerPlusDisponible,
  consignerPlusieursBiens, consignerTropDeBiens, consignerTropLarge,
} from './whatsapp-i18n'
```

Dans `supabase/functions/_shared/whatsapp-matching-outils.test.ts`, remplacer :

```ts
  it('un MANDAT vendu se consigne encore « proposé » : la consignation ne lit pas `occasion`, que le fil applique (décision 12a)', async () => {
    const vendu = { ...mandats[0], id: 'e0000000-0000-4000-8000-0000000000d1', status: 'sold' }
    const mS = m({ id: 'rt6', property_id: vendu.id })
    const { client } = fauxClient({ contacts, market_listings: [], properties: [vendu], matches: [mS] }, { wa_matching_biens_de_l_acheteur: [LA(mS, 'mandat', vendu)] })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'villa', reponse: 'propose' }))
      .toMatchObject({ ok: true, payload: { match_id: 'rt6', bien: VIL } })
  })
})
```

par :

```ts
})

describe('prepareRecordMatchOutcome — « propose » ne vise pas un mandat qui n’est plus en vente (lot E1, décision 12a)', () => {
  // La règle de `get_matches` et du fil : un mandat est en vente s'il est `active` et non supprimé (`occasion`) — un
  // mandat supprimé n'a déjà pas de ligne. Pour « propose » seulement : une réponse en cours se consigne encore.
  const vendu = { ...mandats[0], id: 'e0000000-0000-4000-8000-0000000000d1', title: 'Villa Vendue', address: 'Chemin Vendu 1', status: 'sold' }
  const reserve = { ...mandats[0], id: 'e0000000-0000-4000-8000-0000000000d2', title: 'Villa Réservée', address: 'Chemin Réservé 2', status: 'reserved' }
  const retiree = { id: 'd0000000-0000-4000-8000-0000000000a9', title: 'Loft Retiré', address: 'Rue du Rhône 5', city: 'Genève', price: 800_000, transaction_type: 'buy', status: 'removed' }
  const VEN = 'Villa Vendue · Chemin Vendu 1'
  const RES = 'Villa Réservée · Chemin Réservé 2'
  const RET = 'Loft Retiré · Rue du Rhône 5'
  const mVendu = m({ id: 'hv1', property_id: vendu.id, score: 90 })
  const mReserve = m({ id: 'hv2', property_id: reserve.id, score: 85 })
  const mEnVente = m({ id: 'hv3', property_id: VILLA, score: 20 })
  const mRetiree = m({ id: 'hv4', market_listing_id: retiree.id, score: 80 })
  const preparer = (matches: Ligne[], designes: Ligne[] | null, bien?: string, reponse = 'propose') => {
    const { client } = fauxClient(
      { contacts, market_listings: [retiree], properties: [...mandats, vendu, reserve], matches },
      designes ? { wa_matching_biens_de_l_acheteur: designes } : {},
    )
    return prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien, reponse, motif: 'prix' })
  }

  it('seul un mandat `active` se propose — statut par statut, le refus nomme celui qui ne l’est plus', async () => {
    for (const status of ['draft', 'active', 'reserved', 'sold', 'archived']) {
      const bien = { ...mandats[0], status }
      const mB = m({ id: 'hv0', property_id: VILLA })
      const { client } = fauxClient({ contacts, market_listings: [], properties: [bien], matches: [mB] }, { wa_matching_biens_de_l_acheteur: [LA(mB, 'mandat', bien)] })
      const p = await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'villa', reponse: 'propose' })
      if (status === 'active') expect(p, status).toMatchObject({ ok: true, payload: { match_id: 'hv0', bien: VIL } })
      else expect(p, status).toEqual({ ok: false, error: `« ${VIL} » n'est plus disponible : il ne se propose plus. Rien n'est consigné.` })
    }
  })

  it('deux qui ne sont plus en vente : au pluriel', async () => {
    expect(erreur(await preparer([mVendu, mReserve], [LA(mVendu, 'mandat', vendu), LA(mReserve, 'mandat', reserve)], 'villa')))
      .toBe(`« ${VEN} », « ${RES} » ne sont plus disponibles : ils ne se proposent plus. Rien n'est consigné.`)
  })

  it('hors vente ET en vente mêlés : celui en vente seul, et la question', async () => {
    const p = await preparer([mVendu, mEnVente], [LA(mVendu, 'mandat', vendu), LA(mEnVente, 'mandat', mandats[0])], 'villa')
    expect(p).toMatchObject({ ok: true, payload: { match_id: 'hv3', bien: VIL } })
  })

  it('« Ceux que je vois » ne nomme aucun mandat hors vente', async () => {
    expect(erreur(await preparer([mVendu, mEnVente], [], 'duplex')))
      .toBe(`Aucun bien à proposer pour Julie Martin ne correspond. Ceux que je vois : « ${VIL} ». Lequel ?`)
  })

  it('sans texte : le seul en vente se désigne de lui-même ; aucun, le refus les nomme — une annonce retirée avec eux', async () => {
    expect(await preparer([mVendu, mEnVente], null)).toMatchObject({ ok: true, payload: { match_id: 'hv3', bien: VIL } })
    expect(erreur(await preparer([mVendu, mReserve], null)))
      .toBe(`« ${VEN} », « ${RES} » ne sont plus disponibles : ils ne se proposent plus. Rien n'est consigné.`)
    // Une annonce retirée n'est plus disponible non plus : un seul refus les nomme ensemble.
    expect(erreur(await preparer([mVendu, mRetiree], null)))
      .toBe(`« ${VEN} », « ${RET} » ne sont plus disponibles : ils ne se proposent plus. Rien n'est consigné.`)
  })

  it('« interesse », « pas_interesse », « pas_encore » se consignent encore sur un mandat vendu déjà proposé : « En attente » et « À conclure » le gardent', async () => {
    const mS = m({ id: 'hv5', property_id: vendu.id, status: 'sent' })
    for (const reponse of ['interesse', 'pas_interesse', 'pas_encore']) {
      expect(await preparer([mS], [LA(mS, 'mandat', vendu)], 'villa', reponse), reponse)
        .toMatchObject({ ok: true, payload: { match_id: 'hv5', reponse, bien: VEN } })
    }
  })
})
```

Dans `supabase/functions/_shared/whatsapp-matching-outils.test.ts`, remplacer :

```ts
    expect(consignerAnnonceRetiree('en', six)).toBe(`${cinqNommes} (5 of 6) are no longer on the market: they can't be proposed any more. Nothing recorded.`)
  })
```

par :

```ts
    expect(consignerAnnonceRetiree('en', six)).toBe(`${cinqNommes} (5 of 6) are no longer on the market: they can't be proposed any more. Nothing recorded.`)
  })

  it('plus disponible (un mandat qui n’est plus en vente) : singulier, pluriel, au-delà de cinq — en français et en anglais', () => {
    expect(consignerPlusDisponible('fr', ['A'])).toBe("« A » n'est plus disponible : il ne se propose plus. Rien n'est consigné.")
    expect(consignerPlusDisponible('fr', ['A', 'B'])).toBe("« A », « B » ne sont plus disponibles : ils ne se proposent plus. Rien n'est consigné.")
    expect(consignerPlusDisponible('fr', six)).toBe(`${cinqNommes} (5 sur 6) ne sont plus disponibles : ils ne se proposent plus. Rien n'est consigné.`)
    expect(consignerPlusDisponible('en', ['A'])).toBe("« A » is no longer available: it can't be proposed any more. Nothing recorded.")
    expect(consignerPlusDisponible('en', ['A', 'B'])).toBe("« A », « B » are no longer available: they can't be proposed any more. Nothing recorded.")
    expect(consignerPlusDisponible('en', six)).toBe(`${cinqNommes} (5 of 6) are no longer available: they can't be proposed any more. Nothing recorded.`)
  })
```

Dans `supabase/functions/_shared/whatsapp-phantom-action.test.ts`, remplacer :

```ts
  consignerAucunBien, consignerPlusieursBiens, consignerTropDeBiens, consignerTropLarge, consignerEchoTropLarge,
  consignerAnnonceRetiree,
} from './whatsapp-i18n'
```

par :

```ts
  consignerAucunBien, consignerPlusieursBiens, consignerTropDeBiens, consignerTropLarge, consignerEchoTropLarge,
  consignerAnnonceRetiree, consignerPlusDisponible,
} from './whatsapp-i18n'
```

Dans `supabase/functions/_shared/whatsapp-phantom-action.test.ts`, remplacer :

```ts
      consignerAnnonceRetiree('fr', [bien, autreBien]), consignerAnnonceRetiree('en', [bien, autreBien]),
    ]) expect(detectPhantomAction(s), s).toBeNull()
```

par :

```ts
      consignerAnnonceRetiree('fr', [bien, autreBien]), consignerAnnonceRetiree('en', [bien, autreBien]),
      consignerPlusDisponible('fr', [bien]), consignerPlusDisponible('en', [bien]),
      consignerPlusDisponible('fr', [bien, autreBien]), consignerPlusDisponible('en', [bien, autreBien]),
    ]) expect(detectPhantomAction(s), s).toBeNull()
```

```bash
npx vitest run supabase/functions/_shared/whatsapp-matching-outils.test.ts supabase/functions/_shared/whatsapp-phantom-action.test.ts
```

Attendu : ÉCHEC, `Tests  7 failed | 255 passed (262)` : statut par statut, `draft: expected { ok: true, …(2) } to deeply equal { ok: false, …(1) }` ; le pluriel, `expected 'Plusieurs biens pour Julie Martin cor…' to be '« Villa Vendue · Chemin Vendu 1 », « …'` ; les mêlés et « sans texte », `expected { ok: false, …(1) } to match object { ok: true, payload: { …(2) } }` (le mandat vendu est encore un candidat : « Plusieurs biens ») ; « Ceux que je vois », `expected 'Aucun bien à proposer pour Julie Mart…' to be 'Aucun bien à proposer pour Julie Mart…'` (la liste nomme encore la villa vendue) ; le refus à l'égalité et la garde des confirmations simulées, `TypeError: consignerPlusDisponible is not a function`. Le test des trois autres réponses passe déjà : il garde ce qui ne doit pas bouger.

- [ ] **Étape 2 : Le refus, en français et en anglais**

Dans `supabase/functions/_shared/whatsapp-i18n.ts`, remplacer :

```ts
 * Sans texte, la page des matchs de l'acheteur a été coupée et aucun de ses biens ne se nomme (mandats supprimés,
 * annonces retirées pour « propose ») : ni « aucun bien » (il y en a plus d'une page), ni une liste vide
 * (« correspondent : . »). Le copilote demande lequel.
```

par :

```ts
 * Sans texte, la page des matchs de l'acheteur a été coupée et aucun de ses biens ne se nomme (mandats supprimés ;
 * pour « propose », annonces retirées et mandats qui ne sont plus en vente) : ni « aucun bien » (il y en a plus d'une
 * page), ni une liste vide (« correspondent : . »). Le copilote demande lequel.
```

Dans `supabase/functions/_shared/whatsapp-i18n.ts`, remplacer :

```ts
 * plus ; rien n'est consigné. Les MANDATS n'ont pas cette règle ici : la consignation ne lit pas leur `occasion`
 * (`proposable`, whatsapp-matching-outils.ts).
```

par :

```ts
 * plus ; rien n'est consigné. Un mandat qui n'est plus en vente a son propre refus, `consignerPlusDisponible`
 * (`proposable`, whatsapp-matching-outils.ts).
```

Ajouter à la fin de `supabase/functions/_shared/whatsapp-i18n.ts` :

```ts

/**
 * `propose` sur un mandat qui n'est plus EN VENTE (lot E1, décision 12a de Julien) : vendu, réservé, archivé ou
 * redevenu brouillon, il ne se propose plus — `get_matches` et le fil l'écartent d'« à proposer ». « Plus
 * disponible » vaut aussi pour une annonce retirée que l'agent visait avec lui : elles sont nommées ensemble. Cinq au
 * plus ; rien n'est consigné.
 */
export function consignerPlusDisponible(lang: WaLang, titres: readonly string[]): string {
  const liste = nommer(titres) + compteEnClair(lang, titres.length, null)
  const pluriel = titres.length > 1
  if (lang === 'en') {
    return pluriel
      ? `${liste} are no longer available: they can't be proposed any more. Nothing recorded.`
      : `${liste} is no longer available: it can't be proposed any more. Nothing recorded.`
  }
  return pluriel
    ? `${liste} ne sont plus disponibles : ils ne se proposent plus. Rien n'est consigné.`
    : `${liste} n'est plus disponible : il ne se propose plus. Rien n'est consigné.`
}
```

- [ ] **Étape 3 : « propose » lit `occasion`, et le refus se choisit sur ce qui est visé**

Dans `supabase/functions/_shared/whatsapp-matching-outils.ts`, remplacer :

```ts
  consignerQuelAcheteur, consignerQuelleReponse, consignerTropDeBiens, consignerTropLarge, consignerAnnonceRetiree,
  undoHint, type Consignation,
} from './whatsapp-i18n.ts'
```

par :

```ts
  consignerQuelAcheteur, consignerQuelleReponse, consignerTropDeBiens, consignerTropLarge, consignerAnnonceRetiree,
  consignerPlusDisponible, undoHint, type Consignation, type WaLang,
} from './whatsapp-i18n.ts'
```

Dans `supabase/functions/_shared/whatsapp-matching-outils.ts`, remplacer :

```ts
/**
 * Ce que « propose » peut viser. Une annonce RETIRÉE ne se propose plus — le fil n'en offre aucune à proposer
 * (`FilSelectionResume`, filModele.ts), et `NOTE_MODELE` le dit au modèle : la consigner créerait un deal et une
 * relance sur un bien parti. Un mandat garde sa place quel que soit son statut : cette consignation ne lit pas son
 * `occasion`, que le fil et `get_matches` appliquent (décision 12a) — l'y étendre attend l'accord de Julien.
 */
const proposable = (b: BienWa): boolean => !(b.genre === 'annonce' && b.retire)

const libelles = (biens: readonly Option[]): string[] => biens.map((b) => libelleBien(b))
```

par :

```ts
/**
 * Ce que « propose » peut viser : un bien qui est encore une OCCASION (`occasion`, whatsapp-matching.ts) — une annonce
 * que le marché n'a pas retirée, un mandat en vente (`active` ; un mandat supprimé n'a pas de ligne, `lireBiens`). La
 * règle de `get_matches` et du fil, une seule (lot E1, décision 12a de Julien, 27.09.2026) : le fil n'offre aucun
 * autre bien à proposer, et `NOTE_MODELE` le dit au modèle — le consigner créerait un deal et une relance sur un bien
 * parti. Les autres réponses visent un bien déjà proposé, qu'« En attente » et « À conclure » gardent.
 */
const proposable = (b: BienWa): boolean => b.occasion

const libelles = (biens: readonly Option[]): string[] => biens.map((b) => libelleBien(b))

/**
 * Le refus de « propose » quand aucun des biens visés ne se propose plus : il les nomme, rien n'est consigné. Que des
 * annonces : « retirées du marché » ; un mandat qui n'est plus en vente parmi eux : « plus disponibles », ce qu'est
 * aussi une annonce retirée.
 */
const refusNonProposables = (lang: WaLang, biens: readonly Option[]): string =>
  biens.every((b) => b.genre === 'annonce')
    ? consignerAnnonceRetiree(lang, libelles(biens))
    : consignerPlusDisponible(lang, libelles(biens))
```

Dans `supabase/functions/_shared/whatsapp-matching-outils.ts`, remplacer :

```ts
    // Complète, la page dit tout : n'y voir que des annonces retirées, c'est le dire plutôt que « aucun bien ».
    if (page.plancher == null && !vises.length && page.options.length) {
      return { ok: false, error: consignerAnnonceRetiree(lang, libelles(page.options)) }
    }
```

par :

```ts
    // Complète, la page dit tout : n'y voir que des biens qui ne se proposent plus, c'est le dire plutôt que « aucun bien ».
    if (page.plancher == null && !vises.length && page.options.length) {
      return { ok: false, error: refusNonProposables(lang, page.options) }
    }
```

Dans `supabase/functions/_shared/whatsapp-matching-outils.ts`, remplacer :

```ts
  if (!vises.length && trouves.length) return { ok: false, error: consignerAnnonceRetiree(lang, libelles(trouves)) }
```

par :

```ts
  if (!vises.length && trouves.length) return { ok: false, error: refusNonProposables(lang, trouves) }
```

La règle nomme son nouveau lecteur.

Dans `supabase/functions/_shared/whatsapp-matching.ts`, remplacer :

```ts
   * n'est plus une occasion »). Le fil l'applique aussi (lot E1, décision 12a de Julien : `enVente`, `versBien`) ;
   * `tests/unit/whatsapp-matching-fil.spec.ts` confronte les deux.
   */
  occasion: boolean
```

par :

```ts
   * n'est plus une occasion »). Le fil l'applique aussi (lot E1, décision 12a de Julien : `enVente`, `versBien`) ;
   * `tests/unit/whatsapp-matching-fil.spec.ts` confronte les deux. « propose » de `record_match_outcome` la lit
   * aussi (`proposable`, whatsapp-matching-outils.ts).
   */
  occasion: boolean
```

- [ ] **Étape 4 : Relancer les tests**

```bash
npx vitest run supabase/functions/_shared/whatsapp-matching-outils.test.ts supabase/functions/_shared/whatsapp-phantom-action.test.ts
```

Attendu : PASS, `Test Files  2 passed (2)`, `Tests  262 passed (262)`.

- [ ] **Étape 5 : Vérifier**

`deno check --no-lock` est le seul filet de type du code Deno : les trois modules touchés, puis les cinq fonctions qui les importent.

```bash
deno check --no-lock supabase/functions/_shared/whatsapp-matching-outils.ts supabase/functions/_shared/whatsapp-i18n.ts supabase/functions/_shared/whatsapp-matching.ts
deno check --no-lock supabase/functions/ai-copilot/index.ts supabase/functions/whatsapp-agent-async/index.ts supabase/functions/whatsapp-morning-brief/index.ts supabase/functions/whatsapp-agent/index.ts supabase/functions/whatsapp-webhook/index.ts
```

Attendu : sortie 0, une ligne `Check` par fichier.

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx eslint --quiet supabase/functions/_shared/whatsapp-matching-outils.ts supabase/functions/_shared/whatsapp-i18n.ts supabase/functions/_shared/whatsapp-matching.ts supabase/functions/_shared/whatsapp-matching-outils.test.ts supabase/functions/_shared/whatsapp-phantom-action.test.ts
npm run lint:deadcode
npm run lint:whatsapp-outbound
```

Attendu : ESLint sans sortie ; `✓ Aucun export mort` (`consignerPlusDisponible` est lu par `whatsapp-matching-outils.ts`) ; `✓ Chemin sortant WhatsApp — 16 appel(s) à la garde, tous à finalité lisible.` (le refus neuf n'envoie rien : il est rendu au modèle, puis à l'agent). Aucune clé i18n du CRM n'est touchée : les portes i18n ne sont pas concernées.

La garde de la sortie vers l'acheteur (elle lit les modules du copilote) :

```bash
npx vitest run tests/unit/matching-sans-sortie.spec.ts
```

Attendu : PASS, `Test Files  1 passed (1)`, `Tests  18 passed (18)`.

Les specs qui chargent ou lisent un module touché — les outils du copilote et son modèle pur, ses phrases et leurs gardes, le routeur et les confirmations, le point du matin, la confrontation au fil (inchangée : `proposable` lit `occasion`, qu'elle confronte à `enVente`), la migration lue :

```bash
npx vitest run supabase/functions/_shared/whatsapp-matching-outils.test.ts supabase/functions/_shared/whatsapp-matching.test.ts supabase/functions/_shared/whatsapp-phantom-action.test.ts supabase/functions/_shared/whatsapp-i18n.test.ts supabase/functions/_shared/whatsapp-actions.test.ts supabase/functions/_shared/whatsapp-confirm-buttons.test.ts supabase/functions/_shared/whatsapp-agent-router.test.ts supabase/functions/_shared/morning-brief.test.ts supabase/functions/_shared/morning-brief-data.test.ts tests/unit/whatsapp-matching-fil.spec.ts tests/unit/matching-whatsapp-sql.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/whatsapp-confirm-tools.spec.ts
```

Attendu : PASS, `Test Files  13 passed (13)`, `Tests  730 passed (730)`.

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint`, ni `deno` en parallèle) :

```bash
npx vitest run
```

Attendu : `Test Files  3 failed | 340 passed (343)` ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`.

---

## Tâche 8 : Le titre de « Sa boucle » compte ce qu'il liste (conception §5.5)

La page « Sa boucle » de la fiche contact (`CdBoucle`, `ContactDetailPager.tsx`) montre en tête ses compteurs (`loop.compteurs`) et, dans sa colonne de droite, la liste de ses biens sous le titre « Biens proposés (N) » (`fiche.loop.transmittedCount`, sur `loop.biens.length`). Depuis la tâche 4, un bien revenu n'est plus compté parmi les « Proposés » mais reste dans la liste, avec sa pastille « Revenu » : une fiche qui en a un disait « 4 Proposés » au-dessus de « Biens proposés (5) ». Décision de Julien du 27.09.2026 (conception §5.5) : le titre devient neutre et compte ce qu'il liste — « Ses biens (5) ». La clé suit la forme de ses voisines (`toHandleCount` : une chaîne unique « … ({{count}}) », pas un pluriel i18next) et prend un nom qui dit ce qu'elle compte, `propertiesCount` : « transmitted » décrivait l'envoi au client, que le CRM ne fait plus depuis le 21.09.2026. Quatre langues, au ton des titres de la fiche (« Ses informations », « Sa boucle » ; « Sein Verlauf », « Their information », « Il suo percorso ») : « Ses biens », « Seine Objekte », « Their properties », « I suoi immobili ». Elle n'a qu'un lecteur, la fiche de bureau : l'écran mobile d'un contact ne la lit pas — son onglet « Matching » (`MatchingTab`, `MobileContactDetailScreen.tsx`) n'a pas de titre compté, seulement le sur-titre « Estimation IA », et le mobile reste en l'état jusqu'au lot E2. Aucune spec ne monte la page ; la garde lit la fiche et les quatre fichiers de langue. Le commentaire du sur-titre de bloc (`CdGrp`) nommait le bloc par son titre : il suit.

Choix à valider : le renommage de la clé (`transmittedCount` → `propertiesCount`) ; les textes allemand, anglais et italien.

**Fichiers :**
- Modifier (test) : `tests/unit/sa-boucle.spec.ts`
- Modifier (fiche) : `src/components/crm/contacts-pager/ContactDetailPager.tsx`
- Modifier (i18n) : `src/i18n/locales/fr/contacts.json`, `src/i18n/locales/de/contacts.json`, `src/i18n/locales/en/contacts.json`, `src/i18n/locales/it/contacts.json`

- [ ] **Étape 1 : Écrire les tests qui échouent**

La fiche écrit le titre de la liste par la clé neuve, sur la longueur de la liste qu'elle rend ; les quatre langues portent le titre neutre, et l'ancienne clé n'existe plus. Que la liste compte un bien revenu sans le compter « Proposé » est déjà gardé (`les compteurs : … un bien revenu n'est pas « Proposé »`, `biens` de longueur 5, `proposes` à 4).

Dans `tests/unit/sa-boucle.spec.ts`, remplacer :

```ts
 * Lot E1 : un bien revenu ne compte plus parmi les « Proposés », comme dans le fil (décision 10a) ; sur un mandat qui
 * n'est plus en vente, il ne mène plus nulle part (décision 12a) ; un mandat supprimé n'a pas de ligne, même lu par un
 * super-administrateur.
 */
```

par :

```ts
 * Lot E1 : un bien revenu ne compte plus parmi les « Proposés », comme dans le fil (décision 10a) ; sur un mandat qui
 * n'est plus en vente, il ne mène plus nulle part (décision 12a) ; un mandat supprimé n'a pas de ligne, même lu par un
 * super-administrateur ; le titre de la liste, neutre, compte ce qu'elle liste, biens revenus compris.
 */
```

Dans `tests/unit/sa-boucle.spec.ts`, remplacer :

```ts
describe('lot E1 — la lecture de « Sa boucle » (`useContactSentMatches`)', () => {
  it('la jointure d’un mandat porte son état et sa suppression : sans eux, « en vente » ne se lit pas', () => {
    const source = readFileSync(join(process.cwd(), 'src/hooks/useContactSentMatches.ts'), 'utf8')
    const colonnes = /property:properties\(([^)]*)\)/.exec(source)?.[1]?.split(',').map((c) => c.trim()) ?? []
    expect(colonnes).toEqual(expect.arrayContaining(['status', 'deleted_at']))
  })
})
```

par :

```ts
describe('lot E1 — la lecture de « Sa boucle » (`useContactSentMatches`)', () => {
  it('la jointure d’un mandat porte son état et sa suppression : sans eux, « en vente » ne se lit pas', () => {
    const source = readFileSync(join(process.cwd(), 'src/hooks/useContactSentMatches.ts'), 'utf8')
    const colonnes = /property:properties\(([^)]*)\)/.exec(source)?.[1]?.split(',').map((c) => c.trim()) ?? []
    expect(colonnes).toEqual(expect.arrayContaining(['status', 'deleted_at']))
  })
})

describe('lot E1 — le titre de la liste compte ce qu’elle liste', () => {
  // La liste porte aussi les biens revenus, qui ne sont pas « Proposés » (décision 10a) : « Biens proposés (5) » sous
  // « 4 Proposés » se contredisait. Un titre neutre, sur la longueur de la liste (décision de Julien, 27.09.2026).
  const TITRES: Record<string, string> = {
    fr: 'Ses biens ({{count}})', de: 'Seine Objekte ({{count}})', en: 'Their properties ({{count}})', it: 'I suoi immobili ({{count}})',
  }

  it('la fiche l’écrit par `fiche.loop.propertiesCount`, sur `loop.biens.length`, la liste qu’elle rend dessous', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/crm/contacts-pager/ContactDetailPager.tsx'), 'utf8')
    expect(source).toContain("{t('fiche.loop.propertiesCount', { count: loop.biens.length })}")
    expect(source).toContain('{loop.biens.map((b, i) => <CdBienBoucle')
    expect(source).not.toContain('fiche.loop.transmittedCount')
  })

  it('neutre, dans les quatre langues : il ne dit plus « proposés »', () => {
    for (const [langue, titre] of Object.entries(TITRES)) {
      const brut = readFileSync(join(process.cwd(), `src/i18n/locales/${langue}/contacts.json`), 'utf8')
      const loop = (JSON.parse(brut) as { fiche: { loop: Record<string, string> } }).fiche.loop
      expect(loop.propertiesCount, langue).toBe(titre)
      expect(loop, langue).not.toHaveProperty('transmittedCount')
    }
  })
})
```

```bash
npx vitest run tests/unit/sa-boucle.spec.ts
```

Attendu : ÉCHEC, `Tests  2 failed | 22 passed (24)` : la fiche, `expected '// MEGGA CRM — Fiche détail Contact «…' to contain '{t(\'fiche.loop.propertiesCount\', { …'` ; les langues, `fr: expected undefined to be 'Ses biens ({{count}})'`.

- [ ] **Étape 2 : La fiche lit la clé neuve**

Dans `src/components/crm/contacts-pager/ContactDetailPager.tsx`, remplacer :

```tsx
 * Sur-titre de BLOC — 14 px / 600, casse normale. Quatre emplois : Coordonnées,
 * Ce qu'elle cherche, À traiter, Biens proposés (plus le bloc Note, qui porte le
```

par :

```tsx
 * Sur-titre de BLOC — 14 px / 600, casse normale. Quatre emplois : Coordonnées,
 * Ce qu'elle cherche, À traiter, Ses biens (plus le bloc Note, qui porte le
```

Dans `src/components/crm/contacts-pager/ContactDetailPager.tsx`, remplacer :

```tsx
                <CdGrp P={P}>{t('fiche.loop.transmittedCount', { count: loop.biens.length })}</CdGrp>
```

par :

```tsx
                <CdGrp P={P}>{t('fiche.loop.propertiesCount', { count: loop.biens.length })}</CdGrp>
```

- [ ] **Étape 3 : Le titre neutre, quatre langues**

La clé change de nom à sa place, entre `toHandleCount` et `openInMatching`.

Dans `src/i18n/locales/fr/contacts.json`, remplacer :

```json
      "transmittedCount": "Biens proposés ({{count}})",
```

par :

```json
      "propertiesCount": "Ses biens ({{count}})",
```

Dans `src/i18n/locales/de/contacts.json`, remplacer :

```json
      "transmittedCount": "Vorgeschlagene Objekte ({{count}})",
```

par :

```json
      "propertiesCount": "Seine Objekte ({{count}})",
```

Dans `src/i18n/locales/en/contacts.json`, remplacer :

```json
      "transmittedCount": "Properties proposed ({{count}})",
```

par :

```json
      "propertiesCount": "Their properties ({{count}})",
```

Dans `src/i18n/locales/it/contacts.json`, remplacer :

```json
      "transmittedCount": "Immobili proposti ({{count}})",
```

par :

```json
      "propertiesCount": "I suoi immobili ({{count}})",
```

- [ ] **Étape 4 : Relancer le test**

```bash
npx vitest run tests/unit/sa-boucle.spec.ts
```

Attendu : PASS, `Test Files  1 passed (1)`, `Tests  24 passed (24)`.

- [ ] **Étape 5 : Vérifier**

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx eslint --quiet src/components/crm/contacts-pager/ContactDetailPager.tsx tests/unit/sa-boucle.spec.ts
```

Attendu : aucune sortie.

```bash
npm run lint:deadcode
npm run lint:i18n
npm run i18n:parity:ci
npm run i18n:coverage:ci
npm run lint:prose
```

Attendu : `✓ Aucun export mort` ; `✓ i18n garde-fou OK` ; parité `0 manquante(s), 0 orpheline(s)` (les « possiblement non traduites » restent 1 860) ; couverture `✓ Aucune régression vs référence` (`contacts` reste à 892 clés : une clé renommée, aucune ajoutée) ; `✓ Typographie MEGGA OK — 56 fichiers i18n, 0 tell.`

La garde de la sortie vers l'acheteur :

```bash
npx vitest run tests/unit/matching-sans-sortie.spec.ts
```

Attendu : PASS, `Test Files  1 passed (1)`, `Tests  18 passed (18)`.

Les specs qui chargent ou lisent la fiche ou ses fichiers de langue — « Sa boucle » et les bancs qui la montent, les gardes des contacts, de la grammaire, des couleurs, des polices et des états vides, les bancs, les gardes i18n et l'inventaire du stockage :

```bash
npx vitest run tests/unit/sa-boucle.spec.ts tests/unit/banc-matching-d1.spec.ts tests/unit/banc-matching-boucle.spec.ts tests/unit/banc-matching-explique.spec.ts tests/unit/banc-contacts-roles.spec.ts tests/unit/banc-supabase.spec.ts tests/unit/contacts-contraste.spec.ts tests/unit/contacts-note-contrat.spec.ts tests/unit/contacts-roles-vocabulaire.spec.ts tests/unit/etat-vide.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/megga-x-crm-tokens.spec.ts tests/unit/megga-x-source-frontiere.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/polices-domaines.spec.ts tests/unit/statut-clair.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/dev-bancs-frontiere.spec.ts tests/unit/i18n-listes.spec.ts tests/unit/i18n-globs-vivants.spec.ts tests/unit/stockage-inventaire.spec.ts
```

Attendu : PASS, `Test Files  21 passed (21)`, `Tests  236 passed (236)`. Les bancs `/dev/crm` et `/dev/contacts` montent la même fiche : leur liste s'intitule « Ses biens (N) » sans qu'une fixture change.

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint` en parallèle) :

```bash
npx vitest run
```

Attendu : `Test Files  3 failed | 340 passed (343)` ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`.

---

## Tâche 9 : La renotation dans le moteur (décision B, conception §5.7)

Mesuré en production le 27.09.2026 : `app_config.matching_scoring_v2.version` vaut 3 et, parmi les 1 837 matchs à proposer, 1 249 portent la version 3, 113 la version 2 et 475 aucune. Rien ne les renote : la création est en `ON CONFLICT DO NOTHING` (`insert_*_matches`, migration `20260614130100`) ; le déclencheur des critères (`on_search_criteria_updated`) relance bien le moteur en `match-contact`, mais celui-ci ne fait que créer les couples neufs, et le scan de nuit (`daily-matching-scan`, `0 5 * * *`, qui appelle `scan-all` agence par agence) de même. Décision B de Julien (conception §5.7) : `match-contact` renote aussi les matchs à proposer existants de chaque recherche active du contact, avec ses critères du moment ; `scan-all` renote chaque nuit ceux qu'une version antérieure du barème a notés, sans version compris, 2 000 au plus par agence ; un seul écrivain, celui du lot B (`matching_appliquer_notes` : sous le seuil ou hors du pré-filtre, `ignored` et motif `recherche_ajustee`) ; une ligne au journal par recherche renotée (`matching_ajuster_recherche` sans clé ni refus : `matchs_reevalues`, avec son bilan) ; seuls les matchs à proposer. **Aucune migration** : les deux fonctions du lot B suffisent. La mécanique de `rescore-search` (« Apprendre ») est factorisée plutôt que recopiée — `matchsDeLaRecherche` (la lecture paginée), `ecrireNotes` (les biens, `renoter`, les notes par lots), `bilanDes` (le bilan) — ; `rescore-search` garde son ordre et sa ligne `recherche_ajustee`, et `reevaluerRecherche` sert `match-contact` et `scan-all`. `match-contact` renote AVANT de créer (le bilan ne compte pas les couples qu'il fait naître) ; `scan-all` rattrape APRÈS (ceux-là portent la version courante, et un échec du rattrapage ne coûte pas à la nuit ses nouveaux matchs). La lecture de nuit filtre `status = 'suggested'` et `score_version` nulle ou inférieure à la courante, dans l'ordre de `idx_matches_agency_focus` (`agency_id, contact_id, score desc`, puis `id`), par pages de 1 000 (`max_rows`), et s'arrête dès que 2 000 couples sont choisis ; le choix est une fonction pure, `aRattraper` : à proposer, d'une recherche active, groupés par recherche, dans l'ordre de lecture. Les réponses de `match-contact` et `scan-all` disent `reevalues` et `ecartes`.

⛔ **La ligne au journal ne s'écrit que si un match de la recherche a changé de note ou de statut** (relecture du 27.09.2026) : une ligne pour une recherche où rien n'a bougé est du bruit, et c'est le cas courant — le `match-contact` qu'une correction d'« Apprendre » déclenche renote les mêmes matchs aux mêmes notes, et `match-contact` renote TOUTES les recherches actives du contact quand une seule a changé (le déclencheur ne dit pas laquelle). Les notes, elles, s'écrivent toujours : la version du barème tamponnée, sans quoi la nuit suivante les reprendrait. La règle est une fonction pure, `aJournaliser` : parmi les notes que la base a écrites (un match sorti d'« À proposer » entre la lecture et l'écriture n'en reçoit pas), une écarte son match, ou lui donne un autre score que celui lu avant d'écrire — score et statut suffisent. Le score entre donc dans la lecture (`COLS_MATCH_NOTE`). `rescore-search` écrit toujours sa ligne : elle porte la correction.

⚠ `renoter()` ne sautait pas les couples sans version par oubli : son en-tête et la conception du lot B (§12) le disent, la Recherche (« Ajouter à la sélection de … », `useAjouterSelection`) crée des matchs à proposer SANS version, que l'agent a choisis ; les renoter les écarterait sous le seuil, et déferait une décision humaine — la spec de base B7 (`matching-boucle.spec.ts`) garde ce match à 70. La raison interdit donc de renoter TOUT couple sans version. La voie la plus simple, prise ici : les distinguer par leurs raisons. La Recherche écrit `{ keys: [...] }`, ou rien ; le moteur écrit ses axes (`budget`, `zone`, `type`, `rooms`, `features` — en objets depuis la version 2, en booléens comme les décrit `docs/schema.md`). Sans version et sans axe du moteur, un match est un ajout à la main (`ajouteALaMain`) : jamais renoté, et il ne compte pas dans le plafond de la nuit. Mesuré en production le 27.09.2026 (lecture seule) : les 1 362 couples à proposer versionnés et les 475 sans version portent TOUS les axes du moteur et une recherche — aucun ajout à la main aujourd'hui ; la distinction est retenue telle quelle. `renoter()` ne note plus non plus qu'un match à proposer (`status`, lu avec lui) : un bien déjà proposé garde sa note (§3.5), garde pure que la conception demande (§8). Trois commentaires disaient que le moteur ne renote jamais une paire existante — l'en-tête de `useMatchingFil.ts`, la boucle du banc (`crmFixtures.ts`) et sa confrontation (`banc-matching-boucle.spec.ts`) : ils suivent (le banc est noté à la version courante, rien ne le renote).

Choix à valider : (1) la ligne est signée `system` pour le déclencheur et la nuit, l'agent (`user`) pour un appel à son jeton (« Lancer » du téléphone, qui est un `scan-all` : le plafond vaut par scan) — `matching_ajuster_recherche` n'écrit pas `ai` sans migration ; (2) le bilan gagne `mode`, pour les trois modes (`recherche_ajustee` compris), et `reevalues` y compte les matchs réécrits, changés ou non ; (3) un bien revenu (refusé pour le prix, revenu par une baisse, donc `suggested`) se renote comme tout match à proposer, ainsi que le fait `rescore-search` depuis le lot B : sous le seuil, il passe `ignored` / `recherche_ajustee`.

**Fichiers :**
- Modifier (tests) : `tests/unit/matching-renotation.spec.ts`
- Créer (spec de base) : `tests/backend/matching-renotation.spec.ts`
- Modifier (modèle pur) : `supabase/functions/_shared/matching-renotation.ts`
- Modifier (moteur) : `supabase/functions/matching-engine/index.ts`
- Modifier (commentaires qui disaient que le moteur ne renote jamais) : `src/hooks/useMatchingFil.ts`, `src/pages/dev/crmFixtures.ts`, `tests/unit/banc-matching-boucle.spec.ts`

- [ ] **Étape 1 : Écrire les tests qui échouent**

Le modèle pur : un couple sans version que le moteur a noté (ses axes, en objets ou en booléens) se renote, un ajout à la main (`{ keys }`, `{}`, rien) jamais ; un bien déjà proposé, quel que soit son statut, n'a pas de note ; le choix du scan de nuit (`aRattraper`) — versions antérieures et sans version, ni la courante ni une ultérieure, ni un ajout à la main, ni un bien déjà proposé, ni une recherche close ou absente, groupés par recherche dans l'ordre de lecture, `plafond` au plus, 2 000 par défaut ; ce qui se journalise (`aJournaliser`) — les mêmes notes sans rien d'écarté, rien ; une note qui change, à la hausse ou à la baisse, ou un match écarté même à note égale, une ligne. Le test de l'ajout à la main existait : il nomme désormais ses trois formes.

Dans `tests/unit/matching-renotation.spec.ts`, remplacer :

```ts
/**
 * « Apprendre » côté moteur (lot B) : la réévaluation des matchs à proposer d'une recherche ajustée rejoue
 * le VRAI barème (`calculateScoreV2`) ET le pré-filtre dur du moteur, écarte ce qu'il ne créerait pas
 * aujourd'hui, et ne touche pas un match ajouté à la main. La correction part en UNE clé, fusionnée dans les
 * critères d'aujourd'hui. Module pur de l'edge `matching-engine`, mode `rescore-search`.
 */
import { describe, expect, it, vi } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'
import {
  fusionnerCorrection, lireCorrection, lireRefus, renoter, tranches, type MatchARenoter,
} from '../../supabase/functions/_shared/matching-renotation'
```

par :

```ts
/**
 * « Apprendre » côté moteur (lot B) : la réévaluation des matchs à proposer d'une recherche ajustée rejoue
 * le VRAI barème (`calculateScoreV2`) ET le pré-filtre dur du moteur, écarte ce qu'il ne créerait pas
 * aujourd'hui, et ne touche pas un match ajouté à la main. La correction part en UNE clé, fusionnée dans les
 * critères d'aujourd'hui. Module pur de l'edge `matching-engine`, modes `rescore-search`, `match-contact` et
 * `scan-all`.
 *
 * Lot E1 (la renotation) : un couple que le moteur a noté avant les versions se renote, un ajout à la main
 * jamais, ni un bien déjà proposé ; le scan de nuit choisit ses couples (`aRattraper`) ; une renotation qui ne
 * change rien ne se journalise pas (`aJournaliser`).
 */
import { describe, expect, it, vi } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'
import {
  aJournaliser, aRattraper, fusionnerCorrection, lireCorrection, lireRefus, PLAFOND_RATTRAPAGE, renoter, tranches,
  type MatchARattraper, type MatchARenoter, type NoteMatch,
} from '../../supabase/functions/_shared/matching-renotation'
```

Dans `tests/unit/matching-renotation.spec.ts`, remplacer :

```ts
const match = (id: string, bienId: string, champs: Partial<MatchARenoter> = {}): MatchARenoter => ({
  id, property_id: null, market_listing_id: bienId, score_version: 4, ...champs,
})
const sansLoyer = () => null
```

par :

```ts
/** Des raisons que le moteur a écrites : ses axes, en objets depuis la version 2. */
const RAISONS_MOTEUR = { budget: { match: true, score: 32, detail: 'Dans le budget' } }
const match = (id: string, bienId: string, champs: Partial<MatchARenoter> = {}): MatchARenoter => ({
  id, property_id: null, market_listing_id: bienId, status: 'suggested', score: 80, score_version: 4, reasons: RAISONS_MOTEUR,
  ...champs,
})
const sansLoyer = () => null
```

Dans `tests/unit/matching-renotation.spec.ts`, remplacer :

```ts
  it('un match ajouté à la main (sans `score_version`), ou dont le bien est illisible, n’est pas renoté', () => {
    expect(renoter(
      [match('m-main', 'ml-2', { score_version: null }), match('m-perdu', 'ml-inconnue')],
      biens, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer,
    )).toEqual([])
  })
```

par :

```ts
  it('un match ajouté à la main (ni version, ni axe du moteur), ou dont le bien est illisible, n’est pas renoté', () => {
    // La Recherche écrit `{ keys: [...] }`, ou rien : l'agent a choisi ces biens.
    expect(renoter(
      [
        match('m-main', 'ml-2', { score_version: null, reasons: { keys: ['budget', 'zone'] } }),
        match('m-main-vide', 'ml-2', { score_version: null, reasons: {} }),
        match('m-main-nul', 'ml-2', { score_version: null, reasons: null }),
        match('m-perdu', 'ml-inconnue'),
      ],
      biens, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer,
    )).toEqual([])
  })

  it('un couple que le moteur a noté AVANT les versions (sans `score_version`, ses axes dans `reasons`) est renoté', () => {
    // Ses raisons portent les axes du moteur — en objets, ou en booléens comme les décrit docs/schema.md : c'est lui
    // qui l'a noté, avec un barème périmé.
    const avant = { budget: true, zone: true, rooms: true, surface: false, features: ['parking'] }
    const notes = renoter(
      [match('m-avant', 'ml-2', { score_version: null, reasons: avant }), match('m-objets', 'ml-4', { score_version: null })],
      biens, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer,
    )
    expect(notes.map((n) => [n.id, n.score, n.score_version])).toEqual([
      ['m-avant', 94, DEFAULT_SCORING_CONFIG.version], ['m-objets', 49, DEFAULT_SCORING_CONFIG.version],
    ])
  })

  it('un bien déjà proposé (tout autre statut qu’à proposer) garde la note de sa proposition', () => {
    expect(renoter(
      ['sent', 'interested', 'rejected', 'visit_planned', 'ignored'].map((status) => match(`m-${status}`, 'ml-2', { status })),
      biens, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer,
    )).toEqual([])
  })
```

Dans `tests/unit/matching-renotation.spec.ts`, remplacer :

```ts
describe('la correction : UNE clé, fusionnée dans les critères d’aujourd’hui', () => {
```

par :

```ts
describe('aRattraper — ce que le scan de nuit renote (lot E1)', () => {
  const COURANTE = 4
  const ACTIVES = new Set(['r1', 'r2'])
  const couple = (id: string, recherche: string | null, champs: Partial<MatchARattraper> = {}): MatchARattraper => ({
    ...match(id, `ml-${id}`), client_search_id: recherche, ...champs,
  })
  /** La sélection, lisible : les ids par recherche, dans l'ordre. */
  const ids = (selection: Map<string, MatchARattraper[]>) =>
    Object.fromEntries([...selection].map(([recherche, matchs]) => [recherche, matchs.map((m) => m.id)]))

  it('les versions ANTÉRIEURES, et sans version quand le moteur l’a noté — ni la courante, ni une ultérieure, ni un ajout à la main', () => {
    expect(ids(aRattraper([
      couple('v2', 'r1', { score_version: 2 }),
      couple('v3', 'r1', { score_version: 3 }),
      couple('sans', 'r1', { score_version: null }),
      couple('v4', 'r1', { score_version: 4 }),
      couple('v5', 'r1', { score_version: 5 }),
      couple('main', 'r1', { score_version: null, reasons: { keys: ['budget'] } }),
    ], COURANTE, ACTIVES))).toEqual({ r1: ['v2', 'v3', 'sans'] })
  })

  it('à proposer seulement : un bien déjà proposé garde la note de sa proposition', () => {
    expect(ids(aRattraper(
      ['sent', 'interested', 'rejected', 'visit_planned', 'ignored'].map((status) => couple(status, 'r1', { status, score_version: 2 })),
      COURANTE, ACTIVES,
    ))).toEqual({})
  })

  it('d’une recherche ACTIVE : ni d’une recherche close ou supprimée, ni sans recherche', () => {
    expect(ids(aRattraper([
      couple('close', 'r-close', { score_version: 2 }),
      couple('orphelin', null, { score_version: 2 }),
      couple('actif', 'r2', { score_version: 2 }),
    ], COURANTE, ACTIVES))).toEqual({ r2: ['actif'] })
  })

  it('groupés par recherche, chaque groupe dans l’ordre de lecture', () => {
    expect(ids(aRattraper([
      couple('a', 'r2', { score_version: 2 }),
      couple('b', 'r1', { score_version: null }),
      couple('c', 'r2', { score_version: 3 }),
      couple('d', 'r1', { score_version: 1 }),
    ], COURANTE, ACTIVES))).toEqual({ r2: ['a', 'c'], r1: ['b', 'd'] })
  })

  it('au plus `plafond` couples, les premiers lus ; ceux qu’il écarte ne comptent pas', () => {
    const lus = [
      couple('a', 'r1', { score_version: 2 }),
      couple('courant', 'r1', { score_version: 4 }),
      couple('main', 'r2', { score_version: null, reasons: {} }),
      couple('b', 'r2', { score_version: 2 }),
      couple('c', 'r1', { score_version: 2 }),
    ]
    expect(ids(aRattraper(lus, COURANTE, ACTIVES, 2))).toEqual({ r1: ['a'], r2: ['b'] })
  })

  it('2 000 par défaut, par agence et par nuit : le 2 001ᵉ attend la nuit d’après', () => {
    expect(PLAFOND_RATTRAPAGE).toBe(2000)
    const lus = Array.from({ length: 2001 }, (_, i) => couple(`m${i}`, i % 2 ? 'r1' : 'r2', { score_version: 2 }))
    const selection = aRattraper(lus, COURANTE, ACTIVES)
    const retenus = [...selection.values()].flat().map((m) => m.id)
    expect(retenus).toHaveLength(2000)
    expect(retenus).not.toContain('m2000')
  })
})

describe('aJournaliser — une renotation ne se journalise que si elle change quelque chose (lot E1)', () => {
  const lus = [match('m1', 'ml-1', { score: 80 }), match('m2', 'ml-2', { score: 60 })]
  const raisons = calculateScoreV2(annonce('ml-1', 1_590_000), CRITERES).reasons
  const note = (id: string, score: number, ecarte = false): NoteMatch => ({ id, score, reasons: raisons, score_version: 4, ecarte })

  it('les mêmes notes, rien d’écarté : rien à journaliser — une version tamponnée ne se journalise pas', () => {
    expect(aJournaliser(lus, [note('m1', 80), note('m2', 60)])).toBe(false)
    expect(aJournaliser(lus, [])).toBe(false)
  })

  it('une note qui change, à la hausse comme à la baisse : à journaliser', () => {
    expect(aJournaliser(lus, [note('m1', 80), note('m2', 61)])).toBe(true)
    expect(aJournaliser(lus, [note('m1', 79)])).toBe(true)
  })

  it('un match écarté, même à note égale : son statut change, à journaliser', () => {
    // Un seuil relevé : la note ne bouge pas, le match sort d'« À proposer ».
    expect(aJournaliser(lus, [note('m1', 80), note('m2', 60, true)])).toBe(true)
  })
})

describe('la correction : UNE clé, fusionnée dans les critères d’aujourd’hui', () => {
```

```bash
npx vitest run tests/unit/matching-renotation.spec.ts
```

Attendu : ÉCHEC, `Tests  11 failed | 11 passed (22)` : le couple noté avant les versions, `AssertionError: expected [] to deeply equal [ [ 'm-avant', 94, 4 ], …(1) ]` (`renoter` saute tout couple sans version) ; le bien déjà proposé, `AssertionError: expected [ …(5) ] to deeply equal []` (`renoter` ne lit pas le statut) ; les cinq cas du scan de nuit, `TypeError: aRattraper is not a function` ; le plafond par défaut, `AssertionError: expected undefined to be 2000` ; les trois cas du journal, `TypeError: aJournaliser is not a function`. Le test de l'ajout à la main passe déjà : il garde ce qui ne doit pas bouger.

- [ ] **Étape 2 : Le modèle pur — un ajout à la main reconnu à ses raisons, un bien déjà proposé jamais renoté, ce qui se journalise, le choix du scan de nuit**

Dans `supabase/functions/_shared/matching-renotation.ts`, remplacer :

```ts
// Matching — la RÉÉVALUATION des matchs à proposer d'une recherche ajustée (lot B de la boucle chez
// l'agent, « Apprendre »). Fonctions PURES, comme matching-normalize.ts : zéro I/O, zéro API Deno —
// réutilisées par l'edge matching-engine (mode `rescore-search`) ET par les tests vitest (Node).
//
// Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4.6 et §12.
//
// POURQUOI. Le moteur ne re-note jamais une paire existante : `insert_*_matches` est en
// `ON CONFLICT DO NOTHING`. Une recherche corrigée garderait ses anciens scores et ses anciennes raisons.
// Ce module rejoue le VRAI barème (`calculateScoreV2`) sur les matchs encore à proposer ; l'edge en fait
// les lectures et les écritures (RPC `matching_appliquer_notes`, puis `matching_ajuster_recherche`).
```

par :

```ts
// Matching — la RÉÉVALUATION des matchs à proposer (lot B de la boucle chez l'agent, « Apprendre » ; lot E1,
// la renotation). Fonctions PURES, comme matching-normalize.ts : zéro I/O, zéro API Deno — réutilisées par
// l'edge matching-engine (modes `rescore-search`, `match-contact`, `scan-all`) ET par les tests vitest (Node).
//
// Conceptions : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4.6 et §12 ;
// docs/superpowers/specs/2026-09-27-matching-lot-e1-bureau-design.md, §5.7.
//
// POURQUOI. La création ne re-note jamais une paire existante : `insert_*_matches` est en
// `ON CONFLICT DO NOTHING`. Une recherche corrigée ou modifiée garderait ses anciens scores et ses anciennes
// raisons, et un barème changé laisserait les siens aux matchs déjà notés. Ce module rejoue le VRAI barème
// (`calculateScoreV2`) sur les matchs encore à proposer — d'une recherche corrigée (« Apprendre »), d'une
// recherche dont les critères ont changé (`match-contact`), et, chaque nuit, de ceux qu'une version antérieure
// du barème a notés (`aRattraper`, `scan-all`) ; l'edge en fait les lectures et les écritures (RPC
// `matching_appliquer_notes`, puis `matching_ajuster_recherche`).
```

Dans `supabase/functions/_shared/matching-renotation.ts`, remplacer :

```ts
// ⛔ UN MATCH AJOUTÉ À LA MAIN N'EST PAS RENOTÉ. La Recherche (« Ajouter à la sélection de … ») crée des
// matchs SANS `score_version`, avec ses propres raisons : l'agent les a choisis. Les écarter parce que le
// barème ne les retiendrait pas déferait une décision humaine.
//
```

par :

```ts
// ⛔ UN MATCH AJOUTÉ À LA MAIN N'EST PAS RENOTÉ. La Recherche (« Ajouter à la sélection de … ») crée des
// matchs SANS `score_version`, avec ses propres raisons (`{ keys }`, ou rien) : l'agent les a choisis. Les
// écarter parce que le barème ne les retiendrait pas déferait une décision humaine. Un match que le moteur a
// noté AVANT les versions (juin 2026) n'en a pas non plus, mais il porte ses axes dans `reasons` : lui se
// renote (`ajouteALaMain`).
//
// ⛔ SEUL UN MATCH À PROPOSER (`suggested`) SE RENOTE : un bien proposé, répondu ou en visite garde la note
// qu'il avait quand on l'a proposé, et un match écarté la sienne.
//
// ⚠ UNE RENOTATION QUI NE CHANGE RIEN NE SE JOURNALISE PAS (`aJournaliser`). Ses notes s'écrivent quand même — la
// version du barème tamponnée, sans quoi la nuit suivante les reprendrait —, mais une ligne ne dirait rien. Cas
// courant : le `match-contact` qu'une correction d'« Apprendre » déclenche renote les mêmes matchs aux mêmes
// notes, et il renote TOUTES les recherches actives du contact quand une seule a changé.
//
```

Dans `supabase/functions/_shared/matching-renotation.ts`, remplacer :

```ts
/** Un match `suggested` de la recherche, tel que l'edge le lit. */
export interface MatchARenoter {
  id: string
  property_id: string | null
  market_listing_id: string | null
  /** `null` : ajouté à la main (Recherche), jamais renoté. */
  score_version: number | null
}
```

par :

```ts
/** Un match à renoter, tel que l'edge le lit. */
export interface MatchARenoter {
  id: string
  property_id: string | null
  market_listing_id: string | null
  /** Seul un match à proposer (`suggested`) se renote. */
  status: string
  /** La note qu'il porte : ce qu'une renotation compare pour savoir si elle a changé quelque chose (`aJournaliser`). */
  score: number
  /** La version du barème qui l'a noté ; `null` : noté avant les versions, ou ajouté à la main (Recherche). */
  score_version: number | null
  /** Ses raisons : les axes du moteur, ou celles d'un ajout à la main (`{ keys }`, ou rien). */
  reasons: unknown
}
```

Dans `supabase/functions/_shared/matching-renotation.ts`, remplacer :

```ts
/**
 * Les notes des matchs à proposer d'une recherche, avec ses critères CORRIGÉS. `biens` : les mandats et les
 * annonces par id, colonnes du barème et du pré-filtre ; `refLoyer` : la position loyer d'une annonce du
 * marché.
 */
export function renoter(
  matchs: readonly MatchARenoter[],
  biens: ReadonlyMap<string, Record<string, unknown>>,
  criteres: Record<string, unknown>,
  cfg: ScoringConfig,
  refLoyer: (annonce: Record<string, unknown>) => RentPosition | null,
): NoteMatch[] {
  const tx = inferTransactionType(criteres)
  const notes: NoteMatch[] = []
  for (const m of matchs) {
    if (m.score_version == null) continue
```

par :

```ts
/** Les axes que le moteur écrit dans `reasons`, depuis sa première version. */
const AXES_MOTEUR = ['budget', 'zone', 'type', 'rooms', 'features']

/**
 * Un match AJOUTÉ À LA MAIN (Recherche) : sans version, et sans aucun axe du moteur dans ses raisons — la Recherche
 * écrit `{ keys: [...] }`, ou rien. Sans version mais avec ses axes, c'est le moteur d'avant les versions qui l'a noté.
 */
function ajouteALaMain(m: MatchARenoter): boolean {
  if (m.score_version != null) return false
  const r = m.reasons
  return !(r != null && typeof r === 'object' && !Array.isArray(r) && AXES_MOTEUR.some((axe) => axe in r))
}

/** Un match qui se renote : à proposer, et noté par le moteur. */
const renotable = (m: MatchARenoter): boolean => m.status === 'suggested' && !ajouteALaMain(m)

/**
 * Les notes des matchs à proposer d'une recherche, avec ses critères du moment (CORRIGÉS, pour « Apprendre »).
 * `biens` : les mandats et les annonces par id, colonnes du barème et du pré-filtre ; `refLoyer` : la position
 * loyer d'une annonce du marché. Ni un ajout à la main, ni un bien déjà proposé n'y ont de note.
 */
export function renoter(
  matchs: readonly MatchARenoter[],
  biens: ReadonlyMap<string, Record<string, unknown>>,
  criteres: Record<string, unknown>,
  cfg: ScoringConfig,
  refLoyer: (annonce: Record<string, unknown>) => RentPosition | null,
): NoteMatch[] {
  const tx = inferTransactionType(criteres)
  const notes: NoteMatch[] = []
  for (const m of matchs) {
    if (!renotable(m)) continue
```

Dans `supabase/functions/_shared/matching-renotation.ts`, remplacer :

```ts
      score_version: cfg.version,
      ecarte: !retenu || note.total < cfg.threshold,
    })
  }
  return notes
}
```

par :

```ts
      score_version: cfg.version,
      ecarte: !retenu || note.total < cfg.threshold,
    })
  }
  return notes
}

/**
 * Une renotation qui change quelque chose : une note écarte son match (il sort d'« À proposer »), ou lui donne un
 * autre score que celui lu avant d'écrire. Sinon, rien à journaliser — une version du barème tamponnée seule ne dit
 * rien à l'agent. `lus` : les matchs tels que lus ; `notes` : celles que la base a écrites.
 */
export function aJournaliser(lus: readonly MatchARenoter[], notes: readonly NoteMatch[]): boolean {
  const scores = new Map(lus.map((m) => [m.id, m.score]))
  return notes.some((n) => n.ecarte || scores.get(n.id) !== n.score)
}

/** Au plus tant de couples renotés par agence à chaque scan (`scan-all`, la nuit) : de quoi tenir le temps d'une fonction. */
export const PLAFOND_RATTRAPAGE = 2000

/** Un match tel que le scan de nuit le lit : sa recherche en plus. */
export interface MatchARattraper extends MatchARenoter {
  client_search_id: string | null
}

/**
 * Les couples que le scan de nuit renote, par recherche : à proposer, notés par une version ANTÉRIEURE du barème
 * (`version` est la courante) ou sans version — hors ajouts à la main —, d'une recherche ACTIVE. Dans l'ordre de
 * lecture, `plafond` au plus : les suivants attendent la nuit d'après, qui ne relit plus ceux-ci (renotés, ils
 * portent la version courante). Ni une recherche close ou supprimée, ni un match sans recherche : ses critères et
 * son écrivain (`matching_appliquer_notes`) passent par elle.
 */
export function aRattraper(
  matchs: readonly MatchARattraper[],
  version: number,
  actives: ReadonlySet<string>,
  plafond: number = PLAFOND_RATTRAPAGE,
): Map<string, MatchARattraper[]> {
  const parRecherche = new Map<string, MatchARattraper[]>()
  let pris = 0
  for (const m of matchs) {
    if (pris >= plafond) break
    const recherche = m.client_search_id
    if (recherche == null || !actives.has(recherche)) continue
    if ((m.score_version != null && m.score_version >= version) || !renotable(m)) continue
    const groupe = parRecherche.get(recherche)
    if (groupe) groupe.push(m)
    else parRecherche.set(recherche, [m])
    pris++
  }
  return parRecherche
}
```

- [ ] **Étape 3 : Relancer les tests**

```bash
npx vitest run tests/unit/matching-renotation.spec.ts
```

Attendu : PASS, `Test Files  1 passed (1)`, `Tests  22 passed (22)`.

- [ ] **Étape 4 : Écrire la spec de base**

Elle éprouve le moteur contre une base locale : les cas que la conception garde (§8) — `match-contact` qui laisserait une ancienne note, le scan de nuit qui laisserait une version ancienne, un couple sous le seuil resté à proposer, une recherche renotée sans ligne au journal —, la ligne tue quand rien n'a changé (une recherche du contact renotée à l'identique ; une version antérieure qui garde sa note, tamponnée) et le plafond. Le moteur y est appelé comme ses appelants de la base (le secret de service, l'agence dans le corps) ; les notes attendues sont celles du barème, calculées sur l'annonce lue par les colonnes que le moteur lit. Elle ne tourne pas ici : ne pas la déclarer verte.

Créer `tests/backend/matching-renotation.spec.ts` :

```ts
// Matching · lot E1 — la renotation dans le moteur (edge matching-engine ; conception du 27.09.2026, §5.7).
//   R1  `match-contact` (les critères d'une recherche ont changé) renote les matchs à proposer de CHAQUE recherche
//       active du contact, avec ses critères du moment : l'ancienne note remplacée par celle du barème ; hors du
//       pré-filtre ou sous le seuil, `ignored` / `recherche_ajustee` ; un bien déjà proposé (`sent`), un ajout à la
//       main et une recherche close gardent leur note ; UNE ligne `matchs_reevalues`, avec son bilan, par recherche
//       dont un match a changé de note ou de statut — une recherche renotée sans changement n'en écrit aucune.
//   R2  `scan-all` (le scan de nuit) renote les matchs à proposer qu'une version antérieure du barème a notés, et ceux
//       sans version que le moteur a notés ; ni la version courante, ni un ajout à la main, ni une recherche close ;
//       une version antérieure qui garde sa note est tamponnée, sans ligne ; une ligne par recherche qui a changé.
//   R3  `scan-all` en renote au plus 2 000 par agence et par nuit ; le reste attend la nuit d'après.
// Le moteur est appelé comme ses appelants de la base (le déclencheur des critères, le scan de nuit) : le secret de
// service en Bearer, l'agence dans le corps. Le local ne configure pas `app_config.supabase_url` : les déclencheurs n'y
// appellent pas le moteur, la spec le fait à leur place.
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { waitForEdgeWorker } from './helpers/edge'
import { calculateScoreV2, parseScoringConfig, type ScoringConfig } from '../../supabase/functions/_shared/matching-normalize.ts'
import { tranches } from '../../supabase/functions/_shared/matching-renotation.ts'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_JWT)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ENDPOINT = `${URL}/functions/v1/matching-engine`
const SERVICE_JWT = process.env.SUPABASE_TEST_SERVICE_ROLE_JWT ?? ''
/** Les colonnes d'une annonce que le moteur note (`COLS_ANNONCE_NOTE`, matching-engine/index.ts). */
const COLS_ANNONCE_NOTE = 'id, price, current_price, type, canton, city, rooms, surface_m2, features, status, price_at_first_seen, transaction_type, quality_score, bedrooms, year_built, year_renovated'
const CRITERES = { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'GE'], budget_max: 1_600_000 }
/** Des raisons que le moteur a écrites : ses axes, en objets depuis la version 2. */
const RAISONS_MOTEUR = { budget: { match: true, score: 32, detail: 'Dans le budget' } }
/** Une note plantée, qu'aucun barème ne donne à ces biens : la voir changer, c'est voir la renotation. */
const NOTE_PLANTEE = 11

/** Le moteur, appelé comme par la base : le secret de service en Bearer, l'agence dans le corps. */
async function moteur(body: Record<string, unknown>) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_JWT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, unknown> }
}

describe.skipIf(!HAS_KEYS)('matching · lot E1 — la renotation dans le moteur', () => {
  let s: TwoAgenciesSetup
  let svc: SupabaseClient
  /** Le barème que le moteur lit (`get_app_config`) : sa version est la « courante » de ces cas. */
  let cfg: ScoringConfig
  const contacts: string[] = []

  const mkContact = async (agencyId: string, nom: string) => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'Renotation', last_name: `${nom} ${s.stamp}`, type: 'buyer', search_criteria: null,
    }).select('id').single()
    if (error) throw new Error(`contacts ${nom}: ${error.message}`)
    contacts.push(data.id as string)
    return data.id as string
  }
  /** Une recherche insérée à la main, pour en choisir les critères et l'état (le pont n'en crée que d'actives). */
  const mkRecherche = async (agencyId: string, contactId: string, criteria: Record<string, unknown>, isActive = true) => {
    const { data, error } = await svc.from('client_searches')
      .insert({ agency_id: agencyId, contact_id: contactId, criteria, is_active: isActive }).select('id').single()
    if (error) throw new Error(`client_searches: ${error.message}`)
    return data.id as string
  }
  /** Toutes les annonces de la spec portent ce préfixe : une seule suppression les emporte. */
  const annonce = (tag: string, prix: number, champs: Record<string, unknown> = {}) => ({
    source_id: `renot-${s.stamp}-${tag}`, source_portal: 'flatfox', title: `Renotation ${tag} ${s.stamp}`,
    city: 'Genève', canton: 'GE', type: 'apartment', transaction_type: 'buy', rooms: 4.5, surface_m2: 110,
    features: ['Balcon'], price: prix, current_price: prix, quality_score: 70, status: 'active', ...champs,
  })
  const mkAnnonce = async (tag: string, prix: number, champs: Record<string, unknown> = {}) => {
    const { data, error } = await svc.from('market_listings').insert(annonce(tag, prix, champs)).select('id').single()
    if (error) throw new Error(`market_listings ${tag}: ${error.message}`)
    return data.id as string
  }
  /** Un match à proposer noté par la version courante, sauf `champs`. */
  const mkMatch = async (
    agencyId: string, contactId: string, recherche: string, annonceId: string, champs: Record<string, unknown> = {},
  ) => {
    const { data, error } = await svc.from('matches').insert({
      agency_id: agencyId, contact_id: contactId, client_search_id: recherche, market_listing_id: annonceId,
      source: 'market', status: 'suggested', score: NOTE_PLANTEE, reasons: RAISONS_MOTEUR, score_version: cfg.version,
      ...champs,
    }).select('id').single()
    if (error) throw new Error(`matches: ${error.message}`)
    return data.id as string
  }
  const lire = async (id: string) =>
    (await svc.from('matches').select('status, score, reasons, score_version, reaction_motif').eq('id', id).single()).data as
      { status: string; score: number; reasons: unknown; score_version: number | null; reaction_motif: string | null }
  /** La note du barème, comme le moteur la calcule : l'annonce lue par ses colonnes. */
  const noteDe = async (annonceId: string, criteres: Record<string, unknown>) => {
    const { data, error } = await svc.from('market_listings').select(COLS_ANNONCE_NOTE).eq('id', annonceId).single()
    if (error) throw new Error(`market_listings: ${error.message}`)
    return calculateScoreV2(data as Record<string, unknown>, criteres, cfg)
  }
  const journal = async (contactId: string) =>
    ((await svc.from('activity_events').select('actor_kind, category, metadata')
      .eq('action', 'matchs_reevalues').eq('entity_id', contactId)).data ?? []) as
      { actor_kind: string; category: string; metadata: Record<string, unknown> }[]

  // Le démarrage à froid du worker se paie ici, une fois (`waitForEdgeWorker`, qui n'échoue jamais) : un 503 du runtime
  // local n'est pas un verdict du moteur.
  beforeAll(async () => {
    s = await setupTwoAgencies()
    svc = serviceRoleClient()
    const { data, error } = await svc.from('app_config').select('value').eq('key', 'matching_scoring_v2').maybeSingle()
    if (error) throw new Error(`app_config: ${error.message}`)
    cfg = parseScoringConfig((data as { value: string } | null)?.value ?? null)
    await waitForEdgeWorker(ENDPOINT)
  }, 120_000)

  afterAll(async () => {
    if (!svc) return
    // activity_events est append-only : jamais supprimé. Les matchs d'abord — la clé vers `market_listings` n'a pas de
    // cascade —, ceux que le moteur a créés pour ces contacts compris.
    if (contacts.length) await svc.from('matches').delete().in('contact_id', contacts)
    if (contacts.length) await svc.from('client_searches').delete().in('contact_id', contacts)
    await svc.from('market_listings').delete().like('source_id', `renot-${s.stamp}-%`)
    if (contacts.length) await svc.from('contacts').delete().in('id', contacts)
    await s.cleanup()
  })

  it('R1 — match-contact renote chaque recherche active du contact, avec ses critères du moment ; une ligne par recherche', async () => {
    const c = await mkContact(s.agencyAId, 'R1')
    const autre = { ...CRITERES, budget_max: 1_300_000 }
    const r1 = await mkRecherche(s.agencyAId, c, CRITERES)
    const r2 = await mkRecherche(s.agencyAId, c, autre)
    const r3 = await mkRecherche(s.agencyAId, c, CRITERES)
    const close = await mkRecherche(s.agencyAId, c, CRITERES, false)
    const aGarde = await mkAnnonce('r1-garde', 1_400_000)
    const garde = await mkMatch(s.agencyAId, c, r1, aGarde)
    const hors = await mkMatch(s.agencyAId, c, r1, await mkAnnonce('r1-hors', 1_700_000))
    const aSous = await mkAnnonce('r1-sous', 1_650_000, { type: 'house' })
    const sousLeSeuil = await mkMatch(s.agencyAId, c, r1, aSous)
    const aR2 = await mkAnnonce('r1-r2', 1_250_000)
    const deR2 = await mkMatch(s.agencyAId, c, r2, aR2)
    // r3, rien n'y change : son match porte déjà la note du barème.
    const aStable = await mkAnnonce('r1-stable', 1_500_000)
    const nStable = await noteDe(aStable, CRITERES)
    const stable = await mkMatch(s.agencyAId, c, r3, aStable, { score: nStable.total, reasons: nStable.reasons })
    const propose = await mkMatch(s.agencyAId, c, r1, await mkAnnonce('r1-propose', 1_700_000), {
      status: 'sent', sent_via: 'agent', sent_at: new Date().toISOString(), score: 80, score_version: cfg.version - 1,
    })
    const main = await mkMatch(s.agencyAId, c, r1, await mkAnnonce('r1-main', 1_720_000), {
      score: 70, score_version: null, reasons: { keys: ['budget'] },
    })
    const dansLaClose = await mkMatch(s.agencyAId, c, close, await mkAnnonce('r1-close', 1_400_000), { score_version: cfg.version - 1 })
    // Les critères de r1 changent : le déclencheur relancerait le moteur, que le local ne configure pas.
    const apres = { ...CRITERES, budget_max: 1_450_000 }
    const { error: uErr } = await svc.from('client_searches').update({ criteria: apres }).eq('id', r1)
    if (uErr) throw new Error(`client_searches: ${uErr.message}`)

    const { status, body } = await moteur({ mode: 'match-contact', contact_id: c, agency_id: s.agencyAId })
    expect(status, JSON.stringify(body)).toBe(200)
    expect(body).toMatchObject({ reevalues: 5, ecartes: 2 })

    const n = await noteDe(aGarde, apres)
    expect(await lire(garde)).toMatchObject({ status: 'suggested', score: n.total, reasons: n.reasons, score_version: cfg.version })
    // 1'700'000 dépasse 1'450'000 à 15 % près : hors du pré-filtre du moteur, il sort sans note.
    expect(await lire(hors)).toMatchObject({
      status: 'ignored', reaction_motif: 'recherche_ajustee', score: 0, score_version: cfg.version,
    })
    // Dans le pré-filtre (1'650'000 ≤ 1'667'500), mais une maison au prix du haut de la marge : sous le seuil.
    const nSous = await noteDe(aSous, apres)
    expect(nSous.total).toBeLessThan(cfg.threshold)
    expect(await lire(sousLeSeuil)).toMatchObject({
      status: 'ignored', reaction_motif: 'recherche_ajustee', score: nSous.total, score_version: cfg.version,
    })
    const n2 = await noteDe(aR2, autre)
    expect(await lire(deR2)).toMatchObject({ status: 'suggested', score: n2.total, reasons: n2.reasons, score_version: cfg.version })
    expect(await lire(stable)).toMatchObject({ status: 'suggested', score: nStable.total, score_version: cfg.version })
    expect(await lire(propose)).toMatchObject({ status: 'sent', score: 80, score_version: cfg.version - 1 })
    expect(await lire(main)).toMatchObject({ status: 'suggested', score: 70, score_version: null })
    expect(await lire(dansLaClose)).toMatchObject({ status: 'suggested', score: NOTE_PLANTEE, score_version: cfg.version - 1 })

    const lignes = await journal(c)
    expect(lignes).toHaveLength(2)
    expect(lignes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actor_kind: 'system', category: 'contact',
        metadata: expect.objectContaining({
          client_search_id: r1, mode: 'match-contact', reevalues: 3, ecartes: 2,
          match_ids_ecartes: expect.arrayContaining([hors, sousLeSeuil]), score_version: cfg.version,
        }),
      }),
      expect.objectContaining({ metadata: expect.objectContaining({ client_search_id: r2, reevalues: 1, ecartes: 0 }) }),
    ]))
    // r3 a été renotée — son match réécrit —, mais rien n'y a changé : aucune ligne.
    expect(lignes.map((l) => l.metadata.client_search_id)).not.toContain(r3)
  }, 60_000)

  it('R2 — scan-all renote ce qu’une version antérieure a noté, sans version compris ; rien d’autre', async () => {
    const c = await mkContact(s.agencyAId, 'R2')
    const r = await mkRecherche(s.agencyAId, c, CRITERES)
    const aAncienne = await mkAnnonce('r2-ancienne', 1_500_000)
    const ancienne = await mkMatch(s.agencyAId, c, r, aAncienne, { score_version: cfg.version - 1 })
    const aSans = await mkAnnonce('r2-sans', 1_450_000)
    // Sans version, mais les axes du moteur dans ses raisons (en booléens, comme les décrit docs/schema.md) : c'est
    // le moteur d'avant les versions qui l'a noté.
    const sansVersion = await mkMatch(s.agencyAId, c, r, aSans, {
      score_version: null, reasons: { budget: true, zone: true, rooms: true, surface: false, features: [] },
    })
    const courante = await mkMatch(s.agencyAId, c, r, await mkAnnonce('r2-courante', 1_500_000))
    const main = await mkMatch(s.agencyAId, c, r, await mkAnnonce('r2-main', 1_550_000), {
      score: 70, score_version: null, reasons: { keys: ['zone'] },
    })
    const cClose = await mkContact(s.agencyAId, 'R2-close')
    const close = await mkRecherche(s.agencyAId, cClose, CRITERES, false)
    const dansLaClose = await mkMatch(s.agencyAId, cClose, close, await mkAnnonce('r2-close', 1_500_000), { score_version: cfg.version - 1 })
    // Une version antérieure qui avait déjà la note du barème : tamponnée, rien à journaliser.
    const cStable = await mkContact(s.agencyAId, 'R2-stable')
    const rStable = await mkRecherche(s.agencyAId, cStable, CRITERES)
    const aStable = await mkAnnonce('r2-stable', 1_500_000)
    const nStable = await noteDe(aStable, CRITERES)
    const stable = await mkMatch(s.agencyAId, cStable, rStable, aStable, {
      score: nStable.total, reasons: nStable.reasons, score_version: cfg.version - 1,
    })

    const { status, body } = await moteur({ mode: 'scan-all', agency_id: s.agencyAId })
    expect(status, JSON.stringify(body)).toBe(200)
    // R1 a laissé ses matchs à la version courante : seuls ceux-ci restaient à rattraper dans l'agence.
    expect(body).toMatchObject({ reevalues: 3, ecartes: 0 })

    const nA = await noteDe(aAncienne, CRITERES)
    expect(await lire(ancienne)).toMatchObject({ status: 'suggested', score: nA.total, reasons: nA.reasons, score_version: cfg.version })
    const nS = await noteDe(aSans, CRITERES)
    expect(await lire(sansVersion)).toMatchObject({ status: 'suggested', score: nS.total, reasons: nS.reasons, score_version: cfg.version })
    expect(await lire(courante)).toMatchObject({ status: 'suggested', score: NOTE_PLANTEE, score_version: cfg.version })
    expect(await lire(main)).toMatchObject({ status: 'suggested', score: 70, score_version: null })
    expect(await lire(dansLaClose)).toMatchObject({ status: 'suggested', score: NOTE_PLANTEE, score_version: cfg.version - 1 })
    expect(await lire(stable)).toMatchObject({ status: 'suggested', score: nStable.total, score_version: cfg.version })

    expect(await journal(c)).toEqual([expect.objectContaining({
      actor_kind: 'system', category: 'contact',
      metadata: expect.objectContaining({ client_search_id: r, mode: 'scan-all', reevalues: 2, ecartes: 0, score_version: cfg.version }),
    })])
    expect(await journal(cClose)).toEqual([])
    expect(await journal(cStable)).toEqual([])
  }, 60_000)

  it('R3 — scan-all en renote au plus 2 000 par agence ; le 2 001ᵉ attend la nuit d’après', async () => {
    const c = await mkContact(s.agencyBId, 'R3')
    const r = await mkRecherche(s.agencyBId, c, CRITERES)
    // 2 001 annonces et leurs matchs à proposer, notés par une version antérieure. Les ids naissent ici : un envoi
    // groupé n'a pas à relire ce qu'il a écrit (`max_rows`).
    const ids = Array.from({ length: 2001 }, () => crypto.randomUUID())
    for (const lot of tranches(ids, 500)) {
      const { error } = await svc.from('market_listings').insert(lot.map((id) => ({ id, ...annonce(`r3-${id}`, 1_400_000) })))
      if (error) throw new Error(`market_listings: ${error.message}`)
    }
    for (const lot of tranches(ids, 500)) {
      const { error } = await svc.from('matches').insert(lot.map((id) => ({
        agency_id: s.agencyBId, contact_id: c, client_search_id: r, market_listing_id: id, source: 'market',
        status: 'suggested', score: NOTE_PLANTEE, reasons: RAISONS_MOTEUR, score_version: cfg.version - 1,
      })))
      if (error) throw new Error(`matches: ${error.message}`)
    }
    const restants = async () => (await svc.from('matches').select('id', { count: 'exact', head: true })
      .eq('contact_id', c).eq('score_version', cfg.version - 1)).count

    const nuit = await moteur({ mode: 'scan-all', agency_id: s.agencyBId })
    expect(nuit.status, JSON.stringify(nuit.body)).toBe(200)
    expect(nuit.body.reevalues).toBe(2000)
    expect(await restants()).toBe(1)
    expect(await journal(c)).toEqual([expect.objectContaining({
      metadata: expect.objectContaining({ client_search_id: r, mode: 'scan-all', reevalues: 2000 }),
    })])

    const suivante = await moteur({ mode: 'scan-all', agency_id: s.agencyBId })
    expect(suivante.status, JSON.stringify(suivante.body)).toBe(200)
    expect(suivante.body.reevalues).toBe(1)
    expect(await restants()).toBe(0)
  }, 180_000)
})
```

- [ ] **Étape 5 : Le moteur — `match-contact` renote, `scan-all` rattrape, par la mécanique de `rescore-search`**

Dans `supabase/functions/matching-engine/index.ts`, remplacer :

```ts
import {
  estUuid, fusionnerCorrection, lireCorrection, lireRefus, renoter, REFUS_MAX, tranches, type MatchARenoter,
} from '../_shared/matching-renotation.ts'
```

par :

```ts
import {
  aJournaliser, aRattraper, estUuid, fusionnerCorrection, lireCorrection, lireRefus, PLAFOND_RATTRAPAGE, renoter, REFUS_MAX,
  tranches, type MatchARattraper, type MatchARenoter,
} from '../_shared/matching-renotation.ts'
```

Dans `supabase/functions/matching-engine/index.ts`, remplacer :

```ts
const COLS_ANNONCE_NOTE = 'id, price, current_price, type, canton, city, rooms, surface_m2, features, status, price_at_first_seen, transaction_type, quality_score, bedrooms, year_built, year_renovated'
```

par :

```ts
const COLS_ANNONCE_NOTE = 'id, price, current_price, type, canton, city, rooms, surface_m2, features, status, price_at_first_seen, transaction_type, quality_score, bedrooms, year_built, year_renovated'
/**
 * Ce que la renotation lit d'un match : son bien, de quoi savoir s'il se renote (`renoter`), et sa note, pour savoir
 * si elle a changé (`aJournaliser`).
 */
const COLS_MATCH_NOTE = 'id, property_id, market_listing_id, status, score, score_version, reasons'
```

`renoterRecherche` passe par les trois pièces communes, et les deux nouvelles fonctions la suivent. Dans `supabase/functions/matching-engine/index.ts`, remplacer :

```ts
/**
 * `rescore-search` — la réévaluation des matchs à proposer d'une recherche ajustée (lot B, « Apprendre »).
 *
 * ⚠ L'ORDRE EST LE CONTRAT. (1) renoter EN MÉMOIRE avec les critères d'aujourd'hui où la seule clé corrigée
 * est remplacée ; (2) écrire les notes (`matching_appliquer_notes`) ; (3) d'UN BLOC, `matching_ajuster_recherche` :
 * la clé fusionnée dans la recherche (et dans la fiche si elle portait les mêmes critères — sans quoi le pont
 * `sync_contact_client_search` remettrait l'ancienne au prochain enregistrement de la fiche), les refus pris
 * en compte, UNE ligne au journal. Une panne avant (3) laisse la correction proposée à l'écran, et la même
 * validation renote puis écrit tout ; (3) n'a pas de milieu. Écrire les critères d'abord effaçait la
 * correction (plus d'écart à proposer) sans avoir rien renoté.
 *
 * ⚠ La mise à jour des critères déclenche `trigger_matching_on_search_updated`, qui relance le moteur en
 * `match-contact` (pg_net, asynchrone) : les biens que la recherche corrigée retient DE PLUS y naissent.
 */
async function renoterRecherche(
  supabase: SupabaseClient,
  agencyId: string,
  acteurId: string | null,
  body: RequestBody,
  cfg: ScoringConfig,
  rentIndex: RentStatsIndex,
): Promise<{ statut: number; corps: Record<string, unknown> }> {
  const refus = lireRefus(body.refus_ids)
  const correction = body.correction === undefined ? null : lireCorrection(body.correction)
  if (!estUuid(body.client_search_id) || refus === null || (body.correction !== undefined && correction === null)
    || (body.motif !== undefined && !MOTIFS_CORRECTION.has(body.motif))) {
    return { statut: 400, corps: { error: 'invalid_body' } }
  }
  // Une borne, pas un plafond de travail : le fil ne lit pas davantage de refus (`REFUS_MAX`).
  if (refus.length > REFUS_MAX) return { statut: 413, corps: { error: 'too_many_refus', max: REFUS_MAX } }

  const { data: recherche, error: rErr } = await supabase
    .from('client_searches')
    .select('id, contact_id, criteria')
    .eq('id', body.client_search_id)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (rErr) throw rErr
  if (!recherche) return { statut: 404, corps: { error: 'search_not_found' } }
  const avant = (recherche.criteria ?? null) as Record<string, unknown> | null
  const criteres = correction ? fusionnerCorrection(avant, correction) : avant
  if (!criteres) return { statut: 400, corps: { error: 'invalid_body' } }

  // 1. Les matchs à proposer de la recherche, page par page (idx_matches_agency_focus).
  const matchs: MatchARenoter[] = []
  for (let depuis = 0; ; depuis += PAGE_MATCHS) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, property_id, market_listing_id, score_version')
      .eq('agency_id', agencyId)
      .eq('contact_id', recherche.contact_id)
      .eq('client_search_id', recherche.id)
      .eq('status', 'suggested')
      .order('id')
      .range(depuis, depuis + PAGE_MATCHS - 1)
    if (error) throw error
    const page = (data ?? []) as MatchARenoter[]
    matchs.push(...page)
    if (page.length < PAGE_MATCHS) break
  }

  // Leurs biens, colonnes du barème seulement.
  const biens = new Map<string, Record<string, unknown>>()
  const mandats = [...new Set(matchs.map((m) => m.property_id).filter((id): id is string => id != null))]
  for (const lot of tranches(mandats, LOT_IDS)) {
    const { data, error } = await supabase.from('properties').select(PROP_COLS).eq('agency_id', agencyId).in('id', lot)
    if (error) throw error
    for (const p of (data ?? []) as Record<string, unknown>[]) biens.set(p.id as string, p)
  }
  const annonces = [...new Set(matchs.map((m) => m.market_listing_id).filter((id): id is string => id != null))]
  for (const lot of tranches(annonces, LOT_IDS)) {
    const { data, error } = await supabase.from('market_listings').select(COLS_ANNONCE_NOTE).in('id', lot)
    if (error) throw error
    for (const a of (data ?? []) as Record<string, unknown>[]) biens.set(a.id as string, a)
  }

  // 1-2. Le VRAI barème, sur les critères corrigés — AVANT de les poser.
  const notes = renoter(matchs, biens, criteres, cfg, refLoyer(rentIndex))
  const ecartes: string[] = []
  let reevalues = 0
  for (const lot of tranches(notes, LOT_NOTES)) {
    const { data, error } = await supabase.rpc('matching_appliquer_notes', {
      p_agency_id: agencyId, p_client_search_id: recherche.id, p_notes: lot,
    })
    if (error) throw error
    for (const l of (data ?? []) as { id: string; status: string }[]) {
      reevalues++
      if (l.status === 'ignored') ecartes.push(l.id)
    }
  }

  // 3. D'UN BLOC : la clé corrigée (recherche, fiche identique), les refus pris en compte — deux NOUVEAUX
  //    refus pour ce motif en proposeront une autre —, et UNE ligne au journal (CLAUDE.md §5), qui dit ce
  //    que la renotation a produit.
  const { data: ajuste, error: aErr } = await supabase.rpc('matching_ajuster_recherche', {
    p_agency_id: agencyId,
    p_client_search_id: recherche.id,
    p_acteur_id: acteurId,
    p_cle: correction?.cle ?? null,
    p_valeur: correction?.valeur ?? null,
    p_motif: body.motif ?? null,
    p_refus_ids: refus,
    p_bilan: { reevalues, ecartes: ecartes.length, match_ids_ecartes: ecartes.slice(0, 50), score_version: cfg.version },
  })
  if (aErr) throw aErr
  // Supprimée entre la lecture et l'écriture : rien n'a été posé.
  if (ajuste == null) return { statut: 404, corps: { error: 'search_not_found' } }

  return { statut: 200, corps: { reevalues, ecartes: ecartes.length, mode: 'rescore-search', scoreVersion: cfg.version } }
}
```

par :

```ts
/** Ce que les notes d'une recherche ont produit : les matchs réécrits, et ceux qu'elles ont sortis d'« À proposer ». */
interface NotesEcrites {
  reevalues: number
  ecartes: string[]
  /** Un match réécrit a changé de note ou de statut (`aJournaliser`) : c'est ce qu'une ligne au journal dirait. */
  aJournaliser: boolean
}

/** Les matchs à proposer d'une recherche, page par page (`idx_matches_agency_focus`). */
function matchsDeLaRecherche(
  supabase: SupabaseClient, agencyId: string, recherche: { id: string; contact_id: string },
): Promise<MatchARenoter[]> {
  return toutesLesPages<MatchARenoter>((depuis, jusqua) => supabase
    .from('matches')
    .select(COLS_MATCH_NOTE)
    .eq('agency_id', agencyId)
    .eq('contact_id', recherche.contact_id)
    .eq('client_search_id', recherche.id)
    .eq('status', 'suggested')
    .order('id')
    .range(depuis, jusqua))
}

/**
 * Renote des matchs d'UNE recherche avec `criteres` — le vrai barème et son pré-filtre (`renoter`) — puis écrit leurs
 * notes (`matching_appliquer_notes`, qui ne réécrit qu'un match encore à proposer de cette recherche et de l'agence) :
 * sous le seuil, ou hors du pré-filtre, un match sort d'« À proposer ». Leurs biens sont lus d'abord, colonnes du
 * barème seulement.
 */
async function ecrireNotes(
  supabase: SupabaseClient,
  agencyId: string,
  rechercheId: string,
  matchs: readonly MatchARenoter[],
  criteres: Record<string, unknown>,
  cfg: ScoringConfig,
  rentIndex: RentStatsIndex,
): Promise<NotesEcrites> {
  const biens = new Map<string, Record<string, unknown>>()
  const mandats = [...new Set(matchs.map((m) => m.property_id).filter((id): id is string => id != null))]
  for (const lot of tranches(mandats, LOT_IDS)) {
    const { data, error } = await supabase.from('properties').select(PROP_COLS).eq('agency_id', agencyId).in('id', lot)
    if (error) throw error
    for (const p of (data ?? []) as Record<string, unknown>[]) biens.set(p.id as string, p)
  }
  const annonces = [...new Set(matchs.map((m) => m.market_listing_id).filter((id): id is string => id != null))]
  for (const lot of tranches(annonces, LOT_IDS)) {
    const { data, error } = await supabase.from('market_listings').select(COLS_ANNONCE_NOTE).in('id', lot)
    if (error) throw error
    for (const a of (data ?? []) as Record<string, unknown>[]) biens.set(a.id as string, a)
  }

  const notes = renoter(matchs, biens, criteres, cfg, refLoyer(rentIndex))
  const reecrits = new Set<string>()
  const ecartes: string[] = []
  for (const lot of tranches(notes, LOT_NOTES)) {
    const { data, error } = await supabase.rpc('matching_appliquer_notes', {
      p_agency_id: agencyId, p_client_search_id: rechercheId, p_notes: lot,
    })
    if (error) throw error
    for (const l of (data ?? []) as { id: string; status: string }[]) {
      reecrits.add(l.id)
      if (l.status === 'ignored') ecartes.push(l.id)
    }
  }
  // Ce qui a changé se juge sur ce que la base a écrit : un match sorti d'« À proposer » entre la lecture et
  // l'écriture n'a pas reçu sa note.
  return { reevalues: reecrits.size, ecartes, aJournaliser: aJournaliser(matchs, notes.filter((n) => reecrits.has(n.id))) }
}

/** Le bilan d'une renotation, que `matching_ajuster_recherche` recopie au journal. */
const bilanDes = (n: NotesEcrites, cfg: ScoringConfig, mode: RequestBody['mode']) => ({
  mode, reevalues: n.reevalues, ecartes: n.ecartes.length, match_ids_ecartes: n.ecartes.slice(0, 50), score_version: cfg.version,
})

/**
 * `rescore-search` — la réévaluation des matchs à proposer d'une recherche ajustée (lot B, « Apprendre »).
 *
 * ⚠ L'ORDRE EST LE CONTRAT. (1) renoter EN MÉMOIRE avec les critères d'aujourd'hui où la seule clé corrigée
 * est remplacée ; (2) écrire les notes (`matching_appliquer_notes`) ; (3) d'UN BLOC, `matching_ajuster_recherche` :
 * la clé fusionnée dans la recherche (et dans la fiche si elle portait les mêmes critères — sans quoi le pont
 * `sync_contact_client_search` remettrait l'ancienne au prochain enregistrement de la fiche), les refus pris
 * en compte, UNE ligne au journal. Une panne avant (3) laisse la correction proposée à l'écran, et la même
 * validation renote puis écrit tout ; (3) n'a pas de milieu. Écrire les critères d'abord effaçait la
 * correction (plus d'écart à proposer) sans avoir rien renoté.
 *
 * ⚠ La mise à jour des critères déclenche `trigger_matching_on_search_updated`, qui relance le moteur en
 * `match-contact` (pg_net, asynchrone) : les biens que la recherche corrigée retient DE PLUS y naissent, et ses
 * matchs à proposer y sont renotés une seconde fois, aux mêmes notes — rien n'ayant changé, aucune ligne ne suit
 * celle-ci au journal (`aJournaliser`).
 */
async function renoterRecherche(
  supabase: SupabaseClient,
  agencyId: string,
  acteurId: string | null,
  body: RequestBody,
  cfg: ScoringConfig,
  rentIndex: RentStatsIndex,
): Promise<{ statut: number; corps: Record<string, unknown> }> {
  const refus = lireRefus(body.refus_ids)
  const correction = body.correction === undefined ? null : lireCorrection(body.correction)
  if (!estUuid(body.client_search_id) || refus === null || (body.correction !== undefined && correction === null)
    || (body.motif !== undefined && !MOTIFS_CORRECTION.has(body.motif))) {
    return { statut: 400, corps: { error: 'invalid_body' } }
  }
  // Une borne, pas un plafond de travail : le fil ne lit pas davantage de refus (`REFUS_MAX`).
  if (refus.length > REFUS_MAX) return { statut: 413, corps: { error: 'too_many_refus', max: REFUS_MAX } }

  const { data: recherche, error: rErr } = await supabase
    .from('client_searches')
    .select('id, contact_id, criteria')
    .eq('id', body.client_search_id)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (rErr) throw rErr
  if (!recherche) return { statut: 404, corps: { error: 'search_not_found' } }
  const avant = (recherche.criteria ?? null) as Record<string, unknown> | null
  const criteres = correction ? fusionnerCorrection(avant, correction) : avant
  if (!criteres) return { statut: 400, corps: { error: 'invalid_body' } }

  // 1-2. Les matchs à proposer de la recherche, notés par le VRAI barème sur les critères corrigés — AVANT de les
  //      poser —, et leurs notes écrites.
  const ecrites = await ecrireNotes(
    supabase, agencyId, recherche.id, await matchsDeLaRecherche(supabase, agencyId, recherche), criteres, cfg, rentIndex,
  )

  // 3. D'UN BLOC : la clé corrigée (recherche, fiche identique), les refus pris en compte — deux NOUVEAUX
  //    refus pour ce motif en proposeront une autre —, et UNE ligne au journal (CLAUDE.md §5), qui dit ce
  //    que la renotation a produit.
  const { data: ajuste, error: aErr } = await supabase.rpc('matching_ajuster_recherche', {
    p_agency_id: agencyId,
    p_client_search_id: recherche.id,
    p_acteur_id: acteurId,
    p_cle: correction?.cle ?? null,
    p_valeur: correction?.valeur ?? null,
    p_motif: body.motif ?? null,
    p_refus_ids: refus,
    p_bilan: bilanDes(ecrites, cfg, 'rescore-search'),
  })
  if (aErr) throw aErr
  // Supprimée entre la lecture et l'écriture : rien n'a été posé.
  if (ajuste == null) return { statut: 404, corps: { error: 'search_not_found' } }

  return {
    statut: 200,
    corps: { reevalues: ecrites.reevalues, ecartes: ecrites.ecartes.length, mode: 'rescore-search', scoreVersion: cfg.version },
  }
}

/** Une recherche active, telle que `match-contact` et `scan-all` la lisent. */
interface RechercheActive {
  id: string
  contact_id: string
  criteria: Record<string, unknown> | null
}

/**
 * Une recherche renotée par le moteur lui-même, avec ses critères du moment — `match-contact` quand ils ont changé,
 * `scan-all` pour une version antérieure du barème : les notes de `matchs`, puis UNE ligne `matchs_reevalues` au
 * journal, avec son bilan (`matching_ajuster_recherche` sans clé ni refus : rien d'autre n'est posé). La ligne ne
 * s'écrit que si un match a changé de note ou de statut (`aJournaliser`) ; les notes, elles, s'écrivent toujours —
 * la version du barème tamponnée, la nuit suivante ne les reprend pas. Une recherche sans critères n'est pas notée,
 * comme à la création.
 */
async function reevaluerRecherche(
  supabase: SupabaseClient,
  agencyId: string,
  acteurId: string | null,
  recherche: RechercheActive,
  matchs: readonly MatchARenoter[],
  cfg: ScoringConfig,
  rentIndex: RentStatsIndex,
  mode: RequestBody['mode'],
): Promise<NotesEcrites> {
  if (!recherche.criteria) return { reevalues: 0, ecartes: [], aJournaliser: false }
  const ecrites = await ecrireNotes(supabase, agencyId, recherche.id, matchs, recherche.criteria, cfg, rentIndex)
  if (!ecrites.aJournaliser) return ecrites
  const { error } = await supabase.rpc('matching_ajuster_recherche', {
    p_agency_id: agencyId,
    p_client_search_id: recherche.id,
    p_acteur_id: acteurId,
    p_cle: null,
    p_valeur: null,
    p_motif: null,
    p_refus_ids: [],
    p_bilan: bilanDes(ecrites, cfg, mode),
  })
  if (error) throw error
  return ecrites
}

/**
 * Les couples que le scan de nuit renote (`aRattraper`) : les matchs à proposer de l'agence qu'une version antérieure
 * du barème a notés, ou sans version, lus page par page dans l'ordre de `idx_matches_agency_focus` (`agency_id,
 * contact_id, score desc`, à proposer). La lecture s'arrête au plafond : les suivants attendent la nuit d'après.
 */
async function couplesARattraper(
  supabase: SupabaseClient, agencyId: string, version: number, actives: ReadonlySet<string>,
): Promise<Map<string, MatchARattraper[]>> {
  const lus: MatchARattraper[] = []
  for (let depuis = 0; ; depuis += PAGE_MATCHS) {
    const { data, error } = await supabase
      .from('matches')
      .select(`${COLS_MATCH_NOTE}, client_search_id`)
      .eq('agency_id', agencyId)
      .eq('status', 'suggested')
      .or(`score_version.is.null,score_version.lt.${version}`)
      .order('contact_id')
      .order('score', { ascending: false })
      .order('id')
      .range(depuis, depuis + PAGE_MATCHS - 1)
    if (error) throw error
    const page = (data ?? []) as MatchARattraper[]
    lus.push(...page)
    const selection = aRattraper(lus, version, actives)
    const pleine = [...selection.values()].reduce((n, groupe) => n + groupe.length, 0) >= PLAFOND_RATTRAPAGE
    if (page.length < PAGE_MATCHS || pleine) return selection
  }
}
```

Dans `supabase/functions/matching-engine/index.ts`, remplacer :

```ts
    // L'agent derrière le JWT — `null` pour un appel de service : le journal de `rescore-search` le nomme.
    let acteurId: string | null = null
```

par :

```ts
    // L'agent derrière le JWT — `null` pour un appel de service : le journal d'une renotation le nomme.
    let acteurId: string | null = null
```

Dans `supabase/functions/matching-engine/index.ts`, remplacer :

```ts
    let newMatches = 0
    let newMarketMatches = 0
```

par :

```ts
    let newMatches = 0
    let newMarketMatches = 0
    // Ce que la renotation a produit (`match-contact`, `scan-all`) : les matchs réécrits, et ceux qu'elle a écartés.
    let reevalues = 0
    let ecartes = 0
```

`match-contact` renote avant de créer. Dans `supabase/functions/matching-engine/index.ts`, remplacer :

```ts
      if (searchError) throw searchError
      if (!searches || searches.length === 0) {
        return new Response(JSON.stringify({ newMatches: 0, message: 'No active searches' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: properties, error: propError } = await supabase
```

par :

```ts
      if (searchError) throw searchError
      if (!searches || searches.length === 0) {
        return new Response(JSON.stringify({ newMatches: 0, message: 'No active searches' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Ses critères ont pu changer (`on_search_criteria_updated`) : les matchs à proposer de chaque recherche active
      // sont renotés avec ceux du moment, AVANT la création — ceux qu'elle fait naître sont déjà notés, le bilan ne les
      // compte pas.
      for (const recherche of searches as RechercheActive[]) {
        const r = await reevaluerRecherche(
          supabase, agency_id, acteurId, recherche, await matchsDeLaRecherche(supabase, agency_id, recherche), cfg,
          rentIndex, mode,
        )
        reevalues += r.reevalues
        ecartes += r.ecartes.length
      }

      const { data: properties, error: propError } = await supabase
```

`scan-all` rattrape après avoir créé. Dans `supabase/functions/matching-engine/index.ts`, remplacer :

```ts
      const rows = buildInternalRows(searches || [], properties || [], (s) => s.contact_id as string)
      newMatches += await flush(rows, 'insert_internal_matches', 'internal')

      await matchSearchesAgainstMarket(searches || [], (s) => s.contact_id as string)
    } else if (mode === 'rescore-search' || mode === 'prospects' || mode === 'reactiver-prospect') {
```

par :

```ts
      const rows = buildInternalRows(searches || [], properties || [], (s) => s.contact_id as string)
      newMatches += await flush(rows, 'insert_internal_matches', 'internal')

      await matchSearchesAgainstMarket(searches || [], (s) => s.contact_id as string)

      // ── Le rattrapage : les matchs à proposer qu'une version antérieure du barème a notés (sans version compris),
      // PLAFOND_RATTRAPAGE au plus, recherche par recherche. Après la création : ceux qu'elle vient de noter portent la
      // version courante, et un échec ici ne coûte pas à la nuit ses nouveaux matchs.
      const actives = (searches ?? []) as RechercheActive[]
      const selection = await couplesARattraper(supabase, agency_id, cfg.version, new Set(actives.map((s) => s.id)))
      for (const recherche of actives) {
        const matchs = selection.get(recherche.id)
        if (!matchs) continue
        const r = await reevaluerRecherche(supabase, agency_id, acteurId, recherche, matchs, cfg, rentIndex, mode)
        reevalues += r.reevalues
        ecartes += r.ecartes.length
      }
    } else if (mode === 'rescore-search' || mode === 'prospects' || mode === 'reactiver-prospect') {
```

Dans `supabase/functions/matching-engine/index.ts`, remplacer :

```ts
    return new Response(JSON.stringify({ newMatches, newMarketMatches, mode, scoreVersion: cfg.version }), {
```

par :

```ts
    return new Response(JSON.stringify({ newMatches, newMarketMatches, reevalues, ecartes, mode, scoreVersion: cfg.version }), {
```

```bash
deno check --no-lock supabase/functions/_shared/matching-renotation.ts supabase/functions/matching-engine/index.ts
```

Attendu : sortie 0, deux lignes `Check`.

- [ ] **Étape 6 : Les commentaires qui disaient que le moteur ne renote jamais**

Dans `src/hooks/useMatchingFil.ts`, remplacer :

```ts
 * ⚠ UNE RECHERCHE MODIFIÉE GARDE LES RAISONS DE L'ANCIENNE : `insert_internal_matches` ne re-note pas
 * une paire existante (`ON CONFLICT DO NOTHING`). Seule une correction d'« Apprendre » (lot B) renote les
 * matchs à proposer de SA recherche (`matching-engine`, mode `rescore-search`). Aucun signal fiable ne
 * permet d'écarter les autres ici — `client_searches.updated_at` bouge à CHAQUE enregistrement du contact
 * (trigger de synchro), et s'y fier effacerait les verdicts d'un acheteur dont on a corrigé la nationalité.
```

par :

```ts
 * ⚠ UNE RECHERCHE MODIFIÉE EST RENOTÉE PAR LE MOTEUR, PAS ICI (lot E1) : le changement de ses critères le
 * relance (`on_search_criteria_updated`, mode `match-contact`), qui renote ses matchs à proposer — un ajout à la
 * main garde sa note. Jusqu'à son passage, asynchrone, le fil montre les raisons de l'ancienne : aucun signal
 * fiable ne permet de les écarter ici — `client_searches.updated_at` bouge à CHAQUE enregistrement du contact
 * (trigger de synchro), et s'y fier effacerait les verdicts d'un acheteur dont on a corrigé la nationalité.
```

Dans `src/pages/dev/crmFixtures.ts`, remplacer :

```ts
 * (`banc-matching-boucle.spec.ts` les confronte à `calculateScoreV2` ; il ne renote pas une paire existante). Julie (c9) en a refusé deux pour le
```

par :

```ts
 * (`banc-matching-boucle.spec.ts` les confronte à `calculateScoreV2` ; il ne renote pas une paire quand son prix bouge). Julie (c9) en a refusé deux pour le
```

Dans `tests/unit/banc-matching-boucle.spec.ts`, remplacer :

```ts
 * L'annonce telle que le moteur l'a notée : à son PREMIER prix. Il ne renote pas une paire existante
 * (`ON CONFLICT DO NOTHING`) ; notée au prix d'aujourd'hui, une annonce en baisse gagnerait « Prix baissé de
 * 3 % » et un point que la base n'a jamais écrits.
```

par :

```ts
 * L'annonce telle que le moteur l'a notée : à son PREMIER prix. Il ne renote pas une paire quand son prix bouge
 * (`ON CONFLICT DO NOTHING` ; seuls des critères changés ou une version antérieure du barème la renotent) ; notée
 * au prix d'aujourd'hui, une annonce en baisse gagnerait « Prix baissé de 3 % » et un point que la base n'a
 * jamais écrits.
```

- [ ] **Étape 7 : Vérifier**

`deno check --no-lock` est le seul filet de type du code Deno :

```bash
deno check --no-lock supabase/functions/_shared/matching-renotation.ts supabase/functions/matching-engine/index.ts
```

Attendu : sortie 0, une ligne `Check` par fichier.

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx eslint --quiet supabase/functions/_shared/matching-renotation.ts supabase/functions/matching-engine/index.ts tests/unit/matching-renotation.spec.ts tests/backend/matching-renotation.spec.ts tests/unit/banc-matching-boucle.spec.ts src/hooks/useMatchingFil.ts src/pages/dev/crmFixtures.ts
```

Attendu : aucune sortie.

Les specs qui chargent ou lisent un module touché — le modèle pur, la confrontation de la boucle du banc, et les deux gardes qui lisent la source du moteur (la catégorie de `match_suggested`, la garde de service) :

```bash
npx vitest run tests/unit/matching-renotation.spec.ts tests/unit/banc-matching-boucle.spec.ts tests/unit/activity-events-category.spec.ts tests/unit/edge-secret-compare.spec.ts
```

Attendu : PASS, `Test Files  4 passed (4)`, `Tests  55 passed (55)`.

```bash
npm run lint:deadcode
npm run lint:edge-auth
npm run lint:migrations
npm run lint:spec-sql
```

Attendu : `✓ Aucun export mort` (les exports neufs, `aRattraper`, `aJournaliser`, `PLAFOND_RATTRAPAGE`, `MatchARattraper`, sont lus par le moteur ; ts-prune ne lit que `src`) ; la garde des fonctions edge, `✓ Gardes edge : 90 fonction(s) authentifient leur appelant, 2 ouverte(s) par conception et justifiée(s).` et `✓ Ordre garde → effet : 90 gestionnaire(s) lus, aucun effet avant leur première garde, aucun au chargement (0 exemption(s) temporaire(s), 1 RPC de lecture vérifiée(s)).` ; `✓ Migrations rejouables (368 vérifiées, 3 historiques exclues).` et `✓ Versions uniques (368 horodatages distincts).` (aucune migration) ; `✓ Blocs SQL équilibrés — 40 corps dans 4 spec(s) marqué(s) @sql-blocks-check.` (la spec de base neuve n'écrit pas de SQL). Aucune clé i18n n'est touchée : les portes i18n ne sont pas concernées.

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint`, ni `deno` en parallèle) :

```bash
npx vitest run
```

Attendu : `Test Files  3 failed | 340 passed (343)`, `Tests  1 failed | 5231 passed | 3 skipped (5235)` ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`.

La spec de base se joue contre une base locale où tournent les fonctions (`supabase start`, `SUPABASE_TEST_*` et `SUPABASE_TEST_SERVICE_ROLE_JWT` posés) — elle ne tourne pas sur cette machine, ne pas la déclarer verte :

```bash
npx vitest run --config=vitest.backend.config.ts tests/backend/matching-renotation.spec.ts tests/backend/matching-boucle.spec.ts
```

`matching-boucle.spec.ts` y est pour B7 (`rescore-search`, qui passe désormais par les pièces communes, et son ajout à la main resté à 70) et B8 (`matchs_reevalues`, signé `system` sans acteur).

---

## Tâche 10 : Un deal perdu ne reçoit plus de geste neuf (décision de Julien du 27.09.2026, conception §5.8)

Mesuré (tâche 5) : `transactions.status` vaut `active`, `on_hold`, `cancelled` ou `completed` ; « perdu » n'est pas un statut mais l'étape `lost` (`transactions.stage`), que « Marquer perdu » du Pipeline écrit seule, le statut restant `active`. Or trois lectures prennent « le deal de l'acheteur » sur le statut seul (`status = 'active'`, le plus récent) : `rattacherDeal` (`src/lib/matchingGestes.ts`), qu'appellent les trois gestes qui touchent un deal — « Je l'ai proposé » (`execProposer`), « J'ai proposé N biens » (`execProposerSelection`) et « Planifier une visite » (`execPlanifierVisite`, que la fiche d'un mandat emprunte pour un acquéreur intéressé depuis la tâche 5) —, et les deux fonctions du copilote WhatsApp, `wa_matching_consigner` (« proposé ») et `wa_matching_visite` (la visite d'un intéressé). Un geste neuf pouvait donc se rattacher au deal PERDU de l'acheteur — lui donner un mandat, une relance, une visite — au lieu d'en ouvrir un. Aucun autre geste de `matchingGestes.ts` ne lit `transactions` : la visite ne fait qu'avancer le deal que `rattacherDeal` lui a rendu. Décision de Julien (conception §5.8) : un deal est ouvert si son statut est `active` ou `on_hold` et que son étape n'est pas `lost` ; sinon le geste en ouvre un neuf, comme pour un acheteur sans deal. C'est la règle que la tâche 5 a écrite pour la fiche d'un mandat (`dealOuvert`, `visiteurs.ts`) : elle monte dans un module PUR, `src/lib/dealOuvert.ts` — ses statuts (`STATUTS_DEAL_OUVERT`), l'étape qu'elle exclut (`ETAPE_DEAL_PERDU`), la règle —, que lisent `visiteurs.ts` et `rattacherDeal`, et que les deux fonctions de base recopient (`t.status in ('active', 'on_hold') and t.stage <> 'lost'`). Aucun module existant ne portait déjà étapes et statuts de deal comme une règle : `src/components/crm/tokens.ts` (`CRM_STAGE_ORDER`) est un fichier de jetons d'interface — identifiants de colonne, teintes — que les gestes n'ont pas à charger ; `src/lib/constants.ts` ne garde que des codes (et charge i18n) ; `src/types/transaction.ts` ne porte que le type. `transactions.stage` est `NOT NULL` (baseline, jamais relâché ; les types générés le disent) : `<>` en SQL et `neq` en PostgREST, qui excluraient une étape nulle, sont donc exacts, et la règle n'a pas à la prévoir — la spec garde cette hypothèse sur les types générés. `in` sur le statut, dans `rattacherDeal` : la règle de CLAUDE.md §7 (`eq` plutôt qu'`in`) vise les grandes tables et leurs index partiels ; `transactions` est petite, et la lecture passe par l'index de l'acheteur. La migration du lot D2 n'est pas en production : elle se corrige en place, comme à la tâche 1. `tests/unit/deal-ouvert.spec.ts` confronte le SQL au module — la lecture du deal, entière, dans les deux fonctions, puis la règle lue dans le SQL contre `dealOuvert`, statut par statut et étape par étape —, vérifie que les gestes et la fiche lisent le module sans en garder de copie, et reprend les deux cas de `dealOuvert` de `fiche-planifier-visite.spec.ts`.

Choix à valider : le module neuf (`src/lib/dealOuvert.ts`), qui entre dans le périmètre de la garde « sans sortie » comme les gestes qui le lisent ; l'étape nulle, sans branche dans la règle — le schéma l'interdit, et le test qui porte ce cas lit la garantie dans les types générés ; un deal archivé (`archived_at`, hors du Pipeline) reste ouvert s'il est `active` et pas perdu, comme la tâche 5 l'a fixé pour la fiche ; le commentaire du routeur du copilote (`schedule_visit`, « faute d'un deal actif ») dit « ouvert ».

**Fichiers :**
- Créer (tests) : `tests/unit/deal-ouvert.spec.ts`
- Modifier (tests) : `tests/unit/fiche-planifier-visite.spec.ts`, `tests/unit/matching-fil-gestes.spec.ts`, `tests/unit/matching-sans-sortie.spec.ts`
- Créer (la règle) : `src/lib/dealOuvert.ts`
- Modifier (ses lecteurs) : `src/components/crm/biens/fiche/visiteurs.ts`, `src/lib/matchingGestes.ts`
- Modifier (la même règle en base) : `supabase/migrations/20260924200000_matching_whatsapp.sql`
- Modifier (commentaire) : `supabase/functions/_shared/whatsapp-agent-router.ts`
- Modifier (spec de base) : `tests/backend/matching-whatsapp.spec.ts`

- [ ] **Étape 1 : Écrire les tests qui échouent**

La règle et sa confrontation au SQL, dans une spec neuve qui reprend les deux cas de `dealOuvert` de la fiche ; la lecture du deal par les trois gestes qui en touchent un, au faux client — qui apprend `neq` ; le module neuf dans le périmètre de la garde « sans sortie ». Le test qui figeait l'ancienne lecture (`status=active`, pour la seule sélection) est remplacé ; trois titres qui disaient « deal actif » disent « ouvert ».

Créer `tests/unit/deal-ouvert.spec.ts` :

```ts
/**
 * Le deal OUVERT d'un acheteur (lot E1, conception §5.8) : une règle, lue par les gestes du matching (`rattacherDeal`),
 * par la fiche d'un mandat (`visiteurs.ts`) et par le copilote WhatsApp (`wa_matching_consigner`, `wa_matching_visite`),
 * confrontée ici entre ses deux écritures — le module TypeScript et le SQL de la migration du lot D2, LUE (ses specs de
 * base, `tests/backend/matching-whatsapp.spec.ts`, ne tournent que contre une base locale).
 *
 * Ce que cette spec refuse :
 *   · un deal perdu tenu pour ouvert : « perdu » est l'étape `lost`, son statut reste `active` ;
 *   · une fonction du copilote qui lirait le deal de l'acheteur autrement que `dealOuvert` — un statut de plus ou de
 *     moins, l'étape oubliée, une autre étape exclue ;
 *   · une seconde définition : les gestes et la fiche lisent le module, sans en garder de copie ;
 *   · une étape devenue nulle dans le schéma : la règle ne la prévoit pas, et le `neq` de PostgREST comme le `<>` du SQL
 *     l'excluraient sans bruit.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Constants } from '@/types/database'
import { dealOuvert, ETAPE_DEAL_PERDU, STATUTS_DEAL_OUVERT } from '@/lib/dealOuvert'

const R = process.cwd()
const lire = (f: string) => readFileSync(join(R, f), 'utf8')

/** La migration du copilote WhatsApp (lot D2), par son suffixe : elle se redate le jour de la fusion. */
function migrationWhatsapp(): string {
  const noms = readdirSync(join(R, 'supabase/migrations')).filter((n) => n.endsWith('_matching_whatsapp.sql'))
  expect(noms).toHaveLength(1)
  return lire(`supabase/migrations/${noms[0]}`)
}

/** Le corps d'une fonction, sans commentaires ni blancs superflus : ce qu'elle exécute. */
function corps(sql: string, nom: string): string {
  const i = sql.indexOf(`create or replace function public.${nom}(`)
  expect(i, `${nom} introuvable`).toBeGreaterThanOrEqual(0)
  const debut = sql.indexOf('as $$', i) + 5
  return sql.slice(debut, sql.indexOf('$$;', debut)).replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim()
}

describe('un deal ouvert', () => {
  it('statut par statut : `active` et `on_hold` sont ouverts ; `completed` (gagné) et `cancelled` (annulé) ne le sont pas', () => {
    for (const status of Constants.public.Enums.transaction_status) {
      expect(dealOuvert({ status, stage: 'offer' }), status).toBe(status === 'active' || status === 'on_hold')
    }
  })

  it('un deal perdu n’en est pas un : « perdu » est l’étape `lost`, son statut reste ouvert', () => {
    for (const stage of Constants.public.Enums.transaction_stage) {
      expect(dealOuvert({ status: 'active', stage }), stage).toBe(stage !== 'lost')
      expect(dealOuvert({ status: 'on_hold', stage }), stage).toBe(stage !== 'lost')
    }
  })

  it('l’étape n’est jamais nulle (`NOT NULL`) : la règle n’a pas à le prévoir, et `neq` comme `<>` n’excluent aucun deal', () => {
    // Les types générés disent le schéma : une étape devenue nulle y ferait paraître `| null`, et la règle serait à
    // revoir des trois côtés — TypeScript, PostgREST, SQL.
    const types = lire('src/types/database.ts')
    const table = types.slice(types.indexOf('      transactions: {'))
    const ligne = table.slice(table.indexOf('Row: {'), table.indexOf('Insert: {'))
    expect(ligne).toMatch(/\n\s+stage: Database\["public"\]\["Enums"\]\["transaction_stage"\]\n/)
    expect(ligne).toMatch(/\n\s+status: Database\["public"\]\["Enums"\]\["transaction_status"\]\n/)
  })
})

describe('la même règle en base : le copilote WhatsApp (migration du lot D2, lue)', () => {
  const sql = migrationWhatsapp()
  // La règle telle que le SQL l'écrit, tirée du module, jamais retapée.
  const regle = `t.status in (${STATUTS_DEAL_OUVERT.map((s) => `'${s}'`).join(', ')}) and t.stage <> '${ETAPE_DEAL_PERDU}'`

  it('`wa_matching_consigner` (« proposé ») prend le deal ouvert de l’acheteur, le plus récent : la lecture entière', () => {
    expect(corps(sql, 'wa_matching_consigner')).toContain(
      `select t.id into v_deal from public.transactions t where t.agency_id = p_agency and t.contact_buyer_id = v_match.contact_id and ${regle} order by t.created_at desc limit 1;`,
    )
  })

  it('`wa_matching_visite` (la visite d’un intéressé) aussi, sous verrou', () => {
    expect(corps(sql, 'wa_matching_visite')).toContain(
      `select t.id, t.stage::text into v_deal, v_etape from public.transactions t where t.agency_id = p_agency and t.contact_buyer_id = p_contact and ${regle} order by t.created_at desc limit 1 for update;`,
    )
  })

  it('lue dans le SQL, la règle rend ce que rend `dealOuvert`, statut par statut et étape par étape — et le deal ne se lit qu’une fois', () => {
    for (const nom of ['wa_matching_consigner', 'wa_matching_visite']) {
      const c = corps(sql, nom)
      expect(c.match(/from public\.transactions t\b/g), nom).toHaveLength(1)
      const m = c.match(/t\.status in \(([^)]*)\) and t\.stage <> '([a-z_]+)'/)
      expect(m, `${nom} : la règle du deal ouvert est introuvable`).not.toBeNull()
      const statuts = m![1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))
      for (const status of Constants.public.Enums.transaction_status) {
        for (const stage of Constants.public.Enums.transaction_stage) {
          expect(statuts.includes(status) && stage !== m![2], `${nom} : ${status} / ${stage}`).toBe(dealOuvert({ status, stage }))
        }
      }
    }
  })
})

describe('une seule définition : les gestes et la fiche la lisent (lecture du code)', () => {
  it('`rattacherDeal` filtre sur les statuts et l’étape du module, jamais sur le statut seul', () => {
    const code = lire('src/lib/matchingGestes.ts')
    expect(code).toContain(".in('status', STATUTS_DEAL_OUVERT)")
    expect(code).toContain(".neq('stage', ETAPE_DEAL_PERDU)")
    expect(code).not.toMatch(/\.eq\('status', 'active'\)/)
  })

  it('les règles de la fiche d’un mandat lisent `dealOuvert`, sans en garder de copie', () => {
    const code = lire('src/components/crm/biens/fiche/visiteurs.ts')
    expect(code).toContain("import { dealOuvert } from '@/lib/dealOuvert'")
    expect(code).not.toMatch(/'on_hold'|'lost'/)
  })
})
```

Dans `tests/unit/fiche-planifier-visite.spec.ts`, remplacer :

```ts
import { describe, expect, it } from 'vitest'
import { Constants } from '@/types/database'
import type { Compatible } from '@/components/matching-fil/filQuiPour'
import {
  creationVisite, dealOuvert, preRemplissagePermis, visiteursLies, type ContexteVisite, type DealDuBien,
} from '@/components/crm/biens/fiche/visiteurs'
```

par :

```ts
import { describe, expect, it } from 'vitest'
import type { Compatible } from '@/components/matching-fil/filQuiPour'
import {
  creationVisite, preRemplissagePermis, visiteursLies, type ContexteVisite, type DealDuBien,
} from '@/components/crm/biens/fiche/visiteurs'
```

Dans `tests/unit/fiche-planifier-visite.spec.ts`, remplacer :

```ts
describe('un deal ouvert', () => {
  it('statut par statut : `active` et `on_hold` sont ouverts ; `completed` (gagné) et `cancelled` (annulé) ne le sont pas', () => {
    for (const status of Constants.public.Enums.transaction_status) {
      expect(dealOuvert({ status, stage: 'offer' }), status).toBe(status === 'active' || status === 'on_hold')
    }
  })

  it('un deal perdu n’en est pas un : « perdu » est l’étape `lost`, son statut reste ouvert', () => {
    for (const stage of Constants.public.Enums.transaction_stage) {
      expect(dealOuvert({ status: 'active', stage }), stage).toBe(stage !== 'lost')
      expect(dealOuvert({ status: 'on_hold', stage }), stage).toBe(stage !== 'lost')
    }
  })
})

describe('les visiteurs proposés', () => {
```

par :

```ts
// La règle d'un deal ouvert elle-même (statuts, étape `lost`) se garde avec son module : `deal-ouvert.spec.ts`.

describe('les visiteurs proposés', () => {
```

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer :

```ts
        eq: (col: string, val: unknown) => { e.filtres.push(`${col}=${String(val)}`); return q },
        in: (col: string, vals: unknown[]) => { e.filtres.push(`${col} in ${vals.join(',')}`); return q },
```

par :

```ts
        eq: (col: string, val: unknown) => { e.filtres.push(`${col}=${String(val)}`); return q },
        neq: (col: string, val: unknown) => { e.filtres.push(`${col}<>${String(val)}`); return q },
        in: (col: string, vals: unknown[]) => { e.filtres.push(`${col} in ${vals.join(',')}`); return q },
```

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer :

```ts
  it('cherche le deal actif de cet acheteur, dans cette agence, le plus récent', async () => {
    await execProposerSelection(CTX, JULIE, DEUX)
    expect(lectures().map((l) => [l.table, l.filtres])).toEqual([[
      'transactions',
      ['agency_id=ag-1', 'contact_buyer_id=c-1', 'status=active', 'order created_at desc', 'limit 1'],
    ]])
  })

  it('rattache le deal actif existant, sans le modifier pour une annonce du marché', async () => {
```

par :

```ts
  it('rattache le deal ouvert existant, sans le modifier pour une annonce du marché', async () => {
```

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer :

```ts
  it('rattache un bien en mandat au deal actif qui n’en porte pas', async () => {
```

par :

```ts
  it('rattache un bien en mandat au deal ouvert qui n’en porte pas', async () => {
```

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer :

```ts
  it('crée un new_lead sur l’annonce du marché quand aucun deal n’est actif', async () => {
    await expect(execProposer(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))).resolves.toEqual({ dealId: 'deal-neuf', deja: false })
    expect(seq()).toEqual(['update:matches', 'insert:transactions', 'insert:activity_events', 'insert:reminders'])
    expect(ecritures()[1]!.valeurs).toMatchObject({ stage: 'new_lead', market_listing_id: 'ml-1' })
  })
})
```

par :

```ts
  it('crée un new_lead sur l’annonce du marché quand aucun deal n’est ouvert', async () => {
    await expect(execProposer(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))).resolves.toEqual({ dealId: 'deal-neuf', deja: false })
    expect(seq()).toEqual(['update:matches', 'insert:transactions', 'insert:activity_events', 'insert:reminders'])
    expect(ecritures()[1]!.valeurs).toMatchObject({ stage: 'new_lead', market_listing_id: 'ml-1' })
  })
})

describe('le deal d’un geste : l’OUVERT de l’acheteur, jamais un deal perdu (lot E1)', () => {
  // « Marquer perdu » (Pipeline) n'écrit que l'étape `lost`, le statut reste `active` : lu sur le statut seul, un geste
  // neuf se rattacherait au deal perdu. Ouvert (`dealOuvert`) : un statut `active` ou `on_hold`, et une autre étape.
  const LECTURE_DU_DEAL = ['agency_id=ag-1', 'contact_buyer_id=c-1', 'status in active,on_hold', 'stage<>lost', 'order created_at desc', 'limit 1']
  const VISITE = { debut: '2026-09-24T12:00:00.000Z', dureeMinutes: 45, lieu: null }

  it.each([
    ['« Je l’ai proposé »', () => execProposer(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))],
    ['« J’ai proposé N biens »', () => execProposerSelection(CTX, { id: 'c-1', first: 'Julie', last: 'Morand' }, [
      { matchId: 'm-a', score: 97, bien: annonce('ml-1', 'MG-MK-1') },
    ])],
    ['« Planifier une visite »', () => execPlanifierVisite(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'), VISITE)],
  ])('%s cherche le deal ouvert de cet acheteur, dans cette agence, le plus récent', async (_geste, geste) => {
    await geste()
    expect(lectures().filter((l) => l.table === 'transactions').map((l) => l.filtres)).toEqual([LECTURE_DU_DEAL])
  })
})
```

Dans `tests/unit/matching-sans-sortie.spec.ts`, remplacer :

```ts
  // Lot E1 : les exécuteurs des gestes et la file d'annulation, que partagent le fil et le mobile.
  'src/lib/matchingGestes.ts',
  'src/lib/matchingAnnulation.ts',
```

par :

```ts
  // Lot E1 : les exécuteurs des gestes et la file d'annulation, que partagent le fil et le mobile, et la règle du deal
  // auquel un geste se rattache (`dealOuvert`), que lit aussi la fiche d'un mandat.
  'src/lib/matchingGestes.ts',
  'src/lib/matchingAnnulation.ts',
  'src/lib/dealOuvert.ts',
```

```bash
npx vitest run tests/unit/deal-ouvert.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/fiche-planifier-visite.spec.ts tests/unit/matching-sans-sortie.spec.ts
```

Attendu : ÉCHEC, `Test Files  3 failed | 1 passed (4)`, `Tests  4 failed | 80 passed (84)` : `deal-ouvert.spec.ts` ne se charge pas, `Failed to resolve import "@/lib/dealOuvert"` ; dans `matching-fil-gestes.spec.ts`, les trois gestes, `expected [ [ 'agency_id=ag-1', …(4) ] ] to deeply equal [ [ 'agency_id=ag-1', …(5) ] ]` (la lecture porte `status=active`, ni `status in active,on_hold` ni `stage<>lost`) ; dans `matching-sans-sortie.spec.ts`, « le périmètre est lu », `src/lib/dealOuvert.ts introuvable: expected 0 to be greater than 0`. `fiche-planifier-visite.spec.ts` passe : il n'a perdu que les deux cas partis dans la spec neuve.

- [ ] **Étape 2 : La règle, dans un module pur**

Créer `src/lib/dealOuvert.ts` :

```ts
/**
 * Le deal OUVERT d'un acheteur — la seule règle de ce qu'est « son deal » : celui auquel un geste du matching se
 * rattache (`rattacherDeal`, matchingGestes.ts), et celui qui fait d'un contact un acheteur en cours sur la fiche d'un
 * mandat (`visiteurs.ts`). Module PUR : ni React, ni Supabase, ni traduction.
 *
 * Lot E1 (conception §5.8, décision de Julien) : un deal est ouvert si son statut est `active` ou `on_hold` et que son
 * étape n'est pas `lost`. ⚠ « Perdu » n'est pas un statut : c'est l'étape `lost` — « Marquer perdu » du Pipeline
 * n'écrit qu'elle, le statut reste `active`. Lu sur le statut seul, un geste neuf se rattacherait au deal perdu au lieu
 * d'en ouvrir un.
 *
 * ⛔ CE MODULE EST LE MIROIR DU SQL : `wa_matching_consigner` et `wa_matching_visite` (le copilote WhatsApp, migration
 * `20260924200000_matching_whatsapp.sql`) appliquent la même règle ; `tests/unit/deal-ouvert.spec.ts` les confronte.
 */
import type { Enums } from '@/types/database'

/**
 * Les statuts d'un deal ouvert (`transactions.status`) : `active`, et `on_hold`, un deal suspendu que le Pipeline garde.
 * `completed` est un deal gagné (« Terminer »), `cancelled` un deal annulé.
 */
export const STATUTS_DEAL_OUVERT: readonly Enums<'transaction_status'>[] = ['active', 'on_hold']

/** L'étape d'un deal perdu (`transactions.stage`) : il n'est plus ouvert, quel que soit son statut. */
export const ETAPE_DEAL_PERDU: Enums<'transaction_stage'> = 'lost'

/**
 * Un deal ouvert : d'un statut ouvert, et pas perdu. Son étape n'est jamais nulle (`transactions.stage` est
 * `NOT NULL`) : c'est ce qui rend la règle identique au `<> 'lost'` du SQL et au `neq` de PostgREST, qui excluraient
 * une étape nulle.
 */
export const dealOuvert = (d: { status: string; stage: string }): boolean =>
  STATUTS_DEAL_OUVERT.some((s) => s === d.status) && d.stage !== ETAPE_DEAL_PERDU
```

- [ ] **Étape 3 : La fiche d'un mandat la lit**

`visiteurs.ts` perd sa copie (ses statuts, sa règle) et importe le module ; ses trois lecteurs (`dealOuvertDe`, `visiteursLies`, et par eux `preRemplissagePermis` et `creationVisite`) ne changent pas.

Dans `src/components/crm/biens/fiche/visiteurs.ts`, remplacer :

```ts
 * ⚠ « Perdu » n'est pas un statut de deal : c'est l'étape `lost` — « Marquer perdu » du Pipeline n'écrit qu'elle, le
 * statut reste `active`. Un deal ouvert se lit donc sur les deux (`dealOuvert`).
 */
import type { Compatible } from '@/components/matching-fil/filQuiPour'
import type { AcheteurGeste } from '@/lib/matchingGestes'
```

par :

```ts
 * ⚠ « Perdu » n'est pas un statut de deal : c'est l'étape `lost` — « Marquer perdu » du Pipeline n'écrit qu'elle, le
 * statut reste `active`. Un deal ouvert se lit donc sur les deux : `dealOuvert` (`src/lib/dealOuvert.ts`), la règle des
 * gestes du matching et du copilote WhatsApp, une seule.
 */
import type { Compatible } from '@/components/matching-fil/filQuiPour'
import { dealOuvert } from '@/lib/dealOuvert'
import type { AcheteurGeste } from '@/lib/matchingGestes'
```

Dans `src/components/crm/biens/fiche/visiteurs.ts`, remplacer :

```ts
/**
 * Les statuts d'un deal ouvert (`transactions.status`) : `active`, et `on_hold`, un deal suspendu que le Pipeline garde.
 * `completed` est un deal gagné (« Terminer »), `cancelled` un deal annulé.
 */
const STATUTS_OUVERTS: readonly string[] = ['active', 'on_hold']

/** Un deal ouvert : d'un statut ouvert, et pas perdu. */
export const dealOuvert = (d: Pick<DealDuBien, 'status' | 'stage'>): boolean =>
  STATUTS_OUVERTS.includes(d.status) && d.stage !== 'lost'

/** Le deal ouvert d'un contact sur ce bien, le plus récent. */
```

par :

```ts
/** Le deal ouvert d'un contact sur ce bien, le plus récent. */
```

- [ ] **Étape 4 : Les gestes la lisent (`rattacherDeal`)**

La lecture du deal ne retient plus qu'un deal ouvert ; sans lui, le `new_lead` d'aujourd'hui. Trois commentaires disaient « l'actif ».

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
import { markIntercomMilestone } from '@/lib/intercom-milestones'
import type { Enums, Json, TablesInsert } from '@/types/database'
```

par :

```ts
import { markIntercomMilestone } from '@/lib/intercom-milestones'
import { ETAPE_DEAL_PERDU, STATUTS_DEAL_OUVERT } from '@/lib/dealOuvert'
import type { Enums, Json, TablesInsert } from '@/types/database'
```

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
/**
 * Le deal d'un acheteur à qui l'on propose un bien : l'actif le plus récent s'il existe — un bien en
 * mandat y est rattaché s'il n'en porte aucun, jamais écrasé —, sinon un `new_lead` créé sur ce bien.
 * Partagé par la proposition d'un bien et celle d'une sélection, pour qu'elles ne divergent pas.
 */
async function rattacherDeal(ctx: GesteContext, contactId: string, listing: Pick<BienGeste, 'kind' | 'id'>): Promise<string> {
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, property_id')
    .eq('agency_id', ctx.agencyId)
    .eq('contact_buyer_id', contactId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
```

par :

```ts
/**
 * Le deal d'un acheteur à qui l'on propose un bien : l'OUVERT le plus récent s'il existe (`dealOuvert` : un deal
 * perdu n'en est pas un) — un bien en mandat y est rattaché s'il n'en porte aucun, jamais écrasé —, sinon un
 * `new_lead` créé sur ce bien. Partagé par la proposition d'un bien, celle d'une sélection et la visite planifiée,
 * pour qu'elles ne divergent pas.
 */
async function rattacherDeal(ctx: GesteContext, contactId: string, listing: Pick<BienGeste, 'kind' | 'id'>): Promise<string> {
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, property_id')
    .eq('agency_id', ctx.agencyId)
    .eq('contact_buyer_id', contactId)
    // Deux statuts, donc `in` : la règle de CLAUDE.md §7 (`eq` plutôt qu'`in`) vise les grandes tables et leurs
    // index partiels ; `transactions` est petite, et cette lecture passe par l'acheteur (`idx_transactions_buyer`).
    .in('status', STATUTS_DEAL_OUVERT)
    // `neq` exclut aussi une étape nulle : il n'y en a pas, `stage` est `NOT NULL`.
    .neq('stage', ETAPE_DEAL_PERDU)
    .order('created_at', { ascending: false })
    .limit(1)
```

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
  // 2. Deal : rattacher au deal actif existant, sinon créer en new_lead
```

par :

```ts
  // 2. Deal : rattacher au deal ouvert existant, sinon créer en new_lead
```

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
 * pas deux visites. Puis le deal (l'actif, sinon un `new_lead`, `rattacherDeal`), puis la visite : un bien EN
```

par :

```ts
 * pas deux visites. Puis le deal (l'ouvert, sinon un `new_lead`, `rattacherDeal`), puis la visite : un bien EN
```

- [ ] **Étape 5 : La même règle en base (le copilote WhatsApp)**

La migration du lot D2 n'est pas en production : ses deux lectures du deal se corrigent en place. Le commentaire de `schedule_visit`, dans le routeur du copilote, suit.

Dans `supabase/migrations/20260924200000_matching_whatsapp.sql`, remplacer :

```sql
    -- Le deal : l'actif le plus récent de l'acheteur (un mandat y est rattaché s'il n'en porte aucun, jamais
    -- écrasé), sinon un `new_lead` sur ce bien — `rattacherDeal` du fil.
    select t.id into v_deal from public.transactions t
     where t.agency_id = p_agency and t.contact_buyer_id = v_match.contact_id and t.status = 'active'
     order by t.created_at desc
     limit 1;
```

par :

```sql
    -- Le deal : l'OUVERT le plus récent de l'acheteur (un mandat y est rattaché s'il n'en porte aucun, jamais
    -- écrasé), sinon un `new_lead` sur ce bien — `rattacherDeal` du fil. Ouvert : un statut `active` ou `on_hold`, une
    -- étape autre que `lost` — « Marquer perdu » n'écrit que l'étape, le statut reste `active`. La règle de
    -- `dealOuvert` (src/lib/dealOuvert.ts), que tests/unit/deal-ouvert.spec.ts confronte à ce texte. `stage` est
    -- NOT NULL : `<>` n'exclut aucun deal ouvert.
    select t.id into v_deal from public.transactions t
     where t.agency_id = p_agency and t.contact_buyer_id = v_match.contact_id
       and t.status in ('active', 'on_hold') and t.stage <> 'lost'
     order by t.created_at desc
     limit 1;
```

Dans `supabase/migrations/20260924200000_matching_whatsapp.sql`, remplacer :

```sql
-- match passe `visit_planned` et son deal (l'actif, sinon un `new_lead`) avance à `visit_planned` s'il était avant,
```

par :

```sql
-- match passe `visit_planned` et son deal (l'ouvert, sinon un `new_lead`) avance à `visit_planned` s'il était avant,
```

Dans `supabase/migrations/20260924200000_matching_whatsapp.sql`, remplacer :

```sql
    update public.matches set status = 'visit_planned' where id = v_match and status = 'interested';
    select t.id, t.stage::text into v_deal, v_etape
      from public.transactions t
     where t.agency_id = p_agency and t.contact_buyer_id = p_contact and t.status = 'active'
     order by t.created_at desc
     limit 1
     for update;
```

par :

```sql
    update public.matches set status = 'visit_planned' where id = v_match and status = 'interested';
    -- Le deal OUVERT le plus récent de l'acheteur, la règle de wa_matching_consigner : un deal perdu n'en est pas un.
    select t.id, t.stage::text into v_deal, v_etape
      from public.transactions t
     where t.agency_id = p_agency and t.contact_buyer_id = p_contact
       and t.status in ('active', 'on_hold') and t.stage <> 'lost'
     order by t.created_at desc
     limit 1
     for update;
```

Dans `supabase/functions/_shared/whatsapp-agent-router.ts`, remplacer :

```ts
  // comme toute action auto. Le deal peut aussi être CRÉÉ (à new_lead, faute d'un deal actif) plutôt que simplement
```

par :

```ts
  // comme toute action auto. Le deal peut aussi être CRÉÉ (à new_lead, faute d'un deal ouvert) plutôt que simplement
```

- [ ] **Étape 6 : Relancer les tests**

```bash
npx vitest run tests/unit/deal-ouvert.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/fiche-planifier-visite.spec.ts tests/unit/matching-sans-sortie.spec.ts
```

Attendu : PASS, `Test Files  4 passed (4)`, `Tests  92 passed (92)`.

- [ ] **Étape 7 : Les cas de base (W7)**

Contre une vraie base : « proposé » et la visite d'un intéressé, sur un acheteur dont le seul deal est perdu (l'étape `lost`, le statut `active`, ce qu'écrit « Marquer perdu »), ouvrent un deal neuf — qui porte la relance, ou la visite et l'avancée à `visit_planned` — et laissent le perdu tel quel ; un deal suspendu (`on_hold`) reçoit le geste. Ces cas ne tournent pas sur cette machine : ne pas les déclarer verts.

Dans `tests/backend/matching-whatsapp.spec.ts`, remplacer :

```ts
//       RPC elle-même compte comme un retour pour le même acheteur — rien qu'un faux client ne peut prouver, lui
//       qui n'applique ni le schéma ni `!inner`. À garder VERTE en CI avant toute fusion de ce lot.
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés — et les crochets aussi : ils
```

par :

```ts
//       RPC elle-même compte comme un retour pour le même acheteur — rien qu'un faux client ne peut prouver, lui
//       qui n'applique ni le schéma ni `!inner`. À garder VERTE en CI avant toute fusion de ce lot.
//   W7  (lot E1) un deal perdu ne reçoit plus de geste neuf : « Marquer perdu » n'écrit que l'étape `lost`, le statut
//       reste `active`. « proposé » et la visite d'un intéressé ouvrent un deal neuf, que portent la relance et la
//       visite, au lieu de se rattacher au perdu, qui ne reçoit rien (ni mandat, ni étape) ; un deal suspendu
//       (`on_hold`) reste ouvert : le geste s'y rattache. La règle de `dealOuvert` (src/lib/dealOuvert.ts).
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés — et les crochets aussi : ils
```

Ajouter à la fin de `tests/backend/matching-whatsapp.spec.ts` :

```ts

describe.skipIf(!HAS_KEYS)('W7 — un deal perdu ne reçoit plus de geste neuf (lot E1)', () => {
  /** Un deal de l'acheteur, posé comme le Pipeline le laisse : « Marquer perdu » n'écrit que l'étape. */
  const mkDeal = async (acheteur: string, champs: Record<string, unknown>) => {
    const { data, error } = await svc.from('transactions').insert({
      agency_id: s.agencyAId, contact_buyer_id: acheteur, assigned_to: s.agentAId, ...champs,
    }).select('id').single()
    if (error) throw new Error(`transactions: ${error.message}`)
    return (data as { id: string }).id
  }
  const lireDeal = async (id: string) =>
    (await svc.from('transactions').select('stage, status, property_id').eq('id', id).single()).data as Record<string, unknown>

  it('« proposé » : un deal neuf s’ouvre et porte la relance ; le deal perdu ne reçoit rien', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W7Propose')
    const perdu = await mkDeal(acheteur, { stage: 'lost', status: 'active' })
    const bien = await mkBien(s.agencyAId, 'w7p')
    const m = await mkMatch(s.agencyAId, acheteur, { bien })
    const r = await consigner(m, 'propose')
    expect(r).toMatchObject({ ok: true, deja: false })
    expect(r.deal_id).not.toBe(perdu)
    expect(await lireDeal(r.deal_id!)).toEqual({ stage: 'new_lead', status: 'active', property_id: bien })
    expect((await svc.from('reminders').select('transaction_id').eq('id', r.relance_id!).single()).data)
      .toEqual({ transaction_id: r.deal_id })
    // Le perdu n'a pas reçu le mandat : il est resté tel que « Marquer perdu » l'a laissé.
    expect(await lireDeal(perdu)).toEqual({ stage: 'lost', status: 'active', property_id: null })
    expect((await svc.from('transactions').select('id').eq('contact_buyer_id', acheteur)).data).toHaveLength(2)
  })

  it('la visite d’un intéressé : un deal neuf s’ouvre, avance et porte la visite ; le deal perdu reste perdu', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W7Visite')
    const bien = await mkBien(s.agencyAId, 'w7v')
    const perdu = await mkDeal(acheteur, { stage: 'lost', status: 'active', property_id: bien })
    const m = await mkMatch(s.agencyAId, acheteur, { bien }, { status: 'interested', sent_at: ilYA(6) })
    const r = await planifier(acheteur, { bien }, dans(5))
    if (r.visite_id) visites.push(r.visite_id)
    expect(r).toMatchObject({ ok: true, match_id: m, etape_avant: 'new_lead' })
    expect(r.deal_id).not.toBe(perdu)
    expect(await lireDeal(r.deal_id!)).toEqual({ stage: 'visit_planned', status: 'active', property_id: bien })
    expect((await svc.from('visits').select('transaction_id').eq('id', r.visite_id!).single()).data)
      .toEqual({ transaction_id: r.deal_id })
    expect(await lireDeal(perdu)).toEqual({ stage: 'lost', status: 'active', property_id: bien })
  })

  it('un deal suspendu (`on_hold`) reste ouvert : « proposé » s’y rattache', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W7Suspendu')
    const suspendu = await mkDeal(acheteur, { stage: 'active_search', status: 'on_hold' })
    const m = await mkMatch(s.agencyAId, acheteur, { annonce: await mkAnnonce('w7s') })
    expect(await consigner(m, 'propose')).toMatchObject({ ok: true, deja: false, deal_id: suspendu })
  })
})
```

- [ ] **Étape 8 : Vérifier**

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx eslint --quiet src/lib/dealOuvert.ts src/lib/matchingGestes.ts src/components/crm/biens/fiche/visiteurs.ts supabase/functions/_shared/whatsapp-agent-router.ts tests/unit/deal-ouvert.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/fiche-planifier-visite.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/backend/matching-whatsapp.spec.ts
```

Attendu : aucune sortie.

`deno check --no-lock` est le seul filet de type du code Deno (le routeur n'a changé que d'un commentaire) :

```bash
deno check --no-lock supabase/functions/_shared/whatsapp-agent-router.ts
```

Attendu : sortie 0, `Check supabase/functions/_shared/whatsapp-agent-router.ts`.

```bash
npm run lint:deadcode
node scripts/check-migration-idempotence.mjs
npm run lint:spec-sql
```

Attendu : `✓ Aucun export mort (baseline propre — dont 86 modules chargés en lazy, invisibles pour ts-prune).` (`STATUTS_DEAL_OUVERT` et `ETAPE_DEAL_PERDU` sont lus par `matchingGestes.ts`, `dealOuvert` par `visiteurs.ts`, qui ne l'exporte plus) ; `✓ Migrations rejouables (368 vérifiées, 3 historiques exclues).` et `✓ Versions uniques (368 horodatages distincts).` (la migration se rejoue : deux `create or replace function`) ; `✓ Blocs SQL équilibrés — 40 corps dans 4 spec(s) marqué(s) @sql-blocks-check.` (la spec de base n'écrit pas de SQL). Aucune clé i18n n'est touchée : les portes i18n ne sont pas concernées.

La garde de la sortie vers l'acheteur et la migration du lot D2 lue (ses ancrages d'agence et l'ordre de ses verrous, que les lectures du deal gardent) :

```bash
npx vitest run tests/unit/matching-sans-sortie.spec.ts tests/unit/matching-whatsapp-sql.spec.ts
```

Attendu : PASS, `Test Files  2 passed (2)`, `Tests  55 passed (55)`.

Les specs qui chargent ou lisent un module touché — la règle et sa confrontation, les gestes au faux client, la fiche d'un mandat, l'indépendance du module des gestes, la migration lue, la garde, les copies du copilote confrontées au fil (qui chargent `useMatchingFil`, donc les gestes), le routeur :

```bash
npx vitest run tests/unit/deal-ouvert.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/fiche-planifier-visite.spec.ts tests/unit/matching-gestes-module.spec.ts tests/unit/matching-whatsapp-sql.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/whatsapp-matching-fil.spec.ts supabase/functions/_shared/whatsapp-agent-router.test.ts
```

Attendu : PASS, `Test Files  8 passed (8)`, `Tests  353 passed (353)`.

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint`, ni `deno` en parallèle) :

```bash
npx vitest run
```

Attendu : `Test Files  3 failed | 341 passed (344)`, `Tests  1 failed | 5239 passed | 3 skipped (5243)` ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`.

La spec de base se joue contre une base locale où la migration corrigée est appliquée (`supabase start`, `SUPABASE_TEST_*` posés) — elle ne tourne pas sur cette machine, ne pas la déclarer verte :

```bash
npx vitest run --config=vitest.backend.config.ts tests/backend/matching-whatsapp.spec.ts
```

W2 et W3 y rejouent les autres chemins des deux fonctions : un deal actif réutilisé (W2, deuxième et troisième propositions), un deal déjà à `offer` qui ne recule pas (W3).

---

## Tâche 11 : Le lien d'arrivée, appliqué une fois par navigation (conception §4.2)

Mesuré : le fil lit son arrivée dans l'adresse (`filLiens.ts` : `PARAMETRES` = contact, annonce, onglet, ligne, attente ; `lireArrivee`) et la « consomme » dans un état LOCAL, lu une fois au montage (`MatchingFil.tsx` : `useState(() => lireArrivee(params))`, `pivotConsomme`, `choix` résolu une fois, focus unique) ; l'adresse n'est jamais réécrite. Or les écrans d'onglet restent vivants (`EcransVivants`, `AgentLayout` : six au plus, un seul sur téléphone) et rangent leur état dans l'onglet (`useTabScopedState`) ; seul l'écran MONTRÉ reçoit `location.state` (les cachés reçoivent `null`, et leur `location.key` est l'identifiant de l'onglet) ; un onglet déjà ouvert sur l'adresse visée est seulement réactivé (`reconcilier`), et la barre le rouvre par `navigate(href)`, sans état (`selectionner`). D'où deux défauts : à chaque REMONTAGE (retour arrière, éviction au-delà des six écrans vivants, rechargement), l'arrivée se rejoue et écrase l'onglet et les filtres choisis depuis ; un nouveau clic sur le même lien vers un onglet déjà ouvert sur cette adresse ne la rejoue PAS. Le choix de page du pager (`MatchingPage.tsx` : `estArriveeFil`, `pivotConsomme`, un effet qui écrit la page sans attendre la pile d'onglets) et `?qui=1` des deux fiches de bien (`scrollIntoView`, « pas CONSOMMÉ ») ont le même défaut. Conception §4.2, sur la piste écrite au plan de D1 : la navigation porte un jeton, l'écran range dans la tranche de son onglet le dernier jeton appliqué et n'applique qu'un jeton neuf ; l'adresse n'est jamais réécrite (l'atelier le fait, `setSearchParams(…, { replace: true })` : la réconciliation des onglets y lirait un autre onglet) ; le pager attend la pile d'onglets, comme le fil.

La règle est un module PUR, `src/lib/jetonArrivee.ts` : `avecArrivee()` fabrique les options d'une navigation vers une arrivée — un jeton neuf, `crypto.randomUUID()` comme ailleurs dans le dépôt, dans son état ; `arriveeDe(location)` lit le jeton et l'adresse (chemin et requête) ; `arriveeNeuve(arrivée, dernière)` décide. Son crochet, `src/hooks/useArrivee.ts`, la rapporte à la dernière arrivée rangée dans la tranche de l'onglet — UNE CLÉ PAR LECTEUR, puisque le pager et le fil appliquent la même navigation (`pager.arrivee`, `fil.arrivee`, et `quiPour.arrivee` sur les deux fiches) — et ne la laisse appliquer que la pile d'onglets chargée (son hydratation REMPLACE la tranche) et l'écran montré (`useEcranActif`). L'écran lit `neuve` au rendu (l'arrivée l'emporte sans image intermédiaire), l'applique dans un effet, puis appelle `marquerAppliquee`. Une adresse sans jeton (tapée, collée, ouverte hors du CRM) a pour clé l'adresse elle-même, rapportée à celle de la dernière arrivée appliquée : son rechargement ne la rejoue pas (même adresse, toujours sans état), et l'onglet que la barre réactive — son adresse, sans jeton — ne rejoue pas l'arrivée appliquée sur elle. Le rechargement d'une arrivée à jeton ne la rejoue pas non plus : `navigate(…, { state })` écrit `history.state = { usr, key, idx }`, que le navigateur garde avec l'entrée, et le routeur relit `history.state.usr` au démarrage (`createBrowserLocation`, `@remix-run/router` 1.23.2 ; le test le montre sur `BrowserRouter`). Les douze liens d'arrivée, dans neuf fichiers, s'écrivent `navigate(<gabarit ancré>, avecArrivee())` : `redirection-ouverte.spec.ts` classe chaque `navigate(` par son PREMIER argument, et envelopper `navigate` dans une fonction y aurait fait un puits dynamique à inscrire ; `go` de la fiche deal passe ses options au routeur. Un lien sans arrivée (barre latérale, Analytics, KYC, « Proposer à des acheteurs » de la fiche d'un mandat) n'en porte pas. L'atelier, encore en page 0 jusqu'à la tâche 13, réécrit son adresse sur un geste de l'agent : le pager y voit une adresse neuve sans jeton et repose la page 0, où l'agent se trouve déjà.

Choix à valider : la clé d'une adresse sans jeton est l'adresse elle-même, rapportée à celle de la dernière arrivée appliquée — la même adresse ouverte à nouveau sans jeton dans un onglet du CRM qui l'a déjà appliquée ne se rejoue donc pas (par exemple collée dans une nouvelle fenêtre dont la pile serveur réactive cet onglet) ; seule la DERNIÈRE arrivée est retenue, par lecteur et par onglet (« le dernier jeton appliqué ») : revenir par l'historique sur une arrivée plus ancienne du même onglet la rejoue ; une clé de tranche par lecteur ; la fiche ne marque `?qui=1` appliqué qu'une fois défilée (bien et compatibles lus), et un écran caché n'applique rien ; les deux modules neufs entrent dans le périmètre de la garde « sans sortie », comme `dealOuvert.ts` ; le test de rendu monte la VRAIE pile d'onglets (`CrmTabsProvider`, comme `crm-tabs-compte.spec.tsx`) sous le crochet que partagent les trois écrans — le dépôt n'a aucune spec de rendu de ces écrans.

**Fichiers :**
- Créer (tests) : `tests/unit/jeton-arrivee.spec.tsx`
- Modifier (tests) : `tests/unit/matching-sans-sortie.spec.ts`
- Créer (la règle) : `src/lib/jetonArrivee.ts`
- Créer (le crochet) : `src/hooks/useArrivee.ts`
- Modifier (les écrans) : `src/components/matching-fil/MatchingFil.tsx`, `src/pages/agent/MatchingPage.tsx`, `src/pages/agent/ListingDetailPage.tsx`, `src/pages/agent/ExternalListingDetailPage.tsx`
- Modifier (les liens) : `src/pages/agent/TodayPage.tsx`, `src/pages/agent/ContactDetailPage.tsx`, `src/pages/agent/ContactsPage.tsx`, `src/pages/agent/DealDetailPage.tsx`, `src/pages/agent/ListingsPage.tsx`, `src/pages/agent/NouveauBienPage.tsx`, `src/components/matching-recherche/MatchingRechercheHybride.tsx` (et le lien de chaque fiche vers le fil)
- Modifier (commentaire) : `src/components/matching-fil/filLiens.ts`

- [ ] **Étape 1 : Écrire les tests qui échouent**

La règle, pure ; le crochet monté pour de vrai — `createRoot` + `act`, le routeur mémoire, la vraie pile d'onglets sur un client Supabase simulé — : le remontage, le retour arrière après « Voir le contact », l'onglet réactivé sans jeton, le nouveau clic, l'adresse sans jeton, le rechargement (la tranche relue du miroir de session), l'attente de la pile d'onglets et l'écran caché ; le routeur du navigateur, qui relit le jeton dans `history.state` ; les quatre écrans (leur clé, leur marque, aucune adresse réécrite) ; les douze liens, qui portent chacun un jeton. La garde « sans sortie » lit les deux modules neufs.

Créer `tests/unit/jeton-arrivee.spec.tsx` :

```tsx
/**
 * Le jeton d'arrivée (lot E1, conception `2026-09-27-matching-lot-e1-bureau-design.md` §4.2 et §8) : une arrivée — une
 * place du fil de matchs, la page du fil dans le pager de Matching, « Qui pour ce bien ? » d'une fiche (`?qui=1`) —
 * s'applique UNE fois par navigation.
 *
 * Ce que cette spec refuse :
 *   · une arrivée rejouée au remontage de l'écran, au retour sur son onglet, à un retour arrière ou au rechargement ;
 *   · une arrivée ignorée sur un NOUVEAU clic, même vers un onglet déjà ouvert sur cette adresse ;
 *   · une arrivée appliquée avant le chargement de la pile d'onglets (l'hydratation l'effacerait) ou par un écran caché ;
 *   · une adresse réécrite par le fil, le pager ou une fiche ;
 *   · un lien d'arrivée sans jeton : son second clic serait ignoré.
 *
 * Le crochet (`useArrivee`) est monté pour de vrai — `createRoot` + `act`, le routeur mémoire et la VRAIE pile d'onglets
 * (`CrmTabsProvider`) sur un client Supabase simulé, comme `crm-tabs-compte.spec.tsx`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, useEffect, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BrowserRouter, MemoryRouter, Route, Routes, useLocation, useNavigate, useSearchParams,
  type InitialEntry, type NavigateFunction,
} from 'react-router-dom'
import { poserStockagesMemoire } from './helpers/stockage-memoire'
import { emptyRoots, readFileSafely, rel, scanRoots } from './helpers/fs-scan'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const h = vi.hoisted(() => ({
  /** La lecture de la pile serveur (`crm_open_tabs`) : absente, aucune ligne ; posée, celle que le test tient. */
  lecture: null as null | Promise<{ data: unknown; error: null }>,
  naviguer: null as null | NavigateFunction,
  /** Les arrivées appliquées par l'écran monté, dans l'ordre. */
  applications: [] as string[],
  /** L'arrivée que lit l'écran monté sous le routeur du navigateur. */
  lue: null as null | { jeton: string | null; adresse: string },
}))

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1' }, profile: { agency_id: 'ag-1' } }) }))

vi.mock('@/lib/supabase', () => {
  const chaine = {
    select: () => chaine,
    eq: () => chaine,
    maybeSingle: () => h.lecture ?? Promise.resolve({ data: null, error: null }),
  }
  return { supabase: { from: () => chaine, rpc: async () => ({ data: { revision: 1, stale: false }, error: null }) } }
})

import { CrmTabsProvider } from '@/components/crm/CrmTabsProvider'
import { estArriveeFil } from '@/components/matching-fil/filLiens'
import { useArrivee } from '@/hooks/useArrivee'
import { EcranActifProvider } from '@/hooks/useEcranActif'
import { arriveeDe, arriveeNeuve, avecArrivee } from '@/lib/jetonArrivee'
import { ROUTER_FUTURE } from '@/lib/routerFuture'

const FIL = '/dashboard/matching'
const A = `${FIL}?attente=c7`
const loc = (search: string, state: unknown = null) => ({ pathname: FIL, search, state })

describe('le jeton d’arrivée — la règle', () => {
  it('chaque navigation vers une arrivée porte un jeton neuf, dans son état', () => {
    const un = avecArrivee()
    const deux = avecArrivee()
    expect(un.state.arrivee).toMatch(/\S/)
    expect(un.state.arrivee).not.toBe(deux.state.arrivee)
  })

  it('l’arrivée d’une localisation : le jeton de son état, et son adresse — chemin et requête', () => {
    expect(arriveeDe(loc('?attente=c7', { arrivee: 'j1' }))).toEqual({ jeton: 'j1', adresse: A })
    // Un autre état de navigation (l'accueil KYC pose `openWizard`), un jeton malformé, pas d'état du tout : pas de jeton.
    for (const state of [null, undefined, { openWizard: true }, { arrivee: 7 }, 'j1']) {
      expect(arriveeDe(loc('?attente=c7', state)).jeton, JSON.stringify(state)).toBeNull()
    }
  })

  it('un jeton neuf s’applique ; le même, jamais deux fois ; un nouveau sur la même adresse, si', () => {
    expect(arriveeNeuve({ jeton: 'j1', adresse: A }, null)).toBe(true)
    expect(arriveeNeuve({ jeton: 'j1', adresse: A }, { jeton: 'j1', adresse: A })).toBe(false)
    expect(arriveeNeuve({ jeton: 'j2', adresse: A }, { jeton: 'j1', adresse: A })).toBe(true)
  })

  it('une adresse sans jeton s’applique une fois, sur sa clé : l’adresse elle-même', () => {
    expect(arriveeNeuve({ jeton: null, adresse: A }, null)).toBe(true)
    expect(arriveeNeuve({ jeton: null, adresse: A }, { jeton: null, adresse: A })).toBe(false)
    expect(arriveeNeuve({ jeton: null, adresse: `${FIL}?attente=c9` }, { jeton: null, adresse: A })).toBe(true)
    // L'onglet que la barre réactive navigue vers SON adresse, sans jeton : l'arrivée appliquée sur elle ne se rejoue pas.
    expect(arriveeNeuve({ jeton: null, adresse: A }, { jeton: 'j1', adresse: A })).toBe(false)
    // Un nouveau clic sur le lien, après une adresse tapée : son jeton est neuf.
    expect(arriveeNeuve({ jeton: 'j3', adresse: A }, { jeton: null, adresse: A })).toBe(true)
  })

  it('un rechargement rend le même état, donc le même jeton : l’arrivée ne se rejoue pas', () => {
    const navigation = avecArrivee()
    const appliquee = arriveeDe(loc('?attente=c7', navigation.state))
    // Le navigateur garde avec l'entrée d'historique une COPIE structurée de l'état, et la rend au rechargement.
    expect(arriveeNeuve(arriveeDe(loc('?attente=c7', structuredClone(navigation.state))), appliquee)).toBe(false)
    // Une adresse sans jeton se recharge sans état : sa clé, l'adresse, n'a pas bougé.
    expect(arriveeNeuve(arriveeDe(loc('?attente=c7')), arriveeDe(loc('?attente=c7')))).toBe(false)
  })

  it('ce que l’onglet restitue d’un schéma antérieur ne compte pour rien : l’arrivée est neuve', () => {
    for (const derniere of ['j1', 3, true, {}, { jeton: 'j1' }, { jeton: 5, adresse: A }, { jeton: 'j1', adresse: 7 }]) {
      expect(arriveeNeuve({ jeton: 'j1', adresse: A }, derniere), JSON.stringify(derniere)).toBe(true)
    }
  })
})

let hote: HTMLDivElement | null = null
let racine: Root | null = null

async function rendre(arbre: ReactNode): Promise<void> {
  if (!racine) {
    hote = document.createElement('div')
    document.body.appendChild(hote)
    racine = createRoot(hote)
  }
  await act(async () => { racine!.render(arbre) })
}

function demonter(): void {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
}

async function naviguer(vers: string | number, options?: { state: unknown }): Promise<void> {
  await act(async () => {
    if (typeof vers === 'number') h.naviguer!(vers)
    else h.naviguer!(vers, options)
  })
}

function Pilote() {
  const navigate = useNavigate()
  useEffect(() => { h.naviguer = navigate })
  return null
}

/** Un écran qui lit son arrivée comme le fil : il l'applique — ici, il la consigne —, puis la marque. */
function EcranFil() {
  const [params] = useSearchParams()
  const { pathname, search } = useLocation()
  const { aAppliquer, marquerAppliquee } = useArrivee('fil.arrivee', estArriveeFil(params))
  useEffect(() => {
    if (!aAppliquer) return
    h.applications.push(`${pathname}${search}`)
    marquerAppliquee()
  }, [aAppliquer, marquerAppliquee, pathname, search])
  return null
}

/** Un écran qui lit l'arrivée de sa localisation, sous le routeur du navigateur. */
function LecteurNavigateur() {
  const location = useLocation()
  useEffect(() => { h.lue = arriveeDe(location) })
  return null
}

function Arbre({ entree, montage = 0, actif = true }: { entree: InitialEntry; montage?: number; actif?: boolean }) {
  return (
    <MemoryRouter initialEntries={[entree]} future={ROUTER_FUTURE}>
      <CrmTabsProvider>
        <Pilote />
        <EcranActifProvider value={actif}>
          <Routes>
            {/* Monté sur sa route, comme l'écran : en partir le démonte, y revenir le remonte. */}
            <Route path={FIL} element={<EcranFil key={montage} />} />
            <Route path="*" element={null} />
          </Routes>
        </EcranActifProvider>
      </CrmTabsProvider>
    </MemoryRouter>
  )
}

const avec = (jeton: string, search = '?attente=c7'): InitialEntry => ({ pathname: FIL, search, state: { arrivee: jeton } })

beforeEach(() => {
  poserStockagesMemoire()
  h.lecture = null
  h.naviguer = null
  h.applications = []
  h.lue = null
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  })
})

afterEach(() => demonter())

describe('le jeton d’arrivée — dans l’onglet du CRM', () => {
  it('appliquée une fois : remonter l’écran ne la rejoue pas', async () => {
    await rendre(<Arbre entree={avec('j1')} />)
    expect(h.applications).toEqual([A])
    await rendre(<Arbre entree={avec('j1')} montage={1} />)
    expect(h.applications).toEqual([A])
  })

  it('un retour arrière après « Voir le contact » ne la rejoue pas', async () => {
    await rendre(<Arbre entree={avec('j1')} />)
    await naviguer('/dashboard/contacts/c7')
    await naviguer(-1)
    expect(h.applications).toEqual([A])
  })

  it('l’onglet que la barre réactive — son adresse, sans jeton — ne la rejoue pas', async () => {
    await rendre(<Arbre entree={avec('j1')} />)
    await naviguer('/dashboard/contacts/c7')
    await naviguer(A)
    expect(h.applications).toEqual([A])
  })

  it('un NOUVEAU clic sur le même lien la rejoue, l’écran déjà monté sur cette adresse', async () => {
    await rendre(<Arbre entree={avec('j1')} />)
    await naviguer(A, avecArrivee())
    expect(h.applications).toEqual([A, A])
  })

  it('une adresse sans jeton s’applique une fois ; une autre adresse, une fois aussi', async () => {
    await rendre(<Arbre entree={A} />)
    await rendre(<Arbre entree={A} montage={1} />)
    await naviguer(A)
    expect(h.applications).toEqual([A])
    await naviguer(`${FIL}?attente=c9`)
    expect(h.applications).toEqual([A, `${FIL}?attente=c9`])
  })

  it('un rechargement ne la rejoue pas : même entrée d’historique, même tranche (le miroir de session)', async () => {
    await rendre(<Arbre entree={avec('j1')} />)
    demonter()
    // Un arbre NEUF — routeur, pile d'onglets, écran —, sur la même entrée et le même stockage de session.
    await rendre(<Arbre entree={avec('j1')} />)
    expect(h.applications).toEqual([A])
  })

  it('elle attend la pile d’onglets : appliquée après l’hydratation, et une seule fois', async () => {
    let servir: (r: { data: unknown; error: null }) => void = () => {}
    h.lecture = new Promise((r) => { servir = r })
    await rendre(<Arbre entree={avec('j1')} />)
    expect(h.applications).toEqual([])
    // La pile serveur arrive : l'hydratation REMPLACE la pile locale — une arrivée appliquée avant y serait perdue, et
    // rejouée.
    await act(async () => { servir({ data: { tabs: [], active_index: 0, revision: 1 }, error: null }) })
    expect(h.applications).toEqual([A])
  })

  it('un écran caché ne l’applique pas : il attend d’être montré', async () => {
    await rendre(<Arbre entree={avec('j1')} actif={false} />)
    expect(h.applications).toEqual([])
    await rendre(<Arbre entree={avec('j1')} />)
    expect(h.applications).toEqual([A])
  })

  it('sans paramètre du fil, rien à appliquer — même sous un jeton', async () => {
    await rendre(<Arbre entree={avec('j1', '')} />)
    expect(h.applications).toEqual([])
  })

  it('un rechargement relit le même jeton : le routeur le reprend dans `history.state`', async () => {
    window.history.replaceState(null, '', FIL)
    await rendre(<BrowserRouter future={ROUTER_FUTURE}><Pilote /><LecteurNavigateur /></BrowserRouter>)
    await naviguer(A, avecArrivee())
    const lue = h.lue
    expect(lue).toEqual({ jeton: expect.any(String), adresse: A })
    demonter()
    h.lue = null
    // Un routeur NEUF sur la même entrée d'historique : ce que fait un rechargement.
    await rendre(<BrowserRouter future={ROUTER_FUTURE}><LecteurNavigateur /></BrowserRouter>)
    expect(h.lue).toEqual(lue)
  })
})

const lire = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

describe('le jeton d’arrivée — les écrans et leurs liens', () => {
  /** Les écrans qui appliquent une arrivée, chacun sous SA clé : le pager et le fil appliquent la même navigation. */
  const ECRANS: [string, string][] = [
    ['src/components/matching-fil/MatchingFil.tsx', "useArrivee('fil.arrivee', estArriveeFil(params))"],
    ['src/pages/agent/MatchingPage.tsx', "useArrivee('pager.arrivee', estArriveeFil(searchParams))"],
    ['src/pages/agent/ListingDetailPage.tsx', "useArrivee('quiPour.arrivee', params.has(PARAM_QUI_POUR))"],
    ['src/pages/agent/ExternalListingDetailPage.tsx', "useArrivee('quiPour.arrivee', params.has(PARAM_QUI_POUR))"],
  ]

  it.each(ECRANS)('%s applique son arrivée une fois, et ne réécrit jamais son adresse', (fichier, appel) => {
    const code = lire(fichier)
    expect(code).toContain(appel)
    expect(code).toMatch(/\bmarquerAppliquee\(\)/)
    // ⛔ La réconciliation des onglets lirait une adresse réécrite comme celle d'un autre onglet.
    expect(code).not.toMatch(/setSearchParams|replace:\s*true/)
  })

  /** Une cible d'arrivée : une place du fil, ou une fiche défilée jusqu'à « Qui pour ce bien ? ». */
  const CIBLE = /\/dashboard\/matching(?:\?|\$\{)|\/dashboard\/(?:listings|market)\/\$\{[^}]+\}\?\$\{PARAM_QUI_POUR\}=1/
  /** Les liens d'arrivée, par fichier. Un lien neuf s'inscrit ici — avec son jeton. */
  const SITES: Record<string, number> = {
    'src/components/matching-recherche/MatchingRechercheHybride.tsx': 1,
    'src/pages/agent/ContactDetailPage.tsx': 2,
    'src/pages/agent/ContactsPage.tsx': 1,
    'src/pages/agent/DealDetailPage.tsx': 1,
    'src/pages/agent/ExternalListingDetailPage.tsx': 1,
    'src/pages/agent/ListingDetailPage.tsx': 1,
    'src/pages/agent/ListingsPage.tsx': 1,
    'src/pages/agent/NouveauBienPage.tsx': 1,
    'src/pages/agent/TodayPage.tsx': 3,
  }

  it('chaque lien d’arrivée porte un jeton neuf : sans lui, un second clic sur le même lien serait ignoré', () => {
    const scan = scanRoots([{ root: 'src', keep: (n) => /\.(ts|tsx)$/.test(n) && !n.endsWith('.d.ts') }])
    expect(emptyRoots(scan)).toEqual([])
    expect(scan.unreadable).toEqual([])
    const trouves: Record<string, number> = {}
    const sansJeton: string[] = []
    for (const abs of scan.files) {
      const lu = readFileSafely(abs)
      if (lu.status !== 'ok') continue
      lu.value.split('\n').forEach((ligne, i) => {
        // Un commentaire cite ces adresses sans y mener.
        if (/^\s*(?:\/\/|\*|\/\*|\{\/\*)/.test(ligne) || !CIBLE.test(ligne)) return
        const f = rel(abs)
        trouves[f] = (trouves[f] ?? 0) + 1
        if (!/\b(?:navigate|go)\(/.test(ligne) || !ligne.includes('avecArrivee()')) sansJeton.push(`${f}:${i + 1}`)
      })
    }
    expect(sansJeton).toEqual([])
    expect(trouves).toEqual(SITES)
  })
})
```

Dans `tests/unit/matching-sans-sortie.spec.ts`, remplacer :

```ts
  'src/lib/matchingGestes.ts',
  'src/lib/matchingAnnulation.ts',
  'src/lib/dealOuvert.ts',
```

par :

```ts
  'src/lib/matchingGestes.ts',
  'src/lib/matchingAnnulation.ts',
  'src/lib/dealOuvert.ts',
  // Lot E1 : le jeton d'arrivée — sa règle et son crochet —, que lisent le fil, le pager et les fiches (`?qui=1`).
  'src/lib/jetonArrivee.ts',
  'src/hooks/useArrivee.ts',
```

```bash
npx vitest run tests/unit/jeton-arrivee.spec.tsx tests/unit/matching-sans-sortie.spec.ts
```

Attendu : ÉCHEC, `Test Files  2 failed (2)`, `Tests  1 failed | 17 passed (18)` : la spec neuve ne se charge pas, `Failed to resolve import "@/hooks/useArrivee" from "tests/unit/jeton-arrivee.spec.tsx". Does the file exist?` ; la garde, `src/lib/jetonArrivee.ts introuvable: expected 0 to be greater than 0`.

- [ ] **Étape 2 : La règle, un module pur**

Créer `src/lib/jetonArrivee.ts` :

```ts
/**
 * Le jeton d'arrivée (lot E1, conception `2026-09-27-matching-lot-e1-bureau-design.md` §4.2) — module PUR : ni React,
 * ni routeur, ni Supabase.
 *
 * Une ARRIVÉE est ce qu'un lien demande à l'écran où il mène : une place du fil de matchs (`?onglet`, `?ligne`,
 * `?attente`, `?contact`, `?annonce=p:`), la page du fil dans le pager de Matching, « Qui pour ce bien ? » d'une fiche
 * (`?qui=1`). L'adresse la porte, et la garde : ⛔ l'écran ne la réécrit jamais — la réconciliation des onglets du CRM
 * lirait l'adresse réécrite comme celle d'un autre onglet.
 *
 * Elle s'applique UNE fois par navigation. La navigation qui y mène porte un jeton neuf dans son état (`avecArrivee`),
 * que le navigateur garde avec l'entrée d'historique (`history.state`) ; l'écran range dans la tranche de son onglet la
 * dernière arrivée appliquée, et n'applique que celle qui est neuve (`arriveeNeuve`, par `useArrivee`). Donc :
 *   · revenir sur l'onglet, un retour arrière, une éviction au-delà des six écrans vivants ne la rejouent pas ;
 *   · un rechargement non plus : le navigateur rend la même entrée d'historique, donc le même état, que le routeur
 *     relit au démarrage (`location.state`) ;
 *   · un NOUVEAU clic sur le même lien la rejoue, même vers un onglet déjà ouvert sur cette adresse : son jeton est neuf.
 *
 * ⚠ UNE ADRESSE SANS JETON — tapée, collée, ouverte hors du CRM — s'applique une fois aussi : sa clé est l'adresse
 * elle-même (chemin et requête), rapportée à celle de la dernière arrivée appliquée. Un rechargement la rend telle
 * quelle, sans état : même clé, pas rejouée. Et un onglet que la barre réactive, qui navigue vers son adresse sans jeton,
 * ne rejoue pas l'arrivée appliquée sur cette adresse, avec ou sans jeton.
 * ⚠ Seule la DERNIÈRE est retenue : revenir, par l'historique, sur une arrivée plus ancienne du même onglet la rejoue.
 */

/** L'état d'une navigation vers une arrivée : son jeton. */
interface EtatArrivee {
  arrivee: string
}

/** Une arrivée : le jeton de sa navigation (`null` pour une adresse sans jeton) et son adresse, chemin et requête. */
export interface Arrivee {
  jeton: string | null
  adresse: string
}

/**
 * Les options d'une navigation vers une arrivée : un jeton neuf dans son état. Chaque lien d'arrivée s'écrit
 * `navigate(<gabarit ancré>, avecArrivee())` — sa cible reste un gabarit ancré (`redirection-ouverte.spec.ts`).
 */
export function avecArrivee(): { state: EtatArrivee } {
  return { state: { arrivee: crypto.randomUUID() } }
}

/** L'arrivée que porte une localisation du routeur : le jeton de son état, s'il en porte un, et son adresse. */
export function arriveeDe(l: { pathname: string; search: string; state: unknown }): Arrivee {
  const jeton = typeof l.state === 'object' && l.state !== null ? (l.state as { arrivee?: unknown }).arrivee : undefined
  return { jeton: typeof jeton === 'string' ? jeton : null, adresse: `${l.pathname}${l.search}` }
}

/** Ce que l'onglet restitue peut venir d'un schéma antérieur : seule une arrivée bien formée compte. */
function estArrivee(v: unknown): v is Arrivee {
  if (typeof v !== 'object' || v === null) return false
  const a = v as { jeton?: unknown; adresse?: unknown }
  return typeof a.adresse === 'string' && (a.jeton === null || typeof a.jeton === 'string')
}

/**
 * L'arrivée est-elle NEUVE au regard de la dernière appliquée dans l'onglet ? Avec un jeton : si ce n'est pas le sien.
 * Sans jeton : si son adresse n'est pas la sienne. Une valeur malformée ne compte pour rien : l'arrivée est neuve.
 */
export function arriveeNeuve(a: Arrivee, derniere: unknown): boolean {
  if (!estArrivee(derniere)) return true
  return a.jeton != null ? a.jeton !== derniere.jeton : a.adresse !== derniere.adresse
}
```

- [ ] **Étape 3 : Le crochet — la tranche de l'onglet, la pile d'onglets, l'écran montré**

Créer `src/hooks/useArrivee.ts` :

```ts
/**
 * L'arrivée d'une navigation, appliquée UNE fois dans l'onglet du CRM (lot E1, conception
 * `2026-09-27-matching-lot-e1-bureau-design.md` §4.2 ; la règle vit dans `src/lib/jetonArrivee.ts`). Lue par le fil de
 * matchs, le pager de Matching et les deux fiches de bien (`?qui=1`).
 *
 * L'écran lit `neuve` au RENDU — une arrivée neuve l'emporte sur ce que l'onglet avait retenu, sans image
 * intermédiaire —, l'applique dans un EFFET quand `aAppliquer` est vrai, puis appelle `marquerAppliquee`.
 *
 * ⛔ TANT QUE LA PILE D'ONGLETS CHARGE, RIEN NE S'APPLIQUE. L'hydratation de `CrmTabsProvider` REMPLACE la tranche de
 * l'onglet une fois la pile serveur arrivée (`reconcilier`) : ce qu'on y écrirait avant serait effacé aussitôt — l'effet
 * de l'arrivée, et la trace de son application avec : elle se rejouerait.
 * ⛔ UN ÉCRAN CACHÉ N'APPLIQUE RIEN (`useEcranActif`) : il attend d'être montré.
 * ⚠ Chaque lecteur a SA clé dans la tranche : le pager et le fil appliquent la même navigation, chacun sa part.
 * Hors fournisseur d'onglets (bancs sans onglets), la tranche est un état local : l'arrivée s'applique à chaque montage.
 */
import { useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useCrmTabsOptionnel, useTabScopedState } from '@/hooks/useCrmTabs'
import { useEcranActif } from '@/hooks/useEcranActif'
import { arriveeDe, arriveeNeuve, type Arrivee } from '@/lib/jetonArrivee'

/** Ce qu'un écran sait de l'arrivée que porte sa page. */
interface ArriveeEcran {
  /** La page porte une arrivée que l'onglet n'a pas encore appliquée : l'écran la montre déjà. */
  neuve: boolean
  /** Le moment de l'appliquer : neuve, la pile d'onglets chargée, l'écran montré. */
  aAppliquer: boolean
  /** Son identité (son jeton, sinon son adresse), `null` sans arrivée : de quoi repartir d'un état local neuf. */
  id: string | null
  /** La range, appliquée, dans la tranche de l'onglet. */
  marquerAppliquee: () => void
}

/**
 * L'arrivée que porte la page, rapportée à la dernière appliquée dans l'onglet.
 *
 * @param cle la clé de la tranche — une par lecteur
 * @param presente la page porte une arrivée pour ce lecteur : ses paramètres sont dans l'adresse
 */
export function useArrivee(cle: string, presente: boolean): ArriveeEcran {
  const location = useLocation()
  const [derniere, ranger] = useTabScopedState<unknown>(cle, null)
  const chargement = useCrmTabsOptionnel()?.chargement ?? false
  const ecranActif = useEcranActif()
  const { jeton, adresse } = arriveeDe(location)
  const demandee = useMemo<Arrivee | null>(() => (presente ? { jeton, adresse } : null), [presente, jeton, adresse])
  const neuve = demandee != null && arriveeNeuve(demandee, derniere)
  const marquerAppliquee = useCallback(() => { if (demandee) ranger(demandee) }, [demandee, ranger])
  return {
    neuve,
    aAppliquer: neuve && !chargement && ecranActif,
    id: demandee ? demandee.jeton ?? demandee.adresse : null,
    marquerAppliquee,
  }
}
```

- [ ] **Étape 4 : Le fil applique son arrivée une fois**

Le fil relit son arrivée à chaque rendu, la montre tant qu'elle est neuve, la range dans l'onglet quand `useArrivee` le permet, et pose sa ligne — son choix, sa résolution, son focus — une fois par arrivée : celle d'un nouveau clic, l'écran déjà monté, remplace la précédente. Les valeurs initiales des filtres et de l'onglet ne portent plus l'arrivée : c'est son application qui les écrit. `useCrmTabsOptionnel` sort des imports (le crochet lit la pile d'onglets).

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
import { useAuth } from '@/hooks/useAuth'
import { useCrmTabsOptionnel, useTabScopedState } from '@/hooks/useCrmTabs'
import { useEcranActif } from '@/hooks/useEcranActif'
```

par :

```tsx
import { useAuth } from '@/hooks/useAuth'
import { useTabScopedState } from '@/hooks/useCrmTabs'
import { useEcranActif } from '@/hooks/useEcranActif'
import { useArrivee } from '@/hooks/useArrivee'
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
import { ligneCourante, lireArrivee } from './filLiens'
```

par :

```tsx
import { estArriveeFil, ligneCourante, lireArrivee } from './filLiens'
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
  // Les liens d'arrivée (`filLiens.ts`, conception de D1 §4) : `?contact=` et `?annonce=p:<uuid>` — ceux de l'atelier,
  // qui gardent leur sens —, et `?onglet=`, `?ligne=<clé>`, `?attente=<contact>`. Lus une fois par montage de l'écran.
  // ⚠ Limite connue, déjà vraie de `?contact=` et en attente pour le lot E : un remontage (retour arrière, éviction
  // au-delà de six écrans, rechargement) rejoue le lien ; un onglet du CRM déjà ouvert sur la même URL est réactivé
  // sans le relire.
  const [arrivee] = useState(() => lireArrivee(params))
  const filtresArrivee = arrivee.filtres
  // Les filtres sont rangés dans l'ONGLET : ils survivent à un aller-retour entre onglets. La
  // sélection, elle, reste LOCALE (§2 des retours de revue) — la ranger dans l'onglet écrivait sur
  // le serveur à CHAQUE flèche du clavier, pour une position qui n'a jamais eu besoin de survivre.
  // Même règle pour les cases cochées et le pas de chargement d'une sélection du marché (lot 2).
  const [filtresRetenus, setFiltres] = useTabScopedState<FilFiltres>('fil.filtres', filtresArrivee ?? SANS_FILTRE)
  // L'onglet aussi (lot B) : ce qu'on y relit peut venir d'un schéma antérieur, d'où `ongletValide`.
  const [ongletRetenu, setOngletRetenu] = useTabScopedState<FilOnglet>('fil.onglet', arrivee.onglet ?? 'aProposer')
  // La ligne d'un lien d'arrivée est le premier choix ; absente de la première lecture complète, elle est abandonnée.
  const [choix, setChoix] = useState<string | null>(arrivee.ligne)
  /** La ligne d'arrivée est choisie ou abandonnée : résolue une fois, à la première lecture complète du fil (plus bas). */
  const [arriveeResolue, setArriveeResolue] = useState(arrivee.ligne == null)
  // ⚠ Un lien d'arrivée l'emporte sur les filtres que l'onglet avait retenus — même règle et même
  // mécanique que le pivot du pager (`MatchingPage`) : lu au rendu, écrit dans un effet.
  const [pivotConsomme, setPivotConsomme] = useState(filtresArrivee == null)
  const filtres = pivotConsomme || !filtresArrivee ? filtresRetenus : filtresArrivee
  // L'onglet d'un lien d'arrivée l'emporte sur l'onglet retenu, par la même mécanique que les filtres.
  const onglet = ongletValide(pivotConsomme || !arrivee.onglet ? ongletRetenu : arrivee.onglet)
  // ⛔ TANT QUE LA PILE D'ONGLETS CHARGE, ON N'ÉCRIT PAS. L'hydratation de `CrmTabsProvider` REMPLACE
  // la tranche de l'onglet une fois la pile serveur arrivée (`reconcilier`) : un pivot consommé avant
  // cette arrivée écrivait dans un onglet qui n'existait pas encore, et l'hydratation l'effaçait
  // aussitôt — le lien d'arrivée perdait son filtre sur un chargement à froid.
  const chargementOnglets = useCrmTabsOptionnel()?.chargement ?? false
  useEffect(() => {
    if (pivotConsomme || !filtresArrivee || chargementOnglets) return
    setFiltres(filtresArrivee)
    if (arrivee.onglet) setOngletRetenu(arrivee.onglet)
    setPivotConsomme(true)
  }, [pivotConsomme, filtresArrivee, arrivee.onglet, setFiltres, setOngletRetenu, chargementOnglets])
```

par :

```tsx
  // Les liens d'arrivée (`filLiens.ts`, conception de D1 §4) : `?contact=` et `?annonce=p:<uuid>` — ceux de l'atelier,
  // qui gardent leur sens —, et `?onglet=`, `?ligne=<clé>`, `?attente=<contact>`. Une arrivée s'applique UNE fois par
  // navigation (`useArrivee`) : revenir sur l'onglet, un retour arrière, une éviction au-delà de six écrans vivants ou un
  // rechargement ne la rejouent pas ; un nouveau clic sur le même lien, si. ⛔ L'adresse n'est jamais réécrite.
  const arrivee = useMemo(() => lireArrivee(params), [params])
  const {
    neuve: arriveeNeuve, aAppliquer: arriveeAAppliquer, id: arriveeId, marquerAppliquee,
  } = useArrivee('fil.arrivee', estArriveeFil(params))
  // Les filtres sont rangés dans l'ONGLET : ils survivent à un aller-retour entre onglets. La
  // sélection, elle, reste LOCALE (§2 des retours de revue) — la ranger dans l'onglet écrivait sur
  // le serveur à CHAQUE flèche du clavier, pour une position qui n'a jamais eu besoin de survivre.
  // Même règle pour les cases cochées et le pas de chargement d'une sélection du marché (lot 2).
  const [filtresRetenus, setFiltres] = useTabScopedState<FilFiltres>('fil.filtres', SANS_FILTRE)
  // L'onglet aussi (lot B) : ce qu'on y relit peut venir d'un schéma antérieur, d'où `ongletValide`.
  const [ongletRetenu, setOngletRetenu] = useTabScopedState<FilOnglet>('fil.onglet', 'aProposer')
  // ⚠ Une arrivée NEUVE l'emporte sur les filtres et l'onglet retenus — même règle et même mécanique que le pager
  // (`MatchingPage`) : lue au rendu, rangée dans l'onglet par un effet, qui attend la pile d'onglets (`useArrivee`).
  const filtres = arriveeNeuve && arrivee.filtres ? arrivee.filtres : filtresRetenus
  const onglet = ongletValide(arriveeNeuve && arrivee.onglet ? arrivee.onglet : ongletRetenu)
  useEffect(() => {
    if (!arriveeAAppliquer) return
    if (arrivee.filtres) setFiltres(arrivee.filtres)
    if (arrivee.onglet) setOngletRetenu(arrivee.onglet)
    marquerAppliquee()
  }, [arriveeAAppliquer, arrivee, setFiltres, setOngletRetenu, marquerAppliquee])
  const [choix, setChoix] = useState<string | null>(null)
  // La ligne d'une arrivée neuve est le premier choix ; absente de la première lecture complète, elle est abandonnée
  // (plus bas). Posée PENDANT LE RENDU, comme `coches`, une fois par arrivée : celle d'un nouveau clic sur le même lien,
  // l'écran déjà monté, remplace la précédente.
  const [ligneArrivee, setLigneArrivee] = useState<{ id: string; ligne: string | null; resolue: boolean } | null>(null)
  if (arriveeNeuve && arriveeId && ligneArrivee?.id !== arriveeId) {
    setLigneArrivee({ id: arriveeId, ligne: arrivee.ligne, resolue: arrivee.ligne == null })
    setChoix(arrivee.ligne)
  }
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
  // RENDU, comme `coches`, et une seule fois : dans un effet, `react-hooks/set-state-in-effect` le refuse.
  if (!arriveeResolue && aDesDonnees && !isLoading) {
    setArriveeResolue(true)
    if (arrivee.ligne && !ordre.includes(arrivee.ligne)) setChoix((c) => (c === arrivee.ligne ? null : c))
  }
```

par :

```tsx
  // RENDU, comme `coches`, et une fois par arrivée : dans un effet, `react-hooks/set-state-in-effect` le refuse.
  if (ligneArrivee && !ligneArrivee.resolue && aDesDonnees && !isLoading) {
    const { ligne } = ligneArrivee
    setLigneArrivee({ ...ligneArrivee, resolue: true })
    if (ligne && !ordre.includes(ligne)) setChoix((c) => (c === ligne ? null : c))
  }
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
  // La ligne d'un lien d'arrivée prend le focus UNE fois, quand l'arrivée se résout : le fil défile jusqu'à elle et son
```

par :

```tsx
  // La ligne d'un lien d'arrivée prend le focus UNE fois par arrivée, à sa résolution : le fil défile jusqu'à elle et son
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
  const ecranActif = useEcranActif()
  const focusDepense = useRef(arrivee.ligne == null)
  useEffect(() => {
    if (focusDepense.current || !arriveeResolue || !ecranActif) return
    focusDepense.current = true
    const ligne = arrivee.ligne
    if (!ligne || choix !== ligne || !ordre.includes(ligne)) return
    const actif = document.activeElement
    if (actif == null || actif === document.body || actif === racine.current) focaliser(ligne)
  }, [arriveeResolue, ecranActif, ordre, choix, arrivee.ligne, focaliser])
```

par :

```tsx
  const ecranActif = useEcranActif()
  /** L'arrivée dont la ligne a déjà eu son focus unique, pris ou laissé. */
  const focusDepense = useRef<string | null>(null)
  useEffect(() => {
    if (!ligneArrivee?.resolue || !ecranActif || focusDepense.current === ligneArrivee.id) return
    focusDepense.current = ligneArrivee.id
    const { ligne } = ligneArrivee
    if (!ligne || choix !== ligne || !ordre.includes(ligne)) return
    const actif = document.activeElement
    if (actif == null || actif === document.body || actif === racine.current) focaliser(ligne)
  }, [ligneArrivee, ecranActif, ordre, choix, focaliser])
```

- [ ] **Étape 5 : Le pager attend la pile d'onglets, et choisit sa page par le même jeton**

La page d'arrivée n'est plus un état local lu au montage (`initialPage`, `pivotConsomme`) : une arrivée neuve montre la page 0, l'effet l'écrit dans l'onglet une fois la pile d'onglets chargée, puis la marque. Sans arrivée, la page mémorisée, sinon l'atterrissage. `useState` sort des imports.

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
```

par :

```tsx
import { useEffect, useRef, useLayoutEffect, useCallback } from 'react'
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
import { useEcranActifRef } from '@/hooks/useEcranActif'
```

par :

```tsx
import { useEcranActifRef } from '@/hooks/useEcranActif'
import { useArrivee } from '@/hooks/useArrivee'
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
const LANDING_PAGE = Math.max(0, MATCHING_PAGES.findIndex((p) => p.id === 'recherche'))
```

par :

```tsx
const LANDING_PAGE = Math.max(0, MATCHING_PAGES.findIndex((p) => p.id === 'recherche'))
// La page « par score » (page 0), où atterrit toute arrivée du fil. Index DÉRIVÉ, comme `LANDING_PAGE`.
const SCORE_PAGE = Math.max(0, MATCHING_PAGES.findIndex((p) => p.id === 'score'))
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
  const [searchParams] = useSearchParams()
  const [initialPage] = useState(() =>
    estArriveeFil(searchParams) || atterrissage === 'score'
      ? Math.max(0, MATCHING_PAGES.findIndex((pg) => pg.id === 'score'))
      : LANDING_PAGE,
  )
  const [pageStockee, setPage] = useTabScopedState('pager', initialPage)
  /**
   * ⚠ LE PIVOT L'EMPORTE SUR LA TRANCHE MÉMORISÉE.
   *
   * `useTabScopedState` rend la valeur STOCKÉE dès qu'elle existe. Dans un onglet
   * qui avait déjà servi à Matching et bougé son pager, une arrivée pivotée
   * (« Transmettre à … » depuis une fiche deal) atterrirait sur la page mémorisée
   * au lieu de l'Atelier : le geste qu'on vient de demander serait ignoré au
   * profit d'un souvenir.
   *
   * Règle : une INTENTION EXPRIMÉE MAINTENANT (le paramètre d'URL) passe devant
   * une position retenue.
   *
   * ⛔ La correction se lit au RENDU et s'écrit dans un EFFET — jamais l'inverse.
   * Poser la valeur pendant le rendu écrirait dans le fournisseur d'onglets
   * depuis le rendu d'un autre composant, ce que React refuse ; et la poser
   * seulement dans l'effet ferait afficher une frame sur la mauvaise page avant
   * de glisser vers l'Atelier.
   */
  const pivot = estArriveeFil(searchParams)
  const [pivotConsomme, setPivotConsomme] = useState(!pivot)
  const page = pivotConsomme ? pageStockee : initialPage
  useEffect(() => {
    if (pivotConsomme) return
    setPage(initialPage)
    setPivotConsomme(true)
  }, [pivotConsomme, initialPage, setPage])
  // `pageRef` sert au positionnement initial SANS animation (useLayoutEffect plus
  // bas) : il doit démarrer sur la page d'atterrissage, sinon on verrait l'Atelier
  // une frame avant de glisser vers Recherche. ⚠ Il lit `page` et non
  // `initialPage` : dans un onglet rouvert, la page RETROUVÉE est celle qu'il
  // faut poser d'emblée.
```

par :

```tsx
  const [searchParams] = useSearchParams()
  const [pageStockee, setPage] = useTabScopedState('pager', atterrissage === 'score' ? SCORE_PAGE : LANDING_PAGE)
  /**
   * ⚠ UNE ARRIVÉE NEUVE L'EMPORTE SUR LA PAGE MÉMORISÉE — une fois.
   *
   * `useTabScopedState` rend la valeur STOCKÉE dès qu'elle existe. Dans un onglet
   * qui avait déjà servi à Matching et bougé son pager, une arrivée pivotée
   * (« Transmettre à … » depuis une fiche deal) atterrirait sur la page mémorisée
   * au lieu de la page 0 : le geste qu'on vient de demander serait ignoré au
   * profit d'un souvenir.
   *
   * Règle : une INTENTION EXPRIMÉE MAINTENANT (un lien suivi) passe devant une
   * position retenue, une fois par navigation (`useArrivee`) : revenir sur
   * l'onglet, un retour arrière ou un rechargement rendent la page choisie
   * depuis ; un nouveau clic sur le même lien ramène à la page 0.
   *
   * ⛔ L'arrivée se lit au RENDU et s'écrit dans un EFFET — jamais l'inverse.
   * Poser la valeur pendant le rendu écrirait dans le fournisseur d'onglets
   * depuis le rendu d'un autre composant, ce que React refuse ; et la poser
   * seulement dans l'effet ferait afficher une frame sur la mauvaise page avant
   * de glisser vers la page 0. L'effet attend la pile d'onglets : écrite avant
   * son chargement, la page serait effacée par l'hydratation.
   */
  const {
    neuve: arriveeNeuve, aAppliquer: arriveeAAppliquer, marquerAppliquee,
  } = useArrivee('pager.arrivee', estArriveeFil(searchParams))
  const page = arriveeNeuve ? SCORE_PAGE : pageStockee
  useEffect(() => {
    if (!arriveeAAppliquer) return
    setPage(SCORE_PAGE)
    marquerAppliquee()
  }, [arriveeAAppliquer, setPage, marquerAppliquee])
  // `pageRef` sert au positionnement initial SANS animation (useLayoutEffect plus
  // bas) : il doit démarrer sur la page d'atterrissage, sinon on verrait l'Atelier
  // une frame avant de glisser vers Recherche. ⚠ Il lit `page` : dans un onglet
  // rouvert, la page RETROUVÉE est celle qu'il faut poser d'emblée.
```

- [ ] **Étape 6 : Les deux fiches défilent une fois, et leur lien vers le fil porte un jeton**

La fiche d'un mandat défile quand son bien et ses compatibles sont lus, la fiche d'une annonce quand son annonce l'est : chacune marque l'arrivée APRÈS le défilement.

Dans `src/pages/agent/ListingDetailPage.tsx`, remplacer :

```tsx
import { useQuiPourCeBien } from '@/hooks/useQuiPourCeBien'
import QuiPourFiche from '@/components/matching-fil/QuiPourFiche'
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
```

par :

```tsx
import { useQuiPourCeBien } from '@/hooks/useQuiPourCeBien'
import { useArrivee } from '@/hooks/useArrivee'
import QuiPourFiche from '@/components/matching-fil/QuiPourFiche'
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
import { avecArrivee } from '@/lib/jetonArrivee'
```

Dans `src/pages/agent/ListingDetailPage.tsx`, remplacer :

```tsx
  // ⚠ `?qui=1` n'est pas CONSOMMÉ : un remontage de l'écran (retour arrière, éviction au-delà de six écrans,
  // rechargement) rejoue le défilement — la limite connue des liens d'arrivée du fil (`MatchingFil`).
  const [params] = useSearchParams()
  const quiDemande = params.has(PARAM_QUI_POUR)
  const blocQuiPour = useRef<HTMLDivElement>(null)
  const bienCharge = bien?.id
  const compatiblesLus = !quiPour.isLoading
  useEffect(() => {
    if (quiDemande && bienCharge && compatiblesLus) blocQuiPour.current?.scrollIntoView({ block: 'start' })
  }, [quiDemande, bienCharge, compatiblesLus])
```

par :

```tsx
  // Le défilement est une ARRIVÉE (`useArrivee`) : il part une fois par navigation — un remontage de l'écran (retour
  // arrière, éviction au-delà de six écrans vivants, rechargement) ne le rejoue pas ; un nouveau clic sur le lien, si.
  const [params] = useSearchParams()
  const { aAppliquer: quiAAppliquer, marquerAppliquee } = useArrivee('quiPour.arrivee', params.has(PARAM_QUI_POUR))
  const blocQuiPour = useRef<HTMLDivElement>(null)
  const bienCharge = bien?.id
  const compatiblesLus = !quiPour.isLoading
  useEffect(() => {
    if (!quiAAppliquer || !bienCharge || !compatiblesLus) return
    blocQuiPour.current?.scrollIntoView({ block: 'start' })
    marquerAppliquee()
  }, [quiAAppliquer, bienCharge, compatiblesLus, marquerAppliquee])
```

Dans `src/pages/agent/ListingDetailPage.tsx`, remplacer :

```tsx
                    onOuvrirFil={(requete) => navigate(`/dashboard/matching?${requete}`)}
```

par :

```tsx
                    onOuvrirFil={(requete) => navigate(`/dashboard/matching?${requete}`, avecArrivee())}
```

Dans `src/pages/agent/ExternalListingDetailPage.tsx`, remplacer :

```tsx
import QuiPourFiche from '@/components/matching-fil/QuiPourFiche'
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
```

par :

```tsx
import QuiPourFiche from '@/components/matching-fil/QuiPourFiche'
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
import { useArrivee } from '@/hooks/useArrivee'
import { avecArrivee } from '@/lib/jetonArrivee'
```

Dans `src/pages/agent/ExternalListingDetailPage.tsx`, remplacer :

```tsx
  // `?qui=1` (« Ce qui a bougé », lot D1) : la page amène « Qui pour ce bien ? » à l'écran, sous le carrousel.
```

par :

```tsx
  // `?qui=1` (« Ce qui a bougé », lot D1) : la page amène « Qui pour ce bien ? » à l'écran, sous le carrousel — une fois
  // par navigation (`useArrivee`) : un remontage de l'écran ne le rejoue pas, un nouveau clic sur le lien, si.
```

Dans `src/pages/agent/ExternalListingDetailPage.tsx`, remplacer :

```tsx
  const [params] = useSearchParams()
  const quiDemande = params.has(PARAM_QUI_POUR)
  const blocQuiPour = useRef<HTMLElement>(null)
```

par :

```tsx
  const [params] = useSearchParams()
  const { aAppliquer: quiAAppliquer, marquerAppliquee } = useArrivee('quiPour.arrivee', params.has(PARAM_QUI_POUR))
  const blocQuiPour = useRef<HTMLElement>(null)
```

Dans `src/pages/agent/ExternalListingDetailPage.tsx`, remplacer :

```tsx
    const el = blocQuiPour.current
    if (!quiDemande || !annonceChargee || !el) return
    const r = el.getBoundingClientRect()
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'start' })
  }, [quiDemande, annonceChargee])
```

par :

```tsx
    const el = blocQuiPour.current
    if (!quiAAppliquer || !annonceChargee || !el) return
    const r = el.getBoundingClientRect()
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'start' })
    marquerAppliquee()
  }, [quiAAppliquer, annonceChargee, marquerAppliquee])
```

Dans `src/pages/agent/ExternalListingDetailPage.tsx`, remplacer :

```tsx
                  onOuvrirFil={(requete) => navigate(`/dashboard/matching?${requete}`)}
```

par :

```tsx
                  onOuvrirFil={(requete) => navigate(`/dashboard/matching?${requete}`, avecArrivee())}
```

- [ ] **Étape 7 : Chaque autre lien d'arrivée porte un jeton neuf**

« Aujourd'hui » — ses trois cas mènent au fil ou à la fiche défilée, et portent « Pendant ton absence », le segment Matching et le catalogue ; la fiche contact (« Sa boucle » et « Ouvrir dans le Matching ») ; la liste des contacts ; la fiche deal (« Transmettre à … ») ; « Nouveau bien », en pager et en page ; la pige de la Recherche. Le jeton n'est posé que lorsque le lien porte une arrivée.

Dans `src/pages/agent/TodayPage.tsx`, remplacer :

```tsx
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
```

par :

```tsx
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
import { avecArrivee } from '@/lib/jetonArrivee'
```

Dans `src/pages/agent/TodayPage.tsx`, remplacer :

```tsx
      case 'matching': navigate(ref ? `/dashboard/matching?contact=${ref}` : '/dashboard/matching'); break
      // Lot D1 : une place précise du fil (la requête de `lienFil`), et la fiche d'un mandat défilée jusqu'à « Qui pour
      // ce bien ? ». ⛔ Gabarits ANCRÉS (`/dashboard/…`) : `redirection-ouverte.spec.ts` refuse un puits dynamique.
      case 'matching-fil': navigate(`/dashboard/matching${ref ? `?${ref}` : ''}`); break
      case 'biens-qui-pour': navigate(ref ? `/dashboard/listings/${ref}?${PARAM_QUI_POUR}=1` : '/dashboard/listings'); break
```

par :

```tsx
      case 'matching': navigate(ref ? `/dashboard/matching?contact=${ref}` : '/dashboard/matching', ref ? avecArrivee() : undefined); break
      // Lot D1 : une place précise du fil (la requête de `lienFil`), et la fiche d'un mandat défilée jusqu'à « Qui pour
      // ce bien ? ». ⛔ Gabarits ANCRÉS (`/dashboard/…`) : `redirection-ouverte.spec.ts` refuse un puits dynamique.
      // Lot E1 : chaque arrivée porte un jeton neuf (`avecArrivee`) — l'écran l'applique une fois, un nouveau clic la
      // rejoue.
      case 'matching-fil': navigate(`/dashboard/matching${ref ? `?${ref}` : ''}`, ref ? avecArrivee() : undefined); break
      case 'biens-qui-pour': navigate(ref ? `/dashboard/listings/${ref}?${PARAM_QUI_POUR}=1` : '/dashboard/listings', ref ? avecArrivee() : undefined); break
```

Dans `src/pages/agent/ContactDetailPage.tsx`, remplacer :

```tsx
import { useContactNotes } from '@/hooks/useContactNotes'
import { useCrmDarkPref } from '@/lib/crmDark'
```

par :

```tsx
import { useContactNotes } from '@/hooks/useContactNotes'
import { useCrmDarkPref } from '@/lib/crmDark'
import { avecArrivee } from '@/lib/jetonArrivee'
```

Dans `src/pages/agent/ContactDetailPage.tsx`, remplacer :

```tsx
      onOpenMatching={() => navigate(`/dashboard/matching?contact=${id}`)}
      onOpenListings={() => navigate('/dashboard/listings')}
      // Chaque bien de « Sa boucle » ouvre SA place dans le fil. ⛔ Gabarit ANCRÉ : `redirection-ouverte.spec.ts`.
      onOuvrirFil={(requete) => navigate(`/dashboard/matching?${requete}`)}
```

par :

```tsx
      onOpenMatching={() => navigate(`/dashboard/matching?contact=${id}`, avecArrivee())}
      onOpenListings={() => navigate('/dashboard/listings')}
      // Chaque bien de « Sa boucle » ouvre SA place dans le fil. ⛔ Gabarit ANCRÉ : `redirection-ouverte.spec.ts`.
      onOuvrirFil={(requete) => navigate(`/dashboard/matching?${requete}`, avecArrivee())}
```

Dans `src/pages/agent/ContactsPage.tsx`, remplacer :

```tsx
import { porteDemande } from '@/lib/contactRoles'
```

par :

```tsx
import { porteDemande } from '@/lib/contactRoles'
import { avecArrivee } from '@/lib/jetonArrivee'
```

Dans `src/pages/agent/ContactsPage.tsx`, remplacer :

```tsx
    navigate(createdId ? `/dashboard/matching?contact=${createdId}` : '/dashboard/matching')
```

par :

```tsx
    navigate(createdId ? `/dashboard/matching?contact=${createdId}` : '/dashboard/matching', createdId ? avecArrivee() : undefined)
```

Dans `src/pages/agent/DealDetailPage.tsx`, remplacer :

```tsx
import { useNavigate, useParams } from 'react-router-dom'
```

par :

```tsx
import { useNavigate, useParams, type NavigateOptions } from 'react-router-dom'
```

Dans `src/pages/agent/DealDetailPage.tsx`, remplacer :

```tsx
import { mapCriteria } from '@/lib/crmAdapters'
```

par :

```tsx
import { mapCriteria } from '@/lib/crmAdapters'
import { avecArrivee } from '@/lib/jetonArrivee'
```

Dans `src/pages/agent/DealDetailPage.tsx`, remplacer :

```tsx
  /** Seul point de sortie de la page — voir `DealDetailBanc.onNavigate`. */
  const go = (vers: string) => { if (banc?.onNavigate) banc.onNavigate(vers); else navigate(vers) }
```

par :

```tsx
  /**
   * Seul point de sortie de la page — voir `DealDetailBanc.onNavigate`. Ses options (le jeton d'une arrivée,
   * `avecArrivee`) ne vont qu'au routeur.
   */
  const go = (vers: string, options?: NavigateOptions) => { if (banc?.onNavigate) banc.onNavigate(vers); else navigate(vers, options) }
```

Dans `src/pages/agent/DealDetailPage.tsx`, remplacer :

```tsx
                  <DsBlack p={p} onClick={() => go(`/dashboard/matching${contact ? `?contact=${contact.id}` : ''}`)}>
```

par :

```tsx
                  <DsBlack p={p} onClick={() => go(`/dashboard/matching${contact ? `?contact=${contact.id}` : ''}`, contact ? avecArrivee() : undefined)}>
```

Dans `src/pages/agent/ListingsPage.tsx`, remplacer :

```tsx
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
```

par :

```tsx
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
import { avecArrivee } from '@/lib/jetonArrivee'
```

Dans `src/pages/agent/ListingsPage.tsx`, remplacer :

```tsx
            onVoirQui={(id) => navigate(`/dashboard/listings/${id}?${PARAM_QUI_POUR}=1`)} />}
```

par :

```tsx
            onVoirQui={(id) => navigate(`/dashboard/listings/${id}?${PARAM_QUI_POUR}=1`, avecArrivee())} />}
```

Dans `src/pages/agent/NouveauBienPage.tsx`, remplacer :

```tsx
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
```

par :

```tsx
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
import { avecArrivee } from '@/lib/jetonArrivee'
```

Dans `src/pages/agent/NouveauBienPage.tsx`, remplacer :

```tsx
                onVoirQui={(id) => navigate(`/dashboard/listings/${id}?${PARAM_QUI_POUR}=1`)} />
```

par :

```tsx
                onVoirQui={(id) => navigate(`/dashboard/listings/${id}?${PARAM_QUI_POUR}=1`, avecArrivee())} />
```

Dans `src/components/matching-recherche/MatchingRechercheHybride.tsx`, remplacer :

```tsx
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
```

par :

```tsx
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
import { avecArrivee } from '@/lib/jetonArrivee'
```

Dans `src/components/matching-recherche/MatchingRechercheHybride.tsx`, remplacer :

```tsx
              onQuiPour={(b) => { if (!demo) navigate(`/dashboard/market/${b.id}?${PARAM_QUI_POUR}=1`) }}
```

par :

```tsx
              onQuiPour={(b) => { if (!demo) navigate(`/dashboard/market/${b.id}?${PARAM_QUI_POUR}=1`, avecArrivee()) }}
```

L'en-tête des liens du fil dit comment les surfaces y naviguent.

Dans `src/components/matching-fil/filLiens.ts`, remplacer :

```ts
 * Le fil LIT ses paramètres une fois, à l'arrivée (`lireArrivee`) ; les surfaces qui y mènent — « Aujourd'hui »,
 * « Sa boucle », « Qui pour ce bien ? » — les ÉCRIVENT par `lienFil` et `lienPlace`, jamais à la main : un paramètre
 * renommé d'un côté ne survit pas de l'autre.
```

par :

```ts
 * Le fil LIT ses paramètres (`lireArrivee`) ; les surfaces qui y mènent — « Aujourd'hui », « Sa boucle », « Qui pour ce
 * bien ? » — les ÉCRIVENT par `lienFil` et `lienPlace`, jamais à la main : un paramètre renommé d'un côté ne survit pas
 * de l'autre. Elles y naviguent avec un jeton neuf (`avecArrivee`, `src/lib/jetonArrivee.ts`) : le fil n'applique une
 * arrivée qu'une fois par navigation (`useArrivee`).
```

- [ ] **Étape 8 : Relancer les tests**

```bash
npx vitest run tests/unit/jeton-arrivee.spec.tsx tests/unit/matching-sans-sortie.spec.ts
```

Attendu : PASS, `Test Files  2 passed (2)`, `Tests  39 passed (39)`.

- [ ] **Étape 9 : Vérifier**

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx eslint --quiet src/lib/jetonArrivee.ts src/hooks/useArrivee.ts src/components/matching-fil/MatchingFil.tsx src/components/matching-fil/filLiens.ts src/pages/agent/MatchingPage.tsx src/pages/agent/ListingDetailPage.tsx src/pages/agent/ExternalListingDetailPage.tsx src/pages/agent/TodayPage.tsx src/pages/agent/ContactDetailPage.tsx src/pages/agent/ContactsPage.tsx src/pages/agent/DealDetailPage.tsx src/pages/agent/ListingsPage.tsx src/pages/agent/NouveauBienPage.tsx src/components/matching-recherche/MatchingRechercheHybride.tsx tests/unit/jeton-arrivee.spec.tsx tests/unit/matching-sans-sortie.spec.ts
```

Attendu : aucune sortie. (Sans `--quiet`, 6 avertissements, tous préexistants, contre 8 avant la tâche : les deux `setPivotConsomme` posés dans un effet, du fil et du pager, sont partis.)

```bash
npm run lint:deadcode
npm run lint:i18n
```

Attendu : `✓ Aucun export mort (baseline propre — dont 86 modules chargés en lazy, invisibles pour ts-prune).` (`avecArrivee` est lu par les sites, `arriveeDe`, `arriveeNeuve` et le type `Arrivee` par le crochet, `useArrivee` par les quatre écrans) ; `✓ i18n garde-fou OK — 0 texte FR en dur sur les surfaces agent verrouillées (i18next/no-literal-string).` Aucune clé i18n n'est touchée : les portes de parité et de couverture ne sont pas concernées.

Les gardes de l'écran caché, de la grammaire et de la sortie vers l'acheteur :

```bash
npx vitest run tests/unit/clavier-ecran-cache.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/matching-sans-sortie.spec.ts
```

Attendu : PASS, `Test Files  3 passed (3)`, `Tests  53 passed (53)`.

Les specs qui chargent ou lisent un fichier touché — le jeton et les liens du fil, la garde des redirections (les cibles restent ancrées), la pile d'onglets, les bancs et le stockage, les fiches, les contrastes et la grammaire des pages, le fil, la Recherche et la pige, « Sa boucle », les confrontations du copilote :

```bash
npx vitest run tests/unit/jeton-arrivee.spec.tsx tests/unit/fil-liens-arrivee.spec.ts tests/unit/redirection-ouverte.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/clavier-ecran-cache.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/crm-tabs-compte.spec.tsx tests/unit/crm-tabs.spec.ts tests/unit/dev-bancs-frontiere.spec.ts tests/unit/stockage-inventaire.spec.ts tests/unit/fiche-qui-pour.spec.ts tests/unit/fiche-planifier-visite.spec.ts tests/unit/etat-vide.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/megga-x-crm-tokens.spec.ts tests/unit/matching-contraste.spec.ts tests/unit/matching-atelier-css.spec.ts tests/unit/matching-du-jour.spec.ts tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-apprendre.spec.ts tests/unit/matching-fil-signaux.spec.ts tests/unit/whatsapp-matching-fil.spec.ts tests/unit/sa-boucle.spec.ts tests/unit/statut-clair.spec.ts tests/unit/bien-palette.spec.ts tests/unit/contacts-contraste.spec.ts tests/unit/contacts-note-contrat.spec.ts tests/unit/analytics-contraste.spec.ts tests/unit/kyc-contraste.spec.ts tests/unit/pipeline-contraste.spec.ts tests/unit/mrh-bouge.spec.tsx tests/unit/mrh-historique-prix.spec.tsx tests/unit/mrh-listing-detail.test.ts tests/unit/pige.spec.ts tests/unit/matching-whatsapp-sql.spec.ts tests/unit/mail-oauth-popup.spec.ts tests/unit/omniParse.test.ts
```

Attendu : PASS, `Test Files  38 passed (38)`, `Tests  750 passed | 1 skipped (751)`.

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint` en parallèle) :

```bash
npx vitest run
```

Attendu : `Test Files  3 failed | 342 passed (345)`, `Tests  1 failed | 5260 passed | 3 skipped (5264)` ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`.

---

## Tâche 12 : Le premier lancement et les états vides (conception §5.1)

Mesuré en production le 27.09.2026 : 12 agences sur 13 n'ont AUCUN match. Le fil leur dirait « Tout est à jour » (`fil.vide.titre`, l'état d'« À proposer » de `MatchingFil.tsx` quand rien n'est à traiter) — faux : rien n'a commencé. Décision A de Julien, choisie sur maquette (conception §5.1) : la page 0 reprend la couverture de premier lancement de l'atelier (`MatchingFirstRun` : même image, trois étapes, mono-thème assumé comme celle de Mes biens), textes corrigés dans les quatre langues — le marché suffit, un mandat n'est pas requis, et l'ancienne première étape, « Créez votre premier mandat », laissait croire le contraire. Trois cas : sans recherche d'acheteur active, la couverture ; des recherches mais aucun match, « Aucun bien ne correspond encore aux critères de vos acheteurs », avec « Voir le marché » ; des matchs, le fil, dont le « Tout est à jour » redevient juste. L'atelier montrait la couverture « sans pivot ni bien » ; la condition devient « aucune recherche active dans l'agence », le seul prérequis réel.

La décision est un module PUR, `src/components/matching-fil/filDemarrage.ts` : `ecranDuFil(recherches, fil)` rend `chargement`, `erreur`, `couverture`, `sansMatch` ou `fil`. La couverture ne se montre qu'à coup sûr : jamais pendant une lecture (elle paraîtrait puis s'effacerait), jamais sur un échec (l'état d'erreur du fil s'affiche), jamais à une agence dont le fil a lu un match — une recherche close garde sa boucle. « Aucun match » compte ce que le fil a LU (à proposer, du marché, de la boucle), avant masques et filtres : une agence dont tous les biens sont refusés ou en visite a des matchs et rien à proposer, et lit « Tout est à jour » (« Des matchs, rien à proposer », §5.1). La lecture des recherches est légère — `client_searches`, `select('id').eq('is_active', true).limit(1)`, sous la RLS de l'agent (`client_searches_select`) —, et vit à côté de celle du fil (`useRecherchesActives`, `src/hooks/useMatchingFil.ts`), sous son préfixe (`[CLE_FIL, 'recherches', agence]`) : « Réessayer » et chaque geste la relisent avec lui. La couverture passe dans `matching-fil/` (`git mv`) ; son bouton, « Ajouter un acheteur », OUVRE la création d'un contact (§5.1, validé sur maquette) : il mène à `/dashboard/contacts?nouveau=1` avec un jeton d'arrivée (`avecArrivee`, tâche 11), et la page Contacts ouvre sa modale « Nouveau contact » sur cette arrivée, une fois par navigation (`useArrivee('contacts.nouveau', …)`, la mécanique de `?qui=1` des fiches) — ouverte pendant le rendu (`react-hooks/set-state-in-effect` refuse un `setState` d'effet), marquée par l'effet ; l'adresse garde son paramètre, comme les liens `?nouveau=` et `?fil=` de la Messagerie. Rien d'autre ne l'ouvrait depuis une autre surface du bureau : la modale ne s'ouvrait que de la page elle-même (`openModal`), et `/dashboard/contacts/new` ne sert que le téléphone. Le rôle d'acheteur ne demande aucun paramètre : la modale ne prend pas de rôle initial, mais pré-coche « acheteur » d'elle-même (`EMPTY.roles = ['buyer']`). La page Contacts perd le nettoyage du vieux `?source=` (`setSearchParams(…, { replace: true })`) : une page qui applique une arrivée ne réécrit jamais son adresse (tâche 11), et plus aucun lien ne pose ce paramètre. Les clés `firstRun.*` suivent l'ordre des étapes et nomment ce qu'elles disent (`acheteur`, `biens`, `scores` ; `start` reste le bouton) ; celle de l'état neuf est `fil.vide.sansMatch`. Entrée dans le fil (« né porté : aucun littéral »), la couverture en prend la grammaire : ses rayons et espacements passent aux jetons — exacts là où l'échelle le permet (56, 40, 180, 16, 8 et 12), arrondis au barreau voisin ailleurs (18 → 20, 6 → 8, 30 → 32 ; 9 → 8, sans effet : le bouton ne porte qu'un texte) — et son anneau de focus `#8DA4FF` devient un barreau, `MXC_SYSTEM.blue300` (`#8dc1ff`, l'anneau du CRM en sombre). Les cliquets de l'atelier descendent d'autant (`megga-x-grammar` {31,43} → {23,33}, `couleur-barreaux` 2 → 1) ; le fil reste à {0,0}, sans couleur hors barreaux ; l'exemption de police suit le fichier (`megga-x-crm-tokens`). L'atelier, encore monté jusqu'à la tâche 13, et son banc suivent le déplacement ; son bouton ouvre aussi la création d'un contact, puisque son texte le dit.

Le banc `/dev/crm` : « Vide » rend zéro ligne partout, recherches comprises — la page 0 y est la couverture. L'état « aucun match » demande des recherches sans match, qu'aucun des trois états ne rend : le panneau gagne « Sans match », qui est « Vide » avec les recherches des acheteurs en plus (`client_searches` traverse, comme le socle) — pas un état de plus de l'interception, et aucun écran forcé : le fil y arrive par ses vraies lectures. « Nominal » gagne un mandat VENDU, `p4` (Petit-Saconnex), proposé à Julie (`m26`, `sent`) et qui intéresse Emma (`m27`, `interested`) : « En attente » et « À conclure » le gardent, « Vendu » écrit (tâche 2 ; un état absent vaudrait hors vente, les autres mandats portent `status: 'active'`). Ses notes sont celles du vrai moteur, confrontées par une spec du banc ; aucune relance ne le couvre et la réponse d'Emma sort de la fenêtre de « Pendant ton absence » : « Aujourd'hui » reste celui du lot D1.

Choix à valider : « Sans match », quatrième entrée du panneau (les données de « Vide », plus les recherches) — « Vide » ne peut montrer à la fois la couverture et l'état « aucun match », qui ne diffèrent que par les recherches ; la consigne « plutôt que d'inventer un mode » est lue comme « aucun écran forcé » (le banc de l'atelier montait la couverture en direct) ; « aucun match » = aucun match LU, pas « aucune ligne dans aucun onglet » (une agence aux seuls refus ou visites garde « Tout est à jour ») ; la couverture exige aussi un fil sans match (une recherche close garde sa boucle) ; un échec de la lecture des recherches, fil vide, montre l'état d'erreur du fil, dont « Réessayer » relit les deux ; la création s'ouvre sur l'arrivée `?nouveau=1` de la page Contacts, sans paramètre de rôle (la modale pré-coche déjà « acheteur »), ouverte pendant le rendu et marquée par l'effet ; la page Contacts perd son nettoyage du vieux `?source=`, qu'aucun lien ne pose plus (une adresse `?source=` tapée à la main le garde, sans effet) ; la décision d'ouvrir est éprouvée sur un écran de la spec du jeton qui reprend les trois lignes de la page, et ces trois lignes, lues dans la page — le dépôt n'a aucune spec de rendu de la page Contacts ; le lien de l'atelier compte dans l'inventaire des liens d'arrivée jusqu'à son retrait (tâche 15) ; l'anneau de focus passe à `MXC_SYSTEM.blue300` et quatre espacements s'arrondissent au barreau voisin ; les textes allemand, anglais et italien ; un mandat vendu NEUF (`p4`) plutôt que `pb44` / `pb48` du catalogue, vendus aussi, pour lesquels aucun acheteur du banc n'est noté ; le menu du banc s'élargit de 240 à 320 px pour que « Sans match » tienne sur sa ligne.

**Fichiers :**
- Créer (tests) : `tests/unit/matching-fil-demarrage.spec.ts`, `tests/unit/banc-matching-e1.spec.ts`
- Modifier (tests) : `tests/unit/jeton-arrivee.spec.tsx`
- Modifier (gardes) : `tests/unit/megga-x-crm-tokens.spec.ts`, `tests/unit/megga-x-grammar.spec.ts`, `tests/unit/couleur-barreaux.spec.ts`
- Créer (la règle) : `src/components/matching-fil/filDemarrage.ts`
- Modifier (la lecture) : `src/hooks/useMatchingFil.ts`
- Déplacer : `src/components/matching-atelier/MatchingFirstRun.tsx` → `src/components/matching-fil/MatchingFirstRun.tsx`
- Modifier (i18n) : `src/i18n/locales/fr/matching.json`, `src/i18n/locales/de/matching.json`, `src/i18n/locales/en/matching.json`, `src/i18n/locales/it/matching.json`
- Modifier (le fil) : `src/components/matching-fil/MatchingFil.tsx`
- Modifier (la page Contacts et le jeton d'arrivée) : `src/pages/agent/ContactsPage.tsx`, `src/lib/jetonArrivee.ts`, `src/hooks/useArrivee.ts`
- Modifier (l'atelier et son banc) : `src/pages/agent/MatchingAtelierPage.tsx`, `src/pages/dev/MatchingShowcasePage.tsx`
- Modifier (le banc `/dev/crm`) : `src/pages/dev/crmFixtures.ts`, `src/pages/dev/CrmShowcasePage.tsx`

- [ ] **Étape 1 : Écrire les tests qui échouent**

La règle, pure, dans ses cinq issues ; les textes des quatre langues ; le fil, la couverture et la lecture des recherches, lus dans leur source. La création d'un contact : un écran de la spec du jeton qui l'ouvre comme la page Contacts (une fois ; ni au remontage, ni sur l'onglet réactivé sans jeton ; de nouveau sur un nouveau clic ; jamais sans `?nouveau`), la page elle-même lue (son arrivée, ses deux lignes, son adresse jamais réécrite), et l'inventaire des liens d'arrivée, que rejoignent la couverture du fil et celle de l'atelier. Le banc : le mandat vendu, ses deux matchs et leurs notes, confrontées au moteur. Les gardes : l'exemption de police sur le nouveau chemin, les cliquets de l'atelier abaissés de ce qu'emporte la couverture.

Créer `tests/unit/matching-fil-demarrage.spec.ts` :

```ts
/**
 * Le premier lancement et les états vides du fil de matchs (lot E1, conception
 * `docs/superpowers/specs/2026-09-27-matching-lot-e1-bureau-design.md` §5.1 et §8).
 *
 * Ce que cette spec refuse :
 *   · la couverture montrée à une agence qui a une recherche d'acheteur active, pendant une lecture ou sur un échec ;
 *   · « Tout est à jour » dit à une agence qui a des recherches mais aucun match ;
 *   · une couverture qui laisserait croire qu'un mandat est requis, ou dont une langue manquerait un texte ;
 *   · une page 0 qui ne suivrait pas la règle (`ecranDuFil`).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ecranDuFil, type RecherchesAgence } from '@/components/matching-fil/filDemarrage'
import matchingFr from '@/i18n/locales/fr/matching.json'
import matchingDe from '@/i18n/locales/de/matching.json'
import matchingEn from '@/i18n/locales/en/matching.json'
import matchingIt from '@/i18n/locales/it/matching.json'

const lu = (matchs: number) => ({ chargement: false, erreur: false, matchs })
const TOUTES: RecherchesAgence[] = ['chargement', 'erreur', 'aucune', 'actives']
const source = (chemin: string): string => readFileSync(join(process.cwd(), chemin), 'utf8')

describe('ecranDuFil — la page 0 du Matching (§5.1)', () => {
  it('une agence sans recherche active et sans match : la couverture', () => {
    expect(ecranDuFil('aucune', lu(0))).toBe('couverture')
  })

  it('des recherches, aucun match : l’état « aucun match », pas « Tout est à jour »', () => {
    expect(ecranDuFil('actives', lu(0))).toBe('sansMatch')
  })

  it('des matchs lus : le fil, quelles que soient les recherches — une recherche close garde sa boucle', () => {
    for (const r of TOUTES) expect(ecranDuFil(r, lu(3)), r).toBe('fil')
  })

  it('jamais la couverture pendant une lecture, celle du fil ou celle des recherches', () => {
    for (const r of TOUTES) expect(ecranDuFil(r, { chargement: true, erreur: false, matchs: 0 }), r).toBe('chargement')
    expect(ecranDuFil('chargement', lu(0))).toBe('chargement')
  })

  it('jamais la couverture sur un échec : l’état d’erreur du fil', () => {
    for (const r of TOUTES) expect(ecranDuFil(r, { chargement: false, erreur: true, matchs: 0 }), r).toBe('erreur')
    expect(ecranDuFil('erreur', lu(0))).toBe('erreur')
  })
})

describe('les textes de la couverture et de l’état « aucun match », quatre langues', () => {
  type Etape = { title: string; sub: string }
  type Textes = { firstRun: Record<string, Etape | string>; fil: { vide: Record<string, string> } }
  const LANGUES = { fr: matchingFr, de: matchingDe, en: matchingEn, it: matchingIt } as unknown as Record<string, Textes>

  it('le français : l’acheteur d’abord, puis ses biens — les mandats et le marché —, puis MEGGA', () => {
    const { firstRun, fil } = LANGUES.fr!
    expect(firstRun).toEqual({
      title: 'Votre boucle de match démarre ici',
      acheteur: { title: 'Ajoutez un acheteur', sub: 'Budget, secteur, pièces.' },
      biens: { title: 'Vos mandats et le marché', sub: "Les biens qu'on lui compare." },
      scores: { title: 'MEGGA calcule les matchs', sub: 'Rien à configurer.' },
      start: 'Ajouter un acheteur',
    })
    expect(fil.vide.sansMatch).toBe('Aucun bien ne correspond encore aux critères de vos acheteurs')
    expect(fil.vide.titre).toBe('Tout est à jour')
  })

  it('les quatre langues portent les mêmes clés — l’étape « Créez votre premier mandat » est partie', () => {
    for (const [langue, { firstRun, fil }] of Object.entries(LANGUES)) {
      expect(Object.keys(firstRun), langue).toEqual(['title', 'acheteur', 'biens', 'scores', 'start'])
      for (const etape of ['acheteur', 'biens', 'scores']) {
        const e = firstRun[etape] as Etape
        expect(Boolean(e.title && e.sub), `${langue} ${etape}`).toBe(true)
      }
      expect(Boolean(firstRun.start && fil.vide.sansMatch), langue).toBe(true)
    }
  })
})

describe('la page 0 suit la règle', () => {
  it('le fil monte la couverture, qui ouvre la création d’un contact, et l’état « aucun match », qui mène au marché', () => {
    const fil = source('src/components/matching-fil/MatchingFil.tsx')
    expect(fil).toContain('ecranDuFil(recherches, {')
    // Une ARRIVÉE (`?nouveau=1`, avec son jeton) : la page Contacts ouvre sa création une fois par clic (`useArrivee`).
    expect(fil).toContain("if (ecran === 'couverture') return <MatchingFirstRun onAjouterAcheteur={() => navigate('/dashboard/contacts?nouveau=1', avecArrivee())} />")
    expect(fil).toMatch(/ecran === 'sansMatch' \? \(\s*<Etat sp=\{sp\} titre=\{t\('fil\.vide\.sansMatch'\)\}\s*action=\{onOpenRecherche \? \{ libelle: t\('fil\.vide\.marche'\), faire: onOpenRecherche \} : undefined\} \/>/)
  })

  it('la couverture : l’acheteur, puis ses biens, puis MEGGA — chaque icône à son étape', () => {
    const couverture = source('src/components/matching-fil/MatchingFirstRun.tsx')
    const etapes = [...couverture.matchAll(/\{ icon: '(\w+)', key: '(\w+)' \}/g)].map((m) => [m[2], m[1]])
    expect(etapes).toEqual([['acheteur', 'users'], ['biens', 'home'], ['scores', 'sparkle']])
  })

  it('les recherches actives : une lecture légère, sous la RLS de l’agent et le préfixe du fil', () => {
    const hook = source('src/hooks/useMatchingFil.ts')
    const corps = hook.slice(hook.indexOf('export function useRecherchesActives'))
    expect(corps).toContain("queryKey: [CLE_FIL, 'recherches', agencyId]")
    expect(corps).toContain("supabase.from('client_searches').select('id').eq('is_active', true).limit(1)")
  })
})
```

Créer `tests/unit/banc-matching-e1.spec.ts` :

```ts
/**
 * Le banc `/dev/crm` et le lot E1 : un mandat VENDU, sur lequel Julie n'a pas encore répondu et qui intéresse Emma —
 * « En attente » et « À conclure » le gardent, son état écrit ; « À proposer » ne le montre plus (décision 12a).
 *
 * ⚠ Le banc ne note pas (`src/` ne charge pas le barème Deno) : ses deux matchs portent les notes du vrai moteur, que ce
 * fichier confronte à `calculateScoreV2`. ⚠ Les fixtures sont des tableaux de MODULE : chaque test relit un module neuf
 * (`vi.resetModules`).
 */
import { describe, expect, it, vi } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'
import { cleEtatMandat } from '@/components/matching-fil/filBoucle'
import { versBien, type LigneBien } from '@/hooks/useMatchingFil'

type Ligne = Record<string, unknown> & { id: string }

async function banc() {
  vi.resetModules()
  const f = await import('@/pages/dev/crmFixtures')
  const ligne = (nom: string, id: string): Ligne => {
    const l = (f.CRM_TABLES[nom] as Ligne[]).find((x) => x.id === id)
    if (!l) throw new Error(`${nom}/${id} absent du banc`)
    return l
  }
  return { ligne }
}

describe('le banc du lot E1 — un mandat vendu', () => {
  it('Petit-Saconnex est vendu ; Julie n’a pas répondu, Emma est intéressée — et le fil écrit « Vendu »', async () => {
    const { ligne } = await banc()
    const bien = ligne('properties', 'p4')
    expect(bien.status).toBe('sold')
    expect(ligne('matches', 'm26')).toMatchObject({ contact_id: 'c9', property_id: 'p4', status: 'sent' })
    expect(ligne('matches', 'm27')).toMatchObject({ contact_id: 'c7', property_id: 'p4', status: 'interested' })
    // La jointure porte l'état de la table : « Sa boucle » le lit.
    for (const id of ['m26', 'm27']) expect((ligne('matches', id).property as { status: string }).status, id).toBe('sold')
    expect(cleEtatMandat(versBien(bien as unknown as LigneBien))).toBe('listings:status.sold')
  })

  it('ses deux matchs portent la note du moteur, raisons comprises', async () => {
    const { ligne } = await banc()
    const bien = ligne('properties', 'p4')
    for (const id of ['m26', 'm27']) {
      const m = ligne('matches', id)
      const criteres = ligne('client_searches', m.client_search_id as string).criteria as Record<string, unknown>
      const note = calculateScoreV2(bien, criteres, DEFAULT_SCORING_CONFIG, null, Date.now())
      expect({ id, score: m.score, reasons: m.reasons }).toEqual({ id, score: note.total, reasons: note.reasons })
    }
  })
})
```

Le jeton d'arrivée gagne un lecteur, la page Contacts (`?nouveau=1`) : un écran de la spec ouvre sa création comme elle — pendant le rendu, marquée par l'effet —, l'inventaire des écrans l'inscrit, une lecture fige ses deux lignes, et l'inventaire des liens compte ceux des deux couvertures.

Dans `tests/unit/jeton-arrivee.spec.tsx`, remplacer :

```tsx
 * place du fil de matchs, la page du fil dans le pager de Matching, « Qui pour ce bien ? » d'une fiche (`?qui=1`) —
 * s'applique UNE fois par navigation.
```

par :

```tsx
 * place du fil de matchs, la page du fil dans le pager de Matching, « Qui pour ce bien ? » d'une fiche (`?qui=1`), la
 * création d'un contact (`?nouveau=1`, §5.1) — s'applique UNE fois par navigation.
```

Dans `tests/unit/jeton-arrivee.spec.tsx`, remplacer :

```tsx
 *   · une adresse réécrite par le fil, le pager ou une fiche ;
```

par :

```tsx
 *   · une adresse réécrite par le fil, le pager, une fiche ou la page Contacts ;
```

Dans `tests/unit/jeton-arrivee.spec.tsx`, remplacer :

```tsx
import { act, useEffect, type ReactNode } from 'react'
```

par :

```tsx
import { act, useEffect, useState, type ReactNode } from 'react'
```

Dans `tests/unit/jeton-arrivee.spec.tsx`, remplacer :

```tsx
  /** L'arrivée que lit l'écran monté sous le routeur du navigateur. */
  lue: null as null | { jeton: string | null; adresse: string },
}))
```

par :

```tsx
  /** L'arrivée que lit l'écran monté sous le routeur du navigateur. */
  lue: null as null | { jeton: string | null; adresse: string },
  /** La création d'un contact : ouverte ou non, le nombre de ses ouvertures, et de quoi la refermer. */
  ouverte: false,
  ouvertures: 0,
  fermer: null as null | (() => void),
}))
```

Dans `tests/unit/jeton-arrivee.spec.tsx`, remplacer :

```tsx
const avec = (jeton: string, search = '?attente=c7'): InitialEntry => ({ pathname: FIL, search, state: { arrivee: jeton } })

beforeEach(() => {
  poserStockagesMemoire()
  h.lecture = null
  h.naviguer = null
  h.applications = []
  h.lue = null
```

par :

```tsx
const avec = (jeton: string, search = '?attente=c7'): InitialEntry => ({ pathname: FIL, search, state: { arrivee: jeton } })

const CONTACTS = '/dashboard/contacts'
const NOUVEAU = `${CONTACTS}?nouveau=1`

/**
 * Un écran qui ouvre sa création comme la page Contacts (`ContactsPage`) : PENDANT LE RENDU, quand l'arrivée est à
 * appliquer et la création fermée ; marquée par l'effet.
 */
function EcranContacts() {
  const [params] = useSearchParams()
  const [ouverte, setOuverte] = useState(false)
  const { aAppliquer, marquerAppliquee } = useArrivee('contacts.nouveau', params.has('nouveau'))
  if (aAppliquer && !ouverte) setOuverte(true)
  useEffect(() => { if (aAppliquer) marquerAppliquee() }, [aAppliquer, marquerAppliquee])
  useEffect(() => { if (ouverte) h.ouvertures += 1 }, [ouverte])
  useEffect(() => {
    h.ouverte = ouverte
    h.fermer = () => setOuverte(false)
  })
  return null
}

function ArbreContacts({ entree, montage = 0 }: { entree: InitialEntry; montage?: number }) {
  return (
    <MemoryRouter initialEntries={[entree]} future={ROUTER_FUTURE}>
      <CrmTabsProvider>
        <Pilote />
        <EcranActifProvider value>
          <Routes>
            <Route path={CONTACTS} element={<EcranContacts key={montage} />} />
            <Route path="*" element={null} />
          </Routes>
        </EcranActifProvider>
      </CrmTabsProvider>
    </MemoryRouter>
  )
}

const nouveau = (jeton: string, search = '?nouveau=1'): InitialEntry => ({ pathname: CONTACTS, search, state: { arrivee: jeton } })

beforeEach(() => {
  poserStockagesMemoire()
  h.lecture = null
  h.naviguer = null
  h.applications = []
  h.lue = null
  h.ouverte = false
  h.ouvertures = 0
  h.fermer = null
```

Dans `tests/unit/jeton-arrivee.spec.tsx`, remplacer :

```tsx
const lire = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
```

par :

```tsx
describe('le jeton d’arrivée — la création d’un contact (`?nouveau=1`)', () => {
  it('s’ouvre une fois : remonter l’écran ne la rouvre pas', async () => {
    await rendre(<ArbreContacts entree={nouveau('j1')} />)
    expect([h.ouverte, h.ouvertures]).toEqual([true, 1])
    await rendre(<ArbreContacts entree={nouveau('j1')} montage={1} />)
    expect([h.ouverte, h.ouvertures]).toEqual([false, 1])
  })

  it('refermée, l’onglet réactivé — son adresse, sans jeton — ne la rouvre pas ; un nouveau clic sur le lien, si', async () => {
    await rendre(<ArbreContacts entree={nouveau('j1')} />)
    await act(async () => { h.fermer!() })
    await naviguer(NOUVEAU)
    expect([h.ouverte, h.ouvertures]).toEqual([false, 1])
    await naviguer(NOUVEAU, avecArrivee())
    expect([h.ouverte, h.ouvertures]).toEqual([true, 2])
  })

  it('sans `?nouveau`, rien ne s’ouvre — même sous un jeton', async () => {
    await rendre(<ArbreContacts entree={nouveau('j1', '')} />)
    expect([h.ouverte, h.ouvertures]).toEqual([false, 0])
  })
})

const lire = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
```

Dans `tests/unit/jeton-arrivee.spec.tsx`, remplacer :

```tsx
    ['src/pages/agent/ExternalListingDetailPage.tsx', "useArrivee('quiPour.arrivee', params.has(PARAM_QUI_POUR))"],
  ]
```

par :

```tsx
    ['src/pages/agent/ExternalListingDetailPage.tsx', "useArrivee('quiPour.arrivee', params.has(PARAM_QUI_POUR))"],
    ['src/pages/agent/ContactsPage.tsx', "useArrivee('contacts.nouveau', searchParams.has('nouveau'))"],
  ]
```

Dans `tests/unit/jeton-arrivee.spec.tsx`, remplacer :

```tsx
  /** Une cible d'arrivée : une place du fil, ou une fiche défilée jusqu'à « Qui pour ce bien ? ». */
  const CIBLE = /\/dashboard\/matching(?:\?|\$\{)|\/dashboard\/(?:listings|market)\/\$\{[^}]+\}\?\$\{PARAM_QUI_POUR\}=1/
  /** Les liens d'arrivée, par fichier. Un lien neuf s'inscrit ici — avec son jeton. */
  const SITES: Record<string, number> = {
    'src/components/matching-recherche/MatchingRechercheHybride.tsx': 1,
```

par :

```tsx
  it('la page Contacts ouvre sa création comme l’écran de la spec : pendant le rendu, marquée par l’effet', () => {
    const code = lire('src/pages/agent/ContactsPage.tsx')
    expect(code).toContain('if (aAppliquer && !modalOpen) openModal()')
    expect(code).toContain('useEffect(() => { if (aAppliquer) marquerAppliquee() }, [aAppliquer, marquerAppliquee])')
  })

  /** Une cible d'arrivée : une place du fil, une fiche défilée jusqu'à « Qui pour ce bien ? », la création d'un contact. */
  const CIBLE = /\/dashboard\/matching(?:\?|\$\{)|\/dashboard\/(?:listings|market)\/\$\{[^}]+\}\?\$\{PARAM_QUI_POUR\}=1|\/dashboard\/contacts\?nouveau=1/
  /** Les liens d'arrivée, par fichier. Un lien neuf s'inscrit ici — avec son jeton. */
  const SITES: Record<string, number> = {
    // « Ajouter un acheteur », la couverture de premier lancement : celle du fil, et celle de l'atelier tant qu'il est monté.
    'src/components/matching-fil/MatchingFil.tsx': 1,
    'src/components/matching-recherche/MatchingRechercheHybride.tsx': 1,
```

Dans `tests/unit/jeton-arrivee.spec.tsx`, remplacer :

```tsx
    'src/pages/agent/ListingsPage.tsx': 1,
    'src/pages/agent/NouveauBienPage.tsx': 1,
```

par :

```tsx
    'src/pages/agent/ListingsPage.tsx': 1,
    'src/pages/agent/MatchingAtelierPage.tsx': 1,
    'src/pages/agent/NouveauBienPage.tsx': 1,
```

La garde des polices vise le nouveau chemin.

Dans `tests/unit/megga-x-crm-tokens.spec.ts`, remplacer :

```ts
    'src/components/matching-atelier/MatchingFirstRun.tsx',
```

par :

```ts
    'src/components/matching-fil/MatchingFirstRun.tsx',
```

Le cliquet des rayons et espacements de l'atelier descend de ce qu'emporte la couverture ({8,10} : huit valeurs hors échelle, deux sur l'échelle).

Dans `tests/unit/megga-x-grammar.spec.ts`, remplacer :

```ts
  // {37,50} -> {31,43} (21.09.2026) : la feuille d'envoi `AtlSendSheet` est retirée, « Je l'ai
  // proposé » n'envoie plus rien à l'acheteur.
  ['src/components/matching-atelier', { hors: 31, total: 43 }],
```

par :

```ts
  // {37,50} -> {31,43} (21.09.2026) : la feuille d'envoi `AtlSendSheet` est retirée, « Je l'ai
  // proposé » n'envoie plus rien à l'acheteur.
  // {31,43} -> {23,33} (27.09.2026) : la couverture de premier lancement (`MatchingFirstRun`) quitte l'atelier
  // pour le fil (lot E1), qui l'accueille sans littéral — ses rayons et espacements y passent aux jetons.
  ['src/components/matching-atelier', { hors: 23, total: 33 }],
```

Et celui des couleurs, de son anneau de focus.

Dans `tests/unit/couleur-barreaux.spec.ts`, remplacer :

```ts
  // 3 → 2 le 21.09.2026 : la feuille d'envoi `AtlSendSheet` est retirée.
  ['src/components/matching-atelier', 2],
```

par :

```ts
  // 3 → 2 le 21.09.2026 : la feuille d'envoi `AtlSendSheet` est retirée.
  // 2 → 1 le 27.09.2026 : la couverture de premier lancement quitte l'atelier pour le fil (lot E1), et son anneau de
  // focus prend un barreau (`MXC_SYSTEM.blue300`) : le fil reste sans couleur hors barreaux.
  ['src/components/matching-atelier', 1],
```

```bash
npx vitest run tests/unit/matching-fil-demarrage.spec.ts tests/unit/banc-matching-e1.spec.ts tests/unit/jeton-arrivee.spec.tsx tests/unit/megga-x-crm-tokens.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/couleur-barreaux.spec.ts
```

Attendu : ÉCHEC, `Test Files  6 failed (6)`, `Tests  9 failed | 87 passed (96)` : la spec neuve ne se charge pas, `Failed to resolve import "@/components/matching-fil/filDemarrage" from "tests/unit/matching-fil-demarrage.spec.ts". Does the file exist?` ; le banc, `properties/p4 absent du banc` (deux tests) ; le jeton, trois tests — la page Contacts ne lit pas l'arrivée (`expected '// MEGGA CRM — Page « Contacts » (ref…' to contain 'useArrivee(\'contacts.nouveau\', sear…'`), ni ne porte ses deux lignes (`… to contain 'if (aAppliquer && !modalOpen) openMod…'`), et l'inventaire des liens n'a pas ceux des deux couvertures (`expected { …(9) } to deeply equal { …(11) }`) ; les polices, `src/components/matching-atelier/MatchingFirstRun.tsx` écrit en dur hors exemption, et l'exemption `src/components/matching-fil/MatchingFirstRun.tsx` sans code ; la grammaire, `src/components/matching-atelier — hors échelle : 31 > 23 permis` et `src/components/matching-atelier — total : 43 > 33 permis` ; les couleurs, `src/components/matching-atelier : 2 > 1 permis`. Les trois tests de l'écran qui ouvre la création passent déjà : ils éprouvent la mécanique de la tâche 11 sous la clé `contacts.nouveau` ; c'est la lecture de la page qui les rattache à elle.

- [ ] **Étape 2 : La règle, un module pur**

Créer `src/components/matching-fil/filDemarrage.ts` :

```ts
/**
 * Matching — ce que montre la page 0 (lot E1, conception
 * `docs/superpowers/specs/2026-09-27-matching-lot-e1-bureau-design.md` §5.1) : la couverture de premier lancement,
 * l'état « aucun match », ou le fil lui-même. Module PUR.
 *
 * Mesuré en production le 27.09.2026 : 12 agences sur 13 n'ont aucun match, et le fil leur aurait dit « Tout est à
 * jour » — faux : rien n'a commencé. Le seul prérequis réel d'un match est une recherche d'acheteur ACTIVE : le moteur
 * la compare aux mandats de l'agence et au marché, qui suffit.
 *
 * ⚠ LA COUVERTURE NE SE MONTRE QU'À COUP SÛR : jamais pendant une lecture — elle paraîtrait puis s'effacerait —, jamais
 * sur un échec, où l'état d'erreur du fil dit ce qui se passe. Ni à une agence dont le fil a lu un match, même sans
 * recherche active : une recherche close garde sa boucle, et ce qu'elle porte reste à traiter.
 *
 * ⚠ « Aucun match », c'est aucun match LU — à proposer, du marché ou de la boucle —, pas « aucune ligne » : une agence
 * dont les biens ont tous été refusés ou sont en visite a des matchs et rien à proposer, et le fil lui dit « Tout est à
 * jour ».
 */

/** Ce qu'a rendu la lecture des recherches d'acheteur actives de l'agence (`useRecherchesActives`). */
export type RecherchesAgence = 'chargement' | 'erreur' | 'aucune' | 'actives'

/** Ce que montre la page 0 : `fil` laisse au fil ses propres états, « Tout est à jour » compris. */
type EcranFil = 'chargement' | 'erreur' | 'couverture' | 'sansMatch' | 'fil'

/** La lecture du fil : en cours, en échec sans données, et le nombre de matchs qu'elle a rendus. */
interface LectureFil { chargement: boolean; erreur: boolean; matchs: number }

/** La page 0 du Matching, selon les recherches actives de l'agence et ce que le fil a lu. */
export function ecranDuFil(recherches: RecherchesAgence, fil: LectureFil): EcranFil {
  if (fil.chargement) return 'chargement'
  if (fil.erreur) return 'erreur'
  if (fil.matchs > 0) return 'fil'
  if (recherches === 'chargement' || recherches === 'erreur') return recherches
  return recherches === 'aucune' ? 'couverture' : 'sansMatch'
}
```

- [ ] **Étape 3 : La lecture des recherches actives**

Une lecture légère à côté de celle du fil, sous son préfixe. ⚠ Comme le fil, une requête désactivée n'est pas « en chargement » pour TanStack v5 : sans la garde sur le profil, la couverture passerait le temps que la session arrive.

Dans `src/hooks/useMatchingFil.ts`, remplacer :

```ts
 * ⚠ `chargeLe` est l'heure du DÉBUT des lectures, pas de leur fin : le fil la compare à l'heure où un
 * geste a fini d'écrire pour savoir si ces données le reflètent déjà. Prise à la fin, une lecture
 * partie avant l'écriture passerait pour postérieure.
 */
```

par :

```ts
 * ⚠ `chargeLe` est l'heure du DÉBUT des lectures, pas de leur fin : le fil la compare à l'heure où un
 * geste a fini d'écrire pour savoir si ces données le reflètent déjà. Prise à la fin, une lecture
 * partie avant l'écriture passerait pour postérieure.
 *
 * ⚠ Lot E1 : une seconde lecture, légère, dit si l'agence a une recherche d'acheteur active (`useRecherchesActives`) —
 * sans elle, la page 0 est la couverture de premier lancement (`ecranDuFil`, conception E1 §5.1).
 */
```

Dans `src/hooks/useMatchingFil.ts`, remplacer :

```ts
import type { RelanceProposition } from '@/components/matching-fil/filBoucle'
```

par :

```ts
import type { RelanceProposition } from '@/components/matching-fil/filBoucle'
import type { RecherchesAgence } from '@/components/matching-fil/filDemarrage'
```

Dans `src/hooks/useMatchingFil.ts`, remplacer :

```ts
    erreurLe: requete.errorUpdatedAt,
    rafraichir,
  }
}
```

par :

```ts
    erreurLe: requete.errorUpdatedAt,
    rafraichir,
  }
}

/**
 * L'agence a-t-elle au moins une recherche d'acheteur ACTIVE (lot E1) ? Un identifiant, sous la RLS de l'agent
 * (`client_searches_select` : l'agence de l'appelant). Sans agence, la RLS ne rendrait rien : aucune recherche.
 *
 * ⚠ Sous le préfixe du fil (`CLE_FIL`) : « Réessayer » la relit avec le fil, chaque geste aussi.
 */
export function useRecherchesActives(): RecherchesAgence {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const requete = useQuery({
    queryKey: [CLE_FIL, 'recherches', agencyId],
    queryFn: async () => (await lire<{ id: string }>(
      supabase.from('client_searches').select('id').eq('is_active', true).limit(1),
    )).length > 0,
    enabled: agencyId != null,
  })
  // Comme le fil : une requête DÉSACTIVÉE n'est pas « en chargement » pour TanStack v5 — sans la garde sur le profil,
  // la couverture passerait le temps que la session arrive.
  if (profile == null || requete.isLoading) return 'chargement'
  if (requete.data !== undefined) return requete.data ? 'actives' : 'aucune'
  return requete.isError ? 'erreur' : 'aucune'
}
```

- [ ] **Étape 4 : La couverture passe dans le fil**

```bash
git mv src/components/matching-atelier/MatchingFirstRun.tsx src/components/matching-fil/MatchingFirstRun.tsx
```

Son en-tête dit la condition du fil et l'ordre réel de la boucle ; ses étapes suivent cet ordre, icônes comprises ; son bouton ajoute un acheteur ; ses rayons et espacements passent aux jetons, son anneau de focus au barreau `MXC_SYSTEM.blue300`.

Dans `src/components/matching-fil/MatchingFirstRun.tsx`, remplacer :

```tsx
// MEGGA CRM — Matching · État « Compte neuf » (premier lancement).
// Port du handoff `crm-matching-firstrun.jsx` : remplace la page 0 du pager
// quand l'agence n'a encore ni mandat ni contact avec critères. Explique la
// boucle de match en 3 étapes et pointe vers le prérequis (créer un bien).
//
// EXCEPTION TOKENS ASSUMÉE — comme BiensFirstRun.tsx et ContactsFirstRun.tsx,
// cette couverture est MONO-THÈME : fond sombre #030303 et textes blancs en dur,
// quel que soit le thème de l'app. Ne PAS « corriger » ces couleurs vers les
// tokens sp.* : la maquette repose dessus.
//
// COUVERTURE : illustration plein cadre (halftone violet/magenta sur noir,
// façon cover KYC), livrée avec le paquet de design du 25 juillet. Les motifs
// occupent le coin haut-droit et le coin bas-gauche : le contenu est donc
// remonté (paddingBottom) pour ne pas s'asseoir dessus.

import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
```

par :

```tsx
/**
 * Matching — la couverture de premier lancement (« Compte neuf »), port du handoff `crm-matching-firstrun.jsx`.
 *
 * Lot E1 (conception `docs/superpowers/specs/2026-09-27-matching-lot-e1-bureau-design.md` §5.1) : le fil la montre à la
 * place de la page 0 quand l'agence n'a AUCUNE recherche d'acheteur active (`ecranDuFil`) ; la Recherche reste en page 1.
 * Trois étapes, dans l'ordre de la boucle — un acheteur, les biens qu'on lui compare, les matchs —, et le bouton mène à
 * la création d'un contact. Un mandat n'est pas requis : le marché suffit.
 *
 * EXCEPTION TOKENS ASSUMÉE — comme `BiensFirstRun.tsx`, cette couverture est MONO-THÈME : fond sombre #030303 et textes
 * blancs en dur, quel que soit le thème de l'app (celle des Contacts suit le thème depuis le 16.09.2026). Ne PAS
 * « corriger » ces couleurs vers les jetons `sp.*` : la maquette repose dessus. Son anneau de focus est un barreau,
 * `MXC_SYSTEM.blue300`, l'encre claire de la direction sur fond sombre ; ses rayons et espacements passent par
 * l'échelle, comme tout le fil.
 *
 * COUVERTURE : illustration plein cadre (halftone violet/magenta sur noir, façon cover KYC), livrée avec le paquet de
 * design du 25 juillet. Les motifs occupent le coin haut-droit et le coin bas-gauche : le contenu est donc remonté
 * (paddingBottom) pour ne pas s'asseoir dessus.
 */
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
```

Dans `src/components/matching-fil/MatchingFirstRun.tsx`, remplacer :

```tsx
/** Les 3 étapes de la boucle de match — icône + clé i18n. */
const STEPS: { icon: MEIconName; key: string }[] = [
  { icon: 'home', key: 'mandat' },
  { icon: 'users', key: 'contact' },
  { icon: 'sparkle', key: 'scores' },
]

interface MatchingFirstRunProps {
  /** Création du premier mandat (bouton « Continuer »). */
  onCreateListing: () => void
}

/** Couverture premier lancement du Matching (page 0 quand l'agence n'a aucun match). */
export default function MatchingFirstRun({ onCreateListing }: MatchingFirstRunProps) {
```

par :

```tsx
/** Les 3 étapes de la boucle de match, dans son ordre — icône + clé i18n. */
const STEPS: { icon: MEIconName; key: string }[] = [
  { icon: 'users', key: 'acheteur' },
  { icon: 'home', key: 'biens' },
  { icon: 'sparkle', key: 'scores' },
]

interface MatchingFirstRunProps {
  /** Un premier acheteur (bouton « Ajouter un acheteur ») : la création d'un contact. */
  onAjouterAcheteur: () => void
}

/** Couverture premier lancement du Matching (page 0 quand l'agence n'a aucune recherche d'acheteur active). */
export default function MatchingFirstRun({ onAjouterAcheteur }: MatchingFirstRunProps) {
```

Dans `src/components/matching-fil/MatchingFirstRun.tsx`, remplacer :

```tsx
      <style>{`.mfr-root button:focus-visible{outline:2.5px solid #8DA4FF;outline-offset:3px;}.mfr-root :focus:not(:focus-visible){outline:none;}`}</style>
```

par :

```tsx
      <style>{`.mfr-root button:focus-visible{outline:2.5px solid ${MXC_SYSTEM.blue300};outline-offset:3px;}.mfr-root :focus:not(:focus-visible){outline:none;}`}</style>
```

Dans `src/components/matching-fil/MatchingFirstRun.tsx`, remplacer :

```tsx
      <div style={{ position: 'relative', zIndex: 2, minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 40px', paddingBottom: 180 }}>
```

par :

```tsx
      <div style={{ position: 'relative', zIndex: 2, minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'calc(var(--crm-space-sm) * 7) calc(var(--crm-space-5xl) * 2)', paddingBottom: 'calc(var(--crm-space-5xl) * 9)' }}>
```

Dans `src/components/matching-fil/MatchingFirstRun.tsx`, remplacer :

```tsx
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, maxWidth: 860, width: '100%', marginTop: 40 }}>
          {STEPS.map(s => (
            <div key={s.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '8px 12px' }}>
              <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 999, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <MEIcon name={s.icon} size={34} />
              </span>
              <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.3, color: '#FFFFFF', lineHeight: 1.25, marginTop: 16, textShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
                {t(`firstRun.${s.key}.title`)}
              </div>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginTop: 6, textShadow: '0 0 16px rgba(0,0,0,0.5)' }}>
```

par :

```tsx
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--crm-space-4xl)', maxWidth: 860, width: '100%', marginTop: 'calc(var(--crm-space-5xl) * 2)' }}>
          {STEPS.map(s => (
            <div key={s.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 'var(--crm-space-sm) var(--crm-space-lg)' }}>
              <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <MEIcon name={s.icon} size={34} />
              </span>
              <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.3, color: '#FFFFFF', lineHeight: 1.25, marginTop: 'var(--crm-space-2xl)', textShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
                {t(`firstRun.${s.key}.title`)}
              </div>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginTop: 'var(--crm-space-sm)', textShadow: '0 0 16px rgba(0,0,0,0.5)' }}>
```

Dans `src/components/matching-fil/MatchingFirstRun.tsx`, remplacer :

```tsx
          onClick={onCreateListing}
          style={{
            marginTop: 40, height: 48, padding: '0 30px', borderRadius: 999, border: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, background: '#FFFFFF', color: '#030303',
            display: 'inline-flex', alignItems: 'center', gap: 9, boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
```

par :

```tsx
          onClick={onAjouterAcheteur}
          style={{
            marginTop: 'calc(var(--crm-space-5xl) * 2)', height: 48, padding: '0 calc(var(--crm-space-2xl) * 2)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, background: '#FFFFFF', color: '#030303',
            display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
```

- [ ] **Étape 5 : Les textes, quatre langues**

Les étapes changent de clé et d'ordre (`acheteur`, `biens`, `scores`) ; le titre ne change pas ; `start` devient « Ajouter un acheteur ». L'état neuf prend sa clé parmi ses voisins, après `marche` (« Voir le marché »), qu'il réutilise pour son action. En italien, l'étape reste au vouvoiement de ses voisines (« Aggiunga ») et le bouton à l'impératif des boutons (« Aggiungi », comme « Aggiungi il primo contatto »).

Dans `src/i18n/locales/fr/matching.json`, remplacer :

```json
    "title": "Votre boucle de match démarre ici",
    "mandat": {
      "title": "Créez votre premier mandat",
      "sub": "Un bien à vendre ou à louer."
    },
    "contact": {
      "title": "Ajoutez un contact",
      "sub": "Budget, secteur, pièces."
    },
    "scores": {
      "title": "MEGGA calcule les matchs",
      "sub": "Rien à configurer."
    },
    "start": "Continuer"
```

par :

```json
    "title": "Votre boucle de match démarre ici",
    "acheteur": {
      "title": "Ajoutez un acheteur",
      "sub": "Budget, secteur, pièces."
    },
    "biens": {
      "title": "Vos mandats et le marché",
      "sub": "Les biens qu'on lui compare."
    },
    "scores": {
      "title": "MEGGA calcule les matchs",
      "sub": "Rien à configurer."
    },
    "start": "Ajouter un acheteur"
```

Dans `src/i18n/locales/fr/matching.json`, remplacer :

```json
      "marche": "Voir le marché",
      "attenteTitre": "Aucune réponse attendue",
```

par :

```json
      "marche": "Voir le marché",
      "sansMatch": "Aucun bien ne correspond encore aux critères de vos acheteurs",
      "attenteTitre": "Aucune réponse attendue",
```

Dans `src/i18n/locales/de/matching.json`, remplacer :

```json
    "title": "Hier beginnt Ihre Match-Schleife",
    "mandat": {
      "title": "Erstellen Sie Ihr erstes Mandat",
      "sub": "Ein Objekt zum Verkauf oder zur Miete."
    },
    "contact": {
      "title": "Fügen Sie einen Kontakt hinzu",
      "sub": "Budget, Gebiet, Zimmer."
    },
    "scores": {
      "title": "MEGGA berechnet die Matches",
      "sub": "Nichts einzurichten."
    },
    "start": "Weiter"
```

par :

```json
    "title": "Hier beginnt Ihre Match-Schleife",
    "acheteur": {
      "title": "Fügen Sie einen Käufer hinzu",
      "sub": "Budget, Gebiet, Zimmer."
    },
    "biens": {
      "title": "Ihre Mandate und der Markt",
      "sub": "Die Objekte, die wir mit seiner Suche vergleichen."
    },
    "scores": {
      "title": "MEGGA berechnet die Matches",
      "sub": "Nichts einzurichten."
    },
    "start": "Käufer hinzufügen"
```

Dans `src/i18n/locales/de/matching.json`, remplacer :

```json
      "marche": "Markt ansehen",
      "attenteTitre": "Keine Antwort ausstehend",
```

par :

```json
      "marche": "Markt ansehen",
      "sansMatch": "Noch kein Objekt entspricht den Kriterien Ihrer Käufer",
      "attenteTitre": "Keine Antwort ausstehend",
```

Dans `src/i18n/locales/en/matching.json`, remplacer :

```json
    "title": "Your match loop starts here",
    "mandat": {
      "title": "Create your first mandate",
      "sub": "A property to sell or to rent."
    },
    "contact": {
      "title": "Add a contact",
      "sub": "Budget, area, rooms."
    },
    "scores": {
      "title": "MEGGA computes the matches",
      "sub": "Nothing to configure."
    },
    "start": "Continue"
```

par :

```json
    "title": "Your match loop starts here",
    "acheteur": {
      "title": "Add a buyer",
      "sub": "Budget, area, rooms."
    },
    "biens": {
      "title": "Your mandates and the market",
      "sub": "The properties we compare with their search."
    },
    "scores": {
      "title": "MEGGA computes the matches",
      "sub": "Nothing to configure."
    },
    "start": "Add a buyer"
```

Dans `src/i18n/locales/en/matching.json`, remplacer :

```json
      "marche": "View the market",
      "attenteTitre": "No reply awaited",
```

par :

```json
      "marche": "View the market",
      "sansMatch": "No property matches your buyers' criteria yet",
      "attenteTitre": "No reply awaited",
```

Dans `src/i18n/locales/it/matching.json`, remplacer :

```json
    "title": "Il Suo ciclo di match inizia qui",
    "mandat": {
      "title": "Crei il Suo primo mandato",
      "sub": "Un immobile da vendere o da affittare."
    },
    "contact": {
      "title": "Aggiunga un contatto",
      "sub": "Budget, zona, locali."
    },
    "scores": {
      "title": "MEGGA calcola i match",
      "sub": "Nulla da configurare."
    },
    "start": "Continua"
```

par :

```json
    "title": "Il Suo ciclo di match inizia qui",
    "acheteur": {
      "title": "Aggiunga un acquirente",
      "sub": "Budget, zona, locali."
    },
    "biens": {
      "title": "I Suoi mandati e il mercato",
      "sub": "Gli immobili che confrontiamo con la sua ricerca."
    },
    "scores": {
      "title": "MEGGA calcola i match",
      "sub": "Nulla da configurare."
    },
    "start": "Aggiungi un acquirente"
```

Dans `src/i18n/locales/it/matching.json`, remplacer :

```json
      "marche": "Vedi il mercato",
      "attenteTitre": "Nessuna risposta in attesa",
```

par :

```json
      "marche": "Vedi il mercato",
      "sansMatch": "Nessun immobile corrisponde ancora ai criteri dei Suoi acquirenti",
      "attenteTitre": "Nessuna risposta in attesa",
```

- [ ] **Étape 6 : Le fil monte la couverture et l'état « aucun match »**

La règle décide de la page 0 ; le squelette et l'état d'erreur en suivent les issues. Un filtre actif qui ne retient rien passe toujours avant (« Rien ne correspond à ces filtres ») ; l'état « aucun match » vient ensuite, puis « Tout est à jour ». La couverture remplace la page entière, en-tête compris ; elle est rendue après tous les crochets du composant, et son bouton mène à la création d'un contact par une arrivée à jeton neuf (`avecArrivee`), qu'ouvre la page Contacts (étape 7).

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
 * ⚠ Lot E1 (décision 12a) : un mandat qui n'est plus en vente (`horsVente`) sort d'« À proposer », son en-tête et
 * donc « Qui pour ce bien ? » avec lui ; « En attente » et « À conclure » le gardent, son état écrit.
 *
```

par :

```tsx
 * ⚠ Lot E1 (décision 12a) : un mandat qui n'est plus en vente (`horsVente`) sort d'« À proposer », son en-tête et
 * donc « Qui pour ce bien ? » avec lui ; « En attente » et « À conclure » le gardent, son état écrit.
 *
 * ⚠ Lot E1 (conception §5.1) : sans recherche d'acheteur active et sans match, la page 0 est la couverture de premier
 * lancement (`MatchingFirstRun`) ; avec des recherches mais aucun match, un état sobre qui mène au marché — « Tout est à
 * jour » ne se dit qu'à une agence qui a des matchs (`ecranDuFil`).
 *
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
import { useArrivee } from '@/hooks/useArrivee'
```

par :

```tsx
import { useArrivee } from '@/hooks/useArrivee'
import { avecArrivee } from '@/lib/jetonArrivee'
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
import { useMatchingFil, versGeste } from '@/hooks/useMatchingFil'
```

par :

```tsx
import { useMatchingFil, useRecherchesActives, versGeste } from '@/hooks/useMatchingFil'
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
import { construireCorrections, filtrerCorrections, type Correction, type CorrectionChangement } from './filApprendre'
import { compatiblesDuFil } from './filQuiPour'
```

par :

```tsx
import { construireCorrections, filtrerCorrections, type Correction, type CorrectionChangement } from './filApprendre'
import { ecranDuFil } from './filDemarrage'
import { compatiblesDuFil } from './filQuiPour'
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
import FilSelection from './FilSelection'
```

par :

```tsx
import FilSelection from './FilSelection'
import MatchingFirstRun from './MatchingFirstRun'
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
    isLoading, isError, aDesDonnees, erreurLe, matchs, selections, boucle, relances, historique, chargeLe, rafraichir,
  } = useMatchingFil()
```

par :

```tsx
    isLoading, isError, aDesDonnees, erreurLe, matchs, selections, boucle, relances, historique, chargeLe, rafraichir,
  } = useMatchingFil()
  const recherches = useRecherchesActives()
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
  const enEchec = isError && !aDesDonnees
  const connu = !isLoading && !enEchec
```

par :

```tsx
  const enEchec = isError && !aDesDonnees
  // La page 0 (conception E1 §5.1) : la couverture, l'état « aucun match », ou le fil. `matchs` compte ce que le fil a
  // LU — à proposer, du marché, de la boucle —, avant masques et filtres : c'est l'agence qu'on juge, pas l'écran.
  const ecran = ecranDuFil(recherches, {
    chargement: isLoading, erreur: enEchec, matchs: matchs.length + selections.length + boucle.length,
  })
  const connu = ecran !== 'chargement' && ecran !== 'erreur'
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
        {isLoading ? <Squelette sp={sp} />
          : enEchec ? <Etat sp={sp} alerte titre={t('fil.erreur')} action={{ libelle: t('fil.reessayer'), faire: rafraichir }} />
            // ⚠ Un FILTRE actif qui ne retient rien passe AVANT le constat « aucune donnée du tout » :
            // sinon le seul match d'un acheteur filtré, une fois proposé, fait lire « Tout est à jour »
            // (vrai pour l'agence entière, faux pour ce filtre) au lieu de « Rien ne correspond ».
            : filtreActif && ongletVide ? (
              <Etat sp={sp} titre={t('fil.filtreVide')} action={{ libelle: t('fil.filtres.retirer'), faire: () => setFiltres(SANS_FILTRE) }} />
            ) : rienDuTout || (onglet === 'aProposer' && ongletVide) ? etatAProposer
```

par :

```tsx
        {ecran === 'chargement' ? <Squelette sp={sp} />
          // « Réessayer » relit le fil ET les recherches actives, rangées sous son préfixe.
          : ecran === 'erreur' ? <Etat sp={sp} alerte titre={t('fil.erreur')} action={{ libelle: t('fil.reessayer'), faire: rafraichir }} />
            // ⚠ Un FILTRE actif qui ne retient rien passe AVANT le constat « aucune donnée du tout » :
            // sinon le seul match d'un acheteur filtré, une fois proposé, fait lire « Tout est à jour »
            // (vrai pour l'agence entière, faux pour ce filtre) au lieu de « Rien ne correspond ».
            : filtreActif && ongletVide ? (
              <Etat sp={sp} titre={t('fil.filtreVide')} action={{ libelle: t('fil.filtres.retirer'), faire: () => setFiltres(SANS_FILTRE) }} />
            ) : ecran === 'sansMatch' ? (
              <Etat sp={sp} titre={t('fil.vide.sansMatch')}
                action={onOpenRecherche ? { libelle: t('fil.vide.marche'), faire: onOpenRecherche } : undefined} />
            ) : rienDuTout || (onglet === 'aProposer' && ongletVide) ? etatAProposer
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
    <Etat sp={sp} titre={onglet === 'aProposer' && comptes.aProposer === 0 ? t('fil.vide.titre') : t('fil.choisir')} />
  )
  return (
```

par :

```tsx
    <Etat sp={sp} titre={onglet === 'aProposer' && comptes.aProposer === 0 ? t('fil.vide.titre') : t('fil.choisir')} />
  )
  // La couverture remplace la page 0 ENTIÈRE, en-tête compris : il n'y a encore rien à filtrer. Son bouton ouvre la
  // création d'un contact : la page Contacts l'ouvre sur cette arrivée, une fois par navigation (`useArrivee`).
  if (ecran === 'couverture') return <MatchingFirstRun onAjouterAcheteur={() => navigate('/dashboard/contacts?nouveau=1', avecArrivee())} />
  return (
```

- [ ] **Étape 7 : La page Contacts ouvre sa création sur l'arrivée `?nouveau=1`**

La mécanique de la tâche 11, celle de `?qui=1` des fiches : la page lit l'arrivée sous sa clé (`contacts.nouveau`), ouvre la modale « Nouveau contact » PENDANT LE RENDU quand l'arrivée est à appliquer et la modale fermée — `react-hooks/set-state-in-effect` refuse un `setState` d'effet —, et la marque par l'effet. Le vieux `?source=`, qu'aucun lien ne pose plus, n'est plus nettoyé : une page qui applique une arrivée ne réécrit jamais son adresse. Aucun paramètre de rôle : la modale ne prend pas de rôle initial, et pré-coche « acheteur » d'elle-même (`EMPTY.roles = ['buyer']`, `NewContactModal.tsx`).

Dans `src/pages/agent/ContactsPage.tsx`, remplacer :

```tsx
// Création → NouveauContact en overlay du cadre, câblée Supabase
// (search_criteria snake_case → déclenche l'auto-matching via le pont DB).
// Réf. handoff : crm-screen-contacts-proto.jsx / crm-contacts-firstrun.jsx /
```

par :

```tsx
// Création → NouveauContact en overlay du cadre, câblée Supabase
// (search_criteria snake_case → déclenche l'auto-matching via le pont DB).
// Arrivée `?nouveau=1` (« Ajouter un acheteur », la couverture du Matching) → la
// création s'ouvre, une fois par navigation (`useArrivee`) ; l'adresse n'est
// jamais réécrite.
// Réf. handoff : crm-screen-contacts-proto.jsx / crm-contacts-firstrun.jsx /
```

Dans `src/pages/agent/ContactsPage.tsx`, remplacer :

```tsx
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { useContactsScreen } from '@/hooks/useContactsScreen'
```

par :

```tsx
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { useArrivee } from '@/hooks/useArrivee'
import { useContactsScreen } from '@/hooks/useContactsScreen'
```

Dans `src/pages/agent/ContactsPage.tsx`, remplacer :

```tsx
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  const { t: tr } = useTranslation('contacts')

  // Deep-link `?source=` (handoff Dashboard) — consommé une fois puis nettoyé
  // (le pager n'affiche plus de bannière source ; param obsolète mais toléré).
  useEffect(() => {
    if (searchParams.has('source')) {
      const next = new URLSearchParams(searchParams)
      next.delete('source')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Thème dark/light, calé sur le toggle de la barre latérale (partagé Today/Pipeline) ──
```

par :

```tsx
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const { t: tr } = useTranslation('contacts')

  // ── Thème dark/light, calé sur le toggle de la barre latérale (partagé Today/Pipeline) ──
```

Dans `src/pages/agent/ContactsPage.tsx`, remplacer :

```tsx
  const openModal = () => { setCreateError(null); setModalOpen(true) }
```

par :

```tsx
  const openModal = () => { setCreateError(null); setModalOpen(true) }

  // « Ajouter un acheteur » (la couverture de premier lancement du Matching) arrive avec `?nouveau=1` : la création
  // s'ouvre UNE fois par navigation (`useArrivee`) — un remontage de l'écran ne la rouvre pas, un nouveau clic sur le
  // lien, si. Ouverte PENDANT LE RENDU (`react-hooks/set-state-in-effect` refuse un `setState` d'effet), marquée par
  // l'effet. ⛔ L'adresse garde son paramètre : réécrite, la réconciliation des onglets la lirait comme celle d'un autre
  // onglet. Le rôle d'acheteur, la modale le pré-coche d'elle-même.
  const { aAppliquer, marquerAppliquee } = useArrivee('contacts.nouveau', searchParams.has('nouveau'))
  if (aAppliquer && !modalOpen) openModal()
  useEffect(() => { if (aAppliquer) marquerAppliquee() }, [aAppliquer, marquerAppliquee])
```

Le jeton d'arrivée nomme son lecteur neuf.

Dans `src/lib/jetonArrivee.ts`, remplacer :

```ts
 * `?attente`, `?contact`, `?annonce=p:`), la page du fil dans le pager de Matching, « Qui pour ce bien ? » d'une fiche
 * (`?qui=1`). L'adresse la porte, et la garde : ⛔ l'écran ne la réécrit jamais — la réconciliation des onglets du CRM
 * lirait l'adresse réécrite comme celle d'un autre onglet.
```

par :

```ts
 * `?attente`, `?contact`, `?annonce=p:`), la page du fil dans le pager de Matching, « Qui pour ce bien ? » d'une fiche
 * (`?qui=1`), la création d'un contact (`?nouveau=1`). L'adresse la porte, et la garde : ⛔ l'écran ne la réécrit
 * jamais — la réconciliation des onglets du CRM lirait l'adresse réécrite comme celle d'un autre onglet.
```

Dans `src/hooks/useArrivee.ts`, remplacer :

```ts
 * `2026-09-27-matching-lot-e1-bureau-design.md` §4.2 ; la règle vit dans `src/lib/jetonArrivee.ts`). Lue par le fil de
 * matchs, le pager de Matching et les deux fiches de bien (`?qui=1`).
```

par :

```ts
 * `2026-09-27-matching-lot-e1-bureau-design.md` §4.2 ; la règle vit dans `src/lib/jetonArrivee.ts`). Lue par le fil de
 * matchs, le pager de Matching, les deux fiches de bien (`?qui=1`) et la page Contacts (`?nouveau=1`).
```

- [ ] **Étape 8 : L'atelier et son banc suivent le déplacement**

L'atelier tient la page 0 jusqu'à la tâche 13 : il garde sa condition (ni pivot ni bien), et le bouton de la couverture y ouvre aussi la création d'un contact, puisque son texte dit « Ajouter un acheteur ».

Dans `src/pages/agent/MatchingAtelierPage.tsx`, remplacer :

```tsx
import MatchingFirstRun from '@/components/matching-atelier/MatchingFirstRun'
import { useCrmDark } from '@/lib/crmDark'
```

par :

```tsx
import MatchingFirstRun from '@/components/matching-fil/MatchingFirstRun'
import { useCrmDark } from '@/lib/crmDark'
import { avecArrivee } from '@/lib/jetonArrivee'
```

Dans `src/pages/agent/MatchingAtelierPage.tsx`, remplacer :

```tsx
  // Couverture premier lancement — remplace la page 0 du pager (le reste du
  // pager, dont la Recherche, demeure accessible).
  if (fresh) {
    return <MatchingFirstRun onCreateListing={() => navigate('/dashboard/listings/new')} />
  }
```

par :

```tsx
  // Couverture premier lancement — remplace la page 0 du pager (le reste du
  // pager, dont la Recherche, demeure accessible). Son bouton ouvre la création
  // d'un contact, comme depuis le fil.
  if (fresh) {
    return <MatchingFirstRun onAjouterAcheteur={() => navigate('/dashboard/contacts?nouveau=1', avecArrivee())} />
  }
```

Dans `src/pages/dev/MatchingShowcasePage.tsx`, remplacer :

```tsx
import MatchingFirstRun from '@/components/matching-atelier/MatchingFirstRun'
```

par :

```tsx
import MatchingFirstRun from '@/components/matching-fil/MatchingFirstRun'
```

Dans `src/pages/dev/MatchingShowcasePage.tsx`, remplacer :

```tsx
  if (atelier === 'premier') return <MatchingFirstRun onCreateListing={() => undefined} />
```

par :

```tsx
  if (atelier === 'premier') return <MatchingFirstRun onAjouterAcheteur={() => undefined} />
```

- [ ] **Étape 9 : Le banc `/dev/crm` — un mandat vendu, et « Sans match »**

Le mandat vendu, sa jointure et ses deux matchs, notés par le moteur (Julie : 97, dont les pièces « 4,5 pièces · 116 m² » et les équipements « 2/3 critères » ; Emma : 100, sans critère de pièces ni d'équipements). La jointure porte l'état de la table, comme les autres (« Sa boucle » le lit).

Dans `src/pages/dev/crmFixtures.ts`, remplacer :

```ts
  rooms: { match: false, score: 0, detail: 'Aucun critère' },
  features: { match: false, score: 0, detail: '—' },
}

export const CRM_TABLES: Record<string, unknown[]> = {
```

par :

```ts
  rooms: { match: false, score: 0, detail: 'Aucun critère' },
  features: { match: false, score: 0, detail: '—' },
}
/** Lot E1 : la jointure `property` des deux matchs du mandat VENDU (p4) — son état est celui de la table. */
const PETIT_SACONNEX_EMBARQUE = {
  title: 'Appartement 4,5 pièces · Petit-Saconnex', price: 1_540_000, address: 'Avenue Trembley 20',
  city: 'Genève', canton: 'GE', postal_code: '1209', rooms: 4.5, bedrooms: 3, surface_m2: 116,
  photos: [unsplash(PHOTOS_APPART[2]!)], type: 'apartment', description: 'Traversant, balcon sur le parc, cuisine refaite.',
  features: ['Balcon', 'Ascenseur'], floor: 3, year_built: 1985, charges_monthly: 480, status: 'sold',
}

export const CRM_TABLES: Record<string, unknown[]> = {
```

Dans `src/pages/dev/crmFixtures.ts`, remplacer :

```ts
      status: 'active', transaction_type: 'sale', published_at: ilYA(24 * 2), created_at: ilYA(24 * 3),
      photos: [unsplash(PHOTOS_APPART[9]!)], photos_cf: null,
    },
    ...BIENS_CATALOGUE,
```

par :

```ts
      status: 'active', transaction_type: 'sale', published_at: ilYA(24 * 2), created_at: ilYA(24 * 3),
      photos: [unsplash(PHOTOS_APPART[9]!)], photos_cf: null,
    },
    // Lot E1 (27.09.2026) : un mandat VENDU. Julie n'a pas encore répondu sur lui (m26), Emma s'y est dite intéressée
    // (m27) : « En attente » et « À conclure » les gardent, son état écrit (« Vendu ») ; « À proposer » ne le montre plus.
    {
      id: 'p4', agency_id: AGENCE_BANC.id, created_by: AGENT_BANC.id, partner_agency: null, title: 'Appartement 4,5 pièces · Petit-Saconnex', type: 'apartment',
      address: 'Avenue Trembley 20', postal_code: '1209', city: 'Genève', canton: 'GE',
      price: 1_540_000, charges_monthly: 480, rooms: 4.5, bedrooms: 3, bathrooms: 2, surface_m2: 116,
      year_built: 1985, energy_class: 'C', floor: 3, condition: 'good', off_market: false,
      description: 'Traversant, balcon sur le parc, cuisine refaite.',
      features: ['Balcon', 'Ascenseur'],
      mandate_type: 'exclusive', mandate_commission_pct: 3, mandate_signed_at: ilYA(24 * 90), mandate_expires_at: ilYA(-24 * 90),
      views_count: 158, favorites_count: 11,
      status: 'sold', transaction_type: 'sale', published_at: ilYA(24 * 85), created_at: ilYA(24 * 92),
      photos: [unsplash(PHOTOS_APPART[2]!)], photos_cf: null,
    },
    ...BIENS_CATALOGUE,
```

Dans `src/pages/dev/crmFixtures.ts`, remplacer :

```ts
      contact: ANASTASIA_EMBARQUEE, property: null, market_listing: ANNONCES_SIGNAL[1],
    },
  ],
  crm_offers: [],
```

par :

```ts
      contact: ANASTASIA_EMBARQUEE, property: null, market_listing: ANNONCES_SIGNAL[1],
    },
    // ── Lot E1 (27.09.2026) : le mandat VENDU de Petit-Saconnex (p4), noté par le vrai moteur (`banc-matching-e1.spec.ts`).
    // Proposé à Julie il y a six jours ; proposé à Emma il y a neuf jours, intéressée depuis sept. Aucune relance ne les
    // couvre et la réponse d'Emma sort de la fenêtre de « Pendant ton absence » : « Aujourd'hui » reste celui du lot D1
    // (`banc-matching-d1.spec.ts`) — un mandat vendu n'y entre pas.
    {
      id: 'm26', agency_id: AGENCE_BANC.id, client_search_id: 'cs9', contact_id: 'c9', source: 'internal',
      property_id: 'p4', market_listing_id: null, score_version: 4,
      score: 97, status: 'sent', sent_via: 'agent', sent_at: ilYA(24 * 6), snoozed_until: null, created_at: ilYA(24 * 10),
      response_at: null, reaction_motif: null, reaction_note: null, prix_propose: 1_540_000, apprentissage_at: null,
      reasons: {
        budget: { match: true, score: 32, detail: 'Dans le budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 22, detail: '4,5 pièces · 116 m²' },
        features: { match: true, score: 7, detail: '2/3 critères' },
      },
      contact: JULIE_EMBARQUEE, property: PETIT_SACONNEX_EMBARQUE, market_listing: null,
    },
    {
      id: 'm27', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'internal',
      property_id: 'p4', market_listing_id: null, score_version: 4,
      score: 100, status: 'interested', sent_via: 'agent', sent_at: ilYA(24 * 9), snoozed_until: null, created_at: ilYA(24 * 12),
      response_at: ilYA(24 * 7), reaction_motif: null, reaction_note: null, prix_propose: 1_540_000, apprentissage_at: null,
      reasons: {
        budget: { match: true, score: 47, detail: 'Dans le budget' },
        zone: { match: true, score: 35, detail: 'Genève correspond' },
        type: { match: true, score: 18, detail: 'apartment' },
        rooms: { match: false, score: 0, detail: 'Aucun critère' },
        features: { match: false, score: 0, detail: '—' },
      },
      contact: EMMA_EMBARQUEE, property: PETIT_SACONNEX_EMBARQUE, market_listing: null,
    },
  ],
  crm_offers: [],
```

« Sans match » au panneau : un état qui règle l'interception sur « Vide » et laisse traverser les recherches en plus du socle. Chaque état repose le socle, sans quoi les recherches traverseraient encore « Vide » ; le studio Labs suit l'état de l'interception.

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
const ETATS: { id: BancEtat; label: string; titre: string }[] = [
  { id: 'nominal', label: 'Nominal', titre: '10 contacts, 50 biens, 20 matchs, 4 rappels, 1 visite, journal à 4 lignes' },
  { id: 'vide', label: 'Vide', titre: 'Chaque source rend zéro ligne — les états vides de chaque surface' },
  { id: 'erreur', label: 'Échec', titre: 'Chaque source rend 500 — les branches d’erreur' },
]
```

par :

```tsx
/** Les tables qui TRAVERSENT l'état « Vide » : l'identité de la session, jamais du domaine (voir l'effet qui les pose). */
const SOCLE = ['profiles', 'agencies', 'whatsapp_agent_links'] as const

/**
 * Les états du panneau : ce que rend l'interception (`etat`), et les tables qui traversent « Vide » en plus du socle
 * (`traversent`).
 *
 * ⚠ « Sans match » n'est pas un état de plus de l'interception : c'est « Vide », les recherches des acheteurs en plus
 * (lot E1). Sans recherche active et sans match, le fil de matchs montre sa couverture de premier lancement ; avec des
 * recherches mais aucun match, l'état « aucun match » (conception E1 §5.1). « Vide » ne peut montrer que le premier. Les
 * deux viennent des vraies lectures du fil : aucun écran n'est forcé.
 */
type EtatPanneau = BancEtat | 'sansMatch'
const ETATS: { id: EtatPanneau; etat: BancEtat; traversent?: readonly string[]; label: string; titre: string }[] = [
  { id: 'nominal', etat: 'nominal', label: 'Nominal', titre: '10 contacts, 50 biens, 20 matchs, 4 rappels, 1 visite, journal à 4 lignes' },
  { id: 'vide', etat: 'vide', label: 'Vide', titre: 'Chaque source rend zéro ligne — les états vides de chaque surface' },
  { id: 'sansMatch', etat: 'vide', traversent: ['client_searches'], label: 'Sans match', titre: 'Vide, sauf les recherches des acheteurs — le Matching n’a encore rien trouvé' },
  { id: 'erreur', etat: 'erreur', label: 'Échec', titre: 'Chaque source rend 500 — les branches d’erreur' },
]
const etatDuPanneau = (id: EtatPanneau): (typeof ETATS)[number] => ETATS.find((e) => e.id === id) ?? ETATS[0]!
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
 * ⚠ Une table et non un ternaire : les trois branches sont NOMMÉES des deux côtés, et
 * le jour où le banc gagne un quatrième état, TypeScript réclame sa traduction ici.
 */
```

par :

```tsx
 * ⚠ Une table et non un ternaire : les trois branches sont NOMMÉES des deux côtés, et
 * le jour où le banc gagne un quatrième état, TypeScript réclame sa traduction ici.
 * Ce sont ceux de l'INTERCEPTION (`BancEtat`) : « Sans match », au panneau, en est un
 * « Vide », et le studio y est vide.
 */
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
function Commandes({ etat, setEtat, sansFixture }: {
  etat: BancEtat
  setEtat: (e: BancEtat) => void
  sansFixture: string[]
}) {
```

par :

```tsx
function Commandes({ etat, setEtat, sansFixture }: {
  etat: EtatPanneau
  setEtat: (e: EtatPanneau) => void
  sansFixture: string[]
}) {
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
        <div role="menu" style={{
          width: 240, maxHeight: '60vh', display: 'flex', flexDirection: 'column',
```

par :

```tsx
        <div role="menu" style={{
          // Assez large pour les quatre états sur une ligne, « Sans match » compris.
          width: 320, maxHeight: '60vh', display: 'flex', flexDirection: 'column',
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
  const [etat, setEtatLocal] = useState<BancEtat>('nominal')
```

par :

```tsx
  const [etat, setEtatLocal] = useState<EtatPanneau>('nominal')
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
      socle: ['profiles', 'agencies', 'whatsapp_agent_links'],
```

par :

```tsx
      socle: [...SOCLE],
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
  const setEtat = useCallback((e: BancEtat) => {
    reglerBanc({ etat: e })
    setEtatLocal(e)
```

par :

```tsx
  const setEtat = useCallback((id: EtatPanneau) => {
    const choisi = etatDuPanneau(id)
    // Le socle revient à chaque état : sans quoi « Sans match » laisserait passer les recherches dans « Vide ».
    reglerBanc({ etat: choisi.etat, socle: [...SOCLE, ...(choisi.traversent ?? [])] })
    setEtatLocal(id)
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
        <LabsFixturesContext.Provider value={LABS_PAR_ETAT[etat]}>
```

par :

```tsx
        <LabsFixturesContext.Provider value={LABS_PAR_ETAT[etatDuPanneau(etat).etat]}>
```

- [ ] **Étape 10 : Relancer les tests**

```bash
npx vitest run tests/unit/matching-fil-demarrage.spec.ts tests/unit/banc-matching-e1.spec.ts tests/unit/jeton-arrivee.spec.tsx tests/unit/megga-x-crm-tokens.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/couleur-barreaux.spec.ts
```

Attendu : PASS, `Test Files  6 passed (6)`, `Tests  106 passed (106)`.

- [ ] **Étape 11 : Vérifier**

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx eslint --quiet src/components/matching-fil/filDemarrage.ts src/components/matching-fil/MatchingFirstRun.tsx src/components/matching-fil/MatchingFil.tsx src/hooks/useMatchingFil.ts src/hooks/useArrivee.ts src/lib/jetonArrivee.ts src/pages/agent/ContactsPage.tsx src/pages/agent/MatchingAtelierPage.tsx src/pages/dev/MatchingShowcasePage.tsx src/pages/dev/crmFixtures.ts src/pages/dev/CrmShowcasePage.tsx tests/unit/matching-fil-demarrage.spec.ts tests/unit/banc-matching-e1.spec.ts tests/unit/jeton-arrivee.spec.tsx tests/unit/megga-x-crm-tokens.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/couleur-barreaux.spec.ts
```

Attendu : aucune sortie. (Sans `--quiet`, aucun avertissement non plus, comme avant la tâche.)

```bash
npm run lint:deadcode
npm run lint:i18n
npm run i18n:parity:ci
npm run i18n:coverage:ci
npm run lint:prose
```

Attendu : `✓ Aucun export mort (baseline propre — dont 86 modules chargés en lazy, invisibles pour ts-prune).` (`ecranDuFil` est lu par le fil, `RecherchesAgence` par la lecture, `useRecherchesActives` par le fil ; `MatchingFirstRun` par le fil, l'atelier et son banc ; `useArrivee` aussi par la page Contacts) ; `✓ i18n garde-fou OK — 0 texte FR en dur sur les surfaces agent verrouillées (i18next/no-literal-string).` ; parité `0 manquante(s), 0 orpheline(s)` (les « possiblement non traduites » restent 1 860) ; couverture `✓ Aucune régression vs référence` (`matching` passe de 790 à 791 clés : les quatre des étapes `mandat.*` et `contact.*` cèdent la place à `acheteur.*` et `biens.*`, et `fil.vide.sansMatch` s'ajoute) ; `✓ Typographie MEGGA OK — 56 fichiers i18n, 0 tell.`

Les gardes de la grammaire, des polices, des couleurs, de la sortie vers l'acheteur, des redirections et des bancs, et les specs des bancs du matching :

```bash
npx vitest run tests/unit/megga-x-grammar.spec.ts tests/unit/megga-x-crm-tokens.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/redirection-ouverte.spec.ts tests/unit/dev-bancs-frontiere.spec.ts tests/unit/banc-matching-boucle.spec.ts tests/unit/banc-matching-d1.spec.ts tests/unit/banc-matching-e1.spec.ts tests/unit/banc-matching-explique.spec.ts
```

Attendu : PASS, `Test Files  10 passed (10)`, `Tests  116 passed (116)`. Les deux liens neufs visent un gabarit ancré (`redirection-ouverte`) et n'écrivent rien à l'acheteur (`matching-sans-sortie`) ; le banc du lot D1 ne bouge pas : un mandat vendu n'entre ni dans « Aujourd'hui », ni dans « Pendant ton absence ».

Les specs qui chargent ou lisent un fichier touché — le fil, sa boucle, ses liens et le jeton d'arrivée, « Sa boucle », les gestes, le copilote qui recopie le fil, les bancs et leur interception, les rôles des contacts et la page Contacts, les états vides, les polices, les contrastes et les feuilles de l'atelier, les listes et les globs i18n, la garde des redirections, le stockage, la pile d'onglets et l'écran caché :

```bash
npx vitest run tests/unit/banc-contacts-roles.spec.ts tests/unit/banc-matching-boucle.spec.ts tests/unit/banc-matching-d1.spec.ts tests/unit/banc-matching-e1.spec.ts tests/unit/banc-matching-explique.spec.ts tests/unit/banc-supabase.spec.ts tests/unit/deal-ouvert.spec.ts tests/unit/etat-vide.spec.ts tests/unit/fil-liens-arrivee.spec.ts tests/unit/i18n-globs-vivants.spec.ts tests/unit/i18n-listes.spec.ts tests/unit/jeton-arrivee.spec.tsx tests/unit/matching-atelier-css.spec.ts tests/unit/matching-contraste.spec.ts tests/unit/matching-criteres-explique.spec.ts tests/unit/matching-du-jour.spec.ts tests/unit/matching-fil-apprendre.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-demarrage.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-signaux.spec.ts tests/unit/matching-gestes-module.spec.ts tests/unit/matching-prospects.spec.ts tests/unit/matching-renotation.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/matching-whatsapp-sql.spec.ts tests/unit/megga-x-source-frontiere.spec.ts tests/unit/polices-domaines.spec.ts tests/unit/redirection-ouverte.spec.ts tests/unit/sa-boucle.spec.ts tests/unit/statut-clair.spec.ts tests/unit/stockage-inventaire.spec.ts tests/unit/whatsapp-matching-fil.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/megga-x-crm-tokens.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/dev-bancs-frontiere.spec.ts tests/unit/clavier-ecran-cache.spec.ts tests/unit/contacts-contraste.spec.ts tests/unit/contacts-note-contrat.spec.ts tests/unit/contacts-roles-vocabulaire.spec.ts tests/unit/contacts-roles.spec.ts tests/unit/crm-tabs-compte.spec.tsx tests/unit/crm-tabs.spec.ts
```

Attendu : PASS, `Test Files  45 passed (45)`, `Tests  788 passed (788)`.

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint` en parallèle) :

```bash
npx vitest run
```

Attendu : `Test Files  3 failed | 344 passed (347)`, `Tests  1 failed | 5277 passed | 3 skipped (5281)` ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`.

---

## Tâche 13 : La bascule — le fil en page 0 de Matching (conception §4.1, §4.3)

Mesuré : au bureau, `/dashboard/matching` rend `MatchingPage` (`App.tsx`, `ResponsiveRoute` ; au téléphone, `MobileMatchingPage`, que ce lot ne touche pas), un pager à deux pages dont la page 0 est, en production, l'atelier (`<MatchingAtelierPage embedded/>`), et dont l'ouverture est la Recherche (`atterrissage` vaut `'recherche'` par défaut, `LANDING_PAGE`). Le fil ne vit que sur le banc `/dev/crm`, qui le monte par l'emplacement `banc` et pose `atterrissage="score"` (`matchingFilBanc.tsx`). Conception §4.1 : en production, la page 0 est le fil et « Matching » s'ouvre sur lui ; la Recherche reste en page 1 ; chaque onglet garde sa dernière page vue (`useTabScopedState('pager')`) ; le banc garde ses emplacements. Le fil est monté comme le banc le monte — `<MatchingFil dark onOpenRecherche/>` : « Voir le marché » de ses états glisse vers la Recherche —, et `atterrissage` vaut le fil par défaut. `useTabScopedState` n'écrit rien tant que l'agent ne bouge pas le pager : un onglet qui n'a jamais changé de page s'ouvre sur le fil, un onglet resté sur la Recherche la retrouve, et une arrivée du fil (tâche 11) ramène toujours à la page 0. `LANDING_PAGE`, qui désignait la Recherche, devient `RECHERCHE_PAGE` : ce n'est plus la page d'arrivée.

L'atelier de bureau n'est plus monté : sa page n'a plus d'importeur, et `lint:deadcode` rougirait sur son export — elle part dans cette tâche (`git rm`). Rien d'autre ne meurt avec elle : tout ce qu'elle importait a un autre lecteur — `execReact`, `execRelance` et `useAtelierMatching` (l'écran mobile), `PendingRegistry` (le fil, le mobile), `AtelierGestes` et les types de l'atelier (le mobile, le banc de l'atelier), `AtelierStage` et `atelier.css` (ce banc, `/dev/matching-atelier`, derrière le ternaire DEV, qui part à la tâche 15), `MatchingFirstRun` (le fil, ce banc). Ce qui sort de la production : l'atelier et sa feuille quittent le bundle (mesuré au build : `MatchingPage-*.css` passe de 50,26 à 2,95 kB, `atl-stage` et `atl-embedded` n'y sont plus, le fil y entre), et le bureau n'appelle plus `scan-all` (le mobile, si). Restent sans lecteur sans qu'aucune porte le dise : la clé `matching:atelier.empty.scanError` (quatre langues — le ménage des clés est la tâche 16) et deux props d'`AtelierStage` que son banc ne passe pas, `emptyAction` et `onOpenContacts` (tâche 15). Les liens entrants (§4.3) : un lien sans paramètre ouvre le fil, ou la dernière page vue de l'onglet ; `?contact=` et les liens `lienFil` / `lienPlace` sont des arrivées — le pager rejoint la page 0, le fil lit la place (`lireArrivee`) ; `?annonce=` n'est plus écrit par personne (l'atelier l'écrivait pour lui-même, par `setSearchParams(…, { replace: true })`), et le fil lit toujours `p:`. Les commentaires qui décrivaient l'atelier en page 0, la bascule à venir, l'ouverture sur la Recherche ou la page de l'atelier comme lectrice de `?contact=` disent ce qui est.

Choix à valider : `atterrissage` garde sa valeur `'recherche'`, qu'aucun appelant ne passe plus, et le banc du fil garde `atterrissage="score"`, désormais la valeur par défaut — la conception nomme la prop ; la retirer, avec l'attribut du banc, reste un petit geste (le pager s'ouvrirait alors sur `SCORE_PAGE` sans condition) ; le banc de l'atelier (`/dev/matching-atelier`, sans `atterrissage`) s'ouvre désormais sur sa page 0, comme la production ; la spec neuve rend le pager pour de vrai — la vraie pile d'onglets, la coquille et les deux pages en témoins — plutôt que de lire son code : une lecture ne dirait pas que « Matching » s'ouvre sur le fil ; les commentaires corrigés débordent la liste de la tâche (`usePigeAcheteurs`, `useMatching`, `execReact`, `PageCatalogue` — retiré à la tâche 14 —, `AtelierStage`, `DealDetailPage`, `TodayPage`, `App.tsx`, « l'atelier actuel » des deux bancs), chacun parce qu'il devenait faux ; le point 2 de la doc de `MatchingPagerBanc` nomme encore `AtelierStage`, vrai tant que son banc vit (tâche 15).

**Fichiers :**
- Créer (tests) : `tests/unit/matching-pager.spec.tsx`
- Modifier (gardes) : `tests/unit/jeton-arrivee.spec.tsx`, `tests/unit/matching-sans-sortie.spec.ts`, `tests/unit/megga-x-grammar.spec.ts`
- Modifier (le pager) : `src/pages/agent/MatchingPage.tsx`
- Supprimer : `src/pages/agent/MatchingAtelierPage.tsx`
- Modifier (commentaires) : `src/App.tsx`, `src/components/matching-fil/MatchingFil.tsx`, `src/pages/agent/TodayPage.tsx`, `src/components/crm/today/PageCatalogue.tsx`, `src/pages/agent/DealDetailPage.tsx`, `src/hooks/usePigeAcheteurs.ts`, `src/hooks/useMatching.ts`, `src/lib/matchingGestes.ts`, `src/components/matching-atelier/AtelierStage.tsx`, `src/pages/dev/CrmShowcasePage.tsx`, `src/pages/dev/matchingFilBanc.tsx`

- [ ] **Étape 1 : Écrire les tests qui échouent**

Le pager rendu pour de vrai, sans `banc` : sa page 0 est le fil et il s'ouvre sur lui ; « Voir le marché » du fil mène à la Recherche ; l'onglet garde la Recherche d'un montage à l'autre ; un lien d'arrivée (`?contact=`) ramène au fil l'onglet resté sur la Recherche ; avec un `banc`, ses deux emplacements remplacent les pages. Les gardes qui nommaient la page de l'atelier la retirent : l'inventaire des liens d'arrivée (`SITES`), le périmètre « sans sortie », les deux listes de pages du cliquet de grammaire.

Créer `tests/unit/matching-pager.spec.tsx` :

```tsx
/**
 * Le pager de Matching au bureau (lot E1, conception `2026-09-27-matching-lot-e1-bureau-design.md` §4.1 et §4.3) : sa
 * page 0 est le FIL DE MATCHS, et « Matching » s'ouvre sur lui ; la Recherche reste en page 1.
 *
 * Ce que cette spec refuse :
 *   · une autre page 0 que le fil, en production (sans `banc`) ;
 *   · « Matching » ouvert sur la Recherche, sans arrivée ni page retenue par l'onglet ;
 *   · un fil dont « Voir le marché » ne mènerait pas à la Recherche (`onOpenRecherche`) ;
 *   · un onglet qui perdrait sa dernière page vue : la Recherche retenue l'emporte sur l'ouverture ;
 *   · un lien d'arrivée du fil (`?contact=`) qui laisserait l'onglet sur la Recherche ;
 *   · un banc qui perdrait ses emplacements : ses deux pages remplacent celles de la production.
 *
 * Le pager est monté pour de vrai — `createRoot` + `act`, le routeur mémoire et la VRAIE pile d'onglets
 * (`CrmTabsProvider`) sur un client Supabase simulé, comme `jeton-arrivee.spec.tsx`. La coquille du CRM et les deux
 * pages sont des témoins : ce qui est éprouvé, c'est ce que le pager monte, et la page qu'il montre — celle dont il ne
 * rend pas l'enveloppe inerte.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, createElement, useEffect, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom'
import { poserStockagesMemoire } from './helpers/stockage-memoire'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const h = vi.hoisted(() => ({ naviguer: null as null | NavigateFunction }))

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1' }, profile: { agency_id: 'ag-1' } }) }))

vi.mock('@/lib/supabase', () => {
  const chaine = {
    select: () => chaine,
    eq: () => chaine,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  }
  return { supabase: { from: () => chaine, rpc: async () => ({ data: { revision: 1, stale: false }, error: null }) } }
})

// La coquille du CRM — barre latérale, bande d'onglets : ici, elle ne rend que son contenu.
vi.mock('@/components/crm/CrmWorkspace', () => ({ default: ({ children }: { children: ReactNode }) => children }))

// Les deux pages de la production, en témoins. Le fil porte son « Voir le marché » : un bouton qui appelle
// `onOpenRecherche`.
vi.mock('@/components/matching-fil/MatchingFil', () => ({
  default: ({ onOpenRecherche }: { dark: boolean; onOpenRecherche?: () => void }) =>
    createElement('button', { type: 'button', 'data-temoin': 'fil', onClick: onOpenRecherche }),
}))
vi.mock('@/components/matching-recherche/MatchingRechercheHybride', () => ({
  default: () => createElement('div', { 'data-temoin': 'recherche' }),
}))

import { CrmTabsProvider } from '@/components/crm/CrmTabsProvider'
import { avecArrivee } from '@/lib/jetonArrivee'
import { ROUTER_FUTURE } from '@/lib/routerFuture'
import MatchingPage, { type MatchingPagerBanc } from '@/pages/agent/MatchingPage'

const FIL = '/dashboard/matching'

/** Les emplacements d'un banc, en témoins. Des composants de MODULE, comme l'exige `MatchingPagerBanc`. */
const BANC: MatchingPagerBanc = {
  Page0: () => <div data-temoin="banc-fil" />,
  Page1: () => <div data-temoin="banc-recherche" />,
}

let hote: HTMLDivElement | null = null
let racine: Root | null = null

async function rendre(arbre: ReactNode): Promise<void> {
  if (!racine) {
    hote = document.createElement('div')
    document.body.appendChild(hote)
    racine = createRoot(hote)
  }
  await act(async () => { racine!.render(arbre) })
}

function demonter(): void {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
}

function Pilote() {
  const navigate = useNavigate()
  useEffect(() => { h.naviguer = navigate })
  return null
}

/** Le pager sous sa pile d'onglets. `montage` le remonte dans le même onglet : un retour sur l'écran. */
function Arbre({ banc, montage = 0 }: { banc?: MatchingPagerBanc; montage?: number }) {
  return (
    <MemoryRouter initialEntries={[FIL]} future={ROUTER_FUTURE}>
      <CrmTabsProvider>
        <Pilote />
        <MatchingPage key={montage} banc={banc} />
      </CrmTabsProvider>
    </MemoryRouter>
  )
}

/** Les témoins des deux pages, dans l'ordre du pager. */
const temoins = (): (string | undefined)[] =>
  [...document.querySelectorAll<HTMLElement>('[data-temoin]')].map((t) => t.dataset.temoin)

/** La page montrée : la seule dont le pager ne rend pas l'enveloppe inerte. */
function pageMontree(): string | undefined {
  const vues = [...document.querySelectorAll<HTMLElement>('[data-temoin]')].filter((t) => !t.closest('[inert]'))
  return vues.length === 1 ? vues[0]!.dataset.temoin : undefined
}

/** « Voir le marché » du fil. */
async function voirLeMarche(): Promise<void> {
  await act(async () => { document.querySelector<HTMLElement>('[data-temoin="fil"]')!.click() })
}

beforeEach(() => {
  poserStockagesMemoire()
  h.naviguer = null
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  })
})

afterEach(() => demonter())

describe('le pager de Matching — le fil en page 0', () => {
  it('en production, la page 0 est le fil, et « Matching » s’ouvre sur lui', async () => {
    await rendre(<Arbre />)
    expect(temoins()).toEqual(['fil', 'recherche'])
    expect(pageMontree()).toBe('fil')
  })

  it('« Voir le marché » du fil mène à la Recherche, la page 1', async () => {
    await rendre(<Arbre />)
    await voirLeMarche()
    expect(pageMontree()).toBe('recherche')
  })

  it('l’onglet garde sa dernière page vue : revenu sur l’écran, il rouvre la Recherche', async () => {
    await rendre(<Arbre />)
    await voirLeMarche()
    await rendre(<Arbre montage={1} />)
    expect(pageMontree()).toBe('recherche')
  })

  it('un lien d’arrivée du fil (`?contact=`) ramène au fil l’onglet resté sur la Recherche', async () => {
    await rendre(<Arbre />)
    await voirLeMarche()
    await act(async () => { h.naviguer!(`${FIL}?contact=c7`, avecArrivee()) })
    expect(pageMontree()).toBe('fil')
  })

  it('le banc garde ses emplacements : ses deux pages remplacent celles de la production, et il s’ouvre sur la page 0', async () => {
    await rendre(<Arbre banc={BANC} />)
    expect(temoins()).toEqual(['banc-fil', 'banc-recherche'])
    expect(pageMontree()).toBe('banc-fil')
  })
})
```

Dans `tests/unit/jeton-arrivee.spec.tsx`, remplacer :

```tsx
    // « Ajouter un acheteur », la couverture de premier lancement : celle du fil, et celle de l'atelier tant qu'il est monté.
    'src/components/matching-fil/MatchingFil.tsx': 1,
```

par :

```tsx
    // « Ajouter un acheteur », la couverture de premier lancement du fil.
    'src/components/matching-fil/MatchingFil.tsx': 1,
```

Dans `tests/unit/jeton-arrivee.spec.tsx`, remplacer :

```tsx
    'src/pages/agent/ListingsPage.tsx': 1,
    'src/pages/agent/MatchingAtelierPage.tsx': 1,
    'src/pages/agent/NouveauBienPage.tsx': 1,
```

par :

```tsx
    'src/pages/agent/ListingsPage.tsx': 1,
    'src/pages/agent/NouveauBienPage.tsx': 1,
```

Dans `tests/unit/matching-sans-sortie.spec.ts`, remplacer :

```ts
  'src/pages/agent/MatchingPage.tsx',
  'src/pages/agent/MatchingAtelierPage.tsx',
  'src/pages/agent/ExternalListingDetailPage.tsx',
```

par :

```ts
  'src/pages/agent/MatchingPage.tsx',
  'src/pages/agent/ExternalListingDetailPage.tsx',
```

Dans `tests/unit/megga-x-grammar.spec.ts`, remplacer :

```ts
  // Le pager Matching et son conteneur d'atelier — les deux dernières surfaces
  // du périmètre bureau. `MatchingAtelierPage` était déjà propre (0 marqueur) ;
  // l'entrer quand même est ce qui empêche qu'il cesse de l'être.
  'MatchingPage.tsx', 'MatchingAtelierPage.tsx',
```

par :

```ts
  // Le pager Matching, dernière surface du périmètre bureau. (`MatchingAtelierPage`,
  // son conteneur d'atelier, en faisait partie ; il est parti avec l'atelier de
  // bureau le 27.09.2026 : le fil de matchs tient la page 0, lot E1.)
  'MatchingPage.tsx',
```

Dans `tests/unit/megga-x-grammar.spec.ts`, remplacer :

```ts
  'ContactDetailPage.tsx', 'ContactsPage.tsx',
  'MatchingPage.tsx', 'MatchingAtelierPage.tsx',
  'PipelinePage.tsx', 'DealDetailPage.tsx', 'OfferPage.tsx',
```

par :

```ts
  'ContactDetailPage.tsx', 'ContactsPage.tsx',
  'MatchingPage.tsx',
  'PipelinePage.tsx', 'DealDetailPage.tsx', 'OfferPage.tsx',
```

Dans `tests/unit/megga-x-grammar.spec.ts`, remplacer :

```ts
  // l'argument déjà écrit pour `MatchingAtelierPage` et `OfferPage`.
```

par :

```ts
  // l'argument déjà écrit pour `OfferPage`.
```

```bash
npx vitest run tests/unit/matching-pager.spec.tsx tests/unit/jeton-arrivee.spec.tsx tests/unit/megga-x-grammar.spec.ts tests/unit/matching-sans-sortie.spec.ts
```

Attendu : ÉCHEC, `Test Files  3 failed | 1 passed (4)`, `Tests  7 failed | 75 passed (82)`. Dans la spec neuve, quatre tests tombent sur `No QueryClient set, use QueryClientProvider to set one` (le pager monte encore la page de l'atelier, dont la lecture, `useAtelierMatching`, exige React Query) et le banc sur `expected 'banc-recherche' to be 'banc-fil'` (il s'ouvre encore sur la Recherche) ; `jeton-arrivee`, sur le lien de l'atelier (`+   "src/pages/agent/MatchingAtelierPage.tsx": 1,`) ; `megga-x-grammar`, sur `page hors du cliquet — l'entrer, ou écrire pourquoi : src/pages/agent/MatchingAtelierPage.tsx`. `matching-sans-sortie` reste vert : la page existe encore, elle n'est simplement plus lue.

- [ ] **Étape 2 : Le pager monte le fil et s'ouvre sur lui**

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
//   Page 0 → Atelier triptyque « par score » (MatchingAtelierPage embarqué)
```

par :

```tsx
//   Page 0 → le fil de matchs (MatchingFil), sur lequel « Matching » s'ouvre
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
//     butée : l'atelier a des colonnes scrollables (file d'acheteurs) — un scroll
//     léger défile la colonne, seul un geste franc bascule vers « Recherche ».
//   - clavier = PageUp/PageDown UNIQUEMENT (les flèches restent à l'atelier :
//     J/K/←/→ y déplacent la sélection ; seules `e` et `x` agissent).
```

par :

```tsx
//     butée : le fil a des colonnes scrollables (sa liste, son panneau) — un
//     scroll léger défile la colonne, seul un geste franc bascule vers « Recherche ».
//   - clavier = PageUp/PageDown UNIQUEMENT (les flèches restent au fil : ↑/↓ y
//     déplacent la sélection, ←/→ y changent d'onglet).
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
import MatchingAtelierPage from '@/pages/agent/MatchingAtelierPage'
```

par :

```tsx
import MatchingFil from '@/components/matching-fil/MatchingFil'
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
// Page d'atterrissage = « Recherche ». Les deux pages sont montées d'emblée, mais
// celle-ci était positionnée une hauteur d'écran plus bas et clippée : le marché
// connecté n'apparaissait qu'après un geste (molette / PageDown / point latéral).
// L'Atelier « par score » reste à un cran vers le haut. Index DÉRIVÉ (pas `1` en
// dur) pour ne pas atterrir sur la mauvaise page si l'ordre du pager change.
const LANDING_PAGE = Math.max(0, MATCHING_PAGES.findIndex((p) => p.id === 'recherche'))
// La page « par score » (page 0), où atterrit toute arrivée du fil. Index DÉRIVÉ, comme `LANDING_PAGE`.
const SCORE_PAGE = Math.max(0, MATCHING_PAGES.findIndex((p) => p.id === 'score'))
```

par :

```tsx
// La page du fil de matchs (page 0) : « Matching » s'ouvre sur elle, et toute arrivée du fil y atterrit. Index
// DÉRIVÉ (pas `0` en dur) pour ne pas atterrir sur la mauvaise page si l'ordre du pager change.
const SCORE_PAGE = Math.max(0, MATCHING_PAGES.findIndex((p) => p.id === 'score'))
// La page Recherche (page 1), qu'ouvre « Voir le marché » du fil. Index DÉRIVÉ, comme `SCORE_PAGE`.
const RECHERCHE_PAGE = Math.max(0, MATCHING_PAGES.findIndex((p) => p.id === 'recherche'))
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
/**
 * Contenus de substitution du banc `/dev/matching-atelier`, et rien d'autre.
 *
```

par :

```tsx
/**
 * Contenus de substitution des bancs `/dev/crm` et `/dev/matching-atelier` : ils y
 * injectent des données de démonstration, et rien d'autre.
 *
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
  { banc, atterrissage = 'recherche' }: {
    banc?: MatchingPagerBanc
    /**
     * Page d'arrivée sans pivot. « recherche » en production tant que l'atelier tient la page 0 ;
     * le banc du fil de matchs arrive sur « score » (lot 1). La bascule par défaut est au lot 3.
     */
    atterrissage?: 'score' | 'recherche'
```

par :

```tsx
  { banc, atterrissage = 'score' }: {
    banc?: MatchingPagerBanc
    /**
     * La page où « Matching » s'ouvre quand ni une arrivée ni l'onglet n'en demandent une :
     * le fil (« score ») par défaut.
     */
    atterrissage?: 'score' | 'recherche'
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
  // `?ligne=`, `?attente=`) cible la page 0 — on atterrit directement dessus
  // au lieu de la page Recherche (le param était ignoré et l'atelier hors écran).
  const [searchParams] = useSearchParams()
  const [pageStockee, setPage] = useTabScopedState('pager', atterrissage === 'score' ? SCORE_PAGE : LANDING_PAGE)
```

par :

```tsx
  // `?ligne=`, `?attente=`) cible la page 0, le fil — même dans un onglet resté
  // sur la Recherche. Sans arrivée, l'onglet rouvre la dernière page vue.
  const [searchParams] = useSearchParams()
  const [pageStockee, setPage] = useTabScopedState('pager', atterrissage === 'score' ? SCORE_PAGE : RECHERCHE_PAGE)
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
  // bas) : il doit démarrer sur la page d'atterrissage, sinon on verrait l'Atelier
  // une frame avant de glisser vers Recherche. ⚠ Il lit `page` : dans un onglet
  // rouvert, la page RETROUVÉE est celle qu'il faut poser d'emblée.
```

par :

```tsx
  // bas) : il doit démarrer sur la page montrée, sinon, dans un onglet resté sur la
  // Recherche, on verrait le fil une frame avant de glisser vers elle. ⚠ Il lit
  // `page` : dans un onglet rouvert, la page RETROUVÉE est celle qu'il faut poser
  // d'emblée.
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
  const openRecherche = useCallback(() => goTo(LANDING_PAGE), [goTo])
```

par :

```tsx
  const openRecherche = useCallback(() => goTo(RECHERCHE_PAGE), [goTo])
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
    // Ancêtre scrollable (colonne de l'atelier, overlay…) capable de défiler
```

par :

```tsx
    // Ancêtre scrollable (colonne du fil, overlay…) capable de défiler
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
    // Clavier : PageUp/PageDown UNIQUEMENT — les flèches restent à l'atelier.
```

par :

```tsx
    // Clavier : PageUp/PageDown UNIQUEMENT — les flèches restent au fil.
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
      <style>{`
        /* L'atelier (page 0) est un stage plein écran (position:fixed) : la classe
           .atl-embedded le rend absolu pour qu'il glisse avec le track du pager,
           embarqué dans le bento. */
        .matching-scroll-hint { opacity: .55; transition: opacity .35s ease; }
```

par :

```tsx
      <style>{`
        .matching-scroll-hint { opacity: .55; transition: opacity .35s ease; }
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
                  ⚠ Il ne couvre que les gestionnaires liés au FOCUS : un écouteur posé sur `window` (comme celui
                  de l'atelier) continue de recevoir toutes les touches, page inerte ou pas. */}
              <div inert={page !== 0} style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
                {banc
                  ? <banc.Page0 dark={dark} onOpenRecherche={openRecherche} />
                  : <MatchingAtelierPage embedded dark={dark} onOpenRecherche={openRecherche} />}
              </div>
```

par :

```tsx
                  ⚠ Il ne couvre que les gestionnaires liés au FOCUS : un écouteur posé sur `window` (comme le « / »
                  de la Recherche) continue de recevoir toutes les touches, page inerte ou pas. */}
              <div inert={page !== 0} style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
                {banc
                  ? <banc.Page0 dark={dark} onOpenRecherche={openRecherche} />
                  : <MatchingFil dark={dark} onOpenRecherche={openRecherche} />}
              </div>
```

- [ ] **Étape 3 : La page de l'atelier part**

Plus aucun fichier ne l'importe. Rien de ce qu'elle importait ne perd son dernier lecteur (voir l'introduction) ; son lien d'arrivée (`/dashboard/contacts?nouveau=1`) et son écriture de `?annonce=` partent avec elle.

```bash
git rm src/pages/agent/MatchingAtelierPage.tsx
```

- [ ] **Étape 4 : Les commentaires disent ce qui est**

Ceux qui décrivaient l'atelier en page 0, la bascule à venir, l'ouverture sur la Recherche, ou la page de l'atelier comme lectrice de `?contact=` et appelante des gestes.

Dans `src/App.tsx`, remplacer :

```tsx
  {/* Matching — pager vertical (refonte Claude Design juil. 2026) :
      page 0 = atelier triptyque « par score » · page 1 = recherche
      hybride du marché (vente + location). Deep-links portés par
      l'atelier : ?annonce=p:<id>|m:<id> · ?contact=<id>.
      Mobile (< 768px) : inbox acheteurs + focus. */}
```

par :

```tsx
  {/* Matching — pager vertical (refonte Claude Design juil. 2026) :
      page 0 = le fil de matchs, sur lequel « Matching » s'ouvre · page 1 =
      recherche hybride du marché (vente + location). Liens d'arrivée du
      fil (filLiens.ts) : ?contact=<id> · ?annonce=p:<id> · ?onglet= ·
      ?ligne= · ?attente=. Mobile (< 768px) : inbox acheteurs + focus. */}
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
 * Matching — le FIL DE MATCHS (refonte de la page 0 du pager : lots 1 et 2, puis la boucle, lot B).
 *
 * Conceptions : `docs/superpowers/specs/2026-09-17-matching-fil-design.md` et, pour la boucle,
 * `docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md`. Il remplacera l'atelier
 * (`MatchingAtelierPage`) au lot E ; d'ici là il ne vit que sur le banc `/dev/crm`.
```

par :

```tsx
 * Matching — le FIL DE MATCHS, la page 0 du pager de `/dashboard/matching` au bureau (`MatchingPage`), sur laquelle
 * « Matching » s'ouvre (lots 1 et 2, puis la boucle, lot B).
 *
 * Conceptions : `docs/superpowers/specs/2026-09-17-matching-fil-design.md`, pour la boucle
 * `docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md`, et pour le bureau
 * `docs/superpowers/specs/2026-09-27-matching-lot-e1-bureau-design.md`. Au téléphone, la route rend l'écran mobile
 * (`MobileMatchingPage`), qui ne monte pas le fil.
```

Dans `src/components/matching-fil/MatchingFil.tsx`, remplacer :

```tsx
  // Les liens d'arrivée (`filLiens.ts`, conception de D1 §4) : `?contact=` et `?annonce=p:<uuid>` — ceux de l'atelier,
  // qui gardent leur sens —, et `?onglet=`, `?ligne=<clé>`, `?attente=<contact>`. Une arrivée s'applique UNE fois par
  // navigation (`useArrivee`) : revenir sur l'onglet, un retour arrière, une éviction au-delà de six écrans vivants ou un
  // rechargement ne la rejouent pas ; un nouveau clic sur le même lien, si. ⛔ L'adresse n'est jamais réécrite.
```

par :

```tsx
  // Les liens d'arrivée (`filLiens.ts`, conception de D1 §4) : `?contact=` (le fil filtré sur l'acheteur),
  // `?annonce=p:<uuid>` (filtré sur le bien), `?onglet=`, `?ligne=<clé>`, `?attente=<contact>`. Une arrivée
  // s'applique UNE fois par navigation (`useArrivee`) : revenir sur l'onglet, un retour arrière, une éviction au-delà
  // de six écrans vivants ou un rechargement ne la rejouent pas ; un nouveau clic sur le même lien, si. ⛔ L'adresse
  // n'est jamais réécrite.
```

Dans `src/pages/agent/TodayPage.tsx`, remplacer :

```tsx
      // `?contact=` est le contrat que MatchingAtelierPage lit déjà pour
      // focaliser un acheteur — pas une globale posée avant la navigation.
```

par :

```tsx
      // `?contact=` est le contrat que le fil de matchs lit pour se filtrer
      // sur un acheteur — pas une globale posée avant la navigation.
```

Dans `src/components/crm/today/PageCatalogue.tsx`, remplacer :

```tsx
 * Ce que « Je l'ai proposé » lit d'un match du catalogue — la même forme que l'atelier et le fil
```

par :

```tsx
 * Ce que « Je l'ai proposé » lit d'un match du catalogue — la même forme que le fil et le mobile
```

Dans `src/components/crm/today/PageCatalogue.tsx`, remplacer :

```tsx
  // exécuteur que l'atelier, le fil et le mobile, donc le même journal (`match_propose`), le même
```

par :

```tsx
  // exécuteur que le fil et le mobile, donc le même journal (`match_propose`), le même
```

Dans `src/components/crm/today/PageCatalogue.tsx`, remplacer :

```tsx
  // (MatchingAtelierPage lit ce paramètre). Pas de globale `__sgaFocusBuyer`.
```

par :

```tsx
  // (le fil de matchs s'y filtre sur l'acheteur). Pas de globale `__sgaFocusBuyer`.
```

Dans `src/pages/agent/DealDetailPage.tsx`, remplacer :

```tsx
 * % calculé jamais stocké), « Transmettre » → /dashboard/matching?contact= (l'atelier
 * lit déjà ce param). Fix hérité de la V3 : le deep-link KYC utilise ?openContactId=
```

par :

```tsx
 * % calculé jamais stocké), « Transmettre » → /dashboard/matching?contact= (le fil de
 * matchs s'y filtre sur l'acheteur). Fix hérité de la V3 : le deep-link KYC utilise ?openContactId=
```

Dans `src/hooks/usePigeAcheteurs.ts`, remplacer :

```ts
 * l'ajout à la sélection d'un acheteur depuis cette Recherche même (`useAjouterSelection`), et chaque geste du FIL.
 * ⛔ Mais jusqu'au lot E, le pager de Matching monte l'ATELIER à côté de la Recherche, pas le fil (qui n'y vit qu'au
 * banc) — et l'atelier n'invalide pas `CLE_FIL` (`refresh` de `useAtelierMatching`) : un match écarté ou refusé dans
 * l'atelier ne change la pastille qu'à la prochaine relecture.
```

par :

```ts
 * l'ajout à la sélection d'un acheteur depuis cette Recherche même (`useAjouterSelection`), et chaque geste du FIL,
 * la page voisine de cette Recherche dans le pager de Matching.
```

Dans `src/hooks/useMatching.ts`, remplacer :

```ts
  // queryKeys car la page Atelier lit ['atelier-matches'] et useMatching ['matches'].
```

par :

```ts
  // queryKeys car l'écran mobile de Matching lit ['atelier-matches'] (`useAtelierMatching`) et
  // useMatching ['matches'].
```

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
 *  ⚠ Atelier et mobile seulement (inchangés au lot B) : le fil consigne par `execRepondre`, sans clore par
```

par :

```ts
 *  ⚠ L'écran mobile seulement (inchangé au lot B) : le fil consigne par `execRepondre`, sans clore par
```

Dans `src/components/matching-atelier/AtelierStage.tsx`, remplacer :

```tsx
// Séparé du conteneur (MatchingAtelierPage = données réelles + gestes Supabase ;
// /dev/matching-atelier = données mock du handoff + gestes stub) pour permettre
// la QA visuelle hi-fi sans session — même pattern que le portail vendeur
// (page de démo /dev). Toute la logique d'écran vit ici : onglets, recherche,
// sélection, sorties animées, undo, parking, modals, raccourcis clavier.
```

par :

```tsx
// Monté par son seul banc, /dev/matching-atelier (données mock du handoff +
// gestes stub) : la page 0 de Matching est le fil de matchs. Toute la logique
// d'écran vit ici : onglets, recherche, sélection, sorties animées, undo,
// parking, modals, raccourcis clavier.
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
// lectures traversent l'interception. L'atelier actuel garde son banc, `/dev/matching-atelier`.
```

par :

```tsx
// lectures traversent l'interception. L'atelier garde son banc, `/dev/matching-atelier`.
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
  // Le fil de matchs (refonte, lot 1) — l'atelier actuel reste sur `/dev/matching-atelier`.
```

par :

```tsx
  // Le fil de matchs (refonte, lot 1) — l'atelier reste sur `/dev/matching-atelier`.
```

Dans `src/pages/dev/matchingFilBanc.tsx`, remplacer :

```tsx
 * de fixtures du marché ici. L'atelier actuel garde son propre banc, `/dev/matching-atelier`.
```

par :

```tsx
 * de fixtures du marché ici. L'atelier garde son propre banc, `/dev/matching-atelier`.
```

- [ ] **Étape 5 : Relancer les tests**

```bash
npx vitest run tests/unit/matching-pager.spec.tsx tests/unit/jeton-arrivee.spec.tsx tests/unit/megga-x-grammar.spec.ts tests/unit/matching-sans-sortie.spec.ts
```

Attendu : PASS, `Test Files  4 passed (4)`, `Tests  82 passed (82)`. (Contrôles négatifs joués sur la spec neuve : `atterrissage = 'recherche'` par défaut fait tomber l'ouverture et le banc ; la page tenue dans un `useState` au lieu de l'onglet, le montage suivant ; un pager sourd aux arrivées, le lien `?contact=`.)

- [ ] **Étape 6 : Relever les liens entrants (§4.3)**

```bash
grep -rnE "[\`'\"]/dashboard/matching" src --include='*.ts' --include='*.tsx' | grep -vE "^[^:]+:[0-9]+:\s*(//|\*|/\*|\{/\*)"
grep -rnE "\.set\(\s*'annonce'|[?&]annonce=" src --include='*.ts' --include='*.tsx'
```

Attendu, pour le premier relevé — chaque lien atterrit comme le dit le tableau :

| Lien | Sites | Atterrit |
|---|---|---|
| Sans paramètre | barre latérale (`crmSidebarNav.ts:82`, que lit aussi le nouvel onglet), fiche d'un mandat (`ListingDetailPage.tsx:713`), retour de fiche d'annonce (`ExternalListingDetailPage.tsx:150`), Analytics (`AnalyticsPage.tsx:52`), KYC (`KycPage.tsx:118`), et les branches sans référence de `ContactsPage.tsx:150`, `DealDetailPage.tsx:560`, `TodayPage.tsx:134` et `:139` | Pas d'arrivée : le fil, ou la dernière page vue de l'onglet |
| `?contact=` | fiche contact (`ContactDetailPage.tsx:281`), liste des contacts (`ContactsPage.tsx:150`), deal (`DealDetailPage.tsx:560`), catalogue d'« Aujourd'hui » (`TodayPage.tsx:134`) | Arrivée à jeton : la page 0, le fil filtré sur l'acheteur |
| `lienFil` / `lienPlace` | « Aujourd'hui » (`TodayPage.tsx:139`), « Sa boucle » (`ContactDetailPage.tsx:284`), « Qui pour ce bien ? » (`ListingDetailPage.tsx:955`, `ExternalListingDetailPage.tsx:443`) | Arrivée à jeton : la page 0, la ligne, l'onglet ou la feuille (`lireArrivee`) |

Le reste des lignes relève du téléphone (`MobileContactDetailScreen.tsx:164`, `:166`, `routeMatchers.ts`), du copilote (`aiPanel.ts:271`, qui ne lit que le chemin) ou du banc (`CrmShowcasePage.tsx:193`). La lecture de chaque place par le fil est gardée par `fil-liens-arrivee.spec.ts`, le jeton de chaque lien par `jeton-arrivee.spec.tsx`. Pour le second relevé : six lignes, toutes des commentaires (`App.tsx`, `AtlCockpit.tsx`, `MatchingFil.tsx`, `filLiens.ts`, `jetonArrivee.ts`, `MatchingPage.tsx`) — plus aucun site n'écrit `?annonce=` (avant la tâche, `MatchingAtelierPage.tsx:172`, `next.set('annonce', key)`, était le seul).

- [ ] **Étape 7 : Vérifier**

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx eslint --quiet src/pages/agent/MatchingPage.tsx src/components/matching-fil/MatchingFil.tsx src/App.tsx src/pages/agent/TodayPage.tsx src/components/crm/today/PageCatalogue.tsx src/pages/agent/DealDetailPage.tsx src/hooks/usePigeAcheteurs.ts src/hooks/useMatching.ts src/lib/matchingGestes.ts src/components/matching-atelier/AtelierStage.tsx src/pages/dev/CrmShowcasePage.tsx src/pages/dev/matchingFilBanc.tsx tests/unit/matching-pager.spec.tsx tests/unit/jeton-arrivee.spec.tsx tests/unit/megga-x-grammar.spec.ts tests/unit/matching-sans-sortie.spec.ts
```

Attendu : aucune sortie. (Sans `--quiet`, 2 avertissements, tous deux préexistants dans `AtelierStage.tsx` — `react-hooks/set-state-in-effect`, lignes 123 et 154, 124 et 155 avant la tâche —, comme avant la tâche sur les mêmes fichiers.)

```bash
npm run lint:deadcode
npm run lint:i18n
npm run i18n:parity:ci
npm run i18n:coverage:ci
npm run lint:prose
```

Attendu : `✓ Aucun export mort (baseline propre — dont 86 modules chargés en lazy, invisibles pour ts-prune).` (la page de l'atelier partie, plus rien ne l'importe ; `MatchingFil` est lu par le pager et le banc) ; `✓ i18n garde-fou OK — 0 texte FR en dur sur les surfaces agent verrouillées (i18next/no-literal-string).` ; parité `0 manquante(s), 0 orpheline(s)` (les « possiblement non traduites » restent 1 860) ; couverture `✓ Aucune régression vs référence` ; `✓ Typographie MEGGA OK — 56 fichiers i18n, 0 tell.` Aucune clé n'est touchée : `matching:atelier.empty.scanError` perd son seul lecteur sans qu'aucune de ces portes le signale — son retrait, dans les quatre langues, appartient à la tâche 16.

Les gardes de la grammaire, des couleurs, de la sortie vers l'acheteur, du jeton, des bancs, et les specs des bancs du matching :

```bash
npx vitest run tests/unit/matching-pager.spec.tsx tests/unit/megga-x-grammar.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/jeton-arrivee.spec.tsx tests/unit/dev-bancs-frontiere.spec.ts tests/unit/banc-matching-boucle.spec.ts tests/unit/banc-matching-d1.spec.ts tests/unit/banc-matching-e1.spec.ts tests/unit/banc-matching-explique.spec.ts
```

Attendu : PASS, `Test Files  10 passed (10)`, `Tests  109 passed (109)`. Le cliquet de couleur de `src/pages/agent` ne bouge pas (3) : la page de l'atelier ne portait aucune couleur ; l'inventaire de grammaire de ce dossier non plus ({215, 762}) : elle ne portait aucun littéral.

Les specs qui chargent ou lisent un fichier touché — les contrastes et les feuilles de l'atelier, les bancs et leur interception, la pile d'onglets et l'écran caché, les fiches, le fil, ses liens et ses gestes, « Sa boucle », la Recherche et la pige, les redirections, les routes à jeton, le stockage, les listes et les globs i18n, les confrontations du copilote :

```bash
npx vitest run tests/unit/analytics-contraste.spec.ts tests/unit/banc-contacts-roles.spec.ts tests/unit/banc-supabase.spec.ts tests/unit/calendrier-libelles.spec.ts tests/unit/clavier-ecran-cache.spec.ts tests/unit/contacts-note-contrat.spec.ts tests/unit/deal-ouvert.spec.ts tests/unit/etat-vide.spec.ts tests/unit/fiche-planifier-visite.spec.ts tests/unit/fiche-qui-pour.spec.ts tests/unit/invite-link-origin-guard.spec.ts tests/unit/kyc-contraste.spec.ts tests/unit/kyc-magic-link-url.spec.ts tests/unit/labs-studio.spec.ts tests/unit/mail-oauth-popup.spec.ts tests/unit/matching-fil-demarrage.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/matching-gestes-module.spec.ts tests/unit/matching-whatsapp-sql.spec.ts tests/unit/megga-x-crm-tokens.spec.ts tests/unit/megga-x-source-frontiere.spec.ts tests/unit/messagerie-rattachement.spec.ts tests/unit/messagerie-spam-fil.spec.ts tests/unit/pipeline-contraste.spec.ts tests/unit/poussee-dock.spec.ts tests/unit/redirection-ouverte.spec.ts tests/unit/redirects-guard.spec.ts tests/unit/region-fonctions.spec.ts tests/unit/stockage-inventaire.spec.ts tests/unit/token-routes.spec.ts tests/unit/whatsapp-matching-fil.spec.ts tests/unit/matching-contraste.spec.ts tests/unit/matching-atelier-css.spec.ts tests/unit/fil-liens-arrivee.spec.ts tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-apprendre.spec.ts tests/unit/matching-fil-signaux.spec.ts tests/unit/matching-du-jour.spec.ts tests/unit/sa-boucle.spec.ts tests/unit/mrh-bouge.spec.tsx tests/unit/pige.spec.ts tests/unit/i18n-globs-vivants.spec.ts tests/unit/i18n-listes.spec.ts tests/unit/lazy-prechargeable.spec.tsx tests/unit/crm-tabs-compte.spec.tsx tests/unit/crm-tabs.spec.ts
```

Attendu : PASS, `Test Files  47 passed (47)`, `Tests  841 passed | 1 skipped (842)`.

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint` en parallèle) :

```bash
npx vitest run
```

Attendu : `Test Files  3 failed | 345 passed (348)`, `Tests  1 failed | 5282 passed | 3 skipped (5286)` ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`.

Enfin le bundle, qui doit se construire sans la page de l'atelier :

```bash
npm run build
grep -l "atl-stage" dist/assets/*.css
grep -l "atl-embedded" dist/assets/*.js
grep -l "fil.vide.sansMatch" dist/assets/MatchingPage-*.js
```

Attendu : le build sort à 0 (`✓ built in …`, puis le `postbuild` de la vitrine) ; les deux premiers relevés ne rendent rien — l'atelier et sa feuille ont quitté le bundle (avant la tâche, ils rendaient `MatchingPage-*.css` et `MatchingPage-*.js`) ; le troisième rend le seul chunk `dist/assets/MatchingPage-<empreinte>.js` : le fil y est. `MatchingPage-*.css` passe de 50,26 à 2,95 kB.

---

## Tâche 14 : « Aujourd'hui » à une page — le catalogue de matchs retiré (conception §4.4, §8)

Mesuré : `TodayPage` monte un pager à deux pages (`TODAY_PAGES`) — `PageAujourdhuiH`, puis le catalogue de matchs (`src/components/crm/today/PageCatalogue.tsx`, 1 047 lignes). Le catalogue dit faux et coûte : un refus y porte « Nouveau » (`tagKeyOf` rend `today.catalogue.status.new` pour tout statut qu'il ne nomme pas, `rejected` compris), la baisse de prix y vaut 0 en dur (`drop: 0`), et il lit tous les matchs de l'agence, descriptions comprises (`useMatching()` sans contact). Décision D1 de Julien : « le lot E remplace » le catalogue ; le segment Matching d'« Aujourd'hui » (lot D1) et le fil de matchs prennent le relais. Conception §4.4 : partent avec lui les points de page (`TodayPageDots`), l'indice de molette (`TodayScrollHint`), les changements de page à la molette, au clavier (↑/↓, PageUp/PageDown) et au toucher, leur verrou de 850 ms et le glissement du rail (`animateTo`), la page mémorisée de ce pager (`useTabScopedState('pager', 0)`), `Orbs` (`kit.tsx`, qui rendait `null`), `SEED_CATA` et la prop `demo` jamais passée, les clés `today.pager.*` et `today.catalogue.*` du namespace `dashboard` (79 clés par langue, quatre langues) et `goToPage` (`TodayNavContext`), que rien ne lisait déjà. Ce que le catalogue était seul à lire part aussi : les images clés `cat-*` du `<style>` de l'écran (`cat-overlay` et `cat-pop` animaient sa fiche détail ; `cat-page` n'animait plus rien) et la branche `?contact=` du cas `'matching'` de `onNavigate`, dont il était le seul appelant — l'inventaire des liens d'arrivée (`SITES`, `jeton-arrivee.spec.tsx`) passe de 3 à 2 pour `TodayPage`. Tout le reste a un autre lecteur et reste : `useMatching` (la fiche contact mobile), `PHOTO` (`FOCUS_QUEUE_DEMO`, le banc `/dev/crm`), `RXIcon`, `Av` et `Eyebrow` (la page, la session de relance), `EtatVide`, `useTodayNav`, `execProposer`, `refBienInterne` et `refAnnonceMarche` (le fil, le mobile, la fiche d'un mandat).

Ce que les écouteurs du pager faisaient d'autre, relu avant de les retirer : la molette ne défilait rien elle-même — un descendant capable de défiler (`canScrollNatively`) gardait son défilement natif, et ailleurs elle bloquait le défaut sur un écran qui ne défile pas (`100vh`, cadre en `overflow: hidden`) ; le clavier ne lisait `useEcranActifRef` que pour se taire écran caché, et avalait ↑/↓/PageUp/PageDown partout hors d'un champ de saisie ; le toucher ne faisait que paginer. Rien de ce qui reste n'en dépend : les deux écouteurs de `PageAujourdhuiH` (Échap du panneau « Pendant ton absence » et du popover d'un bloc) lisent `useEcranActif` eux-mêmes, la page n'a aucun descendant `position: fixed` que le rail (`will-change: transform`) aurait contenu, et les flèches retrouvent leur défilement natif. `clavier-ecran-cache.spec.ts` ne voit plus `TodayPage` (plus d'écouteur global) et reste vert. Les cliquets descendent aux comptes mesurés : `crm/today` {43,54} → {26,34}, `src/pages/agent` {215,762} → {211,758}, et les couleurs hors barreaux de `src/components/crm` 501 → 477. Les commentaires qui décrivaient le pager ou le catalogue disent ce qui est, jusqu'à l'en-tête de `MatchingPage`, qui se comparait au « pager Today ».

Choix à valider : le cas `'matching'` de `onNavigate` reste une destination simple (`/dashboard/matching`), comme `'pipeline'` — la table nomme chaque écran, appelant ou pas ; `useMatching` garde sa forme — les champs de `MatchResult` que seul le catalogue lisait (prénom et nom séparés, `source_id`, `transaction_type`, description, équipements…) restent, la fiche contact mobile, son dernier lecteur, construisant ce type et sa lecture ne bougeant pas en E1 (§7), et `TK.ok`, qui perd son seul lecteur, reste dans la palette ; les images clés `focus-ping`, `fmRise` et `m2pulse`, déjà sans lecteur avant la tâche et étrangères au catalogue, restent, comme deux phrases de l'en-tête de l'écran déjà fausses avant elle (l'ancien cockpit `PageAujourdhui` « qui reste au dépôt », « DONNÉES DÉMO »), qui ne parlent ni du pager ni du catalogue ; le rail donnait à la page son propre contexte d'empilement, et ses surcouches (z 30 à 80) rejoignent celui de l'écran sans qu'aucune `isolation` ne soit ajoutée — ce qui chevauche le cadre reste au-dessus d'elles (les menus et le compte de la bande d'onglets, portés dans `<body>` à 9000, l'avis de `CrmAvis` à 100, la recherche à 200), et la barre latérale et le dock ne le chevauchent pas ; la spec lit le code, l'écran n'ayant pas de spec de rendu.

**Fichiers :**
- Créer (tests) : `tests/unit/aujourdhui-une-page.spec.ts`
- Modifier (gardes) : `tests/unit/jeton-arrivee.spec.tsx`, `tests/unit/matching-sans-sortie.spec.ts`, `tests/unit/etat-vide.spec.ts`, `tests/unit/megga-x-grammar.spec.ts`, `tests/unit/couleur-barreaux.spec.ts`
- Modifier (l'écran) : `src/pages/agent/TodayPage.tsx`, `src/components/crm/today/TodayNavContext.tsx`
- Supprimer : `src/components/crm/today/PageCatalogue.tsx`
- Modifier (ce que le catalogue était seul à lire) : `src/components/crm/today/kit.tsx`, `src/i18n/locales/fr/dashboard.json`, `src/i18n/locales/de/dashboard.json`, `src/i18n/locales/en/dashboard.json`, `src/i18n/locales/it/dashboard.json`
- Modifier (commentaires) : `src/components/crm/today/PageAujourdhuiH.tsx`, `src/components/crm/today/HlMatching.tsx`, `src/components/crm/today/data.ts`, `src/hooks/useMatching.ts`, `src/pages/agent/MatchingPage.tsx`, `src/pages/dev/crmFixtures.ts`

- [ ] **Étape 1 : Écrire les tests qui échouent**

« Aujourd'hui » à une page, lu dans le code : une seule page montée, ni point de page ni indice de molette, aucune page retenue par l'onglet, aucun changement de page à la molette, au toucher ou aux touches de page, plus de `goToPage`, plus de catalogue, plus de clés `today.pager` ni `today.catalogue` dans les quatre langues. Les gardes suivent : l'inventaire des liens d'arrivée compte deux liens dans `TodayPage`, le périmètre « sans sortie » et la liste des surfaces qui passent par `EtatVide` perdent le catalogue, et les trois cliquets descendent aux comptes mesurés après la tâche.

Créer `tests/unit/aujourdhui-une-page.spec.ts` :

```ts
/**
 * « Aujourd'hui » à une page (lot E1, conception `2026-09-27-matching-lot-e1-bureau-design.md` §4.4 et §8). Le
 * catalogue de matchs, sa seconde page, est retiré : un refus y portait « Nouveau », la baisse de prix y valait 0 en dur,
 * et il chargeait tous les matchs de l'agence. Le segment Matching de la page (lot D1) et le fil de matchs en tiennent
 * lieu.
 *
 * Ce que cette spec refuse :
 *   · une seconde page montée par l'écran, ou le catalogue revenu ;
 *   · un point de page, un indice de molette, ou une page retenue par l'onglet (`useTabScopedState('pager')`) ;
 *   · un changement de page à la molette, au toucher ou aux touches de page (↑/↓, PageUp/PageDown) ;
 *   · `goToPage` dans le contexte de navigation de l'écran ;
 *   · les libellés du pager et du catalogue (`today.pager.*`, `today.catalogue.*`), dans l'une des quatre langues.
 *
 * Lecture du code, commentaires retirés : l'écran n'a pas de spec de rendu, et ce qu'on refuse ici est une structure
 * — des pages, des écouteurs, des clés —, pas un état.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const R = process.cwd()
const ECRAN = 'src/pages/agent/TodayPage.tsx'

/** Le code d'un fichier sans ses commentaires : ce qui compte est ce qu'il fait, pas ce qu'il raconte. */
function code(fichier: string): string {
  return readFileSync(join(R, fichier), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('« Aujourd’hui » à une page', () => {
  it('l’écran monte une seule page, celle du jour', () => {
    const c = code(ECRAN)
    const pages = [...c.matchAll(/from '@\/components\/crm\/today\/(Page\w*)'/g)].map((m) => m[1])
    expect(pages).toEqual(['PageAujourdhuiH'])
    expect(c.match(/<PageAujourdhuiH\b/g)).toHaveLength(1)
  })

  it('le catalogue de matchs n’existe plus', () => {
    expect(existsSync(join(R, 'src/components/crm/today/PageCatalogue.tsx'))).toBe(false)
  })

  it('ni point de page, ni indice de molette, ni page retenue par l’onglet', () => {
    const c = code(ECRAN)
    expect(c).not.toMatch(/\bTODAY_PAGES\b|\bTodayPageDots\b|\bTodayScrollHint\b/)
    expect(c).not.toMatch(/useTabScopedState\(\s*['"]pager['"]/)
  })

  it('ni la molette, ni le toucher, ni les touches de page ne changent de page', () => {
    const c = code(ECRAN)
    expect(c).not.toMatch(/addEventListener\(\s*['"](?:wheel|touchstart|touchmove)['"]/)
    expect(c).not.toMatch(/['"](?:PageUp|PageDown|ArrowUp|ArrowDown)['"]/)
  })

  it('le contexte de navigation de l’écran ne porte que `navigate`', () => {
    expect(code('src/components/crm/today/TodayNavContext.tsx')).not.toMatch(/\bgoToPage\b/)
    expect(code(ECRAN)).not.toMatch(/\bgoToPage\b/)
  })

  it.each(['fr', 'de', 'en', 'it'])('%s : ni les libellés du pager, ni ceux du catalogue', (langue) => {
    const { today } = JSON.parse(readFileSync(join(R, `src/i18n/locales/${langue}/dashboard.json`), 'utf8')) as {
      today: Record<string, unknown>
    }
    expect(Object.keys(today)).toContain('h')
    expect(Object.keys(today)).not.toContain('pager')
    expect(Object.keys(today)).not.toContain('catalogue')
  })
})
```

Dans `tests/unit/jeton-arrivee.spec.tsx`, remplacer :

```tsx
    'src/pages/agent/TodayPage.tsx': 3,
```

par :

```tsx
    'src/pages/agent/TodayPage.tsx': 2,
```

Dans `tests/unit/matching-sans-sortie.spec.ts`, remplacer :

```ts
  'src/pages/agent/ExternalListingDetailPage.tsx',
  'src/components/crm/today/PageCatalogue.tsx',
  'src/components/crm/today/useFocusMatches.ts',
```

par :

```ts
  'src/pages/agent/ExternalListingDetailPage.tsx',
  'src/components/crm/today/useFocusMatches.ts',
```

Dans `tests/unit/etat-vide.spec.ts`, remplacer :

```ts
      'src/components/crm/today/PageAujourdhuiH.tsx',
      'src/components/crm/today/PageCatalogue.tsx',
      'src/components/crm/pipeline/PipelineTimeline.tsx',
```

par :

```ts
      'src/components/crm/today/PageAujourdhuiH.tsx',
      'src/components/crm/pipeline/PipelineTimeline.tsx',
```

Dans `tests/unit/megga-x-grammar.spec.ts`, remplacer :

```ts
  // « Aujourd'hui », la page d'accueil du CRM (lot A1, 15 août 2026). Elle ne
  // porte que le pager et le chrome — les deux pages vivent dans `today/`.
  'TodayPage.tsx',
```

par :

```ts
  // « Aujourd'hui », la page d'accueil du CRM (lot A1, 15 août 2026). Elle ne
  // porte que le chrome et le cadre — sa page, unique, vit dans `today/`.
  'TodayPage.tsx',
```

Dans `tests/unit/megga-x-grammar.spec.ts`, remplacer :

```ts
  ['src/components/crm/today', { hors: 43, total: 54 }],
```

par :

```ts
  // {43,54} -> {26,34} (27.09.2026) : le catalogue de matchs (`PageCatalogue`) est retiré avec
  // ses littéraux — « Aujourd'hui » n'a plus qu'une page (lot E1).
  ['src/components/crm/today', { hors: 26, total: 34 }],
```

Dans `tests/unit/megga-x-grammar.spec.ts`, remplacer :

```ts
  // ⚠ 762 le 21.09.2026 : la fiche d'une annonce du marché perd son « Envoyer par e-mail » et son
  // historique d'envoi (le matching reste chez l'agent).
  ['src/pages/agent', { hors: 215, total: 762 }],
```

par :

```ts
  // ⚠ 762 le 21.09.2026 : la fiche d'une annonce du marché perd son « Envoyer par e-mail » et son
  // historique d'envoi (le matching reste chez l'agent).
  // 215/762 → 211/758 le 27.09.2026 : « Aujourd'hui » n'a plus qu'une page (lot E1) — ses points de
  // page et son indice de molette partent avec leurs quatre littéraux hors échelle (`gap: 10`,
  // `gap: 11`, `padding: 6`, `gap: 1`).
  ['src/pages/agent', { hors: 211, total: 758 }],
```

Dans `tests/unit/couleur-barreaux.spec.ts`, remplacer :

```ts
  // 502 → 501 le 23.09.2026 : le bleu des cartes de match (`MATCH: '#6F8CFF'`) quitte
  // « Dossiers » avec elles — les matchs vivent dans le segment Matching (lot D1).
  ['src/components/crm', 501],
```

par :

```ts
  // 502 → 501 le 23.09.2026 : le bleu des cartes de match (`MATCH: '#6F8CFF'`) quitte
  // « Dossiers » avec elles — les matchs vivent dans le segment Matching (lot D1).
  // 501 → 477 le 27.09.2026 : le catalogue de matchs d'« Aujourd'hui » (`PageCatalogue`)
  // est retiré avec ses vingt-quatre littéraux hors barreaux ; l'écran n'a plus qu'une page
  // (lot E1).
  ['src/components/crm', 477],
```

```bash
npx vitest run tests/unit/aujourdhui-une-page.spec.ts tests/unit/jeton-arrivee.spec.tsx tests/unit/megga-x-grammar.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/etat-vide.spec.ts
```

Attendu : ÉCHEC, `Test Files  4 failed | 2 passed (6)`, `Tests  12 failed | 84 passed (96)`. Les neuf tests de la spec neuve tombent (`expected [ 'PageAujourdhuiH', 'PageCatalogue' ] to deeply equal [ 'PageAujourdhuiH' ]`, le fichier du catalogue existe, `TODAY_PAGES`, l'écouteur de molette et `goToPage` sont là, et chaque langue porte encore `pager` et `catalogue`) ; `jeton-arrivee`, sur `"src/pages/agent/TodayPage.tsx": 3` ; `megga-x-grammar`, sur « aucune zone ne dépasse son inventaire de rayons et d'espacements » (`src/components/crm/today — hors échelle : 43 > 26 permis`, `total : 54 > 34`, `src/pages/agent — hors échelle : 215 > 211`, `total : 762 > 758`) ; `couleur-barreaux`, sur « aucune zone ne dépasse son inventaire de couleurs hors barreaux » (`src/components/crm : 501 > 477 permis`). `matching-sans-sortie` et `etat-vide` restent verts : leur liste ne fait que perdre une entrée encore présente.

- [ ] **Étape 2 : « Aujourd'hui » n'a plus qu'une page**

L'écran garde son chrome, son ambiance (`applyTK`), la table de `onNavigate` et son cadre bento ; il perd le pager entier — `TODAY_PAGES`, `TodayPageDots`, `TodayScrollHint`, la page tenue par l'onglet, le rail qui glissait (`animateTo`), les écouteurs de molette, de clavier et de toucher et leur verrou, `lightMode` (qui ne servait qu'aux points), les règles `.today-scroll-hint` / `.tsh-*` et les images clés `cat-*` de son `<style>` —, et la branche `?contact=` du cas `'matching'`. La transition d'ambiance perd son exclusion `:not([class*="tsh-"])` : plus aucun élément ne porte ces classes, et sa spécificité moindre ne change rien — les transitions qu'elle croise sont en ligne, en couche Tailwind ou en `!important`. La page est montée seule dans le cadre, qui la clippe à ses coins arrondis.

Remplacer tout le contenu de `src/pages/agent/TodayPage.tsx` par :

```tsx
// MEGGA CRM — Écran « Aujourd'hui » (refonte Claude Design, port fidèle).
//
// Page unique = « concept H » (handoff Today V2, 3 août 2026) — un seul bento :
// la journée + les dossiers/annonces + « Pendant ton absence ». Elle remplace
// l'ancien cockpit `PageAujourdhui`, qui reste au dépôt : c'est lui qui porte
// le câblage Supabase (useFocusQueue, agenda, pipeline, objectif) à reprendre
// au « Lot 0 » d'hydratation du concept H.
// Les matchs du jour s'y lisent dans le segment Matching, et se traitent dans le
// fil de matchs (`/dashboard/matching`). Chrome CRM standard (`CrmWorkspace`).
//
// ⚠️ Port VISUEL sur DONNÉES DÉMO (cf. ./today/data.ts). Le handoff prescrit
// « porter à l'identique d'abord, câbler ensuite » : le câblage live (Supabase)
// est la phase suivante.
//
// Porté de `crm-screen-today-proto.jsx` : applyTK(dark) « allume » l'ambiance du
// cockpit.

import { useNavigate } from 'react-router-dom'
import { crmPalette } from '@/components/crm/tokens'
import type { CrmScreenId } from '@/components/crm/CrmShell'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { TK, applyTK } from '@/components/crm/today/tk'
import { TodayNavProvider } from '@/components/crm/today/TodayNavContext'
import { PageAujourdhuiH } from '@/components/crm/today/PageAujourdhuiH'
import { useCrmDarkPref } from '@/lib/crmDark'
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
import { avecArrivee } from '@/lib/jetonArrivee'

export default function TodayPage() {
  const navigate = useNavigate()

  // ─── Theme: dark/light, tied to the icon-rail toggle ─────────────────
  const [dark, setDark] = useCrmDarkPref()

  const sp = crmPalette(dark)
  // « allume » / éteint tout le cockpit selon l'ambiance (singleton muté en place).
  applyTK(dark)

  // `ref` = identifiant réel porté par le payload (uuid). Les cibles « détail »
  // n'existent qu'avec lui : sans référence, on ouvre la LISTE correspondante
  // plutôt que de laisser un bouton sans effet.
  const onNavigate = (id: CrmScreenId | string, ref?: string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'contact-detail': navigate(ref ? `/dashboard/contacts/${ref}` : '/dashboard/contacts'); break
      case 'deal-detail': navigate(ref ? `/dashboard/transactions/${ref}` : '/dashboard/pipeline'); break
      case 'visite-detail': navigate(ref ? `/dashboard/visits/${ref}` : '/dashboard/calendar'); break
      case 'biens-detail': navigate(ref ? `/dashboard/listings/${ref}` : '/dashboard/listings'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      // Lot D1 : une place précise du fil (la requête de `lienFil`), et la fiche d'un mandat défilée jusqu'à « Qui pour
      // ce bien ? ». ⛔ Gabarits ANCRÉS (`/dashboard/…`) : `redirection-ouverte.spec.ts` refuse un puits dynamique.
      // Lot E1 : chaque arrivée porte un jeton neuf (`avecArrivee`) — l'écran l'applique une fois, un nouveau clic la
      // rejoue.
      case 'matching-fil': navigate(`/dashboard/matching${ref ? `?${ref}` : ''}`, ref ? avecArrivee() : undefined); break
      case 'biens-qui-pour': navigate(ref ? `/dashboard/listings/${ref}?${PARAM_QUI_POUR}=1` : '/dashboard/listings', ref ? avecArrivee() : undefined); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'messagerie': navigate('/dashboard/messagerie'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
        /* Pas de toast « à venir » — un bouton qui ne fait rien doit disparaître. */
    }
  }

  return (
    <TodayNavProvider value={{ navigate: onNavigate }}>
      <div className="today-proto-amb" style={{
        position: 'relative',
        background: TK.bg,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif',
        color: sp.ink,
      }}>
        <style>{`
          .today-proto-amb { transition: background-color .55s ease, color .45s ease; }
          .today-proto-amb *:not(button) {
            transition: background-color .55s ease, border-color .55s ease, color .45s ease, box-shadow .55s ease, fill .45s ease, stroke .45s ease;
          }
          @keyframes focus-ping { 0% { transform: scale(1); opacity: .7; } 75%, 100% { transform: scale(2.4); opacity: 0; } }
          @keyframes fmRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes m2pulse { 0% { transform: scale(1); opacity: .7; } 75%, 100% { transform: scale(2.2); opacity: 0; } }
        `}</style>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <CrmWorkspace active="today" sp={sp} dark={dark} setDark={setDark}>
          <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingTop: 'var(--crm-space-lg)', paddingLeft: 'var(--crm-space-lg)', paddingRight: 24, paddingBottom: 'var(--crm-space-6xl)' }}>
            {/* Le cadre bento — il clippe la page à ses coins arrondis */}
            <div style={{
              position: 'relative', height: '100%', overflow: 'hidden',
              /**
               * ⛔ CE CADRE N'AVAIT AUCUN FOND, et en CLAIR ça se voyait :
               * « pourquoi MEGGA AI est plus blanc que les autres ? » (Julien,
               * 20.09.2026). Il ne l'était pas — c'est CE cadre qui était plus
               * gris. Mesuré au rendu, les trois panneaux côte à côte : barre
               * latérale `#ffffff`, dock `#ffffff`, et celui-ci TRANSPARENT,
               * donc laissant voir le canvas `#f9f9f9`. ΔL* 2,07 d'écart, sur
               * 752 px de large — assez pour se lire comme un autre blanc.
               *
               * ⚠ En SOMBRE le défaut était invisible : `TK.frame` y vaut le
               * gris unique, donc transparent ou peint revenait au même. C'est
               * le clair, qui sépare par un palier, qui le révèle. Même famille
               * que les ombres noires sur l'ancien canvas.
               */
              background: TK.frame,
              // ⚠ `26` était un littéral hors échelle, et désaccordé de la carte
              // latérale comme du dock, qui rendent tous deux 20 px.
              borderRadius: 'var(--crm-radius-4xl)',
              border: `1px solid ${TK.border}`,
              boxShadow: TK.shadowLg,
            }}>
              <PageAujourdhuiH />
            </div>
          </main>
          </CrmWorkspace>
        </div>
      </div>
    </TodayNavProvider>
  )
}
```

`goToPage` n'avait déjà plus de lecteur ; il quitte le contexte de navigation de l'écran.

Dans `src/components/crm/today/TodayNavContext.tsx`, remplacer :

```tsx
// MEGGA CRM — Refonte « Aujourd'hui » · contexte de navigation du pager.
// Remplace les globales `window.__crmNavigate` / `window.__todayGoTo` du proto
// par un contexte React propre :
//   - navigate(id)   → navigation inter-écrans (ex. Agenda « Tout voir » → Calendrier)
//   - goToPage(i)    → pagination du pager (ex. Mode Focus → page Catalogue)
```

par :

```tsx
// MEGGA CRM — Refonte « Aujourd'hui » · contexte de navigation de l'écran.
// Remplace la globale `window.__crmNavigate` du proto par un contexte React
// propre : navigate(id) → navigation inter-écrans (ex. Agenda « Tout voir » →
// Calendrier).
```

Dans `src/components/crm/today/TodayNavContext.tsx`, remplacer :

```tsx
  navigate: (id: string, ref?: string) => void
  goToPage: (page: number) => void
}

const TodayNavContext = createContext<TodayNav>({
  navigate: () => {},
  goToPage: () => {},
})
```

par :

```tsx
  navigate: (id: string, ref?: string) => void
}

const TodayNavContext = createContext<TodayNav>({
  navigate: () => {},
})
```

- [ ] **Étape 3 : Le catalogue part, avec ce qu'il était seul à lire**

Plus rien n'importe le catalogue ; `SEED_CATA`, `CAT_META`, ses tuiles, sa fiche détail, sa galerie et son adaptateur de match partent avec le fichier.

```bash
git rm src/components/crm/today/PageCatalogue.tsx
```

`Orbs` n'avait que lui pour lecteur, et l'en-tête des atomes ne compte plus le catalogue parmi leurs consommateurs.

Dans `src/components/crm/today/kit.tsx`, remplacer :

```tsx
// Port des atomes de `today-redesign-kit.jsx`, réduits à ceux que les surfaces
// VIVANTES consomment : la page Aujourd'hui, le catalogue, la session de relance
// et le mobile. `Tile`, `TileHead` et `MoreLink` sont partis avec les tuiles de
// l'ancien cockpit, qu'elles seules servaient.
```

par :

```tsx
// Port des atomes de `today-redesign-kit.jsx`, réduits à ceux que les surfaces
// VIVANTES consomment : la page Aujourd'hui, la session de relance et le mobile.
// `Tile`, `TileHead` et `MoreLink` sont partis avec les tuiles de l'ancien
// cockpit, qu'elles seules servaient.
```

Dans `src/components/crm/today/kit.tsx`, remplacer :

```tsx
      {children}
    </div>
  )
}

// ─── Orbs de fond (lueur douce derrière le verre) — no-op fidèle ─────────
export function Orbs() {
  return null
}
```

par :

```tsx
      {children}
    </div>
  )
}
```

(Le fichier finit, comme avant, par une ligne vide.)

Les clés `today.pager.*` (lues par le seul pager) et `today.catalogue.*` (lues par le seul catalogue, `today.catalogue.advertiser.*` compris, composée dans le fichier même) partent des quatre langues — 79 clés, les lignes 226 à 342 de chaque `dashboard.json`. Aucune n'est composée ailleurs : sous `today.`, les seules clés composées du dépôt sont `today.tags.*`, `today.h.types.*`, `today.h.listings.*` et `today.reasons.criteria.*`. La commande réécrit chaque fichier par `JSON.stringify(…, null, 2)`, qui les rend à l'octet près (vérifié sur les quatre avant d'écrire) : seules ces lignes partent.

```bash
node -e '
const fs = require("fs")
for (const langue of ["fr", "de", "en", "it"]) {
  const f = `src/i18n/locales/${langue}/dashboard.json`
  const o = JSON.parse(fs.readFileSync(f, "utf8"))
  delete o.today.pager
  delete o.today.catalogue
  fs.writeFileSync(f, JSON.stringify(o, null, 2) + "\n")
}'
node -e 'for (const l of ["fr", "de", "en", "it"]) { const t = require(`./src/i18n/locales/${l}/dashboard.json`).today; console.log(l, Object.keys(t).length, "pager" in t, "catalogue" in t) }'
```

Attendu, pour la seconde commande : `fr 11 false false`, `de 11 false false`, `en 11 false false`, `it 11 false false` (treize sous-clés de `today` avant).

- [ ] **Étape 4 : Les commentaires disent ce qui est**

Ceux qui situaient la page dans un pager, citaient le catalogue comme lecteur, modèle ou référence, ou comparaient le pager de Matching à celui d'« Aujourd'hui ».

Dans `src/components/crm/today/PageAujourdhuiH.tsx`, remplacer :

```tsx
// Port 1:1 de `today-h-live.jsx` (handoff Today V2, 3 août 2026). Page 0 du
// pager Today, elle remplace l'ancien cockpit (`PageAujourdhui`).
```

par :

```tsx
// Port 1:1 de `today-h-live.jsx` (handoff Today V2, 3 août 2026). La page
// unique de l'écran Today, elle remplace l'ancien cockpit (`PageAujourdhui`).
```

Dans `src/components/crm/today/PageAujourdhuiH.tsx`, remplacer :

```tsx
// ne sont pas portés — même règle que le port du catalogue.
```

par :

```tsx
// ne sont pas portés.
```

Dans `src/components/crm/today/HlMatching.tsx`, remplacer :

```tsx
// plein de la fonte, qui ne dit pas « baisse ». Le catalogue du même cockpit marque déjà une baisse de prix ainsi.
```

par :

```tsx
// plein de la fonte, qui ne dit pas « baisse ».
```

Dans `src/components/crm/today/data.ts`, remplacer :

```ts
// ⛔ `PHOTO` ne sert que les données de démonstration : jamais de repli pour un
// bien réel sans photo (voir `CatImg`, PageCatalogue.tsx).
```

par :

```ts
// ⛔ `PHOTO` ne sert que les données de démonstration (`FOCUS_QUEUE_DEMO`, le
// banc `/dev/crm`) : jamais de repli pour un bien réel sans photo.
```

Dans `src/hooks/useMatching.ts`, remplacer :

```ts
     * sans ce champ, le catalogue les affichait sous « Prix de vente ».
```

par :

```ts
     * un prix lu sans ce champ passerait pour un prix de vente.
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
// Même grammaire que Today/Pipeline : un grand bento arrondi qui clippe 2 pages
// glissant en translateY.
//   Page 0 → le fil de matchs (MatchingFil), sur lequel « Matching » s'ouvre
//   Page 1 → Recherche hybride du marché connecté (vente + location)
// Molette / PageUp-PageDown / swipe tactile / points latéraux / indice bas.
//
// Différences avec le pager Today :
```

par :

```tsx
// Un grand bento arrondi qui clippe 2 pages glissant en translateY.
//   Page 0 → le fil de matchs (MatchingFil), sur lequel « Matching » s'ouvre
//   Page 1 → Recherche hybride du marché connecté (vente + location)
// Molette / PageUp-PageDown / swipe tactile / points latéraux / indice bas.
//
// Réglé pour le fil :
```

Dans `src/pages/dev/crmFixtures.ts`, remplacer :

```ts
 * `ANNONCE_MARCHE_BANC`, qui doit rester SANS photo (elle éprouve le repli du catalogue).
```

par :

```ts
 * `ANNONCE_MARCHE_BANC`, qui doit rester SANS photo (elle éprouve le repli d'un bien sans photo).
```

Dans `src/pages/dev/crmFixtures.ts`, remplacer :

```ts
  // Deux matchs pour la page « Catalogue » d'Aujourd'hui, et chacun éprouve un défaut
  // corrigé le 13.09.2026 : l'annonce de marché n'a AUCUNE photo (elle recevait celle
  // de Champel, et cinq intérieurs de stock dans sa galerie), le bien de l'agence n'en
  // a qu'UNE (le collage de la fiche la répétait trois fois).
  // ⚠ Les jointures (`contact`, `market_listing`, `property`) sont portées par la
```

par :

```ts
  // ⚠ Les jointures (`contact`, `market_listing`, `property`) sont portées par la
```

- [ ] **Étape 5 : Relancer les tests**

```bash
npx vitest run tests/unit/aujourdhui-une-page.spec.ts tests/unit/jeton-arrivee.spec.tsx tests/unit/megga-x-grammar.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/etat-vide.spec.ts
```

Attendu : PASS, `Test Files  6 passed (6)`, `Tests  96 passed (96)`. Les trois cliquets tombent pile sur leurs nouveaux comptes : le test « aucun crédit » de chacun reste vert.

- [ ] **Étape 6 : Relever ce qui menait au catalogue ou à « la page 2 »**

```bash
grep -rn "goToPage\|PageCatalogue\|today\.pager\|today\.catalogue\|TODAY_PAGES\|\bOrbs\b" src tests --include='*.ts' --include='*.tsx' --include='*.json'
grep -rn -i "catalogue" src/components/crm/today src/pages/agent src/hooks/useMatching.ts src/pages/dev/crmFixtures.ts src/components/propertyx/MEIcon.tsx
```

Attendu, pour le premier relevé, treize lignes et aucune autre : `ContactsPager.tsx:895` et les quatre `contacts.json` (la clé `pager.goToPage` des Contacts, un autre namespace), six lignes de `tests/unit/aujourdhui-une-page.spec.ts` (son en-tête, le chemin du catalogue, ses motifs) et les deux notes de cliquet (`couleur-barreaux.spec.ts:162`, `megga-x-grammar.spec.ts:1045`). Pour le second, six lignes, dont aucune ne parle du catalogue d'« Aujourd'hui » au présent : `SettingsPage.tsx:34` (le catalogue d'aide), `MEIcon.tsx:102` (le catalogue d'icônes) et `:147` — provenance datée de deux glyphes, « ajoutés pour la refonte « Aujourd'hui » », laissée —, et `crmFixtures.ts:578`, `:850`, `:960` (le catalogue de « Mes biens »).

- [ ] **Étape 7 : Vérifier**

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx eslint --quiet src/pages/agent/TodayPage.tsx src/components/crm/today/TodayNavContext.tsx src/components/crm/today/kit.tsx src/components/crm/today/data.ts src/components/crm/today/PageAujourdhuiH.tsx src/components/crm/today/HlMatching.tsx src/hooks/useMatching.ts src/pages/agent/MatchingPage.tsx src/pages/dev/crmFixtures.ts tests/unit/aujourdhui-une-page.spec.ts tests/unit/jeton-arrivee.spec.tsx tests/unit/matching-sans-sortie.spec.ts tests/unit/etat-vide.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/couleur-barreaux.spec.ts
```

Attendu : aucune sortie (sans `--quiet` non plus : aucun avertissement, comme avant la tâche sur les mêmes fichiers).

```bash
npm run lint:deadcode
npm run lint:i18n
npm run i18n:parity:ci
npm run i18n:coverage:ci
npm run lint:prose
```

Attendu : `✓ Aucun export mort (baseline propre — dont 86 modules chargés en lazy, invisibles pour ts-prune).` (`Orbs` parti, plus rien ne l'aurait lu ; `useTodayNav` et `TodayNavProvider` gardent leurs lecteurs) ; `✓ i18n garde-fou OK — 0 texte FR en dur sur les surfaces agent verrouillées (i18next/no-literal-string).` ; parité `0 manquante(s), 0 orpheline(s), 1836 possiblement non traduite(s)` (1 860 avant : vingt-quatre valeurs identiques au français partent avec les clés) ; couverture `✓ Aucune régression vs référence` — `dashboard` passe de 593 à 514 clés en DE comme en IT, ses non-traduites restent 5 et 4 ; la référence n'est pas refigée ici : le cliquet ne rougit qu'à une hausse, et la figer (`npm run i18n:coverage:update`) revient à la fin du lot, comme le dit l'en-tête du script ; `✓ Typographie MEGGA OK — 56 fichiers i18n, 0 tell.`

Les gardes de l'écran, du clavier, de la grammaire, des couleurs, de la sortie vers l'acheteur, de l'état vide et du jeton :

```bash
npx vitest run tests/unit/aujourdhui-une-page.spec.ts tests/unit/clavier-ecran-cache.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/etat-vide.spec.ts tests/unit/jeton-arrivee.spec.tsx tests/unit/couleur-barreaux.spec.ts
```

Attendu : PASS, `Test Files  7 passed (7)`, `Tests  98 passed (98)`. `clavier-ecran-cache` ne compte plus `TodayPage` parmi les écouteurs globaux, et son contrôle positif (plus de trente fichiers) tient.

Les specs d'« Aujourd'hui » (`grep -rl "today" tests/unit`), et celles qui chargent ou lisent un fichier touché — le pager de Matching, les redirections, les polices, les bancs et leur interception, les listes et les globs i18n, les jetons et les palettes, le stockage :

```bash
npx vitest run tests/unit/absence-signaux.spec.ts tests/unit/admin-compteurs-courrier.spec.ts tests/unit/audit-journal-lignes.spec.ts tests/unit/aujourdhui-une-page.spec.ts tests/unit/banc-matching-d1.spec.ts tests/unit/calendar-palette.spec.ts tests/unit/calendrier-series-ecrans.spec.tsx tests/unit/couleur-barreaux.spec.ts tests/unit/etat-vide.spec.ts tests/unit/focus-audit.spec.ts tests/unit/focus-score.spec.ts tests/unit/graphite-scale.spec.ts tests/unit/matching-du-jour.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/nouvel-onglet.spec.ts tests/unit/today-h-day.spec.ts tests/unit/useAgencyIdentity.spec.ts tests/unit/whatsapp-matching-fil.spec.ts tests/unit/jeton-arrivee.spec.tsx tests/unit/clavier-ecran-cache.spec.ts tests/unit/matching-pager.spec.tsx tests/unit/redirection-ouverte.spec.ts tests/unit/polices-domaines.spec.ts tests/unit/dev-bancs-frontiere.spec.ts tests/unit/banc-supabase.spec.ts tests/unit/banc-matching-boucle.spec.ts tests/unit/banc-matching-e1.spec.ts tests/unit/banc-matching-explique.spec.ts tests/unit/banc-contacts-roles.spec.ts tests/unit/i18n-globs-vivants.spec.ts tests/unit/i18n-listes.spec.ts tests/unit/statut-clair.spec.ts tests/unit/megga-x-crm-tokens.spec.ts tests/unit/mobile-palette.spec.ts tests/unit/lazy-prechargeable.spec.tsx tests/unit/stockage-inventaire.spec.ts
```

Attendu : PASS, `Test Files  37 passed (37)`, `Tests  591 passed (591)`.

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint` en parallèle) :

```bash
npx vitest run
```

Attendu : `Test Files  3 failed | 346 passed (349)`, `Tests  1 failed | 5291 passed | 3 skipped (5295)` ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`.

Enfin le bundle, qui doit se construire sans le catalogue :

```bash
npm run build
grep -l "Catalogue de matchs" dist/assets/*.js
grep -c "today-scroll-hint\|cat-overlay\|goToPage" dist/assets/TodayPage-*.js
grep -l "Démarrer la session" dist/assets/*.js
```

Attendu : le build sort à 0 (`✓ built in …`, puis le `postbuild` de la vitrine) ; le premier relevé ne rend rien — les textes du catalogue ont quitté le bundle (avant la tâche, il rendait `dist/assets/i18n-<empreinte>.js`) ; le second rend `0` ; le troisième, témoin que les textes de ce namespace vivent bien dans ce chunk, rend `dist/assets/i18n-<empreinte>.js`. Le chunk `TodayPage-*.js` passe de 122,97 à 68,92 kB, `i18n-*.js` de 356,46 à 354,04 kB.

---

## Tâche 15 : Le retrait de l'atelier de bureau (conception §6.1, §6.2, §6.4 ; relogement A)

Mesuré, après les tâches 1 à 14 : la page de l'atelier de bureau est partie (tâche 13), mais son dossier, `src/components/matching-atelier/`, porte encore seize fichiers. Douze ne servent plus que son banc, `/dev/matching-atelier` (`MatchingShowcasePage.tsx` et `matchingAtelierFixtures.ts`, derrière le ternaire DEV d'`App.tsx`) : les dix composants de l'écran (`AtelierStage`, `AtlAcheteurMode`, `AtlAnnonceVue`, `AtlCockpit`, `AtlConfirm`, `AtlEmptyState`, `AtlListing`, `AtlOverlayHost`, `AtlQueue`, `AtlWhy`), `constants.ts` et `atelier.css`. Quatre ont d'autres lecteurs : `AtlIcon` (la Recherche, par `RechIcon`), `types.ts`, `format.ts` et `composeAiHint.ts` (l'écran mobile et sa lecture, `useAtelierMatching`). Conception §6 (relogement A, décidé par Julien) : l'atelier de bureau part avec son banc, ce qui survit rejoint son lecteur, et le dossier disparaît ; la garde i18n vise le fil à sa place ; les gardes à chemins en dur suivent.

Ce qui part : les douze fichiers, le banc et sa route, et `matching-atelier-css.spec.ts`, qui ne gardait que la feuille. Ce qui se reloge : `AtlIcon` devient `matching-recherche/MrhIcon.tsx` — le préfixe de son nouveau dossier (`MrhCard`, `MrhPhoto`…) pour ce qu'il est, le rendu des icônes de la Recherche, que `RechIcon` traduit depuis les noms du proto ; `types.ts`, `format.ts` et `composeAiHint.ts` rejoignent l'écran mobile (`crm-mobile/matching/`), dont les trois fichiers qui les lisent ne changent que leurs imports ; `AtelierGestes`, que seul `MmMatchingScreen` lit encore, quitte la file d'annulation pour les types du mobile ; `useAtelierMatching` ne rend plus `pivotByKey` ni `defaultPivotKey`, que seule la page de l'atelier lisait, et son en-tête dit qu'il est la lecture du mobile, retirée au lot E2. Ce que le retrait laisse sans lecteur part avec lui (conception §3.4) : `TriageKind`, `atlFmtCHF`, `atlScoreColor`, `atlInitials`, l'export de `fmtM` (lu par son seul module), la prop `sw` de l'icône (seul `AtlCockpit` la passait : le trait se fixe à 1,6, `TRAIT`) et l'emplacement `Chrome` du pager (`MatchingPagerBanc`), que seul le banc de l'atelier remplissait. ⚠ Ce banc était aussi le SEUL des quatre états de démonstration de la Recherche (`MrhDemoEtat` : annonces, aucune, échec, requête bloquée) : ils rejoignent, AVANT son retrait, le banc `/dev/crm` — une ligne « Recherche » dans son menu, sur la surface Matching, dont l'état passe à la page de démonstration (`matchingFilBanc`) par un contexte, `RechercheDuBanc`, dans son propre module (la table des routes du banc est hissée, et `matchingFilBanc` se charge en différé). Ce ne sont pas les états de l'interception : la Recherche du banc n'en lit rien, et « Requête bloquée » n'a d'équivalent ni dans Nominal, ni dans Vide, Sans match ou Échec. Le préfixe de console `[atelier]` des gestes devient `[matching]` — trois dans `matchingGestes.ts`, un dans la file d'annulation. La garde i18n vise `matching-fil` à la place de `matching-atelier` dans `eslint.config.js`, `scripts/lint-i18n-hardcoded.mjs` et le scanner `scripts/i18n-scan.mjs` : `i18n-globs-vivants.spec.ts`, qui lit les deux listes, rougit au retrait (glob mort, des deux côtés) et verdit à la bascule ; le fil n'a aucun littéral que la règle signale (`lint:i18n` vert ; contrôle négatif joué : un texte en dur glissé dans `FilOnglets` la fait rougir). Les gardes à chemins en dur suivent : `matching-sans-sortie`, `megga-x-grammar` (zone retirée, inventaire des feuilles vide, `src/components/matching-fil` prend la place de l'atelier parmi les racines acquises), `couleur-barreaux` (zone retirée ; `src/pages/dev` 26 → 22, les quatre teintes d'avatar des fixtures du banc), `dev-bancs-frontiere`, `etat-vide` ; `matching-contraste` est recentrée sur la Recherche (la feuille et les initiales d'avatar de l'atelier parties, onze tests → cinq) ; la spec de base de la boucle devient `matching-gestes-contrat.spec.ts`, pour ce qu'elle éprouve. Les commentaires qui nommaient l'atelier vivant disent ce qui est ; restent, parce qu'ils disent vrai, le nom `useAtelierMatching` et sa clé `atelier-matches` (la lecture du mobile, lot E2), le « contrat Atelier » des cinq raisons du moteur, la « convention Atelier » d'`actor_id`, les récits datés des gardes et les clés `matching:atelier.*` que le mobile lit encore. Rien ne change pour l'écran mobile hors ses imports, ni pour le fil, ni pour la Recherche hors son import d'icône et des commentaires. Le banc était déjà hors du bundle (ternaire DEV) : `MatchingPage-*.js` passe de 181,18 à 181,14 kB (l'emplacement `Chrome`), `MobileMatchingPage-*.js` de 48,50 à 48,34 kB. Cent vingt-deux clés de `matching` (feuilles françaises, pluriels comptés) perdent leur dernier lecteur : leur retrait est la tâche 16 ; `tabs.*` reste lu par le mobile (`` t(`tabs.${f}`) ``), `aiHint.*` par `composeAiHint`.

Choix à valider : le banc des états de la Recherche est une ligne « Recherche » du menu de `/dev/crm`, montrée sur la surface Matching et indépendante des états de l'interception (aucun ne vaut « requête bloquée ») — plutôt qu'un second panneau flottant, que Julien avait écarté de ce banc (« il me gâche la vue ») ; l'emplacement `Chrome` du pager part, aucun banc ne le remplissant plus ; `AtlIcon` devient `MrhIcon` et perd `sw`, mais garde ses glyphes `lift` et `tag`, déjà sans lecteur avant la tâche (le retrait ne les tue pas) ; `composeAiHint` et `fmtBudgetRange` sont relogés comme le veut la conception, mais ce qu'ils produisent (`AtelierBuyer.ai`, `AtelierBuyer.budget`) n'est affiché par aucun écran — l'écran mobile ne lit pas ces champs ; la carte MEGGA AI du mode « Par acheteur » de l'atelier montrait le premier, le second n'avait déjà plus de lecteur — : ils restent avec le contrat de données du mobile jusqu'au lot E2, et leurs en-têtes le disent (les retirer dès E1 toucherait ce contrat, que §7 gèle) ; `matching-contraste` perd le test de la palette d'avatar (`AV_PALETTE`, lisible sous l'encre DÉRIVÉE) : plus aucun écran ne dérive cette encre — le mobile peint ces teintes sous un blanc figé (`MmBuyerCard`, `MmFocus`), 1,88 à 4,39:1 d'après la mesure du test retiré, une dette du lot E2 ; le préfixe `[atelier]` de la file d'annulation suit ceux des gestes ; `i18n-globs-vivants.spec.ts` ne change pas — il n'a pas de liste à lui, il lit les deux autres, et c'est la spec neuve qui fige la présence du fil ; la spec de base est renommée avec son `describe`, ses libellés de données (« Atelier QA ») restent ; le scanner garde ses cinq autres dossiers déjà absents (un rapport, pas une porte).

**Fichiers :**
- Créer (tests) : `tests/unit/matching-atelier-retire.spec.ts`
- Créer (banc) : `src/pages/dev/rechercheDuBanc.ts`
- Modifier (tests) : `tests/unit/matching-fil-gestes.spec.ts`, `tests/unit/ajouter-selection.spec.tsx`
- Modifier (le banc `/dev/crm`) : `src/pages/dev/CrmShowcasePage.tsx`, `src/pages/dev/matchingFilBanc.tsx`, `src/components/matching-recherche/mrhDemo.ts`, `src/components/matching-recherche/MatchingRechercheHybride.tsx`
- Supprimer : `src/components/matching-atelier/AtelierStage.tsx`, `src/components/matching-atelier/AtlAcheteurMode.tsx`, `src/components/matching-atelier/AtlAnnonceVue.tsx`, `src/components/matching-atelier/AtlCockpit.tsx`, `src/components/matching-atelier/AtlConfirm.tsx`, `src/components/matching-atelier/AtlEmptyState.tsx`, `src/components/matching-atelier/AtlListing.tsx`, `src/components/matching-atelier/AtlOverlayHost.tsx`, `src/components/matching-atelier/AtlQueue.tsx`, `src/components/matching-atelier/AtlWhy.tsx`, `src/components/matching-atelier/constants.ts`, `src/components/matching-atelier/atelier.css`, `src/pages/dev/MatchingShowcasePage.tsx`, `src/pages/dev/matchingAtelierFixtures.ts`, `tests/unit/matching-atelier-css.spec.ts`
- Modifier (la route, le pager) : `src/App.tsx`, `src/pages/agent/MatchingPage.tsx`
- Déplacer : `src/components/matching-atelier/AtlIcon.tsx` → `src/components/matching-recherche/MrhIcon.tsx` ; `src/components/matching-atelier/types.ts`, `format.ts`, `composeAiHint.ts` → `src/components/crm-mobile/matching/` ; `tests/backend/atelier-matching-loop.spec.ts` → `tests/backend/matching-gestes-contrat.spec.ts`
- Modifier (les lecteurs de ce qui survit) : `src/components/matching-recherche/RechIcon.tsx`, `src/components/matching-recherche/MrhCard.tsx`, `src/components/crm-mobile/matching/MmMatchingScreen.tsx`, `src/components/crm-mobile/matching/MmKyc.tsx`, `src/components/crm-mobile/matching/vm.ts`, `src/hooks/useAtelierMatching.ts`, `src/lib/matchingAnnulation.ts`
- Modifier (la garde i18n) : `eslint.config.js`, `scripts/lint-i18n-hardcoded.mjs`, `scripts/i18n-scan.mjs`
- Modifier (gardes) : `tests/unit/matching-contraste.spec.ts`, `tests/unit/matching-sans-sortie.spec.ts`, `tests/unit/megga-x-grammar.spec.ts`, `tests/unit/couleur-barreaux.spec.ts`, `tests/unit/dev-bancs-frontiere.spec.ts`, `tests/unit/etat-vide.spec.ts`
- Modifier (le préfixe de console) : `src/lib/matchingGestes.ts`, `src/lib/matchingAnnulation.ts`
- Modifier (commentaires) : `src/components/matching-recherche/MatchingRechercheHybride.tsx`, `src/hooks/useAjouterSelection.ts`, `src/hooks/useMatchingFil.ts`, `src/hooks/useQuiPourCeBien.ts`, `src/components/matching-fil/filModele.ts`, `src/lib/matchingGestes.ts`, `src/lib/modaleOuverte.ts`, `src/components/matching-recherche/mrhCtx.ts`, `src/components/matching-recherche/MrhExtDetail.tsx`, `src/components/ui/VerifiedSeal.tsx`, `src/pages/dev/PipelineShowcasePage.tsx`, `src/pages/dev/ModalesShowcasePage.tsx`, `supabase/functions/matching-engine/index.ts`

- [ ] **Étape 1 : Écrire les tests qui échouent**

Le retrait, lu dans le code : le dossier n'existe plus ; aucun fichier de `src/` ne le nomme — ni import, ni renvoi vers son banc — et aucune spec ne l'importe ; le banc, ses fixtures et sa route sont partis ; les quatre états de démonstration de la Recherche se choisissent au menu de `/dev/crm` et la Recherche de ce banc lit l'état choisi ; la garde i18n et le scanner visent le fil, plus l'atelier. La spec des gestes attend le préfixe `[matching]`, et deux titres de test cessent de nommer l'atelier.

Créer `tests/unit/matching-atelier-retire.spec.ts` :

```ts
/**
 * L'atelier de bureau est retiré (lot E1, conception `2026-09-27-matching-lot-e1-bureau-design.md` §6) : le fil de
 * matchs tient la page 0 de Matching, et ce qui survit de l'atelier a rejoint son lecteur (§6.2) — son icône la
 * Recherche, ses types, ses formats et sa phrase MEGGA AI l'écran mobile.
 *
 * Ce que cette spec refuse :
 *   · le dossier `src/components/matching-atelier/`, revenu sous ce nom ;
 *   · un fichier de `src/` qui le nomme encore — un import, ou un renvoi vers son banc —, ou une spec qui l'importe ;
 *   · le banc de l'atelier (`/dev/matching-atelier`) : sa page, ses fixtures, sa route ;
 *   · un état de démonstration de la Recherche sans banc — l'atelier était son seul banc : ses quatre états
 *     (`MrhDemoEtat`) se choisissent au menu de `/dev/crm`, et la Recherche de ce banc montre celui qu'on a choisi ;
 *   · une garde i18n restée sur l'atelier : `matching-fil` prend sa place dans les deux listes verrouillées et dans le
 *     scanner, qui ne nomment plus `matching-atelier`.
 *
 * Lecture du code : ce qu'on refuse est une structure — des fichiers, des imports, une route, des listes —, pas un état
 * de l'écran.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const R = process.cwd()

const lire = (fichier: string): string => readFileSync(join(R, fichier), 'utf8')

/** Les fichiers d'un dossier, récursivement, dont le nom passe le filtre. */
function fichiers(dossier: string, garder: (nom: string) => boolean): string[] {
  return readdirSync(join(R, dossier), { withFileTypes: true }).flatMap((e) => {
    const chemin = `${dossier}/${e.name}`
    if (e.isDirectory()) return fichiers(chemin, garder)
    return garder(e.name) ? [chemin] : []
  })
}

/** Les modules qu'un code importe — statiquement, dynamiquement, pour ses seuls effets — ou qu'une spec simule. */
function importes(code: string): string[] {
  const motif = /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]|\bvi\.mock\(\s*['"]([^'"]+)['"]/gm
  return [...code.matchAll(motif)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4])
}

/** Le corps d'un tableau nommé (`nom = [` … `]`), à n'importe quelle indentation. */
function tableau(fichier: string, nom: string): string {
  const texte = lire(fichier)
  const debut = texte.indexOf(`${nom} = [`)
  expect(debut, `\`${nom}\` introuvable dans ${fichier}`).toBeGreaterThan(-1)
  const fin = texte.slice(debut).search(/\n\s*\]/)
  expect(fin, `fin de \`${nom}\` introuvable dans ${fichier}`).toBeGreaterThan(-1)
  return texte.slice(debut, debut + fin)
}

describe('l’atelier de bureau est retiré', () => {
  it('son dossier n’existe plus', () => {
    expect(existsSync(join(R, 'src/components/matching-atelier'))).toBe(false)
  })

  it('aucun fichier de src/ ne le nomme, et aucune spec ne l’importe', () => {
    const sources = fichiers('src', (n) => /\.(tsx?|css|json)$/.test(n))
    expect(sources.length, 'src/ ne rend plus rien : la clause ne mesure rien').toBeGreaterThan(500)
    expect(sources.filter((f) => lire(f).includes('matching-atelier'))).toEqual([])

    const specs = fichiers('tests', (n) => /\.tsx?$/.test(n))
    expect(specs.length, 'tests/ ne rend plus rien : la clause ne mesure rien').toBeGreaterThan(300)
    const vises = specs.flatMap((f) =>
      importes(lire(f))
        .filter((m) => /matching-atelier|MatchingShowcasePage|matchingAtelierFixtures/.test(m))
        .map((m) => `${f} → ${m}`),
    )
    expect(vises).toEqual([])
  })

  it('son banc est parti, avec sa route', () => {
    expect(existsSync(join(R, 'src/pages/dev/MatchingShowcasePage.tsx'))).toBe(false)
    expect(existsSync(join(R, 'src/pages/dev/matchingAtelierFixtures.ts'))).toBe(false)
    expect(lire('src/App.tsx')).not.toMatch(/MatchingShowcasePage|\/dev\/matching-atelier/)
  })

  it('les quatre états de démonstration de la Recherche ont un banc : le menu de /dev/crm, sur Matching', () => {
    const union = /export type MrhDemoEtat = ([^\n]+)/.exec(lire('src/components/matching-recherche/mrhDemo.ts'))?.[1] ?? ''
    const etats = [...union.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort()
    expect(etats).toEqual(['bloque', 'erreur', 'ok', 'vide'])

    const banc = lire('src/pages/dev/CrmShowcasePage.tsx')
    const menu = /const ETATS_RECHERCHE\b[\s\S]*?\n\]/.exec(banc)?.[0] ?? ''
    expect([...menu.matchAll(/id: '(\w+)'/g)].map((m) => m[1]).sort()).toEqual(etats)
    // L'état choisi est posé autour des routes du banc, et la Recherche du Matching le lit : jamais un état figé.
    expect(banc).toContain('<RechercheDuBanc.Provider value={recherche}>')
    const matching = lire('src/pages/dev/matchingFilBanc.tsx')
    expect(matching).toContain('useContext(RechercheDuBanc)')
    expect(matching).not.toMatch(/demo="/)
  })

  it('la garde i18n vise le fil à la place de l’atelier, des deux côtés, et le scanner aussi', () => {
    for (const [fichier, nom] of [['eslint.config.js', 'lockedFamilies'], ['scripts/lint-i18n-hardcoded.mjs', 'LOCKED_GLOBS']]) {
      const liste = tableau(fichier, nom)
      expect(liste, `${fichier} › ${nom}`).toContain("'src/components/matching-fil/**/*.{ts,tsx}'")
      expect(liste, `${fichier} › ${nom}`).not.toContain('matching-atelier')
    }
    const scanner = tableau('scripts/i18n-scan.mjs', 'DEFAULT_DIRS')
    expect(scanner).toContain("'src/components/matching-fil'")
    expect(scanner).not.toContain('matching-atelier')
  })
})
```

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer :

```ts
      expect(trace).toHaveBeenCalledWith('[atelier] reminder close failed', expect.objectContaining({ code: '42501' }))
```

par :

```ts
      expect(trace).toHaveBeenCalledWith('[matching] reminder close failed', expect.objectContaining({ code: '42501' }))
```

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer :

```ts
  it('un bien : `match_id` seul, sans `match_ids` — l’atelier, le mobile et « Aujourd’hui » en production', async () => {
```

par :

```ts
  it('un bien : `match_id` seul, sans `match_ids` — le fil et l’écran mobile', async () => {
```

Dans `tests/unit/ajouter-selection.spec.tsx`, remplacer :

```tsx
  it('les biens ajoutés apparaissent là où l’agent les proposera : atelier, fil, mobile', async () => {
```

par :

```tsx
  it('les biens ajoutés apparaissent là où l’agent les proposera : le fil et le mobile', async () => {
```

```bash
npx vitest run tests/unit/matching-atelier-retire.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/ajouter-selection.spec.tsx tests/unit/i18n-globs-vivants.spec.ts
```

Attendu : ÉCHEC, `Test Files  2 failed | 2 passed (4)`, `Tests  6 failed | 80 passed (86)`. Les cinq tests de la spec neuve tombent : le dossier existe (`expected true to be false`) ; dix-huit fichiers de `src/` le nomment (`expected [ 'src/App.tsx', …(17) ] to deeply equal []`) ; le banc existe ; le menu de `/dev/crm` n'a pas d'états de la Recherche (`expected [] to deeply equal [ 'bloque', 'erreur', 'ok', 'vide' ]`) ; `lockedFamilies` ne vise pas le fil. `matching-fil-gestes` tombe sur le préfixe (`expected "error" to be called with arguments: [ …(2) ]`). `ajouter-selection` reste vert (un titre), et `i18n-globs-vivants` aussi : l'atelier existe encore, son glob vise des fichiers.

- [ ] **Étape 2 : Les quatre états de la Recherche rejoignent le banc `/dev/crm`**

Avant de retirer le banc de l'atelier, le seul à les montrer. Le menu de `/dev/crm` gagne, sur la surface Matching, une ligne « Recherche » ; son état descend jusqu'à la page de démonstration par un contexte.

Créer `src/pages/dev/rechercheDuBanc.ts` :

```ts
/**
 * L'état de démonstration de la Recherche (la page 1 de Matching) sur le banc `/dev/crm`.
 *
 * Le banc monte la Recherche en démonstration (`mrhDemo.ts`) : ses requêtes sont gatées sur la session, et il n'a pas
 * de fixtures du marché. Ses quatre états (`MrhDemoEtat`) se choisissent au menu du banc, sur la surface Matching ; la
 * page de démonstration (`matchingFilBanc`) montre celui qu'on a choisi.
 *
 * ⚠ Un contexte, pas une prop : la table des routes du banc est hissée (`ROUTES_BANC`), elle ne reçoit rien au rendu.
 * Et il vit dans son propre module : `matchingFilBanc` se charge en différé (`lazy`), et le banc qui pose le contexte
 * ne pourrait pas l'importer de là sans l'embarquer.
 */
import { createContext } from 'react'
import type { MrhDemoEtat } from '@/components/matching-recherche/mrhDemo'

/** L'état que montre la Recherche du banc ; `ok` hors de son fournisseur. */
export const RechercheDuBanc = createContext<MrhDemoEtat>('ok')
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
```

par :

```tsx
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
import { LabsFixturesContext, useLabsFixtures, type LabsFixtureState } from '@/components/crm/labs/fixtures'
import BootCurtain, { CurtainLift } from '@/components/layout/BootCurtain'
```

par :

```tsx
import { LabsFixturesContext, useLabsFixtures, type LabsFixtureState } from '@/components/crm/labs/fixtures'
import type { MrhDemoEtat } from '@/components/matching-recherche/mrhDemo'
import BootCurtain, { CurtainLift } from '@/components/layout/BootCurtain'
import { RechercheDuBanc } from './rechercheDuBanc'
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
// lectures traversent l'interception. L'atelier garde son banc, `/dev/matching-atelier`.
```

par :

```tsx
// lectures traversent l'interception. Sa Recherche est en démonstration, dans l'état choisi au menu.
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
  // Le fil de matchs (refonte, lot 1) — l'atelier reste sur `/dev/matching-atelier`.
```

par :

```tsx
  // Le fil de matchs (refonte, lot 1), et la Recherche en page 1 : ses états se choisissent au menu (`ETATS_RECHERCHE`).
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
const etatDuPanneau = (id: EtatPanneau): (typeof ETATS)[number] => ETATS.find((e) => e.id === id) ?? ETATS[0]!
```

par :

```tsx
const etatDuPanneau = (id: EtatPanneau): (typeof ETATS)[number] => ETATS.find((e) => e.id === id) ?? ETATS[0]!

/**
 * Les états de la Recherche, la page 1 du Matching — le seul banc de ces quatre écrans.
 *
 * ⚠ Ce ne sont pas ceux de l'interception : le banc monte la Recherche en démonstration (`mrhDemo.ts`, faute de
 * fixtures du marché ici), et elle n'en lit rien. `vide` et `bloque` sont deux écrans distincts : « aucune annonce »
 * affirme quelque chose de la base, « bloquée » dit seulement que la requête n'a pas pu partir.
 */
const ETATS_RECHERCHE: { id: MrhDemoEtat; label: string; titre: string }[] = [
  { id: 'ok', label: 'Annonces', titre: 'Les annonces de démonstration, vente et location' },
  { id: 'vide', label: 'Aucune', titre: 'La requête a répondu : aucune annonce ne correspond' },
  { id: 'erreur', label: 'Échec', titre: 'La requête a échoué' },
  { id: 'bloque', label: 'Bloquée', titre: 'La requête n’a pas pu partir : ni réponse, ni échec' },
]
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
function Commandes({ etat, setEtat, sansFixture }: {
  etat: EtatPanneau
  setEtat: (e: EtatPanneau) => void
  sansFixture: string[]
}) {
```

par :

```tsx
function Commandes({ etat, setEtat, recherche, setRecherche, sansFixture }: {
  etat: EtatPanneau
  setEtat: (e: EtatPanneau) => void
  recherche: MrhDemoEtat
  setRecherche: (e: MrhDemoEtat) => void
  sansFixture: string[]
}) {
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
  const etatCourant = ETATS.find((e) => e.id === etat)

  return (
```

par :

```tsx
  const etatCourant = ETATS.find((e) => e.id === etat)
  // Un bouton d'état du menu : ceux de l'interception, et ceux de la Recherche sur le Matching.
  const boutonEtat = (actif: boolean): CSSProperties => ({
    flex: 1, border: 0, cursor: 'pointer', fontFamily: 'inherit', height: 26,
    borderRadius: 'var(--crm-radius-md)', fontSize: 'var(--crm-text-xs)', fontWeight: 600,
    background: actif ? sp.accent : 'transparent', color: actif ? sp.accentInk : sp.sub,
  })

  return (
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
            {ETATS.map((e) => (
              <button key={e.id} type="button" title={e.titre} onClick={() => setEtat(e.id)} aria-pressed={etat === e.id} style={{
                flex: 1, border: 0, cursor: 'pointer', fontFamily: 'inherit', height: 26,
                borderRadius: 'var(--crm-radius-md)', fontSize: 'var(--crm-text-xs)', fontWeight: 600,
                background: etat === e.id ? sp.accent : 'transparent', color: etat === e.id ? sp.accentInk : sp.sub,
              }}>{e.label}</button>
            ))}
          </div>
```

par :

```tsx
            {ETATS.map((e) => (
              <button key={e.id} type="button" title={e.titre} onClick={() => setEtat(e.id)} aria-pressed={etat === e.id}
                style={boutonEtat(etat === e.id)}>{e.label}</button>
            ))}
          </div>
          {courante?.id === 'matching' && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)',
              padding: 'var(--crm-space-xs)', borderBottom: `1px solid ${sp.solidBorder}`,
            }}>
              <span style={{ padding: '0 var(--crm-space-xs)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>
                Recherche
              </span>
              <div style={{ display: 'flex', gap: 'var(--crm-space-2xs)' }}>
                {ETATS_RECHERCHE.map((e) => (
                  <button key={e.id} type="button" title={e.titre} onClick={() => setRecherche(e.id)} aria-pressed={recherche === e.id}
                    style={boutonEtat(recherche === e.id)}>{e.label}</button>
                ))}
              </div>
            </div>
          )}
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
  const [etat, setEtatLocal] = useState<EtatPanneau>('nominal')
  const [sansFixture, setSansFixture] = useState<string[]>([])
```

par :

```tsx
  const [etat, setEtatLocal] = useState<EtatPanneau>('nominal')
  const [recherche, setRecherche] = useState<MrhDemoEtat>('ok')
  const [sansFixture, setSansFixture] = useState<string[]>([])
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
        <LabsFixturesContext.Provider value={LABS_PAR_ETAT[etatDuPanneau(etat).etat]}>
        <Suspense fallback={null}>
```

par :

```tsx
        <LabsFixturesContext.Provider value={LABS_PAR_ETAT[etatDuPanneau(etat).etat]}>
        <RechercheDuBanc.Provider value={recherche}>
        <Suspense fallback={null}>
```

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer :

```tsx
        </Suspense>
        </LabsFixturesContext.Provider>
        </MailFixturesContext.Provider>
        <BootCurtain />
        <Commandes etat={etat} setEtat={setEtat} sansFixture={sansFixture} />
```

par :

```tsx
        </Suspense>
        </RechercheDuBanc.Provider>
        </LabsFixturesContext.Provider>
        </MailFixturesContext.Provider>
        <BootCurtain />
        <Commandes etat={etat} setEtat={setEtat} recherche={recherche} setRecherche={setRecherche} sansFixture={sansFixture} />
```

Remplacer le contenu de `src/pages/dev/matchingFilBanc.tsx` par :

```tsx
/**
 * Le Matching du banc `/dev/crm` : le FIL DE MATCHS (lot 1) en page 0, sur les fixtures de ce banc.
 *
 * ⚠ Le vrai `MatchingPage` est monté — molette, clavier, points de page et thème viennent de la
 * production. Seules les deux pages passent par le slot `banc` : le fil y est le vrai composant (ses
 * lectures traversent l'interception comme Contacts et Mes biens), la Recherche reste en démo, faute
 * de fixtures du marché ici, dans l'état choisi au menu du banc (`RechercheDuBanc`) — le seul banc de
 * ses quatre états.
 *
 * ⚠ Composants de MODULE : une identité recréée à chaque rendu remonterait le fil et viderait sa
 * sélection (cf. `MatchingPagerBanc`).
 */
import { useContext } from 'react'
import MatchingPage, { type MatchingPagerBanc } from '@/pages/agent/MatchingPage'
import MatchingFil from '@/components/matching-fil/MatchingFil'
import MatchingRechercheHybride from '@/components/matching-recherche/MatchingRechercheHybride'
import { RechercheDuBanc } from './rechercheDuBanc'

function PageFil({ dark, onOpenRecherche }: { dark: boolean; onOpenRecherche: () => void }) {
  return <MatchingFil dark={dark} onOpenRecherche={onOpenRecherche} />
}

function PageRecherche({ dark }: { dark: boolean }) {
  const etat = useContext(RechercheDuBanc)
  return <MatchingRechercheHybride dark={dark} demo={etat} />
}

const BANC_FIL: MatchingPagerBanc = { Page0: PageFil, Page1: PageRecherche }

export default function MatchingFilBanc() {
  return <MatchingPage banc={BANC_FIL} atterrissage="score" />
}
```

Dans `src/components/matching-recherche/mrhDemo.ts`, remplacer :

```ts
 * Fixtures du mode `demo` de « Recherche hybride » — banc `/dev/matching-atelier`.
 *
 * POURQUOI CE FICHIER EXISTE. `MatchingRechercheHybride` porte ses propres hooks
 * (`useAuth`, `useMatchingSearch`, `useMatchingSearchTotal`, `useMatchingBuyers`,
 * `useCitySuggest`), tous gatés sur la session. Contrairement à `AtelierStage`,
 * qui est présentationnel et qu'un banc peut alimenter par ses props, cette
 * moitié-là — la plus lourde du périmètre bureau — n'avait AUCUN banc : sans
 * session, ses cinq requêtes sont désactivées et l'écran ne montre qu'un état
 * bloqué. On ne pouvait donc pas la regarder avant de la repeindre.
```

par :

```ts
 * Fixtures du mode `demo` de « Recherche hybride » — banc `/dev/crm`, page 1 du Matching.
 *
 * POURQUOI CE FICHIER EXISTE. `MatchingRechercheHybride` porte ses propres hooks
 * (`useAuth`, `useMatchingSearch`, `useMatchingSearchTotal`, `useMatchingBuyers`,
 * `useCitySuggest`), tous gatés sur la session : un banc ne peut pas l'alimenter
 * par ses props, et cette moitié-là — la plus lourde du périmètre bureau — n'avait
 * AUCUN banc : sans session, ses cinq requêtes sont désactivées et l'écran ne
 * montre qu'un état bloqué. On ne pouvait donc pas la regarder avant de la repeindre.
```

Dans `src/components/matching-recherche/MatchingRechercheHybride.tsx`, remplacer :

```tsx
   * Banc d'essai (`/dev/matching-atelier`) : les cinq requêtes de cet écran sont
   * remplacées par les fixtures de `mrhDemo.ts`, et aucun geste n'écrit.
   *
   * ⚠ Ce composant est le SEUL du périmètre bureau qui porte ses propres hooks —
   * `AtelierStage` est présentationnel et se nourrit par ses props. Sans ce mode,
   * la moitié la plus lourde de l'écran Matching n'a aucun banc : toutes ses
   * requêtes sont gatées sur la session, donc sans session elle ne rend qu'un
   * état bloqué. Idiome repris de `MobileMatchingScreen demo`, pas inventé ici.
```

par :

```tsx
   * Banc d'essai (`/dev/crm`, page 1 du Matching) : les cinq requêtes de cet écran
   * sont remplacées par les fixtures de `mrhDemo.ts`, et aucun geste n'écrit.
   *
   * ⚠ Ses requêtes sont gatées sur la session, et le banc n'a pas de fixtures du
   * marché : sans ce mode, la moitié la plus lourde de l'écran Matching n'aurait
   * aucun banc — sans session, elle ne rend qu'un état bloqué. Idiome repris de
   * `MobileMatchingScreen demo`, pas inventé ici.
```

- [ ] **Étape 3 : L'atelier de bureau part, avec son banc et sa route**

Les dix composants, `constants.ts` et `atelier.css` n'ont plus d'autre lecteur que le banc ; le banc, plus d'autre montage que sa route.

```bash
git rm src/components/matching-atelier/AtelierStage.tsx src/components/matching-atelier/AtlAcheteurMode.tsx src/components/matching-atelier/AtlAnnonceVue.tsx src/components/matching-atelier/AtlCockpit.tsx src/components/matching-atelier/AtlConfirm.tsx src/components/matching-atelier/AtlEmptyState.tsx src/components/matching-atelier/AtlListing.tsx src/components/matching-atelier/AtlOverlayHost.tsx src/components/matching-atelier/AtlQueue.tsx src/components/matching-atelier/AtlWhy.tsx src/components/matching-atelier/constants.ts src/components/matching-atelier/atelier.css
git rm src/pages/dev/MatchingShowcasePage.tsx src/pages/dev/matchingAtelierFixtures.ts
```

Dans `src/App.tsx`, remplacer :

```tsx
const SentryTestPage = import.meta.env.DEV
  ? lazy(() => import('@/pages/dev/SentryTestPage'))
  : () => null
const MatchingShowcasePage = import.meta.env.DEV
  ? lazy(() => import('@/pages/dev/MatchingShowcasePage'))
  : () => null
const MobileShowcasePage = import.meta.env.DEV
```

par :

```tsx
const SentryTestPage = import.meta.env.DEV
  ? lazy(() => import('@/pages/dev/SentryTestPage'))
  : () => null
const MobileShowcasePage = import.meta.env.DEV
```

Dans `src/App.tsx`, remplacer :

```tsx
              <Route path="/design-system/megga-x" element={<MeggaXStyleGuidePage />} />
              {/* Matching — QA visuelle du PAGER entier (chrome, 2 pages, bascule
                  de thème, états d'exception). Mocks du handoff, zéro écriture.
                  Le chemin garde son nom d'origine : il est cité tel quel dans le
                  cerveau comme le banc où s'éprouvent les modales de l'atelier. */}
              <Route path="/dev/matching-atelier" element={<MatchingShowcasePage />} />
              <Route path="/dev/sentry-test" element={<SentryTestPage />} />
```

par :

```tsx
              <Route path="/design-system/megga-x" element={<MeggaXStyleGuidePage />} />
              <Route path="/dev/sentry-test" element={<SentryTestPage />} />
```

Le pager perd l'emplacement `Chrome`, que seul ce banc remplissait, et sa documentation cesse de nommer l'atelier.

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
/**
 * Contenus de substitution des bancs `/dev/crm` et `/dev/matching-atelier` : ils y
 * injectent des données de démonstration, et rien d'autre.
```

par :

```tsx
/**
 * Contenus de substitution du banc `/dev/crm` : il y injecte des données de
 * démonstration, et rien d'autre.
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
 * 2. Un slot appelé rendrait `AtelierStage` sous une identité d'élément qui
 *    change à chaque rendu du banc : la session de triage en cours (onglet,
 *    sélection, historique d'annulation) serait remise à zéro à chaque clic.
 *    Les slots doivent donc être STABLES côté banc — définis hors du composant.
 */
export interface MatchingPagerBanc {
  Page0: (p: { dark: boolean; onOpenRecherche: () => void }) => ReactNode
  Page1: (p: { dark: boolean }) => ReactNode
  /**
   * Commandes du banc, rendues à la RACINE du pager — hors du viewport clippé.
   *
   * ⚠ Elles ne peuvent pas vivre dans une page : le track porte un `transform`,
   * qui fait de lui le bloc englobant de tout descendant en `position: fixed` —
   * les commandes glisseraient avec la page au lieu de rester à l'écran.
   *
   * ⚠ Et elles ne peuvent pas non plus vivre dans le banc au-dessus du pager :
   * c'est le pager qui POSSÈDE le thème (bouton de la barre latérale +
   * `megga.sugar.dark`). Un banc qui relirait la clé pour son compte peindrait
   * ses commandes dans le thème d'avant la dernière bascule — un banc qui
   * fabrique lui-même une incohérence de thème, défaut déjà vécu sur
   * `/dev/biens`.
   */
  Chrome?: (p: { dark: boolean }) => ReactNode
}
```

par :

```tsx
 * 2. Un slot appelé rendrait le fil sous une identité d'élément qui change à
 *    chaque rendu du banc : sa sélection et sa fenêtre d'annulation seraient
 *    remises à zéro à chaque clic. Les slots doivent donc être STABLES côté
 *    banc — définis hors du composant.
 */
export interface MatchingPagerBanc {
  Page0: (p: { dark: boolean; onOpenRecherche: () => void }) => ReactNode
  Page1: (p: { dark: boolean }) => ReactNode
}
```

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
      <MatchingScrollHint page={page} onGo={goTo} sub={sp.sub} ink={sp.ink} />
      {banc?.Chrome ? <banc.Chrome dark={dark} /> : null}
```

par :

```tsx
      <MatchingScrollHint page={page} onGo={goTo} sub={sp.sub} ink={sp.ink} />
```

- [ ] **Étape 4 : Ce qui survit rejoint son lecteur, et le dossier disparaît**

L'icône chez la Recherche, les types, les formats et la phrase MEGGA AI chez l'écran mobile. Le dossier n'a plus de fichier : si un dossier vide reste sur le disque, la dernière commande le retire ; sinon, elle ne fait rien.

```bash
git mv src/components/matching-atelier/AtlIcon.tsx src/components/matching-recherche/MrhIcon.tsx
git mv src/components/matching-atelier/types.ts src/components/crm-mobile/matching/types.ts
git mv src/components/matching-atelier/format.ts src/components/crm-mobile/matching/format.ts
git mv src/components/matching-atelier/composeAiHint.ts src/components/crm-mobile/matching/composeAiHint.ts
test ! -d src/components/matching-atelier || rmdir src/components/matching-atelier
```

L'icône prend le nom de son dossier et perd `sw`, que seul `AtlCockpit` passait.

Remplacer le contenu de `src/components/matching-recherche/MrhIcon.tsx` par :

```tsx
/**
 * Matching · Recherche — le rendu de ses icônes : le jeu maison `MEIcon`, au trait de 1,6, complété de tracés locaux
 * pour les glyphes absents du jeu OU que `MEIcon` rend en police de repli (`layers` → `PxIconFont`) — le trait reste
 * linéaire, sans emoji. `RechIcon` y traduit les noms du proto de la Recherche.
 */

import type { CSSProperties, ReactNode } from 'react'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'

// Glyphes locaux : nom → paths (stroke) ou élément (fill)
const LOCAL: Record<string, { fill?: boolean; node: ReactNode }> = {
  lift: {
    node: (
      <>
        <path d="M5 3h14v18H5z" />
        <path d="M9 8l3-3 3 3" />
        <path d="M9 16l3 3 3-3" />
      </>
    ),
  },
  layers: {
    fill: true,
    node: <path d="m12 2 11 6-11 6-11-6 11-6Zm-11 9 11 6 11-6-2-1-9 5-9-5-2 1Zm0 4 11 6 11-6-2-1-9 5-9-5-2 1Z" />,
  },
  'trend-down': {
    node: (
      <>
        <path d="M22 17 13.5 8.5l-5 5L2 7" />
        <path d="M16 17h6v-6" />
      </>
    ),
  },
  tag: {
    node: (
      <>
        <path d="M12 2H2v10l9.3 9.3a1.7 1.7 0 0 0 2.4 0l7.6-7.6a1.7 1.7 0 0 0 0-2.4L12 2Z" />
        <path d="M7 7h.01" />
      </>
    ),
  },
}

/** Le trait des icônes de la Recherche : 1,6, un rien plus fin que le trait par défaut de `MEIcon` (1,7). */
const TRAIT = 1.6

export type MrhIconName = MEIconName | 'lift' | 'trend-down' | 'tag'

interface MrhIconProps {
  d: MrhIconName
  size?: number
  style?: CSSProperties
  className?: string
}

export default function MrhIcon({ d, size = 16, style, className }: MrhIconProps) {
  const local = LOCAL[d]
  if (local) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill={local.fill ? 'currentColor' : 'none'}
        stroke={local.fill ? 'none' : 'currentColor'}
        strokeWidth={local.fill ? undefined : TRAIT}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ display: 'inline-block', flexShrink: 0, ...style }}
      >
        {local.node}
      </svg>
    )
  }
  return <MEIcon name={d as MEIconName} size={size} strokeWidth={TRAIT} className={className} style={style} />
}
```

Dans `src/components/matching-recherche/RechIcon.tsx`, remplacer :

```tsx
// Matching · Recherche — pont d'icônes. Le proto handoff appelle `CRMIcon` avec
// une couleur de trait explicite (`stroke`) ; on délègue à `AtlIcon` (→ MEIcon,
// stroke 1.6, même set que l'atelier) en posant la couleur via `color`
// (AtlIcon rend en `currentColor`). Garde la grammaire Sugar : stroke linéaire, 0 emoji.

import type { CSSProperties } from 'react'
import AtlIcon, { type AtlIconName } from '@/components/matching-atelier/AtlIcon'

// nom proto → nom MEIcon/AtlIcon
const MAP: Record<string, AtlIconName> = {
```

par :

```tsx
// Matching · Recherche — pont d'icônes. Le proto handoff appelle `CRMIcon` avec
// une couleur de trait explicite (`stroke`) ; on délègue à `MrhIcon` (→ MEIcon,
// trait de 1,6) en posant la couleur via `color` (MrhIcon rend en `currentColor`).
// Trait linéaire, 0 emoji.

import type { CSSProperties } from 'react'
import MrhIcon, { type MrhIconName } from './MrhIcon'

// nom proto → nom MEIcon/MrhIcon
const MAP: Record<string, MrhIconName> = {
```

Dans `src/components/matching-recherche/RechIcon.tsx`, remplacer :

```tsx
    <AtlIcon
      d={MAP[name] ?? 'info'}
```

par :

```tsx
    <MrhIcon
      d={MAP[name] ?? 'info'}
```

Dans `src/components/matching-recherche/MrhCard.tsx`, remplacer :

```tsx
// adapté aux vraies photos market_listings + i18n + icônes AtlIcon.
```

par :

```tsx
// adapté aux vraies photos market_listings + i18n + icônes RechIcon.
```

Les types de l'écran mobile perdent `TriageKind`, que seul l'atelier lisait, et reçoivent `AtelierGestes`, que seul `MmMatchingScreen` lit encore.

Remplacer le contenu de `src/components/crm-mobile/matching/types.ts` par :

```ts
/**
 * Matching au téléphone — le contrat de données de l'écran mobile (`MobileMatchingScreen`) : les formes que produit sa
 * lecture, `useAtelierMatching` (matches + contacts + kyc_cases + properties/market_listings, handoff §9 adapté
 * Supabase), et les gestes que l'écran câble (`AtelierGestes`). Elles portent le nom de l'atelier de bureau, qui les
 * partageait jusqu'à son retrait (lot E1) ; elles partent avec l'écran mobile au lot E2.
 */

import type { SearchCriteria } from '@/types/contact'
import type { PendingHandle } from '@/lib/matchingAnnulation'

export type AtelierTab = 'all' | 'to-send' | 'engaged' | 'no-reply'
export type AtelierKyc = 'verified' | 'pending' | 'stale' | 'none'
export type AtelierStatus = 'to-send' | 'engaged' | 'no-reply'

export interface AtelierReason {
  label: string
  detail: string
  pts: number
  ok: boolean
}

export interface AtelierGalleryPhoto {
  url: string
  room: string
  label: string
}

// Annonce pivot — bien interne (properties) OU annonce marché (market_listings)
export interface AtelierListing {
  /** `p:<uuid>` (properties) ou `m:<uuid>` (market_listings) */
  key: string
  id: string
  kind: 'property' | 'market'
  ref: string
  title: string
  addr: string
  canton: string
  lat: number | null
  lng: number | null
  price: number
  priceWas: number | null
  pricePerM2: number | null
  charges: number | null
  type: string
  transaction: 'Vente' | 'Location'
  rooms: number | null
  area: number | null
  beds: number | null
  baths: number | null
  year: number | null
  floor: number | null
  lift: boolean
  features: string[]
  photos: number
  gallery: AtelierGalleryPhoto[]
  desc: string
  quartier: string
  daysOnMarket: number | null
  qualityScore: number | null
  agency: { name: string | null; phone: string | null }
  sourceUrl: string | null
  firstSeenAt: string | null
  isFurnished: boolean
}

// Acheteur scoré contre l'annonce pivot (1 row = 1 match)
export interface AtelierBuyer {
  /** contact id */
  id: string
  matchId: string
  first: string
  last: string
  av: string
  type: string
  budget: string
  zone: string
  kyc: AtelierKyc
  status: AtelierStatus
  engage: string
  score: number
  ai: string
  reasons: AtelierReason[]
  email: string | null
  phone: string | null
  snoozedUntil: string | null
  criteria: SearchCriteria | null
  /** source du match — visite proposable uniquement sur bien interne */
  source: 'internal' | 'market'
  sentAt: string | null
}

// Bien matché pour un acheteur pivot (vue focus du mobile)
export interface AtelierPoolMatch {
  matchId: string
  lid: string
  L: AtelierListing
  score: number
  reasons: AtelierReason[]
  current: boolean
  snoozedUntil: string | null
  /** statut d'engagement (mobile : « Envoyé » déjà transmis vs « Envoyer ») */
  status: AtelierStatus
}

// Pivot affichable dans la file (groupe annonce → acheteurs)
export interface AtelierPivot {
  listing: AtelierListing
  buyers: AtelierBuyer[]
  actionable: number
}

/**
 * Les gestes que l'écran mobile câble sur un match : chacun diffère son écriture dans la file d'annulation
 * (`PendingRegistry`) et appelle l'exécuteur de `matchingGestes`.
 */
export interface AtelierGestes {
  /** « Je l'ai proposé » : l'agent a présenté le bien lui-même, le CRM consigne. Sans effet sur un
   *  match qui n'est plus à proposer (`ResultatProposition.deja`) */
  send: (matchId: string) => PendingHandle
  /** « J'ai relancé » : la relance interne est repoussée, rien n'est envoyé */
  relance: (matchId: string) => PendingHandle
  snooze: (matchId: string) => PendingHandle
  dismiss: (matchId: string) => PendingHandle
  /** réponse de l'acheteur, consignée par l'agent (Intéressé / Pas intéressé) → matches.status
   *  interested/rejected, produit response_at via trigger. Même fenêtre d'annulation 5 s. */
  react: (matchId: string, reaction: 'interested' | 'rejected') => PendingHandle
  /** réactivation d'un reporté — immédiate, pas de fenêtre d'annulation */
  wake: (matchId: string) => void
  /** « Proposer une visite » — bascule vers le flux visite (picker réel) */
  visit: (matchId: string) => void
}
```

Les formats perdent `atlFmtCHF`, `atlScoreColor` et `atlInitials`, que seuls les composants de l'atelier lisaient ; `fmtM` n'est plus lu que par son module.

Remplacer le contenu de `src/components/crm-mobile/matching/format.ts` par :

```ts
/**
 * Matching au téléphone — les formats de l'écran mobile et de sa lecture (`useAtelierMatching`) : la date de retour
 * d'un report, et la fourchette de budget compacte d'un acheteur (`AtelierBuyer.budget`), qu'aucun écran n'affiche —
 * l'écran mobile lit les critères eux-mêmes.
 */

/** 1100000 → « 1,1M » (libellés budget compacts du handoff) */
function fmtM(p: number): string {
  return String(Math.round(p / 10000) / 100).replace('.', ',') + 'M'
}

/** Fourchette budget « 0,9–1,3M » depuis criteria */
export function fmtBudgetRange(min?: number, max?: number): string {
  if (min && max) return `${fmtM(min)}–${fmtM(max)}`
  if (max) return `≤ ${fmtM(max)}`
  if (min) return `≥ ${fmtM(min)}`
  return '—'
}

/** Date de retour d'un report (J+7), format « 17 juin » */
export function atlReturnDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 7 * 864e5)
  return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })
}
```

Dans `src/components/crm-mobile/matching/composeAiHint.ts`, remplacer :

```ts
// Atelier Matching — synthèse MEGGA AI de la colonne « Pourquoi ça matche ».
// Phrase composée déterministe à partir des signaux réels du moteur de
// matching (reasons), du statut d'engagement et du KYC. Suggestion seulement —
// jamais d'action auto (grammaire : l'IA assiste, l'agent agit).
```

par :

```ts
/**
 * Matching au téléphone — la phrase MEGGA AI d'un acheteur (`AtelierBuyer.ai`), que compose la lecture de l'écran
 * mobile (`useAtelierMatching`) : déterministe, à partir des signaux réels du moteur de matching (reasons), du statut
 * d'engagement et du KYC. Suggestion seulement — jamais d'action auto (grammaire : l'IA assiste, l'agent agit).
 *
 * ⚠ Aucun écran ne l'affiche : la carte MEGGA AI du mode « Par acheteur » de l'atelier de bureau, qui la montrait, est
 * partie avec lui (lot E1), et l'écran mobile ne lit pas ce champ. Elle vit avec le contrat de données du mobile,
 * jusqu'au lot E2.
 */
```

Dans `src/lib/matchingAnnulation.ts`, remplacer :

```ts
  flushNow: () => Promise<ResultatProposition | null>
}

export interface AtelierGestes {
  /** « Je l'ai proposé » : l'agent a présenté le bien lui-même, le CRM consigne. Sans effet sur un
   *  match qui n'est plus à proposer (`ResultatProposition.deja`) */
  send: (matchId: string) => PendingHandle
  /** « J'ai relancé » : la relance interne est repoussée, rien n'est envoyé */
  relance: (matchId: string) => PendingHandle
  snooze: (matchId: string) => PendingHandle
  dismiss: (matchId: string) => PendingHandle
  /** réponse de l'acheteur, consignée par l'agent (Intéressé / Pas intéressé) → matches.status
   *  interested/rejected, produit response_at via trigger. Même fenêtre d'annulation 5 s. */
  react: (matchId: string, reaction: 'interested' | 'rejected') => PendingHandle
  /** réactivation d'un reporté — immédiate, pas de fenêtre d'annulation */
  wake: (matchId: string) => void
  /** « Proposer une visite » — bascule vers le flux visite (picker réel) */
  visit: (matchId: string) => void
}

interface DeferOptions {
```

par :

```ts
  flushNow: () => Promise<ResultatProposition | null>
}

interface DeferOptions {
```

L'écran mobile ne change que ses imports.

Dans `src/components/crm-mobile/matching/MmMatchingScreen.tsx`, remplacer :

```tsx
import { PendingRegistry, type AtelierGestes, type PendingHandle } from '@/lib/matchingAnnulation'
import type { AtelierBuyer, AtelierListing, AtelierTab } from '@/components/matching-atelier/types'
import { atlReturnDate } from '@/components/matching-atelier/format'
```

par :

```tsx
import { PendingRegistry, type PendingHandle } from '@/lib/matchingAnnulation'
import type { AtelierBuyer, AtelierGestes, AtelierListing, AtelierTab } from './types'
import { atlReturnDate } from './format'
```

Dans `src/components/crm-mobile/matching/MmKyc.tsx`, remplacer :

```tsx
import type { AtelierKyc } from '@/components/matching-atelier/types'
```

par :

```tsx
import type { AtelierKyc } from './types'
```

Dans `src/components/crm-mobile/matching/vm.ts`, remplacer :

```ts
} from '@/components/matching-atelier/types'
```

par :

```ts
} from './types'
```

La lecture de l'atelier devient celle du mobile, et d'elle seule : elle ne rend plus `pivotByKey` ni `defaultPivotKey`.

Dans `src/hooks/useAtelierMatching.ts`, remplacer :

```ts
// Atelier Matching — données (contrat HANDOFF_MATCHING_COUTURES).
//
// Données : matches (+ contact + property/market_listing) groupés par annonce
// pivot (`p:<uuid>` interne / `m:<uuid>` veille marché) + KYC du dernier
// dossier acheteur par contact. Le mode « Par acheteur » réutilise les mêmes
// matches re-groupés par contact (poolFor).
//
// Les gestes que l'agent pose sur ces matchs ne sont pas ici : ils vivent dans
// `@/lib/matchingGestes`, que le fil de matchs partage — un seul écrivain par geste.
```

par :

```ts
/**
 * Matching au téléphone — la lecture de l'écran mobile (`MobileMatchingScreen`, contrat HANDOFF_MATCHING_COUTURES), et
 * d'elle seule : l'atelier de bureau, qui la partageait, est retiré (lot E1) ; elle part avec l'écran mobile au lot E2
 * (conception `2026-09-27-matching-lot-e1-bureau-design.md` §6.2). Son retour se borne à ce que l'écran lit.
 *
 * Données : matches (+ contact + property/market_listing) groupés par annonce pivot (`p:<uuid>` interne / `m:<uuid>`
 * veille marché) + KYC du dernier dossier acheteur par contact. La vue focus du mobile réutilise les mêmes matches
 * regroupés par contact (`poolFor`, `buyerFor`).
 *
 * Les gestes que l'agent pose sur ces matchs ne sont pas ici : ils vivent dans `@/lib/matchingGestes`, que le fil de
 * matchs partage — un seul écrivain par geste.
 */
```

Dans `src/hooks/useAtelierMatching.ts`, remplacer :

```ts
import { composeAiHint } from '@/components/matching-atelier/composeAiHint'
import { fmtBudgetRange } from '@/components/matching-atelier/format'
import type {
  AtelierBuyer,
  AtelierListing,
  AtelierPivot,
  AtelierPoolMatch,
  AtelierReason,
} from '@/components/matching-atelier/types'
```

par :

```ts
import { composeAiHint } from '@/components/crm-mobile/matching/composeAiHint'
import { fmtBudgetRange } from '@/components/crm-mobile/matching/format'
import type {
  AtelierBuyer,
  AtelierListing,
  AtelierPivot,
  AtelierPoolMatch,
  AtelierReason,
} from '@/components/crm-mobile/matching/types'
```

Dans `src/hooks/useAtelierMatching.ts`, remplacer :

```ts
  /** true si la query matches ou kyc a échoué — état d'erreur de l'atelier. */
  isError: boolean
  pivots: AtelierPivot[]
  pivotByKey: Map<string, AtelierPivot>
  defaultPivotKey: string | null
  /** Tous les biens matchés d'un acheteur (mode « Par acheteur »), score desc */
  poolFor: (contactId: string, currentKey: string | null) => AtelierPoolMatch[]
  /** Profil acheteur (meilleur match) — deep-link ?contact= */
  buyerFor: (contactId: string) => AtelierBuyer | null
  refresh: () => void
}

/**
 * Données de l'Atelier Matching : matches (annonce pivot ↔ acheteurs) enrichis KYC,
```

par :

```ts
  /** true si la query matches ou kyc a échoué — état d'erreur de l'écran mobile. */
  isError: boolean
  pivots: AtelierPivot[]
  /** Tous les biens matchés d'un acheteur (vue focus du mobile), score desc */
  poolFor: (contactId: string, currentKey: string | null) => AtelierPoolMatch[]
  /** Profil acheteur (meilleur match) — la vue focus du mobile */
  buyerFor: (contactId: string) => AtelierBuyer | null
  refresh: () => void
}

/**
 * Données de l'écran mobile de Matching : matches (annonce pivot ↔ acheteurs) enrichis KYC,
```

Dans `src/hooks/useAtelierMatching.ts`, remplacer :

```ts
  const { pivots, pivotByKey } = useMemo(() => {
```

par :

```ts
  const pivots = useMemo(() => {
```

Dans `src/hooks/useAtelierMatching.ts`, remplacer :

```ts
    const list = Array.from(groups.values())
      .map(g => ({ ...g, buyers: g.buyers.sort((a, z) => z.score - a.score) }))
      .sort((a, z) => z.actionable - a.actionable || z.buyers.length - a.buyers.length)
    return { pivots: list, pivotByKey: new Map(list.map(g => [g.listing.key, g])) }
  }, [rawMatches, listingOf, toBuyer])
```

par :

```ts
    return Array.from(groups.values())
      .map(g => ({ ...g, buyers: g.buyers.sort((a, z) => z.score - a.score) }))
      .sort((a, z) => z.actionable - a.actionable || z.buyers.length - a.buyers.length)
  }, [rawMatches, listingOf, toBuyer])
```

Dans `src/hooks/useAtelierMatching.ts`, remplacer :

```ts
    // remettre tout l'atelier en écran de chargement quand il se rafraîchit.
    isLoading: matchesLoading,
    isError: matchesError || kycError,
    pivots,
    pivotByKey,
    defaultPivotKey: pivots[0]?.listing.key ?? null,
    poolFor,
```

par :

```ts
    // remettre tout l'écran en chargement quand il se rafraîchit.
    isLoading: matchesLoading,
    isError: matchesError || kycError,
    pivots,
    poolFor,
```

- [ ] **Étape 5 : La garde des globs i18n rougit**

Le dossier parti, son glob vise le vide, des deux côtés :

```bash
npx vitest run tests/unit/i18n-globs-vivants.spec.ts
```

Attendu : ÉCHEC, `Test Files  1 failed (1)`, `Tests  2 failed | 22 passed (24)` — `eslint.config.js › verrouillées` et `scripts/lint-i18n-hardcoded.mjs › LOCKED_GLOBS`, sur `glob mort : « src/components/matching-atelier/**/*.{ts,tsx} » ne correspond à aucun fichier`.

- [ ] **Étape 6 : La garde i18n vise le fil**

Dans `eslint.config.js`, remplacer :

```js
      'src/components/crm-identity/**/*.{ts,tsx}',
      'src/components/matching-atelier/**/*.{ts,tsx}',
      'src/components/ai-copilot/**/*.{ts,tsx}',
```

par :

```js
      'src/components/crm-identity/**/*.{ts,tsx}',
      'src/components/matching-fil/**/*.{ts,tsx}',
      'src/components/ai-copilot/**/*.{ts,tsx}',
```

Dans `scripts/lint-i18n-hardcoded.mjs`, remplacer :

```js
  'src/components/crm-identity/**/*.{ts,tsx}',
  'src/components/matching-atelier/**/*.{ts,tsx}',
  'src/components/ai-copilot/**/*.{ts,tsx}',
```

par :

```js
  'src/components/crm-identity/**/*.{ts,tsx}',
  'src/components/matching-fil/**/*.{ts,tsx}',
  'src/components/ai-copilot/**/*.{ts,tsx}',
```

Dans `scripts/i18n-scan.mjs`, remplacer :

```js
  'src/pages/agent',
  'src/components/matching-atelier',
  'src/components/calendar',
```

par :

```js
  'src/pages/agent',
  'src/components/matching-fil',
  'src/components/calendar',
```

```bash
npx vitest run tests/unit/i18n-globs-vivants.spec.ts
npm run lint:i18n
```

Attendu : PASS, `Test Files  1 passed (1)`, `Tests  24 passed (24)` ; puis `✓ i18n garde-fou OK — 0 texte FR en dur sur les surfaces agent verrouillées (i18next/no-literal-string).` — le fil, désormais sous la règle, n'a aucun littéral qu'elle signale (contrôle négatif joué : `Tout est à jour` écrit en dur dans `FilOnglets.tsx` fait sortir `src/components/matching-fil/FilOnglets.tsx:39:8`).

- [ ] **Étape 7 : Les specs et les gardes à chemins en dur suivent**

La spec de la feuille part avec elle ; la spec de base est renommée pour ce qu'elle éprouve — le contrat base des gestes que le fil garde (ses imports ne visaient déjà plus l'atelier).

```bash
git rm tests/unit/matching-atelier-css.spec.ts
git mv tests/backend/atelier-matching-loop.spec.ts tests/backend/matching-gestes-contrat.spec.ts
```

Dans `tests/backend/matching-gestes-contrat.spec.ts`, remplacer :

```ts
// Backend test — Atelier Matching : boucle complète (migration 20260610_001).
```

par :

```ts
// Backend test — les gestes du matching : le contrat base qu'ils supposent (migration 20260610_001).
```

Dans `tests/backend/matching-gestes-contrat.spec.ts`, remplacer :

```ts
describe.skipIf(!HAS_KEYS)('Atelier Matching — boucle complète', () => {
```

par :

```ts
describe.skipIf(!HAS_KEYS)('Gestes du matching — le contrat base', () => {
```

`matching-contraste` est recentrée sur la Recherche : les paliers d'encre d'`atelier.css`, la règle `.atl .av`, les initiales d'avatar de ses composants et la palette `AV_PALETTE` sous l'encre dérivée n'ont plus d'écran ; la pastille de baisse de prix, les encres translucides et la marque des régies restent, et le témoin anti-vacuité porte désormais sur les composants de la Recherche.

Remplacer le contenu de `tests/unit/matching-contraste.spec.ts` par :

```ts
/**
 * Garde-fou : sur la Recherche de « Matching » (la page 1 du pager), l'encre reste lisible.
 *
 * ⛔ POURQUOI UNE GARDE À PART. `megga-x-grammar.spec.ts` compte des littéraux, il ne mesure pas un contraste. Ce que
 * cette garde tient ne se voit qu'en MESURANT : la pastille de baisse de prix, qu'une mesure au rendu a trouvée sous
 * l'AA (`#C45A00`, 4,37:1 sur la carte blanche), une encre translucide, qu'on ne mesure pas si on la lit nue, et la
 * marque des régies, qu'une seconde implémentation chargerait sans ses garde-fous.
 *
 * ⚠ Jusqu'au 27.09.2026, elle lisait aussi la feuille de l'atelier de bureau (`atelier.css` : ses quatre paliers
 * d'encre, dans les deux thèmes) et les initiales d'avatar de ses composants — partis avec l'atelier (lot E1). Ce qui
 * reste est la Recherche.
 *
 * ⚠ PIÈGE DE MESURE, coûté une demi-heure : `getComputedStyle` lu pendant que le volet du navigateur est masqué rend
 * la valeur de DÉPART d'une transition en cours — les images ne sont pas composées, donc la transition n'avance
 * jamais. Forcer une image avant de lire.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

/** Les composants de la Recherche, carte GELÉE exclue (voir le cliquet). */
const RECHERCHE = readdirSync('src/components/matching-recherche')
  .filter((n) => n.endsWith('.tsx') && n !== 'MrhMapView.tsx')
  .map((n) => ({ nom: `src/components/matching-recherche/${n}`, code: readFileSync(`src/components/matching-recherche/${n}`, 'utf-8') }))

const canal = (hex: string): [number, number, number] =>
  [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16)) as [number, number, number]

function luminance(hex: string): number {
  return canal(hex)
    .map((v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    .reduce((acc, c, i) => acc + [0.2126, 0.7152, 0.0722][i] * c, 0)
}

function contraste(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Seuil 4,5 partout, et non 3 : le palier « grand texte » de WCAG commence à 18,66 px en gras, et les textes que
 * peignent ces encres n'y arrivent pas.
 */
const AA = 4.5

describe('Matching — sur la Recherche, l’encre reste lisible', () => {
  /**
   * Sans ce témoin, un dossier renommé rendrait une liste VIDE, et les boucles ci-dessous passeraient par vacuité.
   */
  it('la garde voit bien les composants de la Recherche', () => {
    expect(RECHERCHE.length, 'aucun composant de la Recherche lu — la garde ne mesure plus rien').toBeGreaterThan(5)
    expect(RECHERCHE.map((r) => r.nom)).toContain('src/components/matching-recherche/MrhCard.tsx')
  })

  /**
   * ⛔ LA PASTILLE DE BAISSE DE PRIX — le seul écart que le reciblage ait laissé
   * sous l'AA, et le seul défaut de contraste que la sonde au rendu ait trouvé
   * hors de l'atelier : `#C45A00` rendait 4,37:1 sur la carte blanche et 4,15:1
   * sur la sous-carte.
   *
   * ⚠ CE N'EST PAS UN RECIBLAGE. `--sys-yellow` reste une couleur FONCTIONNELLE
   * — elle dit « le prix a baissé », une information que les neutres ne savent
   * pas porter. On ne la remplace pas par un gris : on l'ASSOMBRIT dans sa propre
   * famille, jusqu'à ce qu'elle passe. Même geste que `tk.goal`, monté de
   * `#059669` à `#047857` sur « Mes biens » — et comme là-bas, la valeur retenue
   * EXISTE DÉJÀ dans le dépôt (`--color-warning-dark` de `globals.css`, `warnFg`
   * du rapport KYC) plutôt que d'être inventée pour l'occasion.
   *
   * ⚠ La teinte sert dans les DEUX rôles — encre sur la carte, et aplat sous une
   * encre blanche. Le contraste étant symétrique, un seul seuil couvre les deux ;
   * ce test le dit explicitement pour que personne ne « corrige » un seul rôle.
   */
  it('la pastille de baisse de prix est lisible dans ses deux rôles', () => {
    const src = readFileSync('src/components/matching-recherche/mrhCtx.ts', 'utf-8')
    const aplatTeinte = /MRH_PRICE_DROP\s*=\s*'(#[0-9a-fA-F]{6})'/.exec(src)?.[1]
    // ⚠ Ancré sur la VALEUR, pas sur la signature : un motif qui décrivait le
    // typage (`(dark: boolean): string =>`) se casse au premier refactor de
    // forme sans que la règle ait changé — une garde qui rougit pour rien se
    // fait désarmer, pas corriger.
    const encreSombre = /mrhPriceDropInk[\s\S]*?dark \? '(#[0-9a-fA-F]{6})'/.exec(src)?.[1]
    expect(aplatTeinte, 'MRH_PRICE_DROP introuvable — la garde ne mesure plus rien').toMatch(/^#/)
    expect(encreSombre, 'encre sombre introuvable — la garde ne mesure plus rien').toMatch(/^#/)

    const faibles: string[] = []
    // ── rôle ENCRE, sur les surfaces pleines de CHAQUE thème ──
    // ⛔ C'est ici que la première version de cette garde était trop courte : elle
    // ne mesurait que le clair. Assombrir la teinte pour passer sur blanc l'a
    // fait tomber à 3,97:1 sur la carte sombre — un correctif qui déplace le
    // défaut d'un thème à l'autre, et une garde qui l'aurait laissé passer.
    for (const [theme, encre, surfaces] of [
      ['clair', aplatTeinte as string, { carte: '#ffffff', 'sous-carte': '#f9f9f9' }],
      ['sombre', encreSombre as string, { carte: '#090909', 'sous-carte': '#050505' }],
    ] as const) {
      for (const [nom, surface] of Object.entries(surfaces)) {
        const r = contraste(encre, surface)
        if (r < AA) faibles.push(`encre ${theme} sur ${nom} = ${r.toFixed(2)}:1`)
      }
    }
    // ── rôle APLAT : encre blanche par-dessus, donc INVARIANT — l'aplat porte
    // son propre fond, il ne dépend pas du thème de la page. Une seule valeur
    // suffit, et c'est pour ça que les deux rôles ne peuvent pas partager la
    // même constante.
    const aplat = contraste('#ffffff', aplatTeinte as string)
    if (aplat < AA) faibles.push(`blanc sur l'aplat = ${aplat.toFixed(2)}:1`)
    expect(faibles, `sous ${AA}:1 :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⚠ UNE SEULE VALEUR POUR UN SEUL SENS. La teinte vivait en QUATRE exemplaires
   * — trois littéraux dans les composants de la Recherche et `--sys-yellow` dans
   * la feuille de l'atelier. Sur cette surface, une valeur dupliquée a toujours
   * fini par diverger (la table des statuts l'a fait trois fois). Les composants
   * lisent la constante : aucun ne la recopie.
   */
  it('la teinte de baisse de prix n’existe qu’en un exemplaire', () => {
    const src = readFileSync('src/components/matching-recherche/mrhCtx.ts', 'utf-8')
    const teinte = (/MRH_PRICE_DROP\s*=\s*'(#[0-9a-fA-F]{6})'/.exec(src)?.[1] ?? '').toLowerCase()
    expect(teinte, 'MRH_PRICE_DROP introuvable — la garde ne mesure plus rien').toMatch(/^#/)
    const litteraux: string[] = []
    for (const { nom, code } of RECHERCHE) {
      for (const m of code.matchAll(/#[0-9a-fA-F]{6}/g)) {
        if (m[0].toLowerCase() === teinte) litteraux.push(`${nom} — ${m[0]}`)
      }
    }
    expect(litteraux, `teinte recopiée au lieu d'être lue :\n  ${litteraux.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ UNE ENCRE TRANSLUCIDE N'EST PAS UNE ENCRE FAIBLE, C'EST UNE ENCRE QU'ON NE
   * MESURE PAS.
   *
   * `MrhExtDetail` déclarait `dot = dark ? 'rgba(255,255,255,.22)' : …` pour un
   * séparateur « · » — 1,68:1 en clair, 1,89:1 en sombre : un jeton qui n'existe
   * QUE pour être plus faible que ses voisins, et « plus faible » finit toujours
   * sous le plancher.
   *
   * ⚠ La garde compose l'ALPHA sur la surface — une valeur lue nue mentirait,
   * c'est le piège (b) du catalogue de sondes. Et elle ne vise que ce qui sert
   * d'ENCRE : `line` et `mapLine` sont des FILETS, ils n'ont pas à passer un
   * seuil de texte.
   */
  it('aucune encre translucide sous l’AA', () => {
    const compose = (rgba: string, fond: string): string => {
      const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/.exec(rgba)
      if (!m) return rgba
      const a = m[4] === undefined ? 1 : Number(m[4])
      const f = canal(fond)
      const v = [1, 2, 3].map((i, k) => Math.round(Number(m[i]) * a + f[k] * (1 - a)))
      return '#' + v.map((x) => x.toString(16).padStart(2, '0')).join('')
    }
    const faibles: string[] = []
    for (const { nom, code } of RECHERCHE) {
      for (const m of code.matchAll(/const (\w+) = dark \? '(rgba\([^']+\))' : '(rgba\([^']+\))'/g)) {
        const [, id, sombre, clair] = m
        // Seulement si la variable est employée comme ENCRE quelque part.
        if (!new RegExp(`color:\\s*${id}\\b`).test(code)) continue
        for (const [theme, valeur, surface] of [
          ['clair', clair, '#ffffff'],
          ['sombre', sombre, '#090909'],
        ] as const) {
          const r = contraste(compose(valeur, surface), surface)
          if (r < AA) faibles.push(`${nom} — ${id} (${theme}) = ${r.toFixed(2)}:1`)
        }
      }
    }
    expect(faibles, `encre translucide sous ${AA}:1 :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ UN SEUL CHEMIN POUR CHARGER LA MARQUE D'UNE RÉGIE.
   *
   * `MrhAgencyLogo` porte trois choses qui ne se voient pas dans une capture et
   * qu'une seconde implémentation perdrait en silence : le mémo d'échec PAR URL
   * (un booléen bloquerait une carte recyclée sur le repli), `referrerPolicy` à
   * `no-referrer` (le CDN est tiers, on ne lui envoie pas l'URL de l'app) et
   * `loading="lazy"` (la grille monte jusqu'à 400 cartes sans virtualisation).
   *
   * ⚠ La règle n'est donc pas « il faut un logo » mais « il n'y a qu'un endroit
   * qui en charge un ». Sur cette surface, une valeur ou une mécanique dupliquée
   * a toujours fini par diverger — la table des statuts l'a fait trois fois.
   */
  it('la marque des régies ne se charge qu’à un seul endroit', () => {
    const porteurs: string[] = []
    for (const { nom, code } of RECHERCHE) {
      if (nom.endsWith('MrhAgencyLogo.tsx')) continue
      // Une balise `img` dont la source est un logo de régie, écrite ailleurs
      // que dans le composant partagé.
      if (/<img[^>]*agency_logo_url/.test(code)) porteurs.push(nom)
      if (/agency_logo_url/.test(code) && !/MrhAgencyLogo/.test(code)) porteurs.push(`${nom} (lit la colonne sans passer par le composant)`)
    }
    expect(porteurs, `chargement de logo hors du composant partagé :\n  ${porteurs.join('\n  ')}`).toEqual([])
  })
})
```

Dans `tests/unit/matching-sans-sortie.spec.ts`, remplacer :

```ts
const MATCHING = [
  'src/components/matching-atelier',
  'src/components/matching-fil',
```

par :

```ts
const MATCHING = [
  'src/components/matching-fil',
```

Dans `tests/unit/matching-sans-sortie.spec.ts`, remplacer :

```ts
 * régie (`tel:`), comme `AtlAnnonceVue.tsx` : joindre l'agence vendeuse est le travail de l'agent,
```

par :

```ts
 * régie (`tel:`) : joindre l'agence vendeuse est le travail de l'agent,
```

Dans `tests/unit/megga-x-grammar.spec.ts`, remplacer :

```ts
  { root: 'src/components/matching-recherche', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/matching-atelier', keep: (n) => /\.tsx?$/.test(n) },
```

par :

```ts
  { root: 'src/components/matching-recherche', keep: (n) => /\.tsx?$/.test(n) },
```

Dans `tests/unit/megga-x-grammar.spec.ts`, remplacer :

```ts
const CSS_ASSUME = new Map<string, { graisse?: number; capitale?: number; interlettrage?: number; taille?: number }>([
  // ⚠ 55 marqueurs sur 143 payés le 15 août 2026 : les 44 graisses passent à
  // 600, et les CINQ micro-capitales partent AVEC leur interlettrage — sur de la
  // casse normale, un tracking positif disloque le mot, ils voyagent ensemble.
  // Restent les 88 tailles, dont 47 hors échelle : elles demandent un arbitrage
  // par site (17 valeurs distinctes, des demi-pas aux chiffres d'affichage), et
  // l'échelle PROPRE du fichier (`.t1`=13,5 px, `.t3`=17) en fait partie.
  ['src/components/matching-atelier/atelier.css', { taille: 88 }],
])
```

par :

```ts
const CSS_ASSUME = new Map<string, { graisse?: number; capitale?: number; interlettrage?: number; taille?: number }>([
  // Vide depuis le 27.09.2026 : sa seule entrée, `atelier.css` (88 tailles), est partie avec l'atelier de bureau
  // (lot E1). Une feuille qui porterait de la grammaire devra y entrer, ou être exemptée : c'est la clause « chaque
  // feuille CSS de src/ est lue ».
])
```

Dans `tests/unit/megga-x-grammar.spec.ts`, remplacer :

```ts
  ['src/components/map', { hors: 0, total: 4 }],
  // {37,50} -> {31,43} (21.09.2026) : la feuille d'envoi `AtlSendSheet` est retirée, « Je l'ai
  // proposé » n'envoie plus rien à l'acheteur.
  // {31,43} -> {23,33} (27.09.2026) : la couverture de premier lancement (`MatchingFirstRun`) quitte l'atelier
  // pour le fil (lot E1), qui l'accueille sans littéral — ses rayons et espacements y passent aux jetons.
  ['src/components/matching-atelier', { hors: 23, total: 33 }],
  ['src/components/matching-fil', { hors: 0, total: 0 }],
```

par :

```ts
  ['src/components/map', { hors: 0, total: 4 }],
  ['src/components/matching-fil', { hors: 0, total: 0 }],
```

Dans `tests/unit/megga-x-grammar.spec.ts`, remplacer :

```ts
      'src/components/matching-recherche',
      'src/components/matching-atelier',
      'src/pages/admin',
```

par :

```ts
      'src/components/matching-recherche',
      // Le fil de matchs tient la place de `src/components/matching-atelier`, sorti de cette liste le 27.09.2026 : le
      // dossier est parti avec l'atelier de bureau (lot E1).
      'src/components/matching-fil',
      'src/pages/admin',
```

Dans `tests/unit/couleur-barreaux.spec.ts`, remplacer :

```ts
  ['src/components/listings', 37],
  ['src/pages/dev', 26],
```

par :

```ts
  ['src/components/listings', 37],
  // 26 → 22 le 27.09.2026 : les fixtures du banc de l'atelier de bureau (`matchingAtelierFixtures`, quatre teintes
  // d'avatar hors barreaux) partent avec lui (lot E1).
  ['src/pages/dev', 22],
```

Dans `tests/unit/couleur-barreaux.spec.ts`, remplacer :

```ts
  ['src/types/visit.ts', 4],
  // 3 → 2 le 21.09.2026 : la feuille d'envoi `AtlSendSheet` est retirée.
  // 2 → 1 le 27.09.2026 : la couverture de premier lancement quitte l'atelier pour le fil (lot E1), et son anneau de
  // focus prend un barreau (`MXC_SYSTEM.blue300`) : le fil reste sans couleur hors barreaux.
  ['src/components/matching-atelier', 1],
  ['src/components/admin', 2],
```

par :

```ts
  ['src/types/visit.ts', 4],
  ['src/components/admin', 2],
```

Dans `tests/unit/dev-bancs-frontiere.spec.ts`, remplacer :

```ts
  // La décision de les geler est de PRODUIT, pas de direction artistique —
  // ce fichier ne fait que la rendre vérifiable.
  { chemin: 'src/pages/dev/SentryTestPage.tsx', route: '/dev/sentry-test' },
  { chemin: 'src/pages/dev/MatchingShowcasePage.tsx', route: '/dev/matching-atelier' },
  { chemin: 'src/pages/dev/MobileShowcasePage.tsx', route: '/dev/mobile' },
```

par :

```ts
  // La décision de les geler est de PRODUIT, pas de direction artistique —
  // ce fichier ne fait que la rendre vérifiable. Ils ne sont plus que six :
  // `/dev/matching-atelier` est parti avec l'atelier de bureau le 27.09.2026
  // (lot E1).
  { chemin: 'src/pages/dev/SentryTestPage.tsx', route: '/dev/sentry-test' },
  { chemin: 'src/pages/dev/MobileShowcasePage.tsx', route: '/dev/mobile' },
```

Dans `tests/unit/etat-vide.spec.ts`, remplacer :

```ts
   * ⚠ CE QUI N'Y EST PAS, ET POURQUOI — deux surfaces ont un vide qui n'est pas
   * un état vide, et les y forcer aurait perdu de l'information :
   *  · `RelanceSession` pose un cadre en TIRETS avec un appel à l'action. Le
   *    tireté dit « quelque chose vient ici » — c'est une invitation, pas un
   *    constat d'absence.
   *  · `AtlEmptyState` (atelier) est un ÉCRAN vide dessiné : quatorze libellés,
   *    une file, une annonce et un panneau « pourquoi ». Le réduire à un titre
   *    et une phrase supprimerait ce qu'il explique.
```

par :

```ts
   * ⚠ CE QUI N'Y EST PAS, ET POURQUOI — une surface a un vide qui n'est pas un
   * état vide, et l'y forcer aurait perdu de l'information :
   *  · `RelanceSession` pose un cadre en TIRETS avec un appel à l'action. Le
   *    tireté dit « quelque chose vient ici » — c'est une invitation, pas un
   *    constat d'absence.
```

- [ ] **Étape 8 : Le préfixe de console des gestes devient `[matching]`**

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
  if (rErr) console.error('[atelier] reminder close failed', rErr)
```

par :

```ts
  if (rErr) console.error('[matching] reminder close failed', rErr)
```

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
    if (dErr) console.error('[atelier] deal stage advance failed', dErr)
```

par :

```ts
    if (dErr) console.error('[matching] deal stage advance failed', dErr)
```

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
  if (error) console.error('[atelier] activity_events insert failed', error)
```

par :

```ts
  if (error) console.error('[matching] activity_events insert failed', error)
```

Dans `src/lib/matchingAnnulation.ts`, remplacer :

```ts
            console.error('[atelier] geste différé en échec', err)
```

par :

```ts
            console.error('[matching] geste différé en échec', err)
```

- [ ] **Étape 9 : Les commentaires disent ce qui est**

Ceux qui nommaient l'atelier comme lecteur vivant (la Recherche et son ajout à la sélection, les références des biens, la lecture plate du fil, les modales, la teinte de baisse de prix, le sceau vérifié, les bancs, le moteur) — et ceux qui disaient qu'une fiche n'a pas à charger le module des gestes, que la fiche d'un mandat charge pour « Planifier une visite » (tâche 5).

Dans `src/components/matching-recherche/MatchingRechercheHybride.tsx`, remplacer :

```tsx
  // de l'acheteur (RPC idempotente), où l'atelier et le fil les montrent. ⛔ Rien ne part
  // vers lui (21.09.2026) : c'est l'agent qui les lui proposera.
```

par :

```tsx
  // de l'acheteur (RPC idempotente), où le fil et l'écran mobile les montrent. ⛔ Rien ne
  // part vers lui (21.09.2026) : c'est l'agent qui les lui proposera.
```

Dans `src/hooks/useAjouterSelection.ts`, remplacer :

```ts
 * dans les matchs à proposer de l'acheteur (`suggested`), où l'atelier et le fil les montrent.
```

par :

```ts
 * dans les matchs à proposer de l'acheteur (`suggested`), où le fil et l'écran mobile les montrent.
```

Dans `src/hooks/useAjouterSelection.ts`, remplacer :

```ts
 * (`rejected`) ou reporté (`snoozed_until` à venir), il n'est PAS dans la file de l'atelier ni du
 * fil : le réactiver en silence déferait une décision prise. On le compte à part, et la Recherche
 * le dit.
```

par :

```ts
 * (`rejected`) ou reporté (`snoozed_until` à venir), il n'est PAS à proposer, ni dans le fil ni sur
 * l'écran mobile : le réactiver en silence déferait une décision prise. On le compte à part, et la
 * Recherche le dit.
```

Dans `src/hooks/useAjouterSelection.ts`, remplacer :

```ts
    // Les biens ajoutés doivent apparaître là où l'agent les proposera : l'atelier
    // (`atelier-matches`), le fil et sa sélection du marché (préfixe `CLE_FIL`), le mobile (`matches`).
```

par :

```ts
    // Les biens ajoutés doivent apparaître là où l'agent les proposera : l'écran mobile de Matching
    // (`atelier-matches`), le fil et sa sélection du marché (préfixe `CLE_FIL`), la fiche contact
    // mobile (`matches`).
```

Dans `src/hooks/useMatchingFil.ts`, remplacer :

```ts
 * ⛔ DES LECTURES PLATES, AUCUNE JOINTURE EMBARQUÉE. L'atelier charge tous les matchs de l'agence
 * avec `properties(*)` et `market_listings(*)` — descriptions et galeries comprises, 1 628 lignes
```

par :

```ts
 * ⛔ DES LECTURES PLATES, AUCUNE JOINTURE EMBARQUÉE. La lecture de l'atelier (`useAtelierMatching`,
 * que garde l'écran mobile) charge tous les matchs de l'agence avec `properties(*)` et
 * `market_listings(*)` — descriptions et galeries comprises, 1 628 lignes
```

Dans `src/hooks/useQuiPourCeBien.ts`, remplacer :

```ts
 * le module des gestes (`matchingGestes`) : une fiche n'a pas à le charger.
```

par :

```ts
 * le module des gestes (`matchingGestes`) : lire les acquéreurs d'un bien n'a pas à le charger. (La fiche d'un mandat
 * le charge pour « Planifier une visite » ; celle d'une annonce du marché, non.)
```

Dans `src/components/matching-fil/filModele.ts`, remplacer :

```ts
// le module des gestes (`matchingGestes`), et une fiche n'a pas à le charger pour lire une ligne.
```

par :

```ts
// le module des gestes (`matchingGestes`), et lire une ligne n'a pas à le charger — la fiche d'une annonce du
// marché ne le charge pas ; celle d'un mandat, pour « Planifier une visite ».
```

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
/** Référence affichée d'une annonce du marché — la même dans l'atelier et dans le fil de matchs. */
```

par :

```ts
/** Référence affichée d'une annonce du marché — la même depuis le fil de matchs et depuis l'écran mobile. */
```

Dans `src/lib/matchingGestes.ts`, remplacer :

```ts
/** Référence affichée d'un bien interne — la même dans l'atelier et dans le fil de matchs. */
```

par :

```ts
/** Référence affichée d'un bien interne — la même depuis le fil de matchs et depuis l'écran mobile. */
```

Dans `src/lib/modaleOuverte.ts`, remplacer :

```ts
 *      le composeur de la messagerie, les overlays de l'atelier…) ;
```

par :

```ts
 *      le composeur de la messagerie…) ;
```

Dans `src/components/matching-recherche/mrhCtx.ts`, remplacer :

```ts
 * `#E89B5A` n'est pas choisi non plus : c'est déjà le pendant sombre de
 * `--sys-yellow` dans `atelier.css` (`.sga[data-theme="dark"] .tone-yellow`). La
 * feuille connaissait la réponse ; les composants la lisent maintenant aussi.
```

par :

```ts
 * `#E89B5A` n'est pas choisi non plus : c'était le pendant sombre de `--sys-yellow`
 * dans la feuille de l'atelier de bureau (`.sga[data-theme="dark"] .tone-yellow`),
 * partie avec lui. La feuille connaissait la réponse ; les composants la lisent.
```

Dans `src/components/matching-recherche/MrhExtDetail.tsx`, remplacer :

```tsx
//    cadre local (même correctif que AtlOverlayHost côté atelier).
```

par :

```tsx
//    cadre local.
```

Dans `src/components/ui/VerifiedSeal.tsx`, remplacer :

```tsx
 * Le tracé existe déjà à cinq endroits du dépôt (`crm-mobile/contacts/ContactSeal`,
 * `crm-mobile/matching/MmVerifiedBadge`, `matching-atelier/AtlWhy` et `AtlQueue`,
 * `crm-dossiers` via la fiche contact). Les cinq lisent leur couleur dans un jeton de
 * thème — `useMobileTokens()`, `sp.*` — et sont donc INUTILISABLES dans le parcours
 * d'onboarding, qui vit sous `<MeggaX>` hors de tout ThemeProvider : les monter là lève
 * à l'exécution.
```

par :

```tsx
 * Le tracé existe déjà à trois endroits du dépôt (`crm-mobile/contacts/ContactSeal`,
 * `crm-mobile/matching/MmVerifiedBadge`, `crm-dossiers` via la fiche contact). Les trois
 * lisent leur couleur dans un jeton de thème — `useMobileTokens()`, `sp.*` — et sont donc
 * INUTILISABLES dans le parcours d'onboarding, qui vit sous `<MeggaX>` hors de tout
 * ThemeProvider : les monter là lève à l'exécution.
```

Dans `src/components/ui/VerifiedSeal.tsx`, remplacer :

```tsx
 * volontairement le seul écart avec les cinq autres, et c'est ce qui la rend partageable.
 * Les cinq copies ne sont pas réécrites dans le même geste — elles marchent, et les
 * rebrancher touche quatre surfaces sans rapport avec ce lot.
```

par :

```tsx
 * volontairement le seul écart avec les trois autres, et c'est ce qui la rend partageable.
 * Les trois copies ne sont pas réécrites dans le même geste — elles marchent, et les
 * rebrancher touche trois surfaces sans rapport avec ce lot.
```

Dans `src/pages/dev/PipelineShowcasePage.tsx`, remplacer :

```tsx
 * travail. Le piège ne ressemble pas à une erreur. Même idiome, mêmes raisons
 * que `/dev/matching-atelier`, `/dev/biens`, `/dev/contacts` et `/dev/mobile` —
 * permanent.
```

par :

```tsx
 * travail. Le piège ne ressemble pas à une erreur. Même idiome, mêmes raisons
 * que `/dev/biens`, `/dev/contacts` et `/dev/mobile` — permanent.
```

Dans `src/pages/dev/ModalesShowcasePage.tsx`, remplacer :

```tsx
 *   · `/dev/matching-atelier` → AtlConfirm, AtlAnnonceVue
 *   · `/dev/mobile`           → CrmBottomCard (et ses trois consommateurs),
```

par :

```tsx
 *   · `/dev/mobile`           → CrmBottomCard (et ses trois consommateurs),
```

Dans `src/pages/dev/ModalesShowcasePage.tsx`, remplacer :

```tsx
          sur leur propre écran — <code>/dev/matching-atelier</code>, <code>/dev/mobile</code>,
          {' '}<code>/dev/contacts</code> — et non ici.
```

par :

```tsx
          sur leur propre écran — <code>/dev/mobile</code>, <code>/dev/contacts</code> — et non ici.
```

Dans `supabase/functions/matching-engine/index.ts`, remplacer :

```ts
    // en Bearer. Le front (useMatching, atelier, écran mobile) envoie le JWT de l'agent, qui
```

par :

```ts
    // en Bearer. Le front (useMatching, écran mobile) envoie le JWT de l'agent, qui
```

- [ ] **Étape 10 : Relancer les tests**

```bash
npx vitest run tests/unit/matching-atelier-retire.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/ajouter-selection.spec.tsx tests/unit/i18n-globs-vivants.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/dev-bancs-frontiere.spec.ts tests/unit/matching-contraste.spec.ts tests/unit/etat-vide.spec.ts
```

Attendu : PASS, `Test Files  10 passed (10)`, `Tests  155 passed (155)`. Les cliquets tombent pile sur leurs comptes : `couleur-barreaux` `src/pages/dev` à 22, et `megga-x-grammar` sans zone ni feuille de l'atelier — l'inventaire B4 de `src/pages/dev` ne bouge pas ({6, 34}) : le banc de l'atelier n'écrivait ses rayons et espacements qu'en jetons. (Contrôles négatifs joués sur la spec neuve : `demo="ok"` remis dans `matchingFilBanc`, l'état `bloque` retiré du menu, un fournisseur à valeur figée, l'atelier remis dans le scanner, un commentaire de `src/` qui nomme encore `matching-atelier/` — chacun la fait rougir.)

- [ ] **Étape 11 : Relever ce qui nomme encore l'atelier**

```bash
grep -rln "matching-atelier" src scripts eslint.config.js
grep -rn "matching-atelier" tests
```

Attendu : le premier relevé ne rend rien. Le second rend dix-neuf lignes, toutes dans des gardes qui en refusent le retour (neuf dans `matching-atelier-retire.spec.ts`, quatre dans `matching-gestes-module.spec.ts`) ou dans des récits datés (`dev-bancs-frontiere.spec.ts:75`, `megga-x-grammar.spec.ts:743`, `:745`, `:1749`, `:2332`, `admin-console-css.spec.ts:4`).

- [ ] **Étape 12 : Vérifier**

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx eslint --quiet eslint.config.js scripts/i18n-scan.mjs scripts/lint-i18n-hardcoded.mjs src/App.tsx src/components/crm-mobile/matching/MmKyc.tsx src/components/crm-mobile/matching/MmMatchingScreen.tsx src/components/crm-mobile/matching/vm.ts src/components/crm-mobile/matching/types.ts src/components/crm-mobile/matching/format.ts src/components/crm-mobile/matching/composeAiHint.ts src/components/matching-fil/filModele.ts src/components/matching-recherche/MatchingRechercheHybride.tsx src/components/matching-recherche/MrhCard.tsx src/components/matching-recherche/MrhExtDetail.tsx src/components/matching-recherche/RechIcon.tsx src/components/matching-recherche/MrhIcon.tsx src/components/matching-recherche/mrhCtx.ts src/components/matching-recherche/mrhDemo.ts src/components/ui/VerifiedSeal.tsx src/hooks/useAjouterSelection.ts src/hooks/useAtelierMatching.ts src/hooks/useMatchingFil.ts src/hooks/useQuiPourCeBien.ts src/lib/matchingAnnulation.ts src/lib/matchingGestes.ts src/lib/modaleOuverte.ts src/pages/agent/MatchingPage.tsx src/pages/dev/CrmShowcasePage.tsx src/pages/dev/ModalesShowcasePage.tsx src/pages/dev/PipelineShowcasePage.tsx src/pages/dev/matchingFilBanc.tsx src/pages/dev/rechercheDuBanc.ts tests/unit/ajouter-selection.spec.tsx tests/unit/couleur-barreaux.spec.ts tests/unit/dev-bancs-frontiere.spec.ts tests/unit/etat-vide.spec.ts tests/unit/matching-contraste.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/matching-atelier-retire.spec.ts tests/backend/matching-gestes-contrat.spec.ts
```

Attendu : aucune sortie. (Sans `--quiet`, 4 avertissements, tous préexistants dans `MatchingRechercheHybride.tsx` — `react-hooks/exhaustive-deps`, lignes 191 et 465, 192 et 466 avant la tâche ; les quatre de l'atelier, `set-state-in-effect` et une mémoïsation non préservée, sont partis avec lui.)

```bash
deno check --no-lock supabase/functions/matching-engine/index.ts
```

Attendu : `Check supabase/functions/matching-engine/index.ts`, sortie 0 (un commentaire seul change).

```bash
npm run lint:deadcode
npm run lint:i18n
npm run i18n:parity:ci
npm run i18n:coverage:ci
npm run lint:prose
```

Attendu : `✓ Aucun export mort (baseline propre — dont 85 modules chargés en lazy, invisibles pour ts-prune).` (86 avant : le banc de l'atelier était l'un d'eux) ; `✓ i18n garde-fou OK — 0 texte FR en dur sur les surfaces agent verrouillées (i18next/no-literal-string).` ; parité `0 manquante(s), 0 orpheline(s), 1836 possiblement non traduite(s)` ; couverture `✓ Aucune régression vs référence` ; `✓ Typographie MEGGA OK — 56 fichiers i18n, 0 tell.` Aucune clé n'est touchée : les cent vingt-deux de l'atelier de bureau perdent leur dernier lecteur sans qu'aucune de ces portes le signale — leur retrait, dans les quatre langues, est la tâche 16.

Les gardes du retrait, des gestes, du pager, du jeton, des palettes et du stockage, et les bancs :

```bash
npx vitest run tests/unit/matching-atelier-retire.spec.ts tests/unit/matching-gestes-module.spec.ts tests/unit/matching-pager.spec.tsx tests/unit/jeton-arrivee.spec.tsx tests/unit/mobile-palette.spec.ts tests/unit/stockage-inventaire.spec.ts tests/unit/megga-x-crm-tokens.spec.ts tests/unit/banc-contacts-roles.spec.ts tests/unit/banc-matching-boucle.spec.ts tests/unit/banc-matching-d1.spec.ts tests/unit/banc-matching-e1.spec.ts tests/unit/banc-matching-explique.spec.ts tests/unit/banc-supabase.spec.ts
```

Attendu : PASS, `Test Files  13 passed (13)`, `Tests  144 passed (144)`.

Les specs qui chargent ou lisent un fichier touché — la Recherche et la pige, le fil et ses gestes, « Sa boucle », les fiches, les bancs, les routes et les redirections, les listes et les globs i18n, les palettes et le stockage :

```bash
npx vitest run tests/unit/activity-events-category.spec.ts tests/unit/ajouter-selection.spec.tsx tests/unit/banc-matching-e1.spec.ts tests/unit/clavier-ecran-cache.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/deal-ouvert.spec.ts tests/unit/dev-bancs-frontiere.spec.ts tests/unit/edge-secret-compare.spec.ts tests/unit/etat-vide.spec.ts tests/unit/fiche-qui-pour.spec.ts tests/unit/i18n-globs-vivants.spec.ts tests/unit/invite-link-origin-guard.spec.ts tests/unit/jeton-arrivee.spec.tsx tests/unit/kyc-magic-link-url.spec.ts tests/unit/labs-studio.spec.ts tests/unit/matching-atelier-retire.spec.ts tests/unit/matching-contraste.spec.ts tests/unit/matching-fil-apprendre.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-demarrage.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-signaux.spec.ts tests/unit/matching-gestes-module.spec.ts tests/unit/matching-pager.spec.tsx tests/unit/matching-sans-sortie.spec.ts tests/unit/matching-whatsapp-sql.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/messagerie-rattachement.spec.ts tests/unit/messagerie-spam-fil.spec.ts tests/unit/mobile-palette.spec.ts tests/unit/mrh-bouge.spec.tsx tests/unit/redirection-ouverte.spec.ts tests/unit/redirects-guard.spec.ts tests/unit/sa-boucle.spec.ts tests/unit/statut-clair.spec.ts tests/unit/stockage-inventaire.spec.ts tests/unit/token-routes.spec.ts tests/unit/whatsapp-matching-fil.spec.ts tests/unit/megga-x-crm-tokens.spec.ts tests/unit/i18n-listes.spec.ts tests/unit/lazy-prechargeable.spec.tsx tests/unit/crm-tabs.spec.ts tests/unit/crm-tabs-compte.spec.tsx tests/unit/mrh-historique-prix.spec.tsx tests/unit/pige.spec.ts tests/unit/fil-liens-arrivee.spec.ts tests/unit/matching-du-jour.spec.ts
```

Attendu : PASS, `Test Files  48 passed (48)`, `Tests  846 passed (846)`.

La spec de base renommée (`tests/backend/matching-gestes-contrat.spec.ts`) ne se joue pas ici : elle attend la base locale (colima), avec les autres specs de base du lot, à la tâche 17.

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint` en parallèle) :

```bash
npx vitest run
```

Attendu : `Test Files  3 failed | 346 passed (349)`, `Tests  1 failed | 5277 passed | 3 skipped (5281)` ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`. (5295 avant : la spec de la feuille emporte ses treize tests, `matching-contraste` passe de onze à cinq, la spec neuve en apporte cinq.)

Enfin le bundle, qui doit se construire sans l'atelier :

```bash
npm run build
grep -l "M22 17 13.5 8.5l-5 5L2 7" dist/assets/*.js
grep -l "aiHint.kycPhrase" dist/assets/*.js
ls dist/assets | wc -l
rm -rf dist
```

Attendu : le build sort à 0 (`✓ built in …`, puis le `postbuild` de la vitrine) ; le premier relevé rend le seul `dist/assets/MatchingPage-<empreinte>.js` — le tracé local de `MrhIcon` vit avec la Recherche ; le second, le seul `dist/assets/MobileMatchingPage-<empreinte>.js` — la phrase MEGGA AI vit avec l'écran mobile ; le troisième rend `645`, comme avant la tâche : le banc de l'atelier n'était déjà pas dans le bundle. `MatchingPage-*.js` passe de 181,18 à 181,14 kB, `MobileMatchingPage-*.js` de 48,50 à 48,34 kB ; `MatchingPage-*.css` reste à 2,95 kB.

---

## Tâche 16 : Les clés mortes partent (conception §6.3)

Mesuré, après les tâches 1 à 15 : le namespace `matching` porte 791 feuilles par langue — les quatre langues ont les mêmes, la porte de parité le garde —, et 214 n'ont plus aucun lecteur. Conception §6.3 : les clés du namespace que plus rien ne lit partent, une fois vérifié qu'aucune n'est composée dynamiquement. Une clé est lue si son chemin complet — ou sa base, pour un pluriel `_one` / `_other` — est écrit en littéral dans `src/` (un appel de `t`, une table de clés, un `i18nKey`, le préfixe `matching:`), ou si une clé composée en couvre la branche (`` t(`fil.motifs.${c.motif}`) ``, `i18n.t('matching:aiHint.kycPhrase.' + kyc)`). Le dépôt n'offre pas d'autre voie : ni `keyPrefix`, ni `returnObjects`, ni `Trans` sur ce namespace, aucune imbrication `$t(…)` dans les fichiers de langue, et pas de `fallbackNS` (`defaultNS` vaut `common`), si bien qu'un `t('title')` lié à un autre namespace ne lit jamais `matching`. Le namespace compose sous vingt préfixes, tous vivants, dont aucun ne couvre une clé qui part : `tabs.` (l'écran mobile, `` t(`tabs.${f}`) ``), `aiHint.kycPhrase.` (`composeAiHint`), `mobile.settings.`, `mobile.verdict.`, `firstRun.`, neuf de `fil.` et six de `recherche.`. Le relevé de l'étape 2, qui ne regarde pas le namespace d'un littéral, en croit lues treize de plus, et ne l'est aucune : `title` — un nom de champ, et le `t('title')` de neuf écrans liés à `listings`, `labs`, `kyc` ou `pipeline` et de l'écran d'erreur, qui lit `errorBoundary.title` —, `market`, `portfolio` et `running` — une source d'annonce, une question de l'appel d'accueil, une icône —, `empty.*` et `filter.*` — les clés composées `` `empty.${cle}Title` `` et `` `filter.${k}` `` du studio Labs, lues dans le namespace `labs`.

Les 214 : 123 que le retrait de l'atelier a laissées — `atelier.empty.scanError` à la bascule (tâche 13), puis 104 `atelier.*`, les neuf `cockpit.*`, huit `confirm.*` (la relance et les écrans de succès) et `empty.cta` au retrait (tâche 15) —, et 91 que plus rien ne lisait avant E1 : l'ancienne page de matching (`title`, `subtitle`, `runMatching`, `running`, `portfolio`, `market`, `kpi.*`, `filter.*`, `sort.*`, `empty.title`, `empty.desc`, `card.*`, `preview.*`, huit des neuf `panel.*`), 37 libellés de l'atelier (galerie de photos, prix, veille du marché, complétude du dossier…) et quatre de la Recherche (`recherche.omni.restore`, `recherche.omni.place`, `recherche.empty.seeNear`, `recherche.card.noPhoto`). Restent 577 feuilles, dont ce que l'écran mobile lit jusqu'au lot E2 (§6.3) — vingt clés d'`atelier`, les quatre `confirm.send*`, `panel.emptyTitle`, `atelierKyc.*`, `tabs.*`, `aiHint.*`, `mobile.*` — et, gardées exprès, `fil.quiPour.etat.refuse` et `refuseSansMotif` : l'état d'un compatible les nomme encore, et la copie du copilote WhatsApp y est confrontée (tâche 3). Aucune spec, aucun script ni aucune fonction de `supabase/` ne nomme une clé qui part : ce que le copilote confronte au fichier (`fil.motifs.*`, `fil.valeurs.parMois`, l'état d'un compatible) reste. Les quatre fichiers passent de 931 à 699 lignes. La commande les réécrit par `JSON.stringify(…, null, 2)`, qui les rend à l'octet près — elle le vérifie avant d'écrire, et refuse une clé absente : partent les lignes des clés retirées et des branches qu'elles vident (`kpi`, `filter`, `sort`, `empty`, `card`, `preview`, `cockpit`, et dans `atelier` `emptyStage` et `queueDone`), et six lignes par langue perdent leur virgule finale, la dernière clé restante de leur objet. Les portes suivent sans rien refiger : la couverture ne rougit qu'à une hausse — `matching` passe de deux chaînes non traduites à zéro, en allemand comme en italien (`portfolio`, `preview.online` et `atelier.no` partent) —, et sa référence se fige à la fin du lot (tâche 17), comme l'a dit la tâche 14 ; la parité compte 1 791 valeurs possiblement non traduites (1 836 avant).

Choix à valider : les quatre clés de la Recherche partent alors que la Recherche ne change pas (§7) — elles n'avaient déjà plus de lecteur avant E1, et aucun écran ne bouge ; les clés du mobile restent, et la spec épingle `atelier`, `confirm` et `panel` exactement à ce que l'écran mobile lit — le lot E2 la reprendra en le retirant ; `fil.quiPour.etat.refuse*` reste alors qu'aucune ligne ne l'atteint plus à l'exécution depuis la tâche 3 ; la spec refuse le retour de ce qui part, elle ne dépiste pas un orphelin futur — aucune garde générale « toute clé a un lecteur » n'est ajoutée ; la référence de couverture n'est pas refigée ici.

**Fichiers :**
- Créer (tests) : `tests/unit/matching-cles-mortes.spec.ts`
- Modifier : `src/i18n/locales/fr/matching.json`, `src/i18n/locales/de/matching.json`, `src/i18n/locales/en/matching.json`, `src/i18n/locales/it/matching.json`

- [ ] **Étape 1 : Écrire le test qui échoue**

Le namespace, lu dans ses quatre fichiers : au premier niveau, plus rien de l'ancienne page de matching ni du cockpit de l'atelier ; `atelier`, `confirm` et `panel` ne gardent que ce que l'écran mobile lit, et il le lit bien ; les quatre clés mortes de la Recherche sont parties ; `tabs.*`, `aiHint.*` et `fil.quiPour.etat.refuse*` sont là.

Créer `tests/unit/matching-cles-mortes.spec.ts` :

```ts
/**
 * Le namespace `matching` ne garde que ce qu'on lit (lot E1, conception `2026-09-27-matching-lot-e1-bureau-design.md`
 * §6.3). Le retrait de l'atelier de bureau a laissé 123 clés sans lecteur ; 91 l'étaient déjà avant E1 — l'ancienne
 * page de matching (`title`, `kpi`, `filter`, `sort`, `card`, `preview`, `panel`…), 37 libellés de l'atelier et
 * quatre de la Recherche. Les 214 sont parties des quatre langues. Aucune n'était lue par une clé composée : le
 * namespace ne compose que sous `tabs.`, `aiHint.kycPhrase.`, `mobile.settings.`, `mobile.verdict.`, `firstRun.`,
 * neuf préfixes de `fil.` et six de `recherche.`.
 *
 * Ce que cette spec refuse, dans chacune des quatre langues :
 *   · une branche retirée, revenue au premier niveau ;
 *   · dans `atelier`, `confirm` et `panel`, une clé que l'écran mobile ne lit pas — ce qu'ils gardent, c'est lui qui
 *     le lit, jusqu'au lot E2 ;
 *   · les quatre clés mortes de la Recherche ;
 *   · et, dans l'autre sens, la perte d'une clé gardée exprès : `tabs.*`, que le mobile compose (`tabs.${f}`),
 *     `aiHint.*`, que lit `composeAiHint`, et `fil.quiPour.etat.refuse*`, que l'état d'un compatible nomme encore et
 *     auquel la copie du copilote WhatsApp est confrontée.
 *
 * Lecture des fichiers : ce qu'on refuse est un contenu — des clés —, pas un écran.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const R = process.cwd()
const LANGUES = ['fr', 'de', 'en', 'it'] as const
const MOBILE = 'src/components/crm-mobile/matching'

type Arbre = { [cle: string]: string | Arbre }

const lire = (langue: string): Arbre =>
  JSON.parse(readFileSync(join(R, `src/i18n/locales/${langue}/matching.json`), 'utf8')) as Arbre

/** Les chemins complets des feuilles d'une branche, triés. */
function feuilles(o: Arbre, prefixe = ''): string[] {
  return Object.entries(o)
    .flatMap(([k, v]) => (typeof v === 'string' ? [prefixe + k] : feuilles(v, `${prefixe}${k}.`)))
    .sort()
}

/** Ce que gardent `atelier`, `confirm` et `panel` : ce que l'écran mobile lit, et rien d'autre. */
const GARDEES_PAR_LE_MOBILE = {
  atelier: [
    'budget', 'empty.desc', 'empty.scanCta', 'empty.scanning', 'empty.title', 'error.desc', 'error.retry',
    'error.title', 'later', 'matchedListings', 'minSurface', 'perMonth', 'searchProfile', 'seeDeal', 'specRooms',
    'targetZones', 'toast.later', 'toast.sent', 'toast.skipped', 'type',
  ],
  confirm: ['sendBody', 'sendCta', 'sendQuestion', 'sendTitle'],
  panel: ['emptyTitle'],
} as const

describe('les clés mortes du namespace `matching` sont parties', () => {
  it.each(LANGUES)('%s : ni l’ancienne page de matching, ni le cockpit de l’atelier, au premier niveau', (langue) => {
    expect(Object.keys(lire(langue)).sort()).toEqual([
      'aiHint', 'atelier', 'atelierKyc', 'confirm', 'fil', 'firstRun', 'mobile', 'pager', 'panel', 'recherche', 'tabs',
    ])
  })

  it.each(LANGUES)('%s : `atelier`, `confirm` et `panel` ne gardent que ce que l’écran mobile lit', (langue) => {
    const o = lire(langue)
    for (const [branche, gardees] of Object.entries(GARDEES_PAR_LE_MOBILE)) {
      expect(feuilles(o[branche] as Arbre), branche).toEqual([...gardees])
    }
  })

  it.each(LANGUES)('%s : les quatre clés mortes de la Recherche', (langue) => {
    const recherche = feuilles(lire(langue).recherche as Arbre)
    expect(recherche.length, 'la Recherche ne rend plus rien : la clause ne mesure rien').toBeGreaterThan(200)
    for (const morte of ['card.noPhoto', 'empty.seeNear', 'omni.place', 'omni.restore']) {
      expect(recherche, morte).not.toContain(morte)
    }
  })
})

describe('les clés gardées exprès', () => {
  it.each(LANGUES)('%s : `tabs.*`, `aiHint.*` et `fil.quiPour.etat.refuse*` sont là', (langue) => {
    const o = lire(langue)
    expect(feuilles(o.tabs as Arbre)).toEqual(['all', 'engaged', 'no-reply', 'to-send'])
    expect(feuilles(o.aiHint as Arbre)).toEqual([
      'aligned', 'daysAgo_one', 'daysAgo_other', 'default', 'engaged', 'engagedVisit', 'kycPhrase.none',
      'kycPhrase.pending', 'kycPhrase.stale', 'kycPhrase.verified', 'noReply', 'posNeg', 'recently', 'twoPos',
    ])
    const etat = ((o.fil as Arbre).quiPour as Arbre).etat as Arbre
    expect(etat.refuse, 'fil.quiPour.etat.refuse').toBeTruthy()
    expect(etat.refuseSansMotif, 'fil.quiPour.etat.refuseSansMotif').toBeTruthy()
  })

  it('ce que gardent `atelier`, `confirm` et `panel`, l’écran mobile le lit', () => {
    const code = readdirSync(join(R, MOBILE))
      .filter((f) => /\.tsx?$/.test(f))
      .map((f) => readFileSync(join(R, MOBILE, f), 'utf8'))
      .join('\n')
    for (const [branche, gardees] of Object.entries(GARDEES_PAR_LE_MOBILE)) {
      for (const cle of gardees) expect(code, `${branche}.${cle}`).toContain(`'${branche}.${cle}'`)
    }
  })
})
```

```bash
npx vitest run tests/unit/matching-cles-mortes.spec.ts
```

Attendu : ÉCHEC, `Test Files  1 failed (1)`, `Tests  12 failed | 5 passed (17)`. Les trois clauses de la première description tombent dans chaque langue : le premier niveau (`expected [ 'aiHint', 'atelier', …(22) ] to deeply equal [ 'aiHint', 'atelier', …(9) ]`), `atelier` (`atelier: expected [ 'activeSearch', …(161) ] to deeply equal [ 'budget', 'empty.desc', …(18) ]`) et la Recherche (`card.noPhoto: expected [ 'ajoutErreur', 'ajoute_one', …(208) ] to not include 'card.noPhoto'`). Les clés gardées exprès et la lecture du mobile sont déjà vertes : elles ne font que tenir.

- [ ] **Étape 2 : Vérifier que plus rien ne les lit**

Le relevé des lecteurs, sur `src/` : chaque tête de clé composée qui couvre une clé du namespace, avec les fichiers qui la composent, puis les clés qu'aucun littéral ne nomme et qu'aucune tête ne couvre, par branche. Il ne regarde pas le namespace d'un littéral : il se trompe dans le sens prudent, en croyant lue une clé nommée ailleurs.

```bash
node -e '
const fs = require("fs")
const path = require("path")
const feuilles = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [p + k] : feuilles(v, `${p}${k}.`)))
const cles = feuilles(JSON.parse(fs.readFileSync("src/i18n/locales/fr/matching.json", "utf8")))
const fichiers = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? fichiers(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []))
// Un littéral qui a la forme d’une clé (avec ou sans « matching: »), et la tête de chaque clé composée.
const litteraux = new Set()
const tetes = new Map()
for (const f of fichiers("src")) {
  const code = fs.readFileSync(f, "utf8")
  for (const m of code.matchAll(/["\x27`]((?:matching:)?[A-Za-z][\w.-]*)["\x27`]/g)) litteraux.add(m[1].replace(/^matching:/, ""))
  for (const m of code.matchAll(/`((?:matching:)?[A-Za-z][\w.-]*)\$\{|["\x27]((?:matching:)?[A-Za-z][\w.-]*)["\x27]\s*\+/g)) {
    const t = (m[1] ?? m[2]).replace(/^matching:/, "")
    if (t.length > 1 && cles.some((c) => c.startsWith(t))) tetes.set(t, new Set([...(tetes.get(t) ?? []), path.basename(f)]))
  }
}
console.log("Têtes composées qui couvrent une clé du namespace :")
for (const [t, f] of [...tetes].sort()) console.log(" ", t, "←", [...f].join(", "))
const sansLecteur = cles.filter((c) => !litteraux.has(c) && !litteraux.has(c.replace(/_(one|other)$/, ""))
  && ![...tetes.keys()].some((t) => c.startsWith(t)))
const parBranche = {}
for (const c of sansLecteur) {
  const b = c.includes(".") ? c.split(".")[0] : "(premier niveau)"
  parBranche[b] = (parBranche[b] ?? 0) + 1
}
console.log("Clés sans aucun lecteur :", sansLecteur.length, JSON.stringify(parBranche))
'
```

Attendu, mot pour mot :

```text
Têtes composées qui couvrent une clé du namespace :
  aiHint.kycPhrase. ← composeAiHint.ts
  empty. ← LabsGallery.tsx
  fil.criteres. ← FilListe.tsx, FilPanneau.tsx, FilSelection.tsx
  fil.equipementsNoms. ← FilCorrection.tsx, filValeurs.ts
  fil.etats. ← filValeurs.ts
  fil.etats.min. ← filValeurs.ts
  fil.kyc. ← FilPanneau.tsx
  fil.motifs. ← ContactDetailPager.tsx, FilCorrection.tsx, FilListe.tsx, FilMotifs.tsx, MatchingFil.tsx, filBoucle.ts
  fil.onglets. ← FilOnglets.tsx
  fil.palier. ← filAtomes.tsx
  fil.types. ← FilCorrection.tsx, filValeurs.ts
  filter. ← LabsApp.tsx
  firstRun. ← MatchingFirstRun.tsx
  mobile.settings. ← MmMatchingSettings.tsx
  mobile.verdict. ← MmVerdict.tsx
  recherche.bouge.vide. ← MrhBouge.tsx
  recherche.detail. ← MrhExtDetail.tsx
  recherche.fenetre.j ← MatchingRechercheHybride.tsx
  recherche.historique.genre. ← MrhHistoriquePrix.tsx
  recherche.reason. ← MatchingRechercheHybride.tsx
  recherche.vue. ← MatchingRechercheHybride.tsx, MrhBouge.tsx
  tabs. ← MmMatchingScreen.tsx
Clés sans aucun lecteur : 201 {"(premier niveau)":2,"recherche":4,"kpi":4,"sort":4,"card":4,"preview":16,"atelier":142,"cockpit":9,"confirm":8,"panel":8}
```

Aucune tête ne couvre une clé qui part, hors `empty.` et `filter.`, qui composent dans le namespace `labs` (`LabsGallery`, `LabsApp`). Les 214 retirées sont les 201 de la dernière ligne, plus les treize que le relevé croit lues à tort : `title`, `market`, `portfolio`, `running`, les trois `empty.*` et les six `filter.*`.

- [ ] **Étape 3 : Retirer les 214 clés des quatre langues**

| Branche | Part | Reste |
|---|---|---|
| premier niveau | `title`, `subtitle`, `runMatching`, `running`, `portfolio`, `market` — l'ancienne page de matching, morte avant E1 | — |
| `kpi`, `filter`, `sort`, `card`, `preview` | toute la branche (4, 6, 4, 4 et 16 clés) — idem | — |
| `empty` | toute la branche (3) — `title` et `desc` avant E1, `cta` avec l'état vide de l'atelier | — |
| `cockpit` | toute la branche (9) — le cockpit de l'atelier | — |
| `atelier` | 142 — 37 mortes avant E1, `empty.scanError` à la bascule, 104 au retrait | 20, que l'écran mobile lit |
| `confirm` | 8 — la relance (`followUp*`) et les écrans de succès (`success*`) de l'atelier | les 4 `send*`, que l'écran mobile lit |
| `panel` | 8 — l'ancien panneau de suggestions, mort avant E1 | `emptyTitle`, que l'écran mobile lit |
| `recherche` | 4 — `omni.restore`, `omni.place`, `empty.seeNear`, `card.noPhoto`, mortes avant E1 | 206 |

La liste exacte est celle de la commande, clé par clé : 6 + 34 + 3 + 9 + 142 + 8 + 8 + 4 = 214. Elle refuse une clé absente et un fichier qui ne serait pas déjà sous la forme de sa réécriture, supprime une branche que le retrait vide, et vérifie, avant d'écrire, que chaque ligne gardée est une ligne d'avant, dans le même ordre, à une virgule finale près.

```bash
node -e '
const fs = require("fs")
// Les clés du namespace que plus rien ne lit, branche par branche ("" : le premier niveau).
const MORTES = {
  "": [
    "title", "subtitle", "runMatching", "running", "portfolio", "market"
  ],
  recherche: [
    "omni.restore", "omni.place", "empty.seeNear", "card.noPhoto"
  ],
  kpi: [
    "totalMatches", "toSend", "sent", "contacts"
  ],
  filter: [
    "all", "suggested", "sentLabel", "internal", "marketLabel", "clear"
  ],
  sort: [
    "score", "priceAsc", "priceDesc", "recent"
  ],
  empty: [
    "title", "desc", "cta"
  ],
  card: [
    "sendTo", "sentBy", "noPhoto", "seeSheet"
  ],
  preview: [
    "rooms", "bedrooms", "surface", "floor", "year", "charges", "features", "compatibilityScore", "source", "agency",
    "pricePerM2", "online", "matchFor", "close", "seeAd", "sendToClient"
  ],
  atelier: [
    "fullListing", "listing", "openGallery", "openGalleryAria_one", "openGalleryAria_other", "viewListing",
    "viewFullListing", "mainPhoto", "noPhotoYet", "nextPhoto", "allPhotos", "collapseFilmstrip", "photo", "photos",
    "photoGallery", "morePhotos_one", "morePhotos_other", "photosCount_one", "photosCount_other", "previous", "next",
    "closeEsc", "copyRef", "refCopied", "salePrice", "rentPrice", "pricePerM2", "monthlyCharges", "chargesPerMonth",
    "priceDrop", "sectionSpecs", "sectionEssential", "sectionFeatures", "sectionDescription", "sectionLocation",
    "specSurface", "specBedrooms", "specBathrooms", "specFloor", "specYear", "specFurnished", "specPhotos",
    "floorLiftSuffix", "floorOrdinal", "roomsCount_one", "roomsCount_other", "roomsLabel", "bedsAbbr", "bathsAbbr",
    "yes", "no", "today", "marketWatch", "onMarket", "daysCount_one", "daysCount_other", "firstDetection",
    "photosCollected", "dossierCompleteness", "qualityVerified", "marketing", "contactVerified", "proposeToBuyer",
    "propose", "proposeToBuyers", "collapseSheet", "expandSheet", "activeSearch", "currentListing",
    "compatibilityScoreEst", "whyMatches", "whyMatchesCriteria_one", "whyMatchesCriteria_other", "strengths",
    "attentionPoints", "otherListingsMatch_one", "otherListingsMatch_other", "kycToComplete", "kycSoftReminder",
    "start", "interested", "notInterested", "proposeVisit", "dismiss", "buyerQueue", "searchBuyer", "queueEmpty",
    "noBuyerLeft", "matchedListingsCount", "scoreDesc", "queueProcessed", "allListingsSorted",
    "allListingsSortedBack", "whyThisListing", "snoozed", "snoozedCount", "reactivate", "reactivateNow", "backOn",
    "toastSentBuyer", "toastLaterListing", "toastDismissedBuyer", "toastBackInQueue", "neighborhoodLabel", "mapAlt",
    "closeAtelier", "buyerTitle", "listingTitle", "backToListing", "empty.scanError", "emptyStage.cockpitTitle",
    "emptyStage.cockpitSub", "emptyStage.queueAria", "emptyStage.queueEyebrow", "emptyStage.sortedBy",
    "emptyStage.queueTitle", "emptyStage.queueSub", "emptyStage.listingAria", "emptyStage.listingTitle",
    "emptyStage.listingSub", "emptyStage.whyAria", "emptyStage.whyTitle", "emptyStage.whySub", "queueDone.title",
    "queueDone.desc", "toast.relance", "toast.interested", "toast.rejected", "toast.backInQueue", "toast.seeDeal",
    "sendDossier", "priceBefore", "queueSortedBy", "sortByMatch", "sortByRelance", "toSchedule", "toScheduleCount",
    "scheduleThisWeek", "scheduleLater", "resume", "changeDate", "followedUp"
  ],
  cockpit: [
    "switchTitle", "switchHint", "switchAria", "currentListing", "browseAll", "filterAria", "processed",
    "progressAria", "queueDone"
  ],
  confirm: [
    "followUpTitle", "followUpQuestion", "followUpBody", "followUpCta", "successSendTitle", "successFollowUpTitle",
    "successSendBody", "successFollowUpBody"
  ],
  panel: [
    "loading", "loadError", "suggestionCount_one", "suggestionCount_other", "searchCompatible", "matchesFound_one",
    "matchesFound_other", "emptyDesc"
  ]
}
for (const langue of ["fr", "de", "en", "it"]) {
  const f = `src/i18n/locales/${langue}/matching.json`
  const avant = fs.readFileSync(f, "utf8")
  const o = JSON.parse(avant)
  // Le fichier a déjà la forme que sa réécriture produit : seules les clés retirées changeront.
  if (JSON.stringify(o, null, 2) + "\n" !== avant) throw new Error(`${langue} : forme inattendue`)
  for (const [branche, cles] of Object.entries(MORTES)) {
    for (const cle of cles) {
      const pas = branche ? [branche, ...cle.split(".")] : cle.split(".")
      const chaine = [o]
      for (const p of pas.slice(0, -1)) chaine.push(chaine[chaine.length - 1]?.[p])
      const parent = chaine[chaine.length - 1]
      const feuille = pas[pas.length - 1]
      if (typeof parent?.[feuille] !== "string") throw new Error(`${langue} : ${pas.join(".")} absente`)
      delete parent[feuille]
      // Une branche vidée part avec sa dernière clé.
      for (let i = pas.length - 1; i > 0 && Object.keys(chaine[i]).length === 0; i--) delete chaine[i - 1][pas[i - 1]]
    }
  }
  const apres = JSON.stringify(o, null, 2) + "\n"
  // Chaque ligne gardée est une ligne du fichier, dans le même ordre, à une virgule finale près.
  const lignes = avant.split("\n")
  let rang = 0
  let virgules = 0
  for (const l of apres.split("\n")) {
    while (rang < lignes.length && lignes[rang] !== l && lignes[rang] !== l + ",") rang++
    if (rang === lignes.length) throw new Error(`${langue} : ligne inattendue ${l}`)
    if (lignes[rang] !== l) virgules++
    rang++
  }
  fs.writeFileSync(f, apres)
  console.log(langue, lignes.length - apres.split("\n").length, "lignes retirées,", virgules, "virgules finales")
}'
```

Attendu : `fr 232 lignes retirées, 6 virgules finales`, puis la même ligne pour `de`, `en` et `it` — les 214 clés, et les 18 lignes d'ouverture et de fermeture des neuf branches vidées. Les six virgules : `recherche.omni.groupListings`, `atelier.empty.scanning`, `atelier.toast.skipped`, l'accolade qui ferme `atelier.toast`, `confirm.sendCta` et `panel.emptyTitle`, chacune devenue la dernière de son objet.

```bash
node -e 'for (const l of ["fr", "de", "en", "it"]) { const o = require(`./src/i18n/locales/${l}/matching.json`); const n = (x) => Object.values(x).reduce((s, v) => s + (typeof v === "string" ? 1 : n(v)), 0); console.log(l, n(o), Object.keys(o).length, n(o.atelier), n(o.confirm), n(o.panel), n(o.recherche)) }'
```

Attendu : `fr 577 11 20 4 1 206`, puis la même ligne pour `de`, `en` et `it` (avant la commande : `791 24 162 12 9 210`).

- [ ] **Étape 4 : Relancer le test**

```bash
npx vitest run tests/unit/matching-cles-mortes.spec.ts
```

Attendu : PASS, `Test Files  1 passed (1)`, `Tests  17 passed (17)`. (Contrôles négatifs joués sur une copie : `title` remis en allemand, `atelier.fullListing` remis en italien, `tabs.no-reply` retiré en anglais, `recherche.omni.restore` remis en français, `'atelier.seeDeal'` renommé dans `MmToast.tsx` — chacun fait tomber, seul, le test qui le vise.)

- [ ] **Étape 5 : Vérifier**

Relancer la commande de l'étape 2, telle quelle.

Attendu : les mêmes têtes, sans `empty.` ni `filter.` — elles ne couvrent plus rien du namespace —, puis `Clés sans aucun lecteur : 0 {}`.

```bash
npx tsc -b --force
```

Attendu : sortie 0, aucune ligne.

```bash
npx eslint tests/unit/matching-cles-mortes.spec.ts
```

Attendu : aucune sortie.

```bash
npm run lint:i18n
npm run i18n:parity:ci
npm run i18n:coverage:ci
npm run lint:prose
```

Attendu : `✓ i18n garde-fou OK — 0 texte FR en dur sur les surfaces agent verrouillées (i18next/no-literal-string).` ; parité `0 manquante(s), 0 orpheline(s), 1791 possiblement non traduite(s)` (1836 avant : quarante-cinq valeurs identiques au français partent avec les clés) ; couverture `✓ Aucune régression vs référence` — `DE  102/8324 non traduit`, `IT  36/8324 non traduit` (104/8538 et 38/8538 avant), et `matching` quitte la liste des namespaces à traduire (2/791 avant, dans les deux langues) ; la référence n'est pas refigée ici, le cliquet ne rougissant qu'à une hausse ; `✓ Typographie MEGGA OK — 56 fichiers i18n, 0 tell.`

Les specs qui lisent un fichier de langue ou chargent l'i18n, celles du studio Labs et les bancs (`grep -rl "matching.json\|i18n" tests/unit`, `tests/unit/labs-*`, `tests/unit/banc-*`) :

```bash
npx vitest run tests/unit/absence-signaux.spec.ts tests/unit/accept-invite-quitter-agence.spec.tsx tests/unit/admin-agency-health.spec.ts tests/unit/admin-kyb-review-reasons.spec.ts tests/unit/admin-refus-cycle-de-vie.spec.ts tests/unit/admin-refus-tiroir.spec.tsx tests/unit/agent-notifications-scenarios.spec.ts tests/unit/agent-notifications-titles.spec.ts tests/unit/audit-journal-acteurs.spec.tsx tests/unit/audit-journal-categories.spec.ts tests/unit/audit-journal-lignes.spec.ts tests/unit/aujourdhui-une-page.spec.ts tests/unit/banc-contacts-roles.spec.ts tests/unit/banc-matching-boucle.spec.ts tests/unit/banc-matching-d1.spec.ts tests/unit/banc-matching-e1.spec.ts tests/unit/banc-matching-explique.spec.ts tests/unit/banc-supabase.spec.ts tests/unit/contacts-roles-vocabulaire.spec.ts tests/unit/credits-confidentialite.spec.ts tests/unit/crm-tabs-compte.spec.tsx tests/unit/crm-tabs.spec.ts tests/unit/erreur-application.spec.tsx tests/unit/focus-score.spec.ts tests/unit/i18n-geo-first-contact.spec.ts tests/unit/i18n-globs-vivants.spec.ts tests/unit/i18n-language-handoff.spec.ts tests/unit/i18n-listes.spec.ts tests/unit/identity-shell-navigation.spec.ts tests/unit/identity-verification-refusal-copy.spec.ts tests/unit/jeton-arrivee.spec.tsx tests/unit/kyc-report-build.spec.ts tests/unit/lab-guard-banner.spec.tsx tests/unit/labs-organisation.spec.ts tests/unit/labs-studio.spec.ts tests/unit/magic-link-upload-errors.spec.ts tests/unit/mail-destinataires.spec.ts tests/unit/matching-atelier-retire.spec.ts tests/unit/matching-cles-mortes.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-demarrage.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/matching-pager.spec.tsx tests/unit/matching-sans-sortie.spec.ts tests/unit/megga-x-crm-tokens.spec.ts tests/unit/messagerie-corps-absent.spec.tsx tests/unit/messagerie-rattachement.spec.ts tests/unit/messagerie-spam-fil.spec.ts tests/unit/messagerie-timeline.spec.ts tests/unit/mrh-bouge.spec.tsx tests/unit/mrh-historique-prix.spec.tsx tests/unit/nouvel-onglet.spec.ts tests/unit/plan-quota-miroir.spec.ts tests/unit/sa-boucle.spec.ts tests/unit/stockage-inventaire.spec.ts tests/unit/vitrine-aide.spec.ts tests/unit/vitrine-i18n.spec.ts tests/unit/whatsapp-business-number.spec.ts tests/unit/whatsapp-matching-fil.spec.ts tests/unit/whatsapp-settings-otp-only.spec.ts tests/unit/whatsapp-usage.spec.ts
```

Attendu : PASS, `Test Files  61 passed (61)`, `Tests  1041 passed (1041)`.

Puis la suite unitaire entière, SEULE (ni `tsc`, ni `eslint` en parallèle) :

```bash
npx vitest run
```

Attendu : `Test Files  3 failed | 347 passed (350)`, `Tests  1 failed | 5294 passed | 3 skipped (5298)` ; seuls les trois échecs locaux connus, `mail/imap`, `mail/mime-parse` et `safe-internal-path`. (5281 avant : la spec neuve en apporte dix-sept.)

Enfin le bundle, qui doit se construire sans les textes retirés :

```bash
npm run build
grep -l "Lancer le matching\|Matcher une autre annonce\|Rétablir ses critères" dist/assets/*.js
grep -l "Aucun bien ne correspond encore aux critères de vos acheteurs" dist/assets/*.js
rm -rf dist
```

Attendu : le build sort à 0 (`✓ built in …`, puis le `postbuild` de la vitrine) ; le premier relevé ne rend rien — `runMatching`, `cockpit.switchTitle` et `recherche.omni.restore` ont quitté le bundle (avant la tâche, il rendait `dist/assets/i18n-<empreinte>.js`) ; le second, témoin que les textes du namespace vivent bien dans ce chunk, rend `dist/assets/i18n-<empreinte>.js`. Le chunk `i18n-*.js`, qui embarque le français, passe de 354,04 à 346,30 kB ; les trois `matching-*.js` chargés à la demande, de 31,91 à 23,75 kB (allemand), 29,24 à 21,81 kB (anglais) et 31,34 à 23,34 kB (italien).

---

## Tâche 17 : vérification, specs de la base, docs, cerveau, feuille de route, commits

- [ ] **Étape 1 : les portes**

```bash
npx tsc -b --force && npx eslint src tests --quiet
bash -c 'for g in lint:prose lint:i18n lint:deadcode lint:deps lint:types-freshness lint:roster lint:edge-auth lint:email-shell lint:migrations lint:whatsapp-outbound lint:spec-sql i18n:parity:ci i18n:coverage:ci check:privileges; do printf "%-28s" "$g"; npm run --silent $g >/dev/null 2>&1 && echo "✓" || echo "✗"; done'
find supabase/functions -name '*.ts' ! -name '*.test.ts' ! -path '*/_shared/mail/*' ! -path '*/mail-*' -print0 | xargs -0 deno check --no-lock
```

Attendu : `tsc`, `eslint` et `deno check` à 0, « ✓ » partout. ⚠ Le `deno check` écarte la messagerie **sur cette machine seulement** (`postal-mime` manque au `node_modules` local) ; la CI contrôle tout. ⚠ `check:privileges` et `lint:claude-md` ont besoin de `SUPABASE_ACCESS_TOKEN` : sans lui, ils ne mesurent qu'une partie et le DISENT — ne pas les compter verts pour autant.

- [ ] **Étape 2 : la suite unitaire, SEULE**

```bash
npx vitest run
```

Attendu : aucune régression. Trois échecs sont connus et hors sujet en local : `mail/imap`, `mail/mime-parse`, `safe-internal-path`. Tout autre rouge se rejoue d'abord seul.

- [ ] **Étape 3 : le build**

```bash
npm run build && rm -rf dist
```

Attendu : sortie 0. Mesuré à l'écriture du plan (27.09.2026) : `MatchingPage-*.css` passe de 50,26 à 2,95 kB (la feuille de l'atelier part), `TodayPage-*.js` de 122,97 à 68,92 kB (le catalogue part), le fil entre dans `MatchingPage-*.js` (166 → 181 kB).

- [ ] **Étape 4 : les specs de la base, en local, AVANT la fusion**

`backend.yml` ne tourne que sur une PR ou un push vers `main` : les specs de base de la pile ne tournent donc nulle part tant qu'on ne les joue pas ici. Sur la machine de Julien, le port 54321 est tenu par GeoPort (ne pas le tuer) : la pile locale se lance depuis une COPIE de `supabase/`, SOUS `$HOME` (colima ne monte que le dossier personnel), aux ports décalés.

```bash
colima start
```

⚠ colima relance seul les 12 conteneurs de Plane (`plane-*`, politique `always`) ; ils s'arrêtent avec lui à la fin.

```bash
rm -rf ~/.cache/megga-e1-verif && mkdir -p ~/.cache/megga-e1-verif && cp -R supabase ~/.cache/megga-e1-verif/supabase
python3 - <<'PY'
import os, re
chemin = os.path.expanduser('~/.cache/megga-e1-verif/supabase/config.toml')
t = open(chemin, encoding='utf-8').read()
t = re.sub(r'^project_id = ".*"$', 'project_id = "megga-e1-verif"', t, count=1, flags=re.M)
for ancien, nouveau in [('54321', '55321'), ('54322', '55322'), ('54320', '55320'), ('54329', '55329'),
                        ('54323', '55323'), ('54324', '55324'), ('54327', '55327'), ('8083', '8183')]:
    t = re.sub(rf'= {ancien}\b', f'= {nouveau}', t)
open(chemin, 'w', encoding='utf-8').write(t)
PY
npx -y supabase@2.111.0 start --workdir ~/.cache/megga-e1-verif
npx -y supabase@2.111.0 status --workdir ~/.cache/megga-e1-verif
```

Relever dans `status` les deux clés (publishable et secret), puis jouer la suite de base avec :

```bash
SUPABASE_TEST_DB_CONTAINER=supabase_db_megga-e1-verif \
SUPABASE_TEST_URL=http://127.0.0.1:55321 \
SUPABASE_TEST_ANON_KEY=<clé publishable de status> \
SUPABASE_TEST_SERVICE_ROLE_KEY=<clé secret de status> \
SUPABASE_TEST_SERVICE_ROLE_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU \
MEGGA_MAGIC_LINK_HMAC_SECRET=test-hmac-secret-for-local-backend-suite-0123456789 \
npm run test:backend
```

Attendu : tout vert, en particulier les specs d'E1 — `tests/backend/matching-renotation.spec.ts` (R1 à R3, tâche 9), `tests/backend/matching-boucle.spec.ts` (B7, B8), `tests/backend/matching-whatsapp.spec.ts` (W7, tâche 10), `tests/backend/matching-gestes-contrat.spec.ts` (tâche 15), et `tests/backend/region-fonctions-base.spec.ts` (l'épingle de région). ⚠ Deux échecs sont propres à cette machine : `today-absence` (`presence_touch`) et `mail-edges` (bail de `mail-sync`), l'horloge de la VM colima avançant de ~19 ms sur le Mac ; la CI ne les voit pas. ⚠ `execSql` a besoin de `SUPABASE_TEST_DB_CONTAINER`, sinon il cherche le conteneur du `project_id` du dépôt et les specs à SQL brut rougissent pour rien.

Puis l'EXPLAIN de la lecture de nuit (`couplesARattraper`, tâche 9 : `agency_id`, `status = 'suggested'`, `score_version` nul ou antérieur, ordre `contact_id, score desc, id`), sur une base presque vide, index forcés :

```bash
docker exec -i supabase_db_megga-e1-verif psql -U postgres -d postgres <<'SQL'
set enable_seqscan = off;
explain select id, contact_id, client_search_id, score, score_version, reasons, status
  from public.matches
 where agency_id = '00000000-0000-0000-0000-000000000000'
   and status = 'suggested'
   and (score_version is null or score_version < 4)
 order by contact_id, score desc, id
 limit 1000;
SQL
```

Attendu : un parcours de `idx_matches_agency_focus` (`agency_id, contact_id, score desc`, partiel sur `status = 'suggested'`), au plus sous un tri incrémental pour `id` — pas de `Seq Scan`. Arrêter ensuite la pile et colima :

```bash
npx -y supabase@2.111.0 stop --workdir ~/.cache/megga-e1-verif
colima stop
```

- [ ] **Étape 5 : les docs**

- `docs/system-map.md` :
  - §6 E (matching), un paragraphe « Lot E1 (27.09.2026, sur branche, fusion à la fin) » : le fil en page 0 et l'arrivée sur lui ; le jeton d'arrivée (`src/lib/jetonArrivee.ts`, `useArrivee`) ; la couverture de premier lancement et ses deux états ; « en vente » (règle de `get_matches`) dans le fil, la fiche, « Sa boucle », « Planifier une visite » et `record_match_outcome` ; `dealOuvert` (`src/lib/dealOuvert.ts`) partout où un geste cherche le deal d'un acheteur ; `match_reactive` ; la renotation (`match-contact` et le rattrapage de `scan-all`, ≤ 2 000 couples par agence et par nuit, journal seulement si une note change) ; l'atelier et le catalogue retirés ;
  - les passages devenus faux (relevés à l'écriture du plan) : l.371, l.375 (le cockpit « 2 pages… Catalogue de matchs »), l.458, l.484 et l.645 (`useAtelierMatching` adresse des gestes → `src/lib/matchingGestes.ts` ; « Sa boucle » : le mandat hors vente et la règle des « Proposés »), l.643 (la visite sans envoi au client vaut aussi pour la fiche d'un mandat ; la renotation), l.822 (les familles i18n verrouillées : `matching-fil`, plus `matching-atelier`).
- `docs/pages.md` vers l.173 (la page de l'atelier retirée ; `/dashboard/matching` = le fil).
- `CLAUDE.md` §8, ligne « CRM agent », après la phrase du lot D2 : une phrase sur E1, sur branche. §3 : « 41 fichiers appellent `createPortal` » — remesurer (`grep -rl createPortal src | wc -l` ; 43 à l'écriture du plan).
- `docs/CHANGELOG.md` : le lot E1 (dont le changement de bundle, étape 3, et les 214 clés du namespace `matching` retirées à la tâche 16).
- La référence de couverture i18n, refigée : les tâches 14 et 16 retirent 293 clés, et la porte ne rougit qu'à une hausse — sans ce geste, sa référence garderait un plafond que le dépôt n'atteint plus.

```bash
npm run i18n:coverage:update && npm run i18n:coverage:ci
```
- `docs/handoff/crm-mobile/MATCHING_SPEC.md` : il cite `MatchingAtelierPage` quatre fois — dire que la page de bureau est retirée et que le mobile garde son écran jusqu'au lot E2.
- Les conceptions et plans voisins devenus faux : conception du fil (§10 : « lot 3 » et « lot 4 » sont E1 et E2 ; l.317 « le deal actif » → ouvert) ; conception D2 (l.133 « Un mandat garde sa place quel que soit son statut » ; l.139 « l'actif ») ; plan D2 (l.687 et 946 « l'actif » ; l.4995 « `record_match_outcome` et le fil gardent tous les mandats »).
- `tests/e2e/agent-dashboard.spec.ts` l.4-6 : son commentaire daté parle encore de la « page Catalogue montée dans le pager ».
- `docs/superpowers/feuille-de-route.md` : l'état de l'étape 5a.
- Cerveau (`.claude-flow/knowledge/megga-memory.seed.json`) :
  - une entrée `megga/matching-bascule-bureau` (le lot E1 : ce qui est fait ; les pièges — un lien d'arrivée se consomme par son jeton, jamais en réécrivant l'adresse ; « perdu » est l'étape `lost`, pas un statut ; un ajout à la main de la Recherche n'a pas de version et ne se renote pas ; la couverture n'apparaît ni en chargement ni en erreur ; E1 suffit à D1 et D2 ; E2 suit) ;
  - les entrées périmées : `megga/matching-ui-hooks` (l'atelier « SEULE surface »), `megga/matching-fil` (lots 3 et 4), `megga/ai-matching-spec` (« envoi 1 clic »), `megga/matching-data-model` (« Envoyer le dossier » ; un match sans version « n'est pas renoté »), `megga/matching-boucle` (même nuance ; « EN ATTENTE : la renotation de toute recherche modifiée » est faite) ; les entrées qui citent `useAtelierMatching` comme adresse des gestes, `pendingTriage`, `PlanifierVisite`, `MatchingAtelierPage`, `MatchingFirstRun` (vers l.1125) ou le catalogue (vers l.15, 87, 1851) ;
  - puis `npm run ruflo:seed`.
- Le plan : ses « Écarts à l'exécution » et ses « En attente », comme pour D1 et D2.

```bash
npm run lint:prose && npm run lint:claude-md
```

- [ ] **Étape 6 : les commits, au signal de Julien**

Un commit par sujet, dans l'ordre des tâches, bâti depuis la photo de l'arbre prise à la fin de sa tâche ; chacun doit compiler (`tsc -b --force`) et passer la suite unitaire SEUL — le vérifier dans une copie jetable, `node_modules` lié :

```
refactor(matching): les gestes quittent l'atelier                                              (tâche 1)
fix(matching): le fil ne propose plus un mandat qui n'est plus en vente                        (tâche 2)
fix(matching): « Qui pour ce bien ? » sans les refus, et jamais sur un mandat hors vente        (tâche 3)
fix(contacts): « Sa boucle » ne compte plus un bien revenu parmi les proposés                  (tâche 4)
fix(biens): « Planifier une visite » n'écrit plus à un acquéreur compatible                    (tâche 5)
feat(matching): « Réactiver » au journal                                                        (tâche 6)
fix(whatsapp): le copilote ne consigne plus « proposé » sur un mandat hors vente               (tâche 7)
fix(contacts): le titre de « Sa boucle » compte ce qu'il liste                                 (tâche 8)
feat(matching): le moteur renote une recherche modifiée et, la nuit, les versions anciennes   (tâche 9)
fix(matching): un deal perdu ne reçoit plus de geste neuf                                      (tâche 10)
fix(matching): un lien d'arrivée ne s'applique qu'une fois                                     (tâche 11)
feat(matching): le premier lancement du fil                                                    (tâche 12)
feat(matching): le fil devient le Matching du bureau                                           (tâche 13)
refactor(aujourdhui): « Aujourd'hui » à une page, le catalogue retiré                          (tâche 14)
refactor(matching): l'atelier de bureau retiré                                                 (tâche 15)
chore(i18n): les clés mortes du matching partent                                               (tâche 16)
docs(matching): le lot E1 — conception, plan, carte et cerveau                                 (tâche 17, + la conception et la feuille de route)
```

---

## Décisions prises (rappel)

Toutes de Julien, le 27.09.2026.

1. **Le lot E est coupé en deux**, comme D : E1 le bureau, puis E2 le téléphone.
2. **Le périmètre d'E1** : le fil en page 0 et l'arrivée sur lui ; le retrait de l'atelier de bureau ; la garde i18n étendue au fil ; le lien d'arrivée appliqué une fois ; un premier lancement et le journal de « Réactiver » ; la renotation d'une recherche modifiée ; le retrait du catalogue d'« Aujourd'hui ».
3. **13a** : « Qui pour ce bien ? » du fil écarte les refus, comme les fiches.
4. **12a** : un mandat qui n'est plus en vente (`active` et non supprimé, la règle de `get_matches`) sort de ce qui se propose — fil, fiche, « Sa boucle », « Planifier une visite », et le copilote WhatsApp (`record_match_outcome`, décision prise pendant l'écriture du plan) ; « En attente » et « À conclure » le gardent, avec son état ; ses refus nourrissent encore « Apprendre ».
5. **10a** : « Sa boucle » s'aligne sur le fil — un bien revenu n'y compte plus parmi les « Proposés » ; le titre de sa liste compte ce qu'il liste (« Ses biens (N) », décision prise pendant l'écriture du plan).
6. **9c** : « Planifier une visite » garde les acquéreurs compatibles, sans message pré-rempli ; le pré-remplissage reste pour un acheteur en deal ouvert ; pour un compatible, la visite suit la règle du fil et de WhatsApp (aucun rappel au client ; seul un match « intéressé » passe en « visite planifiée »).
7. **La renotation B** : quand les critères changent, et chaque nuit pour les couples d'une version antérieure (sans version compris), au plus 2 000 par agence ; seuls les couples « à proposer ».
8. **Le premier lancement A** : la couverture de l'atelier, reprise, textes corrigés ; « Ajouter un acheteur » ouvre la création d'un contact.
9. **Le relogement A** : le dossier `matching-atelier/` disparaît en E1 ; ce qui survit rejoint son lecteur.
10. **Un deal perdu ne reçoit plus de geste neuf** (décision prise pendant l'écriture du plan) : un deal est ouvert si son statut est `active` ou `on_hold` et que son étape n'est pas `lost` — dans le fil comme dans le copilote WhatsApp.

## En attente (hors périmètre — rien n'est fait sans accord de Julien)

- **De la conception (§10)** : paginer la boucle du fil et plafonner ses `.in()` (la production en est loin : boucle vide, 4 acheteurs avec une sélection du marché, 27.09.2026) ; `?annonce=m:` et « Chercher plus loin dans Recherche » (aucune surface n'y mène) ; l'e-mail d'avis après une visite du fil (aucune agence n'a de règle `visit_completed`) ; « Qui pour ce bien ? » du fil garde les acheteurs déjà en deal, que la fiche écarte ; le lot E2 ; les décisions encore attendues de la feuille de route (6, 7, 8, 11).
- **Relevé à l'écriture du plan (27 et 28.09.2026)** :
  - « Sa boucle » : un bien revenu sur un mandat hors vente s'affiche sans lien, sans dire pourquoi (le point « un revenu sans place ne dit pas pourquoi », déjà en attente depuis D1).
  - La fiche d'un bien : `useCreateAgentVisit` (fiche, `VisitNewPage`) n'écrit aucune ligne au journal, quand l'écrivain du fil journalise `visit_scheduled` ; « Acheteurs en cours » et `exclure={enDeal}` comptent encore les deals perdus (la règle `dealOuvert` ne gouverne que les gestes et le pré-remplissage) — et, depuis le 29.09.2026, les deals archivés : un acheteur au deal archivé y est caché, et proposé comme acquéreur dans « Planifier une visite ».
  - Le copilote WhatsApp, hors matching : `create_deal` (`execCreateDeal`) refuse d'ouvrir un dossier dès qu'un dossier `active` existe, même perdu ; `record_offer` (`resolveContactDeal`) vise le plus récent, quel qu'il soit.
  - Le pager : la prop `atterrissage` n'a plus d'appelant pour sa valeur `'recherche'`.
  - « Aujourd'hui » : trois images clés sans lecteur (`focus-ping`, `fmRise`, `m2pulse`), déjà sans lecteur avant E1 ; deux phrases d'en-tête fausses dans `TodayPage` et `PageAujourdhuiH` (« reste au dépôt », « données de démonstration »).
  - Les specs : `tests/unit/matching-fil-gestes.spec.ts` porte deux erreurs de type anciennes (TS2353, l.163 et 190 : `email` hors d'`AcheteurGeste` ; trois à l'écriture du plan), invisibles à Vitest comme à la CI, qui ne type-vérifient pas les specs.
- **Relevé à l'exécution (28 et 29.09.2026)** :
  - ✅ **Tranché par Julien le 29.09.2026** — la recommandation, sept fois (feuille de route, « Tranché le 29.09.2026 ») ; ce qui suit dit où le dépôt l'applique :
    1. l'acquéreur INTÉRESSÉ en deal ouvert suit, sur la fiche d'un bien, la règle du fil (`visiteurs.ts`) : l'écrivain du fil, qui rattache la visite au deal de CE bien (`VisiteAPlanifier.deal`, que la fiche lui passe — `rattacherDeal`, sans lui, prend le plus récent de l'acheteur, tous biens confondus), sans message pré-rempli ni rappel la veille ; tant que les compatibles ne sont pas lus, rien ne part, acheteur en deal compris ;
    2. l'écart « recherche ajustée » est récupérable : `match-contact` et `rescore-search` relisent, avec les « à proposer » d'une recherche, les matchs que le moteur en a écartés, et `matching_appliquer_notes` (lot B, corrigée en place) fait revenir à proposer, motif effacé, ceux que la note retient sur un bien qui se propose encore (une annonce vivante, un mandat en vente) ; un écart de l'agent n'est jamais relu (« Écarter » efface le motif, `execDismiss` : sans quoi un écart du moteur encore à l'écran, écarté par l'agent, reviendrait), la nuit (`scan-all`) reste sur les « à proposer ». ⚠ Le déclencheur des critères ne part que si `criteria` change (`NEW.criteria IS DISTINCT FROM OLD.criteria`) : pas sur un prénom. Mesuré en lecture seule le 29.09.2026 : la première nuit en v4 écarterait au moins 473 des 1 950 « à proposer » (une agence, quatre recherches), tous hors du pré-filtre des critères actuels — 449 sur une annonce hors du canton cherché, dont environ 360 notés sans version par le moteur de juin sur toute la Suisse ; 38 d'un autre type de transaction ; le reste sans prix ou hors budget, les clauses se recoupant —, et au plus 199 de plus (notes stockées de 55 à 59, seuil 55). Aucun sur une annonce retirée ; aucun match n'était encore écarté par le moteur ;
    3. un deal archivé (`archived_at`) n'est pas ouvert (`dealOuvert`, `rattacherDeal`, `wa_matching_consigner`, `wa_matching_visite`) ;
    4. la couverture garde sa condition : aucune recherche active ET aucun match lu ;
    5. le « relancer le moteur » de l'atelier n'est pas repris : la renotation d'une recherche modifiée et la nuit en tiennent lieu ;
    6. « Proposer à des acheteurs » ouvre « À proposer » filtré sur le mandat (`lienFil({ onglet: 'aProposer', bien })`, avec un jeton) ; hors vente, le bouton ne paraît plus (règle 12a : il ne menait qu'à une liste vide) ;
    7. la racine du fil prend un focus perdu (`<body>`, une page inerte, la puce d'onglet d'un écran qu'on cache, `aria-hidden`) quand le fil est montré — son écran, sa page du pager (`montre`) — et à chaque arrivée neuve, jamais sous une modale (`modaleOuverte`) ; un clic de souris sur les commandes du pager ne leur donne pas le focus.
  - **À proposer.** Un prédicat « en vente » unique (la règle est écrite à cinq endroits) ; l'étiquette « À proposer » d'un compatible sous « n'est plus disponible » ; un bien revenu sans place peint comme une occasion dans « Sa boucle » ; « Ses biens (N) » qui peut se lire « les biens qu'il possède ».
  - **Le fil et ses gestes.** L'écrivain du fil rattache un geste au deal ouvert le plus RÉCENT de l'acheteur, tous biens confondus (`rattacherDeal`, comme `wa_matching_visite`) : un acheteur qui a deux deals ouverts peut voir la visite d'un bien rattachée au deal d'un autre — la fiche d'un mandat, elle, passe le deal de ce bien (`VisiteAPlanifier.deal`). Sur la fiche, tant que les compatibles ne sont pas lus (chargement, lecture en échec), la visite part dégradée : sans rappel pour un acheteur en deal, sans « visite planifiée » pour un intéressé, que le fil proposera encore de planifier ; piste : attendre la lecture. « Je l'ai proposé » marque le match `sent` AVANT de chercher le deal : une erreur ensuite laisse un match proposé sans deal ni relance (la vraie correction est transactionnelle) ; la fiche choisit le deal le plus récent par `updated_at`, les gestes par `created_at` ; les lignes de journal de « Plus tard », « Écarter » et « Réactiver » ne sont pas idempotentes et ne nomment pas le bien ; `execSnooze` et `execWake` n'examinent pas l'erreur du rappel ; `ignoreMatch` et `markReaction` de `useMatching` sont morts.
  - **La renotation.** `scan-all` ignore une erreur de lecture de `client_searches` ou de `properties` (une nuit à vide rend `echecs: 0`) ; un couple choisi mais jamais écrit (recherche sans critère) garde sa version et reconsomme le plafond chaque nuit ; le banc `renoterBanc` compte encore tout match renoté dans `reevalues`, et ne simule pas le retour d'un écarté. Depuis l'écart récupérable (29.09.2026) : un match revenu perd le motif `prix` d'un bien revenu par une baisse, que l'écart avait écrasé ; le radar `match_ignored` d'`automation-engine` peut le signaler dès son retour (`created_at` ancien) ; le toast d'« Apprendre » dit les écartés, pas les `retours` ; deux renotations concurrentes d'une même recherche (deux changements de critères rapprochés, chacun par pg_net) peuvent laisser un écart périmé jusqu'à la suivante, et compter un retour à tort ou pas du tout (l'écrivain ne rend pas l'état d'avant) ; les écartés du moteur ne sont jamais purgés et se relisent à chaque renotation de leur recherche (≥ 473 après la première nuit en v4 — piste : les purger sur une annonce retirée, sans `sent_at`) ; pendant la bascule, un onglet resté sur l'ancien bundle écarte sans effacer le motif (`useAtelierMatching` de `main`), et son écart pourrait revenir — piste : un déclencheur qui efface le motif d'un `ignored` écrit par un utilisateur.
  - **Le deal perdu, hors matching.** `weekly-digest`, `weekly-report` et `admin-monitoring` comptent les deals perdus parmi les actifs ; `resolveContactDeal` sert aussi `update_pipeline`.
  - **Le jeton d'arrivée et le chrome.** `fermer` et `fermerAutres` (`useCrmTabs.ts`) posent l'actif puis naviguent en transition : la parade d'E1 est locale à `useArrivee`, la vraie correction est un seul commit dans le chrome. Après « Voir le contact » puis Retour, le fil revient à sa première ligne.
  - **La Recherche.** Son « / » (écouteur global) est avalé quand le fil est montré, et ouvre la liste de l'omnibox hors écran — une ligne suffit (`closest('[inert]')`). `atterrissage`, `SCORE_PAGE` et `pager.score` nomment encore la vue « par score » de l'atelier. La spec du pager ne voit pas un fil monté avec `dark={false}`.
  - **Le copilote WhatsApp.** `wa_matching_consigner` ne revérifie pas l'état du bien au « oui » ; `get_buyers_for_property` montre des « à proposer » sur un mandat hors vente.
  - **Pour le lot E2.** Le modèle de l'atelier, relogé avec le mobile, porte d'autres champs sans lecteur que les deux déjà nommés : `AtelierListing.priceWas`, `quartier`, `isFurnished`, `lift`, `charges`, `AtelierPoolMatch.lid` (vérifiés), et probablement une part du détail d'annonce.
  - **Les docs, avant E1.** `docs/pages.md` cite encore l'ancien wizard de sept étapes à la ligne de `/dashboard/listings` ; les lignes « Envoyer », « Plus tard » et « Écarter » du §3 de `docs/handoff/crm-mobile/MATCHING_SPEC.md` datent d'avant le 21.09.2026 (seul son bandeau le signale).
- **Pour le lot E2 (le téléphone)** : l'encre des avatars mobiles (teintes peintes sous un `#fff` figé dans `MmBuyerCard` et `MmFocus`, 1,88 à 4,39:1) ; les champs `ai` et `budget` du modèle de l'atelier, relogés avec le mobile mais qu'aucun écran n'affiche (`composeAiHint`, `fmtBudgetRange`) ; `useMatching`, lu par le seul mobile ; la clé `contacts:mobile.detail.matching.title`, sans lecteur.

## Écarts à l'exécution (29.09.2026) — le code du dépôt fait foi

Les tâches 1 à 16 ont été exécutées les 28 et 29.09.2026 : chacune appliquée à la lettre, puis relue deux fois — conformité, puis qualité — et reprise jusqu'à ce que les deux passent ; une passe « règle n°1 » a suivi. La 17 : portes, suite unitaire, build, base locale et EXPLAIN joués le 29.09.2026, docs relues, commits au signal de Julien.

⛔ **Les blocs de code des tâches ci-dessus décrivent l'état AVANT les relectures, et ne sont pas réécrits : les commits font foi.** Rejoué aujourd'hui, le plan réintroduirait les défauts que les relectures ont corrigés — une couverture qui survit au premier acheteur, un deuxième deal ouvert en silence, un lien d'arrivée appliqué dans l'onglet voisin, des specs qui restaient vertes sur un code faux, entre autres. Ces lignes disent où le dépôt s'en écarte, et pourquoi.

⚠ **Les « Attendu » chiffrés des tâches ne tombent plus juste**, et c'est attendu : les relectures ont ajouté cinq fichiers de spec (`fiche-planifier-visite-rendu`, `jeton-arrivee-onglets`, `matching-fil-etats`, `matching-fil-recherches`, `contacts-arrivee-rendu`) et une soixantaine de tests aux fichiers existants. `lint:deadcode` compte un module paresseux de moins que le plan (une spec importe `ContactsPage` statiquement ; son seul export est celui par défaut, rien n'échappe à la porte). Le bundle a un chunk `filModele` de plus, importé par `useProperties` (tâche 2) et `useContacts` (tâche 12).

- **Tâche 1** — l'en-tête de `matchingGestes.ts` dit que c'est l'ÉCRAN qui décide du moment d'un geste (après la fenêtre d'annulation, ou tout de suite) ; la garde « un exécuteur, une adresse » vise tout `src/` (aucun `export … exec[A-Z]` hors du module, aucun ré-export) ; un mock mort de `useAuth` retiré.
- **Tâche 2** — `useUpdateProperty` et `useDeleteProperty` invalident le fil (`[CLE_FIL]`) : un mandat vendu ou supprimé ailleurs ne restait « à proposer » que le temps du cache ; les colonnes lues par le fil (`COLONNES_BIEN`, `status` compris) sont épinglées par un espion, et les mandats supprimés filtrés à la lecture.
- **Tâche 3** — la ligne « n'est plus disponible » de « Qui pour ce bien ? » ne s'affiche que si un compatible est encore à proposer (`aDesCompatiblesAProposer`).
- **Tâche 4** — un test de plus : vendu, un mandat nourrit encore « Apprendre » de ses refus.
- **Tâche 5** — une spec de RENDU (`fiche-planifier-visite-rendu.spec.tsx`, cinq cas) prouve la règle du pré-remplissage, que la spec de source ne prouvait pas ; les deals sont revalidés après une visite ; le texte « rien n'est envoyé » retombe sur le nom quand le prénom est vide.
- **Tâche 7** — l'annonce retirée se reconnaît à `retire` ; le refus du copilote dit « ce bien ne se propose plus » (« ces biens », au pluriel), cas anglais compris.
- **Tâche 8** — l'allemand dit « Objekte (N) ».
- **Tâche 9** — ⚠ **deux phrases du plan sont fausses** : les notes NE s'écrivent PAS toujours — seules les notes CHANGÉES s'écrivent (`notesAEcrire`), et `reevalues` compte les notes ÉCRITES, pas les couples relus. Aussi : un barème ou un index de loyers illisible fait SAUTER la renotation (`renotationSautee`) plutôt que de noter sur des replis, et `rescore-search` rend 503 avant toute écriture ; chaque recherche est isolée (`echecs`, `premierEchec`) ; un échec ou un saut est signalé une fois par appel comme événement de PLATEFORME (`reportEdgeError`, l'agence dans le message — posé sur l'agence, il entrait dans la cloche de tous ses agents) ; la lecture de nuit écarte les matchs sans recherche (`client_search_id` non nul : un ajout à la main ne se renote pas et reconsommait le plafond) ; « Sa boucle » regroupe ses relectures Realtime (300 ms) ; R4 éprouve l'idempotence.
- **Tâche 10** — ⛔ **Défaut du plan** : `rattacherDeal` avalait l'erreur de LECTURE du deal et ouvrait alors un second deal `new_lead` en silence ; il lève désormais, et le rattachement du mandat est gardé `property_id is null`. Les types suivent les énumérations de la base ; la garde SQL veut une seule lecture de `transactions` par fonction ; W7 éprouve un deal ouvert ancien contre un perdu récent. ⚠ « `dealOuvert` partout où un geste cherche le deal d'un acheteur » (l'étape 5 de la tâche 17, la conception §5.8) est trop large : la règle gouverne les gestes du fil et deux fonctions du copilote (`wa_matching_consigner`, `wa_matching_visite`), pas `create_deal` ni `resolveContactDeal` (« En attente »).
- **Tâche 11** — ⛔ **Défaut du plan** : fermer l'onglet actif pose le suivant comme actif tout de suite et navigue dans une transition ; le temps d'un rendu, l'écran qui prend la main rend l'adresse de l'onglet fermé AVEC son jeton, et l'arrivée s'écrivait dans sa tranche. `useArrivee` n'applique une arrivée que dans l'onglet qui porte l'adresse (`chezSoi`, sauf hors coquille et sur mobile) ; spec neuve `jeton-arrivee-onglets.spec.tsx` (deux onglets, fermeture de l'actif, rechargement, vrai pager).
- **Tâche 12** — ⛔ **Défaut du plan** : la couverture survivait au premier acheteur — le déclencheur `sync_contact_client_search` active la recherche dans la même transaction, mais la lecture des recherches actives restait fraîche deux minutes. `useCreateContact` (critères posés) et `useUpdateContact` (`search_criteria` ou `agency_id`) la relisent aussitôt, écran caché compris, et marquent le fil périmé. Les tests du câblage ne lisaient que la source : une spec de RENDU du vrai fil (`matching-fil-etats.spec.tsx`) et une du vrai crochet (`matching-fil-recherches.spec.tsx`) les remplacent, et une troisième rend la vraie page Contacts sur `?nouveau=1`. La couverture prend `var(--crm-font)` (son exemption de police part), ses étapes sont une liste ordonnée (`<ol role="list">`), et ses docblocks disent la règle entière : aucune recherche active ET aucun match lu.
- **Tâche 13** — la spec neuve de la tâche 11 supposait le pager ouvert sur la Recherche : un test rougissait et trois autres étaient devenus vides ; leurs onglets retiennent la Recherche, miroir de session compris. Deux commentaires faux sont réécrits (`useArrivee`, `MatchingPage`).
- **Tâche 14** — la spec ne refusait que les ANCIENS noms : elle fait l'INVENTAIRE de ce que l'écran rend (`CrmWorkspace`, `TodayNavProvider`, `PageAujourdhuiH`), refuse tout geste de page et tout état d'onglet, et veut `navigate` seul dans `TodayNav`. `today.focus.viewCatalogue`, dernier libellé du catalogue, sans lecteur, part des quatre langues. Commentaires : six surfaces capturent la molette, cinq pagers écoutent le clavier ; l'en-tête de `TodayPage` dit l'écran lu en base.
- **Tâche 15** — la clause des quatre états de la Recherche est ancrée sur ce que le menu FAIT (la surface existe, chaque bouton pose son état, la page du banc le passe tel quel), et les listes i18n se lisent sans leurs commentaires ; la pastille du banc dit l'état de la Recherche hors du cas nominal ; `MrhIcon` perd `lift` et `tag`, que rien ne produit ; dix commentaires justes. Le scanner i18n garde SIX dossiers absents, pas cinq.
- **Tâche 16** — la spec ne fige plus le premier niveau du namespace : elle refuse le retour des treize noms partis, et une branche neuve reste permise ; la lecture du mobile est comparée EXACTEMENT dans les deux sens.
- **Passe « règle n°1 »** (UI épurée, décision de Julien) — trois textes raccourcis dans les quatre langues, écart assumé aux textes de la conception §5.1 et des tâches 5 et 12 : « Rien n’est envoyé à {prénom}. », « Ce bien n'est plus disponible. », « Aucun match pour l'instant ».
- **Tâche 17** — `tsc`, eslint (`src`, `tests`) et `deno check` (hors messagerie) à 0 ; treize portes sur quatorze vertes, `check:privileges` non comptée (elle exige `SUPABASE_ACCESS_TOKEN`) ; build : feuille `MatchingPage` 2,95 kB, `TodayPage` 68,92 kB, `MatchingPage` 180,88 kB ; base locale : les 197 fichiers verts, dont les cinq specs d'E1 (60 tests). ⚠ **La commande de l'étape 4 est incomplète** : `MEGGA_MAGIC_LINK_HMAC_SECRET` doit être exporté AVANT `supabase start` (le runtime des fonctions le lit au démarrage), sinon trois fichiers à lien magique rougissent. ⚠ **L'EXPLAIN de l'étape 4 ne teste pas la requête réelle** : le moteur lit en plus `client_search_id is not null` (tâche 9). Sur base vide, cette requête prend `idx_matches_client_search` et un tri complet ; sur 200 000 lignes synthétiques (20 agences, transaction annulée), elle prend `idx_matches_agency_focus` et un tri incrémental, comme celle du plan.
