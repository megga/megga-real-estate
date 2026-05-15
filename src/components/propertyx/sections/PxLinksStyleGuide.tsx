// MEGGA Marketplace — Property X "🔗 Links" styleguide section.
// Source : Figma node 11708:31063 — code Figma EXACT.
//
// Page UI Kit Links : shell partagé (PxStyleguideShell) + showcase split bg :
//   - Panneau gauche light gray #EEEFF1 avec border-dashed neutral500
//   - Panneau droit dark #14161C (278px) avec right-side rounded
//   - 4 "Link item" : 2 dark variant (light bg) regular+medium + 2 light variant (dark bg) regular+medium

import { PX, PxLink } from '..'
import PxStyleguideShell, { PxStyleguideSectionTitle } from './PxStyleguideShell'

// ─── Showcase split bg ────────────────────────────────────────────────
function LinksShowcase() {
  return (
    <div
      data-node-id="11708:31221"
      style={{
        position: 'relative',
        width: 556,
        height: 180,
        borderRadius: PX.radius.large,
      }}
    >
      {/* Light gray bg with dashed border — node 11708:31222 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: PX.neutral300,
          border: `1.5px dashed ${PX.neutral500}`,
          borderRadius: PX.radius.large,
          boxShadow: PX.shadow.regular,
        }}
      />
      {/* Dark right panel (278×180) — node 11708:31223 */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 278,
          height: 180,
          background: PX.neutral700,
          borderTopRightRadius: PX.radius.large,
          borderBottomRightRadius: PX.radius.large,
        }}
      />

      {/* 4 Link items overlaid */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Left half : 2 dark links (regular + medium) */}
        <div
          style={{
            flex: '0 0 278px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
          }}
        >
          <PxLink to="#" variant="dark" weight="regular">Link item</PxLink>
          <PxLink to="#" variant="dark" weight="medium">Link item</PxLink>
        </div>
        {/* Right half : 2 light links (regular + medium) */}
        <div
          style={{
            flex: '0 0 278px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
          }}
        >
          <PxLink to="#" variant="light" weight="regular">Link item</PxLink>
          <PxLink to="#" variant="light" weight="medium">Link item</PxLink>
        </div>
      </div>
    </div>
  )
}

export default function PxLinksStyleGuide() {
  return (
    <PxStyleguideShell selected="links" title="Links" iconName="links-regular">
      {/* ─── Link item section ─── */}
      <div data-node-id="11708:31071" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', gap: 40 }}>
        <PxStyleguideSectionTitle title="Link item" />
        <LinksShowcase />
      </div>
    </PxStyleguideShell>
  )
}
