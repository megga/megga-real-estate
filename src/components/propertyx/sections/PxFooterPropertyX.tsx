// Variant Property X (EN) du Footer/V1 — utilisé uniquement sur /about
// pour fidélité Figma maximale.
// Source : Figma node 9613:23660 (Footer/V1 inside Properties page)
//
// Différences vs PxFooter :
// - Headline EN "Discover exclusive real estate opportunities" (vs FR)
// - Paragraphe Lorem ipsum Figma
// - Email placeholder "Enter your email address" / bouton "Subscribe"
// - 6 colonnes 100% Figma (Main pages, props sans titre, blog sans titre,
//   Utility Pages, Contact us, sales/help sans titre)
// - Logo Property X (inline SVG) + copyright "Property X | Designed by BRIX"

import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PX, PxSocialIcon, PxIcon } from '..'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'

// Logo Property X — vrais assets SVG Figma téléchargés dans
// /public/icons/figma/propertyx/. Le footer utilise les tailles 23.167×23.167
// pour l'icon et 107.062×26.074 pour le wordmark (Figma footer specs).
const logoCache = { icon: null as string | null, text: null as string | null }

function PropertyXLogoLight() {
  const [iconSvg, setIconSvg] = useState<string | null>(logoCache.icon)
  const [textSvg, setTextSvg] = useState<string | null>(logoCache.text)

  useEffect(() => {
    if (!iconSvg) {
      fetch('/icons/figma/propertyx/logo-icon.svg').then(r => r.text()).then(t => { logoCache.icon = t; setIconSvg(t) }).catch(() => {})
    }
    if (!textSvg) {
      fetch('/icons/figma/propertyx/logo-text.svg').then(r => r.text()).then(t => { logoCache.text = t; setTextSvg(t) }).catch(() => {})
    }
  }, [iconSvg, textSvg])

  return (
    <span
      role="img"
      aria-label="Property X"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8.424,
        color: PX.neutral100,
      }}
    >
      <span
        aria-hidden="true"
        style={{ display: 'inline-block', width: 23.167, height: 23.167, transform: 'scaleX(-1)' }}
        dangerouslySetInnerHTML={iconSvg ? { __html: iconSvg } : undefined}
      />
      <span
        aria-hidden="true"
        style={{ display: 'inline-block', width: 107.062, height: 26.074 }}
        dangerouslySetInnerHTML={textSvg ? { __html: textSvg } : undefined}
      />
    </span>
  )
}

// Colonnes fidèles Figma (textes EN) — node 9613:23660 footer
const COL_MAIN = {
  title: 'Main pages',
  links: [
    { label: 'Home V1', to: '/' },
    { label: 'Home V2', to: '/' },
    { label: 'Home V3', to: '/' },
    { label: 'About', to: '/about' },
    { label: 'Properties', to: '/about' },
    { label: 'Properties by location', to: '/about' },
    { label: 'Properties by type of property', to: '/about' },
    { label: 'Properties by type', to: '/about' },
  ],
}

const COL_PROPS_LINKS = {
  title: '',
  links: [
    { label: 'Property single', to: '/listing' },
    { label: 'Agences', to: '/agences' },
    { label: 'Page agence', to: '/agences' },
    { label: 'Post a free property', to: '/publier?type=free' },
    { label: 'Post a paid property', to: '/publier?type=premium' },
    { label: 'Blog V1', to: '/blog' },
    { label: 'Blog V2', to: '/blog' },
    { label: 'Blog V3', to: '/blog' },
  ],
}

const COL_BLOG_LINKS = {
  title: '',
  links: [
    { label: 'Blog post', to: '/blog' },
    { label: 'Contact V1', to: '/contact' },
    { label: 'Contact V2', to: '/contact' },
    { label: 'Contact V3', to: '/contact' },
    { label: 'FAQs', to: '/aide' },
    { label: 'Coming soon', to: '/coming-soon' },
    { label: 'Subscribe page', to: '/subscribe' },
  ],
}

const COL_UTILITY = {
  title: 'Utility Pages',
  links: [
    { label: 'Start here', to: '/aide' },
    { label: 'Style guide', to: '/style-guide' },
    { label: 'Password protected', to: '/password' },
    { label: '404 not found', to: '/404' },
    { label: 'Licenses', to: '/licenses' },
    { label: 'Changelog', to: '/changelog' },
  ],
}

// Contact us : Email + Phone (fidèle Figma)
const CONTACT_PRIMARY = [
  { icon: 'mail' as const, label: 'Email address', value: 'info@home.com' },
  { icon: 'phone' as const, label: 'Phone number', value: '(123) 456 - 7890' },
]

// Sales / Help (no title — fidèle Figma)
// V46 = briefcase (sales) — pas building. V29 = chat bubble (help) — pas teardrop.
const CONTACT_SECONDARY = [
  { icon: 'briefcase' as const, label: 'Sales executives', value: 'sales@home.com' },
  { icon: 'message' as const, label: 'Help & support', value: 'support@home.com' },
]

function FooterLink({ to, label, weight = 400 }: { to: string; label: string; weight?: 400 | 500 }) {
  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        textDecoration: 'none',
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: weight,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral300,
      }}
    >
      {label}
    </Link>
  )
}

function LinkColumn({ col }: { col: typeof COL_MAIN }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
    }}>
      {/* Titre 20 Display/4/Medium white — h-25 (même si vide) */}
      <div style={{
        height: 25,
        display: 'flex',
        alignItems: 'flex-start',
      }}>
        {col.title && (
          <span style={{
            fontFamily: PX.font.display,
            fontSize: 20,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.6px',
            color: PX.neutral100,
            whiteSpace: 'nowrap',
          }}>{col.title}</span>
        )}
      </div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        paddingTop: 24,
      }}>
        {col.links.map(l => (
          <FooterLink
            key={l.label + l.to}
            to={l.to}
            label={l.label}
            weight={('weight' in l ? l.weight : 400) as 400 | 500}
          />
        ))}
      </div>
    </div>
  )
}

function ContactInfo({ icon, label, value }: { icon: 'mail' | 'phone' | 'briefcase' | 'message'; label: string; value: string }) {
  // Figma Small Icon/Vxx — chaque icône Figma a une "Element" interne ~16px dans
  // un conteneur 24×24. PxIcon use stroke-1.7 et viewBox 24, ce qui matche bien.
  return (
    <div style={{
      display: 'flex',
      gap: 6,
      alignItems: 'flex-start',
    }}>
      <div style={{
        width: 24,
        height: 24,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        <PxIcon name={icon} size={20} color={PX.neutral100} strokeWidth={1.6} />
      </div>
      <div style={{
        paddingTop: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        alignItems: 'flex-start',
      }}>
        <span style={{
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral400,
          whiteSpace: 'nowrap',
        }}>{label}</span>
        <span style={{
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral100,
          whiteSpace: 'nowrap',
        }}>{value}</span>
      </div>
    </div>
  )
}

export default function PxFooterPropertyX() {
  const { i18n } = useTranslation()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleNewsletterSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    const lang = (i18n.language?.slice(0, 2) || 'fr') as 'fr' | 'de' | 'en' | 'it'
    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({ email: trimmed, lang, source: 'px_footer_propertyx' })
    setSubmitting(false)
    if (error && error.code !== '23505') {
      toast.error('Inscription échouée — réessayez dans un instant.')
      return
    }
    setEmail('')
    toast.success('Merci, votre inscription est confirmée.')
  }

  return (
    <footer className="px-footer-pxv2" style={{
      paddingLeft: 24,
      paddingRight: 24,
      paddingBottom: 24,
      background: 'transparent',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      alignItems: 'center',
    }}>
      {/* Responsive overrides — desktop UI strictly unchanged */}
      <style>{`
        @media (max-width: 900px) {
          .px-footer-pxv2 .px-footer-dark { height: auto !important; padding: 64px 0 !important; }
          .px-footer-pxv2 .px-footer-grid {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 56px !important;
            justify-content: flex-start !important;
            width: 100% !important;
            max-width: calc(100% - 48px) !important;
          }
          .px-footer-pxv2 .px-footer-left {
            width: 100% !important;
            gap: 32px !important;
          }
          .px-footer-pxv2 .px-footer-right {
            width: 100% !important;
            gap: 48px !important;
          }
          .px-footer-pxv2 .px-footer-cols {
            flex-wrap: wrap !important;
            gap: 40px 32px !important;
          }
          /* Fixed-width children inside the left column (h3/p/form/copyright)
             — make them fluid */
          .px-footer-pxv2 .px-footer-left * { max-width: 100% !important; }
          .px-footer-pxv2 .px-footer-left h3,
          .px-footer-pxv2 .px-footer-left p,
          .px-footer-pxv2 .px-footer-left form,
          .px-footer-pxv2 .px-footer-left > div { width: 100% !important; box-sizing: border-box !important; }
          /* Allow input to shrink below its intrinsic min-content */
          .px-footer-pxv2 .px-footer-left form input { min-width: 0 !important; }
        }
        @media (max-width: 480px) {
          /* Stack input + Subscribe button on very narrow screens */
          .px-footer-pxv2 .px-footer-left form {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
            border-radius: 16px !important;
            padding: 12px !important;
          }
          .px-footer-pxv2 .px-footer-left form button { width: 100% !important; justify-content: center !important; }
        }
        @media (max-width: 560px) {
          .px-footer-pxv2 .px-footer-cols {
            flex-direction: column !important;
            gap: 32px !important;
          }
        }
      `}</style>
      {/* Container DARK : bg-neutral700, h-788, rounded-24, w-full */}
      <div className="px-footer-dark" style={{
        width: '100%',
        maxWidth: 1392,
        height: 788,
        background: PX.neutral700,
        borderRadius: PX.radius.large,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Grid Footer : w-1200 flex items-center justify-between (centered in 1392 container) */}
        <div className="px-footer-grid" style={{
          width: 1200,
          maxWidth: 'calc(100% - 48px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Left Content : w-410 flex-col gap-277 items-start */}
          <div className="px-footer-left" style={{
            width: 410,
            display: 'flex',
            flexDirection: 'column',
            gap: 277,
            alignItems: 'flex-start',
          }}>
            {/* Top Content */}
            <div style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
            }}>
              {/* Title : 36 Display/7/Medium tracking-1.08 white w-410 */}
              <h3 style={{
                margin: 0,
                width: 410,
                fontFamily: PX.font.display,
                fontSize: 36,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: '-1.08px',
                color: PX.neutral100,
              }}>
                Discover exclusive real estate opportunities
              </h3>
              {/* Paragraph : pt-16 pb-32, 16/1.5 neutral400 w-404 */}
              <p style={{
                margin: 0,
                paddingTop: 16,
                paddingBottom: 32,
                width: 404,
                fontFamily: PX.font.display,
                fontSize: 16,
                fontWeight: 400,
                lineHeight: 1.5,
                letterSpacing: '-0.48px',
                color: PX.neutral400,
              }}>
                Lorem ipsum dolor sit amet consectetur. Egestas eu amet dictum tellus. Purus morbi lorem viverra cras.
              </p>
              {/* Input pill */}
              <form onSubmit={handleNewsletterSubmit} style={{
                width: 410,
                minHeight: 52,
                paddingLeft: 16,
                paddingRight: 6,
                paddingTop: 6,
                paddingBottom: 6,
                background: PX.neutral600,
                borderRadius: PX.radius.pill,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  aria-label="Email address"
                  required
                  disabled={submitting}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 0,
                    outline: 'none',
                    fontFamily: PX.font.display,
                    fontSize: 16,
                    fontWeight: 400,
                    lineHeight: 1.25,
                    letterSpacing: '-0.48px',
                    color: PX.neutral100,
                  }}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    paddingLeft: 16,
                    paddingRight: 6,
                    paddingTop: 6,
                    paddingBottom: 6,
                    background: PX.neutral100,
                    border: 0,
                    borderRadius: PX.radius.pill,
                    cursor: submitting ? 'wait' : 'pointer',
                    opacity: submitting ? 0.7 : 1,
                    fontFamily: PX.font.display,
                    fontSize: 16,
                    fontWeight: 500,
                    lineHeight: 1.25,
                    letterSpacing: '-0.48px',
                    color: PX.neutral700,
                  }}
                >
                  {submitting ? 'Sending…' : 'Subscribe'}
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: PX.radius.pill,
                    background: PX.neutral700,
                    display: 'grid',
                    placeItems: 'center',
                  }}>
                    <PxIcon name="arrow-right" size={12} color={PX.neutral100} />
                  </span>
                </button>
              </form>

              {/* Social Media : pt-16, 4 icons size-16 */}
              <div style={{
                paddingTop: 16,
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
              }}>
                {([
                  ['facebook',  'https://facebook.com'],
                  ['twitter',   'https://twitter.com'],
                  ['instagram', 'https://instagram.com'],
                  ['linkedin',  'https://linkedin.com'],
                ] as const).map(([name, href]) => (
                  <a
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={name}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 16,
                      height: 16,
                      color: PX.neutral100,
                      textDecoration: 'none',
                    }}
                  >
                    <PxSocialIcon name={name} color="mono" size={16} />
                  </a>
                ))}
              </div>
            </div>

            {/* Bottom Content : flex-col gap-24, logo + copyright */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              alignItems: 'flex-start',
            }}>
              <PropertyXLogoLight />
              <p style={{
                margin: 0,
                width: 370,
                fontFamily: PX.font.display,
                fontSize: 16,
                fontWeight: 400,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
                color: PX.neutral300,
              }}>
                © 2026 MEGGA Real Estate. Tous droits réservés.
              </p>
            </div>
          </div>

          {/* Content Link : w-646 flex-col gap-64 items-start */}
          <div className="px-footer-right" style={{
            width: 646,
            display: 'flex',
            flexDirection: 'column',
            gap: 64,
            alignItems: 'flex-start',
          }}>
            {/* Columns 1 : flex gap-52 — Main pages + 2 unnamed */}
            <div className="px-footer-cols" style={{
              width: '100%',
              display: 'flex',
              gap: 52,
              alignItems: 'flex-start',
            }}>
              <LinkColumn col={COL_MAIN} />
              <LinkColumn col={COL_PROPS_LINKS} />
              <LinkColumn col={COL_BLOG_LINKS} />
            </div>

            {/* Columns 2 : flex gap-52 — Utility + Contact + Sales/Help */}
            <div className="px-footer-cols" style={{
              width: '100%',
              display: 'flex',
              gap: 52,
              alignItems: 'flex-start',
            }}>
              <LinkColumn col={COL_UTILITY} />

              {/* Contact us col (with title) */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}>
                <div style={{ height: 25, display: 'flex', alignItems: 'flex-start' }}>
                  <span style={{
                    fontFamily: PX.font.display,
                    fontSize: 20,
                    fontWeight: 500,
                    lineHeight: 1.25,
                    letterSpacing: '-0.6px',
                    color: PX.neutral100,
                    whiteSpace: 'nowrap',
                  }}>Contact us</span>
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  paddingTop: 24,
                }}>
                  {CONTACT_PRIMARY.map(item => (
                    <ContactInfo key={item.value} {...item} />
                  ))}
                </div>
              </div>

              {/* Sales/Help col (no title) */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}>
                <div style={{ height: 25, width: 123 }} />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  paddingTop: 24,
                }}>
                  {CONTACT_SECONDARY.map(item => (
                    <ContactInfo key={item.value} {...item} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
