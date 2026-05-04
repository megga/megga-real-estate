import type { ReactNode } from 'react'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'

interface Props {
  title: string
  subtitle: string
  action?: ReactNode
}

export default function AccountTabHeader({ title, subtitle, action }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 24,
        marginBottom: 32,
        paddingBottom: 24,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            margin: '0 0 6px',
            fontFamily: T.fontStack,
            fontSize: 40,
            fontWeight: 700,
            color: T.ink,
            letterSpacing: -1.2,
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
      {action && <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>{action}</div>}
    </div>
  )
}
