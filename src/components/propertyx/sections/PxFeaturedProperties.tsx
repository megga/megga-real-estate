// MEGGA Marketplace — Property X "Featured properties" section.
// Source : Figma node 11755:27864 — code Figma exact.
//
// Structure fidèle :
//   <section px-24 py-0>
//     <Container bg-neutral700 rounded-24 py-160 px-0 gap-32 flex-col>
//       <Top Content px-100 flex justify-between items-end>
//         <Left Content>
//           <Badge dark "Featured properties" (cercle icône bg-500 + texte blanc)>
//           <H2 48px white>
//           <Paragraph w-480 16/1.5 white>
//         </Left>
//         <Button Row gap-16>
//           <Circle button dark (chevron-left disabled)>
//           <Circle button white (chevron-right active, shadow small)>
//         </Button Row>
//       </Top Content>
//       <Row Cards h-440 w-1394 overflow-clip>
//         <Card 1 w-954 h-440 rounded-24>
//           <image + fade>
//           <Content p-32 flex-col justify-between>
//             <Top : Badge "For rent" dark + Plus circle button white-40>
//             <Bottom : Text wrapper w-380 (title 24, paragraph 16) + address>
//           </Content>
//         </Card 1>
//         <Card 2 w-221 h-440 opacity-30 (peek faded)>
//       </Row Cards>
//       <Buttons Row pt-24>
//         <PrimaryButton "Start exploring" WHITE bg + dark circle arrow>
//       </Buttons Row>
//     </Container>
//   </section>

import { Link } from 'react-router-dom'
import { PX, PxIcon, PxFigmaIcon, PxCircleButton } from '..'

interface FeaturedItem {
  id: string
  badge: string  // ex "À louer" / "À vendre"
  title: string
  description: string
  address: string
  image: string
}

const FEATURED: FeaturedItem[] = [
  {
    id: 'feat-1',
    badge: 'À louer',
    title: 'Loft contemporain à Carouge',
    description: 'Lumineux 120 m² avec finitions haut de gamme, terrasse plein sud et vue dégagée sur la vieille ville.',
    address: '12 rue de la Filature, 1227 Carouge',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1800&q=85',
  },
  {
    id: 'feat-2',
    badge: 'À vendre',
    title: 'Villa avec vue sur le lac, Cologny',
    description: '280 m² d\'exception avec piscine, jardin arboré et vue panoramique sur le Léman.',
    address: 'Route de la Capite, 1223 Cologny',
    image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1800&q=85',
  },
]

// Badge dark "Featured properties" — fidèle Figma 11755:27868 :
// bg neutral600, pl-6 pr-12 py-6, rounded-pill, contient cercle icône + texte
function FeaturedBadge({ label }: { icon?: 'star' | 'key'; label: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 6,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral600,  // #202127
      borderRadius: PX.radius.pill,
    }}>
      {/* Cercle icône bg-neutral500, size 26 — VRAIE icône Figma star V25 */}
      <span style={{
        width: 26,
        height: 26,
        borderRadius: PX.radius.pill,
        background: PX.neutral500,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        <PxFigmaIcon name="badge-featured-star" size={14.857} color={PX.neutral100} />
      </span>
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral100,
      }}>{label}</span>
    </span>
  )
}

// Badge "For rent" — fidèle Figma 11755:27884 :
// bg neutral700, px-12 py-6, contient icône clé + texte
function ForRentBadge({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral700,
      borderRadius: PX.radius.pill,
    }}>
      <PxFigmaIcon name="key" size={16} color={PX.neutral100} />
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral100,
      }}>{label}</span>
    </span>
  )
}

function FeaturedCard({ p, peek = false }: { p: FeaturedItem; peek?: boolean }) {
  if (peek) {
    // Card 2 : w-221, h-440, simple thumbnail (pas d'opacité, fidèle Figma 11755:27894)
    return (
      <div style={{
        width: 221,
        height: 440,
        flexShrink: 0,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        backgroundImage: `url("${p.image}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />
    )
  }

  // Card 1 (main) : w-954, h-440
  return (
    <div style={{
      position: 'relative',
      width: 954,
      height: 440,
      flexShrink: 0,
      borderRadius: PX.radius.large,
      overflow: 'hidden',
      backgroundImage: `url("${p.image}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      {/* Fade overlay sombre→transparent en bas */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.65) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Content : p-32, flex column justify-between, full height */}
      <div style={{
        position: 'absolute',
        inset: 0,
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
        {/* Top : Badge "For rent" + Plus circle button blanc */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <ForRentBadge label={p.badge} />
          {/* Primary Circle Button — Figma 40×40 (instance 11755:27885) */}
          <PxCircleButton size="lg" variant="light" ariaLabel="Ajouter à la sélection">
            <PxFigmaIcon name="plus" size={16} color={PX.neutral700} />
          </PxCircleButton>
        </div>

        {/* Bottom Content : gap-12 flex-col */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          {/* Text Wrapper : w-380, gap-8 flex-col */}
          <div style={{
            width: 380,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            {/* Title : Display/5/Medium = 24/1.25/-0.72/500 */}
            <h3 style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 24,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.72px',
              color: PX.neutral100,
            }}>{p.title}</h3>
            {/* Paragraph : Paragraph/Default/Regular = 16/1.5/-0.48/400, opacité 0.72
                pour soft white comme Figma (variable inkInverseSoft) */}
            <p style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.inkInverseSoft,
            }}>{p.description}</p>
          </div>

          {/* Address row : gap-8, icon + text */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <PxFigmaIcon name="location" size={20} color={PX.neutral100} />
            <span style={{
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral100,
            }}>{p.address}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PxFeaturedProperties() {
  return (
    <section style={{
      // Figma : px-24 py-0 — pas de padding vertical sur la section
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 0,
      paddingBottom: 0,
      background: PX.neutral100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Container : bg-neutral700 (dark), rounded-24, py-160 (Numbers/Sections/Large).
          maxWidth 1392 = container Figma exact (1440 viewport - 24px margin de chaque côté). */}
      <div style={{
        width: '100%',
        maxWidth: 1392,
        background: PX.neutral700,
        borderRadius: PX.radius.large,
        paddingTop: 160,
        paddingBottom: 160,
        paddingLeft: 0,
        paddingRight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}>
        {/* Top Content : px-100, flex items-end justify-between */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingLeft: 100,
          paddingRight: 100,
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}>
            <FeaturedBadge icon="star" label="Biens vedettes" />
            {/* Title : pt-16, Display/8/Medium 48/1.25/-1.44 */}
            <h2 style={{
              margin: 0,
              paddingTop: 16,
              fontFamily: PX.font.display,
              fontSize: 48,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-1.44px',
              color: PX.neutral100,
            }}>Biens vedettes</h2>
            {/* Paragraph : pt-16, w-480, 16/1.5/-0.48 white */}
            <p style={{
              margin: 0,
              paddingTop: 16,
              width: 480,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral100,
            }}>
              Une sélection curatée par notre équipe parmi les biens les plus
              remarquables de la semaine.
            </p>
          </div>

          {/* Button Row : gap-16 */}
          <div style={{
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start',
          }}>
            {/* Cercle dark (disabled state) */}
            <button aria-label="Précédent" style={{
              width: 48,
              height: 48,
              borderRadius: PX.radius.pill,
              border: 0,
              background: PX.neutral600,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}>
              <PxIcon name="chevron-left" size={16} color={PX.neutral100} />
            </button>
            {/* Cercle blanc (active) */}
            <button aria-label="Suivant" style={{
              width: 48,
              height: 48,
              borderRadius: PX.radius.pill,
              border: 0,
              background: PX.neutral100,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              boxShadow: PX.shadow.small,
            }}>
              <PxIcon name="chevron-right" size={16} color={PX.neutral700} />
            </button>
          </div>
        </div>

        {/* Row Cards : h-440, w-1394 (overflow le container), wrapper centré flex gap-24 */}
        <div style={{
          height: 440,
          overflow: 'hidden',
          width: '100%',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}>
            <FeaturedCard p={FEATURED[0]} />
            <FeaturedCard p={FEATURED[1]} peek />
          </div>
        </div>

        {/* Buttons Row bottom : pt-24, Link "Parcourir tous les biens" + chevron simple */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          paddingTop: 24,
        }}>
          <Link to="/acheter" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral100,
          }}>
            Parcourir tous les biens
            <PxIcon name="chevron-right" size={16} color={PX.neutral100} />
          </Link>
        </div>
      </div>
    </section>
  )
}
