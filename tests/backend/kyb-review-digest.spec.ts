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
// Observé (pas supposé) contre la pile locale avant de resserrer cette assertion, comme
// invité par le brief : anon ET un utilisateur authentifié ordinaire reçoivent tous deux
// 42501 "permission denied for function" -- le REVOKE ALL ... FROM public, anon,
// authenticated de la migration est vérifié par Postgres avant même que PostgREST
// n'atteigne le corps de la fonction, donc aucun des deux rôles ne déclenche jamais le
// 42883/PGRST202 envisagé par le texte d'origine (qui restait, lui, une hypothèse).
const DENIED = '42501'

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
  total: number
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

  it('rend `dossiers` sous forme de tableau — forme de la charge utile, pas une preuve du coalesce sur file vide', async () => {
    // Ce que ce test NE prouve PAS : que coalesce(..., '[]'::jsonb) tient sur une file
    // VIDE. Les it() precedents ont deja inserre des lignes dans cette suite, donc
    // jsonb_agg rend ici un vrai tableau que le coalesce existe ou non — seul un etat
    // vide distinguerait les deux, et le forcer exigerait de vider une file partagee
    // entre suites, ce qu'un test n'a pas a faire. Le coalesce sur file vide se prouve
    // au niveau UNITAIRE (buildReviewDigest([]) === null, tests/unit/kyb-review-digest).
    // Ici on verrouille seulement la FORME : `dossiers` est un tableau, jamais un objet
    // ou une chaine.
    expect(Array.isArray((await payload()).dossiers)).toBe(true)
  })

  it('plafonne `dossiers` a 50 et rend dans `total` le compte REEL, au-dela du plafond', async () => {
    // Assertions RELATIVES uniquement (jamais un total absolu) : cette base est partagee
    // entre suites qui tournent en parallele (meme convention que admin-log-chain.spec.ts).
    // Le plafond de 50 est un invariant absolu, lui, quel que soit le bruit ambiant.
    const N = 52
    const created = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        createAgency({ label: `plafond-${i}`, status: 'manual_review', submittedDaysAgo: 30 }))
    )
    expect(created).toHaveLength(N)

    const { dossiers, total } = await payload()
    expect(dossiers.length, 'jamais plus de 50 dossiers rendus, quelle que soit la file').toBeLessThanOrEqual(50)
    // Ces N dossiers sont TOUS en manual_review avec identity_submitted_at pose : ils
    // comptent tous dans le total REEL, meme ceux restes hors de la page de 50.
    expect(total, 'le total ne doit jamais se limiter a la taille de la page').toBeGreaterThanOrEqual(N)
    expect(total, 'la file depasse reellement le plafond une fois N > 50').toBeGreaterThan(dossiers.length)
  }, 30_000)

  it('refuse un appelant authentifié — un cron l\'appelle, jamais un navigateur', async () => {
    const { data, error } = await ordinaryUser.rpc('kyb_review_digest_payload')
    // EXECUTE est *révoqué* pour `authenticated` (contrairement au patron P3, où il est
    // accordé et la garde is_super_admin() est interne à la fonction) : Postgres refuse
    // donc l'appel par privilège AVANT même d'entrer dans le corps de la fonction.
    // Épinglé à 42501 -- observé contre la pile locale, pas supposé (voir DENIED).
    expect(error?.code, `attendu ${DENIED}, reçu ${error?.code}`).toBe(DENIED)
    expect(data).toBeNull()
  })

  it('refuse l\'anonyme', async () => {
    const { data, error } = await anonClient().rpc('kyb_review_digest_payload')
    expect(error?.code, `attendu ${DENIED}, reçu ${error?.code}`).toBe(DENIED)
    expect(data).toBeNull()
  })
})
