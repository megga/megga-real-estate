/**
 * Modale mobile de confirmation d'envoi de dossier (bottom-sheet). Étape
 * human-in-the-loop avant le geste `send` réel du matching.
 */
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
      <div style={{ padding: 'var(--crm-space-5xl) var(--crm-space-5xl) var(--crm-space-3xl)' }}>
        <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, letterSpacing: -0.3, color: tk.ink }}>
          {t('confirm.sendTitle')}
        </div>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 'var(--crm-text-lg)',
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
            gap: 'var(--crm-space-xl)',
            marginTop: 14,
            padding: 'var(--crm-space-lg) var(--crm-space-xl)',
            borderRadius: 'var(--crm-radius-xl)',
            background: tk.cardSubtle,
          }}
        >
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--crm-radius-md)',
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
                fontSize: 'var(--crm-text-lg)',
                fontWeight: 600,
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
                fontSize: 'var(--crm-text-sm)',
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
              fontSize: 'var(--crm-text-lg)',
              fontWeight: 600,
              color: tk.ink,
              letterSpacing: -0.3,
              whiteSpace: 'nowrap',
            }}
          >
            {priceLabel}
          </div>
        </div>

        {/* canal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 12 }}>
          <MEIcon name={email ? 'mail' : 'file'} size={15} color={tk.muted} />
          <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted }}>
            {email ? t('mobile.channelEmail', { email }) : t('mobile.channelNone')}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', marginTop: 18 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 'var(--crm-radius-pill)',
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'var(--crm-text-xl)',
              fontWeight: 600,
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
              borderRadius: 'var(--crm-radius-pill)',
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'var(--crm-text-xl)',
              fontWeight: 600,
              color: tk.accentInk,
              background: tk.accent,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--crm-space-md)',
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
