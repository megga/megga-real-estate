import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { useFavorites } from '@/hooks/useFavorites'
import { useAuth } from '@/hooks/useAuth'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { supabase } from '@/lib/supabase'
import { pickPhoto } from '@/lib/listingPhotos'
import EmptyState from '../EmptyState'
import { HeartIcon } from '../icons'

interface FavoriteListing {
  id: string
  title: string | null
  price: number | null
  address: string | null
  city: string | null
  canton: string | null
  rooms: number | null
  bedrooms: number | null
  surface_m2: number | null
  photos: string[] | null
  photos_cf: unknown
  transaction_type: 'buy' | 'rent' | null
  charges_monthly: number | null
}

function formatPrice(listing: FavoriteListing): string {
  const price = listing.price
  if (!price && price !== 0) return 'CHF —'
  const isRent = listing.transaction_type === 'rent'
  const formatted = `CHF ${price.toLocaleString('fr-CH').replace(/\s|,/g, "'")}`
  return isRent ? `${formatted} /mois` : formatted
}

interface CardProps {
  listing: FavoriteListing
  onRemove: () => void
  onClick: () => void
}

function FavoriteCard({ listing, onRemove, onClick }: CardProps) {
  const photo = pickPhoto(
    { photos: listing.photos ?? [], photos_cf: null },
    0,
    'thumb',
  )

  return (
    <div
      onClick={onClick}
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        background: '#fff',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(14,20,16,0.08)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 220,
          background: photo
            ? `center/cover no-repeat url(${photo})`
            : 'linear-gradient(135deg, #d8d8d0, #b8b8ae)',
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 36,
            height: 36,
            borderRadius: 999,
            border: 'none',
            background: 'rgba(255,255,255,0.95)',
            color: T.warning,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
          title="Retirer des favoris"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill={T.warning} stroke={T.warning} strokeWidth="1.4">
            <path d="M8 14s-5.5-3.5-5.5-7.5A3.5 3.5 0 018 4a3.5 3.5 0 015.5 2.5C13.5 10.5 8 14 8 14z" />
          </svg>
        </button>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 18,
            fontWeight: 800,
            color: T.ink,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: -0.3,
          }}
        >
          {formatPrice(listing)}
        </div>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 13,
            fontWeight: 600,
            color: T.ink,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {listing.title || 'Bien sans titre'}
        </div>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 12,
            color: T.muted,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {listing.address || listing.city || ''}
          {listing.canton ? `, ${listing.canton}` : ''}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 14,
            marginTop: 6,
            fontFamily: T.fontStack,
            fontSize: 12,
            color: T.soft,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {listing.rooms != null && (
            <span>
              <strong style={{ color: T.ink, fontWeight: 700 }}>{listing.rooms}</strong> pièces
            </span>
          )}
          {listing.bedrooms != null && (
            <span>
              <strong style={{ color: T.ink, fontWeight: 700 }}>{listing.bedrooms}</strong> ch
            </span>
          )}
          {listing.surface_m2 != null && (
            <span>
              <strong style={{ color: T.ink, fontWeight: 700 }}>{listing.surface_m2}</strong> m²
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function FavoritesSection() {
  const { favoriteIds, toggleFavorite } = useFavorites()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { t } = useTranslation('compte')

  const { data: listings = [] } = useQuery({
    queryKey: ['account-favorites', favoriteIds.join(',')],
    queryFn: async () => {
      if (favoriteIds.length === 0) return [] as FavoriteListing[]
      const { data, error } = await supabase
        .from('market_listings')
        .select(
          'id, title, price, address, city, canton, rooms, bedrooms, surface_m2, photos, photos_cf, transaction_type, charges_monthly'
        )
        .in('id', favoriteIds)
      if (error) throw error
      return (data ?? []) as FavoriteListing[]
    },
    enabled: favoriteIds.length > 0,
    staleTime: 60_000,
  })

  if (favoriteIds.length === 0) {
    return (
      <EmptyState
        icon={<HeartIcon size={28} />}
        title={t('empty.favorites.title')}
        body={t('empty.favorites.body')}
        cta={t('empty.favorites.cta')}
        ctaHref="/louer"
      />
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        gap: 16,
      }}
    >
      {listings.map((l) => (
        <FavoriteCard
          key={l.id}
          listing={l}
          onRemove={() => toggleFavorite(l.id, !!user)}
          onClick={() => navigate(`/propriete/${l.id}`)}
        />
      ))}
    </div>
  )
}
