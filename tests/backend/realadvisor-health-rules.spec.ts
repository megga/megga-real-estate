// Règles d'alerte de realadvisor_health_check() — spec live.
//
// Ce qui est vérifié, et pourquoi
// -----------------------------------------------------------------------------
// Migration 20260729170000 : la règle E (`mass_removal`, seuil ABSOLU de 1000
// retraits) part, la règle H (taux de résurrection du revive) arrive.
//
// E alertait sur une grandeur bornée par un plafond qui suit le vivier
// (min(1200, 3 % du live)). Tant que le live tenait ~26 000, le plafond valait
// ~780 et le seuil de 1000 était inatteignable ; à ~44 000 de live le plafond
// vaut 1200 et l'inflow naturel ~1200, donc l'alerte partait TOUTES LES NUITS
// (5 fois en 6 jours) sur le régime normal. H surveille à la place le vrai
// symptôme des faux absents : la part des `removed` que RA ressert vivants.
//
// Les trois cas ci-dessous encadrent exactement ce basculement :
//   1. taux 5 % sur 1000 sondés            → 'resurrection_rate_high' PRÉSENT
//   2. taux 1 % + sweep à 1200 retirés     → ni 'resurrection_rate_high' ni 'mass_removal'
//   3. taux 20 % mais 100 sondés seulement → silencieux (plancher de 200)
//
// Le cas 2 est la non-régression qui compte : 1200 retirés déclenchaient E hier
// et ne doivent plus rien déclencher. Un test négatif seul serait creux (une
// fonction qui ne renvoie jamais de code le passerait) — le cas 1 prouve que la
// fonction produit bien des codes sur le même jeu de données, et le cas 2
// vérifie en plus que la liste renvoyée n'est pas vide (les autres règles, elles,
// tirent sur une base de CI sans crons).
//
// realadvisor_health_check() lit l'état GLOBAL de realadvisor_sync_runs sur des
// fenêtres de 26-74h. Sur une base de CI neuve, d'autres règles (fresh_stalled,
// probe_stopped…) tirent forcément : on n'assert donc jamais sur le NOMBRE de
// codes, seulement sur la présence/absence de ceux qu'on teste.
//
// ⚠ `cron_inactive` n'en fait PAS partie : pg_cron n'est pas installé sur la base
// de CI (contrairement à ce qu'affirme le commentaire d'en-tête de
// cron-health.spec.ts, dont le test se garde de toute façon). C'est ce qui a fait
// échouer la première version de cette spec — la fonction levait « relation
// "cron.job" does not exist » avant d'arriver à ses règles. La même migration
// garde donc cette règle derrière un test d'existence du schéma `cron`.
//
// La fonction poste un mail via net.http_post quand il y a au moins une alerte.
// pg_net met la requête en FILE et ne la joue pas en ligne (même motif que
// agency-verification-run.spec.ts) : depuis le conteneur Postgres de CI la
// connexion échoue sans faire échouer l'appel. Aucun mail n'est réellement émis.
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips cleanly locally.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

type HealthResult = {
  status: 'ok' | 'alert' | 'disabled'
  alerts?: number
  codes?: string[]
}

describe.skipIf(!HAS_KEYS)('realadvisor_health_check — règles E (retirée) et H (résurrection)', () => {
  // Client construit à la DEMANDE, jamais dans le corps du describe : celui-ci
  // s'évalue même sous skipIf, et serviceRoleClient() lève sans les clés — la
  // suite entière tomberait en échec localement au lieu d'être sautée.
  let svc: ReturnType<typeof serviceRoleClient>
  const seededIds: string[] = []
  let startedAt: string

  /** Insère une ligne de run et retient son id pour le teardown. */
  async function seedRun(row: {
    trigger_source: string
    status: string
    total_seen?: number
    total_updated?: number
    total_removed?: number
  }): Promise<void> {
    // Insertion UNITAIRE et jamais en lot : PostgREST prend l'UNION des clés d'un
    // lot et pose NULL sur celles qui manquent à une ligne, ce qui casse l'insert
    // entier sur une colonne NOT NULL DEFAULT.
    const { data, error } = await svc
      .from('realadvisor_sync_runs')
      .insert({
        offer_type: 'buy',
        trigger_source: row.trigger_source,
        status: row.status,
        ended_at: new Date().toISOString(),
        total_seen: row.total_seen ?? 0,
        total_updated: row.total_updated ?? 0,
        total_removed: row.total_removed ?? 0,
      })
      .select('id')
      .single()
    // Un seed avalé en silence rendrait toute la suite verte sans rien prouver.
    if (error) throw new Error(`seed ${row.trigger_source}/${row.status}: ${error.message}`)
    seededIds.push((data as { id: string }).id)
  }

  /** Vide les lignes de revive/sweep semées, pour repartir d'un état connu. */
  async function clearSeeded(): Promise<void> {
    if (seededIds.length === 0) return
    const { error } = await svc.from('realadvisor_sync_runs').delete().in('id', seededIds)
    if (error) throw new Error(`teardown seeds: ${error.message}`)
    seededIds.length = 0
  }

  async function runHealthCheck(): Promise<HealthResult> {
    const { data, error } = await svc.rpc('realadvisor_health_check')
    if (error) throw new Error(`rpc realadvisor_health_check: ${error.message}`)
    return data as HealthResult
  }

  beforeAll(() => {
    svc = serviceRoleClient()
    startedAt = new Date(Date.now() - 1000).toISOString()
  })

  afterAll(async () => {
    await clearSeeded()
    // Chaque appel écrit sa propre ligne 'cron-health' : on la retire aussi.
    await svc
      .from('realadvisor_sync_runs')
      .delete()
      .eq('trigger_source', 'cron-health')
      .gte('ended_at', startedAt)
      .then(() => {}, () => {})
  })

  it('taux de résurrection à 5 % → alerte resurrection_rate_high', async () => {
    await seedRun({ trigger_source: 'cron-revive', status: 'completed', total_seen: 1000, total_updated: 50 })

    const res = await runHealthCheck()

    expect(res.status).toBe('alert')
    expect(res.codes ?? []).toContain('resurrection_rate_high')
  })

  it('taux à 1 % avec 1200 retraits → ni resurrection_rate_high, ni mass_removal', async () => {
    await clearSeeded()
    await seedRun({ trigger_source: 'cron-revive', status: 'completed', total_seen: 1000, total_updated: 10 })
    // 1200 retirés = le plafond dur, exactement ce qui déclenchait E chaque nuit.
    await seedRun({ trigger_source: 'cron-probe-sweep', status: 'capped', total_seen: 44000, total_removed: 1200 })

    const res = await runHealthCheck()

    expect(res.codes ?? []).not.toContain('resurrection_rate_high')
    // La non-régression du chantier : E n'existe plus, aucun volume de retrait ne
    // peut plus produire ce code.
    expect(res.codes ?? []).not.toContain('mass_removal')
    // Garde anti-test-creux : la fonction a bien évalué ses règles sur ce jeu de
    // données et renvoyé une liste vivante. Sans ça, les deux `not.toContain`
    // ci-dessus passeraient aussi sur une fonction muette. On s'ancre sur
    // `fresh_stalled` — vrai sur une base de CI (aucun run cron-fresh) et
    // indépendant de pg_cron, absent ici.
    expect(res.status).toBe('alert')
    expect(res.codes ?? []).toContain('fresh_stalled')
  })

  it('taux à 20 % mais 100 sondés → silencieux (plancher de 200)', async () => {
    await clearSeeded()
    await seedRun({ trigger_source: 'cron-revive', status: 'completed', total_seen: 100, total_updated: 20 })

    const res = await runHealthCheck()

    expect(res.codes ?? []).not.toContain('resurrection_rate_high')
  })
})
