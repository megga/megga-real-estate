// Backend integration spec (live CI) — `admin_overview()`, la vue d'ensemble en un fetch
// (migration 20260731290000, étape 10 du plan, spec §5.1).
//
// Ce que ce fichier cherche à faire échouer, par ordre d'importance :
//
//   1. LE FILTRE DU JOURNAL. §5.1 exclut la conformité des clients finaux. Écrit
//      `category <> 'kyc'`, le filtre aurait AUSSI écarté toutes les lignes de catégorie
//      NULL — c'est-à-dire 95 % de la table (décision PO n° 6, non rattrapable). Le journal
//      se serait vidé en silence, en croyant ne retirer que le KYC. Le test sème les deux
//      cas et vérifie qu'ils sont traités différemment.
//   2. LA COHÉRENCE DES COMPTEURS. Critère de sortie du gate G1 : « compteurs Vue
//      d'ensemble = sommes des tables, zéro contradiction ». Les KPI et le revenu doivent
//      égaler leurs sources, pas les approcher.
//   3. LA NON-FUITE. Aucun nom de client final, nulle part dans l'objet — et un JWT agent
//      refusé.
//
// ⚠ CLIENT CHOISI D'APRÈS LA GARDE : `is_super_admin() OR is_service_role()`, sans branche
// `session_user`. La RPC ne s'éprouve donc pas depuis psql, où session_user vaut toujours
// `postgres`. `execSql` ne sert ici qu'à SEMER.
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

type Row = Record<string, unknown>

describe.skipIf(!HAS_KEYS)('admin_overview() — un objet, un fetch (étape 10)', () => {
  let setup: TwoAgenciesSetup
  let superClient: SupabaseClient
  const extraUserIds: string[] = []

  const overview = async (client?: SupabaseClient): Promise<Row> => {
    const { data, error } = await (client ?? serviceRoleClient()).rpc('admin_overview')
    if (error) throw new Error(`admin_overview: ${error.message}`)
    return data as Row
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()
    const email = `overview-super-${setup.stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Super Overview ${setup.stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    extraUserIds.push(data.user!.id)
    const { error: pErr } = await svc.from('profiles').upsert(
      { id: data.user!.id, email, full_name: `Super Overview ${setup.stamp}`, role: 'super_admin', agency_id: null },
      { onConflict: 'id' }
    )
    if (pErr) throw new Error(`profile: ${pErr.message}`)
    superClient = anonClient()
    const { error: sErr } = await superClient.auth.signInWithPassword({ email, password: PW })
    if (sErr) throw new Error(`signin: ${sErr.message}`)
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (setup) await setup.cleanup()
    for (const id of extraUserIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  // ── 1. La forme ────────────────────────────────────────────────────────────────

  it('rend les sept blocs de §5.1 en un seul appel', async () => {
    const o = await overview()
    for (const k of ['pulse', 'kpis', 'signals', 'journal', 'activation', 'kyc_funnel', 'revenue']) {
      expect(Object.keys(o), `bloc « ${k} » attendu par §5.1`).toContain(k)
    }
    expect(Array.isArray(o.signals), 'signals est une liste').toBe(true)
    expect(Array.isArray(o.journal), 'journal est une liste').toBe(true)
  })

  // ── 2. Le filtre du journal — le test central ──────────────────────────────────

  it('LE FILTRE — une ligne SANS catégorie reste au journal, une ligne `kyc` en sort', async () => {
    // Les deux événements sont semés à l'instant, donc en tête du flux : get_admin_live_feed
    // n'en rend que 40, et des specs tournent en parallèle.
    //
    // Si quelqu'un « simplifie » `is distinct from 'kyc'` en `<> 'kyc'`, la ligne sans
    // catégorie disparaît — et avec elle 95 % du journal réel, sans aucune erreur.
    // activity_events refuse UPDATE comme DELETE : ces deux lignes ne sont pas nettoyables,
    // d'où un libellé qui porte le stamp pour rester identifiable.
    const marqueur = `overview-${setup.stamp}`
    runSql(`begin
      insert into public.activity_events (agency_id, action, entity_type, category, object_label)
        values ('${setup.agencyAId}'::uuid, 'contact_created', 'contact', null, 'sans-cat ${marqueur}');
      insert into public.activity_events (agency_id, action, entity_type, category, object_label)
        values ('${setup.agencyAId}'::uuid, 'kyc_validated', 'contact', 'kyc', 'kyc ${marqueur}');`)

    const o = await overview()
    const labels = (o.journal as Row[]).map((r) => String(r.object_label ?? ''))

    expect(labels.some((l) => l.includes(`sans-cat ${marqueur}`)),
      'une ligne de catégorie NULL doit rester : `<>` l\'aurait écartée avec 95 % du journal')
      .toBe(true)
    expect(labels.some((l) => l.includes(`kyc ${marqueur}`)),
      'la conformité d\'un client final n\'a rien à faire sur cet écran (§5.1)')
      .toBe(false)
  })

  it('AUCUNE ligne du journal n\'est de catégorie `kyc`', async () => {
    // L'invariant, en plus du cas semé : il tient quel que soit le contenu de la base.
    const o = await overview()
    for (const r of (o.journal as Row[])) {
      expect(r.category, `ligne « ${r.object_label} » : le KYC client final est exclu`).not.toBe('kyc')
    }
  })

  // ── 3. La cohérence des compteurs (critère G1) ─────────────────────────────────

  it('les KPI égalent leur source — zéro contradiction', async () => {
    const svc = serviceRoleClient()
    const o = await overview()
    const { data: stats } = await svc.rpc('get_admin_dashboard_stats')
    const s = (stats as Row[])[0]
    const k = o.kpis as Row

    expect(Number(k.agencies)).toBe(Number(s.active_agencies))
    expect(Number(k.users)).toBe(Number(s.total_users))
    expect(Number(k.properties)).toBe(Number(s.active_properties))
    expect(Number(k.transactions)).toBe(Number(s.active_transactions))
    expect(Number(k.new_agencies_this_month)).toBe(Number(s.new_agencies_this_month))
  })

  it('le revenu égale le poste de triage — une seule règle de MRR', async () => {
    // §4.3 : le MRR n'est « jamais recalculé côté front », donc jamais recalculé ici non
    // plus. La Vue d'ensemble et l'écran Plans doivent afficher le MÊME chiffre.
    const o = await overview()
    const { data: board } = await serviceRoleClient().rpc('get_admin_plans_board')
    const b = board as Row
    const r = o.revenue as Row

    expect(Number(r.mrr), 'le MRR de la Vue d\'ensemble = celui de Plans').toBe(Number(b.mrr))
    expect(Number((o.kpis as Row).mrr), 'le KPI et le bloc revenu portent le même MRR').toBe(Number(b.mrr))
    expect(Number(r.subscriptions)).toBe(Number(b.subscriptions))
    expect(Number(r.failed), 'les paiements échoués = la file des impayés')
      .toBe((b.queues as Row).unpaid ? ((b.queues as Row).unpaid as unknown[]).length : 0)
  })

  // ── 4. Le pouls et les signaux ─────────────────────────────────────────────────

  it('le pouls est dérivé, jamais affirmé', async () => {
    const o = await overview()
    const p = o.pulse as Row
    // « Plateforme saine » ne doit pas pouvoir contredire les compteurs qui l'accompagnent :
    // l'écran affiche les deux côte à côte.
    expect(p.healthy, 'healthy = aucune fonction en erreur ET aucun cron en échec')
      .toBe(Number(p.functions_err) === 0 && Number(p.crons_failed) === 0)
    expect(Number(p.functions_err)).toBeGreaterThanOrEqual(0)
    expect(Number(p.crons_failed)).toBeGreaterThanOrEqual(0)
  })

  it('les signaux suivent leurs sources, et le KYB a droit de cité', async () => {
    const svc = serviceRoleClient()
    const o = await overview()
    const kinds = (o.signals as Row[]).map((s) => String(s.kind))

    // §5.13 : les dossiers KYB concernent les agences CLIENTES, pas les clients finaux —
    // c'est ce qui leur donne droit de cité sur un écran d'où la conformité est bannie.
    const { data: q } = await svc.rpc('get_admin_agency_review_queue', { p_limit: 1, p_offset: 0 })
    const enRevue = Number(((q as Row[])[0]?.total_count) ?? 0)
    expect(kinds.includes('kyb_review'), `signal KYB attendu ssi la file est non vide (${enRevue})`)
      .toBe(enRevue > 0)

    // Aucun signal ne doit porter sur la conformité d'un client final.
    for (const s of (o.signals as Row[])) {
      expect(['functions_error', 'payments_failed', 'kyb_review'],
        `signal inattendu : ${s.kind}`).toContain(String(s.kind))
    }
  })

  it('ce qui n\'a pas de source est NOMMÉ, pas simulé', async () => {
    // Mesuré à l'étape 10 : aucun système de tickets n'existe (ni table, ni un seul
    // événement `ticket_created` depuis la création d'activity_events), et le « retard »
    // d'un cron exigerait d'interpréter son planning. Les deux sont déclarés.
    const o = await overview()
    expect(o.unavailable).toEqual(expect.arrayContaining(['support_tickets', 'crons_late']))
    const kinds = (o.signals as Row[]).map((s) => String(s.kind))
    expect(kinds, 'un signal « tickets » serait fabriqué').not.toContain('support_tickets')
  })

  // ── 5. Le tunnel KYC : des comptes, jamais des noms ────────────────────────────

  it('LA NON-FUITE — le tunnel KYC ne porte que des comptes', async () => {
    const o = await overview()
    const f = o.kyc_funnel as Row
    for (const k of Object.keys(f)) {
      expect(['links_sent', 'links_opened', 'links_submitted', 'links_expired', 'conversion_pct'],
        `champ « ${k} » inattendu dans le tunnel`).toContain(k)
      if (f[k] !== null) expect(Number.isFinite(Number(f[k])), `« ${k} » doit être un nombre`).toBe(true)
    }
    // Le taux reste borné même quand rien n'a été envoyé : une division par zéro
    // afficherait « NaN % » sur la page d'accueil de la console.
    expect(Number(f.conversion_pct)).toBeGreaterThanOrEqual(0)
    expect(Number(f.conversion_pct)).toBeLessThanOrEqual(100)
  })

  // ── 6. La porte ────────────────────────────────────────────────────────────────

  it('LA NON-FUITE — un JWT agent est refusé, un super-admin passe', async () => {
    const { error } = await setup.clientA.rpc('admin_overview')
    expect(error?.code, 'la garde refuse un JWT agent').toBe(DENIED)

    // Le pendant : une garde qui refuserait tout le monde serait verte au-dessus et
    // inutile en production.
    const { error: ok } = await superClient.rpc('admin_overview')
    expect(ok, 'un super-admin allowlisté doit passer').toBeNull()
  })
})
