/** Carte « bien correspondant » du focus matching mobile (VUE 2), avec gestes par bien. */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useMobileTokens } from '../useMobileTokens'
import MmVerdict from './MmVerdict'
import { mmPriceLabel, type PoolMatchVM } from './vm'

interface MmMatchCardProps {
  m: PoolMatchVM
  sent: boolean
  scheduled: boolean
  onSend: () => void
  onSchedule: () => void
  /** visite proposable seulement sur bien interne (property) */
  canSchedule: boolean
}

/**
 * Bien correspondant dans le focus — photo + verdict qualitatif, prix, et les
 * deux gestes par bien : Planifier (visite, ghost) + Envoyer/Envoyé (dossier).
 * Raisons masquées au v1 (vivent dans la fiche annonce, différée).
 */
export default function MmMatchCard({ m, sent, scheduled, onSend, onSchedule, canSchedule }: MmMatchCardProps) {
  const { tk, isDark } = useMobileTokens()
  const { t } = useTranslation('matching')

  return (
    <div
      style={{
        border: `1px solid ${tk.cardBorder}`,
        background: tk.card,
        borderRadius: 18,
        boxShadow: tk.shadowSm,
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', height: 116, background: tk.cardSubtle }}>
        {m.coverUrl ? (
          <img
            src={m.coverUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
            <MEIcon name="building" size={30} color={tk.ghost} />
          </div>
        )}
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <MmVerdict score={m.score} onPhoto />
        </div>
      </div>

      <div style={{ padding: '13px 14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 800,
                color: tk.ink,
                letterSpacing: -0.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {m.title}
            </div>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: tk.muted,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {m.addr}
            </div>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: tk.ink,
              letterSpacing: -0.4,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {mmPriceLabel(m.price, m.transaction, t)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 9, marginTop: 13 }}>
          {canSchedule ? (
            <button
              type="button"
              onClick={onSchedule}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 999,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : '#E4E7EC'}`,
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: 700,
                color: tk.ink,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
              }}
            >
              <MEIcon name="calendar" size={15} strokeWidth={2} color={scheduled ? tk.muted : tk.ink} />
              {scheduled ? t('mobile.visitPlanned') : t('mobile.schedule')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSend}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 999,
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12.5,
              fontWeight: 800,
              background: sent ? tk.cardSubtle : tk.accent,
              color: sent ? tk.muted : tk.accentInk,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
          >
            <MEIcon name={sent ? 'check' : 'arrow-right'} size={15} strokeWidth={2.2} color={sent ? tk.muted : tk.accentInk} />
            {sent ? t('mobile.sent') : t('mobile.send')}
          </button>
        </div>
      </div>
    </div>
  )
}
