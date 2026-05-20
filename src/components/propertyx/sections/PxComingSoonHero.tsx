// MEGGA Marketplace — Property X "Coming Soon" hero.
// Source : Figma node 9552:21496 — frame "🔔 Coming Soon".
// Sous-blocs portés ici :
//   - Header Wrapper (11783:16853) : pt-24, logo centré
//   - Hero Section (11783:16895) : container rounded-24 957px, image aérienne
//     ville + fade overlay top + content centré (title 72 + paragraph 16 +
//     email pill 380×52 avec Subscribe button noir + arrow-right)
//
// Form Subscribe branché sur la table coming_soon_subscribers (Supabase).
// États : idle → loading → success | error. Textes i18n (FR/DE/EN/IT).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PX, PxLogo, PxFigmaIcon } from '..'
import { supabase } from '@/lib/supabase'

type FormState = 'idle' | 'loading' | 'success' | 'error'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function PxComingSoonHero() {
  const { t, i18n } = useTranslation('comingSoon')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'loading') return

    const trimmed = email.trim().toLowerCase()
    if (!EMAIL_REGEX.test(trimmed)) {
      setErrorMsg(t('errorInvalidEmail'))
      setState('error')
      return
    }

    setState('loading')
    setErrorMsg('')

    const { error } = await supabase
      .from('coming_soon_subscribers')
      .insert({
        email: trimmed,
        locale: i18n.language?.slice(0, 2) || 'fr',
        source: 'coming_soon_splash',
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      })

    if (error) {
      if (error.code === '23505') {
        setErrorMsg(t('errorAlreadySubscribed'))
      } else {
        setErrorMsg(t('errorGeneric'))
      }
      setState('error')
      return
    }

    setState('success')
  }

  return (
    <>
      {/* Placeholder color fidèle Figma + responsive overrides (tablet < 1024, mobile < 640). */}
      <style>{`
        .px-cs-input::placeholder { color: ${PX.neutral500}; opacity: 1; }
        @media (max-width: 1023px) {
          .px-cs-hero { height: 720px !important; padding: 0 !important; }
          .px-cs-content { padding-top: 80px !important; }
          .px-cs-title { font-size: 56px !important; letter-spacing: -1.68px !important; width: 100% !important; max-width: 480px !important; }
          .px-cs-paragraph { width: 100% !important; max-width: 420px !important; height: auto !important; }
        }
        @media (max-width: 639px) {
          .px-cs-section { padding-left: 12px !important; padding-right: 12px !important; }
          .px-cs-hero { height: 600px !important; border-radius: 16px !important; }
          .px-cs-content { padding-top: 56px !important; padding-left: 20px !important; padding-right: 20px !important; }
          .px-cs-title { font-size: 36px !important; letter-spacing: -1.08px !important; line-height: 1.1 !important; max-width: 100% !important; }
          .px-cs-paragraph { font-size: 14px !important; max-width: 100% !important; }
          .px-cs-form { width: 100% !important; max-width: 100% !important; }
          .px-cs-bg-image { width: 200% !important; height: 100% !important; }
          .px-cs-bg-fade { width: 200% !important; height: 60% !important; }
        }
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
      <section
        className="px-cs-section"
        style={{
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
        }}
      >
        {/* Container : h-957, w-full, rounded-24, overflow-clip, position relative */}
        <div
          className="px-cs-hero"
          style={{
            position: 'relative',
            width: '100%',
            height: 957,
            borderRadius: PX.radius.large,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* ─── Background absolu (image + fade) ─────────────────────── */}
          <div style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
          }}>
            {/* Image : 1413.9×1015, translateX(-50%) left-50% bottom-(-7.14) */}
            <div
              className="px-cs-bg-image"
              style={{
                position: 'absolute',
                left: '50%',
                bottom: -7.14,
                height: 1015.289,
                width: 1413.899,
                transform: 'translateX(-50%)',
                overflow: 'hidden',
                pointerEvents: 'none',
              }}
            >
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
            <div
              className="px-cs-bg-fade"
              style={{
                position: 'absolute',
                left: -8.95,
                top: -5.29,
                width: 1411.899,
                height: 674.85,
                pointerEvents: 'none',
              }}
            >
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
          <div
            className="px-cs-content"
            style={{
              position: 'relative',
              width: 1200,
              maxWidth: '100%',
              paddingTop: 100,
              paddingLeft: 24,
              paddingRight: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            {/* Title block : pt-16 (Sections/PD Extra Small), items-center justify-center */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 16,
              flexShrink: 0,
            }}>
              {/* Heading H1 : 72 Medium, lh 1.15, ls -2.16, white, w-571.795, center */}
              <p
                className="px-cs-title"
                style={{
                  margin: 0,
                  width: 571.795,
                  maxWidth: '100%',
                  fontFamily: PX.font.display,
                  fontSize: 72,
                  fontWeight: 500,
                  lineHeight: 1.15,
                  letterSpacing: '-2.16px',
                  color: PX.neutral100,
                  textAlign: 'center',
                }}
              >
                {t('title')}
              </p>
            </div>

            {/* Wrapper : flex-col items-start (centré par parent) */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flexShrink: 0,
            }}>
              {/* Paragraph block : pt-16, flex-col items-start justify-center */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: 16,
                flexShrink: 0,
              }}>
                {/* Paragraph Default : 16 Regular, lh 1.5, ls -0.48, white, w-422, center */}
                <p
                  className="px-cs-paragraph"
                  style={{
                    margin: 0,
                    width: 422,
                    maxWidth: '100%',
                    fontFamily: PX.font.display,
                    fontSize: 16,
                    fontWeight: 400,
                    lineHeight: 1.5,
                    letterSpacing: '-0.48px',
                    color: PX.neutral100,
                    textAlign: 'center',
                  }}
                >
                  {t('paragraph')}
                </p>
              </div>

              {/* Input Wrapper : pt-32, flex-col items-start justify-center */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: 32,
                flexShrink: 0,
              }}>
                {state === 'success' ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="px-cs-form"
                    style={{
                      width: 380,
                      maxWidth: '100%',
                      minHeight: 52,
                      paddingLeft: 24,
                      paddingRight: 24,
                      background: PX.neutral300,
                      borderRadius: PX.radius.pill,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: PX.font.display,
                      fontSize: 16,
                      fontWeight: 500,
                      lineHeight: 1.25,
                      letterSpacing: '-0.48px',
                      color: PX.neutral700,
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {t('successMessage')}
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    className="px-cs-form"
                    style={{
                      width: 380,
                      maxWidth: '100%',
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
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                    }}>
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
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value)
                            if (state === 'error') {
                              setState('idle')
                              setErrorMsg('')
                            }
                          }}
                          placeholder={t('emailPlaceholder')}
                          aria-label={t('emailPlaceholder')}
                          disabled={state === 'loading'}
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
                      disabled={state === 'loading'}
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
                        cursor: state === 'loading' ? 'wait' : 'pointer',
                        opacity: state === 'loading' ? 0.7 : 1,
                        flexShrink: 0,
                      }}
                    >
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
                      }}>{t('subscribe')}</span>
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
                )}

                {state === 'error' && errorMsg && (
                  <p
                    role="alert"
                    style={{
                      margin: 0,
                      marginTop: 12,
                      fontFamily: PX.font.display,
                      fontSize: 13,
                      fontWeight: 400,
                      lineHeight: 1.4,
                      color: '#FCA5A5',
                      textAlign: 'center',
                    }}
                  >
                    {errorMsg}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
