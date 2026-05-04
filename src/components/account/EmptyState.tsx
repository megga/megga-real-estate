import type { ReactNode } from 'react'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'

interface Props {
  icon: ReactNode
  title: string
  body: string
  cta?: string
  ctaHref?: string
  onCta?: () => void
}

export default function EmptyState({ icon, title, body, cta, ctaHref, onCta }: Props) {
  const ctaStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 42,
    padding: '0 22px',
    borderRadius: 999,
    background: T.ink,
    color: '#fff',
    fontFamily: T.fontStack,
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
  }

  return (
    <div
      style={{
        padding: '64px 28px',
        textAlign: 'center',
        border: `1px dashed ${T.border}`,
        borderRadius: 18,
        background: T.section,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 18px',
          color: T.soft,
          border: `1px solid ${T.border}`,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily: T.fontStack,
          fontSize: 18,
          fontWeight: 700,
          color: T.ink,
          marginBottom: 8,
          letterSpacing: -0.2,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: T.fontStack,
          fontSize: 13,
          color: T.soft,
          lineHeight: 1.55,
          maxWidth: 460,
          margin: '0 auto 22px',
        }}
      >
        {body}
      </div>
      {cta && ctaHref && (
        <a href={ctaHref} style={ctaStyle}>
          {cta}
        </a>
      )}
      {cta && !ctaHref && onCta && (
        <button onClick={onCta} style={ctaStyle}>
          {cta}
        </button>
      )}
    </div>
  )
}
