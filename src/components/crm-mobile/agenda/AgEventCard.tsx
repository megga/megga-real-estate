import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useMobileTokens } from '../useMobileTokens'
import { agIcon, agTone, fmtDur, fmtTime, type AgEventVM } from './vm'

interface AgEventCardProps {
  event: AgEventVM
  past: boolean
  onTap: () => void
}

/** Ligne d'événement (vue Liste) — rail horaire + carte type/titre/contact. */
export default function AgEventCard({ event, past, onTap }: AgEventCardProps) {
  const { tk, isDark } = useMobileTokens()
  const { t } = useTranslation('calendar')
  const tone = agTone(event.type, isDark)
  const subtitle = event.contactName ?? event.location ?? event.propertyTitle ?? ''

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
      <div style={{ width: 46, flexShrink: 0, paddingTop: 2, textAlign: 'center', fontSize: 12, fontWeight: 800, letterSpacing: -0.2, color: past ? tk.ghost : tk.ink, fontVariantNumeric: 'tabular-nums' }}>
        {fmtTime(event.start)}
      </div>
      <button
        type="button"
        onClick={onTap}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          border: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
          background: tk.card,
          borderRadius: 18,
          padding: 13,
          boxShadow: isDark ? `${tk.shadowSm}, inset 0 0 0 1px ${tk.cardBorder}` : tk.shadowSm,
          display: 'flex',
          alignItems: 'center',
          gap: 13,
          opacity: past ? 0.62 : 1,
        }}
      >
        <span style={{ width: 50, height: 50, borderRadius: 13, flexShrink: 0, background: tk.cardSubtle, display: 'grid', placeItems: 'center' }}>
          <MEIcon name={agIcon(event.type)} size={21} color={tone} strokeWidth={1.9} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: tone }}>
              {t(`eventType.${event.type}`)}
            </span>
            {event.durMin > 0 ? (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: tk.ghost, fontVariantNumeric: 'tabular-nums' }}>
                · {fmtDur(event.durMin, t)}
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: -0.3, color: past ? tk.muted : tk.ink, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {event.title}
          </div>
          {subtitle ? (
            <div style={{ fontSize: 12, fontWeight: 600, color: tk.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {past ? (
          <MEIcon name="check-circle" size={20} color={tk.ghost} />
        ) : (
          <MEIcon name="chevron-right" size={18} color={tk.ghost} strokeWidth={2} />
        )}
      </button>
    </div>
  )
}
