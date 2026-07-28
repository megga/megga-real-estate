/**
 * Lecture du passage de session par fragment (app autonome `admin.megga.ch`).
 *
 * ⚠ Le PRODUCTEUR de ce passage n'existe plus : la console est une surface du
 * CRM depuis juillet 2026, on y va par le routeur. Seul `main.admin.tsx` lit
 * encore un fragment, le temps que l'app autonome soit retirée — d'où une spec
 * réduite au LECTEUR.
 *
 * Ce qui reste non négociable tant que ce code vit : les jetons ne se lisent que
 * dans le FRAGMENT, jamais dans la query string, sans quoi ils partiraient dans
 * les journaux d'accès du serveur et dans l'en-tête `Referer`.
 */
import { describe, it, expect } from 'vitest'
import {
  readHandoverFromHash,
  HANDOVER_ACCESS,
  HANDOVER_REFRESH,
} from '@/lib/adminEntry'

const SESSION = { access_token: 'eyJhbGciOi.AAA-bbb_ccc', refresh_token: 'r3fr/esh+tok=en' }

/** Fabrique un fragment comme le faisait le CRM, sans dépendre du producteur retiré. */
function fragmentFor(session: { access_token: string; refresh_token: string }): string {
  return `#${new URLSearchParams({
    [HANDOVER_ACCESS]: session.access_token,
    [HANDOVER_REFRESH]: session.refresh_token,
  }).toString()}`
}

describe('lecture du passage de session vers la console admin', () => {
  it('fait l\'aller-retour, y compris sur des jetons à caractères réservés', () => {
    expect(readHandoverFromHash(fragmentFor(SESSION))).toEqual(SESSION)
  })

  it('rend null sur une visite directe — l\'écran « depuis le CRM » doit suivre, pas une erreur', () => {
    expect(readHandoverFromHash('')).toBeNull()
    expect(readHandoverFromHash('#')).toBeNull()
    expect(readHandoverFromHash('#autre=1')).toBeNull()
    // Un seul des deux jetons ne suffit pas : setSession échouerait de toute façon.
    expect(readHandoverFromHash(`#${HANDOVER_ACCESS}=a`)).toBeNull()
    expect(readHandoverFromHash(`#${HANDOVER_REFRESH}=r`)).toBeNull()
  })

  it('accepte le fragment avec ou sans dièse de tête', () => {
    expect(readHandoverFromHash(fragmentFor(SESSION).slice(1))).toEqual(SESSION)
  })
})
