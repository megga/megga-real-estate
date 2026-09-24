/**
 * « Ce qui a bougé » (`MrhBouge`) : les vides que l'écran doit tenir séparés, et la page suivante en échec
 * (pige, relecture du 21.09.2026).
 *
 * ⛔ DEUX DÉFAUTS. (1) Les jetons client (« Marie », des pièces, une surface) ne filtrent que les mouvements
 * CHARGÉS ; quand aucun ne passait, l'écran disait « Aucune nouvelle annonce sur cette période » — faux sur
 * le marché — et cachait « Voir plus », seule issue vers la page où l'annonce se trouve peut-être.
 * (2) Une page suivante en échec levait `isError`, et l'écran d'erreur remplaçait les pages déjà lues
 * (le versant parent est `etatDuFlux`, dans `pige.spec.ts`).
 * Lot D1 : la pastille des acheteurs compatibles — dite quand il y en a, tue sinon.
 *
 * Idiome createRoot + act (le dépôt n'a pas @testing-library/react). Mock PARTIEL de react-i18next : la clé
 * EST le libellé, et un compte s'y accole (`clé#N`) pour prouver qu'il est passé.
 */
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (k: string, o?: { count?: number }) => (o?.count != null ? `${k}#${o.count}` : k),
    i18n: { language: 'fr' },
  }),
}))

import MrhBouge from '@/components/matching-recherche/MrhBouge'
import { crmPalette } from '@/components/crm/tokens'
import type { MrhCtx } from '@/components/matching-recherche/mrhCtx'
import type { MouvementPige } from '@/components/matching-recherche/pige'
import type { MrhBien } from '@/components/matching-recherche/types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const sp = crmPalette(false)
const ctx = {
  sp, dark: false, ACC: sp.accent, ONACC: sp.accentInk, line: sp.cardSubBg, chipBg: sp.cardSubBg, cardSolid: sp.cardBg,
  surf: { card: sp.cardBg, cardSub: sp.cardSubBg, hairline: 'none', shadow: sp.shadow, shadowHov: sp.shadow },
  sel: [], buyer: null, toggleSel: () => {}, onOpen: () => {}, onAskAi: () => {}, animate: false,
} as MrhCtx

const VILLA = { id: 'ml-1', title: 'Villa de la pige', typeLabel: 'Villa', city: 'Genève', canton: 'GE', transaction: 'vente', photos: [], price: 2_000_000, rent: null } as unknown as MrhBien
const APPARITION: MouvementPige = {
  id: 'ev-1', genre: 'apparition', quand: new Date().toISOString(), ancienPrix: null, prix: 2_000_000,
  variationPct: null, joursSurMarche: 3, bien: VILLA,
}

type PropsBouge = Parameters<typeof MrhBouge>[0]
let racine: Root | null = null
const monter = (p: Partial<PropsBouge>) => {
  const el = document.createElement('div')
  racine = createRoot(el)
  const props: PropsBouge = {
    genre: 'apparition', mouvements: [], charges: 0, etat: 'pret', suiteDisponible: false, chargeSuite: false,
    suiteEnEchec: false, onSuite: () => {}, onReessayer: () => {}, onOuvrir: () => {}, ctx, ...p,
  }
  act(() => { racine!.render(createElement(MrhBouge, props)) })
  return el
}
afterEach(() => { act(() => racine?.unmount()); racine = null })

const bouton = (el: HTMLElement, libelle: string) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent === libelle) ?? null

describe('MrhBouge — deux vides, et une suite qui échoue sans rien effacer', () => {
  it('vide RÉEL : rien de chargé, pas de suite — le marché n’a pas bougé sur la période', () => {
    const el = monter({})
    expect(el.textContent).toContain('recherche.bouge.vide.apparition')
    expect(el.textContent).toContain('recherche.bouge.videCorps')
    expect(el.textContent).not.toContain('recherche.bouge.filtreVide')
    expect(bouton(el, 'recherche.bouge.voirPlus')).toBeNull()
  })

  it('⛔ vide PAR FILTRE avec une suite : « aucun des N chargés », et « Voir plus » reste', () => {
    const onSuite = vi.fn()
    const el = monter({ charges: 30, suiteDisponible: true, onSuite })
    expect(el.textContent).toContain('recherche.bouge.filtreVide#30')
    expect(el.textContent).toContain('recherche.bouge.filtreVideCorps')
    expect(el.textContent).not.toContain('recherche.bouge.vide.apparition')
    const suite = bouton(el, 'recherche.bouge.voirPlus')
    expect(suite).not.toBeNull()
    act(() => { suite!.click() })
    expect(onSuite).toHaveBeenCalledTimes(1)
  })

  it('vide par filtre sans suite : le compte des chargés, sans bouton', () => {
    const el = monter({ charges: 2 })
    expect(el.textContent).toContain('recherche.bouge.filtreVide#2')
    expect(bouton(el, 'recherche.bouge.voirPlus')).toBeNull()
  })

  it('⛔ page suivante en échec : la liste chargée reste, « Réessayer » dessous relance la SUITE', () => {
    const onSuite = vi.fn()
    const onReessayer = vi.fn()
    const el = monter({ mouvements: [APPARITION], charges: 1, suiteDisponible: true, suiteEnEchec: true, onSuite, onReessayer })
    expect(el.textContent).toContain('Villa de la pige')
    expect(el.textContent).toContain('recherche.bouge.suiteErreur')
    expect(el.textContent).not.toContain('recherche.bouge.erreur')
    expect(bouton(el, 'recherche.bouge.voirPlus')).toBeNull()
    act(() => { bouton(el, 'recherche.retry')!.click() })
    expect(onSuite).toHaveBeenCalledTimes(1)
    expect(onReessayer).not.toHaveBeenCalled()
  })

  it('pendant la relance, « Chargement… » passe avant l’échec encore levé', () => {
    const el = monter({ mouvements: [APPARITION], charges: 1, suiteDisponible: true, suiteEnEchec: true, chargeSuite: true })
    expect(el.textContent).not.toContain('recherche.bouge.suiteErreur')
    expect(bouton(el, 'recherche.bouge.chargement')?.disabled).toBe(true)
  })

  it('témoin : une première page en échec reste un écran d’erreur', () => {
    const el = monter({ etat: 'erreur' })
    expect(el.textContent).toContain('recherche.bouge.erreur')
  })

  it('D1 — la ligne dit combien d’acheteurs compatibles, et la pastille ouvre « Qui pour ce bien ? »', () => {
    const vus: string[] = []
    const el = monter({ mouvements: [APPARITION], charges: 1, acheteurs: new Map([['ml-1', 3]]), onQuiPour: (b) => { vus.push(b.id) } })
    const pastille = [...el.querySelectorAll('button')].find((b) => b.textContent === 'recherche.bouge.acheteurs#3')
    expect(pastille, 'pastille absente').toBeDefined()
    act(() => { pastille!.click() })
    expect(vus).toEqual(['ml-1'])
  })

  it('D1 — une annonce ABSENTE de la carte n’a pas de pastille : la ligne ne dit rien', () => {
    // La RPC ne rend jamais une annonce à 0 acheteur : sans compatible, l'annonce manque à la carte.
    const el = monter({ mouvements: [APPARITION], charges: 1, acheteurs: new Map([['ml-2', 3]]), onQuiPour: () => {} })
    expect(el.textContent).not.toContain('recherche.bouge.acheteurs')
    expect(el.querySelectorAll('li button')).toHaveLength(1)
  })

  it('D1 — sans `onQuiPour`, aucune pastille : elle ne mènerait nulle part', () => {
    const el = monter({ mouvements: [APPARITION], charges: 1, acheteurs: new Map([['ml-1', 3]]) })
    expect(el.textContent).not.toContain('recherche.bouge.acheteurs')
    expect(el.querySelectorAll('li button')).toHaveLength(1)
  })

  it('⛔ D1 — la pastille est un bouton FRÈRE : elle n’ouvre pas la fiche, et la ligne l’ouvre toujours', () => {
    // Imbriquée dans le bouton de la ligne, la pastille ferait remonter son clic : « Qui pour ce bien ? » ET la fiche.
    const onOuvrir = vi.fn()
    const onQuiPour = vi.fn()
    const el = monter({ mouvements: [APPARITION], charges: 1, acheteurs: new Map([['ml-1', 3]]), onQuiPour, onOuvrir })
    act(() => { bouton(el, 'recherche.bouge.acheteurs#3')!.click() })
    expect(onQuiPour).toHaveBeenCalledTimes(1)
    expect(onOuvrir).not.toHaveBeenCalled()
    act(() => { el.querySelector<HTMLButtonElement>('button.mrh-flux-ligne')!.click() })
    expect(onOuvrir).toHaveBeenCalledTimes(1)
    expect(onOuvrir.mock.calls[0]![0]).toMatchObject({ id: 'ml-1' })
  })
})

/**
 * ⛔ Le nom accessible de la pastille CONTIENT son texte visible, mot pour mot (WCAG 2.5.3) : qui la commande à la voix
 * dit ce qu'il lit — « 3 buyers » —, et un nom en « 3 matching buyers » ne l'entend pas. Le mock de `react-i18next`
 * ci-dessus rend les CLÉS : il ne peut pas voir ce défaut, d'où la lecture des quatre fichiers.
 */
describe('la pastille des acheteurs — nom accessible (quatre langues)', () => {
  const LANGUES = ['fr', 'en', 'de', 'it'] as const
  const lire = (l: string) => JSON.parse(readFileSync(`src/i18n/locales/${l}/matching.json`, 'utf8')) as {
    fil: { quiPour: { titreAria: string } }
    recherche: { bouge: Record<string, string> }
  }

  it.each(LANGUES)('%s : `acheteursAria` contient `acheteurs` tel quel, au singulier et au pluriel', (l) => {
    const { bouge } = lire(l).recherche
    for (const forme of ['one', 'other']) {
      const visible = bouge[`acheteurs_${forme}`]
      expect(visible, `acheteurs_${forme} absent`).toBeTruthy()
      expect(bouge[`acheteursAria_${forme}`], `acheteursAria_${forme}`).toContain(visible)
    }
  })

  it.each(LANGUES)('%s : la question est celle du bloc où la pastille mène (`fil.quiPour.titreAria`)', (l) => {
    const d = lire(l)
    for (const forme of ['one', 'other']) {
      expect(d.recherche.bouge[`acheteursAria_${forme}`]!.startsWith(d.fil.quiPour.titreAria), `acheteursAria_${forme}`).toBe(true)
    }
  })
})
