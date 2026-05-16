// MEGGA Pro — Trust logos bar.
// Crédibilité tech : ce que MEGGA utilise sous le capot.
// Pattern : eyebrow + h3 + row de 6 partenaires (logos SVG quand dispo,
// wordmark Objectivity sinon), tous en monochrome neutral500 pour rester
// dans la DA Property X.

import { PX } from '../..'
import { useProFadeIn } from './useProFadeIn'
import { useBreakpoint, isMobile, isDesktop } from './useBreakpoint'
import PxProBadge from './PxProBadge'

// ─── Logos en SVG inline (monochrome, currentColor) ──────────────────

function AnthropicLogo({ size = 28 }: { size?: number }) {
  // Wordmark Anthropic + symbol — simplifié monochrome
  return (
    <svg
      width={size * 4.6}
      height={size}
      viewBox="0 0 220 48"
      fill="currentColor"
      aria-label="Anthropic"
    >
      {/* "A" mark + wordmark */}
      <path d="M30 8 L42 40 L36 40 L33 32 L19 32 L16 40 L10 40 L22 8 Z M21 26 L31 26 L26 13 Z" />
      <text
        x="54"
        y="34"
        fontFamily='"Objectivity", "Plus Jakarta Sans", sans-serif'
        fontSize="20"
        fontWeight="600"
        letterSpacing="-0.6"
        fill="currentColor"
      >
        Anthropic
      </text>
    </svg>
  )
}

function SupabaseLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size * 4.8}
      height={size}
      viewBox="0 0 230 48"
      fill="currentColor"
      aria-label="Supabase"
    >
      {/* Triangle "S" symbol simplifié */}
      <path d="M22 6 L22 26 L36 26 L18 42 L18 22 L4 22 Z" />
      <text
        x="48"
        y="34"
        fontFamily='"Objectivity", "Plus Jakarta Sans", sans-serif'
        fontSize="20"
        fontWeight="600"
        letterSpacing="-0.6"
        fill="currentColor"
      >
        Supabase
      </text>
    </svg>
  )
}

function ResendLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size * 4.2}
      height={size}
      viewBox="0 0 200 48"
      fill="currentColor"
      aria-label="Resend"
    >
      {/* "R" mark */}
      <path d="M8 8 L8 40 L14 40 L14 28 L20 28 L26 40 L33 40 L26 26 C30 24 32 21 32 17 C32 12 28 8 22 8 Z M14 14 L22 14 C24 14 26 15 26 17 C26 19 24 22 22 22 L14 22 Z" />
      <text
        x="40"
        y="34"
        fontFamily='"Objectivity", "Plus Jakarta Sans", sans-serif'
        fontSize="20"
        fontWeight="600"
        letterSpacing="-0.6"
        fill="currentColor"
      >
        Resend
      </text>
    </svg>
  )
}

function DilisenseLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size * 5.2}
      height={size}
      viewBox="0 0 250 48"
      fill="currentColor"
      aria-label="dilisense"
    >
      {/* Shield mark */}
      <path d="M22 6 L8 11 V 24 C 8 32 14 38 22 42 C 30 38 36 32 36 24 V 11 Z M22 12 L31 15 V 24 C 31 30 27 34 22 36 C 17 34 13 30 13 24 V 15 Z" />
      <text
        x="44"
        y="34"
        fontFamily='"Objectivity", "Plus Jakarta Sans", sans-serif'
        fontSize="20"
        fontWeight="600"
        letterSpacing="-0.6"
        fill="currentColor"
      >
        dilisense
      </text>
    </svg>
  )
}

function CloudflareLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size * 5}
      height={size}
      viewBox="0 0 240 48"
      fill="currentColor"
      aria-label="Cloudflare"
    >
      {/* Cloud shape */}
      <path d="M30 32 L40 32 C 42 32 44 30 44 28 C 44 26 42 24 40 24 C 39 18 33 14 27 16 C 24 17 22 19 20 22 C 14 22 8 26 8 32 C 8 36 10 38 14 38 L34 38 C 32 36 31 34 30 32 Z" />
      <text
        x="52"
        y="34"
        fontFamily='"Objectivity", "Plus Jakarta Sans", sans-serif'
        fontSize="20"
        fontWeight="600"
        letterSpacing="-0.6"
        fill="currentColor"
      >
        Cloudflare
      </text>
    </svg>
  )
}

// Stripe : utilise le vrai SVG local mais en monochrome via filter.
function StripeLogo({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/stripe-logo.svg"
      alt="Stripe"
      style={{
        height: size,
        width: 'auto',
        display: 'block',
        filter: 'grayscale(1) brightness(0.55)',
      }}
    />
  )
}

interface Partner {
  name: string
  Logo: React.FC<{ size?: number }>
  caption: string
}

const PARTNERS: Partner[] = [
  { name: 'Anthropic', Logo: AnthropicLogo, caption: 'IA Claude Sonnet 4' },
  { name: 'Supabase', Logo: SupabaseLogo, caption: 'Base de données' },
  { name: 'Stripe', Logo: StripeLogo, caption: 'Paiements' },
  { name: 'dilisense', Logo: DilisenseLogo, caption: 'KYC · PEP · LBA' },
  { name: 'Resend', Logo: ResendLogo, caption: 'Emails transactionnels' },
  { name: 'Cloudflare', Logo: CloudflareLogo, caption: 'Hébergement & CDN' },
]

function PartnerCell({ partner, mobile }: { partner: Partner; mobile: boolean }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      padding: '8px 4px',
      minWidth: 0,
      flex: 1,
    }}>
      <div style={{
        height: mobile ? 24 : 28,
        display: 'flex',
        alignItems: 'center',
        color: PX.neutral500,
      }}>
        <partner.Logo size={mobile ? 24 : 28} />
      </div>
      <div style={{
        fontFamily: PX.font.sans,
        fontSize: mobile ? 11 : 12,
        fontWeight: 400,
        letterSpacing: '-0.36px',
        color: PX.neutral400,
        textAlign: 'center',
        lineHeight: 1.3,
      }}>
        {partner.caption}
      </div>
    </div>
  )
}

export default function PxProTrustLogos() {
  const bp = useBreakpoint()
  const mobile = isMobile(bp)
  const desktop = isDesktop(bp)

  const labelRef = useProFadeIn<HTMLDivElement>(0)
  const titleRef = useProFadeIn<HTMLHeadingElement>(100)
  const rowRef = useProFadeIn<HTMLDivElement>(200)

  return (
    <section style={{
      paddingTop: mobile ? 48 : 80,
      paddingBottom: mobile ? 48 : 80,
      paddingLeft: mobile ? 16 : 24,
      paddingRight: mobile ? 16 : 24,
      background: PX.pageBg,
    }}>
      <div style={{
        maxWidth: 1280,
        margin: '0 auto',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: mobile ? 16 : 20,
          marginBottom: mobile ? 32 : 48,
          textAlign: 'center',
        }}>
          <div ref={labelRef}>
            <PxProBadge icon="badge-process-check">Stack technique</PxProBadge>
          </div>
          <h3
            ref={titleRef}
            style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: mobile ? 22 : 30,
              fontWeight: 500,
              lineHeight: 1.3,
              letterSpacing: mobile ? '-0.66px' : '-0.9px',
              color: PX.neutral700,
              maxWidth: 720,
            }}
          >
            Pas de bricolage. Que des géants.
          </h3>
          <p style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontSize: mobile ? 14 : 15,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: '-0.45px',
            color: PX.neutral500,
            maxWidth: 562,
          }}>
            Vos données et paiements traités avec les standards les plus stricts du marché.
          </p>
        </div>

        {/* Row of partners — wrap sur mobile, evenly distributed sur desktop */}
        <div
          ref={rowRef}
          style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr 1fr' : desktop ? 'repeat(6, 1fr)' : 'repeat(3, 1fr)',
            gap: mobile ? 24 : 16,
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 24,
            paddingBottom: 24,
            borderTop: `1px solid ${PX.neutral300}`,
            borderBottom: `1px solid ${PX.neutral300}`,
          }}
        >
          {PARTNERS.map(partner => (
            <PartnerCell key={partner.name} partner={partner} mobile={mobile} />
          ))}
        </div>
      </div>
    </section>
  )
}
