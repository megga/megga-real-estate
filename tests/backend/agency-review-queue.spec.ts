// Backend test (live CI) — couche de donnees de la file de revue KYB (etape 5,
// tache 1 — migration 20260728160000_agency_review_queue.sql).
//
// Deux fonctions testees, toutes deux reservees au super-admin (patron P3 : EXECUTE
// authenticated, garde interne is_super_admin()) :
//   - get_admin_agency_review_queue()           — la liste des dossiers a trancher.
//   - get_admin_agency_review_detail(agency_id) — le detail check par check.
//
// Contexte (docs/agency-kyb-handoff.md §7bis, docs/superpowers/plans/
// 2026-07-28-onboarding-kyb-etape-5.md) : aucune agence ne peut etre auto-validee
// aujourd'hui — la revue humaine est l'UNIQUE voie. Cette file est donc le seul
// moyen pour un dossier soumis d'aboutir.
//
// Aucun de ces tests n'appelle recompute_agency_verification() ni
// submit_agency_identity() : les fixtures ecrivent directement les colonnes de
// verification via le service_role (comme agency-kyb-verification.spec.ts, cf. son
// test « verification_status accepte "validated" »). Consequence directe : aucune
// des agences de ce fichier ne declenche l'ecriture activity_events append-only qui
// rend certaines agences indeletables ailleurs (agency-verification-engine.spec.ts,
// cf. sa note en tete de fichier) — le nettoyage ci-dessous peut donc rester simple.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local
// seede et DOIVENT reellement passer.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'
const DENIED = '42501'

/** PostgREST peut renvoyer un `numeric` en JSON number ou en texte selon la colonne. */
const num = (x: unknown): number | null => (x === null || x === undefined ? null : Number(x))

interface QueueRow {
  agency_id: string
  agency_name: string
  country: string | null
  verification_status: string
  verification_score: number | string | null
  identity_submitted_at: string | null
  verification_sweep_attempts: number
}

interface DetailRow {
  check_id: string
  related_person_id: string | null
  check_type: string
  source: string
  result: string
  raw_response: Record<string, unknown> | null
  checked_at: string
  applicable_weight: number | string | null
  is_veto: boolean
}

describe.skipIf(!HAS_KEYS)('file de revue KYB — couche de donnees (etape 5, tache 1)', () => {
  const agencyIds: string[] = []
  const userIds: string[] = []
  let superAdmin: SupabaseClient
  let ordinaryUser: SupabaseClient

  beforeAll(async () => {
    const svc = serviceRoleClient()

    // Allowlist super-admin (migration 20260705160000) : domaine @megga-test.local,
    // idempotent, jamais nettoye (partage entre fichiers de specs — meme motif que
    // tests/backend/helpers/two-agencies.ts).
    const { error: cfgErr } = await svc
      .from('app_config')
      .upsert({ key: 'super_admin_test_domain', value: '@megga-test.local' }, { onConflict: 'key' })
    if (cfgErr) throw new Error(`app_config super_admin_test_domain: ${cfgErr.message}`)

    superAdmin = await createSuperAdminUser()
    ordinaryUser = await createOrdinaryUser()
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of agencyIds) {
      await svc.from('agencies').delete().eq('id', id).then(() => {}, () => {})
    }
    for (const id of userIds) {
      await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
    }
  })

  async function createOrdinaryUser(): Promise<SupabaseClient> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `review-queue-agent-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Testeur ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser agent: ${error.message}`)
    userIds.push(data.user!.id)
    const client = anonClient()
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PW })
    if (signInErr) throw new Error(`signin agent: ${signInErr.message}`)
    return client
  }

  // role super_admin non attribuable via user_metadata (a raison) -> upsert manuel
  // par le service_role, meme motif que agency-kyb-verification.spec.ts (mkUser).
  async function createSuperAdminUser(): Promise<SupabaseClient> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `review-queue-super-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Super ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser super_admin: ${error.message}`)
    const id = data.user!.id
    userIds.push(id)
    const { error: pErr } = await svc
      .from('profiles')
      .upsert({ id, email, full_name: `Super ${stamp}`, role: 'super_admin', agency_id: null }, { onConflict: 'id' })
    if (pErr) throw new Error(`profile super_admin: ${pErr.message}`)
    const client = anonClient()
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PW })
    if (signInErr) throw new Error(`signin super_admin: ${signInErr.message}`)
    return client
  }

  async function createAgency(label: string): Promise<string> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${label}`
    const { data, error } = await svc
      .from('agencies')
      .insert({ name: `Agence Revue ${stamp}`, slug: `agence-revue-${stamp}`, country: 'FR' })
      .select('id')
      .single()
    if (error) throw new Error(`agency: ${error.message}`)
    agencyIds.push(data!.id as string)
    return data!.id as string
  }

  /** Ecrit directement les colonnes de verification (service_role) — jamais via le
   *  moteur : voir la note en tete de fichier sur le nettoyage. */
  async function setVerification(
    agencyId: string,
    fields: { status: string; score?: number | null; submittedAt?: string; sweepAttempts?: number }
  ): Promise<void> {
    const svc = serviceRoleClient()
    const row: Record<string, unknown> = { verification_status: fields.status }
    if (fields.score !== undefined) row.verification_score = fields.score
    if (fields.submittedAt !== undefined) row.identity_submitted_at = fields.submittedAt
    if (fields.sweepAttempts !== undefined) row.verification_sweep_attempts = fields.sweepAttempts
    const { error } = await svc.from('agencies').update(row).eq('id', agencyId)
    if (error) throw new Error(`set verification: ${error.message}`)
  }

  // ─── get_admin_agency_review_queue ─────────────────────────────────────────
  describe('get_admin_agency_review_queue', () => {
    it('un super-admin voit la file, avec les colonnes attendues', async () => {
      const agencyId = await createAgency('visible')
      await setVerification(agencyId, {
        status: 'manual_review', score: 0.42, sweepAttempts: 0,
        submittedAt: new Date().toISOString(),
      })

      const { data, error } = await superAdmin.rpc('get_admin_agency_review_queue', {})
      expect(error, `rpc: ${error?.message}`).toBeNull()
      const row = (data as QueueRow[] | null)?.find((r) => r.agency_id === agencyId)
      expect(row, 'le dossier manual_review doit figurer dans la file').toBeTruthy()
      expect(row!.verification_status).toBe('manual_review')
      expect(num(row!.verification_score)).toBeCloseTo(0.42, 2)
      expect(row!.country).toBe('FR')
      expect(row!.agency_name).toContain('Agence Revue')
      expect(row!.identity_submitted_at).not.toBeNull()
      expect(row!.verification_sweep_attempts).toBe(0)
    })

    it('est refusee a un utilisateur authentifie ordinaire', async () => {
      const { data, error } = await ordinaryUser.rpc('get_admin_agency_review_queue', {})
      expect(error?.code, `attendu ${DENIED}, recu ${error?.code}`).toBe(DENIED)
      expect(data).toBeNull()
    })

    it('est refusee a anon', async () => {
      const { data, error } = await anonClient().rpc('get_admin_agency_review_queue', {})
      expect(error?.code, `attendu ${DENIED}, recu ${error?.code}`).toBe(DENIED)
      expect(data).toBeNull()
    })

    it('exclut les dossiers deja tranches ou jamais soumis (pending/auto_validated/validated/rejected)', async () => {
      const pending = await createAgency('pending')
      await setVerification(pending, { status: 'pending' })

      const autoValidated = await createAgency('auto-validated')
      await setVerification(autoValidated, {
        status: 'auto_validated', score: 0.95, submittedAt: new Date().toISOString(),
      })

      const validated = await createAgency('validated')
      await setVerification(validated, {
        status: 'validated', score: 0.3, submittedAt: new Date().toISOString(),
      })

      const rejected = await createAgency('rejected')
      await setVerification(rejected, {
        status: 'rejected', score: 0.1, submittedAt: new Date().toISOString(),
      })

      const { data, error } = await superAdmin.rpc('get_admin_agency_review_queue', {})
      expect(error, `rpc: ${error?.message}`).toBeNull()
      const ids = new Set((data as QueueRow[] | null)?.map((r) => r.agency_id))
      for (const excluded of [pending, autoValidated, validated, rejected]) {
        expect(ids.has(excluded), `${excluded} ne doit pas figurer dans la file`).toBe(false)
      }
    })

    it('trie par score croissant (les plus douteux en tete) et place un dossier sans score en tete', async () => {
      const high = await createAgency('score-high')
      await setVerification(high, { status: 'manual_review', score: 0.75, submittedAt: new Date().toISOString() })

      const low = await createAgency('score-low')
      await setVerification(low, { status: 'manual_review', score: 0.2, submittedAt: new Date().toISOString() })

      const mid = await createAgency('score-mid')
      await setVerification(mid, { status: 'manual_review', score: 0.5, submittedAt: new Date().toISOString() })

      // Score jamais calcule (pas de `score` passe -> reste NULL, comme une agence
      // neuve ou un dossier que le moteur n'a jamais traite).
      const unscored = await createAgency('score-null')
      await setVerification(unscored, { status: 'manual_review', submittedAt: new Date().toISOString() })

      const { data, error } = await superAdmin.rpc('get_admin_agency_review_queue', {})
      expect(error, `rpc: ${error?.message}`).toBeNull()
      const mine = new Set([high, low, mid, unscored])
      const ordered = (data as QueueRow[] | null)?.filter((r) => mine.has(r.agency_id)).map((r) => r.agency_id)
      expect(
        ordered,
        'ordre attendu : NULL (le plus opaque) puis les scores connus, du plus bas au plus haut'
      ).toEqual([unscored, low, mid, high])
    })

    it('fait remonter un dossier abandonne par le filet de rattrapage (tentatives epuisees)', async () => {
      // Reproduit exactement l'etat laisse par sweep_pending_agency_verifications()
      // une fois v_max_attempts atteint (20260728150000) : verification_status
      // bascule 'manual_review', verification_score reste NULL (le moteur n'a
      // jamais abouti), verification_sweep_attempts porte le compteur.
      const abandoned = await createAgency('sweep-exhausted')
      await setVerification(abandoned, {
        status: 'manual_review',
        sweepAttempts: 5,
        submittedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      })

      const { data, error } = await superAdmin.rpc('get_admin_agency_review_queue', {})
      expect(error, `rpc: ${error?.message}`).toBeNull()
      const row = (data as QueueRow[] | null)?.find((r) => r.agency_id === abandoned)
      expect(row, 'un dossier abandonne par le filet doit rester visible dans la file').toBeTruthy()
      expect(row!.verification_sweep_attempts).toBe(5)
      expect(row!.verification_score).toBeNull()
      expect(row!.verification_status).toBe('manual_review')
    })
  })

  // ─── get_admin_agency_review_detail ─────────────────────────────────────────
  describe('get_admin_agency_review_detail', () => {
    it('expose type, source, resultat et reponse brute — checks entite (veto) et personne (signal), sans exiger de role', async () => {
      const agencyId = await createAgency('detail-fields')
      const svc = serviceRoleClient()

      const { data: person, error: pErr } = await svc
        .from('agency_related_persons')
        .insert({ agency_id: agencyId, first_name: 'Jean', last_name: 'SansRole' })
        .select('id')
        .single()
      if (pErr) throw new Error(`related_person: ${pErr.message}`)

      const rawAgency = { source_ref: 'zefix-test-001', status: 'active' }
      const { error: avcErr } = await svc.from('agency_verification_checks').insert({
        agency_id: agencyId, check_type: 'registry_lookup', source: 'zefix', result: 'mismatch', raw_response: rawAgency,
      })
      if (avcErr) throw new Error(`agency check: ${avcErr.message}`)

      const rawPerson = { document: 'poa.pdf', reviewer_note: 'ok' }
      const { error: apvcErr } = await svc.from('agency_person_verification_checks').insert({
        related_person_id: person!.id, check_type: 'poa_document_review', source: 'manual', result: 'partial', raw_response: rawPerson,
      })
      if (apvcErr) throw new Error(`person check: ${apvcErr.message}`)

      const { data, error } = await superAdmin.rpc('get_admin_agency_review_detail', { p_agency_id: agencyId })
      expect(error, `rpc: ${error?.message}`).toBeNull()
      const rows = (data ?? []) as DetailRow[]
      expect(rows.length).toBe(2)

      const agencyRow = rows.find((r) => r.check_type === 'registry_lookup')
      expect(agencyRow, 'check entite absent du detail').toBeTruthy()
      expect(agencyRow!.source).toBe('zefix')
      expect(agencyRow!.result).toBe('mismatch')
      expect(agencyRow!.raw_response).toEqual(rawAgency)
      expect(agencyRow!.related_person_id).toBeNull()
      expect(agencyRow!.is_veto, 'registry_lookup est un veto du catalogue courant').toBe(true)

      const personRow = rows.find((r) => r.check_type === 'poa_document_review')
      expect(personRow, 'check personne absent du detail').toBeTruthy()
      expect(personRow!.source).toBe('manual')
      expect(personRow!.result).toBe('partial')
      expect(personRow!.raw_response).toEqual(rawPerson)
      expect(personRow!.related_person_id).toBe(person!.id)
      expect(personRow!.is_veto, 'poa_document_review est un signal, pas un veto').toBe(false)
    })

    it('inclut le check d une personne UBO (non signataire) — vue d audit complete, pas restreinte au perimetre du moteur', async () => {
      const agencyId = await createAgency('detail-ubo')
      const svc = serviceRoleClient()

      const { data: ubo, error: pErr } = await svc
        .from('agency_related_persons')
        .insert({ agency_id: agencyId, first_name: 'Marie', last_name: 'Beneficiaire' })
        .select('id')
        .single()
      if (pErr) throw new Error(`ubo: ${pErr.message}`)

      const { error: rErr } = await svc
        .from('agency_person_roles')
        .insert({ related_person_id: ubo!.id, role: 'ubo', ownership_pct: 40 })
      if (rErr) throw new Error(`role ubo: ${rErr.message}`)

      const { error: cErr } = await svc.from('agency_person_verification_checks').insert({
        related_person_id: ubo!.id, check_type: 'signatory_registry_match', source: 'manual', result: 'mismatch',
      })
      if (cErr) throw new Error(`check ubo: ${cErr.message}`)

      const { data, error } = await superAdmin.rpc('get_admin_agency_review_detail', { p_agency_id: agencyId })
      expect(error, `rpc: ${error?.message}`).toBeNull()
      const rows = (data ?? []) as DetailRow[]
      expect(
        rows.some((r) => r.related_person_id === ubo!.id),
        'le check d un UBO (non signataire) doit rester visible dans le detail'
      ).toBe(true)
    })

    it('applique le poids en vigueur a la date du check, jamais le poids courant', async () => {
      const svc = serviceRoleClient()
      const CHECK_TYPE = 'domain_website_match' // inutilise ailleurs dans les specs backend

      const { data: currentRow, error: curErr } = await svc
        .from('verification_check_config')
        .select('id')
        .eq('check_type', CHECK_TYPE)
        .is('valid_to', null)
        .single()
      if (curErr) throw new Error(`config active ${CHECK_TYPE}: ${curErr.message}`)

      const now = Date.now()
      const farPast = new Date(now - 365 * 24 * 3600 * 1000).toISOString()
      const cutover = new Date(now + 3600 * 1000).toISOString() // dans le FUTUR
      const OLD_WEIGHT = 4
      const NEW_WEIGHT = 20

      let oldConfigId: string | null = null
      let newConfigId: string | null = null

      try {
        const { error: closeErr } = await svc
          .from('verification_check_config')
          .update({ valid_to: farPast })
          .eq('id', currentRow!.id)
        if (closeErr) throw new Error(`fermeture config: ${closeErr.message}`)

        const { data: oldRow, error: oldErr } = await svc
          .from('verification_check_config')
          .insert({ check_type: CHECK_TYPE, weight: OLD_WEIGHT, is_veto: false, valid_from: farPast, valid_to: cutover })
          .select('id')
          .single()
        if (oldErr) throw new Error(`insert ancienne config: ${oldErr.message}`)
        oldConfigId = oldRow!.id as string

        const { data: newRow, error: newErr } = await svc
          .from('verification_check_config')
          .insert({ check_type: CHECK_TYPE, weight: NEW_WEIGHT, is_veto: false, valid_from: cutover, valid_to: null })
          .select('id')
          .single()
        if (newErr) throw new Error(`insert nouvelle config: ${newErr.message}`)
        newConfigId = newRow!.id as string

        const agencyId = await createAgency('temporal-weight')
        // checked_at = maintenant, donc AVANT cutover (futur) -> tombe dans la
        // fenetre ANCIENNE [farPast, cutover) -> doit appliquer OLD_WEIGHT.
        const { error: chkErr } = await svc.from('agency_verification_checks').insert({
          agency_id: agencyId, check_type: CHECK_TYPE, source: 'manual', result: 'match',
        })
        if (chkErr) throw new Error(`check: ${chkErr.message}`)

        const { data, error } = await superAdmin.rpc('get_admin_agency_review_detail', { p_agency_id: agencyId })
        expect(error, `rpc: ${error?.message}`).toBeNull()
        const row = (data as DetailRow[] | null)?.find((r) => r.check_type === CHECK_TYPE)
        expect(row, 'check absent du detail').toBeTruthy()
        expect(num(row!.applicable_weight), 'doit refleter le bareme en vigueur au moment du check').toBeCloseTo(OLD_WEIGHT, 2)
        expect(num(row!.applicable_weight)).not.toBeCloseTo(NEW_WEIGHT, 2)
        expect(row!.is_veto).toBe(false)
      } finally {
        if (newConfigId) await svc.from('verification_check_config').delete().eq('id', newConfigId).then(() => {}, () => {})
        if (oldConfigId) await svc.from('verification_check_config').delete().eq('id', oldConfigId).then(() => {}, () => {})
        await svc.from('verification_check_config').update({ valid_to: null }).eq('id', currentRow!.id).then(() => {}, () => {})
      }
    })

    it('est refusee a un utilisateur authentifie ordinaire et a anon', async () => {
      const agencyId = await createAgency('detail-denied')

      const asOrdinary = await ordinaryUser.rpc('get_admin_agency_review_detail', { p_agency_id: agencyId })
      expect(asOrdinary.error?.code, `attendu ${DENIED}, recu ${asOrdinary.error?.code}`).toBe(DENIED)
      expect(asOrdinary.data).toBeNull()

      const asAnon = await anonClient().rpc('get_admin_agency_review_detail', { p_agency_id: agencyId })
      expect(asAnon.error?.code, `attendu ${DENIED}, recu ${asAnon.error?.code}`).toBe(DENIED)
      expect(asAnon.data).toBeNull()
    })
  })
})
