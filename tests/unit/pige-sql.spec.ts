/**
 * Garde statique de la pige (21.09.2026) — ce que la suite backend ne voit qu'en CI, lu dans le TEXTE des
 * migrations pour rougir en local :
 *  1. le rattrapage Flatfox s'applique AVANT les déclencheurs de la pige, et une seule fois (sinon ses
 *     ~12 500 retraits d'avant la mise en service seraient datés du jour et inonderaient « Retirés ») ;
 *  2. le flux reste SECURITY INVOKER, borné, et ne compte jamais (CLAUDE.md §7) ;
 *  3. l'historique ne s'écrit que sur un changement réel (clause WHEN sur l'UPDATE) ;
 *  4. aucune transaction ne prend un verrou sans `lock_timeout`, et la migration de la pige est coupée en
 *     deux : le schéma, court, puis le relevé initial — sans quoi le verrou exclusif de l'ALTER sur
 *     market_listings, que tout le CRM lit, aurait duré tout le relevé (relecture du 21.09.2026) ;
 *  5. les lecteurs SQL des annonces « vivantes » comptent aussi celles en baisse, que la pige étend à Flatfox.
 * Les tests du balayage Flatfox par lots, que Julien a fait entrer dans l'étape 1b le 21.09.2026 (Question 1
 * du plan), vont et viennent avec la migration `…_flatfox_balayage_par_lots`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const DIR = 'supabase/migrations'
const fichiers = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()
const PIGE = fichiers.find((f) => f.endsWith('_pige_historique_prix.sql'))
const BALAYAGE = fichiers.find((f) => f.endsWith('_flatfox_balayage_par_lots.sql'))
const LECTEURS = fichiers.find((f) => f.endsWith('_pige_baisses_vivantes.sql'))
const lire = (f: string | undefined): string => (f ? readFileSync(`${DIR}/${f}`, 'utf8').toLowerCase() : '')
/** Le texte EXÉCUTÉ : sans commentaires de ligne (aucune de ces migrations n'écrit `--` dans une chaîne). */
const code = (f: string | undefined): string => lire(f).replace(/--[^\n]*/g, '')
/** Les transactions explicites, dans l'ordre (un `begin` de corps plpgsql n'a pas de point-virgule). */
const TRANSACTION = /^\s*begin\s*;([\s\S]*?)^\s*commit\s*;/gm
const transactions = (sql: string): string[] => [...sql.matchAll(TRANSACTION)].map((m) => m[1]!)

describe('pige — garde statique des migrations', () => {
  it('les trois migrations existent et sont datées du même jour', () => {
    expect(PIGE, 'migration de la pige introuvable').toBeDefined()
    expect(BALAYAGE, 'migration du balayage Flatfox introuvable').toBeDefined()
    expect(LECTEURS, 'migration des lecteurs « vivantes » introuvable').toBeDefined()
    expect(PIGE!.slice(0, 8)).toBe(BALAYAGE!.slice(0, 8))
    expect(LECTEURS!.slice(0, 8)).toBe(PIGE!.slice(0, 8))
  })

  it('le rattrapage Flatfox passe AVANT les déclencheurs de la pige, et une seule fois', () => {
    expect(fichiers.indexOf(BALAYAGE!)).toBeLessThan(fichiers.indexOf(PIGE!))
    expect(lire(BALAYAGE)).toContain("tgname = 'trg_ml_historique_maj'")
  })

  it('le flux reste SECURITY INVOKER, borné, et ne compte jamais', () => {
    const sql = lire(PIGE)
    const debut = sql.indexOf('create function public.pige_mouvements')
    const fin = sql.indexOf('comment on function public.pige_mouvements')
    expect(debut).toBeGreaterThan(-1)
    expect(fin).toBeGreaterThan(debut)
    const corps = sql.slice(debut, fin)
    expect(corps).toContain('security invoker')
    expect(corps).not.toMatch(/count\s*\(/)
    expect(corps).toContain('limit least(greatest(')
  })

  it('l’historique ne s’écrit que sur un changement réel de prix ou de statut', () => {
    const sql = lire(PIGE).replace(/\s+/g, ' ')
    expect(sql).toContain(
      'create trigger trg_ml_historique_maj after update on public.market_listings for each row ' +
        'when (old.current_price is distinct from new.current_price or old.price is distinct from new.price ' +
        'or old.status is distinct from new.status)',
    )
  })

  it('⛔ chaque transaction pose un lock_timeout, et rien ne s’exécute hors d’elles', () => {
    for (const f of [BALAYAGE, PIGE, LECTEURS]) {
      const sql = code(f)
      const tx = transactions(sql)
      expect(tx.length, f).toBeGreaterThan(0)
      for (const t of tx) expect(t, f).toContain("set local lock_timeout = '5s'")
      expect(sql.replace(TRANSACTION, '').trim(), `${f} : instruction hors transaction`).toBe('')
    }
  })

  it('⛔ la pige en DEUX transactions : le schéma, puis le relevé, l’index du flux et ses statistiques', () => {
    const [schema, donnees, ...reste] = transactions(code(PIGE))
    expect(reste).toEqual([])
    // A : colonnes, déclencheurs, fonctions, droits — et aucun relevé.
    expect(schema).toContain('alter table public.market_listings add column if not exists removed_at')
    expect(schema).toContain('create trigger trg_ml_historique_maj')
    expect(schema).toContain('create function public.pige_mouvements')
    expect(schema).not.toContain("select ml.id, 'suivi'")
    expect(schema).not.toContain('idx_mph_evenements')
    // B : le relevé, qui saute ce que les déclencheurs ont écrit depuis A, puis l'index, puis ANALYZE.
    const releve = donnees!.indexOf("select ml.id, 'suivi'")
    const index = donnees!.indexOf('create index if not exists idx_mph_evenements')
    const analyse = donnees!.indexOf('analyze public.market_price_history')
    expect(releve).toBeGreaterThan(-1)
    expect(index).toBeGreaterThan(releve)
    expect(analyse).toBeGreaterThan(index)
    expect(donnees!.replace(/\s+/g, ' ')).toContain(
      'not exists (select 1 from public.market_price_history h where h.market_listing_id = ml.id)',
    )
    expect(donnees).toContain('lock table public.market_listings in share mode')
  })

  it('la fonction des déclencheurs n’est exécutable par personne ; le flux borne sa période et ne double aucun retrait', () => {
    const sql = code(PIGE).replace(/\s+/g, ' ')
    expect(sql).toContain('revoke all on function public.ml_historique_prix() from public, anon, authenticated')
    expect(sql).toContain("h.detected_at >= greatest(p_since, now() - interval '31 days')")
    expect(sql).toContain("then ml.status = 'removed' and h.detected_at >= ml.removed_at")
  })

  it('⛔ balayage Flatfox : plafond RELATIF vérifié au premier lot, et au-delà rien n’est retiré', () => {
    const sql = code(BALAYAGE).replace(/\s+/g, ' ')
    expect(sql).toContain('p_plafond integer default null')
    // Compte borné : jamais plus de candidates qu'il n'en faut pour trancher.
    expect(sql).toContain('limit greatest(p_plafond, 0) + 1')
    // Refus AVANT l'UPDATE : lever annule le lot entier.
    const refus = sql.indexOf('if v_candidates > p_plafond then raise exception')
    expect(refus).toBeGreaterThan(-1)
    expect(sql.indexOf('update public.market_listings ml', refus)).toBeGreaterThan(refus)
    // La surcharge à deux arguments ne survit pas : l'appel nommé serait ambigu (PGRST203).
    expect(sql).toContain('drop function if exists public.flatfox_balayer_retraits(timestamptz, integer);')
  })

  it('les lecteurs SQL des « vivantes » comptent aussi les baisses, après l’index partiel qu’ils suivent', () => {
    const sql = code(LECTEURS)
    expect(sql).not.toMatch(/status\s*=\s*'active'/)
    expect(sql.match(/status in \('active', 'price_reduced'\)/g)).toHaveLength(2)
    expect(sql).toContain('create or replace function public.flatfox_active_count_refresh()')
    expect(sql).toContain('create materialized view public.market_rent_stats')
    expect(fichiers.indexOf(LECTEURS!)).toBeGreaterThan(fichiers.indexOf(PIGE!))
  })
})
