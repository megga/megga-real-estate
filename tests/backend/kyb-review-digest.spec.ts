// Backend live — la charge utile du digest quotidien de revue KYB.
//
// Ce que ce test verrouille : le digest ne peut pas mentir sur QUI attend. Il lit la même
// vérité que la file de la console (verification_status = 'manual_review'), et il ne s'ouvre
// qu'au service_role — c'est un cron qui l'appellera, jamais un navigateur.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local seedé et
// DOIVENT réellement passer. Un vert local sans pile démarrée ne prouve rien.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'

interface DigestRow {
  agency_id: string
  agency_name: string
  country: string | null
  score: number | string | null
  submitted_at: string
  age_days: number
}

interface DigestPayload {
  recipients: string[]
  dossiers: DigestRow[]
}

describe.skipIf(!HAS_KEYS)('kyb_review_digest_payload() — la charge utile du digest quotidien', () => {
  const agencyIds: string[] = []
  const userIds: string[] = []
  let ordinaryUser: SupabaseClient

  beforeAll(async () => {
    ordinaryUser = await createOrdinaryUser()
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    // Best-effort HONNÊTE : une agence sur laquelle un activity_events a été écrit est
    // indéletable (append-only, LBA art. 7). Ce fichier n'appelle aucune RPC qui journalise,
    // donc la suppression devrait aboutir — on rapporte nommément si ce n'est pas le cas
    // plutôt que d'avaler l'échec.
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
        `[kyb-review-digest.spec.ts] ${undeletable.length}/${agencyIds.length} agence(s) non supprimée(s) :\n` +
        undeletable.map((u) => `  - ${u.id} : ${u.reason}`).join('\n')
      )
    }
  })

  async function createOrdinaryUser(): Promise<SupabaseClient> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `digest-agent-${stamp}@megga-test.local`
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

  /** Écrit directement les colonnes de vérification par le service_role — même patron de
   *  fixture que agency-review-queue.spec.ts, qui n'appelle ni submit_agency_identity() ni
   *  recompute_agency_verification() pour poser un état. */
  async function createAgency(opts: {
    label: string
    status: string
    submittedDaysAgo: number | null
  }): Promise<string> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${opts.label}`
    const submittedAt = opts.submittedDaysAgo === null
      ? null
      // +1 h pour ne jamais tomber pile sur la frontière du jour : floor(6j 1h) = 6, stable.
      : new Date(Date.now() - (opts.submittedDaysAgo * 86_400 + 3_600) * 1000).toISOString()

    const { data, error } = await svc
      .from('agencies')
      .insert({
        name: `Agence Digest ${stamp}`,
        slug: `agence-digest-${stamp}`,
        country: 'CH',
        verification_status: opts.status,
        identity_submitted_at: submittedAt,
      })
      .select('id')
      .single()
    if (error) throw new Error(`createAgency ${opts.label}: ${error.message}`)
    agencyIds.push(data.id as string)
    return data.id as string
  }

  const payload = async (): Promise<DigestPayload> => {
    const { data, error } = await serviceRoleClient().rpc('kyb_review_digest_payload')
    expect(error).toBeNull()
    return data as unknown as DigestPayload
  }

  it('ne rend que les dossiers en manual_review, jamais un dossier tranché ni jamais soumis', async () => {
    const enAttente = await createAgency({ label: 'attente', status: 'manual_review', submittedDaysAgo: 0 })
    const valide = await createAgency({ label: 'valide', status: 'validated', submittedDaysAgo: 0 })
    const jamaisSoumis = await createAgency({ label: 'neuf', status: 'pending', submittedDaysAgo: null })

    const ids = (await payload()).dossiers.map((d) => d.agency_id)
    expect(ids).toContain(enAttente)
    expect(ids).not.toContain(valide)
    expect(ids).not.toContain(jamaisSoumis)
  })

  it('un manual_review sans identity_submitted_at est écarté — sans quoi son ancienneté serait NULL', async () => {
    // Cas atteignable : admin_request_agency_correction remet la colonne à NULL. Le dossier
    // repasse par 'correction_requested', mais la garde vaut pour tout chemin futur.
    const bancal = await createAgency({ label: 'sans-date', status: 'manual_review', submittedDaysAgo: null })
    expect((await payload()).dossiers.map((d) => d.agency_id)).not.toContain(bancal)
  })

  it('porte l\'ancienneté en JOURS PLEINS depuis identity_submitted_at', async () => {
    const id = await createAgency({ label: 'vieux', status: 'manual_review', submittedDaysAgo: 6 })
    const ligne = (await payload()).dossiers.find((d) => d.agency_id === id)
    expect(ligne?.age_days).toBe(6)
  })

  it('trie du plus ancien au plus récent — c\'est l\'ordre dans lequel on veut les traiter', async () => {
    const dossiers = (await payload()).dossiers
    const ages = dossiers.map((d) => d.age_days)
    expect([...ages].sort((a, b) => b - a)).toEqual(ages)
  })

  it('rend exactement les destinataires de super_admin_allowlist() — un digest sans adresse ne part nulle part', async () => {
    // CORRECTION au brief d'origine : il affirmait que super_admin_allowlist() « n'est pas
    // exposée à PostgREST », donc qu'on ne pouvait qu'asserter un tableau non vide. Mesuré
    // faux : la fonction porte GRANT EXECUTE ... TO service_role (20260705160000), et un
    // appel REST POST /rest/v1/rpc/super_admin_allowlist en service_role rend HTTP 200 avec
    // les deux adresses -- exactement le rôle sous lequel serviceRoleClient() appelle ici.
    // On compare donc les deux tableaux plutôt que de se contenter de « non vide ».
    const { recipients } = await payload()
    const { data: allowlist, error } = await serviceRoleClient().rpc('super_admin_allowlist')
    expect(error).toBeNull()
    expect(Array.isArray(recipients)).toBe(true)
    expect(recipients.length).toBeGreaterThan(0)
    expect([...recipients].sort()).toEqual([...(allowlist as string[])].sort())
    for (const r of recipients) expect(r).toContain('@')
  })

  it('`dossiers` est toujours un tableau, jamais null', async () => {
    // Le cas VIDE lui-même se teste au niveau unitaire (buildReviewDigest([]) === null) :
    // le forcer ici exigerait de vider la file d'une base partagée, ce qu'un test n'a pas
    // à faire. Ici on verrouille seulement le coalesce.
    expect(Array.isArray((await payload()).dossiers)).toBe(true)
  })

  it('refuse un appelant authentifié — un cron l\'appelle, jamais un navigateur', async () => {
    const { data, error } = await ordinaryUser.rpc('kyb_review_digest_payload')
    // Le CODE n'est pas épinglé, et c'est délibéré. Contrairement au patron P3 (EXECUTE
    // accordé à `authenticated` + garde interne is_super_admin(), qui rend bien 42501),
    // cette RPC a EXECUTE *révoqué* pour `authenticated` : PostgREST échoue alors AVANT
    // d'entrer dans la fonction, et le code rendu dépend de sa version (42883 / PGRST202
    // selon que la fonction est masquée du cache de schéma ou refusée à l'exécution).
    // Épingler une de ces valeurs rendrait le test faux à la première montée de version,
    // sur un comportement par ailleurs correct. Ce qui compte : rien ne sort.
    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })

  it('refuse l\'anonyme', async () => {
    const { data, error } = await anonClient().rpc('kyb_review_digest_payload')
    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })
})
