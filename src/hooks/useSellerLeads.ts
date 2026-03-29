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
      return data as SellerLeadRow[]
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
    mutationFn: async ({ leadId, agencyId }: { leadId: string; agencyId: string }) => {
      // 1. Update lead status to 'contacted' + assign agency
      const { error: updateErr } = await supabase
        .from('seller_leads')
        .update({
          status: 'contacted',
          assigned_agency_id: agencyId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)

      if (updateErr) throw updateErr

      // 2. Fetch lead to get contact_id and property_id
      const { data: lead, error: fetchErr } = await supabase
        .from('seller_leads')
        .select('contact_id, property_id, contact_name, contact_email, property_data')
        .eq('id', leadId)
        .single()

      if (fetchErr || !lead) throw fetchErr || new Error('Lead not found')

      // 3. Create seller portal if contact + property exist
      if (lead.contact_id && lead.property_id) {
        const token = crypto.randomUUID()
        const expiresAt = new Date()
        expiresAt.setMonth(expiresAt.getMonth() + 6)

        await supabase.from('seller_portals').insert({
          token,
          contact_id: lead.contact_id,
          property_id: lead.property_id,
          status: 'active',
          expires_at: expiresAt.toISOString(),
        })

        // 4. Send portal access email to seller (fire & forget)
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              to: lead.contact_email,
              subject: 'Accès à votre espace vendeur MEGGA',
              template: 'seller_portal_access',
              data: {
                name: lead.contact_name,
                portal_url: `${window.location.origin}/portail/${token}`,
                address: lead.property_data?.address || '',
              },
            },
          })
        } catch {
          // Email failure should not block
        }

        return { token }
      }

      return { token: null }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-leads'] })
    },
  })
}
