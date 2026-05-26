import { useQuery } from '@tanstack/react-query'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import SectionShell from './SectionShell'

// UI-level status — drives label + colors. Maps from the DB enum below.
type UiStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

interface VisitRow {
  id: string
  scheduled_at: string
  status: UiStatus
  notes: string | null
  property_title: string | null
  property_address: string | null
  agent_name: string | null
}

// `visits.status` is constrained to: planned | confirmed | done | cancelled | no_show
// (see baseline migration, visits_status_check). Map to the 4-bucket UI status.
function mapDbStatus(dbStatus: string | null | undefined): UiStatus {
  switch (dbStatus) {
    case 'confirmed': return 'confirmed'
    case 'done':      return 'completed'
    case 'cancelled': return 'cancelled'
    case 'no_show':   return 'cancelled'
    case 'planned':
    default:          return 'pending'
  }
}

const STATUS_META: Record<UiStatus, { label: string; bg: string; fg: string }> = {
  confirmed: { label: 'Confirmée', bg: '#E7F5EC', fg: '#0F7A3A' },
  pending: { label: 'En attente', bg: '#FBE9E0', fg: '#A85020' },
  completed: { label: 'Effectuée', bg: '#F2F4F8', fg: '#4A5249' },
  cancelled: { label: 'Annulée', bg: '#F2F4F8', fg: '#4A5249' },
}

function VisitItem({ v, isPast }: { v: VisitRow; isPast: boolean }) {
  const d = new Date(v.scheduled_at)
  const dayLine = d.toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const time = d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
  const status = STATUS_META[v.status]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr auto',
        gap: 14,
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          width: 56,
          padding: '8px 0',
          borderRadius: 8,
          textAlign: 'center',
          background: isPast ? '#F2F4F8' : T.ink,
          color: isPast ? T.soft : '#fff',
        }}
      >
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            opacity: 0.7,
          }}
        >
          {d.toLocaleDateString('fr-CH', { month: 'short' })}
        </div>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: -0.5,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          {d.getDate()}
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 13,
            fontWeight: 700,
            color: T.ink,
            marginBottom: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {v.property_title || 'Bien'} {v.property_address ? `· ${v.property_address}` : ''}
        </div>
        <div style={{ fontFamily: T.fontStack, fontSize: 11, color: T.muted }}>
          {dayLine} · {time}
          {v.agent_name ? ` · avec ${v.agent_name}` : ''}
        </div>
        {v.notes && (
          <div
            style={{
              fontFamily: T.fontStack,
              fontSize: 11,
              color: T.soft,
              marginTop: 4,
              fontStyle: 'italic',
            }}
          >
            « {v.notes} »
          </div>
        )}
      </div>
      <span
        style={{
          padding: '3px 9px',
          borderRadius: 6,
          background: status.bg,
          color: status.fg,
          fontFamily: T.fontStack,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {status.label}
      </span>
    </div>
  )
}

// Shape of the raw row returned by the supabase query below — typed here so
// the .map() callback is checked even though the client is currently untyped.
interface VisitsQueryRow {
  id: string
  scheduled_at: string
  status: string
  buyer_message: string | null
  properties: { title: string; address: string | null } | null
  agent: { full_name: string } | null
}

export default function VisitsRow() {
  const { user } = useAuth()
  const email = user?.email ?? null

  const { data: visits = [] } = useQuery({
    queryKey: ['account-visits', email],
    queryFn: async () => {
      if (!email) return [] as VisitRow[]

      // `visits` table (not `property_visits` — that one never existed).
      // RLS: relies on policy `visits_select_by_buyer_email` to grant access
      // when buyer_email matches the JWT email. See migration
      // 20260526140000_visits_select_by_buyer_email.sql.
      const { data, error } = await supabase
        .from('visits')
        .select(`
          id,
          scheduled_at,
          status,
          buyer_message,
          properties:property_id ( title, address ),
          agent:profiles!agent_id ( full_name )
        `)
        .order('scheduled_at', { ascending: false })
        .limit(20)

      if (error) {
        // Defensive: never throw from this query — empty list degrades cleanly
        // (the section short-circuits on visits.length === 0 below).
        return [] as VisitRow[]
      }

      return (data ?? []).map((r): VisitRow => {
        const row = r as unknown as VisitsQueryRow
        return {
          id: row.id,
          scheduled_at: row.scheduled_at,
          status: mapDbStatus(row.status),
          notes: row.buyer_message,
          property_title: row.properties?.title ?? null,
          property_address: row.properties?.address ?? null,
          agent_name: row.agent?.full_name ?? null,
        }
      })
    },
    enabled: !!email,
  })

  if (visits.length === 0) return null

  const now = new Date()
  const upcoming = visits.filter((v) => new Date(v.scheduled_at) >= now)
  const past = visits.filter((v) => new Date(v.scheduled_at) < now)

  return (
    <SectionShell
      id="profile-visits"
      title="Visites"
      subtitle={`${upcoming.length} à venir · ${past.length} effectuée${past.length > 1 ? 's' : ''}`}
    >
      {upcoming.map((v) => (
        <VisitItem key={v.id} v={v} isPast={false} />
      ))}
      {past.map((v) => (
        <VisitItem key={v.id} v={v} isPast={true} />
      ))}
    </SectionShell>
  )
}
