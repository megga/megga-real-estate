import { useTranslation } from 'react-i18next'
import { useMobileTokens } from '../useMobileTokens'
import SgBottomCard from './SgBottomCard'

interface SgConfirmDestructiveProps {
  open: boolean
  title: string
  message?: string
  /** Libellé de l'action destructive (ex. « Supprimer », « Modifier »). */
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmation destructive (Sugar Pure) — bottom-card au-dessus de la nav.
 * CTA rouge foncé opaque (`danger` : #8E1F3D clair / #E0738C sombre, texte
 * blanc, sans icône) + bouton d'annulation neutre. Sert aux suppressions et à
 * l'invalidation KYC (verified → pending). Jamais de libellé « Supprimer »
 * imposé : l'appelant fournit `confirmLabel`.
 */
export default function SgConfirmDestructive({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: SgConfirmDestructiveProps) {
  const { t } = useTranslation('common')
  const { tk } = useMobileTokens()

  return (
    <SgBottomCard open={open} onClose={onCancel} ariaLabel={title}>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3, color: tk.ink }}>{title}</div>
        {message ? (
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 13.5,
              fontWeight: 500,
              lineHeight: 1.45,
              color: tk.inkSoft,
            }}
          >
            {message}
          </p>
        ) : null}
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
            {cancelLabel ?? t('actions.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 999,
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 14.5,
              fontWeight: 800,
              color: tk.dangerInk,
              background: tk.danger,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </SgBottomCard>
  )
}
