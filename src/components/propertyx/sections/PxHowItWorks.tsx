// MEGGA Marketplace — Property X "Process Section" / How it works.
// Source : Figma node 11756:29023 — contenu EXACT du Figma (texte anglais).
//
// Structure : 3 accordion items, chaque état change l'image + popover à droite.
// État 1 : couple laptop + popover "Choose your location" + 2 property cards
// État 2 : homme téléphone + popover Sophie Moore agent
// État 3 : couple souriant + popover "Congratulations" + bouton "Go back home"

import { useState } from 'react'
import { PX, PxIcon, PxFigmaIcon } from '..'

type StepVariant = 'search' | 'agent' | 'success'

interface Step {
  title: string
  body: string
  image: string
  variant: StepVariant
}

const STEPS: Step[] = [
  {
    title: '1. Search for your favorite house in your location',
    body: 'Lorem ipsum dolor sit amet consectetur vitae purus quis metus sed semper diam iaculis duis vitae purus amet sagittis leo elit vitae dolor.',
    image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1400&q=85',
    variant: 'search',
  },
  {
    title: '2. Make a visit appointment with one of our agents',
    body: 'Lorem ipsum dolor sit amet consectetur vitae purus quis metus sed semper diam iaculis duis vitae purus amet sagittis leo elit vitae dolor.',
    image: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=1400&q=85',
    variant: 'agent',
  },
  {
    title: '3. Get your dream house in a month, or less',
    body: 'Lorem ipsum dolor sit amet consectetur vitae purus quis metus sed semper diam iaculis duis vitae purus amet sagittis leo elit vitae dolor.',
    image: 'https://images.unsplash.com/photo-1573497019418-b400bb3ab074?w=1400&q=85',
    variant: 'success',
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

// Popover Search (état 1) — search bar + 2 property cards
function SearchPopover() {
  return (
    <div style={{
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      boxShadow: PX.shadow.large,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Search bar pill "Choose your location" */}
      <div style={{
        background: PX.neutral200,
        borderRadius: PX.radius.pill,
        paddingLeft: 14,
        paddingRight: 5,
        paddingTop: 5,
        paddingBottom: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: PX.font.sans,
          fontSize: 10,
          fontWeight: 400,
          color: PX.neutral500,
        }}>Choose your location</span>
        <span style={{
          width: 26,
          height: 26,
          borderRadius: PX.radius.pill,
          background: PX.neutral700,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}>
          <PxFigmaIcon name="search" size={12} color={PX.neutral100} />
        </span>
      </div>

      <PopoverPropertyCard
        image="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=85"
        title="Luxury Loft in San Francisco"
        address="2238 Stradella Rd, SF"
      />
      <PopoverPropertyCard
        image="https://images.unsplash.com/photo-1613977257363-707ba9348227?w=600&q=85"
        title="Home in Los Angeles heart"
        address="2596 El Segundo, Los Angeles"
      />
    </div>
  )
}

function PopoverPropertyCard({ image, title, address }: { image: string; title: string; address: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Image avec badge "For rent" */}
      <div style={{
        height: 80,
        borderRadius: 8,
        backgroundImage: `url("${image}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
      }}>
        <span style={{
          position: 'absolute',
          top: 5,
          left: 5,
          background: PX.neutral700,
          color: PX.neutral100,
          paddingLeft: 4,
          paddingRight: 6,
          paddingTop: 2,
          paddingBottom: 2,
          borderRadius: 18,
          fontSize: 7,
          fontWeight: 500,
          fontFamily: PX.font.display,
          letterSpacing: '-0.21px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
        }}>
          <PxFigmaIcon name="key" size={7} color={PX.neutral100} />
          For rent
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{
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
          gap: 3,
          fontFamily: PX.font.display,
          fontSize: 8,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.24px',
          color: PX.neutral400,
        }}>
          <PxFigmaIcon name="location" size={8} color={PX.neutral400} />
          {address}
        </div>
      </div>
    </div>
  )
}

// Popover Agent (état 2) — Sophie Moore profile pill
function AgentPopover() {
  return (
    <div style={{
      background: PX.neutral100,
      borderRadius: PX.radius.pill,
      boxShadow: PX.shadow.large,
      padding: 8,
      paddingRight: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      maxWidth: 280,
    }}>
      <img
        src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=85"
        alt="Sophie Moore"
        style={{
          width: 44,
          height: 44,
          borderRadius: PX.radius.pill,
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: '-0.36px',
        color: PX.neutral700,
      }}>
        Hello I'm Sophie Moore! From Casa X, how can I help you?
      </span>
    </div>
  )
}

// Popover Success (état 3) — Congratulations + Go back home
function SuccessPopover() {
  return (
    <div style={{
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      boxShadow: PX.shadow.large,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 14,
      width: 240,
    }}>
      <span style={{
        width: 44,
        height: 44,
        borderRadius: PX.radius.pill,
        background: PX.neutral700,
        display: 'grid',
        placeItems: 'center',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M5 12l5 5L20 7" stroke={PX.neutral100} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{
          fontFamily: PX.font.display,
          fontSize: 18,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.54px',
          color: PX.neutral700,
        }}>Congratulations</div>
        <div style={{
          fontFamily: PX.font.display,
          fontSize: 13,
          fontWeight: 400,
          lineHeight: 1.4,
          letterSpacing: '-0.39px',
          color: PX.neutral500,
          textAlign: 'center',
        }}>
          Your property has been purchased successfully
        </div>
      </div>
      <button type="button" style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 16,
        paddingRight: 6,
        paddingTop: 6,
        paddingBottom: 6,
        background: PX.neutral700,
        color: PX.neutral100,
        border: 0,
        borderRadius: PX.radius.pill,
        fontFamily: PX.font.display,
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '-0.39px',
        cursor: 'pointer',
      }}>
        Go back home
        <span style={{
          width: 22,
          height: 22,
          borderRadius: PX.radius.pill,
          background: PX.neutral100,
          display: 'grid',
          placeItems: 'center',
        }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6h7M6.5 2.5L10 6l-3.5 3.5"
              stroke={PX.neutral700} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
    </div>
  )
}

function RightPopover({ variant }: { variant: StepVariant }) {
  // Position du popover : overlap sur l'image en bas-droite
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    right: 0,
  }
  if (variant === 'search') return <div style={{ ...baseStyle, top: 100, width: 280 }}><SearchPopover /></div>
  if (variant === 'agent') return <div style={{ ...baseStyle, left: 0, right: 'auto', top: 80 }}><AgentPopover /></div>
  return <div style={{ ...baseStyle, bottom: 30 }}><SuccessPopover /></div>
}

export default function PxHowItWorks() {
  const [open, setOpen] = useState(0)
  const activeStep = STEPS[open] ?? STEPS[0]

  return (
    <section style={{
      paddingTop: 80,
      paddingBottom: 160,
      paddingLeft: 24,
      paddingRight: 24,
      // Fond gris off-white pour faire ressortir les bentos blancs
      background: PX.neutral200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Top Content centered */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <ProcessBadge />
          <h2 style={{
            margin: 0,
            paddingTop: 16,
            width: 546,
            maxWidth: '100%',
            fontFamily: PX.font.display,
            fontSize: 48,
            fontWeight: 800,
            lineHeight: 1.25,
            letterSpacing: '-1.44px',
            color: PX.neutral700,
            textAlign: 'center',
          }}>
            Find your dream house as easy as 1, 2, 3
          </h2>
        </div>
        <p style={{
          margin: 0,
          paddingTop: 16,
          paddingBottom: 32,
          width: 562,
          maxWidth: '100%',
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

      {/* Bottom Content : flex gap-51 items-center */}
      <div style={{
        display: 'flex',
        gap: 51,
        alignItems: 'center',
      }}>
        {/* Accordion Wrapper */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {STEPS.map((s, i) => {
            const isOpen = open === i
            return (
              <button
                key={i}
                onClick={() => setOpen(isOpen ? -1 : i)}
                style={{
                  width: 536,
                  minHeight: isOpen ? 226 : 131,
                  padding: isOpen ? 39 : '36px 39px',
                  background: PX.neutral100,
                  borderRadius: PX.radius.large,
                  boxShadow: PX.shadow.small,
                  border: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: `min-height ${PX.duration.fast} ${PX.ease}`,
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 83,
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  }}>
                    <span style={{
                      width: 356,
                      fontFamily: PX.font.display,
                      fontSize: 24,
                      fontWeight: 800,
                      lineHeight: 1.25,
                      letterSpacing: '-0.72px',
                      color: PX.neutral700,
                    }}>{s.title}</span>
                    {isOpen && (
                      <span style={{
                        paddingTop: 16,
                        width: 356,
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

        {/* Right Element : image + popover, dynamique selon activeStep */}
        <div style={{
          position: 'relative',
          width: 611,
          height: 522,
          flexShrink: 0,
        }}>
          {/* Image principale 514×433 — change selon step.
              Pour 'agent' on décale l'image à droite pour laisser place au popover. */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: activeStep.variant === 'agent' ? 97 : 0,
            width: 514,
            height: 433,
            borderRadius: PX.radius.large,
            overflow: 'hidden',
            backgroundImage: `url("${activeStep.image}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transition: `background-image ${PX.duration.base} ${PX.ease}, left ${PX.duration.base} ${PX.ease}`,
          }} />

          {/* Popover dynamique selon variant */}
          <RightPopover variant={activeStep.variant} />
        </div>
      </div>
    </section>
  )
}
