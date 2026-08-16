/**
 * Bottom-sheet de détail d'un événement d'agenda (mobile), rendu dans `CrmSheet`.
 * Composant présentationnel pur, en lecture seule (v1).
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { formatCHF } from '@/lib/utils'
import { useMobileTokens } from '../useMobileTokens'
import CrmSheet from '../primitives/CrmSheet'
import { agIcon, agTone, fmtDur, fmtTime, type AgEventVM } from './vm'

interface AgEventSheetProps {
  event: AgEventVM | null
  onClose: () => void
  onOpenVisit: (id: string) => void
  onOpenProperty: (id: string) => void
}

/**
 * Feuille de détail d'un événement (lecture seule v1) — type/horaire, bien lié,
 * lieu, contact (appel tel: réel), note, et action « Voir la visite ». Les gestes
 * replanifier/supprimer/marquer-fait sont différés (ils exigent la table source,
 * non exposée par `useCalendarScreen`).
 */
export default function AgEventSheet({ event, onClose, onOpenVisit, onOpenProperty }: AgEventSheetProps) {
  const { tk, isDark } = useMobileTokens()
  const { t } = useTranslation('calendar')
  const tone = event ? agTone(event.type, isDark) : tk.ink

  return (
    <CrmSheet open={event !== null} onClose={onClose} ariaLabel={event?.title}>
      {event ? (
        <div style={{ padding: 'var(--crm-space-xs) var(--crm-space-5xl) var(--crm-space-6xl)' }}>
          {/* type + horaire */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)' }}>
            <span style={{ width: 44, height: 44, borderRadius: 'var(--crm-radius-lg)', background: tk.cardSubtle, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <MEIcon name={agIcon(event.type)} size={22} color={tone} strokeWidth={1.9} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: tone }}>
                {t(`eventType.${event.type}`)}
              </div>
              <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: tk.inkSoft, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                {event.durMin > 0 ? `${fmtTime(event.start)} – ${fmtTime(event.end)} · ${fmtDur(event.durMin, t)}` : fmtTime(event.start)}
              </div>
            </div>
          </div>

          <h2 style={{ margin: '16px 0 0', fontSize: 'var(--crm-text-5xl)', fontWeight: 500, letterSpacing: -0.7, color: tk.ink, lineHeight: 1.1 }}>
            {event.title}
          </h2>

          {/* bien lié */}
          {event.propertyId ? (
            <button
              type="button"
              onClick={() => onOpenProperty(event.propertyId as string)}
              style={{ width: '100%', textAlign: 'left', marginTop: 18, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-xl)', borderRadius: 'var(--crm-radius-2xl)', background: tk.card, boxShadow: tk.shadowSm, border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <span style={{ width: 50, height: 50, borderRadius: 'var(--crm-radius-lg)', flexShrink: 0, background: tk.cardSubtle, display: 'grid', placeItems: 'center' }}>
                <MEIcon name="building" size={22} color={tk.inkSoft} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 500, letterSpacing: -0.3, color: tk.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {event.propertyTitle}
                </div>
                {event.propertyPrice != null ? (
                  <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: tk.muted, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCHF(event.propertyPrice)}
                  </div>
                ) : null}
              </div>
              <MEIcon name="chevron-right" size={18} color={tk.ghost} strokeWidth={2} />
            </button>
          ) : null}

          {/* lieu */}
          {event.location ? (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-xl) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-2xl)', background: tk.card, border: `1px solid ${tk.cardBorder}` }}>
              <MEIcon name="location" size={18} color={tk.inkSoft} strokeWidth={1.85} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: tk.ink }}>{event.location}</div>
            </div>
          ) : null}

          {/* contact */}
          {event.contactName ? (
            <div style={{ marginTop: 12, padding: 'var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-2xl)', background: tk.card, border: `1px solid ${tk.cardBorder}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
                <span style={{ width: 44, height: 44, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, background: tone, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-xl)', fontWeight: 500 }}>
                  {event.contactName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-xl)', fontWeight: 500, letterSpacing: -0.3, color: tk.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {event.contactName}
                </div>
              </div>
              {event.phone ? (
                <a
                  href={`tel:${event.phone}`}
                  style={{ marginTop: 12, height: 44, borderRadius: 'var(--crm-radius-pill)', background: tk.cardSubtle, color: tk.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)', fontSize: 'var(--crm-text-xl)', fontWeight: 500, textDecoration: 'none' }}
                >
                  <MEIcon name="phone" size={16} color={tk.ink} />
                  {t('mobile.call')}
                </a>
              ) : null}
            </div>
          ) : null}

          {/* note */}
          {event.note ? (
            <div style={{ marginTop: 12, padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-2xl)', background: tk.cardSubtle }}>
              <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: tk.muted, marginBottom: 7 }}>
                {t('mobile.note')}
              </div>
              <p style={{ margin: 0, fontSize: 'var(--crm-text-xl)', fontWeight: 500, color: tk.inkSoft, lineHeight: 1.6 }}>{event.note}</p>
            </div>
          ) : null}

          {/* action principale (visite réelle = page détail) */}
          {event.type === 'visite' ? (
            <button
              type="button"
              onClick={() => onOpenVisit(event.id)}
              style={{ width: '100%', marginTop: 18, height: 50, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 500, color: tk.accentInk, background: tk.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)' }}
            >
              <MEIcon name="arrow-right" size={16} strokeWidth={2} color={tk.accentInk} />
              {t('mobile.openVisit')}
            </button>
          ) : null}
        </div>
      ) : null}
    </CrmSheet>
  )
}
