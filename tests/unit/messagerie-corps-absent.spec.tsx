/**
 * Un message dont le corps n'a été ni téléchargé ni analysé (trop lourd, illisible) : la
 * synchro n'en écrit que le FAIT (`corpsNonLu` → `body_truncated`, corps vide), et c'est
 * l'écran qui le dit, dans la langue de l'agent (revue du 15.09.2026).
 *
 * ⛔ Le corps était une PHRASE FRANÇAISE écrite en base — « Message de 12 Mo, trop
 * volumineux… » —, lue telle quelle par un agent germanophone, jusque dans l'extrait de la liste.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MailBodyFrame } from '@/components/crm/messagerie/MailBodyFrame'
import { mailSurfaces } from '@/components/crm/messagerie/mailTokens'
import { crmPalette } from '@/components/crm/tokens'

// Mock PARTIEL (cf. lab-guard-banner.spec.tsx) : la clé EST le libellé.
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string) => k }),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let racine: Root | null = null
const monter = (props: { html: string | null; text: string | null; truncated: boolean }) => {
  const el = document.createElement('div')
  racine = createRoot(el)
  act(() => { racine!.render(createElement(MailBodyFrame, { ms: mailSurfaces(crmPalette(false), false), ...props })) })
  return el
}
afterEach(() => { act(() => racine?.unmount()); racine = null })

describe('MailBodyFrame — un corps absent se dit à l’écran', () => {
  it('corps vide et tronqué : la phrase de l’écran, pas un paragraphe vide', () => {
    expect(monter({ html: null, text: null, truncated: true }).textContent).toBe('mail.read.bodyMissing')
  })
  it('témoins : un texte s’affiche tel quel ; un corps vide non tronqué ne dit rien', () => {
    expect(monter({ html: null, text: 'Bonjour', truncated: false }).textContent).toBe('Bonjour')
    expect(monter({ html: null, text: null, truncated: false }).textContent).toBe('')
  })
})
