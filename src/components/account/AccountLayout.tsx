import type { ReactNode } from 'react'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { useIsMobile } from '@/hooks/useMediaQuery'
import AccountHeader from './AccountHeader'
import AccountRail, { type SectionKey } from './AccountRail'
import AccountBottomBar from './AccountBottomBar'

interface Props {
  section: SectionKey
  counts: Record<SectionKey, number>
  onSelect: (key: SectionKey) => void
  onLogout: () => void
  children: ReactNode
}

export default function AccountLayout({ section, counts, onSelect, onLogout, children }: Props) {
  const isMobile = useIsMobile()
  const railWidth = 96

  if (isMobile) {
    return (
      <div
        data-account-page
        style={{
          width: '100%',
          minHeight: '100vh',
          background: T.page,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: T.fontStack,
        }}
      >
        <AccountHeader onLogout={onLogout} />
        <main
          style={{
            minWidth: 0,
            padding: '20px 16px calc(80px + env(safe-area-inset-bottom)) 16px',
            flex: 1,
          }}
        >
          {children}
        </main>
        <AccountBottomBar section={section} counts={counts} onSelect={onSelect} />
      </div>
    )
  }

  return (
    <div
      data-account-page
      style={{
        width: '100%',
        minHeight: '100vh',
        background: T.page,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: T.fontStack,
      }}
    >
      <AccountHeader onLogout={onLogout} />
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `${railWidth}px 1fr`,
        }}
      >
        <AccountRail section={section} counts={counts} onSelect={onSelect} />
        <main style={{ minWidth: 0, padding: '40px 56px 80px' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>{children}</div>
        </main>
      </div>
    </div>
  )
}
