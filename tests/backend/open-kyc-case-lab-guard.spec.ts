// Backend integration spec (live CI) — garde LAB plein sur le chemin WhatsApp
// open_kyc_case (docs/agency-kyb-handoff.md §7ter, « trou de même classe encore
// ouvert »).
//
// executeOpenKycCase insère dans kyc_cases avec le client SERVICE_ROLE de
// whatsapp-webhook. service_role contourne INCONDITIONNELLEMENT les policies : le
// garde posé à l'étape 5 dans le WITH CHECK de kyc_cases_insert (migration
// 20260728171000_kyc_cases_insert_lab_guard.sql) ne couvre donc pas ce chemin, et
// celui des edge functions (kyc-screening, sign-document, via
// supabase/functions/_shared/agency-lab-guard.ts) ne s'applique pas non plus.
// « Ouvrir un dossier KYC client » — précisément l'action que la décision produit
// interdit à une agence non vérifiée — restait faisable par WhatsApp.
//
// Les DEUX étages du tier confirm sont vérifiés :
//   - executeOpenKycCase (whatsapp-webhook, post-« oui ») : le vrai rempart, seul
//     endroit où l'INSERT a lieu. Le payload figé d'une action en attente survit à
//     un changement de statut de l'agence entre la préparation et le « oui » — le
//     garde doit donc être relu au moment de l'exécution, jamais seulement avant.
//   - prepareOpenKycCase (whatsapp-agent) : ne propose même pas la confirmation,
//     pour ne pas promettre une action vouée au refus.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local
// seedé et DOIVENT réellement passer — lire le compte de tests, jamais le code de
// sortie (même convention que les autres specs étape 5).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import {
  prepareOpenKycCase,
  executeOpenKycCase,
  type ActionCtx,
} from '../../supabase/functions/_shared/whatsapp-actions'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

/** Fragment du refus LAB, distinct de tous les autres refus de l'exécuteur
 *  (« contact introuvable », « action incomplète ») — sert à prouver LEQUEL des
 *  contrôles a parlé, pas seulement qu'il y a eu refus. */
const LAB_REFUSAL = /identité de ton agence/i

describe.skipIf(!HAS_KEYS)('open_kyc_case (WhatsApp) — garde LAB plein sur le chemin service-role', () => {
  let svc: SupabaseClient
  let setup: TwoAgenciesSetup
  /** Agence A : reste au défaut (verification_status='pending', jamais soumise)
   *  jusqu'aux tests de statut, placés en fin de fichier. */
  let ctxA: ActionCtx
  /** Agence B : promue 'auto_validated' au setup, représente le cas passant. */
  let ctxB: ActionCtx
  /** Un contact par (agence × étage) : prepareOpenKycCase refuse un contact qui a
   *  déjà un dossier ouvert (dédup anti-doublon MLRO), donc réutiliser les contacts
   *  de l'étage execute ferait échouer les tests de préparation pour une raison
   *  étrangère au garde. */
  let contactAId: string
  let contactBId: string
  let prepContactAId: string
  let prepContactBId: string
  const contactIds: string[] = []
  const caseIds: string[] = []

  /** Dossiers KYC réellement présents en base pour ce contact (lecture service-role,
   *  hors RLS) — l'assertion qui compte : le garde empêche l'INSERT, pas seulement
   *  l'affichage d'un message. */
  const casesFor = async (contactId: string): Promise<string[]> => {
    const { data } = await svc.from('kyc_cases').select('id').eq('contact_id', contactId)
    return (data ?? []).map((r) => r.id as string)
  }

  const mkContact = async (agencyId: string, tag: string): Promise<string> => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'KYB', last_name: `${tag}-${setup.stamp}`,
      type: 'buyer', entity_type: 'pp', source: 'manual',
    }).select('id').single()
    if (error) throw new Error(`contact ${tag}: ${error.message}`)
    contactIds.push(data.id as string)
    return data.id as string
  }

  beforeAll(async () => {
    svc = serviceRoleClient()
    setup = await setupTwoAgencies()
    contactAId = await mkContact(setup.agencyAId, 'exec-blocked')
    contactBId = await mkContact(setup.agencyBId, 'exec-cleared')
    prepContactAId = await mkContact(setup.agencyAId, 'prep-blocked')
    prepContactBId = await mkContact(setup.agencyBId, 'prep-cleared')

    const { error: promoteErr } = await svc
      .from('agencies')
      .update({ identity_submitted_at: new Date().toISOString(), verification_status: 'auto_validated' })
      .eq('id', setup.agencyBId)
    if (promoteErr) throw new Error(`promote agencyB: ${promoteErr.message}`)

    ctxA = { supabase: svc, profileId: setup.agentAId, agencyId: setup.agencyAId, lang: 'fr' }
    ctxB = { supabase: svc, profileId: setup.agentBId, agencyId: setup.agencyBId, lang: 'fr' }
  })

  afterAll(async () => {
    // Best-effort : trg_enforce_kyc_cases_retention refuse la suppression d'un
    // dossier KYC (LBA art. 7 al. 3) hors super_admin — les lignes créées peuvent
    // donc survivre au nettoyage, comme dans kyc-cases-insert-lab-guard.spec.ts.
    for (const id of caseIds) await svc.from('kyc_cases').delete().eq('id', id).then(() => {}, () => {})
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds).then(() => {}, () => {})
    await setup?.cleanup()
  })

  // ── executeOpenKycCase — l'INSERT service-role, le seul vrai rempart ────────

  it('agence non vérifiée (défaut, jamais soumise) — aucun dossier KYC créé', async () => {
    const msg = await executeOpenKycCase(ctxA, { contact_id: contactAId, type: 'buyer_pp', vigilance: 'standard' })
    expect(msg, "l'agent doit apprendre POURQUOI, pas juste que ça a échoué").toMatch(LAB_REFUSAL)
    expect(
      await casesFor(contactAId),
      'une agence non vérifiée ne doit jamais pouvoir ouvrir un dossier KYC, même par WhatsApp',
    ).toEqual([])
  })

  it('agence non vérifiée — refus AVANT toute résolution métier (contact inexistant : c’est quand même le garde qui répond)', async () => {
    // Même posture que le garde des edge functions : une agence bloquée n'a pas à
    // apprendre si la ressource visée existe. Si le message parlait du contact,
    // c'est que contactInAgency aurait tourné avant le garde.
    const msg = await executeOpenKycCase(ctxA, {
      contact_id: '00000000-0000-0000-0000-000000000000', type: 'buyer_pp', vigilance: 'standard',
    })
    expect(msg).toMatch(LAB_REFUSAL)
    expect(msg, 'ne doit rien révéler sur l’existence du contact visé').not.toMatch(/contact/i)
  })

  it('agence vérifiée (auto_validated) — le dossier est bien créé', async () => {
    const msg = await executeOpenKycCase(ctxB, { contact_id: contactBId, type: 'buyer_pp', vigilance: 'standard' })
    expect(msg, `une agence vérifiée doit pouvoir ouvrir un dossier: ${msg}`).not.toMatch(LAB_REFUSAL)
    const ids = await casesFor(contactBId)
    expect(ids.length, 'le dossier doit exister en base').toBe(1)
    caseIds.push(...ids)
  })

  // ── prepareOpenKycCase — ne propose même pas la confirmation ────────────────

  it('agence non vérifiée — la confirmation n’est même pas proposée', async () => {
    const p = await prepareOpenKycCase(ctxA, { contact_id: prepContactAId })
    expect(p.ok, 'aucune carte de confirmation ne doit être armée pour une action vouée au refus').toBe(false)
    if (!p.ok) expect(p.error).toMatch(LAB_REFUSAL)
  })

  it('agence vérifiée — la confirmation est proposée normalement', async () => {
    const p = await prepareOpenKycCase(ctxB, { contact_id: prepContactBId })
    expect(p.ok, 'le garde ne doit rien changer pour une agence vérifiée').toBe(true)
    if (p.ok) expect(p.prompt).toMatch(/KYC/i)
  })

  // ── Fail-closed et liste blanche ───────────────────────────────────────────

  it('agence introuvable (lecture en échec) — refus, fail-closed', async () => {
    // requireAgencyLabCleared traite une lecture impossible comme une absence de
    // preuve, jamais comme un laissez-passer : on ne SAIT pas si l'agence est
    // cleared, donc on refuse.
    const ghost: ActionCtx = { ...ctxA, agencyId: '00000000-0000-0000-0000-000000000000' }
    const msg = await executeOpenKycCase(ghost, { contact_id: contactAId, type: 'buyer_pp', vigilance: 'standard' })
    expect(msg).toMatch(LAB_REFUSAL)
    expect(await casesFor(contactAId)).toEqual([])
  })

  // Ces tests-ci font évoluer le statut de l'agence A : placés APRÈS ceux qui
  // dépendent de son défaut 'pending' (exécution séquentielle du fichier,
  // fileParallelism: false — vitest.backend.config.ts).

  it.each(['manual_review', 'rejected'])(
    'statut intermédiaire %s — toujours refusé (liste blanche, jamais liste noire)',
    async (status) => {
      const { error } = await svc.from('agencies').update({ verification_status: status }).eq('id', setup.agencyAId)
      expect(error, `poser verification_status=${status} sur agencyA`).toBeNull()

      const msg = await executeOpenKycCase(ctxA, { contact_id: contactAId, type: 'buyer_pp', vigilance: 'standard' })
      expect(msg, `verification_status='${status}' ne doit jamais suffire à débloquer l'ouverture d'un dossier`).toMatch(LAB_REFUSAL)
      expect(await casesFor(contactAId)).toEqual([])
    },
  )

  it("'validated' (décision humaine, pas seulement auto_validated) — le dossier est créé", async () => {
    const { error } = await svc.from('agencies').update({ verification_status: 'validated' }).eq('id', setup.agencyAId)
    expect(error).toBeNull()

    const msg = await executeOpenKycCase(ctxA, { contact_id: contactAId, type: 'buyer_pp', vigilance: 'standard' })
    expect(msg, `'validated' doit débloquer au même titre que 'auto_validated': ${msg}`).not.toMatch(LAB_REFUSAL)
    const ids = await casesFor(contactAId)
    expect(ids.length).toBe(1)
    caseIds.push(...ids)
  })
})
