// MEGGA Marketplace — Property X "1, 2, 3" how it works section.
// 2 colonnes : accordion 3 étapes à gauche, photo lifestyle à droite.

import { useState } from 'react'
import { PX } from '../tokens'
import PxSectionLabel from '../PxSectionLabel'

const STEPS = [
  {
    title: 'Trouvez le bien qui vous correspond',
    body: 'Utilisez nos filtres avancés et notre carte interactive pour cibler le quartier, le type, le budget. Notre IA propose 3 suggestions chaque jour selon votre profil.',
  },
  {
    title: 'Planifiez une visite avec un agent',
    body: 'Réservez en 2 clics. L\'agent confirme dans la journée. Tous les agents MEGGA sont certifiés KYC — vous savez à qui vous parlez.',
  },
  {
    title: 'Emménagez en moins d\'un mois',
    body: 'Une fois votre choix fait, MEGGA orchestre le dossier de location ou la promesse de vente. Documents signés électroniquement, dépôt de garantie sécurisé.',
  },
]

export default function PxHowItWorks() {
  const [open, setOpen] = useState(0)

  return (
    <section style={{
      padding: `${PX.space.section}px ${PX.space.pageX}px`,
      background: PX.pageBg,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <PxSectionLabel>Notre processus</PxSectionLabel>
          <h2 style={{
            margin: '16px auto 0',
            maxWidth: 720,
            fontFamily: PX.font.display,
            fontSize: 'clamp(28px, 4vw, 48px)',
            lineHeight: 1.12,
            letterSpacing: -0.8,
            fontWeight: 600,
            color: PX.ink,
          }}>
            Trouvez le bien de vos rêves en 1, 2, 3
          </h2>
          <p style={{
            margin: '16px auto 0',
            maxWidth: 540,
            fontSize: 14.5,
            lineHeight: 1.6,
            color: PX.inkSoft,
          }}>
            Un parcours simple et transparent, sans intermédiaire caché.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          {/* Accordion */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {STEPS.map((s, i) => {
              const isOpen = open === i
              return (
                <button key={i} onClick={() => setOpen(i)} style={{
                  textAlign: 'left',
                  width: '100%',
                  padding: '20px 22px',
                  background: PX.surfaceBg,
                  borderRadius: PX.radiusCard,
                  boxShadow: isOpen ? PX.shadow.card : PX.shadow.soft,
                  border: 0,
                  cursor: 'pointer',
                  transition: `box-shadow ${PX.duration.fast} ${PX.ease}`,
                  fontFamily: PX.font.sans,
                  color: PX.ink,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{
                        width: 28, height: 28,
                        borderRadius: 999,
                        background: isOpen ? PX.ink : 'rgba(10,10,10,0.05)',
                        color: isOpen ? PX.inkInverse : PX.ink,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 13,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}>{i + 1}</span>
                      <h3 style={{
                        margin: 0,
                        fontFamily: PX.font.display,
                        fontSize: 16,
                        fontWeight: 600,
                        color: PX.ink,
                        letterSpacing: -0.2,
                      }}>{s.title}</h3>
                    </div>
                    <span style={{
                      fontSize: 22,
                      color: PX.inkMuted,
                      transform: isOpen ? 'rotate(45deg)' : 'none',
                      transition: `transform ${PX.duration.fast} ${PX.ease}`,
                    }}>+</span>
                  </div>
                  {isOpen && (
                    <p style={{
                      margin: '12px 0 0 42px',
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      color: PX.inkSoft,
                    }}>{s.body}</p>
                  )}
                </button>
              )
            })}
          </div>

          {/* Photo lifestyle */}
          <div style={{
            position: 'relative',
            height: 480,
            borderRadius: PX.radiusImage,
            overflow: 'hidden',
            backgroundImage: `url("https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }} />
        </div>
      </div>
    </section>
  )
}
