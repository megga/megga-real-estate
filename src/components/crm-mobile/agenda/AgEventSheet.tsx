/**
 * Bottom-sheet de détail d'un événement d'agenda (mobile), rendu dans `SgSheet`.
 * Composant présentationnel pur, en lecture seule (v1).
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { formatCHF } from '@/lib/utils'
import { useMobileTokens } from '../useMobileTokens'
import SgSheet from '../primitives/SgSheet'
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
 * non exposée par `useCalendarSugar`).
 */
export default function AgEventSheet({ event, onClose, onOpenVisit, onOpenProperty }: AgEventSheetProps) {
  const { tk, isDark } = useMobileTokens()
  const { t } = useTranslation('calendar')
  const tone = event ? agTone(event.type, isDark) : tk.ink

  return (
    <SgSheet open={event !== null} onClose={onClose} ariaLabel={event?.title}>
      {event ? (
        <div style={{ padding: '4px 20px 22px' }}>
          {/* type + horaire */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ width: 44, height: 44, borderRadius: 13, background: tk.cardSubtle, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <MEIcon name={agIcon(event.type)} size={22} color={tone} strokeWidth={1.9} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: tone }}>
                {t(`eventType.${event.type}`)}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: tk.inkSoft, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                {event.durMin > 0 ? `${fmtTime(event.start)} – ${fmtTime(event.end)} · ${fmtDur(event.durMin, t)}` : fmtTime(event.start)}
              </div>
            </div>
          </div>

          <h2 style={{ margin: '16px 0 0', fontSize: 24, fontWeight: 800, letterSpacing: -0.7, color: tk.ink, lineHeight: 1.1 }}>
            {event.title}
          </h2>

          {/* bien lié */}
          {event.propertyId ? (
            <button
              type="button"
              onClick={() => onOpenProperty(event.propertyId as string)}
              style={{ width: '100%', textAlign: 'left', marginTop: 18, display: 'flex', alignItems: 'center', gap: 13, padding: 12, borderRadius: 16, background: tk.card, boxShadow: tk.shadowSm, border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <span style={{ width: 50, height: 50, borderRadius: 13, flexShrink: 0, background: tk.cardSubtle, display: 'grid', placeItems: 'center' }}>
                <MEIcon name="building" size={22} color={tk.inkSoft} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: -0.3, color: tk.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {event.propertyTitle}
                </div>
                {event.propertyPrice != null ? (
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: tk.muted, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCHF(event.propertyPrice)}
                  </div>
                ) : null}
              </div>
              <MEIcon name="chevron-right" size={18} color={tk.ghost} strokeWidth={2} />
            </button>
          ) : null}

          {/* lieu */}
          {event.location ? (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 16, background: tk.card, border: `1px solid ${tk.cardBorder}` }}>
              <MEIcon name="location" size={18} color={tk.inkSoft} strokeWidth={1.85} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: tk.ink }}>{event.location}</div>
            </div>
          ) : null}

          {/* contact */}
          {event.contactName ? (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 16, background: tk.card, border: `1px solid ${tk.cardBorder}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 44, height: 44, borderRadius: 999, flexShrink: 0, background: tone, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800 }}>
                  {event.contactName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: tk.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {event.contactName}
                </div>
              </div>
              {event.phone ? (
                <a
                  href={`tel:${event.phone}`}
                  style={{ marginTop: 12, height: 44, borderRadius: 999, background: tk.cardSubtle, color: tk.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 800, textDecoration: 'none' }}
                >
                  <MEIcon name="phone" size={16} color={tk.ink} />
                  {t('mobile.call')}
                </a>
              ) : null}
            </div>
          ) : null}

          {/* note */}
          {event.note ? (
            <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 16, background: tk.cardSubtle }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: tk.muted, marginBottom: 7 }}>
                {t('mobile.note')}
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: tk.inkSoft, lineHeight: 1.6 }}>{event.note}</p>
            </div>
          ) : null}

          {/* action principale (visite réelle = page détail) */}
          {event.type === 'visite' ? (
            <button
              type="button"
              onClick={() => onOpenVisit(event.id)}
              style={{ width: '100%', marginTop: 18, height: 50, borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, color: tk.accentInk, background: tk.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <MEIcon name="arrow-right" size={16} strokeWidth={2} color={tk.accentInk} />
              {t('mobile.openVisit')}
            </button>
          ) : null}
        </div>
      ) : null}
    </SgSheet>
  )
}
