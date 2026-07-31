// Backend spec (live CI) — la boucle de remédiation (étape 7, tâche 5, migration
// 20260731150000_agency_correction_requested.sql).
//
// LE DÉFAUT QUE CETTE TÂCHE FERME. `admin_reject_agency_review` posait
// verification_status='rejected' sans toucher identity_submitted_at. Le gate d'onboarding ne
// lit QUE cette colonne, le moteur refuse d'écraser 'rejected', et aucune des quatre
// décisions humaines ne rouvrait un dossier : une agence rejetée par erreur, ou pour une
// faute de saisie corrigeable, était bloquée à vie sans chemin self-serve. Le seul recours
// était un UPDATE manuel en base, hors de toute piste d'audit prévue.
//
// CE QUE CE FICHIER PROUVE, ET DANS QUEL ORDRE :
//   1. la cinquième décision existe, elle est gardée comme les quatre autres ;
//   2. elle rouvre les DEUX choses qui tenaient à identity_submitted_at : le gate
//      d'onboarding et le gel des colonnes d'identité légale ;
//   3. le moteur n'écrase pas ce statut -- une décision humaine ne s'efface pas ;
//   4. et pourtant le dossier n'est PAS enfermé : une resoumission rend la main au moteur.
//      Les points 3 et 4 sont contradictoires si l'un des deux manque, et c'est le couple
//      qu'il faut tenir : sans 3 un recalcul effacerait la demande, sans 4 le dossier
//      resterait en correction_requested pour toujours.
//   5. `rejected` reste terminal, ce qui n'est cohérent QUE parce que la correction existe.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : lire le compte de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'
const DENIED = '42501'

describe.skipIf(!HAS_KEYS)('admin_request_agency_correction — la boucle de remédiation', () => {
  const agencyIds: string[] = []
  const userIds: string[] = []
  let superAdmin: SupabaseClient
  let ordinaryUser: SupabaseClient

  beforeAll(async () => {
    const svc = serviceRoleClient()
    const { error: cfgErr } = await svc
      .from('app_config')
      .upsert({ key: 'super_admin_test_domain', value: '@megga-test.local' }, { onConflict: 'key' })
    if (cfgErr) throw new Error(`app_config: ${cfgErr.message}`)
    superAdmin = await mkUser('super')
    ordinaryUser = await mkUser('agent')
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of agencyIds) await svc.from('agencies').delete().eq('id', id).then(() => {}, () => {})
    for (const id of userIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  async function mkUser(kind: 'super' | 'agent'): Promise<SupabaseClient> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `correction-${kind}-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Testeur ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser ${kind}: ${error.message}`)
    const id = data.user!.id
    userIds.push(id)
    if (kind === 'super') {
      const { error: pErr } = await svc
        .from('profiles')
        .upsert({ id, email, full_name: `Super ${stamp}`, role: 'super_admin', agency_id: null }, { onConflict: 'id' })
      if (pErr) throw new Error(`profile super: ${pErr.message}`)
    }
    const client = anonClient()
    const { error: sErr } = await client.auth.signInWithPassword({ email, password: PW })
    if (sErr) throw new Error(`signin ${kind}: ${sErr.message}`)
    return client
  }

  /** Un dossier soumis et en attente de revue : l'état dans lequel un relecteur le trouve. */
  async function createAgencyAwaitingReview(label: string): Promise<string> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${label}`
    const { data, error } = await svc
      .from('agencies')
      .insert({
        name: `Agence Correction ${stamp}`,
        slug: `agence-correction-${stamp}`,
        legal_name: `Correction Legale ${stamp}`,
        country: 'FR',
        identity_submitted_at: new Date().toISOString(),
        verification_status: 'manual_review',
        verification_score: 0.4,
      })
      .select('id')
      .single()
    if (error) throw new Error(`agency: ${error.message}`)
    agencyIds.push(data!.id as string)
    return data!.id as string
  }

  async function readAgency(agencyId: string) {
    const { data, error } = await serviceRoleClient()
      .from('agencies')
      .select('verification_status, identity_submitted_at, verified_at, verification_sweep_attempts')
      .eq('id', agencyId)
      .single()
    if (error) throw new Error(`read agency: ${error.message}`)
    return data
  }

  // ── 1. La cinquième décision, et ses gardes ───────────────────────────────────────

  it('renvoie le dossier au dirigeant : statut posé, horodatage de soumission effacé', async () => {
    const agencyId = await createAgencyAwaitingReview('happy')
    const { error } = await superAdmin.rpc('admin_request_agency_correction', {
      p_agency_id: agencyId, p_reason: 'Le numéro de registre comporte un chiffre de trop.',
    })
    expect(error, `rpc: ${error?.message}`).toBeNull()

    const agency = await readAgency(agencyId)
    expect(agency.verification_status).toBe('correction_requested')
    expect(
      agency.identity_submitted_at,
      'c\'est cette colonne qui rouvre le gate d\'onboarding ET dégèle l\'identité légale : ' +
      'un seul fait porte les deux'
    ).toBeNull()
    expect(agency.verified_at, 'un dossier renvoyé n\'est jamais « vérifié depuis »').toBeNull()
  })

  it('exige un motif — « corrigez » sans dire quoi ferait resoumettre à l\'identique', async () => {
    const agencyId = await createAgencyAwaitingReview('no-reason')
    for (const reason of ['', '   ', null]) {
      const { error } = await superAdmin.rpc('admin_request_agency_correction', {
        p_agency_id: agencyId, p_reason: reason,
      })
      expect(error, `motif ${JSON.stringify(reason)} doit être refusé`).not.toBeNull()
    }
    expect((await readAgency(agencyId)).verification_status).toBe('manual_review')
  })

  it('refuse un dossier qui n\'attend pas de revue (jamais soumis, ou déjà tranché)', async () => {
    const svc = serviceRoleClient()
    for (const status of ['pending', 'validated', 'auto_validated', 'rejected']) {
      const agencyId = await createAgencyAwaitingReview(`status-${status}`)
      await svc.from('agencies').update({ verification_status: status }).eq('id', agencyId)
      const { error } = await superAdmin.rpc('admin_request_agency_correction', {
        p_agency_id: agencyId, p_reason: 'Motif quelconque',
      })
      expect(
        error,
        `statut ${status} : rouvrir un dossier clos ou jamais soumis corromprait la piste d'audit`
      ).not.toBeNull()
    }
  })

  it('refuse un agent ordinaire et un visiteur anonyme', async () => {
    const agencyId = await createAgencyAwaitingReview('rbac')
    const asOrdinary = await ordinaryUser.rpc('admin_request_agency_correction', {
      p_agency_id: agencyId, p_reason: 'Motif',
    })
    expect(asOrdinary.error?.code).toBe(DENIED)
    const asAnon = await anonClient().rpc('admin_request_agency_correction', {
      p_agency_id: agencyId, p_reason: 'Motif',
    })
    expect(asAnon.error).not.toBeNull()
    expect((await readAgency(agencyId)).verification_status).toBe('manual_review')
  })

  it('journalise la demande avec son motif et le décideur', async () => {
    const agencyId = await createAgencyAwaitingReview('audit')
    const reason = 'La raison sociale déclarée est la traduction, pas celle du registre.'
    await superAdmin.rpc('admin_request_agency_correction', { p_agency_id: agencyId, p_reason: reason })

    const { data: auth } = await superAdmin.auth.getUser()
    const { data: events } = await serviceRoleClient()
      .from('activity_events')
      .select('action, category, severity, actor_kind, actor_id, metadata')
      .eq('agency_id', agencyId)
      .eq('action', 'agency_verification_correction_requested')
      .limit(1)
    expect(events?.length, 'une décision humaine sans trace n\'est pas une décision auditable').toBe(1)
    const ev = events![0]
    expect(ev.category).toBe('kyc')
    expect(ev.severity).toBe('warn')
    expect(ev.actor_kind).toBe('user')
    expect(ev.actor_id).toBe(auth.user!.id)
    const meta = ev.metadata as { reason?: string; previous_status?: string }
    expect(meta.reason, 'le motif doit être lisible par qui reprend le dossier').toBe(reason)
    expect(meta.previous_status).toBe('manual_review')
  })

  // ── 2. Le gel de l'identité légale se lève par le même fait ───────────────────────

  it('dégèle les colonnes d\'identité légale — la charnière avec la tâche 3', async () => {
    const svc = serviceRoleClient()
    const agencyId = await createAgencyAwaitingReview('unfreeze')

    // Un dirigeant de CETTE agence, pour éprouver le garde côté authenticated.
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `correction-founder-${stamp}@megga-test.local`
    const { data: created, error: cErr } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true, user_metadata: { full_name: 'Dirigeant', role: 'agent' },
    })
    if (cErr) throw new Error(`createUser founder: ${cErr.message}`)
    userIds.push(created.user!.id)
    await svc.from('profiles').upsert(
      { id: created.user!.id, email, full_name: 'Dirigeant', role: 'admin', agency_id: agencyId },
      { onConflict: 'id' }
    )
    const founder = anonClient()
    await founder.auth.signInWithPassword({ email, password: PW })

    // Dossier soumis : le garde de la tâche 3 doit refuser.
    const frozen = await founder
      .from('agencies').update({ legal_name: 'Avant Correction SA' }).eq('id', agencyId)
    expect(frozen.error?.code, 'l\'identité d\'un dossier soumis est gelée').toBe(DENIED)

    // Le relecteur demande une correction.
    const { error: reqErr } = await superAdmin.rpc('admin_request_agency_correction', {
      p_agency_id: agencyId, p_reason: 'Raison sociale à reprendre.',
    })
    expect(reqErr).toBeNull()

    // Et le dirigeant peut corriger, sans qu'aucun autre geste n'ait été nécessaire.
    const thawed = await founder
      .from('agencies').update({ legal_name: `Apres Correction SA ${stamp}` }).eq('id', agencyId)
    expect(
      thawed.error,
      'le gel et le gate tiennent tous deux à identity_submetted_at : la demande de correction ' +
      'les rouvre ensemble, ce qui est exactement l\'intention'
    ).toBeNull()
  })

  // ── 3 et 4. Le couple : le moteur n'écrase pas, mais le dossier n'est pas enfermé ──

  it('le moteur n\'écrase JAMAIS correction_requested — une décision humaine ne s\'efface pas', async () => {
    const agencyId = await createAgencyAwaitingReview('engine-respect')
    await superAdmin.rpc('admin_request_agency_correction', {
      p_agency_id: agencyId, p_reason: 'Motif',
    })

    const { error } = await serviceRoleClient().rpc('recompute_agency_verification', { p_agency_id: agencyId })
    expect(error, `recompute: ${error?.message}`).toBeNull()

    expect(
      (await readAgency(agencyId)).verification_status,
      'sans cette garde, un recalcul effacerait la demande du relecteur en silence'
    ).toBe('correction_requested')
  })

  it('une resoumission repasse le dossier en pending — sans quoi il serait enfermé à vie', async () => {
    const svc = serviceRoleClient()
    const agencyId = await createAgencyAwaitingReview('resubmit')

    // Le dossier doit être complet pour que submit_agency_identity accepte : forme juridique
    // et signataire actif, en plus de la raison sociale et du pays déjà posés.
    const { data: form } = await svc.from('legal_forms').select('id').eq('country', 'FR').limit(1).single()
    await svc.from('agencies').update({ legal_form_id: form!.id }).eq('id', agencyId)
    const { data: person } = await svc
      .from('agency_related_persons')
      .insert({ agency_id: agencyId, first_name: 'Jean', last_name: 'Signataire' })
      .select('id').single()
    await svc.from('agency_person_roles')
      .insert({ related_person_id: person!.id, role: 'signatory', signature_power: 'individual' })

    // Un dirigeant, seul autorisé à soumettre.
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `correction-resubmit-${stamp}@megga-test.local`
    const { data: created } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true, user_metadata: { full_name: 'Dirigeant', role: 'agent' },
    })
    userIds.push(created!.user!.id)
    await svc.from('profiles').upsert(
      { id: created!.user!.id, email, full_name: 'Dirigeant', role: 'admin', agency_id: agencyId },
      { onConflict: 'id' }
    )
    const founder = anonClient()
    await founder.auth.signInWithPassword({ email, password: PW })

    // Correction demandée, puis le compteur du filet est sali pour prouver qu'il est remis à 0.
    await superAdmin.rpc('admin_request_agency_correction', { p_agency_id: agencyId, p_reason: 'Motif' })
    await svc.from('agencies').update({ verification_sweep_attempts: 3 }).eq('id', agencyId)

    const { error: submitErr } = await founder.rpc('submit_agency_identity')
    expect(submitErr, `resoumission: ${submitErr?.message}`).toBeNull()

    const agency = await readAgency(agencyId)
    expect(
      agency.verification_status,
      'le moteur refuse d\'écraser correction_requested : si la resoumission ne rendait pas la ' +
      'main, le dossier resterait dans cet état pour toujours'
    ).toBe('pending')
    expect(agency.identity_submitted_at, 'la resoumission repose l\'horodatage').not.toBeNull()
    expect(
      agency.verification_sweep_attempts,
      'un dossier qui repart doit repartir avec un compteur neuf, sinon le filet le déclare ' +
      'épuisé avant même de l\'avoir retenté'
    ).toBe(0)
  })

  it('une soumission ordinaire ne touche pas un statut validated ni rejected', async () => {
    const svc = serviceRoleClient()
    for (const status of ['validated', 'rejected']) {
      const agencyId = await createAgencyAwaitingReview(`untouched-${status}`)
      const { data: form } = await svc.from('legal_forms').select('id').eq('country', 'FR').limit(1).single()
      await svc.from('agencies').update({ legal_form_id: form!.id }).eq('id', agencyId)
      const { data: person } = await svc
        .from('agency_related_persons')
        .insert({ agency_id: agencyId, first_name: 'Jean', last_name: 'Signataire' })
        .select('id').single()
      await svc.from('agency_person_roles')
        .insert({ related_person_id: person!.id, role: 'signatory', signature_power: 'individual' })
      // Dossier tranché ET jamais soumis, pour que submit ne sorte pas en retour anticipé.
      await svc.from('agencies')
        .update({ verification_status: status, identity_submitted_at: null })
        .eq('id', agencyId)

      const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
      const email = `correction-keep-${status}-${stamp}@megga-test.local`
      const { data: created } = await svc.auth.admin.createUser({
        email, password: PW, email_confirm: true, user_metadata: { full_name: 'Dirigeant', role: 'agent' },
      })
      userIds.push(created!.user!.id)
      await svc.from('profiles').upsert(
        { id: created!.user!.id, email, full_name: 'Dirigeant', role: 'admin', agency_id: agencyId },
        { onConflict: 'id' }
      )
      const founder = anonClient()
      await founder.auth.signInWithPassword({ email, password: PW })

      await founder.rpc('submit_agency_identity')
      expect(
        (await readAgency(agencyId)).verification_status,
        `seul correction_requested rend la main : ${status} ne doit pas redevenir pending ` +
        `parce qu'un dirigeant a rappelé la RPC`
      ).toBe(status)
    }
  })

  // ── 5. rejected reste terminal, et c'est cohérent parce que la correction existe ───

  it('rejected reste terminal — aucune des cinq décisions ne le défait', async () => {
    const agencyId = await createAgencyAwaitingReview('terminal')
    await superAdmin.rpc('admin_reject_agency_review', { p_agency_id: agencyId, p_reason: 'Faux documents' })
    expect((await readAgency(agencyId)).verification_status).toBe('rejected')

    const { error } = await superAdmin.rpc('admin_request_agency_correction', {
      p_agency_id: agencyId, p_reason: 'On se ravise',
    })
    expect(
      error,
      'un rejet qui peut se défaire n\'est plus un rejet : le relecteur qui veut laisser une ' +
      'chance demande une correction, celui qui rejette ferme le dossier'
    ).not.toBeNull()
    expect((await readAgency(agencyId)).verification_status).toBe('rejected')
  })

  it('la file de revue ne montre plus un dossier renvoyé — il n\'attend plus le relecteur', async () => {
    const agencyId = await createAgencyAwaitingReview('queue-out')
    await superAdmin.rpc('admin_request_agency_correction', { p_agency_id: agencyId, p_reason: 'Motif' })

    // Parcourt toute la file, page par page : la supposer tenue dans une réponse est
    // exactement l'hypothèse qui avait rendu la troncature à 1000 lignes invisible.
    const seen: string[] = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await superAdmin.rpc('get_admin_agency_review_queue', {
        p_limit: 1000, p_offset: offset,
      })
      if (error) throw new Error(`queue: ${error.message}`)
      const rows = (data ?? []) as { agency_id: string }[]
      seen.push(...rows.map((r) => r.agency_id))
      if (rows.length < 1000) break
    }
    expect(
      seen,
      'la file liste les dossiers en manual_review : un dossier renvoyé attend le dirigeant, ' +
      'pas le relecteur, et l\'y laisser ferait travailler deux fois sur un dossier sans matière'
    ).not.toContain(agencyId)
  })
})
