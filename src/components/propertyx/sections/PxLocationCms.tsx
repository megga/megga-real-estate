// MEGGA Marketplace — Property X "📍 Location CMS" page.
// Source : Figma node 9552:21441 — code Figma EXACT (texte, dimensions, position).
//
// Anatomie fidèle Figma :
//   <section bg-neutral200 flex-col items-center>
//     <Header/V1 : logo + nav noir + bouton "Start exploring" noir>
//     <Hero Section : pleine largeur, rounded-24 — image LA full-bg
//                     + title overlay "Properties in Los Angeles, CA" (white 72)
//                     + paragraph droite + 2 boutons (Start exploring / Post properties)
//                     + Browser search flottant au bas centré sur la rounded card>
//     <Feature Section : dark (neutral700) rounded-24 — badge "Featured properties" + title 48 white
//                        + paragraph + Row Cards (954 card + 221 partial opacity-30)>
//     <Properties Section : badge + title "All properties in Los Angeles" + paragraph droite
//                           + grille 2x Properties Card/V2 (588×520) avec amenities + Contact agent>
//   </section>
//
// Le footer dark est rendu séparément dans la page parente via PxFooterPropertyX.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PX, PxIcon, PxFigmaIcon } from '..'

// ─── Logo Property X dark-on-light ───────────────────────────────────────
const logoCache = { icon: null as string | null, text: null as string | null }

function PropertyXLogoDark() {
  const [iconSvg, setIconSvg] = useState<string | null>(logoCache.icon)
  const [textSvg, setTextSvg] = useState<string | null>(logoCache.text)
  useEffect(() => {
    if (!iconSvg) fetch('/icons/figma/propertyx/logo-icon.svg').then(r => r.text()).then(t => { logoCache.icon = t; setIconSvg(t) }).catch(() => {})
    if (!textSvg) fetch('/icons/figma/propertyx/logo-text.svg').then(r => r.text()).then(t => { logoCache.text = t; setTextSvg(t) }).catch(() => {})
  }, [iconSvg, textSvg])
  return (
    <span role="img" aria-label="Property X" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: PX.neutral700 }}>
      <span aria-hidden="true" style={{ display: 'inline-block', width: 22, height: 22, transform: 'scaleX(-1)' }} dangerouslySetInnerHTML={iconSvg ? { __html: iconSvg } : undefined} />
      <span aria-hidden="true" style={{ display: 'inline-block', width: 101.669, height: 24.76 }} dangerouslySetInnerHTML={textSvg ? { __html: textSvg } : undefined} />
    </span>
  )
}

// ─── Chevron right (16×16, pour le link Contact agent) ─────────────────
// Note : on garde un SVG inline car le fichier Figma chevron-right.svg est mal
// nommé (son path pointe vers le haut — Figma applique rotate-90 côté CSS).
// Notre version inline pointe directement vers la droite, plus simple à utiliser.
function ChevronRight({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m6 4 4 4-4 4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Header dark-on-light ───────────────────────────────────────────────
const navLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
  fontFamily: PX.font.display, fontSize: 16, fontWeight: 500, lineHeight: 1.25,
  letterSpacing: '-0.48px', color: PX.neutral700, paddingTop: 2,
}

function LocationHeader() {
  return (
    <header style={{
      width: '100%', paddingTop: 24, paddingBottom: 24,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <div style={{ width: 1200, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link to="/" style={{ display: 'inline-flex', textDecoration: 'none' }}><PropertyXLogoDark /></Link>
          <nav style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center' }}>
            <Link to="/" style={navLinkStyle}>Home</Link>
            <Link to="/about" style={navLinkStyle}>About</Link>
            <Link to="/services" style={{ ...navLinkStyle, gap: 6 }}>
              Pages
              <PxIcon name="chevron-down" size={16} color={PX.neutral700} />
            </Link>
            <Link to="/account" style={navLinkStyle}>Cart (0)</Link>
          </nav>
        </div>
        <Link to="/buy" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          paddingLeft: 16, paddingRight: 6, paddingTop: 6, paddingBottom: 6,
          background: PX.neutral700, borderRadius: PX.radius.pill, textDecoration: 'none',
        }}>
          <span style={{
            paddingTop: 2, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
            lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral100, whiteSpace: 'nowrap',
          }}>Start exploring</span>
          <span style={{
            width: 28, height: 28, borderRadius: PX.radius.pill, background: PX.neutral100,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <PxFigmaIcon name="arrow-right" size={12} color={PX.neutral700} />
          </span>
        </Link>
      </div>
    </header>
  )
}

// ─── Browser search bar (Figma node 9613:25847) ─────────────────────────
// bg-white, p-24, rounded-48, shadow-soft, gap-2 flex items-center
// Input w-400 + 3 Selects (Location, Property, Type) w-220 each
function BrowserSearch() {
  const [query, setQuery] = useState('')
  return (
    <div style={{
      background: PX.neutral100, padding: 24, borderRadius: 48,
      boxShadow: PX.shadow.small, display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        position: 'relative', width: 400, minHeight: 52, background: PX.neutral200,
        paddingLeft: 16, paddingRight: 6, paddingTop: 6, paddingBottom: 6,
        borderTopLeftRadius: PX.radius.pill, borderBottomLeftRadius: PX.radius.pill,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <input
          type="text"
          placeholder="Search for properties"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="px-lcms-input"
          style={{
            flex: 1, minWidth: 0, paddingTop: 2, paddingLeft: 0, paddingRight: 0, paddingBottom: 0,
            background: 'transparent', border: 0, outline: 'none',
            fontFamily: PX.font.display, fontSize: 16, fontWeight: 400, lineHeight: 1.25,
            letterSpacing: '-0.48px', color: PX.neutral700,
          }}
        />
        <button type="submit" aria-label="Search" style={{
          position: 'absolute', top: '50%', right: 6, transform: 'translateY(-50%)',
          width: 40, height: 40, borderRadius: PX.radius.pill, background: PX.neutral700,
          border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center',
        }}>
          <PxFigmaIcon name="search" size={22} color={PX.neutral100} />
        </button>
      </div>
      <SelectField label="Location" />
      <SelectField label="Property" />
      <SelectField label="Type" rounded="right" />
    </div>
  )
}

function SelectField({ label, rounded }: { label: string; rounded?: 'right' }) {
  const radius: React.CSSProperties = rounded === 'right'
    ? { borderTopRightRadius: PX.radius.pill, borderBottomRightRadius: PX.radius.pill }
    : {}
  return (
    <button type="button" style={{
      width: 220, height: 52, minHeight: 48,
      paddingLeft: 16, paddingRight: 16, paddingTop: 6, paddingBottom: 6,
      background: PX.neutral200, border: 0, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      ...radius,
    }}>
      <span style={{
        paddingTop: 2, fontFamily: PX.font.display, fontSize: 16, fontWeight: 400,
        lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral500, whiteSpace: 'nowrap',
      }}>{label}</span>
      <PxFigmaIcon name="chevron-down" size={16} color={PX.neutral500} />
    </button>
  )
}

// ─── Hero Section : full-bg image rounded card + title overlay + Browser flottant ──
// Figma node 11774:19443 — Hero Section w-1440 h-724
//   Container w-1392 h-700 (px-24) rounded-24 overflow-clip bg-neutral700
//     Background absolute inset-0 : image 1394x822 + Fade 1392x372.5
//     Content w-1200 pt-140 flex items-end justify-between :
//       H1 w-613 h-154.49 (Objectivity 72/115% -2.16, white)
//       Left Content w-480 flex-col gap-24 :
//         Paragraph 16 regular neutral200 lh-1.5
//         Buttons Row gap-16 : Primary "Start exploring" + Link "Post properties"
//   Browser absolute top-674 left-50% z-2
function LocationHero() {
  return (
    <section style={{
      width: '100%', position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingLeft: 24, paddingRight: 24,
      // Hero Section Figma : 1440x724, paddings inclusifs
    }}>
      {/* Container : w-1392 h-700 rounded-24 overflow-clip bg-neutral700 (under image) */}
      <div style={{
        width: '100%', maxWidth: 1392, height: 700, position: 'relative',
        borderRadius: 24, overflow: 'hidden', background: PX.neutral700,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {/* Background : image LA + Fade gradient au top */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <img
            src="/images/sections/location-cms/hero-aerial.jpg"
            alt="Los Angeles aerial cityscape"
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: 822,
              objectFit: 'cover', display: 'block',
            }}
          />
          {/* Fade overlay : gradient from dark at top fading to transparent */}
          <div style={{
            position: 'absolute', top: -1, left: 0, width: '100%', height: 372,
            background: 'linear-gradient(to bottom, rgba(20,22,28,0.65) 0%, rgba(20,22,28,0.35) 40%, rgba(20,22,28,0) 100%)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* Content : w-1200 pt-140 flex items-end justify-between */}
        <div style={{
          position: 'relative', width: 1200, paddingTop: 140,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        }}>
          {/* H1 : 72 medium white lh-1.15 tracking-2.16 w-613 */}
          <h1 style={{
            margin: 0, width: 613,
            fontFamily: PX.font.display, fontSize: 72, fontWeight: 500, lineHeight: 1.15,
            letterSpacing: '-2.16px', color: PX.neutral100,
          }}>
            Properties in Los Angeles, CA
          </h1>
          {/* Left Content : w-480 flex-col gap-24 items-start */}
          <div style={{
            width: 480, display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'flex-start',
          }}>
            <p style={{
              margin: 0, width: '100%',
              fontFamily: PX.font.display, fontSize: 16, fontWeight: 400, lineHeight: 1.5,
              letterSpacing: '-0.48px', color: PX.neutral200,
            }}>
              Lorem ipsum dolor sit amet consectetur fermentum eget fringilla egestas a aliquam arcu arcu nunc pretium id semper ut volutpat. Id gravida aenean.
            </p>
            {/* Buttons Row : gap-16 */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {/* Primary Button "Start exploring" */}
              <Link to="/buy" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                paddingLeft: 16, paddingRight: 6, paddingTop: 6, paddingBottom: 6,
                background: PX.neutral700, borderRadius: PX.radius.pill, textDecoration: 'none',
              }}>
                <span style={{
                  paddingTop: 2, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
                  lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral100, whiteSpace: 'nowrap',
                }}>Start exploring</span>
                <span style={{
                  width: 28, height: 28, borderRadius: PX.radius.pill, background: PX.neutral100,
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                }}>
                  <PxFigmaIcon name="arrow-right" size={12} color={PX.neutral700} />
                </span>
              </Link>
              {/* Link "Post properties" + chevron right (color neutral300 ~ white-ish) */}
              <Link to="/publish" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                textDecoration: 'none',
              }}>
                <span style={{
                  paddingTop: 2, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
                  lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral300, whiteSpace: 'nowrap',
                }}>Post properties</span>
                <ChevronRight color={PX.neutral300} size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Browser search : absolute centered, overlaps bottom of hero card */}
      <div style={{
        position: 'absolute', left: '50%', bottom: -50, transform: 'translateX(-50%)',
        zIndex: 2,
      }}>
        <BrowserSearch />
      </div>
    </section>
  )
}

// ─── Feature Section (dark) : Featured properties card with partial card ──
// Figma node 11774:19578 — pt-120 px-24 flex-col items-center
// Container : bg-neutral700 rounded-24 py-160 px-0 flex-col items-center gap-32 overflow-clip
//   Top Content : badge (bg-neutral600, icon V25 star bg-neutral500 circle) + title 48 white + paragraph 16 white
//   Row Cards : w-1394 h-440 overflow-clip relative
//     Wrapper absolute left-50% gap-24 : Card 954×440 + partial Card 221×441 opacity-30
function FeaturedProperties() {
  return (
    <section style={{
      width: '100%', paddingTop: 120, paddingLeft: 24, paddingRight: 24,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      position: 'relative', zIndex: 1,
    }}>
      <div style={{
        width: '100%', background: PX.neutral700,
        borderRadius: 24, paddingTop: 160, paddingBottom: 160,
        display: 'flex', flexDirection: 'column', gap: 32,
        alignItems: 'center', overflow: 'hidden',
      }}>
        {/* Top Content : badge + title + paragraph centered */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {/* Badge "Featured properties" — bg-neutral600, icon V25 star (bg-neutral500 circle) */}
          <div style={{
            background: PX.neutral600, paddingLeft: 6, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
            borderRadius: PX.radius.pill, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              width: 26, height: 26, borderRadius: 46.635, background: PX.neutral500,
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <PxFigmaIcon name="badge-featured-star" size={14.857} color={PX.neutral100} />
            </span>
            <span style={{
              paddingTop: 2, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
              lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral100, whiteSpace: 'nowrap',
            }}>Featured properties</span>
          </div>
          {/* Title : pt-16, 48 medium white tracking-1.44 */}
          <div style={{ paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <h2 style={{
              margin: 0, fontFamily: PX.font.display, fontSize: 48, fontWeight: 500, lineHeight: 1.25,
              letterSpacing: '-1.44px', color: PX.neutral100, whiteSpace: 'nowrap',
            }}>Featured properties</h2>
          </div>
          {/* Paragraph : pt-16, 16 regular white lh-1.5 w-480.098 center */}
          <div style={{ paddingTop: 16, display: 'flex', alignItems: 'center' }}>
            <p style={{
              margin: 0, width: 480.098,
              fontFamily: PX.font.display, fontSize: 16, fontWeight: 400, lineHeight: 1.5,
              letterSpacing: '-0.48px', color: PX.neutral100, textAlign: 'center',
            }}>
              Lorem ipsum dolor sit amet consectetur fermentum eget fringilla egestas a aliquam arcu arcu nunc pretium id.
            </p>
          </div>
        </div>

        {/* Row Cards : w-1394 h-440 overflow-clip relative */}
        <div style={{ width: 1394, height: 440, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)',
            display: 'flex', gap: 24, alignItems: 'center', overflow: 'hidden',
          }}>
            {/* Main Card 954×440 */}
            <FeaturedCard />
            {/* Partial Card 221×441 opacity-30 (slice of next card preview) */}
            <div style={{
              width: 221, height: 441.075, opacity: 0.3, borderRadius: 24, overflow: 'hidden', position: 'relative',
            }}>
              <img
                src="/images/sections/location-cms/card-interior-2.jpg"
                alt="Property preview"
                style={{ position: 'absolute', left: '-186px', top: 0, width: 593, height: 440, objectFit: 'cover' }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Featured Card 954×440 (image bg + content overlay) ─────────────────
// Figma node 11774:19588
//   bg-neutral500 rounded-24 overflow-clip
//   Background : Image V7 + Fade gradient bottom-to-top
//   Content (absolute inset-0, p-32, flex-col justify-between) :
//     Top Flex : Badge "For rent" (with key icon V34, bg-neutral700) + Plus white circle 40px
//     Bottom : Text Wrapper (title 24 + paragraph 16 white w-380) + Location pin + address
function FeaturedCard() {
  return (
    <Link to="/propriete" style={{
      width: 954, height: 440, borderRadius: 24, overflow: 'hidden', position: 'relative',
      background: PX.neutral500, display: 'block', textDecoration: 'none', flexShrink: 0,
    }}>
      <img
        src="/images/sections/location-cms/card-interior-1.jpg"
        alt="Luxury Loft in San Francisco"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', display: 'block',
        }}
      />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(20,22,28,0.75) 0%, rgba(20,22,28,0.35) 40%, rgba(20,22,28,0) 70%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, padding: 32,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        {/* Top Flex : badge (key + "For rent") + Plus circle button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{
            background: PX.neutral700, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
            borderRadius: PX.radius.pill, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
          }}>
            <PxFigmaIcon name="key" size={16} color={PX.neutral100} />
            <span style={{
              paddingTop: 2, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
              lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral100, whiteSpace: 'nowrap',
            }}>For rent</span>
          </div>
          {/* Primary Circle Button (Plus) — bg-white 40px rounded-pill shadow soft */}
          <span style={{
            width: 40, height: 40, borderRadius: PX.radius.pill, background: PX.neutral100,
            display: 'grid', placeItems: 'center', boxShadow: PX.shadow.small,
          }}>
            <PxFigmaIcon name="plus" size={16} color={PX.neutral700} />
          </span>
        </div>
        {/* Bottom Content : flex-col gap-12 items-start w-full */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start', width: '100%' }}>
          {/* Text Wrapper : flex-col gap-8 items-start w-380 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', width: 380 }}>
            <h3 style={{
              margin: 0, width: '100%',
              fontFamily: PX.font.display, fontSize: 24, fontWeight: 500, lineHeight: 1.25,
              letterSpacing: '-0.72px', color: PX.neutral100,
            }}>Luxury Loft in San Francisco</h3>
            <p style={{
              margin: 0, width: '100%',
              fontFamily: PX.font.display, fontSize: 16, fontWeight: 400, lineHeight: 1.5,
              letterSpacing: '-0.48px', color: PX.neutral100,
            }}>
              Lorem ipsum dolor sit amet consectetur tellus eu enim ultrices imperdiet faucibus elementum.
            </p>
          </div>
          {/* Location row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <PxFigmaIcon name="location" size={20} color={PX.neutral100} />
            <span style={{
              paddingTop: 6, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
              lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral100, whiteSpace: 'nowrap',
            }}>2238 Stradella Rd, SF</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── All Properties Grid Section (light bg, 2 cards V2) ─────────────────
// Figma node 11775:20030 — pt-160 pb-160 flex-col items-center
// Container w-1200 :
//   Top Content w-1195 pb-48 flex items-end justify-between :
//     Left : badge (V36 home, bg-neutral300) + title "All properties in Los Angeles" 48 w-341.25
//     Paragraph (right) w-562.047
//   Grid Wrapper : flex-wrap gap-y-48 gap-x-24 — 2x Properties Card/V2 (588 wide)
const GRID_CARDS = [
  {
    title: 'Luxury Loft in San Francisco',
    address: '2238 Stradella Rd, SF',
    badge: 'For rent' as const,
    sqtf: '2,553 sqtf',
    beds: '3',
    baths: '2',
    parking: '3',
    image: '/images/sections/location-cms/card-interior-1.jpg',
  },
  {
    title: 'Home in Los Angeles Heart',
    address: '2596 El Segundo, Los Angeles',
    badge: 'For sale' as const,
    sqtf: '2,553 sqtf',
    beds: '3',
    baths: '2',
    parking: '3',
    image: '/images/sections/location-cms/card-interior-2.jpg',
  },
] as const

function AllPropertiesGrid() {
  return (
    <section style={{
      width: '100%', paddingTop: 160, paddingBottom: 160,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ width: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Top Content : flex items-end justify-between pb-48 w-1195 */}
        <div style={{
          width: 1195, paddingBottom: 48, display: 'flex',
          alignItems: 'flex-end', justifyContent: 'space-between',
        }}>
          {/* Left Content : badge + title */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
            <div style={{
              background: PX.neutral300, paddingLeft: 6, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
              borderRadius: PX.radius.pill, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                width: 26, height: 26, borderRadius: 46.635, background: PX.neutral400,
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                <PxFigmaIcon name="badge-allprops-home" size={14.857} color={PX.neutral100} />
              </span>
              <span style={{
                paddingTop: 2, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
                lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral700, whiteSpace: 'nowrap',
              }}>All properties</span>
            </div>
            <div style={{ paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <h2 style={{
                margin: 0, width: 341.25,
                fontFamily: PX.font.display, fontSize: 48, fontWeight: 500, lineHeight: 1.25,
                letterSpacing: '-1.44px', color: PX.neutral700,
              }}>All properties in Los Angeles</h2>
            </div>
          </div>
          {/* Paragraph (right) : pt-16 pb-16 w-562.047 */}
          <div style={{
            paddingTop: 16, paddingBottom: 16,
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center',
          }}>
            <p style={{
              margin: 0, width: 562.047, height: 48,
              fontFamily: PX.font.display, fontSize: 16, fontWeight: 400, lineHeight: 1.5,
              letterSpacing: '-0.48px', color: PX.neutral500, textAlign: 'center',
            }}>
              Lorem ipsum dolor sit amet consectetur. Sit ut gravida aenean potenti. Metus in eu vel morbi dui nunc tellus. Non a massa maecenas massa.
            </p>
          </div>
        </div>

        {/* Grid Wrapper : flex-wrap gap-y-48 gap-x-24 items-start w-full */}
        <div style={{
          width: '100%', display: 'flex', flexWrap: 'wrap',
          columnGap: 24, rowGap: 48, alignItems: 'flex-start',
        }}>
          {GRID_CARDS.map(card => (
            <PropertyCardV2 key={card.title} {...card} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Properties Card V2 — version Location CMS (sans price, avec parking) ──
// Figma node 11775:20040 / 11775:20041
//   w-588 flex-col gap-24 items-start :
//     Card image h-364 rounded-24 overflow-clip relative bg-neutral500 (image bg) :
//       Top Flex (absolute p-24) : Badge (key/tag icon + "For rent/sale") + Plus white circle 40px
//     Bottom Content (NOT overlay, below image) :
//       Title 24 medium neutral700
//       Details Wrapper : location pin + address (16 medium neutral700)
//     Divider 1px neutral300
//     Flex Horizontal : Amenities Wrapper (4 amenities: surface V31 / bed V23 / bath V33 / parking V27, gap-24)
//                       + Link "Contact agent" + chevron-right
interface PropertyCardV2Props {
  title: string
  address: string
  badge: 'For rent' | 'For sale'
  sqtf: string
  beds: string
  baths: string
  parking: string
  image: string
}

function PropertyCardV2({ title, address, badge, sqtf, beds, baths, parking, image }: PropertyCardV2Props) {
  const badgeIconName: 'key' | 'tag' = badge === 'For rent' ? 'key' : 'tag'
  return (
    <div style={{
      width: 588, display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'flex-start',
    }}>
      {/* Card image : h-364 rounded-24 overflow-clip relative bg-neutral500 */}
      <Link to="/propriete" style={{
        width: '100%', height: 364, borderRadius: 24, overflow: 'hidden', position: 'relative',
        background: PX.neutral500, display: 'block', textDecoration: 'none',
      }}>
        <img src={image} alt={title} style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block',
        }} />
        {/* Top Flex (absolute p-24) : badge + Plus circle */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, padding: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            background: PX.neutral700, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
            borderRadius: PX.radius.pill, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
          }}>
            <PxFigmaIcon name={badgeIconName} size={16} color={PX.neutral100} />
            <span style={{
              paddingTop: 2, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
              lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral100, whiteSpace: 'nowrap',
            }}>{badge}</span>
          </div>
          <span style={{
            width: 40, height: 40, borderRadius: PX.radius.pill, background: PX.neutral100,
            display: 'grid', placeItems: 'center', boxShadow: PX.shadow.small,
          }}>
            <PxFigmaIcon name="plus" size={16} color={PX.neutral700} />
          </span>
        </div>
      </Link>

      {/* Bottom Content (below image) : title + details */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        <h3 style={{
          margin: 0, fontFamily: PX.font.display, fontSize: 24, fontWeight: 500, lineHeight: 1.25,
          letterSpacing: '-0.72px', color: PX.neutral700, whiteSpace: 'nowrap',
        }}>{title}</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <PxFigmaIcon name="location" size={20} color={PX.neutral700} />
          <span style={{
            paddingTop: 6, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
            lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral700, whiteSpace: 'nowrap',
          }}>{address}</span>
        </div>
      </div>

      {/* Divider 1px neutral300 */}
      <div style={{ width: '100%', height: 1, background: PX.neutral300 }} />

      {/* Flex Horizontal : amenities + Contact agent link */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Amenity icon="surface" label={sqtf} />
          <Amenity icon="bed" label={beds} />
          <Amenity icon="bath" label={baths} />
          <Amenity icon="parking" label={parking} />
        </div>
        {/* Link "Contact agent" — text + chevron-right (NOT a circle button) */}
        <Link to="/contact" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          textDecoration: 'none',
        }}>
          <span style={{
            paddingTop: 2, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
            lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral700, whiteSpace: 'nowrap',
          }}>Contacter l’agence</span>
          <ChevronRight color={PX.neutral700} size={16} />
        </Link>
      </div>
    </div>
  )
}

function Amenity({ icon, label }: { icon: 'surface' | 'bed' | 'bath' | 'parking'; label: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <PxFigmaIcon name={icon} size={20} color={PX.neutral400} />
      <span style={{
        paddingTop: 2, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
        lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral400, whiteSpace: 'nowrap',
      }}>{label}</span>
    </div>
  )
}

// ─── Section exportée ───────────────────────────────────────────────────
export default function PxLocationCms() {
  return (
    <section style={{
      width: '100%', background: PX.neutral200,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      {/* Placeholder color neutral500 (Figma exact) */}
      <style>{`.px-lcms-input::placeholder { color: ${PX.neutral500}; opacity: 1; }`}</style>
      <LocationHeader />
      <LocationHero />
      <FeaturedProperties />
      <AllPropertiesGrid />
    </section>
  )
}
