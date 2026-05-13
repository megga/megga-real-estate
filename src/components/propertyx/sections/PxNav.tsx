// MEGGA Marketplace — Property X "Header/V1" navigation.
// Source : Figma node 11754:23870 — code Figma exact.
//
// Structure fidèle :
//   <section py-24 flex-col items-center>
//     <Container w-1200 flex justify-between items-center>
//       <Left Content flex gap-24 items-center>
//         <Logo Text Light (icon 22 + text image)>
//         <Nav List flex gap-16 items-center>
//           <Link "Home" 16/Medium neutral700>
//           <Link "About">
//           <Link "Pages" + chevron-down 16>
//           <Link "Cart (0)">
//         </Nav List>
//       </Left Content>
//       <PrimaryButton DARK "Start exploring">
//     </Container>
//   </section>
//
// Note : flow normal (PAS absolute) — la nav prend sa place avant le hero.

import { Link } from 'react-router-dom'
import { PX, PxButton, PxIcon, PxLogo } from '..'

interface PxNavProps {
  // glass était l'ancien prop "overlay sur hero" — Figma a la nav en flow normal
  // donc on l'ignore mais on garde pour backward compat avec PropertyXHomePage
  glass?: boolean
}

const NAV_LINKS = [
  { label: 'Accueil', to: '/' },
  { label: 'Acheter', to: '/acheter' },
  { label: 'Louer', to: '/louer' },
  { label: 'Vendre', to: '/vendre' },
] as const

export default function PxNav(_props: PxNavProps) {
  return (
    <header style={{
      // Section : py-24 px-0, flex-col items-center
      paddingTop: 24,
      paddingBottom: 24,
      paddingLeft: 0,
      paddingRight: 0,
      background: PX.neutral100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      // PAS absolute — flow normal (fidèle Figma)
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Container : w-1200 flex justify-between items-center */}
      <div style={{
        width: 1200,
        maxWidth: '100%',
        paddingLeft: 24,
        paddingRight: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Left Content : flex gap-32 items-center (gap augmenté pour lisibilité) */}
        <div style={{
          display: 'flex',
          gap: 32,
          alignItems: 'center',
        }}>
          {/* Logo Text Light : icon 22 + text — taille md pour mieux le voir */}
          <PxLogo variant="dark" form="text" size="md" to="/" />
          {/* Nav List : flex gap-24 items-center (gap +) */}
          <nav style={{
            display: 'flex',
            gap: 24,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {NAV_LINKS.map(link => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  textDecoration: 'none',
                  fontFamily: PX.font.display,
                  // Taille augmentée : 16 → 18 pour meilleure lisibilité
                  fontSize: 18,
                  fontWeight: 500,
                  lineHeight: 1.25,
                  letterSpacing: '-0.54px',
                  color: PX.neutral700,
                }}
              >
                {link.label}
              </Link>
            ))}
            {/* Pages dropdown link (fidèle Figma) */}
            <Link
              to="/services"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
                fontFamily: PX.font.display,
                fontSize: 18,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: '-0.54px',
                color: PX.neutral700,
              }}
            >
              Plus
              <PxIcon name="chevron-down" size={18} color={PX.neutral700} />
            </Link>
          </nav>
        </div>

        {/* PrimaryButton DARK "Start exploring" — taille lg pour cohérence
            avec les liens nav agrandis */}
        <PxButton to="/acheter" variant="primary" size="lg">
          Commencer
        </PxButton>
      </div>
    </header>
  )
}
