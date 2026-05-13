// MEGGA Marketplace — Property X "Testimonials Section".
// Source : Figma node 9665:8400 — code Figma exact.
//
// Structure fidèle :
//   <section pt-200 pb-80 flex-col items-center>
//     <Top Content w-1112 mb-[-170] flex-col items-start>
//       <Badge "Testimonials" LIGHT bg-neutral300 + cercle bg-neutral400>
//       <H2 48 Display/8 w-477 tracking-1.44>
//       <Paragraph pt-16 pb-32, w-562, 16/1.5 neutral500>
//     </Top Content>
//     <Cards Wrapper flex gap-32 items-center>
//       <LEFT col flex-col gap-32 pt-160>
//         <Card "Andy Smith" w-540 h-240 px-52 py-43>
//         <Card "Sandy Houston" same>
//       </LEFT col>
//       <RIGHT col flex-col pb-160 items-start>
//         <Cards Wrapper flex-col gap-32>
//           <Card "Kathie Corl">
//           <Card "Matt Cannon" px-48>
//         </Cards Wrapper>
//         <Button Row pt-48>
//           <PrimaryButton DARK "Start exploring">
//         </Button Row>
//       </RIGHT col>
//     </Cards Wrapper>
//   </section>

import { PX, PxAvatar, PxButton, PxIcon } from '..'

interface Testimonial {
  id: string
  quote: string
  name: string
  location: string
  avatar: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    quote: '« Service exceptionnel, opportunités immobilières inégalées en Suisse romande. »',
    name: 'Kathie Corl',
    location: 'Genève, GE',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
  },
  {
    id: 't2',
    quote: '« Navigation simple, options imbattables — j\'ai trouvé en deux semaines au lieu de six mois. »',
    name: 'Andy Smith',
    location: 'Lausanne, VD',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
  },
  {
    id: 't3',
    quote: '« Ultime plateforme immobilière, qualité et service inégalés. »',
    name: 'Matt Cannon',
    location: 'Lugano, TI',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80',
  },
  {
    id: 't4',
    quote: '« Trouvé l\'appartement parfait rapidement, plateforme immobilière imbattable. »',
    name: 'Sandy Houston',
    location: 'Sion, VS',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80',
  },
]

// Badge "Testimonials" — fidèle Figma : LIGHT bg-neutral300 + cercle bg-neutral400
function TestimonialsBadge() {
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
        <PxIcon name="message" size={15} color={PX.neutral100} />
      </span>
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
      }}>Témoignages</span>
    </span>
  )
}

// Carte testimonial — fidèle Figma : w-540 h-240 px-52 py-43, layout horizontal
function TestimonialCard({ t, narrow = false }: { t: Testimonial; narrow?: boolean }) {
  return (
    <div style={{
      width: 540,
      height: 240,
      paddingLeft: narrow ? 48 : 52,
      paddingRight: narrow ? 48 : 52,
      paddingTop: 43,
      paddingBottom: 43,
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      boxShadow: PX.shadow.small,
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        gap: 24,
        alignItems: 'flex-start',
        height: '100%',
      }}>
        {/* Avatar 80×80 mask circle */}
        <PxAvatar src={t.avatar} alt={t.name} size={80} />
        {/* Content : quote top, details bottom (relative positioning) */}
        <div style={{
          flex: 1,
          height: '100%',
          position: 'relative',
        }}>
          {/* Quote : 20px Display/4/Medium tracking-0.6 lh-1.25 */}
          <p style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 20,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.6px',
            color: PX.neutral700,
            maxWidth: 336,
          }}>{t.quote}</p>
          {/* Details Wrapper : positionné en bas, name + location */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
          }}>
            <div style={{
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
            }}>{t.name}</div>
            <div style={{
              marginTop: 8,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
            }}>{t.location}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PxTestimonials() {
  return (
    <section style={{
      paddingTop: 200,
      paddingBottom: 80,
      paddingLeft: 24,
      paddingRight: 24,
      background: PX.neutral100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Top Content : w-1112, mb-[-170] (overlap cards), flex-col items-start */}
      <div style={{
        width: 1112,
        maxWidth: '100%',
        marginBottom: -170,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}>
        <TestimonialsBadge />
        {/* H2 : pt-16, 48 Display/8/Medium tracking-1.44 w-477 */}
        <h2 style={{
          margin: 0,
          paddingTop: 16,
          width: 477,
          maxWidth: '100%',
          fontFamily: PX.font.display,
          fontSize: 48,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-1.44px',
          color: PX.neutral700,
        }}>
          Ce que pensent nos clients
        </h2>
        {/* Paragraph : pt-16 pb-32, w-562, 16/1.5 neutral500 */}
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
        }}>
          5 000 clients accompagnés depuis 2019 en Suisse romande et alémanique.
          Voici quelques retours d'expérience.
        </p>
      </div>

      {/* Cards Wrapper : flex gap-32 items-center (NOTE: items-center pour aligner verticalement les 2 cols) */}
      <div style={{
        display: 'flex',
        gap: 32,
        alignItems: 'center',
      }}>
        {/* LEFT col : flex-col gap-32, pt-160 (offset vers le bas) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
          paddingTop: 160,
        }}>
          <TestimonialCard t={TESTIMONIALS[1]} />
          <TestimonialCard t={TESTIMONIALS[3]} />
        </div>

        {/* RIGHT col : flex-col, pb-160 (offset vers le haut) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          paddingBottom: 160,
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
          }}>
            <TestimonialCard t={TESTIMONIALS[0]} />
            <TestimonialCard t={TESTIMONIALS[2]} narrow />
          </div>
          {/* Button Row : pt-48, PrimaryButton DARK */}
          <div style={{
            paddingTop: 48,
          }}>
            <PxButton to="/acheter" variant="primary" size="lg">
              Commencer
            </PxButton>
          </div>
        </div>
      </div>
    </section>
  )
}
