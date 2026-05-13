// MEGGA Marketplace — Property X "How it works" section.
// Refactor avec PxSectionLabel + PxIcon.

import { useState } from 'react'
import { PX, PxSectionLabel, PxIcon } from '..'

const STEPS = [
  {
    title: 'Trouvez le bien qui vous correspond',
    body: 'Filtres avancés et carte interactive pour cibler le quartier, le type, le budget. Notre IA propose 3 suggestions chaque jour selon votre profil.',
  },
  {
    title: 'Planifiez une visite avec un agent',
    body: "Réservez en 2 clics. L'agent confirme dans la journée. Tous les agents MEGGA sont certifiés KYC — vous savez à qui vous parlez.",
  },
  {
    title: "Emménagez en moins d'un mois",
    body: 'Une fois votre choix fait, MEGGA orchestre le dossier de location ou la promesse de vente. Documents signés électroniquement, dépôt de garantie sécurisé.',
  },
]

export default function PxHowItWorks() {
  const [open, setOpen] = useState(0)

  return (
    <section style={{
      padding: `${PX.sectionDefault}px 40px`,
      background: PX.neutral100,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <PxSectionLabel icon="check">Notre processus</PxSectionLabel>
          <h2 style={{
            margin: '16px auto 0',
            maxWidth: 720,
            fontFamily: PX.font.display,
            fontSize: 'clamp(28px, 4vw, 48px)',
            lineHeight: 1.12,
            letterSpacing: '-1.4px',
            fontWeight: 500,
            color: PX.neutral700,
          }}>
            Trouvez le bien de vos rêves en 1, 2, 3
          </h2>
          <p style={{
            margin: '16px auto 0',
            maxWidth: 540,
            fontFamily: PX.font.sans,
            fontSize: 14,
            lineHeight: 1.5,
            letterSpacing: '-0.42px',
            color: PX.neutral500,
          }}>
            Un parcours simple et transparent, sans intermédiaire caché.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center' }}>
          {/* Accordion 3 étapes — titre "1." "2." "3." dans le texte */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {STEPS.map((s, i) => {
              const isOpen = open === i
              return (
                <button key={i} onClick={() => setOpen(i)} style={{
                  textAlign: 'left',
                  width: '100%',
                  padding: '24px 28px',
                  background: PX.neutral100,
                  borderRadius: PX.radius.large,
                  boxShadow: PX.shadow.small,
                  border: 0,
                  cursor: 'pointer',
                  transition: `box-shadow ${PX.duration.fast} ${PX.ease}`,
                  fontFamily: PX.font.sans,
                  color: PX.neutral700,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <h3 style={{
                      margin: 0,
                      fontFamily: PX.font.display,
                      fontSize: 18,
                      fontWeight: 500,
                      color: PX.neutral700,
                      letterSpacing: '-0.54px',
                      lineHeight: 1.25,
                    }}>
                      {i + 1}. {s.title}
                    </h3>
                    <span style={{ display: 'inline-flex' }}>
                      <PxIcon name={isOpen ? 'minus' : 'plus'} size={18} color={PX.neutral500} />
                    </span>
                  </div>
                  {isOpen && (
                    <p style={{
                      margin: '12px 0 0',
                      fontFamily: PX.font.sans,
                      fontSize: 14,
                      lineHeight: 1.5,
                      letterSpacing: '-0.42px',
                      color: PX.neutral500,
                    }}>{s.body}</p>
                  )}
                </button>
              )
            })}
          </div>

          {/* Image grande + popover de propriétés flottant en bas droite */}
          <div style={{
            position: 'relative',
            height: 480,
            borderRadius: PX.radius.large,
            overflow: 'visible',
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: PX.radius.large,
              overflow: 'hidden',
              backgroundImage: `url("https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }} />
            {/* Popover card "Vos suggestions" — fidèle Figma */}
            <div style={{
              position: 'absolute',
              right: -24,
              bottom: 32,
              width: 240,
              background: PX.neutral100,
              borderRadius: PX.radius.small,
              boxShadow: PX.shadow.large,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <span style={{
                fontFamily: PX.font.display,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '-0.36px',
                color: PX.neutral500,
                marginBottom: 2,
              }}>Vos suggestions</span>
              {[
                { img: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&q=80', name: 'Loft contemporain · Carouge' },
                { img: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=400&q=80', name: 'Villa lac · Cologny' },
              ].map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                }}>
                  <div style={{
                    width: 48, height: 48,
                    borderRadius: 8,
                    backgroundImage: `url("${item.img}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: PX.font.display,
                      fontSize: 12,
                      fontWeight: 500,
                      letterSpacing: '-0.36px',
                      color: PX.neutral700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>{item.name}</div>
                    <div style={{
                      marginTop: 2,
                      fontFamily: PX.font.sans,
                      fontSize: 10,
                      color: PX.neutral500,
                    }}>Match 92%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
