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
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { HOME_FONT, HOME_M } from './homeTokens'

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
  const [show, setShow] = useState(alwaysShow)
  const [langOpen, setLangOpen] = useState(false)
  const [lang, setLang] = useState<'FR' | 'DE' | 'IT' | 'EN'>('FR')

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
        background: 'rgba(250, 251, 253, 0.88)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${HOME_M.border}`,
        fontFamily: HOME_FONT,
      }}
    >
      <div
        style={{
          height: HEADER_HEIGHT,
          padding: '0 clamp(20px, 5vw, 80px)',
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
          {NAV_ITEMS.map((it, i) => (
            <Link
              key={it.key}
              to={it.to}
              style={{
                padding: '8px 14px',
                fontFamily: HOME_FONT,
                fontSize: 13,
                fontWeight: 600,
                color: i === 0 ? HOME_M.ink : HOME_M.soft,
                textDecoration: 'none',
                borderRadius: 999,
                transition: 'color 0.15s ease, background 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = HOME_M.ink
                e.currentTarget.style.background = HOME_M.section
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = i === 0 ? HOME_M.ink : HOME_M.soft
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {it.label}
            </Link>
          ))}
        </nav>

        {/* Right cluster: lang + account */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {/* Lang selector */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              style={{
                height: 36,
                padding: '0 12px',
                borderRadius: 999,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: HOME_FONT,
                fontSize: 12,
                fontWeight: 600,
                color: HOME_M.soft,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {lang} <ChevronDown size={12} strokeWidth={2.4} />
            </button>
            {langOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 40,
                  right: 0,
                  background: '#fff',
                  border: `1px solid ${HOME_M.border}`,
                  borderRadius: 12,
                  padding: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  boxShadow: '0 8px 24px rgba(14,20,16,0.12)',
                  minWidth: 100,
                  zIndex: 60,
                }}
              >
                {(['FR', 'DE', 'IT', 'EN'] as const).map(l => (
                  <button
                    key={l}
                    onClick={() => {
                      setLang(l)
                      setLangOpen(false)
                    }}
                    style={{
                      height: 30,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: lang === l ? HOME_M.section : 'transparent',
                      cursor: 'pointer',
                      fontFamily: HOME_FONT,
                      fontSize: 12,
                      fontWeight: 600,
                      color: HOME_M.ink,
                      textAlign: 'left',
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Compte / Connexion */}
          <button
            onClick={() => navigate('/login')}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 999,
              border: `1px solid ${HOME_M.border}`,
              background: '#fff',
              cursor: 'pointer',
              fontFamily: HOME_FONT,
              fontSize: 12,
              fontWeight: 600,
              color: HOME_M.ink,
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
            Connexion
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
