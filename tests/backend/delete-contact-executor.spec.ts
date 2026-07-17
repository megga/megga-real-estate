// Couverture LIVE de l'exécuteur destructif executeDeleteContact (outil delete_contact).
// Épingle les invariants critiques que la revue avait relevés comme non testés :
//   1. Suppression heureuse d'un contact de SON agence (fiche disparaît).
//   2. GARDE cross-tenant : le filtre .eq('agency_id') est le SEUL rempart (les exécuteurs
//      tournent en service-role, hors RLS) → une agence ne peut PAS supprimer le contact
//      d'une autre.
//   3. RÉTENTION : une transaction liée SURVIT à la suppression, contact_buyer_id passé à
//      NULL (FK ON DELETE SET NULL) — c'est ce que promet le message « transactions conservées ».
//      (Le pendant kyc_cases est de la même classe SET NULL ; on ne l'exerce pas avec un
//      fixture live car le trigger enforce_kyc_cases_retention interdit d'en nettoyer un —
//      preuve, au passage, que la rétention KYC est verrouillée en base.)
//   4. BLOCAGE 23503 : un contact rattaché à un dossier vendeur (FK NO ACTION) n'est PAS
//      supprimé → message humain, la fiche subsiste.
//   5. Échec DÉFINITIF (contact absent) → ok:false + retryable:false (le copilote ne réarme
//      pas la carte HITL).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : exécuté contre un Supabase local seedé (comme
// whatsapp-matches-enrich.spec.ts, l'autre test qui importe réellement les exécuteurs).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { executeDeleteContact, type ActionCtx } from '../../supabase/functions/_shared/whatsapp-actions'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('executeDeleteContact (live) — garde agence, rétention SET NULL, blocage 23503', () => {
  let svc: SupabaseClient
  let setup: TwoAgenciesSetup
  let ctxA: ActionCtx
  const contactIds: string[] = []
  const txIds: string[] = []
  const sellerLeadIds: string[] = []

  const mkContact = async (agencyId: string, tag: string): Promise<string> => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'DEL', last_name: `${tag}-${setup.stamp}`, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contact ${tag}: ${error.message}`)
    contactIds.push(data.id as string)
    return data.id as string
  }

  beforeAll(async () => {
    svc = serviceRoleClient()
    setup = await setupTwoAgencies()
    // via:'web' pour l'audit ; profileId n'entre QUE dans la metadata d'audit (jamais le scope).
    ctxA = { supabase: svc, profileId: setup.agentAId, agencyId: setup.agencyAId, lang: 'fr', via: 'web' }
  })

  afterAll(async () => {
    // Enfants d'abord (FK), puis contacts, puis users/agences. Les contacts déjà supprimés
    // par les tests → delete no-op. Les activity_events d'audit restent (trail append-only).
    if (sellerLeadIds.length) await svc.from('seller_leads').delete().in('id', sellerLeadIds)
    if (txIds.length) await svc.from('transactions').delete().in('id', txIds)
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds)
    await setup?.cleanup()
  })

  it('supprime un contact simple de son agence (ok:true, la fiche disparaît)', async () => {
    const c = await mkContact(setup.agencyAId, 'simple')
    const res = await executeDeleteContact(ctxA, { contact_id: c })
    expect(res.ok).toBe(true)
    const { data } = await svc.from('contacts').select('id').eq('id', c).maybeSingle()
    expect(data).toBeNull()
  })

  it('REFUSE de supprimer un contact d’une AUTRE agence (garde cross-tenant, service-role hors RLS)', async () => {
    const cB = await mkContact(setup.agencyBId, 'crosstenant')
    const res = await executeDeleteContact(ctxA, { contact_id: cB }) // ctx agence A vise un contact agence B
    expect(res.ok).toBe(false)
    expect(res.retryable).toBe(false)
    const { data } = await svc.from('contacts').select('id').eq('id', cB).maybeSingle()
    expect(data?.id).toBe(cB) // le contact de B est INTACT
  })

  it('RÉTENTION : une transaction liée survit à la suppression, contact_buyer_id → NULL (FK SET NULL)', async () => {
    const c = await mkContact(setup.agencyAId, 'retention')
    const { data: tx, error } = await svc.from('transactions').insert({
      agency_id: setup.agencyAId, contact_buyer_id: c, stage: 'offer', status: 'active',
    }).select('id').single()
    if (error) throw new Error(`tx: ${error.message}`)
    txIds.push(tx.id as string)

    const res = await executeDeleteContact(ctxA, { contact_id: c })
    expect(res.ok).toBe(true)

    const { data: after } = await svc.from('transactions').select('id, contact_buyer_id').eq('id', tx.id).maybeSingle()
    expect(after?.id).toBe(tx.id)          // conservée (rétention)
    expect(after?.contact_buyer_id).toBeNull() // mais déliée
  })

  it('BLOQUE (23503) si le contact est rattaché à un dossier vendeur (FK NO ACTION) — rien supprimé', async () => {
    const c = await mkContact(setup.agencyAId, 'blocked')
    const { data: sl, error } = await svc.from('seller_leads').insert({
      agency_id: setup.agencyAId, contact_id: c, contact_name: 'DEL blocked', contact_email: `del-${setup.stamp}@megga-test.local`,
    }).select('id').single()
    if (error) throw new Error(`seller_lead: ${error.message}`)
    sellerLeadIds.push(sl.id as string)

    const res = await executeDeleteContact(ctxA, { contact_id: c })
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/rattaché|conserver|détache/i) // message humain, pas un code brut
    const { data } = await svc.from('contacts').select('id').eq('id', c).maybeSingle()
    expect(data?.id).toBe(c) // la fiche subsiste
  })

  it('contact déjà supprimé / inexistant → ok:false, retryable:false (échec définitif)', async () => {
    const res = await executeDeleteContact(ctxA, { contact_id: '00000000-0000-0000-0000-000000000000' })
    expect(res.ok).toBe(false)
    expect(res.retryable).toBe(false)
  })
})
