import type { ReactNode } from 'react'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'

interface Props {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  id?: string
}

export default function SectionShell({ title, subtitle, action, children, id }: Props) {
  return (
    <section
      id={id}
      style={{
        background: '#fff',
        border: `1px solid ${T.border}`,
        borderRadius: 18,
        padding: '22px 24px 24px',
        scrollMarginTop: 96,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontFamily: T.fontStack,
              fontSize: 17,
              fontWeight: 700,
              color: T.ink,
              letterSpacing: -0.3,
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <div
              style={{
                fontFamily: T.fontStack,
                fontSize: 12,
                color: T.muted,
                marginTop: 4,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function EmptyInline({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '20px 22px',
        border: `1px dashed ${T.border}`,
        borderRadius: 12,
        background: T.page,
        fontFamily: T.fontStack,
        fontSize: 13,
        color: T.soft,
        lineHeight: 1.55,
      }}
    >
      {text}
    </div>
  )
}
