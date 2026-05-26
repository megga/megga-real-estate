import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface SellerLeadRow {
  id: string
  property_data: {
    address: string
    city: string
    canton: string
    postalCode: string
    type: string
    rooms: string
    surface: number
    photos: string[]
  }
  estimation_min: number | null
  estimation_max: number | null
  estimation_median: number | null
  estimation_confidence: string | null
  contact_name: string
  contact_email: string
  contact_phone: string | null
  motivation: string
  status: 'new' | 'contacted' | 'mandate' | 'lost'
  contact_id: string | null
  property_id: string | null
  created_at: string
}

export function useSellerLeads(status?: string) {
  return useQuery({
    queryKey: ['seller-leads', status],
    queryFn: async () => {
      let query = supabase
        .from('seller_leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (status) query = query.eq('status', status)

      const { data, error } = await query
      if (error) throw error
      return data as unknown as SellerLeadRow[]
    },
    staleTime: 30_000,
  })
}

export function useUpdateSellerLeadStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('seller_leads')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-leads'] })
    },
  })
}

export function useAcceptSellerLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ leadId, agencyId, agentId, agentName }: {
      leadId: string
      agencyId: string
      agentId: string
      agentName: string
    }) => {
      // 1. Fetch lead to get contact_id, property_id, and data
      const { data: lead, error: fetchErr } = await supabase
        .from('seller_leads')
        .select('*')
        .eq('id', leadId)
        .single()

      if (fetchErr || !lead) throw fetchErr || new Error('Lead not found')

      if (!lead.contact_id || !lead.property_id) {
        throw new Error('Lead missing contact_id or property_id')
      }

      // 2. Update contact with agency_id
      await supabase
        .from('contacts')
        .update({ agency_id: agencyId })
        .eq('id', lead.contact_id)

      // 3. Update property with agency_id + created_by
      await supabase
        .from('properties')
        .update({ agency_id: agencyId, created_by: agentId })
        .eq('id', lead.property_id)

      // 4. Create transaction
      const { data: transaction, error: txErr } = await supabase
        .from('transactions')
        .insert({
          agency_id: agencyId,
          property_id: lead.property_id,
          contact_seller_id: lead.contact_id,
          assigned_to: agentId,
          stage: 'new_lead',
          status: 'active',
        })
        .select('id')
        .single()

      if (txErr) throw txErr

      // 5. Create seller portal
      const token = crypto.randomUUID()
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + 6)

      const { error: portalErr } = await supabase.from('seller_portals').insert({
        token,
        agency_id: agencyId,
        contact_id: lead.contact_id,
        property_id: lead.property_id,
        agent_id: agentId,
        status: 'active',
        expires_at: expiresAt.toISOString(),
      })

      if (portalErr) throw portalErr

      // 6. Update seller_lead status
      await supabase
        .from('seller_leads')
        .update({
          status: 'contacted',
          assigned_agency_id: agencyId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)

      // 7. Log activity event
      await supabase.from('activity_events').insert({
        agency_id: agencyId,
        actor_id: agentId,
        action: 'seller_lead_accepted',
        entity_type: 'seller_lead',
        entity_id: leadId,
        metadata: {
          contact_id: lead.contact_id,
          property_id: lead.property_id,
          transaction_id: transaction?.id,
          portal_token: token,
        },
      })

      // 8. Send portal access email to seller (fire & forget)
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: lead.contact_email,
            template: 'seller_portal_access',
            data: {
              name: lead.contact_name,
              portal_url: `${window.location.origin}/portail/${token}`,
              address: (lead.property_data as { address?: string } | null)?.address || '',
              agent_name: agentName,
            },
          },
        })
      } catch {
        // Email failure should not block
      }

      return { token, contactId: lead.contact_id, propertyId: lead.property_id, transactionId: transaction?.id }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-leads'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useRejectSellerLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await supabase
        .from('seller_leads')
        .update({
          status: 'lost',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error

      // Log rejection
      await supabase.from('activity_events').insert({
        action: 'seller_lead_rejected',
        entity_type: 'seller_lead',
        entity_id: id,
        metadata: { reason: reason || null },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-leads'] })
    },
  })
}
