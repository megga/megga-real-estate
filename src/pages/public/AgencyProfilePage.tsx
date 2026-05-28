// MEGGA Marketplace — Page profil agence publique (/agencies/:slug)
// Compose : PxNav + PxAgencyProfile (section hero + biens + équipe) + PxFooter.
// Source : useAgencyProfile (agence + agents liés) + market_listings actifs.

import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PX } from '@/components/propertyx'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import PxAgencyProfile, {
  type AgencyData,
  type AgentMini,
  type ListingMini,
} from '@/components/propertyx/sections/PxAgencyProfile'
import { useAgencyProfile } from '@/hooks/useAgentProfile'

function useAgencyListings(agencyId: string | undefined) {
  return useQuery({
    queryKey: ['agency-listings', agencyId],
    queryFn: async (): Promise<ListingMini[]> => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('market_listings')
        .select('id, title, price, current_price, address, city, canton, rooms, surface_m2, photos, transaction_type, type')
        .eq('agency_profile_id', agencyId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(24)
      if (error) throw error
      return (data ?? []) as ListingMini[]
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })
}

export default function AgencyProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const { data, isLoading, error } = useAgencyProfile(slug ?? '')
  const { data: listings } = useAgencyListings(data?.agency?.id)

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: PX.neutral100, fontFamily: PX.font.sans }}>
        <PxNav bg={PX.neutral100} />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 24px' }}>
          <div style={{ height: 14, width: 160, background: PX.neutral200, borderRadius: 4, marginBottom: 16 }} />
          <div style={{ height: 56, width: 420, maxWidth: '80%', background: PX.neutral200, borderRadius: 8 }} />
        </div>
      </div>
    )
  }

  if (error || !data?.agency) {
    return (
      <div style={{ minHeight: '100vh', background: PX.neutral100, fontFamily: PX.font.sans }}>
        <PxNav bg={PX.neutral100} />
        <div style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '160px 24px',
          textAlign: 'center',
        }}>
          <h1 style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 28,
            fontWeight: 500,
            color: PX.ink,
          }}>Agence introuvable</h1>
          <p style={{
            marginTop: 12,
            color: PX.neutral500,
            fontSize: 16,
          }}>
            Cette agence n'existe pas ou n'est plus référencée.
          </p>
          <Link
            to="/agencies"
            style={{
              display: 'inline-block',
              marginTop: 32,
              padding: '12px 24px',
              background: PX.neutral700,
              color: PX.neutral100,
              borderRadius: PX.radius.pill,
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Voir toutes les agences
          </Link>
        </div>
        <PxFooterPropertyX />
      </div>
    )
  }

  const agency = data.agency as unknown as AgencyData
  const agents = (data.agents ?? []) as unknown as AgentMini[]

  return (
    <div style={{
      minHeight: '100vh',
      background: PX.neutral100,
      fontFamily: PX.font.sans,
      color: PX.ink,
    }}>
      <PxNav bg={PX.neutral100} />
      <PxAgencyProfile agency={agency} agents={agents} listings={listings ?? []} />
      <PxFooterPropertyX />
    </div>
  )
}
