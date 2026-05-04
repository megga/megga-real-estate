import { useState } from 'react'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import SectionShell from './SectionShell'
import { relativeTime } from './relativeTime'

export type ActivityKind =
  | 'lead-received'
  | 'photo-signed'
  | 'listing-viewed'
  | 'listing-published'
  | 'visit-booked'
  | 'visit-completed'
  | 'favorite-added'
  | 'search-saved'
  | 'agent-replied'
  | 'verification-step'
  | 'estimation-received'

export interface ActivityEvent {
  id: string
  kind: ActivityKind
  at: string
  title: string
  sub?: string
  deepLink?: string
}

const TONES: Record<ActivityKind, { bg: string; fg: string }> = {
  'lead-received': { bg: '#E8EFFE', fg: '#0041D9' },
  'photo-signed': { bg: '#F2F4F8', fg: '#0E1410' },
  'listing-viewed': { bg: '#F2F4F8', fg: '#4A5249' },
  'listing-published': { bg: '#E7F5EC', fg: '#0F7A3A' },
  'visit-booked': { bg: '#E8EFFE', fg: '#0041D9' },
  'visit-completed': { bg: '#E7F5EC', fg: '#0F7A3A' },
  'favorite-added': { bg: '#FBE9E0', fg: '#A85020' },
  'search-saved': { bg: '#F2F4F8', fg: '#4A5249' },
  'agent-replied': { bg: '#E8EFFE', fg: '#0041D9' },
  'verification-step': { bg: '#E7F5EC', fg: '#0F7A3A' },
  'estimation-received': { bg: '#F2F4F8', fg: '#0E1410' },
}

function iconFor(kind: ActivityKind) {
  const stroke = 'currentColor'
  switch (kind) {
    case 'lead-received':
    case 'agent-replied':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4h12v8H6l-4 2.5z" />
        </svg>
      )
    case 'photo-signed':
    case 'verification-step':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1l5 2v5c0 4-5 7-5 7s-5-3-5-7V3z" />
        </svg>
      )
    case 'listing-viewed':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" />
          <circle cx="8" cy="8" r="2" />
        </svg>
      )
    case 'listing-published':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 8l6-5 6 5v6a1 1 0 01-1 1h-3v-4H6v4H3a1 1 0 01-1-1z" />
        </svg>
      )
    case 'visit-booked':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3.5" width="12" height="10.5" rx="1" />
          <path d="M2 6.5h12M5 2.5v2M11 2.5v2" />
        </svg>
      )
    case 'visit-completed':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8.5l3 3 7-7" />
        </svg>
      )
    case 'favorite-added':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 14s-5.5-3.5-5.5-7.5A3 3 0 018 4a3 3 0 015.5 2.5C13.5 10.5 8 14 8 14z" />
        </svg>
      )
    case 'search-saved':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 2h8v12l-4-3-4 3z" />
        </svg>
      )
    case 'estimation-received':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 1.5h6l3 3v10H4z" />
          <path d="M10 1.5v3h3M6 8h4M6 11h4" />
        </svg>
      )
  }
}

interface Props {
  events: ActivityEvent[]
  limit?: number
}

export default function ActivityTimeline({ events, limit = 8 }: Props) {
  const [showAll, setShowAll] = useState(false)
  const items = showAll ? events : events.slice(0, limit)

  if (events.length === 0) {
    return (
      <SectionShell
        id="profile-activity"
        title="Activité récente"
        subtitle="Vos actions sur MEGGA s'afficheront ici."
      >
        <div
          style={{
            padding: '20px 22px',
            border: `1px dashed ${T.border}`,
            borderRadius: 12,
            background: T.page,
            fontFamily: T.fontStack,
            fontSize: 13,
            color: T.soft,
            lineHeight: 1.55,
          }}
        >
          Aucune activité pour le moment. Lancez une recherche, ajoutez un favori ou publiez une
          annonce — votre fil se remplira.
        </div>
      </SectionShell>
    )
  }

  return (
    <SectionShell
      id="profile-activity"
      title="Activité récente"
      subtitle={`${events.length} évènement${events.length > 1 ? 's' : ''}`}
      action={
        events.length > limit ? (
          <button
            onClick={() => setShowAll((s) => !s)}
            style={{
              height: 30,
              padding: '0 12px',
              borderRadius: 999,
              border: `1px solid ${T.border}`,
              background: '#fff',
              color: T.ink,
              cursor: 'pointer',
              fontFamily: T.fontStack,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.2,
            }}
          >
            {showAll ? 'Réduire' : 'Tout voir'}
          </button>
        ) : undefined
      }
    >
      <div>
        {items.map((ev, i) => {
          const tone = TONES[ev.kind] ?? { bg: '#F2F4F8', fg: '#4A5249' }
          const last = i === items.length - 1
          const Wrapper = ev.deepLink ? 'a' : 'div'
          return (
            <Wrapper
              key={ev.id}
              {...(ev.deepLink ? { href: ev.deepLink } : {})}
              style={{
                display: 'grid',
                gridTemplateColumns: '30px 1fr auto',
                gap: 14,
                alignItems: 'flex-start',
                padding: '12px 0',
                textDecoration: 'none',
                color: 'inherit',
                borderBottom: last ? 'none' : `1px solid ${T.border}`,
                cursor: ev.deepLink ? 'pointer' : 'default',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  flexShrink: 0,
                  background: tone.bg,
                  color: tone.fg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                }}
              >
                {iconFor(ev.kind)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: T.fontStack,
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.ink,
                    lineHeight: 1.4,
                    letterSpacing: -0.05,
                  }}
                >
                  {ev.title}
                </div>
                {ev.sub && (
                  <div
                    style={{
                      fontFamily: T.fontStack,
                      fontSize: 12,
                      color: T.soft,
                      marginTop: 3,
                      lineHeight: 1.45,
                    }}
                  >
                    {ev.sub}
                  </div>
                )}
              </div>
              <div
                title={new Date(ev.at).toLocaleString('fr-CH')}
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 11,
                  color: T.muted,
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                  marginTop: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                {relativeTime(new Date(ev.at))}
              </div>
            </Wrapper>
          )
        })}
      </div>
    </SectionShell>
  )
}
