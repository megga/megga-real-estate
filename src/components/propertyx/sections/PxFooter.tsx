// MEGGA Marketplace — Property X "Footer".
// Source : Figma node 9643:27743 — sous-composant "Container" (I9643:27743;11800:19962).
// Le node 9643:27743 (Footer/V1) regroupe deux blocs :
//   1. Cards Wrapper (Post a free / paid property) → PxPostProperty.tsx
//   2. Container Footer (dark, links, copyright) → CE FICHIER
//
// Structure fidèle Figma :
//   <Footer wrapper : px-24 pb-24 flex-col gap-24 (mais déjà géré par PostProperty)>
//     <Container DARK : bg-neutral700, h-788, rounded-24, flex-col items-center justify-center>
//       <Grid Footer : w-1200 flex items-center justify-between>
//         <Left Content : w-410, flex-col gap-277 items-start>
//           <Top Content : title 36 + paragraph + input + social>
//           <Bottom Content : logo + copyright>
//         </Left>
//         <Content Link : w-646, flex-col gap-64>
//           <Columns 1 (3 cols gap-52) : Main pages + 8 links + 8 links>
//           <Columns 2 (3 cols gap-52) : Utility + Contact + Sales/Help>
//         </Content Link>
//       </Grid Footer>
//     </Container>
//   </Footer wrapper>

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PX, PxLogo, PxSocialIcon, PxIcon, PxFigmaIcon } from '..'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'

// ─── Colonnes de liens — texte EXACT Figma ──────────────────────────
const COL_MAIN = {
  title: 'Main pages',
  links: [
    { label: 'Home V1', to: '/' },
    { label: 'Home V2', to: '/' },
    { label: 'Home V3', to: '/' },
    { label: 'About', to: '/about' },
    { label: 'Properties', to: '/buy' },
    { label: 'Properties by location', to: '/buy' },
    { label: 'Properties by type of property', to: '/buy' },
    { label: 'Properties by type', to: '/buy' },
  ],
}

const COL_PROPS = {
  title: '',  // colonne sans titre (suit Main pages)
  links: [
    { label: 'Property single', to: '/listing' },
    { label: 'Agences', to: '/agencies' },
    { label: 'Page agence', to: '/agencies' },
    { label: 'Post a free property', to: '/publish?type=free' },
    { label: 'Post a paid property', to: '/publish?type=premium' },
    { label: 'Blog V1', to: '/blog' },
    { label: 'Blog V2', to: '/blog' },
    { label: 'Blog V3', to: '/blog' },
  ],
}

const COL_BLOG = {
  title: '',
  links: [
    { label: 'Blog post', to: '/blog' },
    { label: 'Contact V1', to: '/contact' },
    { label: 'Contact V2', to: '/contact' },
    { label: 'Contact V3', to: '/contact' },
    { label: 'FAQs', to: '/help/faq' },
    { label: 'Coming soon', to: '/coming-soon' },
    { label: 'Subscribe page', to: '/subscribe' },
  ],
}

const COL_UTILITY = {
  title: 'Utility Pages',
  links: [
    { label: 'Start here', to: '/start' },
    { label: 'Style guide', to: '/style-guide' },
    { label: 'Password protected', to: '/password' },
    { label: '404 not found', to: '/404' },
    { label: 'Licenses', to: '/licenses' },
    { label: 'Changelog', to: '/changelog' },
  ],
}

// Contact us : 2 infos (email + phone) — MEGGA conserve ses coordonnées localisées
const CONTACT_PRIMARY = [
  { icon: 'mail' as const, label: 'Email address', value: 'info@home.com' },
  { icon: 'phone' as const, label: 'Phone number', value: '(123) 456 - 7890', uppercase: true },
]

// Colonne 3 : Sales executives + Help & support
const CONTACT_SECONDARY = [
  { icon: 'briefcase' as const, label: 'Sales executives', value: 'sales@home.com' },
  { icon: 'message' as const, label: 'Help & support', value: 'support@home.com' },
]

// ─── Sous-composants ─────────────────────────────────────────────────

// Composant Link footer : 16/Regular neutral300 leading-1.25 ls -0.48
// pt-2 sur le wrapper texte (Figma "pt-xx-small")
function FooterLink({ to, label, emphasized }: { to: string; label: string; emphasized?: boolean }) {
  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        textDecoration: 'none',
      }}
    >
      <span style={{
        paddingTop: 2,
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: emphasized ? 500 : 400,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral300,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </Link>
  )
}

// Colonne de liens : titre 20 Display/4/Medium white + flex-col gap-14 pt-24
function LinkColumn({ col, placeholderWidth }: { col: typeof COL_MAIN; placeholderWidth?: number }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      flexShrink: 0,
    }}>
      {/* Title wrap : flex items-start, h auto si titre, h-25 si placeholder */}
      {col.title ? (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: PX.font.display,
            fontSize: 20,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.6px',
            color: PX.neutral100,
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}>{col.title}</span>
        </div>
      ) : (
        // Spacer placeholder Figma : h-25 (et w-85 ou w-123 selon colonne)
        <div style={{
          height: 25,
          width: placeholderWidth ?? 85,
          flexShrink: 0,
        }} />
      )}
      {/* Footer Column Links : flex-col gap-14 pt-24 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        paddingTop: 24,
        alignItems: 'flex-start',
        flexShrink: 0,
      }}>
        {col.links.map(l => (
          <FooterLink
            key={l.label}
            to={l.to}
            label={l.label}
            emphasized={Boolean('emphasized' in l && l.emphasized)}
          />
        ))}
      </div>
    </div>
  )
}

// Info Wrapper Contact : icon 24 (small icon V38/V39/V46/V29) + label + value
function ContactInfo({
  icon,
  label,
  value,
  uppercase,
}: {
  icon: 'mail' | 'phone' | 'briefcase' | 'message'
  label: string
  value: string
  uppercase?: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      gap: 6,
      alignItems: 'flex-start',
      flexShrink: 0,
    }}>
      {/* Small Icon container : size-24 */}
      <div style={{
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <PxIcon
          name={icon === 'briefcase' ? 'building' : icon === 'message' ? 'message' : icon}
          size={24}
          color={PX.neutral100}
          strokeWidth={1.6}
        />
      </div>
      {/* Wrapper text : pt-2, flex-col gap-6, items-start */}
      <div style={{
        paddingTop: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        alignItems: 'flex-start',
        flexShrink: 0,
      }}>
        {/* Label : 16/Regular neutral400 leading-1.5 ls -0.48 */}
        <span style={{
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral400,
          whiteSpace: 'nowrap',
        }}>{label}</span>
        {/* Value : 16/Medium neutral100 leading-1.25 ls -0.48 */}
        <span style={{
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral100,
          whiteSpace: 'nowrap',
          textTransform: uppercase ? 'uppercase' : undefined,
        }}>{value}</span>
      </div>
    </div>
  )
}

// ─── Composant principal ─────────────────────────────────────────────

export default function PxFooter() {
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
      .insert({ email: trimmed, lang, source: 'px_footer' })
    setSubmitting(false)
    if (error && error.code !== '23505') {
      toast.error('Inscription échouée — réessayez dans un instant.')
      return
    }
    setEmail('')
    toast.success('Merci, votre inscription est confirmée.')
  }

  return (
    <footer style={{
      paddingLeft: 24,
      paddingRight: 24,
      paddingBottom: 24,
      background: PX.neutral100,
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      alignItems: 'center',
      width: '100%',
    }}>
      {/* Container DARK : bg-neutral700, h-788, rounded-24, w-full,
          flex-col items-center justify-center */}
      <div style={{
        width: '100%',
        maxWidth: 1392,
        height: 788,
        background: PX.neutral700,
        borderRadius: PX.sectionPadding.small, // 24
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {/* Grid Footer : w-1200, flex items-center justify-between */}
        <div style={{
          width: 1200,
          maxWidth: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          {/* ─── Left Content : w-410, flex-col gap-277 items-start ─────────── */}
          <div style={{
            width: 410,
            display: 'flex',
            flexDirection: 'column',
            gap: 277,
            alignItems: 'flex-start',
            flexShrink: 0,
          }}>
            {/* Top Content : flex-col items-start justify-center */}
            <div style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {/* Title : 36 Display/7/Medium tracking-1.08 white w-410, leading 1.25 */}
              <p style={{
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
              </p>

              {/* Paragraph wrap : pb-32 pt-16, flex-col justify-center items-start */}
              <div style={{
                paddingTop: 16,
                paddingBottom: 32,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <p style={{
                  margin: 0,
                  height: 48,
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
              </div>

              {/* Input Text pill : bg-neutral600, pl-16 pr-6 py-6, min-h-52, rounded-pill, w-410 */}
              <form
                onSubmit={handleNewsletterSubmit}
                style={{
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
                  flexShrink: 0,
                }}
              >
                {/* Placeholder Wrapper : flex-1 gap-6 items-center */}
                <div style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                }}>
                  {/* Wrapper : pt-2, flex items-center justify-center */}
                  <div style={{
                    paddingTop: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
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
                        background: 'transparent',
                        border: 0,
                        outline: 'none',
                        fontFamily: PX.font.display,
                        fontSize: 16,
                        fontWeight: 400,
                        lineHeight: 1.25,
                        letterSpacing: '-0.48px',
                        color: PX.neutral100,
                        width: '100%',
                      }}
                    />
                  </div>
                </div>

                {/* Subscribe Primary Button : bg-white, pl-16 pr-6 py-6, gap-6, rounded-pill */}
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
                    color: PX.neutral700,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}>{submitting ? 'Sending…' : 'Subscribe'}</span>
                  {/* Icon circle : bg-neutral700, size-28, rounded-pill */}
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: PX.radius.pill,
                    background: PX.neutral700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <PxFigmaIcon name="arrow-right" size={12} color={PX.neutral100} />
                  </span>
                </button>
              </form>

              {/* Social Media : pt-16, gap-16, 4 icons size-16 */}
              <div style={{
                paddingTop: 16,
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
                flexShrink: 0,
              }}>
                {([
                  ['facebook',  'https://facebook.com/megga'],
                  ['twitter',   'https://twitter.com/megga'],
                  ['instagram', 'https://instagram.com/megga'],
                  ['linkedin',  'https://linkedin.com/company/megga'],
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
                      flexShrink: 0,
                    }}
                  >
                    <PxSocialIcon name={name} color="mono" size={16} />
                  </a>
                ))}
              </div>
            </div>

            {/* Bottom Content : flex-col gap-24 items-start */}
            <div style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              alignItems: 'flex-start',
              flexShrink: 0,
            }}>
              {/* Logo Wrapper : flex items-start, contient Logo Full/Light gap-8.4 items-center */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                flexShrink: 0,
              }}>
                <PxLogo variant="light" form="text" size="sm" to="/" />
              </div>
              {/* Copyright : 16/Regular leading-1.25 ls-0.48 neutral300 w-370 */}
              <p style={{
                margin: 0,
                width: 370.648,
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

          {/* ─── Content Link : w-646.501, flex-col gap-64 items-start ──────── */}
          <div style={{
            width: 646.501,
            display: 'flex',
            flexDirection: 'column',
            gap: 64,
            alignItems: 'flex-start',
            flexShrink: 0,
          }}>
            {/* Columns 1 : flex gap-52 items-start w-full */}
            <div style={{
              width: '100%',
              display: 'flex',
              gap: 52,
              alignItems: 'flex-start',
              flexShrink: 0,
            }}>
              <LinkColumn col={COL_MAIN} />
              <LinkColumn col={COL_PROPS} placeholderWidth={85} />
              <LinkColumn col={COL_BLOG} placeholderWidth={85} />
            </div>

            {/* Columns 2 : flex gap-52 items-start w-full */}
            <div style={{
              width: '100%',
              display: 'flex',
              gap: 52,
              alignItems: 'flex-start',
              flexShrink: 0,
            }}>
              {/* Utility Pages column (avec titre) */}
              <LinkColumn col={COL_UTILITY} />

              {/* Contact us column (titre + 2 info wrappers) */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                flexShrink: 0,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  flexShrink: 0,
                }}>
                  <span style={{
                    fontFamily: PX.font.display,
                    fontSize: 20,
                    fontWeight: 500,
                    lineHeight: 1.25,
                    letterSpacing: '-0.6px',
                    color: PX.neutral100,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}>Contact us</span>
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  paddingTop: 24,
                  alignItems: 'flex-start',
                  flexShrink: 0,
                }}>
                  {CONTACT_PRIMARY.map(item => (
                    <ContactInfo key={item.value} {...item} />
                  ))}
                </div>
              </div>

              {/* Sales/Help column (placeholder titre w-123 h-25, pas de titre visible) */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                flexShrink: 0,
              }}>
                <div style={{ height: 25, width: 123, flexShrink: 0 }} />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  paddingTop: 24,
                  alignItems: 'flex-start',
                  flexShrink: 0,
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
