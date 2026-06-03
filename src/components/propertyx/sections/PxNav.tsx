// MEGGA Marketplace — Property X "Header/V1" navigation.
// Source : Figma node 11754:23870 — code Figma exact, étendu d'un dropdown
// "Plus" pour héberger les pages secondaires sans alourdir la nav primaire.
//
// Structure :
//   <section py-24 flex-col items-center>
//     <Container w-1200 flex justify-between items-center>
//       <Left Content flex gap-24 items-center>
//         <Logo Text Light>
//         <Nav List flex gap-16 items-center>
//           <Link "Acheter">
//           <Link "Louer">
//           <Link "Vendre">
//           <Link "Estimer">
//           <Dropdown "Plus ▾">
//         </Nav List>
//       </Left Content>
//       <PrimaryButton "Connexion">
//     </Container>
//   </section>

import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PX, PxButton, MEIcon, PxLogo } from '..'
import PxLanguageSwitcher from './PxLanguageSwitcher'

interface PxNavProps {
  // glass était l'ancien prop "overlay sur hero" — Figma a la nav en flow normal
  // donc on l'ignore mais on garde pour backward compat avec PropertyXHomePage
  glass?: boolean
  // Background optionnel — par défaut blanc (neutral100). Permet aux pages
  // sur fond gris (ex. /faq) de fondre la nav avec le fond de page.
  bg?: string
}

// Liens primaires — uniquement des routes au nouveau design PropertyX.
const PRIMARY_LINKS = [
  { label: 'Acheter', to: '/buy' },
  { label: 'Louer', to: '/rent' },
  { label: 'Publier un bien', to: '/publier-bien' },
] as const

// Dropdown "Plus" — pages secondaires, toutes en design PropertyX.
const MORE_LINKS = [
  { label: 'Agences', to: '/agencies', desc: 'Annuaire des agences' },
  { label: 'À propos', to: '/a-propos', desc: 'L’équipe et la mission' },
  { label: 'FAQ', to: '/faq', desc: 'Questions fréquentes' },
  { label: 'Contact', to: '/contact', desc: 'Nous écrire' },
] as const

const LINK_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  paddingTop: 2,
  textDecoration: 'none',
  fontFamily: PX.font.display,
  fontSize: 16,
  fontWeight: 500,
  lineHeight: 1.25,
  letterSpacing: '-0.48px',
  color: PX.neutral700,
} as const

function MoreDropdown() {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }
  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          ...LINK_STYLE,
          background: 'transparent',
          border: 0,
          cursor: 'pointer',
          padding: 0,
          paddingTop: 2,
        }}
      >
        Plus
        <MEIcon
          name="chevron-down"
          size={16}
          color={PX.neutral700}
        />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 12px)',
            left: 0,
            minWidth: 280,
            padding: 8,
            background: PX.neutral100,
            border: `1px solid ${PX.neutral300}`,
            borderRadius: 16,
            boxShadow: PX.shadow.small,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            zIndex: 50,
          }}
        >
          {MORE_LINKS.map(item => (
            <Link
              key={item.to}
              to={item.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '10px 12px',
                borderRadius: 10,
                textDecoration: 'none',
                fontFamily: PX.font.display,
                color: PX.neutral700,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = PX.neutral200
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.3px' }}>
                {item.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: 400, color: PX.neutral400 }}>
                {item.desc}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 22, 28, 0.4)',
        zIndex: 90,
        animation: 'pxnav-fade-in 200ms ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(360px, 90vw)',
          background: PX.neutral100,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflowY: 'auto',
          boxShadow: PX.shadow.large,
          animation: 'pxnav-slide-in 240ms cubic-bezier(.22,1,.36,1)',
        }}
      >
        <style>{`
          @keyframes pxnav-fade-in { from { opacity: 0 } to { opacity: 1 } }
          @keyframes pxnav-slide-in { from { transform: translateX(100%) } to { transform: translateX(0) } }
        `}</style>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <PxLogo variant="dark" form="text" size="sm" to="/" />
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={onClose}
            style={{
              width: 40, height: 40, borderRadius: PX.radius.pill,
              background: PX.neutral200, border: 0, cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              fontFamily: PX.font.display, fontSize: 18, fontWeight: 500,
              color: PX.neutral700,
            }}
          >×</button>
        </div>

        {[...PRIMARY_LINKS, ...MORE_LINKS].map(item => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClose}
            style={{
              ...LINK_STYLE,
              padding: '14px 16px',
              fontSize: 18,
              fontWeight: 500,
              borderRadius: 12,
              justifyContent: 'flex-start',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = PX.neutral200 }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            {item.label}
          </Link>
        ))}

        <div style={{
          marginTop: 16, paddingTop: 16,
          borderTop: `1px solid ${PX.neutral300}`,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <PxLanguageSwitcher />
          <PxButton to="/login" variant="primary" size="sm">Connexion</PxButton>
        </div>
      </div>
    </div>
  )
}

function Hamburger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Ouvrir le menu"
      onClick={onClick}
      style={{
        width: 44, height: 44,
        background: 'transparent',
        border: `1px solid ${PX.neutral300}`,
        borderRadius: PX.radius.pill,
        display: 'grid', placeItems: 'center',
        cursor: 'pointer', padding: 0,
      }}
    >
      <svg width={20} height={14} viewBox="0 0 20 14" fill="none">
        <path d="M0 1H20M0 7H20M0 13H20" stroke={PX.neutral700} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  )
}

export default function PxNav({ bg = PX.neutral100 }: PxNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <header className="px-nav-pxv2" style={{
      paddingTop: 24,
      paddingBottom: 24,
      paddingLeft: 0,
      paddingRight: 0,
      background: bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Responsive overrides — desktop UI strictly unchanged */}
      <style>{`
        @media (max-width: 760px) {
          .px-nav-pxv2 .px-nav-desktop { display: none !important; }
          .px-nav-pxv2 .px-nav-mobile-toggle { display: inline-grid !important; }
        }
        @media (min-width: 761px) {
          .px-nav-pxv2 .px-nav-mobile-toggle { display: none !important; }
        }
      `}</style>
      <div style={{
        width: 1200,
        maxWidth: '100%',
        paddingLeft: 24,
        paddingRight: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{
          display: 'flex',
          gap: 24,
          alignItems: 'center',
        }}>
          <PxLogo variant="dark" form="text" size="sm" to="/" />
          <nav className="px-nav-desktop" style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {PRIMARY_LINKS.map(link => (
              <Link
                key={link.to}
                to={link.to}
                style={LINK_STYLE}
              >
                {link.label}
              </Link>
            ))}
            <MoreDropdown />
          </nav>
        </div>

        <div className="px-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PxLanguageSwitcher />
          <PxButton to="/login" variant="primary" size="sm">
            Connexion
          </PxButton>
        </div>

        <div className="px-nav-mobile-toggle" style={{ display: 'none' }}>
          <Hamburger onClick={() => setMobileOpen(true)} />
        </div>
      </div>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  )
}
