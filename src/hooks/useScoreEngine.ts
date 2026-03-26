import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

// ── Types ──

export interface ContactScore {
  contact_id: string
  buyer_score: number
  reactivity_score: number
  engagement_score: number
  budget_coherence_score: number
  visit_quality_score: number
  conversion_probability: number
  estimated_real_budget: number | null
  rejection_patterns: string[]
  intent_signals: Record<string, unknown>
  engagement_trend: 'rising' | 'stable' | 'declining'
  interactions_count: number
  visits_count: number
  matches_sent_count: number
  last_calculated_at: string | null
}

export interface PropertyScore {
  property_id: string | null
  market_listing_id: string | null
  source: 'internal' | 'market'
  heat_score: number
  market_position_score: number
  interest_level: number
  days_on_market: number
  price_trend: 'stable' | 'dropping' | 'rising'
  stagnation_risk: 'low' | 'medium' | 'high'
  comparable_count: number
  avg_comparable_price: number | null
  price_vs_market_pct: number | null
  last_calculated_at: string | null
}

export interface MarketChange {
  id: string
  market_listing_id: string | null
  change_type: 'new' | 'price_drop' | 'price_increase' | 'removed' | 'relisted'
  old_price: number | null
  new_price: number | null
  change_pct: number | null
  listing_title: string | null
  listing_city: string | null
  listing_canton: string | null
  listing_type: string | null
  listing_rooms: number | null
  detected_at: string
}

// ── Hooks ──

export function useContactScore(contactId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ['contact-score', contactId],
    queryFn: async (): Promise<ContactScore | null> => {
      const { data, error } = await supabase
        .from('contact_scores')
        .select('*')
        .eq('contact_id', contactId!)
        .single()
      if (error || !data) return null
      return {
        ...data,
        rejection_patterns: typeof data.rejection_patterns === 'string'
          ? JSON.parse(data.rejection_patterns)
          : (data.rejection_patterns ?? []),
        intent_signals: typeof data.intent_signals === 'string'
          ? JSON.parse(data.intent_signals)
          : (data.intent_signals ?? {}),
      } as ContactScore
    },
    enabled: !!contactId,
    staleTime: 10 * 60 * 1000, // 10 min cache
  })

  return { score: data, isLoading }
}

export function usePropertyScore(propertyId: string | undefined, source: 'internal' | 'market' = 'internal') {
  const { data, isLoading } = useQuery({
    queryKey: ['property-score', propertyId, source],
    queryFn: async (): Promise<PropertyScore | null> => {
      const column = source === 'internal' ? 'property_id' : 'market_listing_id'
      const { data, error } = await supabase
        .from('property_scores')
        .select('*')
        .eq(column, propertyId!)
        .eq('source', source)
        .single()
      if (error || !data) return null
      return data as PropertyScore
    },
    enabled: !!propertyId,
    staleTime: 10 * 60 * 1000,
  })

  return { score: data, isLoading }
}

export function useMarketRadar(limit = 20) {
  const { profile } = useAuth()

  const { data: changes = [], isLoading } = useQuery({
    queryKey: ['market-radar', limit],
    queryFn: async (): Promise<MarketChange[]> => {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('market_changes')
        .select('*')
        .gte('detected_at', since)
        .order('detected_at', { ascending: false })
        .limit(limit)
      return (data ?? []) as MarketChange[]
    },
    enabled: !!profile,
    staleTime: 5 * 60 * 1000,
  })

  const newListings = changes.filter(c => c.change_type === 'new')
  const priceDrops = changes.filter(c => c.change_type === 'price_drop')
  const removed = changes.filter(c => c.change_type === 'removed')

  return {
    changes,
    newListings,
    priceDrops,
    removed,
    isLoading,
    totalChanges: changes.length,
  }
}

// ── Score label helpers ──

export function getScoreLabel(score: number): 'excellent' | 'good' | 'average' | 'low' | 'poor' {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'average'
  if (score >= 20) return 'low'
  return 'poor'
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500'
  if (score >= 60) return 'text-emerald-400'
  if (score >= 40) return 'text-amber-500'
  if (score >= 20) return 'text-orange-500'
  return 'text-red-500'
}

export function getHeatLabel(heat: number): string {
  if (heat >= 80) return 'Très demandé'
  if (heat >= 60) return 'Bien positionné'
  if (heat >= 40) return 'Correct'
  if (heat >= 20) return 'Peu d\'intérêt'
  return 'Stagne'
}
