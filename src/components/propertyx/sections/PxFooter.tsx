// MEGGA Marketplace — Property X footer.
// Footer noir massif : 4 colonnes de liens + newsletter signup à gauche
// + logo + crédits.

import { Link } from 'react-router-dom'
import { PX } from '../tokens'

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
      { label: 'Centre d\'aide', to: '/aide' },
      { label: 'Statut système', to: '/aide/statut' },
    ],
  },
]

function FooterLink({ link }: { link: { label: string; to?: string; href?: string } }) {
  const style: React.CSSProperties = {
    display: 'block',
    padding: '6px 0',
    fontSize: 13.5,
    color: PX.inkInverseSoft,
    textDecoration: 'none',
    transition: `color ${PX.duration.fast} ${PX.ease}`,
  }
  const handleEnter = (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.color = PX.inkInverse }
  const handleLeave = (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.color = PX.inkInverseSoft }
  if (link.href) {
    return <a href={link.href} style={style} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>{link.label}</a>
  }
  return <Link to={link.to!} style={style} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>{link.label}</Link>
}

export default function PxFooter() {
  return (
    <footer style={{
      padding: `${PX.space.section}px ${PX.space.pageX}px ${PX.space.sectionInner}px`,
      background: PX.inkBg,
      color: PX.inkInverse,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Bloc newsletter + colonnes */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
          gap: 48,
          paddingBottom: 56,
          borderBottom: `1px solid ${PX.borderInverse}`,
        }}>
          {/* Newsletter */}
          <div>
            <h3 style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 26,
              lineHeight: 1.18,
              letterSpacing: -0.5,
              fontWeight: 600,
              color: PX.inkInverse,
              maxWidth: 320,
            }}>
              Découvrez les meilleures opportunités du marché
            </h3>
            <p style={{
              margin: '12px 0 20px',
              fontSize: 13.5,
              lineHeight: 1.55,
              color: PX.inkInverseSoft,
              maxWidth: 320,
            }}>
              Recevez chaque semaine une sélection curatée de biens et nos analyses du marché suisse romand.
            </p>
            <form onSubmit={e => e.preventDefault()} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              padding: 4,
              borderRadius: PX.radiusPill,
              background: 'rgba(255,255,255,0.08)',
              maxWidth: 360,
            }}>
              <input type="email" placeholder="votre@email.ch" style={{
                flex: 1,
                background: 'transparent',
                border: 0,
                outline: 'none',
                padding: '10px 16px',
                fontSize: 13.5,
                color: PX.inkInverse,
                fontFamily: PX.font.sans,
              }} />
              <button type="submit" style={{
                background: PX.inkInverse,
                color: PX.ink,
                border: 0,
                borderRadius: PX.radiusPill,
                padding: '10px 18px',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: PX.font.sans,
              }}>S'inscrire</button>
            </form>
          </div>

          {/* 3 colonnes de liens */}
          {COLS.map(col => (
            <div key={col.title}>
              <h4 style={{
                margin: '0 0 12px',
                fontSize: 13,
                fontWeight: 700,
                color: PX.inkInverse,
                letterSpacing: 0.3,
              }}>{col.title}</h4>
              {col.links.map(l => <FooterLink key={l.label} link={l} />)}
            </div>
          ))}
        </div>

        {/* Bas du footer : logo + copyright */}
        <div style={{
          paddingTop: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <svg viewBox="0 0 694.81 419.02" width="36" height="22" aria-label="MEGGA">
              <path fill={PX.inkInverse} d="M212.94,0c46.64,5.38,88.55,22.94,122.21,59.67-22.79,28.12-37.71,60.3-47.08,96.28-7.89-14.68-16.56-27.02-28.35-37.25-40.39-35.04-99.55-30.53-134.81,9.66-40.25,45.89-40.1,117.16.48,162.82,35.48,39.93,94.73,44.05,134.83,8.67,14.5-12.89,25.12-28.95,32.24-48.42l-95.26-.1-.03-83.65,192.78-.02c8.8,28.23,5.09,73.7-2.86,101.4-22.71,79.15-85.98,140.1-169.06,149-2.17.23-4.11.34-5.1.93h-31c-42.03-4.33-81.34-20.79-113.04-49.92C-27.8,280.23-21.84,119.65,81.31,39.5,110.93,16.49,145.39,3.92,181.93,0h31.01Z"/>
              <path fill={PX.inkInverse} d="M511.94,419.01h-29c-47.56,0-91.35-24.53-123.87-60,24.65-30.5,36.53-57.89,47.2-96.18,7.43,14.3,16.5,27.51,28.71,37.93,36.96,31.55,90.34,30.86,126.22-1.89,13.97-12.75,24.27-28.48,31.18-47.43l-94.84-.08-.05-83.65,192.4-.03c2.59,9.14,3.94,17.82,4.5,27.2,4.34,72.2-25.1,142.48-83.13,186.34-29.43,22.24-63.45,34.03-99.32,37.8h0Z"/>
              <path fill={PX.inkInverse} d="M511.94,0c43.2,4.34,82.78,21.02,114.61,50.52,6.43,5.96,12.05,11.43,17.39,19.2l-56.72,84.95c-7.57-14.34-16.16-25.96-27.71-36.03-33.9-29.56-83.44-31.58-119.35-4.39-12.97,9.71-22.64,21.92-30.74,35.77l-101.14-.14c10.87-40.77,32.85-75.32,63.12-102.25C402.99,19.45,441.75,4.18,482.95.02h29-.01Z"/>
            </svg>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: PX.inkInverse }}>MEGGA Real Estate</span>
          </Link>
          <div style={{ fontSize: 12.5, color: PX.inkInverseMuted }}>
            © {new Date().getFullYear()} MEGGA Real Estate · Genève, Suisse · Tous droits réservés
          </div>
        </div>
      </div>
    </footer>
  )
}
