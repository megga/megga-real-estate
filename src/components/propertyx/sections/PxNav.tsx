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
import { PX, PxButton, PxLogo } from '..'

interface PxNavProps {
  // glass était l'ancien prop "overlay sur hero" — Figma a la nav en flow normal
  // donc on l'ignore mais on garde pour backward compat avec PropertyXHomePage
  glass?: boolean
  // Background optionnel — par défaut blanc (neutral100). Permet aux pages
  // sur fond gris (ex. /faq) de fondre la nav avec le fond de page.
  bg?: string
}

const NAV_LINKS = [
  { label: 'Accueil', to: '/' },
  { label: 'Acheter', to: '/acheter' },
  { label: 'Louer', to: '/louer' },
  { label: 'Vendre', to: '/vendre' },
] as const

export default function PxNav({ bg = PX.neutral100 }: PxNavProps) {
  return (
    <header style={{
      // Section : py-24 px-0, flex-col items-center
      paddingTop: 24,
      paddingBottom: 24,
      paddingLeft: 0,
      paddingRight: 0,
      // Bg paramétrable via le prop `bg` (default neutral100 blanc).
      // Submit Property + FAQ passent `bg={PX.neutral200}` ou `bg="transparent"`
      // pour unifier la nav avec le fond de page non-blanc.
      background: bg,
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
        {/* Left Content : flex gap-24 items-center (fidèle Figma) */}
        <div style={{
          display: 'flex',
          gap: 24,
          alignItems: 'center',
        }}>
          {/* Logo Text Light : icon 22 + text (taille sm = Figma) */}
          <PxLogo variant="dark" form="text" size="sm" to="/" />
          {/* Nav List : flex gap-16 items-center (fidèle Figma) */}
          <nav style={{
            display: 'flex',
            gap: 16,
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
                  justifyContent: 'center',
                  gap: 6,
                  // Figma : Wrapper texte pt-2 (xx-small) pour centrer optiquement
                  paddingTop: 2,
                  textDecoration: 'none',
                  fontFamily: PX.font.display,
                  // Fidèle Figma : Display/2/Medium = 16/1.25/-0.48
                  fontSize: 16,
                  fontWeight: 500,
                  lineHeight: 1.25,
                  letterSpacing: '-0.48px',
                  color: PX.neutral700,
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* CTA droite "Commencer" (Figma "Start exploring") — Primary Button size sm */}
        <PxButton to="/acheter" variant="primary" size="sm">
          Commencer
        </PxButton>
      </div>
    </header>
  )
}
