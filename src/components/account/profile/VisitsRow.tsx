import { useQuery } from '@tanstack/react-query'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import SectionShell from './SectionShell'

interface VisitRow {
  id: string
  scheduled_at: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  notes: string | null
  property_title: string | null
  property_address: string | null
  agent_name: string | null
}

const STATUS_META: Record<VisitRow['status'], { label: string; bg: string; fg: string }> = {
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

export default function VisitsRow() {
  const { user } = useAuth()

  const { data: visits = [] } = useQuery({
    queryKey: ['account-visits', user?.id],
    queryFn: async () => {
      if (!user) return [] as VisitRow[]
      const { data, error } = await supabase
        .from('property_visits')
        .select('id, scheduled_at, status, notes, property_title, property_address, agent_name')
        .eq('contact_email', user.email ?? '')
        .order('scheduled_at', { ascending: false })
        .limit(20)
      if (error) {
        // If table missing or filter invalid, just return empty
        return [] as VisitRow[]
      }
      return (data ?? []) as VisitRow[]
    },
    enabled: !!user,
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
