// MEGGA Marketplace — Property X "Blog Post — Newsletter CTA" section (CTA/V4).
// Source : Figma node 11798:16974 — code Figma EXACT.
//
// Anatomie :
// - Section px-24, container 1392 max
// - Bento dark : bg-neutral700, h=576, rounded-24, px-98
// - LEFT Image Wrapper 700×524 : laptop image (773×644) positioned with overflow
// - RIGHT Left Content w-480, flex-col gap-32 :
//   - Top Content gap-16 :
//     - Badge "Newsletter" : bg neutral600 + circle 26 neutral500 + star icon
//     - H2 48 white "Subscribe to our weekly newsletter"
//     - Paragraph 16/1.5 neutral400
//   - Input Text w-410 minH-52 pill bg neutral600 :
//     - Placeholder "Enter your email address" white
//     - Primary Button "Subscribe" (white pill + dark arrow circle 28×28)

import { PX, PxFigmaIcon } from '..'

function NewsletterBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 6,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral600,
      borderRadius: PX.radius.pill,
    }}>
      <span style={{
        width: 26,
        height: 26,
        borderRadius: PX.radius.pill,
        background: PX.neutral500,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        <PxFigmaIcon name="badge-featured-star" size={14.857} color={PX.neutral100} />
      </span>
      <span style={{
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 16,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral100,
        paddingTop: 2,
      }}>
        Newsletter
      </span>
    </span>
  )
}

export default function PxBlogPostNewsletterCTA() {
  return (
    <section style={{
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 0,
      paddingBottom: 0,
      background: PX.pageBg,
    }}>
      <div style={{
        background: PX.neutral700,
        height: 576,
        maxWidth: 1392,
        margin: '0 auto',
        borderRadius: PX.radius.large,
        paddingLeft: 98,
        paddingRight: 98,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        overflow: 'hidden',
        gap: 24,
        boxSizing: 'border-box',
      }}>
        {/* LEFT — Laptop image */}
        <div style={{
          width: 700,
          height: 524,
          position: 'relative',
          flexShrink: 0,
          marginRight: -32,  // Figma : mr-[-32px]
        }}>
          <img
            src="/images/sections/blog-post/cta-laptop.png"
            alt="Laptop preview of property article"
            style={{
              position: 'absolute',
              left: 'calc(50% - 72px)',
              top: 'calc(50% + 10px)',
              transform: 'translate(-50%, -50%)',
              width: 773,
              height: 'auto',
              maxWidth: 'none',
              display: 'block',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* RIGHT — Content */}
        <div style={{
          width: 480,
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
          flexShrink: 0,
        }}>
          {/* Top Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', width: '100%' }}>
            <NewsletterBadge />
            <h2 style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 48,
              lineHeight: 1.25,
              letterSpacing: '-1.44px',
              color: PX.neutral100,
            }}>
              Subscribe to our weekly newsletter
            </h2>
            <p style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral400,
            }}>
              Lorem ipsum dolor sit amet consectetur. Volutpat et lacinia sit aenean consequat. Id tellus eget libero eget non odio tristique.
            </p>
          </div>

          {/* Input + Subscribe button */}
          <form
            onSubmit={(e) => e.preventDefault()}
            style={{
              background: PX.neutral600,
              minHeight: 52,
              width: 410,
              maxWidth: '100%',
              borderRadius: PX.radius.pill,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: 16,
              paddingRight: 6,
              paddingTop: 6,
              paddingBottom: 6,
              boxSizing: 'border-box',
            }}
          >
            <input
              type="email"
              placeholder="Enter your email address"
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 0,
                outline: 'none',
                fontFamily: PX.font.sans,
                fontWeight: 400,
                fontSize: 16,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
                color: PX.neutral100,
                paddingTop: 2,
              }}
            />
            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                paddingLeft: 16,
                paddingRight: 6,
                paddingTop: 6,
                paddingBottom: 6,
                background: PX.neutral100,
                color: PX.neutral700,
                border: 0,
                borderRadius: PX.radius.pill,
                cursor: 'pointer',
                fontFamily: PX.font.sans,
                fontWeight: 500,
                fontSize: 16,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
                flexShrink: 0,
              }}
            >
              <span style={{ paddingTop: 2 }}>Subscribe</span>
              <span style={{
                width: 28,
                height: 28,
                borderRadius: PX.radius.pill,
                background: PX.neutral700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <PxFigmaIcon name="arrow-right" size={12} color={PX.neutral100} />
              </span>
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
