// MEGGA Marketplace — Property X "Blog Post — Hero" section.
// Source : Figma node 11800:17013 — code Figma EXACT.
//
// Anatomie :
// - Section pt-56, container 1200 centered, h=878 total
// - Top Content (1200×268) : items-end justify-between
//   - Left Content (772w) :
//     - Details Wrapper : Badge "Articles" (bg neutral400 + V50 icon white) + Date "Mar 26, 2026" (calendar icon + text muted)
//     - Title H1 60px medium lh 1.15 ls -1.8 (Display 9)
//     - Paragraph 16/1.5 neutral500
//   - Card right (380×240, bg white, rounded-24, p-32, shadow small, position relative) :
//     - Profile Wrapper : Avatar 64×64 round + "John Carter" 24 + "@johncarter" 16 muted
//     - Paragraph 16/1.5 neutral500 (311.7w)
//     - Social Media : 4 icons FB/Twitter/Insta/LinkedIn 16px
//     - Primary Circle Button absolute top-24 right-24 (40×40 bg-neutral700 + plus icon)
// - Image (1200×490) rounded-24

import { PX, PxFigmaIcon, PxSocialIcon } from '..'

export default function PxBlogPostHero() {
  return (
    <section style={{
      paddingTop: 56,
      paddingLeft: 0,
      paddingRight: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: PX.pageBg,
    }}>
      <div style={{
        width: 'min(1200px, calc(100% - 48px))',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 64,
      }}>
        {/* Top Content */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 24,
        }}>
          {/* Left Content */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            maxWidth: 772,
          }}>
            {/* Details Wrapper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Badge "Articles" */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 6,
                paddingBottom: 6,
                background: PX.neutral400,
                borderRadius: PX.radius.pill,
                color: PX.neutral100,
              }}>
                <PxFigmaIcon name="blog-article" size={16} color={PX.neutral100} />
                <span style={{
                  fontFamily: PX.font.sans,
                  fontWeight: 500,
                  fontSize: 16,
                  lineHeight: 1.25,
                  letterSpacing: '-0.48px',
                  color: PX.neutral100,
                  paddingTop: 2,
                }}>
                  Articles
                </span>
              </span>
              {/* Date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <PxFigmaIcon name="blog-calendar" size={22} color={PX.neutral400} />
                <span style={{
                  fontFamily: PX.font.sans,
                  fontWeight: 500,
                  fontSize: 16,
                  lineHeight: 1.25,
                  letterSpacing: '-0.48px',
                  color: PX.neutral400,
                  paddingTop: 4,
                }}>
                  Mar 26, 2026
                </span>
              </div>
            </div>

            {/* Title H1 */}
            <div style={{ paddingTop: 16, paddingBottom: 16 }}>
              <h1 style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 500,
                fontSize: 60,
                lineHeight: 1.15,
                letterSpacing: '-1.8px',
                color: PX.neutral700,
                maxWidth: 772,
              }}>
                First-time homebuyer&rsquo;s guide: Steps for beginners
              </h1>
            </div>

            {/* Paragraph */}
            <div style={{ paddingTop: 16 }}>
              <p style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 400,
                fontSize: 16,
                lineHeight: 1.5,
                letterSpacing: '-0.48px',
                color: PX.neutral500,
                maxWidth: 562,
              }}>
                Lorem ipsum dolor sit amet consectetur. Sit ut gravida aenean potenti. Metus in eu vel morbi dui nunc tellus. Non a massa maecenas massa.
              </p>
            </div>
          </div>

          {/* Author Card */}
          <div style={{
            width: 380,
            height: 240,
            background: PX.neutral100,
            borderRadius: PX.radius.large,
            boxShadow: PX.shadow.small,
            padding: 32,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            justifyContent: 'center',
            alignItems: 'flex-start',
            boxSizing: 'border-box',
            flexShrink: 0,
          }}>
            {/* Profile Wrapper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0,
                background: PX.neutral300,
              }}>
                <img
                  src="/images/sections/blog-post/author-john.jpg"
                  alt="John Carter"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{
                  margin: 0,
                  fontFamily: PX.font.sans,
                  fontWeight: 500,
                  fontSize: 24,
                  lineHeight: 1.25,
                  letterSpacing: '-0.72px',
                  color: PX.neutral700,
                  whiteSpace: 'nowrap',
                }}>
                  John Carter
                </p>
                <p style={{
                  margin: 0,
                  fontFamily: PX.font.sans,
                  fontWeight: 500,
                  fontSize: 16,
                  lineHeight: 1.5,
                  letterSpacing: '-0.48px',
                  color: PX.neutral500,
                  whiteSpace: 'nowrap',
                }}>
                  @johncarter
                </p>
              </div>
            </div>

            {/* Description */}
            <p style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
              maxWidth: 312,
            }}>
              Lorem ipsum dolor sit amet consectetur fermentum eget fringilla egestas lorem.
            </p>

            {/* Social Media row */}
            <div style={{ display: 'flex', gap: 16, color: PX.neutral700 }}>
              <PxSocialIcon name="facebook" size={16} color="mono" />
              <PxSocialIcon name="twitter" size={16} color="mono" />
              <PxSocialIcon name="instagram" size={16} color="mono" />
              <PxSocialIcon name="linkedin" size={16} color="mono" />
            </div>

            {/* Primary Circle Button — top right */}
            <button
              type="button"
              aria-label="Follow"
              style={{
                position: 'absolute',
                top: 24,
                right: 24,
                width: 40,
                height: 40,
                borderRadius: PX.radius.pill,
                background: PX.neutral700,
                border: 0,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PxFigmaIcon name="plus" size={16} color={PX.neutral100} />
            </button>
          </div>
        </div>

        {/* Hero image 1200×490 */}
        <div style={{
          width: '100%',
          height: 490,
          borderRadius: PX.radius.large,
          overflow: 'hidden',
        }}>
          <img
            src="/images/sections/blog-post/hero-kitchen.jpg"
            alt="Kitchen — First-time homebuyer's guide"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      </div>
    </section>
  )
}
