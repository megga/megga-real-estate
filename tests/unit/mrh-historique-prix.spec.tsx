/**
 * L'historique du prix d'une annonce (`MrhHistoriquePrix`) : des libellés qui ne disent que ce que la série
 * sait (pige, relecture du 21.09.2026).
 *
 * ⛔ Une annonce DÉJÀ en baisse au début du suivi (relevée à son prix baissé, rien depuis) affichait
 * « Changements de prix 0 · Écart 0,0 % » sous une affiche qui porte le prix barré et « −9,5 % ». L'écran dit
 * à la place d'où part l'historique, et la baisse d'avant, à l'arrondi de l'affiche.
 * ⛔ Une apparition est datée à la DÉTECTION : l'écart ne se dit jamais « depuis la première publication ».
 *
 * Idiome createRoot + act. La lecture réseau est remplacée (`pointsDemo` + hook neutralisé) ; la clé EST le
 * libellé, et les valeurs interpolées s'y accolent (`clé#valeur`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      const v = o && (o.pct ?? o.date ?? o.count)
      return v != null ? `${k}#${String(v)}` : k
    },
    i18n: { language: 'fr' },
  }),
}))
// Le banc passe ses points : la requête n'a pas à exister.
vi.mock('@/hooks/usePige', () => ({
  useHistoriquePrix: () => ({ isPending: false, isError: false, fetchStatus: 'idle', data: undefined }),
}))

import MrhHistoriquePrix from '@/components/matching-recherche/MrhHistoriquePrix'
import { crmPalette } from '@/components/crm/tokens'
import type { PointPrix } from '@/components/matching-recherche/pige'
import type { MrhBien } from '@/components/matching-recherche/types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const point = (genre: PointPrix['genre'], quand: string, prix: number | null, ancienPrix: number | null = null): PointPrix =>
  ({ id: `${genre}-${quand}`, genre, quand, ancienPrix, prix, variationPct: null, statut: null })

const vente = (price: number, price_original: number | null) =>
  ({ id: 'ml-1', transaction: 'vente', price, rent: null, price_original, enLigneDepuis: '2026-06-01T00:00:00.000Z', retireeLe: null }) as unknown as MrhBien

let racine: Root | null = null
const monter = (bien: MrhBien, points: PointPrix[]) => {
  const el = document.createElement('div')
  racine = createRoot(el)
  act(() => { racine!.render(createElement(MrhHistoriquePrix, { bien, sp: crmPalette(false), dark: false, pointsDemo: points })) })
  return el
}
afterEach(() => { act(() => racine?.unmount()); racine = null })

describe('MrhHistoriquePrix — ce que la série sait, rien de plus', () => {
  it('⛔ déjà en baisse au début du suivi, rien depuis : « Suivi depuis le … » et la baisse d’avant, pas « 0 · 0,0 % »', () => {
    const el = monter(vente(905_000, 1_000_000), [point('suivi', '2026-09-21T08:00:00.000Z', 905_000)])
    const texte = el.textContent ?? ''
    expect(texte).toContain('recherche.historique.suivi')
    expect(texte).toContain('recherche.historique.depuisDate#21.09.2026')
    // L'arrondi de l'affiche (`ecartPct`) : −9,5 %, jamais « −10 % ».
    expect(texte).toContain('recherche.historique.avantSuivi#−9,5 %')
    expect(texte).not.toContain('recherche.historique.changements')
    expect(texte).not.toContain('recherche.historique.ecart')
  })

  it('une baisse suivie depuis son premier prix garde ses deux indicateurs, sans « avant le suivi »', () => {
    const el = monter(vente(2450, 2600), [point('suivi', '2026-09-21T08:00:00.000Z', 2600), point('baisse', '2026-09-24T08:00:00.000Z', 2450, 2600)])
    const texte = el.textContent ?? ''
    expect(texte).toContain('recherche.historique.changements')
    expect(texte).toContain('recherche.historique.ecart')
    expect(texte).toContain('−5,8 %')
    expect(texte).not.toContain('recherche.historique.avantSuivi')
  })

  it('une série ouverte par une apparition sans prix : l’écart part du premier prix, daté, pas de « la première détection »', () => {
    const el = monter(vente(2800, 3000), [
      point('apparition', '2026-09-22T08:00:00.000Z', null),
      point('prix', '2026-09-25T08:00:00.000Z', 3000, 0),
      point('baisse', '2026-09-30T08:00:00.000Z', 2800, 3000),
    ])
    const texte = el.textContent ?? ''
    expect(texte).toContain('recherche.historique.depuisDate#25.09.2026')
    expect(texte).not.toContain('recherche.historique.depuisDetection')
    expect(texte).toContain('recherche.historique.genre.apparition')
  })

  it('une apparition AVEC prix : l’écart se dit depuis la première détection', () => {
    const el = monter(vente(900_000, 1_000_000), [point('apparition', '2026-09-22T08:00:00.000Z', 1_000_000), point('baisse', '2026-09-30T08:00:00.000Z', 900_000, 1_000_000)])
    expect(el.textContent).toContain('recherche.historique.depuisDetection')
  })
})
