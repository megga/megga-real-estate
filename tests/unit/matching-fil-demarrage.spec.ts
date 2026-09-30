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
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { ecranDuFil, type RecherchesAgence } from '@/components/matching-fil/filDemarrage'
import matchingFr from '@/i18n/locales/fr/matching.json'
import matchingDe from '@/i18n/locales/de/matching.json'
import matchingEn from '@/i18n/locales/en/matching.json'
import matchingIt from '@/i18n/locales/it/matching.json'

const lu = (matchs: number) => ({ chargement: false, erreur: false, matchs })
const TOUTES: RecherchesAgence[] = ['chargement', 'erreur', 'aucune', 'actives']
const source = (chemin: string): string => readFileSync(join(process.cwd(), chemin), 'utf8')

/**
 * Les pixels d'un PNG RVBA 8 bits non entrelacé — le seul format que la garde de la couverture lit. Le dépôt n'a pas de
 * décodeur d'image : les blocs IDAT, `inflateSync`, puis les cinq filtres de ligne de la norme.
 */
function pixelsPng(png: Buffer): { largeur: number; hauteur: number; rgba: Uint8Array } {
  const largeur = png.readUInt32BE(16)
  const hauteur = png.readUInt32BE(20)
  expect([png[24], png[25], png[28]], 'profondeur 8, RVBA, non entrelacé').toEqual([8, 6, 0])
  const blocs: Buffer[] = []
  for (let i = 8; i < png.length; ) {
    const longueur = png.readUInt32BE(i)
    if (png.toString('latin1', i + 4, i + 8) === 'IDAT') blocs.push(png.subarray(i + 8, i + 8 + longueur))
    i += 12 + longueur
  }
  const brut = inflateSync(Buffer.concat(blocs))
  const pas = largeur * 4
  const rgba = new Uint8Array(pas * hauteur)
  for (let y = 0; y < hauteur; y++) {
    const filtre = brut[y * (pas + 1)]!
    for (let x = 0; x < pas; x++) {
      const v = brut[y * (pas + 1) + 1 + x]!
      const a = x >= 4 ? rgba[y * pas + x - 4]! : 0
      const b = y > 0 ? rgba[(y - 1) * pas + x]! : 0
      const c = x >= 4 && y > 0 ? rgba[(y - 1) * pas + x - 4]! : 0
      const p = a + b - c
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c
      const predit = [0, a, b, (a + b) >> 1, paeth][filtre]!
      rgba[y * pas + x] = (v + predit) & 0xff
    }
  }
  return { largeur, hauteur, rgba }
}

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

  // Revue UX du 29.09.2026 : elle restait noire en clair, au milieu d'un CRM blanc.
  it('elle suit le thème, comme celle de Contacts : en clair, le fond de carte et les encres de la palette', () => {
    const couverture = source('src/components/matching-fil/MatchingFirstRun.tsx')
    expect(couverture).toContain('encresCouverture(sp, dark)')
    expect(couverture).toMatch(/:\s*\{\s*fond: sp\.cardBg, ink: sp\.ink, sub: sp\.sub,/)
    expect(couverture).toContain('bouton: { fond: sp.accent, ink: encreSur(sp.accent)')
  })

  it('son image se pose sur les deux fonds : aucun noir peint sous les points', () => {
    // Elle avait déjà un canal alpha, mais opaque : 892 408 pixels noirs sur 917 280. Le noir est devenu transparence.
    const { rgba } = pixelsPng(readFileSync(join(process.cwd(), 'public/matching/matching-cover.png')))
    let noirsOpaques = 0
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3]! > 200 && Math.max(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!) < 16) noirsOpaques += 1
    }
    expect(noirsOpaques).toBe(0)
  })
})
