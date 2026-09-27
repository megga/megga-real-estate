# Matching — fil de matchs, lot 1 : plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Construire le fil de matchs (« À traiter » sur les biens de l'agence : liste + panneau, filtres, Proposer / Plus tard / Écarter) et le rendre visible sur le banc `/dev/crm`, sans toucher l'atelier en production.

**Architecture :** Un modèle de vue PUR (`filModele.ts`, testé) transforme des `FilMatch` en groupes, reportés et lignes « Recherché / Ce bien ». Un hook de données plat (`useMatchingFil`) lit Supabase sans jointure embarquée. Des composants MEGGA X (`src/components/matching-fil/`) affichent ; les écritures restent celles de l'atelier (`execSendDossier`, `execSnooze`, `execDismiss`), élargies à des types étroits et complétées par le journal. Le banc monte le vrai `MatchingPage` avec le fil en page 0 via le slot `banc` existant.

**Tech Stack :** React 18 + TypeScript, TanStack Query, react-i18next (FR/DE/EN/IT), Supabase JS, Vitest, jetons MEGGA X (`crmPalette`, `--crm-*`).

**Conception :** [docs/superpowers/specs/2026-09-17-matching-fil-design.md](../specs/2026-09-17-matching-fil-design.md) (validée le 17.09.2026).

---

## Règles de ce chantier (à lire avant la première tâche)

- **Commits : AU SIGNAL de Julien seulement** (« committe »), un commit PAR SUJET, jamais de push sans demande. Chaque tâche finit par un « Point de commit » qui donne les fichiers et le message : ne pas l'exécuter sans le signal.
- **Aucun littéral** de rayon, d'espacement ou de taille de texte dans `src/components/matching-fil/` : `var(--crm-radius-*)`, `var(--crm-space-*)`, `var(--crm-text-*)` uniquement (cliquet `megga-x-grammar.spec.ts`, la zone naît à `{ hors: 0, total: 0 }`). `0` est permis (remise à zéro). Largeurs et hauteurs en pixels : permises.
- **Aucune couleur en dur** : `crmPalette(dark)` (`sp.*`), `MXC_SYSTEM`, `STATUT_CLAIR`, `crmVoileAssombrissant`. Graisse ≤ 600, jamais `textTransform: 'uppercase'`.
- **Aucune chaîne française dans le TSX** : tout passe par `t()` (namespace `matching`). **Aucun tiret cadratin ni demi-cadratin** (— –) dans les JSON de langue (`npm run lint:prose`), **aucun ß** en allemand.
- **Aucun export mort** (`npm run lint:deadcode` ne compte que `src/`) : n'exporter que ce qu'un fichier de `src/` importe.
- **La suite unitaire se lance SEULE**, jamais en parallèle de `tsc` ou d'`eslint` (délais de 5 s dépassés, faux rouges).
- ⚠ Jusqu'à la Task 12, `tsc` sur tout le projet signale `src/pages/dev/CrmShowcasePage.tsx` (`MatchingBanc` retiré en Task 0, remplacé en Task 12) : c'est attendu, les vérifications intermédiaires filtrent sur les fichiers de la tâche.
- Le serveur de dev tourne déjà sur **5173** (`preview_start` nom `dev`) ; le banc s'ouvre sur `http://localhost:5173/dev/crm?entree=/dashboard/matching`.

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `src/components/matching-fil/filModele.ts` (créé) | Modèle de vue pur : groupes, reportés, filtres, paliers, lignes de critères, historique |
| `tests/unit/matching-fil-modele.spec.ts` (créé) | Tests du modèle |
| `src/hooks/useAtelierMatching.ts` (modifié) | Types étroits des gestes, `refBienInterne`, journal de Plus tard / Écarter |
| `tests/unit/matching-fil-gestes.spec.ts` (créé) | Le journal de Plus tard / Écarter |
| `src/pages/agent/MatchingAtelierPage.tsx`, `src/components/crm-mobile/matching/MmMatchingScreen.tsx` (modifiés) | Nouvelle signature d'`execDismiss` |
| `src/hooks/useAgentNotifications.ts`, `src/i18n/locales/*/common.json` (modifiés) | Deux actions de journal nommées |
| `src/pages/dev/bancSupabase.ts`, `tests/unit/banc-supabase.spec.ts` (modifiés) | Une écriture `.single()` rend un objet |
| `src/hooks/useMatchingFil.ts` (créé) | Lecture plate des données du fil, passage vers les gestes |
| `src/i18n/locales/*/matching.json` (modifiés) | Bloc `fil.*` en quatre langues |
| `src/components/matching-fil/filAffichage.ts` (créé) | Teintes qui encodent, prix |
| `src/components/matching-fil/filAtomes.tsx` (créé) | Avatar, vignette, score |
| `src/components/matching-fil/FilEnTete.tsx` (créé) | Titre, compte, filtres |
| `src/components/matching-fil/FilListe.tsx` (créé) | Vos biens, lignes, reportés |
| `src/components/matching-fil/FilPanneau.tsx` (créé) | Le panneau d'un match |
| `src/components/matching-fil/FilFeuilleEnvoi.tsx` (créé) | Lien privé : WhatsApp ou copie |
| `src/components/matching-fil/FilAnnulation.tsx` (créé) | Barre « Annuler » |
| `src/components/matching-fil/MatchingFil.tsx` (créé) | Conteneur : données, sélection, gestes, clavier |
| `src/pages/agent/MatchingPage.tsx` (modifié) | Prop `atterrissage` |
| `tests/unit/megga-x-grammar.spec.ts` (modifié) | La zone `matching-fil` entre au cliquet |
| `src/pages/dev/crmFixtures.ts`, `src/pages/dev/CrmShowcasePage.tsx` (modifiés), `src/pages/dev/matchingFilBanc.tsx` (créé) | Le fil sur le banc |
| `src/pages/dev/MatchingShowcasePage.tsx` (rétabli) | Retrait de l'export `MatchingBanc` posé le 17.09 |
| `.claude-flow/knowledge/megga-memory.seed.json` (modifié) | Cerveau |

---

### Task 0 : Préciser la conception et rétablir le banc de l'atelier

**Files :**
- Modify : `docs/superpowers/specs/2026-09-17-matching-fil-design.md`
- Restore : `src/pages/dev/MatchingShowcasePage.tsx`

- [ ] **Step 1 : Ajouter les précisions du lot 1 à la conception**

Dans `docs/superpowers/specs/2026-09-17-matching-fil-design.md`, remplacer la ligne :

```
   est périmé), CHANGELOG.
```

par :

```
   est périmé), CHANGELOG.

**Précisions du plan du lot 1 (17.09.2026).** Le lot 1 ne montre que « À traiter » : les onglets
« En attente » et « Réponses » arrivent avec leur contenu, au lot 3. Il ne charge qu'**une photo**
par bien. Sont reportés au lot 3, parce qu'ils accompagnent la bascule de production ou exigent une
écriture serveur : l'aperçu « Voir ce que {prénom} verra » (le lien ne se crée aujourd'hui qu'en
marquant les matchs envoyés), l'état « aucun acheteur avec critères », `MatchingFirstRun` et le
journal de « Réactiver ». L'atterrissage sur le fil ne vaut que pour le banc.
```

Puis, sous `## 13. À trancher au plan du lot concerné`, ajouter en dernière puce :

```
- **Lot 3 :** un axe « tenu » (`match` = fraction ≥ 0,5) s'affiche ✓ même quand il n'est tenu qu'en
  partie (un prix 7 % au-dessus du budget peut valoir `match: true`). Afficher le `detail` du moteur
  sur un axe partiel suppose de connaître le poids de l'axe ; d'ici là, les valeurs « Recherché /
  Ce bien » côte à côte montrent l'écart, et les fixtures du banc évitent ce cas.
```

- [ ] **Step 2 : Rétablir le banc de l'atelier**

L'export `MatchingBanc` ajouté le 17.09 pour monter l'atelier dans `/dev/crm` devient sans lecteur (le banc montera le fil, Task 12).

Run : `git checkout -- src/pages/dev/MatchingShowcasePage.tsx && git diff --stat -- src/pages/dev/MatchingShowcasePage.tsx`
Expected : aucune ligne de diff.

- [ ] **Step 3 : Point de commit (au signal)**

```bash
git add docs/superpowers/specs/2026-09-17-matching-fil-design.md docs/superpowers/plans/2026-09-17-matching-fil-lot1.md
git commit -m "docs(matching): conception et plan du lot 1 du fil de matchs"
```

---

### Task 1 : Le modèle de vue du fil

**Files :**
- Create : `src/components/matching-fil/filModele.ts`
- Test : `tests/unit/matching-fil-modele.spec.ts`

- [ ] **Step 1 : Écrire les tests**

Créer `tests/unit/matching-fil-modele.spec.ts` :

```ts
/**
 * Le fil de matchs — le modèle de vue (`src/components/matching-fil/filModele.ts`).
 * Conception : docs/superpowers/specs/2026-09-17-matching-fil-design.md, §3 et §4.
 *
 * ⚠ Les `detail` des raisons reprennent le libellé EXACT du moteur (`matching-normalize.ts`) :
 * une fixture qui invente sa formulation éprouve un écran que la production ne rend jamais.
 */
import { describe, expect, it } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'
import {
  cleEquipement, compterHistorique, construireFil, initiales, lignesCriteres, optionsFiltres,
  palierScore, premierEcart,
  type FilBien, type FilFiltres, type FilMatch,
} from '@/components/matching-fil/filModele'

const MAINTENANT = Date.parse('2026-09-17T12:00:00.000Z')
const SANS_FILTRE: FilFiltres = { bienId: null, acheteurId: null, texte: '' }

const bien = (id: string, champs: Partial<FilBien> = {}): FilBien => ({
  id, titre: `Bien ${id}`, prix: 1_000_000, location: false, type: 'apartment', pieces: 4.5,
  surface: 110, ville: 'Genève', canton: 'GE', adresse: null, equipements: [], photo: null, ...champs,
})
const acheteur = (id: string, champs: Partial<FilMatch['acheteur']> = {}): FilMatch['acheteur'] => ({
  id, prenom: `Prénom${id}`, nom: `Nom${id}`, telephone: null, email: null, kyc: 'none', ...champs,
})
const match = (id: string, score: number, b: FilBien, a: FilMatch['acheteur'], champs: Partial<FilMatch> = {}): FilMatch => ({
  id, score, raisons: null, criteres: null, creeLe: '2026-09-10T10:00:00.000Z', reporteJusquau: null, bien: b, acheteur: a, ...champs,
})

describe('palierScore — une seule échelle (§3.5)', () => {
  it.each([[100, 'fort'], [85, 'fort'], [84, 'bon'], [70, 'bon'], [69, 'possible'], [55, 'possible'], [54, 'possible']] as const)(
    '%i → %s', (score, palier) => { expect(palierScore(score)).toBe(palier) },
  )
})

describe('construireFil', () => {
  const champel = bien('p1', { titre: 'Champel' })
  const cologny = bien('p2', { titre: 'Cologny', ville: 'Cologny' })
  const emma = acheteur('c7', { prenom: 'Emma', nom: 'Schneider' })
  const julie = acheteur('c9', { prenom: 'Julie', nom: 'Morand' })
  const antoine = acheteur('c10', { prenom: 'Antoine', nom: 'Lefèvre' })

  it('groupe par bien, trie les groupes par meilleur score et les acheteurs par score', () => {
    const vue = construireFil([
      match('m3', 90, champel, julie),
      match('m2', 91, champel, emma),
      match('m5', 93, cologny, antoine),
    ], SANS_FILTRE, MAINTENANT)
    expect(vue.groupes.map((g) => g.bien.id)).toEqual(['p2', 'p1'])
    expect(vue.groupes[1]!.matchs.map((m) => m.id)).toEqual(['m2', 'm3'])
    expect(vue.ordre).toEqual(['m5', 'm2', 'm3'])
    expect(vue.compte).toBe(3)
  })

  it('à score égal : le plus récent, puis l’id — et une date absente ne casse pas l’ordre', () => {
    const vue = construireFil([
      match('b', 80, champel, julie, { creeLe: '2026-09-01T00:00:00.000Z' }),
      match('c', 80, champel, emma, { creeLe: '2026-09-05T00:00:00.000Z' }),
      match('a', 80, champel, antoine, { creeLe: '2026-09-01T00:00:00.000Z' }),
      match('d', 80, champel, antoine, { creeLe: null }),
    ], SANS_FILTRE, MAINTENANT)
    expect(vue.ordre).toEqual(['c', 'a', 'b', 'd'])
  })

  it('un reporté quitte les lignes et le compte ; un report échu revient', () => {
    const vue = construireFil([
      match('m4', 68, champel, emma, { reporteJusquau: '2026-09-22T00:00:00.000Z' }),
      match('m9', 70, champel, antoine, { reporteJusquau: '2026-09-19T00:00:00.000Z' }),
      match('m3', 90, champel, julie, { reporteJusquau: '2026-09-16T00:00:00.000Z' }),
    ], SANS_FILTRE, MAINTENANT)
    expect(vue.ordre).toEqual(['m3'])
    expect(vue.compte).toBe(1)
    expect(vue.reportes.map((m) => m.id)).toEqual(['m9', 'm4'])
  })

  it('un bien dont tous les acheteurs sont reportés n’a plus de groupe', () => {
    const vue = construireFil(
      [match('m5', 93, cologny, antoine, { reporteJusquau: '2026-09-30T00:00:00.000Z' })],
      SANS_FILTRE, MAINTENANT,
    )
    expect(vue.groupes).toEqual([])
    expect(vue.reportes).toHaveLength(1)
  })

  it('les filtres s’appliquent aussi aux reportés', () => {
    const vue = construireFil(
      [match('m4', 68, champel, emma, { reporteJusquau: '2026-09-22T00:00:00.000Z' })],
      { ...SANS_FILTRE, acheteurId: 'c9' }, MAINTENANT,
    )
    expect(vue.reportes).toEqual([])
  })

  it('filtre par bien, par acheteur, et par texte sans accents ni ligatures', () => {
    const vandoeuvres = bien('p3', { titre: 'Maison · Vandœuvres', ville: 'Vandœuvres' })
    const tous = [
      match('m2', 91, champel, emma), match('m3', 90, champel, julie),
      match('m5', 93, cologny, antoine), match('m6', 70, vandoeuvres, julie),
    ]
    expect(construireFil(tous, { ...SANS_FILTRE, bienId: 'p1' }, MAINTENANT).ordre).toEqual(['m2', 'm3'])
    expect(construireFil(tous, { ...SANS_FILTRE, acheteurId: 'c7' }, MAINTENANT).ordre).toEqual(['m2'])
    expect(construireFil(tous, { ...SANS_FILTRE, texte: 'lefevre' }, MAINTENANT).ordre).toEqual(['m5'])
    expect(construireFil(tous, { ...SANS_FILTRE, texte: '  COLOGNY ' }, MAINTENANT).ordre).toEqual(['m5'])
    expect(construireFil(tous, { ...SANS_FILTRE, texte: 'vandoeuvres' }, MAINTENANT).ordre).toEqual(['m6'])
  })
})

describe('optionsFiltres', () => {
  it('rend chaque bien et chaque acheteur une fois, triés par libellé', () => {
    const villa = bien('p1', { titre: 'Villa' })
    const attique = bien('p2', { titre: 'Attique' })
    const zoe = acheteur('c1', { prenom: 'Zoé', nom: 'Aubert' })
    const elodie = acheteur('c2', { prenom: 'Élodie', nom: 'Roux' })
    const o = optionsFiltres([match('1', 90, villa, zoe), match('2', 80, attique, zoe), match('3', 70, villa, elodie)])
    expect(o.biens).toEqual([{ id: 'p2', libelle: 'Attique' }, { id: 'p1', libelle: 'Villa' }])
    expect(o.acheteurs).toEqual([{ id: 'c2', libelle: 'Élodie Roux' }, { id: 'c1', libelle: 'Zoé Aubert' }])
  })
})

describe('lignesCriteres — « Recherché / Ce bien » (§4.4)', () => {
  const champel = bien('p1', {
    prix: 1_450_000, ville: 'Genève', canton: 'GE', type: 'apartment', pieces: 4.5, surface: 118,
    equipements: ['Balcon', 'Ascenseur', 'Cave', 'Parking'],
  })
  const a = acheteur('c1')

  it('aucun critère sur la recherche, aucune ligne', () => {
    expect(lignesCriteres(match('m', 70, champel, a))).toEqual([])
  })

  it('une ligne par critère posé, dans l’ordre budget → équipements, verdicts du moteur', () => {
    const lignes = lignesCriteres(match('m4', 68, champel, a, {
      criteres: {
        transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Carouge', 'GE'],
        budget_min: 900_000, budget_max: 1_250_000, rooms_min: 4.5, surface_min: 90, features: ['balcon', 'ascenseur'],
      },
      raisons: {
        budget: { match: false, score: 0, detail: '16% au-dessus du budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 22, detail: '4,5 pièces · 118 m²' },
        features: { match: true, score: 10, detail: '2/2 critères' },
      },
    }))
    expect(lignes.map((l) => l.cle)).toEqual(['budget', 'zone', 'type', 'pieces', 'surface', 'equipements'])
    expect(lignes[0]).toEqual({
      cle: 'budget', min: 900_000, max: 1_250_000, prix: 1_450_000, location: false, ok: false, ecart: '16% au-dessus du budget',
    })
    expect(lignes[1]).toEqual({ cle: 'zone', villes: ['Genève', 'Carouge'], cantons: ['GE'], ville: 'Genève', canton: 'GE', ok: true, ecart: null })
    expect(lignes[3]).toEqual({ cle: 'pieces', min: 4.5, max: null, pieces: 4.5, ok: true, ecart: null })
    expect(lignes[4]).toEqual({ cle: 'surface', min: 90, surface: 118, ok: true, ecart: null })
    expect(lignes[5]).toEqual({ cle: 'equipements', voulus: ['balcon', 'ascenseur'], presents: ['balcon', 'ascenseur'], ok: true, ecart: null })
    expect(premierEcart(lignes)).toBe('budget')
  })

  it('sans raison du moteur, ou sur un axe qu’il n’a pas évalué, AUCUN verdict — jamais un ✓ inventé', () => {
    const criteres = { budget_max: 1_000_000, zones: ['GE'] }
    const sansRaison = lignesCriteres(match('m', 70, champel, a, { criteres }))
    expect(sansRaison.map((l) => l.ok)).toEqual([null, null])
    const inactifs = lignesCriteres(match('m', 70, champel, a, {
      criteres,
      raisons: { budget: { match: false, score: 0, detail: '—' }, zone: { match: false, score: 0, detail: 'Aucun critère' } },
    }))
    expect(inactifs.map((l) => [l.ok, l.ecart])).toEqual([[null, null], [null, null]])
    expect(premierEcart(inactifs)).toBeNull()
  })

  it('type : le verdict du moteur, jamais son détail — il répète « Ce bien »', () => {
    const lignes = lignesCriteres(match('m', 60, champel, a, {
      criteres: { type: 'house', rooms_max: 3, surface_min: 160 },
      raisons: {
        type: { match: false, score: 0, detail: 'apartment ≠ house' },
        rooms: { match: false, score: 0, detail: '4,5 pièces · 118 m²' },
      },
    }))
    expect(lignes.map((l) => [l.cle, l.ok, l.ecart])).toEqual([
      ['type', false, null],
      ['pieces', false, null],
      ['surface', false, null],
    ])
    expect(lignes[1]).toMatchObject({ min: null, max: 3 })
  })

  it('pièces et surface : chaque ligne compare SA valeur à SES bornes, quel que soit l’axe fusionné du moteur', () => {
    // Les deux cas relevés en production le 17.09.2026.
    const quatrePieces = lignesCriteres(match('m', 70, bien('p', { pieces: 4, surface: 95 }), a, {
      criteres: { rooms_min: 2, rooms_max: 3, surface_min: 40 },
      raisons: { rooms: { match: true, score: 12, detail: '4 pièces · 95 m²' } },
    }))
    expect(quatrePieces.map((l) => [l.cle, l.ok])).toEqual([['pieces', false], ['surface', true]])
    const centVingtM2 = lignesCriteres(match('m', 70, bien('p', { pieces: 5, surface: 120 }), a, {
      criteres: { rooms_min: 3, rooms_max: 4, surface_min: 70 },
      raisons: { rooms: { match: false, score: 5, detail: '5 pièces · 120 m²' } },
    }))
    expect(centVingtM2.map((l) => [l.cle, l.ok])).toEqual([['pieces', false], ['surface', true]])
    const inconnues = lignesCriteres(match('m', 70, bien('p', { pieces: null, surface: null }), a, {
      criteres: { rooms_min: 3, surface_min: 70 },
    }))
    expect(inconnues.map((l) => l.ok)).toEqual([null, null])
  })

  it('un écart au détail vide n’écrit rien', () => {
    const lignes = lignesCriteres(match('m', 60, champel, a, {
      criteres: { budget_max: 1_000_000 },
      raisons: { budget: { match: false, score: 0, detail: '  ' } },
    }))
    expect(lignes[0]).toMatchObject({ ok: false, ecart: null })
  })

  it('villes ET cantons : un match au canton se lit (« Canton GE correspond »)', () => {
    const lancy = bien('p9', { ville: 'Lancy', canton: 'GE' })
    const lignes = lignesCriteres(match('m', 72, lancy, a, {
      criteres: { zones: ['Cologny', 'Vandoeuvres', ' ge'] },
      raisons: { zone: { match: true, score: 14, detail: 'Canton GE correspond' } },
    }))
    expect(lignes).toEqual([{ cle: 'zone', villes: ['Cologny', 'Vandoeuvres'], cantons: ['GE'], ville: 'Lancy', canton: 'GE', ok: true, ecart: null }])
  })

  it('des critères mal formés ne cassent pas la liste', () => {
    const criteres = { zones: 'Genève', features: [42, 'balcon'] } as unknown as FilMatch['criteres']
    expect(() => lignesCriteres(match('m', 60, champel, a, { criteres }))).not.toThrow()
    expect(lignesCriteres(match('m', 60, champel, a, { criteres })).map((l) => l.cle)).toEqual(['equipements'])
  })

  it('un équipement au slug vide n’est pas un critère', () => {
    const lignes = lignesCriteres(match('m', 60, champel, a, { criteres: { features: ['—', 'balcon'] } }))
    expect(lignes[0]).toMatchObject({ voulus: ['balcon'], presents: ['balcon'] })
  })

  it('cleEquipement : le slug du moteur, sans `custom:`', () => {
    expect(cleEquipement('Vue lac')).toBe('vue-lac')
    expect(cleEquipement('vue_lac')).toBe('vue-lac')
    expect(cleEquipement(' Cheminée ')).toBe('cheminee')
    expect(cleEquipement('custom:Terrasse')).toBe('terrasse')
  })
})

describe('lignesCriteres — les équipements comptent comme le MOTEUR', () => {
  // Cas relevés dans les écritures réelles : puces de la fiche (« vue lac »), WhatsApp (« Vue »),
  // formulaire du bien (« Garage double »), « Nouveau bien » (`vue_lac`, `clim`, `custom:…`).
  const CAS: [string[], string[]][] = [
    [['vue lac'], ['vue_lac']],
    [['garage'], ['Garage double']],
    [['Vue'], ['Vue lac']],
    [['clim'], ['Climatisation']],
    [['terrasse'], ['custom:Terrasse']],
    [['jardin'], ['garden']],
    [['balcon', 'piscine', 'cave'], ['Balcon', 'Piscine']],
    [['Garage double'], ['garage']],
    [['cheminée'], ['Cheminee']],
  ]
  it.each(CAS)('voulus %j, bien %j', (voulus, offerts) => {
    const moteur = calculateScoreV2(
      { price: 1_000_000, type: 'apartment', city: 'Genève', canton: 'GE', rooms: 4, surface_m2: 100, features: offerts },
      { features: voulus },
      DEFAULT_SCORING_CONFIG,
    )
    const [touches] = moteur.reasons.features.detail.split('/')
    const ligne = lignesCriteres(match('m', 70, bien('p', { equipements: offerts }), acheteur('c'), {
      criteres: { features: voulus },
      raisons: moteur.reasons,
    }))[0]
    expect(ligne).toMatchObject({ cle: 'equipements', ok: moteur.reasons.features.match })
    expect(ligne && ligne.cle === 'equipements' ? ligne.presents.length : -1).toBe(Number(touches))
  })
})

describe('compterHistorique', () => {
  it('compte ce qui a été proposé, et ce qui a intéressé (une visite planifiée compte)', () => {
    const h = compterHistorique([
      { contact_id: 'c7', status: 'interested' },
      { contact_id: 'c7', status: 'sent' },
      { contact_id: 'c7', status: 'suggested' },
      { contact_id: 'c1', status: 'ignored' },
      { contact_id: 'c1', status: 'visit_planned' },
      { contact_id: 'c1', status: 'rejected' },
    ])
    expect(h.get('c7')).toEqual({ proposes: 2, interesses: 1 })
    expect(h.get('c1')).toEqual({ proposes: 2, interesses: 1 })
  })
})

describe('initiales', () => {
  it('première lettre du prénom et du nom, en capitales', () => {
    expect(initiales('élodie', ' Schmidt')).toBe('ÉS')
  })
})
```

- [ ] **Step 2 : Lancer les tests, constater l'échec**

Run : `npx vitest run tests/unit/matching-fil-modele.spec.ts`
Expected : FAIL, `Failed to resolve import "@/components/matching-fil/filModele"`.

- [ ] **Step 3 : Écrire le modèle**

Créer `src/components/matching-fil/filModele.ts` :

```ts
/**
 * Le fil de matchs — modèle de vue PUR : ni React, ni Supabase, ni traduction.
 *
 * Conception : `docs/superpowers/specs/2026-09-17-matching-fil-design.md` (§3, §4). Le lot 1
 * n'en sert que « À traiter » sur les biens de l'agence ; la forme est déjà celle du fil entier.
 *
 * ⚠ Aucune chaîne affichée ne sort d'ici : les lignes de critères portent des VALEURS, et c'est
 * l'écran qui les écrit dans la langue de l'agent. Seul le `detail` du moteur traverse tel quel —
 * c'est une donnée, rédigée par `matching-engine`.
 *
 * ⛔ LES CRITÈRES SONT CEUX DE LA RECHERCHE qui a produit le match (`client_searches.criteria`, par
 * `matches.client_search_id`), jamais ceux de la fiche : mesuré le 17.09.2026, 3 acheteurs sur 4 ont
 * un `contacts.search_criteria` vide alors que leur recherche est complète, et un contact peut porter
 * plusieurs recherches. D'où `criteres` sur le MATCH, pas sur l'acheteur.
 *
 * ⛔ LES ÉQUIPEMENTS SE COMPARENT AVEC LA RÈGLE DU MOTEUR (`slugify` puis inclusion,
 * `matching-normalize.ts`). Une règle à nous afficherait « 0 sur 1 » à côté d'un ✓ du moteur, ou
 * l'inverse ; `matching-fil-modele.spec.ts` la confronte à `calculateScoreV2`.
 */
import type { SearchCriteria } from '@/types/contact'
import { splitZones } from '@/lib/contactCriteria'

type AxeMoteur = 'budget' | 'zone' | 'type' | 'rooms' | 'features'
type RaisonMoteur = { match: boolean; score: number; detail: string }
/** `matches.reasons` : cinq axes, `match` = fraction tenue ≥ 0,5 (`matching-normalize.ts`). */
export type RaisonsMoteur = Partial<Record<AxeMoteur, RaisonMoteur>>

export interface FilBien {
  id: string
  titre: string
  prix: number | null
  location: boolean
  /** Type en base (`apartment`, `house`…) : traduit à l'écran. */
  type: string | null
  pieces: number | null
  surface: number | null
  ville: string | null
  canton: string | null
  adresse: string | null
  equipements: string[]
  /** Première photo seulement (§8). */
  photo: string | null
}

export interface FilMatch {
  id: string
  score: number
  raisons: RaisonsMoteur | null
  /** Les critères de la recherche qui a produit ce match. */
  criteres: SearchCriteria | null
  creeLe: string | null
  reporteJusquau: string | null
  bien: FilBien
  acheteur: {
    id: string
    prenom: string
    nom: string
    telephone: string | null
    email: string | null
    kyc: 'verified' | 'pending' | 'stale' | 'none'
  }
}

export interface FilFiltres { bienId: string | null; acheteurId: string | null; texte: string }

export interface FilVue {
  groupes: { bien: FilBien; matchs: FilMatch[] }[]
  /** Triés par date de retour, le plus proche d'abord. */
  reportes: FilMatch[]
  /** Lignes d'« À traiter » : un acheteur sous un bien vaut une ligne (§3.1). */
  compte: number
  /** Ordre de lecture des lignes, celui de ↑/↓. */
  ordre: string[]
}

export interface Historique { proposes: number; interesses: number }
export type PalierScore = 'fort' | 'bon' | 'possible'
export interface OptionFiltre { id: string; libelle: string }

type Verdict = { ok: boolean | null; ecart: string | null }
export type LigneCritere =
  | ({ cle: 'budget'; min: number | null; max: number | null; prix: number | null; location: boolean } & Verdict)
  | ({ cle: 'zone'; villes: string[]; cantons: string[]; ville: string | null; canton: string | null } & Verdict)
  | ({ cle: 'type'; voulu: string; propose: string | null } & Verdict)
  | ({ cle: 'pieces'; min: number | null; max: number | null; pieces: number | null } & Verdict)
  | ({ cle: 'surface'; min: number; surface: number | null } & Verdict)
  | ({ cle: 'equipements'; voulus: string[]; presents: string[] } & Verdict)

/** Trois paliers, bureau et mobile (§3.5). Le seuil du moteur (55) borne le bas. */
export function palierScore(score: number): PalierScore {
  if (score >= 85) return 'fort'
  if (score >= 70) return 'bon'
  return 'possible'
}

/** Minuscules, sans diacritiques, ligatures dépliées : « Vandœuvres » se trouve en tapant « vandoeuvres ». */
const plier = (s: string): string =>
  s.replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
    .normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Le `slugify` du moteur, à l'identique (`matching-normalize.ts`). */
const slug = (s: string): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** Horodatage d'une date ISO ; une date absente ou illisible vaut 0, pour que le tri reste total. */
const temps = (iso: string | null): number => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : 0
}

function passeFiltres(m: FilMatch, f: FilFiltres): boolean {
  if (f.bienId && m.bien.id !== f.bienId) return false
  if (f.acheteurId && m.acheteur.id !== f.acheteurId) return false
  const texte = plier(f.texte.trim())
  if (!texte) return true
  return plier([m.bien.titre, m.bien.ville ?? '', m.bien.adresse ?? '', m.acheteur.prenom, m.acheteur.nom].join(' ')).includes(texte)
}

/** Score décroissant, puis le plus récent, puis l'id : un ordre TOTAL, donc une navigation stable. */
function avant(a: FilMatch, b: FilMatch): number {
  return b.score - a.score || temps(b.creeLe) - temps(a.creeLe) || a.id.localeCompare(b.id)
}

/** Le fil « À traiter » : groupes par bien, reportés à part, compte et ordre de lecture. */
export function construireFil(matchs: readonly FilMatch[], filtres: FilFiltres, maintenant: number): FilVue {
  const reportes: FilMatch[] = []
  const parBien = new Map<string, { bien: FilBien; matchs: FilMatch[] }>()
  for (const m of matchs) {
    if (!passeFiltres(m, filtres)) continue
    if (m.reporteJusquau != null && temps(m.reporteJusquau) > maintenant) {
      reportes.push(m)
      continue
    }
    const groupe = parBien.get(m.bien.id) ?? { bien: m.bien, matchs: [] }
    groupe.matchs.push(m)
    parBien.set(m.bien.id, groupe)
  }
  reportes.sort((a, b) => temps(a.reporteJusquau) - temps(b.reporteJusquau) || a.id.localeCompare(b.id))
  const groupes = [...parBien.values()]
    .map((g) => ({ bien: g.bien, matchs: [...g.matchs].sort(avant) }))
    .sort((a, b) => avant(a.matchs[0]!, b.matchs[0]!))
  const ordre = groupes.flatMap((g) => g.matchs.map((m) => m.id))
  return { groupes, reportes, compte: ordre.length, ordre }
}

/** Les choix des filtres Bien et Acheteur : chacun une fois, triés par libellé. */
export function optionsFiltres(matchs: readonly FilMatch[]): { biens: OptionFiltre[]; acheteurs: OptionFiltre[] } {
  const biens = new Map<string, string>()
  const acheteurs = new Map<string, string>()
  for (const m of matchs) {
    biens.set(m.bien.id, m.bien.titre)
    acheteurs.set(m.acheteur.id, `${m.acheteur.prenom} ${m.acheteur.nom}`)
  }
  const trier = (e: Map<string, string>): OptionFiltre[] =>
    [...e].map(([id, libelle]) => ({ id, libelle })).sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr') || a.id.localeCompare(b.id))
  return { biens: trier(biens), acheteurs: trier(acheteurs) }
}

/** La clé de traduction d'un équipement (`fil.equipementsNoms`) : le slug du moteur, sans le préfixe `custom:`. */
export function cleEquipement(brut: string): string {
  return slug(brut.replace(/^custom:/i, ''))
}

const chaines = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [])

/** Détails que le moteur écrit pour un axe INACTIF (aucun critère de son côté) : pas un verdict. */
const INACTIF = new Set(['—', 'Aucun critère'])

/** Les lignes « Recherché / Ce bien » : une par critère que la recherche a posé (§4.4). */
export function lignesCriteres(m: FilMatch): LigneCritere[] {
  const c = m.criteres
  if (!c) return []
  const raisons = m.raisons ?? {}
  // ⛔ Sans raison du moteur, ou sur un axe qu'il n'a pas évalué, AUCUN verdict : un ✓ sans preuve
  // serait une invention. ⛔ Et l'écart ne s'écrit que là où le `detail` DÉCRIT un écart (budget,
  // zone, équipements) : pour le type, il répète la colonne « Ce bien ».
  const verdict = (axe: AxeMoteur, decritEcart: boolean): Verdict => {
    const r = raisons[axe]
    const detail = typeof r?.detail === 'string' ? r.detail.trim() : ''
    if (!r || typeof r.match !== 'boolean' || (!r.match && INACTIF.has(detail))) return { ok: null, ecart: null }
    return { ok: r.match, ecart: decritEcart && !r.match && detail ? detail : null }
  }
  const lignes: LigneCritere[] = []
  if (c.budget_min != null || c.budget_max != null) {
    lignes.push({ cle: 'budget', min: c.budget_min ?? null, max: c.budget_max ?? null, prix: m.bien.prix, location: m.bien.location, ...verdict('budget', true) })
  }
  const { cities, cantons } = splitZones(chaines(c.zones))
  if (cities.length > 0 || cantons.length > 0) {
    lignes.push({ cle: 'zone', villes: cities, cantons, ville: m.bien.ville, canton: m.bien.canton, ...verdict('zone', true) })
  }
  if (c.type) lignes.push({ cle: 'type', voulu: c.type, propose: m.bien.type, ...verdict('type', false) })
  // ⛔ PIÈCES ET SURFACE : UN FAIT, PAS LA NOTE DU MOTEUR. Il les a FUSIONNÉES en un axe, dont le
  // verdict contredit l'une des deux lignes dès que l'autre tire la moyenne — mesuré le 17.09.2026 :
  // 4 pièces cochées pour 2 à 3 demandées (la surface compensait), 120 m² en écart pour 70 m²
  // demandés (les pièces pesaient). Chaque ligne compare donc SA valeur à SES bornes.
  if (c.rooms_min != null || c.rooms_max != null) {
    const p = m.bien.pieces
    lignes.push({
      cle: 'pieces', min: c.rooms_min ?? null, max: c.rooms_max ?? null, pieces: p, ecart: null,
      ok: p == null ? null : (c.rooms_min == null || p >= c.rooms_min) && (c.rooms_max == null || p <= c.rooms_max),
    })
  }
  if (c.surface_min != null) {
    const s = m.bien.surface
    lignes.push({ cle: 'surface', min: c.surface_min, surface: s, ok: s == null ? null : s >= c.surface_min, ecart: null })
  }
  // Un équipement dont le slug est vide (« — ») n'existe pas pour le moteur : il n'existe pas ici.
  const voulus = chaines(c.features).filter((v) => slug(v) !== '')
  if (voulus.length > 0) {
    const offerts = m.bien.equipements.map(slug).filter(Boolean)
    const presents = voulus.filter((v) => {
      const w = slug(v)
      return offerts.some((h) => h === w || h.includes(w) || w.includes(h))
    })
    lignes.push({ cle: 'equipements', voulus, presents, ...verdict('features', true) })
  }
  return lignes
}

/** Le premier critère que le moteur dit en écart, ou `null`. */
export function premierEcart(lignes: readonly LigneCritere[]): LigneCritere['cle'] | null {
  return lignes.find((l) => l.ok === false)?.cle ?? null
}

const PROPOSES = new Set(['sent', 'interested', 'rejected', 'visit_planned'])
/** Une visite planifiée suit un « intéressé » (§3.1) : elle compte comme tel. */
const INTERESSES = new Set(['interested', 'visit_planned'])

/** « Déjà reçu » (§4.5) : par contact, ce qui lui a été proposé et ce qui l'a intéressé. */
export function compterHistorique(lignes: readonly { contact_id: string; status: string }[]): Map<string, Historique> {
  const parContact = new Map<string, Historique>()
  for (const l of lignes) {
    if (!PROPOSES.has(l.status)) continue
    const h = parContact.get(l.contact_id) ?? { proposes: 0, interesses: 0 }
    h.proposes++
    if (INTERESSES.has(l.status)) h.interesses++
    parContact.set(l.contact_id, h)
  }
  return parContact
}

/** Initiales d'avatar. */
export function initiales(prenom: string, nom: string): string {
  return `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase()
}
```

- [ ] **Step 4 : Lancer les tests, constater le succès**

Run : `npx vitest run tests/unit/matching-fil-modele.spec.ts`
Expected : PASS, 35 tests.

- [ ] **Step 5 : Point de commit (au signal)**

```bash
git add src/components/matching-fil/filModele.ts tests/unit/matching-fil-modele.spec.ts
git commit -m "feat(matching): le modèle de vue du fil de matchs"
```

---

### Task 2 : Plus tard et Écarter écrivent au journal

**Files :**
- Modify : `src/hooks/useAtelierMatching.ts`
- Modify : `src/pages/agent/MatchingAtelierPage.tsx:122-127`
- Modify : `src/components/crm-mobile/matching/MmMatchingScreen.tsx:108-113`
- Modify : `src/hooks/useAgentNotifications.ts:89`
- Modify : `src/i18n/locales/{fr,de,en,it}/common.json` (`audit.action`)
- Test : `tests/unit/matching-fil-gestes.spec.ts`

- [ ] **Step 1 : Écrire le test**

Créer `tests/unit/matching-fil-gestes.spec.ts` :

```ts
/**
 * Garde-fou : Plus tard et Écarter laissent une TRACE au journal (CLAUDE.md §5 : « Audit trail :
 * activity_events pour toute action »). Jusqu'au 17.09.2026, ces deux gestes écrivaient le match
 * sans rien consigner, dans l'atelier comme sur mobile.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { execDismiss, execSnooze } from '@/hooks/useAtelierMatching'

const h = vi.hoisted(() => ({ ecritures: [] as { table: string; genre: string; valeurs: unknown }[] }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const q = {
        insert: (valeurs: unknown) => { h.ecritures.push({ table, genre: 'insert', valeurs }); return q },
        update: (valeurs: unknown) => { h.ecritures.push({ table, genre: 'update', valeurs }); return q },
        eq: () => q,
        then: (resoudre: (r: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resoudre),
      }
      return q
    },
  },
}))
vi.mock('@/lib/intercom-milestones', () => ({ markIntercomMilestone: () => undefined }))
vi.mock('@/lib/intercom', () => ({ INTERCOM_EVENTS: { FIRST_MATCH_SENT: 'first_match_sent' } }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({}) }))

const CTX = { agencyId: 'ag-1', userId: 'u-1', agentName: 'Gregory', agentPhone: null }
const ACHETEUR = { id: 'c-1', matchId: 'm-1', first: 'Julie', last: 'Morand', email: null, score: 90 }

beforeEach(() => { h.ecritures.length = 0 })

describe('gestes du matching — le journal', () => {
  it('Plus tard reporte le match, pose le rappel ET écrit `match_reporte`', async () => {
    await execSnooze(CTX, ACHETEUR)
    expect(h.ecritures.map((e) => `${e.genre}:${e.table}`)).toEqual(['update:matches', 'insert:reminders', 'insert:activity_events'])
    expect(h.ecritures[2]!.valeurs).toMatchObject({
      agency_id: 'ag-1', actor_id: 'u-1', actor_kind: 'user', action: 'match_reporte',
      entity_type: 'contact', entity_id: 'c-1', category: 'deal', metadata: { match_id: 'm-1', score: 90 },
    })
  })

  it('Écarter ignore le match ET écrit `match_ecarte`', async () => {
    await execDismiss(CTX, ACHETEUR)
    expect(h.ecritures.map((e) => `${e.genre}:${e.table}`)).toEqual(['update:matches', 'insert:activity_events'])
    expect(h.ecritures[0]!.valeurs).toEqual({ status: 'ignored' })
    expect(h.ecritures[1]!.valeurs).toMatchObject({ action: 'match_ecarte', entity_id: 'c-1', metadata: { match_id: 'm-1', score: 90 } })
  })
})
```

- [ ] **Step 2 : Lancer, constater l'échec**

Run : `npx vitest run tests/unit/matching-fil-gestes.spec.ts`
Expected : FAIL — Plus tard n'écrit que deux lignes (`update:matches`, `insert:reminders`), et `execDismiss(CTX, ACHETEUR)` écrit `status` sur `undefined.matchId` (TypeError).

- [ ] **Step 3 : Types étroits, référence partagée, journal**

Dans `src/hooks/useAtelierMatching.ts` :

1. Juste avant `/** Bien interne (properties) → AtelierListing`, ajouter :

```ts
/** Référence affichée d'un bien interne — la même dans l'atelier et dans le fil de matchs. */
export const refBienInterne = (id: string): string => `MG-IN-${id.slice(0, 6).toUpperCase()}`

```

2. Dans `mapProperty`, remplacer `    ref: \`MG-IN-${row.id.slice(0, 6).toUpperCase()}\`,` par `    ref: refBienInterne(row.id),`.

3. Juste après l'interface `SendResult`, ajouter :

```ts

/**
 * Ce qu'un geste lit d'un acheteur et d'un bien. Le fil de matchs n'a pas la forme complète de
 * l'atelier : les exécuteurs restent la source UNIQUE des écritures, ils ne demandent que ce
 * qu'ils lisent.
 */
export type AcheteurGeste = Pick<AtelierBuyer, 'id' | 'matchId' | 'first' | 'last' | 'email' | 'score'>
export type BienGeste = Pick<
  AtelierListing,
  'kind' | 'id' | 'key' | 'ref' | 'title' | 'price' | 'addr' | 'rooms' | 'area' | 'type' | 'gallery' | 'sourceUrl' | 'agency'
>
```

4. Dans la signature d'`execSendDossier`, remplacer `  buyer: AtelierBuyer,\n  listing: AtelierListing,\n  channel: 'email' | 'reception' = 'email',` par `  buyer: AcheteurGeste,\n  listing: BienGeste,\n  channel: 'email' | 'reception' = 'email',`.

5. Remplacer tout le bloc `/** « Plus tard » (P) …` jusqu'à la fin d'`execDismiss` par :

```ts
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
```

6. Mettre à jour l'en-tête du fichier : remplacer les deux lignes

```
//   dismiss      → matches.status='ignored' (le moteur ne re-propose jamais
//                  un couple existant — aucune écriture deal/timeline)
```

par

```
//   dismiss      → matches.status='ignored' (le moteur ne re-propose jamais
//                  un couple existant — aucun deal) + activity_events 'match_ecarte'
```

et la ligne `//                  (la ligne « de retour » remonte dans Aujourd'hui)` par `//                  (la ligne « de retour » remonte dans Aujourd'hui) + 'match_reporte'`.

- [ ] **Step 4 : Mettre à jour les deux appelants d'`execDismiss`**

Dans `src/pages/agent/MatchingAtelierPage.tsx`, remplacer :

```ts
    dismiss: matchId => registry.defer(async () => {
      const e = matchIndex.get(matchId)
      if (!e) return null
      await execDismiss(e.buyer)
```

par :

```ts
    dismiss: matchId => registry.defer(async () => {
      const e = matchIndex.get(matchId)
      if (!e || !ctx) return null
      await execDismiss(ctx, e.buyer)
```

Dans `src/components/crm-mobile/matching/MmMatchingScreen.tsx`, remplacer :

```ts
    dismiss: (matchId) => registry.defer(async () => {
      const e = matchIndex.get(matchId)
      if (!e) return null
      await execDismiss(e.buyer)
```

par :

```ts
    dismiss: (matchId) => registry.defer(async () => {
      const e = matchIndex.get(matchId)
      if (!e || !ctx) return null
      await execDismiss(ctx, e.buyer)
```

- [ ] **Step 5 : Nommer les deux actions (classement et libellés du journal)**

Dans `src/hooks/useAgentNotifications.ts`, remplacer :

```ts
  match_suggested: 'matching', whatsapp_ai_send_listings: 'matching', reception_link_created: 'matching',
```

par :

```ts
  match_suggested: 'matching', whatsapp_ai_send_listings: 'matching', reception_link_created: 'matching',
  match_reporte: 'matching', match_ecarte: 'matching',
```

Puis ajouter les libellés d'audit (le script vérifie que le fichier garde sa mise en forme exacte avant d'écrire) :

```bash
python3 - <<'EOF'
import json
LIBELLES = {
  'fr': {'match_ecarte': 'Match écarté', 'match_reporte': 'Match reporté'},
  'de': {'match_ecarte': 'Match verworfen', 'match_reporte': 'Match zurückgestellt'},
  'en': {'match_ecarte': 'Match dismissed', 'match_reporte': 'Match postponed'},
  'it': {'match_ecarte': 'Match scartato', 'match_reporte': 'Match rinviato'},
}
for langue, libelles in LIBELLES.items():
    chemin = f'src/i18n/locales/{langue}/common.json'
    brut = open(chemin, encoding='utf-8').read()
    donnees = json.loads(brut)
    assert json.dumps(donnees, ensure_ascii=False, indent=2) + '\n' == brut, f'{chemin} : mise en forme inattendue'
    donnees['audit']['action'].update(libelles)
    open(chemin, 'w', encoding='utf-8').write(json.dumps(donnees, ensure_ascii=False, indent=2) + '\n')
    print(chemin, 'ok')
EOF
```

Expected : quatre lignes `… ok`.

- [ ] **Step 6 : Lancer les tests**

Run : `npx vitest run tests/unit/matching-fil-gestes.spec.ts`
Expected : PASS, 2 tests.

Run : `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "useAtelierMatching|MatchingAtelierPage|MmMatchingScreen" ; echo fin`
Expected : seulement `fin`.

- [ ] **Step 7 : Point de commit (au signal)**

```bash
git add src/hooks/useAtelierMatching.ts src/pages/agent/MatchingAtelierPage.tsx src/components/crm-mobile/matching/MmMatchingScreen.tsx src/hooks/useAgentNotifications.ts src/i18n/locales/fr/common.json src/i18n/locales/de/common.json src/i18n/locales/en/common.json src/i18n/locales/it/common.json tests/unit/matching-fil-gestes.spec.ts
git commit -m "fix(matching): Plus tard et Écarter écrivent enfin au journal"
```

---

### Task 3 : Le banc rend un objet après une écriture `.single()`

`execSendDossier` crée un deal par `.insert(…).select('id').single()`. Le banc rendait toujours un tableau après une écriture : `created.id` valait `undefined` en silence.

**Files :**
- Modify : `src/pages/dev/bancSupabase.ts`
- Test : `tests/unit/banc-supabase.spec.ts` (ajout en fin de fichier)

- [ ] **Step 1 : Écrire le test**

Ajouter à la FIN de `tests/unit/banc-supabase.spec.ts` :

```ts

describe('bancSupabase — une écriture suivie de `.single()`', () => {
  /**
   * ⛔ `postgrest-js` pose le même `Accept` sur `.insert(…).select().single()` que sur une lecture.
   * Le banc rendait un TABLEAU après toute écriture : `created.id` valait `undefined` et le deal
   * créé par « Proposer » n'avait pas d'identifiant, sans rien dans la console.
   */
  it('POST rend un OBJET quand l’en-tête le demande, un tableau sinon', async () => {
    reglerBanc({ etat: 'nominal', tables: { essais: [...LIGNES] }, ecrivables: ['essais'] })
    const objet = await window.fetch(`${REST}essais?select=id`, {
      method: 'POST', headers: new Headers({ Accept: OBJET_SEUL }), body: JSON.stringify({ nom: 'Charlie' }),
    }).then((r) => r.json()) as Record<string, unknown>
    expect(Array.isArray(objet)).toBe(false)
    expect(objet).toMatchObject({ nom: 'Charlie' })

    const tableau = await window.fetch(`${REST}essais`, { method: 'POST', body: JSON.stringify({ nom: 'Delta' }) }).then((r) => r.json())
    expect(Array.isArray(tableau)).toBe(true)
    reglerBanc({ tables: { essais: LIGNES }, ecrivables: [] })
  })
})
```

- [ ] **Step 2 : Lancer, constater l'échec**

Run : `npx vitest run tests/unit/banc-supabase.spec.ts`
Expected : FAIL sur « POST rend un OBJET » (`expected true to be false`).

- [ ] **Step 3 : Implémenter**

Dans `src/pages/dev/bancSupabase.ts`, remplacer :

```ts
    return ecrire(methode, lignes as Record<string, unknown>[], requete, init, contrat.completions[chemin])
```

par :

```ts
    return ecrire(methode, lignes as Record<string, unknown>[], requete, init, contrat.completions[chemin], objetSeul)
```

Puis remplacer l'en-tête et le corps de la fonction `ecrire` :

```ts
function ecrire(
  methode: string, lignes: Record<string, unknown>[], requete: string, init?: RequestInit,
  completer?: (ligne: Record<string, unknown>) => Record<string, unknown>,
): Response {
  if (contrat.etat !== 'nominal') return json([], 0)
```

par :

```ts
function ecrire(
  methode: string, lignes: Record<string, unknown>[], requete: string, init?: RequestInit,
  completer?: (ligne: Record<string, unknown>) => Record<string, unknown>,
  objetSeul = false,
): Response {
  // ⛔ Même forme que la lecture : `.select().single()` après une écriture attend un OBJET.
  const rendre = (l: Record<string, unknown>[]) => json(objetSeul ? (l[0] ?? null) : l, l.length)
  if (contrat.etat !== 'nominal') return rendre([])
```

et, dans le même corps, `    return json(nouvelles, nouvelles.length)` par `    return rendre(nouvelles)`, puis `  return json(cibles, cibles.length)` par `  return rendre(cibles)`.

Ajouter à la docstring d'`ecrire`, après « Hors « Nominal », rien ne s'écrit. » : ` La forme rendue suit l'en-tête Accept, comme une lecture.`

- [ ] **Step 4 : Lancer les tests**

Run : `npx vitest run tests/unit/banc-supabase.spec.ts`
Expected : PASS (tous).

- [ ] **Step 5 : Point de commit (au signal)**

```bash
git add src/pages/dev/bancSupabase.ts tests/unit/banc-supabase.spec.ts
git commit -m "fix(banc): une écriture suivie de .single() rend un objet"
```

---

### Task 4 : Les données du fil

**Files :**
- Create : `src/hooks/useMatchingFil.ts`

- [ ] **Step 1 : Écrire le hook**

Créer `src/hooks/useMatchingFil.ts` :

```ts
/**
 * Données du fil de matchs (lot 1 : « À traiter » sur les biens de l'agence).
 *
 * Conception : `docs/superpowers/specs/2026-09-17-matching-fil-design.md`, §8.
 *
 * ⛔ DES LECTURES PLATES, AUCUNE JOINTURE EMBARQUÉE. L'atelier charge tous les matchs de l'agence
 * avec `properties(*)` et `market_listings(*)` — descriptions et galeries comprises, 1 628 lignes
 * en production le 17.09.2026 — contre le §7 de CLAUDE.md. Ici : les matchs `suggested` des biens
 * en mandat (10 en production), puis leurs contacts, leurs recherches, leurs biens (colonnes légères)
 * et le KYC, par `in`. Et le banc `/dev/crm` n'applique pas `select` : une jointure y rendrait des
 * lignes sans acheteur ni bien, et l'écran mentirait sur ce que la production affiche.
 *
 * ⛔ LES CRITÈRES VIENNENT DE LA RECHERCHE DU MATCH (`client_searches.criteria`, par
 * `matches.client_search_id`) — ce que le moteur a noté. `contacts.search_criteria` n'est qu'un
 * repli : mesuré le 17.09.2026, il est vide pour 3 acheteurs sur 4.
 *
 * ⚠ UNE RECHERCHE MODIFIÉE GARDE LES RAISONS DE L'ANCIENNE : `insert_internal_matches` ne re-note pas
 * une paire existante (`ON CONFLICT DO NOTHING`). Aucun signal fiable ne permet de les écarter ici —
 * `client_searches.updated_at` bouge à CHAQUE enregistrement du contact (trigger de synchro), et s'y
 * fier effacerait les verdicts d'un acheteur dont on a corrigé la nationalité. La re-notation est un
 * chantier du moteur, à trancher avant la bascule de production (conception §13).
 *
 * ⚠ Le filtre « bien en mandat » est posé DEUX fois : `not(property_id, is, null)` pour la base, et
 * côté client pour le banc, qui ne connaît pas l'opérateur `not`.
 */
import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { mapKycStatus } from '@/lib/crmAdapters'
import { refBienInterne, type AcheteurGeste, type BienGeste } from '@/hooks/useAtelierMatching'
import type { SearchCriteria } from '@/types/contact'
import type { KycDossierStatus } from '@/types/kyc'
import {
  compterHistorique, type FilBien, type FilMatch, type Historique, type RaisonsMoteur,
} from '@/components/matching-fil/filModele'

interface LigneMatch {
  id: string; contact_id: string; property_id: string | null; client_search_id: string | null; score: number
  reasons: RaisonsMoteur | null; snoozed_until: string | null; created_at: string | null
}
interface LigneContact {
  id: string; first_name: string; last_name: string; email: string | null; phone: string | null
  search_criteria: SearchCriteria | null
}
interface LigneBien {
  id: string; title: string | null; type: string | null; transaction_type: string | null
  price: number | string | null; rooms: number | string | null; surface_m2: number | string | null
  address: string | null; city: string | null; canton: string | null; features: unknown; photos: string[] | null
}
interface DonneesFil { matchs: FilMatch[]; historique: Map<string, Historique>; chargeLe: number }

const CLE = 'matching-fil'
const VIDE: DonneesFil = { matchs: [], historique: new Map(), chargeLe: 0 }

async function lire<T>(requete: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await requete
  if (error) throw error
  return (data ?? []) as T[]
}

const nombre = (v: number | string | null): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : null
}

function equipements(brut: unknown): string[] {
  if (Array.isArray(brut)) return brut.filter((f): f is string => typeof f === 'string')
  if (brut && typeof brut === 'object') {
    return Object.entries(brut as Record<string, unknown>).filter(([, v]) => Boolean(v)).map(([k]) => k)
  }
  return []
}

function versBien(b: LigneBien): FilBien {
  return {
    id: b.id, titre: b.title ?? '', prix: nombre(b.price), location: b.transaction_type === 'rent',
    type: b.type, pieces: nombre(b.rooms), surface: nombre(b.surface_m2), ville: b.city, canton: b.canton,
    adresse: b.address, equipements: equipements(b.features), photo: b.photos?.[0] ?? null,
  }
}

async function chargerFil(agencyId: string): Promise<DonneesFil> {
  const bruts = await lire<LigneMatch>(
    supabase.from('matches')
      .select('id, contact_id, property_id, client_search_id, score, reasons, snoozed_until, created_at')
      .eq('agency_id', agencyId)
      .eq('status', 'suggested')
      .not('property_id', 'is', null)
      .order('score', { ascending: false }),
  )
  const lignes = bruts.filter((m) => m.property_id != null)
  if (lignes.length === 0) return { matchs: [], historique: new Map(), chargeLe: Date.now() }
  const contactIds = [...new Set(lignes.map((m) => m.contact_id))]
  const bienIds = [...new Set(lignes.map((m) => m.property_id as string))]
  const rechercheIds = [...new Set(lignes.map((m) => m.client_search_id).filter((id): id is string => id != null))]

  const [contacts, recherches, biens, kyc, historique] = await Promise.all([
    lire<LigneContact>(supabase.from('contacts').select('id, first_name, last_name, email, phone, search_criteria').in('id', contactIds)),
    rechercheIds.length > 0
      ? lire<{ id: string; criteria: SearchCriteria | null }>(supabase.from('client_searches').select('id, criteria').in('id', rechercheIds))
      : Promise.resolve([]),
    lire<LigneBien>(
      supabase.from('properties')
        .select('id, title, type, transaction_type, price, rooms, surface_m2, address, city, canton, features, photos')
        .in('id', bienIds),
    ),
    lire<{ contact_id: string; dossier_status: KycDossierStatus | null }>(
      supabase.from('kyc_cases').select('contact_id, dossier_status')
        .in('contact_id', contactIds).in('type', ['buyer_pp', 'buyer_pm']).order('created_at', { ascending: false }),
    ),
    lire<{ contact_id: string; status: string }>(
      supabase.from('matches').select('contact_id, status')
        .eq('agency_id', agencyId).in('contact_id', contactIds).in('status', ['sent', 'interested', 'rejected', 'visit_planned']),
    ),
  ])

  const contactParId = new Map(contacts.map((c) => [c.id, c]))
  const criteresParRecherche = new Map(recherches.map((r) => [r.id, r.criteria]))
  const bienParId = new Map(biens.map((b) => [b.id, versBien(b)]))
  const kycParContact = new Map<string, KycDossierStatus | null>()
  for (const k of kyc) if (!kycParContact.has(k.contact_id)) kycParContact.set(k.contact_id, k.dossier_status)

  const matchs: FilMatch[] = []
  for (const m of lignes) {
    const c = contactParId.get(m.contact_id)
    const bien = bienParId.get(m.property_id as string)
    // Un contact ou un bien que la RLS ne rend pas : on n'invente pas la ligne.
    if (!c || !bien) continue
    matchs.push({
      id: m.id, score: m.score, raisons: m.reasons, creeLe: m.created_at, reporteJusquau: m.snoozed_until, bien,
      criteres: (m.client_search_id ? criteresParRecherche.get(m.client_search_id) : null) ?? c.search_criteria,
      acheteur: {
        id: c.id, prenom: c.first_name, nom: c.last_name, telephone: c.phone, email: c.email,
        kyc: mapKycStatus(kycParContact.get(c.id) ?? undefined),
      },
    })
  }
  return { matchs, historique: compterHistorique(historique), chargeLe: Date.now() }
}

/** Les matchs « À traiter » des biens de l'agence, leur historique d'envois, et l'heure du chargement. */
export function useMatchingFil(): DonneesFil & { isLoading: boolean; isError: boolean; rafraichir: () => void } {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const client = useQueryClient()
  const requete = useQuery({
    queryKey: [CLE, agencyId],
    queryFn: () => chargerFil(agencyId as string),
    enabled: agencyId != null,
  })
  const rafraichir = useCallback(() => { void client.invalidateQueries({ queryKey: [CLE] }) }, [client])
  // ⚠ Une requête DÉSACTIVÉE n'est pas « en chargement » pour TanStack v5 (`isLoading` faux) : sans
  // la garde sur le profil, le fil afficherait « Tout est à jour » le temps que la session arrive.
  return { ...(requete.data ?? VIDE), isLoading: profile == null || requete.isLoading, isError: requete.isError, rafraichir }
}

/** Ce que les exécuteurs de l'atelier lisent d'un match du fil : ils restent la source unique des écritures. */
export function versGeste(m: FilMatch): { acheteur: AcheteurGeste; bien: BienGeste } {
  return {
    acheteur: { id: m.acheteur.id, matchId: m.id, first: m.acheteur.prenom, last: m.acheteur.nom, email: m.acheteur.email, score: m.score },
    bien: {
      kind: 'property', id: m.bien.id, key: `p:${m.bien.id}`, ref: refBienInterne(m.bien.id), title: m.bien.titre,
      price: m.bien.prix ?? 0, addr: [m.bien.adresse, m.bien.ville].filter(Boolean).join(', '),
      rooms: m.bien.pieces, area: m.bien.surface, type: m.bien.type ?? '',
      gallery: m.bien.photo ? [{ url: m.bien.photo, room: 'Photos', label: 'Photo 01' }] : [],
      sourceUrl: null, agency: { name: null, phone: null },
    },
  }
}
```

- [ ] **Step 2 : Vérifier les types**

Run : `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "useMatchingFil|filModele" ; echo fin`
Expected : seulement `fin`.

(Pas de test unitaire : la lecture est éprouvée sur le banc, Task 13, par les vrais appels interceptés.)

- [ ] **Step 3 : Point de commit (au signal)** — avec la Task 10 (le hook n'a pas encore de lecteur ; `lint:deadcode` rougirait seul).

---

### Task 5 : Les traductions du fil

**Files :**
- Modify : `src/i18n/locales/{fr,de,en,it}/matching.json`

- [ ] **Step 1 : Écrire le bloc `fil` dans les quatre langues**

```bash
python3 - <<'EOF'
import json
FR = {
  "titre": "Matching", "aTraiter": "À traiter · {{count}}", "chargement": "Chargement des matchs",
  "filtres": {"bien": "Filtrer par bien", "tousLesBiens": "Tous les biens", "acheteur": "Filtrer par acheteur", "tousLesAcheteurs": "Tous les acheteurs", "recherche": "Rechercher un bien ou un acheteur", "retirer": "Retirer les filtres"},
  "vosBiens": "Vos biens", "listeAria": "Matchs à traiter",
  "acheteurs_one": "{{count}} acheteur", "acheteurs_other": "{{count}} acheteurs",
  "sansEcart": "Aucun écart signalé", "ecartSur": "{{critere}} à vérifier", "nonEvalues": "Critères non évalués", "sansCriteres": "Aucun critère détaillé",
  "reportes_one": "{{count}} reporté · de retour dès le {{date}}", "reportes_other": "{{count}} reportés · de retour dès le {{date}}",
  "deRetour": "de retour le {{date}}", "reactiver": "Réactiver",
  "votreBien": "Votre bien", "voirBien": "Voir le bien", "sansPhoto": "Pas de photo", "estimation": "estimation",
  "scoreAria": "Score {{score}}, estimation · {{palier}}",
  "palier": {"fort": "très proche", "bon": "proche", "possible": "à examiner"},
  "kyc": {"verified": "KYC vérifié", "pending": "KYC en cours", "stale": "KYC à renouveler", "none": "KYC à compléter"},
  "panneauAria": "{{acheteur}} pour {{bien}}", "pourquoi": "Pourquoi ce match",
  "colonnes": {"critere": "Critère", "recherche": "Recherché", "bien": "Ce bien", "verdict": "Verdict"},
  "criteres": {"budget": "Budget", "zone": "Quartier", "type": "Type", "pieces": "Pièces", "surface": "Surface", "equipements": "Équipements"},
  "correspond": "Correspond", "ecart": "Écart",
  "valeurs": {"entre": "{{min}} à {{max}}", "jusqua": "jusqu'à {{valeur}}", "desDe": "dès {{valeur}}", "auMoins": "{{valeur}} et plus", "auPlus": "{{valeur}} au plus", "m2": "{{valeur}} m²", "parMois": "{{valeur}} / mois", "presents": "{{n}} sur {{total}}", "inconnu": "Non renseigné"},
  "types": {"apartment": "Appartement", "house": "Maison", "villa": "Villa", "office": "Bureau", "commercial": "Commercial", "parking": "Parking", "storage": "Dépôt", "land": "Terrain"},
  "equipementsNoms": {"balcon": "Balcon", "terrasse": "Terrasse", "jardin": "Jardin", "ascenseur": "Ascenseur", "cave": "Cave", "parking": "Parking", "garage": "Garage", "piscine": "Piscine", "cheminee": "Cheminée", "climatisation": "Climatisation", "parquet": "Parquet", "vue-lac": "Vue lac", "vue": "Vue", "place-de-parc": "Place de parc", "clim": "Climatisation"},
  "historique": {"aucun": "Déjà reçu par {{prenom}} : aucun envoi", "proposes_one": "Déjà reçu par {{prenom}} : {{count}} bien proposé", "proposes_other": "Déjà reçu par {{prenom}} : {{count}} biens proposés", "interesses_one": " · {{count}} intéressé", "interesses_other": " · {{count}} intéressés"},
  "actions": {"proposer": "Proposer à {{prenom}}", "plusTard": "Plus tard", "ecarter": "Écarter", "raccourci": "Raccourci : {{touche}}"},
  "reporte": "{{nom}} reporté·e d'une semaine", "ecarte": "{{nom}} écarté·e pour ce bien", "annuler": "Annuler",
  "erreurGeste": "Le geste n'a pas pu être enregistré. Réessayez.",
  "envoi": {"titre": "Proposer à {{prenom}}", "texte": "Un lien privé. {{prenom}} voit le bien et vous dit s'il l'intéresse. Sa réponse est enregistrée dans sa fiche.", "whatsapp": "Envoyer par WhatsApp", "copier": "Copier le lien", "sansTelephone": "{{prenom}} n'a pas de numéro : copiez le lien pour le lui transmettre.", "copie": "Lien copié", "copierAMain": "Copiez ce lien :", "lienAria": "Lien privé pour {{prenom}}", "termine": "Terminé", "erreur": "Le lien n'a pas pu être préparé. Réessayez.", "erreurSuivi": "Le lien est parti, mais le suivi n'a pas pu être enregistré.", "fait": "Bien proposé à {{prenom}}"},
  "vide": {"titre": "Tout est à jour", "texte": "Aucun de vos biens n'attend d'être proposé.", "contacts": "Compléter la recherche d'un contact", "marche": "Voir le marché"},
  "filtreVide": "Rien ne correspond à ces filtres.", "choisir": "Choisissez un match dans la liste.",
  "erreur": "Les matchs n'ont pas pu être chargés.", "reessayer": "Réessayer",
}
EN = {
  "titre": "Matching", "aTraiter": "To review · {{count}}", "chargement": "Loading matches",
  "filtres": {"bien": "Filter by property", "tousLesBiens": "All properties", "acheteur": "Filter by buyer", "tousLesAcheteurs": "All buyers", "recherche": "Search a property or a buyer", "retirer": "Clear filters"},
  "vosBiens": "Your properties", "listeAria": "Matches to review",
  "acheteurs_one": "{{count}} buyer", "acheteurs_other": "{{count}} buyers",
  "sansEcart": "No gaps flagged", "ecartSur": "{{critere}} to check", "nonEvalues": "Criteria not assessed", "sansCriteres": "No detailed criteria",
  "reportes_one": "{{count}} postponed · back from {{date}}", "reportes_other": "{{count}} postponed · back from {{date}}",
  "deRetour": "back on {{date}}", "reactiver": "Reactivate",
  "votreBien": "Your property", "voirBien": "View property", "sansPhoto": "No photo", "estimation": "estimate",
  "scoreAria": "Score {{score}}, estimate · {{palier}}",
  "palier": {"fort": "very close", "bon": "close", "possible": "worth a look"},
  "kyc": {"verified": "KYC verified", "pending": "KYC in progress", "stale": "KYC to renew", "none": "KYC to complete"},
  "panneauAria": "{{acheteur}} for {{bien}}", "pourquoi": "Why this match",
  "colonnes": {"critere": "Criterion", "recherche": "Looking for", "bien": "This property", "verdict": "Verdict"},
  "criteres": {"budget": "Budget", "zone": "Area", "type": "Type", "pieces": "Rooms", "surface": "Surface", "equipements": "Features"},
  "correspond": "Matches", "ecart": "Differs",
  "valeurs": {"entre": "{{min}} to {{max}}", "jusqua": "up to {{valeur}}", "desDe": "from {{valeur}}", "auMoins": "{{valeur}} or more", "auPlus": "{{valeur}} at most", "m2": "{{valeur}} m²", "parMois": "{{valeur}} / month", "presents": "{{n}} of {{total}}", "inconnu": "Not specified"},
  "types": {"apartment": "Apartment", "house": "House", "villa": "Villa", "office": "Office", "commercial": "Commercial", "parking": "Parking", "storage": "Storage", "land": "Land"},
  "equipementsNoms": {"balcon": "Balcony", "terrasse": "Terrace", "jardin": "Garden", "ascenseur": "Lift", "cave": "Cellar", "parking": "Parking", "garage": "Garage", "piscine": "Pool", "cheminee": "Fireplace", "climatisation": "Air conditioning", "parquet": "Parquet", "vue-lac": "Lake view", "vue": "View", "place-de-parc": "Parking space", "clim": "Air conditioning"},
  "historique": {"aucun": "Already sent to {{prenom}}: nothing yet", "proposes_one": "Already sent to {{prenom}}: {{count}} property", "proposes_other": "Already sent to {{prenom}}: {{count}} properties", "interesses_one": " · {{count}} interested", "interesses_other": " · {{count}} interested"},
  "actions": {"proposer": "Propose to {{prenom}}", "plusTard": "Later", "ecarter": "Dismiss", "raccourci": "Shortcut: {{touche}}"},
  "reporte": "{{nom}} postponed by a week", "ecarte": "{{nom}} dismissed for this property", "annuler": "Undo",
  "erreurGeste": "This action couldn't be saved. Try again.",
  "envoi": {"titre": "Propose to {{prenom}}", "texte": "A private link. {{prenom}} sees the property and tells you whether it's of interest. The answer is saved to their record.", "whatsapp": "Send via WhatsApp", "copier": "Copy link", "sansTelephone": "{{prenom}} has no phone number: copy the link to share it.", "copie": "Link copied", "copierAMain": "Copy this link:", "lienAria": "Private link for {{prenom}}", "termine": "Done", "erreur": "The link couldn't be prepared. Try again.", "erreurSuivi": "The link was sent, but the follow-up couldn't be saved.", "fait": "Property proposed to {{prenom}}"},
  "vide": {"titre": "All caught up", "texte": "None of your properties is waiting to be proposed.", "contacts": "Complete a contact's search", "marche": "View the market"},
  "filtreVide": "Nothing matches these filters.", "choisir": "Pick a match from the list.",
  "erreur": "Matches couldn't be loaded.", "reessayer": "Try again",
}
DE = {
  "titre": "Matching", "aTraiter": "Zu bearbeiten · {{count}}", "chargement": "Matches werden geladen",
  "filtres": {"bien": "Nach Objekt filtern", "tousLesBiens": "Alle Objekte", "acheteur": "Nach Käufer filtern", "tousLesAcheteurs": "Alle Käufer", "recherche": "Objekt oder Käufer suchen", "retirer": "Filter entfernen"},
  "vosBiens": "Ihre Objekte", "listeAria": "Zu bearbeitende Matches",
  "acheteurs_one": "{{count}} Käufer", "acheteurs_other": "{{count}} Käufer",
  "sansEcart": "Keine Abweichung gemeldet", "ecartSur": "{{critere}} prüfen", "nonEvalues": "Kriterien nicht bewertet", "sansCriteres": "Keine detaillierten Kriterien",
  "reportes_one": "{{count}} zurückgestellt · zurück ab {{date}}", "reportes_other": "{{count}} zurückgestellt · zurück ab {{date}}",
  "deRetour": "zurück am {{date}}", "reactiver": "Reaktivieren",
  "votreBien": "Ihr Objekt", "voirBien": "Objekt ansehen", "sansPhoto": "Kein Foto", "estimation": "Schätzung",
  "scoreAria": "Score {{score}}, Schätzung · {{palier}}",
  "palier": {"fort": "sehr nah", "bon": "nah", "possible": "prüfenswert"},
  "kyc": {"verified": "KYC geprüft", "pending": "KYC läuft", "stale": "KYC erneuern", "none": "KYC vervollständigen"},
  "panneauAria": "{{acheteur}} für {{bien}}", "pourquoi": "Warum dieser Match",
  "colonnes": {"critere": "Kriterium", "recherche": "Gesucht", "bien": "Dieses Objekt", "verdict": "Ergebnis"},
  "criteres": {"budget": "Budget", "zone": "Gegend", "type": "Typ", "pieces": "Zimmer", "surface": "Fläche", "equipements": "Ausstattung"},
  "correspond": "Erfüllt", "ecart": "Abweichung",
  "valeurs": {"entre": "{{min}} bis {{max}}", "jusqua": "bis {{valeur}}", "desDe": "ab {{valeur}}", "auMoins": "{{valeur}} oder mehr", "auPlus": "höchstens {{valeur}}", "m2": "{{valeur}} m²", "parMois": "{{valeur}} / Monat", "presents": "{{n}} von {{total}}", "inconnu": "Nicht angegeben"},
  "types": {"apartment": "Wohnung", "house": "Haus", "villa": "Villa", "office": "Büro", "commercial": "Gewerbe", "parking": "Parkplatz", "storage": "Lager", "land": "Grundstück"},
  "equipementsNoms": {"balcon": "Balkon", "terrasse": "Terrasse", "jardin": "Garten", "ascenseur": "Lift", "cave": "Keller", "parking": "Parkplatz", "garage": "Garage", "piscine": "Pool", "cheminee": "Cheminée", "climatisation": "Klimaanlage", "parquet": "Parkett", "vue-lac": "Seesicht", "vue": "Aussicht", "place-de-parc": "Parkplatz", "clim": "Klimaanlage"},
  "historique": {"aucun": "Bereits an {{prenom}} gesendet: noch nichts", "proposes_one": "Bereits an {{prenom}} gesendet: {{count}} Objekt", "proposes_other": "Bereits an {{prenom}} gesendet: {{count}} Objekte", "interesses_one": " · {{count}} interessiert", "interesses_other": " · {{count}} interessiert"},
  "actions": {"proposer": "An {{prenom}} senden", "plusTard": "Später", "ecarter": "Verwerfen", "raccourci": "Tastenkürzel: {{touche}}"},
  "reporte": "{{nom}} um eine Woche zurückgestellt", "ecarte": "{{nom}} für dieses Objekt verworfen", "annuler": "Rückgängig",
  "erreurGeste": "Die Aktion konnte nicht gespeichert werden. Bitte erneut versuchen.",
  "envoi": {"titre": "An {{prenom}} senden", "texte": "Ein privater Link. {{prenom}} sieht das Objekt und sagt Ihnen, ob es passt. Die Antwort wird im Kontakt gespeichert.", "whatsapp": "Per WhatsApp senden", "copier": "Link kopieren", "sansTelephone": "{{prenom}} hat keine Telefonnummer: Kopieren Sie den Link, um ihn weiterzugeben.", "copie": "Link kopiert", "copierAMain": "Diesen Link kopieren:", "lienAria": "Privater Link für {{prenom}}", "termine": "Fertig", "erreur": "Der Link konnte nicht erstellt werden. Bitte erneut versuchen.", "erreurSuivi": "Der Link wurde gesendet, aber die Nachverfolgung konnte nicht gespeichert werden.", "fait": "Objekt an {{prenom}} gesendet"},
  "vide": {"titre": "Alles erledigt", "texte": "Keines Ihrer Objekte wartet auf einen Vorschlag.", "contacts": "Suche eines Kontakts ergänzen", "marche": "Markt ansehen"},
  "filtreVide": "Nichts entspricht diesen Filtern.", "choisir": "Wählen Sie einen Match aus der Liste.",
  "erreur": "Die Matches konnten nicht geladen werden.", "reessayer": "Erneut versuchen",
}
IT = {
  "titre": "Matching", "aTraiter": "Da gestire · {{count}}", "chargement": "Caricamento dei match",
  "filtres": {"bien": "Filtra per immobile", "tousLesBiens": "Tutti gli immobili", "acheteur": "Filtra per acquirente", "tousLesAcheteurs": "Tutti gli acquirenti", "recherche": "Cerca un immobile o un acquirente", "retirer": "Rimuovi i filtri"},
  "vosBiens": "I vostri immobili", "listeAria": "Match da gestire",
  "acheteurs_one": "{{count}} acquirente", "acheteurs_other": "{{count}} acquirenti",
  "sansEcart": "Nessuna differenza segnalata", "ecartSur": "{{critere}} da verificare", "nonEvalues": "Criteri non valutati", "sansCriteres": "Nessun criterio dettagliato",
  "reportes_one": "{{count}} rinviato · di ritorno dal {{date}}", "reportes_other": "{{count}} rinviati · di ritorno dal {{date}}",
  "deRetour": "di ritorno il {{date}}", "reactiver": "Riattiva",
  "votreBien": "Il vostro immobile", "voirBien": "Vedi l'immobile", "sansPhoto": "Nessuna foto", "estimation": "stima",
  "scoreAria": "Punteggio {{score}}, stima · {{palier}}",
  "palier": {"fort": "molto vicino", "bon": "vicino", "possible": "da valutare"},
  "kyc": {"verified": "KYC verificato", "pending": "KYC in corso", "stale": "KYC da rinnovare", "none": "KYC da completare"},
  "panneauAria": "{{acheteur}} per {{bien}}", "pourquoi": "Perché questo match",
  "colonnes": {"critere": "Criterio", "recherche": "Cercato", "bien": "Questo immobile", "verdict": "Esito"},
  "criteres": {"budget": "Budget", "zone": "Zona", "type": "Tipo", "pieces": "Locali", "surface": "Superficie", "equipements": "Dotazioni"},
  "correspond": "Corrisponde", "ecart": "Differenza",
  "valeurs": {"entre": "da {{min}} a {{max}}", "jusqua": "fino a {{valeur}}", "desDe": "da {{valeur}}", "auMoins": "{{valeur}} o più", "auPlus": "al massimo {{valeur}}", "m2": "{{valeur}} m²", "parMois": "{{valeur}} / mese", "presents": "{{n}} su {{total}}", "inconnu": "Non indicato"},
  "types": {"apartment": "Appartamento", "house": "Casa", "villa": "Villa", "office": "Ufficio", "commercial": "Commerciale", "parking": "Parcheggio", "storage": "Deposito", "land": "Terreno"},
  "equipementsNoms": {"balcon": "Balcone", "terrasse": "Terrazza", "jardin": "Giardino", "ascenseur": "Ascensore", "cave": "Cantina", "parking": "Parcheggio", "garage": "Garage", "piscine": "Piscina", "cheminee": "Camino", "climatisation": "Aria condizionata", "parquet": "Parquet", "vue-lac": "Vista lago", "vue": "Vista", "place-de-parc": "Posto auto", "clim": "Aria condizionata"},
  "historique": {"aucun": "Già inviato a {{prenom}}: ancora nulla", "proposes_one": "Già inviato a {{prenom}}: {{count}} immobile", "proposes_other": "Già inviato a {{prenom}}: {{count}} immobili", "interesses_one": " · {{count}} interessato", "interesses_other": " · {{count}} interessati"},
  "actions": {"proposer": "Proponi a {{prenom}}", "plusTard": "Più tardi", "ecarter": "Scarta", "raccourci": "Scorciatoia: {{touche}}"},
  "reporte": "{{nom}} rinviato di una settimana", "ecarte": "{{nom}} scartato per questo immobile", "annuler": "Annulla",
  "erreurGeste": "L'azione non è stata registrata. Riprovate.",
  "envoi": {"titre": "Proponi a {{prenom}}", "texte": "Un link privato. {{prenom}} vede l'immobile e vi dice se gli interessa. La risposta viene registrata nella sua scheda.", "whatsapp": "Invia via WhatsApp", "copier": "Copia il link", "sansTelephone": "{{prenom}} non ha un numero: copiate il link per trasmetterlo.", "copie": "Link copiato", "copierAMain": "Copiate questo link:", "lienAria": "Link privato per {{prenom}}", "termine": "Fatto", "erreur": "Il link non è stato preparato. Riprovate.", "erreurSuivi": "Il link è partito, ma il seguito non è stato registrato.", "fait": "Immobile proposto a {{prenom}}"},
  "vide": {"titre": "Tutto in ordine", "texte": "Nessuno dei vostri immobili è in attesa di essere proposto.", "contacts": "Completa la ricerca di un contatto", "marche": "Vedi il mercato"},
  "filtreVide": "Nulla corrisponde a questi filtri.", "choisir": "Scegliete un match dalla lista.",
  "erreur": "Impossibile caricare i match.", "reessayer": "Riprova",
}
for langue, bloc in {'fr': FR, 'de': DE, 'en': EN, 'it': IT}.items():
    chemin = f'src/i18n/locales/{langue}/matching.json'
    brut = open(chemin, encoding='utf-8').read()
    donnees = json.loads(brut)
    assert json.dumps(donnees, ensure_ascii=False, indent=2) + '\n' == brut, f'{chemin} : mise en forme inattendue'
    assert 'fil' not in donnees, f'{chemin} : un bloc fil existe déjà'
    donnees['fil'] = bloc
    open(chemin, 'w', encoding='utf-8').write(json.dumps(donnees, ensure_ascii=False, indent=2) + '\n')
    print(chemin, 'ok')
EOF
```

Expected : quatre lignes `… ok`.

- [ ] **Step 2 : Vérifier parité et typographie**

Run : `npm run i18n:parity:ci && npm run lint:prose`
Expected : les deux sortent en 0 (aucune clé manquante ni orpheline, aucun tiret cadratin, demi-cadratin ou ß).

- [ ] **Step 3 : Point de commit (au signal)** — avec la Task 10 (les clés n'ont pas encore de lecteur).

---

### Task 6 : Affichage et atomes

**Files :**
- Create : `src/components/matching-fil/filAffichage.ts`
- Create : `src/components/matching-fil/filAtomes.tsx`

- [ ] **Step 1 : Créer `filAffichage.ts`**

```ts
/**
 * Affichage du fil de matchs sans React : les teintes qui ENCODENT (le palier d'un score, un critère
 * tenu, un écart), l'encre d'une action en texte, et l'écriture d'un prix.
 *
 * ⚠ Jamais d'aplat teinté sous du texte : la couleur est portée par une pastille ou une icône, le
 * chiffre et les libellés restent à l'encre. Les couleurs de système de la vitrine sont PÂLES,
 * réglées pour le noir ; en clair l'encre passe par `STATUT_CLAIR` (CLAUDE.md §3, point 4 de
 * « Sombre — échelle MEGGA X »).
 */
import type { TFunction } from 'i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { STATUT_CLAIR } from '@/components/megga-x-crm/statut'
import { formatCHF } from '@/lib/utils'
import type { FilBien, PalierScore } from './filModele'

/** Pastille du palier : vert, bleu de marque, ou la sourdine. */
export function teinteScore(palier: PalierScore, sp: CrmPalette): string {
  if (palier === 'fort') return sp.isDark ? MXC_SYSTEM.green400 : STATUT_CLAIR.okInk
  if (palier === 'bon') return sp.isDark ? MXC_SYSTEM.blue300 : sp.accent
  return sp.sub
}

/** Un critère tenu, un KYC vérifié. */
export const teinteTenu = (sp: CrmPalette): string => (sp.isDark ? MXC_SYSTEM.green400 : STATUT_CLAIR.okInk)

/** Un écart signalé par le moteur. */
export const teinteEcart = (sp: CrmPalette): string => (sp.isDark ? MXC_SYSTEM.yellow400 : STATUT_CLAIR.warnInk)

/** Encre d'une action en TEXTE : l'accent ne passe pas l'AA en texte sur sombre (3,44:1). */
export const encreAccent = (sp: CrmPalette): string => (sp.isDark ? MXC_SYSTEM.blue300 : sp.accent)

/** Encre d'une erreur. */
export const teinteErreur = (sp: CrmPalette): string => (sp.isDark ? MXC_SYSTEM.red400 : STATUT_CLAIR.errInk)

/** « CHF 1'450'000 », ou « CHF 2'950 / mois » pour une location. */
export function prixBien(bien: FilBien, t: TFunction): string {
  if (bien.prix == null) return t('fil.valeurs.inconnu')
  return bien.location ? t('fil.valeurs.parMois', { valeur: formatCHF(bien.prix) }) : formatCHF(bien.prix)
}
```

- [ ] **Step 2 : Créer `filAtomes.tsx`**

```tsx
/**
 * Atomes du fil de matchs — l'avatar, la vignette d'un bien et le score, partagés par la liste, le
 * panneau et la feuille d'envoi : un même acheteur ou un même score ne se dessine jamais de deux
 * façons sur un écran.
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import type { PalierScore } from './filModele'
import { teinteScore } from './filAffichage'

/** Initiales sur la sous-surface, neutres : une couleur d'avatar n'encode rien ici. */
export function FilAvatar({ sp, texte, taille }: { sp: CrmPalette; texte: string; taille: number }) {
  // Hors de la déclaration de style : le cliquet de grammaire lirait ce seuil comme une taille de texte.
  const texteGrand = taille >= 36
  return (
    <span aria-hidden style={{
      width: taille, height: taille, flex: 'none', display: 'grid', placeItems: 'center',
      borderRadius: 'var(--crm-radius-pill)', background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`,
      color: sp.ink, fontSize: texteGrand ? 'var(--crm-text-md)' : 'var(--crm-text-xs)', fontWeight: 600,
    }}>
      {texte}
    </span>
  )
}

/** La première photo d'un bien, ou une maison en sourdine. */
export function FilVignette({ sp, photo, largeur, hauteur }: { sp: CrmPalette; photo: string | null; largeur: number; hauteur: number }) {
  return (
    <span aria-hidden style={{
      width: largeur, height: hauteur, flex: 'none', display: 'grid', placeItems: 'center', overflow: 'hidden',
      borderRadius: 'var(--crm-radius-xs)', background: sp.cardSubBg,
    }}>
      {photo
        ? <img src={photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <MEIcon name="home" size={14} color={sp.sub} />}
    </span>
  )
}

/** Le score : le chiffre à l'encre, le palier dans la pastille. Toujours une estimation (CLAUDE.md §5). */
export function FilScore({ sp, score, palier, grand = false }: { sp: CrmPalette; score: number; palier: PalierScore; grand?: boolean }) {
  const { t } = useTranslation('matching')
  const libelle = t('fil.scoreAria', { score, palier: t(`fil.palier.${palier}`) })
  return (
    <span title={libelle} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', flex: 'none' }}>
      <span aria-hidden style={{ width: grand ? 10 : 8, height: grand ? 10 : 8, borderRadius: 'var(--crm-radius-pill)', background: teinteScore(palier, sp) }} />
      <span aria-hidden style={{ fontSize: grand ? 'var(--crm-text-6xl)' : 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
        {score}
      </span>
      <span className="sr-only">{libelle}</span>
    </span>
  )
}
```

- [ ] **Step 3 : Point de commit (au signal)** — avec la Task 10.

---

### Task 7 : En-tête et liste

**Files :**
- Create : `src/components/matching-fil/FilEnTete.tsx`
- Create : `src/components/matching-fil/FilListe.tsx`

- [ ] **Step 1 : Créer `FilEnTete.tsx`**

```tsx
/**
 * En-tête du fil de matchs : le titre, le compte d'« À traiter », et les filtres Bien, Acheteur et
 * texte (§3.4). Ils remplacent les deux vues de l'atelier.
 *
 * ⚠ Des `<select>` NATIFS : deux filtres à choix unique n'ont besoin ni de recherche ni de groupes,
 * et le natif est accessible et navigable au clavier d'office. `colorScheme` suit le thème, sinon
 * la liste déroulante s'ouvrirait claire sur un écran sombre.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import type { FilFiltres, OptionFiltre } from './filModele'

interface Props {
  sp: CrmPalette
  /** `null` tant que le compte n'est pas connu (chargement, échec). */
  compte: number | null
  filtres: FilFiltres
  options: { biens: OptionFiltre[]; acheteurs: OptionFiltre[] }
  onFiltres: (f: FilFiltres) => void
}

export default function FilEnTete({ sp, compte, filtres, options, onFiltres }: Props) {
  const { t } = useTranslation('matching')
  const champ: CSSProperties = {
    height: 34, borderRadius: 'var(--crm-radius-pill)', background: sp.cardBg, color: sp.ink,
    fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', colorScheme: sp.isDark ? 'dark' : 'light',
  }
  return (
    <header style={{
      display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--crm-space-lg)',
      padding: 'var(--crm-space-6xl) var(--crm-space-6xl) var(--crm-space-2xl)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--crm-text-5xl)', fontWeight: 600, color: sp.ink }}>{t('fil.titre')}</h1>
        {compte != null && (
          <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
            {t('fil.aTraiter', { count: compte })}
          </p>
        )}
      </div>
      <Choix sp={sp} style={champ} libelle={t('fil.filtres.bien')} tous={t('fil.filtres.tousLesBiens')}
        valeur={filtres.bienId} options={options.biens} onChange={(bienId) => onFiltres({ ...filtres, bienId })} />
      <Choix sp={sp} style={champ} libelle={t('fil.filtres.acheteur')} tous={t('fil.filtres.tousLesAcheteurs')}
        valeur={filtres.acheteurId} options={options.acheteurs} onChange={(acheteurId) => onFiltres({ ...filtres, acheteurId })} />
      <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <span aria-hidden style={{ position: 'absolute', left: 'var(--crm-space-lg)', display: 'flex', pointerEvents: 'none' }}>
          <MEIcon name="search" size={14} color={sp.sub} />
        </span>
        <input type="search" value={filtres.texte} onChange={(e) => onFiltres({ ...filtres, texte: e.target.value })}
          placeholder={t('fil.filtres.recherche')} aria-label={t('fil.filtres.recherche')}
          style={{ ...champ, width: 240, border: `1px solid ${sp.cardBorder}`, paddingLeft: 'var(--crm-space-7xl)', paddingRight: 'var(--crm-space-lg)' }} />
      </label>
    </header>
  )
}

function Choix({ sp, style, libelle, tous, valeur, options, onChange }: {
  sp: CrmPalette; style: CSSProperties; libelle: string; tous: string
  valeur: string | null; options: OptionFiltre[]; onChange: (v: string | null) => void
}) {
  return (
    <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span className="sr-only">{libelle}</span>
      <select value={valeur ?? ''} onChange={(e) => onChange(e.target.value || null)} style={{
        ...style, appearance: 'none', cursor: 'pointer', maxWidth: 220,
        // L'élément ACTIF porte l'accent (CLAUDE.md §3) : un filtre posé se voit.
        border: `1px solid ${valeur ? sp.accent : sp.cardBorder}`,
        paddingLeft: 'var(--crm-space-lg)', paddingRight: 'var(--crm-space-7xl)',
      }}>
        <option value="">{tous}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.libelle}</option>)}
      </select>
      <span aria-hidden style={{ position: 'absolute', right: 'var(--crm-space-md)', display: 'flex', pointerEvents: 'none' }}>
        <MEIcon name="chevron-down" size={14} color={sp.sub} />
      </span>
    </label>
  )
}
```

- [ ] **Step 2 : Créer `FilListe.tsx`**

```tsx
/**
 * La liste du fil (§3.2) : « Vos biens », un groupe par bien et ses acheteurs dessous, puis les
 * reportés, repliés.
 *
 * ⚠ Une ligne est un `role="option"` à tabindex ITINÉRANT : seule la ligne courante est dans l'ordre
 * de tabulation, et ↑/↓ déplacent la sélection — c'est `MatchingFil` qui porte le clavier du fil.
 * La liste entière n'est donc qu'un arrêt de Tab.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { initiales, lignesCriteres, palierScore, premierEcart, type FilBien, type FilMatch, type FilVue } from './filModele'
import { encreAccent, prixBien, teinteEcart } from './filAffichage'
import { FilAvatar, FilScore, FilVignette } from './filAtomes'

interface Props {
  sp: CrmPalette
  vue: FilVue
  courant: string | null
  onChoisir: (id: string) => void
  onReactiver: (id: string) => void
}

const dateCourte = (iso: string): string => format(new Date(iso), 'dd.MM')

export default function FilListe({ sp, vue, courant, onChoisir, onReactiver }: Props) {
  const { t } = useTranslation('matching')
  const [reportesOuverts, setReportesOuverts] = useState(false)
  const prochainRetour = vue.reportes[0]?.reporteJusquau ?? null
  return (
    <div style={{ padding: 'var(--crm-space-lg)' }}>
      <style>{`.fil-ligne:hover { background: ${sp.focusSurface} !important; }`}</style>
      {vue.groupes.length > 0 && (
        <>
          <p style={{ margin: 0, padding: 'var(--crm-space-sm) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
            {t('fil.vosBiens')}
          </p>
          <div role="listbox" aria-label={t('fil.listeAria')}>
            {vue.groupes.map((g) => (
              <div key={g.bien.id} role="group" aria-label={g.bien.titre} style={{ marginBottom: 'var(--crm-space-md)' }}>
                <EnTeteBien sp={sp} bien={g.bien} nombre={g.matchs.length} />
                {g.matchs.map((m) => <Ligne key={m.id} sp={sp} m={m} active={m.id === courant} onChoisir={onChoisir} />)}
              </div>
            ))}
          </div>
        </>
      )}
      {vue.reportes.length > 0 && prochainRetour && (
        <div style={{ marginTop: 'var(--crm-space-md)', paddingTop: 'var(--crm-space-md)', borderTop: `1px solid ${sp.cardBorder}` }}>
          <button type="button" aria-expanded={reportesOuverts} onClick={() => setReportesOuverts((v) => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', width: '100%', border: 0, background: 'transparent',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', color: sp.sub, textAlign: 'left',
            padding: 'var(--crm-space-sm) var(--crm-space-lg)',
          }}>
            <MEIcon name={reportesOuverts ? 'chevron-up' : 'chevron-down'} size={14} color={sp.sub} />
            {t('fil.reportes', { count: vue.reportes.length, date: dateCourte(prochainRetour) })}
          </button>
          {reportesOuverts && vue.reportes.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-sm) var(--crm-space-lg)' }}>
              <FilAvatar sp={sp} texte={initiales(m.acheteur.prenom, m.acheteur.nom)} taille={24} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-sm)', color: sp.ink }}>{m.acheteur.prenom} {m.acheteur.nom}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.bien.titre} · {t('fil.deRetour', { date: dateCourte(m.reporteJusquau as string) })}
                </div>
              </div>
              <button type="button" onClick={() => onReactiver(m.id)} style={{
                border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: encreAccent(sp), padding: 'var(--crm-space-xs) var(--crm-space-sm)',
              }}>
                {t('fil.reactiver')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EnTeteBien({ sp, bien, nombre }: { sp: CrmPalette; bien: FilBien; nombre: number }) {
  const { t } = useTranslation('matching')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-sm) var(--crm-space-lg)' }}>
      <FilVignette sp={sp} photo={bien.photo} largeur={40} hauteur={30} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {bien.titre}
        </div>
        <div style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {prixBien(bien, t)} · {t('fil.acheteurs', { count: nombre })}
        </div>
      </div>
    </div>
  )
}

function Ligne({ sp, m, active, onChoisir }: { sp: CrmPalette; m: FilMatch; active: boolean; onChoisir: (id: string) => void }) {
  const { t } = useTranslation('matching')
  const lignes = lignesCriteres(m)
  const ecart = premierEcart(lignes)
  const resume = lignes.length === 0 ? t('fil.sansCriteres')
    : ecart ? t('fil.ecartSur', { critere: t(`fil.criteres.${ecart}`) })
      : lignes.some((l) => l.ok === null) ? t('fil.nonEvalues') : t('fil.sansEcart')
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={m.id}
      className="fil-ligne" onClick={() => onChoisir(m.id)} onFocus={() => onChoisir(m.id)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', textAlign: 'left',
        padding: 'var(--crm-space-sm) var(--crm-space-lg)', border: 0, borderRadius: 'var(--crm-radius-md)',
        cursor: 'pointer', fontFamily: 'inherit', color: sp.ink,
        background: active ? sp.focusSurface : 'transparent',
        // L'élément ACTIF porte l'accent (CLAUDE.md §3) — en filet : 3,44:1 en sombre, au-dessus du seuil de 3:1.
        boxShadow: active ? `inset 0 0 0 1px ${sp.accent}` : 'none',
      }}>
      <FilAvatar sp={sp} texte={initiales(m.acheteur.prenom, m.acheteur.nom)} taille={28} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {m.acheteur.prenom} {m.acheteur.nom}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: ecart ? teinteEcart(sp) : sp.sub }}>{resume}</span>
      </span>
      <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
    </button>
  )
}
```

- [ ] **Step 3 : Point de commit (au signal)** — avec la Task 10.

---

### Task 8 : Le panneau d'un match

**Files :**
- Create : `src/components/matching-fil/FilPanneau.tsx`

- [ ] **Step 1 : Créer le panneau**

```tsx
/**
 * Le panneau d'un match (§4) : le bien, l'acheteur, le score, la comparaison « Recherché / Ce bien »
 * et UN bouton principal.
 *
 * Lot 1 : l'étape « À traiter » seule — Proposer, Plus tard, Écarter. Les boutons des autres étapes
 * arrivent avec leurs onglets, au lot 3.
 *
 * ⛔ Jamais de points à l'écran : le moteur reporte le poids d'un axe sans critère sur les autres, donc
 * la somme des points ne retombe pas sur le score, et l'afficher se lirait comme une erreur de calcul.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { formatCHF } from '@/lib/utils'
import { cleEquipement, initiales, lignesCriteres, palierScore, type FilMatch, type Historique, type LigneCritere } from './filModele'
import { encreAccent, prixBien, teinteEcart, teinteTenu } from './filAffichage'
import { FilAvatar, FilScore } from './filAtomes'

interface Props {
  sp: CrmPalette
  m: FilMatch
  historique: Historique | undefined
  onProposer: () => void
  onPlusTard: () => void
  onEcarter: () => void
  onVoirBien: () => void
  onVoirContact: () => void
}

export default function FilPanneau({ sp, m, historique, onProposer, onPlusTard, onEcarter, onVoirBien, onVoirContact }: Props) {
  const { t, i18n } = useTranslation('matching')
  const { bien, acheteur } = m
  const lignes = lignesCriteres(m)
  const nombre = (n: number): string => n.toLocaleString(i18n.language)
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: encreAccent(sp),
  }
  return (
    <section aria-label={t('fil.panneauAria', { acheteur: `${acheteur.prenom} ${acheteur.nom}`, bien: bien.titre })}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)', padding: 'var(--crm-space-6xl)' }}>
        <div style={{ height: 220, display: 'grid', placeItems: 'center', overflow: 'hidden', borderRadius: 'var(--crm-radius-lg)', background: sp.cardSubBg }}>
          {bien.photo
            ? <img src={bien.photo} alt={bien.titre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
                <MEIcon name="home" size={18} color={sp.sub} />{t('fil.sansPhoto')}
              </span>
            )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-2xl)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: 'inline-block', padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
              border: `1px solid ${sp.cardBorder}`, fontSize: 'var(--crm-text-xs)', color: sp.sub,
            }}>
              {t('fil.votreBien')}
            </span>
            <h2 style={{ margin: 0, marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>{bien.titre}</h2>
            <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
              {[prixBien(bien, t), bien.adresse, bien.ville].filter(Boolean).join(' · ')}
            </p>
            <button type="button" onClick={onVoirBien} style={{ ...lien, marginTop: 'var(--crm-space-sm)' }}>{t('fil.voirBien')}</button>
          </div>
          <div style={{ flex: 'none', textAlign: 'right' }}>
            <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} grand />
            <div style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{t('fil.estimation')}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
          <div style={{ minWidth: 0 }}>
            <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-lg)', color: sp.ink }}>
              {acheteur.prenom} {acheteur.nom}
            </button>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: acheteur.kyc === 'verified' ? teinteTenu(sp) : sp.sub }}>
              {t(`fil.kyc.${acheteur.kyc}`)}
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ margin: 0, marginBottom: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>
            {t('fil.pourquoi')}
          </h3>
          {lignes.length === 0
            ? <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{t('fil.sansCriteres')}</p>
            : <TableCriteres sp={sp} lignes={lignes} t={t} nombre={nombre} />}
        </div>

        <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
          {!historique || historique.proposes === 0
            ? t('fil.historique.aucun', { prenom: acheteur.prenom })
            : t('fil.historique.proposes', { prenom: acheteur.prenom, count: historique.proposes })
              + (historique.interesses > 0 ? t('fil.historique.interesses', { count: historique.interesses }) : '')}
        </p>
      </div>

      <div style={{
        position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: 'var(--crm-space-2xl) var(--crm-space-6xl)', background: sp.frameBg, borderTop: `1px solid ${sp.cardBorder}`,
      }}>
        <Bouton sp={sp} t={t} touche="X" onClick={onEcarter}>{t('fil.actions.ecarter')}</Bouton>
        <Bouton sp={sp} t={t} touche="P" onClick={onPlusTard}>{t('fil.actions.plusTard')}</Bouton>
        <span style={{ flex: 1 }} />
        <Bouton sp={sp} t={t} touche="E" onClick={onProposer} principal>{t('fil.actions.proposer', { prenom: acheteur.prenom })}</Bouton>
      </div>
    </section>
  )
}

function Bouton({ sp, t, touche, onClick, principal = false, children }: {
  sp: CrmPalette; t: TFunction; touche: string; onClick: () => void; principal?: boolean; children: ReactNode
}) {
  return (
    <button type="button" onClick={onClick} title={t('fil.actions.raccourci', { touche })} aria-keyshortcuts={touche} style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40,
      paddingLeft: 'var(--crm-space-2xl)', paddingRight: 'var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
      border: principal ? 0 : `1px solid ${sp.cardBorder}`, cursor: 'pointer', fontFamily: 'inherit',
      background: principal ? sp.accent : 'transparent', color: principal ? sp.accentInk : sp.ink,
      fontSize: 'var(--crm-text-md)', fontWeight: 600,
    }}>
      {children}
      <kbd aria-hidden style={{ fontFamily: 'inherit', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: principal ? sp.accentInk : sp.sub }}>{touche}</kbd>
    </button>
  )
}

function TableCriteres({ sp, lignes, t, nombre }: { sp: CrmPalette; lignes: LigneCritere[]; t: TFunction; nombre: (n: number) => string }) {
  const cellule: CSSProperties = {
    padding: 'var(--crm-space-sm) var(--crm-space-xs)', borderBottom: `1px solid ${sp.cardBorder}`, textAlign: 'left', verticalAlign: 'top',
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 'var(--crm-text-md)', color: sp.ink }}>
      <thead>
        <tr style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          <th scope="col" style={{ ...cellule, width: '24%', fontWeight: 500 }}>{t('fil.colonnes.critere')}</th>
          <th scope="col" style={{ ...cellule, fontWeight: 500 }}>{t('fil.colonnes.recherche')}</th>
          <th scope="col" style={{ ...cellule, fontWeight: 500 }}>{t('fil.colonnes.bien')}</th>
          <th scope="col" style={{ ...cellule, width: 32 }}><span className="sr-only">{t('fil.colonnes.verdict')}</span></th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((l) => {
          const [recherche, propose] = valeurs(l, t, nombre)
          return (
            <tr key={l.cle}>
              <th scope="row" style={{ ...cellule, fontWeight: 500, color: sp.sub }}>{t(`fil.criteres.${l.cle}`)}</th>
              <td style={cellule}>{recherche}</td>
              <td style={cellule}>
                {propose}
                {l.ecart && (
                  <span style={{ display: 'block', marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', color: teinteEcart(sp) }}>{l.ecart}</span>
                )}
              </td>
              <td style={cellule}>
                {l.ok !== null && (
                  <span role="img" aria-label={t(l.ok ? 'fil.correspond' : 'fil.ecart')} style={{ display: 'inline-flex' }}>
                    <MEIcon name={l.ok ? 'check' : 'alert'} size={16} color={l.ok ? teinteTenu(sp) : teinteEcart(sp)} />
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** « Recherché » et « Ce bien », écrits dans la langue de l'agent. */
function valeurs(l: LigneCritere, t: TFunction, nombre: (n: number) => string): [string, string] {
  const inconnu = t('fil.valeurs.inconnu')
  switch (l.cle) {
    case 'budget': {
      const montant = (n: number): string => (l.location ? t('fil.valeurs.parMois', { valeur: formatCHF(n) }) : formatCHF(n))
      const recherche = l.min != null && l.max != null ? t('fil.valeurs.entre', { min: formatCHF(l.min), max: montant(l.max) })
        : l.max != null ? t('fil.valeurs.jusqua', { valeur: montant(l.max) })
          : t('fil.valeurs.desDe', { valeur: montant(l.min as number) })
      return [recherche, l.prix == null ? inconnu : montant(l.prix)]
    }
    case 'zone': {
      // Villes puis cantons : un match au canton (« Canton GE correspond ») doit se LIRE.
      const recherche = [l.villes.join(', '), l.cantons.join(', ')].filter(Boolean).join(' · ')
      return [recherche, [l.ville, l.canton].filter(Boolean).join(' · ') || inconnu]
    }
    case 'type':
      return [t(`fil.types.${l.voulu}`, { defaultValue: l.voulu }), l.propose ? t(`fil.types.${l.propose}`, { defaultValue: l.propose }) : inconnu]
    case 'pieces': {
      const recherche = l.min != null && l.max != null
        ? (l.min === l.max ? nombre(l.min) : t('fil.valeurs.entre', { min: nombre(l.min), max: nombre(l.max) }))
        : l.min != null ? t('fil.valeurs.auMoins', { valeur: nombre(l.min) })
          : t('fil.valeurs.auPlus', { valeur: nombre(l.max as number) })
      return [recherche, l.pieces == null ? inconnu : nombre(l.pieces)]
    }
    case 'surface':
      return [
        t('fil.valeurs.auMoins', { valeur: t('fil.valeurs.m2', { valeur: nombre(l.min) }) }),
        l.surface == null ? inconnu : t('fil.valeurs.m2', { valeur: nombre(l.surface) }),
      ]
    case 'equipements':
      return [
        l.voulus.map((f) => t(`fil.equipementsNoms.${cleEquipement(f)}`, { defaultValue: f.replace(/^custom:/i, '') })).join(', '),
        t('fil.valeurs.presents', { n: l.presents.length, total: l.voulus.length }),
      ]
  }
}
```

- [ ] **Step 2 : Point de commit (au signal)** — avec la Task 10.

---

### Task 9 : Feuille d'envoi et barre d'annulation

**Files :**
- Create : `src/components/matching-fil/FilFeuilleEnvoi.tsx`
- Create : `src/components/matching-fil/FilAnnulation.tsx`

- [ ] **Step 1 : Créer `FilFeuilleEnvoi.tsx`**

```tsx
/**
 * La feuille d'envoi du fil (§6.1-6.2) : un lien privé, par WhatsApp ou copié.
 *
 * ⛔ LE LIEN N'EST CRÉÉ QU'AU CLIC SUR UN CANAL, et il n'y a pas d'« Annuler » ensuite :
 * `buyer-reception-create` marque les matchs envoyés à la création. La feuille de l'atelier offrait
 * une annulation qui n'annulait rien.
 *
 * ⚠ La fenêtre WhatsApp s'ouvre AVANT l'attente réseau : un `window.open` posé après un `await`
 * n'est plus un geste de l'utilisateur, et Safari le bloque comme une popup.
 *
 * ⚠ Un presse-papiers refusé n'est pas un échec : le lien reste affiché, sélectionnable.
 *
 * Portée dans `document.body` (CLAUDE.md §3). z-index 100, celui des modales du CRM : le pager dessous
 * plafonne à 80 (ses points de page).
 */
import { useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { crmVoileAssombrissant, type CrmPalette } from '@/components/crm/tokens'
import { useCreateReceptionLink } from '@/hooks/useCreateReceptionLink'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { buildWaMeUrl } from '@/lib/waMeUrl'
import { initiales, type FilMatch } from './filModele'
import { prixBien, teinteErreur, teinteTenu } from './filAffichage'
import { FilAvatar } from './filAtomes'

interface Props {
  sp: CrmPalette
  m: FilMatch
  onFermer: () => void
  /** Consigne l'envoi (deal, relance à +5 j, journal). Appelé une fois le lien créé. */
  onEnvoye: () => Promise<void>
}

export default function FilFeuilleEnvoi({ sp, m, onFermer, onEnvoye }: Props) {
  const { t } = useTranslation('matching')
  const titreId = useId()
  const piege = useFocusTrap(true, onFermer)
  const creer = useCreateReceptionLink()
  const [erreur, setErreur] = useState<'lien' | 'suivi' | null>(null)
  const [lien, setLien] = useState<{ url: string; copie: boolean } | null>(null)
  const { prenom } = m.acheteur
  const telephone = m.acheteur.telephone?.trim() ?? ''
  const occupe = creer.isPending

  const envoyer = async (canal: 'whatsapp' | 'link') => {
    if (occupe) return
    setErreur(null)
    const fenetre = canal === 'whatsapp' ? window.open('about:blank', '_blank') : null
    if (fenetre) fenetre.opener = null
    let url: string
    try {
      url = (await creer.mutateAsync({ contactId: m.acheteur.id, matchIds: [m.id], channel: canal })).url
    } catch {
      fenetre?.close()
      setErreur('lien')
      return
    }
    if (canal === 'whatsapp') {
      const wa = buildWaMeUrl(telephone, t('sendSheet.waMessage', { firstName: prenom, url }))
      if (fenetre) fenetre.location.href = wa
      else window.open(wa, '_blank', 'noopener')
    } else {
      let copie = true
      try { await navigator.clipboard.writeText(url) } catch { copie = false }
      setLien({ url, copie })
    }
    try {
      await onEnvoye()
    } catch {
      setErreur('suivi')
      return
    }
    if (canal === 'whatsapp') onFermer()
  }

  const bouton = (principal: boolean) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-sm)', width: '100%', height: 44,
    borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
    border: principal ? 0 : `1px solid ${sp.cardBorder}`, background: principal ? sp.accent : 'transparent',
    color: principal ? sp.accentInk : sp.ink,
  }) as const

  return createPortal(
    <div onClick={(e) => { if (e.target === e.currentTarget) onFermer() }} style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', background: crmVoileAssombrissant(0.45),
    }}>
      <div ref={piege} role="dialog" aria-modal="true" aria-labelledby={titreId} style={{
        width: 440, maxWidth: '92vw', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)',
        padding: 'var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-6xl)', background: sp.solidBg,
        border: `1px solid ${sp.solidBorder}`, boxShadow: sp.solidShadow, color: sp.ink,
        fontFamily: 'var(--crm-font), system-ui, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <FilAvatar sp={sp} texte={initiales(prenom, m.acheteur.nom)} taille={40} />
          <div style={{ minWidth: 0 }}>
            <h2 id={titreId} style={{ margin: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 600 }}>{t('fil.envoi.titre', { prenom })}</h2>
            <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{m.bien.titre} · {prixBien(m.bien, t)}</p>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', lineHeight: 1.5, color: sp.sub }}>{t('fil.envoi.texte', { prenom })}</p>

        {lien ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xs)' }}>
            <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: lien.copie ? teinteTenu(sp) : sp.ink }}>
              {lien.copie ? t('fil.envoi.copie') : t('fil.envoi.copierAMain')}
            </p>
            <input readOnly value={lien.url} aria-label={t('fil.envoi.lienAria', { prenom })} onFocus={(e) => e.currentTarget.select()} style={{
              height: 36, borderRadius: 'var(--crm-radius-md)', border: `1px solid ${sp.cardBorder}`, background: sp.cardSubBg,
              color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', paddingLeft: 'var(--crm-space-lg)', paddingRight: 'var(--crm-space-lg)',
            }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
            <button type="button" onClick={() => void envoyer('whatsapp')} disabled={occupe || !telephone} autoFocus={!!telephone}
              style={{ ...bouton(true), opacity: !telephone ? 0.5 : 1, cursor: !telephone ? 'not-allowed' : 'pointer' }}>
              <MEIcon name="message" size={16} color={sp.accentInk} />{t('fil.envoi.whatsapp')}
            </button>
            {!telephone && <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{t('fil.envoi.sansTelephone', { prenom })}</p>}
            <button type="button" onClick={() => void envoyer('link')} disabled={occupe} autoFocus={!telephone} style={bouton(false)}>
              <MEIcon name="copy" size={16} color={sp.ink} />{t('fil.envoi.copier')}
            </button>
          </div>
        )}

        {erreur && (
          <p role="alert" style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: teinteErreur(sp) }}>
            {t(erreur === 'lien' ? 'fil.envoi.erreur' : 'fil.envoi.erreurSuivi')}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onFermer} style={{
            border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)',
            fontWeight: 600, color: sp.sub, padding: 'var(--crm-space-sm) var(--crm-space-md)',
          }}>
            {lien ? t('fil.envoi.termine') : t('common:actions.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2 : Créer `FilAnnulation.tsx`**

```tsx
/**
 * La barre d'annulation d'un geste différé (Plus tard, Écarter) : visible tant que « Annuler » annule
 * ENCORE — `MatchingFil` la retire avant la fin de la fenêtre d'écriture (§6.2). Jamais pour un
 * envoi, qui ne s'annule pas.
 */
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { encreAccent } from './filAffichage'

export default function FilAnnulation({ sp, texte, onAnnuler }: { sp: CrmPalette; texte: string; onAnnuler: () => void }) {
  const { t } = useTranslation('matching')
  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)',
      borderTop: `1px solid ${sp.cardBorder}`, background: sp.cardSubBg,
    }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-sm)', color: sp.ink }}>{texte}</span>
      <button type="button" onClick={onAnnuler} style={{
        border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)',
        fontWeight: 600, color: encreAccent(sp), padding: 'var(--crm-space-xs) var(--crm-space-sm)',
      }}>
        {t('fil.annuler')}
      </button>
    </div>
  )
}
```

- [ ] **Step 3 : Point de commit (au signal)** — avec la Task 10.

---

### Task 10 : Le conteneur du fil, et l'atterrissage du pager

**Files :**
- Create : `src/components/matching-fil/MatchingFil.tsx`
- Modify : `src/pages/agent/MatchingPage.tsx`

- [ ] **Step 1 : Créer `MatchingFil.tsx`**

```tsx
/**
 * Matching — le FIL DE MATCHS (refonte de la page 0 du pager, lot 1).
 *
 * Conception : `docs/superpowers/specs/2026-09-17-matching-fil-design.md`. Il remplacera l'atelier
 * (`MatchingAtelierPage`) à la fin du lot 3 ; d'ici là il ne vit que sur le banc `/dev/crm`.
 *
 * Ce conteneur porte les données (`useMatchingFil`), les filtres, la sélection, les gestes, et le
 * CLAVIER du fil entier.
 *
 * ⚠ Le clavier est posé sur la RACINE du fil (`onKeyDown`), pas sur `window` : le fil est la page 0
 * d'un pager dont la page 1 reste montée, et plusieurs écrans d'onglet restent vivants. Un écouteur
 * global agirait depuis une page ou un onglet qu'on ne regarde pas ; celui-ci n'entend que ce qui a
 * le focus dedans. D'où, après chaque geste, le focus rendu à une ligne (ou à la racine).
 *
 * ⚠ Plus tard et Écarter passent par la fenêtre d'annulation (`PendingRegistry`). Proposer, jamais :
 * le lien créé marque déjà le match envoyé (§6.2).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { crmPalette, type CrmPalette } from '@/components/crm/tokens'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { execDismiss, execSendDossier, execSnooze, execWake, type GesteContext } from '@/hooks/useAtelierMatching'
import { useMatchingFil, versGeste } from '@/hooks/useMatchingFil'
import { PendingRegistry, UNDO_WINDOW_MS } from '@/components/matching-atelier/pendingTriage'
import { construireFil, optionsFiltres, type FilFiltres, type FilMatch } from './filModele'
import FilAnnulation from './FilAnnulation'
import FilEnTete from './FilEnTete'
import FilFeuilleEnvoi from './FilFeuilleEnvoi'
import FilListe from './FilListe'
import FilPanneau from './FilPanneau'

const SANS_FILTRE: FilFiltres = { bienId: null, acheteurId: null, texte: '' }
const COLONNES = 'minmax(300px, 380px) minmax(0, 1fr)'
const nomComplet = (m: FilMatch): string => `${m.acheteur.prenom} ${m.acheteur.nom}`

export default function MatchingFil({ dark, onOpenRecherche }: { dark: boolean; onOpenRecherche?: () => void }) {
  const { t } = useTranslation('matching')
  const sp = crmPalette(dark)
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const { user, profile } = useAuth()
  const { isLoading, isError, matchs, historique, chargeLe, rafraichir } = useMatchingFil()

  // Les liens entrants de l'atelier gardent leur sens (§3.4) : `?contact=` filtre sur l'acheteur,
  // `?annonce=p:<uuid>` sur le bien. Lus une fois, à l'arrivée.
  const [filtres, setFiltres] = useState<FilFiltres>(() => {
    const annonce = params.get('annonce')
    return { bienId: annonce?.startsWith('p:') ? annonce.slice(2) : null, acheteurId: params.get('contact'), texte: '' }
  })
  const [masques, setMasques] = useState<ReadonlySet<string>>(() => new Set())
  const [choix, setChoix] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState<FilMatch | null>(null)
  const [enAttente, setEnAttente] = useState<{ id: string; texte: string; annuler: () => void } | null>(null)
  const [registre] = useState(() => new PendingRegistry())
  const racine = useRef<HTMLDivElement>(null)

  // L'agent n'a pas annulé : ce qui attend part quand le fil se ferme.
  useEffect(() => () => registre.flushAll(), [registre])

  const ctx = useMemo<GesteContext | null>(() => (profile?.agency_id
    ? {
      agencyId: profile.agency_id,
      userId: profile.id ?? user?.id ?? '',
      agentName: profile.full_name ?? t('atelier.defaultAgentName'),
      agentPhone: profile.phone ?? null,
    }
    : null), [profile, user, t])

  const visibles = useMemo(() => matchs.filter((m) => !masques.has(m.id)), [matchs, masques])
  const vue = useMemo(() => construireFil(visibles, filtres, chargeLe), [visibles, filtres, chargeLe])
  const options = useMemo(() => optionsFiltres(matchs), [matchs])
  // Sélection DÉRIVÉE : un match qui sort de la liste (geste, filtre) cède la place au premier restant.
  const courant = choix && vue.ordre.includes(choix) ? choix : (vue.ordre[0] ?? null)
  const match = courant ? visibles.find((m) => m.id === courant) ?? null : null

  const focaliser = useCallback((id: string | null) => {
    const ligne = id ? racine.current?.querySelector<HTMLElement>(`[data-match="${id}"]`) : null
    if (ligne) ligne.focus()
    else racine.current?.focus()
  }, [])

  const montrer = useCallback((id: string) => {
    setMasques((s) => { const n = new Set(s); n.delete(id); return n })
  }, [])

  const differer = useCallback((m: FilMatch, texte: string, ecrire: (c: GesteContext) => Promise<void>) => {
    if (!ctx) return
    const i = vue.ordre.indexOf(m.id)
    const suivant = vue.ordre[i + 1] ?? vue.ordre[i - 1] ?? null
    setChoix(suivant)
    focaliser(suivant)
    setMasques((s) => new Set(s).add(m.id))
    const poignee = registre.defer(async () => { await ecrire(ctx); return null }, {
      onSettled: rafraichir,
      onError: () => { montrer(m.id); toast.error(t('fil.erreurGeste')) },
    })
    setEnAttente({
      id: m.id,
      texte,
      annuler: () => {
        poignee.cancel()
        montrer(m.id)
        setChoix(m.id)
        setEnAttente(null)
        // La ligne revient au rendu suivant : le focus la suit après lui.
        setTimeout(() => focaliser(m.id), 0)
      },
    })
  }, [ctx, vue.ordre, registre, rafraichir, montrer, focaliser, toast, t])

  // « Annuler » disparaît AVANT que l'écriture parte : passé ce délai, il n'annulerait plus rien.
  useEffect(() => {
    if (!enAttente) return
    const minuteur = setTimeout(() => setEnAttente((e) => (e === enAttente ? null : e)), UNDO_WINDOW_MS - 400)
    return () => clearTimeout(minuteur)
  }, [enAttente])

  const plusTard = useCallback((m: FilMatch) => {
    differer(m, t('fil.reporte', { nom: nomComplet(m) }), (c) => execSnooze(c, versGeste(m).acheteur))
  }, [differer, t])
  const ecarter = useCallback((m: FilMatch) => {
    differer(m, t('fil.ecarte', { nom: nomComplet(m) }), (c) => execDismiss(c, versGeste(m).acheteur))
  }, [differer, t])
  const reactiver = useCallback((id: string) => {
    execWake(id).then(rafraichir).catch(() => toast.error(t('fil.erreurGeste')))
  }, [rafraichir, toast, t])

  const consignerEnvoi = useCallback(async () => {
    if (!envoi || !ctx) throw new Error('envoi sans contexte agent')
    const { acheteur, bien } = versGeste(envoi)
    await execSendDossier(ctx, acheteur, bien, 'reception')
    toast.success(t('fil.envoi.fait', { prenom: envoi.acheteur.prenom }))
    rafraichir()
  }, [envoi, ctx, toast, t, rafraichir])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Une feuille ouverte garde son clavier : ses événements remontent ici par l'arbre React.
    if (envoi || e.metaKey || e.ctrlKey || e.altKey) return
    const cible = e.target as HTMLElement
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName) || cible.isContentEditable) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!courant) return
      e.preventDefault()
      const i = vue.ordre.indexOf(courant)
      const suivant = vue.ordre[Math.min(vue.ordre.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (!suivant) return
      setChoix(suivant)
      focaliser(suivant)
      return
    }
    if (!match) return
    const touche = e.key.toLowerCase()
    if (touche === 'e') { e.preventDefault(); setEnvoi(match) }
    else if (touche === 'p') { e.preventDefault(); plusTard(match) }
    else if (touche === 'x') { e.preventDefault(); ecarter(match) }
  }

  const connu = !isLoading && !isError
  return (
    <div ref={racine} tabIndex={-1} onKeyDown={onKeyDown} style={{
      height: '100%', display: 'flex', flexDirection: 'column', outline: 'none', background: sp.frameBg, color: sp.ink,
      fontFamily: 'var(--crm-font), system-ui, sans-serif',
    }}>
      <FilEnTete sp={sp} compte={connu ? vue.compte : null} filtres={filtres} options={options} onFiltres={setFiltres} />
      {isLoading ? <Squelette sp={sp} />
        : isError ? <Etat sp={sp} titre={t('fil.erreur')} action={{ libelle: t('fil.reessayer'), faire: rafraichir }} />
          : visibles.length === 0 ? (
            <Etat sp={sp} titre={t('fil.vide.titre')} texte={t('fil.vide.texte')}
              action={{ libelle: t('fil.vide.contacts'), faire: () => navigate('/dashboard/contacts') }}
              secondaire={onOpenRecherche ? { libelle: t('fil.vide.marche'), faire: onOpenRecherche } : undefined} />
          ) : vue.compte === 0 && vue.reportes.length === 0 ? (
            <Etat sp={sp} titre={t('fil.filtreVide')} action={{ libelle: t('fil.filtres.retirer'), faire: () => setFiltres(SANS_FILTRE) }} />
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: COLONNES, borderTop: `1px solid ${sp.cardBorder}` }}>
              <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${sp.cardBorder}` }}>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  <FilListe sp={sp} vue={vue} courant={courant} onChoisir={setChoix} onReactiver={reactiver} />
                </div>
                {enAttente && <FilAnnulation sp={sp} texte={enAttente.texte} onAnnuler={enAttente.annuler} />}
              </div>
              {/* La clé remet le défilement en haut quand on change de match. */}
              <div key={match?.id ?? 'aucun'} style={{ minHeight: 0, overflowY: 'auto' }}>
                {match ? (
                  <FilPanneau sp={sp} m={match} historique={historique.get(match.acheteur.id)}
                    onProposer={() => setEnvoi(match)} onPlusTard={() => plusTard(match)} onEcarter={() => ecarter(match)}
                    onVoirBien={() => navigate(`/dashboard/listings/${match.bien.id}`)}
                    onVoirContact={() => navigate(`/dashboard/contacts/${match.acheteur.id}`)} />
                ) : (
                  <Etat sp={sp} titre={vue.compte === 0 ? t('fil.vide.titre') : t('fil.choisir')} />
                )}
              </div>
            </div>
          )}
      {envoi && (
        <FilFeuilleEnvoi sp={sp} m={envoi} onEnvoye={consignerEnvoi}
          onFermer={() => { const id = envoi.id; setEnvoi(null); setTimeout(() => focaliser(vue.ordre.includes(id) ? id : courant), 0) }} />
      )}
    </div>
  )
}

function Etat({ sp, titre, texte, action, secondaire }: {
  sp: CrmPalette; titre: string; texte?: string
  action?: { libelle: string; faire: () => void }; secondaire?: { libelle: string; faire: () => void }
}) {
  const bouton = (principal: boolean) => ({
    height: 38, paddingLeft: 'var(--crm-space-2xl)', paddingRight: 'var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
    border: principal ? 0 : `1px solid ${sp.cardBorder}`, background: principal ? sp.accent : 'transparent',
    color: principal ? sp.accentInk : sp.ink,
  }) as const
  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', display: 'grid', placeItems: 'center', padding: 'var(--crm-space-6xl)' }}>
      <div style={{ maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--crm-space-md)', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>{titre}</p>
        {texte && <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', lineHeight: 1.5, color: sp.sub }}>{texte}</p>}
        {(action || secondaire) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'var(--crm-space-sm)', marginTop: 'var(--crm-space-sm)' }}>
            {action && <button type="button" onClick={action.faire} style={bouton(true)}>{action.libelle}</button>}
            {secondaire && <button type="button" onClick={secondaire.faire} style={bouton(false)}>{secondaire.libelle}</button>}
          </div>
        )}
      </div>
    </div>
  )
}

function Squelette({ sp }: { sp: CrmPalette }) {
  const { t } = useTranslation('matching')
  return (
    <div role="status" aria-busy="true" aria-label={t('fil.chargement')} style={{
      flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: COLONNES, borderTop: `1px solid ${sp.cardBorder}`,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-lg)', borderRight: `1px solid ${sp.cardBorder}` }}>
        {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ height: 48, borderRadius: 'var(--crm-radius-md)', background: sp.cardSubBg }} />)}
      </div>
      <div style={{ padding: 'var(--crm-space-6xl)' }}>
        <div style={{ height: 220, borderRadius: 'var(--crm-radius-lg)', background: sp.cardSubBg }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Laisser le banc atterrir sur la page 0**

Dans `src/pages/agent/MatchingPage.tsx`, remplacer :

```tsx
export default function MatchingPage({ banc }: { banc?: MatchingPagerBanc } = {}) {
```

par :

```tsx
export default function MatchingPage(
  { banc, atterrissage = 'recherche' }: {
    banc?: MatchingPagerBanc
    /**
     * Page d'arrivée sans pivot. « recherche » en production tant que l'atelier tient la page 0 ;
     * le banc du fil de matchs arrive sur « score » (lot 1). La bascule par défaut est au lot 3.
     */
    atterrissage?: 'score' | 'recherche'
  } = {},
) {
```

puis remplacer :

```tsx
    searchParams.has('contact') || searchParams.has('annonce')
      ? Math.max(0, MATCHING_PAGES.findIndex((pg) => pg.id === 'score'))
      : LANDING_PAGE,
```

par :

```tsx
    searchParams.has('contact') || searchParams.has('annonce') || atterrissage === 'score'
      ? Math.max(0, MATCHING_PAGES.findIndex((pg) => pg.id === 'score'))
      : LANDING_PAGE,
```

- [ ] **Step 3 : Vérifier types et lint des fichiers du fil**

Run : `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "matching-fil|useMatchingFil|MatchingPage" ; echo fin`
Expected : seulement `fin`.

Run : `npx eslint src/components/matching-fil src/hooks/useMatchingFil.ts src/pages/agent/MatchingPage.tsx`
Expected : aucune erreur (des avertissements `react-hooks/*` doivent être lus et corrigés s'ils portent sur ces fichiers).

- [ ] **Step 4 : Point de commit (au signal)**

```bash
git add src/components/matching-fil src/hooks/useMatchingFil.ts src/pages/agent/MatchingPage.tsx src/i18n/locales/fr/matching.json src/i18n/locales/de/matching.json src/i18n/locales/en/matching.json src/i18n/locales/it/matching.json
git commit -m "feat(matching): le fil de matchs, liste et panneau (lot 1)"
```

---

### Task 11 : La zone `matching-fil` entre au cliquet de grammaire

**Files :**
- Modify : `tests/unit/megga-x-grammar.spec.ts`

- [ ] **Step 1 : Déclarer la zone**

Remplacer :

```ts
  { root: 'src/components/matching-atelier', keep: (n) => /\.tsx?$/.test(n) },
```

par :

```ts
  { root: 'src/components/matching-atelier', keep: (n) => /\.tsx?$/.test(n) },
  // Le fil de matchs (17.09.2026), né porté : aucun littéral, aucune graisse au-dessus de 600.
  { root: 'src/components/matching-fil', keep: (n) => /\.tsx?$/.test(n) },
```

et :

```ts
  ['src/components/matching-atelier', { hors: 37, total: 50 }],
```

par :

```ts
  ['src/components/matching-atelier', { hors: 37, total: 50 }],
  ['src/components/matching-fil', { hors: 0, total: 0 }],
```

- [ ] **Step 2 : Lancer les gardes de design**

Run : `npx vitest run tests/unit/megga-x-grammar.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/voile-modale.spec.ts tests/unit/polices-domaines.spec.ts tests/unit/clavier-ecran-cache.spec.ts tests/unit/statut-clair.spec.ts`
Expected : PASS. Si la clause B4 compte un littéral dans `matching-fil`, le remplacer par un barreau `var(--crm-*)` — ne JAMAIS monter l'inventaire.

- [ ] **Step 3 : Point de commit (au signal)**

```bash
git add tests/unit/megga-x-grammar.spec.ts
git commit -m "test(grammaire): le fil de matchs entre au cliquet, à zéro"
```

---

### Task 12 : Le fil sur le banc `/dev/crm`

**Files :**
- Modify : `src/pages/dev/crmFixtures.ts`
- Modify : `src/pages/dev/CrmShowcasePage.tsx`
- Create : `src/pages/dev/matchingFilBanc.tsx`

- [ ] **Step 1 : Deux acheteurs, et un budget à la mesure de Champel**

Dans `src/pages/dev/crmFixtures.ts`, remplacer :

```ts
    search_criteria: { transaction_type: 'buy', type: 'apartment', zones: ['Zürich', 'Genève', 'ZH', 'GE'], budget_min: 1_500_000, budget_max: 3_000_000 },
```

par :

```ts
    search_criteria: { transaction_type: 'buy', type: 'apartment', zones: ['Zürich', 'Genève', 'ZH', 'GE'], budget_min: 1_200_000, budget_max: 3_000_000 },
```

Puis remplacer :

```ts
  contact('c8', 'Léa', 'Martin', {
    phone: '+41 78 902 11 36', type: 'lead', source: 'whatsapp_ai',
    last_interaction_at: ilYA(0.2), created_at: ilYA(0.2),
  }),
]
```

par :

```ts
  contact('c8', 'Léa', 'Martin', {
    phone: '+41 78 902 11 36', type: 'lead', source: 'whatsapp_ai',
    last_interaction_at: ilYA(0.2), created_at: ilYA(0.2),
  }),
  // Le fil de matchs (17.09.2026) : deux acheteurs dont la recherche TIENT sur Champel et sur
  // Cologny. Antoine n'a pas de téléphone : la feuille d'envoi doit griser WhatsApp et le dire.
  contact('c9', 'Julie', 'Morand', {
    email: 'julie.morand@example.ch', phone: '+41 79 530 18 64', canton: 'GE',
    type: 'buyer', score: 'hot', source: 'referral',
    search_criteria: { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Champel', 'GE'], budget_min: 1_300_000, budget_max: 1_600_000, rooms_min: 4, surface_min: 100, features: ['balcon', 'ascenseur', 'terrasse'] },
    last_interaction_at: ilYA(30), created_at: ilYA(200),
  }),
  contact('c10', 'Antoine', 'Lefèvre', {
    email: 'a.lefevre@example.ch', canton: 'GE', type: 'buyer', score: 'warm', source: 'website', language: 'en',
    search_criteria: { transaction_type: 'buy', type: 'house', zones: ['Cologny', 'Vandœuvres', 'GE'], budget_min: 2_800_000, budget_max: 3_500_000, rooms_min: 6, surface_min: 240, features: ['piscine', 'jardin', 'cave'] },
    last_interaction_at: ilYA(90), created_at: ilYA(500),
  }),
]
```

- [ ] **Step 2 : Les biens embarqués, partagés par les matchs**

Juste AVANT la ligne `export const CRM_TABLES: Record<string, unknown[]> = {`, ajouter :

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

- [ ] **Step 3 : Des matchs que le moteur peut créer**

Remplacer :

```ts
  // ⚠ Les jointures (`contact`, `market_listing`, `property`) sont portées par la
  // ligne : le banc n'applique pas `select`.
  matches: [
```

par :

```ts
  // ⚠ Les jointures (`contact`, `market_listing`, `property`) sont portées par la
  // ligne : le banc n'applique pas `select`.
  // ── Le fil de matchs (lot 1, 17.09.2026) : m2 à m6 sont des paires que le moteur PEUT créer —
  // cinq axes, points jamais négatifs, rien sous 55 (`matching-normalize.ts`). ⛔ m2 portait Salomé,
  // qui cherche une MAISON, sur l'appartement de Champel, type « tenu », à 81 : une paire sous le
  // seuil, et une ligne « Type : Maison / Appartement ✓ » à l'écran. m4 est reporté (la section des
  // reportés) ; m6 donne à Emma un historique (« 1 bien proposé · 1 intéressé »). Leurs `detail`
  // reprennent le libellé exact du moteur, et `client_search_id` désigne la recherche notée.
  matches: [
```

Puis remplacer le bloc entier de `m2` (de `    {\n      id: 'm2', agency_id: AGENCE_BANC.id, contact_id: 'c3', source: 'internal',` jusqu'à sa fermeture `      market_listing: null,\n    },`, juste avant `  ],\n  crm_offers: [],`) par :

```ts
    {
      id: 'm2', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'internal',
      property_id: 'p1', market_listing_id: null,
      score: 94, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(30),
      reasons: {
        budget: { match: true, score: 32, detail: 'Dans le budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: false, score: 0, detail: 'Aucun critère' },
        features: { match: false, score: 0, detail: '—' },
      },
      contact: { first_name: 'Emma', last_name: 'Schneider', email: 'emma.schneider@example.com', phone: '+41 76 488 02 19' },
      property: CHAMPEL_EMBARQUE, market_listing: null,
    },
    {
      id: 'm3', agency_id: AGENCE_BANC.id, client_search_id: 'cs9', contact_id: 'c9', source: 'internal',
      property_id: 'p1', market_listing_id: null,
      score: 97, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(20),
      reasons: {
        budget: { match: true, score: 32, detail: 'Dans le budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 22, detail: '4,5 pièces · 118 m²' },
        features: { match: true, score: 7, detail: '2/3 critères' },
      },
      contact: { first_name: 'Julie', last_name: 'Morand', email: 'julie.morand@example.ch', phone: '+41 79 530 18 64' },
      property: CHAMPEL_EMBARQUE, market_listing: null,
    },
    {
      id: 'm4', agency_id: AGENCE_BANC.id, client_search_id: 'cs1', contact_id: 'c1', source: 'internal',
      property_id: 'p1', market_listing_id: null,
      score: 68, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: ilYA(-24 * 5), created_at: ilYA(26),
      reasons: {
        budget: { match: false, score: 0, detail: '16% au-dessus du budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 22, detail: '4,5 pièces · 118 m²' },
        features: { match: true, score: 10, detail: '2/2 critères' },
      },
      contact: { first_name: 'Camille', last_name: 'Rochat', email: 'camille.rochat@example.ch', phone: '+41 79 412 88 03' },
      property: CHAMPEL_EMBARQUE, market_listing: null,
    },
    {
      id: 'm5', agency_id: AGENCE_BANC.id, client_search_id: 'cs10', contact_id: 'c10', source: 'internal',
      property_id: 'p2', market_listing_id: null,
      score: 95, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(12),
      reasons: {
        budget: { match: true, score: 32, detail: 'Dans le budget' },
        zone: { match: true, score: 24, detail: 'Cologny correspond' },
        type: { match: true, score: 12, detail: 'house' },
        rooms: { match: true, score: 22, detail: '7 pièces · 260 m²' },
        features: { match: true, score: 7, detail: '2/3 critères' },
      },
      contact: { first_name: 'Antoine', last_name: 'Lefèvre', email: 'a.lefevre@example.ch', phone: null },
      property: COLOGNY_EMBARQUE, market_listing: null,
    },
    {
      // `pb32` : « Loft 2,5 pièces · Genève », CHF 1'290'000, du catalogue de « Mes biens ».
      id: 'm6', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'internal',
      property_id: 'pb32', market_listing_id: null,
      score: 96, status: 'interested', sent_via: 'reception', sent_at: ilYA(24 * 6), snoozed_until: null, created_at: ilYA(24 * 6 + 2),
      reasons: {
        budget: { match: true, score: 32, detail: 'Dans le budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: false, score: 0, detail: 'Aucun critère' },
        features: { match: false, score: 0, detail: '—' },
      },
      contact: { first_name: 'Emma', last_name: 'Schneider', email: 'emma.schneider@example.com', phone: '+41 76 488 02 19' },
      property: { title: 'Loft 2,5 pièces · Genève', price: 1_290_000, city: 'Genève', canton: 'GE', rooms: 2.5, surface_m2: 86, photos: [], type: 'apartment' },
      market_listing: null,
    },
```

- [ ] **Step 3 bis : Les recherches notées par le moteur**

Le fil lit les critères dans `client_searches` (Task 4). Juste AVANT la ligne `  transactions: [],` de `CRM_TABLES`, ajouter :

```ts
  // Les recherches que le moteur a notées (`matches.client_search_id`) — ce que le fil de matchs
  // compare au bien. Recopiées de la fiche : en production, la fiche est souvent vide et la
  // recherche pleine ; le banc, lui, garde les deux égales pour ne tromper aucune des deux surfaces.
  client_searches: ['c1', 'c7', 'c9', 'c10'].map((id) => ({
    id: `cs${id.slice(1)}`, agency_id: AGENCE_BANC.id, contact_id: id, label: null, is_active: true,
    criteria: CONTACTS.find((c) => c.id === id)?.search_criteria ?? null,
    last_matched_at: null, created_at: ilYA(300), updated_at: ilYA(300),
  })),
```

- [ ] **Step 4 : Le lien privé du banc**

Remplacer :

```ts
export const CRM_EDGES: Record<string, unknown> = {
  'extract-lead': (a: Record<string, unknown>) => {
```

par :

```ts
export const CRM_EDGES: Record<string, unknown> = {
  // « Proposer » du fil de matchs : le lien privé. Rien ne sort du navigateur ; le jeton désigne une
  // page que le banc ne sert pas — le lien s'affiche et se copie, il ne s'ouvre pas.
  'buyer-reception-create': () => ({
    ok: true, token: 'banc-reception', linkId: 'rl-banc', expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  }),
  'extract-lead': (a: Record<string, unknown>) => {
```

- [ ] **Step 5 : La page du banc**

Créer `src/pages/dev/matchingFilBanc.tsx` :

```tsx
/**
 * Le Matching du banc `/dev/crm` : le FIL DE MATCHS (lot 1) en page 0, sur les fixtures de ce banc.
 *
 * ⚠ Le vrai `MatchingPage` est monté — molette, clavier, points de page et thème viennent de la
 * production. Seules les deux pages passent par le slot `banc` : le fil y est le vrai composant (ses
 * lectures traversent l'interception comme Contacts et Mes biens), la Recherche reste en démo, faute
 * de fixtures du marché ici. L'atelier actuel garde son propre banc, `/dev/matching-atelier`.
 *
 * ⚠ Composants de MODULE : une identité recréée à chaque rendu remonterait le fil et viderait sa
 * sélection (cf. `MatchingPagerBanc`).
 */
import MatchingPage, { type MatchingPagerBanc } from '@/pages/agent/MatchingPage'
import MatchingFil from '@/components/matching-fil/MatchingFil'
import MatchingRechercheHybride from '@/components/matching-recherche/MatchingRechercheHybride'

function PageFil({ dark, onOpenRecherche }: { dark: boolean; onOpenRecherche: () => void }) {
  return <MatchingFil dark={dark} onOpenRecherche={onOpenRecherche} />
}

function PageRecherche({ dark }: { dark: boolean }) {
  return <MatchingRechercheHybride dark={dark} demo="ok" />
}

const BANC_FIL: MatchingPagerBanc = { Page0: PageFil, Page1: PageRecherche }

export default function MatchingFilBanc() {
  return <MatchingPage banc={BANC_FIL} atterrissage="score" />
}
```

- [ ] **Step 6 : Brancher le banc**

Dans `src/pages/dev/CrmShowcasePage.tsx` :

1. Remplacer :

```tsx
// Le Matching passe par SON banc (fixtures de l'atelier) : ses hooks réels visent
// le moteur `matching-engine`, qu'aucune fixture de ce banc-ci ne simule.
const MatchingBanc = lazy(() => import('@/pages/dev/MatchingShowcasePage').then((m) => ({ default: () => <m.MatchingBanc dansCoquille /> })))
```

par :

```tsx
// Le Matching du banc est le FIL DE MATCHS (refonte, lot 1), sur les fixtures de ce banc-ci : ses
// lectures traversent l'interception. L'atelier actuel garde son banc, `/dev/matching-atelier`.
const MatchingFilBanc = lazy(() => import('@/pages/dev/matchingFilBanc'))
```

2. Remplacer :

```tsx
  // L'écran d'erreur de l'application (`ErreurApplication`), atteint par une vraie erreur.
  { id: 'matching', chemin: '/dashboard/matching', label: 'Matching', vague: null },
  { id: 'erreur-rendu', chemin: '/dashboard/erreur-rendu', label: 'Erreur de rendu', vague: null },
```

par :

```tsx
  // Le fil de matchs (refonte, lot 1) — l'atelier actuel reste sur `/dev/matching-atelier`.
  { id: 'matching', chemin: '/dashboard/matching', label: 'Matching · fil', vague: null },
  // L'écran d'erreur de l'application (`ErreurApplication`), atteint par une vraie erreur.
  { id: 'erreur-rendu', chemin: '/dashboard/erreur-rendu', label: 'Erreur de rendu', vague: null },
```

3. Remplacer `        <Route path="matching" element={<MatchingBanc />} />` par `        <Route path="matching" element={<MatchingFilBanc />} />`.

4. Remplacer :

```tsx
  { id: 'nominal', label: 'Nominal', titre: '8 contacts, 50 biens, 2 rappels, 1 visite, journal à 4 lignes' },
```

par :

```tsx
  { id: 'nominal', label: 'Nominal', titre: '10 contacts, 50 biens, 6 matchs, 2 rappels, 1 visite, journal à 4 lignes' },
```

5. Remplacer :

```tsx
      ecrivables: ['calendar_labels', 'visits', 'reminders', 'calendar_events', 'contact_notes', 'contacts'],
```

par :

```tsx
      // `matches`, `transactions` et `activity_events` : un match proposé, reporté ou écarté doit
      // QUITTER le fil, et son deal comme sa ligne de journal doivent exister ensuite.
      ecrivables: ['calendar_labels', 'visits', 'reminders', 'calendar_events', 'contact_notes', 'contacts', 'matches', 'transactions', 'activity_events'],
```

- [ ] **Step 7 : Vérifier types et lint**

Run : `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "src/pages/dev" ; echo fin`
Expected : seulement `fin`.

Run : `npx eslint src/pages/dev/crmFixtures.ts src/pages/dev/CrmShowcasePage.tsx src/pages/dev/matchingFilBanc.tsx`
Expected : aucune erreur.

- [ ] **Step 8 : Point de commit (au signal)**

```bash
git add src/pages/dev/crmFixtures.ts src/pages/dev/CrmShowcasePage.tsx src/pages/dev/matchingFilBanc.tsx
git commit -m "feat(banc): le fil de matchs sur /dev/crm, avec des matchs que le moteur peut créer"
```

---

### Task 13 : L'éprouver sur le banc

Aucun code. Chaque vérification lit l'écran ; une capture n'est prise que pour la preuve finale.

- [ ] **Step 1 : Ouvrir le banc sur le fil**

Outil `navigate` (volet navigateur) : `http://localhost:5173/dev/crm?entree=/dashboard/matching`, puis `resize_window` 1440 × 900, attendre 4 s, `read_console_messages` (erreurs seules).
Expected : aucune erreur JavaScript (les 401 d'`/auth` hors banc sont tolérés s'ils préexistaient).

- [ ] **Step 2 : Lire la liste**

`get_page_text`. Expected, dans l'ordre :
- « Matching », « À traiter · 3 » ;
- « Vos biens » ;
- « Appartement 4,5 pièces · Champel », « CHF 1'450'000 · 2 acheteurs », puis « Julie Morand » (97), « Emma Schneider » (94) ;
- « Villa individuelle · Cologny », « CHF 3'200'000 · 1 acheteur », puis « Antoine Lefèvre » (95) ;
- « 1 reporté · de retour dès le JJ.MM » (dans 5 jours).
- ni « Salomé », ni « Camille » dans les lignes actives.

- [ ] **Step 3 : Lire le panneau de Julie**

Expected dans le texte : « Votre bien », « 97 », « estimation », « Julie Morand », une ligne KYC, « Pourquoi ce match », les lignes
Budget « CHF 1'300'000 à CHF 1'600'000 » / « CHF 1'450'000 », Quartier « Genève, Champel · GE » / « Genève · GE », Type « Appartement » / « Appartement »,
Pièces « 4 et plus » / « 4,5 », Surface « 100 m² et plus » / « 118 m² », Équipements « Balcon, Ascenseur, Terrasse » / « 2 sur 3 »,
et « Déjà reçu par Julie : aucun envoi », puis « Écarter », « Plus tard », « Proposer à Julie ».

- [ ] **Step 4 : Historique d'Emma, écart de Camille**

Cliquer « Emma Schneider » : expected Quartier « Zürich, Genève · ZH, GE » / « Genève · GE », « Déjà reçu par Emma : 1 bien proposé · 1 intéressé », et AUCUNE ligne Pièces / Surface / Équipements (Emma n'en a pas posé).
Déplier les reportés, cliquer « Réactiver » sur Camille : expected « À traiter · 4 », Camille dans le groupe Champel avec « Budget à vérifier », et dans son panneau une icône d'écart et « 16% au-dessus du budget » sous « CHF 1'450'000 ».

- [ ] **Step 5 : Clavier et annulation**

Cliquer la ligne de Julie, puis touche ↓ : expected sélection sur Emma (son panneau). Touche `p` : expected la ligne d'Emma disparaît, la barre « Emma Schneider reporté·e d'une semaine · Annuler » apparaît, le focus est sur la ligne suivante. Cliquer « Annuler » : expected Emma revient et redevient sélectionnée. Touche `x` sur Emma, ne rien toucher 5 s : expected la barre disparaît avant l'écriture, Emma ne revient pas, et `/dashboard/audit` (menu du banc) montre « Match écarté ».

- [ ] **Step 6 : Proposer**

Sur Antoine, touche `e` : expected la feuille « Proposer à Antoine », WhatsApp grisé avec « Antoine n'a pas de numéro : copiez le lien pour le lui transmettre. ». Cliquer « Copier le lien » : expected « Lien copié » (ou « Copiez ce lien : ») avec `http://localhost:5173/reception/banc-reception`, un toast « Bien proposé à Antoine », et, après « Terminé », Antoine absent de la liste. `/dashboard/audit` montre « Dossier envoyé ».

- [ ] **Step 7 : Filtres et états**

Recharger. Filtre Acheteur = Julie : expected « À traiter · 1 ». Texte « zzz » : expected « Rien ne correspond à ces filtres. » et « Retirer les filtres » qui ramène la liste. Menu du banc → « Vide » : expected « Tout est à jour », « Compléter la recherche d'un contact », « Voir le marché ». « Échec » : expected « Les matchs n'ont pas pu être chargés. » et « Réessayer ». Revenir à « Nominal ».

- [ ] **Step 8 : Les deux thèmes, et la preuve**

Capture en sombre (`computer` screenshot), bascule du thème dans la barre latérale, capture en clair. Vérifier à l'œil : pastilles de score lisibles, filet d'accent sur la ligne active, aucun aplat teinté sous du texte, feuille d'envoi au voile sombre dans les deux thèmes. Remettre `resize_window` preset `desktop`.

Expected : les deux captures envoyées à Julien (`SendUserFile`), avec la liste des écarts constatés s'il y en a.

---

### Task 14 : Les portes complètes

- [ ] **Step 1 : Types et lint**

Run : `npx tsc -b && npm run lint`
Expected : 0 erreur.

- [ ] **Step 2 : Gardes de dépôt**

Run : `npm run lint:deadcode && npm run i18n:parity:ci && npm run lint:prose && npm run lint:i18n`
Expected : les quatre sortent en 0. `lint:deadcode` : aucun export sans lecteur dans `matching-fil`, `useMatchingFil`, `useAtelierMatching`.

- [ ] **Step 3 : Suite unitaire, SEULE**

Run : `npm run test:unit`
Expected : PASS. En cas de rouge sur une spec sans rapport, la relancer seule avant de conclure (délais sous charge).

- [ ] **Step 4 : Point de commit (au signal)** — rien de neuf si les tâches précédentes sont commitées.

---

### Task 15 : Le cerveau

**Files :**
- Modify : `.claude-flow/knowledge/megga-memory.seed.json`

- [ ] **Step 1 : Ajouter l'entrée `megga/matching-fil`**

```bash
python3 - <<'EOF'
import json
chemin = '.claude-flow/knowledge/megga-memory.seed.json'
brut = open(chemin, encoding='utf-8').read()
d = json.loads(brut)
assert json.dumps(d, ensure_ascii=False, indent=2) + '\n' == brut, 'mise en forme inattendue'
assert not any(e['key'] == 'megga/matching-fil' for e in d['entries'])
d['entries'].append({
  'key': 'megga/matching-fil',
  'namespace': 'megga',
  'value': (
    "FIL DE MATCHS (refonte de la page 0 du pager Matching, conception validée par Julien le 17.09.2026, "
    "docs/superpowers/specs/2026-09-17-matching-fil-design.md). Remplace l'Atelier (trois portes, score invisible, "
    "gestes cachés) par UN fil de paires bien <-> acheteur, liste + panneau comme la Messagerie. Décisions : fil de "
    "matchs (pas par bien ni par acheteur) ; mandats = une ligne par match, marché = UNE sélection par acheteur "
    "(1 618 matchs marché contre 10 mandats en prod le 17.09) ; un seul chemin d'envoi = lien privé de réception ; "
    "trois onglets À traiter / En attente / Réponses. LOT 1 (bench seul, l'atelier reste en production jusqu'à la fin "
    "du lot 3) : src/components/matching-fil/ (filModele.ts pur et testé, MatchingFil, FilListe, FilPanneau, "
    "FilFeuilleEnvoi, FilAnnulation), src/hooks/useMatchingFil.ts (lectures PLATES, sans jointure : le banc n'applique "
    "pas select ; critères = client_searches.criteria par matches.client_search_id, JAMAIS contacts.search_criteria, vide pour 3 acheteurs sur 4 en prod ; équipements comptés avec la règle du moteur, slugify + inclusion, spec de parité avec calculateScoreV2), banc /dev/crm?entree=/dashboard/matching (src/pages/dev/matchingFilBanc.tsx). Les écritures restent "
    "execSendDossier / execSnooze / execDismiss (types étroits AcheteurGeste / BienGeste) ; Plus tard et Écarter "
    "écrivent désormais match_reporte / match_ecarte au journal. Lot 2 = sélection marché (RPC résumé), lot 3 = En "
    "attente + Réponses + e-mail + bascule prod, lot 4 = retrait de l'atelier + mobile. megga/matching-ui-hooks décrit "
    "l'ANCIEN atelier."
  ),
  'tags': 'matching,frontend,refonte,fil,lot1',
})
open(chemin, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('ok')
EOF
```

Expected : `ok`.

- [ ] **Step 2 : Réensemencer et vérifier**

Run : `npm run ruflo:seed && CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory search -q "refonte du matching en fil de matchs liste et panneau" -n megga`
Expected : `megga/matching-fil` dans les résultats.

- [ ] **Step 3 : Point de commit (au signal)**

```bash
git add .claude-flow/knowledge/megga-memory.seed.json
git commit -m "docs(cerveau): le fil de matchs, lot 1"
```

---

## Exécution (17.09.2026) : ce qui a changé par rapport aux blocs de code ci-dessus

⚠ **Le code du dépôt fait foi.** Trois relectures ont fait évoluer le plan en cours de route ; les tâches 1, 4, 5, 8, 12 et 13 ont été corrigées ici même, mais la dernière série de correctifs n'a pas été recopiée dans les blocs.

- **Données** : critères lus dans `client_searches.criteria` (par `client_search_id`), repli sur la fiche ; `chargeLe` pris AVANT les lectures ; `aDesDonnees` et `erreurLe` exposés ; `rafraichir` rend la promesse d'invalidation.
- **Modèle** : équipements comptés comme le moteur (spec de parité avec `calculateScoreV2`) ; villes ET cantons ; pièces et surface comparées chacune à leurs bornes ; pas de texte d'écart pour le type.
- **Conteneur** : barre d'annulation hors des états (et flottante) ; `e.repeat` ignoré ; masques datés (un « Plus tard » réapparaît sous « Reportés ») ; un rafraîchissement en échec garde la liste (toast unique) ; `filtres` rangés dans l'onglet (`useTabScopedState`, pivot d'URL appliqué une fois la pile chargée) ; région vivante toujours montée.
- **Feuille d'envoi** : phases `choix / creation / suivi / fait`, fermeture refusée pendant l'envoi, popup bloquée ou fermée ⇒ vrai lien WhatsApp affiché, échec du suivi ⇒ lien affiché et seul « Fermer », `fil.envoi.waMessage`.
- **Pager** : la page cachée est `inert` (Tab depuis la page 0 faisait défiler le viewport clippé de 470 px) ; marge droite du panneau élargie pour les points de page.
- **Gestes** : double-clic ignoré (`e.detail > 1`) sur les boutons du panneau, le voile de la feuille et « Annuler ».
- **Garde de sécurité** : la redirection WhatsApp de la feuille est inscrite dans `tests/unit/redirection-ouverte.spec.ts`.
- **Dernière relecture** : un filtre venu d'un lien ou de l'onglet n'est plus retiré en silence (état « Rien ne correspond » + option « Sélection actuelle ») ; garde double-clic aussi sur les lignes et « Réactiver » ; marge basse sous la liste pour la barre flottante ; WhatsApp fermé pendant le suivi ⇒ lien affiché ; scores des fixtures recalculés avec `calculateScoreV2` (m2 et m6 : 100, m5 : 97).
