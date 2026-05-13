// Variant Property X (EN) du Header/V1 — utilisé uniquement sur /about
// pour fidélité Figma maximale.
// Source : Figma node 11774:16943 (Header/V1 inside Properties page)
//
// Différences vs PxNav :
// - Position ABSOLUTE top-0 z-4 (overlay au-dessus du hero, fidèle Figma)
// - Logo Property X (icône + wordmark texte) au lieu de MEGGA
// - Nav links en anglais : Home / About / Pages▾ / Cart (0)
// - CTA "Start exploring" au lieu de "Connexion"
//
// Structure fidèle :
//   <section absolute top-0 pt-24 px-0 flex-col items-center w-full z-4>
//     <Container w-1200 flex justify-between items-center>
//       <Left Content flex gap-24 items-center>
//         <Logo Text Light (icon 22 + text "Property X")>
//         <Nav List flex gap-16 items-center>
//           <Link "Home">
//           <Link "About">
//           <Link "Pages" + chevron-down 16>
//           <Link "Cart (0)">
//         </Nav List>
//       </Left Content>
//       <PrimaryButton LIGHT "Start exploring" + circle arrow>
//     </Container>
//   </section>

import { Link } from 'react-router-dom'
import { PX, PxIcon } from '..'

// Logo Property X reconstitué — petit cube avec "n"/"Π" stylisé + wordmark texte.
// Le wordmark Figma est un asset image; on reconstruit en SVG inline pour
// éviter la dépendance aux URLs Figma (expirent à 7 jours).
function PropertyXLogo({ color = PX.neutral700 }: { color?: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
    }}>
      {/* Icon 22×22 — cube avec arche intérieure (motif "Π" / Property X) */}
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style={{ display: 'block' }}>
        <rect x="0.5" y="0.5" width="21" height="21" rx="3" fill="none" stroke={color} strokeWidth="1.6" />
        <path d="M 6 16 L 6 7 L 11 7 L 11 16 M 11 9.5 L 16 9.5 L 16 16" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="square" />
      </svg>
      {/* Wordmark "Property X" — Display/4/Medium 20px ish, tracking serré */}
      <span style={{
        fontFamily: PX.font.display,
        fontWeight: 600,
        fontSize: 18,
        lineHeight: 1,
        letterSpacing: '-0.6px',
        color,
        whiteSpace: 'nowrap',
      }}>Property X</span>
    </span>
  )
}

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
] as const

export default function PxNavPropertyX() {
  return (
    <header style={{
      // Figma : absolute top-0 z-4, pt-24, w-1440 centered, flex-col items-center
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingTop: 24,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 4,
      pointerEvents: 'auto',
    }}>
      {/* Header/V1 inner : py-24 overflow-clip flex-col items-center */}
      <div style={{
        width: '100%',
        paddingTop: 0,
        paddingBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Container : w-1200, flex justify-between items-center */}
        <div style={{
          width: 1200,
          maxWidth: '100%',
          paddingLeft: 24,
          paddingRight: 24,
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
              <PropertyXLogo color={PX.neutral300} />
            </Link>
            {/* Nav List : flex gap-16 items-center */}
            <nav style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {NAV_LINKS.map(link => (
                <Link
                  key={link.to + link.label}
                  to={link.to}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    textDecoration: 'none',
                    fontFamily: PX.font.display,
                    fontSize: 16,
                    fontWeight: 500,
                    lineHeight: 1.25,
                    letterSpacing: '-0.48px',
                    color: PX.neutral300,
                  }}
                >
                  {link.label}
                </Link>
              ))}
              {/* Pages dropdown link */}
              <Link
                to="/services"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  textDecoration: 'none',
                  fontFamily: PX.font.display,
                  fontSize: 16,
                  fontWeight: 500,
                  lineHeight: 1.25,
                  letterSpacing: '-0.48px',
                  color: PX.neutral300,
                }}
              >
                Pages
                <PxIcon name="chevron-down" size={16} color={PX.neutral300} />
              </Link>
              {/* Cart link */}
              <Link
                to="/compte"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  textDecoration: 'none',
                  fontFamily: PX.font.display,
                  fontSize: 16,
                  fontWeight: 500,
                  lineHeight: 1.25,
                  letterSpacing: '-0.48px',
                  color: PX.neutral300,
                }}
              >
                Cart (0)
              </Link>
            </nav>
          </div>

          {/* CTA droite : "Start exploring" — Primary button LIGHT
              bg-white, pl-16 pr-6 py-6, rounded-pill, contient texte + circle dark */}
          <Link
            to="/acheter"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              paddingLeft: 16,
              paddingRight: 6,
              paddingTop: 6,
              paddingBottom: 6,
              background: PX.neutral100,
              borderRadius: PX.radius.pill,
              boxShadow: PX.shadow.small,
              textDecoration: 'none',
            }}
          >
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 2,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
              whiteSpace: 'nowrap',
            }}>Start exploring</span>
            {/* Icon circle : bg-neutral700, size 28, arrow-right white */}
            <span style={{
              width: 28,
              height: 28,
              borderRadius: PX.radius.pill,
              background: PX.neutral700,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}>
              <PxIcon name="arrow-right" size={12} color={PX.neutral100} />
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}
