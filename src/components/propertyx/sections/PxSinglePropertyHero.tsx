// MEGGA Marketplace — Property X "Single Property — Hero gallery" section.
// Source : Figma node 9613:28969 — code Figma EXACT (5 photos, layout 1 large + 2x2 grid).
//
// Anatomie :
// - Container 1200px centered horizontally (page-x 120 sur 1440)
// - Image principale gauche : 594.7 × 435.4, radius 12
// - 4 thumbnails droites : 290.6 × 211.7 chacune, en grid 2×2, radius 12
// - Gap entre toutes les images : 12px

import { PX } from '..'

const heroImages = {
  main: '/images/sections/single-property/hero-1-living.jpg',
  bedroom: '/images/sections/single-property/hero-2-bedroom.jpg',
  kitchen: '/images/sections/single-property/hero-3-kitchen.jpg',
  bathroom: '/images/sections/single-property/hero-4-bathroom.jpg',
  lounge: '/images/sections/single-property/hero-5-lounge.jpg',
}

const tileStyle: React.CSSProperties = {
  borderRadius: PX.radius.small,
  objectFit: 'cover',
  display: 'block',
  width: '100%',
  height: '100%',
}

export default function PxSinglePropertyHero() {
  return (
    <section style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      background: PX.pageBg,
    }}>
      <div style={{
        width: 'min(1200px, calc(100% - 48px))',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 594.7fr) minmax(0, 593.2fr)',
        gap: 12,
        boxSizing: 'border-box',
      }}>
        {/* Main image — left */}
        <div style={{
          width: '100%',
          aspectRatio: '594.7 / 435.4',
          overflow: 'hidden',
          borderRadius: PX.radius.small,
        }}>
          <img src={heroImages.main} alt="Property main view" style={tileStyle} />
        </div>

        {/* 2×2 grid — right */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 12,
        }}>
          <div style={{ overflow: 'hidden', borderRadius: PX.radius.small }}>
            <img src={heroImages.bedroom} alt="Bedroom" style={tileStyle} />
          </div>
          <div style={{ overflow: 'hidden', borderRadius: PX.radius.small }}>
            <img src={heroImages.kitchen} alt="Kitchen" style={tileStyle} />
          </div>
          <div style={{ overflow: 'hidden', borderRadius: PX.radius.small }}>
            <img src={heroImages.bathroom} alt="Bathroom" style={tileStyle} />
          </div>
          <div style={{ overflow: 'hidden', borderRadius: PX.radius.small }}>
            <img src={heroImages.lounge} alt="Living room" style={tileStyle} />
          </div>
        </div>
      </div>
    </section>
  )
}
