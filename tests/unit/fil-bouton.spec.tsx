/**
 * Le bouton d'un geste du fil (`FilBouton`, conception du fil épuré §2) : sa touche quitte sa face et vit dans
 * l'infobulle et `aria-keyshortcuts` ; réduit à une icône, il porte son libellé en `aria-label` et dans l'infobulle.
 *
 * Ce que cette spec refuse aussi : une touche perdue d'`aria-keyshortcuts` sur un bouton-icône ou sur le principal,
 * une autre icône que celle demandée, un bouton-icône qui n'est plus rond ou qui perd sa bordure, un bouton-icône sans
 * touche qui perd son infobulle.
 *
 * Idiome `createRoot` + `act` du dépôt. Mock partiel de react-i18next : la clé EST le libellé, ses valeurs s'y accolent
 * en JSON.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}))

import { FilBouton } from '@/components/matching-fil/filAtomes'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { crmPalette } from '@/components/crm/tokens'

const sp = crmPalette(false)
let hote: HTMLDivElement | null = null
let racine: Root | null = null
async function rendre(bouton: ReactNode): Promise<HTMLButtonElement> {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => { racine!.render(bouton) })
  return hote.querySelector('button')!
}
afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
})

/** Le tracé d'une icône tel que MEIcon le dessine : ce qu'un bouton-icône doit rendre, à l'identique. */
function trace(nom: MEIconName): string {
  const boite = document.createElement('div')
  boite.innerHTML = renderToStaticMarkup(<MEIcon name={nom} />)
  return boite.querySelector('svg')!.innerHTML
}

describe('FilBouton', () => {
  it('sa touche ne s’écrit plus sur sa face : elle vit dans l’infobulle et `aria-keyshortcuts`', async () => {
    const b = await rendre(<FilBouton sp={sp} touche="I" onClick={() => {}}>Intéressé</FilBouton>)
    expect(b.textContent).toBe('Intéressé')
    expect(b.querySelector('kbd')).toBeNull()
    expect(b.title).toBe('fil.actions.raccourci {"touche":"I"}')
    expect(b.getAttribute('aria-keyshortcuts')).toBe('I')
    expect(b.getAttribute('aria-label')).toBeNull()
  })

  it('réduit à son icône, il porte son libellé en `aria-label` et dans l’infobulle, avec sa touche ; rond, bordé', async () => {
    const b = await rendre(<FilBouton sp={sp} icone="close" libelle="Écarter" touche="X" onClick={() => {}} />)
    expect(b.textContent).toBe('')
    expect(b.querySelector('svg')).not.toBeNull()
    expect(b.getAttribute('aria-label')).toBe('Écarter')
    expect(b.title).toBe('fil.actions.infobulle {"libelle":"Écarter","touche":"X"}')
    expect(b.getAttribute('aria-keyshortcuts')).toBe('X')
    // Le texte part, pas l'affordance (conception §2) : un rond — aussi large que haut, sans la marge latérale du bouton
    // écrit (elle l'élargirait en ovale), au rayon de pilule — qui garde la bordure des boutons secondaires.
    expect(b.style.height).not.toBe('')
    expect(b.style.width).toBe(b.style.height)
    expect([b.style.paddingLeft, b.style.paddingRight]).toEqual(['0px', '0px'])
    expect(b.style.borderRadius).toBe('var(--crm-radius-pill)')
    expect(b.style.border).toContain('1px solid')
  })

  it('réduit à son icône sans touche : son libellé en `aria-label` et dans l’infobulle, sans raccourci', async () => {
    const b = await rendre(<FilBouton sp={sp} icone="close" libelle="Écarter" onClick={() => {}} />)
    expect(b.getAttribute('aria-label')).toBe('Écarter')
    expect(b.title).toBe('Écarter')
    expect(b.getAttribute('aria-keyshortcuts')).toBeNull()
  })

  it('l’icône dessinée est celle qu’on demande', async () => {
    const b = await rendre(<FilBouton sp={sp} icone="clock" libelle="Plus tard" touche="P" onClick={() => {}} />)
    expect(b.querySelector('svg')!.innerHTML).toBe(trace('clock'))
    expect(trace('clock')).not.toBe(trace('close'))
  })

  it('un libellé sur un bouton écrit : l’infobulle le dit, le nom accessible reste le texte du bouton', async () => {
    const b = await rendre(<FilBouton sp={sp} principal libelle="Je l’ai proposé à Anastasia" touche="E" onClick={() => {}}>Proposé</FilBouton>)
    expect(b.textContent).toBe('Proposé')
    expect(b.getAttribute('aria-label')).toBeNull()
    expect(b.title).toBe('fil.actions.infobulle {"libelle":"Je l’ai proposé à Anastasia","touche":"E"}')
    expect(b.getAttribute('aria-keyshortcuts')).toBe('E')
  })

  it('un clic appelle le geste', async () => {
    const geste = vi.fn()
    const b = await rendre(<FilBouton sp={sp} icone="clock" libelle="Plus tard" touche="P" onClick={geste} />)
    await act(async () => { b.click() })
    expect(geste).toHaveBeenCalledTimes(1)
  })
})
