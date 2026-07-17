/**
 * Hooks du portail vendeur (`/portail/:token`, page « Votre vente », lecture seule).
 * L'accès passe UNIQUEMENT par l'edge function `seller-portal-action` (service_role,
 * scopée au token) : aucune requête anon directe, un lien fuité n'expose que les
 * données de son propre token. Le hook réassemble le payload serveur (crm_offers,
 * transactions, visites…) vers le modèle de vue `SellerPortalData`.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { SellerPortalData, SellerVisit, SellerActivity, SellerOffer, MandateStep } from '@/lib/mockSellerData'

// ── Types ────────────────────────────────────────────────────────────────

export interface PortalValidation {
  isValid: boolean
  isExpired: boolean
  isRevoked: boolean
  isLoading: boolean
  data: SellerPortalData | null
}

// ── Payload de l'edge function seller-portal-action (action get_data) ───────
// Lignes brutes renvoyées côté serveur (service_role, scopé au token) ;
// l'assemblage final (KPIs, mapping) reste dans le hook (zéro changement de vue).
interface PortalProperty {
  id: string; title: string; address: string; city: string; canton: string
  postal_code: string; price: number; rooms: number; surface_m2: number
  type: string; photos: string[] | null; status: string; condition?: string | null; created_at: string
}
interface PortalTransaction {
  id: string; stage: string; status: string; price_offered: number | null
  price_final: number | null; mandate_type: string | null; created_at: string
}
interface PortalVisitRow {
  id: string; scheduled_at: string; completed_at: string | null
  status: string; feedback_buyer: string | null; rating: number | null
}
interface PortalAgentRow {
  id: string; full_name: string | null; phone: string | null; email: string | null; avatar_url: string | null
}
interface PortalEventRow { id: string; action: string; metadata: unknown; created_at: string }
interface PortalSellerLead {
  estimation_min: number | null; estimation_max: number | null; estimation_median: number | null
  estimation_confidence: string | null; comparable_count: number | null
}
interface PortalOfferRow {
  id: string; amount: number; status: string; kind: string
  parent_offer_id: string | null; conditions: unknown; created_at: string
}
interface GetDataPayload {
  ok: boolean
  reason?: 'invalid' | 'expired' | 'revoked'
  portal?: { id: string; created_at: string; view_count: number; property_id: string }
  property?: PortalProperty | null
  transaction?: PortalTransaction | null
  visits?: PortalVisitRow[]
  agent?: PortalAgentRow | null
  events?: PortalEventRow[]
  sellerLead?: PortalSellerLead | null
  offers?: PortalOfferRow[]
}

/** Traduit un statut/kind `crm_offers` (réel) vers le statut d'offre affiché côté vendeur. */
function mapOfferStatus(o: { status: string; kind: string }): SellerOffer['status'] {
  if (o.status === 'accepted') return 'accepted'
  if (o.status === 'rejected' || o.status === 'withdrawn') return 'rejected'
  if (o.status === 'expired') return 'expired'
  return o.kind === 'counter' ? 'counter_offer' : 'pending'
}

/** Conditions JSONB de l'offre → texte lisible (toggles standards + 'autres') ; null si rien. */
function conditionsToText(c: unknown): string | null {
  if (!c) return null
  if (typeof c === 'string') return c.trim() || null
  if (typeof c !== 'object') return null
  const o = c as Record<string, unknown>
  const parts: string[] = []
  if (o.financing) parts.push('Sous réserve de financement')
  if (o.sale) parts.push('Sous réserve de vente du bien de l\'acquéreur')
  if (o.diagnostic) parts.push('Sous réserve de diagnostic')
  if (o.occupancy) parts.push('Condition d\'occupation')
  if (typeof o.autres === 'string' && o.autres.trim()) parts.push(o.autres.trim())
  return parts.length ? parts.join(' · ') : null
}

/** Projette un stade de transaction (14 stades DB) sur l'étape de mandat affichée au vendeur. */
function stageToMandateStep(stage: string | null): MandateStep {
  switch (stage) {
    case 'new_lead':
    case 'to_qualify':
      return 'mandate_signed'
    case 'active_search':
      return 'published'
    case 'visit_planned':
    case 'visit_done':
      return 'visits'
    case 'interest_confirmed':
    case 'offer':
      return 'offers'
    case 'negotiation':
    case 'reserved':
      return 'negotiation'
    case 'financing':
    case 'notary':
      return 'notary'
    case 'signed':
    case 'closed':
      return 'sold'
    default:
      return 'mandate_signed'
  }
}

/** Devine le type d'activité vendeur à partir du nom d'action de l'`activity_event`. */
function mapActivityType(action: string): SellerActivity['type'] {
  if (action.includes('visit') && action.includes('plan')) return 'visit_planned'
  if (action.includes('visit')) return 'visit_done'
  if (action.includes('offer')) return 'offer_received'
  if (action.includes('document')) return 'document_added'
  if (action.includes('publish')) return 'publication'
  if (action.includes('mandate') || action.includes('accept')) return 'mandate_signed'
  if (action.includes('message')) return 'message'
  if (action.includes('price')) return 'price_update'
  return 'mandate_signed'
}

/**
 * Valide le token de portail et charge les données du vendeur via l'edge function.
 * Retourne un état discret (valide / expiré / révoqué / chargement) + `SellerPortalData`.
 */
export function useSellerPortalAccess(token: string | undefined): PortalValidation {
  const { data, isLoading } = useQuery({
    queryKey: ['seller-portal', token],
    queryFn: async () => {
      if (!token) return null

      // Lecture via edge function token-validée (service_role côté serveur). AUCUNE
      // requête anon directe : un lien fuité n'accède qu'aux données de SON token
      // (blast radius minimal — cf. seller-portal-action, même pattern que les écritures).
      const { data: res, error: invokeErr } = await supabase.functions.invoke(
        'seller-portal-action',
        { body: { token, action: 'get_data' } },
      )
      const payload = (res ?? null) as GetDataPayload | null
      if (invokeErr || !payload) return { isRevoked: false, isExpired: false, data: null }
      if (!payload.ok) {
        return { isRevoked: payload.reason === 'revoked', isExpired: payload.reason === 'expired', data: null }
      }

      const property = payload.property ?? null
      const transaction = payload.transaction ?? null
      const visits = payload.visits ?? []
      const agent = payload.agent ?? null
      const events = payload.events ?? []
      const sellerLead = payload.sellerLead ?? null
      const offers = payload.offers ?? []
      const portalRow = payload.portal ?? { id: '', created_at: new Date().toISOString(), view_count: 0, property_id: '' }

      // 4. Build SellerPortalData
      const mandateStep = stageToMandateStep(transaction?.stage || null)
      const publishedAt = property?.created_at || portalRow.created_at
      const daysOnMarket = Math.max(0, Math.floor((Date.now() - new Date(publishedAt).getTime()) / 86400000))

      const portalData: SellerPortalData = {
        property: {
          id: property?.id || portalRow.property_id,
          title: property?.title || 'Bien immobilier',
          address: property?.address || '',
          city: property?.city || '',
          canton: property?.canton || '',
          postal_code: property?.postal_code || '',
          price: property?.price || 0,
          rooms: property?.rooms || 0,
          surface_m2: property?.surface_m2 || 0,
          type: property?.type || 'apartment',
          photo: property?.photos?.[0] || '',
          photos: property?.photos || [],
          status: (property?.status === 'active' || property?.status === 'reserved' || property?.status === 'sold')
            ? property.status as 'active' | 'reserved' | 'sold'
            : 'active',
          mandate_type: (transaction?.mandate_type as 'exclusive' | 'simple') || 'simple',
          mandate_signed_at: transaction?.created_at || portalRow.created_at,
          published_at: publishedAt,
        },
        kpis: {
          visits_total: visits.length,
          visits_this_month: visits.filter(v => {
            const d = new Date(v.scheduled_at)
            const now = new Date()
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
          }).length,
          offers_total: offers.length,
          online_views: portalRow.view_count || 0,
          days_on_market: daysOnMarket,
          current_step: mandateStep,
        },
        visits: visits.map((v): SellerVisit => ({
          id: v.id,
          date: v.scheduled_at,
          status: v.status as SellerVisit['status'],
          feedback: v.feedback_buyer || null,
          rating: v.rating || null,
        })),
        offers: offers.map((o): SellerOffer => ({
          id: o.id,
          amount: o.amount,
          status: mapOfferStatus(o),
          received_at: o.created_at,
          conditions: conditionsToText(o.conditions),
        })),
        activities: events.map((e): SellerActivity => ({
          id: e.id,
          type: mapActivityType(e.action),
          description: describeActivity(e.action, e.metadata as Record<string, unknown> | null),
          date: e.created_at,
        })),
        agent: {
          name: agent?.full_name || 'Agent MEGGA',
          phone: agent?.phone || '',
          email: agent?.email || '',
          photo: agent?.avatar_url || null,
        },
        estimation: sellerLead ? {
          min: sellerLead.estimation_min,
          max: sellerLead.estimation_max,
          median: sellerLead.estimation_median,
          confidence: sellerLead.estimation_confidence,
          comparable_count: sellerLead.comparable_count,
        } : undefined,
      }

      return { isRevoked: false, isExpired: false, data: portalData }
    },
    enabled: !!token,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  if (!token || isLoading) {
    return { isValid: false, isExpired: false, isRevoked: false, isLoading, data: null }
  }

  if (!data) {
    return { isValid: false, isExpired: false, isRevoked: false, isLoading: false, data: null }
  }

  if (data.isRevoked) {
    return { isValid: false, isExpired: false, isRevoked: true, isLoading: false, data: null }
  }

  if (data.isExpired) {
    return { isValid: false, isExpired: true, isRevoked: false, isLoading: false, data: null }
  }

  if (!data.data) {
    return { isValid: false, isExpired: false, isRevoked: false, isLoading: false, data: null }
  }

  return {
    isValid: true,
    isExpired: false,
    isRevoked: false,
    isLoading: false,
    data: data.data,
  }
}

/** Rend une phrase FR lisible par le vendeur pour un événement d'activité donné. */
function describeActivity(action: string, metadata: Record<string, unknown> | null): string {
  switch (action) {
    case 'seller_lead_accepted':
      return 'Votre dossier a été pris en charge par un agent MEGGA'
    case 'seller_lead_created':
      return 'Demande d\'estimation enregistrée'
    case 'visit_planned':
    case 'visit_created':
      return 'Nouvelle visite planifiée'
    case 'visit_completed':
      return 'Visite effectuée'
    case 'visit_cancelled':
      return 'Visite annulée'
    case 'offer_received':
      return `Offre reçue${metadata?.amount ? ` à CHF ${(metadata.amount as number).toLocaleString('fr-CH')}` : ''}`
    case 'stage_change':
      return `Avancement du dossier : ${metadata?.new_stage || 'mise à jour'}`
    case 'document_uploaded':
      return 'Nouveau document ajouté au dossier'
    case 'message_sent':
      return 'Nouveau message de votre agent'
    case 'price_update':
      return 'Prix du bien mis à jour'
    default:
      return action.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
  }
}

// ── Hook: manage portals (agent side) ────────────────────────────────────
