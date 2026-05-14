// MEGGA Marketplace — Property X "Footer V3" (variant compact).
// Source : Figma node 9631:9808 — frame "Footer V3".
// Différent du Footer V1 (PxFooter) : version courte (308px) utilisée par
// les pages secondaires (Coming Soon, Subscribe, etc.).
//
// Structure fidèle Figma :
//   <Footer V3 : w-1440 h-308, bg neutre100 (page bg)>
//     <Container DARK absolu inset[-0.05% 1.6% 7.47% 1.6%], rounded-24>
//       <Container Default : left-143 top-47.83 w-1108 max-w-1154 px-24>
//         <Flex Vertical : gap-24 items-center flex-1>
//           <Logo Wrapper : Logo Full/Light size 23 + text 26×107>
//           <List Nav Menu : 4 "Link item" gap-16>
//         </Flex Vertical>
//       </Container Default>
//       <Divider absolu : left-120.5 top-171 w-1199.5 h-0 0.5px>
//       <Copyright contents : left-119.5 top-217 w-647>
//       <Social icons : left-1208 top-(217+8) gap-16 size-16>
//     </Container DARK>
//   </Footer V3>

import { Link } from 'react-router-dom'
import { PX, PxLogo, PxSocialIcon } from '..'

// Nav links — texte EXACT Figma "Link item" ×4
const NAV_LINKS = [
  { label: 'Link item', to: '/' },
  { label: 'Link item', to: '/' },
  { label: 'Link item', to: '/' },
  { label: 'Link item', to: '/' },
] as const

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex',
        alignItems: 'flex-start',
        padding: 4,  // mg-tiny
        textDecoration: 'none',
      }}
    >
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}>
        {/* Wrapper text : pt-2 */}
        <span style={{
          paddingTop: 2,
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral100,
          whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
      </span>
    </Link>
  )
}

export default function PxFooterV3() {
  return (
    <footer style={{
      position: 'relative',
      width: '100%',
      maxWidth: PX.containerDesktop,
      margin: '0 auto',
      height: 308,
    }}>
      {/* Container DARK : absolu, inset[-0.05% 1.6% 7.47% 1.6%], rounded-24 */}
      <div style={{
        position: 'absolute',
        top: '-0.05%',
        right: '1.6%',
        bottom: '7.47%',
        left: '1.6%',
        background: PX.neutral700,
        borderRadius: PX.sectionPadding.small,  // 24
      }} />

      {/* Container Default : flex items-center justify-center, max-w-1154, px-24, w-1108
          positionné absolu left-143 top-47.83 */}
      <div style={{
        position: 'absolute',
        top: 47.83,
        left: 143,
        width: 1108,
        maxWidth: 1154,
        paddingLeft: 24,
        paddingRight: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Flex Vertical : flex-1, flex-col gap-24 items-center min-w-px */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          alignItems: 'center',
        }}>
          {/* Logo Wrapper : flex items-start */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
          }}>
            <PxLogo variant="light" form="text" size="sm" to="/" />
          </div>

          {/* List Nav Menu : flex gap-16 items-center overflow-clip */}
          <div style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            overflow: 'hidden',
          }}>
            {NAV_LINKS.map((link, i) => (
              <NavLink key={i} to={link.to} label={link.label} />
            ))}
          </div>
        </div>
      </div>

      {/* Divider absolu : left-120.5 top-171 w-1199.5 h-0 (line 0.5px) */}
      <div style={{
        position: 'absolute',
        top: 171,
        left: 120.5,
        width: 1199.5,
        height: 0,
        borderTop: '0.5px solid rgba(255, 255, 255, 0.10)',
      }} />

      {/* Copyright : absolu left-119.5 top-217 w-647 */}
      <p style={{
        position: 'absolute',
        top: 217,
        left: 119.5,
        margin: 0,
        width: 647,
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral300,
      }}>
        Copyright © Property X | Designed by BRIX Templates - Powered by Webflow
      </p>

      {/* Social icons : absolu left-1208 top-217 (centrés sur cette ligne), gap-16, size-16
          translateY(-50%) sur top calc(50% + 73px) = (308/2 + 73) = 227 ⇒ -50% ⇒ centre à 227, donc top ≈ 219.
          Figma simplifie : on les place alignés avec le copyright */}
      <div style={{
        position: 'absolute',
        top: 217,
        left: 1208,
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
              flexShrink: 0,
            }}
          >
            <PxSocialIcon name={name} color="mono" size={16} />
          </a>
        ))}
      </div>
    </footer>
  )
}
