import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useMobileTokens } from '../useMobileTokens'
import SgBottomCard from './SgBottomCard'

export interface SgActionItem {
  id: string
  icon?: MEIconName
  label: string
  /** Action destructive — rendue en rouge sobre. */
  danger?: boolean
  disabled?: boolean
  /** Trait de séparation au-dessus de cette ligne. */
  divider?: boolean
}

interface SgActionMenuProps {
  open: boolean
  items: SgActionItem[]
  onAction: (id: string) => void
  onClose: () => void
  title?: string
  subtitle?: string
  ariaLabel?: string
}

/**
 * Menu d'actions ••• (Sugar Pure) — feuille d'options réutilisable sur
 * n'importe quelle carte/ligne (bien, contact, deal, RDV…). Action destructive
 * séparée en bas (rouge `danger`). Port .tsx de `crm-action-menu.jsx`, monté
 * sur SgBottomCard, icônes via la source unique MEIcon.
 */
export default function SgActionMenu({
  open,
  items,
  onAction,
  onClose,
  title,
  subtitle,
  ariaLabel,
}: SgActionMenuProps) {
  const { tk } = useMobileTokens()
  const hasHeader = Boolean(title || subtitle)

  return (
    <SgBottomCard open={open} onClose={onClose} ariaLabel={ariaLabel ?? title}>
      {hasHeader ? (
        <div style={{ padding: '15px 17px 11px' }}>
          {title ? (
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: -0.3,
                color: tk.ink,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </div>
          ) : null}
          {subtitle ? (
            <div style={{ fontSize: 12, fontWeight: 600, color: tk.muted, marginTop: 2 }}>
              {subtitle}
            </div>
          ) : null}
        </div>
      ) : null}
      <div style={{ borderTop: hasHeader ? `1px solid ${tk.hair}` : undefined }}>
        {items.map((it, i) => {
          const tone = it.disabled ? tk.muted : it.danger ? tk.danger : tk.ink
          const iconColor = it.disabled ? tk.muted : it.danger ? tk.danger : tk.inkSoft
          return (
            <button
              key={it.id || i}
              type="button"
              disabled={it.disabled}
              onClick={() => {
                if (!it.disabled) onAction(it.id)
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                padding: '13px 16px',
                minHeight: 48,
                border: 0,
                background: 'transparent',
                cursor: it.disabled ? 'default' : 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
                opacity: it.disabled ? 0.5 : 1,
                borderTop: it.divider ? `1px solid ${tk.hair}` : undefined,
              }}
            >
              {it.icon ? <MEIcon name={it.icon} size={18} color={iconColor} /> : null}
              <span
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: -0.2,
                  color: tone,
                  whiteSpace: 'nowrap',
                }}
              >
                {it.label}
              </span>
            </button>
          )
        })}
      </div>
    </SgBottomCard>
  )
}
