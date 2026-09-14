/**
 * Jalons d'activation → Intercom (`src/lib/intercom-milestones.ts`).
 *
 * Les Series d'onboarding ciblent « a fait X pour la première fois » : un jalon qui
 * repartirait à chaque session, ou sur la session d'un autre, fausserait ce ciblage sans
 * que rien ne le montre. Ces tests gardent : un envoi par agent, la garde en base, le
 * rattrapage au boot, les définitions des constats, et le refus sans identité vérifiée.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const h = vi.hoisted(() => ({
  prefs: {} as Record<string, unknown>,
  counts: {} as Record<string, number>,
  filters: [] as string[],
  writes: 0,
  track: [] as string[],
}))

vi.mock('@intercom/messenger-js-sdk', () => ({
  Intercom: () => undefined,
  update: () => undefined,
  shutdown: () => undefined,
  showSpace: () => undefined,
  showArticle: () => undefined,
  trackEvent: (name: string) => { h.track.push(name) },
}))

// Faux client Supabase : `profiles` (lecture/écriture des préférences) et comptages `head`.
vi.mock('@/lib/supabase', () => {
  const from = (table: string) => {
    let update: Record<string, unknown> | null = null
    const q = {
      select: () => q,
      update: (values: Record<string, unknown>) => { update = values; return q },
      eq: (col: string, val: unknown) => { h.filters.push(`${table}.eq(${col},${String(val)})`); return q },
      neq: (col: string, val: unknown) => { h.filters.push(`${table}.neq(${col},${String(val)})`); return q },
      not: (col: string, op: string, val: unknown) => {
        h.filters.push(`${table}.not(${col},${op},${String(val)})`)
        return q
      },
      single: async () => ({ data: { preferences: JSON.parse(JSON.stringify(h.prefs)) }, error: null }),
      then: (resolve: (v: unknown) => unknown) => {
        if (update) {
          h.prefs = update.preferences as Record<string, unknown>
          h.writes++
          return Promise.resolve({ error: null }).then(resolve)
        }
        return Promise.resolve({ count: h.counts[table] ?? 0, error: null }).then(resolve)
      },
    }
    return q
  }
  return { supabase: { from } }
})

let intercom: typeof import('@/lib/intercom')
let jalons: typeof import('@/lib/intercom-milestones')
const agent = { user_id: 'agent-1', intercom_user_jwt: 'jwt', produit: 'crm' as const }

beforeEach(async () => {
  h.prefs = {}
  h.counts = {}
  h.filters = []
  h.writes = 0
  h.track = []
  // L'App ID est lu au chargement du module, et l'état (boot, garde, file) vit dans le
  // module : on recharge les deux à chaque test.
  vi.stubEnv('VITE_INTERCOM_APP_ID', 'app-test')
  vi.resetModules()
  intercom = await import('@/lib/intercom')
  jalons = await import('@/lib/intercom-milestones')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Jalons Intercom — un envoi par agent', () => {
  it("rien ne part sans identité vérifiée : boot anonyme (impersonation comprise) ou JWT absent", async () => {
    const E = intercom.INTERCOM_EVENTS
    intercom.bootIntercom({ produit: 'crm' })
    expect(intercom.trackIntercomEvent(E.DEAL_CREATED)).toBe(false)
    await jalons.markIntercomMilestone(E.FIRST_KYC_CASE_OPENED)

    intercom.bootIntercom({ user_id: 'agent-1', produit: 'crm' })
    expect(intercom.trackIntercomEvent(E.DEAL_CREATED)).toBe(false)
    await jalons.markIntercomMilestone(E.FIRST_KYC_CASE_OPENED)

    expect(h.track).toEqual([])
    expect(h.writes).toBe(0)
  })

  it('envoie un jalon une seule fois et le retient sans toucher aux autres préférences', async () => {
    const E = intercom.INTERCOM_EVENTS
    h.prefs = { ui: { theme: 'dark' } }
    intercom.bootIntercom(agent)
    await jalons.markIntercomMilestone(E.FIRST_MATCH_SENT)
    await jalons.markIntercomMilestone(E.FIRST_MATCH_SENT)

    expect(h.track).toEqual(['first_match_sent'])
    expect(h.prefs).toEqual({ ui: { theme: 'dark' }, intercom: { first_match_sent: expect.any(String) } })
  })

  it('ne renvoie pas un jalon déjà retenu en base (session précédente, autre appareil)', async () => {
    const E = intercom.INTERCOM_EVENTS
    h.prefs = { intercom: { first_match_sent: '2026-09-01T10:00:00.000Z' } }
    intercom.bootIntercom(agent)
    await jalons.markIntercomMilestone(E.FIRST_MATCH_SENT)

    expect(h.track).toEqual([])
    expect(h.writes).toBe(0)
  })

  it("relit la base avant d'envoyer : un autre appareil a pu l'envoyer pendant la session", async () => {
    const E = intercom.INTERCOM_EVENTS
    intercom.bootIntercom(agent)
    await jalons.syncIntercomMilestones('agence-1') // garde chargée vide, rien de franchi
    h.prefs = { intercom: { first_kyc_case_opened: '2026-09-14T08:00:00.000Z' } }
    await jalons.markIntercomMilestone(E.FIRST_KYC_CASE_OPENED)

    expect(h.track).toEqual([])
  })

  it("un boot et un geste simultanés n'envoient le jalon qu'une fois", async () => {
    const E = intercom.INTERCOM_EVENTS
    h.counts = { kyc_cases: 1 }
    intercom.bootIntercom(agent)
    await Promise.all([
      jalons.syncIntercomMilestones('agence-1'),
      jalons.markIntercomMilestone(E.FIRST_KYC_CASE_OPENED),
    ])

    expect(h.track).toEqual(['first_kyc_case_opened'])
  })

  it('après la déconnexion, plus rien ne part', async () => {
    const E = intercom.INTERCOM_EVENTS
    intercom.bootIntercom(agent)
    intercom.shutdownIntercom()
    await jalons.markIntercomMilestone(E.FIRST_MATCH_SENT)

    expect(intercom.getIntercomUserId()).toBeNull()
    expect(h.track).toEqual([])
  })
})

describe('Jalons Intercom — rattrapage en base', () => {
  it('au boot, envoie les jalons constatés en base, et eux seuls', async () => {
    h.counts = { contacts: 5, properties: 2, kyc_cases: 0, matches: 0 }
    intercom.bootIntercom(agent)
    await jalons.syncIntercomMilestones('agence-1')

    expect(h.track).toEqual(['first_contacts_imported', 'first_property_created'])
    expect(Object.keys(h.prefs.intercom as Record<string, string>)).toEqual([
      'first_contacts_imported',
      'first_property_created',
    ])
  })

  it("définitions : 5 contacts au moins, brouillons exclus, match compté dès son envoi (sent_at)", async () => {
    h.counts = { contacts: 4 }
    intercom.bootIntercom(agent)
    await jalons.syncIntercomMilestones('agence-1')

    expect(h.track).toEqual([])
    expect(h.filters).toEqual(expect.arrayContaining([
      'contacts.eq(agency_id,agence-1)',
      'properties.eq(agency_id,agence-1)',
      'properties.neq(status,draft)',
      'kyc_cases.eq(agency_id,agence-1)',
      'matches.eq(agency_id,agence-1)',
      'matches.not(sent_at,is,null)',
    ]))
  })

  it('`only` limite le constat aux jalons demandés', async () => {
    const E = intercom.INTERCOM_EVENTS
    h.counts = { contacts: 5, properties: 3 }
    intercom.bootIntercom(agent)
    await jalons.syncIntercomMilestones('agence-1', [E.FIRST_CONTACTS_IMPORTED])

    expect(h.track).toEqual(['first_contacts_imported'])
    expect(h.filters.some((f) => f.startsWith('properties.'))).toBe(false)
  })

  it('un jalon déjà envoyé ne se recompte plus', async () => {
    h.prefs = { intercom: { first_property_created: '2026-09-01T10:00:00.000Z' } }
    h.counts = { properties: 3 }
    intercom.bootIntercom(agent)
    await jalons.syncIntercomMilestones('agence-1')

    expect(h.filters.some((f) => f.startsWith('properties.'))).toBe(false)
    expect(h.track).toEqual([])
  })
})
