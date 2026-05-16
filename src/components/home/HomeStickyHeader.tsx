// MEGGA — Sticky header (port 1:1 du proto megga-header.jsx).
//
// Deux modes via la prop `alwaysShow` :
// - `alwaysShow={false}` (défaut, homepage) : Hidden au load, slides down
//   quand scrollY > 80% viewport. Permet au hero d'être full-bleed sans
//   chrome au load.
// - `alwaysShow={true}` (search/listing/vendre) : Toujours visible en
//   haut de page (le proto MEGGA Recherche.html utilise ce mode).
//
// Background opaque rgba(250,251,253,0.88) + backdrop blur 14px · 64px
// hauteur · logo noir gauche, nav center, lang + Connexion droite.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { HOME_FONT, HOME_M } from './homeTokens'

type LangCode = 'FR' | 'DE' | 'IT' | 'EN'

function i18nToDisplay(raw: string | undefined): LangCode {
  const short = (raw ?? 'fr').slice(0, 2).toLowerCase()
  switch (short) {
    case 'de': return 'DE'
    case 'it': return 'IT'
    case 'en': return 'EN'
    default: return 'FR'
  }
}

const HEADER_HEIGHT = 64

interface HomeStickyHeaderProps {
  /** Si true, le header est toujours visible (utile sur /louer, /acheter,
   *  /biens/:id, etc.). Si false (défaut, homepage), il slide-down au scroll. */
  alwaysShow?: boolean
}

interface NavItem {
  key: string
  label: string
  to: string
}

const NAV_ITEMS: NavItem[] = [
  { key: 'buy', label: 'Acheter', to: '/acheter' },
  { key: 'rent', label: 'Louer', to: '/louer' },
  { key: 'estimate', label: 'Estimer', to: '/estimations' },
  { key: 'services', label: 'Services', to: '/services' },
  { key: 'pro', label: 'Pour les pros', to: '/agences' },
]

export default function HomeStickyHeader({ alwaysShow = false }: HomeStickyHeaderProps = {}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { i18n } = useTranslation()
  const [show, setShow] = useState(alwaysShow)
  const [langOpen, setLangOpen] = useState(false)
  // La langue affichée se lit depuis i18n (source de vérité), pas un state
  // local — sinon clic = pill visuellement changée mais contenu inchangé.
  const lang: LangCode = i18nToDisplay(i18n.language)
  const handleSelectLang = (code: LangCode) => {
    void i18n.changeLanguage(code.toLowerCase())
    setLangOpen(false)
  }

  // Match nav active state against current pathname (proto-fidèle: highlight la
  // section où on est, pas toujours "Acheter")
  const isNavActive = (to: string) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname === to || location.pathname.startsWith(`${to}/`)
  }

  useEffect(() => {
    if (alwaysShow) {
      setShow(true)
      return
    }
    const onScroll = () => {
      // Apparaît une fois passé 80% du premier viewport (proto-fidèle).
      setShow(window.scrollY > window.innerHeight * 0.8)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [alwaysShow])

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transform: show ? 'translateY(0)' : 'translateY(-100%)',
        transition: alwaysShow ? 'none' : 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${HOME_M.border}`,
        fontFamily: HOME_FONT,
      }}
    >
      <div
        style={{
          height: HEADER_HEIGHT,
          padding: '0 80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* Logo */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <img
            src="/megga-logo.svg"
            alt="MEGGA"
            style={{
              height: 22,
              width: 'auto',
              display: 'block',
              filter: 'brightness(0) saturate(100%)',
            }}
          />
        </Link>

        {/* Center nav (hidden on small screens) */}
        <nav
          aria-label="Navigation principale"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flex: 1,
            justifyContent: 'center',
          }}
          className="home-sticky-nav"
        >
          {NAV_ITEMS.map((it) => {
            const active = isNavActive(it.to)
            return (
              <Link
                key={it.key}
                to={it.to}
                style={{
                  padding: '8px 14px',
                  fontFamily: HOME_FONT,
                  fontSize: 13,
                  fontWeight: 600,
                  color: active ? HOME_M.ink : HOME_M.soft,
                  textDecoration: 'none',
                  borderRadius: 999,
                  transition: 'color 0.15s ease, background 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = HOME_M.ink
                  e.currentTarget.style.background = HOME_M.section
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = active ? HOME_M.ink : HOME_M.soft
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {it.label}
              </Link>
            )
          })}
        </nav>

        {/* Right cluster: lang + account (port proto megga-i18n.jsx + megga-account-store.jsx) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {/* Lang selector — globe icon + pill bordée (proto-fidèle) */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 999,
                border: '1px solid rgba(0,0,0,0.15)',
                background: '#fff',
                color: HOME_M.ink,
                cursor: 'pointer',
                fontFamily: HOME_FONT,
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke={HOME_M.ink} strokeWidth="1.2" />
                <path d="M1 7h12M7 1c2 2 2 10 0 12M7 1c-2 2-2 10 0 12" stroke={HOME_M.ink} strokeWidth="1.2" />
              </svg>
              {lang}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transition: 'transform 0.2s', transform: langOpen ? 'rotate(180deg)' : 'none' }}>
                <path d="M2 4l3 3 3-3" stroke={HOME_M.ink} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {langOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 44,
                  right: 0,
                  minWidth: 160,
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: 12,
                  padding: 6,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                  zIndex: 100,
                }}
              >
                {([
                  { code: 'FR', label: 'Français' },
                  { code: 'DE', label: 'Deutsch' },
                  { code: 'EN', label: 'English' },
                  { code: 'IT', label: 'Italiano' },
                ] as const).map(l => (
                  <button
                    key={l.code}
                    onClick={() => handleSelectLang(l.code)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: lang === l.code ? '#E8EDF5' : 'transparent',
                      cursor: 'pointer',
                      fontFamily: HOME_FONT,
                      fontSize: 13,
                      fontWeight: 600,
                      color: HOME_M.ink,
                      textAlign: 'left',
                    }}
                  >
                    <span>{l.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: HOME_M.muted, letterSpacing: 0.5 }}>{l.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Compte pill (port proto MEGGA_AccountLink — guest state) */}
          <button
            onClick={() => navigate('/login')}
            style={{
              height: 36,
              padding: '0 14px',
              borderRadius: 999,
              border: `1px solid ${HOME_M.border}`,
              background: '#fff',
              color: HOME_M.ink,
              cursor: 'pointer',
              fontFamily: HOME_FONT,
              fontSize: 13,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'border-color 0.15s ease, background 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = HOME_M.ink
              e.currentTarget.style.background = HOME_M.section
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = HOME_M.border
              e.currentTarget.style.background = '#fff'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="9" r="3.6" />
              <path d="M4.5 21c1.5-4.5 4.5-6 7.5-6s6 1.5 7.5 6" />
            </svg>
            <span>Compte</span>
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .home-sticky-nav { display: none !important; }
        }
      `}</style>
    </header>
  )
}
