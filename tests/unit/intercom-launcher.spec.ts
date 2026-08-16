/**
 * Lanceur Intercom masqué — l'invariant qui ne se voit pas à la relecture.
 *
 * Masquer la bulle est un `update()` ; identifier l'agent est un `shutdown()`
 * suivi d'un nouveau `boot()`. Les deux gestes vivent dans des fichiers
 * différents et se croisent une seconde après le montage du CRM : le boot
 * identifié attend le JWT de l'edge `intercom-identity`. Si le masquage n'était
 * qu'un appel à `update()`, il serait effacé par ce re-boot et la bulle
 * reviendrait — à l'écran seulement, jamais dans un test ni dans un log.
 *
 * C'est ce que verrouille ce fichier : l'état voulu du lanceur survit au cycle
 * shutdown → boot, et il s'applique même quand il est demandé AVANT le boot.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sdk = vi.hoisted(() => ({
  Intercom: vi.fn(),
  update: vi.fn(),
  shutdown: vi.fn(),
  showSpace: vi.fn(),
  showArticle: vi.fn(),
  trackEvent: vi.fn(),
}))

vi.mock('@intercom/messenger-js-sdk', () => sdk)

/** Recharge le module : `launcherHidden` et `booted` sont un état de MODULE. */
async function freshIntercom() {
  vi.resetModules()
  return import('@/lib/intercom')
}

/** Arguments du n-ième boot (0-indexé). */
function bootArgs(n = 0) {
  return sdk.Intercom.mock.calls[n]?.[0] as Record<string, unknown> | undefined
}

beforeEach(() => {
  vi.stubEnv('VITE_INTERCOM_APP_ID', 'test_app_id')
  for (const fn of Object.values(sdk)) fn.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Intercom — état du lanceur natif', () => {
  it('boote avec la bulle VISIBLE par défaut', async () => {
    const { bootIntercom } = await freshIntercom()
    bootIntercom()
    expect(bootArgs()).toMatchObject({ app_id: 'test_app_id', hide_default_launcher: false })
  })

  it('applique un masquage demandé AVANT le boot (coquille montée la première)', async () => {
    const { bootIntercom, setIntercomLauncherHidden } = await freshIntercom()

    setIntercomLauncherHidden(true)
    // Rien à mettre à jour : le Messenger n'existe pas encore.
    expect(sdk.update).not.toHaveBeenCalled()

    bootIntercom()
    expect(bootArgs()).toMatchObject({ hide_default_launcher: true })
  })

  it('GARDE la bulle masquée à travers shutdown + re-boot identifié', async () => {
    const { bootIntercom, shutdownIntercom, setIntercomLauncherHidden } = await freshIntercom()

    bootIntercom() // anonyme
    setIntercomLauncherHidden(true) // la coquille CRM se monte
    expect(sdk.update).toHaveBeenCalledWith({ hide_default_launcher: true })

    // Le JWT arrive → cycle d'identification (cf. IntercomMessenger).
    shutdownIntercom()
    bootIntercom({ user_id: 'u1', intercom_user_jwt: 'jwt' })

    expect(bootArgs(1)).toMatchObject({ user_id: 'u1', hide_default_launcher: true })
  })

  it('rétablit la bulle au démontage de la coquille', async () => {
    const { bootIntercom, setIntercomLauncherHidden } = await freshIntercom()

    bootIntercom()
    setIntercomLauncherHidden(true)
    setIntercomLauncherHidden(false)

    expect(sdk.update).toHaveBeenLastCalledWith({ hide_default_launcher: false })
  })

  it('reste un no-op complet sans App ID (dev local)', async () => {
    vi.stubEnv('VITE_INTERCOM_APP_ID', '')
    const { bootIntercom, setIntercomLauncherHidden } = await freshIntercom()

    setIntercomLauncherHidden(true)
    bootIntercom()

    expect(sdk.Intercom).not.toHaveBeenCalled()
    expect(sdk.update).not.toHaveBeenCalled()
  })
})
