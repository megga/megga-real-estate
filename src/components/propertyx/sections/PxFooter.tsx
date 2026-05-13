// MEGGA Marketplace — Property X footer.
// Source : Figma Footer/V1 node 9643:27743 (y=8363, h=996).
// Layout fidèle :
//   - LEFT (big) : titre + paragraphe + subscribe + 4 social icons
//   - RIGHT TOP : 3 cols de liens (Main pages / Properties / Blog)
//   - RIGHT BOTTOM : Utility Pages + Contact us (avec icônes)
//   - BOTTOM LEFT : logo + copyright

import { PX, PxLogo, PxLink, PxInput, PxButton, PxSocialIcon, PxIcon } from '..'

// 3 colonnes principales (en haut à droite)
const COL_MAIN = {
  title: 'Pages principales',
  links: [
    { label: 'Accueil', to: '/' },
    { label: 'Acheter', to: '/acheter' },
    { label: 'Louer', to: '/louer' },
    { label: 'Vendre', to: '/vendre' },
    { label: 'Estimations', to: '/estimations' },
    { label: 'Carte', to: '/carte' },
    { label: 'Portail vendeur', to: '/portail' },
  ],
}

const COL_PROPS = {
  title: 'Marketplace',
  links: [
    { label: 'Bien individuel', to: '/listing' },
    { label: 'Agents', to: '/agents' },
    { label: 'Agence', to: '/agences' },
    { label: 'Publier un bien gratuit', to: '/publier?type=free' },
    { label: 'Publier un bien premium', to: '/publier?type=premium' },
    { label: 'Annonces favorites', to: '/favoris' },
    { label: 'Alertes biens', to: '/alertes' },
  ],
}

const COL_RESOURCES = {
  title: 'Ressources',
  links: [
    { label: 'Blog', to: '/blog' },
    { label: 'Guides', to: '/guides' },
    { label: 'Glossaire', to: '/glossaire' },
    { label: 'FAQ', to: '/aide/faq' },
    { label: 'Statut système', to: '/aide/statut' },
    { label: 'Recrutement', to: '/jobs' },
    { label: 'Presse', to: '/presse' },
  ],
}

// Colonne utility pages (sous main pages)
const COL_UTILITY = {
  title: 'Utility',
  links: [
    { label: 'Centre d\'aide', to: '/aide' },
    { label: 'Style guide', to: '/style-guide' },
    { label: 'Confidentialité', to: '/privacy' },
    { label: 'CGV', to: '/cgv' },
    { label: 'Cookies', to: '/cookies' },
    { label: 'Mentions légales', to: '/legal' },
  ],
}

// Contact us : 4 items avec icônes
const CONTACT_ITEMS = [
  { icon: 'mail',  label: 'Email général',     value: 'support@megga.ch',  href: 'mailto:support@megga.ch' },
  { icon: 'phone', label: 'Téléphone',          value: '+41 22 555 01 02',  href: 'tel:+41225550102' },
  { icon: 'mail',  label: 'Commercial',         value: 'sales@megga.ch',     href: 'mailto:sales@megga.ch' },
  { icon: 'message', label: 'Support',          value: 'help@megga.ch',      href: 'mailto:help@megga.ch' },
] as const

function LinkColumn({ col }: { col: typeof COL_MAIN }) {
  return (
    <div>
      <h4 style={{
        margin: '0 0 16px',
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        color: PX.neutral100,
        letterSpacing: '-0.48px',
      }}>{col.title}</h4>
      <ul style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {col.links.map(l => (
          <li key={l.label}>
            <PxLink to={l.to} variant="light">{l.label}</PxLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function PxFooter() {
  return (
    <footer style={{
      padding: `${PX.sectionDefault}px 24px ${PX.sectionRegular}px`,
      background: PX.neutral100,
    }}>
      {/* Container fond noir, comme une grosse card */}
      <div style={{
        maxWidth: 1392,
        margin: '0 auto',
        background: PX.inkBg,
        borderRadius: PX.radius.large,
        color: PX.neutral100,
        padding: '64px 56px 32px',
      }}>
        {/* Top : LEFT (subscribe) + RIGHT (3 cols liens) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 2.5fr',
          gap: 64,
          paddingBottom: 48,
          borderBottom: `1px solid ${PX.borderInverse}`,
        }}>
          {/* LEFT : Title + paragraph + subscribe + social */}
          <div>
            <h3 style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 32,
              lineHeight: 1.18,
              letterSpacing: '-0.96px',
              fontWeight: 500,
              color: PX.neutral100,
              maxWidth: 380,
            }}>
              Découvrez les meilleures opportunités du marché
            </h3>
            <p style={{
              margin: '16px 0 24px',
              fontFamily: PX.font.sans,
              fontSize: 14,
              lineHeight: 1.5,
              letterSpacing: '-0.42px',
              color: 'rgba(255,255,255,0.72)',
              maxWidth: 380,
            }}>
              Recevez chaque semaine une sélection curatée de biens et nos analyses du marché suisse romand.
            </p>
            <form onSubmit={e => e.preventDefault()} style={{ maxWidth: 380, marginBottom: 24 }}>
              <PxInput
                variant="dark"
                type="email"
                placeholder="votre@email.ch"
                rightSlot={
                  <PxButton type="submit" variant="invert" size="sm" showIcon>
                    S'inscrire
                  </PxButton>
                }
              />
            </form>
            <div style={{ display: 'flex', gap: 8 }}>
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
                    width: 36,
                    height: 36,
                    borderRadius: PX.radius.pill,
                    background: 'rgba(255,255,255,0.08)',
                    color: PX.neutral100,
                    textDecoration: 'none',
                  }}
                >
                  <PxSocialIcon name={name} color="mono" size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* RIGHT : 3 cols de liens */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 32,
          }}>
            <LinkColumn col={COL_MAIN} />
            <LinkColumn col={COL_PROPS} />
            <LinkColumn col={COL_RESOURCES} />
          </div>
        </div>

        {/* Middle : Utility + Contact */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 2.5fr',
          gap: 64,
          padding: '40px 0',
          borderBottom: `1px solid ${PX.borderInverse}`,
        }}>
          {/* Logo (place du subscribe) — placeholder vide à gauche */}
          <div />

          {/* Utility + Contact (3 cols : Utility | Contact1 | Contact2) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 32,
            alignItems: 'start',
          }}>
            <LinkColumn col={COL_UTILITY} />

            {/* Contact us */}
            <div style={{ gridColumn: 'span 2' }}>
              <h4 style={{
                margin: '0 0 16px',
                fontFamily: PX.font.display,
                fontSize: 16,
                fontWeight: 500,
                color: PX.neutral100,
                letterSpacing: '-0.48px',
              }}>Contact</h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}>
                {CONTACT_ITEMS.map(item => (
                  <a
                    key={item.value}
                    href={item.href}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <span style={{
                      width: 24,
                      height: 24,
                      borderRadius: PX.radius.pill,
                      background: 'rgba(255,255,255,0.08)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}>
                      <PxIcon name={item.icon as 'mail' | 'phone' | 'message'} size={12} color="rgba(255,255,255,0.72)" />
                    </span>
                    <div>
                      <div style={{
                        fontFamily: PX.font.sans,
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.48)',
                        letterSpacing: '-0.36px',
                      }}>{item.label}</div>
                      <div style={{
                        fontFamily: PX.font.display,
                        fontSize: 14,
                        fontWeight: 500,
                        letterSpacing: '-0.42px',
                        color: PX.neutral100,
                        marginTop: 2,
                      }}>{item.value}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom : logo + copyright */}
        <div style={{
          paddingTop: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
        }}>
          <PxLogo variant="light" form="text" size="sm" to="/" />
          <div style={{
            fontFamily: PX.font.sans,
            fontSize: 13,
            letterSpacing: '-0.4px',
            color: 'rgba(255,255,255,0.48)',
          }}>
            © {new Date().getFullYear()} MEGGA Real Estate · Genève, Suisse · Tous droits réservés
          </div>
        </div>
      </div>
    </footer>
  )
}
