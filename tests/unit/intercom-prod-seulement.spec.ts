/**
 * Intercom ne boote qu'en production (`src/lib/intercom.ts`).
 *
 * Un poste de développement boote avec son propre projet Supabase, donc avec d'autres
 * `user_id` : chaque environnement créait sa fiche, et un même e-mail finissait sous 2 à 4
 * fiches dans Intercom (plan Intercom §2). Ce test garde la règle : hors build de
 * production, rien ne part vers Intercom tant qu'on ne le force pas explicitement.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const h = vi.hoisted(() => ({ boots: 0 }))

vi.mock('@intercom/messenger-js-sdk', () => ({
  Intercom: () => { h.boots++ },
  update: () => undefined,
  shutdown: () => undefined,
  showSpace: () => undefined,
  showArticle: () => undefined,
  trackEvent: () => undefined,
}))

// L'App ID et le mode sont lus au chargement du module : chaque cas le recharge.
async function charger() {
  vi.resetModules()
  return import('@/lib/intercom')
}

beforeEach(() => {
  h.boots = 0
  vi.stubEnv('VITE_INTERCOM_APP_ID', 'app-test')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Intercom — la production seulement', () => {
  it('hors production, rien ne boote même avec un App ID (poste de développement)', async () => {
    vi.stubEnv('PROD', false)
    const intercom = await charger()

    intercom.bootIntercom({ user_id: 'agent-1', intercom_user_jwt: 'jwt', produit: 'crm' })

    expect(intercom.isIntercomEnabled()).toBe(false)
    expect(h.boots).toBe(0)
    expect(intercom.showIntercomSpace('help')).toBe(false)
  })

  it('en production, le Messenger boote', async () => {
    vi.stubEnv('PROD', true)
    const intercom = await charger()

    intercom.bootIntercom({ produit: 'crm' })

    expect(intercom.isIntercomEnabled()).toBe(true)
    expect(h.boots).toBe(1)
  })

  it('VITE_INTERCOM_FORCE_DEV=true le permet en local, pour essayer le Messenger', async () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_INTERCOM_FORCE_DEV', 'true')
    const intercom = await charger()

    intercom.bootIntercom({ produit: 'crm' })

    expect(h.boots).toBe(1)
  })

  it("sans App ID, rien ne boote, même en production", async () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_INTERCOM_APP_ID', '')
    const intercom = await charger()

    intercom.bootIntercom({ produit: 'crm' })

    expect(intercom.isIntercomEnabled()).toBe(false)
    expect(h.boots).toBe(0)
  })
})
