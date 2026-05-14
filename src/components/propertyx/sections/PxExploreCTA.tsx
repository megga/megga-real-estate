// MEGGA Marketplace — Property X "Explore CTA" section.
// Source : Figma maquette utilisateur — iPad seul flottant sur fond dark
// (le texte marketing "Get in touch / Explore your dream home / Start
// exploring" du template BRIX a été retiré pour fidélité maquette).
//
// Structure :
//   <Section>
//     <Container relative max-width 1392>
//       <Dark container w-100% h-624 rounded-24>
//       <iPad absolute left-80 top-50% w-870 h-627 zIndex 2>
//     </Container>
//   </Section>

import { PX } from '..'

export default function PxExploreCTA() {
  return (
    <section style={{
      paddingTop: 80,
      paddingBottom: 80,
      paddingLeft: 24,
      paddingRight: 24,
      background: PX.neutral100,
    }}>
      <div style={{
        position: 'relative',
        maxWidth: 1392,
        margin: '0 auto',
        minHeight: 624,  // Figma section height
      }}>
        {/* Container DARK : bg-neutral700, full width, rounded-24.
            Hauteur fixée à 624 (la section). L'iPad seul flotte par-dessus,
            fidèle maquette utilisateur — pas de texte marketing à droite. */}
        <div style={{
          background: PX.neutral700,
          width: '100%',
          height: 624,
          borderRadius: PX.radius.large,
          position: 'relative',
          zIndex: 1,
          boxSizing: 'border-box',
        }} />

        {/* iPad mockup : rendu Figma node 11748:15191 utilisé tel quel (PNG)
            → fidélité pixel-perfect garantie sans recréer le contenu en React.
            Dimensions Figma 1852×1335 → ratio 1.388:1, scalé à w-870 h-627.
            Position : fully visible dans le viewport (left:80 met l'iPad à
            x=104 dans le viewport, fini de couper à gauche). */}
        <div style={{
          position: 'absolute',
          left: 80,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 870,
          height: 627,
          zIndex: 2,
        }}>
          <img
            src="/images/sections/cta/ipad-property.png"
            alt="Property X iPad preview"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 8px 24px rgba(25, 33, 61, 0.12))',
            }}
          />
        </div>
      </div>
    </section>
  )
}
