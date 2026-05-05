import { useQuery } from '@tanstack/react-query'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { useFavorites } from '@/hooks/useFavorites'
import { useSavedSearches, type SavedSearch } from '@/hooks/useSavedSearches'
import { supabase } from '@/lib/supabase'
import { pickPhoto } from '@/lib/listingPhotos'
import SectionShell, { EmptyInline } from './SectionShell'

function formatCHF(n: number | null | undefined): string {
  if (n == null) return 'CHF —'
  return `CHF ${n.toLocaleString('fr-CH').replace(/ |,| /g, "'")}`
}

interface FavListing {
  id: string
  title: string | null
  price: number | null
  rent: number | null
  address: string | null
  city: string | null
  photos: string[] | null
  transaction_type: 'buy' | 'rent' | null
}

function chipsFor(s: SavedSearch): string[] {
  const f = s.filters
  const chips: string[] = []
  chips.push(f.context === 'rent' ? 'Location' : 'Achat')
  if (f.types && f.types.length > 0) {
    const labels: Record<string, string> = {
      apartment: 'Appartement',
      house: 'Maison',
      villa: 'Villa',
      land: 'Terrain',
      commercial: 'Commercial',
    }
    chips.push(f.types.map((t) => labels[t] ?? t).join(' · '))
  }
  if (f.canton) chips.push(f.canton)
  if (f.city) chips.push(f.city)
  if (f.maxPrice) chips.push(`≤ ${(Number(f.maxPrice) / 1000).toFixed(0)}k`)
  if (f.rooms) chips.push(`≥ ${f.rooms} pces`)
  return chips
}

function SavedSearchCard({ s }: { s: SavedSearch }) {
  const target = s.filters.context === 'rent' ? '/louer' : '/acheter'
  const chips = chipsFor(s)
  return (
    <a
      href={`${target}?savedSearch=${s.id}`}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        padding: 16,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 6px 18px rgba(14,20,16,0.08)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div
        style={{
          fontFamily: T.fontStack,
          fontSize: 14,
          fontWeight: 700,
          color: T.ink,
          letterSpacing: -0.2,
        }}
      >
        {s.name}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {chips.map((c, i) => (
          <span
            key={i}
            style={{
              padding: '3px 9px',
              borderRadius: 999,
              background: '#F2F4F8',
              fontFamily: T.fontStack,
              fontSize: 11,
              fontWeight: 600,
              color: T.soft,
            }}
          >
            {c}
          </span>
        ))}
      </div>
    </a>
  )
}

function FavThumb({ l }: { l: FavListing }) {
  const photo = pickPhoto({ photos: l.photos ?? [], photos_cf: null }, 0, 'thumb')
  const isRent = l.transaction_type === 'rent'
  const price = l.price ?? l.rent
  return (
    <a
      href={`/listing/${l.id}`}
      style={{
        flexShrink: 0,
        width: 220,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        overflow: 'hidden',
        background: '#fff',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          height: 110,
          background: photo
            ? `center/cover no-repeat url(${photo})`
            : 'linear-gradient(135deg,#d8d8d0,#b8b8ae)',
        }}
      />
      <div style={{ padding: '10px 12px' }}>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 13,
            fontWeight: 800,
            color: T.ink,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: -0.2,
          }}
        >
          {formatCHF(price)}
          {isRent ? ' /mois' : ''}
        </div>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 11,
            color: T.muted,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {l.title ?? '—'} · {l.city ?? l.address ?? ''}
        </div>
      </div>
    </a>
  )
}

export default function MySearchRow() {
  const { searches } = useSavedSearches()
  const { favoriteIds } = useFavorites()

  const { data: favs = [] } = useQuery({
    queryKey: ['account-recent-favs', favoriteIds.slice(0, 4).join(',')],
    queryFn: async () => {
      const ids = favoriteIds.slice(0, 4)
      if (ids.length === 0) return [] as FavListing[]
      const { data, error } = await supabase
        .from('market_listings')
        .select('id, title, price, rent, address, city, photos, transaction_type')
        .in('id', ids)
      if (error) throw error
      return (data ?? []) as FavListing[]
    },
    enabled: favoriteIds.length > 0,
    staleTime: 60_000,
  })

  return (
    <SectionShell
      id="profile-search"
      title="Ma recherche"
      subtitle={`${searches.length} recherche${searches.length > 1 ? 's' : ''} · ${favs.length} favori${favs.length > 1 ? 's' : ''}`}
      action={
        <a
          href="/louer"
          style={{
            height: 30,
            padding: '0 12px',
            borderRadius: 999,
            border: `1px solid ${T.border}`,
            background: '#fff',
            color: T.ink,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            fontFamily: T.fontStack,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
        >
          Nouvelle recherche →
        </a>
      }
    >
      {searches.length === 0 && favs.length === 0 ? (
        <EmptyInline text="Aucune recherche active. Lancez-en une pour recevoir des alertes dès qu'un bien correspond." />
      ) : (
        <>
          {searches.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
                marginBottom: favs.length > 0 ? 18 : 0,
              }}
            >
              {searches.slice(0, 4).map((s) => (
                <SavedSearchCard key={s.id} s={s} />
              ))}
            </div>
          )}
          {favs.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: T.fontStack,
                    fontSize: 12,
                    fontWeight: 700,
                    color: T.muted,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Favoris récents
                </div>
                <a
                  href="#favorites"
                  style={{
                    fontFamily: T.fontStack,
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.ink,
                    textDecoration: 'none',
                  }}
                >
                  Tous les favoris →
                </a>
              </div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                {favs.map((l) => (
                  <FavThumb key={l.id} l={l} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </SectionShell>
  )
}
