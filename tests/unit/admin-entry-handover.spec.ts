/**
 * Passage de session CRM → console (admin.megga.ch).
 *
 * La console n'a AUCUN formulaire de connexion : elle ne s'ouvre qu'en recevant
 * la session de qui l'ouvre depuis le CRM. Ce contrat tient à deux fonctions
 * pures — l'une fabrique l'URL, l'autre la relit — et à une propriété non
 * négociable : les jetons voyagent dans le FRAGMENT, jamais dans la query
 * string, sans quoi ils partiraient dans les journaux d'accès du serveur et
 * dans l'en-tête Referer.
 */
import { describe, it, expect } from 'vitest'
import {
  adminConsoleUrl,
  readHandoverFromHash,
  ADMIN_ENTRY_URL,
  HANDOVER_ACCESS,
  HANDOVER_REFRESH,
} from '@/lib/adminEntry'

const SESSION = { access_token: 'eyJhbGciOi.AAA-bbb_ccc', refresh_token: 'r3fr/esh+tok=en' }

describe('passage de session vers la console admin', () => {
  it('place les jetons dans le fragment, jamais dans la query string', () => {
    const url = new URL(adminConsoleUrl(SESSION)!)
    expect(url.origin).toBe(new URL(ADMIN_ENTRY_URL).origin)
    expect(url.search).toBe('')
    expect(url.hash).toContain(`${HANDOVER_ACCESS}=`)
    expect(url.hash).toContain(`${HANDOVER_REFRESH}=`)
  })

  it('fait l\'aller-retour, y compris sur des jetons à caractères réservés', () => {
    const url = new URL(adminConsoleUrl(SESSION)!)
    expect(readHandoverFromHash(url.hash)).toEqual(SESSION)
  })

  it('n\'ouvre rien sans session exploitable', () => {
    expect(adminConsoleUrl(null)).toBeNull()
    expect(adminConsoleUrl(undefined)).toBeNull()
    expect(adminConsoleUrl({ access_token: '', refresh_token: 'r' })).toBeNull()
    expect(adminConsoleUrl({ access_token: 'a', refresh_token: '' })).toBeNull()
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
    const hash = new URL(adminConsoleUrl(SESSION)!).hash
    expect(readHandoverFromHash(hash.slice(1))).toEqual(SESSION)
  })
})
