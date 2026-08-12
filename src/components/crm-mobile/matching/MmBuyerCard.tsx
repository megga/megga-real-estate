/** Carte acheteur du matching mobile (VUE 1 liste) — un item de l'inbox par acheteur. */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useMobileTokens } from '../useMobileTokens'
import MmVerifiedBadge from './MmVerifiedBadge'
import type { BuyerGroupVM } from './vm'

interface MmBuyerCardProps {
  group: BuyerGroupVM
  onOpen: () => void
  onMenu: () => void
}

/**
 * Carte acheteur (VUE 1) — photo de couverture du meilleur bien + dégradé,
 * kebab d'actions, identité (avatar = identité, jamais accent UI), sceau KYC si
 * vérifié, compteur de biens. Verdict masqué en liste (seul le badge KYC).
 */
export default function MmBuyerCard({ group, onOpen, onMenu }: MmBuyerCardProps) {
  const { tk } = useMobileTokens()
  const { t } = useTranslation('matching')
  const initials = `${(group.first || ' ')[0]}${(group.last || ' ')[0]}`.toUpperCase()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      style={{
        width: '100%',
        textAlign: 'left',
        border: 0,
        cursor: 'pointer',
        fontFamily: 'inherit',
        padding: 0,
        background: tk.card,
        borderRadius: 'var(--crm-radius-5xl)',
        boxShadow: tk.shadow,
        overflow: 'hidden',
        display: 'block',
      }}
    >
      <div style={{ position: 'relative', height: 216, background: tk.cardSubtle }}>
        {group.coverUrl ? (
          <img
            src={group.coverUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
            <MEIcon name="building" size={44} color={tk.ghost} />
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(8,9,12,0.86) 0%, rgba(8,9,12,0.30) 42%, rgba(8,9,12,0) 68%)',
          }}
        />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onMenu()
          }}
          aria-label={t('common:actions.options')}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: 'var(--crm-radius-pill)',
            border: 0,
            background: 'rgba(8,9,12,0.55)',
            backdropFilter: 'blur(6px)',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <MEIcon name="more-horizontal" size={18} color="#fff" />
        </button>

        <div
          style={{
            position: 'absolute',
            left: 13,
            right: 13,
            bottom: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--crm-space-lg)',
          }}
        >
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--crm-radius-pill)',
              display: 'grid',
              placeItems: 'center',
              background: group.av,
              color: '#fff',
              fontSize: 'var(--crm-text-lg)',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initials}
          </span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)' }}>
            <span
              style={{
                fontSize: 'var(--crm-text-2xl)',
                fontWeight: 600,
                color: '#fff',
                letterSpacing: -0.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {group.first} {group.last}
            </span>
            {group.kyc === 'verified' ? <MmVerifiedBadge size={16} /> : null}
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--crm-space-xs)',
              fontSize: 'var(--crm-text-md)',
              fontWeight: 600,
              color: '#fff',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>{t('mobile.bienCount', { count: group.bienCount })}</span>
            <MEIcon name="arrow-right" size={15} strokeWidth={2.2} color="#fff" />
          </span>
        </div>
      </div>
    </div>
  )
}
