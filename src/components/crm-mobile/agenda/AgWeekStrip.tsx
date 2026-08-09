/**
 * Bandeau horizontal de sélection de jour (agenda mobile) : une pastille par jour,
 * avec jusqu'à 3 points signalant le nombre d'événements. Défile pour centrer le
 * jour sélectionné au montage.
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useMobileTokens } from '../useMobileTokens'
import { sameDay } from './vm'

interface AgWeekStripProps {
  days: Date[]
  selected: Date
  onSelect: (d: Date) => void
  /** nombre d'events ce jour (pastilles, max 3 affichées) */
  countFor: (d: Date) => number
}

/** Sélecteur de jour horizontal (port du proto `AgWeekStrip`). Auto-scroll sur le jour actif. */
export default function AgWeekStrip({ days, selected, onSelect, countFor }: AgWeekStripProps) {
  const { tk } = useMobileTokens()
  const { t } = useTranslation('calendar')
  const dows = t('days', { returnObjects: true }) as string[]
  const today = new Date()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const selRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    selRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [])

  return (
    <div
      ref={scrollRef}
      style={{ display: 'flex', gap: 'var(--crm-space-md)', overflowX: 'auto', margin: '0 -18px', padding: 'var(--crm-space-xs) var(--crm-space-4xl) var(--crm-space-md)', scrollbarWidth: 'none' }}
    >
      {days.map((d) => {
        const on = sameDay(d, selected)
        const isToday = sameDay(d, today)
        const count = countFor(d)
        return (
          <button
            key={d.toISOString()}
            ref={on ? selRef : undefined}
            type="button"
            onClick={() => onSelect(d)}
            style={{
              flexShrink: 0,
              width: 50,
              height: 70,
              borderRadius: 'var(--crm-radius-2xl)',
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--crm-space-xs)',
              background: on ? tk.accent : tk.card,
              boxShadow: on ? tk.shadow : tk.shadowSm,
              transition: 'background .2s ease',
            }}
          >
            <span
              style={{
                fontSize: 'var(--crm-text-xs)',
                fontWeight: 700,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
                color: on ? tk.accentInk : tk.muted,
              }}
            >
              {dows[d.getDay()]}
            </span>
            <span
              style={{
                fontSize: 'var(--crm-text-3xl)',
                fontWeight: 800,
                letterSpacing: -0.5,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                color: on ? tk.accentInk : isToday ? tk.ink : tk.inkSoft,
              }}
            >
              {d.getDate()}
            </span>
            <span style={{ display: 'flex', gap: 'var(--crm-space-2xs)', height: 5, alignItems: 'center' }}>
              {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                <span
                  key={i}
                  style={{ width: 4, height: 4, borderRadius: 'var(--crm-radius-pill)', background: on ? tk.accentInk : tk.ghost, opacity: on ? 0.9 : 1 }}
                />
              ))}
            </span>
          </button>
        )
      })}
    </div>
  )
}
