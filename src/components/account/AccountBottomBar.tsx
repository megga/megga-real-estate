import { useTranslation } from 'react-i18next'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { SECTIONS, type SectionKey } from './AccountRail'

interface Props {
  section: SectionKey
  counts: Record<SectionKey, number>
  onSelect: (key: SectionKey) => void
}

export default function AccountBottomBar({ section, counts, onSelect }: Props) {
  const { t } = useTranslation('compte')
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: 'rgba(251, 252, 250, 0.96)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: `1px solid ${T.border}`,
        display: 'grid',
        gridTemplateColumns: `repeat(${SECTIONS.length}, 1fr)`,
        padding: '8px 4px max(8px, env(safe-area-inset-bottom)) 4px',
      }}
    >
      {SECTIONS.map((s) => {
        const Icon = s.icon
        const active = section === s.key
        const count = counts[s.key]
        return (
          <button
            key={s.key}
            onClick={() => onSelect(s.key)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '8px 4px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: active ? T.ink : T.muted,
              fontFamily: T.fontStack,
              minHeight: 56,
            }}
          >
            <div style={{ position: 'relative', display: 'flex' }}>
              <Icon size={22} />
              {count !== undefined && count > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -10,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    borderRadius: 999,
                    background: T.danger,
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `2px solid ${T.page}`,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </div>
            <span
              style={{
                fontFamily: T.fontStack,
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                color: active ? T.ink : T.muted,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
              }}
            >
              {t(s.labelKey).replace(/^Mes |^My /, '')}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
