/**
 * Vue « time-block » de l'agenda mobile : grille horaire proportionnelle (1.7 px/min)
 * avec blocs positionnés à la minute, rendu compact sous ~56 px, et ligne « maintenant »
 * (uniquement le jour même, entre le premier et le dernier créneau visible).
 */
import { useTranslation } from 'react-i18next'
import { useMobileTokens } from '../useMobileTokens'
import { agTone, fmtDur, fmtTime, type AgEventVM } from './vm'

const PX_PER_MIN = 1.7
const MIN_H = 38
const GUTTER = 50
const NOW_RED = '#E54D38'

interface AgTimeGridProps {
  events: AgEventVM[]
  isToday: boolean
  nowMin: number
  onTap: (e: AgEventVM) => void
}

/** Zéro-pad sur 2 chiffres (labels heures/minutes). */
const pad2 = (n: number): string => String(n).padStart(2, '0')

/** Grille time-block proportionnelle (port du proto `AgTimeGrid`). Blocs positionnés à la minute. */
export default function AgTimeGrid({ events, isToday, nowMin, onTap }: AgTimeGridProps) {
  const { tk, isDark } = useMobileTokens()
  const { t } = useTranslation('calendar')
  const lineColor = isDark ? 'rgba(255,255,255,0.14)' : '#D2D7DF'

  const starts = events.map((e) => e.startMin)
  const ends = events.map((e) => e.startMin + e.durMin)
  const gridStart = Math.floor(Math.min(...starts) / 60) * 60
  const gridEnd = Math.ceil(Math.max(...ends) / 60) * 60
  const H = (gridEnd - gridStart) * PX_PER_MIN
  const yOf = (m: number): number => (m - gridStart) * PX_PER_MIN

  const hours: number[] = []
  for (let m = gridStart; m <= gridEnd; m += 60) hours.push(m)
  const nowVisible = isToday && nowMin >= gridStart && nowMin <= gridEnd

  return (
    <div style={{ position: 'relative', height: H, marginTop: 8 }}>
      {/* lignes horaires */}
      {hours.map((m) => (
        <div key={m} style={{ position: 'absolute', left: 0, right: 0, top: yOf(m), display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
          <span style={{ width: GUTTER - 8, textAlign: 'right', paddingRight: 10, fontSize: 11, fontWeight: 700, color: tk.muted, fontVariantNumeric: 'tabular-nums', transform: 'translateY(-50%)', lineHeight: 1 }}>
            {pad2(Math.floor(m / 60))}:00
          </span>
          <span style={{ flex: 1, height: 1, background: lineColor }} />
        </div>
      ))}

      {/* blocs événements */}
      {events.map((e) => {
        const top = yOf(e.startMin) + 2
        const h = Math.max(e.durMin * PX_PER_MIN, MIN_H) - 4
        const tone = agTone(e.type, isDark)
        const compact = h < 56
        const past = isToday && e.startMin + e.durMin < nowMin
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onTap(e)}
            style={{
              position: 'absolute',
              left: GUTTER,
              right: 2,
              top,
              height: h,
              borderRadius: compact ? 12 : 14,
              border: 0,
              borderLeft: `4px solid ${tone}`,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
              background: tk.card,
              boxShadow: tk.shadowSm,
              opacity: past ? 0.62 : 1,
              overflow: 'hidden',
              padding: compact ? '0 13px 0 13px' : '11px 13px 11px 13px',
              display: 'flex',
              flexDirection: compact ? 'row' : 'column',
              alignItems: compact ? 'center' : 'flex-start',
              gap: compact ? 10 : 0,
            }}
          >
            {compact ? (
              <>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, letterSpacing: -0.3, color: tk.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {e.title}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: tk.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {fmtTime(e.start)}
                </span>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: tone }}>
                    {t(`eventType.${e.type}`)}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: tk.ghost, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtTime(e.start)} · {fmtDur(e.durMin, t)}
                  </span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.3, color: tk.ink, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                  {e.title}
                </span>
                {h >= 74 && (e.contactName || e.location) ? (
                  <span style={{ fontSize: 12, fontWeight: 600, color: tk.muted, marginTop: 'auto', paddingTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {e.contactName ?? e.location}
                  </span>
                ) : null}
              </>
            )}
          </button>
        )
      })}

      {/* ligne « maintenant » */}
      {nowVisible ? (
        <div style={{ position: 'absolute', left: 0, right: 2, top: yOf(nowMin), display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 5 }}>
          <span style={{ width: GUTTER - 8, textAlign: 'right', paddingRight: 10, fontSize: 10, fontWeight: 800, color: NOW_RED, fontVariantNumeric: 'tabular-nums', transform: 'translateY(-50%)' }}>
            {pad2(Math.floor(nowMin / 60))}:{pad2(nowMin % 60)}
          </span>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: NOW_RED, flexShrink: 0, boxShadow: '0 0 0 4px rgba(229,77,56,0.16)', transform: 'translateX(-1px)' }} />
          <span style={{ flex: 1, height: 2, background: NOW_RED, borderRadius: 999 }} />
        </div>
      ) : null}
    </div>
  )
}
