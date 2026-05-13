// MEGGA Marketplace — Property X footer.
// Refactor avec PxLogo + PxLink + PxInput + PxButton.

import { PX, PxLogo, PxLink, PxInput, PxButton } from '..'

const COLS = [
  {
    title: 'Marketplace',
    links: [
      { label: 'Acheter', to: '/acheter' },
      { label: 'Louer', to: '/louer' },
      { label: 'Vendre', to: '/vendre' },
      { label: 'Estimations', to: '/estimations' },
      { label: 'Annuaire des agences', to: '/agences' },
      { label: 'Annuaire des agents', to: '/agents' },
    ],
  },
  {
    title: 'MEGGA',
    links: [
      { label: 'Services', to: '/services' },
      { label: 'Publier un bien', to: '/publier' },
      { label: 'Compte agent', to: '/login' },
      { label: 'Aide', to: '/aide' },
      { label: 'Confidentialité', to: '/privacy' },
    ],
  },
  {
    title: 'Contact',
    links: [
      { label: 'support@megga.ch', href: 'mailto:support@megga.ch' },
      { label: '+41 22 555 01 02', href: 'tel:+41225550102' },
      { label: "Centre d'aide", to: '/aide' },
      { label: 'Statut système', to: '/aide/statut' },
    ],
  },
]

export default function PxFooter() {
  return (
    <footer style={{
      padding: `${PX.sectionDefault}px 40px ${PX.sectionRegular}px`,
      background: PX.inkBg,
      color: PX.neutral100,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
          gap: 48,
          paddingBottom: 56,
          borderBottom: `1px solid ${PX.borderInverse}`,
        }}>
          <div>
            <h3 style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 26,
              lineHeight: 1.18,
              letterSpacing: '-0.78px',
              fontWeight: 500,
              color: PX.neutral100,
              maxWidth: 320,
            }}>
              Découvrez les meilleures opportunités du marché
            </h3>
            <p style={{
              margin: '12px 0 20px',
              fontFamily: PX.font.sans,
              fontSize: 14,
              lineHeight: 1.5,
              letterSpacing: '-0.42px',
              color: 'rgba(255,255,255,0.72)',
              maxWidth: 320,
            }}>
              Recevez chaque semaine une sélection curatée de biens et nos analyses du marché suisse romand.
            </p>
            <form onSubmit={e => e.preventDefault()} style={{ maxWidth: 380 }}>
              <PxInput
                variant="dark"
                type="email"
                placeholder="votre@email.ch"
                rightSlot={
                  <PxButton type="submit" variant="invert" size="sm" showIcon={false}>
                    S'inscrire
                  </PxButton>
                }
              />
            </form>
          </div>

          {COLS.map(col => (
            <div key={col.title}>
              <h4 style={{
                margin: '0 0 12px',
                fontFamily: PX.font.sans,
                fontSize: 14,
                fontWeight: 500,
                color: PX.neutral100,
                letterSpacing: '-0.42px',
                textTransform: 'uppercase',
              }}>{col.title}</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.links.map(l => (
                  <li key={l.label}>
                    {'href' in l && l.href
                      ? <PxLink href={l.href} variant="light">{l.label}</PxLink>
                      : <PxLink to={l.to!} variant="light">{l.label}</PxLink>
                    }
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

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
            fontSize: 14,
            letterSpacing: '-0.42px',
            color: 'rgba(255,255,255,0.48)',
          }}>
            © {new Date().getFullYear()} MEGGA Real Estate · Genève, Suisse · Tous droits réservés
          </div>
        </div>
      </div>
    </footer>
  )
}
