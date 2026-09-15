/**
 * L'écran d'erreur ne montre une référence d'incident QUE si l'événement part chez Sentry.
 *
 * ⚠ `Sentry.captureException` rend un identifiant même quand rien n'est envoyé — sans DSN,
 * ou en dev, où le client existe mais est désactivé. Une référence qui ne mène à rien ferait
 * chercher le support dans le vide : c'est `sentryEnvoie()` qui décide, pas l'identifiant.
 *
 * Idiome createRoot + act (le dépôt n'a pas @testing-library/react).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import i18n from '@/i18n'

const h = vi.hoisted(() => ({ envoie: false }))

vi.mock('@/lib/sentry', () => ({
  Sentry: { captureException: () => '9b3ed9db6c2f4e0aa1b2c3d4e5f60718' },
  sentryEnvoie: () => h.envoie,
}))

const { default: ErrorBoundary } = await import('@/components/layout/ErrorBoundary')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Deraille(): never {
  throw new Error('rendu impossible')
}

let conteneur: HTMLDivElement
let racine: Root

async function monter() {
  await act(async () => { racine.render(createElement(ErrorBoundary, null, createElement(Deraille))) })
}

beforeEach(async () => {
  await i18n.changeLanguage('fr')
  // React journalise l'erreur attrapée : attendu, et bruyant.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  conteneur = document.createElement('div')
  document.body.appendChild(conteneur)
  racine = createRoot(conteneur)
})

afterEach(() => {
  act(() => racine.unmount())
  conteneur.remove()
  vi.restoreAllMocks()
})

describe('ErreurApplication — la référence d’incident', () => {
  it('Sentry envoie : la référence (huit caractères) est montrée, à côté des deux issues', async () => {
    h.envoie = true
    await monter()
    expect(conteneur.querySelector('h1')?.textContent).toBe("Cette page n'a pas pu s'afficher")
    expect(conteneur.textContent).toContain("Référence de l'incident : 9b3ed9db")
    expect(conteneur.querySelector('a[href="/dashboard"]')?.textContent).toBe('Retour au tableau de bord')
    expect(conteneur.querySelector('button')?.textContent).toContain('Recharger la page')
  })

  it('⛔ rien ne part (dev, DSN absent) : AUCUNE référence — le centre d’aide reste', async () => {
    h.envoie = false
    await monter()
    expect(conteneur.querySelector('h1')?.textContent).toBe("Cette page n'a pas pu s'afficher")
    expect(conteneur.textContent).not.toContain('Référence')
    expect(conteneur.textContent).toContain("Centre d'aide")
  })
})
