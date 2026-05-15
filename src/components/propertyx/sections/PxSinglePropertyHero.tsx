// MEGGA Marketplace — Property X "Single Property — Hero gallery" section.
// Source : Figma node 9613:28969 — layout 1 large + 2x2 grid (5 photos).
//
// Accepte un prop `photos` (string[]) pour afficher les vraies photos du
// bien. Sans prop, fallback sur les images démo Figma pour la route demo
// `/propriete` (sans :id).

import { PX } from '..'

interface PxSinglePropertyHeroProps {
  photos?: string[]
  title?: string
}

const DEMO_IMAGES = [
  '/images/sections/single-property/hero-1-living.jpg',
  '/images/sections/single-property/hero-2-bedroom.jpg',
  '/images/sections/single-property/hero-3-kitchen.jpg',
  '/images/sections/single-property/hero-4-bathroom.jpg',
  '/images/sections/single-property/hero-5-lounge.jpg',
]

const tileStyle: React.CSSProperties = {
  borderRadius: PX.radius.small,
  objectFit: 'cover',
  display: 'block',
  width: '100%',
  height: '100%',
}

export default function PxSinglePropertyHero({ photos, title = 'Bien immobilier' }: PxSinglePropertyHeroProps) {
  // Si photos est fourni mais incomplet (< 5 photos), on complète avec la
  // première photo répétée — préserve le layout 1 + 4 sans laisser de
  // tiles vides.
  const sourceImages = photos && photos.length > 0
    ? Array.from({ length: 5 }, (_, i) => photos[i] ?? photos[0])
    : DEMO_IMAGES

  const [main, t1, t2, t3, t4] = sourceImages

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
        <div style={{
          width: '100%',
          aspectRatio: '594.7 / 435.4',
          overflow: 'hidden',
          borderRadius: PX.radius.small,
        }}>
          <img src={main} alt={title} style={tileStyle} />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 12,
        }}>
          <div style={{ overflow: 'hidden', borderRadius: PX.radius.small }}>
            <img src={t1} alt={`${title} — vue 2`} style={tileStyle} />
          </div>
          <div style={{ overflow: 'hidden', borderRadius: PX.radius.small }}>
            <img src={t2} alt={`${title} — vue 3`} style={tileStyle} />
          </div>
          <div style={{ overflow: 'hidden', borderRadius: PX.radius.small }}>
            <img src={t3} alt={`${title} — vue 4`} style={tileStyle} />
          </div>
          <div style={{ overflow: 'hidden', borderRadius: PX.radius.small }}>
            <img src={t4} alt={`${title} — vue 5`} style={tileStyle} />
          </div>
        </div>
      </div>
    </section>
  )
}
