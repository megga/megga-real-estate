// MEGGA Marketplace — Property X "Footer/V1".
// Source : Figma node 9643:27743 — code Figma exact.
//
// Structure fidèle :
//   <section px-24 pb-24 flex-col gap-24>
//     (PostProperty Cards Wrapper est dans PxPostProperty séparément)
//     <Container DARK bg-neutral700, h-788, rounded-24, w-full>
//       <Grid Footer w-1200 flex items-center justify-between>
//         <Left Content w-410 flex-col gap-277 items-start>
//           <Top Content : title 36 + paragraph + input + social>
//           <Bottom Content : logo + copyright>
//         </Left>
//         <Content Link w-646 flex-col gap-64>
//           <Columns 1 (3 cols gap-52) : Main pages + Properties links + Blog links>
//           <Columns 2 (3 cols gap-52) : Utility + Contact + Sales/Help>
//         </Content Link>
//       </Grid Footer>
//     </Container>
//   </section>

import { Link } from 'react-router-dom'
import { PX, PxLogo, PxSocialIcon, PxIcon } from '..'

// Colonnes de liens — chaque colonne a un titre + une liste de liens
const COL_MAIN = {
  title: 'Pages principales',
  links: [
    { label: 'Accueil', to: '/' },
    { label: 'Acheter', to: '/acheter' },
    { label: 'Louer', to: '/louer' },
    { label: 'Vendre', to: '/vendre' },
    { label: 'À propos', to: '/about' },
    { label: 'Estimations', to: '/estimations' },
    { label: 'Carte', to: '/carte' },
    { label: 'Portail vendeur', to: '/portail' },
  ],
}

const COL_PROPS = {
  title: '',  // colonne sans titre (suit Main pages)
  links: [
    { label: 'Bien individuel', to: '/listing' },
    { label: 'Agents', to: '/agents' },
    { label: 'Agence', to: '/agences' },
    { label: 'Publier annonce gratuite', to: '/publier?type=free' },
    { label: 'Publier annonce premium', to: '/publier?type=premium' },
    { label: 'Blog', to: '/blog' },
    { label: 'Annonces favorites', to: '/favoris' },
    { label: 'Alertes biens', to: '/alertes' },
  ],
}

const COL_BLOG = {
  title: '',
  links: [
    { label: 'Article de blog', to: '/blog' },
    { label: 'Contact', to: '/contact' },
    { label: 'FAQ', to: '/aide/faq' },
    { label: 'Centre d\'aide', to: '/aide' },
    { label: 'Statut système', to: '/aide/statut' },
    { label: 'Recrutement', to: '/jobs' },
    { label: 'Presse', to: '/presse' },
    { label: 'Plus de templates', to: '/templates' },
  ],
}

const COL_UTILITY = {
  title: 'Utility',
  links: [
    { label: 'Centre d\'aide', to: '/aide' },
    { label: 'Style guide', to: '/style-guide' },
    { label: 'Confidentialité', to: '/privacy' },
    { label: 'CGV', to: '/cgv' },
    { label: 'Mentions légales', to: '/legal' },
    { label: 'Changelog', to: '/changelog' },
  ],
}

const CONTACT_PRIMARY = [
  { icon: 'mail' as const, label: 'Adresse email', value: 'info@megga.ch' },
  { icon: 'phone' as const, label: 'Téléphone', value: '+41 22 555 01 02' },
]

const CONTACT_SECONDARY = [
  { icon: 'briefcase' as const, label: 'Commercial', value: 'sales@megga.ch' },
  { icon: 'message' as const, label: 'Aide & support', value: 'support@megga.ch' },
]

// Composant Link footer : 16/Regular neutral300
function FooterLink({ to, label }: { to: string; label: string }) {
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
        fontWeight: 400,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral300,
      }}
    >
      {label}
    </Link>
  )
}

// Colonne de liens : titre 20 Display/4/Medium white + flex-col gap-14 pt-24
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
      {/* Links : flex-col gap-14 pt-24 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        paddingTop: 24,
      }}>
        {col.links.map(l => (
          <FooterLink key={l.label + l.to} to={l.to} label={l.label} />
        ))}
      </div>
    </div>
  )
}

// Info Wrapper Contact : icon 24 + label + value
function ContactInfo({ icon, label, value }: { icon: 'mail' | 'phone' | 'briefcase' | 'message'; label: string; value: string }) {
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
        <PxIcon
          name={icon === 'briefcase' ? 'building' : icon === 'message' ? 'message' : icon}
          size={24}
          color={PX.neutral100}
        />
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

export default function PxFooter() {
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
    }}>
      {/* Container DARK : bg-neutral700, h-788, rounded-24, w-full */}
      <div style={{
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
        {/* Grid Footer : w-1200 flex items-center justify-between */}
        <div style={{
          width: 1200,
          maxWidth: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}>
          {/* Left Content : w-410, flex-col gap-277 items-start */}
          <div style={{
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
                Découvrez des opportunités immobilières exclusives
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
                Recevez chaque semaine une sélection curatée de biens et nos analyses du marché suisse romand.
              </p>
              {/* Input pill : bg-neutral600, pl-16 pr-6 py-6, h-52, rounded-pill, w-410 */}
              <form onSubmit={e => e.preventDefault()} style={{
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
                  placeholder="votre@email.ch"
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
                {/* Subscribe button : bg-white, pl-16 pr-6 py-6, rounded-pill */}
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
                    border: 0,
                    borderRadius: PX.radius.pill,
                    cursor: 'pointer',
                    fontFamily: PX.font.display,
                    fontSize: 16,
                    fontWeight: 500,
                    lineHeight: 1.25,
                    letterSpacing: '-0.48px',
                    color: PX.neutral700,
                  }}
                >
                  S'inscrire
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
                    }}
                  >
                    <PxSocialIcon name={name} color="mono" size={16} />
                  </a>
                ))}
              </div>
            </div>

            {/* Bottom Content : flex-col gap-24 */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              alignItems: 'flex-start',
            }}>
              <PxLogo variant="light" form="text" size="md" to="/" />
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
                Copyright © {new Date().getFullYear()} MEGGA Real Estate · Genève, Suisse · Tous droits réservés
              </p>
            </div>
          </div>

          {/* Content Link : w-646, flex-col gap-64 items-start */}
          <div style={{
            width: 646,
            display: 'flex',
            flexDirection: 'column',
            gap: 64,
            alignItems: 'flex-start',
          }}>
            {/* Columns 1 : flex gap-52 — Main pages + 2 unnamed cols */}
            <div style={{
              width: '100%',
              display: 'flex',
              gap: 52,
              alignItems: 'flex-start',
            }}>
              <LinkColumn col={COL_MAIN} />
              <LinkColumn col={COL_PROPS} />
              <LinkColumn col={COL_BLOG} />
            </div>

            {/* Columns 2 : flex gap-52 — Utility + Contact + Sales/Help */}
            <div style={{
              width: '100%',
              display: 'flex',
              gap: 52,
              alignItems: 'flex-start',
            }}>
              <LinkColumn col={COL_UTILITY} />

              {/* Contact us col with title */}
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
                  }}>Contact</span>
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
