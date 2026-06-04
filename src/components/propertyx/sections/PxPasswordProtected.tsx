// MEGGA Marketplace — Property X "Password Protected" utility page.
// Source : Figma node 9552:21506 — code Figma EXACT (texte, dimensions, positionnement).
//
// Anatomie fidèle Figma :
//   <section bg-neutral200 flex-col>
//     <Header/V1 : logo + nav noir + bouton "Start exploring" noir>
//     <Hero Section : pt-80 pb-200 — card centrée 580×449 avec lock + form>
//     <Footer cards : 2 cards "Post a free/paid property" w-685 h-160>
//   </section>
//
// Note : Le footer principal dark (bloc "Discover exclusive real estate
// opportunities" + colonnes) est rendu séparément via PxFooterPropertyX dans
// la page parente — pour rester DRY avec /about, /propriete, etc.

import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PX, MEIcon } from '..'

// ─── Logo Property X (inline SVG, version noir/dark) ────────────────────
// Charge les vrais assets Figma stockés dans /public/icons/figma/propertyx/.
// Style cohérent avec PxNavPropertyX / PxFooterPropertyX (mêmes assets).
const logoCache = { icon: null as string | null, text: null as string | null }

function PropertyXLogoDark() {
  const [iconSvg, setIconSvg] = useState<string | null>(logoCache.icon)
  const [textSvg, setTextSvg] = useState<string | null>(logoCache.text)

  useEffect(() => {
    if (!iconSvg) {
      fetch('/icons/figma/propertyx/logo-icon.svg').then(r => r.text()).then(t => { logoCache.icon = t; setIconSvg(t) }).catch(() => {})
    }
    if (!textSvg) {
      fetch('/icons/figma/propertyx/logo-text.svg').then(r => r.text()).then(t => { logoCache.text = t; setTextSvg(t) }).catch(() => {})
    }
  }, [iconSvg, textSvg])

  return (
    <span
      role="img"
      aria-label="Property X"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        color: PX.neutral700,
      }}
    >
      <span
        aria-hidden="true"
        style={{ display: 'inline-block', width: 22, height: 22, transform: 'scaleX(-1)' }}
        dangerouslySetInnerHTML={iconSvg ? { __html: iconSvg } : undefined}
      />
      <span
        aria-hidden="true"
        style={{ display: 'inline-block', width: 101.669, height: 24.76 }}
        dangerouslySetInnerHTML={textSvg ? { __html: textSvg } : undefined}
      />
    </span>
  )
}

// ─── Header "dark-on-light" (variant statique non-overlay) ──────────────
// Source Figma I11781:22491 — Header/V1 utilisé sur Password Protected page.
// Différences vs PxNavPropertyX :
// - Position STATIC (pas absolute)
// - Logo NOIR (PX.neutral700)
// - Nav links NOIRS (PX.neutral700)
// - Bouton "Start exploring" NOIR plein (variant primary)
function PasswordProtectedHeader() {
  return (
    <header style={{
      width: '100%',
      paddingTop: 24,
      paddingBottom: 24,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Container : w-1200, p-0, flex justify-between items-center (Figma exact) */}
      <div style={{
        width: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Left Content : flex gap-24 items-center */}
        <div style={{
          display: 'flex',
          gap: 24,
          alignItems: 'center',
        }}>
          <Link to="/" style={{ display: 'inline-flex', textDecoration: 'none' }}>
            <PropertyXLogoDark />
          </Link>
          {/* Nav List : flex gap-16 items-center justify-center */}
          <nav style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Link to="/" style={navLinkStyle}>Home</Link>
            <Link to="/about" style={navLinkStyle}>About</Link>
            <Link
              to="/services"
              style={{ ...navLinkStyle, gap: 6 }}
            >
              Pages
              <MEIcon name="chevron-down" size={16} color={PX.neutral700} />
            </Link>
            <Link to="/account" style={navLinkStyle}>Cart (0)</Link>
          </nav>
        </div>

        {/* CTA "Start exploring" — Primary button DARK (bg neutral700, text white) */}
        <Link
          to="/buy"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            paddingLeft: 16,
            paddingRight: 6,
            paddingTop: 6,
            paddingBottom: 6,
            background: PX.neutral700,
            borderRadius: PX.radius.pill,
            textDecoration: 'none',
          }}
        >
          <span style={{
            paddingTop: 2,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral100,
            whiteSpace: 'nowrap',
          }}>Start exploring</span>
          {/* Icon circle : bg-white, size 28, arrow-right neutral700 */}
          <span style={{
            width: 28,
            height: 28,
            borderRadius: PX.radius.pill,
            background: PX.neutral100,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}>
            <ArrowRightFigma color={PX.neutral700} />
          </span>
        </Link>
      </div>
    </header>
  )
}

const navLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  textDecoration: 'none',
  fontFamily: PX.font.display,
  fontSize: 16,
  fontWeight: 500,
  lineHeight: 1.25,
  letterSpacing: '-0.48px',
  color: PX.neutral700,
  paddingTop: 2, // Figma wrapper pt-xx-small
}

// ─── Arrow right (Figma "Line Rounded/Arrow rigth", 12×12) ──────────────
// Path simple : ligne horizontale + chevron pointant droite.
function ArrowRightFigma({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2 6h8M7 2.5L10.5 6 7 9.5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Lock icon filled (Figma "Small Icon/V22", 22.892×32.593) ───────────
// Cadenas style solide noir — anse outline + corps fill. Fidèle au render
// Figma node I11782:16364. Dimensions exactes 22.892 × 32.593.
function LockFilled() {
  return (
    <svg
      width="22.892"
      height="32.593"
      viewBox="0 0 22.892 32.593"
      fill="none"
      aria-hidden="true"
    >
      {/* Anse (shackle) : arc en U inversé, stroke seulement, ~60% largeur du body */}
      <path
        d="M5 14V8.5a6.5 6.5 0 0 1 13 0V14"
        stroke={PX.neutral700}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Corps (body) : rectangle plein avec radius */}
      <rect
        x="1"
        y="14"
        width="20.892"
        height="18.593"
        rx="3"
        fill={PX.neutral700}
      />
    </svg>
  )
}

// ─── Hero card (Password protected form) ────────────────────────────────
// Figma node 9631:9405 : bg-white, h-449, px-83 py-77, rounded-20, shadow-small.
// Contenu centré : lock icon + titre + paragraphe + input pill.
function PasswordProtectedCard() {
  const [password, setPassword] = useState('')

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // L'utilisateur peut wire ça plus tard à la vraie auth. Pour l'instant
    // c'est purement visuel (utility page).
  }

  return (
    <div style={{
      background: PX.neutral100,
      height: 449,
      paddingLeft: 83,
      paddingRight: 83,
      paddingTop: 77,
      paddingBottom: 77,
      borderRadius: 20,
      boxShadow: PX.shadow.small,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
    }}>
      {/* Content centré : flex-col items-center justify-center */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Lock icon 32.593×32.593 (image 22.892×32.593 centrée) */}
        <div style={{
          width: 32.593,
          height: 32.593,
          display: 'grid',
          placeItems: 'center',
        }}>
          <LockFilled />
        </div>
        {/* Title : pt-24 (sections/pd-small), 36 Medium tracking -1.08 w-412 */}
        <div style={{ paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{
            margin: 0,
            width: 412,
            fontFamily: PX.font.display,
            fontSize: 36,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-1.08px',
            color: PX.neutral700,
            textAlign: 'center',
          }}>
            Password protected
          </h1>
        </div>
        {/* Paragraph : pt-16, 16/1.5 neutral500 w-422 h-48 */}
        <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
          <p style={{
            margin: 0,
            width: 422,
            height: 48,
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral500,
            textAlign: 'center',
          }}>
            Lorem ipsum dolor sit amet consectetur gravida elementum dolor semper felis pulvinar feugiat risus.
          </p>
        </div>
        {/* Input + bouton : pt-32, w-380 min-h-52 pill bg-neutral300 */}
        <div style={{ paddingTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
          <form
            onSubmit={handleSubmit}
            style={{
              width: 380,
              minHeight: 52,
              paddingLeft: 16,
              paddingRight: 6,
              paddingTop: 6,
              paddingBottom: 6,
              background: PX.neutral300,
              borderRadius: PX.radius.pill,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="px-pwd-input"
              style={{
                flex: 1,
                minWidth: 0,
                paddingTop: 2, // Figma : pt-xx-small sur le wrapper text
                paddingLeft: 0,
                paddingRight: 0,
                paddingBottom: 0,
                background: 'transparent',
                border: 0,
                outline: 'none',
                fontFamily: PX.font.display,
                fontSize: 16,
                fontWeight: 400,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
                color: PX.neutral700,
              }}
            />
            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                paddingLeft: 16,
                paddingRight: 6,
                paddingTop: 6,
                paddingBottom: 6,
                background: PX.neutral700,
                border: 0,
                borderRadius: PX.radius.pill,
                cursor: 'pointer',
                fontFamily: PX.font.display,
                fontSize: 16,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
                color: PX.neutral100,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ paddingTop: 2 }}>Enter now</span>
              <span style={{
                width: 28,
                height: 28,
                borderRadius: PX.radius.pill,
                background: PX.neutral100,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}>
                <ArrowRightFigma color={PX.neutral700} />
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Card "Post a … property" ───────────────────────────────────────────
// Figma node I9627:16279;9548:20036 (et 11800:46921).
// Card blanche h-160, p-20, rounded-24, shadow-small. Contenu w-360 + bouton
// circle "+" positionné absolu top-right (Figma inset 12.5% 2.92% 62.5% 91.24%
// soit ~20px from top et 20px from right sur card 685×160).
interface PostPropertyCardProps {
  title: string
  description: string
  to: string
}

function PostPropertyCard({ title, description, to }: PostPropertyCardProps) {
  return (
    <Link
      to={to}
      style={{
        width: 685,
        height: 160,
        padding: 20,
        background: PX.neutral100,
        borderRadius: 24, // sections/pd-small
        boxShadow: PX.shadow.small,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        textDecoration: 'none',
        color: 'inherit',
        flexShrink: 0,
      }}
    >
      {/* Content : w-360 h-90 flex-col gap-12 justify-center */}
      <div style={{
        width: 360,
        height: 90,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}>
        <p style={{
          margin: 0,
          width: '100%',
          fontFamily: PX.font.display,
          fontSize: 24,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.72px',
          color: PX.neutral700,
        }}>{title}</p>
        <p style={{
          margin: 0,
          width: '100%',
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
        }}>{description}</p>
      </div>
      {/* Bouton circle "+" positionné absolu — Figma inset 12.5%/2.92%/62.5%/91.24% */}
      <span style={{
        position: 'absolute',
        top: '12.5%',
        right: '2.92%',
        bottom: '62.5%',
        left: '91.24%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: PX.neutral700,
        borderRadius: PX.radius.pill,
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 2v12M2 8h12"
            stroke={PX.neutral100}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </Link>
  )
}

// ─── Section exportée ───────────────────────────────────────────────────
export default function PxPasswordProtected() {
  return (
    <section style={{
      width: '100%',
      background: PX.neutral200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
    }}>
      {/* Placeholder color neutral500 (Figma exact) — scope via className unique */}
      <style>{`.px-pwd-input::placeholder { color: ${PX.neutral500}; opacity: 1; }`}</style>
      {/* 1. Header dark-on-light */}
      <PasswordProtectedHeader />

      {/* 2. Hero Section : pt-80 pb-200 flex-col items-center justify-center */}
      <div style={{
        width: '100%',
        paddingTop: 80,
        paddingBottom: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <PasswordProtectedCard />
      </div>

      {/* 3. Footer/V1 wrapper : flex-col gap-24 items-start pb-24 px-24 w-full
          Le Container DARK (footer principal) est rendu séparément dans la page
          parente via PxFooterPropertyX. Le gap-24 entre cards et footer dark est
          assuré par paddingBottom de ce wrapper. */}
      <div style={{
        width: '100%',
        paddingLeft: 24,
        paddingRight: 24,
        paddingBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        alignItems: 'flex-start',
      }}>
        {/* Cards Wrapper : flex items-center justify-between w-full */}
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <PostPropertyCard
            title="Post a free property"
            description="Lorem ipsum dolor sit amet consectetur vitae aenean amet in eros neque nulla mattis sit."
            to="/publish?type=free"
          />
          <PostPropertyCard
            title="Post a paid property"
            description="Lorem ipsum dolor sit amet consectetur vitae aenean amet in eros neque nulla mattis sit."
            to="/publish?type=premium"
          />
        </div>
      </div>
    </section>
  )
}
