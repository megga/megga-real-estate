# Matching · lot D1 — les surfaces du CRM · plan d'exécution

> **Pour un agent :** SOUS-COMPÉTENCE REQUISE — `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`, tâche par tâche. Les étapes sont des cases à cocher.

**But :** la boucle de matching se voit là où l'agent travaille déjà. « Aujourd'hui » dit quoi faire et pourquoi, « Sa boucle » montre toute la boucle d'un acheteur, « Qui pour ce bien ? » vit sur les deux fiches, « Ce qui a bougé » dit ses acheteurs, l'écran de fin d'un nouveau mandat compte ses acquéreurs — et chaque geste mène à la bonne place du fil.

**Conception :** [2026-09-23-matching-lot-d1-surfaces-design.md](../specs/2026-09-23-matching-lot-d1-surfaces-design.md), validée par Julien le 23.09.2026, « Ce qui a bougé » compris. **Étape 4a** de la [feuille de route](../feuille-de-route.md).

**Architecture :** le fil apprend à arriver quelque part (`filLiens.ts` : `?onglet=`, `?ligne=`, `?attente=`), et toutes les surfaces y mènent par les mêmes fonctions (`lienFil`, `lienPlace`). Deux RPC neuves, bornées côté serveur, nourrissent « Aujourd'hui » (`matching_actions_du_jour`) et « Ce qui a bougé » (`pige_acheteurs_compatibles`) ; `today_absence` dit le type de ses rappels. « Sa boucle » et « Qui pour ce bien ? » passent par des modules purs (`saBoucle.ts`, `filQuiPour.ts`) et des lectures ciblées ; le panneau du fil et les deux fiches partagent un composant (`QuiPourCeBien`). Rien ne part vers l'acheteur.

**Pile :** PostgreSQL (une migration, trois fonctions), TypeScript strict, React 18, TanStack Query v5, Supabase Realtime (écran de fin), Vitest (unitaire, et `tests/backend` contre une base locale), i18n 4 langues, banc `/dev/crm`.

**Branche :** `megga/matching-lot-d1`, partie de `megga/contacts-roles`.

> ⚠ **Les commits attendent le signal de Julien** (« committe ») : ils se jouent tous à la fin (tâche 15), **un commit par sujet**, dans l'ordre des tâches. Pendant l'exécution, on enchaîne sans commiter.

> ⚠ **La migration se redate le jour de la fusion** et s'**applique à la main avant**, comme la pige, le lot C et les rôles : l'écran part avant la base (`deploy-app.yml` n'attend pas `deploy.yml`). ⚠ **D1 ne part pas en production sans le lot E** (décision 1 de la conception) : ses liens visent le fil, que `/dashboard/matching` ne monte qu'au lot E.

> ⛔ **Toute navigation s'écrit en gabarit ANCRÉ** — `` navigate(`/dashboard/matching?${requete}`) ``, jamais `navigate(uneVariable)` : `redirection-ouverte.spec.ts` refuse un puits dont la cible ne commence pas par un chemin littéral. Et **aucun paramètre d'URL ne commence par `retour`** : le filet secondaire de la même garde le lirait comme une URL de retour — d'où `?attente=` et non `?retours=`.

> ⚠ **Le cliquet de grammaire** (`megga-x-grammar.spec.ts`) : aucun littéral de rayon, d'espacement ni de taille de texte dans le code neuf — des jetons (`var(--crm-space-*)`, `var(--crm-radius-*)`, `var(--crm-text-*)`). Il marche dans les DEUX sens : quand une tâche retire des littéraux, il demande de « descendre le compte » de la zone (`B4_ASSUME`, ou l'inventaire des classes) — le faire, à la valeur réelle qu'il annonce. Un compte ne MONTE jamais.

> ⚠ **La suite unitaire se joue SEULE**, jamais en parallèle de `tsc` ou d'`eslint` : les délais de 5 s sautent et les faux rouges s'enchaînent. Une spec qui rougit se rejoue d'abord seule.

---

## Les fichiers

| Fichier | Responsabilité |
|---|---|
| `src/components/matching-fil/filLiens.ts` | **Créer.** Les liens d'arrivée du fil : les lire, les écrire, la place d'un match, la ligne courante. |
| `src/components/matching-fil/MatchingFil.tsx` | Lit ses liens d'arrivée (onglet, ligne, feuille « Retours »). |
| `src/pages/agent/MatchingPage.tsx` | Le pager atterrit sur le fil pour chaque lien d'arrivée. |
| `supabase/migrations/20260923120000_matching_surfaces.sql` | **Créer.** `matching_actions_du_jour`, `pige_acheteurs_compatibles`, `today_absence` qui dit le type de ses rappels. |
| `src/types/database.ts` | Les deux RPC neuves. |
| `src/components/matching-fil/filSignaux.ts` | `JOURS_MANDAT` exporté (la base et le banc le confrontent). |
| `src/components/crm/today/matchingDuJour.ts` | **Créer.** Modèle pur du segment Matching : où chaque action mène, avec quels mots. |
| `src/components/crm/today/useMatchingDuJour.ts` | **Créer.** La lecture de `matching_actions_du_jour`. |
| `src/components/crm/today/HlMatching.tsx` | **Créer.** Les lignes du segment Matching et « Voir tout ». |
| `src/components/crm/today/PageAujourdhuiH.tsx` | Le troisième segment ; « Reprendre » d'une relance de proposition ouvre « Retours ». |
| `src/pages/agent/TodayPage.tsx` | Deux cibles de navigation : une place du fil, la fiche d'un mandat sur « Qui pour ce bien ? ». |
| `src/components/crm/today/useHotDeals.ts` | « Dossiers » sans matchs. |
| `src/components/crm/today/useAbsenceSignals.ts` | Motif libellé, vocabulaire d'un retour consigné, relance de proposition reconnue. |
| `src/components/crm-mobile/today/MobileTodayHScreen.tsx` | Ne clôt plus une relance de proposition. |
| `src/components/matching-fil/filBoucle.ts` | `cleMotif` : un motif n'est jamais un code brut. |
| `src/components/matching-fil/filModele.ts` | Reçoit `nombreOuNull`, `listeEquipements`, `photoAnnonce` (sortis de `useMatchingFil`). |
| `src/hooks/useMatchingFil.ts` | Les importe. |
| `src/components/crm/contacts-pager/saBoucle.ts` | **Créer.** Modèle pur de « Sa boucle ». |
| `src/hooks/useContactSentMatches.ts` | Deux lectures parallèles, et les critères des recherches. |
| `src/components/crm/contacts-pager/ContactDetailPager.tsx` | « Sa boucle » : cinq états, dates et prix, biens revenus, correction en attente, gestes vers le fil. |
| `src/pages/agent/ContactDetailPage.tsx` | Construit « Sa boucle » et ouvre le fil. |
| `src/pages/dev/demoFixtures.ts`, `src/pages/dev/ContactsShowcasePage.tsx` | La démo de « Sa boucle » dans sa forme neuve. |
| `src/components/matching-fil/filQuiPour.ts` | **Créer.** Modèle pur de « Qui pour ce bien ? » : un compatible, son état. |
| `src/components/matching-fil/QuiPourCeBien.tsx` | **Créer.** Les deux listes, partagées par le fil et les fiches. |
| `src/components/matching-fil/FilQuiPourCeBien.tsx` | Garde son en-tête, délègue ses listes. |
| `src/hooks/useQuiPourCeBien.ts` | **Créer.** La lecture ciblée des matchs d'un bien. |
| `src/components/matching-fil/QuiPourFiche.tsx` | **Créer.** « Qui pour ce bien ? » sur une fiche : lecture, états, listes. |
| `src/pages/agent/ListingDetailPage.tsx` | « Qui pour ce bien ? » remplace « Suggestions MEGGA AI » ; `?qui=1`. |
| `src/pages/agent/ExternalListingDetailPage.tsx` | « Qui pour ce bien ? » sur l'annonce du marché ; `?qui=1`. |
| `src/hooks/useAnciensProspects.ts` | « Réactiver » rafraîchit aussi la fiche. |
| `src/components/crm/biens/nouveau/acquereurs.ts` | **Créer.** Ce que dit la ligne des acquéreurs (pur). |
| `src/hooks/useAcquereursNouveauMandat.ts` | **Créer.** Le compte en direct (Realtime) et le délai de 30 s. |
| `src/components/crm/biens/nouveau/LigneAcquereurs.tsx` | **Créer.** La ligne de l'écran de fin. |
| `src/components/crm/biens/nouveau/NouveauBien.tsx`, `src/pages/agent/NouveauBienPage.tsx`, `src/pages/agent/ListingsPage.tsx` | L'écran de fin l'affiche ; « Voir qui ». |
| `src/components/matching-recherche/pige.ts` | `lotsAnnonces`. |
| `src/hooks/usePigeAcheteurs.ts` | **Créer.** Les acheteurs de chaque annonce du flux, par lots. |
| `src/components/matching-recherche/MrhBouge.tsx`, `mrh.css`, `mrhDemo.ts`, `MatchingRechercheHybride.tsx` | La pastille « 3 acheteurs ». |
| `src/pages/dev/crmFixtures.ts` | Les RPC du lot rejouées sur le banc. |
| `src/i18n/locales/{fr,de,en,it}/{dashboard,contacts,listings,matching}.json` | Les libellés. |
| `tests/unit/fil-liens-arrivee.spec.ts`, `matching-du-jour.spec.ts`, `sa-boucle.spec.ts`, `fiche-qui-pour.spec.ts`, `banc-matching-d1.spec.ts` | **Créer.** |
| `tests/backend/matching-actions-du-jour.spec.ts`, `tests/backend/pige-acheteurs.spec.ts` | **Créer.** |
| `tests/unit/pige.spec.ts`, `tests/unit/mrh-bouge.spec.tsx`, `tests/unit/matching-sans-sortie.spec.ts` | Étendues. |

---

## Tâche 1 : les liens d'arrivée du fil

**Fichiers :**
- Créer : `src/components/matching-fil/filLiens.ts`
- Créer : `tests/unit/fil-liens-arrivee.spec.ts`

- [ ] **Étape 1 : écrire la spec qui échoue**

`tests/unit/fil-liens-arrivee.spec.ts` :

```ts
/**
 * Les liens d'arrivée du fil (lot D1, conception §4) : ce qu'une surface écrit, le fil le relit ; rien d'inconnu ne
 * casse le fil ; une ligne absente de l'ordre ne choisit rien d'autre que le défaut.
 */
import { describe, expect, it } from 'vitest'
import {
  estArriveeFil, lienFil, lienPlace, ligneCourante, lireArrivee, PARAM_QUI_POUR,
} from '@/components/matching-fil/filLiens'

const lire = (q: string) => lireArrivee(new URLSearchParams(q))
const SANS = { bienId: null, acheteurId: null, texte: '' }

describe('lireArrivee', () => {
  it('sans paramètre du fil, le fil garde ce qu’il avait retenu', () => {
    expect(lire('')).toEqual({ filtres: null, onglet: null, ligne: null })
    expect(lire('page=2')).toEqual({ filtres: null, onglet: null, ligne: null })
  })

  it('les deux liens d’hier gardent leur sens', () => {
    expect(lire('contact=c1')).toEqual({ filtres: { ...SANS, acheteurId: 'c1' }, onglet: null, ligne: null })
    expect(lire('annonce=p:b1')).toEqual({ filtres: { ...SANS, bienId: 'b1' }, onglet: null, ligne: null })
  })

  it('une annonce du marché ne filtre pas : `m:` n’est pas construit', () => {
    expect(lire('annonce=m:ml1').filtres).toEqual(SANS)
  })

  it('`?attente=` ouvre « Retours de … » dans « En attente », filtré sur l’acheteur', () => {
    expect(lire('attente=c7')).toEqual({ filtres: { ...SANS, acheteurId: 'c7' }, onglet: 'enAttente', ligne: 'attente:c7' })
    // Il l'emporte sur un onglet et une ligne contradictoires.
    expect(lire('attente=c7&onglet=aConclure&ligne=m1')).toMatchObject({ onglet: 'enAttente', ligne: 'attente:c7' })
  })

  it('une ligne sans onglet ouvre « À proposer »', () => {
    expect(lire('ligne=m5&contact=c10')).toEqual({ filtres: { ...SANS, acheteurId: 'c10' }, onglet: 'aProposer', ligne: 'm5' })
  })

  it('un onglet inconnu ne casse rien : il est ignoré, et les filtres retenus cèdent quand même', () => {
    expect(lire('onglet=nimporte')).toEqual({ filtres: SANS, onglet: null, ligne: null })
    expect(lire('onglet=aConclure&ligne=m2')).toMatchObject({ onglet: 'aConclure', ligne: 'm2' })
  })

  it('une valeur vide ne compte pas', () => {
    expect(lire('ligne=&contact=%20')).toEqual({ filtres: SANS, onglet: null, ligne: null })
  })
})

describe('lienFil ↔ lireArrivee', () => {
  it.each([
    [{ attente: 'c7' }, { onglet: 'enAttente', ligne: 'attente:c7', acheteurId: 'c7' }],
    [{ ligne: 'm5', contact: 'c10' }, { onglet: 'aProposer', ligne: 'm5', acheteurId: 'c10' }],
    [{ onglet: 'aConclure' as const, ligne: 'm17', contact: 'c7' }, { onglet: 'aConclure', ligne: 'm17', acheteurId: 'c7' }],
    [{ ligne: 'marche:c11', contact: 'c11' }, { onglet: 'aProposer', ligne: 'marche:c11', acheteurId: 'c11' }],
  ])('ce qu’une surface écrit, le fil le relit (%o)', (cible, attendu) => {
    const a = lireArrivee(new URLSearchParams(lienFil(cible)))
    expect({ onglet: a.onglet, ligne: a.ligne, acheteurId: a.filtres?.acheteurId }).toEqual(attendu)
  })

  it('« À proposer » ne s’écrit pas', () => {
    expect(lienFil({ onglet: 'aProposer', ligne: 'm5' })).toBe('ligne=m5')
  })

  it('le pager atterrit sur le fil pour chaque lien', () => {
    for (const q of ['contact=c1', 'annonce=p:b1', 'onglet=enAttente', 'ligne=m1', 'attente=c7']) {
      expect(estArriveeFil(new URLSearchParams(q)), q).toBe(true)
    }
    expect(estArriveeFil(new URLSearchParams('page=1'))).toBe(false)
  })

  it('le paramètre des fiches', () => {
    expect(PARAM_QUI_POUR).toBe('qui')
  })
})

describe('lienPlace', () => {
  const base = { id: 'm1', contactId: 'c1', marche: false }
  it('à chaque statut sa place', () => {
    expect(lienPlace(base)).toBe('ligne=m1&contact=c1')
    expect(lienPlace({ ...base, statut: 'suggested', marche: true })).toBe('ligne=marche%3Ac1&contact=c1')
    expect(lienPlace({ ...base, statut: 'sent' })).toBe('attente=c1')
    expect(lienPlace({ ...base, statut: 'interested' })).toBe('onglet=aConclure&ligne=m1&contact=c1')
  })
  it('le fil ne porte plus un refus, une visite planifiée ni un écarté', () => {
    for (const statut of ['rejected', 'visit_planned', 'ignored']) expect(lienPlace({ ...base, statut }), statut).toBeNull()
  })
})

describe('ligneCourante', () => {
  const ordre = ['correction:cs9:prix', 'bien:p3', 'm22', 'marche:c11']
  it('le choix, s’il est dans l’ordre', () => {
    expect(ligneCourante('marche:c11', ordre)).toBe('marche:c11')
    expect(ligneCourante('bien:p3', ordre)).toBe('bien:p3')
  })
  it('une clé absente ne choisit rien d’autre que le défaut : la première ligne à traiter, pas un en-tête de bien', () => {
    expect(ligneCourante('m999', ordre)).toBe('correction:cs9:prix')
    expect(ligneCourante('m999', ['bien:p3', 'm22'])).toBe('m22')
    expect(ligneCourante(null, [])).toBeNull()
  })
})
```

- [ ] **Étape 2 : la jouer, elle échoue**

```bash
npx vitest run tests/unit/fil-liens-arrivee.spec.ts
```

Attendu : échec, `Failed to resolve import "@/components/matching-fil/filLiens"`.

- [ ] **Étape 3 : écrire le module**

`src/components/matching-fil/filLiens.ts` :

```ts
/**
 * Les liens d'arrivée du fil (lot D1, conception `2026-09-23-matching-lot-d1-surfaces-design.md` §4) — module PUR :
 * ni React, ni Supabase, ni traduction.
 *
 * Le fil LIT ses paramètres une fois, à l'arrivée (`lireArrivee`) ; les surfaces qui y mènent — « Aujourd'hui »,
 * « Sa boucle », « Qui pour ce bien ? » — les ÉCRIVENT par `lienFil` et `lienPlace`, jamais à la main : un paramètre
 * renommé d'un côté ne survit pas de l'autre.
 *
 * ⚠ Un lien d'arrivée l'emporte sur les filtres que l'onglet avait retenus : `lireArrivee` rend des filtres dès qu'un
 * seul paramètre du fil est là. Une ligne sans onglet ouvre « À proposer ».
 * ⚠ `?attente=`, pas `?retours=` : le filet secondaire de `redirection-ouverte.spec.ts` lit tout paramètre qui
 * commence par `retour` comme une URL de retour.
 * ⛔ Pas de `?annonce=m:` : le fil range les annonces du marché dans les lignes « Marché », qu'un filtre de bien écarte
 * (`construireSelections`) — aucune surface n'y mène (§10 de la conception).
 */
import { bienDeCle, cleSelection, type FilFiltres } from './filModele'
import { cleAttente, ONGLETS, type FilOnglet } from './filBoucle'

/** Ce qu'un lien d'arrivée demande au fil. */
interface ArriveeFil {
  /** Les filtres qu'il impose ; `null` : aucun lien, les filtres retenus restent. */
  filtres: FilFiltres | null
  /** L'onglet qu'il ouvre ; `null` : l'onglet retenu reste. */
  onglet: FilOnglet | null
  /** La ligne à choisir, une clé de l'ordre du fil ; absente de l'ordre, elle ne choisit rien (`ligneCourante`). */
  ligne: string | null
}

/** Ce qu'une surface demande au fil. */
interface CibleFil {
  onglet?: FilOnglet
  /** Une clé de l'ordre du fil : un match, `bien:<id>`, `marche:<contact>`, `correction:<recherche>:<motif>`. */
  ligne?: string
  /** Ouvre « Retours de … » de cet acheteur, dans « En attente ». */
  attente?: string
  /** Filtre le fil sur l'acheteur. */
  contact?: string
}

/** Les paramètres du fil — ceux sur lesquels le pager de Matching atterrit aussi (`estArriveeFil`). */
const PARAMETRES = ['contact', 'annonce', 'onglet', 'ligne', 'attente'] as const

/** Le paramètre d'une fiche de bien qui la fait défiler jusqu'à « Qui pour ce bien ? » (conception §7). */
export const PARAM_QUI_POUR = 'qui'

const valeur = (v: string | null): string | null => (v?.trim() ? v.trim() : null)

/** La page porte un lien d'arrivée du fil. */
export function estArriveeFil(params: URLSearchParams): boolean {
  return PARAMETRES.some((p) => params.has(p))
}

/**
 * Lit un lien d'arrivée. Rien d'inconnu ne casse le fil : un onglet inconnu est ignoré, une ligne absente de l'ordre ne
 * choisira rien. `?attente=` l'emporte sur `?onglet=` et `?ligne=` : il désigne une ligne d'« En attente ».
 */
export function lireArrivee(params: URLSearchParams): ArriveeFil {
  if (!estArriveeFil(params)) return { filtres: null, onglet: null, ligne: null }
  const attente = valeur(params.get('attente'))
  const annonce = valeur(params.get('annonce'))
  const brut = params.get('onglet')
  const ongletDemande = (ONGLETS as readonly (string | null)[]).includes(brut) ? brut as FilOnglet : null
  const ligne = attente ? cleAttente(attente) : valeur(params.get('ligne'))
  return {
    filtres: {
      bienId: annonce?.startsWith('p:') ? valeur(annonce.slice(2)) : null,
      acheteurId: valeur(params.get('contact')) ?? attente,
      texte: '',
    },
    onglet: attente ? 'enAttente' : ongletDemande ?? (ligne ? 'aProposer' : null),
    ligne,
  }
}

/** La requête d'un lien vers le fil (sans `?`). « À proposer » ne s'écrit pas : c'est l'onglet d'une ligne sans onglet. */
export function lienFil(c: CibleFil): string {
  const p = new URLSearchParams()
  if (c.attente) {
    p.set('attente', c.attente)
  } else {
    if (c.onglet && c.onglet !== 'aProposer') p.set('onglet', c.onglet)
    if (c.ligne) p.set('ligne', c.ligne)
    if (c.contact) p.set('contact', c.contact)
  }
  return p.toString()
}

/**
 * La place d'un match dans le fil, selon son statut : « Retours de … » s'il attend une réponse, « À conclure » s'il
 * intéresse, sa ligne s'il est à proposer — la ligne « Marché » de l'acheteur pour une annonce du marché, que le fil
 * range là. `null` : le fil ne le porte plus (refusé, visite planifiée, écarté).
 */
export function lienPlace(m: { id: string; statut?: string | null; contactId: string; marche: boolean }): string | null {
  switch (m.statut ?? 'suggested') {
    case 'suggested': return lienFil({ ligne: m.marche ? cleSelection(m.contactId) : m.id, contact: m.contactId })
    case 'sent': return lienFil({ attente: m.contactId })
    case 'interested': return lienFil({ onglet: 'aConclure', ligne: m.id, contact: m.contactId })
    default: return null
  }
}

/**
 * La ligne courante du fil : le choix, s'il est dans l'ordre ; sinon la première ligne À TRAITER — pas l'en-tête d'un
 * bien (« Qui pour ce bien ? », lot C) : on arrive sur un match. Une ligne demandée par un lien et absente de l'ordre
 * (déjà traitée, filtrée) ne choisit donc rien d'autre que ce défaut.
 */
export function ligneCourante(choix: string | null, ordre: readonly string[]): string | null {
  if (choix && ordre.includes(choix)) return choix
  return ordre.find((k) => bienDeCle(k) == null) ?? ordre[0] ?? null
}
```

- [ ] **Étape 4 : la jouer, elle passe**

```bash
npx vitest run tests/unit/fil-liens-arrivee.spec.ts
```

Attendu : `Tests  18 passed`.

---

## Tâche 2 : le fil lit ses liens d'arrivée

**Fichiers :**
- Modifier : `src/components/matching-fil/MatchingFil.tsx`
- Modifier : `src/pages/agent/MatchingPage.tsx`

- [ ] **Étape 1 : l'import**

Dans `MatchingFil.tsx`, sous `import { cleAttente, construireAConclure, … } from './filBoucle'` :

```ts
import { ligneCourante, lireArrivee } from './filLiens'
```

- [ ] **Étape 2 : lire le lien d'arrivée**

Remplacer :

```ts
  // Les liens entrants de l'atelier gardent leur sens (§3.4) : `?contact=` filtre sur l'acheteur,
  // `?annonce=p:<uuid>` sur le bien. Lus une fois, à l'arrivée.
  const [filtresArrivee] = useState<FilFiltres | null>(() => {
    const annonce = params.get('annonce')
    const contact = params.get('contact')
    if (!annonce && !contact) return null
    return { bienId: annonce?.startsWith('p:') ? annonce.slice(2) : null, acheteurId: contact, texte: '' }
  })
```

par :

```ts
  // Les liens d'arrivée (`filLiens.ts`, conception de D1 §4) : `?contact=` et `?annonce=p:<uuid>` — ceux de l'atelier,
  // qui gardent leur sens —, et `?onglet=`, `?ligne=<clé>`, `?attente=<contact>`. Lus une fois, à l'arrivée.
  const [arrivee] = useState(() => lireArrivee(params))
  const filtresArrivee = arrivee.filtres
```

- [ ] **Étape 3 : l'onglet et la ligne demandés**

Remplacer :

```ts
  const [ongletRetenu, setOngletRetenu] = useTabScopedState<FilOnglet>('fil.onglet', 'aProposer')
  const onglet = ongletValide(ongletRetenu)
  const [choix, setChoix] = useState<string | null>(null)
```

par :

```ts
  const [ongletRetenu, setOngletRetenu] = useTabScopedState<FilOnglet>('fil.onglet', arrivee.onglet ?? 'aProposer')
  // La ligne d'un lien d'arrivée est le premier choix ; absente de l'ordre, elle ne choisit rien (`ligneCourante`).
  const [choix, setChoix] = useState<string | null>(arrivee.ligne)
```

Puis, juste sous `const filtres = pivotConsomme || !filtresArrivee ? filtresRetenus : filtresArrivee` :

```ts
  // L'onglet d'un lien d'arrivée l'emporte sur l'onglet retenu, par la même mécanique que les filtres.
  const onglet = ongletValide(pivotConsomme || !arrivee.onglet ? ongletRetenu : arrivee.onglet)
```

- [ ] **Étape 4 : l'effet qui consomme le lien écrit aussi l'onglet**

Remplacer :

```ts
  useEffect(() => {
    if (pivotConsomme || !filtresArrivee || chargementOnglets) return
    setFiltres(filtresArrivee)
    setPivotConsomme(true)
  }, [pivotConsomme, filtresArrivee, setFiltres, chargementOnglets])
```

par :

```ts
  useEffect(() => {
    if (pivotConsomme || !filtresArrivee || chargementOnglets) return
    setFiltres(filtresArrivee)
    if (arrivee.onglet) setOngletRetenu(arrivee.onglet)
    setPivotConsomme(true)
  }, [pivotConsomme, filtresArrivee, arrivee.onglet, setFiltres, setOngletRetenu, chargementOnglets])
```

- [ ] **Étape 5 : la ligne courante passe par `ligneCourante`**

Remplacer :

```ts
  const parDefaut = ordre.find((k) => bienDeCle(k) == null) ?? ordre[0] ?? null
  const courant = choix && ordre.includes(choix) ? choix : parDefaut
```

par :

```ts
  const courant = ligneCourante(choix, ordre)
```

(`bienDeCle` garde deux lecteurs dans le fichier : son import reste.)

- [ ] **Étape 6 : la ligne d'arrivée prend le focus une fois**

Juste sous la déclaration de `focaliserBien` (le `useCallback` qui suit `focaliser`) :

```ts
  // La ligne d'un lien d'arrivée prend le focus UNE fois, quand elle paraît dans l'ordre : le fil défile jusqu'à elle
  // et son clavier est prêt. Absente (déjà traitée, filtrée), ou choix déjà changé par l'agent, jamais.
  const arriveeVue = useRef(arrivee.ligne == null)
  useEffect(() => {
    if (arriveeVue.current || !arrivee.ligne || choix !== arrivee.ligne || !ordre.includes(arrivee.ligne)) return
    arriveeVue.current = true
    focaliser(arrivee.ligne)
  }, [ordre, choix, arrivee.ligne, focaliser])
```

- [ ] **Étape 7 : le pager atterrit sur le fil pour chaque lien**

Dans `src/pages/agent/MatchingPage.tsx`, ajouter l'import :

```ts
import { estArriveeFil } from '@/components/matching-fil/filLiens'
```

Remplacer `searchParams.has('contact') || searchParams.has('annonce') || atterrissage === 'score'` par `estArriveeFil(searchParams) || atterrissage === 'score'`, et `const pivot = searchParams.has('contact') || searchParams.has('annonce')` par `const pivot = estArriveeFil(searchParams)`. Dans le commentaire au-dessus du premier (« Arrivée pivotée … un `?contact=` / `?annonce=` cible l'Atelier »), écrire « un lien d'arrivée du fil (`estArriveeFil` : `?contact=`, `?annonce=`, `?onglet=`, `?ligne=`, `?attente=`) cible la page 0 ».

- [ ] **Étape 8 : compiler et jouer les specs du fil**

```bash
npx tsc -b
npx vitest run tests/unit/fil-liens-arrivee.spec.ts tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/matching-fil-signaux.spec.ts tests/unit/matching-fil-apprendre.spec.ts
```

Attendu : `tsc` sort en 0 ; toutes les specs vertes. `FilFiltres` reste importé (`SANS_FILTRE` le lit) ; si `eslint` le dit inutilisé, retirer l'import de type seulement.

- [ ] **Étape 9 : regarder le banc**

Serveur de dev sur le port 5173 (config `dev` de `.claude/launch.json`), puis ouvrir :

- `http://localhost:5173/dev/crm?entree=%2Fdashboard%2Fmatching%3Fattente%3Dc7` → onglet « En attente », filtré sur Emma, la feuille « Retours à consigner pour Emma Schneider » ouverte à droite, sa ligne focalisée ;
- `http://localhost:5173/dev/crm?entree=%2Fdashboard%2Fmatching%3Fligne%3Dm5%26contact%3Dc10` → « À proposer », filtré sur Antoine, son bien revenu (Cologny) choisi ;
- `http://localhost:5173/dev/crm?entree=%2Fdashboard%2Fmatching%3Fligne%3Dm999` → « À proposer », sans filtre, la première ligne à traiter choisie : rien ne casse.

---

## Tâche 3 : la base — les actions du jour, les acheteurs de la pige, le type des rappels

**Fichiers :**
- Créer : `supabase/migrations/20260923120000_matching_surfaces.sql`
- Modifier : `src/types/database.ts`
- Créer : `tests/backend/matching-actions-du-jour.spec.ts`
- Créer : `tests/backend/pige-acheteurs.spec.ts`

- [ ] **Étape 1 : écrire la spec des actions du jour**

`tests/backend/matching-actions-du-jour.spec.ts` :

```ts
// Matching · lot D1 — `matching_actions_du_jour` et `today_absence` (migration 20260923120000_matching_surfaces.sql).
//   A1  les quatre sortes, dans l'ordre : retours dus, baisses (la plus forte d'abord), nouveaux mandats, marché.
//   A2  cinq au plus par défaut, vingt au plus demandé ; `total` compte tout, avant la coupe.
//   A3  un retour ne compte que ses biens encore sans réponse ; une relance dont aucun bien n'attend, ou pas encore
//       échue, ne fait pas de retour.
//   A4  le cloisonnement : rien d'une autre agence ; un appelant anonyme est refusé.
//   A5  le marché nomme UNE annonce, compte au-delà ; un bien déjà proposé n'y est pas (sa baisse est l'action 2).
//   A6  ni prix nul, ni revenu reporté, ni annonce retirée, ni mandat ancien.
//   T1  `today_absence` : une relance de proposition dit son type et ses biens encore sans réponse.
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { anonClient, serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const JOUR = 86_400_000
const ilYA = (jours: number) => new Date(Date.now() - jours * JOUR).toISOString()
const dansJours = (jours: number) => new Date(Date.now() + jours * JOUR).toISOString()

interface Action {
  genre: string; contact_id: string | null; prenom: string | null; match_id: string | null; property_id: string | null
  market_listing_id: string | null; statut: string | null; titre: string | null; ville: string | null; nombre: number | null
  nouveaux: number | null; baisses: number | null; montant: number | string | null; total: number
}

describe.skipIf(!HAS_KEYS)('matching · lot D1 — les actions du jour', () => {
  let s: TwoAgenciesSetup
  let svc: SupabaseClient
  const contacts: string[] = []
  const annonces: string[] = []
  const biens: string[] = []
  const matchs: string[] = []
  const relances: string[] = []

  const mkContact = async (agencyId: string, prenom: string) => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: prenom, last_name: `D1 ${s.stamp}`, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contacts ${prenom}: ${error.message}`)
    contacts.push(data.id as string)
    return data.id as string
  }
  /**
   * ⚠ Les champs de la pige se posent À L'INSERTION : `trg_ra_price_status` remet `first_seen_at`,
   * `price_at_first_seen` et `price_reduced_at` à leur valeur d'avant sur tout UPDATE. Par défaut une annonce est
   * VIEILLE (vue il y a 60 jours, jamais baissée) : elle ne fait aucun signal « marché » sans qu'on le demande.
   */
  const mkAnnonce = async (tag: string, champs: Record<string, unknown> = {}) => {
    const prix = (champs.current_price ?? champs.price ?? 1_200_000) as number
    const { data, error } = await svc.from('market_listings').insert({
      source_id: `d1-${tag}-${s.stamp}`, source_portal: 'flatfox', title: `D1 ${tag} ${s.stamp}`,
      city: 'Genève', canton: 'GE', type: 'apartment', transaction_type: 'buy', quality_score: 70, status: 'active',
      price: prix, current_price: prix, price_at_first_seen: prix, first_seen_at: ilYA(60), ...champs,
    }).select('id').single()
    if (error) throw new Error(`market_listings ${tag}: ${error.message}`)
    annonces.push(data.id as string)
    return data.id as string
  }
  const mkBien = async (tag: string, champs: Record<string, unknown>) => {
    const { data, error } = await svc.from('properties').insert({
      agency_id: s.agencyAId, title: `D1 ${tag} ${s.stamp}`, type: 'apartment', transaction_type: 'buy', price: 1_500_000, ...champs,
    }).select('id').single()
    if (error) throw new Error(`properties ${tag}: ${error.message}`)
    biens.push(data.id as string)
    return data.id as string
  }
  const mkMatch = async (agencyId: string, contactId: string, cible: { annonce?: string; bien?: string }, champs: Record<string, unknown> = {}) => {
    const { data, error } = await svc.from('matches').insert({
      agency_id: agencyId, contact_id: contactId, score: 80, status: 'suggested',
      source: cible.annonce ? 'market' : 'internal', market_listing_id: cible.annonce ?? null, property_id: cible.bien ?? null, ...champs,
    }).select('id').single()
    if (error) throw new Error(`matches: ${error.message}`)
    matchs.push(data.id as string)
    return data.id as string
  }
  const mkRelance = async (agencyId: string, contactId: string, ids: string[], triggerAt: string) => {
    const { data, error } = await svc.from('reminders').insert({
      agency_id: agencyId, contact_id: contactId, type: 'follow_up_sent_property', trigger_rule: 'manual', trigger_days: 3,
      trigger_at: triggerAt, status: 'pending', channel: 'task', match_id: ids[0], match_ids: ids.length > 1 ? ids : null,
      message_template: 'Retour (spec D1)',
    }).select('id').single()
    if (error) throw new Error(`reminders: ${error.message}`)
    relances.push(data.id as string)
    return data.id as string
  }
  const actions = async (client: SupabaseClient, limite?: number): Promise<Action[]> => {
    const { data, error } = limite == null
      ? await client.rpc('matching_actions_du_jour')
      : await client.rpc('matching_actions_du_jour', { p_limite: limite })
    if (error) throw new Error(error.message)
    return (data ?? []) as Action[]
  }

  let julie = '', clara = '', theo = '', antoine = '', emma = '', anastasia = '', bob = '', leurre = '', chezB = ''
  let mandatNeuf = '', mTheo = '', mAntoine = '', annonceBob = ''

  beforeAll(async () => {
    s = await setupTwoAgencies()
    svc = serviceRoleClient()
    const A = s.agencyAId
    julie = await mkContact(A, 'Julie')
    clara = await mkContact(A, 'Clara')
    theo = await mkContact(A, 'Théo')
    antoine = await mkContact(A, 'Antoine')
    emma = await mkContact(A, 'Emma')
    anastasia = await mkContact(A, 'Anastasia')
    bob = await mkContact(A, 'Bob')
    leurre = await mkContact(A, 'Leurre')

    // A1/A3 — Julie : deux biens proposés sans réponse, sous une relance échue ; sa seconde relance échue ne couvre
    // qu'un refus. Clara : une relance échue dont le seul bien a sa réponse. Le leurre : une relance à venir.
    const j1 = await mkMatch(A, julie, { annonce: await mkAnnonce('j1') }, { status: 'sent', sent_at: ilYA(5), prix_propose: 1_200_000 })
    const j2 = await mkMatch(A, julie, { annonce: await mkAnnonce('j2') }, { status: 'sent', sent_at: ilYA(5), prix_propose: 1_200_000 })
    const j3 = await mkMatch(A, julie, { annonce: await mkAnnonce('j3') }, { status: 'rejected', sent_at: ilYA(9), reaction_motif: 'quartier' })
    await mkRelance(A, julie, [j1, j2], ilYA(1))
    await mkRelance(A, julie, [j3], ilYA(3))
    const c1 = await mkMatch(A, clara, { annonce: await mkAnnonce('c1') }, { status: 'interested', sent_at: ilYA(6) })
    await mkRelance(A, clara, [c1], ilYA(2))
    const l1 = await mkMatch(A, leurre, { annonce: await mkAnnonce('l1') }, { status: 'sent', sent_at: ilYA(1), prix_propose: 1_200_000 })
    await mkRelance(A, leurre, [l1], dansJours(2))

    // A1/A6 — les baisses : Théo (proposé à 1'500'000, l'annonce est à 1'400'000) et Antoine (refusé pour le prix à
    // 1'700'000, revenu à 1'400'000) ; la plus forte d'abord. Leurres : un prix nul, un revenu reporté, une annonce retirée.
    mTheo = await mkMatch(A, theo, { annonce: await mkAnnonce('theo', { price: 1_400_000 }) }, { status: 'sent', sent_at: ilYA(4), prix_propose: 1_500_000 })
    mAntoine = await mkMatch(A, antoine, { annonce: await mkAnnonce('antoine', { price: 1_400_000 }) }, { status: 'suggested', sent_at: ilYA(10), reaction_motif: 'prix', prix_propose: 1_700_000 })
    await mkMatch(A, leurre, { annonce: await mkAnnonce('prix-nul', { price: 0 }) }, { status: 'sent', sent_at: ilYA(4), prix_propose: 1_500_000 })
    await mkMatch(A, leurre, { annonce: await mkAnnonce('reporte', { price: 1_000_000 }) }, { status: 'suggested', reaction_motif: 'prix', prix_propose: 1_500_000, snoozed_until: dansJours(3) })
    await mkMatch(A, leurre, { annonce: await mkAnnonce('retiree', { price: 1_000_000, status: 'removed' }) }, { status: 'sent', sent_at: ilYA(4), prix_propose: 1_500_000 })

    // A1/A6 — un nouveau mandat (mis en service il y a 2 jours) où Emma est compatible ; un mandat ancien (40 jours).
    mandatNeuf = await mkBien('neuf', { status: 'active', published_at: ilYA(2) })
    await mkMatch(A, emma, { bien: mandatNeuf })
    const ancien = await mkBien('ancien', { status: 'active', published_at: ilYA(40), mandate_signed_at: ilYA(45) })
    await mkMatch(A, emma, { bien: ancien })

    // A5 — le marché : Anastasia, une annonce nouvelle et une en baisse ; Bob, une seule, nommée, et une vieille qui ne
    // compte pas. Le bien revenu d'Antoine, déjà proposé, n'y est pas.
    await mkMatch(A, anastasia, { annonce: await mkAnnonce('ana-nouveau', { first_seen_at: ilYA(1) }) })
    await mkMatch(A, anastasia, { annonce: await mkAnnonce('ana-baisse', {
      price: 1_300_000, price_at_first_seen: 1_500_000, price_reduced_at: ilYA(2), first_seen_at: ilYA(30),
    }) })
    annonceBob = await mkAnnonce('bob', { first_seen_at: ilYA(1.5), city: 'Carouge' })
    await mkMatch(A, bob, { annonce: annonceBob })
    await mkMatch(A, bob, { annonce: await mkAnnonce('bob-vieille', { first_seen_at: ilYA(20) }) })

    // A4 — chez B, un retour dû.
    chezB = await mkContact(s.agencyBId, 'ChezB')
    const b1 = await mkMatch(s.agencyBId, chezB, { annonce: await mkAnnonce('b1') }, { status: 'sent', sent_at: ilYA(5) })
    await mkRelance(s.agencyBId, chezB, [b1], ilYA(1))
  })

  afterAll(async () => {
    if (!svc) return
    // activity_events est append-only : jamais supprimé.
    if (relances.length) await svc.from('reminders').delete().in('id', relances)
    if (matchs.length) await svc.from('matches').delete().in('id', matchs)
    if (annonces.length) await svc.from('market_listings').delete().in('id', annonces)
    if (biens.length) await svc.from('properties').delete().in('id', biens)
    if (contacts.length) await svc.from('contacts').delete().in('id', contacts)
    await s.cleanup()
  })

  it('A1 — les quatre sortes, dans l’ordre', async () => {
    const a = await actions(s.clientA, 20)
    expect(a.map((x) => [x.genre, x.contact_id ?? x.property_id])).toEqual([
      ['retour', julie], ['prix', antoine], ['prix', theo], ['mandat', mandatNeuf], ['marche', anastasia], ['marche', bob],
    ])
  })

  it('A2 — cinq au plus par défaut, vingt au plus demandé ; `total` compte tout', async () => {
    expect(await actions(s.clientA)).toHaveLength(5)
    const cinq = await actions(s.clientA, 5)
    expect(cinq).toHaveLength(5)
    expect(cinq.every((x) => x.total === 6)).toBe(true)
    expect(await actions(s.clientA, 1000)).toHaveLength(6)
    expect(await actions(s.clientA, 0)).toHaveLength(1)
  })

  it('A3 — un retour ne compte que ses biens sans réponse', async () => {
    const a = await actions(s.clientA, 20)
    expect(a.filter((x) => x.genre === 'retour')).toEqual([expect.objectContaining({ contact_id: julie, prenom: 'Julie', nombre: 2 })])
    expect(a.some((x) => x.genre === 'retour' && (x.contact_id === clara || x.contact_id === leurre))).toBe(false)
  })

  it('A4 — rien d’une autre agence ; un appelant anonyme est refusé', async () => {
    expect((await actions(s.clientA, 20)).some((x) => x.contact_id === chezB)).toBe(false)
    expect((await actions(s.clientB, 20)).map((x) => [x.genre, x.contact_id])).toEqual([['retour', chezB]])
    const { error } = await anonClient().rpc('matching_actions_du_jour')
    expect(error).not.toBeNull()
  })

  it('A5 — le marché nomme une annonce, compte au-delà ; un bien déjà proposé n’y est pas', async () => {
    const a = await actions(s.clientA, 20)
    expect(a.find((x) => x.genre === 'marche' && x.contact_id === anastasia))
      .toMatchObject({ nombre: 2, nouveaux: 1, baisses: 1, titre: null, market_listing_id: null })
    expect(a.find((x) => x.genre === 'marche' && x.contact_id === bob))
      .toMatchObject({ nombre: 1, nouveaux: 1, baisses: 0, market_listing_id: annonceBob, ville: 'Carouge' })
    expect(a.some((x) => x.genre === 'marche' && x.contact_id === antoine)).toBe(false)
  })

  it('A6 — ni prix nul, ni revenu reporté, ni annonce retirée, ni mandat ancien', async () => {
    const a = await actions(s.clientA, 20)
    const prix = a.filter((x) => x.genre === 'prix')
    expect(prix.map((x) => x.match_id)).toEqual([mAntoine, mTheo])
    expect(prix.map((x) => [x.statut, Number(x.montant)])).toEqual([['suggested', 300_000], ['sent', 100_000]])
    expect(a.filter((x) => x.genre === 'mandat').map((x) => [x.property_id, x.nombre])).toEqual([[mandatNeuf, 1]])
  })

  it('T1 — today_absence : la relance de proposition dit son type et ses biens sans réponse', async () => {
    const { data, error } = await s.clientA.rpc('today_absence', { p_fallback_hours: 72 })
    expect(error).toBeNull()
    const signaux = (data as { signals: { kind: string; contact_id: string | null; reminder_type: string | null; nb_biens: number | null }[] }).signals
    const deJulie = signaux.filter((x) => x.kind === 'reminder' && x.contact_id === julie)
    expect(deJulie.map((x) => x.nb_biens).sort()).toEqual([0, 2])
    expect(deJulie.every((x) => x.reminder_type === 'follow_up_sent_property')).toBe(true)
    // Une réaction consignée n'a ni type de rappel ni biens.
    expect(signaux.filter((x) => x.kind !== 'reminder').every((x) => x.reminder_type == null && x.nb_biens == null)).toBe(true)
  })
})
```

- [ ] **Étape 2 : écrire la spec des acheteurs de la pige**

`tests/backend/pige-acheteurs.spec.ts` :

```ts
// Matching · lot D1 — `pige_acheteurs_compatibles` (migration 20260923120000_matching_surfaces.sql).
//   P1  les acheteurs compatibles d'une annonce : à proposer (reporté compris), proposé, intéressé, en visite — jamais
//       un refus ni un écarté.
//   P2  un acheteur ne compte qu'une fois par annonce : l'index unique `uq_matches_contact_market` refuse un second match,
//       et le compte est `count(distinct)` de toute façon.
//   P3  le cloisonnement : les matchs d'une autre agence ne comptent pas.
//   P4  une annonce sans acheteur ne rend pas de ligne ; 30 identifiants au plus sont lus ; un appelant anonyme est refusé.
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { anonClient, serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const dansJours = (jours: number) => new Date(Date.now() + jours * 86_400_000).toISOString()

describe.skipIf(!HAS_KEYS)('matching · lot D1 — les acheteurs de la pige', () => {
  let s: TwoAgenciesSetup
  let svc: SupabaseClient
  const contacts: string[] = []
  const annonces: string[] = []
  const matchs: string[] = []
  let annonce = '', vide = '', lointaine = '', propose = ''

  const mkContact = async (agencyId: string, nom: string) => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'Pige', last_name: `${nom} ${s.stamp}`, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contacts ${nom}: ${error.message}`)
    contacts.push(data.id as string)
    return data.id as string
  }
  const mkAnnonce = async (tag: string) => {
    const { data, error } = await svc.from('market_listings').insert({
      source_id: `pige-d1-${tag}-${s.stamp}`, source_portal: 'flatfox', title: `Pige D1 ${tag} ${s.stamp}`, city: 'Genève',
      canton: 'GE', type: 'apartment', transaction_type: 'buy', price: 1_200_000, current_price: 1_200_000, quality_score: 70, status: 'active',
    }).select('id').single()
    if (error) throw new Error(`market_listings ${tag}: ${error.message}`)
    annonces.push(data.id as string)
    return data.id as string
  }
  const mkMatch = async (agencyId: string, contactId: string, annonceId: string, champs: Record<string, unknown> = {}) => {
    const { data, error } = await svc.from('matches').insert({
      agency_id: agencyId, contact_id: contactId, score: 80, status: 'suggested', source: 'market', market_listing_id: annonceId, ...champs,
    }).select('id').single()
    if (error) throw new Error(`matches: ${error.message}`)
    matchs.push(data.id as string)
    return data.id as string
  }
  const compte = async (client: SupabaseClient, ids: string[]) => {
    const { data, error } = await client.rpc('pige_acheteurs_compatibles', { p_annonces: ids })
    if (error) throw new Error(error.message)
    return Object.fromEntries(((data ?? []) as { market_listing_id: string; acheteurs: number }[]).map((l) => [l.market_listing_id, l.acheteurs]))
  }

  beforeAll(async () => {
    s = await setupTwoAgencies()
    svc = serviceRoleClient()
    const A = s.agencyAId
    annonce = await mkAnnonce('compte')
    vide = await mkAnnonce('vide')
    for (const statut of ['suggested', 'interested', 'visit_planned', 'rejected', 'ignored']) {
      await mkMatch(A, await mkContact(A, statut), annonce, { status: statut })
    }
    propose = await mkContact(A, 'propose')
    await mkMatch(A, propose, annonce, { status: 'sent' })
    await mkMatch(A, await mkContact(A, 'reporte'), annonce, { status: 'suggested', snoozed_until: dansJours(5) })
    await mkMatch(s.agencyBId, await mkContact(s.agencyBId, 'chez-b'), annonce, { status: 'sent' })
    lointaine = await mkAnnonce('31e')
    await mkMatch(A, await mkContact(A, 'lointain'), lointaine)
  })

  afterAll(async () => {
    if (!svc) return
    if (matchs.length) await svc.from('matches').delete().in('id', matchs)
    if (annonces.length) await svc.from('market_listings').delete().in('id', annonces)
    if (contacts.length) await svc.from('contacts').delete().in('id', contacts)
    await s.cleanup()
  })

  it('P1/P3 — cinq acheteurs chez A : à proposer, reporté, proposé, intéressé, en visite ; ni refus, ni écarté, ni B', async () => {
    expect(await compte(s.clientA, [annonce])).toEqual({ [annonce]: 5 })
    expect(await compte(s.clientB, [annonce])).toEqual({ [annonce]: 1 })
  })

  it('P2 — un second match du même acheteur sur la même annonce est refusé', async () => {
    const { error } = await svc.from('matches').insert({
      agency_id: s.agencyAId, contact_id: propose, score: 70, status: 'suggested', source: 'market', market_listing_id: annonce,
    })
    expect(error?.code).toBe('23505')
    expect(await compte(s.clientA, [annonce])).toEqual({ [annonce]: 5 })
  })

  it('P4 — une annonce sans acheteur ne rend rien ; au-delà de 30 identifiants, rien n’est lu ; l’anonyme est refusé', async () => {
    expect(await compte(s.clientA, [vide])).toEqual({})
    const trenteFictifs = Array.from({ length: 30 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    expect(await compte(s.clientA, [...trenteFictifs, lointaine])).toEqual({})
    expect(await compte(s.clientA, [lointaine])).toEqual({ [lointaine]: 1 })
    const { error } = await anonClient().rpc('pige_acheteurs_compatibles', { p_annonces: [annonce] })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Étape 3 : écrire la migration**

`supabase/migrations/20260923120000_matching_surfaces.sql` :

```sql
-- Matching · lot D1 (23.09.2026) — les surfaces du CRM : « Aujourd'hui », « Ce qui a bougé », « Pendant ton absence ».
-- Conception : docs/superpowers/specs/2026-09-23-matching-lot-d1-surfaces-design.md (§5, §7bis).
--
-- 1. `matching_actions_du_jour(p_limite)` — le segment « Matching » d'« Aujourd'hui » : quatre sortes d'actions,
--    classées et coupées ICI. La page ne lit jamais les matchs de l'agence (§3 : on ne charge jamais tout pour en
--    garder cinq).
-- 2. `pige_acheteurs_compatibles(p_annonces)` — « Ce qui a bougé » : les acheteurs compatibles des annonces d'une page
--    du flux. `pige_mouvements` ne change pas : lui ajouter une colonne changerait son type de retour.
-- 3. `today_absence` — ses rappels disent leur TYPE et combien de biens attendent encore une réponse : une relance de
--    proposition ne se « reprend » pas, elle se consigne (« Retours de … » du fil). Sa sortie reste un `jsonb`.
--
-- ⚠ Deux noms NEUFS, jamais un CREATE OR REPLACE d'une fonction existante dont le type change : le date-guard de
-- `deploy.yml` rejoue les migrations du jour à chaque push (leçon du lot C). `today_absence` garde le sien.
-- ⚠ Les seuils (3, 14 et 7 jours) sont ceux de `src/components/matching-fil/filSignaux.ts` : `matching-du-jour.spec.ts`
-- les confronte.

-- ── 1. Les actions du jour ────────────────────────────────────────────────────
create or replace function public.matching_actions_du_jour(p_limite integer default 5)
returns table (
  genre text,
  contact_id uuid,
  prenom text,
  nom text,
  match_id uuid,
  property_id uuid,
  market_listing_id uuid,
  statut text,
  titre text,
  ville text,
  nombre integer,
  nouveaux integer,
  baisses integer,
  montant numeric,
  location boolean,
  quand timestamptz,
  total integer
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  with agence as (
    select public.get_user_agency_id() as id
  ),
  -- 1. Un retour dû : une relance de proposition échue dont au moins un bien attend encore sa réponse. Une ligne par
  --    acheteur, comme « En attente » dans le fil ; son échéance est la plus ancienne de ses relances échues.
  relances_dues as (
    select r.contact_id, r.trigger_at, coalesce(r.match_ids, array[r.match_id]) as ids
      from public.reminders r
      join agence a on r.agency_id = a.id
     where r.type = 'follow_up_sent_property'
       and r.status in ('pending', 'triggered', 'snoozed')
       and r.trigger_at is not null
       and r.trigger_at <= now()
       and r.contact_id is not null
  ),
  retours as (
    select 'retour'::text as genre, 1 as rang, d.contact_id,
           null::uuid as match_id, null::uuid as property_id, null::uuid as market_listing_id, null::text as statut,
           null::text as titre, null::text as ville,
           count(distinct m.id)::integer as nombre, null::integer as nouveaux, null::integer as baisses,
           null::numeric as montant, null::boolean as location, min(d.trigger_at) as quand
      from relances_dues d
      join public.matches m on m.id = any (d.ids) and m.status = 'sent'
     group by d.contact_id
  ),
  -- 2. Un prix passé sous le prix de proposition (`prix_propose`) : sur un bien proposé sans réponse, ou refusé pour le
  --    prix et revenu à proposer — le signal du lot B (`signalPrix`). Un prix nul (« prix sur demande ») n'est pas une
  --    baisse ; un match reporté attend son heure ; une annonce retirée n'est plus une occasion.
  prix as (
    select 'prix'::text, 2, m.contact_id, m.id, m.property_id, m.market_listing_id, m.status,
           coalesce(nullif(p.title, ''), nullif(ml.title, ''), p.address, ml.address),
           coalesce(p.city, ml.city),
           null::integer, null::integer, null::integer,
           m.prix_propose - x.prix,
           coalesce(p.transaction_type, ml.transaction_type) = 'rent',
           m.sent_at
      from public.matches m
      join agence a on m.agency_id = a.id
      left join public.properties p on p.id = m.property_id
      left join public.market_listings ml on ml.id = m.market_listing_id
      cross join lateral (
        select case when m.property_id is not null then p.price else coalesce(ml.current_price, ml.price) end as prix
      ) x
     where m.prix_propose is not null
       and x.prix > 0
       and x.prix < m.prix_propose
       and (m.status = 'sent'
         or (m.status = 'suggested' and m.reaction_motif = 'prix'
             and (m.snoozed_until is null or m.snoozed_until <= now())))
       and ml.status is distinct from 'removed'
  ),
  -- 3. Un nouveau mandat : signé ou mis en service il y a 7 jours au plus — la plus récente des deux dates, la règle de
  --    `signalBien` —, actif, avec au moins un acquéreur compatible. Un mandat vendu ou retiré n'est plus une occasion.
  mandats as (
    select 'mandat'::text, 3, null::uuid, null::uuid, p.id, null::uuid, null::text,
           coalesce(nullif(p.title, ''), p.address), p.city,
           count(distinct m.contact_id)::integer, null::integer, null::integer, null::numeric,
           p.transaction_type = 'rent',
           greatest(p.mandate_signed_at, p.published_at)
      from public.properties p
      join agence a on p.agency_id = a.id
      join public.matches m on m.property_id = p.id and m.agency_id = a.id
       and m.status in ('suggested', 'sent', 'interested', 'visit_planned')
     where p.status = 'active'
       and greatest(p.mandate_signed_at, p.published_at) > now() - interval '7 days'
       and greatest(p.mandate_signed_at, p.published_at) <= now()
     group by p.id
  ),
  -- 4. Le marché : par acheteur, ses annonces nouvelles (3 jours) ou en baisse (14 jours) — les seuils de
  --    `matching_fil_marche_resume`. Une annonce en baisse ne compte pas aussi comme nouvelle. ⚠ Sans les biens déjà
  --    proposés à l'acheteur (`prix_propose` posé) : leur baisse est l'action 2, un bien ne s'annonce pas deux fois.
  signaux as (
    select m.contact_id, ml.id as annonce, coalesce(nullif(ml.title, ''), ml.address) as titre, ml.city,
           ml.transaction_type,
           coalesce(ml.price_reduced_at > now() - interval '14 days'
             and ml.price_reduced_at <= now()
             and ml.price_at_first_seen > coalesce(ml.current_price, ml.price)
             and coalesce(ml.current_price, ml.price) > 0, false) as en_baisse,
           coalesce(ml.first_seen_at > now() - interval '3 days'
             and ml.first_seen_at <= now(), false) as nouveau,
           ml.price_reduced_at, ml.first_seen_at
      from public.matches m
      join agence a on m.agency_id = a.id
      join public.market_listings ml on ml.id = m.market_listing_id
     where m.status = 'suggested'
       and m.market_listing_id is not null
       and m.prix_propose is null
       and (m.snoozed_until is null or m.snoozed_until <= now())
       and ml.status is distinct from 'removed'
  ),
  -- UNE annonce est nommée ; au-delà, on compte, pour qu'un acheteur tienne en une ligne.
  marche as (
    select 'marche'::text, 4, s.contact_id, null::uuid, null::uuid,
           case when count(*) = 1 then (array_agg(s.annonce))[1] end,
           null::text,
           case when count(*) = 1 then (array_agg(s.titre))[1] end,
           case when count(*) = 1 then (array_agg(s.city))[1] end,
           count(*)::integer,
           (count(*) filter (where s.nouveau and not s.en_baisse))::integer,
           (count(*) filter (where s.en_baisse))::integer,
           null::numeric,
           bool_or(s.transaction_type = 'rent'),
           max(case when s.en_baisse then s.price_reduced_at else s.first_seen_at end)
      from signaux s
     where s.en_baisse or s.nouveau
     group by s.contact_id
  ),
  actions as (
    select * from retours
    union all select * from prix
    union all select * from mandats
    union all select * from marche
  )
  -- L'ordre dit l'urgence : un retour dû ferme la boucle, une baisse sur un bien déjà montré est l'argument le plus fort,
  -- un nouveau mandat est une occasion, le marché un flux. Dans une sorte : la plus ancienne échéance, la plus forte
  -- baisse, le plus récent.
  select x.genre, x.contact_id, c.first_name, c.last_name, x.match_id, x.property_id, x.market_listing_id, x.statut,
         x.titre, x.ville, x.nombre, x.nouveaux, x.baisses, x.montant, x.location, x.quand,
         (count(*) over ())::integer
    from actions x
    left join public.contacts c on c.id = x.contact_id
   order by x.rang,
            case when x.rang = 1 then x.quand end asc nulls last,
            case when x.rang = 2 then x.montant end desc nulls last,
            case when x.rang in (3, 4) then x.quand end desc nulls last,
            x.contact_id nulls last, x.property_id nulls last, x.match_id nulls last
   limit least(greatest(coalesce(p_limite, 5), 1), 20);
$$;

comment on function public.matching_actions_du_jour(integer) is
  'Lot D1 : le segment Matching d''Aujourd''hui — retours dus, baisses sous le prix de proposition, nouveaux mandats (7 j) avec acquéreurs compatibles, marché (nouveau 3 j, baisse 14 j, jamais proposé) ; classées, p_limite au plus (5 par défaut, 20 au plus), total avant la coupe.';

revoke all on function public.matching_actions_du_jour(integer) from public, anon;
grant execute on function public.matching_actions_du_jour(integer) to authenticated;

-- ── 2. Les acheteurs compatibles d'une page de « Ce qui a bougé » ─────────────
-- Les compatibles de « Qui pour ce bien ? » (§7) : à proposer (reportés compris), proposés, intéressés, en visite — ceux
-- qu'un refus n'a pas écartés. 30 identifiants au plus : une page du flux. Servie par `idx_matches_market_listing`.
create or replace function public.pige_acheteurs_compatibles(p_annonces uuid[])
returns table (market_listing_id uuid, acheteurs integer)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  select m.market_listing_id, count(distinct m.contact_id)::integer
    from public.matches m
   where m.agency_id = public.get_user_agency_id()
     and m.market_listing_id = any ((p_annonces)[1:30])
     and m.status in ('suggested', 'sent', 'interested', 'visit_planned')
   group by m.market_listing_id;
$$;

comment on function public.pige_acheteurs_compatibles(uuid[]) is
  'Lot D1 : « Ce qui a bougé » — les acheteurs compatibles (matchs suggested, sent, interested, visit_planned de l''agence) de 30 annonces au plus.';

revoke all on function public.pige_acheteurs_compatibles(uuid[]) from public, anon;
grant execute on function public.pige_acheteurs_compatibles(uuid[]) to authenticated;
```

Puis, dans le même fichier, `today_absence` : recopier À L'IDENTIQUE la fonction de `supabase/migrations/20260803120000_agent_presence_absence.sql` (du `create or replace function public.today_absence` à son `$function$;`, commentaires compris), précédée de :

```sql
-- ── 3. « Pendant ton absence » : le type de chaque rappel, et les biens qu'il attend ──
-- Corps de 20260803120000, À L'IDENTIQUE, plus deux clés par signal : `reminder_type` et `nb_biens` (les biens encore
-- `sent` d'une relance de proposition). Le client ouvre alors « Retours de … » au lieu de passer la relance à `done` :
-- elle se clôt quand ses réponses sont consignées (`fermer_relance_proposition`). Même signature, même `jsonb` : le
-- date-guard peut la rejouer.
```

et n'y changer que deux choses. Dans le CTE `reactions`, après `m.id as ref_id` :

```sql
      m.id                                                as ref_id,
      null::text                                          as reminder_type,
      null::integer                                       as nb_biens
```

Dans le CTE `due_reminders`, après `r.id as ref_id` :

```sql
      r.id                                                as ref_id,
      r.type                                              as reminder_type,
      case when r.type = 'follow_up_sent_property' then (
        select count(*)::integer
          from public.matches m
         where m.id = any (coalesce(r.match_ids, array[r.match_id]))
           and m.status = 'sent'
      ) end                                               as nb_biens
```

(la virgule qui suivait `ref_id` dans l'original n'existe pas : `ref_id` était la dernière colonne des deux CTE — c'est ce qui rend l'ajout sûr pour l'`union all`). Terminer par les deux lignes de droits, à l'identique :

```sql
revoke all on function public.today_absence(integer) from public, anon;
grant execute on function public.today_absence(integer) to authenticated, service_role;
```

- [ ] **Étape 4 : les types**

Dans `src/types/database.ts`, sous `Functions:` du schéma `public`, ajouter en ordre alphabétique — juste avant `matching_ajuster_recherche: {` :

```ts
      matching_actions_du_jour: {
        Args: { p_limite?: number }
        Returns: {
          baisses: number
          contact_id: string
          genre: string
          location: boolean
          market_listing_id: string
          match_id: string
          montant: number
          nom: string
          nombre: number
          nouveaux: number
          prenom: string
          property_id: string
          quand: string
          statut: string
          titre: string
          total: number
          ville: string
        }[]
      }
```

et juste avant `pige_mouvements: {` :

```ts
      pige_acheteurs_compatibles: {
        Args: { p_annonces: string[] }
        Returns: { acheteurs: number; market_listing_id: string }[]
      }
```

(Le générateur type chaque colonne d'une table rendue comme non nulle : les lecteurs relisent les lignes dans leurs propres interfaces, nullables.)

- [ ] **Étape 5 : les portes de la migration**

```bash
npm run --silent lint:migrations
npx tsc -b
```

Attendu : sortie 0 pour les deux (la migration est rejouable : tout y est `create or replace`).

- [ ] **Étape 6 : jouer les specs contre une base locale**

```bash
npx supabase db reset --local
npx vitest run --config=vitest.backend.config.ts tests/backend/matching-actions-du-jour.spec.ts tests/backend/pige-acheteurs.spec.ts tests/backend/today-absence.spec.ts
```

⛔ **Le `--config` n'est pas facultatif** : sans lui, « No test files found ». Attendu : `7 passed` + `3 passed` + la spec historique de `today_absence` inchangée. ⚠ Sur cette machine, le port 54321 est pris par un serveur Python : sans base locale, les specs rendent un 404 HTML trompeur ou sont ignorées — c'est la CI qui les joue ; **le dire dans le rapport** plutôt que de les déclarer vertes.

---

## Tâche 4 : le modèle du segment Matching

**Fichiers :**
- Modifier : `src/components/matching-fil/filSignaux.ts`
- Créer : `src/components/crm/today/matchingDuJour.ts`
- Créer : `tests/unit/matching-du-jour.spec.ts`

- [ ] **Étape 1 : exporter le seuil du nouveau mandat**

Dans `src/components/matching-fil/filSignaux.ts`, remplacer `const JOURS_MANDAT = 7` par :

```ts
export const JOURS_MANDAT = 7
```

(La base le recopie dans `matching_actions_du_jour` et le banc dans ses fixtures : `matching-du-jour.spec.ts` confronte les deux.)

- [ ] **Étape 2 : écrire la spec qui échoue**

`tests/unit/matching-du-jour.spec.ts` :

```ts
/**
 * « Aujourd'hui » — le segment Matching (lot D1, conception §5) : où chaque action mène, avec quels mots, et les seuils
 * que la base partage avec les signaux du fil.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAX_ACTIONS, versAction, type LigneAction } from '@/components/crm/today/matchingDuJour'
import { JOURS_BAISSE, JOURS_MANDAT, JOURS_NOUVEAU } from '@/components/matching-fil/filSignaux'

const ligne = (champs: Partial<LigneAction>): LigneAction => ({
  genre: 'retour', contact_id: null, prenom: null, nom: null, match_id: null, property_id: null, market_listing_id: null,
  statut: null, titre: null, ville: null, nombre: null, nouveaux: null, baisses: null, montant: null, location: null,
  quand: null, total: null, ...champs,
})

describe('versAction — où chaque action mène', () => {
  it('un retour dû ouvre « Retours de … »', () => {
    const a = versAction(ligne({ genre: 'retour', contact_id: 'c7', prenom: 'Emma', nombre: 2 }))
    expect(a).toMatchObject({ cle: 'retour:c7', genre: 'retour', cible: { vers: 'fil', requete: 'attente=c7' } })
    expect(a!.texte).toEqual({ cle: 'today.h.matching.retour', valeurs: { prenom: 'Emma', count: 2 } })
  })

  it('une baisse sur un bien proposé mène à « Retours de … »', () => {
    const a = versAction(ligne({ genre: 'prix', contact_id: 'c9', prenom: 'Julie', match_id: 'm15', market_listing_id: 'ml', statut: 'sent', montant: '50000', titre: 'Champel' }))
    expect(a).toMatchObject({ montant: 50_000, detail: 'Champel', cible: { vers: 'fil', requete: 'attente=c9' } })
    expect(a!.texte.cle).toBe('today.h.matching.prixPropose')
  })

  it('une baisse sur un bien revenu mène à sa ligne ; sur une annonce du marché, à la ligne « Marché »', () => {
    const mandat = versAction(ligne({ genre: 'prix', contact_id: 'c10', prenom: 'Antoine', match_id: 'm5', property_id: 'p2', statut: 'suggested', montant: 250_000 }))
    expect(mandat).toMatchObject({ cible: { vers: 'fil', requete: 'ligne=m5&contact=c10' } })
    expect(mandat!.texte.cle).toBe('today.h.matching.prixRefuse')
    const marche = versAction(ligne({ genre: 'prix', contact_id: 'c7', match_id: 'm20', market_listing_id: 'ml', statut: 'suggested', montant: 110_000 }))
    expect(marche).toMatchObject({ cible: { vers: 'fil', requete: 'ligne=marche%3Ac7&contact=c7' } })
  })

  it('un nouveau mandat mène à sa fiche', () => {
    expect(versAction(ligne({ genre: 'mandat', property_id: 'p3', nombre: 2, titre: 'Florissant' }))).toMatchObject({
      cle: 'mandat:p3', detail: 'Florissant', cible: { vers: 'mandat', id: 'p3' },
      texte: { cle: 'today.h.matching.mandat', valeurs: { count: 2 } },
    })
  })

  it('le marché nomme UNE annonce, et compte au-delà', () => {
    const une = versAction(ligne({ genre: 'marche', contact_id: 'c11', prenom: 'Anastasia', nouveaux: 1, baisses: 0, ville: 'Cologny', titre: 'Villa' }))
    expect(une!.texte).toEqual({ cle: 'today.h.matching.marcheNouveau', valeurs: { prenom: 'Anastasia', ville: 'Cologny', nouveaux: 1, baisses: 0 } })
    expect(une!.detail).toBe('Villa')
    expect(versAction(ligne({ genre: 'marche', contact_id: 'c11', nouveaux: 0, baisses: 1 }))!.texte.cle).toBe('today.h.matching.marcheBaisseSansVille')
    const deux = versAction(ligne({ genre: 'marche', contact_id: 'c11', nouveaux: 1, baisses: 1, titre: 'ignoré' }))
    expect(deux).toMatchObject({ detail: null, texte: { cle: 'today.h.matching.marchePlusieurs' }, cible: { requete: 'ligne=marche%3Ac11&contact=c11' } })
  })

  it('une ligne qui ne mène nulle part est écartée', () => {
    for (const l of [
      ligne({ genre: 'retour' }),
      ligne({ genre: 'prix', contact_id: 'c1', match_id: 'm1', statut: 'sent', montant: 0 }),
      ligne({ genre: 'prix', contact_id: 'c1', match_id: 'm1', statut: 'rejected', montant: 10 }),
      ligne({ genre: 'mandat' }),
      ligne({ genre: 'inconnu', contact_id: 'c1' }),
    ]) expect(versAction(l), JSON.stringify(l)).toBeNull()
  })

  it('le plafond est de cinq', () => {
    expect(MAX_ACTIONS).toBe(5)
  })
})

describe('les seuils de la base', () => {
  it('matching_actions_du_jour compte avec les seuils des signaux', () => {
    const dossier = 'supabase/migrations'
    const fichier = readdirSync(dossier).find((f) => f.endsWith('_matching_surfaces.sql'))
    expect(fichier, 'migration du lot D1 introuvable').toBeDefined()
    const sql = readFileSync(join(dossier, fichier!), 'utf8')
    expect(sql).toMatch(new RegExp(`price_reduced_at > now\\(\\) - interval '${JOURS_BAISSE} days'`))
    expect(sql).toMatch(new RegExp(`first_seen_at > now\\(\\) - interval '${JOURS_NOUVEAU} days'`))
    expect(sql).toMatch(new RegExp(`greatest\\(p\\.mandate_signed_at, p\\.published_at\\) > now\\(\\) - interval '${JOURS_MANDAT} days'`))
    // Une date FUTURE n'est pas un signal, ni à l'écran (`recente`) ni en base.
    expect(sql).toMatch(/price_reduced_at <= now\(\)/)
    expect(sql).toMatch(/first_seen_at <= now\(\)/)
  })
})
```

- [ ] **Étape 3 : la jouer, elle échoue**

```bash
npx vitest run tests/unit/matching-du-jour.spec.ts
```

Attendu : échec, `Failed to resolve import "@/components/crm/today/matchingDuJour"`.

- [ ] **Étape 4 : écrire le module**

`src/components/crm/today/matchingDuJour.ts` :

```ts
/**
 * « Aujourd'hui » — le segment Matching (lot D1, conception `2026-09-23-matching-lot-d1-surfaces-design.md` §5) :
 * modèle de vue PUR des lignes de `matching_actions_du_jour()`. Ni React, ni Supabase, ni traduction.
 *
 * La RPC classe et coupe (cinq au plus) ; ce module dit OÙ chaque action mène et avec quels MOTS — une clé et ses
 * valeurs, que l'écran traduit. Une ligne mal formée (sorte inconnue, identifiant manquant) est écartée : une action
 * sans destination serait un bouton mort.
 *
 * ⚠ Une baisse de prix mène à la PLACE du match dans le fil (`lienPlace`) : « Retours de … » s'il attend une réponse,
 * sa ligne s'il est revenu à proposer — la ligne « Marché » de l'acheteur pour une annonce du marché.
 */
import { lienFil, lienPlace } from '@/components/matching-fil/filLiens'
import { cleSelection } from '@/components/matching-fil/filModele'

/** Le plafond du segment (§5.1) : au-delà, « Voir tout » ouvre le fil. */
export const MAX_ACTIONS = 5

export type GenreAction = 'retour' | 'prix' | 'mandat' | 'marche'

/** Une ligne de `matching_actions_du_jour()`. */
export interface LigneAction {
  genre: string
  contact_id: string | null
  prenom: string | null
  nom: string | null
  match_id: string | null
  property_id: string | null
  market_listing_id: string | null
  statut: string | null
  titre: string | null
  ville: string | null
  nombre: number | null
  nouveaux: number | null
  baisses: number | null
  montant: number | string | null
  location: boolean | null
  quand: string | null
  total: number | null
}

/** Une action du segment, prête à écrire. */
export interface ActionMatching {
  /** Stable d'une lecture à l'autre : la clé React de la ligne. */
  cle: string
  genre: GenreAction
  /** Le texte : une clé `today.h.matching.*` et ses valeurs. Un `montant` s'écrit en CHF par l'écran. */
  texte: { cle: string; valeurs: Record<string, string | number> }
  /** La seconde ligne : le bien nommé, s'il y en a un. */
  detail: string | null
  montant: number | null
  location: boolean
  /** Une place du fil (sa requête), ou la fiche d'un mandat sur « Qui pour ce bien ? ». */
  cible: { vers: 'fil'; requete: string } | { vers: 'mandat'; id: string }
}

const enNombre = (v: number | string | null): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Une ligne de la RPC, écrite ; `null` si elle ne peut mener nulle part. */
export function versAction(l: LigneAction): ActionMatching | null {
  const location = l.location === true
  const prenom = l.prenom?.trim() || ''
  switch (l.genre) {
    case 'retour': {
      if (!l.contact_id) return null
      return {
        cle: `retour:${l.contact_id}`, genre: 'retour', detail: null, montant: null, location,
        texte: { cle: 'today.h.matching.retour', valeurs: { prenom, count: l.nombre ?? 0 } },
        cible: { vers: 'fil', requete: lienFil({ attente: l.contact_id }) },
      }
    }
    case 'prix': {
      const montant = enNombre(l.montant)
      if (!l.contact_id || !l.match_id || montant == null || montant <= 0) return null
      const requete = lienPlace({ id: l.match_id, statut: l.statut, contactId: l.contact_id, marche: l.market_listing_id != null })
      if (!requete) return null
      return {
        cle: `prix:${l.match_id}`, genre: 'prix', detail: l.titre?.trim() || null, montant, location,
        texte: { cle: l.statut === 'sent' ? 'today.h.matching.prixPropose' : 'today.h.matching.prixRefuse', valeurs: { prenom } },
        cible: { vers: 'fil', requete },
      }
    }
    case 'mandat': {
      if (!l.property_id) return null
      return {
        cle: `mandat:${l.property_id}`, genre: 'mandat', detail: l.titre?.trim() || null, montant: null, location,
        texte: { cle: 'today.h.matching.mandat', valeurs: { count: l.nombre ?? 0 } },
        cible: { vers: 'mandat', id: l.property_id },
      }
    }
    case 'marche': {
      if (!l.contact_id) return null
      const nouveaux = l.nouveaux ?? 0
      const baisses = l.baisses ?? 0
      const seul = nouveaux + baisses === 1
      const ville = l.ville?.trim() || ''
      const cle = !seul ? 'today.h.matching.marchePlusieurs'
        : baisses === 1 ? (ville ? 'today.h.matching.marcheBaisse' : 'today.h.matching.marcheBaisseSansVille')
          : (ville ? 'today.h.matching.marcheNouveau' : 'today.h.matching.marcheNouveauSansVille')
      return {
        cle: `marche:${l.contact_id}`, genre: 'marche', detail: seul ? l.titre?.trim() || null : null, montant: null, location,
        texte: { cle, valeurs: { prenom, ville, nouveaux, baisses } },
        cible: { vers: 'fil', requete: lienFil({ ligne: cleSelection(l.contact_id), contact: l.contact_id }) },
      }
    }
    default:
      return null
  }
}
```

- [ ] **Étape 5 : la jouer, elle passe**

```bash
npx vitest run tests/unit/matching-du-jour.spec.ts tests/unit/matching-fil-signaux.spec.ts
```

Attendu : `Tests  8 passed` pour la première ; la seconde reste verte.

---

## Tâche 5 : le segment Matching d'« Aujourd'hui », et « Dossiers » sans matchs

**Fichiers :**
- Créer : `src/components/crm/today/useMatchingDuJour.ts`
- Créer : `src/components/crm/today/HlMatching.tsx`
- Modifier : `src/components/crm/today/PageAujourdhuiH.tsx`
- Modifier : `src/pages/agent/TodayPage.tsx`
- Modifier : `src/components/crm/today/useHotDeals.ts`
- Modifier : `src/i18n/locales/{fr,en,de,it}/dashboard.json`

- [ ] **Étape 1 : la lecture**

`src/components/crm/today/useMatchingDuJour.ts` :

```ts
/**
 * « Aujourd'hui » — le segment Matching (lot D1, conception §5.2) : `matching_actions_du_jour()`, des actions déjà
 * classées et coupées côté serveur. La page ne lit jamais les matchs de l'agence.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { MAX_ACTIONS, versAction, type ActionMatching, type LigneAction } from './matchingDuJour'

interface MatchingDuJour {
  actions: ActionMatching[]
  /** Toutes sortes confondues, avant la coupe : ce que « Voir tout » promet. */
  total: number
  isLoading: boolean
  isError: boolean
}

/** Les actions de matching du jour, écrites (`versAction`). */
export function useMatchingDuJour(): MatchingDuJour {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const q = useQuery({
    queryKey: ['matching-du-jour', agencyId],
    enabled: !!agencyId,
    staleTime: 60_000,
    queryFn: async (): Promise<LigneAction[]> => {
      const { data, error } = await supabase.rpc('matching_actions_du_jour', { p_limite: MAX_ACTIONS })
      if (error) throw error
      return (data ?? []) as unknown as LigneAction[]
    },
  })
  const actions = useMemo(() => (q.data ?? []).flatMap((l) => {
    const a = versAction(l)
    return a ? [a] : []
  }), [q.data])
  return { actions, total: Number(q.data?.[0]?.total ?? 0), isLoading: q.isLoading, isError: q.isError }
}
```

- [ ] **Étape 2 : les lignes**

`src/components/crm/today/HlMatching.tsx` :

```tsx
/**
 * « Aujourd'hui » — le segment Matching (lot D1, conception §5) : cinq actions au plus, chacune avec sa raison, et un
 * geste qui mène à la bonne place du fil, ou à la fiche du mandat. Une surface MONTRE et ORIENTE ; le fil agit.
 *
 * Présentationnel : `PageAujourdhuiH` porte la lecture (`useMatchingDuJour`), le vide et l'échec.
 * ⚠ Aucun littéral de rayon, d'espacement ni de taille de texte : le cliquet de `megga-x-grammar.spec.ts` compte ceux
 * de `crm/today`.
 */
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { montant } from '@/components/matching-fil/filAffichage'
import { TK } from './tk'
import { RXIcon } from './kit'
import type { ActionMatching, GenreAction } from './matchingDuJour'

const ICONE: Record<GenreAction, string> = { retour: 'clock', prix: 'trending-down', mandat: 'home', marche: 'building' }
const CTA: Record<GenreAction, string> = {
  retour: 'today.h.matching.ctaRetour', prix: 'today.h.matching.ctaPrix',
  mandat: 'today.h.matching.ctaMandat', marche: 'today.h.matching.ctaMarche',
}

/** Le texte d'une action : ses valeurs, le montant écrit en CHF, et, au marché à plusieurs annonces, la liste comptée. */
function ecrire(a: ActionMatching, t: TFunction, tm: TFunction): string {
  const v = a.texte.valeurs
  if (a.texte.cle === 'today.h.matching.marchePlusieurs') {
    const liste = [
      Number(v.nouveaux) > 0 ? t('today.h.matching.nouveaux', { count: Number(v.nouveaux) }) : null,
      Number(v.baisses) > 0 ? t('today.h.matching.baisses', { count: Number(v.baisses) }) : null,
    ].filter(Boolean).join(', ')
    return t(a.texte.cle, { prenom: v.prenom, liste })
  }
  return t(a.texte.cle, a.montant != null ? { ...v, montant: montant(a.location, a.montant, tm) } : v)
}

function HlActionLigne({ a, premiere, onAction }: { a: ActionMatching; premiere: boolean; onAction: (a: ActionMatching) => void }) {
  const { t } = useTranslation('dashboard')
  const { t: tm } = useTranslation('matching')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) var(--crm-space-2xs)', minWidth: 0, borderTop: premiere ? 'none' : `1px solid ${TK.border}` }}>
      <span aria-hidden style={{ width: 36, height: 36, borderRadius: 'var(--crm-radius-md)', background: TK.card, color: TK.inkDim, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <RXIcon name={ICONE[a.genre]} size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: TK.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ecrire(a, t, tm)}</div>
        {a.detail && (
          <div style={{ marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: TK.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.detail}</div>
        )}
      </div>
      <button type="button" onClick={() => onAction(a)}
        style={{ flexShrink: 0, height: 32, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, fontFamily: 'inherit', background: TK.accent, color: TK.accentInk, fontSize: 'var(--crm-text-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {t(CTA[a.genre])}
      </button>
    </div>
  )
}

/** Les actions du segment, puis « Voir tout », qui ouvre le fil. */
export default function HlMatching({ actions, total, onAction, onVoirTout }: {
  actions: ActionMatching[]
  total: number
  onAction: (a: ActionMatching) => void
  onVoirTout: () => void
}) {
  const { t } = useTranslation('dashboard')
  return (
    <>
      {actions.map((a, i) => <HlActionLigne key={a.cle} a={a} premiere={i === 0} onAction={onAction} />)}
      <button type="button" onClick={onVoirTout}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-xl) var(--crm-space-2xs) var(--crm-space-2xs)', background: 'none', border: 0, borderTop: `1px solid ${TK.border}`, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: TK.inkDim }}>
          {total > actions.length ? t('today.h.matching.voirToutCompte', { count: total }) : t('today.h.matching.voirTout')}
        </span>
        <RXIcon name="arrow" size={15} sw={2.2} color={TK.sub} />
      </button>
    </>
  )
}
```

- [ ] **Étape 3 : le troisième segment**

Dans `src/components/crm/today/PageAujourdhuiH.tsx` :

a. Sous `import { useHotDeals } from './useHotDeals'` :

```ts
import HlMatching from './HlMatching'
import { useMatchingDuJour } from './useMatchingDuJour'
import type { ActionMatching } from './matchingDuJour'
```

b. Remplacer `const [zone, setZone] = useState<'dossiers' | 'annonces'>('dossiers')` par :

```ts
  const [zone, setZone] = useState<'dossiers' | 'annonces' | 'matching'>('dossiers')
```

c. Sous `const { actions: listingActions, isError: listingsError } = useListingActions()` :

```ts
  // Lot D1 — le segment Matching : cinq actions au plus, classées par la base (`matching_actions_du_jour`).
  const matching = useMatchingDuJour()
```

d. Sous `const onAnn = …` :

```ts
  // Lot D1 — une action du Matching mène à SA place du fil, ou à la fiche du mandat sur « Qui pour ce bien ? ».
  const onMatching = (a: ActionMatching) => (a.cible.vers === 'fil' ? nav('matching-fil', a.cible.requete) : nav('biens-qui-pour', a.cible.id))
```

e. Remplacer la liste des segments :

```tsx
                    {([['dossiers', t('today.h.tabs.deals')], ['annonces', t('today.h.tabs.listings')]] as const).map(([k, l]) => (
                      <button
                        key={k} onClick={() => setZone(k as 'dossiers' | 'annonces')}
                        style={{ height: 26, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap', background: zone === k ? TK.accent : 'transparent', color: zone === k ? TK.accentInk : TK.sub }}
                      >{l}</button>
                    ))}
```

par :

```tsx
                    {([['dossiers', t('today.h.tabs.deals')], ['annonces', t('today.h.tabs.listings')], ['matching', t('today.h.tabs.matching')]] as const).map(([k, l]) => (
                      <button
                        key={k} onClick={() => setZone(k)}
                        style={{ height: 26, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap', background: zone === k ? TK.accent : 'transparent', color: zone === k ? TK.accentInk : TK.sub }}
                      >
                        {l}
                        {/* Le segment dit son compte : une action ne se cache pas derrière un clic sans le dire. */}
                        {k === 'matching' && matching.total > 0 && <span style={{ marginLeft: 'var(--crm-space-xs)', fontVariantNumeric: 'tabular-nums' }}>{matching.total}</span>}
                      </button>
                    ))}
```

f. Remplacer l'en-tête droit du segment :

```tsx
                  {zone === 'dossiers'
                    ? (!dealsError && <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: TK.sub }}>{t('today.h.hotCount', { count: hotDeals.length })}</span>)
                    : <button onClick={() => nav('biens')} style={{ background: 'none', border: 0, fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: TK.sub, cursor: 'pointer', padding: 'var(--crm-space-xs) var(--crm-space-sm)', marginRight: -4 }}>{t('today.h.openListings')}</button>}
```

par :

```tsx
                  {zone === 'dossiers'
                    ? (!dealsError && <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: TK.sub }}>{t('today.h.hotCount', { count: hotDeals.length })}</span>)
                    : zone === 'annonces'
                      ? <button onClick={() => nav('biens')} style={{ background: 'none', border: 0, fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: TK.sub, cursor: 'pointer', padding: 'var(--crm-space-xs) var(--crm-space-sm)', marginRight: -4 }}>{t('today.h.openListings')}</button>
                      : (!matching.isError && !matching.isLoading && <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: TK.sub }}>{t('today.h.matching.compte', { count: matching.total })}</span>)}
```

g. Remplacer le contenu du segment « Annonces » :

```tsx
                  ) : (
                    listingActions.length
                      ? listingActions.map((a, i) => <HlAnnCard key={a.id} a={a} first={i === 0} onCta={onAnn} />)
                      : listingsError
                        ? <HlZoneError label={t('today.h.listings.error')} />
                        : <HlZoneEmpty label={t('today.h.listings.empty')} />
                  )}
```

par :

```tsx
                  ) : zone === 'annonces' ? (
                    listingActions.length
                      ? listingActions.map((a, i) => <HlAnnCard key={a.id} a={a} first={i === 0} onCta={onAnn} />)
                      : listingsError
                        ? <HlZoneError label={t('today.h.listings.error')} />
                        : <HlZoneEmpty label={t('today.h.listings.empty')} />
                  ) : (
                    // Pendant la lecture, rien : « à jour » serait une affirmation, et elle serait fausse.
                    matching.actions.length
                      ? <HlMatching actions={matching.actions} total={matching.total} onAction={onMatching} onVoirTout={() => nav('matching')} />
                      : matching.isError
                        ? <HlZoneError label={t('today.h.matching.erreur')} />
                        : matching.isLoading ? null : <HlZoneEmpty label={t('today.h.matching.vide')} />
                  )}
```

- [ ] **Étape 4 : les deux cibles de navigation**

Dans `src/pages/agent/TodayPage.tsx`, ajouter l'import :

```ts
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
```

et, dans le `switch` d'`onNavigate`, juste sous `case 'matching': …` :

```ts
      // Lot D1 : une place précise du fil (la requête de `lienFil`), et la fiche d'un mandat défilée jusqu'à « Qui pour
      // ce bien ? ». ⛔ Gabarits ANCRÉS (`/dashboard/…`) : `redirection-ouverte.spec.ts` refuse un puits dynamique.
      case 'matching-fil': navigate(`/dashboard/matching${ref ? `?${ref}` : ''}`); break
      case 'biens-qui-pour': navigate(ref ? `/dashboard/listings/${ref}?${PARAM_QUI_POUR}=1` : '/dashboard/listings'); break
```

- [ ] **Étape 5 : « Dossiers » sans matchs**

Dans `src/components/crm/today/useHotDeals.ts`, remplacer :

```ts
    const queue: FocusItem[] = selectFocusQueue({ live: isLive, items, isDemo: false })
```

par :

```ts
    // Lot D1 : les matchs ont quitté « Dossiers ». Ils vivent dans le segment Matching, avec leur raison
    // (`matching_actions_du_jour`) ; ici, un même match s'affichait une seconde fois, sans elle.
    const queue: FocusItem[] = selectFocusQueue({ live: isLive, items, isDemo: false }).filter((it) => it.type !== 'match')
```

et retirer les entrées devenues mortes : `match: 'today.h.deals.ctaMatch',` de `CTA_BY_TYPE`, `match: 'spark',` de `ICON_BY_TYPE` (garder le reste de la ligne), `MATCH: '#6F8CFF',` de `DOT_BY_CATEGORY`. Le mobile (`MobileTodayScreen`) lit `useFocusQueue` directement : il garde ses matchs, il n'est pas repris (conception §8).

- [ ] **Étape 6 : les libellés**

```bash
python3 - <<'EOF'
import json

def ecrire(ns, lang, poser=(), retirer=()):
    p = f'src/i18n/locales/{lang}/{ns}.json'
    d = json.load(open(p, encoding='utf-8'))
    for chemin in retirer:
        *tete, fin = chemin.split('.')
        noeud = d
        for k in tete:
            noeud = noeud[k]
        del noeud[fin]
    for chemin, valeur in poser:
        *tete, fin = chemin.split('.')
        noeud = d
        for k in tete:
            noeud = noeud.setdefault(k, {})
        noeud[fin] = valeur
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')

MATCHING = {
  'fr': {
    'compte_one': '{{count}} action', 'compte_other': '{{count}} actions',
    'retour_one': 'Retour à consigner pour {{prenom}} · {{count}} bien', 'retour_other': 'Retour à consigner pour {{prenom}} · {{count}} biens',
    'prixPropose': 'Prix baissé de {{montant}} sur le bien proposé à {{prenom}}',
    'prixRefuse': 'Prix baissé de {{montant}} sur le bien refusé par {{prenom}}',
    'mandat_one': 'Nouveau mandat · {{count}} acquéreur compatible', 'mandat_other': 'Nouveau mandat · {{count}} acquéreurs compatibles',
    'marcheNouveau': 'Nouveau bien à {{ville}} pour {{prenom}}', 'marcheNouveauSansVille': 'Nouveau bien pour {{prenom}}',
    'marcheBaisse': 'Bien en baisse à {{ville}} pour {{prenom}}', 'marcheBaisseSansVille': 'Bien en baisse pour {{prenom}}',
    'marchePlusieurs': '{{prenom}} · {{liste}}',
    'nouveaux_one': '{{count}} nouveau bien', 'nouveaux_other': '{{count}} nouveaux biens',
    'baisses_one': '{{count}} en baisse', 'baisses_other': '{{count}} en baisse',
    'ctaRetour': 'Consigner', 'ctaPrix': 'Ouvrir', 'ctaMandat': 'Voir qui', 'ctaMarche': 'Voir les biens',
    'voirTout': 'Voir tout dans le Matching',
    'voirToutCompte_one': "Voir l'action dans le Matching", 'voirToutCompte_other': 'Voir les {{count}} actions dans le Matching',
    'vide': "Aucune action de matching aujourd'hui.",
    'erreur': 'Actions de matching indisponibles : le chargement a échoué.',
  },
  'en': {
    'compte_one': '{{count}} action', 'compte_other': '{{count}} actions',
    'retour_one': 'Feedback to record for {{prenom}} · {{count}} property', 'retour_other': 'Feedback to record for {{prenom}} · {{count}} properties',
    'prixPropose': 'Price down {{montant}} on the property proposed to {{prenom}}',
    'prixRefuse': 'Price down {{montant}} on the property {{prenom}} declined',
    'mandat_one': 'New mandate · {{count}} matching buyer', 'mandat_other': 'New mandate · {{count}} matching buyers',
    'marcheNouveau': 'New property in {{ville}} for {{prenom}}', 'marcheNouveauSansVille': 'New property for {{prenom}}',
    'marcheBaisse': 'Price drop in {{ville}} for {{prenom}}', 'marcheBaisseSansVille': 'Price drop for {{prenom}}',
    'marchePlusieurs': '{{prenom}} · {{liste}}',
    'nouveaux_one': '{{count}} new property', 'nouveaux_other': '{{count}} new properties',
    'baisses_one': '{{count}} price drop', 'baisses_other': '{{count}} price drops',
    'ctaRetour': 'Record', 'ctaPrix': 'Open', 'ctaMandat': 'See who', 'ctaMarche': 'See properties',
    'voirTout': 'See all in Matching',
    'voirToutCompte_one': 'See the action in Matching', 'voirToutCompte_other': 'See all {{count}} actions in Matching',
    'vide': 'No matching action today.',
    'erreur': 'Matching actions unavailable: loading failed.',
  },
  'de': {
    'compte_one': '{{count}} Aktion', 'compte_other': '{{count}} Aktionen',
    'retour_one': 'Rückmeldung von {{prenom}} erfassen · {{count}} Objekt', 'retour_other': 'Rückmeldung von {{prenom}} erfassen · {{count}} Objekte',
    'prixPropose': 'Preis um {{montant}} gesenkt beim Objekt, das {{prenom}} vorgeschlagen wurde',
    'prixRefuse': 'Preis um {{montant}} gesenkt beim Objekt, das {{prenom}} abgelehnt hat',
    'mandat_one': 'Neues Mandat · {{count}} passender Käufer', 'mandat_other': 'Neues Mandat · {{count}} passende Käufer',
    'marcheNouveau': 'Neues Objekt in {{ville}} für {{prenom}}', 'marcheNouveauSansVille': 'Neues Objekt für {{prenom}}',
    'marcheBaisse': 'Preissenkung in {{ville}} für {{prenom}}', 'marcheBaisseSansVille': 'Preissenkung für {{prenom}}',
    'marchePlusieurs': '{{prenom}} · {{liste}}',
    'nouveaux_one': '{{count}} neues Objekt', 'nouveaux_other': '{{count}} neue Objekte',
    'baisses_one': '{{count}} Preissenkung', 'baisses_other': '{{count}} Preissenkungen',
    'ctaRetour': 'Erfassen', 'ctaPrix': 'Öffnen', 'ctaMandat': 'Wer passt', 'ctaMarche': 'Objekte ansehen',
    'voirTout': 'Alles im Matching ansehen',
    'voirToutCompte_one': 'Die Aktion im Matching ansehen', 'voirToutCompte_other': 'Alle {{count}} Aktionen im Matching ansehen',
    'vide': 'Heute keine Matching-Aktion.',
    'erreur': 'Matching-Aktionen nicht verfügbar: Laden fehlgeschlagen.',
  },
  'it': {
    'compte_one': '{{count}} azione', 'compte_other': '{{count}} azioni',
    'retour_one': 'Riscontro da registrare per {{prenom}} · {{count}} immobile', 'retour_other': 'Riscontro da registrare per {{prenom}} · {{count}} immobili',
    'prixPropose': "Prezzo ribassato di {{montant}} sull'immobile proposto a {{prenom}}",
    'prixRefuse': "Prezzo ribassato di {{montant}} sull'immobile rifiutato da {{prenom}}",
    'mandat_one': 'Nuovo mandato · {{count}} acquirente compatibile', 'mandat_other': 'Nuovo mandato · {{count}} acquirenti compatibili',
    'marcheNouveau': 'Nuovo immobile a {{ville}} per {{prenom}}', 'marcheNouveauSansVille': 'Nuovo immobile per {{prenom}}',
    'marcheBaisse': 'Ribasso a {{ville}} per {{prenom}}', 'marcheBaisseSansVille': 'Ribasso per {{prenom}}',
    'marchePlusieurs': '{{prenom}} · {{liste}}',
    'nouveaux_one': '{{count}} nuovo immobile', 'nouveaux_other': '{{count}} nuovi immobili',
    'baisses_one': '{{count}} ribasso', 'baisses_other': '{{count}} ribassi',
    'ctaRetour': 'Registra', 'ctaPrix': 'Apri', 'ctaMandat': 'Vedi chi', 'ctaMarche': 'Vedi gli immobili',
    'voirTout': 'Vedi tutto nel Matching',
    'voirToutCompte_one': "Vedi l'azione nel Matching", 'voirToutCompte_other': 'Vedi tutte le {{count}} azioni nel Matching',
    'vide': 'Nessuna azione di matching oggi.',
    'erreur': 'Azioni di matching non disponibili: caricamento non riuscito.',
  },
}
for lang, cles in MATCHING.items():
    ecrire('dashboard', lang,
           poser=[('today.h.tabs.matching', 'Matching'), ('today.h.matching', cles)],
           retirer=['today.h.deals.ctaMatch'])
print('ok')
EOF
```

⚠ « {{prenom}} · {{liste}} » dans les quatre langues, à dessein : une chaîne identique en allemand et en anglais mais différente du français (« : » espacé) compte comme NON traduite pour `i18n:coverage:ci`.

- [ ] **Étape 7 : compiler, jouer, regarder**

```bash
npx tsc -b
npm run --silent i18n:parity:ci && npm run --silent i18n:coverage:ci && npm run --silent lint:i18n
npx vitest run tests/unit/matching-du-jour.spec.ts tests/unit/today-h-day.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/redirection-ouverte.spec.ts
```

Attendu : tout vert. Si le cliquet de grammaire demande de « descendre le compte » de `src/components/crm/today`, le faire.

Le banc ne rend encore rien dans le segment (sa RPC y manque jusqu'à la tâche 13) : vérifier seulement que `http://localhost:5173/dev/crm?entree=/dashboard` montre trois segments, que « Matching » dit « Aucune action de matching aujourd'hui. » (le banc signale en console que la RPC lui manque, et c'est tout), et que « Dossiers » ne montre plus de carte de match.

---

## Tâche 6 : « Pendant ton absence » consigne au lieu de clore

**Fichiers :**
- Modifier : `src/components/matching-fil/filBoucle.ts`
- Modifier : `src/components/crm/today/useAbsenceSignals.ts`
- Modifier : `src/components/crm/today/PageAujourdhuiH.tsx`
- Modifier : `src/components/crm-mobile/today/MobileTodayHScreen.tsx`
- Modifier : `src/i18n/locales/{fr,en,de,it}/dashboard.json`

- [ ] **Étape 1 : un motif n'est jamais un code brut**

Dans `src/components/matching-fil/filBoucle.ts`, sous `export type MotifRefus = …` :

```ts
/**
 * La clé i18n d'un motif de refus (`fil.motifs.*`), ou `null` pour tout autre code — `recherche_ajustee` compris, qui
 * n'est pas une réponse de l'acheteur. Un motif ne s'affiche jamais en code brut (lot D1).
 */
export const cleMotif = (code: string | null | undefined): string | null =>
  (code && (MOTIFS_REFUS as readonly string[]).includes(code) ? `fil.motifs.${code}` : null)
```

- [ ] **Étape 2 : le hook reconnaît une relance de proposition**

Dans `src/components/crm/today/useAbsenceSignals.ts` :

a. Ajouter l'import :

```ts
import { cleMotif } from '@/components/matching-fil/filBoucle'
```

b. Dans `interface AbsenceRow`, sous `ref_id: string` :

```ts
  /** Le type du rappel (`today_absence`, lot D1) ; absent d'une réaction, et d'une base d'avant le lot. */
  reminder_type?: string | null
  /** Les biens encore sans réponse d'une relance de proposition. */
  nb_biens?: number | null
```

c. Dans `interface AbsenceSignal`, sous `refId: string` :

```ts
  /**
   * L'acheteur d'une relance de PROPOSITION (lot D1) : elle ne se « reprend » pas, elle se consigne — « Retours de … »
   * dans le fil. `null` pour tout autre signal.
   */
  retoursDe: string | null
```

d. Dans le `map` des signaux, la branche `like` : remplacer `text: t('today.h.absence.liked', { subject }),` par `text: t('today.h.absence.interesse', { subject }),`, et ajouter `retoursDe: null,` à l'objet rendu.

e. La branche `skip` : remplacer

```ts
          text: t('today.h.absence.skipped', { subject }),
          // Le motif d'écartement est la donnée la plus utile du signal : il dit
          // POURQUOI recalibrer. On le montre à côté de l'horodatage.
          meta: r.motif ? `${meta} · « ${r.motif} »` : meta,
```

par

```ts
          text: t('today.h.absence.pasInteresse', { subject }),
          // Le motif du refus est la donnée la plus utile du signal : il dit POURQUOI recalibrer. LIBELLÉ (lot D1) —
          // il s'affichait en code brut (« prix »).
          meta: motifLibelle ? `${meta} · ${motifLibelle}` : meta,
```

en déclarant, juste au-dessus du `if (r.kind === 'like')` :

```ts
      const cle = cleMotif(r.motif)
      const motifLibelle = cle ? t(cle, { ns: 'matching' }) : null
```

et ajouter `retoursDe: null,` à l'objet rendu.

f. La branche finale (le rappel) : remplacer

```ts
      return {
        id: r.id, type: 'rappel' as const, who, initials: initialsOf(r.first_name, r.last_name),
        av: avatarColor(r.contact_id || r.id),
        text: t('today.h.absence.reminderDue', { subject }),
        meta, late: r.late,
        cta: t('today.h.absence.ctaResume'),
        route: 'contact-detail', navRef: r.contact_id ?? undefined, refId: r.ref_id,
      }
```

par

```ts
      // Une relance de PROPOSITION dit ses biens sans réponse, et « Reprendre » ouvre « Retours de … » (lot D1).
      const proposition = r.reminder_type === 'follow_up_sent_property' && !!r.contact_id && (r.nb_biens ?? 0) > 0
      return {
        id: r.id, type: 'rappel' as const, who, initials: initialsOf(r.first_name, r.last_name),
        av: avatarColor(r.contact_id || r.id),
        text: proposition ? t('today.h.absence.retourAttendu', { count: r.nb_biens ?? 0 }) : t('today.h.absence.reminderDue', { subject }),
        meta, late: r.late,
        cta: t('today.h.absence.ctaResume'),
        route: 'contact-detail', navRef: r.contact_id ?? undefined, refId: r.ref_id,
        retoursDe: proposition ? r.contact_id : null,
      }
```

g. Dans l'en-tête du fichier, sous le paragraphe « Pas d'accusé de lecture », ajouter :

```ts
// ⛔ LOT D1 : une relance de PROPOSITION (`follow_up_sent_property`) n'est pas un rappel qu'on « reprend » : elle se
// clôt quand ses réponses sont consignées (`fermer_relance_proposition`). La passer à `done` d'ici laissait ses biens
// `sent` sans échéance, et le fil perdait la ligne. `retoursDe` la désigne ; les écrans ouvrent « Retours de … ».
```

- [ ] **Étape 3 : le bureau ouvre « Retours de … »**

Dans `src/components/crm/today/PageAujourdhuiH.tsx`, ajouter l'import `import { lienFil } from '@/components/matching-fil/filLiens'`, puis remplacer :

```ts
  const onSignal = async (s: AbsenceSignal) => {
    if (s.type === 'rappel') {
```

par :

```ts
  const onSignal = async (s: AbsenceSignal) => {
    // Lot D1 : une relance de proposition s'ouvre dans « Retours de … », sans rien écrire — elle se clôt quand les
    // réponses sont consignées. La passer à `done` ici laissait ses biens `sent` sans échéance.
    if (s.retoursDe) {
      nav('matching-fil', lienFil({ attente: s.retoursDe }))
      return
    }
    if (s.type === 'rappel') {
```

- [ ] **Étape 4 : le mobile ne la clôt plus**

Dans `src/components/crm-mobile/today/MobileTodayHScreen.tsx`, remplacer :

```ts
    if (s.type === 'rappel') {
      const ok = await resumeReminder(s)
```

par :

```ts
    // Lot D1 : le mobile n'est pas repris, mais il partage le hook — une relance de PROPOSITION ne se clôt pas d'ici
    // (elle se clôt quand ses réponses sont consignées) : on ouvre la fiche, sans rien écrire.
    if (s.type === 'rappel' && !s.retoursDe) {
      const ok = await resumeReminder(s)
```

- [ ] **Étape 5 : le vocabulaire d'un retour consigné**

```bash
python3 - <<'EOF'
import json

def ecrire(ns, lang, poser=(), retirer=()):
    p = f'src/i18n/locales/{lang}/{ns}.json'
    d = json.load(open(p, encoding='utf-8'))
    for chemin in retirer:
        *tete, fin = chemin.split('.')
        noeud = d
        for k in tete:
            noeud = noeud[k]
        del noeud[fin]
    for chemin, valeur in poser:
        *tete, fin = chemin.split('.')
        noeud = d
        for k in tete:
            noeud = noeud.setdefault(k, {})
        noeud[fin] = valeur
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')

ABSENCE = {
  'fr': {'interesse': 'intéressé·e par {{subject}}', 'pasInteresse': 'pas intéressé·e par {{subject}}',
         'retourAttendu_one': 'retour attendu sur {{count}} bien proposé', 'retourAttendu_other': 'retour attendu sur {{count}} biens proposés',
         'groupBuyers': 'Retours consignés'},
  'en': {'interesse': 'interested in {{subject}}', 'pasInteresse': 'not interested in {{subject}}',
         'retourAttendu_one': 'feedback due on {{count}} proposed property', 'retourAttendu_other': 'feedback due on {{count}} proposed properties',
         'groupBuyers': 'Recorded feedback'},
  'de': {'interesse': 'interessiert an {{subject}}', 'pasInteresse': 'nicht interessiert an {{subject}}',
         'retourAttendu_one': 'Rückmeldung zu {{count}} vorgeschlagenem Objekt fällig', 'retourAttendu_other': 'Rückmeldung zu {{count}} vorgeschlagenen Objekten fällig',
         'groupBuyers': 'Erfasste Rückmeldungen'},
  'it': {'interesse': 'interessato/a a {{subject}}', 'pasInteresse': 'non interessato/a a {{subject}}',
         'retourAttendu_one': 'riscontro atteso su {{count}} immobile proposto', 'retourAttendu_other': 'riscontro atteso su {{count}} immobili proposti',
         'groupBuyers': 'Riscontri registrati'},
}
for lang, cles in ABSENCE.items():
    ecrire('dashboard', lang,
           poser=[(f'today.h.absence.{k}', v) for k, v in cles.items()],
           retirer=['today.h.absence.liked', 'today.h.absence.skipped'])
print('ok')
EOF
grep -rn "absence.liked\|absence.skipped" src || echo "aucun lecteur restant"
```

Attendu : « aucun lecteur restant ».

- [ ] **Étape 6 : compiler et jouer**

```bash
npx tsc -b
npm run --silent i18n:parity:ci && npm run --silent i18n:coverage:ci
npx vitest run tests/unit/today-h-day.spec.ts tests/unit/matching-fil-boucle.spec.ts
```

Attendu : tout vert. Si `t(cle, { ns: 'matching' })` ne se type pas, passer par `i18n.t(cle, { ns: 'matching' })` (le hook a déjà `i18n`).

---

## Tâche 7 : le modèle de « Sa boucle »

**Fichiers :**
- Modifier : `src/components/matching-fil/filModele.ts`
- Modifier : `src/hooks/useMatchingFil.ts`
- Créer : `src/components/crm/contacts-pager/saBoucle.ts`
- Créer : `tests/unit/sa-boucle.spec.ts`
- Modifier : `src/hooks/useContactSentMatches.ts`

- [ ] **Étape 1 : trois aides pures rejoignent `filModele`**

`nombreOuNull`, `listeEquipements` et `photoAnnonce` sont privées dans `src/hooks/useMatchingFil.ts` ; « Sa boucle » et « Qui pour ce bien ? » en ont besoin sans passer par un module de hook. Les COUPER de `useMatchingFil.ts` (définitions entières, commentaires compris) et les coller à la fin de `src/components/matching-fil/filModele.ts`, exportées :

```ts
/** Un nombre lu en base (`numeric` arrive en chaîne) ; `null` s'il n'en est pas un. */
export const nombreOuNull = (v: number | string | null): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : null
}

/** Les équipements d'un bien : un tableau de chaînes, ou un objet `{ equipement: vrai }`. */
export function listeEquipements(brut: unknown): string[] {
  if (Array.isArray(brut)) return brut.filter((f): f is string => typeof f === 'string')
  if (brut && typeof brut === 'object') {
    return Object.entries(brut as Record<string, unknown>).filter(([, v]) => Boolean(v)).map(([k]) => k)
  }
  return []
}

/** La vignette d'une annonce : `photos_cf` porte des URL en chaîne OU des objets `{thumb, …}`, sinon `photos`. */
export function photoAnnonce(cf: unknown, photos: string[] | null): string | null {
  const premier: unknown = Array.isArray(cf) ? cf[0] : undefined
  if (typeof premier === 'string' && premier) return premier
  if (premier && typeof premier === 'object') {
    const thumb = (premier as Record<string, unknown>).thumb
    if (typeof thumb === 'string' && thumb) return thumb
  }
  return photos?.find((p) => typeof p === 'string' && p !== '') ?? null
}
```

puis, dans `useMatchingFil.ts`, ajouter `listeEquipements, nombreOuNull, photoAnnonce` à l'import depuis `@/components/matching-fil/filModele`. Les corps doivent rester IDENTIQUES à ceux qu'on coupe (comparer avant de coller).

- [ ] **Étape 2 : écrire la spec qui échoue**

`tests/unit/sa-boucle.spec.ts` :

```ts
/**
 * « Sa boucle » (lot D1, conception §6) : toute la boucle, lisible — une visite planifiée a son état, un bien revenu
 * reste là, un motif n'est jamais un code brut, l'ordre ne bouge pas d'une lecture à l'autre, chaque bien mène à sa
 * place dans le fil.
 */
import { describe, expect, it } from 'vitest'
import type { SearchCriteria } from '@/types/contact'
import { construireSaBoucle, type LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'
import { cleMotif } from '@/components/matching-fil/filBoucle'

const ACHETEUR = { id: 'c9', prenom: 'Julie', nom: 'Morand', telephone: null, email: null, kyc: 'none' as const }
const JOUR = 86_400_000
const il = (j: number) => new Date(Date.parse('2026-09-23T10:00:00Z') - j * JOUR).toISOString()
const SANS = new Map<string, SearchCriteria | null>()
const ligne = (id: string, status: string, champs: Partial<LigneBoucleContact> = {}): LigneBoucleContact => ({
  id, status, score: 90, sent_at: il(5), response_at: null, reaction_motif: null, reaction_note: null,
  prix_propose: 1_500_000, apprentissage_at: null, client_search_id: 'cs9', snoozed_until: null,
  property_id: null, market_listing_id: `ml-${id}`,
  market_listing: { title: `Annonce ${id}`, city: 'Genève', price: 1_500_000, current_price: 1_500_000, transaction_type: 'buy', features: ['Balcon'] },
  ...champs,
})
const boucle = (lignes: LigneBoucleContact[], criteres = SANS) => construireSaBoucle(lignes, criteres, ACHETEUR)

describe('construireSaBoucle', () => {
  it('chaque statut a son état — une visite planifiée n’est plus « Proposé »', () => {
    const b = boucle([
      ligne('m1', 'sent'), ligne('m2', 'interested'), ligne('m3', 'visit_planned'),
      ligne('m4', 'rejected', { reaction_motif: 'prix' }), ligne('m5', 'suggested', { reaction_motif: 'prix' }),
    ])
    expect(Object.fromEntries(b.biens.map((x) => [x.m.id, x.etat]))).toEqual({
      m1: 'propose', m2: 'interesse', m3: 'visite', m4: 'refuse', m5: 'revenu',
    })
  })

  it('un bien revenu reste dans la boucle, et mène à sa ligne dans le fil', () => {
    const mandat = ligne('m5', 'suggested', {
      reaction_motif: 'prix', prix_propose: 3_450_000, property_id: 'p2', market_listing_id: null, market_listing: null,
      property: { title: 'Villa · Cologny', price: 3_200_000, transaction_type: 'sale' },
    })
    const b = boucle([mandat])
    expect(b.biens).toHaveLength(1)
    expect(b.biens[0]).toMatchObject({ etat: 'revenu', lien: 'ligne=m5&contact=c9' })
    expect(b.biens[0]!.m.bien).toMatchObject({ id: 'p2', titre: 'Villa · Cologny', prix: 3_200_000 })
    expect(b.aTraiter.map((x) => x.m.id)).toEqual(['m5'])
    // Sur le marché, le fil le range dans la ligne « Marché » de l'acheteur.
    expect(boucle([ligne('m6', 'suggested', { reaction_motif: 'prix' })]).biens[0]!.lien).toBe('ligne=marche%3Ac9&contact=c9')
  })

  it('un match jamais proposé n’est pas dans la boucle', () => {
    expect(boucle([ligne('m7', 'suggested', { prix_propose: null, reaction_motif: null })]).biens).toEqual([])
    expect(boucle([ligne('m8', 'ignored')]).biens).toEqual([])
  })

  it('chaque bien mène à sa place dans le fil ; un refus et une visite nulle part', () => {
    const b = boucle([ligne('m1', 'sent'), ligne('m2', 'interested'), ligne('m3', 'visit_planned'), ligne('m4', 'rejected')])
    expect(Object.fromEntries(b.biens.map((x) => [x.m.id, x.lien]))).toEqual({
      m1: 'attente=c9', m2: 'onglet=aConclure&ligne=m2&contact=c9', m3: null, m4: null,
    })
  })

  it('l’ordre est stable : la proposition la plus récente d’abord, sans date en dernier, l’id départage', () => {
    const lignes = [
      ligne('mb', 'sent', { sent_at: il(3) }), ligne('ma', 'sent', { sent_at: il(3) }),
      ligne('mc', 'rejected', { sent_at: null }), ligne('md', 'interested', { sent_at: il(1) }),
    ]
    const ordre = (ls: LigneBoucleContact[]) => boucle(ls).biens.map((x) => x.m.id)
    expect(ordre(lignes)).toEqual(['md', 'ma', 'mb', 'mc'])
    expect(ordre([...lignes].reverse())).toEqual(['md', 'ma', 'mb', 'mc'])
  })

  it('un match lu par les deux lectures ne compte qu’une fois', () => {
    const b = boucle([ligne('m1', 'sent'), ligne('m1', 'sent')])
    expect(b.biens).toHaveLength(1)
    expect(b.compteurs).toEqual({ proposes: 1, interesses: 0, refuses: 0 })
  })

  it('les compteurs : proposés, intéressés (visites comprises), pas intéressés', () => {
    const b = boucle([
      ligne('m1', 'sent'), ligne('m2', 'interested'), ligne('m3', 'visit_planned'), ligne('m4', 'rejected'),
      ligne('m5', 'suggested', { reaction_motif: 'prix' }),
    ])
    expect(b.compteurs).toEqual({ proposes: 5, interesses: 2, refuses: 1 })
    expect(b.aTraiter.map((x) => x.m.id)).toEqual(['m2', 'm5'])
  })

  it('la correction en attente se calcule sur ses refus, avec un lien vers le fil', () => {
    const criteres = new Map<string, SearchCriteria | null>([['cs9', { budget_max: 1_600_000, zones: ['Genève'] } as SearchCriteria]])
    const b = boucle([
      ligne('m1', 'rejected', { reaction_motif: 'prix', response_at: il(2) }),
      ligne('m2', 'rejected', { reaction_motif: 'prix', response_at: il(1), prix_propose: 1_560_000 }),
    ], criteres)
    expect(b.corrections).toHaveLength(1)
    expect(b.corrections[0]!.c.motif).toBe('prix')
    expect(b.corrections[0]!.lien).toBe(`ligne=${encodeURIComponent('correction:cs9:prix')}&contact=c9`)
  })
})

describe('un motif n’est jamais un code brut', () => {
  it('les codes du geste ont leur clé ; tout autre code n’en a pas', () => {
    expect(cleMotif('prix')).toBe('fil.motifs.prix')
    expect(cleMotif('etat')).toBe('fil.motifs.etat')
    expect(cleMotif('recherche_ajustee')).toBeNull()
    expect(cleMotif(null)).toBeNull()
  })
})
```

- [ ] **Étape 3 : la jouer, elle échoue**

```bash
npx vitest run tests/unit/sa-boucle.spec.ts
```

Attendu : échec, `Failed to resolve import "@/components/crm/contacts-pager/saBoucle"`.

- [ ] **Étape 4 : écrire le modèle**

`src/components/crm/contacts-pager/saBoucle.ts` :

```ts
/**
 * « Sa boucle » (fiche contact, page 1) — modèle de vue PUR du lot D1 (conception
 * `2026-09-23-matching-lot-d1-surfaces-design.md` §6). Ni React, ni Supabase, ni traduction.
 *
 * ⚠ La boucle se lit en DEUX lectures (`useContactSentMatches`) : les statuts de la boucle, et les biens REVENUS —
 * `suggested` avec un prix de proposition, la règle de `suiviAProposer` dans le fil. Un bien revenu disparaissait de la
 * fiche au moment même où il redevenait une occasion. La règle est reposée ici (`bienBoucle`) : un `suggested` jamais
 * proposé n'entre pas, quoi que la lecture ramène.
 * ⚠ Chaque bien mène à SA place dans le fil (`lienPlace`) ; un refus ou une visite planifiée n'y ont plus de place,
 * leur ligne ne mène nulle part.
 * ⚠ « Apprendre » (lot B) se calcule avec les règles pures du fil (`construireCorrections`), sur les seuls matchs de ce
 * contact — ce qui suffit : une correction porte sur UNE recherche, qui n'appartient qu'à lui.
 */
import type { SearchCriteria } from '@/types/contact'
import { construireCorrections, type Correction } from '@/components/matching-fil/filApprendre'
import { lienFil, lienPlace } from '@/components/matching-fil/filLiens'
import {
  listeEquipements, nombreOuNull, photoAnnonce, temps, type FilBien, type FilMatch, type SuiviMatch,
} from '@/components/matching-fil/filModele'

export type EtatBoucle = 'propose' | 'interesse' | 'visite' | 'refuse' | 'revenu'

/** Les jointures d'un match de la fiche — le banc les porte sur la ligne, il n'applique pas `select`. */
interface JointureBien {
  title?: string | null; address?: string | null; city?: string | null; canton?: string | null
  price?: number | string | null; current_price?: number | string | null; rooms?: number | string | null
  surface_m2?: number | string | null; photos?: string[] | null; photos_cf?: unknown; type?: string | null
  transaction_type?: string | null; features?: unknown
}

/** Une ligne `matches` lue par la fiche (`useContactSentMatches`). */
export interface LigneBoucleContact {
  id: string
  status: string
  score: number | string | null
  sent_at: string | null
  response_at: string | null
  reaction_motif: string | null
  reaction_note: string | null
  prix_propose: number | string | null
  apprentissage_at: string | null
  client_search_id: string | null
  snoozed_until: string | null
  property_id: string | null
  market_listing_id: string | null
  property?: JointureBien | JointureBien[] | null
  market_listing?: JointureBien | JointureBien[] | null
}

/** Un bien de la boucle, prêt à écrire. */
export interface BienBoucle {
  m: FilMatch
  etat: EtatBoucle
  /** La requête du fil qui l'ouvre à sa place ; `null` : le fil ne le porte plus. */
  lien: string | null
}

export interface SaBoucle {
  /** La proposition la plus récente d'abord ; sans date en dernier ; l'id départage. */
  biens: BienBoucle[]
  /** Ce qui attend un geste de l'agent : les intéressés, puis les biens revenus. */
  aTraiter: BienBoucle[]
  /** Les corrections de recherche en attente (« Apprendre »), et où les ouvrir. */
  corrections: { c: Correction; lien: string }[]
  compteurs: { proposes: number; interesses: number; refuses: number }
}

const ETATS: Record<string, EtatBoucle> = {
  sent: 'propose', interested: 'interesse', visit_planned: 'visite', rejected: 'refuse', suggested: 'revenu',
}

const premiere = <T>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null)

/** Un match de la fiche, dans la forme du fil ; `null` sans bien. */
function versMatch(l: LigneBoucleContact, acheteur: FilMatch['acheteur'], criteres: SearchCriteria | null): FilMatch | null {
  const bienId = l.property_id ?? l.market_listing_id
  if (!bienId) return null
  const marche = l.property_id == null
  const b = premiere(l.property) ?? premiere(l.market_listing)
  const bien: FilBien = {
    id: bienId,
    titre: b?.title?.trim() || b?.address?.trim() || '',
    prix: marche ? nombreOuNull(b?.current_price ?? null) ?? nombreOuNull(b?.price ?? null) : nombreOuNull(b?.price ?? null),
    location: b?.transaction_type === 'rent',
    type: b?.type ?? null, pieces: nombreOuNull(b?.rooms ?? null), surface: nombreOuNull(b?.surface_m2 ?? null),
    ville: b?.city ?? null, canton: b?.canton ?? null, adresse: b?.address ?? null,
    equipements: listeEquipements(b?.features), photo: photoAnnonce(b?.photos_cf, b?.photos ?? null),
    ...(marche ? { marche: { ref: bienId, sourceUrl: null } } : {}),
  }
  const suivi: SuiviMatch = {
    statut: l.status as SuiviMatch['statut'], proposeLe: l.sent_at, reponduLe: l.response_at, motif: l.reaction_motif,
    note: l.reaction_note, prixPropose: nombreOuNull(l.prix_propose), apprisLe: l.apprentissage_at,
  }
  return {
    id: l.id, score: nombreOuNull(l.score) ?? 0, raisons: null, criteres, creeLe: null, reporteJusquau: l.snoozed_until,
    rechercheId: l.client_search_id, suivi, bien, acheteur,
  }
}

/** Un match tel que la fiche le montre ; `null` hors de la boucle (écarté, jamais proposé, statut inconnu). */
function bienBoucle(m: FilMatch): BienBoucle | null {
  const s = m.suivi
  const etat = s ? ETATS[s.statut] : undefined
  if (!s || !etat) return null
  if (etat === 'revenu' && s.prixPropose == null && s.motif == null) return null
  return { m, etat, lien: lienPlace({ id: m.id, statut: s.statut, contactId: m.acheteur.id, marche: m.bien.marche != null }) }
}

/**
 * « Sa boucle » d'un acheteur, depuis ses lignes : les deux lectures fusionnées (un match lu deux fois ne compte qu'une
 * fois), les critères de ses recherches, et son identité — le texte d'un bien revenu le nomme.
 */
export function construireSaBoucle(
  lignes: readonly LigneBoucleContact[], criteres: ReadonlyMap<string, SearchCriteria | null>, acheteur: FilMatch['acheteur'],
): SaBoucle {
  const vus = new Set<string>()
  const matchs: FilMatch[] = []
  for (const l of lignes) {
    if (vus.has(l.id)) continue
    vus.add(l.id)
    const m = versMatch(l, acheteur, l.client_search_id ? criteres.get(l.client_search_id) ?? null : null)
    if (m) matchs.push(m)
  }
  const biens = matchs
    .flatMap((m) => { const b = bienBoucle(m); return b ? [b] : [] })
    .sort((a, b) => temps(b.m.suivi?.proposeLe ?? null) - temps(a.m.suivi?.proposeLe ?? null) || a.m.id.localeCompare(b.m.id))
  return {
    biens,
    aTraiter: [...biens.filter((b) => b.etat === 'interesse'), ...biens.filter((b) => b.etat === 'revenu')],
    corrections: construireCorrections(matchs).map((c) => ({ c, lien: lienFil({ ligne: c.cle, contact: acheteur.id }) })),
    compteurs: {
      proposes: biens.length,
      interesses: biens.filter((b) => b.etat === 'interesse' || b.etat === 'visite').length,
      refuses: biens.filter((b) => b.etat === 'refuse').length,
    },
  }
}
```

- [ ] **Étape 5 : la jouer, elle passe**

```bash
npx vitest run tests/unit/sa-boucle.spec.ts
```

Attendu : `Tests  9 passed`.

- [ ] **Étape 6 : la lecture — deux lectures parallèles**

Remplacer TOUT `src/hooks/useContactSentMatches.ts` par :

```ts
/**
 * « Sa boucle » (fiche contact) — les matchs d'un contact que la boucle porte, et les critères de leurs recherches. Le
 * modèle de vue est pur : `construireSaBoucle` (`contacts-pager/saBoucle.ts`).
 *
 * ⚠ DEUX LECTURES PARALLÈLES, pas un `or(…)` (conception de D1, §6) : les statuts de la boucle d'un côté, les biens
 * REVENUS de l'autre (`suggested` avec un prix de proposition : un bien revenu a forcément été proposé). Toutes deux
 * passent par des opérateurs que le banc sait appliquer ; `or` y reste en attente, et le dit en console.
 * ⛔ Rien ne part vers l'acheteur (21.09.2026) : la réponse est consignée par l'agent — ou par un collègue,
 * l'abonnement realtime la fait apparaître sans recharger la fiche.
 */
import { useEffect, useId } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { lire } from '@/hooks/useMatchingFil'
import type { SearchCriteria } from '@/types/contact'
import type { LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'

const STATUTS_BOUCLE = ['sent', 'interested', 'rejected', 'visit_planned']
/** Le match et son bien, colonnes légères (§7 de CLAUDE.md). */
const COLONNES = 'id, status, score, sent_at, response_at, reaction_motif, reaction_note, prix_propose, apprentissage_at,'
  + ' client_search_id, snoozed_until, property_id, market_listing_id,'
  + ' property:properties(title, address, city, canton, price, rooms, surface_m2, photos, type, transaction_type, features),'
  + ' market_listing:market_listings(title, address, city, canton, price, current_price, rooms, surface_m2, photos, photos_cf, type, transaction_type, features)'

interface BoucleContact {
  lignes: LigneBoucleContact[]
  criteres: ReadonlyMap<string, SearchCriteria | null>
}
const VIDE: BoucleContact = { lignes: [], criteres: new Map() }

/** Les lignes de « Sa boucle » d'un contact, rafraîchies en realtime sur ses `matches`. */
export function useContactSentMatches(contactId: string | undefined): BoucleContact & { isLoading: boolean; isError: boolean } {
  const qc = useQueryClient()
  const channelId = useId()

  const query = useQuery<BoucleContact>({
    queryKey: ['contact-sent-matches', contactId],
    enabled: !!contactId,
    staleTime: 15_000,
    queryFn: async () => {
      if (!contactId) return VIDE
      const [boucle, revenus] = await Promise.all([
        lire<LigneBoucleContact>(supabase.from('matches').select(COLONNES).eq('contact_id', contactId).in('status', STATUTS_BOUCLE)),
        lire<LigneBoucleContact>(supabase.from('matches').select(COLONNES).eq('contact_id', contactId).eq('status', 'suggested').gt('prix_propose', 0)),
      ])
      const lignes = [...boucle, ...revenus]
      const ids = [...new Set(lignes.map((l) => l.client_search_id).filter((id): id is string => id != null))]
      const recherches = ids.length
        ? await lire<{ id: string; criteria: SearchCriteria | null }>(supabase.from('client_searches').select('id, criteria').in('id', ids))
        : []
      return { lignes, criteres: new Map(recherches.map((r) => [r.id, r.criteria])) }
    },
  })

  // Realtime : une réponse consignée (par cet agent ou un collègue) mute matches → rafraîchit la fiche.
  useEffect(() => {
    if (!contactId) return
    const channel = supabase
      .channel(`contact-loop-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `contact_id=eq.${contactId}` },
        () => qc.invalidateQueries({ queryKey: ['contact-sent-matches', contactId] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [contactId, channelId, qc])

  return { ...(query.data ?? VIDE), isLoading: query.isLoading, isError: query.isError }
}
```

Le compilateur rougira dans `ContactDetailPage.tsx` (il lit encore `loop.items`) : c'est la tâche 8. Ne pas lancer `tsc` ici.

---

## Tâche 8 : « Sa boucle » à l'écran

**Fichiers :**
- Modifier : `src/components/crm/contacts-pager/ContactDetailPager.tsx`
- Modifier : `src/pages/agent/ContactDetailPage.tsx`
- Modifier : `src/pages/dev/demoFixtures.ts`
- Modifier : `src/pages/dev/ContactsShowcasePage.tsx`
- Modifier : `src/i18n/locales/{fr,en,de,it}/contacts.json`

- [ ] **Étape 1 : les imports de la fiche**

Dans `ContactDetailPager.tsx`, sous `import { useEcranActifRef } from '@/hooks/useEcranActif'` :

```ts
import { dateCourte, montant, texteSignal } from '@/components/matching-fil/filAffichage'
import { cleMotif } from '@/components/matching-fil/filBoucle'
import type { BienBoucle, EtatBoucle, SaBoucle } from '@/components/crm/contacts-pager/saBoucle'
```

- [ ] **Étape 2 : le type de la boucle**

Supprimer le bloc `FicheLoopItem` entier (son commentaire « Un bien proposé à ce contact, avec la réponse que l'agent a consignée… » et l'interface). Dans `ContactDetailPagerProps`, remplacer :

```ts
  /** `transmitted` : biens proposés ; `dismissed` : ceux dont la réponse consignée est « Pas intéressé ». */
  loop: { items: FicheLoopItem[]; pendingLikes: FicheLoopItem[]; transmitted: number; dismissed: number }
```

par :

```ts
  /** « Sa boucle » (lot D1) : le modèle pur de `saBoucle.ts`. */
  loop: SaBoucle
```

et `  onProposeVisit: (matchId: string) => void` par :

```ts
  /** Ouvre le fil à une place précise — la requête de `lienFil` / `lienPlace`. */
  onOuvrirFil: (requete: string) => void
```

- [ ] **Étape 3 : cinq états, cinq pastilles**

Remplacer :

```ts
// État de la boucle → clé couleur de la palette + clé i18n du pill.
// `liked` est VERT (clé `ok`) et non rouge : le like est un signal positif, et c'est
// la couleur du handoff. Passer par une clé de palette garde le mode sombre correct.
const LOOP_STATE: Record<FicheLoopItem['state'], { key: 'ok' | 'wait' | 'ghost'; labelK: string }> = {
  liked: { key: 'ok', labelK: 'loop.pillLiked' },
  sent: { key: 'wait', labelK: 'loop.pillSent' },
  dismissed: { key: 'ghost', labelK: 'loop.pillDismissed' },
}
```

par :

```ts
// État de la boucle (lot D1 : cinq) → clé de couleur de la palette + clé i18n de la pastille. Intéressé et visite en
// VERT (`ok`) : un signal positif. Un bien revenu dans le bleu de l'acheteur (`buyer`) : une occasion, pas une attente.
// Passer par une clé de palette garde le mode sombre correct (tons confrontés par `contacts-contraste.spec.ts`).
const ETAT_BOUCLE: Record<EtatBoucle, { key: 'ok' | 'wait' | 'ghost' | 'buyer'; labelK: string }> = {
  propose: { key: 'wait', labelK: 'loop.etat.propose' },
  interesse: { key: 'ok', labelK: 'loop.etat.interesse' },
  visite: { key: 'ok', labelK: 'loop.etat.visite' },
  refuse: { key: 'ghost', labelK: 'loop.etat.refuse' },
  revenu: { key: 'buyer', labelK: 'loop.etat.revenu' },
}
```

et, dans `CdStatePill`, remplacer `{ state: FicheLoopItem['state']; label: string; P: FichePal }` par `{ state: EtatBoucle; label: string; P: FichePal }` et `const aplat = P[LOOP_STATE[state].key]` par `const aplat = P[ETAT_BOUCLE[state].key]` (le reste de l'atome ne bouge pas : son encre vient déjà d'`encreSur(aplat)`).

- [ ] **Étape 4 : la page « Sa boucle »**

Remplacer la fonction `CdBoucle` entière — de son commentaire `/** La boucle d'un acheteur : ce que l'agent lui a proposé … */` jusqu'à son accolade fermante — par :

```tsx
/**
 * La boucle d'un acheteur (lot D1, conception §6) : ce que l'agent lui a proposé, la réponse consignée, les biens
 * revenus et la correction de recherche en attente. Une surface MONTRE et ORIENTE ; le fil agit — chaque bien ouvre sa
 * place dans le fil, et aucun geste n'est recopié ici. ⛔ « Plus tard » et « Ignorer » sont retirés : ils masquaient une
 * ligne jusqu'au rechargement, sans rien écrire. ⛔ Rien ne part vers l'acheteur (21.09.2026).
 */
function CdBoucle({ P, dark, loop, firstName, onOpenMatching, onOuvrirFil }: {
  P: FichePal
  dark: boolean
  loop: SaBoucle
  firstName: string
  onOpenMatching: () => void
  onOuvrirFil: (requete: string) => void
}) {
  const { t } = useTranslation('contacts')
  const { t: tm } = useTranslation('matching')
  const totallyEmpty = loop.biens.length === 0
  const aTraiter = loop.aTraiter.length + loop.corrections.length
  const titreDe = (b: BienBoucle) => b.m.bien.titre || t('loop.bienSansTitre')

  const counters: { v: number; l: string; liked?: boolean }[] = [
    { v: loop.compteurs.proposes, l: t('loop.compteurs.proposes') },
    { v: loop.compteurs.interesses, l: t('loop.compteurs.interesses'), liked: true },
    { v: loop.compteurs.refuses, l: t('loop.compteurs.refuses') },
  ]

  return (
    // Bord à bord, comme la page d'informations (16.09.2026) : un en-tête, puis deux
    // colonnes pleine hauteur séparées par un filet — plus de cartes dans le cadre.
    <div className="cdp-fiche" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: P.card }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)', padding: 'var(--crm-space-4xl) var(--crm-space-6xl)', borderBottom: `1px solid ${P.hairline}`, flexShrink: 0, minHeight: CD_ENTETE_H, boxSizing: 'border-box' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--crm-text-4xl)', fontWeight: 500, letterSpacing: -0.6, color: P.ink, lineHeight: 1.1 }}>{t('fiche.page.loop')}</h1>
        <div style={{ flex: 1 }} />
        {counters.map((c) => (
          <div key={c.l} style={{ textAlign: 'center', minWidth: 62 }}>
            <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 600, letterSpacing: -0.5, lineHeight: 1, color: c.liked ? P.ok : P.ink, fontVariantNumeric: 'tabular-nums' }}>{c.v}</div>
            <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: P.muted, marginTop: 4 }}>{c.l}</div>
          </div>
        ))}
      </header>

      {totallyEmpty ? (
        // Boucle jamais démarrée → invitation à proposer, pas un cul-de-sac gris.
        <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center' }}>
          <EtatVide
            dark={dark}
            glyphe={<FcpIcon name="send" size={30} />}
            titre={t('fiche.loop.emptyTitle')}
            corps={<Trans t={t} i18nKey="fiche.loop.emptyBody" values={{ name: firstName }} components={{ 1: <br /> }} />}
            action={{ libelle: t('fiche.cta.transmit'), onClick: onOpenMatching }}
          />
        </div>
      ) : (
        <div className="cdp-cols cdp-cols-2">
          {/* À traiter : les intéressés, les biens revenus, la correction de recherche en attente */}
          <section className="cdp-col" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
            <CdGrp P={P}>{t('fiche.loop.toHandleCount', { count: aTraiter })}</CdGrp>
            {aTraiter === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', background: P.sub, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-3xl) var(--crm-space-2xl)' }}>
                <FcpIcon name="check" size={16} stroke={P.ok} />
                <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: P.inkSoft }}>{t('fiche.loop.nothingToHandle')}</div>
              </div>
            ) : (
              <>
                {loop.aTraiter.map((b) => (
                  <CdATraiter key={b.m.id} P={P} icone={b.etat === 'interesse' ? 'heart' : 'send'}
                    titre={b.etat === 'interesse' ? t('loop.aTraiter.interesse', { titre: titreDe(b) }) : titreDe(b)}
                    detail={b.etat === 'revenu' ? texteSignal(b.m, tm) ?? t('loop.detail.revenu') : null}
                    action={b.lien ? { libelle: b.etat === 'interesse' ? t('loop.proposeVisit') : t('loop.aTraiter.ouvrir'), faire: () => onOuvrirFil(b.lien!) } : null} />
                ))}
                {loop.corrections.map(({ c, lien }) => (
                  <CdATraiter key={c.cle} P={P} icone="pencil"
                    titre={t('loop.correction.titre', { motif: tm(`fil.motifs.${c.motif}`) })}
                    detail={t('loop.correction.detail', { count: c.refus.length })}
                    action={{ libelle: t('loop.correction.voir'), faire: () => onOuvrirFil(lien) }} />
                ))}
              </>
            )}
          </section>

          {/* Ce que l'agent a proposé, et la réponse qu'il a consignée */}
          <section className="cdp-col" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--crm-space-sm)' }}>
                <CdGrp P={P}>{t('fiche.loop.transmittedCount', { count: loop.biens.length })}</CdGrp>
                <div style={{ flex: 1 }} />
                <button type="button" onClick={onOpenMatching} style={{ border: 0, background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: P.muted, cursor: 'pointer' }}>{t('fiche.loop.openInMatching')}</button>
              </div>
              {loop.biens.map((b, i) => <CdBienBoucle key={b.m.id} P={P} b={b} premier={i === 0} titre={titreDe(b)} onOuvrirFil={onOuvrirFil} />)}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

/** Une ligne « À traiter » : ce qui attend l'agent, et le geste qui l'ouvre dans le fil. */
function CdATraiter({ P, icone, titre, detail, action }: {
  P: FichePal; icone: string; titre: string; detail: string | null; action: { libelle: string; faire: () => void } | null
}) {
  const coeur = icone === 'heart'
  return (
    <div style={{ background: P.sub, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-2xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
        <span style={{ width: 34, height: 34, borderRadius: 'var(--crm-radius-pill)', background: P.card, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <FcpIcon name={icone} size={15} stroke={coeur ? P.ok : P.inkSoft} fill={coeur ? P.ok : 'none'} sw={1.5} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: -0.2, color: P.ink }}>{titre}</div>
          {detail && <div style={{ marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: P.muted }}>{detail}</div>}
        </div>
      </div>
      {action && <div style={{ display: 'flex' }}><CdCta small P={P} onClick={action.faire}>{action.libelle}</CdCta></div>}
    </div>
  )
}

/**
 * Un bien proposé : son état, ce qui s'est passé et quand — la date et le prix d'une proposition, le motif LIBELLÉ et la
 * note d'un refus, le texte du fil pour un bien revenu ou en baisse depuis —, et, s'il a encore une place dans le fil,
 * le geste qui l'y ouvre (toute la ligne).
 */
function CdBienBoucle({ P, b, premier, titre, onOuvrirFil }: {
  P: FichePal; b: BienBoucle; premier: boolean; titre: string; onOuvrirFil: (requete: string) => void
}) {
  const { t } = useTranslation('contacts')
  const { t: tm } = useTranslation('matching')
  const s = b.m.suivi
  const horsJeu = b.etat === 'refuse'
  const prix = s?.prixPropose != null ? montant(b.m.bien.location, s.prixPropose, tm) : null
  const motif = cleMotif(s?.motif)
  const detail = b.etat === 'propose'
    ? (!s?.proposeLe ? t('loop.detail.proposeSansDate')
      : prix ? t('loop.detail.propose', { date: dateCourte(s.proposeLe), prix })
        : t('loop.detail.proposeSansPrix', { date: dateCourte(s.proposeLe) }))
    : b.etat === 'interesse'
      ? (s?.reponduLe ? t('loop.detail.interesse', { date: dateCourte(s.reponduLe) }) : t('loop.detail.interesseSansDate'))
      : b.etat === 'visite' ? t('loop.detail.visite')
        : b.etat === 'refuse' ? (motif ? t('loop.detail.refuse', { motif: tm(motif) }) : t('loop.detail.refuseSansMotif'))
          : texteSignal(b.m, tm) ?? t('loop.detail.revenu')
  // La baisse depuis la proposition, sur un bien encore sans réponse : le texte du fil.
  const signal = b.etat === 'propose' ? texteSignal(b.m, tm) : null
  const ligne: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) var(--crm-space-2xs)',
    opacity: horsJeu ? 0.55 : 1, borderTop: premier ? '0' : `1px solid ${P.hairline}`,
  }
  const petit: CSSProperties = { marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: P.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const contenu = (
    <>
      {b.m.bien.photo
        ? <img src={b.m.bien.photo} alt="" style={{ width: 44, height: 44, borderRadius: 'var(--crm-radius-md)', objectFit: 'cover', flexShrink: 0, filter: horsJeu ? 'grayscale(.6)' : 'none' }} />
        : <div style={{ width: 44, height: 44, borderRadius: 'var(--crm-radius-md)', flexShrink: 0, background: P.sub, display: 'grid', placeItems: 'center' }}><FcpIcon name="home" size={16} stroke={P.ghost} /></div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: -0.2, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titre}</div>
        <div style={petit}>{detail}</div>
        {signal && <div style={{ ...petit, fontWeight: 600, color: P.ink }}>{signal}</div>}
        {/* La note de l'agent est une DONNÉE consignée, lue telle quelle. */}
        {horsJeu && s?.note && <div style={petit}>{t('loop.note', { note: s.note })}</div>}
      </div>
      <CdStatePill state={b.etat} label={t(ETAT_BOUCLE[b.etat].labelK)} P={P} />
    </>
  )
  if (!b.lien) return <div style={ligne}>{contenu}</div>
  const lien = b.lien
  return (
    <button type="button" onClick={() => onOuvrirFil(lien)}
      style={{ ...ligne, width: '100%', border: 0, borderTop: ligne.borderTop, background: 'transparent', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: 'inherit' }}>
      {contenu}
    </button>
  )
}
```

(`CD_ENTETE_H`, `EtatVide`, `FcpIcon`, `CdGrp`, `CdCta`, `Trans` sont déjà dans le fichier. `minWidth: 62` et `marginTop: 4` sont repris tels quels de l'en-tête d'avant.)

- [ ] **Étape 5 : le montage**

Dans la déstructuration de `ContactDetailPager` (`const { fiche, loop, sp, dark, … } = props`), remplacer `onProposeVisit` par `onOuvrirFil`. Au montage de la page 1, remplacer :

```tsx
            <CdBoucle P={P} dark={dark} loop={loop} firstName={fiche.firstName}
              onOpenMatching={onOpenMatching} onProposeVisit={onProposeVisit} />
```

par :

```tsx
            <CdBoucle P={P} dark={dark} loop={loop} firstName={fiche.firstName}
              onOpenMatching={onOpenMatching} onOuvrirFil={onOuvrirFil} />
```

- [ ] **Étape 6 : la page construit la boucle**

Dans `src/pages/agent/ContactDetailPage.tsx` :

a. Ajouter l'import `import { construireSaBoucle } from '@/components/crm/contacts-pager/saBoucle'`, et `useMemo` à l'import de `react` s'il n'y est pas.

b. Remplacer `  const loop = useContactSentMatches(id)` par :

```ts
  const boucle = useContactSentMatches(id)
  // « Sa boucle » (lot D1) : le modèle pur ; l'identité de l'acheteur nomme un bien revenu (« Refusé par Antoine … »).
  const loop = useMemo(() => construireSaBoucle(boucle.lignes, boucle.criteres, {
    id: id ?? '', prenom: contact?.first_name ?? '', nom: contact?.last_name ?? '', telephone: null, email: null, kyc: 'none',
  }), [boucle.lignes, boucle.criteres, id, contact?.first_name, contact?.last_name])
```

c. Au montage, remplacer `loop={{ items: loop.items, pendingLikes: loop.pendingLikes, transmitted: loop.transmitted, dismissed: loop.dismissed }}` par `loop={loop}`, et :

```tsx
      onProposeVisit={() => navigate(`/dashboard/matching?contact=${id}`)}
```

par :

```tsx
      // Chaque bien de « Sa boucle » ouvre SA place dans le fil. ⛔ Gabarit ANCRÉ : `redirection-ouverte.spec.ts`.
      onOuvrirFil={(requete) => navigate(`/dashboard/matching?${requete}`)}
```

- [ ] **Étape 7 : la démonstration**

Dans `src/pages/dev/demoFixtures.ts`, remplacer l'import `import type { FicheContact, FicheLoopItem } from '@/components/crm/contacts-pager/ContactDetailPager'` par :

```ts
import type { FicheContact } from '@/components/crm/contacts-pager/ContactDetailPager'
import { construireSaBoucle, type LigneBoucleContact, type SaBoucle } from '@/components/crm/contacts-pager/saBoucle'
```

puis remplacer le bloc `DEMO_FICHE_LOOP` entier (son commentaire compris) par :

```ts
const JOUR_DEMO = 86_400_000
const ilYAJours = (j: number) => new Date(Date.now() - j * JOUR_DEMO).toISOString()
/** Une annonce de démonstration, jointe à sa ligne comme PostgREST la rend. */
const annonceDemo = (titre: string, adresse: string, prix: number, photo: string | null | undefined) => ({
  title: titre, address: adresse, city: 'Genève', price: prix, current_price: prix, transaction_type: 'buy',
  photos: photo ? [photo] : null,
})
const ligneDemo = (id: string, status: string, champs: Partial<LigneBoucleContact>): LigneBoucleContact => ({
  id, status, score: 90, sent_at: ilYAJours(4), response_at: null, reaction_motif: null, reaction_note: null,
  prix_propose: null, apprentissage_at: null, client_search_id: null, snoozed_until: null, property_id: null,
  market_listing_id: `ml-${id}`, ...champs,
})
const ACHETEUR_DEMO = { id: DEMO_FICHE.id, prenom: DEMO_FICHE.firstName, nom: DEMO_FICHE.lastName, telephone: null, email: null, kyc: 'none' as const }

/**
 * Boucle de match — page 1 de la fiche (« Sa boucle »). Tous les états y sont : proposé (dont un en baisse depuis),
 * intéressé, pas intéressé (motif et note), et un bien revenu par une baisse.
 */
export const DEMO_FICHE_LOOP: SaBoucle = construireSaBoucle([
  ligneDemo('m1', 'sent', { prix_propose: 1_290_000, market_listing: annonceDemo('Appartement 4.5p — Eaux-Vives', 'Rue des Eaux-Vives 18', 1_250_000, DEMO_LISTING.photos?.[0]) }),
  ligneDemo('m2', 'sent', { sent_at: ilYAJours(6), prix_propose: 1_180_000, market_listing: annonceDemo('Duplex 5p — Carouge', 'Rue Ancienne 7', 1_180_000, DEMO_LISTING.photos?.[1]) }),
  ligneDemo('m3', 'interested', { sent_at: ilYAJours(8), response_at: ilYAJours(2), prix_propose: 1_350_000, market_listing: annonceDemo('Attique 4p — Plainpalais', 'Boulevard du Pont-d’Arve 5', 1_350_000, DEMO_LISTING.photos?.[2]) }),
  ligneDemo('m4', 'rejected', { sent_at: ilYAJours(12), response_at: ilYAJours(10), reaction_motif: 'etat', reaction_note: 'Étage trop bas', prix_propose: 990_000, market_listing: annonceDemo('Appartement 3.5p — Champel', 'Avenue de Champel 30', 990_000, null) }),
  ligneDemo('m5', 'suggested', { sent_at: ilYAJours(20), response_at: ilYAJours(18), reaction_motif: 'prix', prix_propose: 1_450_000, market_listing: annonceDemo('Appartement 5p — Florissant', 'Route de Florissant 60', 1_390_000, null) }),
], new Map(), ACHETEUR_DEMO)

/** La même fiche, boucle jamais démarrée. */
export const DEMO_FICHE_LOOP_VIDE: SaBoucle = construireSaBoucle([], new Map(), ACHETEUR_DEMO)
```

`DEMO_FICHE` et `DEMO_LISTING` sont déclarés plus haut dans le fichier : vérifier que `DEMO_FICHE_LOOP` vient APRÈS eux (sinon, le déplacer sous `DEMO_FICHE`).

Dans `src/pages/dev/ContactsShowcasePage.tsx`, ajouter `DEMO_FICHE_LOOP_VIDE` à l'import depuis `./demoFixtures`, remplacer `loop={surface === 'fiche-vide' ? { ...DEMO_FICHE_LOOP, items: [], pendingLikes: [] } : DEMO_FICHE_LOOP}` par `loop={surface === 'fiche-vide' ? DEMO_FICHE_LOOP_VIDE : DEMO_FICHE_LOOP}`, et `onProposeVisit={NOOP}` par `onOuvrirFil={NOOP}`.

- [ ] **Étape 8 : les libellés**

```bash
python3 - <<'EOF'
import json

def ecrire(ns, lang, poser=(), retirer=()):
    p = f'src/i18n/locales/{lang}/{ns}.json'
    d = json.load(open(p, encoding='utf-8'))
    for chemin in retirer:
        *tete, fin = chemin.split('.')
        noeud = d
        for k in tete:
            noeud = noeud[k]
        del noeud[fin]
    for chemin, valeur in poser:
        *tete, fin = chemin.split('.')
        noeud = d
        for k in tete:
            noeud = noeud.setdefault(k, {})
        noeud[fin] = valeur
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')

MORTES = ['loop.inboxTitle', 'loop.likedTitle', 'loop.likedSub', 'loop.matchPct', 'loop.later', 'loop.handled',
          'loop.openAtelier', 'loop.empty', 'loop.pillLiked', 'loop.pillSent', 'loop.pillDismissed',
          'loop.metaDismissed', 'loop.motif', 'fiche.loop.ignore']
BOUCLE = {
  'fr': {
    'etat': {'propose': 'Proposé', 'interesse': 'Intéressé·e', 'visite': 'Visite planifiée', 'refuse': 'Pas intéressé·e', 'revenu': 'Revenu'},
    'compteurs': {'proposes': 'Proposés', 'interesses': 'Intéressés', 'refuses': 'Pas intéressés'},
    'detail': {'propose': 'Proposé le {{date}} · {{prix}}', 'proposeSansPrix': 'Proposé le {{date}}', 'proposeSansDate': 'Proposé',
               'interesse': 'Intéressé·e le {{date}}', 'interesseSansDate': 'Intéressé·e', 'visite': 'Visite planifiée',
               'refuse': 'Pas intéressé·e · {{motif}}', 'refuseSansMotif': 'Pas intéressé·e', 'revenu': 'Revenu à proposer'},
    'note': '« {{note}} »',
    'bienSansTitre': 'Bien sans titre',
    'aTraiter': {'interesse': 'Intéressé·e par {{titre}}', 'ouvrir': 'Ouvrir dans le Matching'},
    'correction': {'titre': 'Recherche à ajuster · {{motif}}', 'detail_one': '{{count}} refus pour ce motif',
                   'detail_other': '{{count}} refus pour ce motif', 'voir': 'Voir la correction'},
  },
  'en': {
    'etat': {'propose': 'Proposed', 'interesse': 'Interested', 'visite': 'Viewing planned', 'refuse': 'Not interested', 'revenu': 'Back'},
    'compteurs': {'proposes': 'Proposed', 'interesses': 'Interested', 'refuses': 'Not interested'},
    'detail': {'propose': 'Proposed on {{date}} · {{prix}}', 'proposeSansPrix': 'Proposed on {{date}}', 'proposeSansDate': 'Proposed',
               'interesse': 'Interested on {{date}}', 'interesseSansDate': 'Interested', 'visite': 'Viewing planned',
               'refuse': 'Not interested · {{motif}}', 'refuseSansMotif': 'Not interested', 'revenu': 'Back to propose'},
    'note': '“{{note}}”',
    'bienSansTitre': 'Untitled property',
    'aTraiter': {'interesse': 'Interested in {{titre}}', 'ouvrir': 'Open in Matching'},
    'correction': {'titre': 'Search to adjust · {{motif}}', 'detail_one': '{{count}} decline for this reason',
                   'detail_other': '{{count}} declines for this reason', 'voir': 'See the adjustment'},
  },
  'de': {
    'etat': {'propose': 'Vorgeschlagen', 'interesse': 'Interessiert', 'visite': 'Besichtigung geplant', 'refuse': 'Nicht interessiert', 'revenu': 'Wieder da'},
    'compteurs': {'proposes': 'Vorgeschlagen', 'interesses': 'Interessiert', 'refuses': 'Nicht interessiert'},
    'detail': {'propose': 'Vorgeschlagen am {{date}} · {{prix}}', 'proposeSansPrix': 'Vorgeschlagen am {{date}}', 'proposeSansDate': 'Vorgeschlagen',
               'interesse': 'Interessiert seit {{date}}', 'interesseSansDate': 'Interessiert', 'visite': 'Besichtigung geplant',
               'refuse': 'Nicht interessiert · {{motif}}', 'refuseSansMotif': 'Nicht interessiert', 'revenu': 'Wieder vorzuschlagen'},
    'note': '„{{note}}“',
    'bienSansTitre': 'Objekt ohne Titel',
    'aTraiter': {'interesse': 'Interessiert an {{titre}}', 'ouvrir': 'Im Matching öffnen'},
    'correction': {'titre': 'Suche anpassen · {{motif}}', 'detail_one': '{{count}} Absage aus diesem Grund',
                   'detail_other': '{{count}} Absagen aus diesem Grund', 'voir': 'Anpassung ansehen'},
  },
  'it': {
    'etat': {'propose': 'Proposto', 'interesse': 'Interessato/a', 'visite': 'Visita pianificata', 'refuse': 'Non interessato/a', 'revenu': 'Tornato'},
    'compteurs': {'proposes': 'Proposti', 'interesses': 'Interessati', 'refuses': 'Non interessati'},
    'detail': {'propose': 'Proposto il {{date}} · {{prix}}', 'proposeSansPrix': 'Proposto il {{date}}', 'proposeSansDate': 'Proposto',
               'interesse': 'Interessato/a dal {{date}}', 'interesseSansDate': 'Interessato/a', 'visite': 'Visita pianificata',
               'refuse': 'Non interessato/a · {{motif}}', 'refuseSansMotif': 'Non interessato/a', 'revenu': 'Da riproporre'},
    'note': '«{{note}}»',
    'bienSansTitre': 'Immobile senza titolo',
    'aTraiter': {'interesse': 'Interessato/a a {{titre}}', 'ouvrir': 'Apri nel Matching'},
    'correction': {'titre': 'Ricerca da adattare · {{motif}}', 'detail_one': '{{count}} rifiuto per questo motivo',
                   'detail_other': '{{count}} rifiuti per questo motivo', 'voir': 'Vedi la correzione'},
  },
}
for lang, cles in BOUCLE.items():
    ecrire('contacts', lang, poser=[(f'loop.{k}', v) for k, v in cles.items()], retirer=MORTES)
print('ok')
EOF
grep -rn "loop\.pill\|loop\.liked\|loop\.later\|fiche\.loop\.ignore\|loop\.empty'\|loop\.motif'" src || echo "aucun lecteur restant"
```

Attendu : « aucun lecteur restant ». ⚠ Si l'une des clés de `MORTES` manque dans une langue, le script lève `KeyError` : la retirer de la liste pour cette langue seulement, et le noter.

- [ ] **Étape 9 : compiler, jouer**

```bash
npx tsc -b
npm run --silent i18n:parity:ci && npm run --silent i18n:coverage:ci && npm run --silent lint:i18n
npx vitest run tests/unit/sa-boucle.spec.ts tests/unit/contacts-contraste.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/redirection-ouverte.spec.ts tests/unit/matching-sans-sortie.spec.ts
```

Attendu : tout vert. Le cliquet de grammaire demandera sans doute de descendre le compte de `src/components/crm/contacts-pager` (les `marginTop: 3` et `marginBottom: 6` de l'ancienne boucle sont partis) : le faire, à la valeur qu'il annonce.

- [ ] **Étape 10 : regarder**

`http://localhost:5173/dev/contacts` (fiche de démonstration, page 2 « Sa boucle »), en clair et en sombre : cinq biens, cinq pastilles, « Proposé le … · CHF 1'290'000 » suivi de « Prix baissé de CHF 40'000 depuis que vous l'avez proposé », le refus « Pas intéressé·e · État du bien » et sa note, le bien revenu « Refusé par Marie à CHF 1'450'000 · baissé de CHF 60'000 depuis » ; « À traiter » porte l'intéressé (« Proposer la visite ») et le revenu (« Ouvrir dans le Matching ») ; aucun « Plus tard » ni « Ignorer ».

---

## Tâche 9 : « Qui pour ce bien ? », un composant partagé

**Fichiers :**
- Créer : `src/components/matching-fil/filQuiPour.ts`
- Créer : `src/components/matching-fil/QuiPourCeBien.tsx`
- Modifier : `src/components/matching-fil/FilQuiPourCeBien.tsx`
- Créer : `tests/unit/fiche-qui-pour.spec.ts`
- Modifier : `src/i18n/locales/{fr,en,de,it}/matching.json`

- [ ] **Étape 1 : écrire la spec qui échoue**

`tests/unit/fiche-qui-pour.spec.ts` :

```ts
/**
 * « Qui pour ce bien ? » (lots C et D1, conception §7) : un compatible REPORTÉ dit jusqu'à quand, un REVENU dit à quel
 * prix il avait été refusé — ni l'un ni l'autre ne passe pour une suggestion ordinaire —, et une fiche lit les matchs DU
 * bien, jamais ceux de l'agence.
 */
import { describe, expect, it } from 'vitest'
import { etatCompatible, trierCompatibles, versCompatible, type Compatible } from '@/components/matching-fil/filQuiPour'

const T = Date.parse('2026-09-23T10:00:00Z')
const base: Compatible = { id: 'm1', score: 90, reporteJusquau: null, acheteur: { id: 'c1', prenom: 'Julie', nom: 'Morand' } }
const suivi = (statut: 'suggested' | 'sent' | 'interested' | 'visit_planned' | 'rejected', champs: Record<string, unknown> = {}) => ({
  ...base, suivi: { statut, proposeLe: '2026-09-20T09:00:00Z', reponduLe: null, motif: null, note: null, prixPropose: null, apprisLe: null, ...champs },
})

describe('etatCompatible', () => {
  it('un reporté dit jusqu’à quand ; un report échu n’en est plus un', () => {
    expect(etatCompatible({ ...base, reporteJusquau: '2026-09-30T00:00:00Z' }, T)).toEqual({ cle: 'reporte', date: '2026-09-30T00:00:00Z' })
    expect(etatCompatible({ ...base, reporteJusquau: '2026-09-01T00:00:00Z' }, T)).toEqual({ cle: 'aProposer' })
  })

  it('un revenu dit à quel prix il avait été refusé', () => {
    expect(etatCompatible(suivi('suggested', { motif: 'prix', prixPropose: 3_450_000 }), T)).toEqual({ cle: 'revenu', prix: 3_450_000 })
  })

  it('les autres états', () => {
    expect(etatCompatible(base, T)).toEqual({ cle: 'aProposer' })
    expect(etatCompatible(suivi('sent'), T)).toEqual({ cle: 'propose', date: '2026-09-20T09:00:00Z' })
    expect(etatCompatible(suivi('sent', { proposeLe: null }), T)).toEqual({ cle: 'proposeSansDate' })
    expect(etatCompatible(suivi('interested'), T)).toEqual({ cle: 'interesse' })
    expect(etatCompatible(suivi('visit_planned'), T)).toEqual({ cle: 'visite' })
    expect(etatCompatible(suivi('rejected', { motif: 'quartier' }), T)).toEqual({ cle: 'refuse', motif: 'fil.motifs.quartier' })
    // Un code que le geste n'écrit pas ne s'affiche pas en brut.
    expect(etatCompatible(suivi('rejected', { motif: 'recherche_ajustee' }), T)).toEqual({ cle: 'refuseSansMotif' })
  })

  it('par score, l’id départage', () => {
    const tries = trierCompatibles([{ ...base, id: 'b', score: 80 }, { ...base, id: 'a', score: 80 }, { ...base, id: 'c', score: 95 }])
    expect(tries.map((m) => m.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('versCompatible', () => {
  const ligne = {
    id: 'm5', contact_id: 'c10', score: '97', status: 'suggested', snoozed_until: null, sent_at: '2026-09-03T00:00:00Z',
    response_at: '2026-09-05T00:00:00Z', reaction_motif: 'prix', reaction_note: null, prix_propose: '3450000',
  }
  it('un bien revenu garde son suivi ; une suggestion jamais proposée n’en a pas', () => {
    expect(versCompatible(ligne, { first_name: 'Antoine', last_name: 'Lefèvre' })).toMatchObject({
      id: 'm5', score: 97, acheteur: { id: 'c10', prenom: 'Antoine', nom: 'Lefèvre' },
      suivi: { statut: 'suggested', motif: 'prix', prixPropose: 3_450_000 },
    })
    expect(versCompatible({ ...ligne, reaction_motif: null, prix_propose: null }, { first_name: 'A', last_name: 'B' })!.suivi).toBeUndefined()
  })
  it('sans acheteur lisible, rien', () => {
    expect(versCompatible(ligne, undefined)).toBeNull()
  })
})
```

- [ ] **Étape 2 : la jouer, elle échoue**

```bash
npx vitest run tests/unit/fiche-qui-pour.spec.ts
```

Attendu : échec, `Failed to resolve import "@/components/matching-fil/filQuiPour"`.

- [ ] **Étape 3 : le modèle**

`src/components/matching-fil/filQuiPour.ts` :

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

/** Un acquéreur compatible : ce que le fil sait d'un match, ou ce qu'une fiche en lit. */
export type Compatible = Pick<FilMatch, 'id' | 'score' | 'reporteJusquau' | 'suivi'> & {
  acheteur: Pick<FilMatch['acheteur'], 'id' | 'prenom' | 'nom'>
}

/** Une ligne `matches` lue par une fiche (`useQuiPourCeBien`). */
export interface LigneCompatible {
  id: string
  contact_id: string
  score: number | string | null
  status: string
  snoozed_until: string | null
  sent_at: string | null
  response_at: string | null
  reaction_motif: string | null
  reaction_note: string | null
  prix_propose: number | string | null
}

/**
 * Un compatible lu par une fiche ; `null` sans acheteur lisible. Le suivi d'un match à proposer n'existe que s'il a déjà
 * été proposé — la règle de `suiviAProposer` dans le fil.
 */
export function versCompatible(
  l: LigneCompatible, c: { first_name: string | null; last_name: string | null } | undefined,
): Compatible | null {
  if (!c) return null
  const prixPropose = nombreOuNull(l.prix_propose)
  const jamaisPropose = l.status === 'suggested' && prixPropose == null && l.reaction_motif == null
  const suivi: SuiviMatch | undefined = jamaisPropose ? undefined : {
    statut: l.status as SuiviMatch['statut'], proposeLe: l.sent_at, reponduLe: l.response_at, motif: l.reaction_motif,
    note: l.reaction_note, prixPropose, apprisLe: null,
  }
  return {
    id: l.id, score: nombreOuNull(l.score) ?? 0, reporteJusquau: l.snoozed_until, suivi,
    acheteur: { id: l.contact_id, prenom: c.first_name ?? '', nom: c.last_name ?? '' },
  }
}

/** L'état d'un compatible, à écrire : une clé `fil.quiPour.etat.*` et ses valeurs (dates et prix encore bruts). */
type EtatCompatible =
  | { cle: 'reporte'; date: string }
  | { cle: 'aProposer' }
  | { cle: 'revenu'; prix: number }
  | { cle: 'propose'; date: string }
  | { cle: 'proposeSansDate' }
  | { cle: 'interesse' }
  | { cle: 'visite' }
  | { cle: 'refuse'; motif: string }
  | { cle: 'refuseSansMotif' }

/** Où en est un compatible, à l'heure de la lecture. */
export function etatCompatible(m: Compatible, maintenant: number): EtatCompatible {
  if (m.reporteJusquau && temps(m.reporteJusquau) > maintenant) return { cle: 'reporte', date: m.reporteJusquau }
  const s = m.suivi
  if (!s || s.statut === 'suggested') {
    return s?.motif === 'prix' && s.prixPropose != null ? { cle: 'revenu', prix: s.prixPropose } : { cle: 'aProposer' }
  }
  if (s.statut === 'sent') return s.proposeLe ? { cle: 'propose', date: s.proposeLe } : { cle: 'proposeSansDate' }
  if (s.statut === 'interested') return { cle: 'interesse' }
  if (s.statut === 'visit_planned') return { cle: 'visite' }
  const motif = cleMotif(s.motif)
  return motif ? { cle: 'refuse', motif } : { cle: 'refuseSansMotif' }
}

/** Les compatibles d'un bien, par score ; l'id départage. */
export const trierCompatibles = <T extends Compatible>(ms: readonly T[]): T[] =>
  [...ms].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
```

- [ ] **Étape 4 : la jouer, elle passe**

```bash
npx vitest run tests/unit/fiche-qui-pour.spec.ts
```

Attendu : `Tests  6 passed`.

- [ ] **Étape 5 : les deux listes, partagées**

`src/components/matching-fil/QuiPourCeBien.tsx` :

```tsx
/**
 * « Qui pour ce bien ? » — les deux listes (lot C), partagées par le panneau du fil et les deux fiches (lot D1,
 * conception §7) : (1) les acquéreurs compatibles, par score, avec leur état ; (2) les anciens prospects d'un MANDAT,
 * notés à la demande par le moteur (`useAnciensProspects`) — une annonce du marché n'en a pas : le moteur ne les note que
 * contre un mandat. Ni l'en-tête du bien, ni la notion de ligne du fil : « Ouvrir » est ce que l'appelant en fait
 * (`ouvrir`) — choisir une ligne dans le fil, ou y mener depuis une fiche.
 *
 * ⛔ Réactiver n'écrit rien à l'acheteur : c'est l'agent qui l'appellera (conception de la boucle, §1).
 * ⚠ Les anciens prospects ne se demandent au moteur qu'après `delaiProspects` : dans le fil, parcourir les en-têtes aux
 * flèches relirait sinon les recherches closes de l'agence à chaque passage. Sur une fiche, tout de suite.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { useToast } from '@/components/ui/Toast'
import { useAnciensProspects, type AncienProspect } from '@/hooks/useAnciensProspects'
import { initiales, palierScore } from './filModele'
import { dateCourte, dateLongue, montant } from './filAffichage'
import { etatCompatible, trierCompatibles, type Compatible } from './filQuiPour'
import { FilAvatar, FilBouton, FilScore } from './filAtomes'

interface Props {
  sp: CrmPalette
  /** Le bien : un mandat a des anciens prospects, une annonce du marché non. */
  bien: { genre: 'mandat' | 'annonce'; id: string; location: boolean }
  compatibles: readonly Compatible[]
  /** L'heure de la lecture : un report se compare à elle. */
  maintenant: number
  /** Le geste qui ouvre un compatible, ou `null` s'il n'a pas de place à ouvrir. */
  ouvrir: (m: Compatible) => (() => void) | null
  onVoirContact: (contactId: string) => void
  /** Le délai avant de noter les anciens prospects ; 0 : tout de suite. */
  delaiProspects: number
}

export default function QuiPourCeBien({ sp, bien, compatibles, maintenant, ouvrir, onVoirContact, delaiProspects }: Props) {
  const { t } = useTranslation('matching')
  const toast = useToast()
  const mandat = bien.genre === 'mandat'
  const [pret, setPret] = useState(delaiProspects <= 0)
  useEffect(() => {
    if (delaiProspects <= 0) return
    const minuterie = setTimeout(() => setPret(true), delaiProspects)
    return () => clearTimeout(minuterie)
  }, [bien.id, delaiProspects])
  const prospects = useAnciensProspects(mandat && pret ? bien.id : null)
  const tries = trierCompatibles(compatibles)
  const anciens = prospects.data ?? []
  const reactiver = (p: AncienProspect): void => {
    // Pas de `desactive` sur le bouton : un bouton désactivé sous le focus le perd, et `reprendreFocus`
    // (`MatchingFil`) le renverrait à la liste. La garde est ici.
    if (prospects.reactiver.isPending) return
    prospects.reactiver.mutate(p, {
      onSuccess: () => { toast.success(t('fil.quiPour.reactive', { prenom: p.prenom })) },
      onError: () => { toast.error(t('fil.quiPour.erreurReactiver')) },
    })
  }
  const titre: CSSProperties = { margin: 0, marginBottom: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }
  const aide: CSSProperties = { margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }
  const nom: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink,
  }
  const ligne: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', paddingTop: 'var(--crm-space-sm)',
    paddingBottom: 'var(--crm-space-sm)', borderBottom: `1px solid ${sp.cardBorder}`,
  }
  const liste: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 }
  return (
    <>
      <div>
        <h3 style={titre}>{t('fil.quiPour.compatibles', { count: tries.length })}</h3>
        {tries.length === 0 ? <p style={aide}>{t('fil.quiPour.aucunCompatible')}</p> : (
          <ul style={liste}>
            {tries.map((m) => {
              const geste = ouvrir(m)
              return (
                <li key={m.id} style={ligne}>
                  <FilAvatar sp={sp} texte={initiales(m.acheteur.prenom, m.acheteur.nom)} taille={28} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <button type="button" onClick={() => onVoirContact(m.acheteur.id)} style={nom}>{m.acheteur.prenom} {m.acheteur.nom}</button>
                    <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{texteEtat(m, maintenant, bien.location, t)}</span>
                  </span>
                  <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
                  {geste && (
                    <FilBouton sp={sp} compact onClick={geste}>
                      {t('fil.quiPour.ouvrir')}<span className="sr-only"> {m.acheteur.prenom} {m.acheteur.nom}</span>
                    </FilBouton>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {mandat && (
        <div>
          <h3 style={titre}>{t('fil.quiPour.anciens')}</h3>
          <p style={{ ...aide, marginBottom: 'var(--crm-space-md)' }}>{t('fil.quiPour.anciensAide')}</p>
          {!pret || prospects.isLoading ? <p role="status" style={aide}>{t('fil.quiPour.chargement')}</p>
            : prospects.isError ? (
              <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', flexWrap: 'wrap' }}>
                <p style={aide}>{t('fil.quiPour.erreur')}</p>
                <FilBouton sp={sp} compact onClick={() => { void prospects.refetch() }}>{t('fil.reessayer')}</FilBouton>
              </div>
            ) : anciens.length === 0 ? <p style={aide}>{t('fil.quiPour.aucunAncien')}</p> : (
              <ul style={liste}>
                {anciens.map((p) => (
                  <li key={p.contact_id} style={ligne}>
                    <FilAvatar sp={sp} texte={initiales(p.prenom, p.nom)} taille={28} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <button type="button" onClick={() => onVoirContact(p.contact_id)} style={nom}>{p.prenom} {p.nom}</button>
                      <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{origine(p, t)}</span>
                    </span>
                    <FilScore sp={sp} score={p.score} palier={palierScore(p.score)} />
                    <FilBouton sp={sp} compact principal onClick={() => reactiver(p)}>
                      {t('fil.quiPour.reactiver')}<span className="sr-only"> {p.prenom} {p.nom}</span>
                    </FilBouton>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
    </>
  )
}

/** L'état d'un compatible, écrit. */
function texteEtat(m: Compatible, maintenant: number, location: boolean, t: TFunction): string {
  const e = etatCompatible(m, maintenant)
  switch (e.cle) {
    case 'reporte': return t('fil.quiPour.etat.reporte', { date: dateCourte(e.date) })
    case 'propose': return t('fil.quiPour.etat.propose', { date: dateCourte(e.date) })
    case 'revenu': return t('fil.quiPour.etat.revenu', { prix: montant(location, e.prix, t) })
    case 'refuse': return t('fil.quiPour.etat.refuse', { motif: t(e.motif) })
    default: return t(`fil.quiPour.etat.${e.cle}`)
  }
}

/** Ce qui fait un ancien prospect, daté avec l'année : un deal perdu remonte jusqu'à 24 mois. */
function origine(p: AncienProspect, t: TFunction): string {
  if (p.origine === 'deal_perdu') return p.depuis ? t('fil.quiPour.dealPerdu', { date: dateLongue(p.depuis) }) : t('fil.quiPour.dealPerduSansDate')
  return p.depuis ? t('fil.quiPour.rechercheClose', { date: dateLongue(p.depuis) }) : t('fil.quiPour.rechercheCloseSansDate')
}
```

- [ ] **Étape 6 : le panneau du fil garde son en-tête et délègue ses listes**

Remplacer TOUT `src/components/matching-fil/FilQuiPourCeBien.tsx` par :

```tsx
/**
 * « Qui pour ce bien ? » (lot C, conception de la boucle §4.2) — le panneau de l'en-tête d'un bien en mandat, dans le
 * fil : l'en-tête du bien (vignette, prix, signal, « Voir le bien »), puis les deux listes partagées avec les fiches
 * (`QuiPourCeBien`, lot D1) — les acquéreurs compatibles, qu'on ouvre en un clic s'ils sont une ligne du fil, et les
 * anciens prospects. Les prescripteurs attendent le modèle relationnel (étape 6) : pas de section vide.
 *
 * ⚠ Les anciens prospects ne se demandent au moteur qu'après `DELAI_PROSPECTS` sur l'en-tête : parcourir le fil aux
 * flèches passe sur chaque en-tête, et chaque passage relirait les recherches closes de l'agence. Le panneau est remonté
 * à chaque ligne (`key` du conteneur, `MatchingFil`) : quitter l'en-tête avant le délai n'appelle rien.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import type { FilBien, FilMatch } from './filModele'
import { encreAccent, MARGE_POINTS, prixBien, texteSignalBien } from './filAffichage'
import { signalBien } from './filSignaux'
import { FilVignette } from './filAtomes'
import QuiPourCeBien from './QuiPourCeBien'

/** Le temps qu'un en-tête reste choisi avant qu'on note ses anciens prospects : au-delà, on s'y arrête. */
const DELAI_PROSPECTS = 400

interface Props {
  sp: CrmPalette
  bien: FilBien
  /** Ses matchs connus du fil : à proposer, reportés, et ceux de la boucle. */
  compatibles: FilMatch[]
  /** L'heure de la lecture du fil. */
  maintenant: number
  /** Le match est une ligne du fil telle qu'elle s'affiche (filtres compris) : « Ouvrir » ne mène qu'à ce qu'on voit. */
  peutOuvrir: (matchId: string) => boolean
  onChoisir: (matchId: string) => void
  onVoirBien: () => void
  onVoirContact: (contactId: string) => void
}

export default function FilQuiPourCeBien({ sp, bien, compatibles, maintenant, peutOuvrir, onChoisir, onVoirBien, onVoirContact }: Props) {
  const { t } = useTranslation('matching')
  const signal = signalBien(bien, maintenant)
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: encreAccent(sp),
  }
  return (
    <section aria-label={t('fil.quiPour.titreAria', { titre: bien.titre })} style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)',
      padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-2xl)' }}>
        <FilVignette sp={sp} photo={bien.photo} largeur={96} hauteur={72} />
        <div style={{ minWidth: 0 }}>
          <span style={{
            display: 'inline-block', padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
            border: `1px solid ${sp.cardBorder}`, fontSize: 'var(--crm-text-xs)', color: sp.sub,
          }}>
            {t('fil.quiPour.titre')}
          </span>
          <h2 style={{ margin: 0, marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>{bien.titre}</h2>
          <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
            {[prixBien(bien, t), bien.adresse, bien.ville].filter(Boolean).join(' · ')}
          </p>
          {signal && (
            <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>
              {texteSignalBien(signal, bien, t)}
            </p>
          )}
          <button type="button" onClick={onVoirBien} style={lien}>{t('fil.voirBien')}</button>
        </div>
      </div>

      <QuiPourCeBien sp={sp} bien={{ genre: 'mandat', id: bien.id, location: bien.location }} compatibles={compatibles}
        maintenant={maintenant} ouvrir={(m) => (peutOuvrir(m.id) ? () => onChoisir(m.id) : null)}
        onVoirContact={onVoirContact} delaiProspects={DELAI_PROSPECTS} />
    </section>
  )
}
```

- [ ] **Étape 7 : le libellé d'un revenu**

```bash
python3 - <<'EOF'
import json
REVENU = {'fr': 'Revenu · refusé à {{prix}}', 'en': 'Back · declined at {{prix}}',
          'de': 'Wieder da · abgelehnt bei {{prix}}', 'it': 'Tornato · rifiutato a {{prix}}'}
for lang, valeur in REVENU.items():
    p = f'src/i18n/locales/{lang}/matching.json'
    d = json.load(open(p, encoding='utf-8'))
    d['fil']['quiPour']['etat']['revenu'] = valeur
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('ok')
EOF
```

- [ ] **Étape 8 : compiler, jouer, regarder**

```bash
npx tsc -b
npm run --silent i18n:parity:ci && npm run --silent i18n:coverage:ci
npx vitest run tests/unit/fiche-qui-pour.spec.ts tests/unit/matching-fil-signaux.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/matching-sans-sortie.spec.ts
```

Attendu : tout vert (`src/components/matching-fil` reste à `{ hors: 0, total: 0 }` au cliquet : le code déplacé n'a que des jetons).

Banc : `http://localhost:5173/dev/crm?entree=%2Fdashboard%2Fmatching`, choisir l'en-tête « Attique 5,5 pièces · Florissant » : le panneau est le même qu'avant (Anastasia et Emma compatibles, « Ouvrir », anciens prospects après un court délai, « Réactiver »).

---

## Tâche 10 : « Qui pour ce bien ? » sur les deux fiches

**Fichiers :**
- Créer : `src/hooks/useQuiPourCeBien.ts`
- Créer : `src/components/matching-fil/QuiPourFiche.tsx`
- Modifier : `src/pages/agent/ListingDetailPage.tsx`
- Modifier : `src/pages/agent/ExternalListingDetailPage.tsx`
- Modifier : `src/hooks/useAnciensProspects.ts`
- Modifier : `tests/unit/fiche-qui-pour.spec.ts`
- Modifier : `src/i18n/locales/{fr,en,de,it}/{matching,listings}.json`

- [ ] **Étape 1 : la spec de lecture, qui échoue**

Dans `tests/unit/fiche-qui-pour.spec.ts`, ajouter `import { readFileSync } from 'node:fs'` en tête, puis, à la fin :

```ts
describe('la fiche lit les matchs DU bien (lecture du code)', () => {
  const source = (f: string) => readFileSync(f, 'utf8')

  it('aucune fiche ne charge les matchs de l’agence', () => {
    for (const f of ['src/pages/agent/ListingDetailPage.tsx', 'src/pages/agent/ExternalListingDetailPage.tsx']) {
      const code = source(f)
      expect(code, f).not.toMatch(/\buseMatching\(/)
      expect(code, f).toMatch(/<QuiPourFiche\b/)
    }
  })

  it('la requête est ciblée sur le bien, bornée, et cloisonnée à l’agence', () => {
    const code = source('src/hooks/useQuiPourCeBien.ts')
    expect(code).toMatch(/genre === 'mandat' \? 'property_id' : 'market_listing_id'/)
    expect(code).toMatch(/\.eq\(colonne, /)
    expect(code).toMatch(/\.eq\('agency_id', /)
    expect(code).toMatch(/\.limit\(MAX_COMPATIBLES\)/)
    expect(source('src/components/matching-fil/QuiPourFiche.tsx')).toMatch(/useQuiPourCeBien\(/)
  })

  it('« Réactiver » rafraîchit aussi la liste de la fiche', () => {
    expect(source('src/hooks/useAnciensProspects.ts')).toMatch(/invalidateQueries\(\{ queryKey: \[CLE_QUI_POUR\] \}\)/)
  })
})
```

```bash
npx vitest run tests/unit/fiche-qui-pour.spec.ts
```

Attendu : les trois cas neufs échouent (`ENOENT` pour le hook, `useMatching(` trouvé dans la fiche).

- [ ] **Étape 2 : la lecture ciblée**

`src/hooks/useQuiPourCeBien.ts` :

```ts
/**
 * « Qui pour ce bien ? » sur une fiche (lot D1, conception §7) — les matchs DU bien, par une requête CIBLÉE
 * (`property_id` ou `market_listing_id`), jamais `useMatching()` : celui-ci chargeait tous les matchs de l'agence pour en
 * garder quelques-uns — 1 754 en production le 21.09.2026 —, et PostgREST les tronque à 1 000 sans rien dire.
 *
 * Les compatibles sont les matchs qu'un refus n'a pas écartés — à proposer (reportés compris), proposés, intéressés, en
 * visite —, les mêmes que compte « Ce qui a bougé » (`pige_acheteurs_compatibles`).
 * ⚠ Clé `CLE_QUI_POUR` : « Réactiver » un ancien prospect l'invalide (`useAnciensProspects`).
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { lire } from '@/hooks/useMatchingFil'
import { versCompatible, type Compatible, type LigneCompatible } from '@/components/matching-fil/filQuiPour'

/** Préfixe des clés de requête des fiches. */
export const CLE_QUI_POUR = 'qui-pour'
/** Les statuts d'un acquéreur compatible. */
const STATUTS_COMPATIBLES = ['suggested', 'sent', 'interested', 'visit_planned']
/** Borne de la lecture (§7 de CLAUDE.md) : un bien n'a jamais autant d'acquéreurs, mais une requête se borne. */
const MAX_COMPATIBLES = 200

interface QuiPour { compatibles: Compatible[]; chargeLe: number }

/** Les acquéreurs compatibles d'un mandat ou d'une annonce du marché ; `null` : rien n'est lu. */
export function useQuiPourCeBien(cible: { genre: 'mandat' | 'annonce'; id: string } | null) {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const genre = cible?.genre ?? null
  const id = cible?.id ?? null
  const q = useQuery<QuiPour>({
    queryKey: [CLE_QUI_POUR, agencyId, genre, id],
    enabled: Boolean(agencyId && genre && id),
    staleTime: 30_000,
    queryFn: async () => {
      const debut = Date.now()
      const colonne = genre === 'mandat' ? 'property_id' : 'market_listing_id'
      const lignes = await lire<LigneCompatible>(supabase.from('matches')
        .select('id, contact_id, score, status, snoozed_until, sent_at, response_at, reaction_motif, reaction_note, prix_propose')
        .eq('agency_id', agencyId!)
        .eq(colonne, id!)
        .in('status', STATUTS_COMPATIBLES)
        .order('score', { ascending: false })
        .order('id', { ascending: true })
        .limit(MAX_COMPATIBLES))
      const contactIds = [...new Set(lignes.map((l) => l.contact_id))]
      const contacts = contactIds.length
        ? await lire<{ id: string; first_name: string | null; last_name: string | null }>(
          supabase.from('contacts').select('id, first_name, last_name').in('id', contactIds))
        : []
      const parId = new Map(contacts.map((c) => [c.id, c]))
      const compatibles = lignes.flatMap((l) => {
        const c = versCompatible(l, parId.get(l.contact_id))
        return c ? [c] : []
      })
      return { compatibles, chargeLe: debut }
    },
  })
  return {
    compatibles: q.data?.compatibles ?? [], chargeLe: q.data?.chargeLe ?? 0,
    isLoading: q.isLoading, isError: q.isError, refetch: q.refetch,
  }
}
```

- [ ] **Étape 3 : le bloc d'une fiche**

`src/components/matching-fil/QuiPourFiche.tsx` :

```tsx
/**
 * « Qui pour ce bien ? » sur une fiche (lot D1, conception §7) : la lecture CIBLÉE des matchs du bien
 * (`useQuiPourCeBien`), ses états de lecture, et les listes partagées avec le fil (`QuiPourCeBien`). « Ouvrir » mène à la
 * place du match dans le fil (`lienPlace`) ; la fiche fait la navigation.
 */
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { useQuiPourCeBien } from '@/hooks/useQuiPourCeBien'
import { lienPlace } from './filLiens'
import { FilBouton } from './filAtomes'
import QuiPourCeBien from './QuiPourCeBien'

interface Props {
  sp: CrmPalette
  genre: 'mandat' | 'annonce'
  /** `null` : pas de bien réel (banc de démonstration) — rien n'est lu. */
  bienId: string | null
  location: boolean
  /** Les acheteurs à ne pas lister : déjà en deal sur ce bien, la fiche les montre ailleurs. */
  exclure?: ReadonlySet<string>
  onOuvrirFil: (requete: string) => void
  onVoirContact: (contactId: string) => void
}

export default function QuiPourFiche({ sp, genre, bienId, location, exclure, onOuvrirFil, onVoirContact }: Props) {
  const { t } = useTranslation('matching')
  const q = useQuiPourCeBien(bienId ? { genre, id: bienId } : null)
  const aide = { margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub } as const
  if (q.isLoading) return <p role="status" style={aide}>{t('fil.quiPour.chargementCompatibles')}</p>
  if (q.isError) {
    return (
      <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', flexWrap: 'wrap' }}>
        <p style={aide}>{t('fil.quiPour.erreurCompatibles')}</p>
        <FilBouton sp={sp} compact onClick={() => { void q.refetch() }}>{t('fil.reessayer')}</FilBouton>
      </div>
    )
  }
  const compatibles = exclure ? q.compatibles.filter((m) => !exclure.has(m.acheteur.id)) : q.compatibles
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)' }}>
      <QuiPourCeBien sp={sp} bien={{ genre, id: bienId ?? '', location }} compatibles={compatibles} maintenant={q.chargeLe}
        ouvrir={(m) => {
          const requete = lienPlace({ id: m.id, statut: m.suivi?.statut, contactId: m.acheteur.id, marche: genre === 'annonce' })
          return requete ? () => onOuvrirFil(requete) : null
        }}
        onVoirContact={onVoirContact} delaiProspects={0} />
    </div>
  )
}
```

- [ ] **Étape 4 : la fiche d'un mandat**

Dans `src/pages/agent/ListingDetailPage.tsx` :

a. Imports : retirer `import { useMatching } from '@/hooks/useMatching'` ; remplacer `import { useNavigate, useParams } from 'react-router-dom'` par `import { useNavigate, useParams, useSearchParams } from 'react-router-dom'` ; ajouter :

```ts
import { useQuiPourCeBien } from '@/hooks/useQuiPourCeBien'
import QuiPourFiche from '@/components/matching-fil/QuiPourFiche'
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
```

b. Remplacer :

```ts
  // Matches IA (suggestions d'acheteurs) — moteur réel, filtré sur ce bien.
  const { matches: allMatches } = useMatching()
```

par :

```ts
  // « Qui pour ce bien ? » (lot D1) : les matchs DU bien, par une requête ciblée — plus `useMatching()`, qui chargeait
  // tous les matchs de l'agence (PostgREST les tronque à 1 000). `QuiPourFiche` lit la même clé : un seul appel.
  const quiPour = useQuiPourCeBien(id ? { genre: 'mandat', id } : null)
  // `?qui=1` (« Aujourd'hui », l'écran de fin de « Nouveau bien ») : la fiche défile jusqu'au bloc — ses colonnes
  // défilent chacune, et le bloc peut être sous le pli.
  const [params] = useSearchParams()
  const quiDemande = params.has(PARAM_QUI_POUR)
  const blocQuiPour = useRef<HTMLDivElement>(null)
  const bienCharge = bien?.id
  useEffect(() => {
    if (quiDemande && bienCharge) blocQuiPour.current?.scrollIntoView({ block: 'start' })
  }, [quiDemande, bienCharge])
```

c. Remplacer :

```ts
  // Suggestions d'acheteurs (matches IA) hors deals existants.
  const bienMatches = allMatches.filter(
    m => m.propertyId === bien.id && m.status === 'suggested' && !dealsForBien.some(d => d.contact_buyer_id === m.contactId),
  )
```

par :

```ts
  // Les acheteurs déjà en deal sur ce bien : « Acheteurs en cours » les montre, « Qui pour ce bien ? » les tait.
  const enDeal = new Set(dealsForBien.map(d => d.contact_buyer_id).filter((x): x is string => !!x))
  const compatibles = quiPour.compatibles.filter(m => !enDeal.has(m.acheteur.id))
```

d. Dans `liees`, remplacer `...bienMatches.map(m => ({ contactId: m.contactId, nom: m.contactName, score: m.score })),` par :

```ts
    ...compatibles.map(m => ({ contactId: m.acheteur.id, nom: `${m.acheteur.prenom} ${m.acheteur.nom}`.trim(), score: m.score })),
```

et, dans son commentaire, « puis les suggestions » par « puis les acquéreurs compatibles ».

e. Remplacer tout le bloc `{bienMatches.length > 0 && ( … )}` de la colonne « Les gens » (du `{bienMatches.length > 0 && (` à sa parenthèse fermante `)}`) par :

```tsx
                {/* « Qui pour ce bien ? » (lot D1, conception §7) — toujours là : c'est aussi la place des anciens
                    prospects. Le score est celui du moteur, déterministe : plus de « Suggestions MEGGA AI ». */}
                <div className="bf-bloc" ref={blocQuiPour}>
                  <BfGrp vx={vx}>{tr('fil.quiPour.titre', { ns: 'matching' })}</BfGrp>
                  <QuiPourFiche sp={sp} genre="mandat" bienId={id ?? null} location={bien.transaction_type === 'rent'}
                    exclure={enDeal}
                    onOuvrirFil={(requete) => navigate(`/dashboard/matching?${requete}`)}
                    onVoirContact={(contactId) => navigate(`/dashboard/contacts/${contactId}`)} />
                </div>
```

`useEffect` et `useRef` sont déjà importés. Si `tr('…', { ns: 'matching' })` ne se type pas, passer par `i18n.t('fil.quiPour.titre', { ns: 'matching' })` (`i18n` est déjà tiré de `useTranslation`).

- [ ] **Étape 5 : la fiche d'une annonce du marché**

Dans `src/pages/agent/ExternalListingDetailPage.tsx` :

a. Imports : `import { useState, useMemo } from 'react'` → `import { useEffect, useMemo, useRef, useState } from 'react'` ; `import { useLocation, useNavigate, useParams, Link } from 'react-router-dom'` → `import { useLocation, useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'` ; ajouter :

```ts
import QuiPourFiche from '@/components/matching-fil/QuiPourFiche'
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
```

b. Juste sous `const sgSp = useMemo(() => crmPalette(dark), [dark])` :

```ts
  // `?qui=1` (« Ce qui a bougé », lot D1) : la page défile jusqu'à « Qui pour ce bien ? », sous le carrousel.
  const [params] = useSearchParams()
  const quiDemande = params.has(PARAM_QUI_POUR)
  const blocQuiPour = useRef<HTMLElement>(null)
  const annonceChargee = annonce?.id
  useEffect(() => {
    if (quiDemande && annonceChargee) blocQuiPour.current?.scrollIntoView({ block: 'start' })
  }, [quiDemande, annonceChargee])
```

c. Dans la colonne droite, entre le bloc « Match context » (`{contactName && ( … )}`) et le commentaire `{/* Actions */}`, insérer :

```tsx
            {/* « Qui pour ce bien ? » (lot D1, conception §7) : les acquéreurs compatibles de CETTE annonce, par une
                requête ciblée. Pas d'anciens prospects : le moteur ne les note que contre un mandat. Rayon et marge en
                jetons : cette page est au cliquet de `megga-x-grammar.spec.ts`. */}
            {annonce && (
              <section ref={blocQuiPour} className="border border-theme-border" style={{ borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-2xl)' }}>
                <h2 style={{ margin: 0, marginBottom: 'var(--crm-space-md)', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sgSp.sub }}>
                  {t('fil.quiPour.titre', { ns: 'matching' })}
                </h2>
                <QuiPourFiche sp={sgSp} genre="annonce" bienId={annonce.id} location={annonce.transaction_type === 'rent'}
                  onOuvrirFil={(requete) => navigate(`/dashboard/matching?${requete}`)}
                  onVoirContact={(contactId) => navigate(`/dashboard/contacts/${contactId}`)} />
              </section>
            )}
```

- [ ] **Étape 6 : « Réactiver » rafraîchit aussi la fiche**

Dans `src/hooks/useAnciensProspects.ts`, ajouter `import { CLE_QUI_POUR } from '@/hooks/useQuiPourCeBien'`, remplacer :

```ts
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLE_FIL] }),
```

par :

```ts
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: [CLE_FIL] }),
      // Lot D1 : la liste d'une fiche porte sa propre clé ; sans elle, le prospect réactivé n'y paraissait pas.
      qc.invalidateQueries({ queryKey: [CLE_QUI_POUR] }),
    ]),
```

et, dans l'en-tête, « ⚠ Réactiver invalide TOUT le fil (`CLE_FIL`) » par « ⚠ Réactiver invalide TOUT le fil (`CLE_FIL`) et les fiches (`CLE_QUI_POUR`) ».

- [ ] **Étape 7 : les libellés**

```bash
python3 - <<'EOF'
import json

def charger(ns, lang):
    p = f'src/i18n/locales/{lang}/{ns}.json'
    return p, json.load(open(p, encoding='utf-8'))

def sauver(p, d):
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')

LECTURE = {
  'fr': ('Lecture des acquéreurs compatibles…', "Les acquéreurs compatibles n'ont pas pu être lus."),
  'en': ('Reading matching buyers…', 'Matching buyers could not be read.'),
  'de': ('Passende Käufer werden gelesen…', 'Passende Käufer konnten nicht gelesen werden.'),
  'it': ('Lettura degli acquirenti compatibili…', 'Non è stato possibile leggere gli acquirenti compatibili.'),
}
for lang, (chargement, erreur) in LECTURE.items():
    p, d = charger('matching', lang)
    d['fil']['quiPour']['chargementCompatibles'] = chargement
    d['fil']['quiPour']['erreurCompatibles'] = erreur
    sauver(p, d)
    # « Suggestions MEGGA AI » et ses deux voisines n'ont plus de lecteur : un score déterministe n'est pas de l'IA.
    p, d = charger('listings', lang)
    del d['fiche']['suggestions']
    del d['detail']['buyers']['propose']
    del d['detail']['buyers']['matchAffinity']
    sauver(p, d)
print('ok')
EOF
grep -rn "fiche.suggestions\|buyers.propose\|buyers.matchAffinity" src | grep -v "i18n/locales" || echo "aucun lecteur restant"
```

Attendu : « aucun lecteur restant ».

- [ ] **Étape 8 : compiler, jouer, regarder**

```bash
npx tsc -b
npm run --silent i18n:parity:ci && npm run --silent i18n:coverage:ci && npm run --silent lint:i18n && npm run --silent lint:deadcode
npx vitest run tests/unit/fiche-qui-pour.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/redirection-ouverte.spec.ts tests/unit/mrh-listing-detail.test.ts
```

Attendu : tout vert. `useMatching` garde d'autres lecteurs : `lint:deadcode` ne doit rien signaler de neuf.

Banc :
- `http://localhost:5173/dev/crm?entree=%2Fdashboard%2Flistings%2Fp3%3Fqui%3D1` → la fiche de Florissant défile jusqu'à « Qui pour ce bien ? » : Anastasia et Emma (« À proposer »), « Ouvrir » mène au fil sur leur ligne ; anciens prospects dessous.
- `http://localhost:5173/dev/crm?entree=%2Fdashboard%2Flistings%2Fp2` → Antoine « Revenu · refusé à CHF 3'450'000 ».
- `http://localhost:5173/dev/crm?entree=%2Fdashboard%2Fmarket%2F00432e97-f3d2-4d11-9c1f-dd882343ee8e%3Fqui%3D1` → l'annonce du banc : Camille « Proposé le … », « Ouvrir » mène à « Retours de … » ; pas de section « Anciens prospects ».

---

## Tâche 11 : le nouveau mandat dit ses acquéreurs

**Fichiers :**
- Créer : `src/components/crm/biens/nouveau/acquereurs.ts`
- Créer : `src/hooks/useAcquereursNouveauMandat.ts`
- Créer : `src/components/crm/biens/nouveau/LigneAcquereurs.tsx`
- Modifier : `src/components/crm/biens/nouveau/NouveauBien.tsx`
- Modifier : `src/pages/agent/NouveauBienPage.tsx`, `src/pages/agent/ListingsPage.tsx`
- Modifier : `tests/unit/fiche-qui-pour.spec.ts`
- Modifier : `src/i18n/locales/{fr,en,de,it}/listings.json`

- [ ] **Étape 1 : la spec qui échoue**

À la fin de `tests/unit/fiche-qui-pour.spec.ts`, avec `import { DELAI_RECHERCHE_MS, etatAcquereurs } from '@/components/crm/biens/nouveau/acquereurs'` ajouté aux imports :

```ts
describe('le nouveau mandat', () => {
  it('cherche, puis compte, ou dit qu’il n’y a personne après 30 secondes', () => {
    expect(DELAI_RECHERCHE_MS).toBe(30_000)
    expect(etatAcquereurs(null, false, false)).toEqual({ genre: 'recherche' })
    expect(etatAcquereurs(0, false, false)).toEqual({ genre: 'recherche' })
    expect(etatAcquereurs(0, true, false)).toEqual({ genre: 'aucun' })
    expect(etatAcquereurs(4, true, false)).toEqual({ genre: 'trouves', nombre: 4 })
    // Un compte en échec n'est pas « aucun » : ce serait une affirmation fausse.
    expect(etatAcquereurs(null, true, true)).toEqual({ genre: 'erreur' })
  })
})
```

```bash
npx vitest run tests/unit/fiche-qui-pour.spec.ts
```

Attendu : échec, `Failed to resolve import "@/components/crm/biens/nouveau/acquereurs"`.

- [ ] **Étape 2 : ce que dit la ligne**

`src/components/crm/biens/nouveau/acquereurs.ts` :

```ts
/**
 * « Nouveau bien » — l'écran de fin d'un mandat mis en service (lot D1, conception §7) : ce que dit la ligne des
 * acquéreurs compatibles, selon ce qui est arrivé. Module PUR.
 *
 * Le moteur calcule les matchs quelques secondes après la mise en service (déclencheur `on_property_active`) ; la ligne
 * écoute les matchs du bien en direct. Au-delà de `DELAI_RECHERCHE_MS` sans aucun, elle le dit : un mandat sans
 * acquéreur compatible est un RÉSULTAT, pas une attente.
 */
export const DELAI_RECHERCHE_MS = 30_000

export type EtatAcquereurs =
  | { genre: 'recherche' }
  | { genre: 'trouves'; nombre: number }
  | { genre: 'aucun' }
  | { genre: 'erreur' }

/** Des acquéreurs trouvés l'emportent toujours ; un échec n'est jamais « aucun ». */
export function etatAcquereurs(nombre: number | null, ecoule: boolean, enErreur: boolean): EtatAcquereurs {
  if (nombre != null && nombre > 0) return { genre: 'trouves', nombre }
  if (enErreur) return { genre: 'erreur' }
  return ecoule ? { genre: 'aucun' } : { genre: 'recherche' }
}
```

```bash
npx vitest run tests/unit/fiche-qui-pour.spec.ts
```

Attendu : `Tests  10 passed`.

- [ ] **Étape 3 : le compte en direct**

`src/hooks/useAcquereursNouveauMandat.ts` :

```ts
/**
 * « Nouveau bien » — combien d'acquéreurs compatibles le moteur a trouvés pour un mandat qu'on vient de mettre en
 * service, EN DIRECT (lot D1, conception §7) : `matches` est dans la publication Realtime, et le moteur les écrit
 * quelques secondes après la mise en service (`on_property_active`).
 *
 * ⚠ Canal nommé par `useId()` (CLAUDE.md §4) : sans lui, un remontage recréerait un canal du même nom.
 */
import { useEffect, useId, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { lire } from '@/hooks/useMatchingFil'
import { DELAI_RECHERCHE_MS, etatAcquereurs, type EtatAcquereurs } from '@/components/crm/biens/nouveau/acquereurs'

const STATUTS_COMPATIBLES = ['suggested', 'sent', 'interested', 'visit_planned']

/** Les acquéreurs compatibles d'un mandat mis en service ; `null` : rien n'est écouté. */
export function useAcquereursNouveauMandat(propertyId: string | null): EtatAcquereurs {
  const qc = useQueryClient()
  const canal = useId()
  // L'id du bien dont le délai est passé : un autre bien repart de zéro.
  const [ecoule, setEcoule] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['nouveau-mandat-acquereurs', propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const lignes = await lire<{ contact_id: string }>(supabase.from('matches')
        .select('contact_id').eq('property_id', propertyId!).in('status', STATUTS_COMPATIBLES).limit(500))
      return new Set(lignes.map((l) => l.contact_id)).size
    },
  })
  useEffect(() => {
    if (!propertyId) return
    const minuterie = setTimeout(() => setEcoule(propertyId), DELAI_RECHERCHE_MS)
    const channel = supabase
      .channel(`nouveau-mandat-${canal}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `property_id=eq.${propertyId}` },
        () => { void qc.invalidateQueries({ queryKey: ['nouveau-mandat-acquereurs', propertyId] }) })
      .subscribe()
    return () => {
      clearTimeout(minuterie)
      supabase.removeChannel(channel)
    }
  }, [propertyId, canal, qc])
  return etatAcquereurs(q.data ?? null, ecoule === propertyId, q.isError)
}
```

- [ ] **Étape 4 : la ligne**

`src/components/crm/biens/nouveau/LigneAcquereurs.tsx` :

```tsx
/**
 * La ligne des acquéreurs compatibles de l'écran de fin de « Nouveau bien » (lot D1, conception §7) : elle cherche,
 * compte, ou dit qu'il n'y en a pas — et « Voir qui » ouvre la fiche sur « Qui pour ce bien ? ». Région vivante : le
 * compte qui arrive est annoncé.
 */
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { encreAccent } from '@/components/matching-fil/filAffichage'
import type { EtatAcquereurs } from './acquereurs'

export default function LigneAcquereurs({ sp, etat, onVoirQui }: { sp: CrmPalette; etat: EtatAcquereurs; onVoirQui?: () => void }) {
  const { t } = useTranslation('listings')
  const texte = etat.genre === 'trouves' ? t('nouveauBien.fini.acquereurs.trouves', { count: etat.nombre })
    : etat.genre === 'aucun' ? t('nouveauBien.fini.acquereurs.aucun')
      : etat.genre === 'erreur' ? t('nouveauBien.fini.acquereurs.erreur')
        : t('nouveauBien.fini.acquereurs.recherche')
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 'var(--crm-space-md)', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: etat.genre === 'trouves' ? sp.ink : sp.sub }}>
      <span>{texte}</span>
      {etat.genre === 'trouves' && onVoirQui && (
        <button type="button" onClick={onVoirQui}
          style={{ border: 0, background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: encreAccent(sp), cursor: 'pointer' }}>
          {t('nouveauBien.fini.acquereurs.voir')}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Étape 5 : l'écran de fin**

Dans `src/components/crm/biens/nouveau/NouveauBien.tsx` :

a. Imports, sous `import { useEcranActif } from '@/hooks/useEcranActif'` :

```ts
import { useAcquereursNouveauMandat } from '@/hooks/useAcquereursNouveauMandat'
import LigneAcquereurs from './LigneAcquereurs'
```

b. Dans `interface Props`, sous `onOuvrirBien` :

```ts
  /** « Voir qui » : la fiche du bien, sur « Qui pour ce bien ? ». Absent : pas de bouton (banc de Mes biens). */
  onVoirQui?: (id: string) => void
```

et `export default function NouveauBien({ dark, onClose, onOuvrirBien }: Props)` → `export default function NouveauBien({ dark, onClose, onOuvrirBien, onVoirQui }: Props)`.

c. Sous `const [fini, setFini] = useState<{ id: string; publie: boolean } | null>(null)` :

```ts
  // Lot D1 : un mandat mis en service compte ses acquéreurs compatibles, en direct. Un brouillon n'est pas noté.
  const acquereurs = useAcquereursNouveauMandat(fini?.publie ? fini.id : null)
```

d. Dans l'écran « Fini », juste après le `<p>` qui porte `nouveauBien.fini.gardeAide` / `offMarketAide` / `publieAide` :

```tsx
            {fini.publie && <LigneAcquereurs sp={sp} etat={acquereurs} onVoirQui={onVoirQui ? () => onVoirQui(fini.id) : undefined} />}
```

- [ ] **Étape 6 : les deux montages**

`src/pages/agent/NouveauBienPage.tsx` : ajouter `import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'`, et au `<NouveauBien … />` la prop :

```tsx
onVoirQui={(id) => navigate(`/dashboard/listings/${id}?${PARAM_QUI_POUR}=1`)}
```

`src/pages/agent/ListingsPage.tsx` : même import, et même prop au `<NouveauBien … />` du `wizardSlot`. (Le banc de Mes biens, `BiensShowcasePage`, ne la passe pas : pas de bouton.)

- [ ] **Étape 7 : les libellés**

```bash
python3 - <<'EOF'
import json
ACQUEREURS = {
  'fr': {'recherche': 'Recherche des acquéreurs compatibles…', 'trouves_one': '{{count}} acquéreur compatible',
         'trouves_other': '{{count}} acquéreurs compatibles', 'aucun': "Aucun acquéreur compatible pour l'instant",
         'erreur': 'Les acquéreurs compatibles se retrouvent sur sa fiche.', 'voir': 'Voir qui'},
  'en': {'recherche': 'Looking for matching buyers…', 'trouves_one': '{{count}} matching buyer',
         'trouves_other': '{{count}} matching buyers', 'aucun': 'No matching buyer for now',
         'erreur': 'Matching buyers are listed on its page.', 'voir': 'See who'},
  'de': {'recherche': 'Passende Käufer werden gesucht…', 'trouves_one': '{{count}} passender Käufer',
         'trouves_other': '{{count}} passende Käufer', 'aucun': 'Vorerst kein passender Käufer',
         'erreur': 'Die passenden Käufer stehen auf seiner Seite.', 'voir': 'Wer passt'},
  'it': {'recherche': 'Ricerca degli acquirenti compatibili…', 'trouves_one': '{{count}} acquirente compatibile',
         'trouves_other': '{{count}} acquirenti compatibili', 'aucun': 'Nessun acquirente compatibile per ora',
         'erreur': 'Gli acquirenti compatibili sono sulla sua scheda.', 'voir': 'Vedi chi'},
}
for lang, cles in ACQUEREURS.items():
    p = f'src/i18n/locales/{lang}/listings.json'
    d = json.load(open(p, encoding='utf-8'))
    d['nouveauBien']['fini']['acquereurs'] = cles
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('ok')
EOF
```

- [ ] **Étape 8 : compiler, jouer**

```bash
npx tsc -b
npm run --silent i18n:parity:ci && npm run --silent i18n:coverage:ci && npm run --silent lint:i18n
npx vitest run tests/unit/fiche-qui-pour.spec.ts tests/unit/nouveau-bien-completude.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/redirection-ouverte.spec.ts
```

Attendu : tout vert. Le banc ne joue aucun déclencheur : l'écran de fin y dit « Recherche des acquéreurs compatibles… » puis, au bout de 30 s, « Aucun acquéreur compatible pour l'instant » — c'est le comportement attendu sans moteur. La preuve du compte en direct se fait en production, au premier mandat mis en service après la fusion (à inscrire dans le rapport final).

---

## Tâche 12 : « Ce qui a bougé » dit ses acheteurs

**Fichiers :**
- Modifier : `src/components/matching-recherche/pige.ts`
- Modifier : `tests/unit/pige.spec.ts`
- Créer : `src/hooks/usePigeAcheteurs.ts`
- Modifier : `src/components/matching-recherche/MrhBouge.tsx`
- Modifier : `src/components/matching-recherche/mrh.css`
- Modifier : `src/components/matching-recherche/mrhDemo.ts`
- Modifier : `src/components/matching-recherche/MatchingRechercheHybride.tsx`
- Modifier : `tests/unit/mrh-bouge.spec.tsx`
- Modifier : `src/i18n/locales/{fr,en,de,it}/matching.json`

- [ ] **Étape 1 : les lots, une spec qui échoue**

Dans `tests/unit/pige.spec.ts`, ajouter `lotsAnnonces` à l'import depuis `@/components/matching-recherche/pige`, puis, à la fin :

```ts
describe('lotsAnnonces (lot D1)', () => {
  it('des lots de 30 dans l’ordre de chargement, sans doublon : une page de plus ne déplace pas les lots d’avant', () => {
    const ids = Array.from({ length: 65 }, (_, i) => `a${i}`)
    const lots = lotsAnnonces([...ids, 'a3'])
    expect(lots.map((l) => l.length)).toEqual([30, 30, 5])
    expect(lots[0]![0]).toBe('a0')
    expect(lotsAnnonces(ids.slice(0, 40))[0]).toEqual(lots[0])
    expect(lotsAnnonces([])).toEqual([])
  })
})
```

```bash
npx vitest run tests/unit/pige.spec.ts
```

Attendu : échec, `lotsAnnonces is not a function` (ou erreur d'import).

- [ ] **Étape 2 : `lotsAnnonces`**

À la fin de `src/components/matching-recherche/pige.ts` :

```ts
/** Le plafond de `pige_acheteurs_compatibles` (lot D1) : une page du flux. */
const LOT_ACHETEURS = 30

/**
 * Les annonces chargées, en lots pour `pige_acheteurs_compatibles` (lot D1), dans l'ORDRE DE CHARGEMENT et sans
 * doublon : une page de plus ajoute un lot sans déplacer les autres, donc sans les relire. Triés, les identifiants
 * changeraient de lot à chaque page, et tout se relirait.
 */
export function lotsAnnonces(ids: readonly string[], taille = LOT_ACHETEURS): string[][] {
  const uniques = [...new Set(ids)]
  const lots: string[][] = []
  for (let i = 0; i < uniques.length; i += taille) lots.push(uniques.slice(i, i + taille))
  return lots
}
```

```bash
npx vitest run tests/unit/pige.spec.ts
```

Attendu : vert.

- [ ] **Étape 3 : la lecture**

`src/hooks/usePigeAcheteurs.ts` :

```ts
/**
 * « Ce qui a bougé » (lot D1, conception §7bis) — les acheteurs compatibles de chaque annonce du flux, par lots de 30
 * (`pige_acheteurs_compatibles`). `pige_mouvements` ne change pas : sa pagination par clé reste intacte.
 */
import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { lotsAnnonces } from '@/components/matching-recherche/pige'

type LigneAcheteurs = { market_listing_id: string; acheteurs: number | string }

/** Fusionne les lots : une fonction de MODULE, pour que `useQueries` ne la recrée pas à chaque rendu. */
const enCarte = (resultats: { data?: LigneAcheteurs[] }[]): ReadonlyMap<string, number> =>
  new Map(resultats.flatMap((r) => (r.data ?? []).map((l): [string, number] => [l.market_listing_id, Number(l.acheteurs)])))

/** Annonce → acheteurs compatibles, pour les annonces chargées ; une annonce sans acheteur n'y est pas. */
export function usePigeAcheteurs(annonces: readonly string[], actif: boolean): ReadonlyMap<string, number> {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const lots = useMemo(() => lotsAnnonces(annonces), [annonces])
  return useQueries({
    queries: lots.map((lot) => ({
      queryKey: ['pige-acheteurs', agencyId, lot],
      enabled: actif && !!agencyId,
      staleTime: 60_000,
      queryFn: async (): Promise<LigneAcheteurs[]> => {
        const { data, error } = await supabase.rpc('pige_acheteurs_compatibles', { p_annonces: lot })
        if (error) throw error
        return (data ?? []) as LigneAcheteurs[]
      },
    })),
    combine: enCarte,
  })
}
```

- [ ] **Étape 4 : la pastille**

Dans `src/components/matching-recherche/MrhBouge.tsx` :

a. Dans `interface Props`, sous `onOuvrir: (b: MrhBien) => void` :

```ts
  /** Lot D1 : annonce → acheteurs compatibles ; une ligne ne dit rien sans eux. */
  acheteurs?: ReadonlyMap<string, number>
  /** La pastille « 3 acheteurs » : la fiche de l'annonce, sur « Qui pour ce bien ? ». */
  onQuiPour?: (b: MrhBien) => void
```

b. Ajouter `acheteurs, onQuiPour` à la déstructuration de `MrhBouge`, et passer à chaque ligne :

```tsx
          <LigneFlux key={m.id} m={m} bordure={i > 0} maintenant={maintenant} onOuvrir={onOuvrir} ctx={ctx}
            acheteurs={acheteurs?.get(m.bien.id) ?? 0} onQuiPour={onQuiPour} />
```

c. `LigneFlux` : sa signature prend `acheteurs: number; onQuiPour?: (b: MrhBien) => void`, et son rendu devient :

```tsx
  return (
    <li className="mrh-flux-item" style={{ borderTop: bordure ? '1px solid ' + line : 'none' }}>
      {/* Pas de `background` en ligne : le fond au repos et au survol vit dans `mrh.css`, sur la ligne ENTIÈRE — la
          pastille des acheteurs est un second bouton, frère du premier (un bouton n'en contient pas un autre). */}
      <button onClick={() => onOuvrir(b)} className="mrh-flux-ligne"
        style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr) auto', alignItems: 'center', gap: 'var(--crm-space-2xl)', padding: 'var(--crm-space-lg) var(--crm-space-4xl)', border: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: sp.ink }}>
        {/* … contenu INCHANGÉ : vignette, identité, ce qui a bougé, quand … */}
      </button>
      {/* Lot D1 : la ligne dit s'il existe des acheteurs compatibles, jamais qu'il n'y en a pas. */}
      {acheteurs > 0 && onQuiPour && (
        <button type="button" onClick={() => onQuiPour(b)} aria-label={t('recherche.bouge.acheteursAria', { count: acheteurs, titre: b.title })}
          style={{ flexShrink: 0, marginRight: 'var(--crm-space-4xl)', padding: 'var(--crm-space-2xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', background: surf.cardSub, color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {t('recherche.bouge.acheteurs', { count: acheteurs })}
        </button>
      )}
    </li>
  )
```

(Le contenu du premier bouton ne change pas ; seul son style perd `width: '100%'` au profit de `flex: 1, minWidth: 0`. `surf` vient de `ctx`, déjà déstructuré dans `LigneFlux` : sinon l'y ajouter.)

- [ ] **Étape 5 : le survol sur la ligne entière**

Dans `src/components/matching-recherche/mrh.css`, remplacer :

```css
.mrh-flux-ligne { background: transparent; transition: background .15s; }
.mrh-flux-ligne:hover { background: var(--mrh-line); }
```

par :

```css
.mrh-flux-item { display: flex; align-items: center; transition: background .15s; }
.mrh-flux-item:hover { background: var(--mrh-line); }
.mrh-flux-ligne { background: transparent; }
```

et, dans le commentaire au-dessus, « la ligne survolée » reste vrai : ajouter « (la ligne ENTIÈRE, pastille des acheteurs comprise — lot D1) ».

- [ ] **Étape 6 : la démo et le branchement**

Dans `src/components/matching-recherche/mrhDemo.ts`, sous `MRH_DEMO_MOUVEMENTS` :

```ts
/** Lot D1 : les acheteurs compatibles de deux annonces du flux de démonstration — la pastille se voit au banc. */
export const MRH_DEMO_ACHETEURS: ReadonlyMap<string, number> = new Map([['demo-ml-02', 3], ['demo-ml-01', 1]])
```

Dans `src/components/matching-recherche/MatchingRechercheHybride.tsx` :

a. Imports : `import { usePigeAcheteurs } from '@/hooks/usePigeAcheteurs'`, `import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'`, et `MRH_DEMO_ACHETEURS` à l'import existant de `./mrhDemo`.

b. Sous `const mouvementsCharges = useMemo(…)` :

```ts
  // Lot D1 : les acheteurs compatibles des annonces CHARGÉES (avant les jetons client : les lots restent stables).
  const idsPige = useMemo(() => mouvementsCharges.map((m) => m.bien.id), [mouvementsCharges])
  const acheteursPige = usePigeAcheteurs(idsPige, genreFlux != null && !demo)
  const acheteurs = demo ? MRH_DEMO_ACHETEURS : acheteursPige
```

c. Au montage de `<MrhBouge … />`, ajouter :

```tsx
              acheteurs={acheteurs}
              onQuiPour={(b) => { if (!demo) navigate(`/dashboard/market/${b.id}?${PARAM_QUI_POUR}=1`) }}
```

- [ ] **Étape 7 : les libellés**

```bash
python3 - <<'EOF'
import json
ACHETEURS = {
  'fr': ('{{count}} acheteur', '{{count}} acheteurs', 'Qui pour « {{titre}} » ? {{count}} acheteur compatible', 'Qui pour « {{titre}} » ? {{count}} acheteurs compatibles'),
  'en': ('{{count}} buyer', '{{count}} buyers', 'Who for “{{titre}}”? {{count}} matching buyer', 'Who for “{{titre}}”? {{count}} matching buyers'),
  'de': ('{{count}} Käufer', '{{count}} Käufer', 'Wer passt zu „{{titre}}“? {{count}} passender Käufer', 'Wer passt zu „{{titre}}“? {{count}} passende Käufer'),
  'it': ('{{count}} acquirente', '{{count}} acquirenti', 'Chi per «{{titre}}»? {{count}} acquirente compatibile', 'Chi per «{{titre}}»? {{count}} acquirenti compatibili'),
}
for lang, (un, plusieurs, aria_un, aria_plusieurs) in ACHETEURS.items():
    p = f'src/i18n/locales/{lang}/matching.json'
    d = json.load(open(p, encoding='utf-8'))
    bouge = d['recherche']['bouge']
    bouge['acheteurs_one'], bouge['acheteurs_other'] = un, plusieurs
    bouge['acheteursAria_one'], bouge['acheteursAria_other'] = aria_un, aria_plusieurs
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('ok')
EOF
```

- [ ] **Étape 8 : la spec de rendu**

Dans `tests/unit/mrh-bouge.spec.tsx`, à la fin du `describe` existant :

```ts
  it('D1 — la ligne dit combien d’acheteurs compatibles, et la pastille ouvre « Qui pour ce bien ? »', () => {
    const vus: string[] = []
    const el = monter({ mouvements: [APPARITION], charges: 1, acheteurs: new Map([['ml-1', 3]]), onQuiPour: (b) => { vus.push(b.id) } })
    const pastille = [...el.querySelectorAll('button')].find((b) => b.textContent === 'recherche.bouge.acheteurs#3')
    expect(pastille, 'pastille absente').toBeDefined()
    act(() => { pastille!.click() })
    expect(vus).toEqual(['ml-1'])
  })

  it('D1 — sans acheteur compatible, la ligne ne dit rien', () => {
    const el = monter({ mouvements: [APPARITION], charges: 1, acheteurs: new Map([['ml-1', 0]]), onQuiPour: () => {} })
    expect(el.textContent).not.toContain('recherche.bouge.acheteurs')
  })
```

(Le mock de `react-i18next` de ce fichier écrit `clé#N` quand un compte est passé.)

- [ ] **Étape 9 : compiler, jouer, regarder**

```bash
npx tsc -b
npm run --silent i18n:parity:ci && npm run --silent i18n:coverage:ci && npm run --silent lint:i18n
npx vitest run tests/unit/pige.spec.ts tests/unit/mrh-bouge.spec.tsx tests/unit/matching-atelier-css.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/redirection-ouverte.spec.ts
```

Attendu : tout vert. Si le cliquet demande de descendre le compte de `src/components/matching-recherche`, le faire.

Banc : `http://localhost:5173/dev/crm?entree=%2Fdashboard%2Fmatching`, page 2 (Recherche, en démonstration), vue « Ce qui a bougé » : la ligne de l'annonce `demo-ml-02` porte « 3 acheteurs », celle de `demo-ml-01` « 1 acheteur » ; le survol peint la ligne entière, pastille comprise.

---

## Tâche 13 : le banc joue les surfaces du lot

**Fichiers :**
- Modifier : `src/pages/dev/crmFixtures.ts`
- Créer : `tests/unit/banc-matching-d1.spec.ts`

Sans ces fixtures, le banc disait toujours « Tu es à jour », relance échue comprise (conception §9). Les RPC y sont REJOUÉES sur les tables du banc, comme `resumeMarcheBanc` le fait pour la ligne « Marché » : un geste consigné au banc se voit dans « Aujourd'hui ».

- [ ] **Étape 1 : la spec qui échoue**

`tests/unit/banc-matching-d1.spec.ts` :

```ts
/**
 * Le banc `/dev/crm` et le lot D1 : ses RPC rejouées racontent l'histoire du banc — le retour dû d'Emma (deux biens sans
 * réponse), trois baisses (Antoine revenu, Emma revenue, Julie proposée), le nouveau mandat de Florissant, le marché
 * d'Anastasia —, « Pendant ton absence » reconnaît la relance de proposition, et la boucle d'Antoine garde son bien revenu.
 *
 * ⚠ Les fixtures sont des tableaux de MODULE : chaque test relit un module neuf (`vi.resetModules`).
 */
import { describe, expect, it, vi } from 'vitest'
import { construireSaBoucle, type LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'

async function banc() {
  vi.resetModules()
  const f = await import('@/pages/dev/crmFixtures')
  const rpc = (nom: string) => f.CRM_RPC[nom] as (a: Record<string, unknown>) => unknown
  return { f, rpc }
}

describe('le banc du lot D1', () => {
  it('« Aujourd’hui » : cinq actions dans l’ordre des sortes, sur six', async () => {
    const { rpc } = await banc()
    const lignes = rpc('matching_actions_du_jour')({ p_limite: 5 }) as Record<string, unknown>[]
    expect(lignes.map((l) => [l.genre, l.contact_id ?? l.property_id, l.match_id ?? null])).toEqual([
      ['retour', 'c7', null],
      ['prix', 'c10', 'm5'],
      ['prix', 'c7', 'm20'],
      ['prix', 'c9', 'm15'],
      ['mandat', 'p3', null],
    ])
    expect(lignes[0]).toMatchObject({ nombre: 2, prenom: 'Emma' })
    expect(lignes[1]).toMatchObject({ montant: 250_000, statut: 'suggested' })
    expect(lignes[3]).toMatchObject({ montant: 50_000, statut: 'sent' })
    expect(lignes[4]).toMatchObject({ nombre: 2 })
    expect(lignes.every((l) => l.total === 6)).toBe(true)
    // Au-delà de la coupe : le marché d'Anastasia, une annonce nouvelle et une en baisse. Le bien revenu d'Emma, déjà
    // proposé, n'y figure pas : sa baisse est l'action 2.
    const tout = rpc('matching_actions_du_jour')({ p_limite: 20 }) as Record<string, unknown>[]
    expect(tout).toHaveLength(6)
    expect(tout[5]).toMatchObject({ genre: 'marche', contact_id: 'c11', nouveaux: 1, baisses: 1, titre: null })
  })

  it('« Pendant ton absence » : le retour d’Emma est une relance de proposition, deux biens sans réponse', async () => {
    const { rpc } = await banc()
    const p = rpc('today_absence')({ p_fallback_hours: 72 }) as { since: string; signals: Record<string, unknown>[] }
    expect(p.signals.find((s) => s.id === 'reminder:rb2')).toMatchObject({
      kind: 'reminder', contact_id: 'c7', reminder_type: 'follow_up_sent_property', nb_biens: 2, late: true,
    })
    // Le refus de Julie (m14) est un retour consigné de la fenêtre ; rb1 (Julie) n'est pas échue.
    expect(p.signals.find((s) => s.id === 'match:m14')).toMatchObject({ kind: 'skip', motif: 'prix', reminder_type: null })
    expect(p.signals.some((s) => s.id === 'reminder:rb1')).toBe(false)
  })

  it('« Ce qui a bougé » : les acheteurs compatibles d’une annonce, sans les refus', async () => {
    const { rpc } = await banc()
    const r = rpc('pige_acheteurs_compatibles')({ p_annonces: ['ml-boucle-2', 'ml-boucle-3', 'ml-signal-1', 'ml-inconnue'] }) as
      { market_listing_id: string; acheteurs: number }[]
    // ml-boucle-2 : son seul match est le refus de Julie (m14) — il ne compte pas.
    expect(Object.fromEntries(r.map((l) => [l.market_listing_id, l.acheteurs]))).toEqual({ 'ml-boucle-3': 1, 'ml-signal-1': 1 })
  })

  it('« Aujourd’hui » : la file Focus du banc porte des matchs — que « Dossiers » ne montre plus', async () => {
    const { rpc } = await banc()
    const lignes = rpc('focus_top_matches') as unknown as Record<string, unknown>[]
    expect(lignes.map((l) => l.match_id)).toEqual(['m22', 'm23'])
  })

  it('« Sa boucle » d’Antoine garde son bien revenu', async () => {
    const { f } = await banc()
    const lignes = (f.CRM_TABLES.matches as (LigneBoucleContact & { contact_id: string })[]).filter((m) => m.contact_id === 'c10')
    const b = construireSaBoucle(lignes, new Map(), { id: 'c10', prenom: 'Antoine', nom: 'Lefèvre', telephone: null, email: null, kyc: 'none' })
    expect(b.biens.find((x) => x.m.id === 'm5')).toMatchObject({ etat: 'revenu', lien: 'ligne=m5&contact=c10' })
  })
})
```

⚠ `focus_top_matches` est une fixture CONSTANTE (un tableau), pas une fonction : le quatrième cas la lit telle quelle.

```bash
npx vitest run tests/unit/banc-matching-d1.spec.ts
```

Attendu : échec (les entrées de `CRM_RPC` manquent).

- [ ] **Étape 2 : les RPC rejouées**

Dans `src/pages/dev/crmFixtures.ts` :

a. L'import des seuils devient `import { JOURS_BAISSE, JOURS_MANDAT, JOURS_NOUVEAU } from '@/components/matching-fil/filSignaux'`.

b. Juste AVANT `export const CRM_RPC_VIDE`, ajouter :

```ts
/**
 * Lot D1 (23.09.2026) — les RPC des surfaces, REJOUÉES sur les tables du banc. ⚠ MIROIRS de
 * `20260923120000_matching_surfaces.sql` et de `today_absence` : mêmes règles, mêmes seuils (`filSignaux`) —
 * `banc-matching-d1.spec.ts` confronte leur sortie à l'histoire du banc. Une règle changée d'un côté se change de l'autre.
 */
type MatchBanc = {
  id: string; agency_id: string; contact_id: string; property_id: string | null; market_listing_id: string | null
  status: string; score: number; sent_at: string | null; response_at?: string | null; reaction_motif?: string | null
  prix_propose?: number | null; snoozed_until?: string | null
}
type RappelBanc = {
  id: string; agency_id: string; contact_id: string | null; property_id?: string | null; type: string; status: string
  trigger_at: string | null; match_id?: string | null; match_ids?: string[] | null
}
type BienBanc = {
  id: string; agency_id: string; title?: string | null; address?: string | null; city?: string | null; price?: number | null
  status?: string; transaction_type?: string | null; mandate_signed_at?: string | null; published_at?: string | null
}
type AnnonceBanc = {
  id: string; title?: string | null; address?: string | null; city?: string | null; price?: number | null
  current_price?: number | null; status?: string | null; transaction_type?: string | null; price_at_first_seen?: number | null
  price_reduced_at?: string | null; first_seen_at?: string | null
}
type ContactBanc = { id: string; first_name: string | null; last_name: string | null }

const JOUR_BANC = 86_400_000
const STATUTS_COMPATIBLES_BANC = new Set(['suggested', 'sent', 'interested', 'visit_planned'])
const recenteBanc = (iso: string | null | undefined, jours: number, maintenant: number): boolean =>
  iso != null && Date.parse(iso) > maintenant - jours * JOUR_BANC && Date.parse(iso) <= maintenant
const matchsBanc = () => (CRM_TABLES.matches as MatchBanc[]).filter((m) => m.agency_id === AGENCE_BANC.id)
const contactBanc = (id: string | null) => (CRM_TABLES.contacts as ContactBanc[]).find((c) => c.id === id)
const bienBanc = (id: string | null | undefined) => (CRM_TABLES.properties as BienBanc[]).find((p) => p.id === id)
const annonceBanc = (id: string | null | undefined) => (CRM_TABLES.market_listings as AnnonceBanc[]).find((x) => x.id === id)
const couverts = (r: RappelBanc): string[] => r.match_ids ?? (r.match_id ? [r.match_id] : [])
const envoyesBanc = (ids: readonly string[]) => matchsBanc().filter((m) => ids.includes(m.id) && m.status === 'sent')

/** `matching_actions_du_jour(p_limite)`, sur le banc. */
function actionsDuJourBanc(a: Record<string, unknown>) {
  const maintenant = Date.now()
  const limite = Math.min(Math.max(Number(a.p_limite ?? 5) || 1, 1), 20)
  const vide = {
    contact_id: null, match_id: null, property_id: null, market_listing_id: null, statut: null, titre: null, ville: null,
    nombre: null, nouveaux: null, baisses: null, montant: null, location: null, quand: null,
  }
  const lignes: (Record<string, unknown> & { rang: number })[] = []

  // 1. Les retours dus, un par acheteur.
  const retours = new Map<string, { ids: Set<string>; quand: string }>()
  for (const r of CRM_TABLES.reminders as RappelBanc[]) {
    if (r.agency_id !== AGENCE_BANC.id || r.type !== 'follow_up_sent_property' || !['pending', 'triggered', 'snoozed'].includes(r.status)) continue
    if (!r.contact_id || !r.trigger_at || Date.parse(r.trigger_at) > maintenant) continue
    const envoyes = envoyesBanc(couverts(r))
    if (!envoyes.length) continue
    const e = retours.get(r.contact_id) ?? { ids: new Set<string>(), quand: r.trigger_at }
    for (const m of envoyes) e.ids.add(m.id)
    if (r.trigger_at < e.quand) e.quand = r.trigger_at
    retours.set(r.contact_id, e)
  }
  for (const [contact, e] of retours) lignes.push({ ...vide, genre: 'retour', rang: 1, contact_id: contact, nombre: e.ids.size, quand: e.quand })

  // 2. Les prix passés sous le prix de proposition.
  for (const m of matchsBanc()) {
    if (m.prix_propose == null) continue
    const revenu = m.status === 'suggested' && m.reaction_motif === 'prix' && (!m.snoozed_until || Date.parse(m.snoozed_until) <= maintenant)
    if (m.status !== 'sent' && !revenu) continue
    const bien = bienBanc(m.property_id)
    const annonce = annonceBanc(m.market_listing_id)
    if (annonce?.status === 'removed') continue
    const prix = m.property_id ? Number(bien?.price ?? 0) : Number(annonce?.current_price ?? annonce?.price ?? 0)
    if (!(prix > 0) || prix >= m.prix_propose) continue
    lignes.push({
      ...vide, genre: 'prix', rang: 2, contact_id: m.contact_id, match_id: m.id, property_id: m.property_id,
      market_listing_id: m.market_listing_id, statut: m.status,
      titre: bien?.title || annonce?.title || bien?.address || annonce?.address || null, ville: bien?.city ?? annonce?.city ?? null,
      montant: m.prix_propose - prix, location: (bien?.transaction_type ?? annonce?.transaction_type) === 'rent', quand: m.sent_at,
    })
  }

  // 3. Les nouveaux mandats (7 jours), actifs, avec au moins un acquéreur compatible.
  for (const p of CRM_TABLES.properties as BienBanc[]) {
    if (p.agency_id !== AGENCE_BANC.id || p.status !== 'active') continue
    const quand = [p.mandate_signed_at, p.published_at].filter((d): d is string => d != null).sort().pop() ?? null
    if (!recenteBanc(quand, JOURS_MANDAT, maintenant)) continue
    const acheteurs = new Set(matchsBanc().filter((m) => m.property_id === p.id && STATUTS_COMPATIBLES_BANC.has(m.status)).map((m) => m.contact_id))
    if (!acheteurs.size) continue
    lignes.push({
      ...vide, genre: 'mandat', rang: 3, property_id: p.id, titre: p.title || p.address || null, ville: p.city ?? null,
      nombre: acheteurs.size, location: p.transaction_type === 'rent', quand,
    })
  }

  // 4. Le marché, par acheteur : jamais proposé, nouveau (3 jours) ou en baisse (14 jours).
  const parContact = new Map<string, { annonce: AnnonceBanc; nouveau: boolean; enBaisse: boolean }[]>()
  for (const m of matchsBanc()) {
    if (m.status !== 'suggested' || !m.market_listing_id || m.prix_propose != null) continue
    if (m.snoozed_until && Date.parse(m.snoozed_until) > maintenant) continue
    const x = annonceBanc(m.market_listing_id)
    if (!x || x.status === 'removed') continue
    const prix = Number(x.current_price ?? x.price ?? 0)
    const enBaisse = recenteBanc(x.price_reduced_at, JOURS_BAISSE, maintenant) && Number(x.price_at_first_seen ?? 0) > prix && prix > 0
    const nouveau = recenteBanc(x.first_seen_at, JOURS_NOUVEAU, maintenant)
    if (!enBaisse && !nouveau) continue
    parContact.set(m.contact_id, [...(parContact.get(m.contact_id) ?? []), { annonce: x, nouveau, enBaisse }])
  }
  for (const [contact, s] of parContact) {
    const seule = s.length === 1 ? s[0]!.annonce : null
    lignes.push({
      ...vide, genre: 'marche', rang: 4, contact_id: contact, market_listing_id: seule?.id ?? null,
      titre: seule ? seule.title || seule.address || null : null, ville: seule?.city ?? null, nombre: s.length,
      nouveaux: s.filter((x) => x.nouveau && !x.enBaisse).length, baisses: s.filter((x) => x.enBaisse).length,
      location: s.some((x) => x.annonce.transaction_type === 'rent'),
      quand: s.map((x) => (x.enBaisse ? x.annonce.price_reduced_at : x.annonce.first_seen_at) ?? '').sort().pop() || null,
    })
  }

  const enMs = (iso: unknown) => (typeof iso === 'string' ? Date.parse(iso) : 0)
  lignes.sort((x, y) => (x.rang - y.rang)
    || (x.rang === 1 ? enMs(x.quand) - enMs(y.quand) : x.rang === 2 ? Number(y.montant) - Number(x.montant) : enMs(y.quand) - enMs(x.quand)))
  const total = lignes.length
  return lignes.slice(0, limite).map(({ rang: _rang, ...l }) => {
    const c = contactBanc(l.contact_id as string | null)
    return { ...l, prenom: c?.first_name ?? null, nom: c?.last_name ?? null, total }
  })
}

/** `pige_acheteurs_compatibles(p_annonces)`, sur le banc : 30 identifiants au plus. */
function acheteursPigeBanc(a: Record<string, unknown>) {
  const ids = (Array.isArray(a.p_annonces) ? a.p_annonces : []).slice(0, 30) as string[]
  return ids.flatMap((id) => {
    const acheteurs = new Set(matchsBanc().filter((m) => m.market_listing_id === id && STATUTS_COMPATIBLES_BANC.has(m.status)).map((m) => m.contact_id))
    return acheteurs.size ? [{ market_listing_id: id, acheteurs: acheteurs.size }] : []
  })
}

/** `today_absence(p_fallback_hours)`, sur le banc : l'agent du banc n'a pas de présence, la fenêtre est celle du repli. */
function absenceBanc(a: Record<string, unknown>) {
  const maintenant = Date.now()
  const heures = Math.min(Math.max(Number(a.p_fallback_hours ?? 72) || 72, 1), 720)
  const depuis = maintenant - heures * 3_600_000
  const reactions = matchsBanc()
    .filter((m) => (m.status === 'interested' || m.status === 'rejected') && m.response_at != null && Date.parse(m.response_at) > depuis)
    .map((m) => {
      const c = contactBanc(m.contact_id)
      const p = bienBanc(m.property_id)
      const x = annonceBanc(m.market_listing_id)
      return {
        id: `match:${m.id}`, kind: m.status === 'interested' ? 'like' : 'skip', contact_id: m.contact_id,
        first_name: c?.first_name ?? null, last_name: c?.last_name ?? null, subject: p?.title || p?.address || x?.title || null,
        motif: m.reaction_motif ?? null, occurred_at: m.response_at!, late: false, ref_id: m.id, reminder_type: null, nb_biens: null,
      }
    })
  const rappels = (CRM_TABLES.reminders as RappelBanc[])
    .filter((r) => r.agency_id === AGENCE_BANC.id && (r.status === 'pending' || r.status === 'triggered')
      && r.trigger_at != null && Date.parse(r.trigger_at) <= maintenant)
    .map((r) => {
      const c = contactBanc(r.contact_id)
      const p = bienBanc(r.property_id)
      return {
        id: `reminder:${r.id}`, kind: 'reminder', contact_id: r.contact_id, first_name: c?.first_name ?? null,
        last_name: c?.last_name ?? null, subject: p?.title || p?.address || null, motif: null, occurred_at: r.trigger_at!,
        late: true, ref_id: r.id, reminder_type: r.type,
        nb_biens: r.type === 'follow_up_sent_property' ? envoyesBanc(couverts(r)).length : null,
      }
    })
  const signals = [...reactions, ...rappels].sort((x, y) => y.occurred_at.localeCompare(x.occurred_at)).slice(0, 50)
  return { since: new Date(depuis).toISOString(), signals }
}

/**
 * `focus_top_matches` : la file Focus d'« Aujourd'hui » lit les meilleurs matchs. Le mobile les montre ; le bureau ne les
 * montre PLUS dans « Dossiers » (lot D1) — ces deux lignes prouvent au banc que le filtre tient.
 */
const FOCUS_TOP_BANC = [
  { match_id: 'm22', contact_id: 'c11', contact_name: 'Anastasia Volkova', kind: 'internal', score: 100, lead_score: null, reasons_match_count: 5, reason_keys: ['budget', 'zone', 'type', 'rooms', 'features'], property_title: 'Attique 5,5 pièces · Florissant', property_price: 2_350_000, property_photo: null, city: 'Genève', kyc_risk_high: false, kyc_days_to_expiry: null },
  { match_id: 'm23', contact_id: 'c7', contact_name: 'Emma Schneider', kind: 'internal', score: 100, lead_score: null, reasons_match_count: 5, reason_keys: ['budget', 'zone', 'type', 'rooms', 'features'], property_title: 'Attique 5,5 pièces · Florissant', property_price: 2_350_000, property_photo: null, city: 'Genève', kyc_risk_high: false, kyc_days_to_expiry: null },
]
```

c. Dans `CRM_RPC`, sous `matching_fil_marche_resume: () => resumeMarcheBanc(),` :

```ts
  // Lot D1 — les surfaces du CRM (miroirs des RPC : voir `actionsDuJourBanc`).
  matching_actions_du_jour: (a: Record<string, unknown>) => actionsDuJourBanc(a),
  pige_acheteurs_compatibles: (a: Record<string, unknown>) => acheteursPigeBanc(a),
  today_absence: (a: Record<string, unknown>) => absenceBanc(a),
  focus_top_matches: FOCUS_TOP_BANC,
```

(À l'état « Vide » du banc, `today_absence` retombe sur `null` — le hook le lit comme « aucun signal » —, les trois autres sur `[]` : aucune entrée n'est à ajouter à `CRM_RPC_VIDE`.)

- [ ] **Étape 3 : jouer**

```bash
npx vitest run tests/unit/banc-matching-d1.spec.ts tests/unit/banc-matching-explique.spec.ts tests/unit/banc-matching-boucle.spec.ts tests/unit/banc-supabase.spec.ts tests/unit/dev-bancs-frontiere.spec.ts
```

Attendu : `Tests  5 passed` pour la première, les autres vertes. Si une action de plus paraît (un match du banc qu'on n'a pas vu), ne PAS corriger l'attendu à l'aveugle : dire laquelle, et si elle est juste (une règle de la RPC la veut), ajuster la spec en l'écrivant dans son commentaire.

- [ ] **Étape 4 : regarder le banc, en clair et en sombre**

1. `http://localhost:5173/dev/crm?entree=/dashboard` : le segment « Matching 6 » ; ses cinq lignes — « Retour à consigner pour Emma · 2 biens » (Consigner), « Prix baissé de CHF 250'000 sur le bien refusé par Antoine », « … de CHF 110'000 sur le bien refusé par Emma », « … de CHF 50'000 sur le bien proposé à Julie », « Nouveau mandat · 2 acquéreurs compatibles » (Voir qui) — et « Voir les 6 actions dans le Matching ». Chaque geste mène à la bonne place (Retours d'Emma ; ligne d'Antoine ; ligne « Marché » d'Emma ; Retours de Julie ; fiche de Florissant défilée sur « Qui pour ce bien ? »).
2. « Dossiers » : aucune carte d'Anastasia ni d'Emma sur Florissant.
3. « Pendant ton absence » : « Emma retour attendu sur 2 biens proposés » → « Reprendre » ouvre les Retours d'Emma, et la relance `rb2` reste `pending` ; « Julie pas intéressé·e par Appartement 5 pièces · Servette » avec « · Prix » dans sa méta.
4. Fiche d'Antoine (`/dashboard/contacts/c10`), page « Sa boucle » : le bien revenu de Cologny, sa ligne ouvre le fil sur lui.
5. Fiche de Julie (`c9`) : « Recherche à ajuster · Prix » dans « À traiter », son refus noté « Au-dessus de ce que sa banque suit. ».

---

## Tâche 14 : la garde « sans sortie » couvre D1

**Fichiers :**
- Modifier : `tests/unit/matching-sans-sortie.spec.ts`

- [ ] **Étape 1 : les fichiers neufs entrent au périmètre**

Dans `MATCHING`, sous `'src/hooks/useContactSentMatches.ts',` :

```ts
  // Lot D1 (23.09.2026) : les surfaces qui montrent la boucle hors du fil. `src/components/matching-fil` couvre déjà
  // `filLiens`, `filQuiPour`, `QuiPourCeBien` et `QuiPourFiche`.
  'src/hooks/useQuiPourCeBien.ts',
  'src/hooks/usePigeAcheteurs.ts',
  'src/hooks/useAcquereursNouveauMandat.ts',
  'src/components/crm/today/matchingDuJour.ts',
  'src/components/crm/today/useMatchingDuJour.ts',
  'src/components/crm/today/HlMatching.tsx',
  'src/components/crm/today/useAbsenceSignals.ts',
  'src/components/crm/contacts-pager/saBoucle.ts',
  'src/components/crm/biens/nouveau/acquereurs.ts',
  'src/components/crm/biens/nouveau/LigneAcquereurs.tsx',
```

et, dans `SECTIONS`, sous l'entrée `function CdBoucle(` :

```ts
  // Ses deux atomes (lot D1) : une ligne « À traiter » et un bien de la boucle.
  { fichier: 'src/components/crm/contacts-pager/ContactDetailPager.tsx', debut: 'function CdATraiter(' },
  { fichier: 'src/components/crm/contacts-pager/ContactDetailPager.tsx', debut: 'function CdBienBoucle(' },
```

⚠ La garde exige qu'une section fasse plus de 200 caractères : `CdATraiter` et `CdBienBoucle` en font bien plus.

- [ ] **Étape 2 : jouer**

```bash
npx vitest run tests/unit/matching-sans-sortie.spec.ts
```

Attendu : vert. Aucun fichier neuf n'appelle de fonction serveur autre que `matching-engine` (via `useAnciensProspects`, déjà au périmètre) ni un motif d'envoi.

---

## Tâche 15 : vérification, docs, cerveau, feuille de route, commits

- [ ] **Étape 1 : les portes**

```bash
npx tsc -b && npx eslint src tests --quiet
bash -c 'for g in lint:prose lint:i18n lint:deadcode lint:deps lint:types-freshness lint:roster lint:edge-auth lint:email-shell lint:migrations lint:whatsapp-outbound lint:spec-sql i18n:parity:ci i18n:coverage:ci check:privileges; do printf "%-28s" "$g"; npm run --silent $g >/dev/null 2>&1 && echo "✓" || echo "✗"; done'
```

Attendu : `tsc` et `eslint` à 0, « ✓ » partout. ⚠ `check:privileges`, `check:drift` et `lint:claude-md` ont besoin de `SUPABASE_ACCESS_TOKEN` : sans lui, ils ne mesurent qu'une partie et le DISENT — ne pas les compter verts pour autant.

- [ ] **Étape 2 : la suite unitaire, SEULE**

```bash
npx vitest run
```

Attendu : aucune régression. Trois échecs sont connus et hors sujet en local : `mail/imap`, `mail/mime-parse`, `safe-internal-path`. Tout autre rouge se rejoue d'abord seul.

- [ ] **Étape 3 : le build**

```bash
npm run build
```

Attendu : sortie 0.

- [ ] **Étape 4 : les docs**

- `docs/system-map.md` §6 E (matching) : un paragraphe « Lot D1 (23.09.2026, sur branche, fusion à la fin) » — les liens d'arrivée du fil (`filLiens.ts` : `?onglet=`, `?ligne=`, `?attente=`, `lienPlace`), le segment Matching d'« Aujourd'hui » (`matching_actions_du_jour`, quatre sortes, cinq au plus, « Dossiers » sans matchs), « Pendant ton absence » qui ouvre « Retours » au lieu de clore une relance de proposition (`today_absence` rend `reminder_type` et `nb_biens`), « Sa boucle » (deux lectures, cinq états, biens revenus, « Apprendre », gestes vers le fil), « Qui pour ce bien ? » sur les deux fiches (`useQuiPourCeBien`, `QuiPourCeBien` partagé, `?qui=1`), l'écran de fin d'un nouveau mandat (Realtime, 30 s), « Ce qui a bougé » (`pige_acheteurs_compatibles`). §2 (cockpit « Aujourd'hui ») : le troisième segment. §2 Hooks : `useQuiPourCeBien`, `usePigeAcheteurs`, `useAcquereursNouveauMandat`.
- `CLAUDE.md` §7, liste des abonnements Realtime : elle en nomme six ; il y en a désormais HUIT — `useLabsAssets.ts` (déjà là, omis) et `useAcquereursNouveauMandat.ts` (l'écran de fin, sur `matches` du bien). Remesurer avant d'écrire : `grep -rln "removeChannel" src | sort`. §8, ligne « CRM agent » : une phrase sur D1, sur branche.
- `docs/superpowers/feuille-de-route.md` : l'état de l'étape 4a.
- Cerveau : une entrée `megga/matching-surfaces` dans `.claude-flow/knowledge/megga-memory.seed.json` (ce qui est fait, les deux RPC, les pièges : navigation ANCRÉE, pas de paramètre `retour*`, `?annonce=m:` en attente, le marché sans les biens déjà proposés, D1 ne part pas sans le lot E), puis `npm run ruflo:seed`.

- [ ] **Étape 5 : les commits, au signal de Julien**

Un commit par sujet, dans l'ordre des tâches ; chacun doit compiler et passer ses specs SEUL (le vérifier dans un worktree jetable, `node_modules` lié) :

```
feat(matching): le fil sait où arriver — onglet, ligne, retours d'un acheteur          (tâches 1-2)
feat(matching): la base des surfaces — actions du jour, acheteurs de la pige           (tâche 3)
feat(aujourdhui): le segment Matching, et « Dossiers » sans matchs                     (tâches 4-5)
fix(aujourdhui): « Pendant ton absence » consigne une relance au lieu de la clore      (tâche 6)
feat(contacts): « Sa boucle » lit toute la boucle                                      (tâches 7-8)
feat(matching): « Qui pour ce bien ? » sur les deux fiches                             (tâches 9-10)
feat(biens): le nouveau mandat dit ses acquéreurs                                      (tâche 11)
feat(pige): « Ce qui a bougé » dit ses acheteurs                                       (tâche 12)
test(banc): les surfaces du lot D1 sur le banc                                         (tâche 13)
test(matching): la garde « sans sortie » couvre D1                                     (tâche 14)
docs(matching): le lot D1 — conception, plan, carte et cerveau                         (tâche 15, + la conception et la feuille de route)
```

---

## Décisions prises (rappel)

1. **Les liens de D1 visent le fil seul** — D1 ne part pas en production sans le lot E.
2. **« Aujourd'hui » gagne un segment « Matching »**, troisième de la colonne droite, cinq actions au plus, chacune avec sa raison ; les matchs quittent « Dossiers ».
3. **« Qui pour ce bien ? » sur les deux fiches** : compatibles partout, anciens prospects sur le mandat seul.
4. **« Ce qui a bougé » dit ses acheteurs**, par une RPC à part (`pige_mouvements` ne change pas).
5. (Au plan, 23.09.2026) **`?attente=` et non `?retours=`** ; **pas de `?annonce=m:`** ; le marché d'« Aujourd'hui » **sans les biens déjà proposés**.

## En attente (hors périmètre — rien n'est fait sans accord de Julien)

- Le catalogue d'« Aujourd'hui » (page 2) : un match refusé y porte « Nouveau », la baisse y vaut 0 en dur, et il charge tous les matchs de l'agence — le lot E le remplace.
- Les anciens prospects d'une annonce du marché (le moteur ne note que contre un mandat).
- Les prescripteurs de « Qui pour ce bien ? » (étape 6).
- L'étincelle « MEGGA AI » sur le texte système d'une relance, dans « Ta journée ».
- Le lien mort de « Dossiers » vers `/dashboard/contacts/property:…`.
- « Aujourd'hui » et la fiche contact sur mobile (lot E) — le mobile ne clôt plus une relance de proposition depuis « Pendant ton absence », c'est tout. ⚠ Son ✓ (`markBlockDone`) la clôt encore : décision 8 de la feuille de route.
- `?annonce=m:<uuid>` : un filtre du fil sur une annonce du marché, à concevoir avec le lot E.
- La preuve du compte en direct de l'écran de fin : au premier mandat mis en service après la fusion.

**Relevé à l'exécution (23.09.2026)** — non fait, hors périmètre ou à relire, par surface. Les huit points à TRANCHER sont les décisions 6 à 13 de la [feuille de route](../feuille-de-route.md).

*Le fil et ses liens d'arrivée*
- (lot E) Le lien d'arrivée reste dans l'URL alors que son effet est rangé dans l'onglet du CRM : il est REJOUÉ à chaque remontage de l'écran (retour arrière après « Voir le contact », éviction au-delà de six écrans, rechargement), écrasant l'onglet et les filtres choisis depuis, et IGNORÉ quand un onglet du CRM porte déjà exactement cette URL. Déjà vrai de `?contact=`, étendu par D1 à l'onglet, à la ligne et au focus. Piste : un jeton dans `navigate(…, { state })`, consommé une fois et rangé dans la tranche d'onglet ; ⛔ pas de `setSearchParams(replace)`, que la réconciliation des onglets lirait comme un autre onglet `/dashboard/matching`.
- (lot E) Le pager de Matching n'attend pas le chargement des onglets, le fil si : au rechargement, le pager pourrait revenir sur la Recherche retenue pendant que le fil rejoue le lien (non reproduit : le banc ne recharge pas la pile d'onglets).
- Pendant `chargementOnglets`, les choix de l'agent sont masqués puis écrasés (préexistant pour les filtres, étendu à l'onglet) ; aucun test de rendu du câblage de `MatchingFil` (pivot, choix initial, focus unique) : vérifié au banc seulement.
- La conception (validée, non modifiée) est à réaligner sur deux points : un onglet inconnu est ignoré, pas ramené à « À proposer » (§4) ; le paramètre de fiche s'appelle `PARAM_QUI_POUR`, pas `cheminFicheQuiPour` (§7).
- Mineurs de `filLiens.ts` : l'écrivain ne retire pas les espaces comme le lecteur (sans effet avec des UUID) ; le test d'onglet double celui d'`ongletValide` ; une union discriminée pour les cibles ; des cas de spec (`?? ordre[0]`, `qui=1`).

*« Aujourd'hui »*
- Le même geste s'appelle « Consigner » (segment) et « Reprendre » (« Pendant ton absence ») sur la même page ; « Retours consignés » compte aussi les consignations de l'agent lui-même (`today_absence` ne filtre pas l'auteur).
- Une relance de proposition paraît aussi dans « Ta journée » et au Calendrier (`calendar-reminders` lit sans filtre de type).
- Un même acheteur peut occuper plusieurs des cinq places (un retour et des baisses).
- (lot E) `/dashboard/matching` monte l'atelier, qui n'invalide pas `CLE_FIL` : un geste de l'atelier ne rafraîchit le segment, « Pendant ton absence », les fiches et les pastilles de la pige qu'à leur prochaine lecture.
- Préexistants : le filet manque sous « Dossiers » (`borderTop` écrit avant `border: 0`) ; `TK.sub` rend 4,36:1 sur `#16181c`, sous l'AA pour du 12 px ; `aria-pressed` manque aux trois segments.

*« Sa boucle » et la fiche contact*
- (à relire) Un revenu SANS PLACE (reporté, annonce retirée) garde la pastille « Revenu », celle d'une occasion, sans dire pourquoi il n'est ni « à traiter » ni cliquable (`fil.quiPour.etat.reporte` existe) ; deux « Ouvrir dans le Matching » (en-tête et carte) mènent à deux places sous le même nom.
- (à relire) Un revenu du marché sur une annonce `removed` n'a ni lien ni place « à traiter », parce que la ligne « Marché » du fil l'exclut.
- Préexistants : `P.shadow` et `P.shadowSm` sont invalides en sombre (`inset 0 0 0 1px #2b2d30, none` est rejeté : les `CdRoundBtn` n'ont ni pastille ni anneau) ; `P.hairline` y est un voile à 0,08 (ΔL* 9,04), pas le filet unique `#2b2d30` ; la page cachée du pager n'est pas `inert` ; « Modifier » est un `<span onClick>`, injoignable au clavier ; « Sa boucle » mobile n'est pas reprise (lot E).

*« Qui pour ce bien ? » et les fiches*
- Non faits : une garde « aucune fiche, ni « Aujourd'hui » mobile, ne tire `useAtelierMatching` » (parcours du graphe d'imports) ; `?qui=1` ne déplace pas le focus ; les anciens prospects se chargent en cascade après les compatibles ; `BfGrp` n'est pas un titre (un h1 puis des h3) ; le `role="status"` est inséré avec son texte (annonce peu fiable) ; atteindre la borne de 200 ne se dit pas.
- `?qui=1` n'est pas consommé : un remontage de la fiche rejoue le défilement, comme les liens d'arrivée du fil.
- Hors périmètre : « Qui visite ? » (`PlanifierVisite`) garde l'étincelle et « 97 % estimé » pour le même score déterministe ; « Proposer à des acheteurs » (`fiche.cta.propose`, `ListingDetailPage`) mène à `/dashboard/matching` sans paramètre, alors que `?annonce=p:<id>` existe ; la fiche d'un mandat charge encore tous les contacts (`useContacts()`) et toutes les transactions de l'agence.

*« Nouveau bien »*
- Au banc, la publication exige des photos (le stockage n'y est pas intercepté) : l'état « publié » n'a été vu que posé à la main.
- Hors périmètre, antérieur : sous 980 px de conteneur (1 024 × 768), le formulaire se coupe en deux rangées et l'aperçu recouvre le champ d'adresse.

*La base*
- Hors périmètre, antérieurs : `today_absence` (`security definer`) lit le contact et le bien d'un rappel par identifiant sans filtre d'agence ; `fermer_relance_proposition` (`security definer`, lot B) lit les matchs de même.
- `get_user_agency_id()` est évaluée par ligne dans `pige_acheteurs_compatibles` (négligeable).
- Cas de spec absents : la branche mandat de `prix`, « la plus récente des deux dates », une relance `snoozed` ou `done`, un appelant sans agence.

*Les gardes*
- `matching-sans-sortie.spec.ts` découpe `CdBoucle` fonction par fonction : un rétrécissement de la section ne rougit pas (la borner par des bannières) ; un `functions.invoke(NOM, …)` au premier argument non littéral échappe à la liste blanche.

*Le banc*
- Aucun déclencheur : deux effets seulement sont rejoués à la lecture (`relanceClose`, `reponduLe`) ; `set_match_prix_propose` ne l'est pas (limite du lot B), et « Dossiers », qui lit `reminders` sans passer par les miroirs, montre encore une relance que la base aurait close.
- `or(…)` n'y est pas lu (le filtre de dormance : Anastasia « Lead qui refroidit · 0 j » après 21 h) ; `gt` y compare des chaînes (`'null' > '0'`), et la lecture des revenus ramène des `suggested` jamais proposés, que `saBoucle.ts` écarte.
- La présence n'est pas modélisée (« Tout marquer comme vu » ne vide rien) : « Pendant ton absence » n'est pas éprouvée au banc pour `presence_touch`.
- Des règles des miroirs ne sont exercées par aucun test (relance `snoozed` ou `done`, mandat daté dans le futur, bornes de `p_limite`, départage) ; `FOCUS_TOP_BANC` porte m23, que la vraie `focus_top_matches` ne rendrait pas (plafond de deux par contact).

*Relecture finale (23.09.2026), les mineurs*
- Le catalogue d'« Aujourd'hui » : « Proposé » n'invalide pas `[CLE_FIL]`, donc le segment « Matching » reste périmé ; le lot E retire le catalogue.
- Le vocabulaire : DE « Kein Interesse » (lot C) contre « Nicht interessiert » ; IT « Non interessato » contre « Non interessato/a » ; FR compteurs « Intéressés » contre pastilles « Intéressé·e » ; « acheteurs » dans la pige (conception §7bis) contre « acquéreurs » ailleurs.
- « Proposer la visite » ouvre la fiche contact depuis « Pendant ton absence », « À conclure » depuis « Sa boucle » : on pourrait passer par `lienPlace`.
- « Voir les N actions dans le Matching » ouvre « À proposer », qui ne montre pas ces N actions : retirer le compte du libellé ? Décision de texte.
- « Nouveau mandat · N acquéreurs compatibles » compte les acheteurs déjà en deal, que la fiche cache.
- Une relance `snoozed` compte pour le segment et le fil, pas pour `today_absence` (règle antérieure, `pending` et `triggered` seuls) : replanifiée mais toujours en retard, elle sort de « Pendant ton absence ».
- `STATUTS_BOUCLE` est en double (`useContactSentMatches.ts`, `useMatchingFil.ts`).
- Un commentaire périmé au-dessus de `onSignal` (`PageAujourdhuiH.tsx`, antérieur au lot).
- Le focus en coins carrés sur la liste « Ce qui a bougé » (cosmétique).

---

## Écarts à l'exécution (23.09.2026) — le code du dépôt fait foi

Les tâches ont été exécutées par sous-agents et corrigées après relecture : de 1 à 13, une relecture de conformité puis une de qualité ; la 14, une relecture en deux passes ; la 15, portes, suite et build verts, docs relues le 23.09.2026, commits au signal de Julien. Les blocs de code des tâches ci-dessus ne sont pas réécrits : ces lignes disent où le dépôt s'en écarte, et pourquoi.

- ⚠ **La migration s'appelle `supabase/migrations/20260923190000_matching_surfaces.sql`**, pas `…120000` (tâche 3). Au redatage du jour de la fusion, chaque lot garde son suffixe : `…120000` passerait AVANT `…140000_matching_boucle`, dont elle lit `prix_propose` et `match_ids`, et `db reset` casserait (un corps `language sql` est validé à sa création). Son en-tête le dit ; le banc et les specs la nomment sans date (`…_matching_surfaces.sql`), et les specs la trouvent par ce suffixe : le redatage ne les touche pas.
- **Tâche 1** — `lienPlace` exige `reporte: boolean` : un `suggested` reporté est rangé dans « Reportés », hors de l'ordre du fil, et « Ouvrir » menait à un AUTRE bien de l'acheteur (principe §6) ; les tâches 4, 7 et 10 le passent ou le calculent. `lienFil` écrit `onglet=aProposer` sans ligne (l'onglet se perdait) ; `?attente=` l'emporte aussi sur `?contact=` pour le filtre. Spec : 18 → 20 tests.
- **Tâche 2** — la ligne d'arrivée se RÉSOUT à la première lecture complète du fil : absente, elle est abandonnée, au lieu d'attendre qu'elle paraisse et de voler sélection et focus ; le focus n'est pris que s'il est perdu (`<body>`, nul, la racine), jamais sur un écran caché (`useEcranActif`) ; lu une fois par MONTAGE.
- **Tâche 3** — `nb_biens` filtré par `m.agency_id = v_agency` (`today_absence` est `security definer`) ; `prix` écarte un mandat non actif ou supprimé et `mandats` les supprimés, leurre « mandat vendu » dans A6 (décision 12) ; specs backend : la réaction de Clara datée à l'insertion (`set_match_response_at` ne part qu'en UPDATE : l'assertion était vide), un vrai signal de baisse sur l'annonce d'Antoine (A5) ; en-tête de migration corrigé.
- **Tâche 4** — `versAction` passe `reporte: false` au cas `prix` (la RPC écarte les revenus reportés), écarte une baisse ni `sent` ni `suggested` et un marché sans nouveauté ni baisse (hors contrat : phrase fausse ou ligne sans raison) ; la spec confronte aussi `greatest(...) <= now()` et assère `cle` et `location`.
- **Tâche 5** — clé `[CLE_FIL, 'du-jour', agencyId]` (sous une clé à part, une action consignée restait affichée 60 s) ; `isLoading` vrai tant que le profil manque ; la phrase sur deux lignes, entière au survol (`title`) ; icône `arrow-down` (`trending-down` retombait sur un histogramme) ; nom accessible « Matching, 7 actions » ; `useFocusQueue({ matchs: false })` au lieu d'un filtre après coup, qui faisait disparaître de « Dossiers » un acheteur dormant ayant un match fort et lisait `focus_top_matches` pour rien ; le corps des segments (`.hl-dossier`) défile (le segment chevauchait « Pendant ton absence » dès 1 024 × 768). Appartiennent aussi au commit de la tâche 5 : « Voir tout » → `lienFil({ onglet: 'aProposer' })` (posé à la tâche 13 : sans paramètre, un filtre retenu démentait le compte et un onglet neuf atterrissait sur la Recherche) et le cliquet de couleur `src/components/crm` 502 → 501 (le `MATCH: '#6F8CFF'` retiré de `useHotDeals`, repéré après la tâche 8).
- **Tâche 6** — clé `[CLE_FIL, 'absence', profile?.id]` ; `resumeReminder` refuse lui-même un `retoursDe` ; la traduction ligne → signal devient un module pur, `absenceSignaux.ts`, éprouvé par une spec HORS PLAN (`tests/unit/absence-signaux.spec.ts`) ; `CLE_FIL` déménage dans `filModele.ts`, ré-exporté par `useMatchingFil` (l'importer de là tirait `useAtelierMatching`, 1 157 lignes, dans « Aujourd'hui » mobile) ; allemand `vorgeschlagenen`.
- **Tâche 7** — `lire` rejoint `CLE_FIL` dans `filModele` ; `construireSaBoucle(lignes, criteres, acheteur, maintenant)`, quatrième paramètre obligatoire (un revenu reporté n'a pas de lien et n'est pas « à traiter ») ; le hook rend `chargeLe` ; un revenu du marché sur une annonce `removed` n'a pas de lien (le hook lit `market_listings.status`) ; un mandat masqué (supprimé, RLS) n'a pas de ligne ; Realtime sur `UPDATE` seul, `abortSignal`, canal nommé avec le contact, lectures en ordre total.
- **Tâche 8** — `ContactDetailPage` passe `boucle.chargeLe`, `demoFixtures` une constante `MAINTENANT_DEMO` ; défaut du plan corrigé dans `CdBienBoucle`, dont le `{ ...ligne, border: 0, borderTop: … }` effaçait le filet : à l'état final, `ligne` pose les QUATRE côtés un à un (`borderTop` filet ou 0, `borderRight`, `borderBottom` et `borderLeft` à 0 : un `<button>` porte une bordure d'agent utilisateur), et le bouton étale `{ ...ligne, … }` sans aucun raccourci `border` ; cliquet de grammaire `contacts-pager` {44, 61} → {42, 59} ; après relecture : cartes « À traiter » filetées (invisibles en sombre), états de chargement et d'erreur (la page disait « Aucun bien proposé »), détail, signal et note à la ligne, la ligne refusée n'atténue plus que vignette et titre, anglais « Returned » et « Ready to propose again », vocabulaire DE/IT aligné sur le fil.
- **Tâche 9** — le report ne compte que pour un `suggested` (`versCompatible`) ; `texteEtat` exhaustif ; l'exigence de remontage écrite en tête de `QuiPourCeBien`. Effets visibles dans le fil : « Revenu · refusé à … » au lieu de « À proposer », plus de motif en code brut.
- **Tâche 10** — `lire` et `CLE_FIL` depuis `filModele` (aucune fiche ne tire `useAtelierMatching`) ; clé `[CLE_FIL, CLE_QUI_POUR, …]`, que « Réactiver » couvre par son `[CLE_FIL]`, sans seconde invalidation ; `reporte` par `etatCompatible` ; `retiree` (annonce retirée : pas d'« Ouvrir » pour un compatible à proposer, ligne `fil.quiPour.retiree`) ; `annonce.transaction === 'location'` (le plan écrivait `transaction_type === 'rent'` : l'annonce arrive mappée) ; anciens prospects sur un mandat ACTIF seulement (sinon un 404 et une erreur sur chaque mandat vendu ou brouillon) ; `?qui=1` : le mandat défile après la remise à zéro des colonnes, une fois les compatibles lus, l'annonce seulement si le bloc n'est pas entier à l'écran, et par le haut ; une erreur ne remplace plus une liste valide ; pas de faux vide tant que l'agence n'est pas connue ; `position: relative` sur `QuiPourFiche`.
- **Tâche 11** — canal `nouveau-mandat-${canal}-${propertyId}`, `abortSignal`, relecture à `SUBSCRIBED`, événements regroupés (~300 ms, annulation puis invalidation) ; « Aucun » repose sur une RELECTURE en fin de délai (celle de `SUBSCRIBED` pouvait être avalée par TanStack) ; garde `propertyId != null` ; `STATUTS_COMPATIBLES` exporté une fois (`filQuiPour.ts`) ; `role="status"` sur le texte seul ; l'écran « Fini » défile (son bouton passait sous le pli à 1 024 × 768).
- **Tâche 12** — clé `[CLE_FIL, 'pige-acheteurs', …]` ; lots PAR PAGE (`lotsParPage` : découpés sur la liste entière, les pastilles clignotaient au « Voir plus ») ; la taille des lots est liée à la borne SQL `(p_annonces)[1:30]` (`pige.spec.ts` lit la migration) ; anneau de filet sur la pastille (sans lui, ΔL* 0 en sombre) et fond `chipBg`, un voile (un fond opaque trouait la ligne survolée) ; `aria-label` conformes au WCAG 2.5.3 dans les quatre langues, gardés ; grille commune des lignes (`subgrid`), bouton de ligne étiré.
- **Tâche 13** — miroirs fidèles à la vraie migration (mandat actif et non supprimé, `STATUTS_COMPATIBLES` partagé, bornes, dates, départage) ; `FOCUS_TOP_BANC` corrigé contre la vraie RPC ; une relance de proposition sans bien `sent` est écartée (`relanceClose`, miroir de `fermer_relance_proposition`), une relance SANS bien (celle d'`automation-engine`, `match_id` nul) reste ouverte ; l'histoire du banc rend exactement l'attendu du plan (six actions).
- **Tâche 14** — `absenceSignaux.ts` entre au périmètre (c'est lui qui reconnaît une relance de proposition, `retoursDe`) ; `mailto:`, `sms:` et le composeur de la Messagerie rejoignent les interdits (aucune occurrence dans le périmètre) ; la règle « pages hôtes hors périmètre » est écrite dans la garde.
- **Relecture finale (23.09.2026)** — trois retouches après la passe des docs : la clé de « Sa boucle » (`useContactSentMatches`) passe sous le préfixe du fil, `[CLE_FIL, 'sa-boucle', contactId]`, et son invalidation Realtime la suit (un geste du fil rafraîchit aussi une fiche rouverte dans les 15 s de son `staleTime`) ; les commentaires qui citaient la migration par son nom daté écrivent `…_matching_surfaces.sql` (`filQuiPour.ts`, `crmFixtures.ts`, les deux specs backend), qui ne se périme pas au redatage ; en anglais, `fil.quiPour.etat.revenu` devient « Returned · declined at {{prix}} », aligné sur « Sa boucle ».
- **Incidents** — deux relecteurs sont sortis de leur rôle : l'un a joué `git stash push -u` sur le worktree, puis l'a restauré (arbre vérifié identique octet pour octet, aucune perte) ; l'autre a lancé `preview_start` depuis un autre dossier (sans conséquence : la conformité se juge sur le code). Depuis, les consignes des relecteurs interdisent toute commande git qui écrit et `preview_start`.
