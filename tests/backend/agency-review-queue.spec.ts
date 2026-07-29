// Backend test (live CI) — file de revue KYB (etape 5 : couche de donnees tache 1 +
// decision humaine tache 2 — migration 20260728160000_agency_review_queue.sql).
//
// Six fonctions testees, toutes reservees au super-admin :
//   - get_admin_agency_review_queue()           — la liste des dossiers a trancher.
//   - get_admin_agency_review_detail(agency_id) — le detail check par check.
//   - admin_validate_agency_review(agency_id)            — pose 'validated'.
//   - admin_reject_agency_review(agency_id, reason)      — pose 'rejected', motif obligatoire.
//   - admin_relaunch_agency_review(agency_id)            — declenche le moteur.
//   - admin_resolve_agency_id_document(agency_id, check_id, result) — tranche une piece d'identite.
// Les deux lectures suivent le patron P3 (EXECUTE authenticated, garde interne
// is_super_admin() OU is_service_role()) ; les quatre actions de la tache 2 (decision
// humaine) sont gardees par is_super_admin() SEUL — jamais is_service_role(), une
// decision humaine journalise auth.uid() comme decideur, un appel service_role n'a pas
// de session. Voir le commentaire d'arbitrage en tete de la section tache 2 de la
// migration pour le choix face a une Edge Function relais (action « relancer »).
//
// Contexte (docs/agency-kyb-handoff.md §7bis, docs/superpowers/plans/
// 2026-07-28-onboarding-kyb-etape-5.md) : aucune agence ne peut etre auto-validee
// aujourd'hui — la revue humaine est l'UNIQUE voie. Cette file est donc le seul
// moyen pour un dossier soumis d'aboutir.
//
// Les tests de la tache 1 (queue/detail) n'appellent ni recompute_agency_verification()
// ni submit_agency_identity() : leurs fixtures ecrivent directement les colonnes de
// verification via le service_role (comme agency-kyb-verification.spec.ts, cf. son
// test « verification_status accepte "validated" »). Les tests de la tache 2, EUX,
// appellent les RPC reelles (admin_validate/reject/relaunch/resolve), qui journalisent
// systematiquement un activity_events — append-only (trigger
// enforce_activity_events_immutability, LBA art. 7), ce qui rend l'agence indeletable
// par un DELETE ordinaire (ON DELETE SET NULL sur activity_events.agency_id percute le
// meme trigger), exactement la limite deja documentee par
// agency-verification-engine.spec.ts. Le afterAll ci-dessous rapporte donc nommement,
// comme ce fichier voisin, ce qu'il n'a pas pu supprimer plutot que de l'avaler en silence.
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
  /** Nombre TOTAL de dossiers en attente, repete sur chaque ligne (sous-requete scalaire) —
   *  la page seule ne dit pas combien il en reste derriere. `bigint` cote SQL, rendu en
   *  nombre ou en texte selon PostgREST, d'ou le passage par num(). */
  total_count: number | string
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

describe.skipIf(!HAS_KEYS)('file de revue KYB — donnees et decision humaine (etape 5, taches 1-2)', () => {
  const agencyIds: string[] = []
  const userIds: string[] = []
  let superAdmin: SupabaseClient
  let ordinaryUser: SupabaseClient
  let superAdminId: string

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

    // Identite du super-admin — necessaire pour verifier que la trace d'une decision
    // humaine (tache 2) porte bien le decideur (activity_events.actor_id).
    const { data: superAdminAuth, error: superAdminAuthErr } = await superAdmin.auth.getUser()
    if (superAdminAuthErr || !superAdminAuth.user) {
      throw new Error(`super admin getUser: ${superAdminAuthErr?.message}`)
    }
    superAdminId = superAdminAuth.user.id
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    // Best-effort HONNETE (voir la note en tete de fichier) : les tests de la tache 2
    // journalisent un activity_events reel (append-only, LBA art. 7) sur certaines de
    // ces agences, ce qui les rend indeletables par un DELETE ordinaire — meme motif
    // que agency-verification-engine.spec.ts. Chaque echec est collecte avec la raison
    // exacte plutot qu'avale en silence.
    const undeletable: { id: string; reason: string }[] = []
    for (const id of agencyIds) {
      const { error } = await svc.from('agencies').delete().eq('id', id)
      if (error) undeletable.push({ id, reason: `${error.code ?? '?'} ${error.message}` })
    }
    for (const id of userIds) {
      await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
    }
    if (undeletable.length > 0) {
      console.warn(
        `[agency-review-queue.spec.ts] ${undeletable.length}/${agencyIds.length} agence(s) de test ` +
        `non supprimee(s) -- activity_events est append-only (LBA art. 7) des qu'une decision humaine ` +
        `(tache 2 : valider/rejeter/relancer/resoudre) y a ecrit une ligne, meme limite structurelle que ` +
        `agency-verification-engine.spec.ts (cf. sa note en tete de fichier) :\n` +
        undeletable.map((u) => `  - ${u.id} : ${u.reason}`).join('\n')
      )
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

  /** Parcourt TOUTE la file, page par page, au lieu de supposer qu'elle tient dans une
   *  seule reponse -- l'hypothese exacte qui rendait la troncature invisible (cf. le
   *  describe « pagination de la file »). Les tests qui cherchent LEURS fixtures dans
   *  cette file PARTAGEE passent par ici : ni les dossiers laisses par un autre fichier
   *  de specs, ni le volume seede plus bas ne doivent pouvoir les faire echouer. */
  async function fetchWholeQueue(): Promise<QueueRow[]> {
    const PAGE = 1000 // = max_rows : la plus grande page que la RPC accepte de rendre
    const all: QueueRow[] = []
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await superAdmin.rpc('get_admin_agency_review_queue', {
        p_limit: PAGE, p_offset: offset,
      })
      if (error) throw new Error(`rpc queue: ${error.message}`)
      const rows = (data ?? []) as QueueRow[]
      all.push(...rows)
      const total = rows.length > 0 ? Number(rows[0]!.total_count) : all.length
      if (rows.length < PAGE || all.length >= total) return all
    }
  }

  /** Relit les colonnes de verification (service_role) — verifie l'effet d'une decision. */
  async function getAgencyVerification(agencyId: string): Promise<{
    verification_status: string
    verification_score: number | string | null
    verified_at: string | null
  }> {
    const svc = serviceRoleClient()
    const { data, error } = await svc
      .from('agencies')
      .select('verification_status, verification_score, verified_at')
      .eq('id', agencyId)
      .single()
    if (error) throw new Error(`get agency: ${error.message}`)
    return data as { verification_status: string; verification_score: number | string | null; verified_at: string | null }
  }

  interface EventRow {
    actor_id: string | null
    actor_kind: string
    action: string
    category: string
    severity: string
    entity_type: string
    entity_id: string | null
    object_label: string | null
    metadata: Record<string, unknown> | null
  }

  /** Dernier evenement d'une agence pour une `action` donnee (service_role, contourne RLS). */
  async function getLatestEvent(agencyId: string, action: string): Promise<EventRow | null> {
    const svc = serviceRoleClient()
    const { data, error } = await svc
      .from('activity_events')
      .select('actor_id, actor_kind, action, category, severity, entity_type, entity_id, object_label, metadata')
      .eq('agency_id', agencyId)
      .eq('action', action)
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) throw new Error(`activity_events: ${error.message}`)
    return (data?.[0] as EventRow | undefined) ?? null
  }

  /** Signataire actif (service_role) — sert les tests de resolution de piece d'identite. */
  async function createSignatory(agencyId: string): Promise<string> {
    const svc = serviceRoleClient()
    const { data, error } = await svc
      .from('agency_related_persons')
      .insert({ agency_id: agencyId, first_name: 'Jean', last_name: 'Signataire' })
      .select('id')
      .single()
    if (error) throw new Error(`related_person: ${error.message}`)
    const { error: rErr } = await svc
      .from('agency_person_roles')
      .insert({ related_person_id: data!.id, role: 'signatory', signature_power: 'individual' })
    if (rErr) throw new Error(`person_role: ${rErr.message}`)
    return data!.id as string
  }

  /** Pose un check id_document en attente de revue (service_role) — reproduit l'etat laisse
   *  par submit_agency_identity_id_document (20260728110000) sans rejouer tout le parcours. */
  async function insertPendingIdDocumentCheck(relatedPersonId: string): Promise<string> {
    const svc = serviceRoleClient()
    const { data, error } = await svc
      .from('agency_person_verification_checks')
      .insert({ related_person_id: relatedPersonId, check_type: 'id_document', source: 'manual', result: 'pending_manual_review' })
      .select('id')
      .single()
    if (error) throw new Error(`insert id_document check: ${error.message}`)
    return data!.id as string
  }

  // ─── get_admin_agency_review_queue ─────────────────────────────────────────
  describe('get_admin_agency_review_queue', () => {
    it('un super-admin voit la file, avec les colonnes attendues', async () => {
      const agencyId = await createAgency('visible')
      await setVerification(agencyId, {
        status: 'manual_review', score: 0.42, sweepAttempts: 0,
        submittedAt: new Date().toISOString(),
      })

      const row = (await fetchWholeQueue()).find((r) => r.agency_id === agencyId)
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

      const ids = new Set((await fetchWholeQueue()).map((r) => r.agency_id))
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

      const mine = new Set([high, low, mid, unscored])
      const ordered = (await fetchWholeQueue()).filter((r) => mine.has(r.agency_id)).map((r) => r.agency_id)
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

      const row = (await fetchWholeQueue()).find((r) => r.agency_id === abandoned)
      expect(row, 'un dossier abandonne par le filet doit rester visible dans la file').toBeTruthy()
      expect(row!.verification_sweep_attempts).toBe(5)
      expect(row!.verification_score).toBeNull()
      expect(row!.verification_status).toBe('manual_review')
    })
  })

  // ─── Pagination de la file (correctif revue etape 6) ────────────────────────
  //
  // Defaut corrige : la RPC ne portait AUCUN limit/offset. PostgREST tronque toute
  // reponse a max_rows (supabase/config.toml, [api] max_rows = 1000) -- en silence,
  // sans erreur ni indicateur. Passe 1000 agences en manual_review, la file se
  // coupait donc d'elle-meme, et comme le tri est `verification_score asc nulls
  // first`, la troncature emportait la QUEUE de la liste : les dossiers les MIEUX
  // notes devenaient invisibles et personne ne pouvait plus les trancher. Sur un
  // dispositif ou la revue humaine est l'UNIQUE voie de sortie (aucune agence ne
  // peut etre auto-validee, docs/agency-kyb-handoff.md §7bis), un dossier invisible
  // est un dossier bloque indefiniment.
  //
  // Reproduit en base avant correctif : 1448 agences en manual_review, la RPC rendait
  // exactement 1000 lignes, score le plus haut visible 0.652 pour un maximum reel de
  // 1.000 -- 448 dossiers hors d'atteinte.
  describe('pagination de la file', () => {
    // Volume > max_rows : le SEUL moyen de prouver qu'un dossier situe au-dela de la
    // borne PostgREST reste joignable. Insere et supprime en UNE requete (filtre sur
    // le prefixe de slug) plutot qu'en 1010 allers-retours ; ces agences ne recoivent
    // aucune decision humaine, donc aucun activity_events ne les rend indeletables
    // (contrairement aux fixtures de la tache 2, cf. la note du afterAll global).
    const VOLUME = 1010
    const volumePrefix = `agence-volume-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    // Score haut ET date identiques sur toutes les lignes de volume : elles se placent
    // donc en FIN de file (la ou la troncature frappait) et sont toutes a EGALITE sur
    // les deux cles de tri metier -- ce qui met aussi a l'epreuve le departage
    // deterministe sans lequel une pagination par offset saute ou repete des lignes.
    const VOLUME_SCORE = 0.99
    const VOLUME_SUBMITTED_AT = new Date('2026-07-28T12:00:00.000Z').toISOString()

    beforeAll(async () => {
      const svc = serviceRoleClient()
      const rows = Array.from({ length: VOLUME }, (_, i) => ({
        name: `Agence Volume ${i}`,
        slug: `${volumePrefix}-${i}`,
        country: 'CH',
        verification_status: 'manual_review',
        verification_score: VOLUME_SCORE,
        identity_submitted_at: VOLUME_SUBMITTED_AT,
      }))
      const { error } = await svc.from('agencies').insert(rows)
      if (error) throw new Error(`seed volume: ${error.message}`)
    })

    afterAll(async () => {
      const svc = serviceRoleClient()
      const { error } = await svc.from('agencies').delete().like('slug', `${volumePrefix}-%`)
      if (error) console.warn(`[agency-review-queue.spec.ts] purge volume: ${error.message}`)
    })

    /** Vrai nombre de dossiers en attente, lu hors RPC (service_role, contourne la
     *  garde) — l'etalon contre lequel total_count est confronte. */
    async function trueManualReviewCount(): Promise<number> {
      const svc = serviceRoleClient()
      const { count, error } = await svc
        .from('agencies')
        .select('id', { count: 'exact', head: true })
        .eq('verification_status', 'manual_review')
      if (error) throw new Error(`count manual_review: ${error.message}`)
      return count ?? 0
    }

    it('annonce le nombre TOTAL de dossiers en attente, pas la seule taille de la page', async () => {
      const { data, error } = await superAdmin.rpc('get_admin_agency_review_queue', {
        p_limit: 5, p_offset: 0,
      })
      expect(error, `rpc: ${error?.message}`).toBeNull()

      const rows = (data ?? []) as QueueRow[]
      expect(rows.length, 'la page doit etre bornee a p_limit').toBe(5)

      const total = num(rows[0]!.total_count)
      const expected = await trueManualReviewCount()
      expect(total, 'total_count doit compter TOUS les dossiers en attente, pas la page').toBe(expected)
      expect(total!, 'le volume seede doit depasser max_rows, sinon ce test ne prouve rien')
        .toBeGreaterThan(1000)
    })

    it('decale la fenetre avec p_offset, sans trou ni recouvrement', async () => {
      const first = await superAdmin.rpc('get_admin_agency_review_queue', { p_limit: 4, p_offset: 0 })
      expect(first.error, `rpc: ${first.error?.message}`).toBeNull()
      const second = await superAdmin.rpc('get_admin_agency_review_queue', { p_limit: 2, p_offset: 2 })
      expect(second.error, `rpc: ${second.error?.message}`).toBeNull()

      const firstIds = ((first.data ?? []) as QueueRow[]).map((r) => r.agency_id)
      const secondIds = ((second.data ?? []) as QueueRow[]).map((r) => r.agency_id)

      expect(firstIds).toHaveLength(4)
      expect(
        secondIds,
        'la page [offset 2, limit 2] doit reprendre EXACTEMENT les 3e et 4e lignes de la file'
      ).toEqual(firstIds.slice(2, 4))
    })

    // ─── Le defaut d'origine, reproduit ────────────────────────────────────────
    // Sans pagination, tout dossier au-dela du 1000e etait purement inatteignable :
    // la RPC ne proposait aucun moyen d'aller le chercher, et PostgREST coupait la
    // reponse sans le dire. Ce test echoue en rouge sur la version d'avant.
    it('rend joignable un dossier situe au-dela de max_rows (1000)', async () => {
      const total = await trueManualReviewCount()
      expect(total, 'pre-requis du test').toBeGreaterThan(1000)

      // La toute derniere ligne de la file : celle qu'un tri par score croissant
      // relegue le plus loin, donc la premiere sacrifiee par la troncature.
      const last = await superAdmin.rpc('get_admin_agency_review_queue', {
        p_limit: 1, p_offset: total - 1,
      })
      expect(last.error, `rpc: ${last.error?.message}`).toBeNull()
      const lastRows = (last.data ?? []) as QueueRow[]
      expect(lastRows, 'le dernier dossier de la file doit rester atteignable').toHaveLength(1)

      // Et il etait bien hors de portee avant : absent des 1000 premieres lignes,
      // seule fenetre que l'ancienne RPC savait rendre.
      const firstPage = await superAdmin.rpc('get_admin_agency_review_queue', {
        p_limit: 1000, p_offset: 0,
      })
      expect(firstPage.error, `rpc: ${firstPage.error?.message}`).toBeNull()
      const firstPageIds = new Set(((firstPage.data ?? []) as QueueRow[]).map((r) => r.agency_id))
      expect(
        firstPageIds.has(lastRows[0]!.agency_id),
        'ce dossier tombe hors des 1000 premieres lignes -- exactement ce que l ancienne RPC rendait invisible'
      ).toBe(false)
    })

    it('ne rend jamais plus de lignes que PostgREST ne peut en delivrer', async () => {
      // Un p_limit superieur a max_rows ramenerait la troncature silencieuse par la
      // fenetre : la RPC doit borner elle-meme, pour que « j'ai tout recu » reste vrai.
      const { data, error } = await superAdmin.rpc('get_admin_agency_review_queue', {
        p_limit: 5000, p_offset: 0,
      })
      expect(error, `rpc: ${error?.message}`).toBeNull()
      expect(
        ((data ?? []) as QueueRow[]).length,
        'la RPC doit plafonner a max_rows plutot que laisser PostgREST couper en silence'
      ).toBeLessThanOrEqual(1000)
    })

    it('garde un ordre deterministe a score et date identiques (pagination stable)', async () => {
      // Les 1010 lignes de volume partagent score ET date : sans departage explicite,
      // Postgres est libre de les rendre dans un ordre different a chaque appel, et une
      // pagination par offset se met alors a sauter ou repeter des dossiers -- le meme
      // defaut (un dossier qu'on ne voit jamais), en plus discret.
      const page = (offset: number) =>
        superAdmin.rpc('get_admin_agency_review_queue', { p_limit: 3, p_offset: offset })

      const total = await trueManualReviewCount()
      const deepOffset = total - 6 // au coeur du bloc a egalite parfaite

      const runA = await page(deepOffset)
      expect(runA.error, `rpc: ${runA.error?.message}`).toBeNull()
      const runB = await page(deepOffset)
      expect(runB.error, `rpc: ${runB.error?.message}`).toBeNull()

      const idsA = ((runA.data ?? []) as QueueRow[]).map((r) => r.agency_id)
      const idsB = ((runB.data ?? []) as QueueRow[]).map((r) => r.agency_id)
      expect(idsA, 'deux lectures de la meme fenetre doivent rendre les memes dossiers').toEqual(idsB)

      // Deux fenetres adjacentes ne doivent partager aucun dossier.
      const next = await page(deepOffset + 3)
      expect(next.error, `rpc: ${next.error?.message}`).toBeNull()
      const idsNext = ((next.data ?? []) as QueueRow[]).map((r) => r.agency_id)
      const overlap = idsA.filter((id) => idsNext.includes(id))
      expect(overlap, 'deux fenetres adjacentes ne doivent jamais se recouvrir').toEqual([])
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

  // ─── admin_validate_agency_review (tache 2) ─────────────────────────────────
  describe('admin_validate_agency_review', () => {
    it('un super-admin valide un dossier en manual_review -- pose validated, jamais auto_validated', async () => {
      const agencyId = await createAgency('validate-ok')
      await setVerification(agencyId, { status: 'manual_review', score: 0.6, submittedAt: new Date().toISOString() })

      const { error } = await superAdmin.rpc('admin_validate_agency_review', { p_agency_id: agencyId })
      expect(error, `rpc: ${error?.message}`).toBeNull()

      const agency = await getAgencyVerification(agencyId)
      expect(agency.verification_status, 'la decision humaine pose validated, jamais auto_validated').toBe('validated')
      expect(agency.verified_at, 'verified_at doit etre pose par la validation').not.toBeNull()
    })

    it('journalise la decision avec l identite du decideur', async () => {
      const agencyId = await createAgency('validate-trace')
      await setVerification(agencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })

      const { error } = await superAdmin.rpc('admin_validate_agency_review', { p_agency_id: agencyId })
      expect(error, `rpc: ${error?.message}`).toBeNull()

      const event = await getLatestEvent(agencyId, 'agency_verification_validated')
      expect(event, 'la decision doit etre journalisee dans activity_events').toBeTruthy()
      expect(event!.actor_kind, 'l acteur est un humain, jamais le moteur').toBe('user')
      expect(event!.actor_id, 'la trace doit porter l identite du decideur').toBe(superAdminId)
      expect(event!.category).toBe('kyc')
      expect(event!.severity).toBe('info')
      // Correctif revue point 4 : convention depot (object_label lisible, pas un id nu).
      expect(event!.object_label, 'object_label doit porter un libelle humain, pas rester vide').toContain('Agence Revue')
    })

    it('est refusee a un utilisateur authentifie ordinaire', async () => {
      const agencyId = await createAgency('validate-denied-user')
      await setVerification(agencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })

      const { error } = await ordinaryUser.rpc('admin_validate_agency_review', { p_agency_id: agencyId })
      expect(error?.code, `attendu ${DENIED}, recu ${error?.code}`).toBe(DENIED)

      const agency = await getAgencyVerification(agencyId)
      expect(agency.verification_status, 'un refus ne doit rien changer').toBe('manual_review')
    })

    it('est refusee a anon', async () => {
      const agencyId = await createAgency('validate-denied-anon')
      await setVerification(agencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })

      const { error } = await anonClient().rpc('admin_validate_agency_review', { p_agency_id: agencyId })
      expect(error?.code, `attendu ${DENIED}, recu ${error?.code}`).toBe(DENIED)
    })

    // Correctif revue point 2 : la garde est_super_admin() SEUL (jamais is_service_role())
    // n'etait verifiee par aucun test -- quatre lignes plus haut dans la migration, les
    // deux lectures (get_admin_agency_review_queue/detail) font l'inverse en accordant ce
    // role. Un copier-coller malheureux entre les deux sections retablirait l'auto-
    // validation par script (service_role n'a pas de session, auth.uid() y vaut NULL) avec
    // une suite entierement verte sans ce test.
    it('est refusee au role de service (un script ne doit jamais auto-valider une agence)', async () => {
      const agencyId = await createAgency('validate-denied-service-role')
      await setVerification(agencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })

      const { error } = await serviceRoleClient().rpc('admin_validate_agency_review', { p_agency_id: agencyId })
      expect(error?.code, `attendu ${DENIED}, recu ${error?.code}`).toBe(DENIED)

      const agency = await getAgencyVerification(agencyId)
      expect(agency.verification_status, 'un refus ne doit rien changer').toBe('manual_review')
    })

    it('refuse un dossier qui n est pas en manual_review', async () => {
      const agencyId = await createAgency('validate-wrong-status')
      await setVerification(agencyId, { status: 'pending' })

      const { error } = await superAdmin.rpc('admin_validate_agency_review', { p_agency_id: agencyId })
      expect(error, 'un dossier hors manual_review ne doit pas se laisser valider').not.toBeNull()

      const agency = await getAgencyVerification(agencyId)
      expect(agency.verification_status).toBe('pending')
    })
  })

  // ─── admin_reject_agency_review (tache 2) ───────────────────────────────────
  describe('admin_reject_agency_review', () => {
    it('un super-admin rejette un dossier en manual_review avec un motif', async () => {
      const agencyId = await createAgency('reject-ok')
      await setVerification(agencyId, { status: 'manual_review', score: 0.1, submittedAt: new Date().toISOString() })

      const { error } = await superAdmin.rpc('admin_reject_agency_review', {
        p_agency_id: agencyId, p_reason: 'Registre du commerce introuvable, raison sociale non concordante',
      })
      expect(error, `rpc: ${error?.message}`).toBeNull()

      const agency = await getAgencyVerification(agencyId)
      expect(agency.verification_status).toBe('rejected')
    })

    it('exige un motif -- refuse null', async () => {
      const agencyId = await createAgency('reject-no-reason-null')
      await setVerification(agencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })

      const { error } = await superAdmin.rpc('admin_reject_agency_review', { p_agency_id: agencyId, p_reason: null })
      expect(error, 'un rejet sans motif est irrecevable').not.toBeNull()

      const agency = await getAgencyVerification(agencyId)
      expect(agency.verification_status, 'le rejet refuse ne doit rien changer').toBe('manual_review')
    })

    it('exige un motif -- refuse une chaine vide ou blanche', async () => {
      const agencyId = await createAgency('reject-no-reason-blank')
      await setVerification(agencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })

      const blank = await superAdmin.rpc('admin_reject_agency_review', { p_agency_id: agencyId, p_reason: '   ' })
      expect(blank.error, 'une chaine blanche n est pas un motif').not.toBeNull()

      const empty = await superAdmin.rpc('admin_reject_agency_review', { p_agency_id: agencyId, p_reason: '' })
      expect(empty.error, 'une chaine vide n est pas un motif').not.toBeNull()
    })

    it('journalise le motif et l identite du decideur', async () => {
      const agencyId = await createAgency('reject-trace')
      await setVerification(agencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })
      const REASON = 'Signataire introuvable au registre'

      const { error } = await superAdmin.rpc('admin_reject_agency_review', { p_agency_id: agencyId, p_reason: REASON })
      expect(error, `rpc: ${error?.message}`).toBeNull()

      const event = await getLatestEvent(agencyId, 'agency_verification_rejected')
      expect(event, 'le rejet doit etre journalise').toBeTruthy()
      expect(event!.actor_kind).toBe('user')
      expect(event!.actor_id, 'la trace doit porter l identite du decideur').toBe(superAdminId)
      expect(event!.category).toBe('kyc')
      expect((event!.metadata as Record<string, unknown> | null)?.reason, 'le motif doit etre conserve pour l audit').toBe(REASON)
      expect(event!.object_label, 'object_label doit porter un libelle humain, pas rester vide').toContain('Agence Revue')
    })

    it('est refusee a un utilisateur authentifie ordinaire et a anon', async () => {
      const agencyId = await createAgency('reject-denied')
      await setVerification(agencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })

      const asOrdinary = await ordinaryUser.rpc('admin_reject_agency_review', { p_agency_id: agencyId, p_reason: 'motif' })
      expect(asOrdinary.error?.code, `attendu ${DENIED}, recu ${asOrdinary.error?.code}`).toBe(DENIED)

      const asAnon = await anonClient().rpc('admin_reject_agency_review', { p_agency_id: agencyId, p_reason: 'motif' })
      expect(asAnon.error?.code, `attendu ${DENIED}, recu ${asAnon.error?.code}`).toBe(DENIED)
    })

    // Correctif revue point 2 (voir la note jumelle sur admin_validate_agency_review).
    it('est refusee au role de service (un script ne doit jamais auto-rejeter une agence)', async () => {
      const agencyId = await createAgency('reject-denied-service-role')
      await setVerification(agencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })

      const { error } = await serviceRoleClient().rpc('admin_reject_agency_review', { p_agency_id: agencyId, p_reason: 'motif' })
      expect(error?.code, `attendu ${DENIED}, recu ${error?.code}`).toBe(DENIED)

      const agency = await getAgencyVerification(agencyId)
      expect(agency.verification_status, 'un refus ne doit rien changer').toBe('manual_review')
    })
  })

  // ─── admin_relaunch_agency_review (tache 2) ─────────────────────────────────
  describe('admin_relaunch_agency_review', () => {
    it('un super-admin relance le moteur -- declenche reellement recompute_agency_verification', async () => {
      const agencyId = await createAgency('relaunch-ok')
      // submittedAt requis (correctif revue point 1) : un dossier 'pending' mais SOUMIS
      // (net.http_post primaire jamais parti, cf. sweep_pending_agency_verifications) est
      // l'usage nominal de la relance -- distinct du dossier jamais soumis teste plus bas.
      await setVerification(agencyId, { status: 'pending', submittedAt: new Date().toISOString() })

      const before = await getLatestEvent(agencyId, 'agency_verification_recomputed')
      expect(before, 'aucun passage moteur avant la relance').toBeNull()

      const { error } = await superAdmin.rpc('admin_relaunch_agency_review', { p_agency_id: agencyId })
      expect(error, `rpc: ${error?.message}`).toBeNull()

      const engineEvent = await getLatestEvent(agencyId, 'agency_verification_recomputed')
      expect(engineEvent, 'la relance doit reellement appeler le moteur').toBeTruthy()
      expect(engineEvent!.actor_kind, 'cet evenement-ci est journalise par le moteur, pas par l humain').toBe('system')
      expect(engineEvent!.actor_id).toBeNull()
    })

    it('journalise la demande humaine de relance, distincte du passage du moteur', async () => {
      const agencyId = await createAgency('relaunch-trace')
      await setVerification(agencyId, { status: 'pending', submittedAt: new Date().toISOString() })

      const { error } = await superAdmin.rpc('admin_relaunch_agency_review', { p_agency_id: agencyId })
      expect(error, `rpc: ${error?.message}`).toBeNull()

      const humanEvent = await getLatestEvent(agencyId, 'agency_verification_relaunch_requested')
      expect(humanEvent, 'la demande de relance doit etre journalisee avec l identite du decideur').toBeTruthy()
      expect(humanEvent!.actor_kind).toBe('user')
      expect(humanEvent!.actor_id).toBe(superAdminId)
      expect(humanEvent!.category).toBe('kyc')
      expect(humanEvent!.object_label, 'object_label doit porter un libelle humain, pas rester vide').toContain('Agence Revue')
    })

    it('est refusee a un utilisateur authentifie ordinaire et a anon', async () => {
      const agencyId = await createAgency('relaunch-denied')
      await setVerification(agencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })

      const asOrdinary = await ordinaryUser.rpc('admin_relaunch_agency_review', { p_agency_id: agencyId })
      expect(asOrdinary.error?.code, `attendu ${DENIED}, recu ${asOrdinary.error?.code}`).toBe(DENIED)

      const asAnon = await anonClient().rpc('admin_relaunch_agency_review', { p_agency_id: agencyId })
      expect(asAnon.error?.code, `attendu ${DENIED}, recu ${asAnon.error?.code}`).toBe(DENIED)
    })

    it('le moteur relance apres une validation humaine ne l ecrase pas', async () => {
      const agencyId = await createAgency('relaunch-no-override-validated')
      await setVerification(agencyId, { status: 'manual_review', score: 0.9, submittedAt: new Date().toISOString() })

      const { error: validateErr } = await superAdmin.rpc('admin_validate_agency_review', { p_agency_id: agencyId })
      expect(validateErr, `validate: ${validateErr?.message}`).toBeNull()
      const validated = await getAgencyVerification(agencyId)
      expect(validated.verification_status).toBe('validated')

      const { error: relaunchErr } = await superAdmin.rpc('admin_relaunch_agency_review', { p_agency_id: agencyId })
      expect(relaunchErr, `relaunch: ${relaunchErr?.message}`).toBeNull()

      const afterRelaunch = await getAgencyVerification(agencyId)
      expect(afterRelaunch.verification_status, 'un verdict humain ne se retourne pas seul, meme relance').toBe('validated')
      expect(afterRelaunch.verified_at, 'verified_at pose par la validation humaine ne doit pas bouger').toBe(validated.verified_at)
      expect(num(afterRelaunch.verification_score)).toBeCloseTo(num(validated.verification_score) ?? -1, 3)

      const engineEvent = await getLatestEvent(agencyId, 'agency_verification_recomputed')
      expect(engineEvent, 'le moteur sort avant son propre insert -- aucun passage journalise sur un dossier deja tranche').toBeNull()
    })

    it('le moteur relance apres un rejet humain ne l ecrase pas non plus', async () => {
      const agencyId = await createAgency('relaunch-no-override-rejected')
      await setVerification(agencyId, { status: 'manual_review', score: 0.1, submittedAt: new Date().toISOString() })

      const { error: rejectErr } = await superAdmin.rpc('admin_reject_agency_review', {
        p_agency_id: agencyId, p_reason: 'Piece d identite non concordante',
      })
      expect(rejectErr, `reject: ${rejectErr?.message}`).toBeNull()

      const { error: relaunchErr } = await superAdmin.rpc('admin_relaunch_agency_review', { p_agency_id: agencyId })
      expect(relaunchErr, `relaunch: ${relaunchErr?.message}`).toBeNull()

      const agency = await getAgencyVerification(agencyId)
      expect(agency.verification_status, 'un rejet humain ne se retourne pas seul, meme relance').toBe('rejected')
    })

    // ─── Correctif revue etape 5/tache 2, point 1 (CRITIQUE) ──────────────────────────
    // Reproduit en base : une agence neuve, jamais soumise (identity_submitted_at NULL,
    // statut par defaut 'pending'), ne doit JAMAIS pouvoir sortir de 'pending' via la
    // relance -- recompute_agency_verification ne sait rejeter que les dossiers deja
    // TRANCHES (rejected/validated, 20260728130000), jamais un 'pending', et un dossier
    // vide echoue quand meme tous ses vetos entite (aucun check ne peut valoir 'match'),
    // donc atterrit en 'manual_review' au lieu d'y rester insensible. Sans cette garde,
    // relancer PUIS valider (deux appels authentifies parfaitement legitimes) suffisait a
    // faire passer une agence sans la moindre piece a 'validated'.
    it('refuse de relancer un dossier jamais soumis (identity_submitted_at NULL)', async () => {
      const agencyId = await createAgency('relaunch-never-submitted')
      // Pas de setVerification : statut par defaut 'pending', identity_submitted_at NULL --
      // exactement l'etat d'une agence fraichement creee, cf. 20260728101000/107000.

      const { error } = await superAdmin.rpc('admin_relaunch_agency_review', { p_agency_id: agencyId })
      expect(error, 'un dossier jamais soumis ne doit pas se laisser relancer').not.toBeNull()

      const agency = await getAgencyVerification(agencyId)
      expect(agency.verification_status, 'un refus ne doit rien changer au statut').toBe('pending')

      const engineEvent = await getLatestEvent(agencyId, 'agency_verification_recomputed')
      expect(engineEvent, 'le moteur ne doit meme pas etre appele -- la garde precede le perform').toBeNull()
    })

    it('une agence jamais soumise ne peut pas atteindre validated (relance puis validation, deux appels legitimes)', async () => {
      const agencyId = await createAgency('relaunch-then-validate-never-submitted')

      const { error: relaunchErr } = await superAdmin.rpc('admin_relaunch_agency_review', { p_agency_id: agencyId })
      expect(relaunchErr, 'la relance sur un dossier jamais soumis doit etre refusee').not.toBeNull()

      const afterRelaunch = await getAgencyVerification(agencyId)
      expect(afterRelaunch.verification_status, 'la relance refusee ne doit jamais faire entrer le dossier en manual_review').toBe('pending')

      // Meme si la relance avait (a tort) fait passer le dossier en manual_review,
      // admin_validate_agency_review exige lui-meme ce statut (teste separement) -- la
      // chaine complete de l'attaque reproduite en revue est verifiee ici de bout en bout.
      const { error: validateErr } = await superAdmin.rpc('admin_validate_agency_review', { p_agency_id: agencyId })
      expect(validateErr, 'valider un dossier reste hors de portee sans passage prealable par manual_review').not.toBeNull()

      const final = await getAgencyVerification(agencyId)
      expect(final.verification_status, 'une agence jamais soumise ne doit jamais atteindre validated').toBe('pending')
      expect(final.verified_at).toBeNull()
    })
  })

  // ─── admin_resolve_agency_id_document (tache 2) ─────────────────────────────
  // Signature elargie (correctif revue point 3) : (p_agency_id, p_check_id, p_result).
  // p_agency_id est une assertion de l'appelant, pas un filtre -- voir la migration.
  describe('admin_resolve_agency_id_document', () => {
    it('un super-admin resout une piece d identite en match -- ajoute une ligne, ne modifie jamais celle en attente', async () => {
      const agencyId = await createAgency('resolve-match')
      await setVerification(agencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })
      const personId = await createSignatory(agencyId)
      const checkId = await insertPendingIdDocumentCheck(personId)

      const { error } = await superAdmin.rpc('admin_resolve_agency_id_document', {
        p_agency_id: agencyId, p_check_id: checkId, p_result: 'match',
      })
      expect(error, `rpc: ${error?.message}`).toBeNull()

      const svc = serviceRoleClient()
      const { data, error: selErr } = await svc
        .from('agency_person_verification_checks')
        .select('id, result, source, check_type')
        .eq('related_person_id', personId)
        .eq('check_type', 'id_document')
        .order('checked_at', { ascending: true })
      if (selErr) throw new Error(`select checks: ${selErr.message}`)

      expect(data, 'append-only : la ligne en attente doit survivre, une nouvelle ligne s ajoute').toHaveLength(2)
      expect(data![0].id).toBe(checkId)
      expect(data![0].result, 'la ligne en attente d origine ne doit jamais etre modifiee').toBe('pending_manual_review')
      expect(data![1].result).toBe('match')
      expect(data![1].source).toBe('manual')
    })

    it('journalise la resolution avec l identite du decideur', async () => {
      const agencyId = await createAgency('resolve-trace')
      await setVerification(agencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })
      const personId = await createSignatory(agencyId)
      const checkId = await insertPendingIdDocumentCheck(personId)

      const { error } = await superAdmin.rpc('admin_resolve_agency_id_document', {
        p_agency_id: agencyId, p_check_id: checkId, p_result: 'mismatch',
      })
      expect(error, `rpc: ${error?.message}`).toBeNull()

      const event = await getLatestEvent(agencyId, 'agency_identity_document_resolved')
      expect(event, 'la resolution doit etre journalisee').toBeTruthy()
      expect(event!.actor_kind).toBe('user')
      expect(event!.actor_id, 'la trace doit porter l identite du decideur').toBe(superAdminId)
      expect(event!.category).toBe('kyc')
      expect(event!.severity, 'un mismatch est un signal de conformite qui merite un warn').toBe('warn')
      expect(event!.object_label, 'object_label doit porter un libelle humain, pas rester vide').toContain('Agence Revue')
    })

    // ─── Correctif revue point 3, defaut 1 (dossier clos) ────────────────────────────
    // Reproduit en base : resoudre une piece sur une agence DEJA REJETEE reussissait sans
    // la moindre garde, faisant entrer une preuve nouvelle dans un dossier clos.
    it('refuse de resoudre une piece sur un dossier deja tranche (rejected)', async () => {
      const agencyId = await createAgency('resolve-closed-rejected')
      const personId = await createSignatory(agencyId)
      const checkId = await insertPendingIdDocumentCheck(personId)
      await setVerification(agencyId, { status: 'rejected', submittedAt: new Date().toISOString() })

      const { error } = await superAdmin.rpc('admin_resolve_agency_id_document', {
        p_agency_id: agencyId, p_check_id: checkId, p_result: 'match',
      })
      expect(error, 'resoudre une piece sur un dossier deja tranche (rejected) doit etre refuse').not.toBeNull()

      const svc = serviceRoleClient()
      const { data, error: selErr } = await svc
        .from('agency_person_verification_checks')
        .select('id, result')
        .eq('related_person_id', personId)
        .eq('check_type', 'id_document')
      if (selErr) throw new Error(`select checks: ${selErr.message}`)
      expect(data, 'un refus ne doit ajouter aucune ligne -- pas de preuve nouvelle dans un dossier clos').toHaveLength(1)
      expect(data![0].result).toBe('pending_manual_review')
    })

    // ─── Correctif revue point 3, defaut 2 (garde inter-agences) ─────────────────────
    // Reproduit en base : rien ne rattachait l'identifiant de la verification a une
    // agence -- un ecran de detail perime pouvait resoudre la piece d'une AUTRE agence.
    it('refuse de resoudre une piece qui n appartient pas a l agence indiquee', async () => {
      const ownerAgencyId = await createAgency('resolve-cross-agency-owner')
      await setVerification(ownerAgencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })
      const personId = await createSignatory(ownerAgencyId)
      const checkId = await insertPendingIdDocumentCheck(personId)

      const otherAgencyId = await createAgency('resolve-cross-agency-other')
      await setVerification(otherAgencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })

      // p_agency_id pointe vers otherAgencyId -- un ecran reste ouvert sur la MAUVAISE
      // agence -- alors que le check appartient reellement a ownerAgencyId.
      const { error } = await superAdmin.rpc('admin_resolve_agency_id_document', {
        p_agency_id: otherAgencyId, p_check_id: checkId, p_result: 'match',
      })
      expect(error, 'un check qui n appartient pas a l agence indiquee doit etre refuse').not.toBeNull()

      const svc = serviceRoleClient()
      const { data, error: selErr } = await svc
        .from('agency_person_verification_checks')
        .select('id, result')
        .eq('related_person_id', personId)
        .eq('check_type', 'id_document')
      if (selErr) throw new Error(`select checks: ${selErr.message}`)
      expect(data, 'un refus ne doit ajouter aucune ligne').toHaveLength(1)
      expect(data![0].result).toBe('pending_manual_review')
    })

    it('refuse un resultat qui n est pas une decision humaine valide', async () => {
      const agencyId = await createAgency('resolve-bad-result')
      const personId = await createSignatory(agencyId)
      const checkId = await insertPendingIdDocumentCheck(personId)

      const { error } = await superAdmin.rpc('admin_resolve_agency_id_document', {
        p_agency_id: agencyId, p_check_id: checkId, p_result: 'unavailable',
      })
      expect(error, 'unavailable n est pas une decision humaine recevable').not.toBeNull()
    })

    it('refuse de resoudre deux fois la meme piece', async () => {
      const agencyId = await createAgency('resolve-twice')
      await setVerification(agencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })
      const personId = await createSignatory(agencyId)
      const checkId = await insertPendingIdDocumentCheck(personId)

      const first = await superAdmin.rpc('admin_resolve_agency_id_document', {
        p_agency_id: agencyId, p_check_id: checkId, p_result: 'match',
      })
      expect(first.error, `rpc: ${first.error?.message}`).toBeNull()

      const second = await superAdmin.rpc('admin_resolve_agency_id_document', {
        p_agency_id: agencyId, p_check_id: checkId, p_result: 'mismatch',
      })
      expect(second.error, 'une piece deja resolue ne doit pas se laisser resoudre une seconde fois').not.toBeNull()
    })

    it('refuse un check qui n est pas de type id_document', async () => {
      const agencyId = await createAgency('resolve-wrong-type')
      const personId = await createSignatory(agencyId)
      const svc = serviceRoleClient()
      const { data, error: insErr } = await svc
        .from('agency_person_verification_checks')
        .insert({ related_person_id: personId, check_type: 'poa_document_review', source: 'manual', result: 'pending_manual_review' })
        .select('id')
        .single()
      if (insErr) throw new Error(`insert poa check: ${insErr.message}`)

      const { error } = await superAdmin.rpc('admin_resolve_agency_id_document', {
        p_agency_id: agencyId, p_check_id: data!.id, p_result: 'match',
      })
      expect(error, 'cette fonction ne doit resoudre que des checks id_document').not.toBeNull()
    })

    it('est refusee a un utilisateur authentifie ordinaire et a anon', async () => {
      const agencyId = await createAgency('resolve-denied')
      const personId = await createSignatory(agencyId)
      const checkId = await insertPendingIdDocumentCheck(personId)

      const asOrdinary = await ordinaryUser.rpc('admin_resolve_agency_id_document', {
        p_agency_id: agencyId, p_check_id: checkId, p_result: 'match',
      })
      expect(asOrdinary.error?.code, `attendu ${DENIED}, recu ${asOrdinary.error?.code}`).toBe(DENIED)

      const asAnon = await anonClient().rpc('admin_resolve_agency_id_document', {
        p_agency_id: agencyId, p_check_id: checkId, p_result: 'match',
      })
      expect(asAnon.error?.code, `attendu ${DENIED}, recu ${asAnon.error?.code}`).toBe(DENIED)
    })

    // Correctif revue point 2 (voir les notes jumelles sur validate/reject).
    it('est refusee au role de service (un script ne doit jamais auto-resoudre une piece)', async () => {
      const agencyId = await createAgency('resolve-denied-service-role')
      await setVerification(agencyId, { status: 'manual_review', submittedAt: new Date().toISOString() })
      const personId = await createSignatory(agencyId)
      const checkId = await insertPendingIdDocumentCheck(personId)

      const { error } = await serviceRoleClient().rpc('admin_resolve_agency_id_document', {
        p_agency_id: agencyId, p_check_id: checkId, p_result: 'match',
      })
      expect(error?.code, `attendu ${DENIED}, recu ${error?.code}`).toBe(DENIED)

      const svc = serviceRoleClient()
      const { data, error: selErr } = await svc
        .from('agency_person_verification_checks')
        .select('id, result')
        .eq('related_person_id', personId)
        .eq('check_type', 'id_document')
      if (selErr) throw new Error(`select checks: ${selErr.message}`)
      expect(data, 'un refus ne doit ajouter aucune ligne').toHaveLength(1)
      expect(data![0].result).toBe('pending_manual_review')
    })
  })
})
