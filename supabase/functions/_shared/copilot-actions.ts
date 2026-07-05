// Exécuteurs des outils WEB du copilote (ai-copilot). Même contrat que
// whatsapp-actions.ts : reçoivent un contexte identitaire dérivé SERVEUR
// (jamais du body), renvoient un texte court réinjecté role:'tool'.
//
// Particularité web : deux clients Supabase.
//  - `userClient` : scopé au JWT de l'agent (anon key + Authorization). C'est LUI
//    qui appelle les RPC SECURITY DEFINER qui dérivent l'agence du JWT
//    (focus_top_matches, analytics_*) → get_user_agency_id()/auth.uid() résolvent,
//    RLS et scoping garantis par la DB, zéro paramètre d'agence forgeable.
//  - `supabase` : service-role, pour les données marché SANS PII ni scope agence
//    (market_rent_stats — SELECT authenticated révoqué — et match_candidate_listings).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { canonicalPropertyType } from './whatsapp-lead.ts'
import {
  buildRentStatsIndex, rentPosition, surfaceBand,
  type RentStatsRow, type RentPosition,
} from './rent-reference.ts'
import { buildSaleStats, salePosition, MIN_COMPARABLES, type SaleCandidateRow } from './copilot-market.ts'

export interface WebToolCtx {
  supabase: SupabaseClient
  userClient: SupabaseClient
  profileId: string
  agencyId: string | null
}

type Args = Record<string, unknown>

const numArg = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : null
}
const strArg = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

// ─── suggest_priorities_today ────────────────────────────────────────────────
// File Focus réelle (RPC focus_top_matches, agence dérivée du JWT) + rappels du
// jour. Sortie compacte JSON : le modèle rédige, il n'invente rien.
export async function execSuggestPrioritiesToday(ctx: WebToolCtx, a: Args): Promise<string> {
  const limit = Math.min(Math.max(numArg(a.limit) ?? 8, 1), 15)

  const [focus, reminders] = await Promise.all([
    ctx.userClient.rpc('focus_top_matches', { p_limit: limit }),
    (async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const end = new Date(); end.setHours(23, 59, 59, 999)
      return await ctx.userClient
        .from('reminders')
        .select('type, trigger_at, message_template')
        .eq('status', 'pending')
        .gte('trigger_at', start.toISOString())
        .lte('trigger_at', end.toISOString())
        .order('trigger_at', { ascending: true })
        .limit(10)
    })(),
  ])

  if (focus.error) return `Erreur priorités: ${focus.error.message}`

  type FocusRow = {
    contact_id: string; contact_name: string | null; score: number | null
    lead_score: number | null; reason_keys: string[] | null
    property_title: string | null; property_price: number | null; city: string | null
    kyc_risk_high: boolean | null; kyc_days_to_expiry: number | null
  }
  const items = ((focus.data ?? []) as FocusRow[]).map((r) => {
    const out: Record<string, unknown> = { contact_id: r.contact_id }
    if (r.contact_name) out.client = r.contact_name
    if (typeof r.score === 'number') out.score_match = r.score
    if (typeof r.lead_score === 'number') out.score_lead_estimation = Math.round(r.lead_score)
    if (r.reason_keys?.length) out.raisons = r.reason_keys
    if (r.property_title) out.bien = r.property_title
    if (typeof r.property_price === 'number' && r.property_price > 0) out.montant = r.property_price
    if (r.city) out.ville = r.city
    if (r.kyc_risk_high) out.kyc_attention = true // signal non bloquant (KYC facultatif)
    if (typeof r.kyc_days_to_expiry === 'number') out.kyc_expire_dans_jours = r.kyc_days_to_expiry
    return out
  })

  const rappels = (reminders.error ? [] : (reminders.data ?? [])).map((r) => ({
    type: r.type, quand: r.trigger_at, note: r.message_template ?? undefined,
  }))

  if (!items.length && !rappels.length) {
    return 'Aucune priorité calculée aujourd’hui (pas de match actionnable ni de rappel du jour).'
  }
  return JSON.stringify({
    note: 'Scores = estimations internes (matching + engagement), à présenter comme telles.',
    priorites_matches: items,
    rappels_du_jour: rappels,
  })
}

// ─── get_analytics_snapshot ──────────────────────────────────────────────────
// Cockpit réel : RPC SECURITY DEFINER (agence + agent du JWT). Snapshot borné.
export async function execGetAnalyticsSnapshot(ctx: WebToolCtx, a: Args): Promise<string> {
  const period = ['month', 'quarter', 'year'].includes(String(a.period)) ? String(a.period) : 'month'
  const scope = a.scope === 'agency' ? 'agency' : 'me'

  const [cockpit, objectif] = await Promise.all([
    ctx.userClient.rpc('analytics_cockpit', { p_period: period, p_scope: scope }),
    ctx.userClient.rpc('analytics_objectif', { p_period: period, p_scope: scope }),
  ])
  if (cockpit.error) return `Erreur analytics: ${cockpit.error.message}`

  const payload = JSON.stringify({
    periode: period,
    perimetre: scope === 'me' ? 'agent seul' : 'agence',
    cockpit: cockpit.data ?? {},
    objectif: objectif.error ? undefined : (objectif.data ?? {}),
  })
  // Borne dure : jamais un pavé dans le prompt (le cockpit est déjà agrégé).
  return payload.length > 6000 ? payload.slice(0, 6000) + '…(tronqué)' : payload
}

// ─── get_market_stats ────────────────────────────────────────────────────────
// 100% déterministe. Locatif : MV market_rent_stats (médianes pré-calculées,
// n>=20 par construction) via rent-reference. Vente : échantillon réel
// match_candidate_listings (RPC indexée, colonnes légères) agrégé en TS.
export async function execGetMarketStats(ctx: WebToolCtx, a: Args): Promise<string> {
  const tx = a.transaction_type === 'buy' ? 'buy' : 'rent'
  const type = canonicalPropertyType(strArg(a.property_type) ?? 'appartement') ?? 'apartment'
  const canton = (strArg(a.canton) ?? '').toUpperCase() || null
  const city = strArg(a.city)
  const npa = strArg(a.postal_code)
  const surface = numArg(a.surface_m2)
  const amount = numArg(a.amount)

  if (!canton && !city && !npa) {
    return 'Précise au moins une zone (canton, ville ou NPA) pour calculer des statistiques de marché.'
  }

  if (tx === 'rent') {
    // Le locatif exige le canton (clé de la MV). Sans canton explicite mais avec
    // une ville/NPA, on demande plutôt que de deviner (honnêteté > confort).
    if (!canton) return 'Pour le locatif, précise le canton (ex. GE, VD) en plus de la ville/NPA.'
    const { data, error } = await ctx.supabase
      .from('market_rent_stats')
      .select('level, canton, type, surface_band, postal_code, city, median_loyer_m2, p25_loyer_m2, p75_loyer_m2, n_comparables')
      .eq('canton', canton)
      .eq('type', type)
    if (error) return `Erreur stats locatives: ${error.message}`
    const rows = (data ?? []) as RentStatsRow[]
    if (!rows.length) return `Échantillon insuffisant: aucune statistique locative fiable pour ${type} dans le canton ${canton} (seuil ${MIN_COMPARABLES} comparables).`

    const index = buildRentStatsIndex(rows)

    // Bien à positionner fourni → position vs marché (fallback NPA→ville→canton).
    let position: RentPosition | null = null
    if (surface && amount) {
      position = rentPosition({ canton, type, surface_m2: surface, loyer: amount, postal_code: npa, city }, index)
    }

    // Segment de référence à publier : NPA si dispo, sinon canton (band du bien
    // si connue, sinon toutes les bandes du canton pour donner l'ordre de grandeur).
    const band = surface ? surfaceBand(surface) : null
    const pick = (level: string, geo: string | null) => rows.find((r) =>
      r.level === level && (band ? r.surface_band === band : true) &&
      (level === 'npa_surf' ? r.postal_code === geo : true))
    const segment = (npa && pick('npa_surf', npa)) || (band ? pick('canton_surf', null) : null)

    const out: Record<string, unknown> = {
      source: 'annonces locatives actives (sync quotidienne), loyers au m2 winsorisés',
      transaction: 'location', type, canton,
    }
    if (segment) {
      out.segment = {
        niveau: segment.level === 'npa_surf' ? `NPA ${segment.postal_code}` : `canton ${canton}`,
        bande_surface_m2: segment.surface_band,
        loyer_m2_median: segment.median_loyer_m2,
        loyer_m2_p25: segment.p25_loyer_m2,
        loyer_m2_p75: segment.p75_loyer_m2,
        n_comparables: segment.n_comparables,
      }
    } else {
      out.segments_canton = rows.filter((r) => r.level === 'canton_surf').map((r) => ({
        bande_surface_m2: r.surface_band,
        loyer_m2_median: r.median_loyer_m2,
        n_comparables: r.n_comparables,
      }))
    }
    if (position) {
      out.position_du_bien = {
        loyer_m2_du_bien: Math.round((amount! / surface!) * 100) / 100,
        position_pct_vs_mediane: position.position_pct,
        niveau_de_comparaison: position.level,
        n_comparables: position.n_comparables,
      }
    } else if (surface || amount) {
      out.position_du_bien = 'non calculable (il faut loyer ET surface)'
    }
    return JSON.stringify(out)
  }

  // ── Vente : échantillon réel via la RPC de matching (indexée, plafonnée). ──
  if (!canton) return 'Pour la vente, précise le canton (ex. GE, VD) en plus de la ville.'
  const { data, error } = await ctx.supabase.rpc('match_candidate_listings', {
    p_tx: 'buy',
    p_cantons: [canton],
    p_types: [type],
    p_min_quality: 50,
    p_limit: 400,
  })
  if (error) return `Erreur stats vente: ${error.message}`
  const rows = (data ?? []) as SaleCandidateRow[]
  const stats = buildSaleStats(rows, city)
  if (!stats) {
    return `Échantillon insuffisant: moins de ${MIN_COMPARABLES} annonces de vente comparables (${type}, canton ${canton}${city ? `, ${city}` : ''}). Ne cite aucun chiffre de marché.`
  }
  const out: Record<string, unknown> = {
    source: 'annonces de vente actives (sync quotidienne), prix au m2',
    transaction: 'vente', type, canton,
    segment: {
      niveau: stats.level === 'city' ? `ville ${city}` : `canton ${canton}`,
      prix_m2_median: stats.median_price_m2,
      prix_m2_p25: stats.p25_price_m2,
      prix_m2_p75: stats.p75_price_m2,
      n_comparables: stats.n,
    },
  }
  if (stats.level === 'canton' && city) {
    out.note = `Moins de ${MIN_COMPARABLES} comparables à ${city} : statistiques élargies au canton.`
  }
  const pos = salePosition(stats, amount, surface)
  if (pos) {
    out.position_du_bien = {
      prix_m2_du_bien: pos.subject_price_m2,
      position_pct_vs_mediane: pos.position_pct,
    }
  } else if (surface || amount) {
    out.position_du_bien = 'non calculable (il faut prix ET surface)'
  }
  return JSON.stringify(out)
}
