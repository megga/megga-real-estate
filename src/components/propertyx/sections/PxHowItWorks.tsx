// MEGGA Marketplace — Property X "Process Section" / How it works.
// Source : Figma node 11756:29023 — code Figma exact.
//
// Structure fidèle :
//   <section pt-80 pb-160 flex-col items-center>
//     <Top Content centered>
//       <Title Wrapper>
//         <Badge LIGHT bg-neutral300, pl-6 pr-12 py-6, cercle bg-neutral400 size-26 + texte dark>
//         <H2 48px w-546 centered>
//       </Title Wrapper>
//       <Paragraph pt-16 pb-32, w-562, 16/1.5 neutral500 centered>
//     </Top Content>
//     <Bottom Content flex gap-51 items-center>
//       <Accordion Wrapper flex-col gap-16>
//         <Accordion OPEN : bg-white h-226 p-39 rounded-24 shadow small w-536>
//           <Content : title 24 Display/5 + description 16/1.5 neutral500>
//           <Minus icon 20px>
//         </Accordion>
//         <Accordion CLOSED 2 : h-131 px-39 py-36>
//         <Accordion CLOSED 3 : h-131 px-39 py-36>
//       </Accordion Wrapper>
//       <Right Element 611×522>
//         <Image 514×433>
//         <Popover (295,172) 316×349 bg-white rounded-24>
//           <Search "Choose your location" pill bg-neutral200 + dark circle>
//           <Card 1 (image masked) + badge mini "For rent" + title 12 + address 8>
//           <Card 2 ...>
//         </Popover>
//       </Right Element>
//     </Bottom Content>
//   </section>

import { useState } from 'react'
import { PX, PxIcon, PxFigmaIcon } from '..'

const STEPS = [
  {
    title: '1. Trouvez le bien qui vous correspond',
    body: 'Filtres avancés et carte interactive pour cibler le quartier, le type, le budget. Notre IA propose 3 suggestions chaque jour selon votre profil.',
  },
  {
    title: '2. Planifiez une visite avec un agent',
    body: "Réservez en 2 clics. L'agent confirme dans la journée. Tous les agents MEGGA sont certifiés KYC — vous savez à qui vous parlez.",
  },
  {
    title: "3. Emménagez en moins d'un mois",
    body: 'Une fois votre choix fait, MEGGA orchestre le dossier de location ou la promesse de vente. Documents signés électroniquement, dépôt de garantie sécurisé.',
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
      }}>Notre processus</span>
    </span>
  )
}

// Popover mini-card "Luxury Loft" — utilisée dans le popover du Right Element
function PopoverMiniCard({ image, title, address }: { image: string; title: string; address: string }) {
  return (
    <div style={{
      width: '100%',
      borderRadius: 8,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* Image avec badge "For rent" mini en haut */}
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
          padding: '2px 6px',
          borderRadius: 18,
          fontSize: 7,
          fontWeight: 500,
          fontFamily: PX.font.display,
          letterSpacing: '-0.21px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
        }}>
          <PxFigmaIcon name="key" size={7} color={PX.neutral100} />
          À louer
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 4px' }}>
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

export default function PxHowItWorks() {
  const [open, setOpen] = useState(0)

  return (
    <section style={{
      paddingTop: 80,
      paddingBottom: 160,
      paddingLeft: 24,
      paddingRight: 24,
      // Section bg neutral200 (off-white) pour faire ressortir les bentos blancs
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
        {/* Title Wrapper */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <ProcessBadge />
          {/* Title : pt-16, 48 Display/8/Medium tracking -1.44, w-546 */}
          <h2 style={{
            margin: 0,
            paddingTop: 16,
            width: 546,
            maxWidth: '100%',
            fontFamily: PX.font.display,
            fontSize: 48,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-1.44px',
            color: PX.neutral700,
            textAlign: 'center',
          }}>
            Trouvez le bien de vos rêves en 1, 2, 3
          </h2>
        </div>
        {/* Paragraph : pt-16 pb-32, w-562, 16/1.5 neutral500 centered */}
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
          Un parcours simple et transparent en 3 étapes, avec un agent certifié
          à vos côtés du premier filtre jusqu'aux clés.
        </p>
      </div>

      {/* Bottom Content : flex gap-51 items-center */}
      <div style={{
        display: 'flex',
        gap: 51,
        alignItems: 'center',
      }}>
        {/* Accordion Wrapper : flex-col gap-16 */}
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
                  height: 'auto',
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
                    {/* Title : 24 Display/5/Medium tracking -0.72, w-356 */}
                    <span style={{
                      width: 356,
                      fontFamily: PX.font.display,
                      fontSize: 24,
                      fontWeight: 500,
                      lineHeight: 1.25,
                      letterSpacing: '-0.72px',
                      color: PX.neutral700,
                    }}>{s.title}</span>
                    {/* Description (only if open) : pt-16, 16/1.5/-0.48 neutral500 */}
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
                  {/* Plus/Minus icon 20px */}
                  <PxIcon name={isOpen ? 'minus' : 'plus'} size={20} color={PX.neutral700} />
                </div>
              </button>
            )
          })}
        </div>

        {/* Right Element 611×522 — image grande + popover */}
        <div style={{
          position: 'relative',
          width: 611,
          height: 522,
          flexShrink: 0,
        }}>
          {/* Image 514×433 en haut */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 514,
            height: 433,
            borderRadius: PX.radius.large,
            overflow: 'hidden',
            backgroundImage: `url("https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=85")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }} />

          {/* Popover (295, 172), 316×349, bg-white rounded-24 */}
          <div style={{
            position: 'absolute',
            left: 295,
            top: 172,
            width: 316,
            height: 349,
            background: PX.neutral100,
            borderRadius: PX.radius.large,
            boxShadow: PX.shadow.large,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            {/* Search bar pill "Choose your location" : bg-neutral200, rounded-pill */}
            <div style={{
              background: PX.neutral200,
              borderRadius: PX.radius.pill,
              paddingLeft: 14,
              paddingRight: 4,
              paddingTop: 6,
              paddingBottom: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 36,
            }}>
              <span style={{
                fontFamily: PX.font.display,
                fontSize: 10,
                fontWeight: 400,
                lineHeight: 1.5,
                color: PX.neutral500,
              }}>Choisir un lieu</span>
              <span style={{
                width: 22,
                height: 22,
                borderRadius: PX.radius.pill,
                background: PX.neutral700,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}>
                <PxIcon name="search" size={11} color={PX.neutral100} />
              </span>
            </div>

            {/* Card 1 : Luxury Loft */}
            <PopoverMiniCard
              image="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&q=80"
              title="Loft contemporain · Carouge"
              address="12 rue de la Filature"
            />

            {/* Card 2 : Home in Los Angeles heart */}
            <PopoverMiniCard
              image="https://images.unsplash.com/photo-1613977257363-707ba9348227?w=400&q=80"
              title="Villa lac · Cologny"
              address="Route de la Capite"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
