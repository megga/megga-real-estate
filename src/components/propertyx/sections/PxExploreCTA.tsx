// MEGGA Marketplace — Property X "CTA/V3" section.
// Source : Figma node 11754:25937.
//
// iPad reconstruit en React à partir des assets individuels Figma :
// - Bezel iPad Pro 11 Space Gray Landscape (PNG transparent au centre)
// - 5 photos de propriétés (JPG)
// - Icônes via PxFigmaIcon (Figma SVG)
// - Logo MEGGA SVG natif
// Layout en flex/grid pour robustesse — pas de positions absolues fragiles.

import { useEffect, useState } from 'react'
import { PX, PxButton, PxFigmaIcon } from '..'

// MEGGA wordmark SVG inline — viewBox 1920×419, aspect 4.58:1.
function MeggaLogoInline({ height, color }: { height: number; color: string }) {
  const width = height * (1920 / 419)
  return (
    <svg viewBox="0 0 1920 419" width={width} height={height} aria-label="MEGGA" style={{ display: 'block' }}>
      <polygon fill={color} points="92 0 237.62 219.08 384 0 475 0 475.31 63.04 363.87 229.77 237.7 418.79 104.93 220.12 104.62 419 0 419 0 0 92 0"/>
      <polygon fill={color} points="826 0 826.06 94.73 622.1 94.74 621.94 167.65 791.33 167.66 791.33 251.37 622.01 251.37 621.99 324.3 826.05 324.29 825.97 419 517.35 419 517 0 826 0"/>
      <path fill={color} d="M1052,0c46.64,5.38,88.55,22.94,122.21,59.67-22.79,28.12-37.71,60.3-47.08,96.28-7.89-14.68-16.56-27.02-28.35-37.25-40.39-35.04-99.55-30.53-134.81,9.66-40.25,45.89-40.1,117.16.48,162.82,35.48,39.93,94.73,44.05,134.83,8.67,14.5-12.89,25.12-28.95,32.24-48.42l-95.26-.1-.03-83.65,192.78-.02c8.8,28.23,5.09,73.7-2.86,101.4-22.71,79.15-85.98,140.1-169.06,149-2.17.23-4.11.34-5.1.93h-31c-42.03-4.33-81.34-20.79-113.04-49.92-96.69-88.85-90.73-249.43,12.42-329.58,29.62-23.01,64.08-35.58,100.62-39.5h31Z"/>
      <path fill={color} d="M1732,0l188,418.23v.77h-104.98l-42.28-94.7h-124.31s-42.38,94.7-42.38,94.7h-104.22c.24-1.34.57-2.95,1.41-4.82L1690,0h42ZM1739.67,250.92l-29.06-64.46-29.15,64.86,58.21-.39Z"/>
      <path fill={color} d="M1351,419h-29c-47.56,0-91.35-24.53-123.87-60,24.65-30.5,36.53-57.89,47.2-96.18,7.43,14.3,16.5,27.51,28.71,37.93,36.96,31.55,90.34,30.86,126.22-1.89,13.97-12.75,24.27-28.48,31.18-47.43l-94.84-.08-.05-83.65,192.4-.03c2.59,9.14,3.94,17.82,4.5,27.2,4.34,72.2-25.1,142.48-83.13,186.34-29.43,22.24-63.45,34.03-99.32,37.8Z"/>
      <path fill={color} d="M1351,0c43.2,4.34,82.78,21.02,114.61,50.52,6.43,5.96,12.05,11.43,17.39,19.2l-56.72,84.95c-7.57-14.34-16.16-25.96-27.71-36.03-33.9-29.56-83.44-31.58-119.35-4.39-12.97,9.71-22.64,21.92-30.74,35.77l-101.14-.14c10.87-40.77,32.85-75.32,63.12-102.25,31.59-28.19,70.35-43.46,111.55-47.62h29Z"/>
      <polygon fill={color} points="475.11 419 370.91 419 370.69 251.26 475.21 95.29 475.11 419"/>
    </svg>
  )
}

// ─── Badge "Get in touch" dark variant ─────────────────────────────────────
function GetInTouchBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 6,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral600,
      borderRadius: PX.radius.pill,
    }}>
      <span style={{
        width: 26, height: 26, borderRadius: PX.radius.pill, background: PX.neutral500,
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        <PxFigmaIcon name="badge-featured-star" size={14.857} color={PX.neutral100} />
      </span>
      <span style={{
        fontFamily: PX.font.display, fontSize: 16, fontWeight: 500, lineHeight: 1.25,
        letterSpacing: '-0.48px', color: PX.neutral100, paddingTop: 2,
      }}>Get in touch</span>
    </span>
  )
}

// ─── iPad screen content (inside bezel) — flex layout structuré ────────────
function IpadStatusBar() {
  return (
    <div style={{
      position: 'absolute', top: 12, left: 18, right: 18,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontFamily: '"SF Pro Display", "SF Pro", -apple-system, sans-serif',
      fontSize: 8, fontWeight: 510, color: PX.neutral700,
    }}>
      <span>9:41 Mon Oct 16</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <svg width="11" height="7" viewBox="0 0 11 7" fill="none">
          <rect x="0" y="4.5" width="1.5" height="2.5" rx="0.3" fill={PX.neutral700} />
          <rect x="2.5" y="3" width="1.5" height="4" rx="0.3" fill={PX.neutral700} />
          <rect x="5" y="1.5" width="1.5" height="5.5" rx="0.3" fill={PX.neutral700} />
          <rect x="7.5" y="0" width="1.5" height="7" rx="0.3" fill={PX.neutral700} />
        </svg>
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M4.5 0.4C3 0.4 1.6 0.95 0.6 1.85l0.7 0.7C2.1 1.85 3.3 1.5 4.5 1.5c1.2 0 2.4 0.35 3.2 1.05l0.7-0.7C7.4 0.95 6 0.4 4.5 0.4z" fill={PX.neutral700} />
          <circle cx="4.5" cy="5.7" r="0.85" fill={PX.neutral700} />
        </svg>
        <span>100%</span>
        <svg width="18" height="8" viewBox="0 0 18 8" fill="none">
          <rect x="0.3" y="0.5" width="15" height="7" rx="1.6" stroke={PX.neutral700} strokeWidth="0.5" fill="none" opacity="0.4" />
          <rect x="1.2" y="1.4" width="13.2" height="5.2" rx="0.9" fill={PX.neutral700} />
          <rect x="15.8" y="2.6" width="1.4" height="2.8" rx="0.5" fill={PX.neutral700} opacity="0.4" />
        </svg>
      </div>
    </div>
  )
}

function IpadHeader() {
  // Layout Figma : logo absolute-left, search absolute-center, ... absolute-right.
  // On utilise grid 3 colonnes (1fr auto 1fr) pour centrer la search bar.
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      paddingLeft: 10, paddingRight: 10, paddingTop: 30,
      columnGap: 10,
    }}>
      {/* Logo MEGGA — justify-self start, hauteur Figma 15.635 */}
      <div style={{ justifySelf: 'start' }}>
        <MeggaLogoInline height={15.635} color={PX.neutral700} />
      </div>
      {/* Search bar centered — width Figma exact 237.742 × 30.81 */}
      <div style={{
        width: 237.742,
        height: 30.81,
        position: 'relative',
        background: PX.neutral200, borderRadius: 91.97,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        paddingLeft: 9.48, paddingRight: 30,
        boxSizing: 'border-box',
      }}>
        <span style={{
          fontFamily: PX.font.display, fontSize: 9.48, fontWeight: 400,
          color: PX.neutral500, lineHeight: 1.25, letterSpacing: '-0.2844px',
        }}>Choose your location</span>
        <span style={{
          position: 'absolute', right: 3.55, top: '50%', transform: 'translateY(-50%)',
          width: 23.7, height: 23.7, borderRadius: PX.radius.pill,
          background: PX.neutral700, display: 'grid', placeItems: 'center',
        }}>
          <PxFigmaIcon name="search" size={13.035} color={PX.neutral100} />
        </span>
      </div>
      {/* "..." more menu — justify-self end */}
      <div style={{
        justifySelf: 'end',
        width: 24, height: 24, borderRadius: PX.radius.pill,
        border: `1px solid ${PX.neutral300}`, display: 'grid', placeItems: 'center',
      }}>
        <span style={{ color: PX.neutral500, fontSize: 12, lineHeight: 0, marginTop: -4 }}>···</span>
      </div>
    </div>
  )
}

function IpadPhotoGrid() {
  // Largeurs Figma exactes : main 378.039 + right 2×182.893 + gap 4 (approximé).
  // Hauteur photo main 367.262 ; 2×2 photos 131.138 each, total ~265 + gap.
  return (
    <div style={{
      display: 'flex', gap: 5,
      paddingLeft: 10, paddingRight: 10, paddingTop: 16,
    }}>
      {/* Large photo left — Figma 378.039 × 367.262 */}
      <div style={{
        width: 378.039, height: 270, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
        backgroundImage: 'url("/images/sections/cta-ipad/photo-main.jpg")',
        backgroundSize: 'cover', backgroundPosition: 'center',
      }} />
      {/* Right 2x2 grid — Figma photos 182.893 × 131.138, 2 cols × 2 rows */}
      <div style={{
        display: 'grid', gridTemplateColumns: '182.893px 182.893px',
        gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 5, position: 'relative',
        height: 270,
      }}>
        {['photo-2.jpg', 'photo-3.jpg', 'photo-4.jpg', 'photo-5.jpg'].map((p, i) => (
          <div key={i} style={{
            borderRadius: 8, overflow: 'hidden',
            backgroundImage: `url("/images/sections/cta-ipad/${p}")`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }} />
        ))}
        {/* Star/save button bottom-right — Figma 35 × 35 (padding 10.408 + icon 14.571) */}
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
          width: 35, height: 35, borderRadius: PX.radius.pill,
          background: PX.neutral100, display: 'grid', placeItems: 'center',
          boxShadow: PX.shadow.small,
        }}>
          <PxFigmaIcon name="badge-featured-star" size={14.571} color={PX.neutral700} />
        </div>
      </div>
    </div>
  )
}

function IpadBottomSection() {
  return (
    <div style={{
      display: 'flex', gap: 24,
      paddingLeft: 10, paddingRight: 10, paddingTop: 14,
    }}>
      {/* Left column : details — Figma typo exacte */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 8.326,
      }}>
        {/* Address row — icône location V37 + "2238 Stradella Rd, SF" 10.41/500 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5.336 }}>
          <PxFigmaIcon name="location" size={13.34} color={PX.neutral700} />
          <span style={{
            fontFamily: PX.font.display, fontSize: 10.41, fontWeight: 500,
            color: PX.neutral700, letterSpacing: '-0.3123px', lineHeight: 1.25,
          }}>2238 Stradella Rd, SF</span>
        </div>
        {/* Title — "Luxury Loft in San Francisco" 14.59/500/-0.4377 */}
        <div style={{
          fontFamily: PX.font.display, fontSize: 14.59, fontWeight: 500,
          color: PX.neutral700, letterSpacing: '-0.4377px', lineHeight: 1.25,
        }}>Luxury Loft in San Francisco</div>
        {/* Description — Figma 11.16/400/1.5/-0.3348 neutral500 width 391.878 */}
        <p style={{
          margin: 0, maxWidth: 391.878,
          fontFamily: PX.font.display, fontSize: 11.16, fontWeight: 400,
          color: PX.neutral500, letterSpacing: '-0.3348px', lineHeight: 1.5,
        }}>
          Sem egestas elit pretium turpis eu quis tristique phasellus pellentesque
          elementum pharetra iaculis metus pretium viverra tortor faucibus.
        </p>
        {/* Stats row — Figma gap-15.612 height-15.718, icônes 15.718 */}
        <div style={{
          display: 'flex', gap: 15.612, alignItems: 'center', height: 15.718, marginTop: 2,
        }}>
          <StatItem icon="surface" value="2,553 sqtf" />
          <StatItem icon="bed" value="3" />
          <StatItem icon="bath" value="2" />
          <StatItem icon="parking" value="3" />
        </div>
      </div>

      {/* Right column : contact agent (au-dessus) + price card */}
      <div style={{
        width: 200, display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Contact agent link — 9.43/500/-0.2829 + chevron-right 9.428 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6.897, alignSelf: 'flex-start',
          marginTop: 4,
        }}>
          <span style={{
            fontFamily: PX.font.display, fontSize: 9.43, fontWeight: 500,
            color: PX.neutral700, letterSpacing: '-0.2829px', lineHeight: 1.25,
            paddingTop: 1.179,
          }}>Contact agent</span>
          <PxFigmaIcon name="chevron-right" size={9.428} color={PX.neutral700} />
        </div>
        {/* Price card — Figma 191.503 wide, bg white, rounded 8.326 */}
        <div style={{
          width: 191.503,
          background: PX.neutral100, borderRadius: 8.326,
          padding: 10, display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div>
            <div style={{
              fontFamily: PX.font.display, fontSize: 14.59, fontWeight: 500,
              color: PX.neutral700, letterSpacing: '-0.4377px', lineHeight: 1.25,
            }}>$ 8,495,000 USD</div>
            <div style={{
              fontFamily: PX.font.display, fontSize: 10.41, fontWeight: 500,
              color: PX.neutral500, letterSpacing: '-0.3123px', lineHeight: 1.25,
              marginTop: 2,
            }}>Property for sale</div>
          </div>
          <div style={{ height: 1, background: PX.neutral300 }} />
          <div style={{
            fontFamily: PX.font.display, fontSize: 10.41, fontWeight: 500,
            color: PX.neutral700, letterSpacing: '-0.3123px', lineHeight: 1.25,
          }}>Get in touch to receive more info</div>
          {/* Figma : 3 inputs (Full name + 2× Email address) */}
          <InputPill placeholder="Full name" />
          <InputPill placeholder="Email address" />
          <InputPill placeholder="Email address" />
        </div>
      </div>
    </div>
  )
}

function StatItem({ icon, value }: { icon: 'surface' | 'bed' | 'bath' | 'parking'; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5.239 }}>
      <PxFigmaIcon name={icon} size={15.718} color={PX.neutral400} />
      <span style={{
        fontFamily: PX.font.display, fontSize: 10.48, fontWeight: 500,
        color: PX.neutral400, letterSpacing: '-0.3144px', lineHeight: 1.25,
      }}>{value}</span>
    </div>
  )
}

function InputPill({ placeholder }: { placeholder: string }) {
  return (
    <div style={{
      background: PX.neutral200, borderRadius: 283.298,
      paddingLeft: 12, paddingRight: 6, paddingTop: 6, paddingBottom: 6,
      display: 'flex', alignItems: 'center', minHeight: 22,
      boxSizing: 'border-box',
    }}>
      <span style={{
        fontFamily: PX.font.display, fontSize: 8, fontWeight: 400,
        color: PX.neutral500, lineHeight: 1.5,
      }}>{placeholder}</span>
    </div>
  )
}

function IpadHomeIndicator() {
  return (
    <div style={{
      position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
      width: 200, height: 3.5, borderRadius: 100, background: PX.neutral700,
    }} />
  )
}

function IpadDevice() {
  return (
    <div style={{
      position: 'relative',
      width: 851.64,
      height: 613.898,
    }}>
      {/* iPad screen content (under bezel) — bg #fafafb fills bezel cutout */}
      <div style={{
        position: 'absolute',
        // Inset Figma : 5.09% top / 3.56% right / 5.02% bottom / 3.67% left
        top: '5.09%', right: '3.56%', bottom: '5.02%', left: '3.67%',
        background: PX.neutral200,
        borderRadius: 18,
        overflow: 'hidden',
        zIndex: 1,
      }}>
        <IpadStatusBar />
        <IpadHeader />
        <IpadPhotoGrid />
        <IpadBottomSection />
        <IpadHomeIndicator />
      </div>
      {/* Bezel iPad Pro 11 Space Gray Landscape — PNG transparent au centre,
          posé AU-DESSUS de l'écran pour que le frame se voie. */}
      <img
        src="/images/sections/cta-ipad/ipad-bezel.png"
        alt="iPad Pro 11"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
    </div>
  )
}

// ─── PxExploreCTA root — CTA/V3 section ─────────────────────────────────────
// Section 1440×624 native Figma. Responsive scaling pour viewport < 1440 :
// la section entière scale uniformément, jamais clippée.
export default function PxExploreCTA() {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth
      setScale(Math.min(1, vw / 1440))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const scaledHeight = (80 + 624 + 200) * scale

  return (
    <section style={{
      background: PX.neutral100,
      overflow: 'hidden',
      width: '100%',
      height: scaledHeight,
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        width: 1440,
        marginLeft: -720,
        transformOrigin: 'top center',
        transform: `scale(${scale})`,
      }}>
        <div style={{ paddingTop: 80, paddingBottom: 200 }}>
          <div style={{
            position: 'relative',
            width: 1440,
            margin: '0 auto',
            height: 624,
          }}>
            {/* Container dark : Figma right-23.84 top-50% translateY -50% w-1394 */}
            <div style={{
              position: 'absolute',
              right: 23.84,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 1394,
              background: PX.neutral700,
              paddingLeft: 120,
              paddingRight: 120,
              paddingTop: 160,
              paddingBottom: 160,
              borderRadius: PX.radius.large,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'flex-start',
              boxSizing: 'border-box',
              zIndex: 1,
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}>
                <GetInTouchBadge />
                <h2 style={{
                  margin: 0, paddingTop: 16, width: 447,
                  fontFamily: PX.font.display, fontSize: 48, fontWeight: 500,
                  lineHeight: 1.25, letterSpacing: '-1.44px', color: PX.neutral100,
                }}>
                  Explore your dream home today
                </h2>
                <p style={{
                  margin: 0, paddingTop: 16, width: 480.098, height: 49.923,
                  fontFamily: PX.font.display, fontSize: 16, fontWeight: 400,
                  lineHeight: 1.5, letterSpacing: '-0.48px', color: PX.neutral400,
                }}>
                  Lorem ipsum dolor sit amet consectetur. Volutpat et lacinia sit
                  aenean consequat. Id tellus eget libero eget non odio tristique.
                </p>
                <div style={{ paddingTop: 24 }}>
                  <PxButton to="/acheter" variant="invert" size="sm">
                    Start exploring
                  </PxButton>
                </div>
              </div>
            </div>

            {/* iPad — Figma right-732.36 top-50%+64 translateY -50% */}
            <div style={{
              position: 'absolute',
              right: 732.36,
              top: 'calc(50% + 64px)',
              transform: 'translateY(-50%)',
              width: 851.64,
              height: 613.898,
              zIndex: 2,
            }}>
              <IpadDevice />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
