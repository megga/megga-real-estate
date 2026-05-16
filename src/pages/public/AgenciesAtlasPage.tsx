// MEGGA Marketplace — preview "Atlas des agences" (refonte v2 éditoriale).
// Route : /agences-atlas — temporaire, pour comparaison côte à côte avec
// l'actuelle /agences. Si validée, l'Atlas remplacera /agences.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PX } from '@/components/propertyx'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import PxAgenciesAtlas, { type AgencyAtlasItem } from '@/components/propertyx/sections/PxAgenciesAtlas'

function useAgencies() {
  return useQuery({
    queryKey: ['agencies-atlas'],
    queryFn: async (): Promise<AgencyAtlasItem[]> => {
      const all: AgencyAtlasItem[] = []
      let from = 0
      const pageSize = 1000
      while (true) {
        const { data, error } = await supabase
          .from('agency_profiles')
          .select('id, name, slug, canton, city, logo_url, status')
          .order('name')
          .range(from, from + pageSize - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        all.push(...(data as AgencyAtlasItem[]))
        if (data.length < pageSize) break
        from += pageSize
      }
      return all
    },
    staleTime: 5 * 60 * 1000,
  })
}

export default function AgenciesAtlasPage() {
  const { data: agencies, isLoading } = useAgencies()

  return (
    <div style={{
      minHeight: '100vh',
      background: PX.neutral100,
      fontFamily: PX.font.sans,
      color: PX.ink,
    }}>
      <PxNav bg={PX.neutral100} />
      <PxAgenciesAtlas
        agencies={agencies ?? []}
        isLoading={isLoading}
        totalCount={agencies?.length ?? null}
      />
      <PxFooterPropertyX />
    </div>
  )
}
