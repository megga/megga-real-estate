// Backend spec (live CI) — les huit gestes super-admin écrivent au REGISTRE (`admin_log`).
//
// POURQUOI CE FICHIER EXISTE. Le critère 2 du gate G2 exige « un geste par écran démontré de
// bout en bout : UI → RPC → ligne visible dans Sécurité avec metadata ». L'écran Sécurité lit
// `admin_log`. Jusqu'au 02.08.2026 ces huit RPC journalisaient dans `activity_events` — le
// journal des AGENCES, sans chaîne d'empreintes — et le critère ne pouvait donc pas passer.
//
// `admin-gestes-sweep.spec.ts` porte déjà le contrôle STATIQUE (« le corps de la fonction
// appelle admin_log_write »). Il ne suffit pas : un appel présent dans la source n'est pas
// une LIGNE en base. Une famille hors du référentiel lèverait `23503`, un flottant dans les
// paires lèverait `22023`, une valeur nulle romprait la cohérence acteur — trois façons
// d'avoir la bonne source et rien au registre. Ce fichier mesure le RÉSULTAT.
//
// CE QUI EST DÉLIBÉRÉMENT VÉRIFIÉ ICI, ET QUI CASSE SI ON L'ENLÈVE :
//   1. la ligne existe, dans la bonne famille, avec ses paires ;
//   2. l'acteur est NOMMÉ — jamais « Système » sous un JWT super-admin ;
//   3. le motif d'un rejet vit AUSSI dans le registre : un auditeur qui lit `admin_log` n'a
//      pas à joindre le journal de l'agence pour savoir pourquoi ;
//   4. un plafond DÉCIMAL passe (`->>`, donc du texte) — c'est le piège `22023` nommé dans le
//      handoff, et le seul geste qui porte un `numeric` ;
//   5. un REFUS lève et n'écrit rien — les cinq appelants front ne lisent que `error`, donc
//      un `return admin_error(...)` au lieu d'une levée serait un échec SILENCIEUX à l'écran ;
//   6. `activity_events` continue d'être écrit — la fiche de revue KYB y lit ses motifs ;
//   7. la chaîne d'empreintes reste vérifiable après ces écritures.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : lire le COMPTE de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'

/** Une paire de metadata du registre : tableau ORDONNÉ, jamais un objet (§4.2). */
interface Pair { l: string; v: string }

/** Une ligne du registre, réduite à ce que ce fichier interroge. */
interface LigneRegistre {
  family: string
  action: string
  severity: string
  actor_label: string
  actor_user_id: string | null
  entity_type: string
  entity_id: string
  entity_label: string
  agency_id: string | null
  metadata: Pair[]
  seq: number
}

describe.skipIf(!HAS_KEYS)('les gestes super-admin laissent une ligne au registre MEGGA', () => {
  const agencyIds: string[] = []
  const userIds: string[] = []
  let superAdmin: SupabaseClient
  let superAdminId: string
  let superAdminLabel: string

  beforeAll(async () => {
    const svc = serviceRoleClient()
    // Même idiome que les specs KYB voisines : l'allowlist super-admin est une donnée de
    // configuration, et `is_super_admin()` exige le rôle ET l'e-mail allowlisté.
    const { error: cfgErr } = await svc
      .from('app_config')
      .upsert({ key: 'super_admin_test_domain', value: '@megga-test.local' }, { onConflict: 'key' })
    if (cfgErr) throw new Error(`app_config: ${cfgErr.message}`)

    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `registre-super-${stamp}@megga-test.local`
    superAdminLabel = `Super Registre ${stamp}`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: superAdminLabel, role: 'agent' },
    })
    if (error) throw new Error(`createUser super: ${error.message}`)
    superAdminId = data.user!.id
    userIds.push(superAdminId)
    const { error: pErr } = await svc.from('profiles').upsert(
      { id: superAdminId, email, full_name: superAdminLabel, role: 'super_admin', agency_id: null },
      { onConflict: 'id' },
    )
    if (pErr) throw new Error(`profile super: ${pErr.message}`)

    superAdmin = anonClient()
    const { error: sErr } = await superAdmin.auth.signInWithPassword({ email, password: PW })
    if (sErr) throw new Error(`signin super: ${sErr.message}`)
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    // `admin_log` est append-only par construction (trois triggers de refus) : ses lignes ne
    // se nettoient PAS, et c'est voulu. La base de CI est fraîche à chaque run.
    for (const id of agencyIds) await svc.from('agencies').delete().eq('id', id).then(() => {}, () => {})
    for (const id of userIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  /** Un dossier soumis et en attente de revue : l'état dans lequel un relecteur le trouve. */
  async function agenceEnRevue(label: string): Promise<{ id: string; nom: string }> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${label}`
    const nom = `Registre Legale ${stamp}`
    const { data, error } = await svc
      .from('agencies')
      .insert({
        name: `Agence Registre ${stamp}`,
        slug: `agence-registre-${stamp}`,
        legal_name: nom,
        country: 'FR',
        identity_submitted_at: new Date().toISOString(),
        verification_status: 'manual_review',
      })
      .select('id')
      .single()
    if (error) throw new Error(`agence ${label}: ${error.message}`)
    agencyIds.push(data.id)
    // `legal_name` prime sur `name` dans coalesce(legal_name, name) — c'est ce libellé-là
    // que le registre doit porter.
    return { id: data.id, nom }
  }

  /**
   * Lit le registre AVEC LE JWT SUPER-ADMIN, jamais avec la clé de service.
   * `service_role` n'échappe pas aux GRANT : le SELECT lui est révoqué sur `admin_log`, et
   * une lecture révoquée rend `null` SANS erreur — le test serait vert sur du vide.
   */
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

  /** La valeur d'une paire, par son libellé — l'ordre est garanti, la recherche reste lisible. */
  const paire = (l: LigneRegistre, label: string): string | undefined =>
    l.metadata.find((p) => p.l === label)?.v

  // ── 1. Les cinq décisions KYB — famille `kyb` ────────────────────────────────────────

  it('admin_validate_agency_review écrit une ligne `kyb`, avec un acteur NOMMÉ', async () => {
    const agence = await agenceEnRevue('validate')
    const { data, error } = await superAdmin.rpc('admin_validate_agency_review', { p_agency_id: agence.id })
    expect(error, 'le geste doit passer sous un JWT super-admin').toBeNull()
    // Enveloppe §10.1 : le retour est passé de `void` à `jsonb` en entrant dans le périmètre
    // des GESTES. Un `void` rendrait `null` ici.
    expect(data, 'enveloppe §10.1 attendue').toMatchObject({ ok: true })

    const l = await lignes(agence.id, 'agency_verification_validated')
    expect(l, 'exactement une ligne de registre pour cette décision').toHaveLength(1)
    expect(l[0].family).toBe('kyb')
    expect(l[0].severity).toBe('info')
    expect(l[0].entity_type).toBe('agency')
    expect(l[0].entity_label, 'legal_name prime sur name').toBe(agence.nom)
    expect(l[0].agency_id).toBe(agence.id)

    // L'ACTEUR. admin_log_write le dérive d'auth.uid() : sous un JWT super-admin il doit
    // porter le nom du relecteur. « Système » ici signalerait une perte du contexte JWT
    // (appel par clé de service), c'est-à-dire une décision humaine attribuée à la machine.
    expect(l[0].actor_user_id).toBe(superAdminId)
    expect(l[0].actor_label).toBe(superAdminLabel)

    // Les paires : tableau ORDONNÉ de {l, v}, jamais un objet.
    expect(Array.isArray(l[0].metadata)).toBe(true)
    expect(l[0].metadata.every((p) => typeof p.l === 'string' && typeof p.v === 'string')).toBe(true)
    expect(paire(l[0], 'Décision')).toBe('Validée')
    expect(paire(l[0], 'Statut précédent')).toBe('manual_review')
    expect(paire(l[0], 'Statut')).toBe('validated')
  })

  it('admin_reject_agency_review porte le MOTIF dans le registre, pas seulement dans activity_events', async () => {
    const agence = await agenceEnRevue('reject')
    const motif = 'Pièce d’identité illisible — registre'
    const { error } = await superAdmin.rpc('admin_reject_agency_review', {
      p_agency_id: agence.id, p_reason: motif,
    })
    expect(error).toBeNull()

    const l = await lignes(agence.id, 'agency_verification_rejected')
    expect(l).toHaveLength(1)
    expect(l[0].family).toBe('kyb')
    expect(l[0].severity, 'un rejet est un fait à surveiller').toBe('warn')
    // LE point de ce test : le registre MEGGA doit se suffire à lui-même. Un auditeur qui
    // lit `admin_log` dans deux ans n'a pas à joindre le journal de l'agence pour savoir
    // POURQUOI un dossier a été rejeté.
    expect(paire(l[0], 'Motif')).toBe(motif)
    expect(paire(l[0], 'Décision')).toBe('Rejetée')
    expect(paire(l[0], 'Statut')).toBe('rejected')

    // Non-régression : `activity_events` reste écrit. La fiche de revue KYB y lit le motif
    // (decisionReasonFromEvent), et l'agence a le droit de voir ce qui lui arrive. Ce n'est
    // pas un déplacement de journal, c'est un ajout.
    const svc = serviceRoleClient()
    const { data: evts } = await svc
      .from('activity_events')
      .select('action, metadata')
      .eq('entity_id', agence.id)
      .eq('action', 'agency_verification_rejected')
    expect(evts ?? [], 'le journal de l’agence reste alimenté').toHaveLength(1)
  })

  it('admin_request_agency_correction dit au registre que le dossier est ROUVERT', async () => {
    const agence = await agenceEnRevue('correction')
    const motif = 'Compléter l’adresse du siège'
    const { error } = await superAdmin.rpc('admin_request_agency_correction', {
      p_agency_id: agence.id, p_reason: motif,
    })
    expect(error).toBeNull()

    const l = await lignes(agence.id, 'agency_verification_correction_requested')
    expect(l).toHaveLength(1)
    expect(l[0].family).toBe('kyb')
    expect(paire(l[0], 'Motif')).toBe(motif)
    // Ce fait ne se déduit PAS du statut, et c'est ce qui distingue une correction d'un
    // rejet : elle remet identity_submitted_at à NULL, ce qui rouvre le parcours
    // d'onboarding et dégèle les colonnes d'identité légale.
    expect(paire(l[0], 'Dossier rouvert')).toBe('oui')
  })

  it('admin_relaunch_agency_review journalise APRÈS le moteur, avec l’état obtenu', async () => {
    const agence = await agenceEnRevue('relaunch')
    const { error } = await superAdmin.rpc('admin_relaunch_agency_review', { p_agency_id: agence.id })
    expect(error).toBeNull()

    const l = await lignes(agence.id, 'agency_verification_relaunch_requested')
    expect(l).toHaveLength(1)
    expect(l[0].family).toBe('kyb')
    expect(paire(l[0], 'Statut avant')).toBe('manual_review')
    // « Statut après » n'existe QUE si la ligne est écrite après recompute_agency_verification.
    // C'est aussi l'ordre qu'impose §10.2 amendé : le verrou de chaîne est pris en dernier et
    // tenu jusqu'au COMMIT, donc jamais pendant le recalcul.
    expect(paire(l[0], 'Statut après'), 'l’état APRÈS moteur doit être relevé').toBeDefined()
    const svc = serviceRoleClient()
    const { data: apres } = await svc
      .from('agencies').select('verification_status').eq('id', agence.id).single()
    expect(paire(l[0], 'Statut après')).toBe(apres!.verification_status)
  })

  // ── 2. Le rôle d'un compte — famille `identity` ──────────────────────────────────────

  it('admin_set_user_role écrit une ligne `identity` — pas `lifecycle`', async () => {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `registre-cible-${stamp}@megga-test.local`
    const { data: created, error: cErr } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Cible ${stamp}`, role: 'agent' },
    })
    if (cErr) throw new Error(`createUser cible: ${cErr.message}`)
    const cibleId = created.user!.id
    userIds.push(cibleId)
    await svc.from('profiles').upsert(
      { id: cibleId, email, full_name: `Cible ${stamp}`, role: 'agent', agency_id: null },
      { onConflict: 'id' },
    )

    const { error } = await superAdmin.rpc('admin_set_user_role', { p_user_id: cibleId, p_role: 'manager' })
    expect(error).toBeNull()

    const l = await lignes(cibleId, 'role_changed')
    expect(l).toHaveLength(1)
    // `identity` et non `lifecycle` : un rôle dit les DROITS d'un compte, son cycle de vie
    // (actif / suspendu) appartient aux edge functions admin-*-lifecycle. Les confondre
    // aurait laissé la famille `identity` définitivement vide.
    expect(l[0].family).toBe('identity')
    expect(l[0].entity_type).toBe('profile')
    expect(paire(l[0], 'Rôle précédent')).toBe('agent')
    expect(paire(l[0], 'Nouveau rôle')).toBe('manager')
    expect(paire(l[0], 'Effet')).toBe('rôle modifié')
  })

  it('admin_set_user_role journalise MÊME quand le rôle ne change pas', async () => {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `registre-noop-${stamp}@megga-test.local`
    const { data: created, error: cErr } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `NoOp ${stamp}`, role: 'agent' },
    })
    if (cErr) throw new Error(`createUser noop: ${cErr.message}`)
    const cibleId = created.user!.id
    userIds.push(cibleId)
    await svc.from('profiles').upsert(
      { id: cibleId, email, full_name: `NoOp ${stamp}`, role: 'agent', agency_id: null },
      { onConflict: 'id' },
    )

    const { error } = await superAdmin.rpc('admin_set_user_role', { p_user_id: cibleId, p_role: 'agent' })
    expect(error).toBeNull()

    // `activity_events` reste CONDITIONNEL (il raconte ce qui est arrivé au compte : rien).
    // Le registre, lui, répond à « qu'a fait le super-admin » — et un geste posé sans effet
    // reste un geste posé. Son absence laisserait un trou inexplicable entre deux lignes.
    const l = await lignes(cibleId, 'role_changed')
    expect(l, 'le registre garde la trace du geste, pas seulement de son effet').toHaveLength(1)
    expect(paire(l[0], 'Effet')).toBe('rôle inchangé')
  })

  // ── 3. Plan et quotas — famille `plans` ──────────────────────────────────────────────

  it('admin_set_agency_plan écrit une ligne `plans` qui nomme l’override manuel', async () => {
    const agence = await agenceEnRevue('plan')
    const { error } = await superAdmin.rpc('admin_set_agency_plan', {
      p_agency_id: agence.id, p_plan: 'pro', p_status: 'active', p_note: 'Compte partenaire',
    })
    expect(error).toBeNull()

    const l = await lignes(agence.id, 'subscription_changed')
    expect(l).toHaveLength(1)
    expect(l[0].family).toBe('plans')
    expect(l[0].entity_label, 'l’écran Sécurité affiche une entité lisible, pas un uuid').toBe(agence.nom)
    expect(paire(l[0], 'Nouveau plan')).toBe('pro')
    // La vraie information de conformité : cette RPC contourne Stripe, et un webhook
    // ultérieur peut la défaire.
    expect(paire(l[0], 'Override manuel')).toBe('oui')
    expect(paire(l[0], 'Note')).toBe('Compte partenaire')

    const svc = serviceRoleClient()
    await svc.from('subscriptions').delete().eq('agency_id', agence.id).then(() => {}, () => {})
  })

  it('admin_set_agency_quotas accepte un plafond DÉCIMAL — le piège 22023 du hash de chaîne', async () => {
    const agence = await agenceEnRevue('quotas')
    // 12.5 part comme un NOMBRE JSON, exactement comme le fait useSetAgencyQuotas depuis
    // l'écran. C'est le seul geste des huit qui porte un `numeric`. Si la fonction relayait
    // cette valeur en jsonb (`->`) au lieu de la lire en texte (`->>`), admin_log_write
    // lèverait `22023` — le hash de chaîne porte sur le TEXTE du jsonb, et une
    // re-sérialisation différente romprait la chaîne sans qu'aucune donnée n'ait bougé.
    // Ce test rougit donc sur la régression exacte que le handoff nommait.
    const { error } = await superAdmin.rpc('admin_set_agency_quotas', {
      p_agency_id: agence.id,
      p_quotas: { ai_monthly_cost_cap_usd: 12.5, active_properties_cap: 40, alert_threshold_pct: 75 },
      p_note: 'Palier négocié',
    })
    expect(error, 'un flottant ne doit PAS faire échouer le geste').toBeNull()

    const l = await lignes(agence.id, 'quota_changed')
    expect(l).toHaveLength(1)
    expect(l[0].family).toBe('plans')
    expect(paire(l[0], 'Plafond IA (USD/mois)'), 'la valeur est rendue en TEXTE').toBe('12.5')
    expect(paire(l[0], 'Seuil d’alerte (%)')).toBe('75')
    expect(paire(l[0], 'Quotas antérieurs')).toBe('aucun (première pose)')

    // Et la paire décimale est bien du TEXTE dans le jsonb stocké, pas un nombre : c'est la
    // propriété que la garde d'admin_log_write protège.
    const brut = l[0].metadata.find((p) => p.l === 'Plafond IA (USD/mois)')
    expect(typeof brut!.v).toBe('string')
  })

  // ── 4. Ce qu'un REFUS doit faire (et ne pas faire) ───────────────────────────────────

  it('un refus LÈVE et n’écrit rien au registre — jamais une enveloppe d’erreur', async () => {
    const agence = await agenceEnRevue('refus')
    // Motif vide : refusé par la RPC. Ce refus doit arriver à l'écran comme une ERREUR.
    const { data, error } = await superAdmin.rpc('admin_reject_agency_review', {
      p_agency_id: agence.id, p_reason: '   ',
    })
    // LE point : les cinq appelants front (callRpc de useAdminKybReview, et les quatre
    // supabase.rpc des écrans Plans / Facturation / Quotas / Utilisateurs) ne lisent QUE
    // `error` et jettent `data`. Un `return admin_error(...)` au lieu d'une levée rendrait
    // `error` NULL : le geste paraîtrait réussi alors qu'il n'a rien fait.
    expect(error, 'un refus métier doit rester une levée, pas une enveloppe').not.toBeNull()
    expect(data).toBeNull()

    // Et la levée annule tout : aucune ligne, ni au registre ni au journal de l'agence.
    expect(await lignes(agence.id)).toHaveLength(0)
  })

  it('un agent simple n’atteint jamais le registre par ces gestes', async () => {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `registre-agent-${stamp}@megga-test.local`
    const { data: created, error: cErr } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Agent ${stamp}`, role: 'agent' },
    })
    if (cErr) throw new Error(`createUser agent: ${cErr.message}`)
    userIds.push(created.user!.id)
    const agent = anonClient()
    const { error: sErr } = await agent.auth.signInWithPassword({ email, password: PW })
    if (sErr) throw new Error(`signin agent: ${sErr.message}`)

    const agence = await agenceEnRevue('agent')
    const { error } = await agent.rpc('admin_validate_agency_review', { p_agency_id: agence.id })
    expect(error?.code, 'la garde is_super_admin() doit refuser').toBe('42501')
    expect(await lignes(agence.id)).toHaveLength(0)
  })

  // ── 5. La chaîne d'empreintes tient après tout ça ────────────────────────────────────

  it('la chaîne d’empreintes reste vérifiable après les écritures des gestes', () => {
    // `admin_log_verify_chain` n'est PAS accordée à `authenticated` ; sa garde admet en
    // revanche session_user in ('postgres','supabase_admin') — c'est-à-dire exactement le
    // rôle sous lequel execSql tourne. C'est le seul canal qui l'atteint depuis les tests.
    //
    // ⚠ Le verdict s'appelle `status`, et `no_rows` en est une valeur À PART ENTIÈRE : la
    // fonction refuse explicitement de rendre 'ok' sur zéro ligne (« une marche sur zéro
    // ligne ne rencontre aucune rupture »). Tester `<> 'broken'` aurait donc rendu ce test
    // VERT sur un registre vide — c'est-à-dire précisément dans le cas où les huit gestes
    // n'auraient rien écrit. D'où les deux assertions : le statut ET le compte.
    expect(() => execSql(`do $$
declare v jsonb;
begin
  v := public.admin_log_verify_chain(null, null);
  if (v ->> 'status') <> 'ok' then
    raise exception 'chaine admin_log non verifiee apres les gestes : %', v::text;
  end if;
  if coalesce((v ->> 'rows_checked')::bigint, 0) < 8 then
    raise exception 'registre trop maigre (% lignes) : les gestes n ont pas ecrit',
      v ->> 'rows_checked';
  end if;
end $$;`), 'la chaîne doit rester intacte ET porter les lignes des gestes').not.toThrow()
  })
})
