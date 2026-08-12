/**
 * Carte d'événement de la vue Liste (agenda mobile) : rail horaire à gauche, carte
 * type/durée/titre/contact à droite. Les événements passés sont grisés + cochés.
 */
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
    <div style={{ display: 'flex', gap: 'var(--crm-space-xl)', alignItems: 'stretch' }}>
      <div style={{ width: 46, flexShrink: 0, paddingTop: 'var(--crm-space-2xs)', textAlign: 'center', fontSize: 'var(--crm-text-md)', fontWeight: 500, letterSpacing: -0.2, color: past ? tk.muted : tk.ink, fontVariantNumeric: 'tabular-nums' }}>
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
          borderRadius: 'var(--crm-radius-3xl)',
          padding: 'var(--crm-space-xl)',
          boxShadow: isDark ? `${tk.shadowSm}, inset 0 0 0 1px ${tk.cardBorder}` : tk.shadowSm,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--crm-space-xl)',
          opacity: past ? 0.62 : 1,
        }}
      >
        <span style={{ width: 50, height: 50, borderRadius: 'var(--crm-radius-lg)', flexShrink: 0, background: tk.cardSubtle, display: 'grid', placeItems: 'center' }}>
          <MEIcon name={agIcon(event.type)} size={21} color={tone} strokeWidth={1.9} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
            <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: tone }}>
              {t(`eventType.${event.type}`)}
            </span>
            {event.durMin > 0 ? (
              <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: tk.muted, fontVariantNumeric: 'tabular-nums' }}>
                · {fmtDur(event.durMin, t)}
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 500, letterSpacing: -0.3, color: past ? tk.muted : tk.ink, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {event.title}
          </div>
          {subtitle ? (
            <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
