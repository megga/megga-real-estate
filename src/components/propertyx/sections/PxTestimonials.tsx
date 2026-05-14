// MEGGA Marketplace — Property X "Testimonials Section".
// Source : Figma node 9665:8400 — code Figma EXACT (texte, dimensions, position).
//
// Structure fidèle :
//   <section pt-200 pb-80 flex-col items-center justify-center>
//     <Top Content w-1112 mb-[-170] flex-col items-start>
//       <Badge "Testimonials" bg-neutral300 + cercle bg-neutral400>
//       <H2 48 Display/8/Medium w-477 ls-1.44 "Look at what people say about us">
//       <Paragraph pt-16 pb-32, w-562, 16/1.5 neutral500>
//     </Top Content>
//     <Cards Wrapper flex gap-32 items-center>
//       <LEFT col flex-col gap-32 pt-160>
//         <Card "Andy Smith" w-540 h-240 px-52 py-43>
//         <Card "Sandy Houston" same>
//       </LEFT col>
//       <RIGHT col flex-col items-start pb-160>
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

import { PX, PxButton, PxFigmaIcon } from '..'

interface Testimonial {
  id: string
  quote: string
  name: string
  location: string
  avatar: string
  quoteWidth: number // Figma exact widths
  cardPaddingX: 48 | 52
}

// Avatars : photos Figma téléchargées en local quand <1MB, sinon Unsplash
// équivalent (Kathie & Matt étaient >1MB chacune — portraits similaires).
const TESTIMONIALS: Record<string, Testimonial> = {
  andy: {
    id: 'andy',
    quote: '“Navigating properties made easy, unbeatable USA options.”',
    name: 'Andy Smith',
    location: 'Los Angeles, CA',
    avatar: '/images/sections/testimonials/andy-smith.png',
    quoteWidth: 306.121,
    cardPaddingX: 52,
  },
  sandy: {
    id: 'sandy',
    quote: '“Found perfect home swiftly, unbeatable real estate platform.”',
    name: 'Sandy Houston',
    location: 'San Francisco, CA',
    avatar: '/images/sections/testimonials/sandy-houston.png',
    quoteWidth: 322.121,
    cardPaddingX: 52,
  },
  kathie: {
    id: 'kathie',
    quote: '“Exceptional service, unmatched real estate opportunities in USA.”',
    name: 'Kathie Corl',
    location: 'New York, NY',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80',
    quoteWidth: 332.242,
    cardPaddingX: 52,
  },
  matt: {
    id: 'matt',
    quote: '“Ultimate real estate hub, unmatched quality and service.”',
    name: 'Matt Cannon',
    location: 'Los Angeles, CA',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
    quoteWidth: 335.977,
    cardPaddingX: 48,
  },
}

// Badge "Testimonials" — fidèle Figma (node 11756:32333) :
// bg-neutral300, pl-6 pr-12 py-6 rounded-pill + cercle bg-neutral400 26×26 + icône
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
        <PxFigmaIcon name="badge-testimonials-message" size={14.857} color={PX.neutral100} />
      </span>
      <span style={{
        paddingTop: 2,
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
        whiteSpace: 'nowrap',
      }}>Testimonials</span>
    </span>
  )
}

// Avatar 80×80 cercle mask (Figma : mask-size 80×80 + img cover)
function TestimonialAvatar({ src, alt }: { src: string; alt: string }) {
  return (
    <span style={{
      width: 80,
      height: 80,
      borderRadius: PX.radius.pill,
      overflow: 'hidden',
      flexShrink: 0,
      display: 'inline-block',
      background: PX.neutral300,
    }}>
      <img
        src={src}
        alt={alt}
        width={80}
        height={80}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </span>
  )
}

// Card — fidèle Figma (node 9667:9771, 9667:9784, 9667:9745, 9667:9758) :
// w-540 h-240.842 px-52|48 py-43 bg-white rounded-24 shadow-small
// Layout : flex gap-24 items-start. Quote en haut, Details Wrapper avec mt-99.56
function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div style={{
      width: 540,
      height: 240.842,
      paddingLeft: t.cardPaddingX,
      paddingRight: t.cardPaddingX,
      paddingTop: 43,
      paddingBottom: 43,
      background: PX.neutral100,
      borderRadius: PX.radius.large, // 24
      boxShadow: PX.shadow.small,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
    }}>
      {/* Wrapper : flex gap-24 items-start */}
      <div style={{
        display: 'flex',
        gap: 24,
        alignItems: 'flex-start',
      }}>
        {/* Avatar 80×80 */}
        <TestimonialAvatar src={t.avatar} alt={t.name} />
        {/* Content : grid-like, quote sur 1 row, details mt-99.56 */}
        <div style={{
          display: 'inline-grid',
          gridTemplateColumns: 'max-content',
          gridTemplateRows: 'max-content',
          placeItems: 'start',
          position: 'relative',
        }}>
          {/* Quote : Display/4/Medium 20px ls -0.6 lh 1.25 neutral700 */}
          <p style={{
            gridColumn: 1,
            gridRow: 1,
            margin: 0,
            marginLeft: 0,
            marginTop: 0,
            fontFamily: PX.font.display,
            fontSize: 20,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.6px',
            color: PX.neutral700,
            width: t.quoteWidth,
          }}>{t.quote}</p>
          {/* Details Wrapper : mt-99.56, ml-0.24, name + location */}
          <div style={{
            gridColumn: 1,
            gridRow: 1,
            marginLeft: 0.24,
            marginTop: 99.56,
            display: 'inline-grid',
            gridTemplateColumns: 'max-content',
            gridTemplateRows: 'max-content',
            placeItems: 'start',
            whiteSpace: 'nowrap',
          }}>
            <p style={{
              gridColumn: 1,
              gridRow: 1,
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
            }}>{t.name}</p>
            <p style={{
              gridColumn: 1,
              gridRow: 1,
              margin: 0,
              marginTop: 24,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
            }}>{t.location}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PxTestimonials() {
  return (
    <section
      data-node-id="9665:8400"
      style={{
        paddingTop: 200,
        paddingBottom: 80,
        background: PX.neutral100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
      }}>
      {/* Top Content : w-1112, mb-[-170] (overlap cards), flex-col items-start justify-center */}
      <div style={{
        width: 1112,
        maxWidth: '100%',
        marginBottom: -170,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}>
        {/* Header Block : Badge + Title */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}>
          <TestimonialsBadge />
          {/* Title wrapper : pt-16 (sections/pd-extra-small) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 16,
          }}>
            {/* H2 : 48 Display/8/Medium ls -1.44 w-477.023 */}
            <p style={{
              margin: 0,
              width: 477.023,
              fontFamily: PX.font.display,
              fontSize: 48,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-1.44px',
              color: PX.neutral700,
            }}>Look at what people say about us</p>
          </div>
        </div>
        {/* Paragraph block : pt-16 pb-32, w-562.047 */}
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
            height: 48,
            width: 562.047,
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral500,
          }}>Lorem ipsum dolor sit amet consectetur. Id eu mi ac ac aliquam etiam ultrices augue convallis nunc ultrices amet consequat adipiscing.</p>
        </div>
      </div>

      {/* Cards Wrapper : flex gap-32 items-center */}
      <div
        data-node-id="9667:9743"
        style={{
          display: 'flex',
          gap: 32,
          alignItems: 'center',
        }}>
        {/* LEFT col (Grid 1 Column) : flex-col gap-32 pt-160 — décalée vers le bas */}
        <div
          data-node-id="9667:9796"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
            alignItems: 'flex-start',
            paddingTop: 160,
          }}>
          <TestimonialCard t={TESTIMONIALS.andy} />
          <TestimonialCard t={TESTIMONIALS.sandy} />
        </div>

        {/* RIGHT col (Grid 1 Column) : flex-col items-start pb-160 — décalée vers le haut */}
        <div
          data-node-id="9667:9797"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            paddingBottom: 160,
          }}>
          <div
            data-node-id="9667:9804"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}>
            <div
              data-node-id="9667:9811"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 32,
                alignItems: 'flex-start',
              }}>
              <TestimonialCard t={TESTIMONIALS.kathie} />
              <TestimonialCard t={TESTIMONIALS.matt} />
            </div>
            {/* Button Row : pt-48 (sections/pd-default), PrimaryButton DARK "Start exploring" */}
            <div
              data-node-id="9667:9805"
              style={{
                display: 'flex',
                alignItems: 'center',
                paddingTop: 48,
              }}>
              <PxButton to="/properties" variant="primary" size="sm">
                Start exploring
              </PxButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
