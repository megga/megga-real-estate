// MEGGA Pro — CTA final "Réservez votre démo".
// Pattern bento dark (PxContactHero) simplifié pour B2B.

import { useState } from 'react'
import { PX, PxButton, PxSectionLabel, PxAvatar, PxIcon, PxFigmaIcon } from '../..'
import { useProFadeIn } from './useProFadeIn'

function FormField({
  label,
  placeholder,
  type = 'text',
}: {
  label: string
  placeholder: string
  type?: string
}) {
  const [value, setValue] = useState('')
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{
        fontFamily: PX.font.sans,
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '-0.4px',
        color: PX.neutral500,
      }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        style={{
          height: 48,
          padding: '0 18px',
          background: PX.neutral200,
          borderRadius: PX.radius.pill,
          border: 'none',
          outline: 'none',
          fontFamily: PX.font.sans,
          fontSize: 15,
          fontWeight: 400,
          letterSpacing: '-0.45px',
          color: PX.neutral700,
        }}
      />
    </label>
  )
}

const BENEFITS: Array<{ icon: 'sparkle' | 'clock' | 'shield'; label: string }> = [
  { icon: 'sparkle', label: 'Démo personnalisée 25 min' },
  { icon: 'clock', label: 'Aucun engagement, aucune CB' },
  { icon: 'shield', label: 'Migration de vos données incluse' },
]

export default function PxProFinalCTA() {
  const labelRef = useProFadeIn<HTMLDivElement>(0)
  const titleRef = useProFadeIn<HTMLHeadingElement>(100)
  const subRef = useProFadeIn<HTMLParagraphElement>(180)
  const cardRef = useProFadeIn<HTMLDivElement>(260)

  return (
    <section
      id="demo"
      style={{
        paddingTop: 24,
        paddingBottom: 24,
        paddingLeft: 24,
        paddingRight: 24,
        background: PX.pageBg,
        scrollMarginTop: 24,
      }}
    >
      <div style={{
        background: PX.inkBg,
        borderRadius: PX.radius.large,
        paddingTop: 96,
        paddingBottom: 96,
        paddingLeft: 64,
        paddingRight: 64,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Texture */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
            opacity: 0.4,
            pointerEvents: 'none',
          }}
        />

        <div style={{
          position: 'relative',
          maxWidth: 1100,
          margin: '0 auto',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            marginBottom: 64,
            textAlign: 'center',
          }}>
            <div ref={labelRef}>
              <PxSectionLabel icon="send" invert>Réservez votre démo</PxSectionLabel>
            </div>
            <h2
              ref={titleRef}
              style={{
                margin: 0,
                fontFamily: PX.font.display,
                fontSize: 56,
                fontWeight: 500,
                lineHeight: 1.1,
                letterSpacing: '-2.5px',
                color: PX.inkInverse,
                maxWidth: 720,
              }}
            >
              25 minutes pour voir si MEGGA est fait pour vous.
            </h2>
            <p
              ref={subRef}
              style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontSize: 18,
                fontWeight: 400,
                lineHeight: 1.5,
                letterSpacing: '-0.54px',
                color: PX.inkInverseSoft,
                maxWidth: 580,
              }}
            >
              Vous nous parlez de votre quotidien, on vous montre comment MEGGA
              s'intègre — concret, pas commercial.
            </p>
          </div>

          {/* Bento card */}
          <div
            ref={cardRef}
            style={{
              background: PX.inkInverse,
              borderRadius: PX.radius.large,
              padding: 48,
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.7fr)',
              gap: 56,
              alignItems: 'stretch',
              boxShadow: PX.shadow.large,
            }}
          >
            {/* LEFT — Form */}
            <form
              onSubmit={e => e.preventDefault()}
              style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
            >
              <div style={{
                fontFamily: PX.font.display,
                fontSize: 24,
                fontWeight: 500,
                letterSpacing: '-0.72px',
                color: PX.neutral700,
                marginBottom: 8,
              }}>
                Vos coordonnées
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <FormField label="Prénom" placeholder="Jean" />
                <FormField label="Nom" placeholder="Lyonnet" />
              </div>
              <FormField label="Agence" placeholder="Lyonnet Immobilier" />
              <FormField label="Email professionnel" placeholder="jean@agence.ch" type="email" />
              <FormField label="Téléphone" placeholder="+41 22 123 45 67" type="tel" />

              <div style={{ marginTop: 12 }}>
                <PxButton variant="primary" size="lg" type="submit">
                  Réserver ma démo
                </PxButton>
              </div>

              <p style={{
                margin: 0,
                marginTop: 6,
                fontFamily: PX.font.sans,
                fontSize: 12,
                fontWeight: 400,
                lineHeight: 1.5,
                letterSpacing: '-0.36px',
                color: PX.neutral500,
              }}>
                Vos données restent en Suisse. RGPD/LPD conforme. Désinscription en 1 clic.
              </p>
            </form>

            {/* RIGHT — Agent + benefits */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 28,
              padding: 32,
              background: PX.neutral200,
              borderRadius: PX.radius.medium,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <PxAvatar size={48} src="https://i.pravatar.cc/120?img=68" alt="Gregory Lyonnet" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{
                    fontFamily: PX.font.display,
                    fontSize: 16,
                    fontWeight: 500,
                    letterSpacing: '-0.48px',
                    color: PX.neutral700,
                  }}>
                    Gregory Lyonnet
                  </span>
                  <span style={{
                    fontFamily: PX.font.sans,
                    fontSize: 13,
                    fontWeight: 400,
                    letterSpacing: '-0.39px',
                    color: PX.neutral500,
                  }}>
                    Vous accompagnera personnellement
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {BENEFITS.map(b => (
                  <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      width: 32,
                      height: 32,
                      borderRadius: PX.radius.pill,
                      background: PX.neutral700,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}>
                      <PxIcon name={b.icon} size={14} color={PX.neutral100} />
                    </span>
                    <span style={{
                      fontFamily: PX.font.sans,
                      fontSize: 14,
                      fontWeight: 500,
                      letterSpacing: '-0.42px',
                      color: PX.neutral700,
                    }}>
                      {b.label}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: 'auto',
                paddingTop: 20,
                borderTop: `1px solid ${PX.neutral300}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontFamily: PX.font.sans,
                  fontSize: 13,
                  fontWeight: 400,
                  letterSpacing: '-0.39px',
                  color: PX.neutral500,
                }}>
                  <PxFigmaIcon name="form-mail" size={14} color={PX.neutral500} />
                  contact@megga.ch
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontFamily: PX.font.sans,
                  fontSize: 13,
                  fontWeight: 400,
                  letterSpacing: '-0.39px',
                  color: PX.neutral500,
                }}>
                  <PxFigmaIcon name="form-phone" size={14} color={PX.neutral500} />
                  +41 22 000 00 00
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
