# Matching — fil de matchs, lot 2 : la sélection du marché — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Ajouter au fil de matchs une ligne « Marché » par acheteur, qui ouvre sa sélection de biens du marché (cochables, écarts seuls, « Écarter ») et les envoie tous dans UN lien privé — sur le banc `/dev/crm`, l'atelier restant en production.

**Architecture :** Une RPC `matching_fil_marche()` résume côté serveur les matchs du marché par acheteur (nombre, meilleur score, trois vignettes) ; le fil n'en reçoit que ces lignes. À l'ouverture d'une ligne, `useSelectionMarche` charge ses biens vingt à la fois (lectures plates). Le modèle pur gagne `construireSelections` et `precoches` ; les écritures passent par un nouvel exécuteur `execEnvoyerSelection` (un deal, UNE relance, UNE ligne de journal) qui partage le rattachement du deal avec `execSendDossier`. La feuille d'envoi accepte N biens.

**Tech Stack :** React 19 + TypeScript, TanStack Query v5, react-i18next (FR/DE/EN/IT), Supabase (SQL, RLS, PostgREST), Vitest, jetons MEGGA X.

**Conception :** [docs/superpowers/specs/2026-09-17-matching-fil-design.md](../specs/2026-09-17-matching-fil-design.md) §3.2, §5, §6, §8, §10. **Lot 1** (non commité, dans ce worktree) : [2026-09-17-matching-fil-lot1.md](2026-09-17-matching-fil-lot1.md) — lire sa section finale « Exécution » : le code du dépôt fait foi.

---

## Règles de ce chantier

- **Commits : AU SIGNAL de Julien seulement** (« committe »), un commit PAR SUJET, jamais de push. Les « Point de commit » ne s'exécutent pas sans ce signal.
- **Aucun littéral** de rayon, d'espacement ou de taille de texte dans `src/components/matching-fil/` : `var(--crm-radius-*)`, `var(--crm-space-*)`, `var(--crm-text-*)`, `0`, ou `calc()` de variables. Largeurs et hauteurs en pixels permises. Aucune couleur en dur, graisse ≤ 600, pas de capitales CSS, aucune chaîne affichée hors `t()`.
- **i18n** : fichiers `src/i18n/locales/*/matching.json` au format exact `JSON.stringify(obj, null, 2) + '\n'` ; les modifier par script qui vérifie ce format d'abord. Aucun tiret cadratin ni demi-cadratin, aucun ß, l'italien au vouvoiement « Lei ».
- **Aucun export mort** (`npm run lint:deadcode`, `src/` seulement).
- **Tests : ciblés et SEULS** — jamais la suite complète en parallèle de `tsc` ou `eslint`.
- **Production** : aucune écriture. La migration n'est PAS appliquée par ce plan (elle part avec la fusion, `deploy.yml`).
- Banc : `http://localhost:5173/dev/crm?entree=/dashboard/matching` (serveur déjà lancé, HMR).

## Décisions de ce plan (précisions de la conception)

1. **Un envoi de sélection = un suivi.** Un deal (l'actif, sinon un `new_lead` sur le meilleur bien), UNE relance `follow_up_sent_property` à +5 j (portant le `match_id` du meilleur bien) et UNE ligne `dossier_envoye` listant les `match_ids`. Appeler `execSendDossier` N fois poserait N relances identiques dans « Aujourd'hui ».
2. **« Chercher plus loin dans Recherche » est reporté au lot 3.** Recherche ne sait pas s'ouvrir sur un acheteur (son acheteur est un état interne), et Julien a demandé de ne pas toucher à Recherche.
3. **Clavier sur une ligne « Marché »** : ↑/↓ comme les autres lignes ; `E` envoie les biens cochés (s'il y en a) ; `P` et `X` n'y font rien — ils visent UN match, la ligne en porte plusieurs.
4. **Un filtre « Bien » masque toutes les lignes « Marché »** (un bien en mandat n'est dans aucune sélection) ; « Acheteur » et le texte s'y appliquent.
5. **« Écarter » dans une sélection** passe par la même fenêtre d'annulation que dans le panneau, sans déplacer la sélection du fil.

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `src/components/matching-fil/filModele.ts` (modifié) | `FilSelectionResume`, `cleSelection`, `contactDeSelection`, `construireSelections`, `precoches`, `FilBien.marche` |
| `tests/unit/matching-fil-modele.spec.ts` (modifié) | Tests des ajouts |
| `src/hooks/useAtelierMatching.ts` (modifié) | `refAnnonceMarche`, `rattacherDeal` (extrait), `execEnvoyerSelection` |
| `tests/unit/matching-fil-gestes.spec.ts` (modifié) | Tests de `execEnvoyerSelection` et du rattachement |
| `supabase/migrations/20260921120000_matching_fil_marche.sql` (créé) | La RPC de résumé |
| `src/types/database.ts` (modifié) | Le type de la RPC |
| `src/hooks/useMatchingFil.ts` (modifié) | Résumés « Marché », helpers partagés |
| `src/hooks/useSelectionMarche.ts` (créé) | Les biens d'une sélection, vingt à la fois |
| `src/i18n/locales/*/matching.json` (modifiés) | Clés `fil.marche*`, `fil.selection.*`, `fil.envoi.*` |
| `src/components/matching-fil/filValeurs.ts` (créé) | `valeursCritere`, `resumeRecherche` (extraits du panneau) |
| `src/components/matching-fil/filAffichage.ts`, `filAtomes.tsx`, `FilPanneau.tsx` (modifiés) | `MARGE_POINTS` partagé, `referrerPolicy`, import des valeurs |
| `src/components/matching-fil/FilListe.tsx` (modifié) | Section « Marché » |
| `src/components/matching-fil/FilSelection.tsx` (créé) | Le panneau de sélection |
| `src/components/matching-fil/FilFeuilleEnvoi.tsx` (modifié) | Un ou plusieurs biens |
| `src/components/matching-fil/MatchingFil.tsx` (modifié) | Intégration |
| `src/pages/dev/crmFixtures.ts`, `src/pages/dev/CrmShowcasePage.tsx` (modifiés) | Annonces, matchs et RPC du banc |
| `.claude-flow/knowledge/megga-memory.seed.json` (modifié) | Cerveau |

---

### Task 0 : Consigner les décisions du lot 2 dans la conception

**Files :** Modify `docs/superpowers/specs/2026-09-17-matching-fil-design.md`

- [ ] **Step 1 : Ajouter les précisions**

Après le paragraphe qui commence par `**Précisions du plan du lot 1 (17.09.2026).**` (fin du §10), ajouter :

```
**Précisions du plan du lot 2 (17.09.2026).** Un envoi de sélection est UN suivi : un deal (l'actif,
sinon un `new_lead` sur le meilleur bien), UNE relance à +5 j et UNE ligne `dossier_envoye` qui liste
les `match_ids` (`execEnvoyerSelection`). Le lien « Chercher plus loin dans Recherche » est reporté au
lot 3 : Recherche ne sait pas s'ouvrir sur un acheteur, et on n'y touche pas. Sur une ligne « Marché »,
`E` envoie les biens cochés ; `P` et `X` n'y font rien. Un filtre « Bien » masque les lignes « Marché ».
La RPC de résumé est `matching_fil_marche()` (migration `20260921120000`, à renommer au jour de la
fusion si elle a lieu après le 21.09.2026 : date-guard de `deploy.yml`).
```

Sous `## 13. À trancher au plan du lot concerné`, ajouter la puce :

```
- **Moteur / automatisations (avant la bascule) :** `automation-engine` pose une relance à +3 j par
  match envoyé resté sans réponse et sans relance portant SON `match_id`. Une sélection de N biens n'en
  porte qu'une : N-1 relances automatiques suivraient, envoyées par e-mail si la règle est en envoi
  automatique. À aligner sur « un envoi, un suivi ».
```

- [ ] **Step 2 : Point de commit (au signal)** — avec le plan.

```bash
git add docs/superpowers/specs/2026-09-17-matching-fil-design.md docs/superpowers/plans/2026-09-17-matching-fil-lot2.md
git commit -m "docs(matching): plan du lot 2 du fil de matchs, la sélection du marché"
```

---

### Task 1 : Le modèle des sélections

**Files :**
- Modify : `src/components/matching-fil/filModele.ts`
- Modify : `tests/unit/matching-fil-modele.spec.ts`

- [ ] **Step 1 : Écrire les tests**

Dans `tests/unit/matching-fil-modele.spec.ts`, remplacer le bloc d'import :

```ts
import {
  cleEquipement, compterHistorique, construireFil, initiales, lignesCriteres, optionsFiltres,
  palierScore, premierEcart,
  type FilBien, type FilFiltres, type FilMatch,
} from '@/components/matching-fil/filModele'
```

par :

```ts
import {
  cleEquipement, cleSelection, compterHistorique, construireFil, construireSelections, contactDeSelection, initiales,
  lignesCriteres, optionsFiltres, palierScore, precoches, premierEcart,
  type FilBien, type FilFiltres, type FilMatch, type FilSelectionResume,
} from '@/components/matching-fil/filModele'
```

Puis ajouter à la FIN du fichier :

```ts

describe('construireSelections — les lignes « Marché » (§3.2)', () => {
  const s = (id: string, prenom: string, nom: string, nombre: number, meilleurScore: number): FilSelectionResume => ({
    acheteur: acheteur(id, { prenom, nom }), nombre, meilleurScore, vignettes: [],
  })
  const tous = [
    s('c9', 'Julie', 'Morand', 3, 97), s('c7', 'Emma', 'Schneider', 3, 100),
    s('c4', 'Luca', 'Bernasconi', 1, 97), s('c2', 'Théo', 'Baumgartner', 0, 99),
  ]

  it('par meilleur score, puis par nombre ; une sélection vide n’a pas de ligne', () => {
    expect(construireSelections(tous, SANS_FILTRE).map((x) => x.acheteur.id)).toEqual(['c7', 'c9', 'c4'])
  })

  it('un filtre sur un BIEN écarte toutes les sélections ; acheteur et texte s’appliquent', () => {
    expect(construireSelections(tous, { ...SANS_FILTRE, bienId: 'p1' })).toEqual([])
    expect(construireSelections(tous, { ...SANS_FILTRE, acheteurId: 'c9' }).map((x) => x.acheteur.id)).toEqual(['c9'])
    expect(construireSelections(tous, { ...SANS_FILTRE, texte: 'bernasconi' }).map((x) => x.acheteur.id)).toEqual(['c4'])
  })
})

describe('cleSelection', () => {
  it('fait l’aller et le retour, et ne confond jamais un id de match', () => {
    expect(contactDeSelection(cleSelection('c9'))).toBe('c9')
    expect(contactDeSelection('m3')).toBeNull()
  })
})

describe('precoches — cochés d’office (§5)', () => {
  const b = bien('ml', { prix: 1_500_000, ville: 'Genève', canton: 'GE', type: 'apartment', pieces: 5, surface: 124 })
  const criteres = { budget_min: 1_300_000, budget_max: 1_600_000, rooms_min: 4 }
  const raisonsOk = { budget: { match: true, score: 32, detail: 'Dans le budget' } }

  it('retient les biens dont chaque critère est tenu, dans l’ordre reçu, 5 au plus', () => {
    const matchs = Array.from({ length: 7 }, (_, i) => match(`m${i}`, 90 - i, b, acheteur('c'), { criteres, raisons: raisonsOk }))
    expect(precoches(matchs)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4'])
  })

  it('un écart, un verdict absent ou aucun critère : pas coché', () => {
    const ecart = match('e', 90, b, acheteur('c'), { criteres, raisons: { budget: { match: false, score: 0, detail: '12% au-dessus du budget' } } })
    const sansVerdict = match('n', 90, b, acheteur('c'), { criteres })
    const sansCritere = match('v', 90, b, acheteur('c'))
    expect(precoches([ecart, sansVerdict, sansCritere])).toEqual([])
  })
})
```

- [ ] **Step 2 : Lancer, constater l'échec**

Run : `npx vitest run tests/unit/matching-fil-modele.spec.ts`
Expected : FAIL (`construireSelections` / `cleSelection` / `precoches` non exportés).

- [ ] **Step 3 : Implémenter**

Dans `src/components/matching-fil/filModele.ts` :

1. Dans l'interface `FilBien`, après la ligne `  photo: string | null`, ajouter :

```ts
  /** Annonce du MARCHÉ (lot 2) : sa référence et son lien d'origine. Absent pour un bien en mandat. */
  marche?: { ref: string; sourceUrl: string | null }
```

2. Ajouter à la FIN du fichier :

```ts

/** La ligne « Marché » d'un acheteur (lot 2, §3.2) : un résumé serveur, jamais ses biens un à un. */
export interface FilSelectionResume {
  acheteur: FilMatch['acheteur']
  /** Matchs du marché `suggested`, non reportés, sur une annonce non retirée. */
  nombre: number
  meilleurScore: number
  /** Jusqu'à trois vignettes, du meilleur bien au moins bon. */
  vignettes: string[]
}

const PREFIXE_SELECTION = 'marche:'

/** L'identifiant de la ligne « Marché » d'un acheteur dans l'ordre du fil — distinct de tout id de match. */
export const cleSelection = (contactId: string): string => `${PREFIXE_SELECTION}${contactId}`

/** L'acheteur d'une ligne « Marché », ou `null` pour une ligne de match. */
export const contactDeSelection = (cle: string): string | null =>
  (cle.startsWith(PREFIXE_SELECTION) ? cle.slice(PREFIXE_SELECTION.length) : null)

/**
 * Les lignes « Marché » retenues par les filtres, par meilleur score (§3.2). Un filtre sur un BIEN les
 * écarte toutes : un bien en mandat n'est dans aucune sélection du marché.
 */
export function construireSelections(resumes: readonly FilSelectionResume[], filtres: FilFiltres): FilSelectionResume[] {
  if (filtres.bienId) return []
  const texte = plier(filtres.texte.trim())
  const nom = (s: FilSelectionResume): string => `${s.acheteur.prenom} ${s.acheteur.nom}`
  return resumes
    .filter((s) => s.nombre > 0)
    .filter((s) => !filtres.acheteurId || s.acheteur.id === filtres.acheteurId)
    .filter((s) => !texte || plier(nom(s)).includes(texte))
    .sort((a, b) =>
      b.meilleurScore - a.meilleurScore || b.nombre - a.nombre
      || nom(a).localeCompare(nom(b), 'fr') || a.acheteur.id.localeCompare(b.acheteur.id))
}

/**
 * Les biens cochés d'office dans une sélection (§5) : ceux dont CHAQUE critère posé est tenu, 5 au plus,
 * dans l'ordre reçu. Un verdict absent n'est pas tenu : on ne coche pas sur une supposition.
 */
export function precoches(matchs: readonly FilMatch[], max = 5): string[] {
  return matchs
    .filter((m) => {
      const lignes = lignesCriteres(m)
      return lignes.length > 0 && lignes.every((l) => l.ok === true)
    })
    .slice(0, max)
    .map((m) => m.id)
}
```

- [ ] **Step 4 : Lancer, constater le succès**

Run : `npx vitest run tests/unit/matching-fil-modele.spec.ts`
Expected : PASS, 40 tests.

- [ ] **Step 5 : Point de commit (au signal)** — avec la Task 10 (exports sans lecteur avant).

---

### Task 2 : L'envoi d'une sélection

**Files :**
- Modify : `src/hooks/useAtelierMatching.ts`
- Modify : `tests/unit/matching-fil-gestes.spec.ts`

- [ ] **Step 1 : Écrire les tests**

Remplacer INTÉGRALEMENT `tests/unit/matching-fil-gestes.spec.ts` par :

```ts
/**
 * Garde-fou : les gestes du matching laissent une TRACE au journal (CLAUDE.md §5), et un envoi de
 * sélection n'écrit qu'UN suivi — un deal, une relance, une ligne de journal (lot 2 du fil de matchs).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { execDismiss, execEnvoyerSelection, execSendDossier, execSnooze } from '@/hooks/useAtelierMatching'

const h = vi.hoisted(() => ({
  ecritures: [] as { table: string; genre: string; valeurs: unknown; filtres: string[] }[],
  lectures: {} as Record<string, unknown[]>,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const e = { table, genre: 'select', valeurs: null as unknown, filtres: [] as string[] }
      const q = {
        select: () => q,
        insert: (valeurs: unknown) => { e.genre = 'insert'; e.valeurs = valeurs; h.ecritures.push(e); return q },
        update: (valeurs: unknown) => { e.genre = 'update'; e.valeurs = valeurs; h.ecritures.push(e); return q },
        eq: (col: string, val: unknown) => { e.filtres.push(`${col}=${String(val)}`); return q },
        in: (col: string, vals: unknown[]) => { e.filtres.push(`${col} in ${vals.join(',')}`); return q },
        order: () => q,
        limit: () => q,
        single: () => Promise.resolve({ data: { id: 'deal-neuf' }, error: null }),
        then: (resoudre: (r: { data: unknown; error: null }) => unknown) =>
          Promise.resolve({ data: e.genre === 'select' ? (h.lectures[table] ?? []) : null, error: null }).then(resoudre),
      }
      return q
    },
    functions: { invoke: () => Promise.resolve({ error: null }) },
  },
}))
vi.mock('@/lib/intercom-milestones', () => ({ markIntercomMilestone: () => undefined }))
vi.mock('@/lib/intercom', () => ({ INTERCOM_EVENTS: { FIRST_MATCH_SENT: 'first_match_sent' } }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({}) }))

const CTX = { agencyId: 'ag-1', userId: 'u-1', agentName: 'Gregory', agentPhone: null }
const ACHETEUR = { id: 'c-1', matchId: 'm-1', first: 'Julie', last: 'Morand', email: null, score: 90 }
const annonce = (id: string, ref: string) => ({
  kind: 'market' as const, id, key: `m:${id}`, ref, title: `Annonce ${id}`, price: 1_500_000, addr: 'Genève',
  rooms: 5, area: 124, type: 'apartment', gallery: [], sourceUrl: null, agency: { name: null, phone: null },
})
const seq = () => h.ecritures.map((e) => `${e.genre}:${e.table}`)

beforeEach(() => { h.ecritures.length = 0; h.lectures = {} })

describe('gestes du matching — le journal', () => {
  it('Plus tard reporte le match, pose le rappel ET écrit `match_reporte`', async () => {
    await execSnooze(CTX, ACHETEUR)
    expect(seq()).toEqual(['update:matches', 'insert:reminders', 'insert:activity_events'])
    expect(h.ecritures[2]!.valeurs).toMatchObject({
      agency_id: 'ag-1', actor_id: 'u-1', actor_kind: 'user', action: 'match_reporte',
      entity_type: 'contact', entity_id: 'c-1', category: 'deal', metadata: { match_id: 'm-1', score: 90 },
    })
  })

  it('Écarter ignore le match ET écrit `match_ecarte`', async () => {
    await execDismiss(CTX, ACHETEUR)
    expect(seq()).toEqual(['update:matches', 'insert:activity_events'])
    expect(h.ecritures[0]!.valeurs).toEqual({ status: 'ignored' })
    expect(h.ecritures[1]!.valeurs).toMatchObject({ action: 'match_ecarte', entity_id: 'c-1', metadata: { match_id: 'm-1', score: 90 } })
  })
})

describe('execEnvoyerSelection — un geste, un suivi', () => {
  const JULIE = { id: 'c-1', first: 'Julie', last: 'Morand' }

  it('marque les matchs envoyés, crée le deal sur le meilleur bien, et n’écrit qu’UNE ligne de journal et UNE relance', async () => {
    await execEnvoyerSelection(CTX, JULIE, [
      { matchId: 'm-b', score: 91, bien: annonce('ml-2', 'MG-MK-2') },
      { matchId: 'm-a', score: 97, bien: annonce('ml-1', 'MG-MK-1') },
    ])
    expect(seq()).toEqual(['update:matches', 'insert:transactions', 'insert:activity_events', 'insert:reminders'])
    expect(h.ecritures[0]!.filtres).toEqual(['id in m-b,m-a'])
    expect(h.ecritures[1]!.valeurs).toMatchObject({ contact_buyer_id: 'c-1', stage: 'new_lead', market_listing_id: 'ml-1' })
    expect(h.ecritures[2]!.valeurs).toMatchObject({
      action: 'dossier_envoye', entity_id: 'c-1',
      metadata: { match_ids: ['m-b', 'm-a'], deal_id: 'deal-neuf', nombre: 2, canal: 'reception' },
    })
    expect(h.ecritures[3]!.valeurs).toMatchObject({ type: 'follow_up_sent_property', match_id: 'm-a', transaction_id: 'deal-neuf' })
  })

  it('rattache le deal actif existant, sans le modifier pour une annonce du marché', async () => {
    h.lectures.transactions = [{ id: 'deal-actif', property_id: null }]
    await execEnvoyerSelection(CTX, JULIE, [{ matchId: 'm-a', score: 97, bien: annonce('ml-1', 'MG-MK-1') }])
    expect(seq()).toEqual(['update:matches', 'insert:activity_events', 'insert:reminders'])
    expect(h.ecritures[1]!.valeurs).toMatchObject({ metadata: { deal_id: 'deal-actif' } })
  })

  it('rien à envoyer, rien d’écrit', async () => {
    await execEnvoyerSelection(CTX, JULIE, [])
    expect(h.ecritures).toEqual([])
  })
})

describe('execSendDossier — le rattachement du deal, gardé à travers l’extraction', () => {
  it('rattache un bien en mandat au deal actif qui n’en porte pas', async () => {
    h.lectures.transactions = [{ id: 'deal-actif', property_id: null }]
    await execSendDossier(CTX, ACHETEUR, {
      kind: 'property', id: 'p1', key: 'p:p1', ref: 'MG-IN-P1', title: 'Champel', price: 1_450_000, addr: 'Genève',
      rooms: 4.5, area: 118, type: 'apartment', gallery: [], sourceUrl: null, agency: { name: null, phone: null },
    }, 'reception')
    expect(seq()).toEqual(['update:matches', 'update:transactions', 'insert:activity_events', 'insert:reminders'])
    expect(h.ecritures[1]!.valeurs).toEqual({ property_id: 'p1' })
    expect(h.ecritures[2]!.valeurs).toMatchObject({ action: 'dossier_envoye', metadata: { deal_id: 'deal-actif' } })
  })

  it('crée un new_lead sur l’annonce du marché quand aucun deal n’est actif', async () => {
    await execSendDossier(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'), 'reception')
    expect(seq()).toEqual(['update:matches', 'insert:transactions', 'insert:activity_events', 'insert:reminders'])
    expect(h.ecritures[1]!.valeurs).toMatchObject({ stage: 'new_lead', market_listing_id: 'ml-1' })
  })
})
```

- [ ] **Step 2 : Lancer, constater l'échec**

Run : `npx vitest run tests/unit/matching-fil-gestes.spec.ts`
Expected : FAIL (`execEnvoyerSelection` n'existe pas).

- [ ] **Step 3 : Implémenter**

Dans `src/hooks/useAtelierMatching.ts` :

1. Juste AVANT `/** Bien de veille marché (market_listings) → AtelierListing`, ajouter :

```ts
/** Référence affichée d'une annonce du marché — la même dans l'atelier et dans le fil de matchs. */
export const refAnnonceMarche = (portail: string | null, sourceId: string | null, id: string): string =>
  `MG-${portail === 'flatfox' ? 'FL' : 'MK'}-${sourceId ?? id.slice(0, 6)}`

```

et dans `mapMarketListing`, remplacer ``    ref: `MG-${row.source_portal === 'flatfox' ? 'FL' : 'MK'}-${row.source_id ?? row.id.slice(0, 6)}`,`` par `    ref: refAnnonceMarche(row.source_portal, row.source_id, row.id),`.

2. Dans `execSendDossier`, remplacer le bloc qui va de `  // 2. Deal : rattacher au deal actif existant, sinon créer en new_lead` jusqu'à la fermeture du `else { … }` (juste avant `  // 3. Timeline contact`) par :

```ts
  // 2. Deal : rattacher au deal actif existant, sinon créer en new_lead
  const dealId = await rattacherDeal(ctx, buyer.id, listing)

```

3. Juste AVANT `/** « Envoyer le dossier » (E) — deal + timeline + nextAction + notification */`, ajouter :

```ts
/**
 * Le deal d'un acheteur à qui l'on propose un bien : l'actif le plus récent s'il existe — un bien en
 * mandat y est rattaché s'il n'en porte aucun, jamais écrasé —, sinon un `new_lead` créé sur ce bien.
 * Partagé par l'envoi d'un bien et l'envoi d'une sélection, pour qu'ils ne divergent pas.
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

```

4. Juste APRÈS la fin de `execSendDossier` (avant `/** « Relancer · autre canal » (R)`), ajouter :

```ts
/** Un bien d'une sélection du marché, tel que l'envoi le consigne. */
export interface EnvoiSelection { matchId: string; score: number; bien: BienGeste }

/**
 * « Envoyer N biens » — la sélection du marché d'un acheteur, transmise par UN lien de réception déjà
 * créé (`buyer-reception-create` a marqué les matchs envoyés ; on le repose, idempotent, pour ne pas
 * dépendre de ce détail de l'edge).
 *
 * ⛔ UN GESTE, UN SUIVI : un deal, UNE ligne de journal et UNE relance à +5 j pour la sélection entière.
 * Appeler `execSendDossier` N fois poserait N relances identiques pour le même acheteur dans
 * « Aujourd'hui ». Le deal et la relance portent le MEILLEUR bien de la sélection.
 */
export async function execEnvoyerSelection(
  ctx: GesteContext,
  acheteur: Pick<AtelierBuyer, 'id' | 'first' | 'last'>,
  envois: readonly EnvoiSelection[],
): Promise<SendResult> {
  if (envois.length === 0) return { dealId: null, emailSent: false }
  const ids = envois.map((e) => e.matchId)
  const { error: mErr } = await supabase
    .from('matches')
    .update({ status: 'sent', sent_via: 'reception', sent_at: new Date().toISOString() })
    .in('id', ids)
  if (mErr) throw mErr
  void markIntercomMilestone(INTERCOM_EVENTS.FIRST_MATCH_SENT)

  const meilleur = envois.reduce((a, b) => (b.score > a.score ? b : a))
  const dealId = await rattacherDeal(ctx, acheteur.id, meilleur.bien)
  const n = envois.length

  await logEvent(ctx, {
    action: 'dossier_envoye',
    contactId: acheteur.id,
    label: `${acheteur.first} ${acheteur.last} · ${n} bien${n > 1 ? 's' : ''}`,
    metadata: { match_ids: ids, deal_id: dealId, bien_refs: envois.map((e) => e.bien.ref), canal: 'reception', nombre: n },
  })

  await supabase.from('reminders').insert({
    agency_id: ctx.agencyId,
    contact_id: acheteur.id,
    property_id: null,
    transaction_id: dealId,
    match_id: meilleur.matchId,
    type: 'follow_up_sent_property',
    trigger_rule: 'manual',
    trigger_days: 5,
    trigger_at: inDays(5),
    status: 'pending',
    channel: 'task',
    message_template: `Sans réponse à la sélection de ${n} bien${n > 1 ? 's' : ''} — relancer ${acheteur.first} ${acheteur.last}`,
  })

  return { dealId, emailSent: false }
}

```

5. Dans l'en-tête du fichier, après la ligne `//   wake         → snoozed_until=null + reminder annulé (immédiat, hors queue)`, ajouter :

```ts
//   envoyerSelection → N matchs 'sent' + UN deal, UN 'dossier_envoye', UNE relance +5 j (fil, lot 2)
```

- [ ] **Step 4 : Lancer**

Run : `npx vitest run tests/unit/matching-fil-gestes.spec.ts`
Expected : PASS, 7 tests.

Run : `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "useAtelierMatching" ; echo fin`
Expected : `fin`.

- [ ] **Step 5 : Point de commit (au signal)**

```bash
git add src/hooks/useAtelierMatching.ts tests/unit/matching-fil-gestes.spec.ts
git commit -m "feat(matching): l'envoi d'une sélection, un deal, une relance, une ligne de journal"
```

---

### Task 3 : La RPC de résumé

**Files :**
- Create : `supabase/migrations/20260921120000_matching_fil_marche.sql`
- Modify : `src/types/database.ts`

- [ ] **Step 1 : Écrire la migration**

Créer `supabase/migrations/20260921120000_matching_fil_marche.sql` :

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Le fil de matchs, lot 2 : une ligne « Marché » par acheteur (17.09.2026)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Conception : docs/superpowers/specs/2026-09-17-matching-fil-design.md, §3.2 et §8.
--
-- POURQUOI UNE RPC. Mesuré en production le 17.09.2026 : 1 612 matchs à traiter sur des annonces du
-- marché pour 4 acheteurs (40, 133, 406 et 1 033), contre 10 sur les biens en mandat. Le fil n'en
-- montre qu'UNE ligne par acheteur — leur nombre, le meilleur score et trois vignettes. Les biens
-- eux-mêmes ne descendent au navigateur qu'à l'ouverture d'une sélection, vingt à la fois.
--
-- ── Ce qu'une ligne compte ──
-- `suggested`, non reporté (`snoozed_until` nul ou échu), sur une annonce non `removed` : la purge
-- nocturne (`purge_stale_market_matches`) ne passe qu'une fois par nuit.
--
-- ── Vignettes ──
-- `photos_cf` (jsonb) porte des URL en chaîne OU des objets `{thumb, …}` (3 annonces sur 1 618 le
-- 17.09.2026) ; `photos` (text[]) sinon.
--
-- ── Sécurité et index ──
-- SECURITY INVOKER : la RLS de `matches` (par agence) s'applique. Le filtre explicite sur
-- `get_user_agency_id()` sert `idx_matches_agency_focus (agency_id, contact_id, score desc)
-- where status = 'suggested'`.
--
-- ⚠ DATE-GUARD (`deploy.yml`) : une migration n'est appliquée que si son horodatage est ≥ au jour UTC
-- de la fusion. Renommer ce fichier au jour de la fusion si elle a lieu après le 21.09.2026.

begin;

create or replace function public.matching_fil_marche()
returns table (
  contact_id uuid,
  nombre integer,
  meilleur_score integer,
  vignettes text[]
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  with retenus as (
    select m.contact_id,
           m.score,
           coalesce(
             case when jsonb_typeof(ml.photos_cf -> 0) = 'string' then ml.photos_cf ->> 0 end,
             ml.photos_cf -> 0 ->> 'thumb',
             ml.photos[1]
           ) as vignette,
           row_number() over (partition by m.contact_id order by m.score desc, m.created_at desc, m.id) as rang
      from public.matches m
      join public.market_listings ml on ml.id = m.market_listing_id
     where m.agency_id = public.get_user_agency_id()
       and m.status = 'suggested'
       and m.market_listing_id is not null
       and (m.snoozed_until is null or m.snoozed_until <= now())
       and ml.status is distinct from 'removed'
  )
  select r.contact_id,
         count(*)::integer,
         max(r.score)::integer,
         coalesce(array_agg(r.vignette order by r.rang) filter (where r.rang <= 3 and r.vignette is not null), '{}'::text[])
    from retenus r
   group by r.contact_id
   order by max(r.score) desc, count(*) desc;
$$;

comment on function public.matching_fil_marche() is
  'Fil de matchs (lot 2) : une ligne « Marché » par acheteur — nombre de matchs du marché à traiter, meilleur score, trois vignettes.';

revoke all on function public.matching_fil_marche() from public, anon;
grant execute on function public.matching_fil_marche() to authenticated;

commit;
```

- [ ] **Step 2 : Déclarer le type**

Dans `src/types/database.ts`, section `Functions`, juste AVANT la ligne `      megga_agency_slug: { Args: { p_name: string }; Returns: string }`, ajouter :

```ts
      matching_fil_marche: {
        Args: never
        Returns: {
          contact_id: string
          meilleur_score: number
          nombre: number
          vignettes: string[]
        }[]
      }
```

- [ ] **Step 3 : Vérifier**

Run : `npm run lint:migrations && npm run lint:types-freshness`
Expected : les deux sortent en 0.

(Le corps SQL a été éprouvé en lecture seule sur la production le 17.09.2026, agence substituée à `get_user_agency_id()` : 4 lignes, 3 vignettes chacune.)

- [ ] **Step 4 : Point de commit (au signal)**

```bash
git add supabase/migrations/20260921120000_matching_fil_marche.sql src/types/database.ts
git commit -m "feat(db): matching_fil_marche, une ligne « Marché » par acheteur"
```

---

### Task 4 : Les données — résumés et sélection

**Files :**
- Modify : `src/hooks/useMatchingFil.ts`
- Create : `src/hooks/useSelectionMarche.ts`

- [ ] **Step 1 : Étendre `useMatchingFil.ts`**

1. Remplacer la première ligne de l'en-tête `/**\n * Données du fil de matchs (lot 1 : « À traiter » sur les biens de l'agence).` par :

```ts
/**
 * Données du fil de matchs : « À traiter » sur les biens de l'agence (lot 1), et une ligne « Marché »
 * par acheteur, résumée côté serveur par `matching_fil_marche()` (lot 2).
```

2. Remplacer l'import de `@/components/matching-fil/filModele` par :

```ts
import {
  compterHistorique, type FilBien, type FilMatch, type FilSelectionResume, type Historique, type RaisonsMoteur,
} from '@/components/matching-fil/filModele'
```

3. Remplacer `interface LigneContact {` par `export interface LigneContact {`.

4. Remplacer `interface DonneesFil { matchs: FilMatch[]; historique: Map<string, Historique>; chargeLe: number }` et les deux lignes qui suivent (`const CLE = …`, `const VIDE = …`) par :

```ts
interface DonneesFil {
  matchs: FilMatch[]
  selections: FilSelectionResume[]
  historique: Map<string, Historique>
  chargeLe: number
}

/** Préfixe des clés de requête du fil : l'invalider rafraîchit aussi les sélections ouvertes. */
export const CLE_FIL = 'matching-fil'
const VIDE: DonneesFil = { matchs: [], selections: [], historique: new Map(), chargeLe: 0 }
```

puis remplacer les deux occurrences de `[CLE, agencyId]` et `[CLE]` par `[CLE_FIL, agencyId]` et `[CLE_FIL]`.

5. Exporter les trois helpers partagés : remplacer `async function lire<T>(` par `export async function lire<T>(`, `const nombre = (v: number | string | null): number | null => {` par `export const nombreOuNull = (v: number | string | null): number | null => {`, et `function equipements(brut: unknown): string[] {` par `export function listeEquipements(brut: unknown): string[] {` ; dans `versBien`, remplacer chaque `nombre(` par `nombreOuNull(` et `equipements(b.features)` par `listeEquipements(b.features)`.

6. Ajouter juste APRÈS la fonction `versBien` :

```ts

/** Un contact lu, dans la forme du fil. */
export function versAcheteur(c: LigneContact, kyc: KycDossierStatus | null | undefined): FilMatch['acheteur'] {
  return {
    id: c.id, prenom: c.first_name, nom: c.last_name, telephone: c.phone, email: c.email,
    kyc: mapKycStatus(kyc ?? undefined),
  }
}
```

7. Remplacer INTÉGRALEMENT la fonction `chargerFil` par :

```ts
async function chargerFil(agencyId: string): Promise<DonneesFil> {
  const debut = Date.now()
  const [bruts, resumes] = await Promise.all([
    lire<LigneMatch>(
      supabase.from('matches')
        .select('id, contact_id, property_id, client_search_id, score, reasons, snoozed_until, created_at')
        .eq('agency_id', agencyId)
        .eq('status', 'suggested')
        .not('property_id', 'is', null)
        .order('score', { ascending: false }),
    ),
    lire<{ contact_id: string; nombre: number; meilleur_score: number; vignettes: string[] | null }>(supabase.rpc('matching_fil_marche')),
  ])
  const lignes = bruts.filter((m) => m.property_id != null)
  if (lignes.length === 0 && resumes.length === 0) return { matchs: [], selections: [], historique: new Map(), chargeLe: debut }
  const contactIds = [...new Set([...lignes.map((m) => m.contact_id), ...resumes.map((r) => r.contact_id)])]
  const bienIds = [...new Set(lignes.map((m) => m.property_id as string))]
  const rechercheIds = [...new Set(lignes.map((m) => m.client_search_id).filter((id): id is string => id != null))]

  const [contacts, recherches, biens, kyc, historique] = await Promise.all([
    lire<LigneContact>(supabase.from('contacts').select('id, first_name, last_name, email, phone, search_criteria').in('id', contactIds)),
    rechercheIds.length > 0
      ? lire<{ id: string; criteria: SearchCriteria | null }>(supabase.from('client_searches').select('id, criteria').in('id', rechercheIds))
      : Promise.resolve([]),
    bienIds.length > 0
      ? lire<LigneBien>(
        supabase.from('properties')
          .select('id, title, type, transaction_type, price, rooms, surface_m2, address, city, canton, features, photos')
          .in('id', bienIds),
      )
      : Promise.resolve([]),
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
      acheteur: versAcheteur(c, kycParContact.get(c.id)),
    })
  }

  const selections: FilSelectionResume[] = []
  for (const r of resumes) {
    const c = contactParId.get(r.contact_id)
    if (!c || r.nombre <= 0) continue
    selections.push({
      acheteur: versAcheteur(c, kycParContact.get(c.id)),
      nombre: r.nombre, meilleurScore: r.meilleur_score, vignettes: r.vignettes ?? [],
    })
  }
  return { matchs, selections, historique: compterHistorique(historique), chargeLe: debut }
}
```

8. Remplacer INTÉGRALEMENT la fonction `versGeste` par :

```ts
/** Ce que les exécuteurs de l'atelier lisent d'un match du fil : ils restent la source unique des écritures. */
export function versGeste(m: FilMatch): { acheteur: AcheteurGeste; bien: BienGeste } {
  const marche = m.bien.marche
  return {
    acheteur: { id: m.acheteur.id, matchId: m.id, first: m.acheteur.prenom, last: m.acheteur.nom, email: m.acheteur.email, score: m.score },
    bien: {
      kind: marche ? 'market' : 'property',
      id: m.bien.id,
      key: `${marche ? 'm' : 'p'}:${m.bien.id}`,
      ref: marche ? marche.ref : refBienInterne(m.bien.id),
      title: m.bien.titre,
      price: m.bien.prix ?? 0, addr: [m.bien.adresse, m.bien.ville].filter(Boolean).join(', '),
      rooms: m.bien.pieces, area: m.bien.surface, type: m.bien.type ?? '',
      gallery: m.bien.photo ? [{ url: m.bien.photo, room: 'Photos', label: 'Photo 01' }] : [],
      sourceUrl: marche ? marche.sourceUrl : null, agency: { name: null, phone: null },
    },
  }
}
```

- [ ] **Step 2 : Créer `useSelectionMarche.ts`**

```ts
/**
 * Les biens du MARCHÉ d'un acheteur, pour la sélection du fil de matchs (lot 2, conception §5 et §8).
 *
 * ⛔ CHARGÉS À L'OUVERTURE DE SA LIGNE, VINGT À LA FOIS — jamais les 1 612 matchs du marché au
 * navigateur (17.09.2026). Servis par `idx_matches_agency_focus (agency_id, contact_id, score desc)
 * where status = 'suggested'`. On lit `limite + 1` lignes : la dernière ne sert qu'à dire s'il en reste.
 *
 * ⚠ Mêmes règles que le résumé serveur (`matching_fil_marche`) : non reporté, annonce non `removed`.
 * Appliquées ici côté client aussi — le banc ne connaît ni `not`, ni `or`.
 *
 * ⚠ La vignette : `photos_cf` porte des URL en chaîne OU des objets `{thumb, …}`, sinon `photos`.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { refAnnonceMarche } from '@/hooks/useAtelierMatching'
import { CLE_FIL, lire, listeEquipements, nombreOuNull, versAcheteur, type LigneContact } from '@/hooks/useMatchingFil'
import type { SearchCriteria } from '@/types/contact'
import type { KycDossierStatus } from '@/types/kyc'
import type { FilBien, FilMatch, RaisonsMoteur } from '@/components/matching-fil/filModele'

/** Le pas de chargement d'une sélection (§5). */
export const PAS_SELECTION = 20

interface LigneMatchMarche {
  id: string; market_listing_id: string | null; client_search_id: string | null; score: number
  reasons: RaisonsMoteur | null; snoozed_until: string | null; created_at: string | null
}
interface LigneAnnonce {
  id: string; title: string | null; type: string | null; transaction_type: string | null
  price: number | string | null; current_price: number | string | null; rooms: number | string | null
  surface_m2: number | string | null; address: string | null; city: string | null; canton: string | null
  features: unknown; photos: string[] | null; photos_cf: unknown; status: string | null
  source_portal: string | null; source_id: string | null; source_url: string | null
}
interface DonneesSelection { matchs: FilMatch[]; aPlus: boolean; chargeLe: number }

const AUCUNE: DonneesSelection = { matchs: [], aPlus: false, chargeLe: 0 }

function photoAnnonce(cf: unknown, photos: string[] | null): string | null {
  const premier: unknown = Array.isArray(cf) ? cf[0] : undefined
  if (typeof premier === 'string' && premier) return premier
  if (premier && typeof premier === 'object') {
    const thumb = (premier as Record<string, unknown>).thumb
    if (typeof thumb === 'string' && thumb) return thumb
  }
  return photos?.find((p) => typeof p === 'string' && p !== '') ?? null
}

function versBienMarche(a: LigneAnnonce): FilBien {
  return {
    id: a.id, titre: a.title ?? '', prix: nombreOuNull(a.current_price) ?? nombreOuNull(a.price),
    location: a.transaction_type === 'rent', type: a.type, pieces: nombreOuNull(a.rooms), surface: nombreOuNull(a.surface_m2),
    ville: a.city, canton: a.canton, adresse: a.address, equipements: listeEquipements(a.features),
    photo: photoAnnonce(a.photos_cf, a.photos),
    marche: { ref: refAnnonceMarche(a.source_portal, a.source_id, a.id), sourceUrl: a.source_url },
  }
}

async function chargerSelection(agencyId: string, contactId: string, limite: number): Promise<DonneesSelection> {
  const debut = Date.now()
  const bruts = await lire<LigneMatchMarche>(
    supabase.from('matches')
      .select('id, market_listing_id, client_search_id, score, reasons, snoozed_until, created_at')
      .eq('agency_id', agencyId)
      .eq('contact_id', contactId)
      .eq('status', 'suggested')
      .not('market_listing_id', 'is', null)
      .order('score', { ascending: false })
      .range(0, limite),
  )
  const aPlus = bruts.length > limite
  const lignes = bruts.slice(0, limite).filter((m) =>
    m.market_listing_id != null && !(m.snoozed_until != null && Date.parse(m.snoozed_until) > debut))
  if (lignes.length === 0) return { matchs: [], aPlus, chargeLe: debut }
  const annonceIds = [...new Set(lignes.map((m) => m.market_listing_id as string))]
  const rechercheIds = [...new Set(lignes.map((m) => m.client_search_id).filter((id): id is string => id != null))]

  const [contacts, recherches, annonces, kyc] = await Promise.all([
    lire<LigneContact>(supabase.from('contacts').select('id, first_name, last_name, email, phone, search_criteria').in('id', [contactId])),
    rechercheIds.length > 0
      ? lire<{ id: string; criteria: SearchCriteria | null }>(supabase.from('client_searches').select('id, criteria').in('id', rechercheIds))
      : Promise.resolve([]),
    lire<LigneAnnonce>(
      supabase.from('market_listings')
        .select('id, title, type, transaction_type, price, current_price, rooms, surface_m2, address, city, canton, features, photos, photos_cf, status, source_portal, source_id, source_url')
        .in('id', annonceIds),
    ),
    lire<{ contact_id: string; dossier_status: KycDossierStatus | null }>(
      supabase.from('kyc_cases').select('contact_id, dossier_status')
        .in('contact_id', [contactId]).in('type', ['buyer_pp', 'buyer_pm']).order('created_at', { ascending: false }),
    ),
  ])

  const c = contacts.find((x) => x.id === contactId)
  if (!c) return { matchs: [], aPlus: false, chargeLe: debut }
  const acheteur = versAcheteur(c, kyc.find((k) => k.contact_id === contactId)?.dossier_status)
  const criteresParRecherche = new Map(recherches.map((r) => [r.id, r.criteria]))
  const annonceParId = new Map(annonces.map((a) => [a.id, a]))

  const matchs: FilMatch[] = []
  for (const m of lignes) {
    const a = annonceParId.get(m.market_listing_id as string)
    if (!a || a.status === 'removed') continue
    matchs.push({
      id: m.id, score: m.score, raisons: m.reasons, creeLe: m.created_at, reporteJusquau: m.snoozed_until,
      bien: versBienMarche(a),
      criteres: (m.client_search_id ? criteresParRecherche.get(m.client_search_id) : null) ?? c.search_criteria,
      acheteur,
    })
  }
  return { matchs, aPlus, chargeLe: debut }
}

/** Les biens du marché d'un acheteur, `limite` à la fois ; `null` : aucune sélection ouverte. */
export function useSelectionMarche(contactId: string | null, limite: number) {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const requete = useQuery({
    queryKey: [CLE_FIL, 'selection', agencyId, contactId, limite],
    queryFn: () => chargerSelection(agencyId as string, contactId as string, limite),
    enabled: agencyId != null && contactId != null,
    // « Voir 20 de plus » garde les vingt premiers à l'écran pendant que les suivants arrivent.
    placeholderData: keepPreviousData,
  })
  const donnees = requete.data ?? AUCUNE
  return {
    ...donnees,
    isLoading: contactId != null && (profile == null || requete.isLoading),
    isError: requete.isError && requete.data === undefined,
  }
}
```

- [ ] **Step 3 : Vérifier**

Run : `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "useMatchingFil|useSelectionMarche|MatchingFil" ; echo fin`
Expected : des erreurs possibles dans `MatchingFil.tsx` seulement (il ne lit pas encore `selections`) — AUCUNE dans les deux hooks. Elles disparaissent à la Task 10.

- [ ] **Step 4 : Point de commit (au signal)** — avec la Task 10.

---

### Task 5 : Les traductions du lot 2

**Files :** Modify `src/i18n/locales/{fr,de,en,it}/matching.json`

- [ ] **Step 1 : Ajouter les clés**

```bash
python3 - <<'EOF'
import json
AJOUTS = {
  'fr': {
    'marche': 'Marché · une sélection par acheteur', 'marcheAria': 'Sélections du marché',
    'ecarteSelection': '« {{titre}} » écarté pour {{prenom}}',
    'selection': {
      'ligne_one': '{{count}} bien pas encore proposé', 'ligne_other': '{{count}} biens pas encore proposés',
      'titreAria': 'Sélection du marché pour {{nom}}', 'recherche': 'Recherche : {{resume}}',
      'inclure': 'Inclure « {{titre}} »', 'ecarts': 'À vérifier : {{liste}}', 'pieces': '{{valeur}} pièces',
      'voirPlus': 'Voir 20 de plus',
      'envoyer_one': 'Envoyer {{count}} bien à {{prenom}}', 'envoyer_other': 'Envoyer {{count}} biens à {{prenom}}',
      'aucunCoche': 'Cochez au moins un bien.', 'vide': 'Aucun bien du marché à proposer.',
      'erreur': "La sélection n'a pas pu être chargée.",
    },
    'envoi': {
      'biens_one': '{{count}} bien', 'biens_other': '{{count}} biens',
      'texteSelection': "Un lien privé. {{prenom}} voit les biens et vous dit lesquels l'intéressent. Ses réponses sont enregistrées dans sa fiche.",
      'waMessageSelection': 'Bonjour {{prenom}}, voici {{count}} biens qui pourraient vous intéresser : {{url}}',
      'faitSelection_one': '{{count}} bien proposé à {{prenom}}', 'faitSelection_other': '{{count}} biens proposés à {{prenom}}',
    },
  },
  'de': {
    'marche': 'Markt · eine Auswahl pro Käufer', 'marcheAria': 'Markt-Auswahlen',
    'ecarteSelection': '„{{titre}}“ für {{prenom}} verworfen',
    'selection': {
      'ligne_one': '{{count}} Objekt noch nicht vorgeschlagen', 'ligne_other': '{{count}} Objekte noch nicht vorgeschlagen',
      'titreAria': 'Markt-Auswahl für {{nom}}', 'recherche': 'Suche: {{resume}}',
      'inclure': '„{{titre}}“ einbeziehen', 'ecarts': 'Zu prüfen: {{liste}}', 'pieces': '{{valeur}} Zimmer',
      'voirPlus': '20 weitere anzeigen',
      'envoyer_one': '{{count}} Objekt an {{prenom}} senden', 'envoyer_other': '{{count}} Objekte an {{prenom}} senden',
      'aucunCoche': 'Wählen Sie mindestens ein Objekt aus.', 'vide': 'Keine Marktobjekte vorzuschlagen.',
      'erreur': 'Die Auswahl konnte nicht geladen werden.',
    },
    'envoi': {
      'biens_one': '{{count}} Objekt', 'biens_other': '{{count}} Objekte',
      'texteSelection': 'Ein privater Link. {{prenom}} sieht die Objekte und sagt Ihnen, welche passen. Die Antworten werden im Kontakt gespeichert.',
      'waMessageSelection': 'Guten Tag {{prenom}}, hier sind {{count}} Objekte, die Sie interessieren könnten: {{url}}',
      'faitSelection_one': '{{count}} Objekt an {{prenom}} gesendet', 'faitSelection_other': '{{count}} Objekte an {{prenom}} gesendet',
    },
  },
  'en': {
    'marche': 'Market · one selection per buyer', 'marcheAria': 'Market selections',
    'ecarteSelection': '“{{titre}}” dismissed for {{prenom}}',
    'selection': {
      'ligne_one': '{{count}} property not yet proposed', 'ligne_other': '{{count}} properties not yet proposed',
      'titreAria': 'Market selection for {{nom}}', 'recherche': 'Search: {{resume}}',
      'inclure': 'Include “{{titre}}”', 'ecarts': 'To check: {{liste}}', 'pieces': '{{valeur}} rooms',
      'voirPlus': 'Show 20 more',
      'envoyer_one': 'Send {{count}} property to {{prenom}}', 'envoyer_other': 'Send {{count}} properties to {{prenom}}',
      'aucunCoche': 'Tick at least one property.', 'vide': 'No market properties to propose.',
      'erreur': "The selection couldn't be loaded.",
    },
    'envoi': {
      'biens_one': '{{count}} property', 'biens_other': '{{count}} properties',
      'texteSelection': 'A private link. {{prenom}} sees the properties and tells you which ones are of interest. The answers are saved to their record.',
      'waMessageSelection': 'Hello {{prenom}}, here are {{count}} properties you may like: {{url}}',
      'faitSelection_one': '{{count}} property proposed to {{prenom}}', 'faitSelection_other': '{{count}} properties proposed to {{prenom}}',
    },
  },
  'it': {
    'marche': 'Mercato · una selezione per acquirente', 'marcheAria': 'Selezioni del mercato',
    'ecarteSelection': '«{{titre}}» scartato per {{prenom}}',
    'selection': {
      'ligne_one': '{{count}} immobile non ancora proposto', 'ligne_other': '{{count}} immobili non ancora proposti',
      'titreAria': 'Selezione del mercato per {{nom}}', 'recherche': 'Ricerca: {{resume}}',
      'inclure': 'Includi «{{titre}}»', 'ecarts': 'Da verificare: {{liste}}', 'pieces': '{{valeur}} locali',
      'voirPlus': 'Mostra altri 20',
      'envoyer_one': 'Invia {{count}} immobile a {{prenom}}', 'envoyer_other': 'Invia {{count}} immobili a {{prenom}}',
      'aucunCoche': 'Selezioni almeno un immobile.', 'vide': 'Nessun immobile del mercato da proporre.',
      'erreur': 'Non è stato possibile caricare la selezione.',
    },
    'envoi': {
      'biens_one': '{{count}} immobile', 'biens_other': '{{count}} immobili',
      'texteSelection': 'Un link privato. {{prenom}} vede gli immobili e Le dice quali gli interessano. Le risposte vengono registrate nella sua scheda.',
      'waMessageSelection': 'Buongiorno {{prenom}}, ecco {{count}} immobili che potrebbero interessarLe: {{url}}',
      'faitSelection_one': '{{count}} immobile proposto a {{prenom}}', 'faitSelection_other': '{{count}} immobili proposti a {{prenom}}',
    },
  },
}
for langue, ajout in AJOUTS.items():
    chemin = f'src/i18n/locales/{langue}/matching.json'
    brut = open(chemin, encoding='utf-8').read()
    d = json.loads(brut)
    assert json.dumps(d, ensure_ascii=False, indent=2) + '\n' == brut, f'{chemin} : mise en forme inattendue'
    fil = d['fil']
    for cle in ('marche', 'marcheAria', 'ecarteSelection', 'selection'):
        assert cle not in fil, f'{chemin} : fil.{cle} existe déjà'
    for cle in ajout['envoi']:
        assert cle not in fil['envoi'], f'{chemin} : fil.envoi.{cle} existe déjà'
    fil['marche'] = ajout['marche']; fil['marcheAria'] = ajout['marcheAria']
    fil['ecarteSelection'] = ajout['ecarteSelection']; fil['selection'] = ajout['selection']
    fil['envoi'].update(ajout['envoi'])
    open(chemin, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
    print(chemin, 'ok')
EOF
```

- [ ] **Step 2 : Vérifier**

Run : `npm run i18n:parity:ci && npm run lint:prose`
Expected : 0 manquante, 0 orpheline ; typographie OK.

- [ ] **Step 3 : Point de commit (au signal)** — avec la Task 10.

---

### Task 6 : Valeurs partagées, marge, vignettes

**Files :**
- Create : `src/components/matching-fil/filValeurs.ts`
- Modify : `src/components/matching-fil/FilPanneau.tsx`, `filAffichage.ts`, `filAtomes.tsx`

- [ ] **Step 1 : Créer `filValeurs.ts`** (la fonction `valeurs` du panneau, déplacée telle quelle et exportée, plus le résumé d'une recherche)

```ts
/**
 * « Recherché » et « Ce bien », écrits dans la langue de l'agent — partagés par le panneau d'un bien en
 * mandat (la grille) et la sélection du marché (le résumé d'une recherche en une ligne).
 */
import type { TFunction } from 'i18next'
import { formatCHF } from '@/lib/utils'
import { cleEquipement, lignesCriteres, type FilMatch, type LigneCritere } from './filModele'

/** Les deux cellules d'une ligne de critère : ce que l'acheteur cherche, ce que le bien offre. */
export function valeursCritere(l: LigneCritere, t: TFunction, nombre: (n: number) => string): [string, string] {
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

/** La recherche d'un acheteur en une ligne (§5) : les valeurs « Recherché » de ses critères, dans l'ordre. */
export function resumeRecherche(m: FilMatch, t: TFunction, nombre: (n: number) => string): string {
  return lignesCriteres(m).map((l) => valeursCritere(l, t, nombre)[0]).join(' · ')
}
```

- [ ] **Step 2 : Brancher le panneau**

Dans `src/components/matching-fil/FilPanneau.tsx` :
- supprimer INTÉGRALEMENT la fonction locale `function valeurs(...)` et son commentaire `/** « Recherché » et « Ce bien »… */` ;
- remplacer les appels `valeurs(l, t, nombre)` par `valeursCritere(l, t, nombre)` ;
- ajouter `import { valeursCritere } from './filValeurs'` ;
- retirer de ses imports ce qui n'est plus lu (`formatCHF`, `cleEquipement`) ;
- remplacer la constante locale `const MARGE_POINTS = 'calc(var(--crm-space-7xl) + var(--crm-space-lg))'` (et son docblock) par l'import `MARGE_POINTS` depuis `./filAffichage`.

- [ ] **Step 3 : Partager la marge**

À la fin de `src/components/matching-fil/filAffichage.ts`, ajouter :

```ts

/**
 * Marge droite des panneaux du fil : les points de page du pager (`MatchingPage`) flottent au bord
 * droit, et recouvraient le grand score et le bouton principal.
 */
export const MARGE_POINTS = 'calc(var(--crm-space-7xl) + var(--crm-space-lg))'
```

- [ ] **Step 4 : Vignettes des portails**

Dans `src/components/matching-fil/filAtomes.tsx`, sur l'`<img>` de `FilVignette`, ajouter `referrerPolicy="no-referrer"`, et dans son docblock la phrase : « `no-referrer` : Flatfox refuse les images demandées depuis un autre site (même règle que `MrhPhoto`). »

- [ ] **Step 5 : Vérifier**

Run : `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "FilPanneau|filValeurs|filAffichage|filAtomes" ; echo fin`
Expected : `fin`.

- [ ] **Step 6 : Point de commit (au signal)** — avec la Task 10.

---

### Task 7 : La section « Marché » de la liste

**Files :** Modify `src/components/matching-fil/FilListe.tsx`

- [ ] **Step 1 : Étendre la liste**

1. Remplacer l'en-tête du fichier :

```ts
/**
 * La liste du fil (§3.2) : « Vos biens », un groupe par bien et ses acheteurs dessous, puis les
 * reportés, repliés.
```

par :

```ts
/**
 * La liste du fil (§3.2) : « Vos biens », un groupe par bien et ses acheteurs dessous ; puis
 * « Marché », une ligne par acheteur (lot 2) ; puis les reportés, repliés.
```

2. Remplacer la ligne d'import de `./filModele` par :

```ts
import {
  cleSelection, initiales, lignesCriteres, palierScore, premierEcart,
  type FilBien, type FilMatch, type FilSelectionResume, type FilVue,
} from './filModele'
```

3. Dans `interface Props`, après `  vue: FilVue`, ajouter `  selections: FilSelectionResume[]`, et dans la signature du composant remplacer `{ sp, vue, courant, onChoisir, onReactiver }` par `{ sp, vue, selections, courant, onChoisir, onReactiver }`.

4. Juste AVANT la ligne `      {vue.reportes.length > 0 && prochainRetour && (`, ajouter :

```tsx
      {selections.length > 0 && (
        <>
          <p style={{ margin: 0, padding: 'var(--crm-space-sm) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
            {t('fil.marche')}
          </p>
          <div role="listbox" aria-label={t('fil.marcheAria')} style={{ marginBottom: 'var(--crm-space-md)' }}>
            {selections.map((s) => (
              <LigneSelection key={s.acheteur.id} sp={sp} s={s} active={cleSelection(s.acheteur.id) === courant} onChoisir={onChoisir} />
            ))}
          </div>
        </>
      )}
```

5. Remplacer, dans `Ligne`, l'objet `style={{ … }}` du `<button>` par `style={styleLigne(sp, active)}`, et ajouter AVANT `function EnTeteBien` :

```tsx
/** Une ligne du fil — match ou sélection — choisie ou non. */
function styleLigne(sp: CrmPalette, active: boolean): CSSProperties {
  return {
    width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', textAlign: 'left',
    padding: 'var(--crm-space-sm) var(--crm-space-lg)', border: 0, borderRadius: 'var(--crm-radius-md)',
    cursor: 'pointer', fontFamily: 'inherit', color: sp.ink,
    background: active ? sp.focusSurface : 'transparent',
    // L'élément ACTIF porte l'accent (CLAUDE.md §3), en filet : sur sombre l'accent brut tombe sous 3:1.
    boxShadow: active ? `inset 0 0 0 1px ${encreAccent(sp)}` : 'none',
  }
}

/** La ligne « Marché » d'un acheteur : ses meilleures vignettes, combien de biens attendent, le meilleur score. */
function LigneSelection({ sp, s, active, onChoisir }: { sp: CrmPalette; s: FilSelectionResume; active: boolean; onChoisir: (id: string) => void }) {
  const { t } = useTranslation('matching')
  const cle = cleSelection(s.acheteur.id)
  const vignettes: (string | null)[] = s.vignettes.length > 0 ? s.vignettes.slice(0, 3) : [null]
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={cle}
      className="fil-ligne" onClick={ignorerDoubleClic(onChoisir)(cle)} onFocus={() => onChoisir(cle)} style={styleLigne(sp, active)}>
      <span aria-hidden style={{ display: 'inline-flex', flex: 'none' }}>
        {vignettes.map((url, i) => (
          <span key={`${i}-${url ?? 'vide'}`} style={{
            display: 'inline-flex', marginLeft: i === 0 ? 0 : 'calc(var(--crm-space-md) * -1)',
            borderRadius: 'var(--crm-radius-xs)', boxShadow: `0 0 0 2px ${sp.frameBg}`,
          }}>
            <FilVignette sp={sp} photo={url} largeur={28} hauteur={28} />
          </span>
        ))}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {s.acheteur.prenom} {s.acheteur.nom}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{t('fil.selection.ligne', { count: s.nombre })}</span>
      </span>
      <FilScore sp={sp} score={s.meilleurScore} palier={palierScore(s.meilleurScore)} />
    </button>
  )
}

```

6. Remplacer `import { useState, type MouseEvent } from 'react'` par `import { useState, type CSSProperties, type MouseEvent } from 'react'`.

- [ ] **Step 2 : Point de commit (au signal)** — avec la Task 10.

---

### Task 8 : Le panneau de sélection

**Files :** Create `src/components/matching-fil/FilSelection.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
/**
 * La sélection du MARCHÉ d'un acheteur (lot 2, conception §5) : ses biens du marché pas encore
 * proposés, du meilleur au moins bon, cochables, et UN envoi pour tous.
 *
 * ⚠ Les biens qui tiennent CHAQUE critère posé sont cochés d'office (5 au plus, `precoches`, calculé
 * par `MatchingFil`) ; le reste se coche à la main. Décocher n'écrit rien. « Écarter » écrit (le couple
 * n'est plus proposé) et passe par la même fenêtre d'annulation que dans le panneau d'un bien.
 *
 * ⚠ Seuls les ÉCARTS s'affichent, pas la grille complète : sur vingt biens, c'est ce qui les distingue.
 */
import { useId, type CSSProperties, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { initiales, lignesCriteres, palierScore, type FilMatch, type FilSelectionResume } from './filModele'
import { encreAccent, MARGE_POINTS, prixBien, teinteEcart, teinteTenu } from './filAffichage'
import { FilAvatar, FilScore, FilVignette } from './filAtomes'
import { resumeRecherche } from './filValeurs'

interface Props {
  sp: CrmPalette
  resume: FilSelectionResume
  matchs: FilMatch[]
  coches: readonly string[]
  aPlus: boolean
  isLoading: boolean
  isError: boolean
  onCocher: (id: string, coche: boolean) => void
  onEcarter: (m: FilMatch) => void
  onVoirPlus: () => void
  onEnvoyer: () => void
  onVoirContact: () => void
}

/** Le second clic d'un double clic tombe sur ce que le premier a déplacé : ignoré (`detail` 2). */
const unSeulClic = (faire: () => void) => (e: MouseEvent) => { if (e.detail > 1) return; faire() }

export default function FilSelection({
  sp, resume, matchs, coches, aPlus, isLoading, isError, onCocher, onEcarter, onVoirPlus, onEnvoyer, onVoirContact,
}: Props) {
  const { t, i18n } = useTranslation('matching')
  const nombre = (n: number): string => n.toLocaleString(i18n.language)
  const raisonId = useId()
  const { acheteur } = resume
  const reference = matchs[0]
  const aucun = coches.length === 0
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontWeight: 600,
  }
  return (
    <section aria-label={t('fil.selection.titreAria', { nom: `${acheteur.prenom} ${acheteur.nom}` })}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)',
        padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
          <div style={{ minWidth: 0 }}>
            <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-3xl)', color: sp.ink }}>
              {acheteur.prenom} {acheteur.nom}
            </button>
            <div style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
              {t('fil.marche')} · {t('fil.selection.ligne', { count: resume.nombre })}
            </div>
          </div>
        </div>

        {reference && lignesCriteres(reference).length > 0 && (
          <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
            {t('fil.selection.recherche', { resume: resumeRecherche(reference, t, nombre) })}
          </p>
        )}

        {isLoading ? (
          <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
            <span className="sr-only">{t('fil.chargement')}</span>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 68, borderRadius: 'var(--crm-radius-lg)', background: sp.cardSubBg }} />)}
          </div>
        ) : isError ? (
          <p role="alert" style={{ margin: 0, fontSize: 'var(--crm-text-md)', color: sp.ink }}>{t('fil.selection.erreur')}</p>
        ) : matchs.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', color: sp.sub }}>{t('fil.selection.vide')}</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
            {matchs.map((m) => (
              <Bien key={m.id} sp={sp} m={m} coche={coches.includes(m.id)} nombre={nombre} onCocher={onCocher} onEcarter={onEcarter} />
            ))}
          </ul>
        )}

        {aPlus && !isLoading && (
          <button type="button" onClick={onVoirPlus} style={{ ...lien, alignSelf: 'flex-start', fontSize: 'var(--crm-text-sm)', color: encreAccent(sp) }}>
            {t('fil.selection.voirPlus')}
          </button>
        )}
      </div>

      <div style={{
        position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
        padding: `var(--crm-space-2xl) ${MARGE_POINTS} var(--crm-space-2xl) var(--crm-space-6xl)`,
        background: sp.frameBg, borderTop: `1px solid ${sp.cardBorder}`,
      }}>
        {aucun && <span id={raisonId} style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{t('fil.selection.aucunCoche')}</span>}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={unSeulClic(onEnvoyer)} disabled={aucun}
          aria-describedby={aucun ? raisonId : undefined} aria-keyshortcuts="E" title={t('fil.actions.raccourci', { touche: 'E' })}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40,
            paddingLeft: 'var(--crm-space-2xl)', paddingRight: 'var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
            border: 0, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
            background: sp.accent, color: sp.accentInk, opacity: aucun ? 0.5 : 1, cursor: aucun ? 'not-allowed' : 'pointer',
          }}>
          {t('fil.selection.envoyer', { count: coches.length, prenom: acheteur.prenom })}
        </button>
      </div>
    </section>
  )
}

function Bien({ sp, m, coche, nombre, onCocher, onEcarter }: {
  sp: CrmPalette; m: FilMatch; coche: boolean; nombre: (n: number) => string
  onCocher: (id: string, coche: boolean) => void; onEcarter: (m: FilMatch) => void
}) {
  const { t } = useTranslation('matching')
  const lignes = lignesCriteres(m)
  const ecarts = lignes.filter((l) => l.ok === false).map((l) => t(`fil.criteres.${l.cle}`))
  const tenus = lignes.length > 0 && lignes.every((l) => l.ok === true)
  const details = [
    prixBien(m.bien, t),
    m.bien.pieces != null ? t('fil.selection.pieces', { valeur: nombre(m.bien.pieces) }) : null,
    m.bien.surface != null ? t('fil.valeurs.m2', { valeur: nombre(m.bien.surface) }) : null,
  ].filter(Boolean).join(' · ')
  const resume = lignes.length === 0 ? t('fil.sansCriteres')
    : ecarts.length > 0 ? t('fil.selection.ecarts', { liste: ecarts.join(', ') })
      : tenus ? t('fil.sansEcart') : t('fil.nonEvalues')
  return (
    <li style={{
      display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md)',
      borderRadius: 'var(--crm-radius-lg)', background: sp.cardBg,
      // L'élément choisi porte l'accent (CLAUDE.md §3).
      border: `1px solid ${coche ? encreAccent(sp) : sp.cardBorder}`,
    }}>
      <label style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', cursor: 'pointer' }}>
        <input type="checkbox" checked={coche} onChange={(e) => onCocher(m.id, e.target.checked)}
          aria-label={t('fil.selection.inclure', { titre: m.bien.titre })}
          style={{ width: 16, height: 16, flex: 'none', margin: 0, accentColor: encreAccent(sp), cursor: 'pointer' }} />
        <FilVignette sp={sp} photo={m.bien.photo} largeur={56} hauteur={42} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {m.bien.titre}
          </span>
          <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{details}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
            {(ecarts.length > 0 || tenus) && (
              <span aria-hidden style={{ display: 'inline-flex', flex: 'none' }}>
                <MEIcon name={ecarts.length > 0 ? 'alert' : 'check'} size={12} color={ecarts.length > 0 ? teinteEcart(sp) : teinteTenu(sp)} />
              </span>
            )}
            {resume}
          </span>
        </span>
      </label>
      <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
      <button type="button" onClick={unSeulClic(() => onEcarter(m))} style={{
        border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)',
        fontWeight: 600, color: sp.sub, padding: 'var(--crm-space-xs) var(--crm-space-sm)',
      }}>
        {t('fil.actions.ecarter')}
      </button>
    </li>
  )
}
```

- [ ] **Step 2 : Point de commit (au signal)** — avec la Task 10.

---

### Task 9 : La feuille d'envoi, pour un ou plusieurs biens

**Files :** Modify `src/components/matching-fil/FilFeuilleEnvoi.tsx`

- [ ] **Step 1 : Généraliser**

1. Dans l'en-tête du fichier, remplacer la première ligne ` * La feuille d'envoi du fil (§6.1-6.2) : un lien privé, par WhatsApp ou copié.` par :

```ts
 * La feuille d'envoi du fil (§6.1-6.2) : un lien privé, par WhatsApp ou copié — pour un bien en mandat
 * ou pour la sélection du marché d'un acheteur (plusieurs biens dans UN lien, lot 2).
```

2. Remplacer :

```ts
interface Props {
  sp: CrmPalette
  m: FilMatch
```

par :

```ts
interface Props {
  sp: CrmPalette
  acheteur: FilMatch['acheteur']
  /** Un bien ou plusieurs ; tous du même acheteur. */
  matchs: readonly FilMatch[]
```

3. Remplacer `export default function FilFeuilleEnvoi({ sp, m, onFermer, onEnvoye }: Props) {` par `export default function FilFeuilleEnvoi({ sp, acheteur, matchs, onFermer, onEnvoye }: Props) {`, puis les deux lignes

```ts
  const { prenom } = m.acheteur
  const telephone = m.acheteur.telephone?.trim() ?? ''
```

par :

```ts
  const { prenom } = acheteur
  const telephone = acheteur.telephone?.trim() ?? ''
  const premier = matchs[0]
  const plusieurs = matchs.length > 1
```

4. Remplacer `url = (await creer.mutateAsync({ contactId: m.acheteur.id, matchIds: [m.id], channel: canal })).url` par `url = (await creer.mutateAsync({ contactId: acheteur.id, matchIds: matchs.map((x) => x.id), channel: canal })).url`.

5. Remplacer `wa = buildWaMeUrl(telephone, t('fil.envoi.waMessage', { prenom, url }))` par :

```ts
      wa = buildWaMeUrl(telephone, plusieurs
        ? t('fil.envoi.waMessageSelection', { prenom, url, count: matchs.length })
        : t('fil.envoi.waMessage', { prenom, url }))
```

6. Remplacer `<FilAvatar sp={sp} texte={initiales(prenom, m.acheteur.nom)} taille={40} />` par `<FilAvatar sp={sp} texte={initiales(prenom, acheteur.nom)} taille={40} />`, la ligne `<p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{m.bien.titre} · {prixBien(m.bien, t)}</p>` par :

```tsx
            <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
              {plusieurs || !premier ? t('fil.envoi.biens', { count: matchs.length }) : `${premier.bien.titre} · ${prixBien(premier.bien, t)}`}
            </p>
```

et `{t('fil.envoi.texte', { prenom })}` par `{t(plusieurs ? 'fil.envoi.texteSelection' : 'fil.envoi.texte', { prenom })}`.

- [ ] **Step 2 : Point de commit (au signal)** — avec la Task 10.

---

### Task 10 : L'intégration dans le fil

**Files :** Modify `src/components/matching-fil/MatchingFil.tsx`

- [ ] **Step 1 : Remplacer le fichier**

Remplacer INTÉGRALEMENT `src/components/matching-fil/MatchingFil.tsx` par :

```tsx
/**
 * Matching — le FIL DE MATCHS (refonte de la page 0 du pager, lots 1 et 2).
 *
 * Conception : `docs/superpowers/specs/2026-09-17-matching-fil-design.md`. Il remplacera l'atelier
 * (`MatchingAtelierPage`) à la fin du lot 3 ; d'ici là il ne vit que sur le banc `/dev/crm`.
 *
 * Ce conteneur porte les données (`useMatchingFil`, `useSelectionMarche`), les filtres, la sélection,
 * les gestes, et le CLAVIER du fil entier.
 *
 * ⚠ Le clavier est posé sur la RACINE du fil (`onKeyDown`), pas sur `window` : le fil est la page 0
 * d'un pager dont la page 1 reste montée, et plusieurs écrans d'onglet restent vivants. Un écouteur
 * global agirait depuis une page ou un onglet qu'on ne regarde pas ; celui-ci n'entend que ce qui a
 * le focus dedans. D'où, après chaque geste, le focus rendu à une ligne (ou à la racine).
 *
 * ⚠ Plus tard et Écarter passent par la fenêtre d'annulation (`PendingRegistry`). Proposer, jamais :
 * le lien créé marque déjà le match envoyé (§6.2).
 *
 * ⚠ Un match qu'un geste fait sortir est MASQUÉ localement (`masques`) jusqu'à ce que les données le
 * reflètent : la valeur est `null` tant que l'écriture n'a pas fini, puis l'heure où elle a fini. Une
 * lecture COMMENCÉE après cette heure fait foi — un reporté reparaît sous « Reportés », un match
 * encore à traiter reparaît à sa place. Sans cette levée, un reporté restait caché jusqu'au
 * rechargement.
 *
 * ⚠ Lot 2 : une ligne « Marché » par acheteur (`cleSelection`) suit les biens en mandat dans l'ordre de
 * lecture. Choisie, elle charge ses biens et montre la sélection à droite ; `E` y envoie les biens
 * cochés. `P` et `X` n'y font rien : ils visent UN match, et la ligne en porte plusieurs. Un « Écarter »
 * dans la sélection ne déplace pas la sélection du fil.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { crmPalette, type CrmPalette } from '@/components/crm/tokens'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useCrmTabsOptionnel, useTabScopedState } from '@/hooks/useCrmTabs'
import {
  execDismiss, execEnvoyerSelection, execSendDossier, execSnooze, execWake, type GesteContext,
} from '@/hooks/useAtelierMatching'
import { useMatchingFil, versGeste } from '@/hooks/useMatchingFil'
import { PAS_SELECTION, useSelectionMarche } from '@/hooks/useSelectionMarche'
import { PendingRegistry, UNDO_WINDOW_MS } from '@/components/matching-atelier/pendingTriage'
import {
  cleSelection, construireFil, construireSelections, contactDeSelection, optionsFiltres, precoches,
  type FilFiltres, type FilMatch,
} from './filModele'
import FilAnnulation from './FilAnnulation'
import FilEnTete from './FilEnTete'
import FilFeuilleEnvoi from './FilFeuilleEnvoi'
import FilListe from './FilListe'
import FilPanneau from './FilPanneau'
import FilSelection from './FilSelection'

const SANS_FILTRE: FilFiltres = { bienId: null, acheteurId: null, texte: '' }
const COLONNES = 'minmax(300px, 380px) minmax(0, 1fr)'
const nomComplet = (m: FilMatch): string => `${m.acheteur.prenom} ${m.acheteur.nom}`

/** Ce que la feuille d'envoi transmet : un bien en mandat, ou des biens cochés d'une sélection. */
interface Envoi { origine: 'mandat' | 'selection'; acheteur: FilMatch['acheteur']; matchs: FilMatch[] }

/** Un match masqué par un geste redevient visible quand une lecture COMMENCÉE après l'écriture le dit. */
function visibleSelon(masques: ReadonlyMap<string, number | null>, id: string, chargeLe: number): boolean {
  const fin = masques.get(id)
  // ⚠ `>=` et non `>` : `rafraichir` lance la lecture dans le même tour que la fin de l'écriture, donc
  // souvent dans la même milliseconde. Une lecture partie AVANT est annulée par cette invalidation.
  return fin === undefined || (fin !== null && chargeLe >= fin)
}

export default function MatchingFil({ dark, onOpenRecherche }: { dark: boolean; onOpenRecherche?: () => void }) {
  const { t } = useTranslation('matching')
  const sp = crmPalette(dark)
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const { user, profile } = useAuth()
  const { isLoading, isError, aDesDonnees, erreurLe, matchs, selections, historique, chargeLe, rafraichir } = useMatchingFil()

  // Les liens entrants de l'atelier gardent leur sens (§3.4) : `?contact=` filtre sur l'acheteur,
  // `?annonce=p:<uuid>` sur le bien. Lus une fois, à l'arrivée.
  const [filtresArrivee] = useState<FilFiltres | null>(() => {
    const annonce = params.get('annonce')
    const contact = params.get('contact')
    if (!annonce && !contact) return null
    return { bienId: annonce?.startsWith('p:') ? annonce.slice(2) : null, acheteurId: contact, texte: '' }
  })
  // Les filtres sont rangés dans l'ONGLET : ils survivent à un aller-retour entre onglets. La
  // sélection, elle, reste LOCALE (§2 des retours de revue) — la ranger dans l'onglet écrivait sur
  // le serveur à CHAQUE flèche du clavier, pour une position qui n'a jamais eu besoin de survivre.
  // Même règle pour les cases cochées et le pas de chargement d'une sélection du marché (lot 2).
  const [filtresRetenus, setFiltres] = useTabScopedState<FilFiltres>('fil.filtres', filtresArrivee ?? SANS_FILTRE)
  const [choix, setChoix] = useState<string | null>(null)
  // ⚠ Un lien d'arrivée l'emporte sur les filtres que l'onglet avait retenus — même règle et même
  // mécanique que le pivot du pager (`MatchingPage`) : lu au rendu, écrit dans un effet.
  const [pivotConsomme, setPivotConsomme] = useState(filtresArrivee == null)
  const filtres = pivotConsomme || !filtresArrivee ? filtresRetenus : filtresArrivee
  // ⛔ TANT QUE LA PILE D'ONGLETS CHARGE, ON N'ÉCRIT PAS. L'hydratation de `CrmTabsProvider` REMPLACE
  // la tranche de l'onglet une fois la pile serveur arrivée (`reconcilier`) : un pivot consommé avant
  // cette arrivée écrivait dans un onglet qui n'existait pas encore, et l'hydratation l'effaçait
  // aussitôt — le lien d'arrivée perdait son filtre sur un chargement à froid.
  const chargementOnglets = useCrmTabsOptionnel()?.chargement ?? false
  useEffect(() => {
    if (pivotConsomme || !filtresArrivee || chargementOnglets) return
    setFiltres(filtresArrivee)
    setPivotConsomme(true)
  }, [pivotConsomme, filtresArrivee, setFiltres, chargementOnglets])

  const [masques, setMasques] = useState<ReadonlyMap<string, number | null>>(() => new Map())
  const [coches, setCoches] = useState<Readonly<Record<string, readonly string[]>>>({})
  const [limites, setLimites] = useState<Readonly<Record<string, number>>>({})
  const [envoi, setEnvoi] = useState<Envoi | null>(null)
  const [enAttente, setEnAttente] = useState<{ id: string; texte: string; annuler: () => void } | null>(null)
  const [registre] = useState(() => new PendingRegistry())
  const racine = useRef<HTMLDivElement>(null)
  const reveils = useRef(new Set<string>())

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

  const visibles = useMemo(() => matchs.filter((m) => visibleSelon(masques, m.id, chargeLe)), [matchs, masques, chargeLe])
  const options = useMemo(() => optionsFiltres(matchs), [matchs])
  // ⚠ CE QUE L'ONGLET RESTITUE PEUT ÊTRE PÉRIMÉ OU MALFORMÉ : un schéma antérieur, une écriture
  // interrompue. `texte` redevient une chaîne, `bienId`/`acheteurId` une chaîne ou `null` — mais un id
  // qui ne correspond plus à AUCUN match connu (bien vendu, acheteur supprimé, ou son SEUL match
  // envoyé à l'instant) N'EST PAS effacé : un filtre qu'on efface tout seul rouvre le fil à tout le
  // monde sans le dire. `construireFil` ne trouve alors rien, et c'est l'état « Rien ne correspond à
  // ces filtres » qui doit paraître — jamais la liste entière.
  const filtresValides = useMemo<FilFiltres>(() => ({
    texte: typeof filtres.texte === 'string' ? filtres.texte : '',
    bienId: typeof filtres.bienId === 'string' ? filtres.bienId : null,
    acheteurId: typeof filtres.acheteurId === 'string' ? filtres.acheteurId : null,
  }), [filtres])
  const vue = useMemo(() => construireFil(visibles, filtresValides, chargeLe), [visibles, filtresValides, chargeLe])
  const selectionsVues = useMemo(() => construireSelections(selections, filtresValides), [selections, filtresValides])
  const ordre = useMemo(
    () => [...vue.ordre, ...selectionsVues.map((s) => cleSelection(s.acheteur.id))],
    [vue.ordre, selectionsVues],
  )
  const compte = vue.compte + selectionsVues.length
  const filtreActif = Boolean(filtresValides.bienId || filtresValides.acheteurId || filtresValides.texte)
  // Sélection DÉRIVÉE : une ligne qui sort du fil (geste, filtre) cède la place à la première restante.
  const courant = choix && ordre.includes(choix) ? choix : (ordre[0] ?? null)
  const contactSelection = courant ? contactDeSelection(courant) : null
  const match = courant && !contactSelection ? visibles.find((m) => m.id === courant) ?? null : null
  const resumeSelection = contactSelection ? selectionsVues.find((s) => s.acheteur.id === contactSelection) ?? null : null

  const limite = contactSelection ? (limites[contactSelection] ?? PAS_SELECTION) : PAS_SELECTION
  const selection = useSelectionMarche(contactSelection, limite)
  const matchsSelection = useMemo(
    () => selection.matchs.filter((m) => visibleSelon(masques, m.id, selection.chargeLe)),
    [selection.matchs, selection.chargeLe, masques],
  )
  const cochesSelection = useMemo(() => {
    if (!contactSelection) return []
    const retenus = coches[contactSelection] ?? precoches(matchsSelection)
    return retenus.filter((id) => matchsSelection.some((m) => m.id === id))
  }, [contactSelection, coches, matchsSelection])

  // Lus APRÈS un `await` ou un minuteur, où la valeur du rendu qui a créé la fonction serait périmée.
  // Posés dans un effet : une ref écrite pendant le rendu est refusée par `react-hooks/refs`.
  const ordreRef = useRef(ordre)
  const courantRef = useRef(courant)
  useLayoutEffect(() => {
    ordreRef.current = ordre
    courantRef.current = courant
  })

  const focaliser = useCallback((id: string | null) => {
    const ligne = id ? racine.current?.querySelector<HTMLElement>(`[data-match="${CSS.escape(id)}"]`) : null
    if (ligne) ligne.focus()
    else racine.current?.focus()
  }, [])

  const montrer = useCallback((id: string) => {
    setMasques((s) => { if (!s.has(id)) return s; const n = new Map(s); n.delete(id); return n })
  }, [])

  /** Une ligne sort du fil : la sélection passe à la suivante, ou à la précédente si c'était la dernière. */
  const ceder = useCallback((id: string): string | null => {
    const liste = ordreRef.current
    const i = liste.indexOf(id)
    const suivant = liste[i + 1] ?? liste[i - 1] ?? null
    setChoix(suivant)
    return suivant
  }, [])

  const differer = useCallback((
    m: FilMatch, texte: string, ecrire: (c: GesteContext) => Promise<void>, dansSelection = false,
  ) => {
    if (!ctx) return
    // Dans une sélection, le bien n'est pas une ligne du fil : la sélection du fil ne bouge pas.
    if (!dansSelection) focaliser(ceder(m.id))
    setMasques((s) => new Map(s).set(m.id, null))
    const poignee = registre.defer(async () => { await ecrire(ctx); return null }, {
      onSettled: () => {
        // Après un échec, `onError` a déjà rendu le match : rien à dater.
        const fin = Date.now()
        setMasques((s) => (s.has(m.id) ? new Map(s).set(m.id, fin) : s))
        void rafraichir()
      },
      onError: () => { montrer(m.id); toast.error(t('fil.erreurGeste')) },
    })
    setEnAttente({
      id: m.id,
      texte,
      annuler: () => {
        poignee.cancel()
        montrer(m.id)
        setEnAttente(null)
        if (dansSelection) return
        setChoix(m.id)
        // La ligne revient au rendu suivant : le focus la suit après lui.
        setTimeout(() => focaliser(m.id), 0)
      },
    })
  }, [ctx, ceder, registre, rafraichir, montrer, focaliser, toast, t])

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
  const ecarterDeSelection = useCallback((m: FilMatch) => {
    setCoches((c) => {
      const actuels = c[m.acheteur.id]
      return actuels ? { ...c, [m.acheteur.id]: actuels.filter((id) => id !== m.id) } : c
    })
    differer(m, t('fil.ecarteSelection', { titre: m.bien.titre, prenom: m.acheteur.prenom }),
      (c) => execDismiss(c, versGeste(m).acheteur), true)
  }, [differer, t])
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

  const cocher = useCallback((id: string, coche: boolean) => {
    if (!contactSelection) return
    setCoches((c) => ({
      ...c,
      [contactSelection]: coche ? [...new Set([...cochesSelection, id])] : cochesSelection.filter((x) => x !== id),
    }))
  }, [contactSelection, cochesSelection])

  const envoyerSelection = useCallback(() => {
    if (!resumeSelection || cochesSelection.length === 0) return
    setEnvoi({
      origine: 'selection',
      acheteur: resumeSelection.acheteur,
      matchs: matchsSelection.filter((m) => cochesSelection.includes(m.id)),
    })
  }, [resumeSelection, cochesSelection, matchsSelection])

  const consignerEnvoi = useCallback(async (e: Envoi) => {
    try {
      if (!ctx) throw new Error('envoi sans contexte agent')
      if (e.origine === 'mandat') {
        const m = e.matchs[0]
        if (!m) return
        const { acheteur, bien } = versGeste(m)
        await execSendDossier(ctx, acheteur, bien, 'reception')
        toast.success(t('fil.envoi.fait', { prenom: e.acheteur.prenom }))
        // Comme Plus tard et Écarter, le match sort et la sélection passe au suivant. Le focus attend la
        // fermeture de la feuille : posé sur une ligne maintenant, il sortirait de la modale ouverte.
        ceder(m.id)
      } else {
        await execEnvoyerSelection(
          ctx,
          { id: e.acheteur.id, first: e.acheteur.prenom, last: e.acheteur.nom },
          e.matchs.map((m) => ({ matchId: m.id, score: m.score, bien: versGeste(m).bien })),
        )
        toast.success(t('fil.envoi.faitSelection', { count: e.matchs.length, prenom: e.acheteur.prenom }))
        setCoches((c) => { const n = { ...c }; delete n[e.acheteur.id]; return n })
      }
      const fin = Date.now()
      setMasques((s) => { const n = new Map(s); for (const m of e.matchs) n.set(m.id, fin); return n })
    } finally {
      // Même en échec : le lien est créé, donc les matchs sont déjà marqués envoyés en base.
      void rafraichir()
    }
  }, [ctx, ceder, toast, t, rafraichir])

  const fermerEnvoi = useCallback(() => {
    setEnvoi(null)
    // Après le démontage de la feuille, qui rend d'abord le focus à son déclencheur : la ligne choisie
    // le reprend — la suivante, si l'envoi a fait sortir le match.
    setTimeout(() => focaliser(courantRef.current), 0)
  }, [focaliser])

  // Un rafraîchissement en échec garde la liste chargée, et le dit UNE fois par échec.
  const echecSignale = useRef(0)
  useEffect(() => {
    if (!isError || !aDesDonnees || erreurLe === echecSignale.current) return
    echecSignale.current = erreurLe
    toast.error(t('fil.erreurRafraichir'))
  }, [isError, aDesDonnees, erreurLe, toast, t])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Une feuille ouverte garde son clavier : ses événements remontent ici par l'arbre React.
    if (envoi || e.metaKey || e.ctrlKey || e.altKey) return
    const cible = e.target as HTMLElement
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName) || cible.isContentEditable) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!courant) return
      e.preventDefault()
      const i = ordre.indexOf(courant)
      const suivant = ordre[Math.min(ordre.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (!suivant) return
      setChoix(suivant)
      focaliser(suivant)
      return
    }
    // ⛔ La répétition automatique d'une touche tenue trierait une ligne par répétition.
    if (e.repeat) return
    const touche = e.key.toLowerCase()
    if (contactSelection) {
      if (touche === 'e' && cochesSelection.length > 0) { e.preventDefault(); envoyerSelection() }
      return
    }
    if (!match) return
    if (touche === 'e') { e.preventDefault(); setEnvoi({ origine: 'mandat', acheteur: match.acheteur, matchs: [match] }) }
    else if (touche === 'p') { e.preventDefault(); plusTard(match) }
    else if (touche === 'x') { e.preventDefault(); ecarter(match) }
  }

  const enEchec = isError && !aDesDonnees
  const connu = !isLoading && !enEchec
  const rienDuTout = visibles.length === 0 && selections.length === 0
  return (
    <div ref={racine} tabIndex={-1} onKeyDown={onKeyDown} style={{
      position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', outline: 'none', background: sp.frameBg, color: sp.ink,
      fontFamily: 'var(--crm-font), system-ui, sans-serif',
    }}>
      <FilEnTete sp={sp} compte={connu ? compte : null} filtres={filtresValides} options={options} onFiltres={setFiltres} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {isLoading ? <Squelette sp={sp} />
          : enEchec ? <Etat sp={sp} alerte titre={t('fil.erreur')} action={{ libelle: t('fil.reessayer'), faire: rafraichir }} />
            // ⚠ Un FILTRE actif qui ne retient rien passe AVANT le constat « aucune donnée du tout » :
            // sinon le seul match d'un acheteur filtré, une fois envoyé, fait lire « Tout est à jour »
            // (vrai pour l'agence entière, faux pour ce filtre) au lieu de « Rien ne correspond ».
            : filtreActif && compte === 0 && vue.reportes.length === 0 ? (
              <Etat sp={sp} titre={t('fil.filtreVide')} action={{ libelle: t('fil.filtres.retirer'), faire: () => setFiltres(SANS_FILTRE) }} />
            ) : rienDuTout ? (
              <Etat sp={sp} titre={t('fil.vide.titre')} texte={t('fil.vide.texte')}
                action={{ libelle: t('fil.vide.contacts'), faire: () => navigate('/dashboard/contacts') }}
                secondaire={onOpenRecherche ? { libelle: t('fil.vide.marche'), faire: onOpenRecherche } : undefined} />
            ) : (
              <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: COLONNES, borderTop: `1px solid ${sp.cardBorder}` }}>
                {/* `paddingBottom` : la barre d'annulation est un OVERLAY ancré bas-gauche (§ci-dessous) —
                    sans réserve, elle couvre les dernières lignes pendant toute la fenêtre d'annulation. */}
                <div style={{ minHeight: 0, overflowY: 'auto', borderRight: `1px solid ${sp.cardBorder}`, paddingBottom: 'calc(var(--crm-space-7xl) * 3)' }}>
                  <FilListe sp={sp} vue={vue} selections={selectionsVues} courant={courant} onChoisir={setChoix} onReactiver={reactiver} />
                </div>
                {/* La clé remet le défilement en haut quand on change de ligne. */}
                <div key={courant ?? 'aucun'} style={{ minHeight: 0, overflowY: 'auto' }}>
                  {contactSelection && resumeSelection ? (
                    <FilSelection sp={sp} resume={resumeSelection} matchs={matchsSelection} coches={cochesSelection}
                      aPlus={selection.aPlus} isLoading={selection.isLoading} isError={selection.isError}
                      onCocher={cocher} onEcarter={ecarterDeSelection} onEnvoyer={envoyerSelection}
                      onVoirPlus={() => setLimites((l) => ({ ...l, [contactSelection]: limite + PAS_SELECTION }))}
                      onVoirContact={() => navigate(`/dashboard/contacts/${contactSelection}`)} />
                  ) : match ? (
                    <FilPanneau sp={sp} m={match} historique={historique.get(match.acheteur.id)}
                      onProposer={() => setEnvoi({ origine: 'mandat', acheteur: match.acheteur, matchs: [match] })}
                      onPlusTard={() => plusTard(match)} onEcarter={() => ecarter(match)}
                      onVoirBien={() => navigate(`/dashboard/listings/${match.bien.id}`)}
                      onVoirContact={() => navigate(`/dashboard/contacts/${match.acheteur.id}`)} />
                  ) : (
                    <Etat sp={sp} titre={compte === 0 ? t('fil.vide.titre') : t('fil.choisir')} />
                  )}
                </div>
              </div>
            )}
      </div>
      {/* ⛔ HORS des états : Plus tard ou Écarter sur la DERNIÈRE ligne fait basculer l'écran sur « Tout est
          à jour », et la barre partait avec la liste alors que l'écriture attendait encore. */}
      {enAttente && <FilAnnulation sp={sp} texte={enAttente.texte} onAnnuler={enAttente.annuler} />}
      {/* Région vivante montée en PERMANENCE : une région qui apparaît avec son texte n'est pas annoncée
          de façon fiable. */}
      <div role="status" aria-live="polite" className="sr-only">{enAttente?.texte ?? ''}</div>
      {envoi && (
        <FilFeuilleEnvoi sp={sp} acheteur={envoi.acheteur} matchs={envoi.matchs}
          onEnvoye={() => consignerEnvoi(envoi)} onFermer={fermerEnvoi} />
      )}
    </div>
  )
}
```

puis recopier À L'IDENTIQUE, à la suite, les deux composants `Etat` et `Squelette` du fichier actuel (ils ne changent pas).

⚠ Le bloc a été confronté au fichier du lot 1 le 21.09.2026 (diff relu : seuls changent les ajouts du lot 2, tous les commentaires du lot 1 sont repris). Avant de remplacer, refaire ce diff : une ligne du lot 1 absente du bloc se reporte et se signale.

- [ ] **Step 2 : Vérifier**

Run : `npx tsc --noEmit -p tsconfig.app.json` → aucune erreur.
Run : `npx eslint src/components/matching-fil src/hooks/useMatchingFil.ts src/hooks/useSelectionMarche.ts src/hooks/useAtelierMatching.ts` → 0 erreur.
Run : `npx vitest run tests/unit/megga-x-grammar.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/redirection-ouverte.spec.ts` → PASS.

- [ ] **Step 3 : Point de commit (au signal)**

```bash
git add src/components/matching-fil src/hooks/useMatchingFil.ts src/hooks/useSelectionMarche.ts src/i18n/locales/fr/matching.json src/i18n/locales/de/matching.json src/i18n/locales/en/matching.json src/i18n/locales/it/matching.json tests/unit/matching-fil-modele.spec.ts
git commit -m "feat(matching): la sélection du marché dans le fil de matchs (lot 2)"
```

---

### Task 11 : Le marché sur le banc

**Files :** Modify `src/pages/dev/crmFixtures.ts`, `src/pages/dev/CrmShowcasePage.tsx`

- [ ] **Step 1 : Quatre annonces du marché**

Dans `src/pages/dev/crmFixtures.ts`, juste AVANT `export const CRM_TABLES: Record<string, unknown[]> = {` (donc APRÈS `unsplash` et `PHOTOS_APPART`), ajouter :

```ts
/**
 * Annonces du MARCHÉ pour le fil de matchs (lot 2, 17.09.2026) — des ventes à Genève que les recherches
 * de Julie (c9) et d'Emma (c7) retiennent. ml-fil-3 garde volontairement deux écarts pour Julie
 * (surface, équipements) : la sélection doit montrer un bien NON coché d'office.
 */
const annonceFil = (id: string, titre: string, rue: string, npa: string, prix: number, pieces: number, surface: number, equipements: string[], photo: string, sourceId: string) => ({
  id, title: titre, address: rue, city: 'Genève', postal_code: npa, canton: 'GE',
  type: 'apartment', transaction_type: 'buy', price: prix, current_price: prix, price_at_first_seen: prix, price_per_m2: null,
  rooms: pieces, bedrooms: Math.max(1, Math.floor(pieces) - 1), bathrooms: pieces >= 5 ? 2 : 1, surface_m2: surface,
  features: equipements, photos: [unsplash(photo)], photos_cf: null, status: 'active',
  source_portal: 'realadvisor', source_url: `https://realadvisor.ch/fr/demo/${sourceId}`, source_id: sourceId,
  agency_name: 'Régie de démonstration', agency_phone: null, agency_logo_url: null, lat: null, lng: null,
  year_built: 1998, days_on_market: 9, land_surface: null, description: null, floor: 3, parking_count: null,
  year_renovated: null, usable_surface: null, charges_monthly: 450, is_furnished: false, availability_date: null,
  visit_contact_name: null, agency_reference: null,
})
const ANNONCES_FIL = [
  annonceFil('ml-fil-1', 'Appartement 5 pièces · Florissant', 'Route de Florissant 62', '1206', 1_520_000, 5, 124, ['Balcon', 'Ascenseur'], PHOTOS_APPART[0]!, '51842'),
  annonceFil('ml-fil-2', 'Attique 4,5 pièces · Eaux-Vives', 'Rue du Lac 14', '1207', 1_590_000, 4.5, 132, ['Terrasse', 'Ascenseur', 'Balcon'], PHOTOS_APPART[1]!, '51907'),
  annonceFil('ml-fil-3', 'Appartement 4 pièces · Plainpalais', 'Rue de Carouge 40', '1205', 1_180_000, 4, 96, ['Ascenseur'], PHOTOS_APPART[2]!, '52013'),
  annonceFil('ml-fil-4', 'Appartement 6 pièces · Champel', 'Avenue Miremont 30', '1206', 2_450_000, 6, 175, ['Ascenseur', 'Balcon', 'Cave'], PHOTOS_APPART[3]!, '52101'),
]

```

⚠ Vérifier d'abord que `PHOTOS_APPART` porte au moins 4 identifiants ; sinon réutiliser ses entrées en rotation (`PHOTOS_APPART[i % PHOTOS_APPART.length]`).

Puis remplacer `  market_listings: [ANNONCE_MARCHE_BANC, ...ANNONCES_CLOCHE],` par `  market_listings: [ANNONCE_MARCHE_BANC, ...ANNONCES_CLOCHE, ...ANNONCES_FIL],`.

- [ ] **Step 2 : Les matchs, notés par le vrai moteur**

Les raisons et le score DOIVENT sortir de `calculateScoreV2` (`supabase/functions/_shared/matching-normalize.ts`), pas d'une estimation. Pour chaque paire ci-dessous, calculer avec un script jetable lancé par `npx tsx` (liste : annonce ci-dessus ; critères : le `search_criteria` du contact dans `CONTACTS`) :

| id | contact | recherche | annonce |
|---|---|---|---|
| m8 | c9 Julie | cs9 | ml-fil-1 |
| m9 | c9 Julie | cs9 | ml-fil-2 |
| m10 | c9 Julie | cs9 | ml-fil-3 |
| m11 | c7 Emma | cs7 | ml-fil-1 |
| m12 | c7 Emma | cs7 | ml-fil-2 |
| m13 | c7 Emma | cs7 | ml-fil-4 |

Exemple de script (à lancer depuis la racine du worktree, dans un fichier du dossier temporaire) :

```ts
import { calculateScoreV2 } from './supabase/functions/_shared/matching-normalize'
const annonce = { current_price: 1_520_000, type: 'apartment', city: 'Genève', canton: 'GE', rooms: 5, surface_m2: 124, features: ['Balcon', 'Ascenseur'] }
const julie = { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Champel', 'GE'], budget_min: 1_300_000, budget_max: 1_600_000, rooms_min: 4, surface_min: 100, features: ['balcon', 'ascenseur', 'terrasse'] }
console.log(JSON.stringify(calculateScoreV2(annonce, julie), null, 2))
```

Une paire dont le score est **< 55** n'est PAS créée (le moteur ne la créerait pas) : la retirer et le signaler.

Ajouter chaque match à la FIN du tableau `matches`, sur ce modèle (valeurs `score` et `reasons` = sortie EXACTE du moteur ; `created_at` décroissant de ilYA(8) à ilYA(18) dans l'ordre du tableau) :

```ts
    {
      id: 'm8', agency_id: AGENCE_BANC.id, client_search_id: 'cs9', contact_id: 'c9', source: 'market',
      property_id: null, market_listing_id: 'ml-fil-1',
      score: 0, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(8),
      reasons: { /* sortie exacte de calculateScoreV2 */ },
      contact: { first_name: 'Julie', last_name: 'Morand', email: 'julie.morand@example.ch', phone: '+41 79 530 18 64' },
      market_listing: ANNONCES_FIL[0], property: null,
    },
```

- [ ] **Step 3 : m1 devient envoyé, comme son lien**

Le lien `rl1` de Camille (vu, sans réaction) porte `match_ids: ['m1']` : un match dont le lien est parti est `sent`. Dans l'objet `m1`, remplacer `score: 88, status: 'suggested', sent_via: null, sent_at: null,` par `score: 88, status: 'sent', sent_via: 'reception', sent_at: ilYA(50),`, et ajouter au commentaire au-dessus de `matches: [` : `// m1 est ENVOYÉ (17.09.2026) : son lien rl1 est parti et a été vu ; « suggested » contredisait la fiche de Camille.`

⚠ Vérifier ensuite que la page « Aujourd'hui » du banc (`/dashboard`) rend toujours sa page « Catalogue » sans erreur (sa source est la RPC `focus_top_matches`).

- [ ] **Step 4 : La RPC du banc, calculée**

Juste AVANT `export const CRM_RPC_VIDE`, ajouter :

```ts
/**
 * `matching_fil_marche` — le résumé « Marché » du fil, CALCULÉ sur les tables du banc à chaque appel, avec
 * les règles de la RPC : `suggested`, non reporté, annonce non retirée ; trois vignettes. Une valeur figée
 * ne bougerait pas quand un envoi ou un « Écarter » vide la sélection.
 */
function resumeMarcheBanc() {
  const maintenant = Date.now()
  const annonces = new Map((CRM_TABLES.market_listings as { id: string; status?: string | null; photos?: string[] | null }[]).map((a) => [a.id, a]))
  const parContact = new Map<string, { score: number; creeLe: string; vignette: string | null }[]>()
  for (const m of CRM_TABLES.matches as { contact_id: string; market_listing_id: string | null; status: string; score: number; created_at: string; snoozed_until?: string | null }[]) {
    if (m.status !== 'suggested' || !m.market_listing_id) continue
    if (m.snoozed_until && Date.parse(m.snoozed_until) > maintenant) continue
    const a = annonces.get(m.market_listing_id)
    if (!a || a.status === 'removed') continue
    const liste = parContact.get(m.contact_id) ?? []
    liste.push({ score: m.score, creeLe: m.created_at, vignette: a.photos?.[0] ?? null })
    parContact.set(m.contact_id, liste)
  }
  return [...parContact]
    .map(([contact_id, l]) => {
      const tries = [...l].sort((x, y) => y.score - x.score || y.creeLe.localeCompare(x.creeLe))
      return {
        contact_id, nombre: l.length, meilleur_score: tries[0]!.score,
        vignettes: tries.slice(0, 3).map((x) => x.vignette).filter((v): v is string => !!v),
      }
    })
    .sort((x, y) => y.meilleur_score - x.meilleur_score || y.nombre - x.nombre)
}

```

et dans `export const CRM_RPC: Record<string, unknown> = {`, ajouter l'entrée `  matching_fil_marche: () => resumeMarcheBanc(),`.

- [ ] **Step 5 : Le titre de l'état Nominal**

Dans `src/pages/dev/CrmShowcasePage.tsx`, mettre à jour le nombre de matchs du titre de l'état `nominal` (`'10 contacts, 50 biens, N matchs, …'`) avec le compte RÉEL du tableau `matches` après cette tâche.

- [ ] **Step 6 : Vérifier**

Run : `npx tsc --noEmit -p tsconfig.app.json` → aucune erreur.
Run : `npx eslint src/pages/dev/crmFixtures.ts src/pages/dev/CrmShowcasePage.tsx` → 0 erreur.
Run : `npx vitest run tests/unit/megga-x-grammar.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/banc-supabase.spec.ts tests/unit/dev-bancs-frontiere.spec.ts` → PASS.

- [ ] **Step 7 : Point de commit (au signal)**

```bash
git add src/pages/dev/crmFixtures.ts src/pages/dev/CrmShowcasePage.tsx
git commit -m "feat(banc): le marché du fil de matchs, des matchs notés par le moteur"
```

---

### Task 12 : L'éprouver sur le banc

Aucun code. Lire l'écran (`get_page_text`, `javascript_tool`), capture pour la preuve finale seulement.

- [ ] **Step 1** : ouvrir `http://localhost:5173/dev/crm?entree=/dashboard/matching` (1440 × 900). Expected : « À traiter · 5 » (3 lignes de biens + 2 lignes « Marché ») ; une section « Marché · une sélection par acheteur » avec Emma puis Julie (meilleur score d'abord), « N biens pas encore proposés », vignettes visibles ; aucune erreur console.
- [ ] **Step 2** : ↓ jusqu'à la ligne d'Emma. Expected : panneau de sélection, « Recherche : » suivi de son budget, de ses zones et du type, ses biens par score, ceux qui tiennent tous les critères cochés, pied « Envoyer N biens à Emma ».
- [ ] **Step 3** : ligne de Julie. Expected : ml-fil-3 NON coché, « À vérifier : Surface, Équipements » (ou les écarts réels du moteur) avec l'icône d'écart.
- [ ] **Step 4** : décocher tous les biens de Julie. Expected : « Cochez au moins un bien. », bouton grisé, `E` ne fait rien. Recocher un bien.
- [ ] **Step 5** : « Écarter » sur un bien de Julie. Expected : le bien disparaît, la barre « « … » écarté pour Julie » + Annuler, la ligne Julie reste choisie. « Annuler » : le bien revient.
- [ ] **Step 6** : `E` sur la ligne de Julie. Expected : feuille « Proposer à Julie », sous-titre « N biens », texte de sélection ; « Copier le lien » : lien affiché, toast « N biens proposés à Julie » ; « Terminé » : la ligne de Julie montre les biens restants, ou disparaît s'il n'en reste aucun. `/dashboard/audit` : UNE ligne « Dossier envoyé ».
- [ ] **Step 7** : filtre Bien = un bien en mandat. Expected : aucune ligne « Marché ». Filtre Acheteur = Emma : sa ligne « Marché » seule (plus ses matchs en mandat). Texte « morand » : Julie seule.
- [ ] **Step 8** : états « Vide » et « Échec » du banc : pas de ligne « Marché », pas d'erreur non gérée. Thème clair puis sombre : capture de chaque, envoyée à Julien.

---

### Task 13 : Les portes

- [ ] **Step 1** : `npx tsc -b && npm run lint` → 0 erreur.
- [ ] **Step 2** : `npm run lint:deadcode && npm run i18n:parity:ci && npm run lint:prose && npm run lint:i18n && npm run lint:migrations && npm run lint:types-freshness` → tout vert.
- [ ] **Step 3** : `npm run test:unit` SEUL. Les trois échecs connus sans lien (deux specs de messagerie sur `npm:postal-mime@3.0.0`, `safe-internal-path` sur `javascript:`) peuvent subsister ; tout autre rouge se lit et se corrige.

---

### Task 14 : Le cerveau

- [ ] **Step 1** : dans `.claude-flow/knowledge/megga-memory.seed.json` (format `JSON.stringify(d, null, 2) + '\n'`, vérifié par script), compléter la valeur de l'entrée `megga/matching-fil` par :

« LOT 2 (banc) : une ligne « Marché » par acheteur, résumée par la RPC matching_fil_marche() (migration 20260921120000, SECURITY INVOKER, idx_matches_agency_focus ; à renommer au jour de la fusion — date-guard) ; sélection chargée à l'ouverture, 20 à la fois (useSelectionMarche) ; cochés d'office = tous critères tenus, 5 au plus (precoches) ; envoi de sélection = execEnvoyerSelection : UN deal, UNE relance +5 j, UN dossier_envoye listant les match_ids (rattacherDeal partagé avec execSendDossier). Écart moteur connu : automation-engine pose une relance +3 j PAR match envoyé sans relance portant son match_id. Lien vers Recherche reporté au lot 3. Banc : m1 passé à sent (cohérent avec rl1), annonces ml-fil-1..4, matchs m8..m13 notés par calculateScoreV2. »

- [ ] **Step 2** : `npm run ruflo:seed`, puis `CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory search -q "sélection du marché par acheteur dans le fil de matchs" -n megga` → `megga/matching-fil` en tête.

- [ ] **Step 3 : Point de commit (au signal)**

```bash
git add .claude-flow/knowledge/megga-memory.seed.json
git commit -m "docs(cerveau): le fil de matchs, lot 2"
```

---

## Exécution (21.09.2026)

Tâches 0 à 14 faites, non commitées. Trois relectures ont modifié le plan ; le code du dépôt fait foi. Écarts :

- **Migration** datée `20260921120000` (le jour de l'exécution) ; toujours à renommer si la fusion a lieu plus tard. Vignettes : `nullif(…, '')`, trois premières NON vides, `created_at desc nulls last`.
- **`execEnvoyerSelection`** ne repasse en `sent` que les matchs encore `suggested` DE CET ACHETEUR (comme l'edge) ; `MAX_BIENS_LIEN = 50` (plafond de `buyer-reception-create`, qui coupe en silence) refusé avant toute écriture et câblé dans l'écran ; échec de la relance signalé en console. Mock de `matching-fil-gestes.spec.ts` fidèle à supabase-js (écriture enregistrée au `then`, lectures et erreurs injectables).
- **Cochés d'office** sur des faits (`criteresNonTenus` : prix dans les bornes, tous les équipements), pas sur le seul verdict du moteur ; FIGÉS une fois par acheteur au premier chargement réel ; après un envoi, rien n'est recoché. Le résumé « À vérifier » d'un bien lit la même fonction.
- **`useSelectionMarche`** : données provisoires gardées pour le MÊME acheteur seulement (sinon on voyait, et on pouvait écarter, les biens d'un autre) ; départage `created_at`, `id` ; `isFetching`, `refetch`.
- **Focus** : `data-bien` sur les cases, focus au bien voisin après « Écarter », `reprendreFocus` rend le focus à la ligne courante quand l'élément focalisé du fil est démonté (événements venus de la feuille portée dans `<body>` ignorés) ; ↑/↓ d'une case à l'autre ; focus suivi après « Voir 20 de plus ».
- **Divers** : options du filtre « Acheteur » incluant les acheteurs du marché seul ; `aria-label` des « Écarter » ; pièces au pluriel et avec unité dans le résumé ; « Envoyer à Julie » à zéro case ; titre vide replié ; échec de la RPC toléré seulement si la fonction est ABSENTE.
- **Banc** : tri numérique et transitif (le banc rangeait 100 après 97) ; `resumeMarcheBanc` aligné sur la RPC. Reste : le banc ignore `not`, une ligne en mandat peut occuper une place de la page de 20.
- **Spec backend** `tests/backend/matching-fil-marche.spec.ts` écrite, jamais jouée (pas de Docker local).
