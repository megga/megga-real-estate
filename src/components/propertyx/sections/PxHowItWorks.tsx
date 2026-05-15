// MEGGA Marketplace — Property X "Process Section" / How it works.
// Source : Figma node 11756:29023 — contenu EXACT du Figma (texte anglais).
//
// Structure : Top Content (badge + H2 + paragraphe) + Bottom Content avec
// Accordion (3 items, body affiché quand ouvert) à gauche + Right Element
// statique (image + popover search) à droite — fidèle au node Figma qui ne
// montre qu'un seul état du right element indépendamment de l'accordion.

import { useState } from 'react'
import { PX, PxIcon, PxFigmaIcon } from '..'

interface Step {
  title: string
  body: string
}

// Figma 11756:29033-29047 : 3 accordion items, body affiché uniquement quand ouvert.
// Le right element reste fixé sur la première étape "search" (Figma 11756:29053).
const STEPS: Step[] = [
  {
    title: '1. Search for your favorite  house in your location',
    body: 'Lorem ipsum dolor sit amet consectetur vitae purus quis metus sed semper diam iaculis duis vitae purus amet sagittis leo elit vitae dolor.',
  },
  {
    title: '2. Make a visit appointment with one of our agents',
    body: 'Lorem ipsum dolor sit amet consectetur vitae purus quis metus sed semper diam iaculis duis vitae purus amet sagittis leo elit vitae dolor.',
  },
  {
    title: '3. Get your dream house in a month, or less',
    body: 'Lorem ipsum dolor sit amet consectetur vitae purus quis metus sed semper diam iaculis duis vitae purus amet sagittis leo elit vitae dolor.',
  },
]

// Badge "Our process" — fidèle Figma 11756:29026
// bg-neutral300 (LIGHT), pl-6 pr-12 py-6, cercle bg-neutral400 size-26
function ProcessBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 6,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral300,
      borderRadius: PX.radius.pill,
    }}>
      <span style={{
        width: 26,
        height: 26,
        borderRadius: PX.radius.pill,
        background: PX.neutral400,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        <PxFigmaIcon name="badge-process-check" size={14.857} color={PX.neutral100} />
      </span>
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
      }}>Our process</span>
    </span>
  )
}

// Right element popover — Figma node 11756:29053.
// Carte blanche unique (316.133×349.748) contenant search bar + 2 property cards.
// Positionnée à left[295.48] top[172.4] dans le conteneur 611.609×522.151.
function RightPopover() {
  return (
    <div style={{
      position: 'absolute',
      left: 295.48,
      top: 172.4,
      width: 316.133,
      height: 349.748,
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      boxShadow: PX.shadow.small,
    }}>
      {/* Search bar pill "Choose your location" — Figma 11756:29061 */}
      {/* w-269, pl-14.487 pr-4.533 py-14.487 */}
      <div style={{
        position: 'absolute',
        left: 23.81,
        top: 23.81,
        width: 269,
        background: PX.neutral200,
        borderRadius: 113.33,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 14.487,
        paddingRight: 4.533,
        paddingTop: 14.487,
        paddingBottom: 14.487,
        boxSizing: 'border-box',
      }}>
        <span style={{
          fontFamily: '"Poppins", "Plus Jakarta Sans", sans-serif',
          fontSize: 10,
          fontWeight: 400,
          lineHeight: 1.5,
          color: PX.neutral500,
          width: 107,
        }}>Choose your location</span>
        <span style={{
          width: 22.216,
          height: 22.216,
          borderRadius: 57.946,
          background: PX.neutral700,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}>
          <PxFigmaIcon name="search" size={12.216} color={PX.neutral100} />
        </span>
      </div>

      {/* Property cards : Figma 11756:29069 (top 243.51 → offset 71.11 inside popover)
          and 11756:29085 (top 377.24 → offset 204.84 inside popover) */}
      <PopoverPropertyCard
        topOffset={71.11}
        image="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=85"
        title="Luxury Loft in San Francisco"
        address="2238 Stradella Rd, SF"
      />
      <PopoverPropertyCard
        topOffset={204.84}
        image="https://images.unsplash.com/photo-1613977257363-707ba9348227?w=600&q=85"
        title="Home in Los Angeles heart"
        address="2596 El Segundo, Los Angeles"
      />
    </div>
  )
}

function PopoverPropertyCard({
  topOffset,
  image,
  title,
  address,
}: {
  topOffset: number
  image: string
  title: string
  address: string
}) {
  return (
    <>
      {/* Image w-268.75 × h-80.798 (mask cuts to 80.798 from full 95.944) */}
      <div style={{
        position: 'absolute',
        left: 23.81,
        top: topOffset,
        width: 268.75,
        height: 80.798,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundImage: `url("${image}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        {/* Badge "For rent" — Figma 11756:29073 : pl-2.99 pr-4.485 py-2.242 */}
        <span style={{
          position: 'absolute',
          left: 5,
          top: 4.45,
          background: PX.neutral700,
          color: PX.neutral100,
          paddingLeft: 2.99,
          paddingRight: 4.485,
          paddingTop: 2.242,
          paddingBottom: 2.242,
          borderRadius: 17.938,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.495,
        }}>
          <PxFigmaIcon name="key" size={7.474} color={PX.neutral100} />
          <span style={{
            fontFamily: PX.font.display,
            fontSize: 7,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.21px',
            color: PX.neutral100,
          }}>For rent</span>
        </span>
      </div>
      {/* Title + address block — Figma 11756:29078 */}
      <div style={{
        position: 'absolute',
        left: 23.81,
        top: topOffset + 80.798 + 4.45,
        display: 'flex',
        flexDirection: 'column',
        gap: 3.239,
      }}>
        <div style={{
          width: 164.75,
          height: 14.75,
          fontFamily: PX.font.display,
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.36px',
          color: PX.neutral700,
        }}>{title}</div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3.239,
        }}>
          <PxFigmaIcon name="location" size={8.098} color={PX.neutral400} />
          <span style={{
            fontFamily: PX.font.display,
            fontSize: 8,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.24px',
            color: PX.neutral400,
          }}>{address}</span>
        </div>
      </div>
    </>
  )
}

export default function PxHowItWorks() {
  const [open, setOpen] = useState(0)

  return (
    <section style={{
      paddingTop: 80,
      paddingBottom: 160,
      paddingLeft: 24,
      paddingRight: 24,
      // Figma 11756:29023 = pas de fill (transparent / hérite du parent neutral100)
      background: PX.neutral100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Top Content centered */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <ProcessBadge />
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: 16,
          }}>
            <h2 style={{
              margin: 0,
              width: 546.25,
              maxWidth: '100%',
              fontFamily: PX.font.display,
              fontSize: 48,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-1.44px',
              color: PX.neutral700,
              textAlign: 'center',
            }}>
              Find your dream house as easy as 1, 2, 3
            </h2>
          </div>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: 16,
          paddingBottom: 32,
        }}>
          <p style={{
            margin: 0,
            width: 562.047,
            maxWidth: '100%',
            height: 48,
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral500,
            textAlign: 'center',
          }}>
            Lorem ipsum dolor sit amet consectetur. Sit ut gravida aenean potenti.
            Metus in eu vel morbi dui nunc tellus. Non a massa maecenas massa.
          </p>
        </div>
      </div>

      {/* Bottom Content : flex gap-51 items-center */}
      <div style={{
        display: 'flex',
        gap: 51,
        alignItems: 'center',
      }}>
        {/* Accordion Wrapper : 3 cards w-536.656 gap-16 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignItems: 'flex-start',
        }}>
          {STEPS.map((s, i) => {
            const isOpen = open === i
            return (
              <button
                key={i}
                onClick={() => setOpen(isOpen ? -1 : i)}
                style={{
                  width: 536.656,
                  height: isOpen ? 226.308 : 131.308,
                  padding: isOpen ? 39 : '36px 39px',
                  background: PX.neutral100,
                  borderRadius: PX.radius.large,
                  boxShadow: PX.shadow.small,
                  border: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  transition: `height ${PX.duration.fast} ${PX.ease}`,
                  boxSizing: 'border-box',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: isOpen ? 'flex-start' : 'center',
                  justifyContent: 'space-between',
                  gap: isOpen ? 83 : 87,
                  width: '100%',
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  }}>
                    <span style={{
                      width: isOpen ? 352.219 : 352.219,
                      fontFamily: PX.font.display,
                      fontSize: 24,
                      fontWeight: 500,
                      lineHeight: 1.25,
                      letterSpacing: '-0.72px',
                      color: PX.neutral700,
                      whiteSpace: isOpen ? 'pre-wrap' : 'normal',
                    }}>{s.title}</span>
                    {isOpen && (
                      <span style={{
                        paddingTop: 16,
                        width: 356.219,
                        height: 72,
                        fontFamily: PX.font.display,
                        fontSize: 16,
                        fontWeight: 400,
                        lineHeight: 1.5,
                        letterSpacing: '-0.48px',
                        color: PX.neutral500,
                      }}>{s.body}</span>
                    )}
                  </div>
                  <PxIcon name={isOpen ? 'minus' : 'plus'} size={20} color={PX.neutral700} />
                </div>
              </button>
            )
          })}
        </div>

        {/* Right Element : Figma 11756:29053 — w-611.609 h-522.151
            Image principale 514.828×433.495 à top-0 left-0,
            puis popover blanc 316.133×349.748 à left-295.48 top-172.4. */}
        <div style={{
          position: 'relative',
          width: 611.609,
          height: 522.151,
          flexShrink: 0,
        }}>
          {/* Image principale 514.828×433.495 — image step 1 fixe (Figma) */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 514.828,
            height: 433.495,
            borderRadius: PX.radius.large,
            overflow: 'hidden',
            backgroundImage: 'url("https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1400&q=85")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }} />

          {/* Popover search (carte blanche unique) */}
          <RightPopover />
        </div>
      </div>
    </section>
  )
}
