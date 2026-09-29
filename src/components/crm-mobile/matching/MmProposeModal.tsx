/**
 * Modale mobile « Je l'ai proposé » (bottom-sheet) : l'agent confirme qu'il a présenté
 * le bien à l'acheteur, avant le geste `send` du matching.
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useMobileTokens } from '../useMobileTokens'
import CrmBottomCard from '../primitives/CrmBottomCard'

interface MmProposeModalProps {
  open: boolean
  buyerFirst: string
  listingTitle: string
  listingAddr: string
  priceLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmation de « Je l'ai proposé » : déclenche le geste `send` (`execProposer`).
 * ⛔ Rien ne part vers l'acheteur (21.09.2026) : l'agent lui a présenté le bien par ses
 * propres moyens ; le CRM consigne et pose le rappel à 3 jours que la modale annonce.
 * Plus de ligne « canal » : il n'y a plus de canal.
 */
export default function MmProposeModal({
  open,
  buyerFirst,
  listingTitle,
  listingAddr,
  priceLabel,
  onConfirm,
  onCancel,
}: MmProposeModalProps) {
  const { tk } = useMobileTokens()
  const { t } = useTranslation('matching')

  return (
    <CrmBottomCard open={open} onClose={onCancel} ariaLabel={t('confirm.sendTitle')}>
      <div style={{ padding: 'var(--crm-space-5xl) var(--crm-space-5xl) var(--crm-space-3xl)' }}>
        <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, letterSpacing: -0.3, color: tk.ink }}>
          {t('confirm.sendQuestion', { firstName: buyerFirst })}
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

        {/* bien proposé */}
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
            <MEIcon name="check" size={16} strokeWidth={2} color={tk.accentInk} />
            {t('confirm.sendCta')}
          </button>
        </div>
      </div>
    </CrmBottomCard>
  )
}
