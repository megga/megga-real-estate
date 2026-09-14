/**
 * Backend (live CI) — prise de rendez-vous KYC : un lien RÉVOQUÉ ne réserve plus, et l'agenda
 * externe de l'agent n'est interrogé que sous bail (migration 20260914090000, audit du
 * 13.09.2026). Contre `supabase start` (SUPABASE_TEST_*), jamais la production.
 *
 *   R  book_kyc_appointment : un lien passé à `expired` AVANT son échéance — le seul levier de
 *      révocation — lève `link_expired` ; témoins : un lien soumis, et un lien encore ouvert,
 *      réservent (comportement inchangé). La liste blanche, valeur par valeur.
 *   B  le bail : accordé, refusé dans la fenêtre, repris une fois échu ; durée absurde refusée ;
 *      la ligne d'un autre agent sans bail depuis une heure est purgée.
 *   D  table et fonctions réservées au service : refus de PRIVILÈGE pour anon et authenticated,
 *      lecture du service en témoin.
 *   E  bout en bout par les edge functions servies en local : appointment-slots refuse un lien
 *      révoqué AVANT de divulguer le rendez-vous qu'il porte (témoin : le même lien, avant
 *      révocation, le montre) ; l'instantané de l'agent est écrit, resservi tel quel dans la
 *      fenêtre, repris une fois périmé ; appointment-book refuse le lien révoqué sans rien
 *      écrire, et jette l'instantané après une réservation ; appointment-manage le jette après
 *      une annulation.
 *
 * ⚠ Aucun agenda externe n'est connecté ici : `externalBusyRanges` rend `{ ok: true, busy: [] }`
 * sans appeler Google ni Microsoft. Ce qu'on éprouve est le BAIL et l'instantané — la rafale,
 * elle, est éprouvée par _shared/booking-freebusy-cache.test.ts, contre la même règle.
 * Secret HMAC : même câblage que magic-link-public-surface.spec.ts.
 * skipIf ne SKIP PAS en CI : lire le COMPTE de tests, jamais le seul code de sortie.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { anonClient, serviceRoleClient } from './helpers/supabase'
import { waitForEdgeWorker } from './helpers/edge'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const HAS_HMAC = !!process.env.MEGGA_MAGIC_LINK_HMAC_SECRET
const TEST_SECRET = process.env.MEGGA_MAGIC_LINK_HMAC_SECRET ?? ''
const BASE_URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const FN_HEADERS = { apikey: ANON, Authorization: `Bearer ${ANON}` }

type SignFn = (payload: { id: string; exp: number; k?: 'appt' }) => Promise<string>

/** Instant UTC à J+days, heure ronde — midi UTC tombe dans une grille 06:00-22:00 de Zurich en toute saison. */
const at = (days: number, utcHour: number, minutes = 0): string => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  d.setUTCHours(utcHour, minutes, 0, 0)
  return d.toISOString()
}

const OPEN_ALL_WEEK = Object.fromEntries(['1', '2', '3', '4', '5', '6', '7'].map((d) => [d, [['06:00', '22:00']]]))

describe.skipIf(!HAS_KEYS)('RDV KYC — statut du lien et instantané free/busy', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient
  let sign: SignFn | null = null
  const contactIds: string[] = []
  const caseIds: string[] = []
  const linkIds: string[] = []

  /** Un lien de l'agence A émis par l'agent A ; son jeton est SIGNÉ quand le secret est là. */
  const mkLink = async (tag: string, status: string): Promise<{ linkId: string; token: string }> => {
    const { data: c, error: cErr } = await svc.from('contacts').insert({
      agency_id: setup.agencyAId, first_name: 'Rdv', last_name: `${tag}-${setup.stamp}`, type: 'buyer',
    }).select('id').single()
    if (cErr) throw new Error(`contact ${tag}: ${cErr.message}`)
    contactIds.push(c.id)
    const { data: k, error: kErr } = await svc.from('kyc_cases').insert({
      agency_id: setup.agencyAId, contact_id: c.id, type: 'buyer_pp',
    }).select('id').single()
    if (kErr) throw new Error(`kyc_case ${tag}: ${kErr.message}`)
    caseIds.push(k.id)
    const { data: l, error: lErr } = await svc.from('kyc_magic_links').insert({
      token: `rdv-statut-${setup.stamp}-${tag}`,
      agency_id: setup.agencyAId, kyc_case_id: k.id, contact_id: c.id,
      mode: 'libre', channels: ['email'], status,
      expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      created_by: setup.agentAId,
    }).select('id').single()
    if (lErr) throw new Error(`link ${tag}: ${lErr.message}`)
    linkIds.push(l.id)
    if (!sign) return { linkId: l.id as string, token: '' }
    const token = await sign({ id: l.id, exp: Math.floor(Date.now() / 1000) + 3600 })
    const { error: tErr } = await svc.from('kyc_magic_links').update({ token }).eq('id', l.id)
    if (tErr) throw new Error(`token ${tag}: ${tErr.message}`)
    return { linkId: l.id as string, token }
  }

  const revoquer = async (linkId: string) => {
    const { error } = await svc.from('kyc_magic_links').update({ status: 'expired' }).eq('id', linkId)
    if (error) throw new Error(`révocation : ${error.message}`)
  }

  const instantane = async (agentId: string) => {
    const { data, error } = await svc.from('kyc_booking_freebusy_cache')
      .select('lease_id, claimed_at, fetched_at, ok, busy, window_to').eq('agent_id', agentId).maybeSingle()
    if (error) throw new Error(`instantané : ${error.message}`)
    return data as { lease_id: string; claimed_at: string; fetched_at: string | null; ok: boolean | null; busy: unknown; window_to: string | null } | null
  }

  const claim = (agentId: string, ttl = 60) =>
    svc.rpc('kyc_booking_freebusy_claim', { p_agent_id: agentId, p_ttl_seconds: ttl })

  const slots = (token: string) =>
    fetch(`${BASE_URL}/functions/v1/appointment-slots?${new URLSearchParams({ token })}`, { headers: FN_HEADERS })

  const book = (token: string, startsAt: string) =>
    fetch(`${BASE_URL}/functions/v1/appointment-book`, {
      method: 'POST',
      headers: { ...FN_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, starts_at: startsAt }),
    })

  beforeAll(async () => {
    if (HAS_HMAC) {
      // Shim Deno AVANT d'importer le module de jeton — même convention que magic-link-public-surface.spec.ts.
      ;(globalThis as Record<string, unknown>).Deno = {
        env: { get: (k: string) => (k === 'MEGGA_MAGIC_LINK_HMAC_SECRET' ? TEST_SECRET : undefined) },
      }
      const mod = (await import('../../supabase/functions/_shared/magic-link-token.ts')) as { signMagicLinkToken: SignFn }
      sign = mod.signMagicLinkToken
    }
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()
    const { error } = await svc.from('agent_booking_settings').upsert({
      agent_id: setup.agentAId, agency_id: setup.agencyAId, is_open: true,
      timezone: 'Europe/Zurich', slot_minutes: 30, buffer_minutes: 15,
      min_notice_hours: 24, max_advance_days: 30, weekly_hours: OPEN_ALL_WEEK,
    }, { onConflict: 'agent_id' })
    if (error) throw new Error(`settings: ${error.message}`)
    if (HAS_HMAC) {
      for (const fn of ['appointment-slots', 'appointment-book', 'appointment-manage']) {
        await waitForEdgeWorker(`${BASE_URL}/functions/v1/${fn}`)
      }
    }
  }, 240_000)

  afterAll(async () => {
    if (!svc) return
    // appointments AVANT setup.cleanup() : agent_id est ON DELETE RESTRICT.
    await svc.from('appointments').delete().in('agency_id', [setup.agencyAId, setup.agencyBId])
    await svc.from('kyc_booking_freebusy_cache').delete().in('agent_id', [setup.agentAId, setup.agentBId])
    await svc.from('agent_booking_settings').delete().in('agency_id', [setup.agencyAId, setup.agencyBId])
    // Rétention LBA : un lien de moins de dix ans ne se supprime pas — meilleur effort.
    if (linkIds.length) await svc.from('kyc_magic_links').delete().in('id', linkIds).then(() => {}, () => {})
    if (caseIds.length) await svc.from('kyc_cases').delete().in('id', caseIds).then(() => {}, () => {})
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds).then(() => {}, () => {})
    await setup.cleanup()
  })

  // ── R. La RPC de réservation lit la liste ────────────────────────────────────
  describe('R — book_kyc_appointment refuse un lien révoqué', () => {
    const bookRpc = (linkId: string, startsAt: string) =>
      svc.rpc('book_kyc_appointment', { p_magic_link_id: linkId, p_starts_at: startsAt })

    it('R1 lien passé à `expired` AVANT son échéance → link_expired, et aucun rendez-vous écrit', async () => {
      const { linkId } = await mkLink('R1', 'submitted')
      await revoquer(linkId)
      const { error } = await bookRpc(linkId, at(5, 12))
      expect(String(error?.message)).toContain('link_expired')
      const { data } = await svc.from('appointments').select('id').eq('magic_link_id', linkId)
      expect(data ?? []).toEqual([])
    })

    it('R2 TÉMOIN — le même lien, soumis et non révoqué, réserve', async () => {
      const { linkId } = await mkLink('R2', 'submitted')
      const { data, error } = await bookRpc(linkId, at(5, 12))
      expect(error).toBeNull()
      expect(typeof data).toBe('string')
    })

    it('R3 TÉMOIN — un lien encore ouvert réserve toujours (comportement inchangé)', async () => {
      const { linkId } = await mkLink('R3', 'opened')
      const { error } = await bookRpc(linkId, at(6, 12))
      expect(error).toBeNull()
    })

    it('R4 la liste blanche, valeur par valeur — un statut inconnu refuse', async () => {
      const attendu: Record<string, boolean> = {
        pending: true, opened: true, uploading: true, verifying: true, submitted: true,
        expired: false, revoked: false, SUBMITTED: false, '': false,
      }
      for (const [statut, reserve] of Object.entries(attendu)) {
        const { data, error } = await svc.rpc('kyc_magic_link_bookable', { p_status: statut })
        expect(error, statut).toBeNull()
        expect(data, statut).toBe(reserve)
      }
    })
  })

  // ── B. Le bail ───────────────────────────────────────────────────────────────
  describe('B — un bail par agent et par fenêtre', () => {
    it('B1 accordé, puis refusé dans la même fenêtre', async () => {
      const a = await claim(setup.agentBId)
      expect(a.error).toBeNull()
      expect(typeof a.data).toBe('string')
      const b = await claim(setup.agentBId)
      expect(b.error).toBeNull()
      expect(b.data).toBeNull()
    })

    it('B2 repris une fois la fenêtre échue — un bail NEUF', async () => {
      const avant = await instantane(setup.agentBId)
      const { error } = await svc.from('kyc_booking_freebusy_cache')
        .update({ claimed_at: new Date(Date.now() - 61_000).toISOString() }).eq('agent_id', setup.agentBId)
      expect(error).toBeNull()
      const { data } = await claim(setup.agentBId)
      expect(typeof data).toBe('string')
      expect(data).not.toBe(avant?.lease_id)
    })

    it('B3 une durée absurde est refusée', async () => {
      expect(String((await claim(setup.agentBId, 0)).error?.message)).toContain('bad_ttl')
      expect(String((await claim(setup.agentBId, 3601)).error?.message)).toContain('bad_ttl')
    })

    it('B4 la ligne d’un AUTRE agent sans bail depuis une heure est purgée au bail suivant', async () => {
      await svc.from('kyc_booking_freebusy_cache')
        .update({ claimed_at: new Date(Date.now() - 2 * 3_600_000).toISOString() }).eq('agent_id', setup.agentBId)
      expect(await instantane(setup.agentBId)).not.toBeNull()
      await claim(setup.agentAId)
      expect(await instantane(setup.agentBId)).toBeNull()
      // Témoin : la ligne de l'agent qui vient de prendre le bail, elle, reste.
      expect(await instantane(setup.agentAId)).not.toBeNull()
      await svc.from('kyc_booking_freebusy_cache').delete().eq('agent_id', setup.agentAId)
    })
  })

  // ── D. Réservé au service ────────────────────────────────────────────────────
  describe('D — ni anon ni authenticated', () => {
    it('D1 anon : lecture de l’instantané et bail refusés par privilège', async () => {
      const anon = anonClient()
      const lu = await anon.from('kyc_booking_freebusy_cache').select('agent_id').limit(1)
      expect(lu.error?.code).toBe('42501')
      expect((await anon.rpc('kyc_booking_freebusy_claim', { p_agent_id: setup.agentAId, p_ttl_seconds: 60 })).error).not.toBeNull()
    })

    it('D2 un agent authentifié : ni sa propre ligne, ni le bail, ni la liste', async () => {
      await claim(setup.agentAId)
      const lu = await setup.clientA.from('kyc_booking_freebusy_cache').select('agent_id').eq('agent_id', setup.agentAId)
      expect(lu.error?.code).toBe('42501')
      expect((await setup.clientA.rpc('kyc_booking_freebusy_claim', { p_agent_id: setup.agentAId, p_ttl_seconds: 60 })).error).not.toBeNull()
      expect((await setup.clientA.rpc('kyc_magic_link_bookable', { p_status: 'submitted' })).error).not.toBeNull()
      // Témoin : la ligne EXISTE — le refus n'est pas une table vide.
      expect(await instantane(setup.agentAId)).not.toBeNull()
      await svc.from('kyc_booking_freebusy_cache').delete().eq('agent_id', setup.agentAId)
    })
  })

  // ── E. Bout en bout par les edge functions ────────────────────────────────────
  describe.skipIf(!HAS_HMAC)('E — par les edge functions', () => {
    let lienListe = { linkId: '', token: '' }
    let lienReserve = { linkId: '', token: '' }

    it('E1 appointment-slots : un lien révoqué répond 410 `expired` SANS divulguer son rendez-vous', async () => {
      const { linkId, token } = await mkLink('E1', 'submitted')
      const { error } = await svc.rpc('book_kyc_appointment', { p_magic_link_id: linkId, p_starts_at: at(7, 12) })
      expect(error).toBeNull()
      // Témoin : avant révocation, le même appel MONTRE le rendez-vous.
      const temoin = await slots(token)
      const corpsTemoin = await temoin.text()
      expect(temoin.status, corpsTemoin.slice(0, 300)).toBe(200)
      expect(JSON.parse(corpsTemoin).already_booked).toBe(true)

      await revoquer(linkId)
      const res = await slots(token)
      const corps = (await res.json()) as Record<string, unknown>
      expect(res.status).toBe(410)
      expect(corps.reason).toBe('expired')
      expect(corps).not.toHaveProperty('appointment')
      expect(corps).not.toHaveProperty('slots')
    }, 60_000)

    it('E2 lien soumis : créneaux servis, et l’instantané de l’agent écrit sous bail', async () => {
      await svc.from('kyc_booking_freebusy_cache').delete().eq('agent_id', setup.agentAId)
      lienListe = await mkLink('E2', 'submitted')
      const res = await slots(lienListe.token)
      const texte = await res.text()
      expect(res.status, texte.slice(0, 300)).toBe(200)
      const corps = JSON.parse(texte) as { booking_open: boolean; slots: unknown[] }
      expect(corps.booking_open).toBe(true)
      expect(corps.slots.length).toBeGreaterThan(0)
      const ligne = await instantane(setup.agentAId)
      expect(ligne?.ok).toBe(true)
      expect(ligne?.fetched_at).not.toBeNull()
      expect(ligne?.busy).toEqual([])
      // La fenêtre lue couvre l'horizon entier (30 jours), pas seulement la requête.
      expect(Date.parse(String(ligne?.window_to))).toBeGreaterThan(Date.now() + 30 * 86_400_000)
    }, 60_000)

    it('E3 dans la fenêtre : resservi TEL QUEL — même bail, même lecture, aucun nouvel appel', async () => {
      const avant = await instantane(setup.agentAId)
      for (let i = 0; i < 3; i++) {
        const res = await slots(lienListe.token)
        expect(res.status).toBe(200)
        await res.body?.cancel()
      }
      const apres = await instantane(setup.agentAId)
      expect(apres?.lease_id).toBe(avant?.lease_id)
      expect(apres?.fetched_at).toBe(avant?.fetched_at)
    }, 60_000)

    it('E4 périmé : repris sous un bail NEUF, relu', async () => {
      const avant = await instantane(setup.agentAId)
      const vieux = new Date(Date.now() - 61_000).toISOString()
      await svc.from('kyc_booking_freebusy_cache').update({ claimed_at: vieux, fetched_at: vieux }).eq('agent_id', setup.agentAId)
      const res = await slots(lienListe.token)
      expect(res.status).toBe(200)
      await res.body?.cancel()
      const apres = await instantane(setup.agentAId)
      expect(apres?.lease_id).not.toBe(avant?.lease_id)
      expect(Date.parse(String(apres?.fetched_at))).toBeGreaterThan(Date.parse(vieux))
    }, 60_000)

    it('E5 appointment-book : un lien révoqué répond 410 `expired` et n’écrit rien', async () => {
      const { linkId, token } = await mkLink('E5', 'submitted')
      await revoquer(linkId)
      const res = await book(token, at(9, 12))
      const corps = (await res.json()) as Record<string, unknown>
      expect(res.status).toBe(410)
      expect(corps.reason).toBe('expired')
      const { data } = await svc.from('appointments').select('id').eq('magic_link_id', linkId)
      expect(data ?? []).toEqual([])
    }, 60_000)

    it('E6 TÉMOIN — un lien soumis réserve, et l’instantané de l’agent est JETÉ après l’écho', async () => {
      expect(await instantane(setup.agentAId), 'témoin : l’instantané existe avant la réservation').not.toBeNull()
      lienReserve = await mkLink('E6', 'submitted')
      const res = await book(lienReserve.token, at(8, 12))
      const texte = await res.text()
      expect(res.status, texte.slice(0, 300)).toBe(200)
      const { data } = await svc.from('appointments').select('id, status').eq('magic_link_id', lienReserve.linkId)
      expect(data).toHaveLength(1)
      expect(await instantane(setup.agentAId)).toBeNull()
    }, 60_000)

    it('E7 appointment-manage : une annulation jette l’instantané', async () => {
      // L'instantané revient avec la liste suivante…
      const liste = await slots(lienListe.token)
      expect(liste.status).toBe(200)
      await liste.body?.cancel()
      expect(await instantane(setup.agentAId)).not.toBeNull()
      // … et repart avec l'annulation, par le jeton de GESTION du rendez-vous.
      const { data: rdv } = await svc.from('appointments').select('id').eq('magic_link_id', lienReserve.linkId).single()
      const jeton = await sign!({ id: rdv!.id as string, exp: Math.floor(Date.now() / 1000) + 3600, k: 'appt' })
      const res = await fetch(`${BASE_URL}/functions/v1/appointment-manage`, {
        method: 'POST',
        headers: { ...FN_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: jeton, action: 'cancel' }),
      })
      const texte = await res.text()
      expect(res.status, texte.slice(0, 300)).toBe(200)
      const { data: annule } = await svc.from('appointments').select('status').eq('id', rdv!.id).single()
      expect(annule?.status).toBe('cancelled')
      expect(await instantane(setup.agentAId)).toBeNull()
    }, 60_000)
  })
})
