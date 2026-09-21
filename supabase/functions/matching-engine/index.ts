import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { isServiceSecret } from '../_shared/require-service-secret.ts'
import { redactedErrorMessage } from '../_shared/audit-edge-error.ts'
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
  estUuid, fusionnerCorrection, lireCorrection, lireRefus, renoter, REFUS_MAX, tranches, type MatchARenoter,
} from '../_shared/matching-renotation.ts'
import {
  buildRentStatsIndex,
  rentPosition,
  type RentStatsIndex,
  type RentStatsRow,
  type RentSubject,
} from '../_shared/rent-reference.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

interface RequestBody {
  mode: 'match-property' | 'match-contact' | 'scan-all' | 'rescore-search'
  property_id?: string
  contact_id?: string
  include_market?: boolean // Aussi matcher contre market_listings (veille marché)
  /** rescore-search : la recherche dont les matchs à proposer sont renotés (lot B, « Apprendre »). */
  client_search_id?: string
  /**
   * rescore-search : la SEULE clé corrigée et sa valeur (`{ cle, valeur }`), fusionnée dans les critères
   * d'aujourd'hui APRÈS la renotation. Absente : ses critères actuels, rien de posé.
   */
  correction?: unknown
  /** rescore-search : le motif de refus qui a produit la correction (journal). */
  motif?: string
  /** rescore-search : les refus pris en compte (`apprentissage_at`), `REFUS_MAX` au plus. */
  refus_ids?: unknown
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

// colonnes lues par le scoring (jamais description/photos — règles perf §7)
const PROP_COLS = 'id, transaction_type, price, type, canton, city, rooms, surface_m2, features'
/**
 * Ce que le barème lit d'une annonce du marché — ce que rend `match_candidate_listings` —, et ce que son
 * pré-filtre dur trie (`quality_score`) : la renotation le rejoue (`renoter`).
 */
const COLS_ANNONCE_NOTE = 'id, price, current_price, type, canton, city, rooms, surface_m2, features, status, price_at_first_seen, transaction_type, quality_score'
/** Les motifs qu'« Apprendre » chiffre (le CHECK `matches_reaction_motif_check` en porte d'autres). */
const MOTIFS_CORRECTION = new Set(['prix', 'quartier', 'surface', 'pieces', 'type', 'equipements'])
/** `max_rows` de PostgREST : au-delà, une lecture tronque EN SILENCE. */
const PAGE_MATCHS = 1000
const LOT_IDS = 100
const LOT_NOTES = 500

/**
 * `rescore-search` — la réévaluation des matchs à proposer d'une recherche ajustée (lot B, « Apprendre »).
 *
 * ⚠ L'ORDRE EST LE CONTRAT. (1) renoter EN MÉMOIRE avec les critères d'aujourd'hui où la seule clé corrigée
 * est remplacée ; (2) écrire les notes (`matching_appliquer_notes`) ; (3) d'UN BLOC, `matching_ajuster_recherche` :
 * la clé fusionnée dans la recherche (et dans la fiche si elle portait les mêmes critères — sans quoi le pont
 * `sync_contact_client_search` remettrait l'ancienne au prochain enregistrement de la fiche), les refus pris
 * en compte, UNE ligne au journal. Une panne avant (3) laisse la correction proposée à l'écran, et la même
 * validation renote puis écrit tout ; (3) n'a pas de milieu. Écrire les critères d'abord effaçait la
 * correction (plus d'écart à proposer) sans avoir rien renoté.
 *
 * ⚠ La mise à jour des critères déclenche `trigger_matching_on_search_updated`, qui relance le moteur en
 * `match-contact` (pg_net, asynchrone) : les biens que la recherche corrigée retient DE PLUS y naissent.
 */
async function renoterRecherche(
  supabase: SupabaseClient,
  agencyId: string,
  acteurId: string | null,
  body: RequestBody,
  cfg: ScoringConfig,
  rentIndex: RentStatsIndex,
): Promise<{ statut: number; corps: Record<string, unknown> }> {
  const refus = lireRefus(body.refus_ids)
  const correction = body.correction === undefined ? null : lireCorrection(body.correction)
  if (!estUuid(body.client_search_id) || refus === null || (body.correction !== undefined && correction === null)
    || (body.motif !== undefined && !MOTIFS_CORRECTION.has(body.motif))) {
    return { statut: 400, corps: { error: 'invalid_body' } }
  }
  // Une borne, pas un plafond de travail : le fil ne lit pas davantage de refus (`REFUS_MAX`).
  if (refus.length > REFUS_MAX) return { statut: 413, corps: { error: 'too_many_refus', max: REFUS_MAX } }

  const { data: recherche, error: rErr } = await supabase
    .from('client_searches')
    .select('id, contact_id, criteria')
    .eq('id', body.client_search_id)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (rErr) throw rErr
  if (!recherche) return { statut: 404, corps: { error: 'search_not_found' } }
  const avant = (recherche.criteria ?? null) as Record<string, unknown> | null
  const criteres = correction ? fusionnerCorrection(avant, correction) : avant
  if (!criteres) return { statut: 400, corps: { error: 'invalid_body' } }

  // 1. Les matchs à proposer de la recherche, page par page (idx_matches_agency_focus).
  const matchs: MatchARenoter[] = []
  for (let depuis = 0; ; depuis += PAGE_MATCHS) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, property_id, market_listing_id, score_version')
      .eq('agency_id', agencyId)
      .eq('contact_id', recherche.contact_id)
      .eq('client_search_id', recherche.id)
      .eq('status', 'suggested')
      .order('id')
      .range(depuis, depuis + PAGE_MATCHS - 1)
    if (error) throw error
    const page = (data ?? []) as MatchARenoter[]
    matchs.push(...page)
    if (page.length < PAGE_MATCHS) break
  }

  // Leurs biens, colonnes du barème seulement.
  const biens = new Map<string, Record<string, unknown>>()
  const mandats = [...new Set(matchs.map((m) => m.property_id).filter((id): id is string => id != null))]
  for (const lot of tranches(mandats, LOT_IDS)) {
    const { data, error } = await supabase.from('properties').select(PROP_COLS).eq('agency_id', agencyId).in('id', lot)
    if (error) throw error
    for (const p of (data ?? []) as Record<string, unknown>[]) biens.set(p.id as string, p)
  }
  const annonces = [...new Set(matchs.map((m) => m.market_listing_id).filter((id): id is string => id != null))]
  for (const lot of tranches(annonces, LOT_IDS)) {
    const { data, error } = await supabase.from('market_listings').select(COLS_ANNONCE_NOTE).in('id', lot)
    if (error) throw error
    for (const a of (data ?? []) as Record<string, unknown>[]) biens.set(a.id as string, a)
  }

  // 1-2. Le VRAI barème, sur les critères corrigés — AVANT de les poser.
  const notes = renoter(matchs, biens, criteres, cfg, (a) => rentPosition({
    canton: (a.canton as string | null) ?? null,
    type: (a.type as string | null) ?? null,
    surface_m2: numOrNull(a.surface_m2),
    loyer: numOrNull(a.current_price) ?? numOrNull(a.price),
  }, rentIndex))
  const ecartes: string[] = []
  let reevalues = 0
  for (const lot of tranches(notes, LOT_NOTES)) {
    const { data, error } = await supabase.rpc('matching_appliquer_notes', {
      p_agency_id: agencyId, p_client_search_id: recherche.id, p_notes: lot,
    })
    if (error) throw error
    for (const l of (data ?? []) as { id: string; status: string }[]) {
      reevalues++
      if (l.status === 'ignored') ecartes.push(l.id)
    }
  }

  // 3. D'UN BLOC : la clé corrigée (recherche, fiche identique), les refus pris en compte — deux NOUVEAUX
  //    refus pour ce motif en proposeront une autre —, et UNE ligne au journal (CLAUDE.md §5), qui dit ce
  //    que la renotation a produit.
  const { data: ajuste, error: aErr } = await supabase.rpc('matching_ajuster_recherche', {
    p_agency_id: agencyId,
    p_client_search_id: recherche.id,
    p_acteur_id: acteurId,
    p_cle: correction?.cle ?? null,
    p_valeur: correction?.valeur ?? null,
    p_motif: body.motif ?? null,
    p_refus_ids: refus,
    p_bilan: { reevalues, ecartes: ecartes.length, match_ids_ecartes: ecartes.slice(0, 50), score_version: cfg.version },
  })
  if (aErr) throw aErr
  // Supprimée entre la lecture et l'écriture : rien n'a été posé.
  if (ajuste == null) return { statut: 404, corps: { error: 'search_not_found' } }

  return { statut: 200, corps: { reevalues, ecartes: ecartes.length, mode: 'rescore-search', scoreVersion: cfg.version } }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth — secret de service pour les appels internes, sinon JWT agent ──
    // Appelants internes : `daily_matching_scan()` (tâche `daily-matching-scan`) et les
    // quatre triggers de client_searches (nouvelle recherche, critères modifiés) et de
    // properties (bien activé, prix modifié) — tous rejouent `app_config.service_role_key`
    // en Bearer. Le front (useMatching, atelier, écran mobile) envoie le JWT de l'agent, qui
    // n'est pas le secret et retombe sur requireAgentAuth.
    // S8 (audit du 13.09.2026) : un `===` contre la seule clé de l'env ne tenait que par la
    // coïncidence des deux clés ; `isServiceSecret` accepte app_config OU l'env, à temps
    // constant.
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const isServiceRole = await isServiceSecret(admin, req)

    const body = (await req.json()) as RequestBody & { agency_id?: string }
    const { mode, property_id, contact_id, include_market = true } = body

    let supabase: SupabaseClient
    let agency_id: string
    // L'agent derrière le JWT — `null` pour un appel de service : le journal de `rescore-search` le nomme.
    let acteurId: string | null = null

    if (isServiceRole) {
      supabase = admin
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
      acteurId = auth.profile.id
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
            // `category` manquait ici, et cette seule omission faisait 95 % des lignes
            // sans catégorie de toute la table (4 616 sur 4 858, mesuré à l'étape 6) —
            // ce que la décision PO n° 6 décrivait comme un héritage diffus alors que
            // c'était UN émetteur. Le passé reste nul (activity_events refuse l'UPDATE),
            // mais le futur est classé.
            //
            // `contact` et non `ai` : un match est suggéré À un contact, c'est sa famille
            // MÉTIER. Que l'IA en soit l'auteur est déjà porté par `actor_kind`, et le
            // redire ici ferait de la catégorie `ai` deux choses à la fois. La puce
            // « Matchs » de l'écran vient du couple category + entity_type (§5.2), et
            // `entity_type: 'match'` la désigne déjà sans ambiguïté.
            category: 'contact',
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

    if (mode === 'match-property' && property_id) {
      // ── Nouveau bien interne → scanner tous les acheteurs (interne uniquement) ──
      const { data: property, error: propError } = await supabase
        .from('properties')
        .select(PROP_COLS)
        .eq('id', property_id)
        .eq('agency_id', agency_id) // défense en profondeur : ne score que le bien de l'agence
        .single()
      if (propError || !property) {
        return new Response(JSON.stringify({ error: 'property_not_found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

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
      // `supabase` est un client service-role : sans le filtre d'agence, ce
      // `contact_id` venu du corps atteignait les recherches de N'IMPORTE quel
      // contact de la plateforme, et les matches créés ensuite portaient
      // l'agence de l'APPELANT sur le contact d'une autre. Les deux autres
      // branches de ce switch (`match-property`, `scan-all`) filtraient déjà.
      // Les deux appelants légitimes passent : le front envoie l'agence du
      // profil, et le pont `client_searches` (20260621120000) poste
      // `NEW.agency_id`, c'est-à-dire l'agence de la ligne visée.
      const { data: searches, error: searchError } = await supabase
        .from('client_searches')
        .select('id, contact_id, criteria')
        .eq('contact_id', contact_id)
        .eq('agency_id', agency_id)
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
    } else if (mode === 'rescore-search') {
      const r = await renoterRecherche(supabase, agency_id, acteurId, body, cfg, rentIndex)
      return new Response(JSON.stringify(r.corps), {
        status: r.statut, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
      return new Response(JSON.stringify({ error: 'invalid_mode' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ newMatches, newMarketMatches, mode, scoreVersion: cfg.version }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    // Ce catch reçoit les erreurs Postgres des RPC d'insertion et des lectures (`throw error`
    // plus haut) : leur message nomme tables et contraintes. Journal, pas réponse — audit
    // S14. Les deux refus dus à l'APPELANT (mode inconnu, bien absent) sortent avant, avec
    // leur code : ils passaient par ici en 500, texte compris.
    console.error('[matching-engine] échec :', redactedErrorMessage(error))
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
