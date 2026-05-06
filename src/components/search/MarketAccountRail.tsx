// MEGGA — Market Account Rail
// Faithful port of design proto megga-account-page.jsx (AccountRail + APRailTab + APIcon).
// 96px wide vertical rail with: Recherche / [sep] / Mes recherches / Favoris / Messagerie / Profil.

import { Link } from 'react-router-dom'
import { useFavorites } from '@/hooks/useFavorites'

const M = {
  ink: '#0E1410',
  soft: '#3F4640',
  muted: '#7A8079',
  border: '#E6E8EC',
  surface: '#FFFFFF',
  cream: '#FAFBFD',
  blue: '#0041D9',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

// ── Icons (24×24, stroke-only, currentColor) ──────────────────────────────

const IcoSearch = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10.5" cy="10.5" r="6.5" /><path d="M16 16l4 4" />
  </svg>
)

const IcoBookmark = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12v18l-6-4-6 4z" />
  </svg>
)

const IcoHeart = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-7.5-4.7-7.5-10.3A4.7 4.7 0 0112 6.5a4.7 4.7 0 017.5 4.2C19.5 16.3 12 21 12 21z" />
  </svg>
)

const IcoMessage = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5h18v12H8l-5 3z" />
  </svg>
)

const IcoUser = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="9" r="3.6" /><path d="M4.5 21c1.5-4.5 4.5-6 7.5-6s6 1.5 7.5 6" />
  </svg>
)

// ── APRailTab port ────────────────────────────────────────────────────────

interface RailTabProps {
  active: boolean
  icon: React.ReactNode
  label: string
  count?: number
  onClick?: () => void
  href?: string
}

function RailTab({ active, icon, label, count = 0, onClick, href }: RailTabProps) {
  const inner = (
    <>
      <div
        style={{
          position: 'relative',
          width: 44,
          height: 44,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: active ? '#fff' : 'transparent',
          border: active ? `1px solid ${M.border}` : '1px solid transparent',
          boxShadow: active ? '0 1px 2px rgba(14,20,16,0.04)' : 'none',
          color: active ? M.ink : M.soft,
          transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease',
        }}
      >
        {icon}
        {count > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              background: '#E53935',
              color: '#fff',
              fontFamily: FONT,
              fontSize: 10,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #FAFBFD',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </div>
      <span
        style={{
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: 600,
          color: active ? M.ink : M.muted,
          textAlign: 'center',
          lineHeight: 1.2,
          letterSpacing: -0.1,
        }}
      >
        {label}
      </span>
    </>
  )

  const baseStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    padding: '10px 6px',
    borderRadius: 12,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    textDecoration: 'none',
  }

  if (href) {
    return (
      <Link to={href} style={baseStyle}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} style={baseStyle}>
      {inner}
    </button>
  )
}

// ── Main rail ─────────────────────────────────────────────────────────────

interface MarketAccountRailProps {
  activeView: string
  onViewChange: (view: string) => void
  /** Sticky offset from top (header height). Default 64. */
  stickyTop?: number
  savedSearchesCount?: number
  unreadMessagesCount?: number
}

export default function MarketAccountRail({
  activeView,
  onViewChange,
  stickyTop = 64,
  savedSearchesCount = 0,
  unreadMessagesCount = 0,
}: MarketAccountRailProps) {
  const { count: favCount } = useFavorites()

  return (
    <aside
      aria-label="Outils acheteur"
      style={{
        width: 96,
        flexShrink: 0,
        background: M.cream,
        borderRight: `1px solid ${M.border}`,
        padding: '20px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        position: 'sticky',
        top: stickyTop,
        height: `calc(100vh - ${stickyTop}px)`,
        overflowY: 'auto',
        fontFamily: FONT,
      }}
    >
      <RailTab
        active={activeView === 'search'}
        icon={<IcoSearch s={22} />}
        label="Recherche"
        onClick={() => onViewChange('search')}
      />

      <div style={{ height: 1, background: M.border, margin: '8px 12px' }} />

      <RailTab
        active={activeView === 'saved'}
        icon={<IcoBookmark s={22} />}
        label="Mes recherches"
        count={savedSearchesCount}
        onClick={() => onViewChange('saved')}
      />
      <RailTab
        active={activeView === 'favorites'}
        icon={<IcoHeart s={22} />}
        label="Favoris"
        count={favCount}
        onClick={() => onViewChange('favorites')}
      />
      <RailTab
        active={activeView === 'messages'}
        icon={<IcoMessage s={22} />}
        label="Messagerie"
        count={unreadMessagesCount}
        href="/compte#messages"
      />
      <RailTab
        active={activeView === 'profile'}
        icon={<IcoUser s={22} />}
        label="Profil"
        href="/compte#profile"
      />
    </aside>
  )
}
