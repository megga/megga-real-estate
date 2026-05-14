// MEGGA Marketplace — Property X "Coming Soon" hero.
// Source : Figma node 9552:21496 — frame "🔔 Coming Soon".
// Sous-blocs portés ici :
//   - Header Wrapper (11783:16853) : pt-24, logo centré
//   - Hero Section (11783:16895) : container rounded-24 957px, image aérienne
//     ville + fade overlay top + content centré (title 72 + paragraph 16 +
//     email pill 380×52 avec Subscribe button noir + arrow-right)

import { PX, PxLogo, PxFigmaIcon } from '..'

export default function PxComingSoonHero() {
  return (
    <>
      {/* Placeholder color fidèle Figma : neutral500 #464851 (sinon le browser
          applique gray-400 ou une opacité atténuée du color de l'input). */}
      <style>{`
        .px-cs-input::placeholder { color: ${PX.neutral500}; opacity: 1; }
      `}</style>
      {/* ─── Header Wrapper : pt-24, items-center ─────────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 24,
        width: '100%',
        position: 'relative',
        zIndex: 3,
      }}>
        {/* Header/V3 : pt-24 pb-24 px-0, items-center justify-center, overflow-clip */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 24,
          paddingBottom: 24,
          overflow: 'hidden',
          width: '100%',
        }}>
          <PxLogo variant="dark" form="text" size="sm" to="/" />
        </div>
      </div>

      {/* ─── Hero Section : pt-24 pb-24 px-24, w-1440 max ──────────────── */}
      <section style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 24,
        paddingBottom: 24,
        paddingLeft: 24,
        paddingRight: 24,
        width: '100%',
        maxWidth: PX.containerDesktop,
        margin: '0 auto',
        position: 'relative',
        zIndex: 2,
      }}>
        {/* Container : h-957, w-full, rounded-24, overflow-clip, position relative */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: 957,
          borderRadius: PX.radius.large,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          {/* ─── Background absolu (image + fade) ─────────────────────── */}
          <div style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
          }}>
            {/* Image : 1413.9×1015, translateX(-50%) left-50% bottom-(-7.14) */}
            <div style={{
              position: 'absolute',
              left: '50%',
              bottom: -7.14,
              height: 1015.289,
              width: 1413.899,
              transform: 'translateX(-50%)',
              overflow: 'hidden',
              pointerEvents: 'none',
            }}>
              <img
                src="/images/sections/coming-soon/hero-aerial.jpg"
                alt=""
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '10.39%',
                  width: '100%',
                  height: '98.5%',
                  maxWidth: 'none',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
            {/* Fade : 1411.9×674.85, left-(-8.95) top-(-5.29) */}
            <div style={{
              position: 'absolute',
              left: -8.95,
              top: -5.29,
              width: 1411.899,
              height: 674.85,
              pointerEvents: 'none',
            }}>
              <img
                src="/images/sections/coming-soon/hero-fade.png"
                alt=""
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  maxWidth: 'none',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
          </div>

          {/* ─── Content : w-1200, pt-100, flex-col items-center ──────── */}
          <div style={{
            position: 'relative',
            width: 1200,
            maxWidth: '100%',
            paddingTop: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            {/* Title block : pt-16 (Sections/PD Extra Small), items-center justify-center */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 16,
              flexShrink: 0,
            }}>
              {/* Heading H1 : 72 Medium, lh 1.15, ls -2.16, white, w-571.795, center */}
              <p style={{
                margin: 0,
                width: 571.795,
                fontFamily: PX.font.display,
                fontSize: 72,
                fontWeight: 500,
                lineHeight: 1.15,
                letterSpacing: '-2.16px',
                color: PX.neutral100,
                textAlign: 'center',
              }}>
                Get notified when we launch
              </p>
            </div>

            {/* Wrapper : flex-col items-start (centré par parent) */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              flexShrink: 0,
            }}>
              {/* Paragraph block : pt-16, flex-col items-start justify-center */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                paddingTop: 16,
                flexShrink: 0,
              }}>
                {/* Paragraph Default : 16 Regular, lh 1.5, ls -0.48, white, w-422, h-48, center */}
                <p style={{
                  margin: 0,
                  width: 422,
                  height: 48,
                  fontFamily: PX.font.display,
                  fontSize: 16,
                  fontWeight: 400,
                  lineHeight: 1.5,
                  letterSpacing: '-0.48px',
                  color: PX.neutral100,
                  textAlign: 'center',
                }}>
                  Lorem ipsum dolor sit amet consectetur gravida elementum dolor semper felis pulvinar feugiat risus.
                </p>
              </div>

              {/* Input Wrapper : pt-32, flex-col items-start justify-center */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                paddingTop: 32,
                flexShrink: 0,
              }}>
                {/* Input Text pill : bg-neutral300, pl-16 pr-6 py-6, min-h-52, rounded-pill, w-380 */}
                <form
                  onSubmit={e => e.preventDefault()}
                  style={{
                    width: 380,
                    minHeight: 52,
                    paddingLeft: 16,
                    paddingRight: 6,
                    paddingTop: 6,
                    paddingBottom: 6,
                    background: PX.neutral300,
                    borderRadius: PX.radius.pill,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                  }}
                >
                  {/* Placeholder Wrapper : flex-1 gap-6 items-center min-w-px */}
                  <div style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                  }}>
                    {/* Wrapper : pt-2 */}
                    <div style={{
                      paddingTop: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      flex: 1,
                    }}>
                      <input
                        type="email"
                        placeholder="Enter your email address"
                        aria-label="Email address"
                        className="px-cs-input"
                        style={{
                          background: 'transparent',
                          border: 0,
                          outline: 'none',
                          fontFamily: PX.font.display,
                          fontSize: 16,
                          fontWeight: 400,
                          lineHeight: 1.25,
                          letterSpacing: '-0.48px',
                          color: PX.neutral700,
                          width: '100%',
                        }}
                      />
                    </div>
                  </div>

                  {/* Subscribe button : bg-neutral700, pl-16 pr-6 py-6, gap-6, rounded-pill */}
                  <button
                    type="submit"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingLeft: 16,
                      paddingRight: 6,
                      paddingTop: 6,
                      paddingBottom: 6,
                      background: PX.neutral700,
                      border: 0,
                      borderRadius: PX.radius.pill,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {/* Wrapper text : pt-2 */}
                    <span style={{
                      paddingTop: 2,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: PX.font.display,
                      fontSize: 16,
                      fontWeight: 500,
                      lineHeight: 1.25,
                      letterSpacing: '-0.48px',
                      color: PX.neutral100,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}>Subscribe</span>
                    {/* Icon circle : bg-white, size-28, rounded-pill, arrow noir */}
                    <span style={{
                      width: 28,
                      height: 28,
                      borderRadius: PX.radius.pill,
                      background: PX.neutral100,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <PxFigmaIcon name="arrow-right" size={12} color={PX.neutral700} />
                    </span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
