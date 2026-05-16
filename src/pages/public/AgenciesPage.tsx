// MEGGA Marketplace — Annuaire des agences (refonte design Property X).
// Composition :
//   <PxNav>
//   <PxAgenciesHero> (search + canton dans un browser pill)
//   <PxAgenciesGrid> (compteur + grille 2-col de cards)
//   <PxFooterPropertyX>
//
// Source de vérité : Supabase table `agency_profiles`. Pagination interne au
// hook (page de 1000) — la table peut contenir quelques milliers de lignes.

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PX } from '@/components/propertyx'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import PxAgenciesHero from '@/components/propertyx/sections/PxAgenciesHero'
import PxAgenciesGrid, { type AgencyDirectoryItem } from '@/components/propertyx/sections/PxAgenciesGrid'

const CANTON_LABELS: Record<string, string> = {
  AG: 'Argovie', AI: 'Appenzell RI', AR: 'Appenzell RE', BE: 'Berne', BL: 'Bâle-Campagne',
  BS: 'Bâle-Ville', FR: 'Fribourg', GE: 'Genève', GL: 'Glaris', GR: 'Grisons', JU: 'Jura',
  LU: 'Lucerne', NE: 'Neuchâtel', NW: 'Nidwald', OW: 'Obwald', SG: 'Saint-Gall',
  SH: 'Schaffhouse', SO: 'Soleure', SZ: 'Schwytz', TG: 'Thurgovie', TI: 'Tessin',
  UR: 'Uri', VD: 'Vaud', VS: 'Valais', ZG: 'Zoug', ZH: 'Zurich',
}

function useAgencies() {
  return useQuery({
    queryKey: ['agencies-directory-px'],
    queryFn: async (): Promise<AgencyDirectoryItem[]> => {
      const all: AgencyDirectoryItem[] = []
      let from = 0
      const pageSize = 1000
      while (true) {
        const { data, error } = await supabase
          .from('agency_profiles')
          .select('id, name, slug, canton, city, logo_url, website_url, status')
          .order('name')
          .range(from, from + pageSize - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        all.push(...(data as AgencyDirectoryItem[]))
        if (data.length < pageSize) break
        from += pageSize
      }
      return all
    },
    staleTime: 5 * 60 * 1000,
  })
}

export default function AgenciesPage() {
  const { data: agencies, isLoading } = useAgencies()
  const [search, setSearch] = useState('')
  const [canton, setCanton] = useState('')

  const filtered = useMemo<AgencyDirectoryItem[]>(() => {
    if (!agencies) return []
    let list = agencies
    if (canton) list = list.filter(a => a.canton === canton)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.city && a.city.toLowerCase().includes(q))
      )
    }
    return list
  }, [agencies, search, canton])

  const hasFilter = Boolean(search || canton)

  function clearFilters() {
    setSearch('')
    setCanton('')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: PX.neutral100,
      fontFamily: PX.font.sans,
      color: PX.ink,
    }}>
      <PxNav bg={PX.neutral100} />

      <PxAgenciesHero
        search={search}
        onSearchChange={setSearch}
        canton={canton}
        onCantonChange={setCanton}
        totalCount={agencies?.length ?? null}
      />

      <PxAgenciesGrid
        agencies={filtered}
        isLoading={isLoading}
        hasFilter={hasFilter}
        onClearFilters={clearFilters}
        selectedCantonLabel={canton ? CANTON_LABELS[canton] || canton : null}
      />

      <PxFooterPropertyX />
    </div>
  )
}
