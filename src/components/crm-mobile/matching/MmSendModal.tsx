import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useMobileTokens } from '../useMobileTokens'
import SgBottomCard from '../primitives/SgBottomCard'

interface MmSendModalProps {
  open: boolean
  buyerFirst: string
  listingTitle: string
  listingAddr: string
  priceLabel: string
  /** e-mail du destinataire (canal réel) ; null → consigné au dossier sans envoi. */
  email: string | null
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmation d'envoi du dossier (human-in-the-loop, exigence MEGGA). Déclenche
 * le geste `send` réel (execSendDossier) après validation. L'envoi e-mail dépend
 * du canal réel (l'exécuteur n'envoie qu'en e-mail) — on n'affiche donc pas de
 * faux canal WhatsApp. Si pas d'e-mail : transmis au dossier client sans envoi.
 */
export default function MmSendModal({
  open,
  buyerFirst,
  listingTitle,
  listingAddr,
  priceLabel,
  email,
  onConfirm,
  onCancel,
}: MmSendModalProps) {
  const { tk } = useMobileTokens()
  const { t } = useTranslation('matching')

  return (
    <SgBottomCard open={open} onClose={onCancel} ariaLabel={t('confirm.sendTitle')}>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3, color: tk.ink }}>
          {t('confirm.sendTitle')}
        </div>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 13.5,
            fontWeight: 500,
            lineHeight: 1.45,
            color: tk.inkSoft,
          }}
        >
          {t('confirm.sendBody', { firstName: buyerFirst })}
        </p>

        {/* bien transmis */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 14,
            padding: '11px 12px',
            borderRadius: 14,
            background: tk.cardSubtle,
          }}
        >
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: tk.card,
              boxShadow: tk.shadowSm,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <MEIcon name="building" size={18} color={tk.inkSoft} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 800,
                color: tk.ink,
                letterSpacing: -0.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {listingTitle}
            </div>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: tk.muted,
                marginTop: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {listingAddr}
            </div>
          </div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 800,
              color: tk.ink,
              letterSpacing: -0.3,
              whiteSpace: 'nowrap',
            }}
          >
            {priceLabel}
          </div>
        </div>

        {/* canal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <MEIcon name={email ? 'mail' : 'file'} size={15} color={tk.muted} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: tk.muted }}>
            {email ? t('mobile.channelEmail', { email }) : t('mobile.channelNone')}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 999,
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 14.5,
              fontWeight: 700,
              color: tk.inkSoft,
              background: tk.cardSubtle,
            }}
          >
            {t('common:actions.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1.4,
              height: 48,
              borderRadius: 999,
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 14.5,
              fontWeight: 800,
              color: tk.accentInk,
              background: tk.accent,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <MEIcon name="send" size={16} strokeWidth={2} color={tk.accentInk} />
            {t('confirm.sendCta')}
          </button>
        </div>
      </div>
    </SgBottomCard>
  )
}
