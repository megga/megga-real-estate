// MEGGA Pro — CTA final self-serve.
// Différenciateur : MEGGA n'a PAS de "demo gatekeeping". Le CRM EST la démo.
// L'agent crée son compte → entre dans l'app → essaie librement.

import { PX, PxButton, PxIconFont } from '../..'
import type { PxIconFontName } from '../..'
import { useProFadeIn } from './useProFadeIn'
import PxProBadge from './PxProBadge'

const TRUST_SIGNALS: Array<{ icon: PxIconFontName; label: string; sub: string }> = [
  {
    icon: 'clock',
    label: '60 secondes',
    sub: 'pour créer votre compte',
  },
  {
    icon: 'credit-card',
    label: 'Sans carte bancaire',
    sub: 'aucune information de paiement requise',
  },
  {
    icon: 'eye',
    label: 'Aucune démo à programmer',
    sub: "vous explorez le CRM directement, à votre rythme",
  },
]

export default function PxProFinalCTA() {
  const labelRef = useProFadeIn<HTMLDivElement>(0)
  const titleRef = useProFadeIn<HTMLHeadingElement>(100)
  const subRef = useProFadeIn<HTMLParagraphElement>(180)
  const ctaRef = useProFadeIn<HTMLDivElement>(260)
  const trustRef = useProFadeIn<HTMLDivElement>(360)

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
        paddingTop: 120,
        paddingBottom: 120,
        paddingLeft: 64,
        paddingRight: 64,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'relative',
          maxWidth: 920,
          margin: '0 auto',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <div ref={labelRef}>
            <PxProBadge icon="badge-megaphone" invert>Notre CRM est la démo</PxProBadge>
          </div>

          <h2
            ref={titleRef}
            style={{
              margin: 0,
              marginTop: 28,
              fontFamily: PX.font.display,
              fontSize: 72,
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: '-3px',
              color: PX.inkInverse,
              maxWidth: 880,
            }}
          >
            Créez votre compte. Explorez librement.
          </h2>

          <p
            ref={subRef}
            style={{
              margin: 0,
              marginTop: 28,
              fontFamily: PX.font.sans,
              fontSize: 20,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.6px',
              color: PX.inkInverseSoft,
              maxWidth: 640,
            }}
          >
            Pendant que nos concurrents vous demandent de réserver un appel commercial,
            chez MEGGA vous entrez dans le CRM tout de suite. Sans engagement, sans CB,
            sans présentation à subir.
          </p>

          <div
            ref={ctaRef}
            style={{
              marginTop: 44,
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PxButton variant="invert" size="lg" to="/register">
              Créer mon compte gratuit
            </PxButton>
            <PxButton variant="ghost" size="lg" to="/login" showIcon={false}>
              <span style={{ color: PX.inkInverse }}>J'ai déjà un compte</span>
            </PxButton>
          </div>

          {/* Trust signals — 3 colonnes */}
          <div
            ref={trustRef}
            style={{
              marginTop: 80,
              width: '100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 24,
              paddingTop: 48,
              borderTop: `1px solid rgba(255,255,255,0.10)`,
            }}
          >
            {TRUST_SIGNALS.map(t => (
              <div
                key={t.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: 14,
                  padding: '0 12px',
                }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: PX.radius.pill,
                  background: 'rgba(255,255,255,0.08)',
                  border: `1px solid rgba(255,255,255,0.12)`,
                  display: 'grid',
                  placeItems: 'center',
                }}>
                  <PxIconFont name={t.icon} size={20} color={PX.inkInverse} />
                </div>
                <div>
                  <div style={{
                    fontFamily: PX.font.display,
                    fontSize: 18,
                    fontWeight: 500,
                    letterSpacing: '-0.54px',
                    color: PX.inkInverse,
                    lineHeight: 1.25,
                  }}>
                    {t.label}
                  </div>
                  <div style={{
                    marginTop: 6,
                    fontFamily: PX.font.sans,
                    fontSize: 14,
                    fontWeight: 400,
                    letterSpacing: '-0.42px',
                    color: PX.inkInverseMuted,
                    lineHeight: 1.5,
                  }}>
                    {t.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
