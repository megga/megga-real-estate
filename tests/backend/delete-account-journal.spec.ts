// Backend spec (live CI) — delete-account laisse le journal d'audit INTACT, détaché de
// son auteur par la FK, et nomme l'opérateur quand c'est un super-admin qui supprime.
//
// POURQUOI CE FICHIER EXISTE. C'est le premier test de delete-account (`grep delete-account
// tests/backend` rendait 0). Son étape 8 réécrivait `actor_id = 'deleted_user'` sur chaque
// ligne de l'agent, et le registre nLPD (activité n°1) promettait cette anonymisation : elle
// n'a jamais eu lieu. `actor_id` est un uuid (22P02), le trigger append-only refuse la
// réécriture, et le résultat était jeté — la fonction répondait 200. L'étape est RETIRÉE :
// la dissociation est faite par la BASE à l'étape 11 (deleteUser → profiles_id_fkey ON
// DELETE CASCADE → activity_events_actor_id_fkey ON DELETE SET NULL), sur toutes les lignes
// et dans la transaction de la suppression.
//
// ⚠ CE SPEC NE DISTINGUE PAS L'ANCIEN CODE DU NOUVEAU sur la branche self : l'étape 8
// échouait sans rien modifier, donc l'état final était déjà celui de la FK. Il fige le
// contrat de bout en bout, À TRAVERS delete-account, et rejette les deux faux correctifs
// que le trigger admettrait — `actor_kind = 'system'` (branche « anonymisation nLPD », qui
// attribuerait le geste d'un agent à la machine et poserait `anonymized_reason`) et toute
// sentinelle en métadonnées (`deleted_user_id`). Le ROUGE sur l'ancien code vient de la
// garde statique tests/unit/activity-events-append-only.spec.ts.
//
// La branche ADMIN, elle, est neuve : la trace `account_deleted` nommait la CIBLE en
// `actor_id` (puis la FK la détachait), et le super-admin qui supprimait n'était inscrit
// nulle part. Elle nomme désormais l'opérateur, et écrit au registre MEGGA (famille
// `lifecycle`), comme admin-user-lifecycle.
//
// ⚠ LE PIÈGE DE LA BRANCHE ADMIN. `setupTwoAgencies` allowliste tout `@megga-test.local`
// (`super_admin_allowlist_match` compare un SUFFIXE), et delete-account REFUSE (403) de
// supprimer un compte allowlisté. La cible doit donc vivre sur un autre domaine — même
// précaution que admin-lifecycle-edges.spec.ts.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : lire le COMPTE de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { anonClient, serviceRoleClient } from './helpers/supabase'
import { waitForEdgeWorker } from './helpers/edge'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const FN = (name: string) => `${URL}/functions/v1/${name}`
const PW = 'Test-Password-123!'
const SOURCE = 'delete-account-journal.spec'

/** Le domaine allowlisté (opérateur) et celui qui ne l'est PAS (cible). Voir l'en-tête. */
const DOM_ADMIN = '@megga-test.local'
const DOM_CIBLE = '@delete-account-cible.local'

interface Ligne {
  id: string
  actor_id: string | null
  actor_kind: string
  agency_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  category: string | null
  created_at: string
  object_label: string | null
  ip_address: string | null
  metadata: Record<string, unknown> | null
}
const COLONNES = 'id, actor_id, actor_kind, agency_id, action, entity_type, entity_id, category, created_at, object_label, ip_address, metadata'

/** Appelle delete-account et rend le statut, le corps lu et le texte brut (pour le message d'échec). */
async function appeler(jwt: string, body: unknown) {
  const res = await fetch(FN('delete-account'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body),
  })
  const texte = await res.text()
  let corps: Record<string, unknown> = {}
  try { corps = JSON.parse(texte) as Record<string, unknown> } catch { corps = { brut: texte } }
  // ⚠ Un 503 vient du runtime edge LOCAL (worker pas debout), pas de la fonction : le texte le dit.
  return { status: res.status, corps, texte: texte.slice(0, 400) }
}

async function traceSuppression(cibleId: string): Promise<Ligne[]> {
  const { data, error } = await serviceRoleClient()
    .from('activity_events')
    .select(COLONNES)
    .eq('action', 'account_deleted')
    .eq('entity_id', cibleId)
  if (error) throw new Error(`lecture account_deleted : ${error.message}`)
  return (data ?? []) as Ligne[]
}

async function compteDisparu(id: string) {
  const svc = serviceRoleClient()
  const { data: profil } = await svc.from('profiles').select('id').eq('id', id).maybeSingle()
  expect(profil, 'le profil doit disparaître avec le compte (cascade de l’étape 11)').toBeNull()
  const { data: auth } = await svc.auth.admin.getUserById(id)
  expect(auth?.user ?? null, 'le compte d’authentification doit être supprimé').toBeNull()
}

describe.skipIf(!HAS_KEYS)('delete-account (branche self) — le journal survit, détaché par la FK', () => {
  let s: TwoAgenciesSetup
  let jwtA = ''
  /** Les lignes semées, relues AVANT la suppression — la référence de « inchangé ». */
  const avant: Ligne[] = []

  beforeAll(async () => {
    s = await setupTwoAgencies()
    const { data } = await s.clientA.auth.getSession()
    jwtA = data.session!.access_token
    const svc = serviceRoleClient()
    // Deux formes : sans libellé ni IP, et avec les deux. Le trigger exige que la FK ne
    // touche QUE `actor_id` — `object_label` et `ip_address` compris.
    const formes = [
      { object_label: null, ip_address: null },
      { object_label: `ZZ Delete ${s.stamp}`, ip_address: '203.0.113.7' },
    ]
    for (const f of formes) {
      const { data: row, error } = await svc.from('activity_events').insert({
        agency_id: s.agencyAId,
        actor_id: s.agentAId,
        actor_kind: 'user',
        action: 'contact_created',
        entity_type: 'contact',
        category: 'contact',
        severity: 'info',
        metadata: { source: SOURCE },
        ...f,
      }).select(COLONNES).single()
      if (error) throw new Error(`seed activity_events : ${error.message}`)
      avant.push(row as Ligne)
    }
    // Non-vacuité : on tient bien deux lignes AVEC leur acteur avant de supprimer.
    expect(avant.map((l) => l.actor_id)).toEqual([s.agentAId, s.agentAId])
    await waitForEdgeWorker(FN('delete-account'))
  }, 120_000)

  afterAll(async () => {
    // Les lignes restent : le trigger refuse leur suppression avant dix ans, et c'est voulu.
    // `cleanup()` tolère le deleteUser d'un compte déjà supprimé.
    await s?.cleanup()
  })

  it('supprime le compte, et chaque ligne du journal reste — sans acteur, jamais « système »', async () => {
    const r = await appeler(jwtA, {})
    expect(r.status, `delete-account : ${r.texte}`).toBe(200)
    expect(r.corps.success).toBe(true)

    await compteDisparu(s.agentAId)

    const { data, error } = await serviceRoleClient()
      .from('activity_events').select(COLONNES).in('id', avant.map((l) => l.id))
    expect(error, `relecture : ${error?.message}`).toBeNull()
    const apres = (data ?? []) as Ligne[]
    expect(apres, 'la ligne d’audit ne doit JAMAIS disparaître (LBA art. 7 al. 3)').toHaveLength(avant.length)

    for (const a of avant) {
      const p = apres.find((l) => l.id === a.id)!
      expect(p.actor_id, 'l’acteur est détaché').toBeNull()
      // Une personne a agi, on a perdu son nom. 'system' raconterait que la machine l'a fait.
      expect(p.actor_kind).toBe('user')
      expect(p.action).toBe(a.action)
      expect(p.entity_type).toBe(a.entity_type)
      expect(p.created_at).toBe(a.created_at)
      expect(p.object_label).toBe(a.object_label)
      expect(p.ip_address).toBe(a.ip_address)
      expect(p.agency_id).toBe(s.agencyAId)
      expect(p.metadata?.source, 'les métadonnées d’origine survivent').toBe(SOURCE)
      // La preuve du détachement, posée par la BRANCHE FK du trigger — donc par la base.
      expect(p.metadata?.actor_detached_from).toBe(s.agentAId)
      expect(p.metadata?.actor_detached_reason).toBe('profile deleted (FK on delete set null)')
      // Les deux faux correctifs : la branche « anonymisation » et la sentinelle applicative.
      expect(p.metadata, 'la branche « anonymisation nLPD » a écrit (actor_kind=system)').not.toHaveProperty('anonymized_reason')
      expect(p.metadata, 'une réécriture applicative a écrit sa sentinelle').not.toHaveProperty('deleted_user_id')
    }

    // La trace de la suppression elle-même : écrite AVANT la destruction avec l'auteur réel,
    // puis détachée par la même FK.
    const trace = await traceSuppression(s.agentAId)
    expect(trace, 'une trace account_deleted, et une seule').toHaveLength(1)
    expect(trace[0]!.category).toBe('auth')
    expect(trace[0]!.actor_id).toBeNull()
    expect(trace[0]!.actor_kind).toBe('user')
    expect(trace[0]!.metadata?.initiated_by).toBe('user')
    expect(trace[0]!.metadata?.actor_detached_from).toBe(s.agentAId)
  }, 90_000)
})

describe.skipIf(!HAS_KEYS)('delete-account (branche admin) — l’opérateur est nommé, au journal et au registre', () => {
  const userIds: string[] = []
  let agencyId = ''
  let operateur: SupabaseClient
  let operateurId = ''
  let operateurEmail = ''
  let operateurJwt = ''
  let cibleId = ''
  let cibleEmail = ''

  async function mkUser(prefix: string, domaine: string, role: string, agence: string | null) {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `${prefix}-${stamp}${domaine}`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `${prefix} ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser ${prefix}: ${error.message}`)
    const id = data.user!.id
    userIds.push(id)
    const { error: pErr } = await svc.from('profiles').upsert(
      { id, email, full_name: `${prefix} ${stamp}`, role, agency_id: agence }, { onConflict: 'id' },
    )
    if (pErr) throw new Error(`profile ${prefix}: ${pErr.message}`)
    return { id, email }
  }

  beforeAll(async () => {
    const svc = serviceRoleClient()
    const { error: cfgErr } = await svc
      .from('app_config')
      .upsert({ key: 'super_admin_test_domain', value: DOM_ADMIN }, { onConflict: 'key' })
    if (cfgErr) throw new Error(`app_config : ${cfgErr.message}`)

    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data: ag, error: agErr } = await svc.from('agencies')
      .insert({ name: `Agence Suppression ${stamp}`, slug: `agence-suppression-${stamp}` })
      .select('id').single()
    if (agErr) throw new Error(`agence : ${agErr.message}`)
    agencyId = ag.id

    const op = await mkUser('suppr-super', DOM_ADMIN, 'super_admin', null)
    operateurId = op.id
    operateurEmail = op.email
    operateur = anonClient()
    const { data: sess, error: sErr } = await operateur.auth.signInWithPassword({ email: op.email, password: PW })
    if (sErr) throw new Error(`signin opérateur : ${sErr.message}`)
    operateurJwt = sess.session!.access_token

    const cible = await mkUser('suppr-cible', DOM_CIBLE, 'agent', agencyId)
    cibleId = cible.id
    cibleEmail = cible.email
    await waitForEdgeWorker(FN('delete-account'))
  }, 120_000)

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of userIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
    if (agencyId) await svc.from('agencies').delete().eq('id', agencyId).then(() => {}, () => {})
  })

  it('un super-admin supprime un compte tiers : la trace nomme l’OPÉRATEUR, le registre aussi', async () => {
    const rep = await appeler(operateurJwt, { target_user_id: cibleId })
    expect(rep.status, `delete-account : ${rep.texte}`).toBe(200)
    expect(rep.corps.success).toBe(true)

    await compteDisparu(cibleId)

    // 1. Le journal de l'agence : l'auteur du geste est l'opérateur, la cible est l'entité.
    //    Il n'est PAS détaché — l'opérateur, lui, existe toujours.
    const trace = await traceSuppression(cibleId)
    expect(trace, 'une trace account_deleted, et une seule').toHaveLength(1)
    const t = trace[0]!
    expect(t.actor_id, 'la trace nommait la CIBLE en acteur : le super-admin n’apparaissait nulle part').toBe(operateurId)
    expect(t.actor_kind).toBe('user')
    expect(t.entity_id).toBe(cibleId)
    expect(t.agency_id).toBe(agencyId)
    expect(t.metadata?.initiated_by).toBe('admin')
    expect(t.metadata).not.toHaveProperty('actor_detached_from')

    // 2. Le registre MEGGA. ⚠ Lu avec le JWT de l'opérateur : `service_role` n'a PAS le
    //    SELECT sur `admin_log`, et une lecture révoquée rend `null` sans erreur.
    const { data: reg, error: regErr } = await operateur
      .from('admin_log')
      .select('family, action, severity, actor_label, actor_user_id, entity_type, entity_id, agency_id, metadata')
      .eq('entity_id', cibleId)
      .eq('action', 'account_deleted')
    expect(regErr, `lecture admin_log : ${regErr?.message}`).toBeNull()
    expect(reg, 'une ligne de registre pour la suppression').toHaveLength(1)
    const r = reg![0] as { family: string; actor_label: string; actor_user_id: string | null; entity_type: string; agency_id: string | null; metadata: Array<{ l: string; v: string }> }
    expect(r.family).toBe('lifecycle')
    expect(r.entity_type).toBe('profile')
    expect(r.agency_id).toBe(agencyId)
    // Clé de service : `auth.uid()` NULL, donc « Système » — l'opérateur est dans les paires.
    expect(r.actor_label).toBe('Système')
    expect(r.actor_user_id).toBeNull()
    expect(r.metadata.find((p) => p.l === 'Opérateur')?.v).toBe(operateurEmail)
    // ⛔ Le registre est append-only et gardé dix ans : il ne doit pas réintroduire l'adresse
    //    de la personne dont il consigne l'effacement.
    expect(JSON.stringify(r.metadata), 'le registre ne garde pas l’e-mail du compte effacé').not.toContain(cibleEmail)
  }, 90_000)
})
