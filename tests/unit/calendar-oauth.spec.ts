/**
 * Aller-retour OAuth de connexion d'agenda (src/lib/calendarOauth).
 *
 * Deux invariants de sécurité sont couverts ici :
 *   1. `calendarAuthMethod` ne renvoie `reauth` (= signInWithOAuth, qui
 *      ré-authentifie la session entière et peut basculer l'agent sur un autre
 *      compte) QUE si l'identité est déjà celle du compte courant.
 *   2. `calendarReturnPath` n'accepte que des écrans d'une table fermée : le
 *      paramètre `from` est lu dans l'URL de callback, donc attaquable.
 */
import { describe, it, expect } from 'vitest'
import {
  calendarAuthMethod,
  calendarRedirectTo,
  calendarReturnPath,
} from '@/lib/calendarOauth'

const ORIGIN = 'https://app.megga.ch'

describe('calendarRedirectTo', () => {
  it('marque le flux selon le provider', () => {
    expect(calendarRedirectTo(ORIGIN, 'google')).toBe(`${ORIGIN}/auth/callback?gcal=1`)
    expect(calendarRedirectTo(ORIGIN, 'azure')).toBe(`${ORIGIN}/auth/callback?outlook=1`)
  })

  it('ajoute `from` quand la connexion part du calendrier', () => {
    expect(calendarRedirectTo(ORIGIN, 'google', 'calendar'))
      .toBe(`${ORIGIN}/auth/callback?gcal=1&from=calendar`)
    expect(calendarRedirectTo(ORIGIN, 'azure', 'calendar'))
      .toBe(`${ORIGIN}/auth/callback?outlook=1&from=calendar`)
  })

  it('ignore une origine inconnue plutôt que de la propager', () => {
    // Cas réel : la fonction de connexion passée en référence à un onClick
    // reçoit un MouseEvent, pas un objet d'options.
    const notAnOrigin = 'https://evil.example' as unknown as 'calendar'
    expect(calendarRedirectTo(ORIGIN, 'google', notAnOrigin))
      .toBe(`${ORIGIN}/auth/callback?gcal=1`)
  })
})

describe('calendarAuthMethod', () => {
  it('lie l’identité quand le compte n’a pas encore celle du provider', () => {
    // Le cas dangereux : compte e-mail/mot de passe, adresse Google différente.
    // signInWithOAuth basculerait sur un autre compte, linkIdentity non.
    expect(calendarAuthMethod('google', [{ provider: 'email' }])).toBe('link')
    expect(calendarAuthMethod('azure', [{ provider: 'email' }, { provider: 'google' }])).toBe('link')
  })

  it('ré-authentifie seulement si l’identité est déjà celle du compte', () => {
    expect(calendarAuthMethod('google', [{ provider: 'google' }])).toBe('reauth')
    expect(calendarAuthMethod('azure', [{ provider: 'email' }, { provider: 'azure' }])).toBe('reauth')
  })

  it('retombe sur la liaison quand les identités sont indisponibles', () => {
    // getUserIdentities() peut échouer : ne jamais choisir la voie risquée par défaut.
    expect(calendarAuthMethod('google', null)).toBe('link')
    expect(calendarAuthMethod('google', undefined)).toBe('link')
    expect(calendarAuthMethod('google', [])).toBe('link')
  })
})

describe('calendarReturnPath', () => {
  const FALLBACK = '/dashboard/settings?tab=integrations&gcal=success'

  it('ramène au calendrier quand la connexion en venait', () => {
    expect(calendarReturnPath(new URLSearchParams('gcal=1&from=calendar'), FALLBACK))
      .toBe('/dashboard/calendar')
  })

  it('garde la destination historique sans paramètre', () => {
    expect(calendarReturnPath(new URLSearchParams('gcal=1'), FALLBACK)).toBe(FALLBACK)
  })

  it('refuse toute destination hors table (redirection ouverte)', () => {
    for (const hostile of [
      'from=https://evil.example',
      'from=//evil.example',
      'from=/dashboard/settings',
      'from=calendar2',
      'from=',
    ]) {
      expect(calendarReturnPath(new URLSearchParams(hostile), FALLBACK)).toBe(FALLBACK)
    }
  })
})
