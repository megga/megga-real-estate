import type { ReactNode } from 'react'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface Props {
  title: string
  subtitle: string
  action?: ReactNode
}

export default function AccountTabHeader({ title, subtitle, action }: Props) {
  const isMobile = useIsMobile()
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'flex-end',
        justifyContent: 'space-between',
        gap: isMobile ? 16 : 24,
        marginBottom: isMobile ? 20 : 32,
        paddingBottom: isMobile ? 16 : 24,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            margin: '0 0 6px',
            fontFamily: T.fontStack,
            fontSize: isMobile ? 28 : 40,
            fontWeight: 700,
            color: T.ink,
            letterSpacing: isMobile ? -0.6 : -1.2,
            lineHeight: 1.05,
          }}
        >
          {title}
        </h1>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 14,
            color: T.soft,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {subtitle}
        </div>
      </div>
      {action && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexShrink: 0,
            width: isMobile ? '100%' : 'auto',
          }}
        >
          {action}
        </div>
      )}
    </div>
  )
}
