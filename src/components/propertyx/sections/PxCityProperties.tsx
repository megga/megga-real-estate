// MEGGA Marketplace — Property X "Property CSM" (City State Market) page.
// Source : Figma node 9552:21444 — code Figma EXACT (texte, dimensions, position).
//
// Anatomie fidèle Figma :
//   <section bg-neutral200 flex-col items-center>
//     <Header/V1 : logo + nav noir + bouton "Start exploring" noir>
//     <Hero Section : pt-56 pb-80 px-24 — title + paragraph + image masked + Browser search>
//     <Properties Section : "Featured properties" — badge + title 48 + paragraph + Row Cards (954 + 221)>
//     <Properties Section #2 : "All properties in Los Angeles" — badge + title + 4 cards grid 588x364>
//   </section>
//
// Le footer dark est rendu séparément dans la page parente via PxFooterPropertyX.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PX, PxIcon } from '..'

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

// ─── Arrow right (Figma "Line Rounded/Arrow rigth", 12×12) ──────────────
function ArrowRightFigma({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 6h8M7 2.5L10.5 6 7 9.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Chevron down (16×16) ───────────────────────────────────────────────
function ChevronDown({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m4 6 4 4 4-4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Search icon (Line Rounded/Search, 22×22) ───────────────────────────
function SearchIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" stroke={color} strokeWidth="1.6" fill="none" />
      <path d="m18 18-3.2-3.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// ─── Location pin icon (Small Icon/V37, 20×20) ──────────────────────────
function LocationPin({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 18s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill="none" />
      <circle cx="10" cy="7.5" r="2" stroke={color} strokeWidth="1.6" fill="none" />
    </svg>
  )
}

// ─── Home icon (Icon V25, 14.857×14.13 inside 26 circle) ────────────────
function HomeIcon({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 7.5 8 3l6 4.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.5Z" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M6.5 14V9.5h3V14" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

// ─── Header dark-on-light ───────────────────────────────────────────────
const navLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
  fontFamily: PX.font.display, fontSize: 16, fontWeight: 500, lineHeight: 1.25,
  letterSpacing: '-0.48px', color: PX.neutral700, paddingTop: 2,
}

function CityPropertiesHeader() {
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
            <ArrowRightFigma color={PX.neutral700} />
          </span>
        </Link>
      </div>
    </header>
  )
}

// ─── Browser search bar (Figma node 9613:25830) ─────────────────────────
// Container : bg-white, p-24, rounded-48, shadow-soft, gap-2 flex items-center
// Children : Input (w-400 + search icon) + 3 Selects (Location, Property, Type)
// All sibling pills share continuous look : input rounded-l-pill, last select rounded-r-pill
function BrowserSearch() {
  const [query, setQuery] = useState('')
  return (
    <div style={{
      background: PX.neutral100, padding: 24, borderRadius: 48,
      boxShadow: PX.shadow.small, display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Input Text : bg-neutral200, w-400, min-h-52, rounded-l-pill */}
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
          className="px-csm-input"
          style={{
            flex: 1, minWidth: 0, paddingTop: 2, paddingLeft: 0, paddingRight: 0, paddingBottom: 0,
            background: 'transparent', border: 0, outline: 'none',
            fontFamily: PX.font.display, fontSize: 16, fontWeight: 400, lineHeight: 1.25,
            letterSpacing: '-0.48px', color: PX.neutral700,
          }}
        />
        {/* Search icon button : absolute right-6, bg-neutral700 size-40 rounded-pill */}
        <button type="submit" aria-label="Search" style={{
          position: 'absolute', top: '50%', right: 6, transform: 'translateY(-50%)',
          width: 40, height: 40, borderRadius: PX.radius.pill, background: PX.neutral700,
          border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center',
        }}>
          <SearchIcon color={PX.neutral100} />
        </button>
      </div>
      {/* 3 Selects : bg-neutral200, w-220, h-52, px-16 py-6, justify-between */}
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
      <ChevronDown color={PX.neutral500} />
    </button>
  )
}

// ─── Hero Section ───────────────────────────────────────────────────────
// Figma node 11776:20253 — pt-56 pb-80 px-24 w-full
// Container : flex-col gap-120 items-center w-full
//   Wrapper : flex-col gap-64 items-center w-full
//     Top Content : flex items-end justify-between w-1200
//       Title (left) : "Houses for sale or rent" 72 medium tracking-2.16 w-422 h-154.492
//       Paragraph (right) : 16 regular neutral500 w-472.098
//     Image : w-1394 h-858 mask (visible 520) rounded-24 — masked image of LA cityscape
//   Browser : centered below
function CityHero() {
  return (
    <section style={{
      width: '100%', paddingTop: 56, paddingBottom: 80, paddingLeft: 24, paddingRight: 24,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    }}>
      <div style={{
        width: '100%', display: 'flex', flexDirection: 'column',
        gap: 120, alignItems: 'center',
      }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 64, alignItems: 'center' }}>
          {/* Top Content : w-1200 flex items-end justify-between */}
          <div style={{ width: 1200, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <h1 style={{
              margin: 0, width: 422, height: 154.492,
              fontFamily: PX.font.display, fontSize: 72, fontWeight: 500, lineHeight: 1.15,
              letterSpacing: '-2.16px', color: PX.neutral700,
            }}>
              Houses for sale or rent
            </h1>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <p style={{
                margin: 0, width: 472.098,
                fontFamily: PX.font.display, fontSize: 16, fontWeight: 400, lineHeight: 1.5,
                letterSpacing: '-0.48px', color: PX.neutral500,
              }}>
                Lorem ipsum dolor sit amet consectetur fermentum eget fringilla egestas a aliquam arcu arcu nunc pretium id semper ut volutpat. Id gravida aenean.
              </p>
            </div>
          </div>
          {/* Image : w-1394 h-520 (mask visible portion) rounded-24 */}
          <div style={{
            width: 1394, height: 520, borderRadius: 24, overflow: 'hidden',
            position: 'relative', flexShrink: 0,
          }}>
            <img
              src="https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=2400&q=85&auto=format&fit=crop"
              alt="Modern luxury home exterior"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        </div>
        {/* Browser search bar centered below */}
        <BrowserSearch />
      </div>
    </section>
  )
}

// ─── Featured Properties Section ────────────────────────────────────────
// Figma node 9613:27286 — w-1440, gap-40, flex-col items-center
// Top Content : badge "Featured properties" + title 48 + paragraph 16
// Row Cards : h-440 w-1394 overflow-clip with main card 954 + partial card 221 (opacity-30)
function FeaturedProperties() {
  return (
    <section style={{
      width: 1440, maxWidth: '100%', borderRadius: 24,
      paddingTop: 0, paddingBottom: 0,
      display: 'flex', flexDirection: 'column', gap: 40, alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Top Content : badge + title + paragraph centered */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {/* Badge : bg-neutral300 pill, icon V25 + text */}
        <div style={{
          background: PX.neutral300, paddingLeft: 6, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
          borderRadius: PX.radius.pill, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            width: 26, height: 26, borderRadius: 46.635, background: PX.neutral400,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <HomeIcon color={PX.neutral100} size={15} />
          </span>
          <span style={{
            paddingTop: 2, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
            lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral700, whiteSpace: 'nowrap',
          }}>Featured properties</span>
        </div>
        {/* Title : pt-16 (sections/pd-extra-small) */}
        <div style={{ paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{
            margin: 0, fontFamily: PX.font.display, fontSize: 48, fontWeight: 500, lineHeight: 1.25,
            letterSpacing: '-1.44px', color: PX.neutral700, whiteSpace: 'nowrap',
          }}>Featured properties</h2>
        </div>
        {/* Paragraph : pt-16, 16 regular neutral500, w-480.098 text-center */}
        <div style={{ paddingTop: 16, display: 'flex', alignItems: 'center' }}>
          <p style={{
            margin: 0, width: 480.098,
            fontFamily: PX.font.display, fontSize: 16, fontWeight: 400, lineHeight: 1.5,
            letterSpacing: '-0.48px', color: PX.neutral500, textAlign: 'center',
          }}>
            Lorem ipsum dolor sit amet consectetur fermentum eget fringilla egestas a aliquam arcu arcu nunc pretium id.
          </p>
        </div>
      </div>
      {/* Row Cards : h-440 w-1394 overflow-clip relative */}
      <div style={{ width: 1394, height: 440, overflow: 'hidden', position: 'relative' }}>
        {/* Wrapper : absolute left-1/2 -translate-x-1/2, flex gap-24 items-center */}
        <div style={{
          position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)',
          display: 'flex', gap: 24, alignItems: 'center', overflow: 'hidden',
        }}>
          {/* Main Card 954×440 */}
          <FeaturedCard />
          {/* Partial card 221 wide opacity-30 */}
          <div style={{
            width: 221, height: 441.075, opacity: 0.3, borderRadius: 24, overflow: 'hidden', position: 'relative',
          }}>
            <img
              src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=85&auto=format&fit=crop"
              alt="Property preview"
              style={{ position: 'absolute', left: '-186px', top: 0, width: 593, height: 440, objectFit: 'cover' }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Featured Card 954×440 with image bg + content overlay ──────────────
// Figma node 11780:21885
function FeaturedCard() {
  return (
    <Link to="/buy" style={{
      width: 954, height: 440, borderRadius: 24, overflow: 'hidden', position: 'relative',
      background: PX.neutral500, display: 'block', textDecoration: 'none', flexShrink: 0,
    }}>
      {/* Background Image V7 */}
      <img
        src="https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=2000&q=85&auto=format&fit=crop"
        alt="Luxury Loft in San Francisco"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', display: 'block',
        }}
      />
      {/* Fade overlay (gradient bottom-to-top dark) */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(20,22,28,0.75) 0%, rgba(20,22,28,0.35) 40%, rgba(20,22,28,0) 70%)',
      }} />
      {/* Content : absolute inset 0, flex-col h-440 justify-between p-32 */}
      <div style={{
        position: 'absolute', inset: 0, padding: 32,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        {/* Flex Horizontal top : badge left + circle button right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          {/* Badge "For rent" : bg-neutral700 px-12 py-6 rounded-pill text-white 16 medium */}
          <div style={{
            background: PX.neutral700, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
            borderRadius: PX.radius.pill, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              paddingTop: 2, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
              lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral100, whiteSpace: 'nowrap',
            }}>For rent</span>
          </div>
          {/* Primary Circle Button : bg-white size-40 rounded-pill shadow-soft with arrow */}
          <span style={{
            width: 40, height: 40, borderRadius: PX.radius.pill, background: PX.neutral100,
            display: 'grid', placeItems: 'center', boxShadow: PX.shadow.small,
          }}>
            <ArrowRightFigma color={PX.neutral700} size={14} />
          </span>
        </div>
        {/* Bottom Content : flex-col gap-12 items-start w-full */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start', width: '100%' }}>
          {/* Text Wrapper : flex-col gap-8 items-start w-380 text-white */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', width: 380, color: PX.neutral100 }}>
            <h3 style={{
              margin: 0, fontFamily: PX.font.display, fontSize: 30, fontWeight: 500, lineHeight: 1.25,
              letterSpacing: '-0.9px', color: PX.neutral100,
            }}>Luxury Loft in San Francisco</h3>
            <p style={{
              margin: 0, fontFamily: PX.font.display, fontSize: 16, fontWeight: 400, lineHeight: 1.5,
              letterSpacing: '-0.48px', color: PX.neutral100,
            }}>
              Lorem ipsum dolor sit amet consectetur tellus eu enim ultrices imperdiet faucibus elementum.
            </p>
          </div>
          {/* Location row : icon + text */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 20, height: 20, display: 'grid', placeItems: 'center' }}>
              <LocationPin color={PX.neutral100} />
            </span>
            <span style={{
              paddingTop: 6, fontFamily: PX.font.display, fontSize: 16, fontWeight: 400,
              lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral100, whiteSpace: 'nowrap',
            }}>2238 Stradella Rd, SF</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── All Properties Grid Section ────────────────────────────────────────
// Figma node 11780:22133 — pt-160 pb-160 flex-col items-center
// Container w-1200 with Top Content (badge + title + paragraph w-1195 pb-48)
// Grid Wrapper : flex-wrap gap-x-24 gap-y-48 — 4 cards (Properties Card/V2) w-588 each
const GRID_CARDS = [
  {
    title: 'Luxury Loft in San Francisco',
    location: '2238 Stradella Rd, SF',
    price: '$2,553/sqtf',
    sqtf: '2,553 sqtf',
    beds: '3',
    baths: '2',
    badge: 'For rent',
    image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1500&q=85&auto=format&fit=crop',
  },
  {
    title: 'Home in Los Angeles Heart',
    location: '2238 Stradella Rd, LA',
    price: '$8,392/sqtf',
    sqtf: '8,392 sqtf',
    beds: '3',
    baths: '2',
    badge: 'For sale',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1500&q=85&auto=format&fit=crop',
  },
  {
    title: 'Modern Loft in San Francisco',
    location: '2238 Stradella Rd, SF',
    price: '$1,334/sqtf',
    sqtf: '1,334 sqtf',
    beds: '1',
    baths: '2',
    badge: 'For sale',
    image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1500&q=85&auto=format&fit=crop',
  },
  {
    title: 'Executive Office, San Diego',
    location: '90071, South Grand Avenue, San Diego',
    price: '$8,392/sqtf',
    sqtf: '8,392 sqtf',
    beds: '3',
    baths: '2',
    badge: 'For sale',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1500&q=85&auto=format&fit=crop',
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
            {/* Badge "All properties" */}
            <div style={{
              background: PX.neutral300, paddingLeft: 6, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
              borderRadius: PX.radius.pill, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                width: 26, height: 26, borderRadius: 46.635, background: PX.neutral400,
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                <HomeIcon color={PX.neutral100} size={15} />
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
          {/* Paragraph (right) : pt-16 pb-16, 16 regular neutral500, w-562.047 text-center */}
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
        {/* Grid Wrapper : flex-wrap gap-x-24 gap-y-48 items-start w-full */}
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

// ─── Properties Card V2 ─────────────────────────────────────────────────
// Figma node 11780:22143 (et 22144, 22145, 22146)
// w-588, flex-col gap-24 items-start
// Card : h-364 rounded-24 overflow-clip bg-cover (image bg) + Flex Horizontal top (badge + circle btn) + Bottom (location + price abs)
// Below card : title + paragraph + amenities row + divider + Contact agent button
interface PropertyCardV2Props {
  title: string
  location: string
  price: string
  sqtf: string
  beds: string
  baths: string
  badge: string
  image: string
}

function PropertyCardV2({ title, location, price, sqtf, beds, baths, badge, image }: PropertyCardV2Props) {
  return (
    <div style={{
      width: 588, display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'flex-start',
    }}>
      {/* Card : h-364 rounded-24 overflow-clip relative bg-neutral500 */}
      <Link to="/buy" style={{
        width: '100%', height: 364, borderRadius: 24, overflow: 'hidden', position: 'relative',
        background: PX.neutral500, display: 'block', textDecoration: 'none',
      }}>
        <img src={image} alt={title} style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block',
        }} />
        {/* Top Flex Horizontal : badge left + circle btn right, p-24 */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, padding: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            background: PX.neutral700, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
            borderRadius: PX.radius.pill, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              paddingTop: 2, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
              lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral100, whiteSpace: 'nowrap',
            }}>{badge}</span>
          </div>
          <span style={{
            width: 40, height: 40, borderRadius: PX.radius.pill, background: PX.neutral100,
            display: 'grid', placeItems: 'center', boxShadow: PX.shadow.small,
          }}>
            <ArrowRightFigma color={PX.neutral700} size={14} />
          </span>
        </div>
        {/* Bottom Content : absolute bottom-0 left/right p-24, location + price */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          color: PX.neutral100,
        }}>
          {/* Location with icon */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <LocationPin color={PX.neutral100} />
            <span style={{
              paddingTop: 4, fontFamily: PX.font.display, fontSize: 16, fontWeight: 400,
              lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral100, whiteSpace: 'nowrap',
            }}>{location}</span>
          </div>
          {/* Price */}
          <span style={{
            paddingTop: 2, fontFamily: PX.font.display, fontSize: 20, fontWeight: 500,
            lineHeight: 1.25, letterSpacing: '-0.6px', color: PX.neutral100, whiteSpace: 'nowrap',
          }}>{price}</span>
        </div>
      </Link>
      {/* Below card content : title + amenities + divider + Contact button */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
        <h3 style={{
          margin: 0, fontFamily: PX.font.display, fontSize: 24, fontWeight: 500, lineHeight: 1.25,
          letterSpacing: '-0.72px', color: PX.neutral700,
        }}>{title}</h3>
        {/* Divider */}
        <div style={{ width: '100%', height: 1, background: PX.neutral300 }} />
        {/* Amenities row + Contact button */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <Amenity icon="surface" label={sqtf} />
            <Amenity icon="bed" label={beds} />
            <Amenity icon="bath" label={baths} />
          </div>
          <Link to="/buy" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            paddingLeft: 16, paddingRight: 6, paddingTop: 6, paddingBottom: 6,
            background: PX.neutral700, borderRadius: PX.radius.pill, textDecoration: 'none',
          }}>
            <span style={{
              paddingTop: 2, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
              lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral100, whiteSpace: 'nowrap',
            }}>Contacter l’agence</span>
            <span style={{
              width: 28, height: 28, borderRadius: PX.radius.pill, background: PX.neutral100,
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <ArrowRightFigma color={PX.neutral700} />
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}

function Amenity({ icon, label }: { icon: 'surface' | 'bed' | 'bath'; label: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <span style={{ width: 20, height: 20, display: 'grid', placeItems: 'center' }}>
        <PxIcon name={icon} size={20} color={PX.neutral500} />
      </span>
      <span style={{
        paddingTop: 2, fontFamily: PX.font.display, fontSize: 16, fontWeight: 500,
        lineHeight: 1.25, letterSpacing: '-0.48px', color: PX.neutral500, whiteSpace: 'nowrap',
      }}>{label}</span>
    </div>
  )
}

// ─── Section exportée ───────────────────────────────────────────────────
export default function PxCityProperties() {
  return (
    <section style={{
      width: '100%', background: PX.neutral200,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      {/* Placeholder color neutral500 (Figma exact) */}
      <style>{`.px-csm-input::placeholder { color: ${PX.neutral500}; opacity: 1; }`}</style>
      <CityPropertiesHeader />
      <CityHero />
      <FeaturedProperties />
      <AllPropertiesGrid />
    </section>
  )
}
