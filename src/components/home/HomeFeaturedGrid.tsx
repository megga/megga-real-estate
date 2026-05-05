// MEGGA Homepage — Featured listings grid (port 1:1 du proto megga-body.jsx).
// 3-col grid (vs ancien carousel) avec cards stylisées Manrope + badges.
// Source : Supabase market_listings (vraies données prod, pas hardcodées).

import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { HOME_FONT, HOME_M, formatCHF } from './homeTokens'

interface FeaturedListing {
  id: string
  title: string
  price: number
  rent: number | null
  address: string
  city: string
  rooms: number
  surface: number
  imageUrl: string | null
  badge?: string
  transaction_type: 'buy' | 'rent'
}

function pickBadge(row: Record<string, unknown>): string | undefined {
  if (row.status === 'price_reduced') return 'Baisse de prix'
  const seen = (row.first_seen_at as string) || (row.created_at as string)
  if (seen) {
    const ageH = (Date.now() - new Date(seen).getTime()) / 3_600_000
    if (ageH < 48) return 'Nouveau'
  }
  return undefined
}

function useHomeFeatured() {
  return useQuery({
    queryKey: ['home-featured-grid'],
    queryFn: async (): Promise<FeaturedListing[]> => {
      const baseSelect =
        'id, title, price, current_price, rent_chf, address, city, postal_code, rooms, surface_m2, photos, status, first_seen_at, created_at, transaction_type'

      const { data } = await supabase
        .from('market_listings')
        .select(baseSelect)
        .eq('status', 'active')
        .gte('quality_score', 50)
        .gt('price', 0)
        .not('photos', 'is', null)
        .order('first_seen_at', { ascending: false })
        .limit(6)

      return (data ?? [])
        .filter(r => Array.isArray(r.photos) && (r.photos as string[]).length > 0)
        .map(r => ({
          id: r.id as string,
          title: (r.title as string) || 'Bien immobilier',
          price: Number(r.current_price ?? r.price ?? 0),
          rent: r.rent_chf != null ? Number(r.rent_chf) : null,
          address: (r.address as string) || '',
          city: (r.city as string) || '',
          rooms: Number(r.rooms) || 0,
          surface: Number(r.surface_m2) || 0,
          imageUrl: (r.photos as string[])[0] ?? null,
          badge: pickBadge(r),
          transaction_type: (r.transaction_type as 'buy' | 'rent') || 'buy',
        }))
    },
    staleTime: 5 * 60 * 1000,
  })
}

export default function HomeFeaturedGrid() {
  const { data: listings, isLoading } = useHomeFeatured()
  const visible = listings ?? []

  return (
    <section
      style={{
        padding: '40px clamp(20px, 5vw, 80px) 80px',
        background: HOME_M.section,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 24,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: HOME_FONT,
              fontSize: 'clamp(32px, 4.5vw, 48px)',
              fontWeight: 700,
              color: HOME_M.ink,
              lineHeight: 1.05,
              margin: 0,
              letterSpacing: -1.2,
            }}
          >
            Annonces récentes.
          </h2>
          <p
            style={{
              fontFamily: HOME_FONT,
              fontSize: 14,
              color: HOME_M.soft,
              marginTop: 12,
              margin: 0,
            }}
          >
            Sélection des nouveaux biens en Suisse · mise à jour quotidienne
          </p>
        </div>
        <Link
          to="/louer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            height: 44,
            padding: '0 22px',
            borderRadius: 999,
            border: `1px solid ${HOME_M.ink}`,
            textDecoration: 'none',
            fontFamily: HOME_FONT,
            fontSize: 13,
            fontWeight: 600,
            color: HOME_M.ink,
            background: 'transparent',
          }}
        >
          Voir tout <span>→</span>
        </Link>
      </div>

      {isLoading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              style={{
                background: HOME_M.card,
                border: `1px solid ${HOME_M.border}`,
                borderRadius: 16,
                height: 380,
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div
          style={{
            padding: '80px 40px',
            textAlign: 'center',
            background: HOME_M.card,
            borderRadius: 16,
            border: `1px solid ${HOME_M.border}`,
            fontFamily: HOME_FONT,
            color: HOME_M.soft,
          }}
        >
          Aucun bien à afficher pour le moment.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {visible.map(l => (
            <ListingCard key={l.id} l={l} />
          ))}
        </div>
      )}
    </section>
  )
}

function ListingCard({ l }: { l: FeaturedListing }) {
  const isRent = l.transaction_type === 'rent'
  const priceLabel =
    isRent && l.rent
      ? formatCHF(l.rent) + ' / mois'
      : formatCHF(l.price)
  const txBadge = isRent ? 'À louer' : 'À vendre'
  const detailUrl = `/biens/${l.id}`

  return (
    <Link
      to={detailUrl}
      style={{
        background: HOME_M.card,
        border: `1px solid ${HOME_M.border}`,
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        textDecoration: 'none',
        color: 'inherit',
        transition:
          'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease, border-color 0.25s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow =
          '0 12px 32px rgba(14, 20, 16, 0.10), 0 2px 6px rgba(14, 20, 16, 0.04)'
        e.currentTarget.style.borderColor = '#cfd6c8'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = HOME_M.border
      }}
    >
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            width: '100%',
            height: 220,
            background: HOME_M.section,
            backgroundImage: l.imageUrl ? `url(${l.imageUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            height: 28,
            padding: '0 12px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(8px)',
            fontFamily: HOME_FONT,
            fontSize: 11,
            fontWeight: 600,
            color: HOME_M.ink,
            letterSpacing: 0.2,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 1px 2px rgba(14,20,16,0.06)',
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: isRent ? HOME_M.green : HOME_M.ink,
            }}
          />
          {txBadge}
        </span>
        {l.badge && (
          <span
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              height: 28,
              padding: '0 10px',
              borderRadius: 999,
              background: HOME_M.green,
              color: '#fff',
              fontFamily: HOME_FONT,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {l.badge}
          </span>
        )}
      </div>

      <div style={{ padding: '18px 20px 20px' }}>
        <div
          style={{
            display: 'flex',
            gap: 14,
            fontFamily: HOME_FONT,
            fontSize: 12,
            fontWeight: 500,
            color: HOME_M.muted,
            marginBottom: 10,
            fontVariantNumeric: 'tabular-nums',
            flexWrap: 'wrap',
          }}
        >
          {l.rooms > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 11V5a1 1 0 011-1h2a1 1 0 011 1v3h4V5a1 1 0 011-1h2a1 1 0 011 1v6M2 11h12M2 11v2M14 11v2"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
              {l.rooms} pièces
            </span>
          )}
          {l.surface > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <rect
                  x="2"
                  y="2"
                  width="12"
                  height="12"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
              {l.surface} m²
            </span>
          )}
          {l.city && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 14s-5-4.5-5-8a5 5 0 0110 0c0 3.5-5 8-5 8z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  fill="none"
                />
                <circle
                  cx="8"
                  cy="6"
                  r="1.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  fill="none"
                />
              </svg>
              {l.city}
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: HOME_FONT,
            fontSize: 18,
            fontWeight: 700,
            color: HOME_M.ink,
            lineHeight: 1.3,
            letterSpacing: -0.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {l.title}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${HOME_M.border}`,
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: HOME_FONT,
              fontSize: 13,
              color: HOME_M.soft,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {l.address}
          </span>
          <span
            style={{
              fontFamily: HOME_FONT,
              fontSize: 16,
              fontWeight: 700,
              color: HOME_M.ink,
              letterSpacing: -0.3,
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}
          >
            {priceLabel}
          </span>
        </div>
      </div>
    </Link>
  )
}
