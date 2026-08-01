// Backend integration spec (live CI) — relevé IA mensuel et dérives
// (migration 20260801320000, étape 20, spec §5.11).
//
// Ce que ce fichier cherche à faire échouer :
//
//   1. LA DÉRIVE QUI NE S'ÉTEINT PAS. « Rien à signaler » doit RÉELLEMENT retirer la dérive
//      du relevé — un bouton qui n'éteint rien est pire que pas de bouton, l'écran répète
//      une alerte qu'on a déjà arbitrée et on cesse de la lire.
//   2. LE SEUIL. 95 % (§7) est le seuil de DÉRIVE, distinct du seuil d'ALERTE
//      (`alert_threshold_pct`, défaut 80) que sert get_admin_quota_breaches. Les confondre
//      ferait remonter en arbitrage ce qui n'est qu'une mise en garde.
//   3. LE MOIS. Les dérives ne vivent que sur le mois EN COURS. Une dérive écartée en
//      juillet doit se represénter en août si elle persiste — sinon on l'enterre.
//   4. CE QUI N'A PAS DE SOURCE est NOMMÉ, pas simulé : `ai_usage_logs` ne porte aucune
//      colonne d'utilisateur, donc la moitié « par compte » de §5.11 n'existe pas.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI — lire le compte de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'
const DENIED = '42501'

const runSql = (body: string) => execSql(`do $$\n${body}\nend $$;`)
const assertSql = (body: string) => expect(() => runSql(body), 'assertion SQL').not.toThrow()

type Row = Record<string, unknown>

describe.skipIf(!HAS_KEYS)('relevé IA mensuel et dérives (étape 20)', () => {
  let setup: TwoAgenciesSetup
  let superClient: SupabaseClient
  const extraUserIds: string[] = []
  let stamp = ''
  let cleDerive = ''

  const releve = async (client?: SupabaseClient): Promise<Row> => {
    const { data, error } = await (client ?? serviceRoleClient()).rpc('get_admin_ai_month', { p_months: 3 })
    if (error) throw new Error(`get_admin_ai_month: ${error.message}`)
    return (data as Row).data as Row
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    stamp = setup.stamp
    cleDerive = `quota_${setup.agencyAId}`
    const svc = serviceRoleClient()
    const email = `aimonth-super-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Super IA ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    extraUserIds.push(data.user!.id)
    const { error: pErr } = await svc.from('profiles').upsert(
      { id: data.user!.id, email, full_name: `Super IA ${stamp}`, role: 'super_admin', agency_id: null },
      { onConflict: 'id' }
    )
    if (pErr) throw new Error(`profile: ${pErr.message}`)
    superClient = anonClient()
    const { error: sErr } = await superClient.auth.signInWithPassword({ email, password: PW })
    if (sErr) throw new Error(`signin: ${sErr.message}`)

    // Un plafond bas et une consommation qui le frôle : l'agence A doit dériver.
    // 9.60 / 10.00 = 96 %, au-dessus du seuil de 95 % et bien au-dessus des 80 %
    // d'ALERTE — c'est ce qui permet de distinguer les deux seuils.
    const { error: qErr } = await svc.from('agency_usage_quotas').upsert(
      { agency_id: setup.agencyAId, ai_monthly_cost_cap_usd: 10, alert_threshold_pct: 80 },
      { onConflict: 'agency_id' }
    )
    if (qErr) throw new Error(`quota: ${qErr.message}`)

    const { error: uErr } = await svc.from('ai_usage_logs').insert([
      { agency_id: setup.agencyAId, edge_function: 'ai-copilot', provider: 'deepseek',
        input_tokens: 1000, output_tokens: 500, estimated_cost_usd: 9.6, module: 'copilot' },
      { agency_id: setup.agencyBId, edge_function: 'ai-copilot', provider: 'deepseek',
        input_tokens: 100, output_tokens: 50, estimated_cost_usd: 0.4, module: 'copilot' },
    ])
    if (uErr) throw new Error(`usage: ${uErr.message}`)
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    await svc.from('ai_usage_logs').delete().in('agency_id', [setup.agencyAId, setup.agencyBId]).then(() => {}, () => {})
    await svc.from('agency_usage_quotas').delete().eq('agency_id', setup.agencyAId).then(() => {}, () => {})
    // ai_drift_dismissals est fermée en écriture : le nettoyage passe par psql.
    runSql(`begin
      delete from public.ai_drift_dismissals where drift_key = '${cleDerive}';`)
    if (setup) await setup.cleanup()
    for (const id of extraUserIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  // ── 1. Le relevé ───────────────────────────────────────────────────────────────

  it('rend les mois, les agences, leur PART et la médiane', async () => {
    const r = await releve()
    expect(Array.isArray(r.months)).toBe(true)
    const mois = (r.months as Row[])[0]
    expect(Object.keys(mois)).toEqual(
      expect.arrayContaining(['month', 'total_cost_usd', 'calls', 'median_agency_cost_usd', 'agencies']))

    const a = (mois.agencies as Row[]).find((x) => x.agency_id === setup.agencyAId)
    expect(a, 'l\'agence A est au relevé du mois courant').toBeTruthy()
    expect(Number(a!.cost_usd)).toBeCloseTo(9.6, 1)
    expect(Number(a!.share_pct), 'la part est calculée ici, pas côté écran')
      .toBeGreaterThan(0)
  })

  it('les parts d\'un mois somment à 100 % — sinon le camembert ment', async () => {
    const r = await releve()
    for (const m of (r.months as Row[])) {
      const parts = (m.agencies as Row[]).reduce((s, a) => s + Number(a.share_pct), 0)
      if ((m.agencies as Row[]).length === 0) continue
      // Tolérance : chaque part est arrondie au dixième, l'écart cumulé reste sous 1 point.
      expect(parts, `mois ${m.month} : les parts somment à ${parts}`).toBeGreaterThan(99)
      expect(parts).toBeLessThan(101)
    }
  })

  it('CE QUI N\'A PAS DE SOURCE est NOMMÉ — la moitié « par compte » de §5.11', async () => {
    // `ai_usage_logs` ne porte aucune colonne d'utilisateur, et toute la chaîne d'écriture
    // est agence : il n'y a rien à agréger par compte, ni rien à rattraper dans le passé.
    // Les fabriquer aurait produit une médiane crédible et fausse.
    const { data } = await serviceRoleClient().rpc('get_admin_ai_month', { p_months: 3 })
    expect(((data as Row).data as Row).unavailable).toEqual(
      expect.arrayContaining(['per_account_median', 'zero_call_accounts', 'per_account_drift']))

    // Le garde-fou du constat : si un jour ai_usage_logs gagne une colonne d'utilisateur,
    // ce test doit rougir pour qu'on retire la mention au lieu de la laisser mentir.
    assertSql(`
    begin
      if exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='ai_usage_logs'
                    and column_name in ('profile_id','user_id','actor_id')) then
        raise exception 'ai_usage_logs porte desormais un utilisateur : la moitie « par compte » de 5.11 devient calculable, retirer unavailable';
      end if;
    `)
  })

  // ── 2. La dérive ───────────────────────────────────────────────────────────────

  it('LE SEUIL — une agence à 96 % de son plafond dérive', async () => {
    const r = await releve()
    const d = (r.drifts as Row[]).find((x) => x.key === cleDerive)
    expect(d, 'l\'agence A consomme 9.60 sur un plafond de 10.00').toBeTruthy()
    expect(Number(d!.pct_of_cap)).toBeCloseTo(96, 0)
    expect(d!.severity).toBe('crit')
  })

  it('le seuil de DÉRIVE (95 %) n\'est pas le seuil d\'ALERTE (80 %)', async () => {
    // Les confondre ferait remonter en arbitrage ce qui n'est qu'une mise en garde.
    // L'agence B est à 0.40 : au-dessus d'aucun seuil, elle ne doit pas dériver.
    const svc = serviceRoleClient()
    await svc.from('agency_usage_quotas').upsert(
      { agency_id: setup.agencyBId, ai_monthly_cost_cap_usd: 10, alert_threshold_pct: 1 },
      { onConflict: 'agency_id' })
    try {
      const r = await releve()
      expect((r.drifts as Row[]).some((x) => x.agency_id === setup.agencyBId),
        'un seuil d\'alerte à 1 % ne doit PAS créer une dérive : la dérive est à 95 % du PLAFOND')
        .toBe(false)
    } finally {
      await svc.from('agency_usage_quotas').delete().eq('agency_id', setup.agencyBId).then(() => {}, () => {})
    }
  })

  it('LA DÉRIVE S\'ÉTEINT — « Rien à signaler » la retire réellement du relevé', async () => {
    // Un bouton qui n'éteint rien est pire que pas de bouton : l'écran répète une alerte
    // qu'on a déjà arbitrée, et on cesse de la lire.
    const svc = serviceRoleClient()
    const mois = new Date().toISOString().slice(0, 8) + '01'

    const { data, error } = await svc.rpc('admin_ai_drift_dismiss', {
      p_month: mois, p_drift_key: cleDerive,
    })
    expect(error).toBeNull()
    expect((data as Row).ok).toBe(true)
    expect(((data as Row).data as Row).was_new, 'premier écartement').toBe(true)

    const apres = await releve()
    expect((apres.drifts as Row[]).some((x) => x.key === cleDerive),
      'la dérive écartée ne doit plus remonter').toBe(false)
  })

  it('l\'écartement est idempotent PAR LA CLÉ PRIMAIRE', async () => {
    // Deux super-admins qui écartent la même dérive doivent converger, pas se doubler :
    // c'est pourquoi la clé (mois, dérive) vaut mieux qu'un jeton fourni par l'appelant.
    const { data } = await serviceRoleClient().rpc('admin_ai_drift_dismiss', {
      p_month: new Date().toISOString().slice(0, 8) + '01', p_drift_key: cleDerive,
    })
    expect((data as Row).ok).toBe(true)
    expect(((data as Row).data as Row).was_new, 'le second écartement n\'insère rien').toBe(false)

    assertSql(`
    declare v_n int;
    begin
      select count(*) into v_n from public.ai_drift_dismissals where drift_key = '${cleDerive}';
      if v_n <> 1 then
        raise exception 'deux ecartements ont produit % lignes', v_n;
      end if;
    `)
  })

  it('LE MOIS — une dérive ne s\'écarte pas sur un mois clos', async () => {
    // Une dérive écartée en juillet doit se represénter en août si elle persiste, sinon on
    // l'enterre. Écarter le passé n'aurait aucun effet visible : autant refuser.
    const { data } = await serviceRoleClient().rpc('admin_ai_drift_dismiss', {
      p_month: '2026-01-01', p_drift_key: cleDerive,
    })
    expect((data as Row).ok).toBe(false)
    expect((data as Row).code).toBe('precondition_failed')
  })

  it('un mois ou une clé manquants sont refusés', async () => {
    const svc = serviceRoleClient()
    const { data: sansMois } = await svc.rpc('admin_ai_drift_dismiss', { p_month: null, p_drift_key: 'x' })
    expect((sansMois as Row).code).toBe('precondition_failed')
    const { data: sansCle } = await svc.rpc('admin_ai_drift_dismiss', {
      p_month: new Date().toISOString().slice(0, 8) + '01', p_drift_key: '  ',
    })
    expect((sansCle as Row).code).toBe('precondition_failed')
  })

  // ── 3. Le journal et la porte ──────────────────────────────────────────────────

  it('chaque écartement est journalisé en famille `ai`', async () => {
    const { data } = await serviceRoleClient().rpc('get_admin_security_journal', {
      p_window: 'today', p_filter: 'ai', p_limit: 100,
    })
    const actions = (data as Row[]).map((l) => String(l.action))
    expect(actions, 'l\'arbitrage doit laisser une trace').toContain('ai_drift_dismissed')
  })

  it('LA NON-FUITE — un JWT agent est refusé, un super-admin passe', async () => {
    const { error: e1 } = await setup.clientA.rpc('get_admin_ai_month', { p_months: 3 })
    expect(e1?.code).toBe(DENIED)
    const { error: e2 } = await setup.clientA.rpc('admin_ai_drift_dismiss', {
      p_month: '2026-08-01', p_drift_key: 'x',
    })
    expect(e2?.code).toBe(DENIED)

    const { error: ok } = await superClient.rpc('get_admin_ai_month', { p_months: 3 })
    expect(ok, 'un super-admin allowlisté doit passer').toBeNull()
  })

  it('la table des écartements est fermée en écriture directe', () => {
    assertSql(`
    begin
      if has_table_privilege('authenticated', 'public.ai_drift_dismissals', 'INSERT')
         or has_table_privilege('service_role', 'public.ai_drift_dismissals', 'INSERT')
         or has_table_privilege('anon', 'public.ai_drift_dismissals', 'SELECT') then
        raise exception 'ai_drift_dismissals est ecrivable hors du chemin prevu';
      end if;
    `)
  })
})
