import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { SellerPortalData, SellerVisit, SellerActivity, MandateStep } from '@/lib/mockSellerData'

// ── Types ────────────────────────────────────────────────────────────────

export interface SellerPortalRow {
  id: string
  token: string
  agency_id: string | null
  contact_id: string
  property_id: string
  agent_id: string
  status: 'active' | 'expired' | 'revoked'
  created_at: string
  expires_at: string
  last_viewed_at: string | null
  view_count: number
}

export interface PortalValidation {
  isValid: boolean
  isExpired: boolean
  isRevoked: boolean
  isLoading: boolean
  data: SellerPortalData | null
  portal: SellerPortalRow | null
}

// ── Map transaction stage to mandate step ────────────────────────────────

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

// ── Map activity events to SellerActivity ────────────────────────────────

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

// ── Hook: validate token and load data (seller side) ─────────────────────

export function useSellerPortalAccess(token: string | undefined): PortalValidation {
  const { data, isLoading } = useQuery({
    queryKey: ['seller-portal', token],
    queryFn: async () => {
      if (!token) return null

      // 1. Fetch portal by token
      const { data: portal, error: portalErr } = await supabase
        .from('seller_portals')
        .select('id, agency_id, contact_id, property_id, agent_id, status, created_at, expires_at, last_viewed_at, view_count')
        .eq('token', token)
        .single()

      if (portalErr || !portal) return { portal: null, isRevoked: false, isExpired: false }

      const portalRow = portal as SellerPortalRow

      if (portalRow.status === 'revoked') {
        return { portal: portalRow, isRevoked: true, isExpired: false }
      }

      if (portalRow.status === 'expired' || new Date(portalRow.expires_at) < new Date()) {
        return { portal: portalRow, isRevoked: false, isExpired: true }
      }

      // 2. Record view (fire & forget)
      supabase
        .from('seller_portals')
        .update({
          last_viewed_at: new Date().toISOString(),
          view_count: (portalRow.view_count || 0) + 1,
        })
        .eq('id', portalRow.id)
        .then(() => {})

      // 3. Load all related data in parallel
      const [, propertyRes, transactionRes, visitsRes, agentRes, eventsRes, sellerLeadRes] = await Promise.all([
        // Contact (reserved for future enrichment)
        supabase
          .from('contacts')
          .select('id, first_name, last_name, email, phone')
          .eq('id', portalRow.contact_id)
          .single(),
        // Property
        supabase
          .from('properties')
          .select('id, title, address, city, canton, postal_code, price, rooms, surface_m2, type, photos, status, condition, created_at')
          .eq('id', portalRow.property_id)
          .single(),
        // Transaction
        supabase
          .from('transactions')
          .select('id, stage, status, price_offered, price_final, mandate_type, created_at')
          .eq('property_id', portalRow.property_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        // Visits
        supabase
          .from('visits')
          .select('id, scheduled_at, completed_at, status, feedback_buyer, rating')
          .eq('property_id', portalRow.property_id)
          .order('scheduled_at', { ascending: false }),
        // Agent profile
        supabase
          .from('profiles')
          .select('id, full_name, phone, email, avatar_url')
          .eq('id', portalRow.agent_id)
          .single(),
        // Activity events
        supabase
          .from('activity_events')
          .select('id, action, metadata, created_at')
          .or(`entity_id.eq.${portalRow.property_id},entity_id.eq.${portalRow.contact_id}`)
          .order('created_at', { ascending: false })
          .limit(20),
        // Seller lead (for estimation data)
        supabase
          .from('seller_leads')
          .select('estimation_min, estimation_max, estimation_median, estimation_confidence, comparable_count')
          .eq('contact_id', portalRow.contact_id)
          .eq('property_id', portalRow.property_id)
          .limit(1)
          .single(),
      ])

      const property = propertyRes.data
      const transaction = transactionRes.data
      const visits = visitsRes.data || []
      const agent = agentRes.data
      const events = eventsRes.data || []
      const sellerLead = sellerLeadRes.data

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
          offers_total: transaction?.price_offered ? 1 : 0,
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
        offers: transaction?.price_offered ? [{
          id: transaction.id,
          amount: transaction.price_offered,
          status: transaction.stage === 'offer' ? 'pending' as const :
                  transaction.stage === 'negotiation' ? 'counter_offer' as const :
                  transaction.stage === 'reserved' || transaction.stage === 'signed' ? 'accepted' as const :
                  'pending' as const,
          received_at: transaction.created_at,
          conditions: null,
        }] : [],
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

      return { portal: portalRow, isRevoked: false, isExpired: false, data: portalData }
    },
    enabled: !!token,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  if (!token || isLoading) {
    return { isValid: false, isExpired: false, isRevoked: false, isLoading, data: null, portal: null }
  }

  if (!data || !data.portal) {
    return { isValid: false, isExpired: false, isRevoked: false, isLoading: false, data: null, portal: null }
  }

  if (data.isRevoked) {
    return { isValid: false, isExpired: false, isRevoked: true, isLoading: false, data: null, portal: data.portal }
  }

  if (data.isExpired) {
    return { isValid: false, isExpired: true, isRevoked: false, isLoading: false, data: null, portal: data.portal }
  }

  return {
    isValid: true,
    isExpired: false,
    isRevoked: false,
    isLoading: false,
    data: data.data || null,
    portal: data.portal,
  }
}

// ── Helper: describe activity in French ─────────────────────────────────

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

export interface SellerPortalRecord {
  id: string
  token: string
  contactId: string
  status: 'active' | 'expired' | 'revoked'
}

export function useSellerPortals() {
  const getPortalForContact = useCallback(async (contactId: string): Promise<SellerPortalRecord | null> => {
    const { data } = await supabase
      .from('seller_portals')
      .select('id, token, contact_id, status')
      .eq('contact_id', contactId)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (!data) return null
    return { id: data.id, token: data.token, contactId: data.contact_id, status: data.status as 'expired' | 'active' | 'revoked' }
  }, [])

  const getPortalUrl = useCallback((token: string): string => {
    return `${window.location.origin}/portal/${token}`
  }, [])

  const createPortal = useCallback(async (_params: {
    contactId: string
    contactName: string
    contactEmail: string
    propertyTitle: string
    propertyAddress: string
    agentName?: string
  }): Promise<SellerPortalRecord | null> => {
    // Portal creation is now handled by useAcceptSellerLead
    // This is a stub for backwards compatibility
    const existing = await getPortalForContact(_params.contactId)
    return existing
  }, [getPortalForContact])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const markInviteSent = useCallback((_portalId: string) => {
    // No-op — invite tracking is handled by activity_events
  }, [])

  return {
    portals: [] as SellerPortalRecord[],
    createPortal,
    getPortalForContact,
    getPortalUrl,
    markInviteSent,
  }
}
