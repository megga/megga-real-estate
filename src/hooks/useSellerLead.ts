import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EstimationResult } from './usePropertyEstimation'

export interface SellerLeadInput {
  // Property data
  propertyData: {
    address: string
    city: string
    canton: string
    postalCode: string
    lat?: number
    lng?: number
    type: string
    rooms: string
    bedrooms: string
    surface: number
    condition: string
    yearBuilt: string
    photos: string[]
  }
  // Estimation
  estimation: EstimationResult
  // Contact
  contactName: string
  contactEmail: string
  contactPhone: string
  motivation: 'immediate' | '3months' | '6months' | 'exploring'
}

export function useSellerLead() {
  return useMutation({
    mutationFn: async (input: SellerLeadInput) => {
      const pd = input.propertyData
      const nameParts = input.contactName.trim().split(/\s+/)
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      // 1. Create contact (type: 'seller')
      const { data: contact, error: contactErr } = await supabase
        .from('contacts')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: input.contactEmail,
          phone: input.contactPhone || null,
          type: 'seller',
          source: 'website',
          score: input.motivation === 'immediate' ? 'hot' : input.motivation === '3months' ? 'warm' : 'cold',
          notes: `Motivation: ${input.motivation}. Estimation: ${input.estimation.estimation ? `CHF ${input.estimation.estimation}` : 'N/A'}`,
        })
        .select('id')
        .single()

      if (contactErr) throw contactErr

      // 2. Create property (status: 'draft')
      const { data: property, error: propErr } = await supabase
        .from('properties')
        .insert({
          title: `${pd.type === 'apartment' ? 'Appartement' : pd.type === 'house' ? 'Maison' : pd.type === 'villa' ? 'Villa' : pd.type === 'land' ? 'Terrain' : 'Bien'} — ${pd.city || pd.canton}`,
          type: pd.type || 'apartment',
          status: 'draft',
          price: input.estimation.estimation || null,
          currency: 'CHF',
          rooms: pd.rooms ? parseFloat(pd.rooms) : null,
          bedrooms: pd.bedrooms ? parseInt(pd.bedrooms) : null,
          surface_m2: pd.surface || null,
          condition: pd.condition || null,
          year_built: pd.yearBuilt ? parseInt(pd.yearBuilt) : null,
          address: pd.address,
          city: pd.city || null,
          canton: pd.canton,
          postal_code: pd.postalCode || null,
          lat: pd.lat || null,
          lng: pd.lng || null,
          photos: pd.photos.length > 0 ? pd.photos : null,
        })
        .select('id')
        .single()

      if (propErr) throw propErr

      // 3. Insert seller lead (links contact + property)
      const { data: lead, error: leadErr } = await supabase
        .from('seller_leads')
        .insert({
          property_data: pd,
          estimation_min: input.estimation.estimation_min,
          estimation_max: input.estimation.estimation_max,
          estimation_median: input.estimation.estimation,
          estimation_price_per_m2: input.estimation.median_price_m2,
          estimation_confidence: input.estimation.confidence,
          comparable_count: input.estimation.comparable_count,
          contact_name: input.contactName,
          contact_email: input.contactEmail,
          contact_phone: input.contactPhone || null,
          motivation: input.motivation,
          status: 'new',
          source: 'website',
          contact_id: contact.id,
          property_id: property.id,
        })
        .select('id')
        .single()

      if (leadErr) throw leadErr

      // 4. Create activity_event (audit trail)
      await supabase.from('activity_events').insert({
        action: 'seller_lead_created',
        entity_type: 'seller_lead',
        entity_id: lead.id,
        metadata: {
          contact_id: contact.id,
          property_id: property.id,
          estimation: input.estimation.estimation,
          motivation: input.motivation,
          source: 'website',
        },
      }).then(() => {})

      // 5. Create daily_action for agent notification
      await supabase.from('daily_actions').insert({
        priority: 'high',
        category: 'follow_up',
        title: `Nouveau vendeur : ${input.contactName}`,
        description: `${pd.city || pd.canton} — ${pd.type} ${pd.rooms}p. ${pd.surface} m² — Estimation ${input.estimation.estimation ? `CHF ${Math.round(input.estimation.estimation / 1000)}K` : 'N/A'} — Motivation: ${input.motivation}`,
        entity_type: 'contact',
        entity_id: contact.id,
        action_type: 'call',
        is_completed: false,
      }).then(() => {})

      // 6. Send confirmation email to seller (fire & forget)
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: input.contactEmail,
            subject: 'Votre estimation MEGGA',
            template: 'seller_estimation',
            data: {
              name: input.contactName,
              address: pd.address,
              city: pd.city,
              estimation_min: input.estimation.estimation_min,
              estimation_max: input.estimation.estimation_max,
              estimation_median: input.estimation.estimation,
              confidence: input.estimation.confidence,
            },
          },
        })
      } catch {
        // Email failure should not block lead creation
      }

      // 7. Send notification email to agent (fire & forget)
      try {
        // Find an admin/agent to notify
        const { data: agentProfile } = await supabase
          .from('profiles')
          .select('email')
          .in('role', ['admin', 'manager', 'agent'])
          .limit(1)
          .single()

        const agentEmail = agentProfile?.email || 'agent@megga.ch'
        const estMin = input.estimation.estimation_min ? `CHF ${Math.round(input.estimation.estimation_min / 1000)}K` : 'N/A'
        const estMax = input.estimation.estimation_max ? `CHF ${Math.round(input.estimation.estimation_max / 1000)}K` : 'N/A'
        await supabase.functions.invoke('send-email', {
          body: {
            to: agentEmail,
            subject: `Nouveau lead vendeur — ${input.contactName}, ${pd.city || pd.canton}`,
            template: 'agent_new_seller_lead',
            data: {
              seller_name: input.contactName,
              seller_email: input.contactEmail,
              seller_phone: input.contactPhone || 'Non renseigné',
              address: pd.address,
              city: pd.city,
              canton: pd.canton,
              type: pd.type,
              rooms: pd.rooms,
              surface: pd.surface,
              estimation_range: `${estMin} - ${estMax}`,
              motivation: input.motivation,
              dashboard_url: `${window.location.origin}/dashboard`,
            },
          },
        })
      } catch {
        // Agent email failure should not block
      }

      return { leadId: lead.id, contactId: contact.id, propertyId: property.id }
    },
  })
}
