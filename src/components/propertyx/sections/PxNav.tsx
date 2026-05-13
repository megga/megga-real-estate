// MEGGA Marketplace — Property X top navigation.
// Refactor utilisant les atomes du DS (PxLogo, PxLink, PxButton).

import { PX, PxLogo, PxLink, PxButton } from '..'

interface PxNavProps {
  glass?: boolean  // overlay sur fond photo (texte clair)
}

const NAV_LINKS = [
  { label: 'Acheter', to: '/acheter' },
  { label: 'Louer', to: '/louer' },
  { label: 'Vendre', to: '/vendre' },
  { label: 'Estimations', to: '/estimations' },
]

export default function PxNav({ glass = false }: PxNavProps) {
  const variant: 'dark' | 'light' = glass ? 'light' : 'dark'

  return (
    <header style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      zIndex: 10,
      padding: '24px 48px',
    }}>
      <div style={{
        maxWidth: PX.containerDesktop,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
      }}>
        {/* Logo + nav links groupés à gauche (fidèle Figma) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <PxLogo variant={glass ? 'light' : 'dark'} form="text" size="sm" to="/" />
          <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {NAV_LINKS.map(link => (
              <PxLink key={link.to} to={link.to} variant={variant}>
                {link.label}
              </PxLink>
            ))}
          </nav>
        </div>

        {/* CTA à droite (fidèle Figma) */}
        <PxButton to="/acheter" variant={glass ? 'invert' : 'primary'} size="sm">
          Commencer
        </PxButton>
      </div>
    </header>
  )
}
