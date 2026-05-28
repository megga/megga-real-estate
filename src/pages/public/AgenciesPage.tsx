// MEGGA Marketplace — Annuaire des agences (refonte design Property X).
// Composition :
//   <PxNav>
//   <PxAgenciesHero> (search + canton + spécialité + vérifié, browser 4 zones)
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

// Postgrest cap = 1000 rows / requête. On parallélise jusqu'à 10 batches
// (= 10'000 agences max) — ~2× plus rapide qu'une boucle séquentielle.
const PAGE = 1000
const MAX_PAGES = 10

function useAgencies() {
  return useQuery({
    queryKey: ['agencies-directory-px'],
    queryFn: async (): Promise<AgencyDirectoryItem[]> => {
      const requests = Array.from({ length: MAX_PAGES }, (_, i) =>
        supabase
          .from('agency_profiles')
          .select('id, name, slug, canton, city, logo_url, website_url, status, specialties, agent_count, active_listings_count')
          .order('name')
          .range(i * PAGE, (i + 1) * PAGE - 1)
      )
      const responses = await Promise.all(requests)
      const all: AgencyDirectoryItem[] = []
      for (const r of responses) {
        if (r.error) throw r.error
        if (r.data?.length) all.push(...(r.data as AgencyDirectoryItem[]))
        if (!r.data || r.data.length < PAGE) break // stop early if last batch incomplete
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
  const [specialty, setSpecialty] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)

  const filtered = useMemo<AgencyDirectoryItem[]>(() => {
    if (!agencies) return []
    let list = agencies
    if (canton) list = list.filter(a => a.canton === canton)
    if (verifiedOnly) list = list.filter(a => a.status === 'verified')
    if (specialty) {
      list = list.filter(a => Array.isArray(a.specialties) && a.specialties.includes(specialty))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.city && a.city.toLowerCase().includes(q))
      )
    }
    return list
  }, [agencies, search, canton, specialty, verifiedOnly])

  const hasFilter = Boolean(search || canton || specialty || verifiedOnly)

  function clearFilters() {
    setSearch('')
    setCanton('')
    setSpecialty('')
    setVerifiedOnly(false)
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
        specialty={specialty}
        onSpecialtyChange={setSpecialty}
        verifiedOnly={verifiedOnly}
        onVerifiedOnlyChange={setVerifiedOnly}
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
