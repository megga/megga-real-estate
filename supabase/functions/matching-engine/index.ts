import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import {
  calculateScoreV2,
  inferTransactionType,
  normalizeZones,
  parseScoringConfig,
  DEFAULT_SCORING_CONFIG,
  type ScoringConfig,
  type ScoreResult,
} from '../_shared/matching-normalize.ts'
import {
  buildRentStatsIndex,
  rentPosition,
  type RentStatsIndex,
  type RentStatsRow,
  type RentSubject,
} from '../_shared/rent-reference.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  mode: 'match-property' | 'match-contact' | 'scan-all'
  property_id?: string
  contact_id?: string
  include_market?: boolean // Aussi matcher contre market_listings (veille marché)
}

// Ligne de match prête à insérer (commune interne/marché).
interface MatchRow {
  agency_id: string
  contact_id: string
  property_id?: string
  market_listing_id?: string
  client_search_id: string | null
  score: number
  reasons: ScoreResult['reasons']
  score_version: number
}

const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth — service_role bypass pour pg_cron, sinon JWT agent ──
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const token = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice('bearer '.length).trim()
      : ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const isServiceRole = token !== '' && token === serviceRoleKey

    const body = (await req.json()) as RequestBody & { agency_id?: string }
    const { mode, property_id, contact_id, include_market = true } = body

    let supabase: ReturnType<typeof createClient>
    let agency_id: string

    if (isServiceRole) {
      supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey)
      if (!body.agency_id) {
        return new Response(
          JSON.stringify({ error: 'agency_id required for service-role calls' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      agency_id = body.agency_id
    } else {
      const auth = await requireAgentAuth(req, corsHeaders)
      if (auth instanceof Response) return auth
      supabase = auth.supabase
      agency_id = auth.profile.agency_id // JWT-derived, on ignore body.agency_id
    }

    // ── Barème de scoring (externalisé, ajustable sans redéploiement) ──
    let cfg: ScoringConfig = DEFAULT_SCORING_CONFIG
    try {
      const { data: cfgVal } = await supabase.rpc('get_app_config', { config_key: 'matching_scoring_v2' })
      cfg = parseScoringConfig(typeof cfgVal === 'string' ? cfgVal : null)
    } catch (_) {
      cfg = DEFAULT_SCORING_CONFIG // jamais de crash sur une config absente/cassée
    }

    // ── Référence loyer marché (signal déterministe, lookup en mémoire) ──
    // Chargé UNE fois ; jamais de GROUP BY live. Absence/erreur ⇒ index vide ⇒
    // rentPosition()=null ⇒ bonus pricePosP=0 ⇒ barème 100 pts inchangé
    // (dégradation silencieuse). v1 plafonné L1 : canton_surf seul car la RPC
    // match_candidate_listings ne renvoie PAS postal_code (finesse city/NPA =
    // choix de scope v1, voir docs/estimation-loyer-vague2-concevoir.md §8.8).
    let rentIndex: RentStatsIndex = buildRentStatsIndex([])
    const { data: statsRows, error: statsErr } = await supabase
      .from('market_rent_stats')
      .select('*')
      .eq('level', 'canton_surf')
    if (statsErr) {
      console.error('[matching-engine] market_rent_stats load failed, axis inactive:', statsErr.message)
    } else {
      rentIndex = buildRentStatsIndex((statsRows ?? []) as RentStatsRow[])
    }

    let newMatches = 0
    let newMarketMatches = 0

    // ── Insertion batch dé-dupliquée + audit sur les lignes RÉELLEMENT créées ──
    async function flush(rows: MatchRow[], rpc: 'insert_market_matches' | 'insert_internal_matches', source: 'market' | 'internal'): Promise<number> {
      if (rows.length === 0) return 0
      const { data: created, error } = await supabase.rpc(rpc, { p_rows: rows })
      if (error) throw error
      const createdRows = (created ?? []) as { id: string; contact_id: string; property_id: string | null; market_listing_id: string | null; score: number }[]
      if (createdRows.length > 0) {
        const { error: auditErr } = await supabase.from('activity_events').insert(
          createdRows.map((m) => ({
            agency_id,
            actor_id: null,
            actor_kind: 'ai',
            action: 'match_suggested',
            entity_type: 'match',
            entity_id: m.id,
            metadata: {
              contact_id: m.contact_id,
              property_id: m.property_id,
              market_listing_id: m.market_listing_id,
              score: m.score,
              mode,
              source,
              score_version: cfg.version,
            },
          })),
        )
        // Audit obligatoire (actor_kind='ai', cf CLAUDE.md) — un échec RLS ne doit pas passer inaperçu
        if (auditErr) console.error('[matching-engine] activity_events insert failed:', auditErr.message)
      }
      return createdRows.length
    }

    // ── Matchs internes (properties de l'agence). Filtre DUR transaction_type. ──
    function buildInternalRows(
      searches: Record<string, unknown>[],
      properties: Record<string, unknown>[],
      resolveContactId: (s: Record<string, unknown>) => string,
    ): MatchRow[] {
      const rows: MatchRow[] = []
      for (const search of searches) {
        const criteria = search.criteria as Record<string, unknown> | null
        if (!criteria) continue
        const tx = inferTransactionType(criteria)
        const cId = resolveContactId(search)
        for (const property of properties) {
          const pTx = property.transaction_type as string | null
          if (pTx && pTx !== tx) continue // un loyer n'est jamais une vente
          const score = calculateScoreV2(property, criteria, cfg)
          if (score.total >= cfg.threshold) {
            rows.push({
              agency_id,
              contact_id: cId,
              property_id: property.id as string,
              client_search_id: (search.id as string) ?? null,
              score: score.total,
              reasons: score.reasons,
              score_version: cfg.version,
            })
          }
        }
      }
      return rows
    }

    // ── Matchs marché (market_listings) via pré-filtre SQL DUR puis scoring soft ──
    async function matchSearchesAgainstMarket(
      searches: Record<string, unknown>[],
      resolveContactId: (s: Record<string, unknown>) => string,
    ): Promise<void> {
      if (!include_market) return
      const rows: MatchRow[] = []
      for (const search of searches) {
        const criteria = search.criteria as Record<string, unknown> | null
        if (!criteria) continue
        const cId = resolveContactId(search)
        const tx = inferTransactionType(criteria)
        const { cantons } = normalizeZones(criteria.zones)

        const { data: candidates, error } = await supabase.rpc('match_candidate_listings', {
          p_tx: tx,
          p_budget_min: numOrNull(criteria.budget_min),
          p_budget_max: numOrNull(criteria.budget_max),
          p_cantons: cantons.length > 0 ? cantons : null,
          p_types: null, // le type reste un axe SOFT (scoring), pas un filtre dur
          p_limit: 400,
        })
        if (error) throw error

        for (const ml of (candidates ?? []) as Record<string, unknown>[]) {
          // Sujet pour la référence loyer : loyer canonique = COALESCE(current_price, price).
          // Gate tx==='rent' → jamais de raison loyer sur une vente. Résolution L1
          // (canton) car la RPC ne renvoie pas postal_code. rentRef null ⇒ bonus 0.
          const subject: RentSubject = {
            canton: (ml.canton as string | null) ?? null,
            type: (ml.type as string | null) ?? null,
            surface_m2: numOrNull(ml.surface_m2),
            loyer: numOrNull(ml.current_price) ?? numOrNull(ml.price),
          }
          const rentRef = tx === 'rent' ? rentPosition(subject, rentIndex) : null
          const score = calculateScoreV2(ml, criteria, cfg, rentRef)
          if (score.total >= cfg.threshold) {
            rows.push({
              agency_id,
              contact_id: cId,
              market_listing_id: ml.id as string,
              client_search_id: (search.id as string) ?? null,
              score: score.total,
              reasons: score.reasons,
              score_version: cfg.version,
            })
          }
        }
      }
      newMarketMatches += await flush(rows, 'insert_market_matches', 'market')
    }

    // colonnes lues par le scoring (jamais description/photos — règles perf §7)
    const PROP_COLS = 'id, transaction_type, price, type, canton, city, rooms, surface_m2, features'

    if (mode === 'match-property' && property_id) {
      // ── Nouveau bien interne → scanner tous les acheteurs (interne uniquement) ──
      const { data: property, error: propError } = await supabase
        .from('properties')
        .select(PROP_COLS)
        .eq('id', property_id)
        .eq('agency_id', agency_id) // défense en profondeur : ne score que le bien de l'agence
        .single()
      if (propError || !property) throw new Error(`Property not found: ${property_id}`)

      const { data: searches, error: searchError } = await supabase
        .from('client_searches')
        .select('id, contact_id, criteria')
        .eq('agency_id', agency_id)
        .eq('is_active', true)
      if (searchError) throw searchError

      const rows = buildInternalRows(searches || [], [property], (s) => s.contact_id as string)
      newMatches += await flush(rows, 'insert_internal_matches', 'internal')
    } else if (mode === 'match-contact' && contact_id) {
      // ── Acheteur (modifié) → scanner les biens internes + la veille marché ──
      const { data: searches, error: searchError } = await supabase
        .from('client_searches')
        .select('id, contact_id, criteria')
        .eq('contact_id', contact_id)
        .eq('is_active', true)
      if (searchError) throw searchError
      if (!searches || searches.length === 0) {
        return new Response(JSON.stringify({ newMatches: 0, message: 'No active searches' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select(PROP_COLS)
        .eq('agency_id', agency_id)
        .eq('status', 'active')
      if (propError) throw propError

      const rows = buildInternalRows(searches, properties || [], () => contact_id!)
      newMatches += await flush(rows, 'insert_internal_matches', 'internal')

      await matchSearchesAgainstMarket(searches, () => contact_id!)
    } else if (mode === 'scan-all') {
      // ── Scan complet (pg_cron) ──
      const { data: searches } = await supabase
        .from('client_searches')
        .select('id, contact_id, criteria')
        .eq('agency_id', agency_id)
        .eq('is_active', true)

      const { data: properties } = await supabase
        .from('properties')
        .select(PROP_COLS)
        .eq('agency_id', agency_id)
        .eq('status', 'active')

      const rows = buildInternalRows(searches || [], properties || [], (s) => s.contact_id as string)
      newMatches += await flush(rows, 'insert_internal_matches', 'internal')

      await matchSearchesAgainstMarket(searches || [], (s) => s.contact_id as string)
    } else {
      throw new Error(`Invalid mode: ${mode}. Expected 'match-property', 'match-contact', or 'scan-all'`)
    }

    return new Response(JSON.stringify({ newMatches, newMarketMatches, mode, scoreVersion: cfg.version }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
