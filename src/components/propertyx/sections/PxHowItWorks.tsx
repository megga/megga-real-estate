// MEGGA Marketplace — Property X "Process Section" / How it works.
// Source : Figma node 11756:29023 — contenu EXACT du Figma (texte anglais).
//
// Structure : Top Content (badge + H2 + paragraphe) + Bottom Content avec
// Accordion (3 items, body affiché quand ouvert) à gauche + Right Element
// dynamique (image + popover) à droite. L'image et le popover changent selon
// l'étape active de l'accordion ; le popover garde la même position pour les
// 3 étapes (left 295.48, top 172.4), seul son contenu varie.

import { useState } from 'react'
import { PX, PxIcon, PxFigmaIcon } from '..'

type PopoverKind = 'search' | 'chat' | 'congrats'

interface Step {
  title: string
  body: string
  image: string
  popover: PopoverKind
}

// Position commune des 3 popovers — Figma step 1 (11756:29053).
const POPOVER_LEFT = 295.48
const POPOVER_TOP = 172.4

// Figma 11756:29033-29047 : 3 accordion items, body affiché uniquement quand ouvert.
const STEPS: Step[] = [
  {
    title: '1. Search for your favorite  house in your location',
    body: 'Lorem ipsum dolor sit amet consectetur vitae purus quis metus sed semper diam iaculis duis vitae purus amet sagittis leo elit vitae dolor.',
    image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1400&q=85',
    popover: 'search',
  },
  {
    title: '2. Prenez rendez-vous avec l’agence du bien',
    body: 'Lorem ipsum dolor sit amet consectetur vitae purus quis metus sed semper diam iaculis duis vitae purus amet sagittis leo elit vitae dolor.',
    image: 'https://images.unsplash.com/photo-1499996860823-5214fcc65f8f?w=1400&q=85&sat=-100',
    popover: 'chat',
  },
  {
    title: '3. Get your dream house in a month, or less',
    body: 'Lorem ipsum dolor sit amet consectetur vitae purus quis metus sed semper diam iaculis duis vitae purus amet sagittis leo elit vitae dolor.',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1400&q=85',
    popover: 'congrats',
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

// Step 1 popover — search bar + 2 property cards (Figma 11756:29053).
// 316.133 × 349.748.
function SearchPopover() {
  return (
    <div style={{
      position: 'absolute',
      left: POPOVER_LEFT,
      top: POPOVER_TOP,
      width: 316.133,
      height: 349.748,
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      boxShadow: PX.shadow.small,
    }}>
      {/* Search bar pill "Choose your location" — Figma 11756:29061 */}
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

      {/* Property cards : Figma 11756:29069 / 11756:29085 */}
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

// Step 2 popover — chat bubble Sophie Moore (Figma reference).
// Pilule blanche avec avatar + message.
function ChatPopover() {
  return (
    <div style={{
      position: 'absolute',
      left: POPOVER_LEFT,
      top: POPOVER_TOP,
      width: 316.133,
      background: PX.neutral100,
      borderRadius: PX.radius.pill,
      boxShadow: PX.shadow.small,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      paddingLeft: 12,
      paddingRight: 20,
      paddingTop: 12,
      paddingBottom: 12,
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: 44,
        height: 44,
        borderRadius: PX.radius.pill,
        overflow: 'hidden',
        backgroundImage: 'url("/images/avatars/sophie-moore.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        flexShrink: 0,
      }} />
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.3,
        letterSpacing: '-0.42px',
        color: PX.neutral700,
      }}>
        Hello I'm Sophie Moore! From Casa X, how can I help you?
      </span>
    </div>
  )
}

// Step 3 popover — congrats card (Figma reference).
// Carte blanche centrée verticalement avec check + titre + sous-titre + bouton.
function CongratsPopover() {
  return (
    <div style={{
      position: 'absolute',
      left: POPOVER_LEFT,
      top: POPOVER_TOP,
      width: 316.133,
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      boxShadow: PX.shadow.small,
      padding: 32,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      boxSizing: 'border-box',
    }}>
      <span style={{
        width: 56,
        height: 56,
        borderRadius: PX.radius.pill,
        background: PX.neutral700,
        display: 'grid',
        placeItems: 'center',
      }}>
        <PxFigmaIcon name="check" size={24} color={PX.neutral100} />
      </span>
      <div style={{
        fontFamily: PX.font.display,
        fontSize: 24,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.72px',
        color: PX.neutral700,
        textAlign: 'center',
      }}>Congratulations</div>
      <p style={{
        margin: 0,
        fontFamily: PX.font.display,
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: '-0.42px',
        color: PX.neutral500,
        textAlign: 'center',
      }}>
        Your property has been purchased successfully
      </p>
      <button
        type="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          paddingLeft: 20,
          paddingRight: 6,
          paddingTop: 6,
          paddingBottom: 6,
          background: PX.neutral700,
          color: PX.neutral100,
          border: 0,
          borderRadius: PX.radius.pill,
          cursor: 'pointer',
          fontFamily: PX.font.display,
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: '-0.42px',
          marginTop: 4,
        }}
      >
        Go back home
        <span style={{
          width: 28,
          height: 28,
          borderRadius: PX.radius.pill,
          background: PX.neutral100,
          display: 'grid',
          placeItems: 'center',
        }}>
          <PxFigmaIcon name="arrow-right" size={14} color={PX.neutral700} />
        </span>
      </button>
    </div>
  )
}

function StepPopover({ kind }: { kind: PopoverKind }) {
  if (kind === 'chat') return <ChatPopover />
  if (kind === 'congrats') return <CongratsPopover />
  return <SearchPopover />
}

export default function PxHowItWorks() {
  const [open, setOpen] = useState(0)
  // Quand l'accordion est fermé (open === -1) on retombe sur l'étape 1.
  const active = STEPS[open >= 0 ? open : 0]

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

        {/* Right Element : w-611.609 h-522.151. L'image et le popover
            changent selon l'étape active (active = STEPS[open >= 0 ? open : 0]).
            Le popover garde toujours la même position d'ancrage. */}
        <div style={{
          position: 'relative',
          width: 611.609,
          height: 522.151,
          flexShrink: 0,
        }}>
          {/* Image principale 514.828×433.495 */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 514.828,
            height: 433.495,
            borderRadius: PX.radius.large,
            overflow: 'hidden',
            backgroundImage: `url("${active.image}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transition: `background-image ${PX.duration.fast} ${PX.ease}`,
          }} />

          {/* Popover dynamique selon l'étape, position fixe */}
          <StepPopover kind={active.popover} />
        </div>
      </div>
    </section>
  )
}
