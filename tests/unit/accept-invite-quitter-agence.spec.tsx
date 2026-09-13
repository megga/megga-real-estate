/**
 * La page d'invitation exige un consentement avant de faire quitter une agence qui porte
 * des données (audit du 13.09.2026, point S9).
 *
 * POURQUOI CE BANC, et pas `/dev/public`. Le banc public monte la page SANS session : il
 * rend « se connecter pour accepter », jamais le bouton ni l'avertissement, qui n'existent
 * que pour l'invité connecté dont l'e-mail concorde. La suite backend prouve le contrat de
 * l'edge (409 sans consentement) ; ce banc prouve que la PAGE le tient : la case conditionne
 * le bouton, `confirmLeave` ne part que cochée, et un 409 imprévu devient l'avertissement —
 * pas l'erreur générique qui renverrait l'invité à l'accueil.
 *
 * ⚠ Le 409 est servi comme `supabase-js` le rend : `data` à null, le code dans
 * `error.context` (la `Response`). Une fixture qui le mettrait dans `data.error` passerait
 * même contre une page qui ne sait pas lire le corps d'un refus.
 *
 * Idiome createRoot + act (le dépôt n'a pas @testing-library/react), cf. lab-guard-banner.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ROUTER_FUTURE } from '@/lib/routerFuture'

type Reponse = { data: unknown; error: unknown }

const h = vi.hoisted(() => ({
  apercu: {} as Record<string, unknown>,
  reclamation: { data: null, error: null } as { data: unknown; error: unknown },
  corps: [] as Record<string, unknown>[],
  // La clé EST le libellé : ce banc porte sur la mécanique, la copie est gardée par
  // i18n:parity. ⚠ UNE SEULE fonction pour tout le fichier : la page met `t` dans les
  // dépendances de l'effet d'aperçu, et un `t` neuf à chaque rendu le relancerait sans fin.
  t: (k: string) => k,
}))

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: h.t }),
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { email: 'invite@example.invalid' } }) }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: async (_nom: string, opts: { body: Record<string, unknown> }): Promise<Reponse> => {
        h.corps.push(opts.body)
        if (opts.body.action === 'preview') return { data: h.apercu, error: null }
        return h.reclamation
      },
    },
  },
}))

const { default: AcceptInvitePage } = await import('@/pages/public/AcceptInvitePage')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const APERCU = {
  email: 'invite@example.invalid',
  role: 'agent',
  agencyName: 'Agence Démo',
  inviterName: 'Agent Démo',
  expiresAt: '2099-01-01T00:00:00Z',
}

/** Un refus tel que `functions.invoke` le rend : `data` null, le corps dans `error.context`. */
function refus(status: number, code: string): Reponse {
  return {
    data: null,
    error: { message: 'Edge Function returned a non-2xx status code', context: { status, json: async () => ({ error: code }) } },
  }
}

let hote: HTMLDivElement
let racine: Root | null = null

/** Laisse filer les promesses de l'aperçu et de la réclamation. */
const vider = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve() })

async function monter() {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  act(() => racine!.render(
    // Les mêmes drapeaux que l'app : la navigation part dans une transition, comme en vrai.
    createElement(MemoryRouter, { initialEntries: ['/accept-invite/jeton-demo'], future: ROUTER_FUTURE },
      createElement(Routes, null,
        createElement(Route, { path: '/accept-invite/:token', element: createElement(AcceptInvitePage) }),
        createElement(Route, { path: '/dashboard', element: createElement('p', { id: 'arrivee' }, 'dashboard') }),
      ),
    ),
  ))
  await vider()
}

const alerte = () => hote.querySelector('[role="alert"]')
const caseACocher = () => hote.querySelector<HTMLInputElement>('input[type="checkbox"]')
const bouton = () => [...hote.querySelectorAll<HTMLButtonElement>('button')]
  .find((b) => b.textContent === 'team.acceptInvite.accept') ?? null
const reclamations = () => h.corps.filter((c) => c.action === 'claim')

beforeEach(() => {
  h.apercu = { ...APERCU }
  h.reclamation = { data: { success: true, redirectTo: '/dashboard' }, error: null }
  h.corps = []
})

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
})

describe('AcceptInvitePage — quitter une agence qui porte des données', () => {
  it('l’aperçu le signale : avertissement, bouton bloqué tant que la case n’est pas cochée', async () => {
    h.apercu = { ...APERCU, leavesAgencyWithData: true }
    await monter()

    expect(alerte(), 'l’avertissement doit s’afficher').not.toBeNull()
    expect(alerte()!.textContent).toContain('team.acceptInvite.leaveWarningTitle')
    expect(bouton()!.disabled, 'sans la case, le bouton ne doit rien envoyer').toBe(true)

    act(() => { caseACocher()!.click() })
    expect(bouton()!.disabled).toBe(false)

    act(() => { bouton()!.click() })
    await vider()
    // La suite d'une réclamation réussie (navigation) n'est pas l'objet de ce banc : seul le
    // corps envoyé l'est.
    expect(reclamations()).toEqual([{ token: 'jeton-demo', action: 'claim', confirmLeave: true }])
  })

  it('CONTRÔLE POSITIF — sans données à quitter : ni avertissement, ni case, ni `confirmLeave`', async () => {
    await monter()

    expect(alerte()).toBeNull()
    expect(caseACocher()).toBeNull()
    expect(bouton()!.disabled).toBe(false)

    act(() => { bouton()!.click() })
    await vider()
    expect(reclamations()).toEqual([{ token: 'jeton-demo', action: 'claim' }])
  })

  it('un 409 que l’aperçu n’avait pas prévu devient l’avertissement, pas une erreur', async () => {
    h.reclamation = refus(409, 'prior_agency_holds_data')
    await monter()
    expect(alerte()).toBeNull()

    act(() => { bouton()!.click() })
    await vider()
    expect(alerte(), 'le 409 doit ouvrir la confirmation').not.toBeNull()
    expect(hote.textContent, 'pas l’écran d’erreur générique').not.toContain('team.acceptInvite.error')
    expect(bouton()!.disabled).toBe(true)

    // Seconde tentative, cochée : cette fois le consentement part.
    h.reclamation = { data: { success: true }, error: null }
    act(() => { caseACocher()!.click() })
    act(() => { bouton()!.click() })
    await vider()
    expect(reclamations()).toEqual([
      { token: 'jeton-demo', action: 'claim' },
      { token: 'jeton-demo', action: 'claim', confirmLeave: true },
    ])
  })

  it('un autre refus garde son message : l’e-mail discordant n’est pas pris pour un 409', async () => {
    h.reclamation = refus(403, 'email_mismatch')
    await monter()

    act(() => { bouton()!.click() })
    await vider()
    expect(alerte()).toBeNull()
    expect(hote.textContent).toContain('team.acceptInvite.emailMismatch')
  })
})
