// Backend integration spec (live CI) — garde LAB plein sur l'INSERT de kyc_cases
// (revue étape 5/tâche 4, point 2 CRITIQUE — migration
// 20260728171000_kyc_cases_insert_lab_guard.sql).
//
// « Ouvrir un dossier KYC client » n'était gardé QUE côté navigateur (KycLabGuard.tsx
// bloque la route /dashboard/kyc) et côté edge function (kyc-screening, via
// supabase/functions/_shared/agency-lab-guard.ts) — jamais côté table. La policy
// kyc_cases_insert (baseline) ne vérifiait que l'isolation inter-agences
// (agency_id = get_my_agency_id()), rien sur l'état de vérification de l'agence.
//
// Vérifié en conditions réelles : un agent d'une agence jamais soumise crée un
// dossier KYC par appel PostgREST direct (src/hooks/useKycDossier.ts fait exactement
// cet INSERT ; contourner le routeur React suffit pour l'atteindre sans passer par
// KycLabGuard) — l'INSERT réussissait, le trigger seed_kyc_lba_checks semait ses
// vérifications LBA, activity_events journalisait l'ouverture. « Ouvrir un dossier
// KYC client » est précisément l'action que ce garde doit empêcher.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local
// seedé et DOIVENT réellement passer — lire le compte de tests, jamais le code de
// sortie (même convention que les autres specs étape 5).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('kyc_cases_insert — garde LAB plein côté table (revue étape 5/tâche 4, point 2)', () => {
  let setup: TwoAgenciesSetup
  /** contact de l'agence A (jamais soumise, verification_status='pending' par défaut). */
  let contactAId: string
  /** contact de l'agence B, promue 'auto_validated' juste après setup. */
  let contactBId: string
  const caseIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    const { data: contactA, error: contactAErr } = await svc
      .from('contacts')
      .insert({
        agency_id: setup.agencyAId, first_name: 'CL', last_name: `Guard A ${setup.stamp}`,
        entity_type: 'pp', type: 'buyer', source: 'manual',
      })
      .select('id')
      .single()
    if (contactAErr) throw new Error(`contact A: ${contactAErr.message}`)
    contactAId = contactA!.id as string

    const { data: contactB, error: contactBErr } = await svc
      .from('contacts')
      .insert({
        agency_id: setup.agencyBId, first_name: 'CL', last_name: `Guard B ${setup.stamp}`,
        entity_type: 'pp', type: 'buyer', source: 'manual',
      })
      .select('id')
      .single()
    if (contactBErr) throw new Error(`contact B: ${contactBErr.message}`)
    contactBId = contactB!.id as string

    // agencyB seule promue cleared — agencyA reste au défaut (pending, jamais soumise).
    const { error: promoteErr } = await svc
      .from('agencies')
      .update({ identity_submitted_at: new Date().toISOString(), verification_status: 'auto_validated' })
      .eq('id', setup.agencyBId)
    if (promoteErr) throw new Error(`promote agencyB: ${promoteErr.message}`)
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of caseIds) await svc.from('kyc_cases').delete().eq('id', id).then(() => {}, () => {})
    await svc.from('contacts').delete().eq('id', contactAId).then(() => {}, () => {})
    await svc.from('contacts').delete().eq('id', contactBId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('agence non vérifiée (défaut, jamais soumise) — INSERT direct refusé', async () => {
    const { data, error } = await setup.clientA
      .from('kyc_cases')
      .insert({ agency_id: setup.agencyAId, contact_id: contactAId, type: 'buyer_pp', vigilance: 'standard' })
      .select('id')
      .maybeSingle()
    expect(error, 'une agence non vérifiée ne doit jamais pouvoir ouvrir un dossier KYC').not.toBeNull()
    expect(data, 'aucune ligne ne doit être retournée').toBeNull()

    const { data: rows } = await serviceRoleClient()
      .from('kyc_cases')
      .select('id')
      .eq('agency_id', setup.agencyAId)
      .eq('contact_id', contactAId)
    expect(rows?.length ?? 0, 'aucun dossier ne doit avoir été créé malgré la tentative').toBe(0)
  })

  it('agence vérifiée (auto_validated) — INSERT direct accepté', async () => {
    const { data, error } = await setup.clientB
      .from('kyc_cases')
      .insert({ agency_id: setup.agencyBId, contact_id: contactBId, type: 'buyer_pp', vigilance: 'standard' })
      .select('id')
      .single()
    expect(error, `une agence vérifiée doit pouvoir ouvrir un dossier KYC: ${error?.message}`).toBeNull()
    expect(data?.id, 'la ligne créée doit être retournée').toBeTruthy()
    if (data?.id) caseIds.push(data.id as string)

    const { data: rows } = await serviceRoleClient()
      .from('kyc_cases')
      .select('id')
      .eq('agency_id', setup.agencyBId)
      .eq('contact_id', contactBId)
    expect(rows?.length ?? 0, 'le dossier doit exister en base').toBe(1)
  })

  // ── Points mineurs (revue) : statuts intermédiaires, jamais confondus avec cleared ──

  it.each(['manual_review', 'rejected'])(
    'agence au statut intermédiaire %s — INSERT direct toujours refusé (liste blanche, pas liste noire)',
    async (status) => {
      const svc = serviceRoleClient()
      const { error: setErr } = await svc.from('agencies').update({ verification_status: status }).eq('id', setup.agencyAId)
      expect(setErr).toBeNull()

      const { error } = await setup.clientA
        .from('kyc_cases')
        .insert({ agency_id: setup.agencyAId, contact_id: contactAId, type: 'buyer_pp', vigilance: 'standard' })
        .select('id')
        .maybeSingle()
      expect(error, `verification_status='${status}' ne doit jamais suffire à débloquer l'ouverture d'un dossier KYC`).not.toBeNull()
    }
  )

  it("agence 'validated' (décision humaine, pas seulement auto_validated) — INSERT direct accepté", async () => {
    const svc = serviceRoleClient()
    const { error: setErr } = await svc.from('agencies').update({ verification_status: 'validated' }).eq('id', setup.agencyAId)
    expect(setErr).toBeNull()

    const { data, error } = await setup.clientA
      .from('kyc_cases')
      .insert({ agency_id: setup.agencyAId, contact_id: contactAId, type: 'buyer_pp', vigilance: 'standard' })
      .select('id')
      .single()
    expect(error, `'validated' doit débloquer au même titre que 'auto_validated': ${error?.message}`).toBeNull()
    if (data?.id) caseIds.push(data.id as string)
  })
})
