// MEGGA Marketplace — Page Property X "🏢 Agency Single".
// Route /agences/:slug — remplace l'ancien design "Sugar Editorial".
//
// Compose : PxNav + PxAgencyProfile + PxFooterPropertyX.
// Données : useAgencyProfile (agence + agents) + useAgencyListings (biens).

import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAgencyProfile } from '@/hooks/useAgentProfile'
import { PX } from '@/components/propertyx'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import PxAgencyProfile, {
  type AgencyData, type AgentMini, type ListingMini,
} from '@/components/propertyx/sections/PxAgencyProfile'

function useAgencyListings(agencyProfileId: string | null | undefined) {
  return useQuery({
    queryKey: ['agency-listings-px', agencyProfileId],
    enabled: !!agencyProfileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_listings')
        .select('id, title, price, current_price, address, city, canton, rooms, surface_m2, photos, transaction_type, type')
        .eq('agency_profile_id', agencyProfileId!)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(12)
      if (error) throw error
      return (data ?? []) as ListingMini[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

function LoadingState() {
  return (
    <div style={{
      padding: '120px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: PX.font.sans,
      color: PX.neutral500,
      fontSize: 16,
    }}>
      Chargement…
    </div>
  )
}

function NotFoundState({ slug }: { slug: string }) {
  return (
    <div style={{
      padding: '120px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      fontFamily: PX.font.sans,
      textAlign: 'center',
    }}>
      <h1 style={{
        margin: 0,
        fontSize: 36,
        fontWeight: 500,
        letterSpacing: '-1.08px',
        color: PX.neutral700,
      }}>Agence introuvable</h1>
      <p style={{
        margin: 0,
        fontSize: 16,
        color: PX.neutral500,
        letterSpacing: '-0.48px',
      }}>
        Aucune agence ne correspond au slug <code>{slug}</code>.
      </p>
      <Link to="/agences" style={{
        marginTop: 8,
        textDecoration: 'underline',
        textUnderlineOffset: 4,
        fontSize: 14,
        fontWeight: 500,
        color: PX.neutral700,
      }}>← Retour à l’annuaire</Link>
    </div>
  )
}

export default function PropertyXAgencyProfilePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { data, isLoading, error } = useAgencyProfile(slug)
  const { data: listings = [], isLoading: listingsLoading } = useAgencyListings(data?.agency?.id)

  return (
    <div style={{
      minHeight: '100vh',
      background: PX.surfaceBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
    }}>
      <PxNav bg={PX.surfaceBg} />

      {isLoading || listingsLoading ? (
        <LoadingState />
      ) : error || !data?.agency ? (
        <NotFoundState slug={slug} />
      ) : (
        <PxAgencyProfile
          agency={data.agency as unknown as AgencyData}
          agents={(data.agents ?? []) as unknown as AgentMini[]}
          listings={listings}
        />
      )}

      <PxFooterPropertyX />
    </div>
  )
}
