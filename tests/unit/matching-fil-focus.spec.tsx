/**
 * Le focus d'ouverture du fil (`MatchingFil`) : son clavier vit sur sa racine, et le focus est perdu quand il s'ouvre.
 *
 * Ce que cette spec refuse :
 *   · un fil ouvert, montré, qui laisse le focus sur `<body>` — donc sourd jusqu'au premier clic ;
 *   · un focus pris ailleurs qu'à un focus PERDU (un champ hors du fil le garde), ou qui fait défiler ;
 *   · un focus pris par un fil qu'on ne regarde pas — un écran caché, la page cachée du pager — puis oublié quand on le
 *     montre ; un focus resté sur une page devenue inerte, ou sur la puce d'onglet d'un écran qu'on cache
 *     (`aria-hidden`), qu'il faut tenir pour perdu ;
 *   · un focus pris sous une modale ouverte : E, P et X agiraient sur un match qu'on ne voit pas ;
 *   · une arrivée neuve qui ne rend pas le focus au fil, ou un fil qui le reprend à chaque rendu ;
 *   · la couverture, sans racine, suivie d'un fil qui ne le prend pas.
 *
 * Le montage est celui de `matching-fil-etats.spec.tsx` : le vrai fil, ses deux lectures tenues par le test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, useEffect } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const h = vi.hoisted(() => ({
  fil: null as unknown as LectureFil,
  recherches: 'aucune' as RecherchesAgence,
  navigate: null as NavigateFunction | null,
  /** Une modale possède-t-elle le clavier ? jsdom n'en voit jamais (`getClientRects` y est vide) : le test le dit. */
  modale: false,
  /** Stable d'un rendu à l'autre, comme celui de react-i18next. */
  traduction: { t: (cle: string) => cle, i18n: { language: 'fr' } },
}))

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => h.traduction,
}))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1' }, profile: { id: 'u-1', agency_id: 'ag-1' } }) }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/modaleOuverte', () => ({ modaleOuverte: () => h.modale }))
vi.mock('@/hooks/useMatchingFil', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useMatchingFil')>()),
  useMatchingFil: () => h.fil,
  useRecherchesActives: () => h.recherches,
}))
vi.mock('@/hooks/useSelectionMarche', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useSelectionMarche')>()),
  useSelectionMarche: () => ({
    matchs: [], aPlus: false, chargeLe: 0, isLoading: false, isError: false, aDesDonnees: false,
    isPlaceholderData: false, isFetching: false, refetch: () => Promise.resolve(),
  }),
}))

import MatchingFil from '@/components/matching-fil/MatchingFil'
import type { RecherchesAgence } from '@/components/matching-fil/filDemarrage'
import type { FilBien, FilMatch } from '@/components/matching-fil/filModele'
import type { useMatchingFil } from '@/hooks/useMatchingFil'
import { EcranActifProvider } from '@/hooks/useEcranActif'
import { avecArrivee } from '@/lib/jetonArrivee'
import { ROUTER_FUTURE } from '@/lib/routerFuture'

type LectureFil = ReturnType<typeof useMatchingFil>

const CHAMPEL: FilBien = {
  id: 'p1', titre: 'Appartement Champel', prix: 1_250_000, location: false, type: 'apartment', pieces: 4, surface: 110,
  ville: 'Genève', canton: 'GE', adresse: 'Avenue de Champel 12', equipements: [], photo: null, enVente: true, statut: 'active',
}
const A_PROPOSER: FilMatch = {
  id: 'm1', score: 88, raisons: null, criteres: null, creeLe: null, reporteJusquau: null, rechercheId: null, bien: CHAMPEL,
  acheteur: { id: 'c1', prenom: 'Julie', nom: 'Sturm', telephone: null, email: null, kyc: 'none' },
}

function lecture(p: Partial<LectureFil> = {}): LectureFil {
  return {
    isLoading: false, isError: false, aDesDonnees: true, erreurLe: 0,
    matchs: [], selections: [], boucle: [], relances: [], historique: new Map(), chargeLe: Date.now(),
    rafraichir: () => Promise.resolve(), ...p,
  }
}

function Pilote() {
  const navigate = useNavigate()
  useEffect(() => { h.navigate = navigate })
  return null
}

let hote: HTMLDivElement | null = null
let racine: Root | null = null

/** Rend (ou re-rend) le fil : son écran montré ou caché, sa page du pager montrée ou non. */
async function rendre({ actif = true, montre = true }: { actif?: boolean; montre?: boolean } = {}) {
  if (!racine) {
    hote = document.createElement('div')
    document.body.appendChild(hote)
    racine = createRoot(hote)
  }
  await act(async () => {
    racine!.render(
      <MemoryRouter initialEntries={['/dashboard/matching']} future={ROUTER_FUTURE}>
        <EcranActifProvider value={actif}>
          <MatchingFil dark={false} montre={montre} />
        </EcranActifProvider>
        <Pilote />
      </MemoryRouter>,
    )
  })
}

/** La racine du fil : l'élément qui porte son clavier. */
const racineDuFil = (): HTMLElement | null => hote?.querySelector<HTMLElement>('[tabindex="-1"]') ?? null

/** Rend le focus à `<body>`, comme une page qu'on quitte ou un écran qu'on cache. */
function perdreFocus(): void {
  act(() => { (document.activeElement as HTMLElement | null)?.blur() })
}

beforeEach(() => {
  h.fil = lecture({ matchs: [A_PROPOSER] })
  h.recherches = 'aucune'
  h.navigate = null
  h.modale = false
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  })
})

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('le focus d’ouverture du fil', () => {
  it('le fil s’ouvre : sa racine prend le focus perdu, sans rien faire défiler', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    await rendre()
    expect(racineDuFil()).not.toBeNull()
    expect(document.activeElement).toBe(racineDuFil())
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('un focus tenu ailleurs lui reste : un champ hors du fil', async () => {
    const champ = document.createElement('input')
    document.body.appendChild(champ)
    champ.focus()
    await rendre()
    expect(document.activeElement).toBe(champ)
  })

  it('un focus resté sur une page devenue inerte est perdu : la racine le prend', async () => {
    const page = document.createElement('div')
    page.setAttribute('inert', '')
    const bouton = document.createElement('button')
    page.appendChild(bouton)
    document.body.appendChild(page)
    bouton.focus()
    await rendre()
    expect(document.activeElement).toBe(racineDuFil())
  })

  it('la puce d’onglet cliquée reste dans l’écran qu’on cache (`aria-hidden`) : un focus perdu, que la racine prend', async () => {
    // Le navigateur ne rend ce focus à `<body>` qu'au rendu suivant : l'effet le voit encore sur la puce.
    const ecranQuitte = document.createElement('div')
    ecranQuitte.setAttribute('aria-hidden', 'true')
    const puce = document.createElement('button')
    ecranQuitte.appendChild(puce)
    document.body.appendChild(ecranQuitte)
    await rendre({ actif: false })
    puce.focus()
    expect(document.activeElement).toBe(puce)
    await rendre({ actif: true })
    expect(document.activeElement).toBe(racineDuFil())
  })

  it('sous une modale ouverte, rien ; la modale fermée, une arrivée neuve le rend à la racine', async () => {
    h.modale = true
    await rendre()
    expect(document.activeElement).toBe(document.body)
    h.modale = false
    await act(async () => { h.navigate!('/dashboard/matching?contact=c1', avecArrivee()) })
    expect(document.activeElement).toBe(racineDuFil())
  })

  it('la page cachée du pager ne le prend pas ; montrée, elle le prend', async () => {
    await rendre({ montre: false })
    expect(document.activeElement).toBe(document.body)
    await rendre({ montre: true })
    expect(document.activeElement).toBe(racineDuFil())
  })

  it('un écran caché ne le prend pas ; montré, il le prend — et le reprend à chaque retour', async () => {
    await rendre({ actif: false })
    expect(document.activeElement).toBe(document.body)
    await rendre({ actif: true })
    expect(document.activeElement).toBe(racineDuFil())
    perdreFocus()
    await rendre({ actif: false })
    await rendre({ actif: true })
    expect(document.activeElement).toBe(racineDuFil())
  })

  it('une arrivée neuve le rend à la racine ; hors de ces moments, un rendu ne le reprend pas', async () => {
    await rendre()
    perdreFocus()
    await rendre()
    expect(document.activeElement).toBe(document.body)
    await act(async () => { h.navigate!('/dashboard/matching?contact=c1', avecArrivee()) })
    expect(document.activeElement).toBe(racineDuFil())
  })

  it('une arrivée neuve laisse un focus tenu ailleurs', async () => {
    await rendre()
    const champ = document.createElement('input')
    document.body.appendChild(champ)
    champ.focus()
    await act(async () => { h.navigate!('/dashboard/matching?contact=c1', avecArrivee()) })
    expect(document.activeElement).toBe(champ)
  })

  it('la couverture n’a pas de racine ; le fil qui lui succède la prend', async () => {
    h.fil = lecture()
    await rendre()
    expect(racineDuFil()).toBeNull()
    expect(document.activeElement).toBe(document.body)
    h.fil = lecture({ matchs: [A_PROPOSER] })
    await rendre()
    expect(document.activeElement).toBe(racineDuFil())
  })

  it('le banc passe au fil ce que le pager lui dit (lecture du code ; le pager, `matching-pager.spec.tsx`)', () => {
    const pager = readFileSync(join(process.cwd(), 'src/pages/agent/MatchingPage.tsx'), 'utf8')
    expect(pager).toContain('<banc.Page0 dark={dark} onOpenRecherche={openRecherche} montre={page === 0} />')
    expect(readFileSync(join(process.cwd(), 'src/pages/dev/matchingFilBanc.tsx'), 'utf8'))
      .toContain('<MatchingFil dark={dark} onOpenRecherche={onOpenRecherche} montre={montre} />')
  })
})
