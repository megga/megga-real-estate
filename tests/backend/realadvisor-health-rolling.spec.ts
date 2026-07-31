// Règle I de realadvisor_health_check() — `rolling_stopped` — spec live.
//
// Ce qui est vérifié, et pourquoi
// -----------------------------------------------------------------------------
// Migration 20260730120000. La nuit du 29 au 30/07/2026, le rolling crawl n'a
// produit aucune ligne de run et n'a touché aucune annonce, sans qu'aucune alerte
// ne parte : ni une requête pg_net perdue, ni une sortie précoce de
// runBackground() n'écrivent quoi que ce soit en base. La règle I fait de cette
// absence un signal.
//
// Les trois cas encadrent exactement le contour de la règle :
//   1. aucune ligne cron-rolling            → 'rolling_stopped' PRÉSENT
//   2. une ligne cron-rolling 'completed'   → 'rolling_stopped' ABSENT
//   3. une ligne cron-rolling encore en vol → 'rolling_stopped' ABSENT
//
// Le cas 3 est celui qui compte le plus : un run de rolling vit 30 à 40 minutes
// et peut déborder (celui du 28/07 a tenu ~3h). Tant qu'il tourne, `ended_at` est
// NULL — une règle qui teste cette seule colonne compterait zéro et alerterait
// sur un crawl en pleine santé. D'où le `coalesce(ended_at, started_at)` de la
// migration, que ce cas verrouille. Sans lui, ce test échoue.
//
// Le cas 2 seul serait creux : une fonction muette le passerait aussi. Chaque
// assertion négative est donc doublée d'un ancrage sur `fresh_stalled`, vrai sur
// une base de CI (aucun run cron-fresh) et indépendant de pg_cron — ce qui prouve
// que la fonction a bien évalué ses règles sur le même jeu de données.
//
// ⚠ `cron_inactive` n'est pas testable ici : pg_cron n'est pas installé sur la
// base de CI, la migration garde donc cette règle derrière un test d'existence du
// schéma `cron`. La clause de suppression de la règle I (« taire rolling_stopped
// si cron_inactive a déjà signalé le job ») est par conséquent inerte en CI :
// v_missing y est toujours vide, et la règle tire sur la seule absence de run.
// C'est le comportement voulu, pas un angle mort du test.
//
// La fonction poste un mail via net.http_post quand il y a au moins une alerte.
// pg_net met la requête en FILE et ne la joue pas en ligne : depuis le conteneur
// Postgres de CI la connexion échoue sans faire échouer l'appel. Aucun mail n'est
// réellement émis.
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

describe.skipIf(!HAS_KEYS)('realadvisor_health_check — règle I (rolling muet)', () => {
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
    /** null = run encore en vol (le cas que le coalesce de la règle protège). */
    ended_at?: string | null
    total_seen?: number
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
        ended_at: row.ended_at === undefined ? new Date().toISOString() : row.ended_at,
        total_seen: row.total_seen ?? 0,
        total_updated: 0,
        total_removed: 0,
      })
      .select('id')
      .single()
    // Un seed avalé en silence rendrait toute la suite verte sans rien prouver.
    if (error) throw new Error(`seed ${row.trigger_source}/${row.status}: ${error.message}`)
    seededIds.push((data as { id: string }).id)
  }

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

  it('aucun run cron-rolling sur 26h → alerte rolling_stopped', async () => {
    const res = await runHealthCheck()

    expect(res.status).toBe('alert')
    expect(res.codes ?? []).toContain('rolling_stopped')
  })

  it('un run cron-rolling terminé cette nuit → pas de rolling_stopped', async () => {
    await clearSeeded()
    await seedRun({ trigger_source: 'cron-rolling', status: 'completed', total_seen: 14300 })

    const res = await runHealthCheck()

    expect(res.codes ?? []).not.toContain('rolling_stopped')
    // Garde anti-test-creux : la fonction a bien évalué ses règles sur ce jeu de
    // données et renvoyé une liste vivante.
    expect(res.status).toBe('alert')
    expect(res.codes ?? []).toContain('fresh_stalled')
  })

  it('un run cron-rolling encore en vol (ended_at NULL) → pas de rolling_stopped', async () => {
    await clearSeeded()
    // Le crawl a démarré et n'a pas fini : c'est l'état normal d'un rolling qui
    // déborde. Un test sur `ended_at` seul le compterait zéro et alerterait à tort.
    //
    // ⚠ `realadvisor_sync_runs_one_running` est un index unique partiel GLOBAL :
    // une seule ligne 'running' peut exister dans toute la table. Le seed
    // ci-dessous échoue donc en 23505 si une autre spec en laisse une derrière
    // elle — le `clearSeeded()` juste au-dessus retire la nôtre, et le message
    // d'erreur du seed nomme la contrainte, ce qui rend le cas diagnosticable.
    await seedRun({ trigger_source: 'cron-rolling', status: 'running', ended_at: null, total_seen: 3200 })

    const res = await runHealthCheck()

    expect(res.codes ?? []).not.toContain('rolling_stopped')
    expect(res.status).toBe('alert')
    expect(res.codes ?? []).toContain('fresh_stalled')
  })
})
