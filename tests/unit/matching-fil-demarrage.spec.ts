/**
 * Le premier lancement et les états vides du fil de matchs (lot E1, conception
 * `docs/superpowers/specs/2026-09-27-matching-lot-e1-bureau-design.md` §5.1 et §8).
 *
 * Ce que cette spec refuse :
 *   · la couverture montrée à une agence qui a une recherche d'acheteur active, pendant une lecture ou sur un échec ;
 *   · « Tout est à jour » dit à une agence qui a des recherches mais aucun match ;
 *   · une couverture qui laisserait croire qu'un mandat est requis, dont une langue manquerait un texte, ou dont une
 *     étape perdrait son icône.
 *
 * Ce que la page 0 REND de cette règle est éprouvé sur le vrai fil, dans `matching-fil-etats.spec.tsx` ; la lecture
 * des recherches actives, sur le vrai crochet, dans `matching-fil-recherches.spec.tsx`.
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
    expect(fil.vide.sansMatch).toBe('Aucun match pour l\'instant')
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

describe('la couverture', () => {
  // Une icône ne se lit pas dans le DOM rendu (un tracé SVG) : c'est la table des étapes qui la porte.
  it('l’acheteur, puis ses biens, puis MEGGA — chaque icône à son étape', () => {
    const couverture = source('src/components/matching-fil/MatchingFirstRun.tsx')
    const etapes = [...couverture.matchAll(/\{ icon: '(\w+)', key: '(\w+)' \}/g)].map((m) => [m[2], m[1]])
    expect(etapes).toEqual([['acheteur', 'users'], ['biens', 'home'], ['scores', 'sparkle']])
  })
})
