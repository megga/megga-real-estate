// Backend spec (live CI) — les deux edges de cycle de vie écrivent au REGISTRE.
//
// POURQUOI CE FICHIER EXISTE. `20260802180000` a fait journaliser huit RPC ET deux edge
// functions dans `admin_log`. Les huit RPC sont couvertes par `admin-gestes-registre.spec.ts` ;
// les deux edges ne l'étaient par RIEN. C'était le seul trou déclaré du remboursement, et il
// portait la famille `lifecycle` en entier : ni test, ni ligne en production. Sa première
// preuve aurait été un vrai clic sur une vraie agence — c'est-à-dire le bannissement des
// comptes de tous ses membres pour éprouver une ligne de journal.
//
// CE QUE CE FICHIER PROUVE, et que le statique ne peut pas :
//   1. le chemin COMPLET tourne — auth super-admin → mutation → `admin_log_write` ;
//   2. l'acteur vaut « Système », conséquence documentée de la clé de service (voir plus bas) ;
//   3. l'identité de l'opérateur n'est pas perdue : elle est dans la 1ʳᵉ paire de metadata ;
//   4. les compteurs partent en CHAÎNES (le hash de chaîne porte sur le texte du jsonb) ;
//   5. un refus d'authentification ne laisse AUCUNE ligne — une garde ne journalise pas.
//
// ⚠ LE PIÈGE QUI REND CE TEST CREUX SI ON L'IGNORE. `super_admin_allowlist_match` déclare
// allowlisté TOUT e-mail dont le suffixe est `app_config.super_admin_test_domain`. Le
// super-admin de test doit donc porter `@megga-test.local`, mais ses CIBLES surtout pas :
//   · `admin-user-lifecycle` REFUSE (403) d'agir sur un compte allowlisté (anti-lockout) ;
//   · `admin-agency-lifecycle` ÉPARGNE les membres allowlistés (`skipped++`, pas `processed++`).
// Des cibles sur le même domaine rendraient donc `Membres traités = 0` et un 403 — le test
// passerait à côté de tout ce qu'il croit mesurer. D'où DEUX domaines distincts.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : lire le COMPTE de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const PW = 'Test-Password-123!'

/** Le domaine allowlisté (super-admin) et celui qui ne l'est PAS (cibles). Voir l'en-tête. */
const DOM_ADMIN = '@megga-test.local'
const DOM_CIBLE = '@megga-cible.local'

interface Pair { l: string; v: string }
interface LigneRegistre {
  family: string; action: string; severity: string
  actor_label: string; actor_user_id: string | null
  entity_type: string; entity_id: string; entity_label: string
  agency_id: string | null; metadata: Pair[]; seq: number
}

describe.skipIf(!HAS_KEYS)('les edges de cycle de vie écrivent au registre (famille lifecycle)', () => {
  const userIds: string[] = []
  const agencyIds: string[] = []
  let superAdmin: SupabaseClient
  let adminEmail = ''
  let adminJwt = ''
  let agencyId = ''
  let agencyName = ''
  let membreEmail = ''
  let cibleId = ''
  let cibleEmail = ''

  /** Crée un compte auth + son profil, et rend son id. */
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
    if (cfgErr) throw new Error(`app_config: ${cfgErr.message}`)

    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    agencyName = `Agence Cycle ${stamp}`
    const { data: ag, error: agErr } = await svc.from('agencies').insert({
      name: agencyName, slug: `agence-cycle-${stamp}`, country: 'CH', status: 'active',
    }).select('id').single()
    if (agErr) throw new Error(`agence: ${agErr.message}`)
    agencyId = ag.id
    agencyIds.push(agencyId)

    const admin = await mkUser('cycle-super', DOM_ADMIN, 'super_admin', null)
    adminEmail = admin.email
    superAdmin = anonClient()
    const { data: sess, error: sErr } = await superAdmin.auth.signInWithPassword({
      email: adminEmail, password: PW,
    })
    if (sErr) throw new Error(`signin super: ${sErr.message}`)
    adminJwt = sess.session!.access_token

    // Cibles sur le domaine NON allowlisté — sinon anti-lockout et compteurs à zéro.
    // DEUX membres rattachés à l'agence : c'est ce que `members_processed` doit compter.
    membreEmail = (await mkUser('cycle-membre', DOM_CIBLE, 'agent', agencyId)).email
    const cible = await mkUser('cycle-cible', DOM_CIBLE, 'agent', agencyId)
    cibleId = cible.id
    cibleEmail = cible.email
  }, 90_000)

  afterAll(async () => {
    const svc = serviceRoleClient()
    // `admin_log` est append-only (trois triggers de refus) : ses lignes ne se nettoient pas,
    // et c'est voulu. La base de CI est fraîche à chaque run.
    for (const id of agencyIds) await svc.from('agencies').delete().eq('id', id).then(() => {}, () => {})
    for (const id of userIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  /** apikey = clé du projet, Authorization = JWT UTILISATEUR : `requireSuperAdmin` appelle
   *  `auth.getUser(token)` et refuse d'emblée tout jeton sans `sub` (les clés d'API). */
  const callEdge = (fn: string, body: unknown, bearer: string | null) =>
    fetch(`${URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify(body),
    })

  /** Lecture du registre AVEC le JWT super-admin : `service_role` n'a PAS le SELECT sur
   *  `admin_log`, et une lecture révoquée rend `null` SANS erreur — test vert sur du vide. */
  async function lignes(entityId: string, action?: string): Promise<LigneRegistre[]> {
    let q = superAdmin
      .from('admin_log')
      .select('family, action, severity, actor_label, actor_user_id, entity_type, entity_id, entity_label, agency_id, metadata, seq')
      .eq('entity_id', entityId)
      .order('seq', { ascending: true })
    if (action) q = q.eq('action', action)
    const { data, error } = await q
    if (error) throw new Error(`lecture admin_log: ${error.message}`)
    return (data ?? []) as unknown as LigneRegistre[]
  }

  const paire = (l: LigneRegistre, label: string) => l.metadata.find((p) => p.l === label)?.v

  // ── 1. Suspension d'agence ───────────────────────────────────────────────────────────

  it('admin-agency-lifecycle suspend et laisse une ligne `lifecycle`', async () => {
    const res = await callEdge('admin-agency-lifecycle', { action: 'suspend', agency_id: agencyId }, adminJwt)
    const corps = await res.json()
    expect(res.status, `réponse inattendue : ${JSON.stringify(corps)}`).toBe(200)
    expect(corps.members_processed, 'le membre non allowlisté doit être traité').toBe(2)

    const l = await lignes(agencyId, 'agency_suspended')
    expect(l, 'une ligne de registre pour la suspension').toHaveLength(1)
    expect(l[0].family).toBe('lifecycle')
    expect(l[0].severity).toBe('warn')
    expect(l[0].entity_type).toBe('agency')
    expect(l[0].entity_label).toBe(agencyName)
    expect(l[0].agency_id).toBe(agencyId)

    // ⚠ L'ACTEUR VAUT « Système », ET C'EST LE FAIT LE PLUS IMPORTANT DE CE FICHIER.
    // `requireSuperAdmin` rend un client à la CLÉ DE SERVICE : `auth.uid()` y est NULL, donc
    // `admin_log_write` force `actor_label` et LÈVE si on lui passe autre chose.
    // Si ce test rougit un jour parce que le libellé porte un NOM, ce n'est probablement pas
    // une régression : c'est que quelqu'un a monté dans l'edge un second client portant le
    // JWT de l'appelant — l'amélioration recommandée dans ETAT_CHANTIER §7duodecies. Mettre
    // alors l'assertion à jour CONSCIEMMENT, plutôt que de la contourner.
    expect(l[0].actor_label).toBe('Système')
    expect(l[0].actor_user_id).toBeNull()

    // L'attribution n'est pas perdue, elle est DÉPLACÉE : sans cette paire, une suspension
    // d'agence n'aurait plus aucun auteur nulle part.
    expect(paire(l[0], 'Opérateur')).toBe(adminEmail)
    expect(paire(l[0], 'Action')).toBe('Suspension')
    // En CHAÎNE, pas en nombre : le hash de chaîne porte sur le TEXTE du jsonb.
    expect(paire(l[0], 'Membres traités')).toBe('2')
    expect(typeof l[0].metadata.find((p) => p.l === 'Membres traités')!.v).toBe('string')
    expect(paire(l[0], 'Membres épargnés (allowlist)')).toBe('0')

    const svc = serviceRoleClient()
    const { data: ag } = await svc.from('agencies').select('status').eq('id', agencyId).single()
    expect(ag!.status, 'la mutation a bien eu lieu, pas seulement le journal').toBe('suspended')
  }, 90_000)

  it('admin-agency-lifecycle réactive et laisse une SECONDE ligne', async () => {
    const res = await callEdge('admin-agency-lifecycle', { action: 'reactivate', agency_id: agencyId }, adminJwt)
    expect(res.status).toBe(200)

    const l = await lignes(agencyId, 'agency_activated')
    expect(l).toHaveLength(1)
    expect(l[0].family).toBe('lifecycle')
    expect(paire(l[0], 'Action')).toBe('Réactivation')
    // Deux gestes = deux lignes. Un registre qui écraserait ne raconterait plus l'histoire.
    expect(await lignes(agencyId)).toHaveLength(2)
  }, 90_000)

  // ── 2. Suspension de compte ──────────────────────────────────────────────────────────

  it('admin-user-lifecycle suspend un compte et laisse une ligne `lifecycle`', async () => {
    const res = await callEdge('admin-user-lifecycle', { action: 'suspend', user_id: cibleId }, adminJwt)
    const corps = await res.json()
    expect(res.status, `réponse inattendue : ${JSON.stringify(corps)}`).toBe(200)

    const l = await lignes(cibleId, 'user_suspended')
    expect(l).toHaveLength(1)
    expect(l[0].family).toBe('lifecycle')
    expect(l[0].entity_type).toBe('profile')
    expect(l[0].actor_label).toBe('Système')
    expect(paire(l[0], 'Opérateur')).toBe(adminEmail)
    expect(paire(l[0], 'Compte cible')).toBe(cibleEmail)
    // Le fait le moins évident du geste, et celui qu'un auditeur doit trouver ICI : le ban
    // bloque le REFRESH, pas les JWT déjà émis.
    expect(paire(l[0], 'Accès résiduel')).toContain('1 h')

    const svc = serviceRoleClient()
    const { data: p } = await svc.from('profiles').select('is_suspended').eq('id', cibleId).single()
    expect(p!.is_suspended).toBe(true)
  }, 90_000)

  // ── 3. Ce qu'un REFUS ne doit pas faire ──────────────────────────────────────────────

  it('sans Authorization : 401 et AUCUNE ligne — une garde ne journalise pas', async () => {
    const avant = (await lignes(agencyId)).length
    const res = await callEdge('admin-agency-lifecycle', { action: 'suspend', agency_id: agencyId }, null)
    expect(res.status).toBe(401)
    expect(await lignes(agencyId), 'un refus d’auth ne laisse pas de trace au registre')
      .toHaveLength(avant)
  }, 60_000)

  it('un agent simple : 403 et aucune ligne', async () => {
    const avant = (await lignes(cibleId)).length
    const agent = anonClient()
    // `membreEmail` a été banni au test 1 puis DÉBANNI au test 2 : sa session redevient
    // possible ici, et c'est bien ce qu'on veut éprouver — un compte valide, mais sans rôle.
    const { data: sess, error: sErr } = await agent.auth.signInWithPassword({
      email: membreEmail, password: PW,
    })
    if (sErr || !sess.session) throw new Error(`signin agent: ${sErr?.message ?? 'pas de session'}`)

    const res = await callEdge('admin-user-lifecycle', { action: 'suspend', user_id: cibleId }, sess.session.access_token)
    expect(res.status, 'rôle non super_admin').toBe(403)
    expect(await lignes(cibleId)).toHaveLength(avant)
  }, 60_000)

  // ── 4. La chaîne tient ───────────────────────────────────────────────────────────────

  it('la chaîne d’empreintes reste vérifiable après les écritures des edges', () => {
    // `admin_log_verify_chain` n'est pas accordée à `authenticated` ; sa garde admet
    // session_user in ('postgres','supabase_admin') — le rôle sous lequel execSql tourne.
    // ⚠ `no_rows` est une valeur À PART ENTIÈRE du verdict : tester `<> 'broken'` rendrait
    // ce test vert sur un registre VIDE, c'est-à-dire dans le cas même qu'on veut exclure.
    expect(() => execSql(`do $$
declare v jsonb;
begin
  v := public.admin_log_verify_chain(null, null);
  if (v ->> 'status') <> 'ok' then
    raise exception 'chaine admin_log non verifiee apres les edges : %', v::text;
  end if;
  if coalesce((v ->> 'rows_checked')::bigint, 0) < 3 then
    raise exception 'registre trop maigre (% lignes) : les edges n ont pas ecrit',
      v ->> 'rows_checked';
  end if;
end $$;`), 'la chaîne doit rester intacte').not.toThrow()
  })
})
