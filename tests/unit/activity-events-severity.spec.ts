/**
 * Toute `severity` écrite dans `activity_events` appartient au domaine du CHECK.
 *
 * POURQUOI CE BANC EXISTE. Une migration de ce dépôt a écrit `severity = 'critical'` là où
 * elle voulait dire « grave » — mais en passant d'abord par `'error'`, qui est le domaine
 * d'`auth_events` et NON celui d'`activity_events`. Les deux tables se ressemblent, leurs
 * CHECK diffèrent d'un seul barreau, et l'erreur ne se voit qu'à l'exécution : 23514, dans
 * une fonction sans bloc `exception`, donc rollback de TOUT le travail de la nuit.
 *
 * Le contrôle est statique et lit la baseline pour le domaine — le figer ici en dur le
 * ferait diverger du schéma le jour où un barreau s'ajoute.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS = join(process.cwd(), 'supabase/migrations')
const BASELINE = '00000000000000_baseline_remote_schema.sql'

/** Domaine réel, lu dans le CHECK de la baseline. */
function domaine(): string[] {
  const sql = readFileSync(join(MIGRATIONS, BASELINE), 'utf8')
  const m = sql.match(/activity_events_severity_check"?\s+CHECK\s*\(\(?"?severity"?\s*=\s*ANY\s*\(ARRAY\[([^\]]+)\]/i)
  expect(m, 'le CHECK de severity doit rester lisible dans la baseline').not.toBeNull()
  return [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

/**
 * Valeurs de `severity` écrites dans un INSERT ciblant `activity_events`.
 *
 * On lit la fenêtre qui suit `insert into … activity_events`, jusqu'au `;` : c'est là que
 * vivent la liste de colonnes et les `values`/`case`. Les paramètres et variables ne sont
 * pas jugés — on ne contrôle que les LITTÉRAUX, seuls décidables statiquement.
 */
function severitesEcrites(sql: string): string[] {
  const out: string[] = []
  for (const bloc of sql.matchAll(/insert\s+into\s+(?:public\.)?activity_events\b[\s\S]*?;/gi)) {
    const t = bloc[0]
    // `severity: 'x'` (jsonb/TS) et `'x'` dans un case/values dont la colonne est severity.
    for (const m of t.matchAll(/severity\s*(?::|=)\s*'([^']+)'/gi)) out.push(m[1])
    for (const m of t.matchAll(/\bthen\s+'([a-z_]+)'\s*(?:else\s+'([a-z_]+)'\s*)?end\s*,?\s*\n?\s*jsonb_build_object/gi)) {
      out.push(m[1]); if (m[2]) out.push(m[2])
    }
  }
  return out
}

describe('activity_events.severity — le domaine du CHECK est respecté par les migrations', () => {
  const valides = domaine()

  it('le domaine est bien {info, warn, critical} — et PAS celui d’auth_events', () => {
    expect(valides).toEqual(['info', 'warn', 'critical'])
    expect(valides, '⛔ « error » appartient à auth_events, pas à activity_events').not.toContain('error')
  })

  it('aucune migration n’écrit une severity hors domaine dans activity_events', () => {
    const fautes: string[] = []
    for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && f !== BASELINE)) {
      for (const s of severitesEcrites(readFileSync(join(MIGRATIONS, f), 'utf8'))) {
        if (!valides.includes(s)) fautes.push(`${f} → severity '${s}'`)
      }
    }
    // Un 23514 dans une fonction sans bloc `exception` annule TOUTE sa transaction : le
    // travail utile déjà fait part avec l'événement censé le signaler.
    expect(fautes, 'severity hors du CHECK d’activity_events').toEqual([])
  })

  it('la réconciliation nocturne signale une nuit TRONQUÉE, et avec une valeur valide', async () => {
    const sql = readFileSync(join(MIGRATIONS, '20260815218000_reconcile_wa_consent_cache.sql'), 'utf8')
    expect(sql, 'le drapeau capped est ce qui distingue une nuit tronquée d’une nuit calme')
      .toContain("'capped', v_n >= c_max")
    for (const s of severitesEcrites(sql)) expect(valides).toContain(s)
  })
})
