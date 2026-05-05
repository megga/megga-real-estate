import { useQuery } from '@tanstack/react-query'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { pickPhoto } from '@/lib/listingPhotos'
import SectionShell from './SectionShell'

interface UserListing {
  id: string
  title: string | null
  address: string | null
  surface_m2: number | null
  rooms: number | null
  price: number | null
  status: string | null
  photos: string[] | null
  views_count: number | null
  favorites_count: number | null
  published_at: string | null
}

function formatCHF(n: number | null | undefined): string {
  if (n == null) return 'CHF —'
  return `CHF ${n.toLocaleString('fr-CH').replace(/ |,| /g, "'")}`
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  active: { label: 'En ligne', bg: '#E7F5EC', fg: '#0F7A3A' },
  draft: { label: 'Brouillon', bg: '#F2F4F8', fg: '#4A5249' },
  pending: { label: 'En attente', bg: '#FBE9E0', fg: '#A85020' },
  sold: { label: 'Vendu', bg: '#0E1410', fg: '#fff' },
  archived: { label: 'Archivée', bg: '#F2F4F8', fg: '#4A5249' },
}

function StatusPill({ status }: { status: string | null }) {
  const meta = STATUS_META[status ?? 'active'] ?? STATUS_META.active
  return (
    <span
      style={{
        padding: '3px 9px',
        borderRadius: 6,
        background: meta.bg,
        color: meta.fg,
        fontFamily: T.fontStack,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}
    >
      {meta.label}
    </span>
  )
}

function Stat({ n, lab }: { n: number; lab: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: T.fontStack,
          fontSize: 14,
          fontWeight: 800,
          color: T.ink,
          letterSpacing: -0.2,
        }}
      >
        {n.toLocaleString('fr-CH')}
      </span>
      <span style={{ fontFamily: T.fontStack, fontSize: 11, color: T.muted }}>{lab}</span>
    </span>
  )
}

interface CardProps {
  listing: UserListing
  onOpenStats?: (l: UserListing) => void
}

function ListingCard({ listing: l, onOpenStats }: CardProps) {
  const photo = pickPhoto({ photos: l.photos ?? [], photos_cf: null }, 0, 'thumb')

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px minmax(0, 1fr)',
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        background: '#fff',
        minWidth: 0,
      }}
    >
      <div
        style={{
          background: photo
            ? `center/cover no-repeat url(${photo})`
            : 'linear-gradient(135deg,#d8d8d0,#b8b8ae)',
          minHeight: 170,
        }}
      />
      <div
        style={{
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <StatusPill status={l.status} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: T.fontStack,
              fontSize: 15,
              fontWeight: 700,
              color: T.ink,
              letterSpacing: -0.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {l.title || 'Bien sans titre'}
          </div>
          <div
            style={{
              fontFamily: T.fontStack,
              fontSize: 12,
              color: T.muted,
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {l.address || '—'}
            {l.surface_m2 != null ? ` · ${l.surface_m2} m²` : ''}
            {l.rooms != null ? ` · ${l.rooms} pces` : ''}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenStats?.(l)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            background: '#FAFAF7',
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: T.fontStack,
            minWidth: 0,
            flexWrap: 'wrap',
            rowGap: 6,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#F2F4EF')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#FAFAF7')}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              minWidth: 0,
              flex: '1 1 auto',
            }}
          >
            <Stat n={l.views_count ?? 0} lab="vues" />
            <Stat n={l.favorites_count ?? 0} lab="favoris" />
          </span>
          <span style={{ fontSize: 10, color: T.muted, fontWeight: 700, whiteSpace: 'nowrap' }}>
            Stats →
          </span>
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginTop: 'auto',
            paddingTop: 4,
            flexWrap: 'wrap',
            rowGap: 8,
          }}
        >
          <div
            style={{
              fontFamily: T.fontStack,
              fontSize: 16,
              fontWeight: 800,
              color: T.ink,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: -0.3,
              whiteSpace: 'nowrap',
            }}
          >
            {formatCHF(l.price)}
          </div>
          <a
            href="/compte#listings"
            style={{
              fontFamily: T.fontStack,
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              textDecoration: 'none',
              padding: '0 12px',
              height: 30,
              borderRadius: 999,
              background: T.ink,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
            }}
          >
            Gérer →
          </a>
        </div>
      </div>
    </div>
  )
}

interface Props {
  onOpenStats?: (l: UserListing) => void
}

export default function MyListingsRow({ onOpenStats }: Props) {
  const { user } = useAuth()

  const { data: listings = [] } = useQuery({
    queryKey: ['account-my-listings', user?.id],
    queryFn: async () => {
      if (!user) return [] as UserListing[]
      const { data, error } = await supabase
        .from('properties')
        .select(
          'id, title, address, surface_m2, rooms, price, status, photos, views_count, favorites_count, published_at'
        )
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []) as UserListing[]
    },
    enabled: !!user,
  })

  if (listings.length === 0) {
    return (
      <SectionShell
        title="Mes biens"
        subtitle="Vous n'avez pas encore d'annonce."
        id="profile-listings"
      >
        <a
          href="/vendre"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            height: 40,
            padding: '0 18px',
            borderRadius: 999,
            background: T.ink,
            color: '#fff',
            fontFamily: T.fontStack,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          + Publier un bien
        </a>
      </SectionShell>
    )
  }

  return (
    <SectionShell
      id="profile-listings"
      title="Mes biens"
      subtitle={`${listings.length} bien${listings.length > 1 ? 's' : ''} sur le marché`}
      action={
        <a
          href="/vendre"
          style={{
            height: 30,
            padding: '0 12px',
            borderRadius: 999,
            background: T.ink,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            textDecoration: 'none',
            fontFamily: T.fontStack,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
        >
          + Nouveau bien
        </a>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {listings.map((l) => (
          <ListingCard key={l.id} listing={l} onOpenStats={onOpenStats} />
        ))}
      </div>
    </SectionShell>
  )
}
