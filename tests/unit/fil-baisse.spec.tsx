/**
 * La baisse de prix sur une ligne du fil (`FilBaisse`, décision de Julien du 01.10.2026) : une flèche et le montant,
 * sans phrase à l'écran — la phrase reste pour un lecteur d'écran et au survol.
 *
 * Idiome `createRoot` + `act` du dépôt. Mock partiel de react-i18next : la clé EST le libellé, ses valeurs s'y accolent
 * en JSON.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}))

import { FilBaisse } from '@/components/matching-fil/filAtomes'
import { crmPalette } from '@/components/crm/tokens'

const LIBELLE = 'fil.signal.court {"montant":"CHF 250\'000"}'

let hote: HTMLDivElement | null = null
let racine: Root | null = null
afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
})

describe('FilBaisse', () => {
  it('à l’écran, la flèche et le montant ; la phrase pour un lecteur d’écran et au survol', async () => {
    hote = document.createElement('div')
    document.body.appendChild(hote)
    racine = createRoot(hote)
    await act(async () => { racine!.render(<FilBaisse sp={crmPalette(false)} montant="CHF 250'000" />) })
    const baisse = hote.firstElementChild as HTMLElement
    expect(baisse.title).toBe(LIBELLE)
    expect(baisse.querySelector('.sr-only')?.textContent).toBe(LIBELLE)
    const vu = [...baisse.children].filter((e) => e.getAttribute('aria-hidden') != null)
    expect(vu.map((e) => e.textContent)).toEqual(['', "CHF 250'000"])
    expect(vu[0].querySelector('svg')).not.toBeNull()
  })
})
