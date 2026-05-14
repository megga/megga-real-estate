// MEGGA Marketplace — Property X "404 Not Found" section.
// Source : Figma node 9552:21503 — code Figma EXACT (texte, dimensions, position).
//
// Structure :
//   <section bg-neutral200>
//     <Header absolute top-0 z-4 (dark text / dark CTA — variant LIGHT page)>
//     <Hero pt-24 pb-100 pl-102 pr-24>
//       <Left content : "404" géant + "Oops..." + paragraphe + bouton "Go back home">
//       <Mask group : photo room 709×800 rounded-24>
//     </Hero>
//     <Cards section : 2 cartes "Post a free / Post a paid property">
//   </section>

import { Link } from 'react-router-dom'
import { PX, PxIcon } from '..'

// Logo MEGGA — SVG dans /public/megga-logo.svg, rendu en noir via filter.
function MeggaLogo() {
  return (
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
  )
}

// Primary Button "Dark sur fond light" — Figma node I11781:22569;11734:18262.
// bg neutral700, texte blanc, cercle blanc avec arrow neutral700.
function PrimaryButtonDark({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
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
        whiteSpace: 'nowrap',
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
        color: PX.neutral100,
        whiteSpace: 'nowrap',
      }}>{label}</span>
      <span style={{
        width: 28,
        height: 28,
        borderRadius: PX.radius.pill,
        background: PX.neutral100,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        <PxIcon name="arrow-right" size={12} color={PX.neutral700} />
      </span>
    </Link>
  )
}

// Vrais liens MEGGA — alignés avec HomeStickyHeader (source de vérité).
const NAV_LINKS = [
  { label: 'Acheter', to: '/acheter' },
  { label: 'Louer', to: '/louer' },
  { label: 'Estimer', to: '/estimations' },
  { label: 'Services', to: '/services' },
  { label: 'Pour les pros', to: '/agences' },
] as const

// ─── Header (Figma node 11781:22569 — Header/V1 variant LIGHT page) ────────────
function NotFoundHeader() {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 1440,
      maxWidth: '100%',
      paddingTop: 24,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      zIndex: 4,
    }}>
      <div style={{
        width: '100%',
        paddingTop: 24,
        paddingBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 1200,
          maxWidth: '100%',
          paddingLeft: 24,
          paddingRight: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Left content : logo MEGGA + nav FR */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
              <MeggaLogo />
            </Link>
            <nav style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center' }}>
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
                    color: PX.neutral700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* CTA droite : "Compte" — pill MEGGA (style Property X dark conservé) */}
          <PrimaryButtonDark to="/login" label="Compte" />
        </div>
      </div>
    </div>
  )
}

// ─── Cards Section (Figma node 9631:9496 — Footer/V1 dans 404, cards uniquement) ──
// 2 cartes "Post a free property" / "Post a paid property" — bg blanc, h-160,
// shadow small, rounded-24, avec bouton circle "+" en haut à droite.
function CTACard({ title, body, to, plusLabel }: { title: string; body: string; to: string; plusLabel: string }) {
  return (
    <Link
      to={to}
      style={{
        position: 'relative',
        flex: 1,
        height: 160,
        padding: 20,
        background: PX.neutral100,
        borderRadius: 24,
        boxShadow: PX.shadow.small,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        textDecoration: 'none',
      }}
    >
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
        }}>{body}</p>
      </div>
      {/* Plus circle button : 40×40, bg neutral700, top: 20, right: 20 (extrait des insets % Figma) */}
      <span
        aria-label={plusLabel}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: PX.radius.pill,
          background: PX.neutral700,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <PxIcon name="plus" size={16} color={PX.neutral100} />
      </span>
    </Link>
  )
}

function CardsSection() {
  // On recale les cards sur le container 1200 (= largeur du Grid Footer dans
  // le bloc dark) au lieu de la pleine largeur 1392, sinon le titre 24px et
  // le bouton "+" 40px laissent un vide visuel disproportionné dans des cards
  // de 685px.
  return (
    <div style={{
      width: '100%',
      paddingLeft: 24,
      paddingRight: 24,
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
      }}>
        <CTACard
          to="/publier?type=free"
          title="Post a free property"
          body="Lorem ipsum dolor sit amet consectetur vitae aenean amet in eros neque nulla mattis sit."
          plusLabel="Post a free property"
        />
        <CTACard
          to="/publier?type=premium"
          title="Post a paid property"
          body="Lorem ipsum dolor sit amet consectetur vitae aenean amet in eros neque nulla mattis sit."
          plusLabel="Post a paid property"
        />
      </div>
    </div>
  )
}

// ─── Hero Section (Figma node 11781:22631) ──────────────────────────────────
// flex items-center justify-between, pt-24 pb-100 pl-102 pr-24, w-full.
// Left content (517×407) en grid overlay : "404" géant + bottom content
// décalé via ml-0 mt-218.94 (mt négatif simulé par grid placement).
function HeroSection() {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      paddingTop: 24,
      paddingBottom: 100,
      paddingLeft: 102,
      paddingRight: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 3,
    }}>
      {/* Left content : grid overlay — "404" en row1, bottom content en row1 avec mt:218.94 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'max-content',
        gridTemplateRows: 'max-content',
        placeItems: 'start',
        position: 'relative',
      }}>
        {/* "404" géant — Display Other/404 : 233.239px, ls=-6.9972, lh=1.15, neutral300 */}
        <p style={{
          gridColumn: 1,
          gridRow: 1,
          margin: 0,
          marginTop: 0,
          marginLeft: 0,
          fontFamily: PX.font.display,
          fontWeight: 500,
          fontSize: 233.239,
          lineHeight: 1.15,
          letterSpacing: '-6.9972px',
          color: PX.neutral300,
          whiteSpace: 'nowrap',
        }}>404</p>

        {/* Bottom content : superposé sur "404" via grid row1 + marginTop calculé */}
        <div style={{
          gridColumn: 1,
          gridRow: 1,
          marginLeft: 0,
          marginTop: 218.94,
          paddingTop: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          position: 'relative',
        }}>
          {/* Title "Oops...page not found" — Display/8/Medium 48/1.25/-1.44 neutral700, w=517 */}
          <h1 style={{
            margin: 0,
            width: 517,
            maxWidth: '100%',
            fontFamily: PX.font.display,
            fontSize: 48,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-1.44px',
            color: PX.neutral700,
          }}>
            Oops...page not found
          </h1>

          {/* Paragraph pt-16 — Paragraph/Default/Regular 16/1.5/-0.48 neutral500, w=422 h=48 */}
          <div style={{ paddingTop: 16 }}>
            <p style={{
              margin: 0,
              width: 422,
              maxWidth: '100%',
              height: 48,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
            }}>
              Lorem ipsum dolor sit amet consectetur gravida elementum dolor semper felis pulvinar feugiat risus.
            </p>
          </div>

          {/* Button row pt-24 — "Go back home" Primary Button DARK */}
          <div style={{ paddingTop: 24 }}>
            <PrimaryButtonDark to="/" label="Go back home" />
          </div>
        </div>
      </div>

      {/* Right : Mask group 709×800 — photo room, rounded-24 */}
      <div style={{
        width: 709,
        height: 800,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <img
          src="/images/sections/notfound/hero-room.jpg"
          alt=""
          aria-hidden="true"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>
    </div>
  )
}

export default function PxNotFound() {
  return (
    <section style={{
      position: 'relative',
      width: '100%',
      background: PX.neutral200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      isolation: 'isolate',
    }}>
      <NotFoundHeader />
      <HeroSection />
      <CardsSection />
    </section>
  )
}
